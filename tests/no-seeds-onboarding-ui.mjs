// Browser check of No Seeds sign-up and draft saving, with Supabase faked (no real emails or data).
// Sign up with email -> answer a step -> open the emailed link -> answers move to the account ->
// leave and come back -> continue at the right step -> submit for review.
// Run: node tests/no-seeds-onboarding-ui.mjs
import assert from 'node:assert/strict';
import { launchBrowser } from './browser-runtime.mjs';
import { staticServer } from './static-server.mjs';

const SUPABASE = 'https://btnrophnyfuwnqzwiooh.supabase.co';
const STORAGE_KEY = 'sb-btnrophnyfuwnqzwiooh-auth-token';
const USER = {id: '11111111-2222-4333-8444-555555555555', email: 'nia@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-13T00:00:00Z'};

// What the database holds for this person; the sign-up trigger fills first name and birthday.
let row = null;
const otpRequests = [];
const googleRequests = [];
const patches = [];
const newRow = (first_name, birth_date) => ({id: USER.id, status: 'draft', first_name, birth_date, gender: null, seeking: [], age_min: 25, age_max: 60,
  city: null, zip: null, relationship_goal: null, marriage_view: null, bio: null, prompts: [], basics: {}, interests: [], compatibility: {}, eligibility: {},
  pledge_accepted_at: null, review_note: null, profile_photos: []});

async function fakeSupabase(route) {
  const request = route.request();
  const url = new URL(request.url());
  const json = (status, body) => route.fulfill({status, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
  if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}});
  if (url.pathname === '/auth/v1/otp') {
    const body = request.postDataJSON();
    otpRequests.push(body);
    row = newRow(body.data.first_name, body.data.birth_date);
    return json(200, {});
  }
  // Google: the account is created with Google's first name (no birthday) and the browser returns signed in.
  if (url.pathname === '/auth/v1/authorize') {
    googleRequests.push(url);
    row = newRow('Ashley', null);
    const back = new URL(url.searchParams.get('redirect_to'));
    const session = JSON.parse(fakeSession());
    if (url.searchParams.get('code_challenge')) back.search = '?code=fake-code';
    else back.hash = new URLSearchParams({access_token: session.access_token, refresh_token: session.refresh_token, expires_in: '3600', expires_at: String(session.expires_at), token_type: 'bearer'}).toString();
    return route.fulfill({status: 302, headers: {location: back.href}});
  }
  if (url.pathname === '/auth/v1/token') return json(200, JSON.parse(fakeSession()));
  if (url.pathname === '/auth/v1/user') return json(200, USER);
  if (url.pathname === '/rest/v1/profiles' && request.method() === 'GET') return json(200, row ? [row] : []);
  if (url.pathname === '/rest/v1/profiles' && request.method() === 'PATCH') {
    assert.equal(url.searchParams.get('id'), `eq.${USER.id}`, 'only the member\'s own row is written');
    const body = request.postDataJSON();
    patches.push(body);
    row = {...row, ...body};
    return route.fulfill({status: 204, headers: {'access-control-allow-origin': '*'}});
  }
  return json(200, []);
}

const fakeSession = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({alg: 'HS256', typ: 'JWT'})}.${b64({sub: USER.id, role: 'authenticated', exp})}.sig`;
  return JSON.stringify({access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'fake-refresh', user: USER});
};

const server = await staticServer('prototype/no-seeds-public-beta/dist');
const runtime = await launchBrowser();
let passed = 0;
const check = async (name, fn) => {await fn(); passed++; console.log(`PASS  ${name}`);};
try {
  const context = await runtime.browser.newContext({viewport: {width: 390, height: 844}});
  await context.route(`${SUPABASE}/**`, fakeSupabase);
  let page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.url);

  await check('Create your account sends a sign-up link with first name and birthday', async () => {
    await page.click('#welcome-join');
    await page.click('#open-public-application');
    await page.waitForSelector('text=Create your account');
    await page.fill('[name=first_name]', 'Nia');
    await page.fill('[name=intake_email]', 'Nia@Example.com');
    await page.fill('[name=birth_date]', '1992-03-04');
    await page.click('.account-continue');
    await page.waitForSelector('text=2 of 10');
    assert.equal(otpRequests.length, 1);
    assert.equal(otpRequests[0].email, 'nia@example.com');
    assert.equal(otpRequests[0].create_user, true);
    assert.deepEqual(otpRequests[0].data, {first_name: 'Nia', birth_date: '1992-03-04'});
    assert.match(await page.textContent('.status'), /We emailed a sign-in link to nia@example.com/);
  });

  await check('steps answered before opening the link are kept on the phone (no second email)', async () => {
    await page.click('[data-public-back]');
    await page.waitForSelector('text=Create your account');
    await page.click('.account-continue');
    await page.waitForSelector('text=2 of 10');
    assert.equal(otpRequests.length, 1, 'going back and forward does not resend the email');
    await page.click('label[for=gender_woman]');
    await page.click('label[for=seeking_man]');
    await page.click('.account-continue');
    await page.waitForSelector('text=3 of 10');
    const draft = JSON.parse(await page.evaluate(() => localStorage.getItem('noSeedsPublicDraft')));
    assert.equal(draft.gender, 'Woman');
    assert.deepEqual(draft.seeking, ['Man']);
    assert.equal(patches.length, 0, 'nothing is written to the database before sign-in');
  });

  await check('opening the emailed link moves phone answers to the account and continues at step 3', async () => {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, fakeSession()]);
    await page.reload();
    await page.waitForSelector('text=3 of 10');
    assert.equal(patches.length, 1);
    assert.equal(row.first_name, 'Nia', 'first name saved at sign-up');
    assert.equal(row.birth_date, '1992-03-04', 'birthday saved at sign-up');
    assert.equal(row.gender, 'Woman');
    assert.deepEqual(row.seeking, ['Man']);
  });

  await check('each step saves to the account as soon as Continue is tapped', async () => {
    await page.fill('[name=city]', 'Atlanta');
    await page.fill('[name=zip]', '30303');
    await page.selectOption('[name=age_min]', '30');
    await page.selectOption('[name=age_max]', '45');
    await page.click('label[for=travelDistance_50_mi]');
    await page.click('label[for=willingToFly_maybe]');
    await page.click('.account-continue');
    await page.waitForSelector('text=4 of 10');
    assert.equal(row.city, 'Atlanta');
    assert.equal(row.zip, '30303');
    assert.deepEqual([row.age_min, row.age_max], [30, 45]);
    assert.equal(row.basics.travelDistance, '50 mi');
    assert.equal(row.basics.willingToFly, 'Maybe');
    await page.selectOption('[name=relationship_goal]', 'Marriage-minded');
    await page.selectOption('[name=marriage_view]', 'Want marriage');
    await page.click('.account-continue');
    await page.waitForSelector('text=5 of 10');
    assert.equal(row.relationship_goal, 'Marriage-minded');
  });

  await check('a returning member on a new phone reloads their saved draft and continues where they stopped', async () => {
    await page.close();
    const otherPhone = await runtime.browser.newContext({viewport: {width: 390, height: 844}});
    await otherPhone.route(`${SUPABASE}/**`, fakeSupabase);
    await otherPhone.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, [STORAGE_KEY, fakeSession()]);
    page = await otherPhone.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.url);
    await page.waitForSelector('text=5 of 10');
    await page.click('[data-public-back]');
    await page.waitForSelector('text=4 of 10');
    await page.click('[data-public-back]');
    await page.waitForSelector('text=3 of 10');
    assert.equal(await page.inputValue('[name=city]'), 'Atlanta', 'saved answers are shown, not a blank form');
    assert.equal(await page.inputValue('[name=age_min]'), '30');
  });

  await check('a finished profile is submitted to the account for founder review', async () => {
    row = {...row, eligibility: {black: true, noChildren: true, neverChildren: true, noStepParent: true, honest: true, respect: true},
      pledge_accepted_at: '2026-10-13T00:00:00Z', bio: 'Hi.', prompts: [{id: 'ordinary_sunday', answer: 'Market.'}, {id: 'green_flag', answer: 'Follow-through.'}]};
    await page.reload();
    await page.waitForSelector('text=Submit for review');
    await page.click('button[data-action=submit]');
    await page.waitForFunction(() => !document.querySelector('#intake-form'));
    assert.equal(patches.at(-1).status, 'submitted');
    assert.equal(row.status, 'submitted');
  });

  await check('Sign up with Google keeps the typed birthday, creates the account and continues at step 2', async () => {
    const phone = await runtime.browser.newContext({viewport: {width: 390, height: 844}});
    await phone.route(`${SUPABASE}/**`, fakeSupabase);
    page = await phone.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    patches.length = 0;
    await page.goto(server.url);
    await page.click('#welcome-join');
    await page.click('#open-public-application');
    await page.fill('[name=birth_date]', '1994-07-21');
    await page.click('#account-google');
    await page.waitForSelector('text=2 of 10');
    assert.equal(googleRequests.length, 1);
    assert.equal(googleRequests[0].searchParams.get('provider'), 'google');
    assert.equal(new URL(googleRequests[0].searchParams.get('redirect_to')).origin, server.url);
    assert.equal(row.first_name, 'Ashley', 'first name from Google');
    assert.equal(row.birth_date, '1994-07-21', 'birthday typed before tapping Google is saved');
    assert.ok(!page.url().includes('access_token'), 'tokens are cleared from the address bar');
  });

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`\nALL ${passed} CHECKS PASSED`);
} finally {
  await runtime.close();
  await server.close();
}

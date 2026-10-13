// Unit checks for prototype/no-seeds-public-beta/dist/onboarding-sync.js (no network, no browser).
// Run: node tests/no-seeds-onboarding-sync.mjs
import assert from 'node:assert/strict';
import { profilePatch, mergeDrafts, hasUnsavedAnswers, resumeStep, startAccount, saveDraftToServer, submitProfile, friendlyAuthError } from '../prototype/no-seeds-public-beta/dist/onboarding-sync.js';

let passed = 0;
const check = async (name, fn) => {await fn(); passed++; console.log(`ok - ${name}`);};

const ELIGIBLE = {black: true, noChildren: true, neverChildren: true, noStepParent: true, honest: true, respect: true};
const complete = {
  first_name: 'Nia', birth_date: '1992-03-04', gender: 'Woman', seeking: ['Man'], city: 'Atlanta', zip: '30303',
  relationship_goal: 'Long-term partner', eligibility: ELIGIBLE, pledge_accepted_at: '2026-10-13T00:00:00Z',
  prompts: [{id: 'ordinary_sunday', answer: 'Farmers market.'}, {id: 'green_flag', answer: 'Follow-through.'}],
};

// A fake supabase client that records what the app sends.
function fakeClient({error = null} = {}) {
  const calls = [];
  return {
    calls,
    auth: {signInWithOtp: async (args) => {calls.push(['otp', args]); return {data: {}, error};}},
    from: (table) => ({update: (values) => ({eq: async (column, value) => {calls.push(['update', table, values, column, value]); return {error};}})}),
  };
}

await check('profilePatch only sends member-writable columns and cleans bad values', () => {
  const patch = profilePatch({
    first_name: '  Nia  ', birth_date: '1992-02-30', gender: 'Robot', seeking: ['Man', 'Alien'], age_min: 70, age_max: 30,
    zip: '30303-1234', email: 'nia@example.com', status: 'approved', link_sent_to: 'x', id: 'someone-else',
    prompts: [{id: 'a', answer: ' yes '}, {id: 'b', answer: '   '}],
  });
  assert.equal(patch.first_name, 'Nia');
  assert.equal(patch.birth_date, null, 'Feb 30 is not a date');
  assert.equal(patch.gender, null);
  assert.deepEqual(patch.seeking, ['Man']);
  assert.deepEqual([patch.age_min, patch.age_max], [30, 70], 'inverted range is swapped');
  assert.equal(patch.zip, '30303');
  assert.deepEqual(patch.prompts, [{id: 'a', answer: 'yes'}]);
  for (const key of ['email', 'status', 'link_sent_to', 'id']) assert.ok(!(key in patch), `${key} must never be written`);
});

await check('mergeDrafts keeps saved answers and fills gaps from the phone', () => {
  const server = {first_name: 'Nia', birth_date: '1992-03-04', city: null, seeking: [], prompts: [], age_min: 25, age_max: 60, eligibility: {black: true}};
  const local = {first_name: 'Typo', city: 'Atlanta', seeking: ['Man'], prompts: [{id: 'x', answer: 'hi'}], age_min: 30, age_max: 45, eligibility: {noChildren: true}};
  const merged = mergeDrafts(server, local);
  assert.equal(merged.first_name, 'Nia', 'account wins');
  assert.equal(merged.city, 'Atlanta', 'phone fills the gap');
  assert.deepEqual(merged.seeking, ['Man']);
  assert.equal(merged.prompts[0].answer, 'hi');
  assert.deepEqual([merged.age_min, merged.age_max], [30, 45], 'range picked on the phone replaces the default');
  assert.deepEqual(merged.eligibility, {noChildren: true, black: true});
  assert.ok(hasUnsavedAnswers(server, merged));
  assert.ok(!hasUnsavedAnswers(merged, merged));
});

await check('mergeDrafts does not overwrite a saved age range', () => {
  const merged = mergeDrafts({age_min: 35, age_max: 50}, {age_min: 25, age_max: 70});
  assert.deepEqual([merged.age_min, merged.age_max], [35, 50]);
});

await check('resumeStep returns the first unfinished step', () => {
  assert.equal(resumeStep({}), 0);
  assert.equal(resumeStep({first_name: 'Nia', birth_date: '1992-03-04'}), 1);
  assert.equal(resumeStep({...complete, zip: '303'}), 2);
  assert.equal(resumeStep({...complete, relationship_goal: null}), 3);
  assert.equal(resumeStep({...complete, eligibility: {...ELIGIBLE, honest: false}}), 4);
  assert.equal(resumeStep({...complete, prompts: [complete.prompts[0]]}), 6);
  assert.equal(resumeStep(complete), 7, 'all required done, story not yet written');
  assert.equal(resumeStep({...complete, bio: 'Hi.'}), 9, 'everything written: go to preview and submit');
});

await check('startAccount sends an emailed link with first name and birthday as sign-up data', async () => {
  const client = fakeClient();
  await startAccount(client, {email: ' Nia@Example.com ', first_name: ' Nia ', birth_date: '1992-03-04'}, 'http://127.0.0.1/');
  const [, args] = client.calls[0];
  assert.equal(args.email, 'nia@example.com');
  assert.equal(args.options.shouldCreateUser, true);
  assert.equal(args.options.emailRedirectTo, 'http://127.0.0.1/');
  assert.deepEqual(args.options.data, {first_name: 'Nia', birth_date: '1992-03-04'});
});

await check('saveDraftToServer updates only the member\'s own row and keeps the status', async () => {
  const client = fakeClient();
  assert.equal(await saveDraftToServer(client, 'user-1', complete), null);
  const [, table, values, column, value] = client.calls[0];
  assert.deepEqual([table, column, value], ['profiles', 'id', 'user-1']);
  assert.ok(!('status' in values));
});

await check('submitProfile asks for review and passes database errors back', async () => {
  const ok = fakeClient();
  await submitProfile(ok, 'user-1', complete);
  assert.equal(ok.calls[0][2].status, 'submitted');
  const failing = fakeClient({error: {message: 'Profile is missing: two prompts'}});
  assert.equal((await submitProfile(failing, 'user-1', {})).message, 'Profile is missing: two prompts');
});

await check('friendlyAuthError explains rate limits plainly', () => {
  assert.match(friendlyAuthError({message: 'email rate limit exceeded'}), /Too many sign-in emails/);
  assert.match(friendlyAuthError({message: 'Unable to validate email address: invalid format'}), /doesn't look right/);
});

console.log(`\n${passed} onboarding sync checks passed`);

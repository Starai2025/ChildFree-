// Exercise real routing/render handlers with synthetic state and a minimal event-capable DOM.
// No network, member records, sign-in emails or approval writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {accountLanding, draftForAccount, resumeStep, mergeDrafts, hasUnsavedAnswers} from '../prototype/no-seeds-public-beta/dist/onboarding-sync.js';

const source = await readFile(new URL('../prototype/no-seeds-public-beta/dist/app.js', import.meta.url), 'utf8');
const cut = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const profile = {
  id: 'test-member', status: 'draft', first_name: 'Nia', birth_date: '1992-03-04', gender: 'Woman', seeking: ['Man'],
  city: 'Atlanta', zip: '30303', relationship_goal: 'Committed relationship', bio: 'A synthetic test profile.',
  prompts: [{id: 'ordinary_sunday', answer: 'Market.'}, {id: 'joy', answer: 'Live music.'}],
  eligibility: {black: true, noChildren: true, neverChildren: true, noStepParent: true, honest: true, respect: true},
  pledge_accepted_at: '2026-10-14T00:00:00Z', profile_photos: [], email: 'nia@example.com',
};

function harness(status = 'draft') {
  const events = new Map();
  const calls = [];
  const pending = [];
  let authListener;
  const state = {user: {id: profile.id, email: profile.email}, profile: {...profile, status}, photos: [],
    publicProfile: {...profile}, publicStep: 0, publicGateOpen: false, signInOpen: false, setupOverview: false,
    landingFor: null, tab: 'profile', saving: false, error: '', message: ''};
  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {value: profile.email, addEventListener(type, handler) {events.set(`${selector}:${type}`, handler);}});
      return elements.get(selector);
    },
    querySelectorAll() {return [];},
  };
  const context = vm.createContext({state, document, app: {innerHTML: ''}, queueMicrotask, history: {state: null, pushState() {}}, supabase: {auth: {
    getSession: async () => ({data: {session: state.user ? {user: state.user} : null}}),
    onAuthStateChange: listener => {authListener = listener;},
  }}, accountLanding, resumeStep, mergeDrafts, hasUnsavedAnswers,
    loadProfile: async () => calls.push('load-profile'),
    loadPublicDraft: () => ({}), savePublicDraft: () => calls.push('save-local'),
    saveDraftToServer: async () => {calls.push('save-account'); return null;},
    authErrorFromUrl: () => '',
    renderApp: () => calls.push(`app:${state.tab}`),
    renderPublicApplication: () => `<form id="intake-form">editor:${state.publicStep}</form>`,
    renderWelcome: () => {context.app.innerHTML = 'welcome'; calls.push('welcome');}, renderAgreement: () => {},
    renderLockup: () => '<div>No Seeds</div>', notice: () => state.error || state.message,
    escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    GOOGLE_G: '', BACK_ICON: '', setTimeout: fn => pending.push(fn), startTypingExpiryTimer: () => {}, window: {location: {origin: 'https://example.test'}, scrollTo() {}, addEventListener() {}},
    signIn: async email => calls.push(`email:${email}`), startGoogle: async () => ({error: null}), friendlyAuthError: e => e.message,
    signOut: async () => calls.push('signout'), formToPublicProfile: () => state.publicProfile,
  });
  vm.runInContext(cut('const PROFILE_STEPS = [', '\nconst state ='), context);
  vm.runInContext(cut('async function init()', 'async function load()'), context);
  vm.runInContext(cut('async function load() {', 'async function loadProfile()'), context);
  vm.runInContext(cut('async function savePublicApplication(', 'async function reencodeImage('), context);
  vm.runInContext(cut('function renderAuth() {', '// The one No Seeds logo'), context);
  return {state, calls, context, html: () => context.app.innerHTML,
    load: () => context.load(), render: () => context.renderAuth(), openSignIn: () => context.openSignIn(),
    init: () => context.init(),
    async authChange(event, session) {
      const previous = pending.length;
      authListener(event, session);
      for (const callback of pending.splice(previous)) await callback();
    },
    save: () => context.savePublicApplication({}),
    click: selector => events.get(`${selector}:click`)(),
    submit: selector => events.get(`${selector}:submit`)({preventDefault() {}}), elements};
}

let count = 0;
async function check(name, fn) {await fn(); count++; console.log(`PASS  ${name}`);}

await check('account states select setup, review status or Discover, with unknown states closed', () => {
  for (const status of ['draft', 'changes_requested']) assert.equal(accountLanding(status), 'setup');
  assert.equal(accountLanding('approved'), 'discover');
  for (const status of ['submitted', 'removed', undefined, 'forged']) assert.equal(accountLanding(status), 'status');
});
await check('a completed draft lands on setup summary instead of the photo editor', async () => {
  const h = harness(); await h.load();
  assert.match(h.html(), /Finish your profile/); assert.match(h.html(), /Continue setup/);
  assert.equal(h.state.publicStep, 9); assert.ok(!h.html().includes('editor:9'));
  h.click('#continue-setup'); assert.match(h.html(), /editor:9/); assert.equal(h.state.setupOverview, false);
});
await check('a draft with existing photos offers review rather than another photo upload', async () => {
  const h = harness(); h.state.photos = [{id: 'photo', position: 0}]; await h.load();
  assert.match(h.html(), />Review and submit</); assert.match(h.html(), /1 of 6 photos added/);
});
await check('a new or partially finished account continues at its first missing step', async () => {
  for (const [changes, expected] of [[{birth_date: null}, 0], [{gender: null}, 1], [{city: null}, 2]]) {
    const h = harness(); Object.assign(h.state.profile, changes); await h.load();
    assert.match(h.html(), /Finish your profile/); h.click('#continue-setup');
    assert.equal(h.state.publicStep, expected); assert.match(h.html(), new RegExp(`editor:${expected}`));
  }
});
await check('reviewing saved answers opens the first step without deleting them', async () => {
  const h = harness(); await h.load(); const before = JSON.stringify(h.state.publicProfile);
  h.click('#review-answers'); assert.equal(h.state.publicStep, 0);
  assert.equal(JSON.stringify(h.state.publicProfile), before);
});
await check('changes requested show a revision summary and the founder feedback', async () => {
  const h = harness('changes_requested'); h.state.profile.review_note = 'Update your bio.';
  await h.load(); assert.match(h.html(), /Update your profile/); assert.match(h.html(), /Update your bio/);
});
await check('submitted profiles open review status without reopening onboarding', async () => {
  const h = harness('submitted'); await h.load(); assert.deepEqual(h.calls, ['load-profile', 'app:status']);
  assert.equal(h.state.setupOverview, false); assert.equal(h.state.tab, 'status');
});
await check('approved profiles open Discover without changing approval', async () => {
  const h = harness('approved'); await h.load(); assert.equal(h.state.tab, 'discover');
  assert.equal(h.state.profile.status, 'approved'); assert.ok(!h.calls.includes('save-account'));
  h.state.tab = 'matches'; await h.load(); assert.equal(h.state.tab, 'matches', 'subsequent loads preserve chosen tab');
});
await check('approval and revision transitions change the landing page in the same session', async () => {
  const h = harness('submitted'); await h.load(); h.state.profile.status = 'approved'; await h.load();
  assert.equal(h.state.tab, 'discover');
  h.state.profile.status = 'changes_requested'; await h.load(); assert.equal(h.state.setupOverview, true);
});
await check('opening sign-in sends no email; only submitting its form requests a link', async () => {
  const h = harness(); h.state.user = null; h.openSignIn(); assert.match(h.html(), /Welcome <em>back<\/em>/);
  assert.ok(!h.html().includes('Create your account')); assert.deepEqual(h.calls, []);
  await h.submit('#signin-form'); assert.deepEqual(h.calls, [`email:${profile.email}`]);
});
await check('back to welcome preserves the draft and clears the sign-in notice', () => {
  const h = harness(); h.state.user = null; h.openSignIn(); h.state.message = 'Check your email';
  h.click('#signin-back'); assert.equal(h.html(), 'welcome'); assert.equal(h.state.publicProfile.first_name, 'Nia');
  assert.equal(h.state.message, ''); assert.equal(h.state.signInOpen, false);
});
await check('returning to setup after opening the editor does not reset an active step', async () => {
  const h = harness(); await h.load(); h.click('#continue-setup'); h.state.publicStep = 4;
  await h.load(); assert.equal(h.state.publicStep, 4); assert.equal(h.state.setupOverview, false);
});
await check('Save and finish later returns to setup after preserving the entered answers', async () => {
  const h = harness(); await h.load(); h.click('#continue-setup');
  h.state.publicProfile.bio = 'A newly entered test answer.'; await h.save();
  assert.match(h.html(), /Finish your profile/); assert.match(h.html(), /Your progress is saved/);
  assert.equal(h.state.publicProfile.bio, 'A newly entered test answer.');
  assert.ok(h.calls.includes('save-local')); assert.ok(h.calls.includes('save-account'));
});
await check('saved account drafts stay private across A sign-out and B sign-in, and A can recover its draft', () => {
  const storage = new Map();
  const userA = {id: 'account-A', email: 'a@example.invalid'}, userB = {id: 'account-B', email: 'b@example.invalid'};
  const ctx = vm.createContext({state: {user: userA, publicProfile: {...profile, email: userA.email}}, draftForAccount,
    localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
  });
  vm.runInContext(cut('function emptyPublicProfile()', 'function escapeHtml('), ctx);
  ctx.savePublicDraft();
  ctx.state.user = null;
  assert.equal(ctx.loadPublicDraft().first_name, null, 'signed-out welcome does not expose A');
  ctx.state.user = userB;
  const forB = ctx.loadPublicDraft(userB);
  assert.equal(forB.city, null); assert.equal(forB.pledge_accepted_at, null); assert.deepEqual({...forB.eligibility}, {});
  const serverB = {id: userB.id, first_name: 'B', email: userB.email, eligibility: {}, city: null};
  const mergedB = mergeDrafts(serverB, forB);
  assert.equal(mergedB.city, null); assert.deepEqual(mergedB.eligibility, {}); assert.equal(mergedB.pledge_accepted_at, null);
  ctx.state.publicProfile = {...forB, first_name: 'B', email: userB.email}; ctx.savePublicDraft();
  assert.equal(ctx.loadPublicDraft(userA).first_name, 'Nia');
  assert.equal(ctx.loadPublicDraft(userA).city, 'Atlanta', 'B saving does not overwrite A backup');
});
await check('pre-signup answers survive for their intended account, including Google birthday input', () => {
  const user = {id: 'account-A', email: 'nia@example.com'};
  const own = {email: ' NIA@EXAMPLE.COM ', city: 'Atlanta'};
  assert.equal(draftForAccount(own, user), own);
  const googleDraft = {birth_date: '1994-07-21'};
  assert.equal(draftForAccount(googleDraft, user), googleDraft);
  assert.deepEqual(draftForAccount({...own, email: 'other@example.com'}, user), {});
  assert.deepEqual(draftForAccount({_accountId: 'account-B', ...own}, user), {});
});
await check('session expiry or sign-out in another tab closes the previous account editor', async () => {
  const h = harness(); await h.init(); h.click('#continue-setup');
  assert.match(h.html(), /editor:9/);
  h.state.saving = true;
  await h.authChange('SIGNED_OUT', null);
  assert.equal(h.html(), 'welcome'); assert.equal(h.state.user, null);
  assert.equal(h.state.publicProfile.first_name, undefined); assert.equal(h.state.publicGateOpen, false);
  assert.equal(h.state.setupOverview, false); assert.equal(h.state.signInOpen, false);
  assert.equal(h.state.saving, false, 'abandoned consent/submission cannot keep a new session busy');
});
await check('same-account token refresh preserves unsaved edits and the current screen', async () => {
  const h = harness(); await h.init(); h.click('#continue-setup'); h.state.publicStep = 3;
  h.state.publicProfile.bio = 'Unsaved synthetic edit';
  await h.authChange('TOKEN_REFRESHED', {user: h.state.user});
  assert.equal(h.state.publicStep, 3); assert.equal(h.state.publicProfile.bio, 'Unsaved synthetic edit');
  assert.equal(h.state.setupOverview, false);
});
console.log(`\nALL ${count} ACCOUNT ROUTING CHECKS PASSED`);

import test from 'node:test';
import assert from 'node:assert/strict';
import { candidates, canDiscover, connections, createDemo, demoStateSchema, exportOwnDemo, member, pairId, transition, type DemoState } from '../packages/domain/src/demo.ts';
const at = '2026-10-07T15:00:00.000Z';
const run = (state: DemoState, action: Parameters<typeof transition>[1]) => transition(state, action, at);
function matched() {
  let state = run(createDemo(at), {type: 'discover'});
  assert.ok(candidates(state, at).some(m => m.id === 'malik'));
  state = run(state, {type: 'react', target: 'malik', kind: 'like'});
  return state;
}
test('demo discovery enforces reciprocal preferences and retains assignments across serialization', () => {
  let state = run(createDemo(at), {type: 'discover'});
  assert.deepEqual(candidates(state, at).map(m => m.id), ['imani', 'malik', 'theo']);
  const persisted = demoStateSchema.parse(JSON.parse(JSON.stringify(state)));
  assert.equal(run(persisted, {type: 'discover'}).exposures.length, state.exposures.length);
  state = run(state, {type: 'save', patch: {preferences: {...member(state).preferences, radius: 1}}});
  assert.deepEqual(candidates(state, at).map(m => m.id), ['imani']);
  state = run(state, {type: 'react', target: 'imani', kind: 'pass'});
  assert.equal(candidates(state, at).length, 0);
  state = run(state, {type: 'save', patch: {preferences: {...member(state).preferences, radius: 50}}});
  assert.deepEqual(candidates(state, at).map(m => m.id), ['malik', 'theo']);
  const narrow = run(state, {type: 'switch', id: 'malik'});
  const excluded = run(narrow, {type: 'save', patch: {preferences: {...member(narrow).preferences, genders: ['man']}}});
  assert.ok(!candidates(run(excluded, {type: 'switch', id: 'amara'}), at).some(m => m.id === 'malik'));
});
test('one reciprocal like makes one match; retries do not create another', () => {
  const state = matched();
  assert.equal(state.matches.length, 1);
  assert.equal(state.matches[0].id, pairId('amara', 'malik'));
  assert.equal(run(state, {type: 'react', target: 'malik', kind: 'like'}).matches.length, 1);
  assert.throws(() => run(state, {type: 'react', target: 'amara', kind: 'like'}));
});
test('a new fixture cannot submit or be approved with incomplete real-equivalent prerequisites', () => {
  let state = run(createDemo(at), {type: 'switch', id: 'new'});
  assert.equal(canDiscover(member(state), at), false);
  assert.throws(() => run(state, {type: 'submit'}), /Complete/);
  assert.throws(() => run(state, {type: 'moderate', target: 'new', decision: 'approve', reason: 'test'}), /Complete/);
  assert.throws(() => run(state, {type: 'save', patch: {reviewed: true}}), /review console/);
  const answers = {...member(createDemo(at), 'amara').answers};
  state = run(state, {type: 'save', patch: {answers, pledged: true, photos: [0, 1], identity: 'simulated_verified'}});
  state = run(state, {type: 'submit'});
  assert.equal(member(state).lifecycle, 'pending_review');
  assert.equal(canDiscover(member(state), at), false);
  state = run(state, {type: 'moderate', target: 'new', decision: 'approve', reason: 'Synthetic approval'});
  assert.equal(canDiscover(member(state), at), true);
});
test('unfinished profile drafts persist, but submission denies them and valid edits hide an approved profile', () => {
  let state = createDemo(at);
  state = run(state, {type: 'save', patch: {profile: {...member(state).profile, display_name: '', prompts: member(state).profile.prompts.map(p => ({...p, answer: ''}))}}});
  assert.equal(member(demoStateSchema.parse(JSON.parse(JSON.stringify(state)))).profile.display_name, '');
  assert.equal(member(state).reviewed, false);
  assert.equal(canDiscover(member(state), at), false);
  assert.throws(() => run(state, {type: 'submit'}), /Complete/);
});
test('birthday and incompatible pledge/attestation changes remove discovery and chat access', () => {
  let state = matched();
  state = run(state, {type: 'save', patch: {dob: '2008-10-08'}});
  assert.equal(canDiscover(member(state), at), false);
  assert.equal(connections(state, state.actor, at).length, 0);
  assert.throws(() => run(state, {type: 'send', matchId: pairId('amara', 'malik'), text: 'Hello', id: 'no'}), /unavailable/);
  state = run(matched(), {type: 'save', patch: {pledged: false}});
  assert.equal(connections(state, state.actor, at).length, 0);
});
test('failed sends stay out of conversations until retry and message IDs deduplicate', () => {
  let state = run(matched(), {type: 'fail_next'});
  const matchId = pairId('amara', 'malik');
  state = run(state, {type: 'send', matchId, text: 'A thoughtful hello.', id: 'one'});
  assert.equal(state.messages.filter(m => m.status === 'accepted').length, 0);
  assert.equal(state.messages[0].status, 'failed');
  state = run(state, {type: 'retry', id: 'one'});
  state = run(state, {type: 'send', matchId, text: 'Repeated request', id: 'one'});
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].text, 'A thoughtful hello.');
  assert.equal(state.messages[0].status, 'accepted');
});
test('pause preserves eligible chat; block closes both sides; unblock never restores a match', () => {
  let state = run(matched(), {type: 'pause'});
  assert.equal(canDiscover(member(state), at), false);
  assert.equal(connections(state, state.actor, at).length, 1);
  state = run(state, {type: 'close', target: 'malik', block: true});
  assert.equal(connections(state, state.actor, at).length, 0);
  assert.throws(() => run(state, {type: 'send', matchId: pairId('amara', 'malik'), text: 'No', id: 'no'}), /unavailable/);
  const other = run(state, {type: 'switch', id: 'malik'});
  assert.throws(() => run(other, {type: 'reply', matchId: pairId('amara', 'malik')}), /unavailable/);
  state = run(state, {type: 'unblock', target: 'malik'});
  state = run(state, {type: 'pause'});
  assert.equal(state.matches[0].status, 'closed');
  assert.ok(!candidates(run(state, {type: 'discover'}), at).some(m => m.id === 'malik'));
});
test('reports work without blocks and export contains only the selected fixture’s own sent content', () => {
  let state = matched();
  state = run(state, {type: 'report', target: 'malik', category: 'Other', detail: 'Synthetic report.', id: 'receipt'});
  assert.equal(state.blocks.length, 0);
  assert.equal(connections(state, state.actor, at).length, 1);
  state = run(state, {type: 'send', matchId: pairId('amara', 'malik'), text: 'Own text.', id: 'own'});
  state = run(state, {type: 'reply', matchId: pairId('amara', 'malik')});
  const exported = JSON.parse(exportOwnDemo(state));
  assert.equal(exported.member.id, 'amara');
  assert.equal(exported.messages.length, 1);
  assert.equal(exported.messages[0].sender, 'amara');
  assert.equal(exported.reports[0].id, 'receipt');
  assert.ok(!exportOwnDemo(state).includes('That sounds lovely'));
});
test('suspension prevents active sends and deletion clears local profile/conversation content', () => {
  let state = matched();
  state = run(state, {type: 'send', matchId: pairId('amara', 'malik'), text: 'Fixture message.', id: 'one'});
  state = run(state, {type: 'moderate', target: 'malik', decision: 'suspend', reason: 'Synthetic restriction'});
  assert.equal(connections(state, state.actor, at).length, 0);
  state = run(state, {type: 'delete'});
  assert.equal(member(state).lifecycle, 'deleted');
  assert.equal(member(state).photos.length, 0);
  assert.equal(state.messages.length, 0);
  assert.throws(() => run(state, {type: 'save', patch: {step: 0}}), /restricted/);
  assert.throws(() => run(state, {type: 'moderate', target: 'amara', decision: 'restore', reason: 'Cannot restore'}), /Deleted/);
});
test('corrupt stored references and unknown state versions are rejected', () => {
  const state = createDemo(at);
  assert.equal(demoStateSchema.safeParse({...state, actor: 'missing'}).success, false);
  assert.equal(demoStateSchema.safeParse({...state, version: 99}).success, false);
});

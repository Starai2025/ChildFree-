// usage (from the repo root): node tests/matching-chat-sql.mjs
// Optional: node tests/matching-chat-sql.mjs <path to pglite dist/index.js>
// Applies both public-beta migrations in PGlite with minimal Supabase auth/storage stand-ins,
// then proves the matching and chat rules as visitors, approved members and unapproved applicants.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite} = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, instance_id uuid, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated, service_role;
`);
for (const file of ['202610120001_public_beta_profiles.sql', '202610120002_matching_and_chat.sql', '202610120003_reports_and_member_views.sql'])
  await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));

// Members: Jessica (woman, seeks men), Marcus and Chris (men, seek women), Devon (not yet approved), Erin (approved, later removed).
const J = '10000000-0000-4000-8000-000000000001', M = '10000000-0000-4000-8000-000000000002',
      C = '10000000-0000-4000-8000-000000000003', D = '10000000-0000-4000-8000-000000000004',
      E = '10000000-0000-4000-8000-000000000005';
await db.exec(`insert into auth.users (id) values ('${J}'),('${M}'),('${C}'),('${D}'),('${E}');`);
const fill = (id, name, gender, seeking, status) => db.exec(`update public.profiles set first_name = '${name}', birth_date = '1990-05-01',
  gender = '${gender}', seeking = '{${seeking}}', city = 'Atlanta', zip = '30308', relationship_goal = 'A committed relationship',
  prompts = '[{"id":"a","answer":"x"},{"id":"b","answer":"y"}]', eligibility = '{"ok":true}', pledge_accepted_at = now(),
  status = '${status}' where id = '${id}'`);
await fill(J, 'Jessica', 'Woman', 'Man', 'approved');
await fill(M, 'Marcus', 'Man', 'Woman', 'approved');
await fill(C, 'Chris', 'Man', 'Woman', 'approved');
await fill(D, 'Devon', 'Man', 'Woman', 'submitted');
await fill(E, 'Eric', 'Man', 'Woman', 'approved');

const as = async (role, uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${role};`);
  try { return await db.query(sql); } finally { await db.exec('reset role;'); }
};
const fails = async (label, fn, pattern) => {
  try { await fn(); } catch (e) { if (pattern) assert.match(e.message, pattern, label); return; }
  assert.fail(`${label}: expected an error`);
};
const like = (actor, target, kind = 'like') => as('authenticated', actor,
  `insert into public.profile_reactions (actor_id, target_id, kind) values ('${actor}', '${target}', '${kind}')
   on conflict (actor_id, target_id) do update set kind = excluded.kind`);
const matchCount = async () => (await db.query(`select count(*)::int as n from public.matches`)).rows[0].n;
const results = [];
const check = name => results.push(`PASS  ${name}`);

// Visitors see nothing.
for (const t of ['profile_reactions', 'matches', 'messages', 'blocks'])
  await fails(`anon ${t}`, () => as('anon', '', `select * from public.${t}`), /permission denied/);
await fails('anon cards', () => as('anon', '', `select * from public.member_cards()`), /permission denied/);
check('visitors cannot read reactions, matches, messages, blocks or member cards');

// Only approved members react; never to themselves; never to unapproved profiles.
await fails('self like', () => like(J, J), /not_self/);
await fails('unapproved actor', () => like(D, J), /only approved members/);
await fails('unapproved target', () => like(J, D), /not available/);
check('only approved members can like or pass, never themselves or unapproved profiles');

// Discovery shows approved, compatible people only — never unapproved ones or private fields.
let cards = (await as('authenticated', J, `select * from public.member_cards()`)).rows;
assert.deepEqual(cards.map(c => c.first_name).sort(), ['Chris', 'Eric', 'Marcus']);
assert.ok(!('birth_date' in cards[0]) && !('zip' in cards[0]) && !('eligibility' in cards[0]));
assert.equal((await as('authenticated', M, `select * from public.member_cards()`)).rows.map(c => c.first_name).join(), 'Jessica');
assert.equal((await as('authenticated', D, `select * from public.member_cards()`)).rows.length, 0);
check('discovery lists approved, compatible members only, without private fields');

// One-way like: no match, no chat.
await like(J, M);
assert.equal(await matchCount(), 0);
assert.equal((await as('authenticated', J, `select * from public.matches`)).rows.length, 0);
check('one-way like does not create a match or chat');

// Mutual like creates exactly one match; repeats and re-likes never duplicate it.
await like(M, J);
assert.equal(await matchCount(), 1);
await like(M, J); await like(J, M); await like(J, M, 'pass'); await like(J, M);
assert.equal(await matchCount(), 1);
const mJM = (await as('authenticated', J, `select id from public.matches`)).rows[0].id;
assert.equal((await as('authenticated', M, `select id from public.matches`)).rows[0].id, mJM);
check('mutual like creates one match; duplicate likes do not create duplicate matches');

// Chat inside the match; outsiders see nothing and cannot post.
await as('authenticated', J, `insert into public.messages (match_id, sender_id, body) values ('${mJM}', '${J}', 'Hi Marcus!')`);
await as('authenticated', M, `insert into public.messages (match_id, sender_id, body) values ('${mJM}', '${M}', 'Hi Jessica!')`);
assert.equal((await as('authenticated', M, `select * from public.messages`)).rows.length, 2);
assert.equal((await as('authenticated', C, `select * from public.matches`)).rows.length, 0);
assert.equal((await as('authenticated', C, `select * from public.messages`)).rows.length, 0);
await fails('outsider posts', () => as('authenticated', C, `insert into public.messages (match_id, sender_id, body) values ('${mJM}', '${C}', 'hey')`), /row-level security/);
await fails('spoof sender', () => as('authenticated', J, `insert into public.messages (match_id, sender_id, body) values ('${mJM}', '${M}', 'fake')`), /row-level security/);
await fails('create match directly', () => as('authenticated', C, `insert into public.matches (user_one, user_two) values ('${J}', '${C}')`), /permission denied/);
check('users cannot read or post in another match, spoof a sender or create matches directly');

// Blocks: close the match, stop messages, hide each other.
await like(J, C); await like(C, J);
const mJC = (await as('authenticated', C, `select id from public.matches`)).rows[0].id;
await as('authenticated', C, `insert into public.messages (match_id, sender_id, body) values ('${mJC}', '${C}', 'Hello')`);
await as('authenticated', C, `insert into public.blocks (blocker_id, blocked_id) values ('${C}', '${J}')`);
await fails('blocked sends', () => as('authenticated', J, `insert into public.messages (match_id, sender_id, body) values ('${mJC}', '${J}', 'still there?')`), /row-level security/);
await fails('blocker sends', () => as('authenticated', C, `insert into public.messages (match_id, sender_id, body) values ('${mJC}', '${C}', 'one more')`), /row-level security/);
assert.equal((await db.query(`select status, closed_reason from public.matches where id = '${mJC}'`)).rows[0].closed_reason, 'blocked');
assert.ok(!(await as('authenticated', J, `select * from public.member_cards(array['${C}']::uuid[])`)).rows.length);
await fails('like across block', () => like(J, C), /not available/);
check('blocked users cannot message, react to or see each other; the match closes');

// Closed match cannot receive messages.
await as('authenticated', J, `select public.close_match('${mJM}', 'not a fit')`);
await fails('closed match', () => as('authenticated', M, `insert into public.messages (match_id, sender_id, body) values ('${mJM}', '${M}', 'wait')`), /row-level security/);
const closed = (await as('authenticated', M, `select status, closed_reason from public.matches where id = '${mJM}'`)).rows[0];
assert.equal(closed.status, 'closed'); assert.equal(closed.closed_reason, 'not a fit');
await fails('close twice', () => as('authenticated', M, `select public.close_match('${mJM}')`), /already closed/);
check('a closed match cannot receive messages and stays closed');

// Removed profiles leave matching and their matches close.
await like(J, E); await like(E, J);
await db.exec(`insert into public.admin_reviews (profile_id, decision, note) values ('${E}', 'removed', 'policy')`);
assert.equal((await db.query(`select count(*)::int as n from public.matches where '${E}' in (user_one, user_two) and status = 'active'`)).rows[0].n, 0);
assert.ok(!(await as('authenticated', J, `select * from public.member_cards()`)).rows.some(c => c.first_name === 'Eric'));
await fails('like removed', () => like(M, E), /not available/);
check('removed or unapproved profiles drop out of matching and their matches close');

// Photos: approved members see approved members' photos, not unapproved or blocked ones.
await db.exec(`insert into storage.objects (bucket_id, name) values ('profile-photos', '${M}/a.jpg'), ('profile-photos', '${D}/a.jpg'), ('profile-photos', '${C}/a.jpg')`);
const visible = (await as('authenticated', J, `select name from storage.objects`)).rows.map(r => r.name.split('/')[0]);
assert.ok(visible.includes(M) && !visible.includes(D) && !visible.includes(C));
assert.equal((await as('authenticated', D, `select name from storage.objects where name not like '${D}/%'`)).rows.length, 0);
check('photos: visible to approved members only, never unapproved or blocked owners');

// Reports: members file their own; nobody but the founder changes them; others never see them.
await fails('report as someone else', () => as('authenticated', M, `insert into public.reports (reporter_id, reported_id, reason) values ('${J}', '${M}', 'other')`), /row-level security/);
await fails('report wrong match', () => as('authenticated', M, `insert into public.reports (reporter_id, reported_id, match_id, reason) values ('${M}', '${C}', '${mJM}', 'other')`), /does not belong/);
await as('authenticated', M, `insert into public.reports (reporter_id, reported_id, match_id, reason, details, status) values ('${M}', '${J}', '${mJM}', 'harassment', 'test', 'actioned')`);
assert.equal((await db.query(`select status from public.reports`)).rows[0].status, 'open');
await fails('edit report', () => as('authenticated', M, `update public.reports set details = 'changed'`), /permission denied/);
assert.equal((await as('authenticated', J, `select * from public.reports`)).rows.length, 0);
assert.equal((await as('authenticated', M, `select * from public.reports`)).rows.length, 1);
check('reports: filed as yourself only, always open, unchangeable, invisible to the reported person');

// Likes received and my matches.
const F = '10000000-0000-4000-8000-000000000006';
await db.exec(`insert into auth.users (id) values ('${F}')`);
await fill(F, 'Felix', 'Man', 'Woman', 'approved');
await like(F, J);
assert.deepEqual((await as('authenticated', J, `select first_name from public.likes_received()`)).rows.map(r => r.first_name), ['Felix']);
await like(J, F);
assert.equal((await as('authenticated', J, `select * from public.likes_received()`)).rows.length, 0);
assert.deepEqual((await as('authenticated', J, `select other_first_name from public.my_matches()`)).rows.map(r => r.other_first_name), ['Felix']);
check('likes_received lists unanswered likes; my_matches lists only open matches with the other card');

// The paste-able live check passes here too and rolls itself back.
const live = await db.exec(await readFile('supabase/tests/matching_live_check.sql', 'utf8'));
assert.ok(live.some(r => r.rows?.[0]?.result === 'ALL MATCHING CHECKS PASSED'));
assert.equal((await db.query(`select count(*)::int as n from auth.users where email like 'qa-%'`)).rows[0].n, 0);
check('supabase/tests/matching_live_check.sql passes and leaves no data behind');

console.log(results.join('\n'));
console.log(`\nALL ${results.length} CHECKS PASSED`);

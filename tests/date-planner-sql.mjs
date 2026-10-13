// usage (from the repo root): node tests/date-planner-sql.mjs
// Applies the public-beta migrations in PGlite with minimal Supabase auth/storage stand-ins,
// then proves the date planner rules as match members, an outsider and the server.
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
for (const file of ['202610120001_public_beta_profiles.sql', '202610120002_matching_and_chat.sql', '202610120003_reports_and_member_views.sql',
  '202610130001_signup_profile_basics.sql', '202610130002_google_signup_name.sql', '202610130003_date_planner_and_live_chat.sql'])
  await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));

const J = '10000000-0000-4000-8000-000000000001', M = '10000000-0000-4000-8000-000000000002', C = '10000000-0000-4000-8000-000000000003';
await db.exec(`insert into auth.users (id) values ('${J}'),('${M}'),('${C}');`);
const fill = (id, name, gender, seeking) => db.exec(`update public.profiles set first_name = '${name}', birth_date = '1990-05-01',
  gender = '${gender}', seeking = '{${seeking}}', city = 'Atlanta', zip = '30308', relationship_goal = 'A committed relationship',
  prompts = '[{"id":"a","answer":"x"},{"id":"b","answer":"y"}]', eligibility = '{"ok":true}', pledge_accepted_at = now(),
  status = 'approved' where id = '${id}'`);
await fill(J, 'Jessica', 'Woman', 'Man'); await fill(M, 'Marcus', 'Man', 'Woman'); await fill(C, 'Chris', 'Man', 'Woman');

const as = async (role, uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${role};`);
  try { return await db.query(sql); } finally { await db.exec('reset role;'); }
};
const fails = async (label, fn, pattern) => {
  try { await fn(); } catch (e) { if (pattern) assert.match(e.message, pattern, label); return; }
  assert.fail(`${label}: expected an error`);
};
const results = [];
const check = name => results.push(`PASS  ${name}`);
const like = (a, b) => as('authenticated', a, `insert into public.profile_reactions (actor_id, target_id, kind) values ('${a}', '${b}', 'like')`);
await like(J, M); await like(M, J);
const match = (await db.query(`select id from public.matches`)).rows[0].id;
const send = (who, n) => as('authenticated', who, `insert into public.messages (match_id, sender_id, body)
  select '${match}', '${who}', 'hello ' || g from generate_series(1, ${n}) g`);
const ready = async (who) => (await as('authenticated', who, `select public.date_planner_ready('${match}') as ok`)).rows[0].ok;

// Ready only after 5 messages each.
await send(J, 5); await send(M, 4);
assert.equal(await ready(J), false);
await send(M, 1);
assert.equal(await ready(J), true);
assert.equal(await ready(C), false, 'outsiders are never ready');
check('the planner unlocks only after both people have sent 5 messages each');

// Members cannot create plans or zip cache rows themselves; the server does.
await fails('member creates plan', () => as('authenticated', J, `insert into public.date_plans (match_id) values ('${match}')`), /permission denied/);
await fails('member reads zip cache', () => as('authenticated', J, `select * from public.zip_locations`), /permission denied/);
const plan = (await db.query(`insert into public.date_plans (match_id, created_by, midpoint_label) values ('${match}', '${J}', 'Midtown') returning id`)).rows[0].id;
await db.exec(`insert into public.date_plan_options (plan_id, kind, label, detail, reason, maps_url, rating) values
  ('${plan}', 'place', 'Jazz Lounge', '1 Peach St', 'You both like Live music', 'https://maps.google.com/?cid=1', 4.6),
  ('${plan}', 'place', 'Garden Cafe', '2 Peach St', null, null, 4.4)`);
await db.exec(`insert into public.date_plan_options (plan_id, kind, label, starts_at) values
  ('${plan}', 'time', 'Fri 7:00 PM', now() + interval '3 days'), ('${plan}', 'time', 'Sat 11:00 AM', now() + interval '4 days')`);
await fails('second live plan', () => db.exec(`insert into public.date_plans (match_id) values ('${match}')`), /unique|duplicate/);
check('only the server creates plans and suggestions; one live plan per match; the ZIP cache is private');

// Only the two members see the plan.
assert.equal((await as('authenticated', M, `select * from public.date_plan_options`)).rows.length, 4);
assert.equal((await as('authenticated', C, `select * from public.date_plans`)).rows.length, 0);
assert.equal((await as('authenticated', C, `select * from public.date_plan_options`)).rows.length, 0);
check('outsiders cannot see the plan or its options');

// Custom options: your own name only, no fake ratings or links, at most 5 each.
await as('authenticated', M, `insert into public.date_plan_options (plan_id, kind, label, created_by) values ('${plan}', 'place', 'My favorite taco spot', '${M}')`);
await fails('spoof creator', () => as('authenticated', M, `insert into public.date_plan_options (plan_id, kind, label, created_by) values ('${plan}', 'place', 'x', '${J}')`), /row-level security/);
await fails('fake rating', () => as('authenticated', M, `insert into public.date_plan_options (plan_id, kind, label, created_by, rating) values ('${plan}', 'place', 'x', '${M}', 5)`), /row-level security/);
await fails('time without start', () => as('authenticated', M, `insert into public.date_plan_options (plan_id, kind, label, created_by) values ('${plan}', 'time', 'Someday', '${M}')`), /time_has_start/);
await fails('outsider adds', () => as('authenticated', C, `insert into public.date_plan_options (plan_id, kind, label, created_by) values ('${plan}', 'place', 'x', '${C}')`), /row-level security/);
for (let i = 0; i < 4; i++) await as('authenticated', M, `insert into public.date_plan_options (plan_id, kind, label, created_by) values ('${plan}', 'place', 'Spot ${i}', '${M}')`);
await fails('sixth custom', () => as('authenticated', M, `insert into public.date_plan_options (plan_id, kind, label, created_by) values ('${plan}', 'place', 'Too many', '${M}')`), /up to 5/);
check('either member can add their own place or time (up to 5), never as someone else and never with fake ratings');

// Picks: for yourself only; confirmation when both pick the same place and time.
const opt = async (label) => (await db.query(`select id from public.date_plan_options where label = '${label}'`)).rows[0].id;
const pick = (who, label) => opt(label).then((id) => as('authenticated', who, `insert into public.date_plan_picks (option_id, member_id) values ('${id}', '${who}')`));
await fails('pick for other', async () => as('authenticated', J, `insert into public.date_plan_picks (option_id, member_id) values ('${await opt('Jazz Lounge')}', '${M}')`), /row-level security/);
await pick(J, 'Jazz Lounge'); await pick(J, 'Sat 11:00 AM'); await pick(J, 'Fri 7:00 PM');
await pick(M, 'Garden Cafe'); await pick(M, 'Sat 11:00 AM');
assert.equal((await db.query(`select status from public.date_plans`)).rows[0].status, 'open', 'no shared place yet');
await pick(M, 'Fri 7:00 PM');
assert.equal((await db.query(`select status from public.date_plans`)).rows[0].status, 'open', 'times agree but places do not');
await pick(M, 'Jazz Lounge');
const confirmed = (await db.query(`select p.status, pl.label as place, t.label as time from public.date_plans p
  join public.date_plan_options pl on pl.id = p.confirmed_place join public.date_plan_options t on t.id = p.confirmed_time`)).rows[0];
assert.deepEqual([confirmed.status, confirmed.place, confirmed.time], ['confirmed', 'Jazz Lounge', 'Fri 7:00 PM']);
assert.equal((await as('authenticated', J, `select plan_id from public.date_plan_picks limit 1`)).rows[0].plan_id, plan);
check('the plan confirms itself when both pick the same place and time (earliest shared time wins)');

// Confirmed plans are locked; blocking hides everything.
await fails('pick after confirm', () => pick(J, 'Garden Cafe'), /row-level security/);
await db.exec(`insert into public.blocks (blocker_id, blocked_id) values ('${M}', '${J}')`);
assert.equal((await as('authenticated', J, `select * from public.date_plans`)).rows.length, 0);
assert.equal((await as('authenticated', J, `select * from public.date_plan_options`)).rows.length, 0);
check('a confirmed plan is locked, and blocking hides the plan from both people');

console.log(results.join('\n'));
console.log(`\nALL ${results.length} CHECKS PASSED`);

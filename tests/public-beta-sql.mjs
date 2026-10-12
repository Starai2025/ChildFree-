// usage (from the repo root): node tests/public-beta-sql.mjs
// Optional: node tests/public-beta-sql.mjs <migration.sql> <path to pglite dist/index.js>
// Runs the public-beta migration in PGlite with minimal Supabase auth/storage stand-ins,
// then exercises the founder's checklist as anon, two applicants and the service role.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const migrationPath = process.argv[2] || 'supabase/migrations/202610120001_public_beta_profiles.sql';
const {PGlite} = await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : '@electric-sql/pglite');
const db = new PGlite();

// --- Supabase stand-ins: roles, auth.uid(), auth.users, storage ---
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated, service_role;
  grant all on all tables in schema public to service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`);
await db.exec(await readFile(migrationPath, 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const as = async (role, uid, sql, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${role};`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
};
const fails = async (label, fn, pattern) => {
  try { await fn(); } catch (e) { if (pattern) assert.match(e.message, pattern, label); return e.message; }
  assert.fail(`${label}: expected an error`);
};
const results = [];
const check = (name) => results.push(`PASS  ${name}`);

// 1. Applicant signup: a draft profile row appears automatically.
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');`);
let rows = (await db.query(`select id, status from public.profiles order by id`)).rows;
assert.deepEqual(rows.map(r => r.status), ['draft', 'draft']); check('signup creates a draft profile for each new user');

// 2. Save profile (own row only) and 3. reload it.
await as('authenticated', A, `update public.profiles set first_name = 'Jessica', birth_date = '1994-01-01', gender = 'Woman', seeking = '{Man,Woman}',
  city = 'Atlanta', zip = '30308', relationship_goal = 'A committed relationship', bio = 'Good conversation.',
  prompts = '[{"id":"ordinary_sunday","answer":"Coffee and a long walk."}]', basics = '{"height":66}', interests = '{Coffee,Jazz}',
  compatibility = '{"faithPractice":"personal"}' where id = '${A}'`);
rows = (await as('authenticated', A, `select first_name, city, interests, status from public.profiles`)).rows;
assert.equal(rows.length, 1); assert.equal(rows[0].first_name, 'Jessica'); assert.deepEqual(rows[0].interests, ['Coffee', 'Jazz']);
check('applicant saves and reloads their own profile (sees exactly one row)');

// Applicants cannot approve themselves or skip the review fields.
await fails('self-approve', () => as('authenticated', A, `update public.profiles set status = 'approved' where id = '${A}'`), /cannot change status/);
await as('authenticated', A, `update public.profiles set review_note = 'looks great', reviewed_at = now() where id = '${A}'`);
rows = (await db.query(`select review_note, reviewed_at from public.profiles where id = '${A}'`)).rows;
assert.equal(rows[0].review_note, null); assert.equal(rows[0].reviewed_at, null);
check('applicant cannot set approved, review notes or review dates');

// 4. Submit: blocked until complete, then accepted.
const why = await fails('incomplete submit', () => as('authenticated', A, `update public.profiles set status = 'submitted' where id = '${A}'`), /incomplete/);
assert.match(why, /at least two prompts/); assert.match(why, /eligibility answers/); assert.match(why, /community pledge/);
await fails('under 18', () => as('authenticated', A, `update public.profiles set birth_date = current_date - interval '17 years', status = 'submitted' where id = '${A}'`), /18 or older/);
await as('authenticated', A, `update public.profiles set
  prompts = '[{"id":"ordinary_sunday","answer":"Coffee and a long walk."},{"id":"partnership","answer":"Choosing each other."}]',
  eligibility = '{"answers":["yes","yes","yes","yes","yes","yes"]}', pledge_accepted_at = now(), status = 'submitted' where id = '${A}'`);
rows = (await as('authenticated', A, `select status, submitted_at from public.profiles`)).rows;
assert.equal(rows[0].status, 'submitted'); assert.ok(rows[0].submitted_at);
check('submit is refused while incomplete or under 18, then accepted');

// Photos: own folder only.
await as('authenticated', A, `insert into public.profile_photos (profile_id, storage_path, position) values ('${A}', '${A}/one.jpg', 0)`);
await fails('photo row in another folder', () => as('authenticated', A, `insert into public.profile_photos (profile_id, storage_path, position) values ('${A}', '${B}/x.jpg', 1)`), /own_folder/);
await fails('photo row for another profile', () => as('authenticated', B, `insert into public.profile_photos (profile_id, storage_path, position) values ('${A}', '${A}/two.jpg', 1)`), /row-level security/);
await as('authenticated', A, `insert into storage.objects (bucket_id, name) values ('profile-photos', '${A}/one.jpg')`);
await fails('upload into another folder', () => as('authenticated', A, `insert into storage.objects (bucket_id, name) values ('profile-photos', '${B}/one.jpg')`), /row-level security/);
assert.equal((await as('authenticated', B, `select * from storage.objects`)).rows.length, 0);
assert.equal((await as('authenticated', B, `select * from public.profile_photos`)).rows.length, 0);
check('photos: applicants upload and list only inside their own folder');

// 6. Unauthorized users cannot read or change another profile; anon reads nothing.
assert.equal((await as('authenticated', B, `select * from public.profiles where id = '${A}'`)).rows.length, 0);
const upd = await as('authenticated', B, `update public.profiles set first_name = 'Hacked' where id = '${A}'`);
assert.equal(upd.affectedRows ?? 0, 0);
assert.equal((await db.query(`select first_name from public.profiles where id = '${A}'`)).rows[0].first_name, 'Jessica');
await fails('anon reads profiles', () => as('anon', '', `select * from public.profiles`), /permission denied/);
await fails('anon reads photos', () => as('anon', '', `select * from public.profile_photos`), /permission denied/);
await fails('applicant reads review log', () => as('authenticated', A, `select * from public.admin_reviews`), /permission denied/);
await fails('applicant writes review log', () => as('authenticated', A, `insert into public.admin_reviews (profile_id, decision) values ('${A}', 'approved')`), /permission denied/);
check('another applicant, anon visitors and applicants cannot read or change others or the review log');

// 5. Admin review through the service role.
await fails('approve a draft', () => as('service_role', '', `insert into public.admin_reviews (profile_id, decision) values ('${B}', 'approved')`), /only submitted profiles/);
await as('service_role', '', `insert into public.admin_reviews (profile_id, decision, note) values ('${A}', 'changes_requested', 'Add a clearer photo.')`);
rows = (await as('authenticated', A, `select status, review_note from public.profiles`)).rows;
assert.equal(rows[0].status, 'changes_requested'); assert.equal(rows[0].review_note, 'Add a clearer photo.');
await as('authenticated', A, `update public.profiles set status = 'submitted' where id = '${A}'`);
await as('service_role', '', `insert into public.admin_reviews (profile_id, decision) values ('${A}', 'approved')`);
assert.equal((await db.query(`select status from public.profiles where id = '${A}'`)).rows[0].status, 'approved');
await as('authenticated', A, `update public.profiles set bio = 'Updated bio.' where id = '${A}'`);
assert.equal((await db.query(`select status from public.profiles where id = '${A}'`)).rows[0].status, 'submitted');
await as('service_role', '', `insert into public.admin_reviews (profile_id, decision, note) values ('${A}', 'removed', 'Policy violation.')`);
await fails('edit removed', () => as('authenticated', A, `update public.profiles set bio = 'x' where id = '${A}'`), /removed/);
assert.equal((await db.query(`select count(*)::int as n from public.admin_reviews`)).rows[0].n, 3);
check('founder review: changes requested → resubmit → approved; edits re-queue; removed locks the profile');

// Bucket is private.
rows = (await db.query(`select public, file_size_limit from storage.buckets where id = 'profile-photos'`)).rows;
assert.equal(rows[0].public, false); check('profile-photos bucket exists and is private');

console.log(results.join('\n'));
console.log(`\nALL ${results.length} CHECKS PASSED`);

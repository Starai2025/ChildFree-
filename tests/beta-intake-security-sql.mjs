import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile('supabase/migrations/202610150001_retire_legacy_beta_intake.sql', 'utf8');
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
`);
await db.exec(migration);
assert.equal((await db.query("select to_regclass('public.beta_applications') as table_name")).rows[0].table_name, null);
await db.exec(`
  create table public.beta_applications (email text, profile jsonb);
  alter table public.beta_applications enable row level security;
  create policy beta_applications_insert_anyone on public.beta_applications for insert with check (true);
  grant insert on public.beta_applications to public, anon, authenticated, service_role;
  grant insert (email, profile) on public.beta_applications to public, anon, authenticated;
  insert into public.beta_applications values ('existing@example.test', '{}');
`);
await db.exec(migration);
await db.exec(migration);
assert.equal((await db.query("select count(*)::integer as n from pg_policies where tablename = 'beta_applications'")).rows[0].n, 0);
for (const role of ['anon', 'authenticated']) {
  assert.equal((await db.query(`select has_table_privilege('${role}', 'public.beta_applications', 'insert') as allowed`)).rows[0].allowed, false);
  assert.equal((await db.query(`select has_any_column_privilege('${role}', 'public.beta_applications', 'insert') as allowed`)).rows[0].allowed, false);
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query("insert into public.beta_applications (email) values ('blocked@example.test')"), /permission denied/);
  await db.exec('reset role');
}
await db.exec('set role service_role');
await db.query("insert into public.beta_applications values ('server@example.test', '{}')");
await db.exec('reset role');
assert.equal((await db.query('select count(*)::integer as n from public.beta_applications')).rows[0].n, 2);
await db.close();
console.log('PASS legacy beta intake: absent-table safe, repeatable, policy removed, anon/member table and column inserts denied, existing rows/server access preserved');

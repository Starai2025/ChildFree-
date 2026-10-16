// Isolated fixtures only. Applies every current web-beta migration, then attacks the new gates.
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
  create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
  create table auth.sessions (id uuid primary key, user_id uuid, not_after timestamptz);
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text, factor_type text);
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated, service_role;
`);
const migrationDir = 'supabase/migrations/';
for (const file of (await readdir(migrationDir)).filter((f) => f.endsWith('.sql') && f >= '202610120001').sort()) {
  await db.exec(await readFile(migrationDir + file, 'utf8'));
}
await db.exec('grant all on all tables in schema public to service_role; grant usage on all sequences in schema public to service_role;');
const F = '10000000-0000-4000-8000-000000000001', A = '10000000-0000-4000-8000-000000000002', B = '10000000-0000-4000-8000-000000000003';
const S = '20000000-0000-4000-8000-000000000001';
const YES = {black:true,noChildren:true,neverChildren:true,noStepParent:true,honest:true,respect:true};
const as = async (role, id, sql, params = [], claims = {}) => {
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:id || null, role, aal:'aal2',session_id:S,...claims})]);
  await db.exec(`set role ${role}`);
  try {
    const result = await db.query(sql, params);
    await db.exec('reset role');
    return result;
  } catch (error) {
    try { await db.exec('reset role'); } catch { /* outer explicit transaction must roll back first */ }
    throw error;
  }
};
const rejected = async (fn, pattern = /permission denied|incomplete|eligibility|agreements|founder|invitation|confirmed|MFA|50-member/i) => {
  await assert.rejects(fn, pattern);
};
let checks = 0;
const pass = (name) => {checks++; console.log(`PASS ${name}`)};
await db.query(`insert into auth.users(id,email,email_confirmed_at) values ($1,'founder@example.test',now()),($2,'a@example.test',now()),($3,'b@example.test',now())`,[F,A,B]);
await db.query('insert into app_private.founder_admins(user_id) values($1)',[F]);
await db.query('insert into auth.sessions values($1,$2,null)',[S,F]);
await db.query("insert into auth.mfa_factors(user_id,status,factor_type) values($1,'verified','totp')",[F]);
for (const id of [A,B]) await db.query(`update public.profiles set first_name='Test', birth_date='1990-01-01',gender='Woman',seeking='{Woman}',city='Atlanta',zip='30303',relationship_goal='Long-term',
  prompts='[{"id":"a","answer":"One"},{"id":"b","answer":"Two"}]',eligibility=$2 where id=$1`,[id,YES]);
const accept = (id, answers=YES, version='2026-10-16.1', terms=true, privacy=true, pledge=true) =>
  as('authenticated',id,'select public.accept_agreements($1,$2,$3,$4,$5)',[version,answers,terms,privacy,pledge]);
const action = (name,payload={},claims={}) => as('authenticated',F,'select public.founder_action($1,$2) as result',[name,payload],claims);
const submit = (id) => as('authenticated',id,'update public.profiles set status=\'submitted\' where id=$1',[id]);
const approve = (id) => action('decide',{profile_id:id,decision:'approved',reviewer_id:A});

for (const role of ['anon','authenticated']) {
  for (const table of ['agreement_acceptances','beta_invites','founder_admins','founder_audit','beta_capacity']) {
    await rejected(() => as(role,A,`select * from app_private.${table}`));
    await rejected(() => as(role,A,`delete from app_private.${table}`));
  }
}
await rejected(() => as('anon',null,'select public.accept_agreements($1,$2,true,true,true)',['2026-10-16.1',YES]));
await rejected(() => as('authenticated',A,'select public.founder_action(\'invitations\')'));
for (const claims of [{aal:'aal1'},{session_id:'missing'},{role:'service_role',aal:'aal1'}]) {
  await rejected(() => action('invitations',{},claims));
}
await db.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[S]);
await rejected(() => action('invitations'));
await db.query('update auth.sessions set not_after=null where id=$1',[S]);
await db.query("update auth.mfa_factors set status='unverified' where user_id=$1",[F]);
await rejected(() => action('invitations'));
await db.query("update auth.mfa_factors set status='verified' where user_id=$1",[F]);
pass('anonymous/members cannot read or forge ledgers, invitations, founder roles or audits; founder requires live session and verified MFA');

for (const key of Object.keys(YES)) {
  for (const value of [false,'true',1,null,undefined]) {
    const answers={...YES,[key]:value}; if (value === undefined) delete answers[key];
    await rejected(() => accept(A,answers),/Confirm all six/);
    await rejected(() => as('authenticated',A,"update public.profiles set eligibility=$2,pledge_accepted_at=now(),status='submitted' where id=$1",[A,answers]));
    await rejected(() => as('service_role',null,"update public.profiles set eligibility=$2,pledge_accepted_at=now(),status='submitted' where id=$1",[A,answers]));
  }
}
for (const args of [[YES,'old'],[YES,'2026-10-16.1',false],[YES,'2026-10-16.1',true,false],[YES,'2026-10-16.1',true,true,false],[YES,'2026-10-16.1',null,true,true]]) {
  await rejected(() => accept(A,...args),/Confirm all six/);
}
await as('authenticated',A,"update public.profiles set pledge_accepted_at='2000-01-01' where id=$1",[A]);
assert.equal((await db.query('select pledge_accepted_at from public.profiles where id=$1',[A])).rows[0].pledge_accepted_at,null);
await rejected(() => submit(A));
await accept(A); await accept(B);
const original=(await db.query('select * from app_private.agreement_acceptances where user_id=$1',[A])).rows[0];
await accept(A);
assert.deepEqual((await db.query('select * from app_private.agreement_acceptances where user_id=$1',[A])).rows[0],original);
assert.equal(original.version,'2026-10-16.1'); assert.equal(original.terms_version,'2026-10-14'); assert.equal(original.privacy_version,'2026-10-14');
assert.equal((await as('authenticated',A,'select public.agreement_status() as s')).rows[0].s.accepted,true);
pass('all six answers require JSON true on member AND service submission; explicit current agreements required; timestamps/versions immutable and retries idempotent');

await submit(A); await submit(B);
await rejected(() => approve(A),/invitation/);
await rejected(() => as('service_role',null,"update public.profiles set status='approved' where id=$1",[A]),/invitation/);
await rejected(() => as('service_role',null,"insert into public.admin_reviews(profile_id,decision) values($1,'approved')",[A]),/named founder/);
await action('invite',{email:' A@Example.Test '});
for (const key of Object.keys(YES)) {
  await rejected(() => as('service_role',null,"update public.profiles set eligibility=$2,status='approved' where id=$1",[A,{...YES,[key]:false}]),/six eligibility/);
}
await db.query('update auth.users set email_confirmed_at=null where id=$1',[A]);
await rejected(() => approve(A),/confirmed/);
await db.query('update auth.users set email_confirmed_at=now() where id=$1',[A]);
await approve(A);
await as('authenticated',A,"update public.profiles set pledge_accepted_at='2000-01-01' where id=$1",[A]);
assert.equal(new Date((await db.query('select pledge_accepted_at from public.profiles where id=$1',[A])).rows[0].pledge_accepted_at).getTime(),new Date(original.accepted_at).getTime());
// Any member edit returns the approval to review, even attempted timestamp tampering.
await approve(A);
assert.equal((await db.query('select reviewer_id from public.admin_reviews where profile_id=$1',[A])).rows[0].reviewer_id,F);
await action('invite',{email:'b@example.test'}); await approve(B);
pass('only an invited confirmed account can be approved; legacy service passcode insert fails; decision actor cannot be spoofed');

const cards=() => as('authenticated',A,'select * from public.member_cards()');
assert.equal((await cards()).rows.length,1);
await as('authenticated',A,'insert into public.profile_reactions(actor_id,target_id,kind) values($1,$2,\'like\')',[A,B]);
await as('authenticated',B,'insert into public.profile_reactions(actor_id,target_id,kind) values($1,$2,\'like\')',[B,A]);
const match=(await db.query('select id from public.matches')).rows[0].id;
await as('authenticated',A,"insert into public.messages(match_id,sender_id,body) values($1,$2,'Hello')",[match,A]);
await db.query("insert into storage.objects(bucket_id,name) values('profile-photos',$1)",[`${B}/one.jpg`]);
assert.equal((await as('authenticated',A,'select * from storage.objects')).rows.length,1);
await action('revoke_invite',{email:'b@example.test'});
assert.equal((await cards()).rows.length,0);
assert.equal((await as('authenticated',B,'select * from public.member_cards()')).rows.length,0);
assert.equal((await as('authenticated',A,'select * from public.my_matches()')).rows.length,0);
assert.equal((await as('authenticated',A,'select * from public.matches')).rows.length,0);
assert.equal((await as('authenticated',B,'select * from public.matches')).rows.length,0);
assert.equal((await as('authenticated',A,'select * from public.messages')).rows.length,0);
assert.equal((await as('authenticated',A,'select * from storage.objects')).rows.length,0);
await rejected(() => as('authenticated',A,"insert into public.messages(match_id,sender_id,body) values($1,$2,'Blocked')",[match,A]),/row-level security/);
await rejected(() => as('authenticated',A,"insert into public.profile_reactions(actor_id,target_id,kind) values($1,$2,'pass') on conflict(actor_id,target_id) do update set kind='pass'",[A,B]),/not available/);
pass('revoking invitation immediately closes discovery, likes, matches, chat and other-member photo access on both sides');

await db.exec('begin');
await action('invite',{email:'b@example.test'});
await db.query("update public.profiles set status='submitted' where id=any($1::uuid[])",[[A,B]]);
await db.exec('update app_private.beta_capacity set approved_count=49');
await approve(A);
await rejected(() => approve(B),/50-member/);
// Failed statement outside explicit savepoint aborts the transaction. Rollback restores the isolated fixture state.
await db.exec('rollback');
assert.equal((await db.query('select approved_count from app_private.beta_capacity')).rows[0].approved_count,2);
await db.query('delete from public.profiles where id=$1',[B]);
assert.equal((await db.query('select approved_count from app_private.beta_capacity')).rows[0].approved_count,1);
pass('conditional capacity update refuses approval 51; rollback and profile deletion preserve the counter');

await db.query('update app_private.founder_admins set revoked_at=now() where user_id=$1',[F]);
await rejected(() => action('invitations'));
assert.deepEqual((await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and (has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('anon',p.oid,'execute'))`)).rows,[]);
assert.deepEqual((await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prorettype='trigger'::regtype and (has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('anon',p.oid,'execute'))`)).rows,[]);
assert.ok((await db.query('select count(*)::int as n from app_private.founder_audit')).rows[0].n>0);
pass('revoked founder denied immediately; audit present; no exposed browser definer or trigger execution grants');
await db.close(); console.log(`ALL ${checks} SECURITY GROUPS PASSED`);

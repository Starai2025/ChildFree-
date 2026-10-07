import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { snapshotSchema } from '../packages/domain/src/index.ts';

const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const C='00000000-0000-4000-8000-000000000003';
const D='00000000-0000-4000-8000-000000000004';
const yes={identifies_black:true,never_married:true,no_children:true,no_parental_role:true,never_parent:true,seeks_black:true};
const profile={display_name:'Jordan',gender:'nonbinary',gender_description:'',bio:'',prompts:[{id:'joy',version:1,answer:'Sharing home-cooked meals with loved ones.'},{id:'building',version:1,answer:'A loving partnership with time to explore.'}],relationship_goal:'serious_relationship',marriage_intent:'open'};
let db: PGlite;
before(async () => {
  db=new PGlite();
  // Isolated test harness only: claims emulate Supabase auth.uid()/auth.jwt().
  // This proves PostgreSQL permissions/transactions, not hosted JWT verification.
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    insert into auth.users values('${A}'),('${B}'),('${C}'),('${D}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610060001_onboarding.sql',import.meta.url),'utf8'));
});
after(async () => {await db?.close();});
async function actor<T>(id: string | null, fn: (tx: Transaction) => Promise<T>, role='authenticated', anonymous=false) {
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claims',$1,true)`,[JSON.stringify({sub:id,is_anonymous:anonymous})]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}
async function rpc(id: string, sql: string, params: unknown[] = []) {
  return actor(id, async tx => { const result=await tx.query<{data:unknown}>(`select ${sql} as data`,params); return snapshotSchema.parse(result.rows[0].data); });
}
const eligibility=(id:string,dob='1990-01-01',answers=yes,version=1) => rpc(id,'public.api_eligibility($1,$2::jsonb,$3)',[dob,JSON.stringify(answers),version]);
const pledge=(id:string) => rpc(id,'public.api_accept_pledge(1)');
const draft=(id:string,revision:number,fields:unknown) => rpc(id,'public.api_save_draft($1::jsonb,$2)',[JSON.stringify(fields),revision]);
const save=(id:string,revision:number,fields:unknown=profile) => rpc(id,'public.api_save_profile($1::jsonb,$2)',[JSON.stringify(fields),revision]);

test('migration enables RLS on every private table', async () => {
  const {rows}=await db.query<{relname:string;relrowsecurity:boolean}>(`select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='private' and relkind='r'`);
  assert.equal(rows.length,8); assert.ok(rows.every(row=>row.relrowsecurity));
});
test('anonymous, missing-session and anonymous-auth users cannot bootstrap', async () => {
  await assert.rejects(actor(null,tx=>tx.query('select public.api_onboarding()'),'anon'),/permission denied/);
  await assert.rejects(actor(null,tx=>tx.query('select public.api_onboarding()')),/UNAUTHENTICATED/);
  await assert.rejects(actor(A,tx=>tx.query('select public.api_onboarding()'),'authenticated',true),/UNAUTHENTICATED/);
});
test('no member can query or alter raw/private/admin data', async () => {
  for (const sql of ['select * from private.private_details','select * from private.accounts',`update private.accounts set lifecycle='active'`,`insert into private.pledge_versions values(9,'fake','fake',now(),true)`,'select private.ensure_account()']) {
    await assert.rejects(actor(A,tx=>tx.query(sql)),/permission denied/);
  }
});
test('adult eligibility is authoritative and does not substitute for a pledge', async () => {
  const state=await eligibility(A); assert.equal(state.eligible,true); assert.equal(state.pledge.accepted,false);
  await assert.rejects(draft(A,0,{display_name:'Jordan'}),/STALE_PLEDGE/);
  const accepted=await pledge(A); assert.equal(accepted.pledge.accepted,true);
  await pledge(A); await eligibility(A);
  const counts=await db.query<{n:number}>(`select count(*)::integer n from private.pledge_acceptances where user_id=$1`,[A]);
  assert.equal(counts.rows[0].n,1);
  const versions=await db.query<{n:number}>(`select count(*)::integer n from private.eligibility_versions where user_id=$1`,[A]);
  assert.equal(versions.rows[0].n,1);
});
test('owner snapshots never return another member data', async () => {
  const state=await rpc(B,'public.api_onboarding()'); assert.equal(state.dob,null); assert.equal(state.answers,null);
  assert.deepEqual(state.draft.fields,{}); assert.equal(state.pledge.accepted,false);
  assert.equal(JSON.stringify(state).includes('1990-01-01'),false);
});
test('birthday boundary, incompatible answers and corrections enforce membership', async () => {
  const {rows}=await db.query<{adult:string;minor:string}>(`select to_char(current_date-interval '18 years','YYYY-MM-DD') adult,to_char(current_date-interval '18 years'+interval '1 day','YYYY-MM-DD') minor`);
  assert.equal((await eligibility(C,rows[0].minor)).eligible,false);
  assert.equal((await eligibility(D,rows[0].adult)).eligible,true);
  const failed=await eligibility(B,'1990-01-01',{...yes,never_parent:false}); assert.equal(failed.lifecycle,'ineligible');
  await pledge(B); await assert.rejects(save(B,0),/INELIGIBLE/);
  const corrected=await eligibility(B); assert.equal(corrected.lifecycle,'onboarding'); assert.equal(corrected.eligible,true);
  await assert.rejects(eligibility(B,'1991-01-01'),/CONFLICT/);
});
test('direct RPC rejects stale policies and malformed attestations', async () => {
  await assert.rejects(eligibility(A,'1990-01-01',yes,2),/STALE_POLICY/);
  await assert.rejects(actor(A,tx=>tx.query('select public.api_eligibility($1,$2::jsonb,1)',['1990-01-01',JSON.stringify({...yes,verified_adult:true})])),/INVALID_INPUT/);
  await assert.rejects(actor(A,tx=>tx.query('select public.api_eligibility($1,$2::jsonb,1)',['1990-02-30',JSON.stringify(yes)])),/date\/time field value out of range/);
  await assert.rejects(rpc(A,'public.api_accept_pledge(2)'),/STALE_PLEDGE/);
});
test('draft CAS prevents stale writes and actor spoofing without committing bad data', async () => {
  const state=await draft(A,0,{display_name:'Jordan'}); assert.equal(state.draft.revision,1);
  await assert.rejects(draft(A,0,{display_name:'Old draft'}),/CONFLICT/);
  for (const fields of [{lifecycle:'active'},{dob:'1990-01-01'},{user_id:B},{verified_adult:true}]) await assert.rejects(draft(A,1,fields),/INVALID_INPUT/);
  assert.equal((await rpc(A,'public.api_onboarding()')).draft.fields.display_name,'Jordan');
});
test('complete profile validates catalogs and structured answers in SQL', async () => {
  const invalid=[{...profile,prompts:[]},{...profile,prompts:[profile.prompts[0],profile.prompts[0]]},{...profile,prompts:[{...profile.prompts[0],answer:'short'},profile.prompts[1]]},{...profile,prompts:[{...profile.prompts[0],id:'unknown'},profile.prompts[1]]},{...profile,verified_adult:true},{...profile,bio:'x'.repeat(501)},{...profile,gender:'self_described'}];
  for (const fields of invalid) await assert.rejects(save(A,1,fields),/INVALID_INPUT/);
  const state=await save(A,1); assert.equal(state.profile_revision,1); assert.equal(state.draft.step,'photos'); assert.equal(state.lifecycle,'onboarding');
  await assert.rejects(save(A,1),/CONFLICT/);
  await assert.rejects(rpc(A,'public.api_submit_profile(1)'),/PREREQUISITES_MISSING/);
});
test('a material pledge update prevents protected saves', async () => {
  await db.exec(`update private.pledge_versions set current=false; insert into private.pledge_versions(version,text,text_hash,current) values(2,'Updated pledge','synthetic',true)`);
  await assert.rejects(draft(A,2,{display_name:'Jordan'}),/STALE_PLEDGE/);
  await assert.rejects(pledge(A),/STALE_PLEDGE/);
  assert.equal((await rpc(A,'public.api_accept_pledge(2)')).pledge.accepted,true);
});
test('published catalog content must be versioned, and disabled prompts cannot be newly saved', async () => {
  await assert.rejects(db.exec(`update private.prompt_catalog set text='Mutated' where id='joy'`),/new version/);
  await assert.rejects(db.exec(`update private.pledge_versions set text='Mutated' where version=2`),/new version/);
  await db.exec(`update private.prompt_catalog set enabled=false where id='joy'`);
  await assert.rejects(save(B,0),/STALE_PLEDGE/);
  await rpc(B,'public.api_accept_pledge(2)');
  await assert.rejects(save(B,0),/INVALID_INPUT/);
});
test('restricted members retain only their own status; no draft or eligibility mutation', async () => {
  await db.query(`update private.accounts set lifecycle='banned' where user_id=$1`,[A]);
  assert.equal((await rpc(A,'public.api_onboarding()')).lifecycle,'banned');
  await assert.rejects(draft(A,2,{display_name:'Jordan'}),/RESTRICTED/);
  await assert.rejects(eligibility(A),/RESTRICTED/);
});

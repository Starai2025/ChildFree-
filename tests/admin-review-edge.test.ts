import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transform} from 'esbuild';

async function request(options: any = {}) {
  const source = await readFile('supabase/functions/admin-review/index.ts','utf8');
  assert.doesNotMatch(source,/ADMIN_PASSCODE|x-admin-passcode/);
  const code = (await transform(source.replace(/^import .*;\r?\n/gm,''),{loader:'ts',format:'cjs'})).code;
  const calls: string[] = [];
  let handler: (request: Request) => Promise<Response>;
  const member = {
    auth: {
      getClaims: async () => {calls.push('claims'); return {data:{claims:{role:'authenticated',aal:'aal2',sub:'founder',...options.claims}},error:options.claimsError}},
      getUser: async () => {calls.push('user'); return {data:{user:options.user === undefined ? {id:'founder',email_confirmed_at:'2026-10-16'} : options.user},error:options.userError}},
    },
    rpc: async (name: string,args: any) => {
      calls.push(`rpc:${name}`);
      if (name === 'founder_access') return {data:options.access || {founder:true,mfa:true},error:options.accessError};
      assert.equal(name,'founder_action');
      assert.equal(args.p_action,options.action || 'reports');
      return {data:{ok:true},error:options.actionError};
    },
  };
  const admin = {
    from(table: string) {
      calls.push(`service:${table}`);
      return {select() {return {eq() {return {order() {return {limit:async () => ({data:[],error:null})}}}}}}};
    },
  };
  vm.runInNewContext(code,{
    createClient(_url: string,key: string,config: any) {
      if (key === 'secret') return admin;
      assert.equal(config.global.headers.Authorization,'Bearer token'); return member;
    },
    Deno:{env:{get:(key: string) => ({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'secret',ALLOWED_ORIGINS:'https://noseedsdatingsite.com'}[key])},serve(fn: typeof handler) {handler=fn}},
    Response,Request,TextEncoder,console,
  });
  const response=await handler!(new Request('https://example.supabase.co/functions/v1/admin-review',{
    method:options.method || 'POST',
    headers:{Origin:options.origin || 'https://noseedsdatingsite.com','Content-Type':'application/json',
      ...(options.noBearer ? {'x-admin-passcode':'retired-credential'} : {Authorization:'Bearer token'})},
    ...(options.method === 'OPTIONS' ? {} : {body:options.rawBody || JSON.stringify({action:options.action || 'reports',profile_id:'10000000-0000-4000-8000-000000000001',decision:'approved',reviewer_id:'spoof'})}),
  }));
  return {response,calls};
}

test('old passcode, unverified JWT, wrong role/AAL, unconfirmed or mismatched user all fail before privileged reads',async () => {
  for (const options of [{noBearer:true},{claimsError:{message:'bad signature'}},{claims:{role:'service_role'}},{claims:{aal:'aal1'}},
    {user:null},{user:{id:'different',email_confirmed_at:'2026-10-16'}},{user:{id:'founder'}},{userError:{message:'revoked'}}]) {
    const {response,calls}=await request(options);
    assert.equal(response.status,401,JSON.stringify(options));
    assert.ok(!calls.some(c=>c.startsWith('service:') || c.startsWith('rpc:')));
  }
});
test('ordinary members, revoked founders, stale MFA/session and database authorization errors fail closed',async () => {
  for (const options of [{access:{founder:false,mfa:true}},{access:{founder:true,mfa:false}},{accessError:{message:'unavailable'}},
    {actionError:{code:'42501',message:'Founder login and MFA required'}}]) {
    const {response,calls}=await request(options);
    assert.equal(response.status,403);
    assert.ok(!calls.some(c=>c.startsWith('service:')));
  }
});
test('only verified founder AAL2 reads are audited before service data access; responses never cached',async () => {
  const {response,calls}=await request();
  assert.equal(response.status,200);
  assert.deepEqual(calls,['claims','user','rpc:founder_access','rpc:founder_action','service:reports']);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'),'https://noseedsdatingsite.com');
  assert.deepEqual(await response.json(),{reports:[]});
});
test('decisions, invitations and report resolutions use caller JWT RPC rather than privileged direct writes',async () => {
  for (const action of ['decide','invite','revoke_invite','invitations','resolve_report']) {
    const {response,calls}=await request({action});
    assert.equal(response.status,200);
    assert.deepEqual(calls,['claims','user','rpc:founder_access','rpc:founder_action']);
  }
});
test('unknown origins and malformed/unknown actions never reach privileged data',async () => {
  for (const options of [{origin:'https://attacker.test'},{rawBody:'null'},{rawBody:'[]'},{rawBody:'bad'},{action:'unknown'}]) {
    const {response,calls}=await request(options);
    assert.ok([400,403].includes(response.status));
    assert.ok(!calls.some(c=>c.startsWith('service:') || c==='rpc:founder_action'));
  }
  const {response}=await request({method:'OPTIONS'});
  assert.equal(response.status,204);
  assert.match(response.headers.get('access-control-allow-headers')!,/authorization/);
  assert.doesNotMatch(response.headers.get('access-control-allow-headers')!,/passcode/);
});

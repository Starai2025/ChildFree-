import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, type AuthGateway } from '../supabase/functions/onboarding/handler.ts';

const config = {supabaseUrl:'https://example.supabase.co',supabaseKey:'isolated-test-key',allowedOrigins:'http://localhost:8081'};
function request(body: unknown, extra: Record<string,string>={}) {
  return new Request('https://example.supabase.co/functions/v1/onboarding',{method:'POST',headers:{authorization:'Bearer synthetic-test-token','Content-Type':'application/json',...extra},body:JSON.stringify(body)});
}
test('Edge handler rejects missing token before touching a provider', async () => {
  let called=false;
  const handler=createHandler(config,()=>{called=true;throw new Error('should not call');});
  const response=await handler(new Request('https://example.org',{method:'POST',body:'{}'}));
  assert.equal(response.status,401); assert.equal(called,false);
});
test('Edge validation rejects forged actor/approval and excessive payloads', async () => {
  let called=false;
  const handler=createHandler(config,()=>{called=true;throw new Error('should not call');});
  for (const body of [{action:'bootstrap',user_id:'another-user'},{action:'draft_save',expected_revision:0,fields:{verified_adult:true}}]) {
    assert.equal((await handler(request(body))).status,400);
  }
  assert.equal((await handler(request({payload:'x'.repeat(17000)}))).status,413);
  assert.equal(called,false);
});
test('Edge denies invalid sessions and anonymous-auth members even with a bearer token', async () => {
  for (const user of [{authenticated:false,anonymous:false},{authenticated:true,anonymous:true}]) {
    let called=false;
    const gateway: AuthGateway={getUser:async()=>user,rpc:async()=>{called=true;throw new Error('should not call');}};
    assert.equal((await createHandler(config,()=>gateway)(request({action:'bootstrap'}))).status,401);
    assert.equal(called,false);
  }
});
test('Edge errors are allowlisted; raw database information is never returned', async () => {
  const gateway: AuthGateway={getUser:async()=>({authenticated:true,anonymous:false}),rpc:async()=>({data:null,error:{message:'private details secret DOB',code:'XX000'}})};
  const response=await createHandler(config,()=>gateway)(request({action:'bootstrap'}));
  assert.equal(response.status,503); assert.deepEqual(await response.json(),{ok:false,code:'PROVIDER_UNAVAILABLE'});
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('Edge maps CAS conflicts and refuses an unconfigured or unapproved web origin', async () => {
  const gateway: AuthGateway={getUser:async()=>({authenticated:true,anonymous:false}),rpc:async()=>({data:null,error:{message:'CONFLICT',code:'P0001'}})};
  assert.equal((await createHandler(config,()=>gateway)(request({action:'bootstrap'}))).status,409);
  assert.equal((await createHandler(config,()=>gateway)(request({action:'bootstrap'},{origin:'https://untrusted.example.org'}))).status,403);
  assert.equal((await createHandler({},()=>gateway)(request({action:'bootstrap'}))).status,503);
});

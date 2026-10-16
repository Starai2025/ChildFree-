// Negative probes only: no accounts, sign-in emails, consent, invitations or member writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile('prototype/no-seeds-public-beta/dist/app.js','utf8');
const url=/const SUPABASE_URL = "([^"]+)"/.exec(source)[1];
const key=/const SUPABASE_ANON_KEY = "([^"]+)"/.exec(source)[1];
for (const extra of [{},{'x-admin-passcode':'retired-test-value'},{Authorization:'Bearer malformed-token'}]) {
  const response=await fetch(`${url}/functions/v1/admin-review`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://noseedsdatingsite.com',...extra},body:JSON.stringify({action:'queue'})});
  assert.equal(response.status,401); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.ok((await response.json()).error);
}
console.log('PASS live Edge rejects missing login, retired passcode header and malformed JWT; responses no-store');
for (const action of ['founder_access','agreement_status','founder_action','accept_agreements']) {
  const payload=action==='founder_action'?{p_action:'invitations',p_payload:{}}:action==='accept_agreements'?{p_version:'old',p_answers:{},p_terms:false,p_privacy:false,p_pledge:false}:{};
  const response=await fetch(`${url}/rest/v1/rpc/${action}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.ok([401,403].includes(response.status),`${action}: ${response.status}`);
  assert.equal((await response.json()).code,'42501');
}
const response=await fetch(`${url}/rest/v1/founder_admins?select=user_id`,{headers:{apikey:key,'Accept-Profile':'app_private'}});
assert.equal((await response.json()).code,'PGRST106');
console.log('PASS live anonymous consent/founder RPCs denied; private schema excluded from REST');

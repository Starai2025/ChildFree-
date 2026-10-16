import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const migration=await readFile('supabase/migrations/202610160001_beta_security.sql','utf8');
for (const document of ['terms.html','privacy.html']) {
  const text=(await readFile(`prototype/no-seeds-public-beta/dist/${document}`,'utf8')).replaceAll('\r\n','\n');
  const hash=createHash('sha256').update(text).digest('hex');
  assert.ok(migration.includes(hash),`${document} changed: publish a new agreement version/acceptance migration rather than silently changing accepted documents`);
}
const agreementSource=(await readFile('prototype/no-seeds-public-beta/dist/agreements.js','utf8')).replaceAll('export ','');
const tick=() => new Promise(setImmediate);
function consent({accepted=false}={}) {
  let session={user:{id:'A'},access_token:'token-A'}, listener, unsubscribed=false;
  const calls=[], handlers={}, elements={};
  const form={reportValidity:()=>true,querySelector:(s)=>elements[s] ||= {disabled:false,textContent:''}};
  const root={innerHTML:'',querySelector(s) {return elements[s] ||= {disabled:false,addEventListener(type,fn) {handlers[`${s}:${type}`]=fn}}}};
  let deferAccept;
  const client={auth:{getSession:async()=>({data:{session}}),onAuthStateChange(fn) {listener=fn;return {data:{subscription:{unsubscribe(){unsubscribed=true}}}}}}};
  const context=vm.createContext({AbortController,FormData:class {get(){return 'on'}},fetch:async(url,options)=>{
    calls.push({url,options});
    if (url.endsWith('agreement_status')) return Response.json({version:'2026-10-16.1',accepted});
    if (deferAccept) await deferAccept;
    return Response.json('2026-10-16T12:00:00Z');
  },Response});
  vm.runInContext(agreementSource,context);
  const start=()=>context.ensureAgreements(client,root,{userId:'A',url:'https://example.supabase.co',key:'public'});
  return {start,root,calls,form,
    submit:()=>handlers['#agreement-consent:submit']({preventDefault(){},currentTarget:form}),
    cancel:()=>handlers['#agreement-cancel:click'](),
    switchAccount(){session={user:{id:'B'},access_token:'token-B'};listener('SIGNED_IN',session)},
    setPending(promise){deferAccept=promise}, unsubscribed:()=>unsubscribed};
}
{
  const h=consent({accepted:true}); assert.equal(await h.start(),true); assert.equal(h.calls.length,1); assert.equal(h.root.innerHTML,''); assert.ok(h.unsubscribed());
}
{
  const h=consent(); const pending=h.start(); await tick();
  assert.match(h.root.innerHTML,/terms.html/); assert.match(h.root.innerHTML,/privacy.html/);
  assert.equal((h.root.innerHTML.match(/type="checkbox"/g)||[]).length,9);
  assert.doesNotMatch(h.root.innerHTML,/ checked/,'no prechecked legal acceptance');
  assert.equal(h.calls.length,1,'viewing agreements never accepts them');
  await h.submit(); assert.equal(await pending,true); assert.ok(h.unsubscribed());
  const acceptance=h.calls[1]; assert.equal(acceptance.options.headers.Authorization,'Bearer token-A');
  const payload=JSON.parse(acceptance.options.body); assert.equal(payload.p_terms,true); assert.equal(payload.p_privacy,true); assert.equal(payload.p_pledge,true);
  assert.equal(Object.keys(payload.p_answers).length,6); assert.ok(!('accepted_at' in payload) && !('user_id' in payload));
}
{
  const h=consent(); const pending=h.start(); await tick(); h.cancel(); assert.equal(await pending,false); assert.equal(h.calls.length,1);
}
{
  const h=consent(); const pending=h.start(); await tick(); h.switchAccount();
  assert.equal(await pending,false); assert.equal(h.calls.length,1); assert.ok(h.unsubscribed());
}
{
  let release; const h=consent(); h.setPending(new Promise(r=>release=r));
  const pending=h.start(); await tick(); const submitting=h.submit(); await tick();
  h.switchAccount(); release(); await submitting;
  assert.equal(await pending,false); assert.equal(h.calls[1].options.headers.Authorization,'Bearer token-A');
  assert.ok(h.calls[1].options.signal.aborted,'account switch aborts the old in-flight request');
}
console.log('PASS explicit consent, cancel, immutable identity/token, account switches before and during acceptance');

const review=(await readFile('prototype/no-seeds-public-beta/dist/review.html','utf8')).split('<script type="module">')[1].split('</script>')[0].replace(/^\s*import .*;\r?\n/m,'');
const sourceAuth=await readFile('prototype/no-seeds-public-beta/dist/founder-auth.js','utf8');
assert.doesNotMatch(review,/x-admin-passcode|state\.passcode/);
assert.match(sourceAuth,/mfa\.enroll/); assert.match(sourceAuth,/mfa\.challengeAndVerify/);
let authListener,ready,waitForFetch;
const token=(id,aal='aal2')=>({user:{id},access_token:`header.${btoa(JSON.stringify({aal}))}.sig`});
let session=token('F');
const root={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},replaceChildren(){this.innerHTML=''}};
const context=vm.createContext({document:{querySelector:()=>root},founderClient:{auth:{getSession:async()=>({data:{session}}),onAuthStateChange(fn){authListener=fn}}},
  renderFounderLogin(_root,_error,callback){ready=callback},fetch:async(_url,req)=>{if(waitForFetch)await waitForFetch;const action=JSON.parse(req.body).action; return Response.json(action==='queue'?{profiles:[{id:'private-profile',first_name:'Test'}]}:action==='reports'?{reports:[{id:'private-report'}]}:{invitations:[{email:'private@example.test'}]})},
  Response,atob,setTimeout(){},confirm:()=>false,window:{location:{reload(){}}}});
vm.runInContext(review,context);
await ready('F'); assert.match(root.innerHTML,/private@example.test/);
session=token('B'); authListener('SIGNED_IN',session);
assert.equal(root.innerHTML,'');
assert.equal(vm.runInContext('state.unlocked',context),false);
assert.equal(vm.runInContext('state.profiles.length+state.reports.length+state.invitations.length',context),0);
session=token('F'); await ready('F');
session=token('F','aal1'); authListener('TOKEN_REFRESHED',session); assert.equal(root.innerHTML,'');
session=token('F'); await ready('F');
let release; waitForFetch=new Promise(r=>release=r);
const pending=vm.runInContext('load()',context); await tick();
session=token('B'); authListener('SIGNED_IN',session); release(); await pending;
assert.equal(vm.runInContext('state.profiles.length+state.reports.length+state.invitations.length',context),0);
assert.equal(vm.runInContext('state.unlocked',context),false);
console.log('PASS review locks on account switch/MFA downgrade and discards late sensitive responses');

const founderSource=sourceAuth.replace(/^import .*;\r?\n/m,'').replace(/^export const founderClient = .*;\r?\n/m,'').replaceAll('export ','');
async function enrollment({pending=false}={}) {
  let current={user:{id:'founder'},access_token:'fixture'},listener,release;
  const handlers={},elements={}; let markup='';
  const root={get innerHTML(){return markup},set innerHTML(value){markup=value;for(const k of Object.keys(elements))delete elements[k]},
    querySelector(s){return elements[s] ||= {children:[],addEventListener(type,fn){handlers[`${s}:${type}`]=fn},replaceChildren(...children){this.children=children}}}};
  const waiting=pending ? new Promise(r=>release=r) : Promise.resolve();
  const client={auth:{getSession:async()=>({data:{session:current}}),onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}}},
    mfa:{listFactors:async()=>({data:{totp:[]}}),enroll:async()=>{await waiting;return {data:{id:'factor',totp:{qr_code:'<svg>synthetic credential</svg>'}}}}}},rpc:async()=>({data:{founder:true,mfa:false}})};
  const context=vm.createContext({founderClient:client,sessionStorage:{removeItem(){}},window:{location:{origin:'https://example.test'}},
    document:{createElement:()=>({})}});
  vm.runInContext(founderSource,context);
  context.renderFounderLogin(root,'',()=>assert.fail('must not unlock without MFA'));
  await tick();
  const enrolling=handlers['#enroll-founder:click'](); await tick();
  return {root,elements,enrolling,release,
    switchAccount(){current={user:{id:'other'},access_token:'different'};listener('SIGNED_IN',current)}};
}
{
  const h=await enrollment(); await h.enrolling;
  assert.equal(h.elements['#founder-qr'].children.length,1);
  h.switchAccount(); assert.match(h.root.innerHTML,/Account changed/); assert.equal(h.elements['#founder-qr'],undefined);
}
{
  const h=await enrollment({pending:true}); h.switchAccount(); h.release(); await h.enrolling;
  assert.match(h.root.innerHTML,/Account changed/); assert.equal(h.elements['#founder-qr'],undefined,'late enrollment must not display a credential for a stale account');
}
console.log('PASS enrollment QR is cleared on account switch and late credential responses are discarded');

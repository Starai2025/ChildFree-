// Isolated synthetic Claude-runtime adapter for visual/regression checks.
// It is injected by Playwright only; it never ships in the actual prototype.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-runtime.mjs';

const html = await readFile('prototype/web-mvp1/index.html', 'utf8');
const images = Object.fromEntries(await Promise.all(['amara', 'malik'].map(async name => [name, `data:image/png;base64,${(await readFile(`prototype/web-mvp1/preview-assets/synthetic-${name}.png`)).toString('base64')}`])));
const server = createServer((request, response) => response.writeHead(200, {'Content-Type':'text/html'}).end(html));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let runtime;
const shots = {};
try {
  runtime = await launchBrowser();
  const context = await runtime.browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const external = [];
  await context.route('**/*', route => {
    const target = route.request().url();
    if (target.startsWith(url) || target.startsWith('data:')) return route.continue();
    // The original Google Fonts request is optional; use system fallback offline.
    external.push(target); return route.abort();
  });
  await page.addInitScript(({images}) => {
    const docs = new Map(), listeners = new Map();
    const copy = value => structuredClone(value);
    const stamp = Date.now();
    const profile = (name,gender) => ({name,gender,city:'Atlanta',age:32,partnerGenders:['Man','Woman'],ageMin:25,ageMax:45,revision:1,photoCount:2,goal:'A committed relationship',marriage:"I'm open to marriage",bio:'Good conversation, weekend adventures, and a life built with intention.',prompts:[{id:'ordinary_sunday',a:'Coffee, the farmers market, and a long walk with nowhere to rush.'},{id:'partnership',a:'Choosing each other. Being kind, being honest, and making room to grow.'}],details:{height:70,faith:'Spiritual, not religious',interests:['Coffee','Live music','Art and museums']},lastActive:stamp});
    const populate = member => {
      docs.clear();
      if (member) {
        docs.set('profiles/amara', profile('Amara','Woman'));
        docs.set('profiles/malik', profile('Malik','Man'));
        docs.set('profiles/zuri', profile('Zuri','Woman'));
        docs.set('approvals/amara', {status:'approved',revision:1});
        docs.set('approvals/malik', {status:'approved',revision:1});
        docs.set('reactions/malik', {r:{amara:{k:'like',at:stamp-60000}}});
        docs.set('data/users/amara/private', {elig:{dob:'1994-01-01',result:'eligible',answers:Array(6).fill('yes'),v:1},pledge:{v:1,at:stamp},matchSeen:{},lastRead:{}});
        for (const id of ['amara','malik','zuri']) for (let i=0;i<2;i++) docs.set(`photos/${id}/p/${i}`, {img:images[id==='malik'?'malik':'amara'],i,rev:1});
      }
    };
    // Reload with ?new=1 to inspect the real welcome/eligibility screens.
    populate(!location.search.includes('new=1'));
    const snapshot = path => ({exists:docs.has(path),data:()=>copy(docs.get(path))});
    const collection = path => ({docs:[...docs].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([key,value])=>({id:key.slice(path.length+1),data:()=>copy(value)}))});
    const notify = path => {
      for (const key of [path,path.slice(0,path.lastIndexOf('/'))]) for (const callback of listeners.get(key)||[]) queueMicrotask(callback);
    };
    const subscribe = (path,cb,snap) => {
      const callback = ()=>cb(snap(path));
      if (!listeners.has(path)) listeners.set(path,new Set());
      listeners.get(path).add(callback);queueMicrotask(callback);
      return ()=>listeners.get(path).delete(callback);
    };
    const db = {
      doc:path=>({get:async()=>snapshot(path),set:async value=>{docs.set(path,copy(value));notify(path);},update:async patch=>{docs.set(path,{...docs.get(path),...copy(patch)});notify(path);},delete:async()=>{docs.delete(path);notify(path);},onSnapshot:cb=>subscribe(path,cb,snapshot)}),
      collection:path=>({get:async()=>collection(path),onSnapshot:cb=>subscribe(path,cb,collection)})
    };
    window.claude={use:async name=>name==='db'?db:name==='user'?{id:async()=> 'amara',isOwner:async()=>true,can:async()=>true}:{join:async()=>({leave:async()=>{},presence:async()=>{},onPeers:()=>()=>{}})}};
    window.prototypeFixture={get:path=>copy(docs.get(path)),reply:async()=>db.doc('msgs/malik/c/amara__malik').set({to:'amara',list:[{id:'synthetic-reply',t:'That sounds like my kind of Sunday. Coffee this weekend?',at:Date.now()}]})};
  },{images});
  const action = (name) => page.locator(`[data-act="${name}"]`);
  const capture = async (key,label) => {
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.locator('img[src]').evaluateAll(async els=>Promise.all(els.map(el=>el.decode().catch(()=>{}))));
    await mkdir('docs/evidence/claude-redesign',{recursive:true});
    await page.screenshot({path:`docs/evidence/claude-redesign/${key}.png`});
    shots[key]={label,...await page.evaluate(()=>({route:document.body.dataset.route||'welcome',body:document.querySelector('.app').outerHTML+document.querySelector('#tabs').outerHTML+document.querySelector('#layer').outerHTML}))};
    for (const [name,src] of Object.entries(images)) shots[key].body=shots[key].body.replaceAll(src,`__PORTRAIT_${name}__`);
  };
  await page.goto(url+'?new=1'); await action('go').filter({hasText:"Check if I'm eligible"}).waitFor();
  await capture('welcome','Welcome');
  await action('go').filter({hasText:"Check if I'm eligible"}).click();
  await page.locator('#dob').waitFor();await capture('onboarding','Onboarding');
  await action('submit-elig').click();assert.ok(await page.locator('#elig-err').innerText());
  await page.goto(url);
  await page.locator('.photo-identity h2').filter({hasText:'Malik'}).waitFor();
  assert.equal(await page.locator('body').getAttribute('data-route'),'discover');
  assert.equal(await page.locator('.card-actions .like').isVisible(),true);
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    const identity = await page.locator('.photo-identity').boundingBox();
    const controls = await page.locator('.card-actions').boundingBox();
    assert.ok(identity.y+identity.height<controls.y,`Profile identity obscured at ${width}px`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:390,height:844});
  await capture('discover','Discover');
  await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByRole('heading',{name:'Filters',exact:true}).waitFor();
  await capture('filters','Filters');
  await page.locator('[data-act="go"][data-r="discover"]').filter({hasText:'Back to Discover'}).click();
  await page.locator('.card-actions .like').click();await page.getByRole('dialog').waitFor();await capture('match','Mutual match');
  await action('match-chat').click();await page.locator('#compose').fill('A thoughtful hello from a synthetic design preview.');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByText('A thoughtful hello from a synthetic design preview.',{exact:true}).waitFor();
  await page.evaluate(()=>window.prototypeFixture.reply());
  await page.getByText('That sounds like my kind of Sunday. Coffee this weekend?',{exact:true}).waitFor();
  await capture('chat','Conversation');
  assert.equal(await page.evaluate(()=>window.prototypeFixture.get('msgs/amara/c/amara__malik').list.length),1);
  await page.getByRole('button',{name:'Conversation options',exact:true}).click();
  await action('report').waitFor();await capture('safety','Safety controls');
  await action('plan-start').click();await page.locator('.planner').waitFor();
  await capture('planner','Date planner');await action('close').click();
  await page.getByRole('button',{name:'Back to matches',exact:true}).click();
  await page.getByRole('heading',{name:'Conversations',exact:true}).waitFor();await capture('matches','Matches');
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('heading',{name:'Your profile',exact:true}).waitFor();await capture('profile','Profile');
  await page.getByRole('button',{name:'Review',exact:true}).last().click();await page.getByRole('heading',{name:'Review',exact:true}).waitFor();await capture('review','Review');
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}px`);
  }
  assert.equal(errors.length,0,errors.join('\n'));
  assert.ok(external.every(url=>url.startsWith('https://fonts.googleapis.com/')||url.startsWith('https://fonts.gstatic.com/')),'Unexpected external requests');
  const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
  const preview=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Black Childfree — design preview</title><style>body{margin:0;background:#F4F5F7;font:14px system-ui;color:#222328}header{max-width:940px;margin:28px auto;padding:0 20px}h1{font-size:24px;letter-spacing:-.8px;margin:0 0 8px}p{font-size:12px;color:#71747D;line-height:1.8}nav{display:flex;gap:6px;flex-wrap:wrap;margin:20px 0}button{border:1px solid #E3E6ED;background:#fff;color:#626976;border-radius:8px;padding:10px 14px;cursor:pointer}button[aria-pressed=true]{background:#CB4708;color:#fff;border-color:#CB4708}iframe{display:block;width:min(390px,100%);height:844px;border:1px solid #E3E6ED;border-radius:18px;background:white;margin:24px auto 40px;box-shadow:0 12px 60px #28304412}</style><header><h1>black childfree <span style="color:#CB4708">♡</span></h1><p>Design preview · Synthetic people and conversations. These are static screen previews; no account is created. The working prototype requires Claude's artifact runtime.</p><nav id="views"></nav></header><iframe id="phone" title="Selected app screen" sandbox="allow-same-origin"></iframe><script>const shots=${json(shots)},css=${json(css)},images=${json(images)};function show(key){const view=shots[key];let body=view.body;for(const[name,src]of Object.entries(images))body=body.replaceAll('__PORTRAIT_'+name+'__',src);document.querySelector('#phone').srcdoc='<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body data-route="'+view.route+'">'+body+'</body></html>';document.querySelectorAll('#views button').forEach(button=>button.setAttribute('aria-pressed',button.dataset.key===key))}for(const[key,view]of Object.entries(shots)){const button=document.createElement('button');button.textContent=view.label;button.dataset.key=key;button.onclick=()=>show(key);document.querySelector('#views').append(button)}show('discover');</script></html>`;
  await writeFile('prototype/web-mvp1/design-preview.html',preview);
  // The bundled single-process Chromium uses one context; this fresh page has
  // no page-level fixture initialization, proving the preview needs no APIs.
  const previewPage = await context.newPage();
  await previewPage.setViewportSize({width:1024,height:1080});
  const previewErrors = [];previewPage.on('pageerror',e=>previewErrors.push(e.message));
  await previewPage.setContent(preview);
  const frame = previewPage.frameLocator('#phone');
  await frame.getByRole('heading',{name:'Discover',exact:true}).waitFor();
  await previewPage.getByRole('button',{name:'Conversation',exact:true}).click();
  await frame.getByRole('textbox',{name:'Message',exact:true}).waitFor();
  assert.equal(await frame.locator('body').evaluate(()=>typeof window.claude),'undefined');
  await previewPage.getByRole('button',{name:'Discover',exact:true}).click();
  await frame.getByRole('heading',{name:'Discover',exact:true}).waitFor();
  await previewPage.screenshot({path:'docs/evidence/claude-redesign/preview.png',fullPage:true});
  assert.equal(previewErrors.length,0,previewErrors.join('\n'));
  await previewPage.close();
  console.log('PASS: Claude prototype synthetic UI — welcome/eligibility guard, discovery, mutual match, text send/reply, safety/planner, matches/profile/review, 320/390/768px overflow checks, and standalone preview switching without Claude APIs. Real Claude services were not tested.');
} finally {await runtime?.close();await new Promise(resolve=>server.close(resolve));}

// Captures the shipped, isolated app. Screenshots are actual browser renders.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {launchBrowser} from './browser-runtime.mjs';
const root=path.resolve('prototype/web-mvp1');
const server=createServer(async(req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.ttf')?'font/ttf':'text/html'}).end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const runtime=await launchBrowser();
try {
 const page=await runtime.browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('dialog',dialog=>dialog.accept());
 const external=[];page.on('request',req=>{if(!req.url().startsWith(`http://127.0.0.1:${server.address().port}/`)&&!req.url().startsWith('data:'))external.push(req.url());});
 const background=selector=>page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor);
 const color=selector=>page.locator(selector).evaluate(el=>getComputedStyle(el).color);
 const contrast=(a,b)=>{
  const luminance=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
 };
 const viewports=[{width:320,height:667},{width:390,height:844},{width:768,height:844},{width:1280,height:900}];
 await page.goto(`http://127.0.0.1:${server.address().port}/demo-standalone.html`);
 await page.locator('.photo-identity h2').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await mkdir('docs/evidence/native-midnight',{recursive:true});
 for(const {width,height} of viewports) {
  await page.setViewportSize({width,height});
  const identity=await page.locator('.photo-identity').boundingBox(),controls=await page.locator('.card-actions').boundingBox();
  assert.ok(identity.y+identity.height<controls.y,`Identity hidden by controls at ${width}px: ${JSON.stringify({identity,controls})}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:390,height:844});
 const capture=async name=>{await page.locator('img[src]').evaluateAll(els=>Promise.all(els.map(e=>e.decode().catch(()=>{}))));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`docs/evidence/native-midnight/${name}.png`,animations:'disabled'});};
 assert.equal(await background('header.top'),'rgb(246, 240, 232)');
 assert.equal(await background('.card-actions .like'),'rgb(138, 51, 36)');
 assert.ok(contrast(await background('.card-actions .like'),await color('.card-actions .like'))>=4.5,'Small Like label contrast');
 assert.equal(await background('.card-actions .pass'),'rgb(17, 17, 17)');
 assert.equal(await background('.native-profile-badges .native-badge:not(.soft)'),'rgb(15, 92, 77)');
 assert.equal(await page.locator('header.top .native-logo').getAttribute('aria-label'),'FREE MIDNIGHT');
 assert.ok(await page.locator('header.top .brand-emblem').evaluate(el=>el.naturalWidth>0));
 const titleStyle=await page.locator('.discover-heading h1').evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),weight:parseInt(getComputedStyle(el).fontWeight,10)}));
 assert.ok(titleStyle.size>=19&&titleStyle.weight>=700,'Terracotta heading must meet large-text contrast sizing');
 await capture('discover');
 await page.locator('.card-actions .like').click();await page.locator('.native-match').waitFor();await capture('match');
 assert.equal(await background('.native-match .native-pill'),'rgb(138, 51, 36)');
 assert.equal(await color('.native-match .native-pill'),'rgb(246, 240, 232)');
 assert.ok(contrast(await background('.native-match .native-pill'),await color('.native-match .native-pill'))>=4.5,'Match CTA contrast');
 for(const viewport of viewports){
  await page.setViewportSize(viewport);
  await page.locator('.native-match').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));
  const logo=await page.locator('.native-match .native-logo').boundingBox();
  assert.ok(logo.y>=38,`Match logo clipped at ${viewport.width}×${viewport.height}`);
  await page.locator('.native-match .native-pill').scrollIntoViewIfNeeded();
  const cta=await page.locator('.native-match .native-pill').boundingBox();
  assert.ok(cta.y>=38&&cta.y+cta.height<=viewport.height,'Match CTA cannot be reached');
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-act=match-chat]').click();await page.locator('#compose').waitFor();
 await page.locator('[data-demo=menu]').click();await page.locator('[data-demo=fresh]').click();await page.locator('.welcome').waitFor();await capture('welcome');
 assert.equal(await background('.welcome .native-pill'),'rgb(138, 51, 36)');
 assert.ok(contrast(await background('.welcome .native-pill'),await color('.welcome .native-pill'))>=4.5,'Welcome CTA contrast');
 assert.equal(await color('.welcome h1 span'),'rgb(200, 154, 43)');
 assert.ok(await page.evaluate(()=>document.fonts.check('700 34px "Midnight Lora"')&&document.fonts.check('700 19px "Midnight DM Sans"')));
 assert.equal(await page.locator('.welcome h1').evaluate(el=>getComputedStyle(el).fontWeight),'700');
 assert.match(await page.locator('.welcome h1').innerText(),/The Only Thing\s+We're Raising\s*Is the Bar\./);
 assert.equal(await page.locator('.native-welcome-copy>p').first().innerText(),'Black Singles. No Children. Not Ever.');
 for(const viewport of viewports){
  await page.setViewportSize(viewport);
  const cta=await page.locator('.welcome .native-pill').boundingBox();
  assert.ok(cta.y>=38&&cta.y+cta.height<=viewport.height,`Welcome CTA below fold at ${viewport.width}×${viewport.height}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.locator('.welcome .native-pill').click();await page.locator('#dob').waitFor();
 assert.equal(errors.length,0,errors.join('\n'));
 assert.deepEqual(external,[],'Standalone preview requested an external provider or asset');
 const names=['welcome','discover','match'];
 const shots=await Promise.all(names.map(async name=>`<figure><figcaption>${name==='welcome'?'Welcome':name==='discover'?'Discover':'Match'}</figcaption><img src="data:image/png;base64,${(await readFile(`docs/evidence/native-midnight/${name}.png`)).toString('base64')}"></figure>`));
 const gallery=`<!doctype html><html><meta charset="utf-8"><title>FREE MIDNIGHT · Midnight Luxe · First three screens</title><style>body{margin:0;padding:24px;background:#111111;color:#F6F0E8;font-family:system-ui}h1{font:700 32px system-ui;margin:0 0 8px}.intro{margin:0 0 24px;font-size:13px}.screens{display:flex;gap:20px}figure{margin:0;width:390px}figcaption{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#C89A2B;margin-bottom:12px}img{display:block;width:390px;border-radius:24px}footer{font-size:12px;margin-top:20px;color:#F6F0E8}</style><h1>FREE MIDNIGHT · Midnight Luxe</h1><p class="intro">Welcome, Discover & Match · Actual app screens · Synthetic demo data</p><div class="screens">${shots.join('')}</div><footer>Revised palette · #111111 &nbsp; #0F5C4D &nbsp; #C89A2B &nbsp; #F6F0E8 &nbsp; #8A3324</footer></html>`;
 await writeFile('docs/evidence/native-midnight/screens.html',gallery);
 await page.setViewportSize({width:1258,height:1040});await page.setContent(gallery);await page.screenshot({path:'docs/evidence/native-midnight/three-screens.png',fullPage:true});
 console.log('PASS: Midnight Luxe — shipped screens, locked computed colors, bundled serif, 320/390/768/1280px layouts, eligibility and mutual-match chat navigation; no external requests. Captured actual browser screenshots.');
}finally{await runtime.close();await new Promise(resolve=>server.close(resolve));}

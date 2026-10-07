// Verifies the shipped interactive demo with no injected runtime or provider mocks.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {launchBrowser} from './browser-runtime.mjs';
const root=path.resolve('prototype/web-mvp1');
const server=createServer(async(request,response)=> {
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if (!file.startsWith(root+path.sep)) {response.writeHead(403).end();return;}
  try {const content=await readFile(file);response.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':'text/html'}).end(content);}
  catch {response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let runtime;
try {
  runtime=await launchBrowser();
  const page=await runtime.browser.newPage({viewport:{width:390,height:844}});
  const errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  const url=`http://127.0.0.1:${server.address().port}/demo.html`;
  page.on('request',request=> {if (!request.url().startsWith(`http://127.0.0.1:${server.address().port}/`)&&!request.url().startsWith('data:')&&!request.url().startsWith('file:')) external.push(request.url());});
  page.on('dialog',dialog=>dialog.accept());
  const actor=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('blackchildfree.claude-browser-demo.v1')).entries);
  const act=name=>page.locator(`[data-act="${name}"]`);
  const demo=name=>page.locator(`[data-demo="${name}"]`);
  await page.goto(url);await page.locator('.photo-identity h2').filter({hasText:'Malik'}).waitFor();
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    const identity=await page.locator('.photo-identity').boundingBox(),buttons=await page.locator('.card-actions').boundingBox();
    assert.ok(identity.y+identity.height<buttons.y,`Demo bar obscures profile at ${width}px`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.setViewportSize({width:390,height:844});
  await mkdir('docs/evidence/claude-browser-demo',{recursive:true});
  await page.locator('.card-photo img').evaluate(image=>image.decode());
  await page.screenshot({path:'docs/evidence/claude-browser-demo/discover.png'});
  await page.locator('.card-actions .like').click();await act('match-chat').click();
  await page.getByRole('textbox',{name:'Message',exact:true}).fill('Hello from the actual clickable synthetic demo.');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByText('Hello from the actual clickable synthetic demo.',{exact:true}).waitFor();
  await demo('menu').click();await demo('reply').click();
  await page.getByText(/^Simulated reply:/).waitFor();
  await page.reload();await page.locator('#tabs').getByRole('button',{name:'Matches',exact:true}).click();
  await act('open-chat').click();await page.getByText('Hello from the actual clickable synthetic demo.',{exact:true}).waitFor();
  await page.getByText(/^Simulated reply:/).waitFor();
  const stored=await actor();assert.equal(stored.find(([key])=>key==='msgs/amara/c/amara__malik')[1].list.length,1);
  assert.ok(await page.evaluate(()=>localStorage.getItem('blackchildfree.claude-browser-demo.v1').length<100000),'Preset portraits must not fill browser storage.');
  assert.ok(stored.some(([,value])=>value.img==='@demo-portrait:amara'));
  await page.screenshot({path:'docs/evidence/claude-browser-demo/chat.png'});
  await demo('menu').click();await demo('fresh').click();await page.getByRole('button',{name:"Check if I'm eligible",exact:true}).waitFor();
  await page.getByRole('button',{name:"Check if I'm eligible",exact:true}).click();
  await page.locator('#dob').fill('1994-01-01');
  for (let i=0;i<6;i++) {
    const radio=page.locator(`[name="q${i}"][value="yes"]`);
    await page.locator('.seg label').filter({has:radio}).click();assert.ok(await radio.isChecked());
  }
  await act('submit-elig').click();await page.locator('#pledge-check').check();await act('accept-pledge').click();
  await page.locator('#photos img').first().waitFor();
  assert.equal(await page.locator('#photos img').count(),2);
  await page.screenshot({path:'docs/evidence/claude-browser-demo/onboarding.png'});
  await page.locator('#f-name').fill('Demo Taylor');await page.locator('#f-gender').selectOption('Woman');
  await page.locator('[data-f="partnerGenders"][value="Man"]').check();
  await page.locator('#f-p1').selectOption('ordinary_sunday');await page.locator('#f-a1').fill('Coffee, a farmers market, and an unhurried walk together.');
  await page.locator('#f-p2').selectOption('partnership');await page.locator('#f-a2').fill('Being honest and thoughtful, and choosing each other every day.');
  await page.locator('#f-goal').selectOption('A committed relationship');
  await page.locator('#f-city').fill('Atlanta');await page.locator('#f-zip').fill('30308');
  await act('submit-profile').click();await act('skip-passions').click();
  await page.getByRole('heading',{name:'Your profile is in review.',exact:true}).waitFor();
  await page.locator('#hdr').getByRole('button',{name:'Review',exact:true}).click();
  await page.locator('[data-act="approve"][data-id="amara"]').click();
  await page.locator('#tabs').getByRole('button',{name:'Discover',exact:true}).click();
  await page.locator('.photo-identity h2').filter({hasText:'Malik'}).waitFor();
  await page.reload();await page.locator('.photo-identity h2').filter({hasText:'Malik'}).waitFor();
  const completed=await actor();assert.equal(completed.find(([key])=>key==='profiles/amara')[1].name,'Demo Taylor');
  await demo('menu').click();await demo('reset').click();await page.locator('.photo-identity h2').filter({hasText:'Malik'}).waitFor();
  // The downloadable version embeds all assets and supports the same app logic.
  await page.goto(url.replace('demo.html','demo-standalone.html'));
  await page.locator('.photo-identity h2').filter({hasText:'Malik'}).waitFor();
  await page.locator('.card-photo img').evaluate(image=>image.decode());
  assert.ok((await page.locator('.card-photo img').getAttribute('src')).startsWith('data:image/png;base64,'));
  // Opening the downloaded HTML directly must work without a web server.
  await page.goto(`file://${path.join(root,'demo-standalone.html')}`);
  await page.locator('.photo-identity h2').filter({hasText:'Malik'}).waitFor();
  await page.locator('.card-photo img').evaluate(image=>image.decode());
  await page.locator('.card-actions .like').click();await act('match-chat').click();
  await page.getByRole('textbox',{name:'Message',exact:true}).fill('An offline synthetic hello.');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.reload();await page.locator('#tabs').getByRole('button',{name:'Matches',exact:true}).click();
  await act('open-chat').click();await page.getByText('An offline synthetic hello.',{exact:true}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(external.length,0,external.join('\n'));
  console.log('PASS: shipped browser demo — no injected adapters, persistent mutual match/messages/simulated reply, deduplicated photos, new-profile eligibility/pledge/editor, reset, responsive controls and self-contained download. No external provider requests.');
} finally {await runtime?.close();await new Promise(resolve=>server.close(resolve));}

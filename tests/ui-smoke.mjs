// Browser checks of the Expo web rendering. All authentication/API data is synthetic.
// This is NOT hosted Supabase, native SecureStore or a phone launch test.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { createBrotliDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import { extract } from 'tar-fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

const root=path.resolve('apps/mobile/dist-qa');
const fixtureEnv={
  ...process.env,CI:'1',EXPO_PUBLIC_APP_ENV:'development',
  EXPO_PUBLIC_SUPABASE_URL:'https://qa.supabase.co',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_syntheticfixture0000',
  EXPO_PUBLIC_TERMS_URL:'https://example.org/terms',EXPO_PUBLIC_PRIVACY_URL:'https://example.org/privacy',EXPO_PUBLIC_SUPPORT_URL:'https://example.org/support',
};
if (!process.env.UI_SKIP_EXPORT) await new Promise((resolve,reject)=>{
  const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','export:web','--workspace','@black-childfree/mobile','--','--output-dir','dist-qa'],{env:fixtureEnv,stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`QA export failed: ${code}`)));
});
const server=createServer(async (req,res)=>{
  try {
    const target=path.resolve(root,`.${decodeURIComponent(new URL(req.url,'http://localhost').pathname)}`);
    if (target!==root && !target.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    const file=target===root?path.join(root,'index.html'):target;
    const contents=await readFile(file);
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'}).end(contents);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
let page;
const browserDir=await mkdtemp(path.join(tmpdir(),'blackchildfree-ui-'));
try {
  // The package's default extractor chowns archive entries as root. Extract into
  // a task-owned directory without changing ownership (managed runtimes deny chown).
  const require=createRequire(import.meta.url);
  const bin=path.resolve(path.dirname(require.resolve('@sparticuz/chromium')),'../bin');
  await pipeline(createReadStream(path.join(bin,'chromium.br')),createBrotliDecompress(),createWriteStream(path.join(browserDir,'chromium'),{mode:0o700}));
  await pipeline(createReadStream(path.join(bin,'fonts.tar.br')),createBrotliDecompress(),extract(path.join(browserDir,'fonts'),{chown:false}));
  await pipeline(createReadStream(path.join(bin,'swiftshader.tar.br')),createBrotliDecompress(),extract(browserDir,{chown:false}));
  const fontConfig=path.join(browserDir,'fonts','fonts.conf');
  const original=await readFile(fontConfig,'utf8');
  const {writeFile}=await import('node:fs/promises');
  await writeFile(fontConfig,original.replaceAll('/tmp/fonts',path.join(browserDir,'fonts')));
  process.env.FONTCONFIG_PATH=path.join(browserDir,'fonts');
  process.env.FONTCONFIG_FILE=fontConfig;
  browser=await playwright.launch({executablePath:path.join(browserDir,'chromium'),args:chromium.args.filter(arg=>arg!=='--disable-web-security'),headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const claims={sub:'00000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+3600};
  const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic`;
  await context.addInitScript(({token,claims})=>sessionStorage.setItem('sb-qa-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',expires_at:claims.exp,expires_in:3600,token_type:'bearer',user:{id:claims.sub,email:'synthetic@example.org',aud:'authenticated',role:'authenticated'}})),{token,claims});
  const prompts=[{id:'joy',version:1,text:'Something that always brings me joy is…'},{id:'building',version:1,text:'The life I want to build with someone is…'}];
  let state={lifecycle:'onboarding',eligible:false,policy_version:1,dob:null,answers:null,pledge:{version:1,text:'Synthetic pledge v1 for isolated UI checks.',accepted:false},prompts,draft:{revision:0,step:'eligibility',fields:{}},profile_revision:0};
  const calls=[];
  await page.route('https://qa.supabase.co/**',async route=>{
    const request=route.request();
    if (!request.url().includes('/functions/v1/onboarding')) {
      await route.fulfill({status:200,contentType:'application/json',body:'{}'});return;
    }
    const input=request.postDataJSON();calls.push(input.action);
    switch(input.action) {
      case 'eligibility': state={...state,dob:input.dob,answers:input.answers,eligible:true};break;
      case 'pledge_accept':state={...state,pledge:{...state.pledge,accepted:true}};break;
      case 'draft_save':state={...state,draft:{revision:state.draft.revision+1,step:'profile',fields:input.fields}};break;
      case 'profile_save':state={...state,profile_revision:state.profile_revision+1,draft:{revision:state.draft.revision+1,step:'photos',fields:input.fields}};break;
    }
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,data:state})});
  });
  const address=server.address();const url=`http://127.0.0.1:${address.port}`;
  await page.goto(url);
  const dob=()=>page.getByRole('textbox',{name:'Birth date (YYYY-MM-DD)',exact:true});
  await dob().waitFor();await dob().fill('1990-01-01');
  await page.getByRole('button',{name:'Reload saved information (discard unsaved edits)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('input[aria-label="Birth date (YYYY-MM-DD)"]')?.value==='');
  await dob().fill('1990-01-01');
  const yes=page.getByRole('radio',{name:/Yes/});assert.equal(await yes.count(),6);
  for(let i=0;i<6;i++) await yes.nth(i).click();
  await page.getByRole('checkbox',{name:/I agree to the Community Pledge/}).click();
  await page.getByRole('button',{name:'Save and continue',exact:true}).click();
  const name=()=>page.getByRole('textbox',{name:'Display name',exact:true});
  await name().waitFor();
  assert.equal(await page.getByRole('radio',{name:/Woman/}).isChecked(),false);
  await name().fill('Dirty unsaved name');
  await page.getByRole('button',{name:'Reload saved information (discard unsaved edits)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('input[aria-label="Display name"]')?.value==='');
  await page.getByRole('button',{name:'Save and continue',exact:true}).click();
  await page.getByRole('alert').filter({hasText:/Use a name/}).waitFor();assert.equal(calls.includes('profile_save'),false);
  await name().fill('Jordan');await page.getByRole('radio',{name:/Nonbinary/}).click();
  await page.getByRole('radio',{name:/The life I want to build/}).nth(1).click();
  await page.getByRole('textbox',{name:'Your answer to prompt 1 (20–200 characters)',exact:true}).fill('Travel and cooking together bring me joy.');
  await page.getByRole('textbox',{name:'Your answer to prompt 2 (20–200 characters)',exact:true}).fill('A thoughtful partnership with room to grow.');
  await page.getByRole('button',{name:'Save draft for later',exact:true}).click();
  await page.getByText(/Saved draft revision: 1/).waitFor();
  await page.reload();await name().waitFor();assert.equal(await name().inputValue(),'Jordan');
  await page.getByRole('button',{name:'Save draft and go back to eligibility',exact:true}).click();await dob().waitFor();
  // New pledge must render an unchecked acknowledgment, never carry old accepted state.
  state={...state,pledge:{version:2,text:'Synthetic updated pledge.',accepted:false}};
  await page.getByRole('button',{name:'Reload saved information (discard unsaved edits)',exact:true}).click();
  const pledge=page.getByRole('checkbox',{name:/I agree to the Community Pledge/});
  await page.getByText('Synthetic updated pledge.',{exact:true}).waitFor();assert.equal(await pledge.isChecked(),false);
  await pledge.click();await page.getByRole('button',{name:'Save and continue',exact:true}).click();await name().waitFor();
  await page.getByRole('button',{name:'Save and continue',exact:true}).click();
  await page.getByText('Your profile draft is saved.',{exact:true}).waitFor();
  assert.equal(calls.includes('profile_save'),true);assert.equal(errors.length,0,errors.join('\n'));
  await mkdir('docs/evidence',{recursive:true});
  await page.screenshot({path:'docs/evidence/onboarding-web-fixture.png',fullPage:true});
  console.log('PASS: Expo web UI — draft resume, explicit gender, reload/reset, new-pledge acknowledgment, Back save and photos gate. Synthetic providers only.');
} catch(error) {
  if (page) {
    await mkdir('docs/evidence',{recursive:true});
    await page.screenshot({path:'docs/evidence/ui-debug.png',fullPage:true});
    console.log(await page.evaluate(()=>Array.from(document.querySelectorAll('button')).map(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON(),cover:(()=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.textContent?.slice(0,250);})()}))));
  }
  throw error;
} finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  await rm(browserDir,{recursive:true,force:true});
}

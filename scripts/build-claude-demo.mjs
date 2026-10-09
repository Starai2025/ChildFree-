import {readFile,writeFile,readdir} from 'node:fs/promises';

const source=await readFile('prototype/web-mvp1/index.html','utf8');
const runtime=await readFile('prototype/web-mvp1/local-demo-runtime.js','utf8');
// Portraits: every preview-assets/synthetic-<id>.jpg|png (a second photo is synthetic-<id>-2). Missing people fall back to a default portrait.
const portraitFiles=(await readdir('prototype/web-mvp1/preview-assets')).filter(file=>/^synthetic-(?!native-couple)[a-z0-9-]+.(jpe?g|png)$/.test(file)).sort();
const imageNames={...Object.fromEntries(portraitFiles.map(file=>[file.replace(/^synthetic-|.(jpe?g|png)$/g,''),file])),welcome:'synthetic-native-couple.png',mark:'free-midnight-emblem.png'};
const mime=file=>file.endsWith('.png')?'image/png':'image/jpeg';
const embeddedImages=Object.fromEntries(await Promise.all(Object.entries(imageNames).map(async ([name,file])=>[name,`data:${mime(file)};base64,${(await readFile(`prototype/web-mvp1/preview-assets/${file}`)).toString('base64')}`])));
const hostedImages=Object.fromEntries(Object.entries(imageNames).map(([name,file])=>[name,`preview-assets/${file}`]));
const fonts=await Promise.all(['Lora','DMSans'].map(async name=>({path:`preview-assets/${name}.ttf`,data:`data:font/ttf;base64,${(await readFile(`prototype/web-mvp1/preview-assets/${name}.ttf`)).toString('base64')}`,license:await readFile(`prototype/web-mvp1/preview-assets/${name}-OFL.txt`,'utf8')})));
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const notice=`<aside id="demo-bar" aria-label="Synthetic demo controls"><span id="demo-status">DEMO · SYNTHETIC PEOPLE<br>SAVED ONLY ON THIS DEVICE</span><button data-demo="menu">Demo controls</button></aside><section id="demo-panel" hidden aria-label="Demo controls"><p>Try the working interface using invented details. You are viewing a local simulation, with no real account, other users, verification or administration.</p><button data-demo="fresh">Start a new demo profile</button><button data-demo="reply">Simulate a reply</button><button data-demo="reset">Reset demo</button><button data-demo="close">Close controls</button></section>`;
const styles=`<style>body{padding-top:38px;--native-demo-inset:38px}header.top,.chat-head{top:38px}.fcount,.pcount{top:102px}#demo-bar{position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;height:38px;background:#262A32;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:4px 16px;z-index:50;gap:10px}#demo-status{font-size:10px;font-weight:700;letter-spacing:.06em;line-height:1.35}#demo-bar button{font-size:12px;font-weight:600;min-height:28px;padding:4px 12px;background:#ffffff12;border:1px solid #ffffff50;color:#fff;border-radius:7px}#demo-panel{position:fixed;top:44px;left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 24px));padding:18px;background:#fff;border:1px solid #E3E6ED;box-shadow:0 10px 50px #0003;border-radius:14px;z-index:51}#demo-panel[hidden]{display:none}#demo-panel p{font-size:12px;color:#71747D}#demo-panel button{display:block;width:100%;margin:8px 0}#demo-panel [data-demo=reply]{display:none}body[data-route=chat] #demo-panel [data-demo=reply]{display:block}body[data-route=discover] .card-photo,body[data-route=view] .card-photo{height:clamp(180px,calc(100svh - 488px),422px)}.planner{padding-top:calc(58px + env(safe-area-inset-top,0px))}.match{padding-top:68px}.chat-head .tiny::after{content:' · synthetic member'}</style>`;
function build(images,standalone=false) {
const {welcome,mark,...portraits}=images;
let demo=source.replace(/<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/g,'');
demo=demo.replace('const NATIVE_WELCOME_IMAGE = "preview-assets/synthetic-native-couple.png";','const NATIVE_WELCOME_IMAGE = window.__NATIVE_WELCOME_IMAGE__; delete window.__NATIVE_WELCOME_IMAGE__;');
demo=demo.replace('const FREE_MIDNIGHT_MARK = "preview-assets/free-midnight-emblem.png";','const FREE_MIDNIGHT_MARK = window.__FREE_MIDNIGHT_MARK__; delete window.__FREE_MIDNIGHT_MARK__;');
if(standalone){
  for(const font of fonts) demo=demo.replace(font.path,font.data);
  demo=demo.replace('</head>',`<script type="text/plain" id="native-font-license">${fonts.map(font=>font.path+'\n'+font.license).join('\n\n')}</script></head>`);
}
demo=demo.replace('<title>FREE MIDNIGHT — founding beta</title>','<title>FREE MIDNIGHT — interactive demo</title>');
demo=demo.replace('</head>',styles+'</head>');
demo=demo.replace('</head>',`<style>#demo-bar{background:var(--native-obsidian);color:var(--native-ivory)}#demo-bar button{background:transparent;border-color:#F6F0E860;color:var(--native-ivory);border-radius:999px}#demo-panel{background:var(--native-ivory);border-color:#11111126;box-shadow:0 10px 50px #11111133}#demo-panel p{color:var(--native-obsidian)}#demo-panel button{background:var(--native-ivory);color:var(--native-obsidian);border-color:#11111126}</style></head>`);
demo=demo.replace('<body>','<body>'+notice);
demo=demo.replace('<script>',`<script>window.__LOCAL_DEMO_PORTRAITS__=${json(portraits)};window.__NATIVE_WELCOME_IMAGE__=${json(welcome)};window.__FREE_MIDNIGHT_MARK__=${json(mark)};\n${runtime}</script>\n<script>`);
demo=demo.replace('ATLANTA · CHILD FREE, FULL OF POSSIBILITY','ATLANTA · SYNTHETIC DEMO');
demo=demo.replaceAll('Founding beta prototype. Profiles and messages are stored in this app\'s shared beta database. Avoid sensitive details such as your address or financial information.','Interactive demo. All profiles and messages are synthetic and stored only in this browser. Use invented details.');
demo=demo.replaceAll('No profiles are live yet.','No synthetic profiles are approved yet.');
demo=demo.replace('const APP_URL = "https://claude.ai/artifact/N7SbnP4m7YqKfYyQaevAJo";','const APP_URL = location.href.split("#")[0];');
demo=demo.replaceAll('A person on our team reviews every profile before members can see it.','Use Review to approve this synthetic profile. No real person reviews demo profiles.');
demo=demo.replaceAll("A person on our team will check it soon. You'll be able to discover members once it's approved.",'Use Review to approve this synthetic profile. Approval is simulated on this device.');
demo=demo.replaceAll('Every profile is reviewed by a person before discovery.','Synthetic approval is simulated through Review.');
return demo;
}
await writeFile('prototype/web-mvp1/demo.html',build(hostedImages));
await writeFile('prototype/web-mvp1/demo-standalone.html',build(embeddedImages,true));
console.log('Built standalone interactive demo. No providers or real accounts; image presets are deduplicated in saved state.');

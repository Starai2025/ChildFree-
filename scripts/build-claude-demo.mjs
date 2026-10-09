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
// One small "Demo" pill opens the demo menu; the app itself carries no demo bar. Review (team view) lives in the menu.
const notice=`<button id="demo-pill" data-demo="menu" aria-controls="demo-panel" aria-label="Demo controls">Demo</button><section id="demo-panel" hidden aria-label="Demo controls"><p class="demo-title">Interactive demo</p><p id="demo-status">Every person here is fictional. Progress is saved only in this browser.</p><div class="demo-actions"><button data-demo="reply">Simulate a reply</button><button data-demo="review" data-act="go" data-r="admin">Review queue (team view)</button><button data-demo="fresh">Start a new demo profile</button><button data-demo="reset">Reset demo</button><button data-demo="close">Close</button></div><div class="demo-confirm" hidden><p class="demo-confirm-text"></p><button data-demo="confirm">Continue</button><button data-demo="cancel">Cancel</button></div></section>`;
const styles=`<style>#demo-pill{position:fixed;z-index:50;top:14px;right:max(16px,calc(50% - 224px));display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:6px 14px;border:1px solid #F6F0E840;border-radius:999px;background:#111111D9;color:#F6F0E8;font:700 12px/1 "Midnight DM Sans",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;backdrop-filter:blur(8px);box-shadow:0 4px 16px #11111140;cursor:pointer}#demo-pill::before{content:"";width:7px;height:7px;border-radius:50%;background:#C89A2B}body[data-route=chat] #demo-pill{right:max(64px,calc(50% - 176px))}#demo-panel{position:fixed;z-index:51;top:56px;right:max(16px,calc(50% - 224px));width:min(320px,calc(100% - 32px));padding:20px;border:1px solid #11111126;border-radius:20px;background:#F6F0E8;color:#111111;box-shadow:0 16px 48px #11111140;font-family:"Midnight DM Sans",system-ui,sans-serif}#demo-panel[hidden],#demo-panel [hidden]{display:none}#demo-panel .demo-title{margin:0 0 4px;font:700 18px/1.3 "Midnight Lora",Georgia,serif}#demo-panel p{margin:0 0 12px;font-size:14px;line-height:1.45;color:#111111B8}#demo-panel button{display:block;width:100%;min-height:44px;margin:8px 0 0;padding:10px 16px;border:1px solid #11111133;border-radius:999px;background:transparent;color:#111111;font:600 15px/1.2 "Midnight DM Sans",system-ui,sans-serif;cursor:pointer}#demo-panel [data-demo=confirm]{border:0;background:#8A3324;color:#F6F0E8}#demo-panel [data-demo=reply]{display:none}body[data-route=chat] #demo-panel [data-demo=reply]{display:block}.demo-confirm-text{font-weight:600;color:#111111!important}body:has(#layer .planner) :is(#demo-pill,#demo-panel){display:none}</style>`;
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
demo=demo.replace('<body>','<body>'+notice);
demo=demo.replace('<script>',`<script>window.__LOCAL_DEMO_PORTRAITS__=${json(portraits)};window.__NATIVE_WELCOME_IMAGE__=${json(welcome)};window.__FREE_MIDNIGHT_MARK__=${json(mark)};\n${runtime}</script>\n<script>`);
demo=demo.replace('ATLANTA · CHILD FREE, FULL OF POSSIBILITY','ATLANTA');
demo=demo.replaceAll('Founding beta prototype. Profiles and messages are stored in this app\'s shared beta database. Avoid sensitive details such as your address or financial information.','Interactive demo. All profiles and messages are synthetic and stored only in this browser. Use invented details.');
demo=demo.replaceAll('No profiles are live yet.','No synthetic profiles are approved yet.');
demo=demo.replace('const APP_URL = "https://claude.ai/artifact/N7SbnP4m7YqKfYyQaevAJo";','const APP_URL = location.href.split("#")[0];');
demo=demo.replaceAll('A person on our team reviews every profile before members can see it.','In this demo, approve your profile from the Demo menu.');
demo=demo.replaceAll("A person on our team will check it soon. You'll be able to discover members once it's approved.",'In this demo, approve it from Demo → Review queue.');
demo=demo.replaceAll('Every profile is reviewed by a person before discovery.','In this demo, approval happens from the Demo menu.');
return demo;
}
await writeFile('prototype/web-mvp1/demo.html',build(hostedImages));
await writeFile('prototype/web-mvp1/demo-standalone.html',build(embeddedImages,true));
console.log('Built standalone interactive demo. No providers or real accounts; image presets are deduplicated in saved state.');

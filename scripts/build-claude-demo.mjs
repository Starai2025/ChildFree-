import {readFile,writeFile} from 'node:fs/promises';

const source=await readFile('prototype/web-mvp1/index.html','utf8');
const runtime=await readFile('prototype/web-mvp1/local-demo-runtime.js','utf8');
const embeddedImages=Object.fromEntries(await Promise.all(['amara','malik'].map(async name=>[name,`data:image/png;base64,${(await readFile(`prototype/web-mvp1/preview-assets/synthetic-${name}.png`)).toString('base64')}`])));
const hostedImages={amara:'preview-assets/synthetic-amara.png',malik:'preview-assets/synthetic-malik.png'};
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const notice=`<aside id="demo-bar" aria-label="Synthetic demo controls"><span id="demo-status">DEMO · SYNTHETIC PEOPLE<br>SAVED ONLY ON THIS DEVICE</span><button data-demo="menu">Demo controls</button></aside><section id="demo-panel" hidden aria-label="Demo controls"><p>Try the working interface using invented details. You are viewing a local simulation, with no real account, other users, verification or administration.</p><button data-demo="fresh">Start a new demo profile</button><button data-demo="reply">Simulate a reply</button><button data-demo="reset">Reset demo</button><button data-demo="close">Close controls</button></section>`;
const styles=`<style>body{padding-top:38px}header.top,.chat-head{top:38px}.fcount,.pcount{top:114px}#demo-bar{position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;height:38px;background:#262A32;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:4px 16px;z-index:50;gap:10px}#demo-status{font-size:8px;font-weight:600;letter-spacing:.3px;line-height:1.5}#demo-bar button{font-size:10px;min-height:28px;padding:4px 10px;background:#ffffff12;border:1px solid #ffffff50;color:#fff;border-radius:7px}#demo-panel{position:fixed;top:44px;left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 24px));padding:18px;background:#fff;border:1px solid #E3E6ED;box-shadow:0 10px 50px #0003;border-radius:14px;z-index:51}#demo-panel[hidden]{display:none}#demo-panel p{font-size:12px;color:#71747D}#demo-panel button{display:block;width:100%;margin:8px 0}#demo-panel [data-demo=reply]{display:none}body[data-route=chat] #demo-panel [data-demo=reply]{display:block}body[data-route=discover] .card-photo,body[data-route=view] .card-photo{height:clamp(180px,calc(100svh - 488px),422px)}.planner{padding-top:calc(58px + env(safe-area-inset-top,0px))}.match{padding-top:68px}.chat-head .tiny::after{content:' · synthetic member'}</style>`;
function build(images) {
let demo=source.replace(/<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/g,'');
demo=demo.replace('<title>Black Childfree — founding beta</title>','<title>Black Childfree — interactive demo</title>');
demo=demo.replace('</head>',styles+'</head>');
demo=demo.replace('<body>','<body>'+notice);
demo=demo.replace('<script>',`<script>window.__LOCAL_DEMO_PORTRAITS__=${json(images)};\n${runtime}</script>\n<script>`);
demo=demo.replace('ATLANTA · CHILD FREE, FULL OF POSSIBILITY','ATLANTA · SYNTHETIC DEMO');
demo=demo.replaceAll('Founding beta prototype. Profiles and messages are stored in this app\'s shared beta database. Avoid sensitive details such as your address or financial information.','Interactive demo. All profiles and messages are synthetic and stored only in this browser. Use invented details.');
demo=demo.replaceAll('No profiles are live yet.','No synthetic profiles are approved yet.');
demo=demo.replace('const APP_URL = "https://claude.ai/artifact/N7SbnP4m7YqKfYyQaevAJo";','const APP_URL = location.href.split("#")[0];');
demo=demo.replaceAll('A person on our team reviews every profile before members can see it.','Use Review to approve this synthetic profile. No real person reviews demo profiles.');
demo=demo.replaceAll("A person on our team will check it soon. You'll be able to discover members once it's approved.",'Use Review to approve this synthetic profile. Approval is simulated on this device.');
return demo;
}
await writeFile('prototype/web-mvp1/demo.html',build(hostedImages));
await writeFile('prototype/web-mvp1/demo-standalone.html',build(embeddedImages));
console.log('Built standalone interactive demo. No providers or real accounts; image presets are deduplicated in saved state.');

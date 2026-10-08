// Standalone DEMO ONLY: local synthetic data, no authentication or providers.
// The builder injects this into demo.html, never into the Claude index.html.
(() => {
  'use strict';
  const KEY = 'blackchildfree.claude-browser-demo.v1';
  const images = window.__LOCAL_DEMO_PORTRAITS__;
  delete window.__LOCAL_DEMO_PORTRAITS__;
  const clone = value => JSON.parse(JSON.stringify(value));
  const listeners = new Map();
  const stamp = Date.now();
  const compatibility = {version:1,answers:{faithPractice:'personal',faithPartner:'respect',faithImportance:'prefer',spendingPriority:'balanced',dateBudget:'casual',spendingImportance:'prefer',socialPace:'balanced',weekend:'mix',lifestyleImportance:'prefer',dateAvailability:'weekends'}};
  const profile = (name, gender) => ({name,gender,city:'Atlanta',zip:'30308',age:32,partnerGenders:['Man','Woman'],ageMin:25,ageMax:45,revision:1,photoCount:2,goal:'A committed relationship',marriage:"I'm open to marriage",bio:'Good conversation, weekend adventures, and a life built with intention.',prompts:[{id:'ordinary_sunday',a:'Coffee, the farmers market, and a long walk with nowhere to rush.'},{id:'partnership',a:'Choosing each other. Being kind, being honest, and making room to grow.'}],details:{height:70,faith:'Spiritual, not religious',interests:['Coffee','Live music','Art and museums']},lastActive:stamp});
  function fixtures(fresh = false) {
    const seeded = new Map();
    seeded.set('profiles/malik', profile('Malik','Man'));
    seeded.set('profiles/zuri', profile('Zuri','Woman'));
    seeded.get('profiles/malik').compatibility = clone(compatibility);
    seeded.set('approvals/malik', {status:'approved',revision:1,note:'Synthetic demo approval'});
    seeded.set('reactions/malik', {r:{amara:{k:'like',at:stamp-60000}}});
    if (!fresh) {
      seeded.set('profiles/amara', profile('Amara','Woman'));
      seeded.get('profiles/amara').compatibility = clone(compatibility);
      seeded.set('approvals/amara', {status:'approved',revision:1,note:'Synthetic demo approval'});
      seeded.set('data/users/amara/private', {elig:{dob:'1994-01-01',result:'eligible',answers:Array(6).fill('yes'),v:1},pledge:{v:1,at:stamp},matchSeen:{},lastRead:{}});
    }
    for (const id of ['amara','malik','zuri']) for (let i=0;i<2;i++) seeded.set(`photos/${id}/p/${i}`, {img:images[id==='malik'?'malik':'amara'],i,rev:1});
    if (fresh) for (let i=0;i<2;i++) seeded.set(`data/users/amara/photo${i}`, {img:images.amara});
    const venues = [
      ['cafe','Demo Grove Café','Midtown','Coffee & conversation'],
      ['garden','Demo Garden Patio','Decatur','Outdoors & walks'],
      ['gallery','Demo Art House','West End','Art & museums']
    ];
    for (const [id,name,area,vibe] of venues) seeded.set(`venues/${id}`,{name,area,address:'Fictional preview venue — no real address',vibes:[vibe,'Coffee & conversation'],tags:['Quiet enough to talk'],price:1,blurb:'A fictional venue for trying the date planner.',at:stamp});
    return seeded;
  }
  function encode(value) {
    return JSON.stringify({version:1,entries:[...value]},(key,item)=> {
      if (key==='img') for (const [name,image] of Object.entries(images)) if (item===image) return `@demo-portrait:${name}`;
      return item;
    });
  }
  function decode(raw) {
    const value = JSON.parse(raw,(key,item)=>key==='img' && typeof item==='string' && item.startsWith('@demo-portrait:') ? images[item.slice(15)] : item);
    if (value.version!==1 || !Array.isArray(value.entries) || value.entries.length>2000 || !value.entries.every(entry=>Array.isArray(entry)&&entry.length===2&&typeof entry[0]==='string'&&entry[1]&&typeof entry[1]==='object')) throw new Error('Unsupported demo state');
    return new Map(value.entries);
  }
  let docs;
  try {const saved=localStorage.getItem(KEY);docs=saved?decode(saved):fixtures();}
  catch {docs=fixtures();document.querySelector('#demo-status').textContent='DEMO · Saved data unavailable; fresh fixtures loaded';}
  const snapshot = path => ({exists:docs.has(path),data:()=>clone(docs.get(path))});
  const collection = path => ({docs:[...docs].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([key,value])=>({id:key.slice(path.length+1),data:()=>clone(value)}))});
  function notify(path) {
    for (const key of [path,path.slice(0,path.lastIndexOf('/'))]) for (const callback of listeners.get(key)||[]) queueMicrotask(callback);
  }
  function subscribe(path, callback, read) {
    const deliver=()=>callback(read(path));
    if (!listeners.has(path)) listeners.set(path,new Set());
    listeners.get(path).add(deliver);queueMicrotask(deliver);
    return ()=>listeners.get(path).delete(deliver);
  }
  function mutate(path,value,remove=false) {
    const next=new Map(docs);
    if (remove) next.delete(path);else next.set(path,clone(value));
    try {localStorage.setItem(KEY,encode(next));}
    catch {throw new Error('Demo progress could not be saved. Browser storage may be full or blocked.');}
    docs=next;notify(path);
  }
  const db={
    doc:path=>({get:async()=>snapshot(path),set:async value=>mutate(path,value),update:async patch=>mutate(path,{...docs.get(path),...clone(patch)}),delete:async()=>mutate(path,null,true),onSnapshot:callback=>subscribe(path,callback,snapshot)}),
    collection:path=>({get:async()=>collection(path),onSnapshot:callback=>subscribe(path,callback,collection)})
  };
  // Compatibility adapter for this isolated local demo. It is not a real session.
  window.claude={use:async name=>name==='db'?db:name==='user'?{id:async()=> 'amara',isOwner:async()=>true,can:async()=>true}:{join:async()=>({leave:async()=>{},presence:async()=>{},onPeers:()=>()=>{}})}};
  document.addEventListener('click',async event=> {
    const button=event.target.closest('[data-demo]');if (!button) return;
    const panel=document.querySelector('#demo-panel');
    try {
      if (button.dataset.demo==='menu') {panel.hidden=!panel.hidden;return;}
      if (button.dataset.demo==='close') {panel.hidden=true;return;}
      if (button.dataset.demo==='reset' || button.dataset.demo==='fresh') {
        const fresh=button.dataset.demo==='fresh';
        if (!confirm(fresh?'Start a new synthetic profile? This resets your local demo progress.':'Reset all synthetic demo progress on this device?')) return;
        localStorage.setItem(KEY,encode(fixtures(fresh)));location.reload();return;
      }
      if (button.dataset.demo==='reply') {
        const target=document.querySelector('[data-act="chat-menu"]')?.dataset.id;
        if (!target) {document.querySelector('#demo-status').textContent='DEMO · Open a conversation to simulate a reply';return;}
        const pair=['amara',target].sort().join('__');
        const path=`msgs/${target}/c/${pair}`;
        const previous=docs.get(path)||{to:'amara',list:[]};
        await db.doc(path).set({...previous,list:[...previous.list,{id:`demo-reply-${Date.now()}`,t:'Simulated reply: That sounds like my kind of Sunday. Coffee this weekend?',at:Date.now()}]});
        panel.hidden=true;
      }
    } catch (error) {document.querySelector('#demo-status').textContent=`DEMO · ${error.message}`;}
  });
})();

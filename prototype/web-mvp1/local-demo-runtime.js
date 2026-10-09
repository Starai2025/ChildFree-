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
  // Fictional cast. "amara" (shown as Jessica) is the demo user; "malik" is shown as Marcus. Internal ids stay stable for saved state.
  const CAST_VERSION = 2;
  const day = 86400000, hour = 3600000;
  const answers = (faithPractice,faithPartner,faithImportance,spendingPriority,dateBudget,spendingImportance,socialPace,weekend,lifestyleImportance,dateAvailability) =>
    ({version:1,answers:{faithPractice,faithPartner,faithImportance,spendingPriority,dateBudget,spendingImportance,socialPace,weekend,lifestyleImportance,dateAvailability}});
  const jessicaAnswers = answers('personal','respect','prefer','balanced','casual','prefer','balanced','mix','prefer','weekends');
  const people = {
    amara:   {name:'Jessica', gender:'Woman', age:32, city:'Atlanta', zip:'30308', seeks:['Man','Woman'], ageMin:25, ageMax:60, goal:'A committed relationship', marriage:"I'm open to marriage", height:66, faith:'Spiritual, not religious', interests:['Coffee','Live music','Art and museums'], compatibility:jessicaAnswers,
      bio:'Good conversation, weekend adventures, and a life built with intention.',
      prompts:[['ordinary_sunday','Coffee, the farmers market, and a long walk with nowhere to rush.'],['partnership','Choosing each other. Being kind, being honest, and making room to grow.']]},
    malik:   {name:'Marcus', gender:'Man', age:32, city:'Atlanta', zip:'30308', seeks:['Woman'], ageMin:25, ageMax:45, goal:'A committed relationship', marriage:"I'm open to marriage", height:70, faith:'Spiritual, not religious', interests:['Coffee','Live music','Art and museums','Cooking'], compatibility:jessicaAnswers,
      bio:'Easygoing, curious and always planning the next good meal.',
      prompts:[['ordinary_sunday','Coffee on the porch, a long run, then cooking something new for people I love.'],['partnership','Choosing each other. Being kind, being honest, and making room to grow.']],
      reply:'That sounds like my kind of Sunday. Coffee this weekend?'},
    michael: {name:'Michael', gender:'Man', age:52, city:'Decatur', zip:'30030', seeks:['Woman'], ageMin:30, ageMax:58, goal:'A life partner', marriage:'I want to marry', height:73, faith:'Christian', interests:['Jazz','Coffee','Live music','Travel'], compatibility:answers('daily','shared','essential','saving','occasion','prefer','balanced','culture','prefer','weekends'),
      bio:'Settled, grateful and ready to share the good life with the right person.',
      prompts:[['building','A home full of music, travel twice a year, and Sunday dinners with friends.'],['cared_for','Someone remembers the little things and shows up when it counts.']],
      reply:'I like your energy. Do you have a favorite jazz spot in the city?'},
    brandon: {name:'Brandon', gender:'Man', age:29, city:'West End', zip:'30310', seeks:['Woman'], ageMin:25, ageMax:36, goal:'A committed relationship', marriage:"I'm open to marriage", height:71, faith:'Agnostic', interests:['Hiking','Hip-hop','Brunch','Photography'], compatibility:answers('secular','respect','flexible','experiences','free','flexible','social','outdoors','prefer','flexible'),
      bio:'Weekend hiker, weekday photographer, full-time brunch enthusiast.',
      prompts:[['joy','Catching golden hour on a trail with a camera in my hand.'],['life_together','Spontaneous road trips, a dog named after a rapper, and plenty of sleep.']],
      reply:'Ha, I was hoping you\'d say that. Trail or brunch first?'},
    anthony: {name:'Anthony', gender:'Man', age:59, city:'Buckhead', zip:'30305', seeks:['Woman'], ageMin:30, ageMax:62, goal:'A life partner', marriage:"I don't plan to marry", height:72, faith:'Christian', interests:['Golf','Wine','Travel','Art and museums'], compatibility:answers('occasional','respect','prefer','balanced','occasion','prefer','quiet','culture','flexible','flexible'),
      bio:'Retired early, traveling often, looking for a partner in the next adventure.',
      prompts:[['tradition','Sunday golf, a good bottle of wine and a long dinner after.'],['building','Freedom, companionship and seeing the world together.']],
      reply:'What a nice surprise. Have you been to the High Museum lately?'},
    chris:   {name:'Chris', gender:'Man', age:41, city:'Midtown', zip:'30309', seeks:['Woman'], ageMin:28, ageMax:48, goal:'A committed relationship', marriage:"I'm open to marriage", height:69, faith:'Spiritual, not religious', interests:['Art and museums','Playing sports','Photography','Reading'], compatibility:answers('personal','explore','flexible','balanced','casual','prefer','balanced','culture','prefer','weekdays'),
      bio:'Tennis in the morning, galleries in the afternoon, a good book at night.',
      prompts:[['joy','A new exhibit, an empty gallery and nowhere to be.'],['partnership','Two full lives that are better together.']],
      reply:'I meant every word. Farmers market this weekend?'},
    jason:   {name:'Jason', gender:'Man', age:45, city:'Grant Park', zip:'30312', seeks:['Woman'], ageMin:30, ageMax:50, goal:'A life partner', marriage:'I want to marry', height:74, faith:'Christian', interests:['Coffee','Watching sports','R&B and soul','Cooking'], compatibility:answers('daily','respect','prefer','balanced','casual','prefer','balanced','mix','prefer','weekends'),
      bio:'Homebody with a passport. I cook, I host and I always bring dessert.',
      prompts:[['ordinary_sunday','Pancakes, the game on, and a walk through Grant Park.'],['cared_for','Someone makes time for me even when life is busy.']],
      reply:'Can\'t wait for Saturday. I\'ll grab us a table by the window.'},
    kevin:   {name:'Kevin', gender:'Man', age:36, city:'Old Fourth Ward', zip:'30308', seeks:['Woman'], ageMin:28, ageMax:42, goal:'A committed relationship', marriage:"I'm open to marriage", height:70, faith:'Agnostic', interests:['Fitness','Comedy','Running','Brunch'], compatibility:answers('secular','respect','flexible','experiences','casual','flexible','social','outdoors','prefer','flexible'),
      bio:'Beltline runner, comedy-show regular, terrible at karaoke.',
      prompts:[['joy','A morning run on the Beltline and a big brunch after.'],['life_together','Travel, laughter and plenty of lazy Sundays.']],
      reply:'Glad we matched! Did you see the date idea I sent?'},
    brittany:{name:'Brittany', gender:'Woman', age:27, city:'Midtown', zip:'30309', seeks:['Man','Woman'], ageMin:25, ageMax:38, goal:'A committed relationship', marriage:"I'm open to marriage", height:65, faith:'Spiritual, not religious', interests:['Coffee','Art and museums','Dancing','Brunch'], compatibility:answers('personal','explore','flexible','experiences','casual','flexible','social','culture','prefer','weekends'),
      bio:'Designer by day, dancer by night, coffee always.',
      prompts:[['joy','Discovering a new coffee shop and staying way too long.'],['partnership','Hyping each other up and keeping life fun.']],
      reply:'Okay, I like you already. Coffee or a gallery first?'},
    lauren:  {name:'Lauren', gender:'Woman', age:35, city:'Kirkwood', zip:'30317', seeks:['Man'], ageMin:30, ageMax:45, goal:'A committed relationship', marriage:'I want to marry', height:67, faith:'Christian', interests:['Reading','Yoga','Cooking'], compatibility:answers('daily','shared','essential','saving','casual','prefer','quiet','home','prefer','weekdays'),
      bio:'Bookworm, yoga regular and a very good cook.', approved:false,
      prompts:[['cared_for','Someone cooks with me and leaves the kitchen cleaner than they found it.'],['building','A calm, joyful home with room for friends.']]},
    ashley:  {name:'Ashley', gender:'Woman', age:39, city:'Inman Park', zip:'30307', seeks:['Woman','Man'], ageMin:30, ageMax:48, goal:'A committed relationship', marriage:"I'm open to marriage", height:66, faith:'Spiritual, not religious', interests:['Yoga','Live music','Reading','Wine'], compatibility:answers('personal','respect','prefer','balanced','occasion','prefer','balanced','culture','prefer','weekends'),
      bio:'Live-music regular with a soft spot for small venues.',
      prompts:[['joy','A jazz trio, a glass of wine and good company.'],['partnership','Being each other\'s safe place.']],
      reply:'I\'ll send you the name of that spot. Friday?'},
    nicole:  {name:'Nicole', gender:'Woman', age:46, city:'East Atlanta', zip:'30316', seeks:['Man'], ageMin:38, ageMax:58, goal:'A life partner', marriage:"I'm open to marriage", height:68, faith:'Christian', interests:['Gardening','Gospel','Volunteering'], compatibility:answers('daily','shared','essential','saving','free','prefer','quiet','home','prefer','weekends'),
      bio:'Gardener, volunteer and proud auntie.', approved:false,
      prompts:[['tradition','Sunday dinner at my place, everyone welcome.'],['cared_for','Someone checks in just because.']]},
    danielle:{name:'Danielle', gender:'Woman', age:51, city:'East Point', zip:'30344', seeks:['Woman'], ageMin:30, ageMax:58, goal:'A life partner', marriage:"I don't plan to marry", height:67, faith:'Christian', interests:['Gospel','Gardening','Coffee','Live music'], compatibility:answers('daily','respect','prefer','saving','casual','prefer','quiet','home','prefer','weekends'),
      bio:'Choir on Sundays, garden on Saturdays, good coffee every day.',
      prompts:[['ordinary_sunday','Church, brunch with friends and an afternoon in the garden.'],['building','Peace, laughter and someone to grow old with.']],
      reply:'You have great taste. Have you tried the café on Main Street?'},
    rachel:  {name:'Rachel', gender:'Woman', age:59, city:'Sandy Springs', zip:'30328', seeks:['Man','Woman'], ageMin:32, ageMax:65, goal:'A life partner', marriage:"I'm open to marriage", height:64, faith:'Jewish', interests:['Theater','Travel','Wine','Art and museums'], compatibility:answers('occasional','respect','flexible','experiences','occasion','flexible','social','culture','prefer','flexible'),
      bio:'Theater lover and world traveler with a full calendar and room for one more.',
      prompts:[['joy','Opening night, a good seat and dinner after.'],['life_together','Passports, plays and long talks over wine.']],
      reply:'Lovely to hear from you. Have you seen anything at the Alliance this season?'}
  };
  // Members active this week rank ahead of quieter ones when nothing else separates them.
  // A brand-new demo profile has no matches yet, so only Marcus and a few women are recently active there.
  const ACTIVE_THIS_WEEK = ['amara','malik','jason','kevin','ashley','brittany','danielle'];
  const ACTIVE_FOR_NEW_PROFILE = ['malik','brittany','danielle'];
  const profileOf = (id, p, fresh) => ({name:p.name,gender:p.gender,city:p.city,zip:p.zip,age:p.age,partnerGenders:p.seeks,ageMin:p.ageMin,ageMax:p.ageMax,revision:1,photoCount:2,goal:p.goal,marriage:p.marriage,bio:p.bio,
    prompts:p.prompts.map(([id,a])=>({id,a})),details:{height:p.height,faith:p.faith,interests:p.interests.slice()},compatibility:clone(p.compatibility),lastActive:(fresh?ACTIVE_FOR_NEW_PROFILE:ACTIVE_THIS_WEEK).includes(id)?stamp-(id.length%5)*hour:stamp-(8+id.length%5)*day});
  const portrait = (id, i) => images[`${id}${i ? '-2' : ''}`] || images[id] || images[people[id].gender === 'Man' ? 'malik' : 'amara'];
  // Local "YYYY-MM-DDTHH:MM" for the next given weekday (0 = Sunday), at least one day ahead.
  const nextDay = (weekday, time) => {const d = new Date(stamp + day); while (d.getDay() !== weekday) d.setDate(d.getDate()+1); const pad = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${time}`;};
  const pair = other => ['amara', other].sort().join('__');
  const thread = (lines) => {const mine = [], theirs = []; lines.forEach(([me, t], i) => (me ? mine : theirs).push({id:`demo-${i}-${me ? 'j' : 't'}`, t, at:stamp - (lines.length - i) * 40 * 60000})); return {mine, theirs};};
  function fixtures(fresh = false) {
    const seeded = new Map();
    for (const [id, p] of Object.entries(people)) {
      if (id === 'amara' && fresh) continue;
      seeded.set(`profiles/${id}`, profileOf(id, p, fresh));
      if (p.approved !== false) seeded.set(`approvals/${id}`, {status:'approved', revision:1, note:'Synthetic demo approval'});
      for (let i = 0; i < 2; i++) seeded.set(`photos/${id}/p/${i}`, {img:portrait(id, i), i, rev:1});
    }
    // Who already likes Jessica. Chris left a comment on her Sunday prompt.
    seeded.set('reactions/malik', {r:{amara:{k:'like', at:stamp - 60000}}});
    seeded.set('reactions/chris', {r:{amara:{k:'like', at:stamp - 8 * day, on:'prompt:ordinary_sunday', note:'Farmers market and a long walk? You had me at coffee.'}}});
    for (const id of ['jason','kevin','ashley']) seeded.set(`reactions/${id}`, {r:{amara:{k:'like', at:stamp - 3 * day}}});
    const venues = [
      ['cafe','Demo Grove Café','Midtown','Coffee & conversation'],
      ['garden','Demo Garden Patio','Decatur','Outdoors & walks'],
      ['gallery','Demo Art House','West End','Art & museums']
    ];
    for (const [id,name,area,vibe] of venues) seeded.set(`venues/${id}`,{name,area,address:'Fictional preview venue — no real address',vibes:[vibe,'Coffee & conversation'],tags:['Quiet enough to talk'],price:1,blurb:'A fictional venue for trying the date planner.',at:stamp});
    const cache = Object.fromEntries(venues.map(([id,name,area,vibe]) => [id,{name,area,address:'Fictional preview venue — no real address',vibes:[vibe],tags:['Quiet enough to talk'],price:1,blurb:'A fictional venue for trying the date planner.'}]));
    seeded.set('events/mixer', {title:'Founding cohort mixer', when:nextDay(5,'19:00'), place:'Demo Art House, West End (fictional venue)', details:'Meet other founding members over music and small bites. Synthetic demo event.', capacity:40, at:stamp});
    for (const id of ['jason','ashley','danielle','brittany']) seeded.set(`rsvps/${id}`, {going:{mixer:true}});
    if (!fresh) {
      seeded.set('data/users/amara/private', {elig:{dob:'1994-01-01',result:'eligible',answers:Array(6).fill('yes'),v:1},pledge:{v:1,at:stamp},matchSeen:{jason:stamp,kevin:stamp,ashley:stamp},lastRead:{[pair('ashley')]:stamp}});
      seeded.set('reactions/amara', {r:Object.fromEntries(['jason','kevin','ashley'].map(id => [id,{k:'like', at:stamp - 2 * day}]))});
      // Jason: an ongoing conversation and a locked Saturday date he proposed.
      const saturday = nextDay(6,'11:00'), dateId = 'demo-date-jason';
      const j = thread([[0,'Your Sunday prompt had me sold. Farmers market at Grant Park sometime?'],[1,'I\'d love that. Is the coffee there any good?'],[0,'It\'s fine, but I know a better café nearby. Saturday at 11?'],[1,'Saturday works. Looking forward to it.'],[0,'Locked it in. See you then.']]);
      seeded.set(`msgs/jason/c/${pair('jason')}`, {to:'amara', list:j.theirs, seenAt:stamp, plan:{id:dateId, role:'init', vibe:'Coffee & conversation', budget:1, times:[saturday], rounds:[['cafe']], likes:{'0:cafe':true}, sent:0, accept:'', status:'active', at:stamp - day, venueCache:{cafe:cache.cafe}}});
      seeded.set(`msgs/amara/c/${pair('jason')}`, {to:'jason', list:j.mine, seenAt:stamp - 50 * 60000, plan:{id:dateId, role:'resp', likes:{'0:cafe':true}, done:0, request:-1, custom:null, pick:{venue:'cafe', time:saturday}, status:'active', at:stamp - day}});
      // Ashley: a friendly conversation, already read.
      const a = thread([[1,'Hi Ashley! A fellow live-music fan. Who have you seen lately?'],[0,'A jazz trio at a tiny spot in Inman Park. You would love it.']]);
      seeded.set(`msgs/ashley/c/${pair('ashley')}`, {to:'amara', list:a.theirs, seenAt:stamp});
      seeded.set(`msgs/amara/c/${pair('ashley')}`, {to:'ashley', list:a.mine, seenAt:stamp});
      // Kevin: a new match who has already proposed a coffee date. It's Jessica's turn.
      seeded.set(`msgs/kevin/c/${pair('kevin')}`, {to:'amara', list:[], seenAt:0, plan:{id:'demo-date-kevin', role:'init', vibe:'Coffee & conversation', budget:1, times:[nextDay(4,'19:00'), nextDay(0,'14:00')], rounds:[['cafe','garden','gallery']], likes:{'0:cafe':true,'0:garden':true}, sent:0, accept:'', status:'active', at:stamp - 5 * hour, venueCache:cache}});
    }
    if (fresh) for (let i=0;i<2;i++) seeded.set(`data/users/amara/photo${i}`, {img:portrait('amara', i)});
    return seeded;
  }
  function encode(value) {
    return JSON.stringify({version:1,cast:CAST_VERSION,entries:[...value]},(key,item)=> {
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
  try {const saved=localStorage.getItem(KEY);docs=saved&&JSON.parse(saved).cast===CAST_VERSION?decode(saved):fixtures();}
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
        await db.doc(path).set({...previous,list:[...previous.list,{id:`demo-reply-${Date.now()}`,t:`Simulated reply: ${(people[target]||{}).reply||'Great to hear from you. Tell me more!'}`,at:Date.now()}]});
        panel.hidden=true;
      }
    } catch (error) {document.querySelector('#demo-status').textContent=`DEMO · ${error.message}`;}
  });
})();

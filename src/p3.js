/* p3: player state, save/load + v1 migration, inventory & equipment,
       XP with overflow, quests, dailies, login bonus, feedback (floaters,
       toasts, level flash, xp bar, sfx) */

function freshPlayer(){return{
  v:SAVE_VERSION,
  map:'town',tx:11,ty:10,px:11*TILE,py:10*TILE,facing:1,
  hp:10,
  xp:{attack:0,strength:0,defence:0,ranged:0,magic:0,woodcutting:0,mining:0},
  style:'accurate', // melee training style: accurate|aggressive|defensive
  gold:0,
  inv:[],            // [{id,qty}] for stackables, [{gear:{id,r}}] for gear
  bank:{},           // stackables only: id -> qty
  bankGear:[],       // gear pieces: [{id,r}]
  gear:{weapon:null,shield:null,helmet:null,body:null,legs:null,cape:null}, // {id,r}
  tools:{axe:'bronze_axe',pick:'bronze_pick'},
  ownedTools:['bronze_axe','bronze_pick'],
  capes:[],          // earned+bought cape ids
  quests:{},questProg:{},
  daily:{date:'',tasks:[],prog:{},claimed:[]},
  login:{last:'',streak:0},
  grave:null,        // {map,x,y,items:[...],gold,left}  left = ms remaining
  stats:{kills:0,deaths:0,chopped:0,mined:0,bossKills:{},legendaries:0,
         playMs:0,bestDrop:null,questsDone:0},
  ts:0,              // save timestamp (Date.now) for cloud LWW
  moving:null,path:[],action:null,
};}
let P=freshPlayer();
const lvl=s=>lvlFor(P.xp[s]);
function totalLevel(){return SKILL_ORDER.reduce((a,s)=>a+lvl(s),0);}
function maxHp(){
  let hp=10;
  for(const slot in P.gear){const pc=P.gear[slot];
    if(pc&&GEAR[pc.id]){const st=gearStats(pc);hp+=st.hp||0;}}
  return hp;
}

/* ---------------- storage (localStorage with in-memory fallback) ------ */
const store=(()=>{let mem={};
  try{localStorage.setItem('__t','1');localStorage.removeItem('__t');
    return{get:k=>localStorage.getItem(k),set:(k,v)=>localStorage.setItem(k,v),
           del:k=>localStorage.removeItem(k),mem:false};}
  catch(e){return{get:k=>mem[k]??null,set:(k,v)=>{mem[k]=v;},del:k=>{delete mem[k];},mem:true};}
})();
const SAVE_KEY='emberbrook_v2';
const OLD_KEY='emberbrook_v1';

function serialize(){
  const {moving,path,action,...clean}=P;
  clean.ts=Date.now();
  /* persist ground drops per map so loot survives reload */
  clean.worldDrops={};
  for(const m in world)clean.worldDrops[m]=world[m].drops;
  return clean;
}
function save(){
  P.ts=Date.now();
  try{store.set(SAVE_KEY,JSON.stringify(serialize()));}catch(e){}
  syncPushSoon();
}
function applySave(d){
  const fp=freshPlayer();
  P={...fp,...d,moving:null,path:[],action:null};
  P.xp={...fp.xp,...(d.xp||{})};
  P.gear={...fp.gear,...(d.gear||{})};
  P.stats={...fp.stats,...(d.stats||{})};
  if(d.worldDrops)for(const m in d.worldDrops){if(world[m])world[m].drops=d.worldDrops[m];}
  delete P.worldDrops;
  P.hp=clamp(P.hp,1,maxHp());
}
function load(){
  const raw=store.get(SAVE_KEY);
  if(raw){try{applySave(JSON.parse(raw));return true;}catch(e){}}
  const old=store.get(OLD_KEY);
  if(old){try{applySave(migrateV1(JSON.parse(old)));toast('Save upgraded to v2!','good');return true;}catch(e){}}
  return false;
}
/* v1 -> v2: combat xp splits evenly into attack/strength/defence */
function migrateV1(o){
  const d=freshPlayer();
  const cmb=(o.xp&&o.xp.combat)||0;
  d.xp.attack=d.xp.strength=d.xp.defence=Math.floor(cmb/3);
  d.xp.woodcutting=(o.xp&&o.xp.woodcutting)||0;
  d.xp.mining=(o.xp&&o.xp.mining)||0;
  d.gold=o.gold||0;
  d.bank={...(o.bank||{})};
  d.quests={...(o.quests||{})};d.questProg={...(o.questProg||{})};
  d.daily=o.daily||d.daily; d.login=o.login||d.login;
  d.stats={...d.stats,kills:(o.stats&&o.stats.kills)||0,
    chopped:(o.stats&&o.stats.chopped)||0,mined:(o.stats&&o.stats.mined)||0};
  /* keep known stackables */
  (o.inv||[]).forEach(s=>{if(ITEMS[s.id])d.inv.push({id:s.id,qty:s.qty});});
  /* v1 tools + weapon -> v2 equivalents */
  if(o.equip){
    if(o.equip.axe)d.tools.axe=o.equip.axe,d.ownedTools.push(o.equip.axe);
    if(o.equip.pick)d.tools.pick=o.equip.pick,d.ownedTools.push(o.equip.pick);
    const wep=o.equip.weapon||'';
    d.gear.weapon={id:wep.includes('iron')?'g_m_2_weapon':'g_m_1_weapon',r:0};
  }else d.gear.weapon={id:'g_m_1_weapon',r:0};
  d.ownedTools=[...new Set(d.ownedTools)];
  return d;
}
function resetSave(){store.del(SAVE_KEY);store.del(OLD_KEY);location.reload();}

/* ---------------- inventory ---------------- */
function invGet(id){return P.inv.find(s=>s.id===id&&!s.gear);}
function invCount(id){const s=invGet(id);return s?s.qty:0;}
function invSlotsUsed(){return P.inv.length;}
function addItem(id,qty){ // stackables
  const s=invGet(id);
  if(s){s.qty+=qty;return true;}
  if(P.inv.length>=INV_CAP)return false;
  P.inv.push({id,qty});return true;
}
function removeItem(id,qty){
  const s=invGet(id);if(!s||s.qty<qty)return false;
  s.qty-=qty;if(s.qty<=0)P.inv.splice(P.inv.indexOf(s),1);return true;
}
function addGear(piece){ // {id,r} one slot each
  if(P.inv.length>=INV_CAP)return false;
  P.inv.push({gear:{id:piece.id,r:piece.r||0}});return true;
}
function addGold(n){P.gold+=n;dailyEvent('gold',null,n);updateHUD();}

/* ---------------- equipment ---------------- */
function canEquip(piece){
  const g=GEAR[piece.id];if(!g)return{ok:false,why:'?'};
  const have=lvl(g.reqSkill);
  if(have<g.req)return{ok:false,why:`${SKILLS[g.reqSkill].name} ${g.req} required`};
  /* 2-handed rule not used (one weapon per line) — shields always allowed */
  return{ok:true};
}
function equipGear(invIndex){
  const slotItem=P.inv[invIndex];if(!slotItem||!slotItem.gear)return;
  const piece=slotItem.gear,g=GEAR[piece.id];
  const chk=canEquip(piece);
  if(!chk.ok){toast(chk.why,'bad');return;}
  P.inv.splice(invIndex,1);
  const prev=P.gear[g.slot];
  P.gear[g.slot]={id:piece.id,r:piece.r||0};
  if(prev)P.inv.push({gear:prev});
  P.hp=clamp(P.hp,1,maxHp());
  sfx('equip');updateHUD();save();
}
function unequip(slot){
  const pc=P.gear[slot];if(!pc)return;
  if(P.inv.length>=INV_CAP){toast('Inventory full','bad');return;}
  P.gear[slot]=null;P.inv.push({gear:pc});
  P.hp=clamp(P.hp,1,maxHp());updateHUD();save();
}
function equipCape(capeId){
  if(!P.capes.includes(capeId))return;
  const prev=P.gear.cape;
  P.gear.cape={id:capeId,r:0};
  if(prev&&prev.id!==capeId&&!CAPES[prev.id])P.inv.push({gear:prev});
  updateHUD();save();
}
/* aggregate combat bonuses from equipment */
function gearBonus(){
  const b={acc:0,pow:0,def:0,rpow:0,mpow:0};
  for(const slot in P.gear){const pc=P.gear[slot];
    if(!pc||!GEAR[pc.id])continue;const st=gearStats(pc);
    for(const k in b)b[k]+=st[k]||0;}
  return b;
}

/* ---------------- XP (overflow past the cap keeps counting) ---------- */
function gainXp(skill,amount){
  if(amount<=0)return;
  const before=lvl(skill);
  P.xp[skill]+=Math.round(amount);
  const after=lvl(skill);
  showXpBar(skill);
  if(after>before){
    levelFlash(`${SKILLS[skill].name} level ${after}!`);
    sfx('level');
    if(after===MAX_LVL)toast(`${SKILLS[skill].name} mastered! Visit Master Aldric for your cape.`,'gold');
  }
}

/* ---------------- quests ---------------- */
function questState(id){
  const st=P.quests[id];
  if(st==='done')return'done';
  if(st==='active')return (P.questProg[id]||0)>=QUESTS[id].need?'ready':'active';
  const i=QUEST_ORDER.indexOf(id);
  return (i===0||P.quests[QUEST_ORDER[i-1]]==='done')?'available':'locked';
}
function questEvent(kind,what,map){
  for(const id of QUEST_ORDER){
    if(P.quests[id]!=='active')continue;
    const q=QUESTS[id];
    if(q.kind!==kind)continue;
    const match=q.kind==='gather'?q.item.includes(what):q.mob.includes(what);
    if(match){P.questProg[id]=(P.questProg[id]||0)+1;
      if(P.questProg[id]===q.need)toast(`${q.name}: ready to turn in!`,'good');}
  }
  dailyEvent(kind,what,1,map);
}

/* ---------------- dailies & login bonus ---------------- */
function todayStr(){return new Date().toISOString().slice(0,10);}
function seedShuffle(arr,seed){
  const a=[...arr];let s=seed;
  for(let i=a.length-1;i>0;i--){s=(s*9301+49297)%233280;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function rollDailies(){
  const today=todayStr();
  if(P.daily.date===today)return;
  const seed=[...today].reduce((a,c)=>a+c.charCodeAt(0),0);
  P.daily={date:today,tasks:seedShuffle(DAILY_POOL,seed).slice(0,3).map(t=>t.id),prog:{},claimed:[]};
}
function dailyEvent(kind,what,amt,map){
  if(!P.daily.tasks)return;
  for(const tid of P.daily.tasks){
    if(P.daily.claimed.includes(tid))continue;
    const t=DAILY_POOL.find(d=>d.id===tid);if(!t)continue;
    let hit=false;
    if(t.kind===kind){
      if(kind==='gold')hit=true;
      else if(kind==='gather')hit=t.item?t.item.includes(what):true;
      else if(kind==='kill')hit=t.mob?t.mob.includes(what):true;
      else hit=true;
    }
    if(t.kind==='killmap'&&kind==='kill'&&map===t.map)hit=true;
    if(t.kind==='stylehit'&&kind==='stylehit')hit=true;
    if(hit)P.daily.prog[tid]=(P.daily.prog[tid]||0)+(amt||1);
  }
}
function loginBonus(){
  const today=todayStr();
  if(P.login.last===today)return;
  const yesterday=new Date(Date.now()-864e5).toISOString().slice(0,10);
  P.login.streak=P.login.last===yesterday?P.login.streak+1:1;
  P.login.last=today;
  const g=Math.min(20+P.login.streak*10,100);
  P.gold+=g;
  toast(`Daily bonus: +${g}g (streak ${P.login.streak})`,'gold');
}

/* ---------------- feedback ---------------- */
const floaters=[];
function floater(x,y,txt,color){floaters.push({x,y,txt,color,t0:T,life:1100});}
function toast(msg,cls){
  const el=document.createElement('div');el.className='toast '+(cls||'');el.textContent=msg;
  $('toasts').appendChild(el);
  setTimeout(()=>el.classList.add('show'),10);
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300);},2600);
}
function levelFlash(txt){
  $('flashText').textContent=txt;
  const el=$('flash');el.classList.remove('go');
  void el.offsetWidth;el.classList.add('go');
}
let xpBarTimer=null,xpSkill='woodcutting';
function showXpBar(skill){
  xpSkill=skill;const l=lvl(skill);
  const lo=xpAt(l),hi=xpAt(l+1);
  const frac=l>=MAX_LVL?1:clamp((P.xp[skill]-lo)/(hi-lo),0,1);
  $('xpfill').style.width=(frac*100)+'%';
  $('xpfill').style.background=SKILLS[skill].color;
  $('xplabel').textContent=`${SKILLS[skill].name} ${l}${l>=MAX_LVL?' (MAX)':''}`;
  $('xpnum').textContent=l>=MAX_LVL?fmtXp(P.xp[skill])+' xp':(P.xp[skill]-lo)+' / '+(hi-lo);
  $('xpwrap').classList.add('show');
  clearTimeout(xpBarTimer);xpBarTimer=setTimeout(()=>$('xpwrap').classList.remove('show'),2500);
}
/* tiny WebAudio sfx */
let AC=null,soundOn=true;
function ensureAudio(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}}
function beep(freq,dur,type,vol,when){
  if(!AC||!soundOn)return;
  const o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'square';o.frequency.value=freq;
  g.gain.setValueAtTime(vol||.04,AC.currentTime+(when||0));
  g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+(when||0)+dur);
  o.connect(g).connect(AC.destination);
  o.start(AC.currentTime+(when||0));o.stop(AC.currentTime+(when||0)+dur+.02);
}
function sfx(kind){
  if(!AC||!soundOn)return;
  switch(kind){
    case'chop':beep(180,.08);break;
    case'mine':beep(140,.09,'triangle');break;
    case'hit':beep(220,.06,'sawtooth',.03);break;
    case'hurt':beep(110,.12,'sawtooth',.05);break;
    case'shoot':beep(500,.05,'triangle',.03);break;
    case'zap':beep(700,.09,'sine',.04);beep(900,.06,'sine',.03,.05);break;
    case'kill':beep(320,.07);beep(240,.09,'square',.04,.07);break;
    case'loot':beep(520,.06,'triangle');beep(660,.08,'triangle',.04,.06);break;
    case'rare':beep(520,.08,'triangle',.05);beep(660,.08,'triangle',.05,.08);beep(880,.14,'triangle',.05,.16);break;
    case'level':beep(392,.1,'triangle',.06);beep(523,.1,'triangle',.06,.1);beep(659,.18,'triangle',.06,.2);break;
    case'eat':beep(260,.08,'sine',.05);break;
    case'equip':beep(300,.05,'square',.04);beep(420,.06,'square',.04,.05);break;
    case'coin':beep(700,.05,'triangle',.04);beep(880,.06,'triangle',.03,.04);break;
    case'die':beep(200,.2,'sawtooth',.06);beep(150,.25,'sawtooth',.05,.15);beep(100,.35,'sawtooth',.05,.3);break;
  }
}

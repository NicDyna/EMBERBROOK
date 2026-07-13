/* p8: cloud sync client (last-write-wins), SW registration, tap input,
       boot & main loop, EB debug handle */

/* ---------------- sync (single player, shared token) ----------------
   Push: throttled after every save + on tab hide.
   Pull: on boot and when the tab regains focus — the save with the
   newest ts wins (last-write-wins). Offline: silently skipped. */
const SYNC={state:'off',lastOk:0,err:'',pushT:0,pending:false};
function syncHeaders(){return{'Content-Type':'application/json','x-eb-token':store.get('eb_token')||''};}
function syncEnabled(){return !!(store.get('eb_token')||'').trim()&&location.protocol.startsWith('http');}
async function syncPull(){
  if(!syncEnabled())return;
  try{
    const res=await fetch('/api/save',{headers:syncHeaders()});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    if(data.save&&data.save.ts&&data.save.ts>(P.ts||0)){
      applySave(data.save);
      rebuildPlayerSprite();updateHUD();
      $('zone').textContent=MAPS[P.map].name;
      toast('☁ Loaded newer save from the cloud','good');
      store.set(SAVE_KEY,JSON.stringify(serialize()));
    }
    SYNC.state='ok';SYNC.lastOk=Date.now();
  }catch(e){SYNC.state='err';SYNC.err=String(e.message||e);}
}
async function syncPush(){
  if(!syncEnabled())return;
  try{
    const res=await fetch('/api/save',{method:'POST',headers:syncHeaders(),
      body:JSON.stringify({save:serialize()})});
    if(!res.ok)throw new Error('HTTP '+res.status);
    SYNC.state='ok';SYNC.lastOk=Date.now();
  }catch(e){SYNC.state='err';SYNC.err=String(e.message||e);}
}
function syncPushSoon(){ // throttle: at most one push per 30s
  if(!syncEnabled())return;
  if(SYNC.pending)return;
  const wait=Math.max(0,30000-(Date.now()-SYNC.pushT));
  SYNC.pending=true;
  setTimeout(()=>{SYNC.pending=false;SYNC.pushT=Date.now();syncPush();},wait);
}
async function syncNow(verbose){
  if(!syncEnabled()){SYNC.state='off';if(verbose)toast('Enter the secret token first.','bad');return;}
  await syncPull();
  await syncPush();
  if(verbose)toast(SYNC.state==='ok'?'☁ Sync complete':'⚠ Sync failed: '+SYNC.err,SYNC.state==='ok'?'good':'bad');
}

/* ---------------- input ---------------- */
function bindInput(){
  let press=null;
  const endPress=()=>{if(press){clearTimeout(press.timer);press=null;}};
  /* the world tap action (drop > mob > npc > resource > board/monument > walk) */
  function tapAt(tx,ty,wx,wy){
    const d=dropAt(P.map,tx,ty);
    if(d){setLoot(d);clickMark={x:tx,y:ty,t0:T};return;}
    const m=mobAt(P.map,tx,ty)||world[P.map].mobs.find(mm=>{
      if(!mm.alive)return false;
      const big=MOBS[mm.type].boss?30:18;
      return Math.abs(mm.px+16-wx)<big&&Math.abs(mm.py+16-(MOBS[mm.type].boss?16:0)-wy)<big;
    });
    if(m){setFight(m);clickMark={x:m.tx,y:m.ty,t0:T};return;}
    const n=npcAt(P.map,tx,ty);
    if(n){setTalk(n);clickMark={x:n.tx,y:n.ty,t0:T};return;}
    let r=resAt(P.map,tx,ty);
    if(!r){const below=resAt(P.map,tx,ty+1); /* tree canopy renders a tile above its base */
      if(below&&RES[below.type].skill==='woodcutting')r=below;}
    if(tileAt(P.map,tx,ty)==='Q'){openQuestBoard();clickMark={x:tx,y:ty,t0:T};return;}
    if(tileAt(P.map,tx,ty)==='H'){openMonument();clickMark={x:tx,y:ty,t0:T};return;}
    if(r&&r.alive){setGather(r);clickMark={x:r.x,y:r.y,t0:T};return;}
    if(walkable(P.map,tx,ty)){
      P.action=null;
      const sx=P.moving?P.moving.txx:P.tx, sy=P.moving?P.moving.tyy:P.ty;
      const path=findPath(P.map,sx,sy,tx,ty,false);
      if(path){P.path=path;clickMark={x:tx,y:ty,t0:T};}
    }
  }
  cv.addEventListener('pointerdown',ev=>{
    ensureAudio();endPress();
    if($('panel').classList.contains('open'))return; /* full-screen menu open: ignore world taps */
    /* a world tap while chatting closes the sheet + abandons the conversation */
    if($('dialog').classList.contains('open'))closeDialog();
    const rect=cv.getBoundingClientRect(),{camx,camy}=camera();
    const wx=(ev.clientX-rect.left)/SCALE+camx,wy=(ev.clientY-rect.top)/SCALE+camy;
    const tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE);
    press={sx:ev.clientX,sy:ev.clientY,tx,ty,wx,wy,timer:0};
    const drop=dropAt(P.map,tx,ty); /* long-tap a pile → itemised pickup menu */
    if(drop)press.timer=setTimeout(()=>{press=null;openFloorMenu(drop);},450);
    /* hold-to-steer: update() (p5) starts steering after ~220 ms held */
    HOLD.down=true;HOLD.cx=ev.clientX;HOLD.cy=ev.clientY;HOLD.t0=T;HOLD.onDrop=!!drop;HOLD.steer=false;
  });
  cv.addEventListener('pointermove',ev=>{
    if(HOLD.down){HOLD.cx=ev.clientX;HOLD.cy=ev.clientY;}
    if(press&&(Math.abs(ev.clientX-press.sx)>12||Math.abs(ev.clientY-press.sy)>12))endPress();
  });
  cv.addEventListener('pointerup',()=>{
    const steered=HOLD.steer;HOLD.down=false;HOLD.steer=false;
    if(!press)return;const p=press;endPress();
    if(steered)return; /* the hold consumed this gesture — no tap on release */
    tapAt(p.tx,p.ty,p.wx,p.wy);
  });
  cv.addEventListener('pointercancel',()=>{HOLD.down=false;HOLD.steer=false;endPress();});
  window.addEventListener('resize',resize);
}

/* ---------------- boot ---------------- */
function boot(){
  buildWorld();buildSprites();buildIcons();resize();
  bindUI();bindInput();
  const hadSave=load();
  rebuildPlayerSprite();
  rollDailies();loginBonus();
  P.hp=clamp(P.hp,1,maxHp());
  $('zone').textContent=MAPS[P.map].name;$('zone').classList.add('go');
  updateHUD();
  if(!hadSave){
    P.gear.weapon={id:'g_m_1_weapon',r:0};
    P.gear.body={id:'g_m_1_body',r:0};P.gear.legs={id:'g_m_1_legs',r:0};
    P.hp=maxHp();addItem('bread',5);rebuildPlayerSprite();
    setTimeout(()=>toast('Welcome to Emberbrook! Talk to Elder Rowan to begin.','gold'),400);
  }
  syncNow(false);
  let last=performance.now();
  function loop(ts){
    const dt=Math.min(50,ts-last);last=ts;
    update(dt);draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  setInterval(save,8000);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)save();
    else syncPull();
  });
  window.addEventListener('pagehide',save);
  /* PWA */
  if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
}

/* ---------------- debug handle ---------------- */
window.EB={world,MAPS,ITEMS,TOOLS,GEAR,MOBS,CAPES,RARITY,QUESTS,RES,RECIPES,
 FUSIONS,FUSE_RECIPES,FUSE_ORDER,EFFECTS,MOB_FUSION_DROP,weaponEffects,
 update,camera,setGather,setFight,setLoot,openBank,openShop,openInventory,openEquipment,
 openSkills,openQuests,openQuestBoard,openSettings,openDialog,openMonument,openCapes,openBestiary,
 openCraft,doCraft,craftMax,craftReq,openFuse,doFuse,
 addItem,addGear,invCount,equipGear,unequip,gearBonus,playerAttack,rollLoot,rollRarity,
 spawnDrop,pickupDrop,pickupOne,openFloorMenu,killMob,eatFood,save,load,serialize,applySave,migrateV1,
 hurtPlayer,die,maxHp,lvlFor,totalLevel,questState,freshPlayer,rebuildPlayerSprite,
 syncNow,syncPull,syncPush,
 get P(){return P},set P(v){P=v},get T(){return T},get SCALE(){return SCALE}};
boot();

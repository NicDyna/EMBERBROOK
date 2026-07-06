/* p5: movement & actions — RS-style combat (accuracy vs defence, weapon
       speed, combat triangle, ammo), ground loot + gravestone death,
       food & regen, mob/boss AI, main update loop */
const STEP_MS=170, MOB_STEP=280;
function startStep(e,dur){
  const n=e.path.shift();if(!n)return;
  const[nx,ny]=n;
  e.facing=nx>e.tx?1:(nx<e.tx?-1:e.facing);
  e.moving={fx:e.tx,fy:e.ty,txx:nx,tyy:ny,t0:T,dur};
}
function stepEntity(e){
  if(!e.moving)return;
  const m=e.moving,pr=Math.min(1,(T-m.t0)/m.dur);
  e.px=(m.fx+(m.txx-m.fx)*pr)*TILE;
  e.py=(m.fy+(m.tyy-m.fy)*pr)*TILE;
  if(pr>=1){e.tx=m.txx;e.ty=m.tyy;e.px=e.tx*TILE;e.py=e.ty*TILE;e.moving=null;}
}
function adjacent(ax,ay,bx,by){return Math.abs(ax-bx)<=1&&Math.abs(ay-by)<=1&&!(ax===bx&&ay===by);}
function distTiles(ax,ay,bx,by){return Math.max(Math.abs(ax-bx),Math.abs(ay-by));}
function switchMap(ex){
  P.map=ex.map;P.tx=ex.tx;P.ty=ex.ty;P.px=P.tx*TILE;P.py=P.ty*TILE;
  P.path=[];P.moving=null;P.action=null;
  world[P.map].mobs.forEach(m=>m.aggro=false);
  if(REGION_ORDER.includes(P.map)){if(!P.reached)P.reached={};P.reached[P.map]=true;}
  ambientBiome();
  const zl=$('zone');zl.textContent=MAPS[P.map].name;
  zl.classList.remove('go');void zl.offsetWidth;zl.classList.add('go');
  save();
}

/* ---------------- fast travel ----------------
   Home to town + any region already reached on foot; blocked while a mob is
   actively attacking you (can't teleport out of a fight). Arrives at the safe
   top-of-region tile. Dungeons are not travel targets — enter them on foot. */
const WARP={town:[20,17],forest:[30,2],mountains:[30,2],plains:[30,2],desert:[30,2]};
function underAttack(){return world[P.map].mobs.some(m=>m.alive&&m.aggro);}
function warpTo(dest){
  if(!world[dest]||!WARP[dest])return;
  if(dest===P.map){toast('You are already here.');return;}
  if(underAttack()){toast('Cannot travel while under attack!','bad');return;}
  const[x,y]=WARP[dest];
  P.map=dest;P.tx=x;P.ty=y;P.px=x*TILE;P.py=y*TILE;
  P.path=[];P.moving=null;P.action=null;
  world[dest].mobs.forEach(m=>m.aggro=false);
  if(REGION_ORDER.includes(dest)){if(!P.reached)P.reached={};P.reached[dest]=true;}
  ambientBiome();
  const zl=$('zone');zl.textContent=MAPS[dest].name;zl.classList.remove('go');void zl.offsetWidth;zl.classList.add('go');
  sfx('warp');save();
}

/* ---------------- current combat mode from weapon ---------------- */
function combatMode(){ // 'melee'|'ranged'|'magic'
  const w=P.gear.weapon&&GEAR[P.gear.weapon.id];
  if(!w)return'melee';
  return w.line==='r'?'ranged':w.line==='g'?'magic':'melee';
}
function weaponRange(){const m=combatMode();return m==='melee'?1:m==='ranged'?4:5;}
function weaponSpeed(){
  const w=P.gear.weapon&&GEAR[P.gear.weapon.id];
  let spd=w?w.spd:2400;
  if(combatMode()==='melee'&&P.style==='accurate')spd*=0.92; /* accurate: slightly faster */
  return spd;
}
function ammoFor(mode){return mode==='ranged'?'arrows':mode==='magic'?'runes':null;}
/* which skill the current attack trains */
function trainSkill(){
  const m=combatMode();
  if(m==='ranged')return'ranged';
  if(m==='magic')return'magic';
  return P.style==='aggressive'?'strength':P.style==='defensive'?'defence':'attack';
}
/* combat triangle: melee > ranged > magic > melee */
function triangle(att,def){
  if(att===def)return 1;
  /* softened so fighting off-style is a mild penalty, not a death sentence */
  if((att==='melee'&&def==='ranged')||(att==='ranged'&&def==='magic')||(att==='magic'&&def==='melee'))return 1.18;
  return 0.88;
}
/* player attack + max hit from skills, gear, style, capes */
function playerAttack(){
  const b=gearBonus(),m=combatMode();
  let accSkill = m==='ranged'?lvl('ranged') : m==='magic'?lvl('magic') : lvl('attack');
  let powSkill = m==='ranged'?lvl('ranged') : m==='magic'?lvl('magic') : lvl('strength');
  const w=P.gear.weapon&&GEAR[P.gear.weapon.id];
  const ws=w?gearStats(P.gear.weapon):{acc:2,pow:1};
  let acc = accSkill*2 + (ws.acc||0)*1.5 + 8;
  let pow = 2 + powSkill*0.38 + (ws.pow||0)*0.5
          + (m==='ranged'?b.rpow:m==='magic'?b.mpow:0)*0.5;
  if(m==='melee'&&P.style==='accurate')acc*=1.12;
  if(m==='melee'&&P.style==='aggressive')pow*=1.1;
  if(perkActive('acc'))acc*=1.05;
  if(m==='melee'&&perkActive('meleedmg'))pow*=1.05;
  return{acc,maxHit:Math.max(1,Math.floor(pow)),mode:m};
}
function playerDefence(){
  const b=gearBonus();
  return lvl('defence')*2 + b.def*1.2 + 8;
}
function hitChance(attRoll,defRoll){return clamp(attRoll/(attRoll+defRoll),0.05,0.95);}

/* ---------------- projectiles (visual only) ---------------- */
const shots=[];
function shoot(x0,y0,x1,y1,color){shots.push({x0,y0,x1,y1,t0:T,life:220,color});}

/* ---------------- actions ---------------- */
function setGather(r){
  const d=RES[r.type];
  if(lvl(d.skill)<d.lvl){toast('Requires '+SKILLS[d.skill].name+' level '+d.lvl);return;}
  if(!invGet(d.item)&&P.inv.length>=INV_CAP){toast('Inventory full!');return;}
  P.action={kind:'gather',target:r.id,prog:0};
  routeToTarget(r.x,r.y,true);
}
function setFight(m){
  P.action={kind:'fight',target:m.id};
  routeToTarget(m.tx,m.ty,true);
}
function setTalk(n){
  P.action={kind:'talk',target:n.id};
  routeToTarget(n.tx,n.ty,true);
}
function setLoot(d){
  P.action={kind:'loot',x:d.x,y:d.y};
  routeToTarget(d.x,d.y,false); /* walk onto the drop tile */
}
function routeToTarget(x,y,adj){
  /* start from the tile we're stepping toward (when mid-step) so a re-issued
     route flows on from there instead of snapping back to the departed tile */
  const sx=P.moving?P.moving.txx:P.tx, sy=P.moving?P.moving.tyy:P.ty;
  const path=findPath(P.map,sx,sy,x,y,adj);
  if(path)P.path=path;else P.path=[];
}
function nearestRes(type,fx,fy){
  const d=RES[type];
  let best=null,bd=99;
  for(const r of world[P.map].res){
    if(r.type!==type||!r.alive)continue;
    const dist=Math.abs(r.x-fx)+Math.abs(r.y-fy);
    if(dist<bd&&dist<=12){bd=dist;best=r;}
  }
  if(!best)return null;
  return (invGet(d.item)||P.inv.length<INV_CAP)?best:null;
}
function nearestMob(type,fx,fy){
  let best=null,bd=99;
  for(const m of world[P.map].mobs){
    if(m.type!==type||!m.alive)continue;
    const dist=Math.abs(m.tx-fx)+Math.abs(m.ty-fy);
    if(dist<bd&&dist<=8){bd=dist;best=m;}
  }
  return best;
}
function findTarget(){
  if(!P.action)return null;
  const W=world[P.map];
  if(P.action.kind==='gather')return W.res.find(r=>r.id===P.action.target);
  if(P.action.kind==='fight')return W.mobs.find(m=>m.id===P.action.target);
  if(P.action.kind==='talk')return W.npcs.find(n=>n.id===P.action.target);
  if(P.action.kind==='loot')return dropAt(P.map,P.action.x,P.action.y);
  return null;
}

/* ---------------- ground drops ---------------- */
const DROP_TTL=90000;
function spawnDrop(map,x,y,payload){ // payload {gold?, items?:[{id,qty}|{gear}]}
  let d=dropAt(map,x,y);
  if(!d){d={x,y,gold:0,items:[],ts:T,grave:false};world[map].drops.push(d);}
  d.ts=T;
  if(payload.gold)d.gold+=payload.gold;
  if(payload.items)for(const it of payload.items){
    if(it.gear){d.items.push({gear:it.gear});continue;}
    const ex=d.items.find(s=>s.id===it.id&&!s.gear);
    if(ex)ex.qty+=it.qty;else d.items.push({id:it.id,qty:it.qty});
  }
  return d;
}
function bestRarityOf(d){
  let r=0;for(const it of d.items)if(it.gear&&(it.gear.r||0)>r)r=it.gear.r;
  return r;
}
function pickupDrop(d){
  const W=world[P.map];
  if(d.gold>0){addGold(d.gold);floater(P.px+16,P.py-10,'+'+d.gold+'g','#e8b64c');sfx('coin');d.gold=0;}
  const remain=[];
  for(const it of d.items){
    if(it.gear){
      if(addGear(it.gear)){
        const nm=gearName(it.gear);
        toast('+ '+nm,(it.gear.r||0)>=2?'gold':'drop');
        if((it.gear.r||0)>=3){sfx('rare');
          P.stats.bestDrop=nm;
          if(it.gear.r>=4){P.stats.legendaries++;levelFlash((it.gear.r===5?'UNIQUE! ':'LEGENDARY! ')+nm);}
        }else sfx('loot');
      }else{remain.push(it);toast('Inventory full','bad');}
    }else{
      if(addItem(it.id,it.qty)){toast('+'+it.qty+' '+ITEMS[it.id].name,'drop');sfx('loot');}
      else{remain.push(it);toast('Inventory full','bad');}
    }
  }
  d.items=remain;
  if(!d.items.length&&d.gold<=0){
    if(d.grave)P.grave=null;
    W.drops.splice(W.drops.indexOf(d),1);
  }
  save();
}

/* ---------------- loot generation ---------------- */
function rollLoot(mob){
  const d=MOBS[mob.type];
  const out={gold:0,items:[]};
  const rolls=(d.boss||d.semi)?2:1; /* bosses + dungeon semi-bosses roll twice */
  /* fodder drops the biome's gear line; bosses/semis stay any-line jackpots */
  const biomeLine=(d.boss||d.semi)?null:BIOME_LINE[P.map];
  for(let i=0;i<rolls;i++){
    const e=lootRoll(d.loot);
    if(e.gold)out.gold+=rand(e.gold[0],e.gold[1]);
    else if(e.item)out.items.push({id:e.item,qty:rand(e.q[0],e.q[1])});
    else if(e.gear){
      const tier=rand(e.gear.tierMin,e.gear.tierMax);
      const lines=e.gear.line?[e.gear.line]:(biomeLine?[biomeLine]:['m','r','g']);
      const line=lines[rand(0,lines.length-1)];
      const slots=Object.keys(LINE_DEFS[line].slots);
      const slot=slots[rand(0,slots.length-1)];
      out.items.push({gear:{id:`g_${line}_${tier}_${slot}`,r:rollRarity(d.rarityBoost||0)}});
    }
  }
  /* boss signature drop: ~14% chance to also drop its unique (rarity 5) */
  if(d.unique&&GEAR[d.unique]&&Math.random()<0.14)out.items.push({gear:{id:d.unique,r:5}});
  return out;
}

/* ---------------- food ---------------- */
function eatFood(invIndex){
  const s=P.inv[invIndex];if(!s||s.gear)return;
  const def=ITEMS[s.id];if(!def||!def.heal)return;
  if(P.hp>=maxHp()){toast('Already at full health');return;}
  removeItem(s.id,1);
  P.hp=Math.min(maxHp(),P.hp+def.heal);
  P.eatT=T; /* brief attack delay after eating */
  sfx('eat');floater(P.px+16,P.py-10,'+'+def.heal,'#7fd17f');
  updateHUD();
}

/* ---------------- the action tick ---------------- */
function doAction(){
  if(!P.action)return;
  const t=findTarget();
  if(!t){P.action=null;return;}
  if(P.action.kind==='gather'&&!t.alive){
    const next=nearestRes(t.type,t.x,t.y);
    if(next)setGather(next);else P.action=null;
    return;
  }
  if(P.action.kind==='fight'&&!t.alive){
    const next=nearestMob(t.type,P.tx,P.ty);
    if(next)setFight(next);else P.action=null;
    return;
  }
  if(P.action.kind==='loot'){
    if(P.tx===t.x&&P.ty===t.y){pickupDrop(t);P.action=null;}
    else if(!P.path.length&&!P.moving){routeToTarget(t.x,t.y,false);
      if(!P.path.length)P.action=null;}
    return;
  }
  const tx=t.tx!==undefined?t.tx:t.x, ty=t.ty!==undefined?t.ty:t.y;
  const inRange=P.action.kind==='fight'
    ? distTiles(P.tx,P.ty,tx,ty)<=weaponRange()&&!(P.tx===tx&&P.ty===ty)
    : adjacent(P.tx,P.ty,tx,ty);
  if(!inRange){
    if(!P.path.length&&T-(P.retimer||0)>450){P.retimer=T;routeToTarget(tx,ty,true);}
    return;
  }
  P.path=[];
  P.facing=tx>P.tx?1:(tx<P.tx?-1:P.facing);
  if(P.action.kind==='talk'){openDialog(t);P.action=null;return;}
  if(P.action.kind==='gather'){
    const d=RES[t.type];
    if(!invGet(d.item)&&P.inv.length>=INV_CAP){toast('Inventory full! Bank or sell in town.');P.action=null;return;}
    const tool=d.skill==='woodcutting'?TOOLS[P.tools.axe]:TOOLS[P.tools.pick];
    let speed=Math.max(600,d.time*tool.speed*(1-lvl(d.skill)*0.006));
    if(d.skill==='woodcutting'&&perkActive('chop'))speed*=0.9;
    if(d.skill==='mining'&&perkActive('mine'))speed*=0.9;
    P.action.prog=(P.action.prog||0)+FRAME_DT;
    if(P.action.prog>=speed){
      P.action.prog=0;
      addItem(d.item,1);
      gainXp(d.skill,d.xp);
      sfx(d.skill==='woodcutting'?'chop':'mine');
      toast('+1 '+ITEMS[d.item].name,'drop');
      questEvent('gather',d.item);
      if(d.skill==='woodcutting')P.stats.chopped++;else P.stats.mined++;
      t.alive=false;t.respawnAt=T+d.respawn;
      const next=nearestRes(t.type,t.x,t.y);
      if(next)setGather(next);else{P.action=null;toast('No more nearby. Tap another resource.');}
    }
    return;
  }
  if(P.action.kind==='fight'){
    t.aggro=true;
    if(T-(P.eatT||0)<1200)return; /* just ate */
    if(T-(P.atkT||0)>=weaponSpeed()){
      const atk=playerAttack();
      const mode=atk.mode;
      /* ammo check + consumption (cape perk: chance to save) */
      const ammo=ammoFor(mode);
      if(ammo){
        if(invCount(ammo)<=0){toast('Out of '+ITEMS[ammo].name+'!','bad');P.action=null;return;}
        const saveEff=mode==='ranged'?'savearrow':'saverune';
        if(!(perkActive(saveEff)&&Math.random()<0.10))removeItem(ammo,1);
        if(invCount(ammo)===50)toast('Only 50 '+ITEMS[ammo].name+' left','bad');
      }
      P.atkT=T;
      const md=MOBS[t.type];
      const tri=triangle(mode,md.style);
      const chance=hitChance(atk.acc*(tri>1?1.07:tri<1?0.93:1), md.def*2+8);
      let dmg=0;
      if(Math.random()<chance)dmg=Math.max(1,Math.round(rand(Math.ceil(atk.maxHit*0.35),atk.maxHit)*tri));
      if(mode==='ranged'){shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#d8d5c8');sfx('shoot');}
      else if(mode==='magic'){shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#b06fd1');sfx('zap');}
      else sfx('hit');
      t.hp-=dmg;
      const big=dmg>0&&dmg>=atk.maxHit*0.75;
      floater(t.px+16,t.py-6,dmg>0?'-'+dmg:'miss',dmg>0?(big?'#ffd24a':'#ffe3a0'):'#9aa',dmg>0?(big?13:10):9);
      if(dmg>0){
        spawnParticles(t.px+16,t.py+8,mode==='magic'?'#c9a5ff':mode==='ranged'?'#e8e2c8':'#ffd27a',big?9:5,big?1.6:1);
        gainXp(trainSkill(),dmg*4);
        if(mode!=='melee')dailyEvent('stylehit',null,1);
      }
      if(t.hp<=0)killMob(t);
    }
  }
}
function killMob(m){
  const d=MOBS[m.type];
  m.alive=false;m.aggro=false;m.respawnAt=T+(d.respawn||9000);
  gainXp(trainSkill(),d.xp);
  const loot=rollLoot(m);
  spawnDrop(P.map,m.tx,m.ty,loot);
  sfx('kill');
  spawnParticles(m.px+16,m.py+10,d.boss?'#ffcf5a':'#e8b070',d.boss?22:12,d.boss?2.2:1.4);
  P.stats.kills++;
  if(d.boss){
    P.stats.bossKills[m.type]=(P.stats.bossKills[m.type]||0)+1;
    levelFlash(d.name+' defeated!');shake(6);
  }
  questEvent('kill',m.type,P.map);
  const next=nearestMob(m.type,P.tx,P.ty);
  if(next)setFight(next);else P.action=null;
  save();
}
function hurtPlayer(dmg){
  if(perkActive('dmgred'))dmg=Math.max(0,Math.round(dmg*0.95));
  if(dmg<=0){floater(P.px+16,P.py-10,'miss','#9aa');return;}
  P.hp-=dmg;P.lastHurt=T;sfx('hurt');
  shake(Math.min(9,2.5+dmg*0.5));
  spawnParticles(P.px+16,P.py+8,'#e85b4a',5,1);
  floater(P.px+16,P.py-10,'-'+dmg,'#ff6a5a',11);
  if(P.hp<=0)die();
}
/* death: carried items drop as a gravestone; equipped gear is kept.
   The 2-minute timer only ticks while the game is running. */
function die(){
  P.stats.deaths++;
  const items=P.inv.splice(0,P.inv.length);
  const gold=P.gold;P.gold=0;
  if(items.length||gold>0){
    /* find a walkable tile for the grave (player tile always is) */
    const d=spawnDrop(P.map,P.tx,P.ty,{gold,items});
    d.grave=true;d.left=120000;
    P.grave={map:P.map,x:P.tx,y:P.ty};
    toast('☠️ Defeated! Your items wait at a gravestone — 2 minutes!','bad');
  }else toast('☠️ You were defeated!','bad');
  sfx('die');
  world[P.map].mobs.forEach(mm=>mm.aggro=false);
  P.map='town';P.tx=20;P.ty=17;P.px=P.tx*TILE;P.py=P.ty*TILE;
  P.path=[];P.moving=null;P.action=null;P.hp=maxHp();
  save();
}

/* ---------------- mob & boss AI ---------------- */
function updateMobs(){
  const W=world[P.map];
  for(const m of W.mobs){
    const d=MOBS[m.type];
    if(!m.alive){
      if(T>=m.respawnAt){m.alive=true;m.hp=d.hp;m.tx=m.hx;m.ty=m.hy;m.px=m.tx*TILE;m.py=m.ty*TILE;m.moving=null;}
      continue;
    }
    stepEntity(m);
    if(m.moving)continue;
    if(d.aggro&&!m.aggro&&distTiles(m.tx,m.ty,P.tx,P.ty)<=4)m.aggro=true;
    if(m.aggro){
      const dist=distTiles(m.tx,m.ty,P.tx,P.ty);
      if(dist>12){m.aggro=false;continue;}
      if(dist<=d.range&&dist>=1){
        m.atkT=m.atkT||T+400;
        if(T>=m.atkT){
          m.atkT=T+d.spd;
          const tri=triangle(d.style,combatMode());
          const chance=hitChance(d.acc*2+8,playerDefence()*(tri>1?0.95:1));
          let dmg=0;
          if(Math.random()<chance)dmg=Math.max(1,Math.round(rand(1,Math.max(1,Math.floor(1+d.pow*0.40)))*tri));
          if(d.style==='ranged')shoot(m.px+16,m.py+8,P.px+16,P.py+8,'#d8d5c8');
          if(d.style==='magic')shoot(m.px+16,m.py+8,P.px+16,P.py+8,'#b06fd1');
          m.lungeT=T; /* renderer lunges the mob toward the player briefly */
          hurtPlayer(dmg);
        }
      }else{
        const path=findPath(P.map,m.tx,m.ty,P.tx,P.ty,true);
        if(path&&path.length){m.path=[path[0]];startStep(m,d.boss?MOB_STEP*1.2:MOB_STEP);}
      }
    }else{
      m.atkT=0;
      if(T>=m.wanderT){
        m.wanderT=T+rand(1800,4500);
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{
          const nx=m.tx+dx,ny=m.ty+dy;
          return walkable(P.map,nx,ny)&&Math.abs(nx-m.hx)<=3&&Math.abs(ny-m.hy)<=3
            &&!(nx===P.tx&&ny===P.ty)&&!mobAt(P.map,nx,ny);
        });
        if(dirs.length){const[dx,dy]=dirs[rand(0,dirs.length-1)];m.path=[[m.tx+dx,m.ty+dy]];startStep(m,MOB_STEP);}
      }
    }
  }
  for(const r of W.res)if(!r.alive&&T>=r.respawnAt)r.alive=true;
}
/* townsfolk gently mill about near their post (gives them a walk cycle) */
function updateNpcs(){
  const W=world[P.map];
  for(const n of W.npcs){
    stepEntity(n);
    if(n.moving)continue;
    if(T>=n.wanderT){
      n.wanderT=T+ambRand(3500,8000);
      if(ambChance(0.55))continue; /* often just idle in place */
      const opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{
        const nx=n.tx+dx,ny=n.ty+dy;
        return walkable(P.map,nx,ny)&&Math.abs(nx-n.hx)<=2&&Math.abs(ny-n.hy)<=2
          &&!(nx===P.tx&&ny===P.ty)&&!mobAt(P.map,nx,ny)&&!npcAt(P.map,nx,ny)&&!exitAt(P.map,nx,ny);
      });
      if(opts.length){const[dx,dy]=opts[ambRand(0,opts.length-1)];
        n.facing=dx<0?-1:dx>0?1:n.facing;n.path=[[n.tx+dx,n.ty+dy]];startStep(n,340);}
    }
  }
}

/* ---------------- main update ---------------- */
let FRAME_DT=16;
function update(dt){
  FRAME_DT=dt;T+=dt;
  P.stats.playMs+=dt;
  stepEntity(P);
  if(!P.moving){
    const ex=exitAt(P.map,P.tx,P.ty);
    if(ex){switchMap(ex);return;}
    doAction(); /* before the next step: lets ranged/magic stop at range */
  }
  if(!P.moving&&P.path.length){
    const[nx,ny]=P.path[0];
    if(!walkable(P.map,nx,ny))P.path=[];
    else startStep(P,STEP_MS);
  }
  /* slow out-of-combat regen */
  if(P.hp<maxHp()&&T-(P.lastHurt||0)>4000){
    P.regenT=(P.regenT||0)+dt;
    if(P.regenT>=3000){P.regenT=0;P.hp=Math.min(maxHp(),P.hp+1);}
  }
  updateMobs();
  updateNpcs();
  /* ground drop lifecycle (graves tick only in-game, by design) */
  for(const map in world){
    const W=world[map];
    for(let i=W.drops.length-1;i>=0;i--){
      const dd=W.drops[i];
      if(dd.grave){
        dd.left-=dt; /* ticks only while the game is running, by design */
        if(dd.left<=0){W.drops.splice(i,1);if(P.grave&&P.grave.map===map)P.grave=null;
          toast('Your gravestone crumbled…','bad');}
      }else if(T-dd.ts>DROP_TTL)W.drops.splice(i,1);
    }
  }
  for(let i=floaters.length-1;i>=0;i--)if(T-floaters[i].t0>floaters[i].life)floaters.splice(i,1);
  for(let i=shots.length-1;i>=0;i--)if(T-shots[i].t0>shots[i].life)shots.splice(i,1);
  for(let i=particles.length-1;i>=0;i--)if(T-particles[i].t0>particles[i].life)particles.splice(i,1);
  updateHUD();
}

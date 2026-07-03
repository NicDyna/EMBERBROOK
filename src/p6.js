/* p6: rendering & HUD — camera, tile pass, ground drops (rarity glow),
       gravestone timer, projectiles, bosses drawn 2x, paper-doll player */
const cv=$('cv'),ctx=cv.getContext('2d');
let SCALE=2,VW=0,VH=0;
function resize(){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  VW=window.innerWidth;VH=window.innerHeight;
  cv.width=VW*dpr;cv.height=VH*dpr;
  cv.style.width=VW+'px';cv.style.height=VH+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  SCALE=clamp(Math.min(VW,VH)/(TILE*9),1.4,3.2);
}
let clickMark=null;
function camera(){
  const W=world[P.map],mapW=W.w*TILE,mapH=W.h*TILE;
  let camx=P.px+16-VW/(2*SCALE),camy=P.py+16-VH/(2*SCALE);
  if(mapW<VW/SCALE)camx=-(VW/SCALE-mapW)/2;else camx=clamp(camx,0,mapW-VW/SCALE);
  if(mapH<VH/SCALE)camy=-(VH/SCALE-mapH)/2;else camy=clamp(camy,0,mapH-VH/SCALE);
  return{camx:Math.round(camx),camy:Math.round(camy)};
}
function draw(){
  const W=world[P.map];
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#14110d';ctx.fillRect(0,0,VW,VH);
  const{camx,camy}=camera();
  ctx.save();
  ctx.scale(SCALE,SCALE);
  ctx.translate(-camx,-camy);
  const waterShift=Math.floor(T/600)%2;
  const x0=Math.max(0,Math.floor(camx/TILE)),x1=Math.min(W.w-1,Math.ceil((camx+VW/SCALE)/TILE));
  const y0=Math.max(0,Math.floor(camy/TILE)),y1=Math.min(W.h-1,Math.ceil((camy+VH/SCALE)/TILE));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    let ch=W.grid[y][x];
    if(RES[ch])ch=MAPS[P.map].ground;
    let spr=SPR[ch]||SPR[MAPS[P.map].ground];
    if(ch==='W')spr=SPR['W1'];
    ctx.drawImage(spr,x*TILE,y*TILE);
    if((ch==='W'||ch==='~')&&waterShift){ /* cheap shimmer */
      ctx.fillStyle='#ffffff10';ctx.fillRect(x*TILE+8,y*TILE+6,10,2);
    }
  }
  /* building labels */
  ctx.font='bold 8px monospace';ctx.textAlign='center';
  for(const l of W.labels){
    ctx.fillStyle='#00000055';ctx.fillRect(l.x*TILE-20,l.y*TILE-6,40,10);
    ctx.fillStyle='#e8dcc3';ctx.fillText(l.t,l.x*TILE,l.y*TILE+2);
  }
  /* click marker */
  if(clickMark&&T-clickMark.t0<500){
    const a=1-(T-clickMark.t0)/500;
    ctx.strokeStyle='rgba(232,182,76,'+a+')';ctx.lineWidth=2;
    const cxp=clickMark.x*TILE+16,cyp=clickMark.y*TILE+16,r=6+((T-clickMark.t0)/500)*6;
    ctx.beginPath();ctx.moveTo(cxp-r,cyp-r);ctx.lineTo(cxp+r,cyp+r);
    ctx.moveTo(cxp+r,cyp-r);ctx.lineTo(cxp-r,cyp+r);ctx.stroke();
  }
  /* ground drops (before entities so they sit under feet) */
  for(const d of W.drops){
    const cx=d.x*TILE,cy=d.y*TILE;
    const r=bestRarityOf(d);
    if(r>0||d.grave){ /* rarity / grave glow */
      const pulse=0.25+0.15*Math.sin(T/300);
      ctx.fillStyle=(d.grave?'#e8dcc3':RARITY[r].color)+'';
      ctx.globalAlpha=pulse;ctx.beginPath();
      ctx.arc(cx+16,cy+18,12,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(d.grave){
      ctx.drawImage(SPR.gravestone,cx,cy);
      const secs=Math.max(0,Math.ceil(d.left/1000));
      ctx.font='bold 8px monospace';ctx.textAlign='center';
      ctx.fillStyle=secs<=20?'#e85b4a':'#e8dcc3';
      ctx.fillText(secs+'s',cx+16,cy-2);
    }else{
      if(d.gold>0)ctx.drawImage(SPR.coins,cx,cy);
      const firstGear=d.items.find(i=>i.gear),firstItem=d.items.find(i=>!i.gear);
      const ic=firstGear?ICON[firstGear.gear.id]:firstItem?ICON[firstItem.id]:null;
      if(ic){ctx.drawImage(ic,0,0,32,32,cx+8,cy+8,16,16);}
    }
  }
  /* resources */
  for(const r of W.res){
    const d=RES[r.type];
    if(d.skill==='woodcutting')
      ctx.drawImage(r.alive?(r.type==='O'?SPR.oak:SPR.tree):SPR.stump,r.x*TILE,r.y*TILE-(r.alive?16:0));
    else
      ctx.drawImage(r.alive?(r.type==='I'?SPR.rock_i:SPR.rock_c):SPR.rubble,r.x*TILE,r.y*TILE);
  }
  /* mobs (bosses drawn at 2x, anchored to their tile) */
  for(const m of W.mobs){
    if(!m.alive)continue;
    const d=MOBS[m.type];
    const facing=m.moving&&m.moving.txx<m.tx?-1:1;
    if(d.boss){
      const spr=SPR[m.type];
      ctx.save();
      if(facing<0){ctx.translate(m.px+48,m.py-32);ctx.scale(-1,1);ctx.drawImage(spr,0,0,32,32,-16,0,64,64);}
      else ctx.drawImage(spr,0,0,32,32,m.px-16,m.py-32,64,64);
      ctx.restore();
      ctx.fillStyle='#000000aa';ctx.fillRect(m.px-8,m.py-40,48,5);
      ctx.fillStyle='#c9584a';ctx.fillRect(m.px-7,m.py-39,46*(m.hp/d.hp),3);
      ctx.font='bold 8px monospace';ctx.textAlign='center';
      ctx.fillStyle='#f0c419';ctx.fillText(d.name,m.px+16,m.py-44);
    }else{
      drawFlipped(SPR[m.type],m.px,m.py,facing);
      if(m.hp<d.hp){
        ctx.fillStyle='#000000aa';ctx.fillRect(m.px+6,m.py-6,20,4);
        ctx.fillStyle='#c9584a';ctx.fillRect(m.px+7,m.py-5,18*(m.hp/d.hp),2);
      }
    }
  }
  /* npcs + markers */
  for(const n of W.npcs){
    ctx.drawImage(SPR['npc_'+n.id],n.x*TILE,n.y*TILE);
    let mark=null;
    if(n.role==='quests'||n.role==='chat'||n.role==='shop'){
      for(const q of QUEST_ORDER){
        if(QUESTS[q].giver!==n.id)continue;
        const st=questState(q);
        if(st==='ready'){mark='?';break;}
        if(st==='active')mark=mark||'…';
      }
    }
    if(n.role==='capes'){
      const any=SKILL_ORDER.some(s=>lvl(s)>=MAX_LVL&&!P.capes.includes('cape_'+s));
      if(any)mark='!';
    }
    if(mark){
      const bob=Math.sin(T/300)*2;
      ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillStyle=mark==='?'?'#7fbf5f':'#e8b64c';
      ctx.fillText(mark,n.x*TILE+16,n.y*TILE-6+bob);
    }
  }
  /* projectiles */
  for(const s of shots){
    const pr=Math.min(1,(T-s.t0)/s.life);
    const x=s.x0+(s.x1-s.x0)*pr,y=s.y0+(s.y1-s.y0)*pr;
    ctx.fillStyle=s.color;ctx.fillRect(x-2,y-2,4,4);
    ctx.fillStyle=s.color+'66';ctx.fillRect(x-1-(s.x1-s.x0)*0.04,y-1-(s.y1-s.y0)*0.04,3,3);
  }
  /* player */
  const bob=P.moving?Math.sin(T/70)*1.5:0;
  drawFlipped(SPR.player,P.px,P.py+bob-2,P.facing);
  /* gather progress */
  if(P.action&&P.action.kind==='gather'&&P.action.prog>0){
    const tgt=findTarget();
    if(tgt){const d=RES[tgt.type];
      const tool=d.skill==='woodcutting'?TOOLS[P.tools.axe]:TOOLS[P.tools.pick];
      let speed=Math.max(600,d.time*tool.speed*(1-lvl(d.skill)*0.006));
      ctx.fillStyle='#000000aa';ctx.fillRect(P.px+4,P.py-8,24,4);
      ctx.fillStyle='#e8b64c';ctx.fillRect(P.px+5,P.py-7,22*Math.min(1,P.action.prog/speed),2);}
  }
  /* floaters */
  ctx.font='bold 9px monospace';ctx.textAlign='center';
  for(const f of floaters){
    const pr=(T-f.t0)/f.life;
    ctx.globalAlpha=1-pr;
    ctx.fillStyle='#000';ctx.fillText(f.txt,f.x+1,f.y-pr*18+1);
    ctx.fillStyle=f.color;ctx.fillText(f.txt,f.x,f.y-pr*18);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}
function drawFlipped(spr,x,y,facing){
  if(facing<0){ctx.save();ctx.translate(x+32,y);ctx.scale(-1,1);ctx.drawImage(spr,0,0);ctx.restore();}
  else ctx.drawImage(spr,x,y);
}

/* ---------------- HUD ---------------- */
function updateHUD(){
  $('hpfill').style.width=(100*P.hp/maxHp())+'%';
  $('hptext').textContent=P.hp+'/'+maxHp();
  $('gold').textContent=P.gold;
  /* style button only matters for melee */
  const styleBtn=$('stylebtn');
  if(styleBtn){
    if(combatMode()==='melee'){
      styleBtn.style.display='';
      styleBtn.textContent=P.style==='accurate'?'🎯':P.style==='aggressive'?'⚔️':'🛡️';
    }else styleBtn.style.display='none';
  }
  /* ammo counter for ranged/magic */
  const am=$('ammo');
  if(am){
    const a=ammoFor(combatMode());
    if(a){am.style.display='';am.textContent=(a==='arrows'?'➶ ':'✦ ')+invCount(a);}
    else am.style.display='none';
  }
}

/* p6: rendering & HUD — camera, tile pass, ground drops (rarity glow),
       gravestone timer, projectiles, bosses drawn 2x, paper-doll player */
const cv=$('cv'),ctx=cv.getContext('2d');
/* resource node → sprite key (resolved against SPR at draw time, after buildSprites) */
const TREE_SPR={O:'oak',Y:'pine',J:'maple',L:'yew'};
const ROCK_SPR={I:'rock_i',Z:'crystal',A:'coal',e:'mithril_rock',u:'adamant_rock',j:'runite_rock'};
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
let shakeMag=0,shakeT=-9999;
function shake(m){shakeMag=Math.min(11,Math.max(shakeMag,m));shakeT=T;}
function camera(){
  const W=world[P.map],mapW=W.w*TILE,mapH=W.h*TILE;
  let camx=P.px+16-VW/(2*SCALE),camy=P.py+16-VH/(2*SCALE);
  if(mapW<VW/SCALE)camx=-(VW/SCALE-mapW)/2;else camx=clamp(camx,0,mapW-VW/SCALE);
  if(mapH<VH/SCALE)camy=-(VH/SCALE-mapH)/2;else camy=clamp(camy,0,mapH-VH/SCALE);
  /* round to whole DEVICE pixels, not world pixels — otherwise the camera lurches
     in SCALE-sized (1.4–3.2px) steps under the smoothly-interpolated player = jitter */
  return{camx:Math.round(camx*SCALE)/SCALE,camy:Math.round(camy*SCALE)/SCALE};
}
function draw(){
  const W=world[P.map];
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#14110d';ctx.fillRect(0,0,VW,VH);
  const{camx,camy}=camera();
  let shx=0,shy=0;
  if(shakeMag>0){const k=Math.max(0,1-(T-shakeT)/260)*shakeMag;
    shx=(Math.random()*2-1)*k;shy=(Math.random()*2-1)*k;if(k<=0.15)shakeMag=0;}
  ctx.save();
  ctx.scale(SCALE,SCALE);
  ctx.translate(-camx+shx,-camy+shy);
  const waterShift=Math.floor(T/600)%2;
  const x0=Math.max(0,Math.floor(camx/TILE)),x1=Math.min(W.w-1,Math.ceil((camx+VW/SCALE)/TILE));
  const y0=Math.max(0,Math.floor(camy/TILE)),y1=Math.min(W.h-1,Math.ceil((camy+VH/SCALE)/TILE));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    let ch=W.grid[y][x];
    if(RES[ch]||ch==='B')ch=MAPS[P.map].ground; /* building footprint = ground under the billboard */
    let spr=SPR[ch]||SPR[MAPS[P.map].ground];
    if(ch==='W')spr=SPR['W1'];
    ctx.drawImage(spr,x*TILE,y*TILE);
    if((ch==='W'||ch==='~')&&waterShift){ /* cheap shimmer */
      ctx.fillStyle='#ffffff10';ctx.fillRect(x*TILE+8,y*TILE+6,10,2);
    }
  }
  /* (place/street labels are drawn after the buildings, below) */
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
  /* ---- y-sorted billboards: buildings, trees/rocks, mobs, npcs, player ----
     everything upright is sorted by its feet-Y so you pass behind a house or
     tree when you're north of it (the Pokémon-style oblique depth). */
  const bills=[];
  for(const b of W.buildings)bills.push({s:(b.y+b.d)*TILE,k:'b',o:b});
  for(const r of W.res)bills.push({s:(r.y+1)*TILE,k:'r',o:r});
  for(const m of W.mobs){if(m.alive)bills.push({s:m.py+TILE,k:'m',o:m});}
  for(const n of W.npcs)bills.push({s:n.py+TILE,k:'n',o:n});
  bills.push({s:P.py+TILE+2,k:'p'});
  bills.sort((a,b)=>a.s-b.s);
  for(const it of bills){
    if(it.k==='b'){
      const b=it.o;if(!b.spr)continue;
      const bx=b.x*TILE,by=(b.y+b.d)*TILE-b.spr.height;
      ctx.fillStyle='#00000030';ctx.fillRect(bx+3,(b.y+b.d)*TILE-3,b.w*TILE-6,3);
      ctx.drawImage(b.spr,bx,by);
      if(b.chim){ /* drifting chimney smoke */
        const sx=bx+b.chim[0]*4,sy=by+b.chim[1]*4;
        for(let s=0;s<3;s++){
          const t=((T/60)+s*22)%66,py=sy-2-t*0.75,px=sx+Math.sin((t+s*11)/12)*3;
          ctx.fillStyle='rgba(208,208,202,'+(0.26*(1-t/66)).toFixed(3)+')';
          ctx.beginPath();ctx.arc(px,py,1.4+t*0.05,0,Math.PI*2);ctx.fill();
        }
      }
    }else if(it.k==='r'){
      const r=it.o,d=RES[r.type];
      if(d.skill==='woodcutting'){
        const sway=r.alive?Math.sin(T/900+r.x*1.3)*0.8:0; /* gentle wind */
        const tspr=SPR[TREE_SPR[r.type]]||SPR.tree;
        ctx.drawImage(r.alive?tspr:SPR.stump,r.x*TILE+sway,r.y*TILE-(r.alive?16:0));
      }else{
        const rspr=SPR[ROCK_SPR[r.type]]||SPR.rock_c;
        ctx.drawImage(r.alive?rspr:SPR.rubble,r.x*TILE,r.y*TILE);
      }
    }else if(it.k==='m'){
      const m=it.o,d=MOBS[m.type];
      const facing=m.moving&&m.moving.txx<m.tx?-1:1;
      const bob=m.moving?-Math.abs(Math.sin(T/100))*2:0;               /* walk hop */
      const lunge=(T-(m.lungeT||0)<150)?(P.px>=m.px?3:-3):0;           /* attack lunge */
      const mx=m.px+lunge,my=m.py+bob;
      if(d.boss){
        const spr=SPR[m.type];ctx.save();
        if(facing<0){ctx.translate(mx+48,my-32);ctx.scale(-1,1);ctx.drawImage(spr,0,0,32,32,-16,0,64,64);}
        else ctx.drawImage(spr,0,0,32,32,mx-16,my-32,64,64);
        ctx.restore();
        ctx.fillStyle='#000000aa';ctx.fillRect(m.px-8,m.py-40,48,5);
        ctx.fillStyle='#c9584a';ctx.fillRect(m.px-7,m.py-39,46*(m.hp/d.hp),3);
        ctx.font='bold 8px monospace';ctx.textAlign='center';
        ctx.fillStyle='#f0c419';ctx.fillText(d.name,m.px+16,m.py-44);
      }else{
        drawFlipped(SPR[m.type],mx,my,facing);
        if(d.semi){ /* elite: name bar + wider health bar */
          ctx.fillStyle='#000000aa';ctx.fillRect(m.px+2,m.py-8,28,4);
          ctx.fillStyle='#c9584a';ctx.fillRect(m.px+3,m.py-7,26*(m.hp/d.hp),2);
          ctx.font='bold 8px monospace';ctx.textAlign='center';
          ctx.fillStyle='#d9a5f0';ctx.fillText(d.name,m.px+16,m.py-11);
        }else if(m.hp<d.hp){
          ctx.fillStyle='#000000aa';ctx.fillRect(m.px+6,m.py-6,20,4);
          ctx.fillStyle='#c9584a';ctx.fillRect(m.px+7,m.py-5,18*(m.hp/d.hp),2);
        }
      }
    }else if(it.k==='n'){
      const n=it.o,spr=SPR['npc_'+n.id];
      const fr=spr.stand?(n.moving?(Math.floor(T/170)%2?spr.walk1:spr.walk2):spr.stand):spr;
      const nb=n.moving?-Math.abs(Math.sin(T/120))*1.5:Math.sin(T/750+n.hx)*0.5;
      drawFlipped(fr,n.px,n.py-12+nb,n.facing);
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
      if(n.role==='fuse'){
        if(P.inv.some(s=>s.gear&&GEAR[s.gear.id]&&GEAR[s.gear.id].fusion))mark='!';
      }
      if(mark){
        const nbob=Math.sin(T/300)*2;
        ctx.font='bold 12px monospace';ctx.textAlign='center';
        ctx.fillStyle=mark==='?'?'#7fbf5f':'#e8b64c';
        ctx.fillText(mark,n.px+16,n.py-20+nbob);
      }
    }else{
      const f=playerFrame(),moving=P.moving||P.path.length;
      const bob=moving?-Math.abs(Math.sin(T/90))*2:Math.sin(T/700)*0.6;
      const lunge=f===SPR.player.atk?P.facing*3:0;
      drawFlipped(f,P.px+lunge,P.py-12+bob,P.facing);
      if(P.action&&P.action.kind==='gather'&&P.action.prog>0){
        const tgt=findTarget();
        if(tgt){const d=RES[tgt.type];
          const tool=d.skill==='woodcutting'?TOOLS[P.tools.axe]:TOOLS[P.tools.pick];
          let speed=Math.max(600,d.time*tool.speed*(1-lvl(d.skill)*0.006));
          ctx.fillStyle='#000000aa';ctx.fillRect(P.px+4,P.py-8,24,4);
          ctx.fillStyle='#e8b64c';ctx.fillRect(P.px+5,P.py-7,22*Math.min(1,P.action.prog/speed),2);}
      }
    }
  }
  /* interaction highlight: a soft light-yellow outline around whatever the
     player is currently acting on — a resource, a mob, or an NPC */
  if(P.action){
    const tgt=findTarget();
    let bx=null;
    if(tgt){
      if(P.action.kind==='gather'&&tgt.alive){
        const tree=RES[tgt.type]&&RES[tgt.type].skill==='woodcutting';
        const sway=Math.sin(T/900+tgt.x*1.3)*0.8;
        bx=tree?[tgt.x*TILE+sway,tgt.y*TILE-16,32,48]:[tgt.x*TILE,tgt.y*TILE,32,32];
      }else if(P.action.kind==='fight'&&tgt.alive){
        bx=MOBS[tgt.type].boss?[tgt.px-16,tgt.py-32,64,64]:[tgt.px,tgt.py,32,32];
      }else if(P.action.kind==='talk'){
        bx=[tgt.px,tgt.py-12,32,44];
      }
    }
    if(bx){
      const a=0.55+0.25*Math.sin(T/220); /* gentle pulse */
      ctx.strokeStyle='rgba(240,226,140,'+a.toFixed(2)+')';
      ctx.lineWidth=1.5;
      ctx.strokeRect(bx[0]-1,bx[1]-1,bx[2]+2,bx[3]+2);
    }
  }
  /* place + street labels, drawn above the buildings for readability */
  ctx.font='bold 8px monospace';ctx.textAlign='center';
  for(const l of W.labels){
    const bw=ctx.measureText(l.t).width+8;
    ctx.fillStyle='#0d0b08cc';ctx.fillRect(l.x*TILE-bw/2,l.y*TILE-7,bw,11);
    ctx.fillStyle='#e8dcc3';ctx.fillText(l.t,l.x*TILE,l.y*TILE+1);
  }
  /* projectiles (above everything) */
  for(const s of shots){
    const pr=Math.min(1,(T-s.t0)/s.life);
    const x=s.x0+(s.x1-s.x0)*pr,y=s.y0+(s.y1-s.y0)*pr;
    ctx.fillStyle=s.color;ctx.fillRect(x-2,y-2,4,4);
    ctx.fillStyle=s.color+'66';ctx.fillRect(x-1-(s.x1-s.x0)*0.04,y-1-(s.y1-s.y0)*0.04,3,3);
  }
  /* spark particles (hits / kills) */
  for(const p of particles){
    const e=(T-p.t0)/1000, pr=(T-p.t0)/p.life;
    const px=p.x+p.vx*e, py=p.y+p.vy*e+90*e*e;
    ctx.globalAlpha=Math.max(0,1-pr);
    ctx.fillStyle=p.color;ctx.fillRect(px-p.size/2,py-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha=1;
  /* floaters */
  ctx.textAlign='center';
  for(const f of floaters){
    const pr=(T-f.t0)/f.life;
    ctx.font='bold '+(f.size||9)+'px monospace';
    ctx.globalAlpha=1-pr;
    ctx.fillStyle='#000';ctx.fillText(f.txt,f.x+1,f.y-pr*18+1);
    ctx.fillStyle=f.color;ctx.fillText(f.txt,f.x,f.y-pr*18);
    ctx.globalAlpha=1;
  }
  ctx.restore();
  if(minimapOn)drawMinimap();
}
function drawFlipped(spr,x,y,facing){
  if(facing<0){ctx.save();ctx.translate(x+32,y);ctx.scale(-1,1);ctx.drawImage(spr,0,0);ctx.restore();}
  else ctx.drawImage(spr,x,y);
}
/* pick the player animation frame: attack lunge > walk cycle > idle */
function playerFrame(){
  const f=SPR.player;if(f.nodeName)return f;
  if(P.action&&P.action.kind==='fight'&&T-(P.atkT||0)<220)return f.atk;
  if(P.moving||P.path.length)return (Math.floor(T/130)%2)?f.walk1:f.walk2;
  return f.stand;
}

/* ---------------- HUD ----------------
   Called every frame, so it only touches the DOM when a value actually changes
   (writing styles/text at 60 Hz forces layout/repaint thrash on mobile). */
let _hud={};
function updateHUD(){
  const mh=maxHp(),mode=combatMode(),a=ammoFor(mode),ammo=a?invCount(a):-1;
  if(P.hp!==_hud.hp||mh!==_hud.mh){
    $('hpfill').style.width=(100*P.hp/mh)+'%';$('hptext').textContent=P.hp+'/'+mh;}
  if(P.gold!==_hud.gold)$('gold').textContent=P.gold;
  if(mode!==_hud.mode||P.style!==_hud.style){
    const styleBtn=$('stylebtn');
    if(styleBtn){
      if(mode==='melee'){styleBtn.style.display='';
        styleBtn.textContent=P.style==='accurate'?'🎯':P.style==='aggressive'?'⚔️':'🛡️';}
      else styleBtn.style.display='none';
    }
  }
  if(mode!==_hud.mode||a!==_hud.a||ammo!==_hud.ammo){
    const am=$('ammo');
    if(am){if(a){am.style.display='';am.textContent=(a==='arrows'?'➶ ':'✦ ')+ammo;}
      else am.style.display='none';}
  }
  _hud={hp:P.hp,mh,gold:P.gold,mode,style:P.style,a,ammo};
}

/* ---------------- minimap (toggle open, redrawn while visible) ---------- */
let minimapOn=false;
const MM_GROUND={'.':'#4a6741',',':'#5a4a3a',';':'#565c58',':':'#465239',
  's':'#dbe4ee','a':'#a89a4e','d':'#d8c489'};
function toggleMinimap(){
  minimapOn=!minimapOn;
  $('minimap').classList.toggle('open',minimapOn);
  if(minimapOn)drawMinimap();
}
function drawMinimap(){
  const cvm=$('mmcv');if(!cvm)return;
  const W=world[P.map],cols=W.w,rows=W.h;
  const cell=clamp(Math.floor(Math.min(window.innerWidth*0.86,360)/cols),3,10);
  if(cvm.width!==cols*cell){cvm.width=cols*cell;cvm.height=rows*cell;}
  const g=cvm.getContext('2d');
  const gnd=MM_GROUND[MAPS[P.map].ground]||'#4a6741';
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const ch=W.grid[y][x];
    g.fillStyle = ch==='~'?'#31504f' : (ch==='P'||ch==='E'||ch==='D')?'#8a8578'
      : ch==='B'||ch==='K'?'#6f5340' : (ch==='Q'||ch==='H'||ch==='G')?'#c9a24a'
      : ch==='k'?'#3f7a3a' : ch==='V'?'#8a929c' : ch==='N'?'#b08f57'
      : MM_GROUND[ch]||(RES[ch]?gnd:'#33302a');
    g.fillRect(x*cell,y*cell,cell,cell);
  }
  for(const r of W.res){if(!r.alive)continue;
    g.fillStyle=RES[r.type].skill==='woodcutting'?'#3a6a2c':'#7d8590';g.fillRect(r.x*cell,r.y*cell,cell,cell);}
  for(const e of W.exits){g.fillStyle='#7fbf5f';g.fillRect(e.x*cell-1,e.y*cell-1,cell+2,cell+2);}
  for(const n of W.npcs){g.fillStyle='#e8b64c';g.fillRect(n.x*cell-1,n.y*cell-1,cell+2,cell+2);}
  for(const m of W.mobs){if(!m.alive)continue;
    g.fillStyle=MOBS[m.type].boss?'#f0c419':'#c9584a';g.fillRect(m.tx*cell,m.ty*cell,cell,cell);}
  g.fillStyle='#0d0b08';g.fillRect(P.tx*cell-2,P.ty*cell-2,cell+4,cell+4);
  g.fillStyle='#66e0ff';g.fillRect(P.tx*cell-1,P.ty*cell-1,cell+2,cell+2);
  $('mmlabel').textContent=MAPS[P.map].name;
}

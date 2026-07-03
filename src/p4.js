/* p4: procedural pixel art — tiles, paper-doll player (gear tinting),
       mobs & bosses, ground-drop sprites, inventory icons.
       All sprites use a 16px logical grid drawn 2x onto 32px canvases. */
const SPR={};
function mk(w,h,fn){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');
  const p=(x,y,pw,ph,col)=>{g.fillStyle=col;g.fillRect(x*2,y*2,pw*2,ph*2);};
  fn(g,p);return c;
}
function noiseTile(base,specks,density){
  return mk(32,32,(g,p)=>{
    g.fillStyle=base;g.fillRect(0,0,32,32);
    const n=density||14;
    for(let i=0;i<n;i++)p(rand(0,15),rand(0,15),1,1,specks[i%specks.length]);
  });
}
function shade(hex,f){ // lighten (f>0) / darken (f<0) a #rrggbb color
  const n=parseInt(hex.slice(1),16);
  const ch=s=>clamp(Math.round(((n>>s)&255)*(1+f)),0,255);
  return '#'+[16,8,0].map(s=>ch(s).toString(16).padStart(2,'0')).join('');
}

function buildSprites(){
  /* ---- ground ---- */
  SPR['.']=noiseTile('#4a6741',['#425e3a','#54744a','#3f5937']);
  SPR[',']=noiseTile('#5a4a3a',['#4f4133','#655342','#544539'],10);
  SPR[';']=noiseTile('#565c58',['#4b514d','#616a63','#3f4a44'],12);
  SPR[':']=noiseTile('#465239',['#3d4832','#525f43','#39432e'],16);
  SPR['P']=mk(32,32,(g,p)=>{g.fillStyle='#8a8578';g.fillRect(0,0,32,32);
    p(0,0,16,1,'#7c776b');p(0,15,16,1,'#7c776b');
    [[2,3],[7,5],[12,2],[4,10],[10,12],[14,8],[1,13],[8,9]].forEach(([x,y])=>{p(x,y,2,2,'#948f81');p(x,y,1,1,'#9d9889')});
  });
  /* ---- walls & solids ---- */
  SPR['X']=mk(32,32,(g,p)=>{g.fillStyle='#6d6a63';g.fillRect(0,0,32,32);
    p(0,0,16,1,'#7d7a72');
    for(let r=0;r<4;r++)for(let c2=0;c2<4;c2++){const off=r%2?2:0;p((c2*4+off)%16,r*4,3,3,'#77746c');p((c2*4+off)%16,r*4,3,1,'#827f76');}
  });
  SPR['#']=mk(32,32,(g,p)=>{g.fillStyle='#332e29';g.fillRect(0,0,32,32);
    p(2,2,4,3,'#3d3730');p(9,4,5,4,'#3d3730');p(4,9,4,4,'#3d3730');p(11,11,4,3,'#3d3730');
    p(2,2,4,1,'#453f37');p(9,4,5,1,'#453f37');});
  SPR['U']=mk(32,32,(g,p)=>{g.fillStyle='#3f4a4a';g.fillRect(0,0,32,32);
    for(let r=0;r<4;r++)for(let c2=0;c2<4;c2++){const off=r%2?2:0;p((c2*4+off)%16,r*4,3,3,'#4a5757');p((c2*4+off)%16,r*4,3,1,'#556363');}
    p(3,5,2,2,'#2f3a3a');p(10,9,3,2,'#2f3a3a');});
  SPR['S']=mk(32,32,(g,p)=>{g.fillStyle='#22301f';g.fillRect(0,0,32,32);
    p(2,2,5,5,'#2b3d27');p(9,7,5,5,'#2b3d27');p(4,10,4,4,'#1a2618');p(11,1,4,4,'#263524');
    p(6,12,1,3,'#3d4f33');p(12,10,1,4,'#3d4f33');});
  SPR['~']=mk(32,32,(g,p)=>{g.fillStyle='#31504f';g.fillRect(0,0,32,32);
    p(2,3,4,1,'#457270');p(9,6,4,1,'#457270');p(4,11,3,1,'#457270');p(11,13,3,1,'#457270');p(12,2,3,1,'#3c6260');});
  SPR['W1']=mk(32,32,(g,p)=>{g.fillStyle='#35566b';g.fillRect(0,0,32,32);
    p(2,3,3,1,'#4a7089');p(9,6,4,1,'#4a7089');p(4,11,3,1,'#4a7089');p(12,13,3,1,'#4a7089');});
  SPR['R']=mk(32,32,(g,p)=>{g.fillStyle='#6e4438';g.fillRect(0,0,32,32);
    for(let r=0;r<4;r++)p(0,r*4,16,1,'#5c382e');
    for(let r=0;r<4;r++)for(let c2=0;c2<4;c2++)p(c2*4+(r%2?2:0),r*4+1,1,3,'#7a4a3a');});
  SPR['W']=SPR['W1'];
  SPR['F']=mk(32,32,(g,p)=>{g.fillStyle='#243b22';g.fillRect(0,0,32,32);
    p(2,2,5,5,'#2f4d2c');p(9,7,5,5,'#2f4d2c');p(4,10,4,4,'#1f331d');p(11,1,4,4,'#2a442a');});
  SPR['Q']=mk(32,32,(g,p)=>{g.drawImage(SPR['.'],0,0);
    p(3,13,2,3,'#5b4632');p(11,13,2,3,'#5b4632');
    p(2,4,12,9,'#6b5138');p(3,5,10,7,'#8a6a42');
    p(4,6,5,1,'#e8dcc3');p(4,8,7,1,'#e8dcc3');p(4,10,4,1,'#e8dcc3');
    p(2,4,12,1,'#7d5f42');});
  SPR['H']=mk(32,32,(g,p)=>{ /* trophy monument */
    g.drawImage(SPR['.'],0,0);
    p(3,12,10,3,'#7d7a72');p(4,11,8,1,'#8a877f');
    p(5,3,6,9,'#8f8c84');p(5,3,6,1,'#9d9a92');
    p(6,4,4,1,'#f0c419');p(7,6,2,4,'#6d6a63');
    p(6,5,1,1,'#5f5c55');p(9,5,1,1,'#5f5c55');});
  SPR['G']=mk(32,32,(g,p)=>{ /* ruins gravestone decoration */
    g.drawImage(SPR[';'],0,0);
    p(5,6,6,8,'#6a716c');p(6,4,4,3,'#6a716c');p(6,5,4,1,'#757c76');
    p(7,8,2,1,'#525a54');p(6,10,4,1,'#525a54');});
  SPR['E']=mk(32,32,(g,p)=>{g.drawImage(SPR['P'],0,0);p(6,7,5,2,'#e8b64c');p(10,5,2,2,'#e8b64c');p(10,9,2,2,'#e8b64c');});
  /* ---- resources ---- */
  SPR.tree=mk(32,48,(g,p)=>{
    p(7,17,2,7,'#5b4632');p(6,22,4,2,'#4e3b29');
    p(3,4,10,10,'#2f4d2c');p(5,2,6,4,'#2f4d2c');p(1,7,14,5,'#2f4d2c');
    p(4,4,4,3,'#40663a');p(9,7,3,3,'#40663a');p(3,10,3,2,'#294427');});
  SPR.oak=mk(32,48,(g,p)=>{
    p(6,16,4,8,'#4e3b29');p(5,22,6,2,'#42311f');
    p(2,2,12,12,'#26421f');p(0,6,16,6,'#26421f');p(4,0,8,4,'#26421f');
    p(3,3,5,3,'#39572e');p(10,6,4,3,'#39572e');p(2,10,4,2,'#1d3418');
    p(7,4,2,2,'#546e2f');});
  SPR.stump=mk(32,32,(g,p)=>{g.drawImage(SPR['.'],0,0);
    p(6,8,4,5,'#5b4632');p(5,7,6,2,'#8a6a42');p(6,8,4,1,'#a4855c');});
  SPR.rock_c=mk(32,32,(g,p)=>{
    p(3,6,10,8,'#57524b');p(5,4,7,3,'#57524b');p(2,9,12,4,'#4c4841');
    p(4,5,4,2,'#645e56');p(6,8,2,2,'#c47f3e');p(10,10,2,2,'#c47f3e');p(4,11,2,1,'#c47f3e');});
  SPR.rock_i=mk(32,32,(g,p)=>{
    p(3,6,10,8,'#4e4c4a');p(5,4,7,3,'#4e4c4a');p(2,9,12,4,'#44423f');
    p(4,5,4,2,'#5b5956');p(6,8,2,2,'#9fb0bd');p(10,10,2,2,'#9fb0bd');p(4,11,2,1,'#9fb0bd');});
  SPR.rubble=mk(32,32,(g,p)=>{
    p(4,11,3,2,'#4c4841');p(9,12,3,2,'#57524b');p(7,9,2,2,'#4c4841');});

  /* ---- player paper-doll (rebuilt whenever equipment changes) ---- */
  rebuildPlayerSprite();

  /* ---- mobs ---- */
  SPR.goblin=mk(32,32,(g,p)=>{
    p(4,4,8,7,'#6f8f3f');p(2,4,2,3,'#5d7a33');p(12,4,2,3,'#5d7a33');
    p(5,6,2,2,'#d9e04a');p(9,6,2,2,'#d9e04a');p(6,7,1,1,'#2b2b2b');p(10,7,1,1,'#2b2b2b');
    p(6,10,4,1,'#3f5222');p(4,11,3,4,'#5d7a33');p(9,11,3,4,'#5d7a33');});
  SPR.wolf=mk(32,32,(g,p)=>{
    p(2,7,12,5,'#8b8b8b');p(11,5,4,4,'#9a9a9a');p(13,4,2,2,'#7c7c7c');
    p(14,6,1,1,'#d94a3a');p(1,6,2,3,'#7c7c7c');
    p(3,12,2,3,'#6f6f6f');p(11,12,2,3,'#6f6f6f');p(0,8,2,2,'#7c7c7c');});
  SPR.rat=mk(32,32,(g,p)=>{
    p(4,9,8,4,'#96775f');p(11,8,3,3,'#a8886e');p(13,9,1,1,'#2b2b2b');
    p(1,10,3,1,'#c9a68a');p(5,13,2,2,'#7d6350');p(9,13,2,2,'#7d6350');});
  SPR.skeleton=mk(32,32,(g,p)=>{
    p(5,1,6,5,'#d8d5c8');p(6,3,1,1,'#171512');p(9,3,1,1,'#171512');p(7,5,2,1,'#171512');
    p(6,6,4,6,'#c9c6b8');p(5,7,6,1,'#d8d5c8');p(5,9,6,1,'#d8d5c8');
    p(4,6,1,5,'#c9c6b8');p(11,6,1,5,'#c9c6b8');
    p(1,5,2,7,'#8a6a42');p(1,4,2,1,'#6b5138');}); /* bow at side */
  SPR.cultist=mk(32,32,(g,p)=>{
    p(4,2,8,12,'#5a3d6b');p(5,1,6,3,'#4a3159');p(6,4,4,3,'#1d1522');
    p(7,5,1,1,'#d94af0');p(9,5,1,1,'#d94af0');
    p(3,6,1,6,'#5a3d6b');p(12,6,1,6,'#5a3d6b');
    p(13,3,1,9,'#8a6a42');p(12,2,3,2,'#b06fd1');});
  SPR.gargoyle=mk(32,32,(g,p)=>{
    p(4,4,8,8,'#7a8087');p(2,3,3,4,'#6a7077');p(11,3,3,4,'#6a7077');
    p(5,6,2,2,'#e8b64c');p(9,6,2,2,'#e8b64c');
    p(3,2,2,3,'#5c6269');p(11,2,2,3,'#5c6269');
    p(5,12,2,3,'#6a7077');p(9,12,2,3,'#6a7077');p(6,10,4,1,'#565c63');});
  SPR.bogstalker=mk(32,32,(g,p)=>{
    p(4,5,8,8,'#4e6b3f');p(3,4,10,2,'#42592f');
    p(5,7,2,2,'#e0e04a');p(9,7,2,2,'#e0e04a');
    p(2,8,2,5,'#42592f');p(12,8,2,5,'#42592f');
    p(13,2,1,10,'#8a6a42');p(6,13,4,2,'#3a4d2a');});
  SPR.hagspawn=mk(32,32,(g,p)=>{
    p(4,3,8,10,'#3f5a52');p(5,2,6,2,'#354943');
    p(6,5,1,2,'#7af0c9');p(9,5,1,2,'#7af0c9');
    p(3,6,1,6,'#3f5a52');p(12,6,1,6,'#3f5a52');
    p(6,13,4,2,'#2c403a');p(2,1,3,3,'#7af0c955');});
  /* bosses: distinct 16px art, rendered at 2x scale (see draw()) */
  SPR.goblin_king=mk(32,32,(g,p)=>{
    p(4,5,8,7,'#5d7a33');p(2,5,2,3,'#4e6629');p(12,5,2,3,'#4e6629');
    p(5,7,2,2,'#f0e04a');p(9,7,2,2,'#f0e04a');
    p(4,3,8,2,'#f0c419');p(4,2,1,2,'#f0c419');p(7,1,2,3,'#f0c419');p(11,2,1,2,'#f0c419');
    p(6,11,4,1,'#3f5222');p(4,12,3,3,'#4e6629');p(9,12,3,3,'#4e6629');});
  SPR.rock_horror=mk(32,32,(g,p)=>{
    p(3,4,10,9,'#5f5b54');p(2,6,2,5,'#524e48');p(12,6,2,5,'#524e48');
    p(5,6,2,2,'#e8642c');p(9,6,2,2,'#e8642c');
    p(4,4,3,2,'#6d6961');p(9,10,3,2,'#6d6961');
    p(4,13,3,2,'#44413b');p(9,13,3,2,'#44413b');p(6,3,4,1,'#77746c');});
  SPR.lich=mk(32,32,(g,p)=>{
    p(5,1,6,5,'#d8d5c8');p(6,3,1,1,'#66e0ff');p(9,3,1,1,'#66e0ff');p(7,5,2,1,'#171512');
    p(4,6,8,8,'#2c3e50');p(4,6,8,1,'#3d5266');
    p(3,6,1,7,'#2c3e50');p(12,6,1,7,'#2c3e50');
    p(13,1,1,12,'#8a6a42');p(12,0,3,2,'#66e0ff');
    p(4,1,1,1,'#f0c419');p(11,1,1,1,'#f0c419');p(5,0,6,1,'#f0c419');});
  SPR.swamp_hag=mk(32,32,(g,p)=>{
    p(4,2,8,11,'#354a42');p(3,1,10,3,'#2c3e37');
    p(5,5,2,2,'#7af0c9');p(9,5,2,2,'#7af0c9');p(7,8,2,1,'#1d2a25');
    p(2,5,2,8,'#2c3e37');p(12,5,2,8,'#2c3e37');
    p(1,0,3,4,'#7af0c955');p(12,0,3,4,'#7af0c955');
    p(13,2,1,11,'#5b4632');p(11,1,4,2,'#4e8a6d');});
  /* ---- NPCs ---- */
  const NPCC={banker:'#4f6a8f',smith:'#8f5a3a',elder:'#7a6f9a',guard:'#6b7d5a',skillmaster:'#b0862c'};
  for(const id in NPCC)SPR['npc_'+id]=mk(32,32,(g,p)=>{
    p(5,1,6,5,'#d9a877');p(5,0,6,2,id==='elder'?'#cfcabb':'#3c2f22');
    p(6,3,1,1,'#2b2b2b');p(9,3,1,1,'#2b2b2b');
    p(4,6,8,7,NPCC[id]);p(4,6,8,1,'#00000033');
    p(3,7,1,4,'#d9a877');p(12,7,1,4,'#d9a877');
    p(5,13,2,2,'#33291e');p(9,13,2,2,'#33291e');
    if(id==='guard')p(13,2,1,10,'#b8c4cf');
    if(id==='smith')p(2,3,2,8,'#555049');
    if(id==='skillmaster'){p(4,6,8,1,'#f0c419');p(2,6,2,8,'#d9534f');p(12,6,2,8,'#7f9bd1');}});
  /* ---- misc ---- */
  SPR.gravestone=mk(32,32,(g,p)=>{
    p(4,6,8,9,'#7d7a72');p(5,4,6,3,'#7d7a72');p(5,5,6,1,'#8a877f');
    p(6,8,4,1,'#5f5c55');p(6,10,4,1,'#5f5c55');p(3,14,10,1,'#4c4841');});
  SPR.coins=mk(32,32,(g,p)=>{
    p(5,10,3,2,'#f0c419');p(8,11,3,2,'#e0b410');p(6,8,3,2,'#f0d45a');p(7,9,1,1,'#fff0a0');});
}

/* ---------- paper-doll: player sprite from current gear ---------- */
function rebuildPlayerSprite(){
  const gearOf=slot=>P.gear[slot]&&GEAR[P.gear[slot].id]?GEAR[P.gear[slot].id]:null;
  const w=gearOf('weapon'),sh=gearOf('shield'),he=gearOf('helmet'),
        bo=gearOf('body'),le=gearOf('legs');
  const capePc=P.gear.cape,cape=capePc&&CAPES[capePc.id]?CAPES[capePc.id]:null;
  SPR.player=mk(32,32,(g,p)=>{
    /* cape behind everything */
    if(cape){p(3,6,10,8,shade(cape.color,-0.25));p(4,6,8,7,cape.color);}
    /* legs */
    const legC=le?le.color:'#4a3b2c';
    p(5,12,2,3,legC);p(9,12,2,3,legC);
    p(5,15,2,1,shade(legC,-0.3));p(9,15,2,1,shade(legC,-0.3));
    /* torso */
    const bodC=bo?bo.color:'#77543f';
    p(4,6,8,6,shade(bodC,-0.15));p(5,7,6,4,bodC);p(4,6,8,1,shade(bodC,-0.35));
    if(bo&&bo.line==='g')p(4,11,8,2,bodC); /* robe skirt */
    /* arms */
    p(3,7,1,4,'#d9a877');p(12,7,1,4,'#d9a877');
    /* belt */
    p(7,6,2,6,shade(bodC,-0.35));
    /* head */
    p(5,1,6,5,'#d9a877');
    if(he){
      if(he.line==='m'){p(5,0,6,3,he.color);p(5,3,1,2,he.color);p(10,3,1,2,he.color);p(7,3,2,2,he.color);}
      else if(he.line==='r'){p(5,0,6,2,he.color);p(4,1,1,3,he.color);p(11,1,1,3,he.color);}
      else {p(4,1,8,1,he.color);p(6,0,4,1,he.color);p(7,0,2,1,shade(he.color,0.2));}
    }else{p(5,0,6,2,'#6e4f2a');p(4,1,1,2,'#6e4f2a');p(11,1,1,2,'#6e4f2a');}
    p(6,3,1,1,'#2b2b2b');p(9,3,1,1,'#2b2b2b');
    /* weapon (right side) */
    if(w){
      if(w.line==='m'){p(13,2,1,8,w.color);p(13,1,1,1,shade(w.color,0.3));p(12,9,3,1,'#8a6a42');p(13,10,1,2,'#5b4632');}
      else if(w.line==='r'){p(13,2,1,9,'#8a6a42');p(12,2,1,1,'#8a6a42');p(12,10,1,1,'#8a6a42');p(14,3,1,7,'#d8d5c8');}
      else {p(13,1,1,11,'#8a6a42');p(12,0,3,2,w.color);p(13,0,1,1,shade(w.color,0.4));}
    }
    /* shield (left side, over arm) */
    if(sh){p(1,6,3,5,sh.color);p(1,6,3,1,shade(sh.color,0.25));p(2,8,1,1,shade(sh.color,-0.3));}
  });
}

/* ---------- inventory icons ---------- */
const ICON={};
function mkIcon(fn){return mk(32,32,fn);}
function iconShape(p,shape,c){
  const d=shade(c,-0.3),l=shade(c,0.25);
  switch(shape){
    case'sword':p(7,2,2,8,c);p(7,2,1,8,l);p(5,10,6,1,'#8a6a42');p(7,11,2,3,'#5b4632');break;
    case'bow':p(5,2,1,12,'#8a6a42');p(6,2,2,1,c);p(6,13,2,1,c);p(9,3,1,10,'#d8d5c8');break;
    case'staff':p(7,3,2,11,'#8a6a42');p(6,1,4,3,c);p(7,1,1,1,l);break;
    case'shield':p(4,3,8,7,c);p(5,10,6,2,c);p(6,12,4,1,c);p(7,13,2,1,c);p(4,3,8,1,l);p(7,5,2,4,d);break;
    case'helm_m':p(4,4,8,6,c);p(4,4,8,2,l);p(7,8,2,4,c);p(5,10,2,2,d);p(9,10,2,2,d);break;
    case'helm_r':p(4,4,8,4,c);p(3,6,2,6,c);p(11,6,2,6,c);p(4,4,8,1,l);break;
    case'helm_g':p(3,9,10,2,c);p(5,5,6,4,c);p(7,2,2,3,c);p(7,2,1,1,l);break;
    case'body':p(4,3,8,9,c);p(2,4,2,4,c);p(12,4,2,4,c);p(4,3,8,1,l);p(7,5,2,7,d);break;
    case'legs':p(5,3,6,3,c);p(5,6,2,8,c);p(9,6,2,8,c);p(5,3,6,1,l);break;
    case'cape':p(4,2,8,11,c);p(5,13,6,1,c);p(4,2,8,1,l);p(6,4,1,8,d);break;
    case'axe':p(7,3,2,10,'#8a6a42');p(5,2,4,4,c);p(4,3,2,3,c);break;
    case'pick':p(7,3,2,10,'#8a6a42');p(4,2,8,2,c);p(3,3,2,2,c);p(11,3,2,2,c);break;
    case'arrow':p(7,2,1,10,'#8a6a42');p(6,2,3,2,c);p(6,11,1,2,'#d8d5c8');p(9,11,1,2,'#d8d5c8');break;
    case'rune':p(5,4,6,8,c);p(6,5,4,6,l);p(7,6,2,4,d);break;
    case'logs':p(3,7,10,4,'#8a6a42');p(3,7,10,1,'#a4855c');p(11,7,2,4,'#5b4632');break;
    case'ore':p(4,6,8,6,'#57524b');p(6,8,2,2,c);p(9,9,2,2,c);break;
    case'bone':p(4,10,8,2,'#d8d5c8');p(3,9,2,2,'#d8d5c8');p(11,11,2,2,'#d8d5c8');break;
    case'pelt':p(4,4,8,8,c);p(3,3,3,3,c);p(10,3,3,3,c);p(6,6,4,4,shade(c,0.2));break;
    case'dust':p(5,8,2,2,c);p(8,6,2,2,c);p(9,10,2,2,c);p(6,11,1,1,c);break;
    case'herb':p(7,4,2,8,'#3a6a2c');p(5,5,2,2,c);p(9,6,2,2,c);p(6,9,1,1,c);break;
    case'gem':p(6,4,4,2,c);p(5,6,6,3,c);p(7,9,2,3,c);p(6,5,2,1,shade(c,0.5));break;
    case'bread':p(4,6,8,5,c);p(4,6,8,1,shade(c,0.3));p(6,8,1,1,shade(c,-0.2));p(9,8,1,1,shade(c,-0.2));break;
    case'meat':p(4,6,7,5,c);p(10,5,3,3,'#d8d5c8');p(5,7,3,2,shade(c,0.25));break;
    case'pie':p(4,7,8,4,c);p(3,7,10,1,shade(c,0.3));p(5,9,2,1,shade(c,-0.3));p(9,9,2,1,shade(c,-0.3));break;
    case'stew':p(4,7,8,5,'#8a6a42');p(4,7,8,1,'#a4855c');p(5,6,6,2,c);p(6,5,1,1,'#e8dcc3');p(9,5,1,1,'#e8dcc3');break;
    case'coin':p(5,5,6,6,c);p(6,6,4,4,shade(c,0.3));p(7,7,2,2,c);break;
  }
}
const ITEM_ICON={
  logs:['logs','#8a6a42'],oak_logs:['logs','#5b4632'],copper_ore:['ore','#c47f3e'],
  iron_ore:['ore','#9fb0bd'],bone:['bone','#d8d5c8'],wolf_pelt:['pelt','#8b8b8b'],
  ancient_dust:['dust','#b0a0e0'],swamp_herb:['herb','#7af0c9'],gem:['gem','#66e0ff'],
  arrows:['arrow','#b8c4cf'],runes:['rune','#9b7fd1'],
  bread:['bread','#d9a860'],cooked_meat:['meat','#a05a3a'],meat_pie:['pie','#c98b50'],
  stew:['stew','#8a5a3a'],
};
function buildIcons(){
  for(const id in ITEM_ICON){const[s,c]=ITEM_ICON[id];ICON[id]=mkIcon((g,p)=>iconShape(p,s,c));}
  for(const id in TOOLS){const[s,c]=TOOLS[id].icon;ICON[id]=mkIcon((g,p)=>iconShape(p,s,c));}
  for(const id in GEAR){
    const g0=GEAR[id];
    let shape=g0.slot;
    if(g0.slot==='weapon')shape=g0.line==='m'?'sword':g0.line==='r'?'bow':'staff';
    if(g0.slot==='helmet')shape='helm_'+g0.line;
    ICON[id]=mkIcon((g,p)=>iconShape(p,shape,g0.color));
  }
  for(const id in CAPES){const c=CAPES[id];ICON[id]=mkIcon((g,p)=>iconShape(p,'cape',c.color));}
  ICON.gold=mkIcon((g,p)=>iconShape(p,'coin','#f0c419'));
}

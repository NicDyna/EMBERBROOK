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
/* 1:1 fine-grid canvas (double the detail of mk's 2x grid) — used for the
   higher-res, animated characters. q(x,y,w,h,col) draws a single art pixel. */
function mkPix(w,h,fn){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');
  const q=(x,y,pw,ph,col)=>{g.fillStyle=col;g.fillRect(x,y,pw,ph);};
  fn(g,q);return c;
}
function noiseTile(base,specks,density){
  return mk(32,32,(g,p)=>{
    g.fillStyle=base;g.fillRect(0,0,32,32);
    const n=density||14;
    /* ambRand (not rand) so decorative tile noise never touches the gameplay RNG */
    for(let i=0;i<n;i++)p(ambRand(0,15),ambRand(0,15),1,1,specks[i%specks.length]);
  });
}
function shade(hex,f){ // lighten (f>0) / darken (f<0) a #rrggbb color
  const n=parseInt(hex.slice(1),16);
  const ch=s=>clamp(Math.round(((n>>s)&255)*(1+f)),0,255);
  return '#'+[16,8,0].map(s=>ch(s).toString(16).padStart(2,'0')).join('');
}

/* ---------- oblique 2.5D buildings (north-facing: front + pitched roof) ----
   Drawn on a fine 4px art-grid so structures carry far more detail than the
   16px character sprites. Anchored at the footprint's south edge (see p6). */
const BUILDING_STYLE={
  house_a:{wall:'#cbb79a',roof:'#7d4a3a',trim:'#5b4632',door:'#5b4632'},
  house_b:{wall:'#b9a888',roof:'#586576',trim:'#4a3f33',door:'#432f22'},
  house_c:{wall:'#d6c39c',roof:'#6b7d5a',trim:'#5b4632',door:'#432f22'},
  bank:   {wall:'#b8bfc9',roof:'#455066',trim:'#8a8f98',door:'#39414f',stone:true,chimney:false},
  forge:  {wall:'#9c9186',roof:'#38352f',trim:'#57524b',door:'#2b2824',forge:true},
  hall:   {wall:'#cdb98f',roof:'#8a5a3a',trim:'#5b4632',door:'#432f22',big:true},
  inn:    {wall:'#caa96f',roof:'#7a4a38',trim:'#5b4632',door:'#432f22',sign:true},
  church: {wall:'#d0c7b1',roof:'#4a5566',trim:'#8a8272',door:'#4a3a2a',church:true,chimney:false},
  tower:  {wall:'#9aa0a2',roof:'#7a4a3a',trim:'#6a7072',round:true},
};
function mkBuilding(b){
  const AP=4, s=BUILDING_STYLE[b.type]||BUILDING_STYLE.house_a;
  const aw=b.w*8;                              // art-px width == b.w*TILE at AP=4
  const wallR=b.d*4+10, round=!!s.round;
  const roofR=round?Math.round(aw*0.55)+4:Math.round(aw*0.5)+3;
  const spireR=s.church?Math.round(aw*0.95):0;
  const ah=spireR+roofR+wallR;
  const c=document.createElement('canvas');c.width=aw*AP;c.height=ah*AP;
  const g=c.getContext('2d');
  const p=(x,y,w,h,col)=>{if(w<=0||h<=0)return;g.fillStyle=col;
    g.fillRect(Math.round(x*AP),Math.round(y*AP),Math.max(1,Math.round(w*AP)),Math.max(1,Math.round(h*AP)));};
  const wallTop=spireR+roofR, wallBot=ah, roofTop=spireR;

  if(round){ /* ---- round stone tower (Büchelturm) ---- */
    const cx=aw/2;
    for(let i=0;i<aw;i++){const t=(i/(aw-1))*2-1;
      p(i,wallTop,1,wallR,shade(s.wall,-0.30+0.48*(1-Math.abs(t))));}
    for(let ry=wallTop+2;ry<wallBot;ry+=3)p(1,ry,aw-2,1,shade(s.wall,-0.34));
    p(0,wallTop,aw,2,shade(s.wall,-0.4));
    p(cx-1,wallTop+5,2,4,'#1d1f22');p(cx-1,wallBot-9,2,5,'#1d1f22');
    for(let ry=0;ry<roofR;ry++){const frac=ry/(roofR-1),wdt=Math.max(2,Math.round(aw*frac));
      p(cx-wdt/2,roofTop+ry,wdt,1,shade(s.roof,0.12-frac*0.42));}
    p(cx-0.5,roofTop-3,1,4,'#6a7072');p(cx+0.5,roofTop-3,3,1.6,'#c94a3a');
    return c;
  }

  /* ---- pitched roof (hip trapezoid seen obliquely) ---- */
  const ridgeW=Math.max(3,Math.round(aw*0.30));
  for(let ry=0;ry<roofR;ry++){const frac=ry/(roofR-1);
    const wdt=Math.round(ridgeW+(aw+2-ridgeW)*frac),left=(aw-wdt)/2,shf=0.10-frac*0.30;
    p(left,roofTop+ry,wdt,1,shade(s.roof,shf));
    if(ry%2===0)p(left,roofTop+ry,wdt,1,shade(s.roof,shf-0.09));}
  p((aw-ridgeW)/2,roofTop,ridgeW,1,shade(s.roof,0.28));
  p(-1,wallTop-1,aw+2,1,shade(s.roof,-0.45));

  /* ---- walls ---- */
  p(0,wallTop,aw,wallR,s.wall);
  p(0,wallTop,aw,1,shade(s.wall,0.18));
  p(0,wallBot-1,aw,1,shade(s.wall,-0.35));
  if(s.stone){
    for(let ry=wallTop+2;ry<wallBot-1;ry+=3)p(1,ry,aw-2,1,shade(s.wall,-0.20));
    for(let i=0;i<3;i++)p(2+i*(aw-4)/2,wallTop+1,1.5,wallR-2,shade(s.wall,0.10));
  }else{
    p(0,wallTop,1.5,wallR,s.trim);p(aw-1.5,wallTop,1.5,wallR,s.trim);
    p(0,wallTop+Math.round(wallR*0.5),aw,1,shade(s.trim,0.05));
  }
  /* windows */
  const winY=wallTop+3,winH=3,glow='#f2d68a';
  for(const cxf of (b.w>=4?[0.17,0.63]:[0.30])){const wx=Math.round(aw*cxf);
    p(wx-0.5,winY-0.5,3,winH+1,s.trim);p(wx,winY,2,winH,glow);
    p(wx,winY,2,1,shade(glow,0.2));p(wx+0.9,winY,0.5,winH,shade(s.trim,-0.2));}
  /* door */
  const dw=Math.max(3,Math.round(aw*0.16)),dx=(aw-dw)/2,dh=Math.round(wallR*0.55);
  p(dx-0.5,wallBot-dh-0.5,dw+1,dh+0.5,s.trim);p(dx,wallBot-dh,dw,dh,s.door);
  p(dx,wallBot-dh,dw,1,shade(s.door,0.25));p(dx+dw-1,wallBot-dh+dh*0.4,0.8,0.8,'#e8c451');

  /* ---- flourishes ---- */
  if(s.forge){p(aw-6,roofTop+2,3,roofR,shade(s.wall,-0.25));p(aw-6,roofTop+1,3,1.5,'#2b2824');
    p(aw-6.5,roofTop-2,1.6,1.6,'#0000002e');p(aw-5,roofTop-5,2,2,'#00000022');
    p(Math.round(aw*0.63),winY,2,winH,'#ff8a3a');p(Math.round(aw*0.63),winY,2,1,'#ffd08a');}
  if(s.sign){p(aw-7,wallTop+2,0.8,4,s.trim);p(aw-9,wallTop+5,5,4,shade(s.door,0.12));
    p(aw-9,wallTop+5,5,1,s.trim);p(aw-7.6,wallTop+6,2,2,'#e8c451');}
  if(s.big){p(aw/2-0.5,roofTop-6,1,6,'#6a7072');p(aw/2+0.5,roofTop-6,3.5,2,'#4a7ea0');
    p(aw/2-1.5,wallTop+2,3,3,'#e8dcc3');p(aw/2-0.2,wallTop+3,0.7,1.6,'#2b2824');}
  if(s.stone){p(aw/2-1.5,wallTop+2,3,3,'#f0c419');p(aw/2-0.6,wallTop+2.6,1.2,1.8,shade('#f0c419',-0.3));}
  if(s.church){
    const tw=Math.max(7,Math.round(aw*0.32)),tTop=Math.round(spireR*0.42);
    p(0,tTop,tw,wallBot-tTop,s.wall);p(0,tTop,tw,1,shade(s.wall,0.16));
    p(0,tTop,1,wallBot-tTop,s.trim);p(tw-1,tTop,1,wallBot-tTop,s.trim);
    p(tw/2-1,tTop+4,2,4,'#2b2f36');p(tw/2-1,tTop+11,2,3,'#2b2f36');
    for(let ry=0;ry<tTop;ry++){const frac=ry/(tTop-1),wdt=Math.max(1,Math.round(tw*frac));
      p(tw/2-wdt/2,ry,wdt,1,shade(s.roof,0.16-frac*0.42));}
    p(tw/2-0.4,0,0.9,3.2,'#e8dcc3');p(tw/2-1.5,1,3,0.9,'#e8dcc3');
    const rw=Math.round(aw*0.62);p(rw,wallTop+2,3,3,'#6fb7ff');p(rw+0.6,wallTop+2.6,1.6,1.8,'#bfe0ff');
  }
  if(!s.stone&&!s.church){ /* window flower boxes */
    for(const cxf of (b.w>=4?[0.17,0.63]:[0.30])){const wx=Math.round(aw*cxf);
      p(wx-1,winY+winH+0.5,4,1.5,'#5b4632');
      p(wx,winY+winH+0.5,1,1,'#d0556a');p(wx+1.5,winY+winH+0.5,1,1,'#e6cf49');p(wx+2.6,winY+winH+0.5,1,1,'#8a5fd0');}
  }
  if(s.chimney!==false&&!s.forge){ /* roof chimney + smoke anchor */
    const cxp=aw-7,cyp=roofTop+Math.max(1,Math.round(roofR*0.18));
    p(cxp-0.5,cyp-1,4,1,shade(s.roof,-0.65));p(cxp,cyp-1,3,8,shade(s.roof,-0.5));p(cxp,cyp-1,3,1,'#3a3630');
    b.chim=[cxp+1.5,cyp-1];
  }
  if(s.forge)b.chim=[aw-4.5,roofTop+1];
  return c;
}

function buildSprites(){
  /* ---- ground ---- */
  SPR['.']=mkPix(32,32,(g,q)=>{
    g.fillStyle='#4a6741';g.fillRect(0,0,32,32);
    [[2,3,7,5],[19,2,9,4],[23,20,7,6],[3,22,7,5],[13,13,7,4]].forEach(([x,y,w,h])=>q(x,y,w,h,'#45603a'));
    [[6,9],[15,5],[23,11],[29,17],[4,15],[18,21],[27,26],[11,25],[9,29],[20,8]].forEach(([x,y])=>{
      q(x+1,y,1,3,'#567a49');q(x,y+1,1,2,'#3f5937');q(x+2,y+1,1,2,'#3f5937');});
    q(12,11,2,1,'#e6cf49');q(12,10,1,1,'#f4e07a');q(25,7,1,1,'#e8e0ec');q(7,20,2,1,'#d98ab0');q(7,19,1,1,'#e8a8c8');});
  SPR[',']=noiseTile('#5a4a3a',['#4f4133','#655342','#544539'],10);
  SPR[';']=noiseTile('#565c58',['#4b514d','#616a63','#3f4a44'],12);
  SPR[':']=noiseTile('#465239',['#3d4832','#525f43','#39432e'],16);
  SPR['P']=mkPix(32,32,(g,q)=>{
    g.fillStyle='#6f6b60';g.fillRect(0,0,32,32);
    [[1,1,7,6],[10,1,8,7],[20,2,6,5],[27,1,4,7],[2,9,6,7],[9,10,7,6],[18,9,7,7],[26,9,5,7],
     [1,17,7,6],[9,17,6,7],[16,18,8,6],[25,17,6,7],[2,25,8,6],[11,25,7,6],[19,25,7,6],[27,25,4,6]
    ].forEach(([x,y,w,h],i)=>{const c=['#8f8a7d','#87826f','#948f81','#83806f'][i%4];
      q(x,y,w,h,c);q(x,y,w,1,shade(c,0.13));q(x,y+h-1,w,1,shade(c,-0.22));q(x,y,1,h,shade(c,0.06));});});
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
  /* ---- biome grounds (snow / savanna / desert sand) ---- */
  SPR['s']=noiseTile('#e2e9f1',['#d1dbe6','#f2f6fa','#c6d0dc'],9);
  SPR['a']=noiseTile('#a89a4e',['#8f833c','#b8ab5e','#9c8f45'],14);
  SPR['d']=noiseTile('#d8c489',['#cbb677','#e6d6a0','#c9b06f'],8);
  /* ---- town wall (dressed stone), cactus, dungeon mouth ---- */
  SPR['K']=mk(32,32,(g,p)=>{g.fillStyle='#5b5f66';g.fillRect(0,0,32,32);
    for(let r=0;r<4;r++)for(let c2=0;c2<4;c2++){const off=r%2?2:0;
      p((c2*4+off)%16,r*4,3,3,'#666b73');p((c2*4+off)%16,r*4,3,1,'#7b818a');p((c2*4+off)%16,r*4+3,3,1,'#43464c');}
    p(0,0,16,1,'#8b929c');p(0,1,16,1,'#3a3d42');}); /* bright battlement cap + shadow line */
  SPR['k']=mk(32,32,(g,p)=>{g.drawImage(SPR['d'],0,0);
    p(6,4,3,10,'#3f7a3a');p(6,4,1,10,'#2f5c2c');p(6,4,3,1,'#5aa050');
    p(3,7,3,2,'#3f7a3a');p(3,5,2,3,'#3f7a3a');p(9,9,3,2,'#3f7a3a');p(11,7,2,3,'#3f7a3a');
    p(7,6,1,1,'#dfeecb');p(4,6,1,1,'#dfeecb');p(10,10,1,1,'#dfeecb');});
  SPR['D']=mk(32,32,(g,p)=>{
    p(1,3,14,13,'#57524b');p(1,3,14,1,'#655e54');p(1,15,14,1,'#3a3630');
    p(0,6,2,9,'#4c4841');p(14,6,2,9,'#4c4841');
    p(4,7,8,9,'#0d0b08');p(4,7,8,2,'#060504');p(5,6,6,1,'#3a3630');
    p(2,13,2,3,'#e8642c');p(2,12,1,1,'#ffb060');});
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
  SPR.pine=mk(32,48,(g,p)=>{
    p(7,17,2,7,'#4e3b29');p(6,22,4,2,'#42311f');
    p(4,4,8,10,'#2c4a44');p(6,1,4,4,'#2c4a44');p(2,8,12,5,'#2c4a44');
    p(5,5,3,3,'#3f6a5f');p(9,8,2,3,'#3f6a5f');p(3,10,3,2,'#22403a');
    p(3,4,10,2,'#e6f0f6');p(2,9,4,1,'#e6f0f6');p(10,10,3,1,'#e6f0f6');});
  SPR.crystal=mk(32,32,(g,p)=>{
    p(3,8,10,6,'#4c4841');p(2,11,12,3,'#44423f');p(3,8,10,1,'#5b5651');
    p(5,3,2,8,'#66e0ff');p(5,3,1,8,'#bfefff');
    p(8,5,2,7,'#7af0c9');p(8,5,1,5,'#c9fff0');
    p(3,7,2,4,'#9b7fd1');p(11,7,2,4,'#9b7fd1');});

  /* ---- player paper-doll (rebuilt whenever equipment changes) ---- */
  rebuildPlayerSprite();

  /* ---- biome mobs (detailed 1px art, feet ~y30; procedural bob/lunge in p6) ---- */
  /* ===== Whisperwood ===== */
  SPR.spider=mkPix(32,32,(g,q)=>{
    q(7,28,18,2,'#00000030');
    q(2,16,7,1,'#241d1a');q(1,13,3,3,'#241d1a');q(2,21,7,1,'#241d1a');q(1,23,3,3,'#241d1a');
    q(23,16,7,1,'#241d1a');q(28,13,3,3,'#241d1a');q(23,21,7,1,'#241d1a');q(28,23,3,3,'#241d1a');
    q(11,15,11,11,'#3a2f2a');q(12,16,9,8,'#48392f');q(11,15,11,1,'#55433a');
    q(11,9,10,7,'#3a2f2a');q(12,10,8,5,'#48392f');
    q(13,11,2,2,'#d94a3a');q(17,11,2,2,'#d94a3a');q(13,11,1,1,'#ff8a6a');q(17,11,1,1,'#ff8a6a');
    q(15,8,2,2,'#241d1a');});
  SPR.boar=mkPix(32,32,(g,q)=>{
    q(5,28,22,2,'#00000030');
    q(6,15,17,10,'#6e5442');q(7,16,15,6,'#7d6350');q(6,15,17,1,'#8a6f5a');q(3,17,4,7,'#5e4636');
    q(22,13,7,9,'#7d6350');q(23,14,5,5,'#8a6f5a');q(27,11,2,3,'#5e4636');
    q(28,17,3,3,'#8a6f5a');q(24,16,1,1,'#2b2b2b');q(27,20,1,2,'#e8e2c8');q(24,21,1,2,'#e8e2c8');
    q(9,17,10,2,'#5e4636');
    q(8,24,3,6,'#5e4636');q(13,24,3,6,'#6e5442');q(18,24,3,6,'#5e4636');
    q(8,29,3,1,'#463527');q(13,29,3,1,'#463527');q(18,29,3,1,'#463527');});
  SPR.bandit=mkPix(32,32,(g,q)=>{
    q(8,30,15,2,'#00000030');
    q(10,12,12,18,'#3a5233');q(11,13,10,16,'#46613d');q(10,12,12,1,'#557049');q(11,28,10,2,'#2c3f26');
    q(9,5,14,9,'#33482d');q(9,5,14,1,'#3f5735');q(11,9,10,5,'#160f12');
    q(13,10,3,2,'#e8e2c8');q(17,10,3,2,'#e8e2c8');q(14,10,1,1,'#2b2b2b');q(18,10,1,1,'#2b2b2b');
    q(7,14,3,10,'#33482d');q(23,14,3,10,'#33482d');
    q(26,6,1,18,'#8a6a42');q(25,6,1,3,'#8a6a42');q(25,21,1,3,'#8a6a42');q(28,9,1,12,'#d8d5c8');});
  /* ===== Frostpeak Mountains ===== */
  SPR.frost_wolf=mkPix(32,32,(g,q)=>{
    q(4,28,23,2,'#00000030');
    q(4,15,20,9,'#c9d6e2');q(5,16,18,5,'#dbe6f0');q(4,15,20,1,'#eef4fa');q(1,16,4,8,'#b3c2d2');
    q(21,10,8,9,'#dbe6f0');q(22,11,6,6,'#eef4fa');q(27,8,2,4,'#b3c2d2');q(24,8,2,3,'#b3c2d2');
    q(28,14,3,3,'#c9d6e2');q(26,13,2,2,'#66e0ff');q(30,15,1,1,'#2b2b2b');q(24,16,4,1,'#a6b6c8');
    q(6,23,3,7,'#a6b6c8');q(11,23,3,7,'#b3c2d2');q(17,23,3,7,'#a6b6c8');q(21,23,3,7,'#b3c2d2');
    q(6,29,3,1,'#8a9aac');q(11,29,3,1,'#8a9aac');q(17,29,3,1,'#8a9aac');q(21,29,3,1,'#8a9aac');});
  SPR.ice_sprite=mkPix(32,32,(g,q)=>{
    q(9,28,14,2,'#00000020');
    q(11,10,10,12,'#8fe0ff');q(12,11,8,9,'#bfefff');q(11,10,10,1,'#e6f9ff');
    q(13,6,6,6,'#8fe0ff');q(14,7,4,4,'#e6f9ff');
    q(13,13,2,2,'#1f6f9a');q(17,13,2,2,'#1f6f9a');
    q(8,14,3,1,'#c9fff0');q(21,14,3,1,'#c9fff0');q(15,3,1,3,'#c9fff0');
    q(9,20,2,5,'#8fe0ff');q(21,20,2,5,'#8fe0ff');q(15,22,2,6,'#8fe0ff');
    q(6,10,2,2,'#e6f9ff55');q(24,18,2,2,'#e6f9ff55');});
  SPR.snow_troll=mkPix(32,32,(g,q)=>{
    q(6,29,20,2,'#00000030');
    q(6,12,20,17,'#cdd8e2');q(7,13,18,14,'#dde7ef');q(6,12,20,1,'#eef4fa');
    q(2,14,5,11,'#b9c6d4');q(25,14,5,11,'#b9c6d4');
    q(9,6,14,9,'#cdd8e2');q(9,6,14,1,'#eef4fa');
    q(11,9,3,2,'#1f6f9a');q(18,9,3,2,'#1f6f9a');q(12,9,1,1,'#66e0ff');q(19,9,1,1,'#66e0ff');
    q(12,13,8,1,'#8a9aac');q(13,11,1,2,'#e8e2c8');q(18,11,1,2,'#e8e2c8');
    q(9,26,6,4,'#9fb0bd');q(17,26,6,4,'#9fb0bd');q(9,29,6,1,'#7f90a0');q(17,29,6,1,'#7f90a0');});
  /* ===== Golden Plains ===== */
  SPR.steppe_lion=mkPix(32,32,(g,q)=>{
    q(4,28,23,2,'#00000030');
    q(4,15,20,9,'#cba064');q(5,16,18,5,'#d8b078');q(4,15,20,1,'#e6c48e');q(2,22,3,6,'#a9793f');
    q(20,9,10,11,'#a9793f');q(22,11,7,8,'#d8b078');q(23,12,5,5,'#e6c48e');
    q(28,14,3,3,'#cba064');q(26,13,2,2,'#2b2b2b');q(30,15,1,1,'#2b2b2b');q(24,17,4,1,'#8a6a42');
    q(6,23,3,7,'#b98d52');q(11,23,3,7,'#cba064');q(17,23,3,7,'#b98d52');q(21,23,3,7,'#cba064');
    q(6,29,3,1,'#8a6a42');q(11,29,3,1,'#8a6a42');q(17,29,3,1,'#8a6a42');q(21,29,3,1,'#8a6a42');});
  SPR.war_hawk=mkPix(32,32,(g,q)=>{
    q(9,28,14,2,'#00000030');
    q(13,12,6,12,'#6e5236');q(14,13,4,9,'#7d6144');q(13,12,6,1,'#8a6f52');
    q(2,10,11,4,'#5e4630');q(3,9,8,2,'#6e5236');q(1,12,5,2,'#4e3826');
    q(19,10,11,4,'#5e4630');q(21,9,8,2,'#6e5236');q(26,12,5,2,'#4e3826');
    q(13,7,6,6,'#7d6144');q(14,8,4,4,'#8a6f52');
    q(14,9,1,2,'#f0c419');q(17,9,1,2,'#f0c419');q(15,11,2,2,'#e8b64c');q(15,12,2,1,'#c98b2c');
    q(14,24,2,4,'#e8b64c');q(17,24,2,4,'#e8b64c');});
  SPR.nomad=mkPix(32,32,(g,q)=>{
    q(8,30,15,2,'#00000030');
    q(9,11,14,19,'#b89a5e');q(10,12,12,17,'#c7aa6c');q(9,11,14,1,'#d6bb7e');q(10,28,12,2,'#8f7745');
    q(9,4,14,9,'#a98a4e');q(9,4,14,1,'#c7aa6c');q(11,8,10,5,'#2a2018');q(9,3,14,2,'#8f7745');
    q(12,9,3,2,'#e8e2c8');q(17,9,3,2,'#e8e2c8');q(13,9,1,1,'#2b2b2b');q(18,9,1,1,'#2b2b2b');
    q(7,13,3,10,'#a98a4e');q(23,13,3,10,'#a98a4e');
    q(26,4,2,24,'#6b5138');q(25,2,4,4,'#e8b64c');q(26,2,2,2,'#ffe98a');});
  /* ===== Ashen Desert ===== */
  SPR.scorpion=mkPix(32,32,(g,q)=>{
    q(6,28,20,2,'#00000030');
    q(9,18,14,7,'#b98d52');q(10,19,12,4,'#cba064');q(9,18,14,1,'#d8b078');
    q(3,16,5,2,'#a9793f');q(2,14,3,3,'#b98d52');q(1,15,2,2,'#8a6a42');
    q(24,16,5,2,'#a9793f');q(29,14,2,3,'#b98d52');
    q(9,25,2,4,'#8a6a42');q(13,25,2,4,'#8a6a42');q(17,25,2,4,'#8a6a42');
    q(22,14,2,4,'#b98d52');q(23,11,2,3,'#b98d52');q(24,9,2,3,'#cba064');q(24,7,3,2,'#d8b078');q(26,6,2,2,'#2b2320');
    q(12,19,1,1,'#2b2b2b');q(15,19,1,1,'#2b2b2b');});
  SPR.sand_wraith=mkPix(32,32,(g,q)=>{
    q(8,29,15,2,'#00000020');
    q(9,10,14,17,'#c9bfa0');q(10,11,12,15,'#d8cfb2');q(9,10,14,1,'#e6ddc2');
    q(11,25,2,4,'#c9bfa0');q(15,26,2,3,'#c9bfa0');q(19,25,2,4,'#c9bfa0');
    q(10,5,12,7,'#b8ac8a');q(10,5,12,1,'#d8cfb2');
    q(12,8,3,2,'#e8b64c');q(17,8,3,2,'#e8b64c');q(13,8,1,1,'#fff0a0');q(18,8,1,1,'#fff0a0');
    q(7,13,3,9,'#b8ac8a');q(22,13,3,9,'#b8ac8a');
    q(4,6,3,3,'#e8b64c33');q(25,17,3,3,'#e8b64c33');});
  SPR.dune_raider=mkPix(32,32,(g,q)=>{
    q(8,30,15,2,'#00000030');
    q(10,12,12,18,'#7a5a3a');q(11,13,10,16,'#8a6a45');q(10,12,12,1,'#9a7a52');q(11,28,10,2,'#5e4630');
    q(9,5,14,9,'#6b4e33');q(9,5,14,1,'#8a6a45');q(11,9,10,4,'#1c130c');q(9,4,14,2,'#5e4630');
    q(13,10,3,2,'#e8e2c8');q(17,10,3,2,'#e8e2c8');q(14,10,1,1,'#2b2b2b');q(18,10,1,1,'#2b2b2b');
    q(7,14,3,10,'#6b4e33');q(23,14,3,10,'#6b4e33');
    q(26,6,1,18,'#8a6a42');q(25,6,1,3,'#8a6a42');q(25,21,1,3,'#8a6a42');q(28,9,1,12,'#d8d5c8');});

  /* ---- dungeon semi-bosses (elite, normal size, name bar in p6) ---- */
  SPR.spider_matron=mkPix(32,32,(g,q)=>{
    q(5,29,22,2,'#00000030');
    q(1,15,7,1,'#241d1a');q(0,12,3,3,'#241d1a');q(1,22,7,1,'#241d1a');q(0,24,3,3,'#241d1a');
    q(24,15,7,1,'#241d1a');q(29,12,3,3,'#241d1a');q(24,22,7,1,'#241d1a');q(29,24,3,3,'#241d1a');
    q(9,15,14,12,'#332824');q(10,16,12,9,'#443229');q(9,15,14,1,'#55433a');q(12,17,8,5,'#7a3f8a');
    q(11,9,10,8,'#332824');q(12,10,8,6,'#443229');
    q(12,11,2,2,'#d94a3a');q(18,11,2,2,'#d94a3a');q(12,11,1,1,'#ff8a6a');q(18,11,1,1,'#ff8a6a');
    q(14,8,4,2,'#241d1a');q(13,16,1,1,'#b06fd1');q(18,16,1,1,'#b06fd1');});
  SPR.ice_warden=mkPix(32,32,(g,q)=>{
    q(8,30,15,2,'#00000030');
    q(8,11,16,19,'#2f5a72');q(9,12,14,17,'#376a86');q(8,11,16,1,'#4a86a6');q(9,28,14,2,'#204152');
    q(10,3,12,10,'#bfefff');q(10,3,12,1,'#e6f9ff');
    q(12,7,3,3,'#1f6f9a');q(17,7,3,3,'#1f6f9a');q(13,8,1,1,'#66e0ff');q(18,8,1,1,'#66e0ff');
    q(13,11,6,1,'#171512');q(6,13,3,12,'#2f5a72');q(23,13,3,12,'#2f5a72');
    q(11,1,10,3,'#8fe0ff');q(14,0,4,2,'#e6f9ff');
    q(27,1,2,27,'#4a6a7a');q(25,0,6,5,'#8fe0ff');q(27,1,2,2,'#e6f9ff');});
  SPR.barrow_wight=mkPix(32,32,(g,q)=>{
    q(8,30,15,2,'#00000030');
    q(8,11,16,19,'#33403a');q(9,12,14,17,'#3e4d45');q(8,11,16,1,'#4c5c52');q(9,28,14,2,'#232c27');
    q(10,4,12,9,'#8a9a86');q(10,4,12,1,'#a2b2a0');
    q(12,8,3,3,'#171512');q(17,8,3,3,'#171512');q(13,9,1,1,'#9bffb0');q(18,9,1,1,'#9bffb0');
    q(13,12,6,1,'#171512');q(13,12,1,1,'#8a9a86');q(16,12,1,1,'#8a9a86');
    q(6,13,3,11,'#33403a');q(23,13,3,11,'#33403a');q(7,14,2,3,'#8a9a86');q(24,14,2,3,'#8a9a86');
    q(10,2,12,3,'#5a6a3a');q(13,1,6,2,'#6a7a45');
    q(27,3,2,25,'#3a3020');q(25,1,5,5,'#9bffb055');});
  SPR.tomb_guardian=mkPix(32,32,(g,q)=>{
    q(8,30,15,2,'#00000030');
    q(9,25,4,6,'#3a2f1a');q(19,25,4,6,'#3a2f1a');
    q(9,13,14,13,'#b8912c');q(10,14,12,10,'#d0a83a');q(9,13,14,1,'#e6c451');
    q(9,17,14,2,'#2b3a5a');q(9,21,14,1,'#2b3a5a');q(6,14,3,10,'#a07f26');q(23,14,3,10,'#a07f26');
    q(11,4,10,10,'#0f0d0a');q(10,4,12,1,'#d0a83a');q(9,2,4,5,'#d0a83a');q(19,2,4,5,'#d0a83a');
    q(13,9,2,2,'#e8642c');q(17,9,2,2,'#e8642c');q(12,12,8,2,'#2b3a5a');q(12,13,8,1,'#e6c451');});

  /* ---- dungeon bosses (big 2× sprite, see draw()) ---- */
  SPR.bandit_king=mkPix(32,32,(g,q)=>{
    q(7,30,18,2,'#00000030');
    q(9,25,5,6,'#2c3f26');q(18,25,5,6,'#2c3f26');q(9,30,5,1,'#1f2c1a');q(18,30,5,1,'#1f2c1a');
    q(8,15,16,11,'#5a2f2f');q(9,16,14,8,'#6e3a3a');q(8,15,16,1,'#864545');
    q(8,19,16,2,'#3a2a1a');q(15,20,2,1,'#e8b64c');q(5,16,4,9,'#4a2626');q(23,16,4,9,'#4a2626');
    q(9,6,14,10,'#c99b6a');q(9,6,14,1,'#d8ac7c');
    q(11,10,4,3,'#2b2b2b');q(17,10,4,3,'#2b2b2b');q(12,11,1,2,'#e8642c');q(18,11,1,2,'#e8642c');
    q(11,14,10,1,'#6e4b33');q(10,15,12,2,'#5e3f2a');
    q(9,1,14,5,'#f0c419');q(9,1,14,1,'#ffe98a');q(10,0,2,2,'#f0c419');q(15,0,2,2,'#f0c419');q(20,0,2,2,'#f0c419');q(15,2,2,2,'#d94a3a');
    q(24,14,2,14,'#cbd0d8');q(24,14,1,14,'#eef1f5');q(23,26,4,2,'#8a6a42');});
  SPR.frost_giant=mkPix(32,32,(g,q)=>{
    q(5,30,22,2,'#00000030');
    q(6,11,20,18,'#c2d2e2');q(7,12,18,15,'#d6e3ef');q(6,11,20,1,'#eef5fb');
    q(1,13,6,13,'#aec0d2');q(25,13,6,13,'#aec0d2');
    q(9,4,14,10,'#c2d2e2');q(9,4,14,1,'#eef5fb');q(8,2,4,4,'#bfefff');q(20,2,4,4,'#bfefff');
    q(11,7,3,3,'#1f6f9a');q(18,7,3,3,'#1f6f9a');q(12,8,1,1,'#66e0ff');q(19,8,1,1,'#66e0ff');
    q(11,12,10,1,'#8497aa');q(12,10,1,3,'#e8f2fa');q(19,10,1,3,'#e8f2fa');
    q(9,26,7,4,'#9fb0bd');q(17,26,7,4,'#9fb0bd');q(9,29,7,1,'#7f90a0');q(17,29,7,1,'#7f90a0');});
  SPR.plains_warlord=mkPix(32,32,(g,q)=>{
    q(6,30,20,2,'#00000030');
    q(9,25,5,6,'#4a3a2a');q(18,25,5,6,'#4a3a2a');q(9,30,5,1,'#332619');q(18,30,5,1,'#332619');
    q(7,13,18,13,'#8a5a3a');q(8,14,16,10,'#a06a44');q(7,13,18,1,'#b87a50');
    q(7,17,18,2,'#c98b2c');q(14,15,4,6,'#c98b2c');q(3,14,5,11,'#6e4a30');q(24,14,5,11,'#6e4a30');
    q(9,5,14,9,'#b8895c');q(9,5,14,1,'#c99b6a');
    q(11,9,3,2,'#2b2b2b');q(18,9,3,2,'#2b2b2b');q(12,10,1,1,'#e8642c');q(19,10,1,1,'#e8642c');
    q(11,13,10,1,'#5e3f2a');q(8,1,16,5,'#7d8590');q(8,1,16,1,'#9aa4ad');q(14,0,4,2,'#c94a3a');
    q(2,8,3,18,'#8a6a42');q(0,6,6,4,'#b8c4cf');q(0,6,6,1,'#d8e0e8');});
  SPR.sand_pharaoh=mkPix(32,32,(g,q)=>{
    q(7,30,18,2,'#00000030');
    q(8,13,16,17,'#c9a83a');q(9,14,14,14,'#dcc04e');q(8,13,16,1,'#efd66a');q(9,28,14,2,'#a07f26');
    q(8,17,16,2,'#2b3a6a');q(8,21,16,1,'#2b3a6a');
    q(10,4,12,10,'#0f0d0a');q(9,4,14,1,'#e6c451');
    q(12,8,3,3,'#66e0ff');q(17,8,3,3,'#66e0ff');q(13,9,1,1,'#c9f5ff');q(18,9,1,1,'#c9f5ff');
    q(13,12,6,1,'#171512');
    q(7,3,4,12,'#dcc04e');q(21,3,4,12,'#dcc04e');q(7,3,4,1,'#efd66a');q(21,3,4,1,'#efd66a');
    q(9,1,14,4,'#dcc04e');q(9,1,14,1,'#efd66a');q(14,0,4,2,'#2b3a6a');q(15,4,2,2,'#e8642c');
    q(6,14,3,11,'#a07f26');q(23,14,3,11,'#a07f26');
    q(27,1,2,27,'#7a5a2a');q(25,0,6,5,'#66e0ff');q(27,1,2,2,'#c9f5ff');});
  /* ---- NPCs (detailed animated humanoids) ---- */
  buildNpcSprites();
  /* ---- misc ---- */
  SPR.gravestone=mk(32,32,(g,p)=>{
    p(4,6,8,9,'#7d7a72');p(5,4,6,3,'#7d7a72');p(5,5,6,1,'#8a877f');
    p(6,8,4,1,'#5f5c55');p(6,10,4,1,'#5f5c55');p(3,14,10,1,'#4c4841');});
  SPR.coins=mk(32,32,(g,p)=>{
    p(5,10,3,2,'#f0c419');p(8,11,3,2,'#e0b410');p(6,8,3,2,'#f0d45a');p(7,9,1,1,'#fff0a0');});

  /* ---- oblique buildings (generated per footprint) ---- */
  for(const mid in world)for(const b of (world[mid].buildings||[]))b.spr=mkBuilding(b);
}

/* ---------- paper-doll: detailed, animated player from current gear --------
   Higher-res (1px art, 32x44) and pose-driven: returns a set of frames
   {stand, walk1, walk2, atk} that the renderer cycles by movement/combat. */
const CHAR_H=44, CHAR_FOOT=42;   // sprite height + foot row (anchor in p6)
function rebuildPlayerSprite(){
  const gearOf=slot=>P.gear[slot]&&GEAR[P.gear[slot].id]?GEAR[P.gear[slot].id]:null;
  const w=gearOf('weapon'),sh=gearOf('shield'),he=gearOf('helmet'),
        bo=gearOf('body'),le=gearOf('legs');
  const capePc=P.gear.cape,cape=capePc&&CAPES[capePc.id]?CAPES[capePc.id]:null;
  const skin='#e2b485',skinD='#b9895c',hair='#6e4f2a';
  const legC=le?le.color:'#43372a',legD=shade(legC,-0.32);
  const bodC=bo?bo.color:'#7c5436',bodL=shade(bodC,0.17),bodD=shade(bodC,-0.3);
  const line=w?w.line:'m';
  function leg(q,x,lift,c,boot){
    const top=30,len=12-lift;
    q(x,top,4,len-2,c);q(x,top,4,1,shade(c,0.16));q(x,top+len-2,4,3,boot);
  }
  function weapon(q,hx,hy,atk){
    if(!w)return;
    const c=w.color;
    if(line==='m'){ /* sword */
      if(atk){q(hx-1,hy-2,5,2,'#8a6a42');q(hx,hy-9,2,8,'#cfd4dc');q(hx+1,hy-10,2,9,shade('#cfd4dc',0.3));}
      else{q(hx,hy,2,13,'#cbd0d8');q(hx,hy,2,1,'#eef1f5');q(hx-1,hy+12,4,2,'#8a6a42');q(hx,hy+14,2,3,'#5b4632');}
    }else if(line==='r'){ /* bow */
      q(hx+1,hy-3,2,17,'#8a6a42');q(hx,hy-3,1,4,'#8a6a42');q(hx,hy+11,1,4,'#8a6a42');
      q(hx+3,hy-1,1,13,'#d8d5c8');if(atk){q(hx-3,hy+5,6,1,'#d8d5c8');q(hx-3,hy+4,1,3,'#c7ccd4');}
    }else{ /* staff */
      q(hx+1,hy-3,2,18,'#8a6a42');q(hx,hy-7,4,4,c);q(hx+1,hy-6,2,2,shade(c,0.4));
      if(atk){q(hx-1,hy-9,6,6,c+'99');q(hx,hy-8,4,4,c+'cc');}
    }
  }
  function frame(pose){
   const A=pose.a||[0,0],B=pose.b||[0,0],atk=pose.atk||0;
   return mkPix(32,CHAR_H,(g,q)=>{
    q(9,41,15,2,'#00000030');                                  /* shadow */
    if(cape){const c=cape.color;                               /* cape */
      q(10,15,13,21,shade(c,-0.3));q(11,15,11,20,c);
      q(12,16,1,18,shade(c,-0.45));q(20,17,1,17,shade(c,-0.18));}
    leg(q,12+A[0],A[1],legD,'#241b12');                        /* back leg */
    leg(q,17+B[0],B[1],legC,'#33281c');                        /* front leg */
    q(9,17,15,14,bodD);q(10,18,13,12,bodC);q(10,18,13,2,bodL); /* torso */
    q(9,26,15,2,shade(bodC,-0.44));q(15,27,2,1,'#caa24a');     /* belt + buckle */
    if(bo&&bo.line==='g'){q(9,30,15,7,bodC);q(9,36,15,1,bodD);}/* robe skirt */
    q(6,18,4,10,bodD);q(6,26,4,3,skinD);                       /* back arm */
    q(14,15,5,3,skinD);                                        /* neck */
    q(11,5,11,11,skin);q(11,5,11,1,shade(skin,0.18));q(11,14,11,2,skinD);
    if(he){const hc=he.color,hl=shade(hc,0.28),hd=shade(hc,-0.3);
      if(he.line==='m'){q(10,3,13,5,hc);q(10,3,13,1,hl);q(10,7,2,6,hc);q(21,7,2,6,hc);q(14,6,5,2,hd);}
      else if(he.line==='r'){q(11,3,11,3,hc);q(10,5,2,7,hc);q(21,5,2,7,hc);q(11,3,11,1,hl);}
      else{q(10,4,13,2,hc);q(13,2,7,2,hc);q(15,1,3,1,hl);q(11,5,11,1,hd);}
    }else{q(11,3,11,3,hair);q(10,5,2,6,hair);q(20,4,2,4,hair);q(11,3,11,1,shade(hair,0.2));}
    q(16,10,2,2,'#2b2b2b');q(20,10,2,2,'#2b2b2b');q(21,12,1,2,skinD);q(16,13,4,1,skinD);
    if(atk){q(21,16,4,4,bodC);q(24,16,3,3,skin);weapon(q,25,17,1);} /* front arm raised */
    else{q(21,18,4,9,bodC);q(21,26,4,3,skin);weapon(q,23,16,0);}   /* front arm at side */
    if(sh){const sc=sh.color;q(4,18,5,11,sc);q(4,18,5,1,shade(sc,0.3));
      q(5,21,3,4,shade(sc,-0.28));q(4,28,5,1,shade(sc,-0.45));}
   });
  }
  SPR.player={stand:frame({}),walk1:frame({a:[-1,0],b:[2,2]}),
              walk2:frame({a:[2,2],b:[-1,0]}),atk:frame({a:[-1,0],b:[1,0],atk:1})};
}

/* ---------- townsfolk: same higher-res humanoid, per-role, animated ------ */
const NPC_LOOK={
  banker:     {body:'#3f6a8f',hair:'#4a3222',robe:1},
  smith:      {body:'#6b4a33',hair:'#2f2118',skin:'#d09a6e',prop:'hammer',apron:1},
  elder:      {body:'#6a6079',hair:'#dcd7c8',beard:'#dcd7c8',robe:1,prop:'staff',propC:'#cbd0d8'},
  guard:      {body:'#5c7a4a',hat:'#b8c4cf',helm:1,prop:'spear'},
  skillmaster:{body:'#b0862c',cape:'#9b5fb0',hair:'#5a4630',robe:1,trim:'#e8c451'},
};
function mkHumanoid(o,pose){
  const A=pose.a||[0,0],B=pose.b||[0,0];
  const skin=o.skin||'#e2b485',skinD=shade(skin,-0.2);
  const bod=o.body,bodL=shade(bod,0.16),bodD=shade(bod,-0.3);
  const legC=o.legs||shade(bod,-0.42),legD=shade(legC,-0.3);
  return mkPix(32,CHAR_H,(g,q)=>{
    q(9,41,15,2,'#00000030');
    if(o.cape){q(10,15,13,21,shade(o.cape,-0.3));q(11,15,11,20,o.cape);}
    const L=(x,lift,c,boot)=>{const len=12-lift;q(x,30,4,len-2,c);q(x,30,4,1,shade(c,0.15));q(x,30+len-2,4,3,boot);};
    L(12+A[0],A[1],legD,'#241b12');L(17+B[0],B[1],legC,'#33281c');
    q(9,17,15,14,bodD);q(10,18,13,12,bod);q(10,18,13,2,bodL);q(9,26,15,2,shade(bod,-0.44));
    if(o.trim)q(9,26,15,1,o.trim);
    if(o.apron){q(11,20,11,10,'#4a3323');q(11,20,11,1,'#5c4230');}
    if(o.robe){q(9,30,15,8,bod);q(9,37,15,1,bodD);}
    q(6,18,4,10,bodD);q(6,26,4,3,skinD);
    q(14,15,5,3,skinD);q(11,5,11,11,skin);q(11,5,11,1,shade(skin,0.18));q(11,14,11,2,skinD);
    if(o.hat){const hc=o.hat;q(10,3,13,4,hc);q(10,3,13,1,shade(hc,0.25));
      if(o.helm){q(10,6,2,6,hc);q(21,6,2,6,hc);q(14,6,5,2,shade(hc,-0.25));}}
    else if(o.hair){q(11,3,11,3,o.hair);q(10,5,2,6,o.hair);q(20,4,2,4,o.hair);q(11,3,11,1,shade(o.hair,0.2));}
    if(o.beard){q(11,13,11,4,o.beard);q(12,17,9,2,o.beard);q(15,16,3,2,skin);}
    q(16,10,2,2,'#2b2b2b');q(20,10,2,2,'#2b2b2b');
    q(21,18,4,9,bod);q(21,26,4,3,skin);
    if(o.prop==='hammer'){q(24,15,2,9,'#6e4f2a');q(22,12,6,4,'#7d8590');q(22,12,6,1,'#9aa4ad');}
    else if(o.prop==='staff'){q(24,7,2,23,'#8a6a42');q(23,5,4,3,o.propC||'#cbd0d8');q(24,5,2,1,'#eef1f5');}
    else if(o.prop==='spear'){q(24,3,2,27,'#8a6a42');q(23,1,4,4,'#c7ccd4');q(24,1,2,1,'#eef1f5');}
  });
}
function buildNpcSprites(){
  for(const id in NPC_LOOK){const o=NPC_LOOK[id];
    SPR['npc_'+id]={stand:mkHumanoid(o,{}),walk1:mkHumanoid(o,{a:[-1,0],b:[2,2]}),walk2:mkHumanoid(o,{a:[2,2],b:[-1,0]})};}
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

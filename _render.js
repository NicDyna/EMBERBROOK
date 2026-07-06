/* Dev-only headless renderer: runs game.js with real (node-canvas) canvases
   via jsdom and writes PNGs, so sprites/scenes can be inspected without a
   browser. Usage: node _render.js  (outputs to the path in OUT). Not served. */
const fs=require('fs');
const {JSDOM}=require('jsdom');
const OUT=process.argv[2]||'.';
let html=fs.readFileSync(__dirname+'/static/index.html','utf8');
const game=fs.readFileSync(__dirname+'/static/game.js','utf8');
html=html.replace(/<script src="\/game\.js[^"]*"><\/script>/,'<script>'+game+'</script>');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/',
  beforeParse(window){
    window.fetch=()=>Promise.reject(new Error('offline'));
    Object.defineProperty(window,'innerWidth',{value:760,configurable:true});
    Object.defineProperty(window,'innerHeight',{value:1080,configurable:true});
    Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});
  }});
const w=dom.window,doc=w.document;
function save(name,canvas){
  const url=canvas.toDataURL('image/png');
  fs.writeFileSync(OUT+'/'+name,Buffer.from(url.split(',')[1],'base64'));
  console.log('wrote',name,canvas.width+'x'+canvas.height);
}
/* draw a labelled, zoomed sheet of [label, canvas] pairs */
function sheet(name,items,zoom,cols){
  zoom=zoom||5;cols=cols||items.length;
  let mw=0,mh=0;items.forEach(([l,s])=>{if(s){mw=Math.max(mw,s.width);mh=Math.max(mh,s.height);}});
  const pad=12,lab=16,cw=mw*zoom+pad,ch=mh*zoom+pad+lab;
  const rows=Math.ceil(items.length/cols);
  const c=doc.createElement('canvas');c.width=cw*cols;c.height=ch*rows;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.fillStyle='#20242a';g.fillRect(0,0,c.width,c.height);
  items.forEach(([label,spr],i)=>{
    if(!spr)return;
    const cx=(i%cols)*cw,cy=Math.floor(i/cols)*ch;
    g.fillStyle='#2c313a';g.fillRect(cx+3,cy+3,cw-6,ch-lab-3);
    const dw=spr.width*zoom,dh=spr.height*zoom;
    g.drawImage(spr,cx+(cw-dw)/2,cy+3+((ch-lab-6)-dh)/2,dw,dh);
    g.fillStyle='#e8dcc3';g.font='11px sans-serif';g.textAlign='center';
    g.fillText(label,cx+cw/2,cy+ch-5);
  });
  save(name,c);
}
setTimeout(()=>{
 try{
  const EB=w.EB;
  w.eval('resize()');
  EB.P.map='town';EB.P.tx=25;EB.P.ty=18;EB.P.px=25*32;EB.P.py=18*32;EB.P.path=[];EB.P.moving=null;
  w.eval('update(16)');w.eval('draw()');
  save('scene.png',doc.getElementById('cv'));
  const S=w.eval('SPR');
  const pf=S.player;
  if(pf&&pf.stand){sheet('player.png',[['stand',pf.stand],['walk1',pf.walk1],['walk2',pf.walk2],['atk',pf.atk]],7,4);}
  const one=s=>(s&&s.nodeName)?s:(s&&(s.stand||Object.values(s)[0]));
  const chars=[['player',one(pf)]];
  ['banker','smith','elder','guard','skillmaster'].forEach(n=>chars.push([n,one(S['npc_'+n])]));
  ['goblin','wolf','rat','skeleton','cultist','gargoyle','bogstalker','hagspawn'].forEach(n=>chars.push([n,S[n]]));
  ['goblin_king','rock_horror','lich','swamp_hag'].forEach(n=>chars.push([n,S[n]]));
  sheet('chars.png',chars,6,6);
  console.log('DONE');
 }catch(e){console.log('ERR',e&&e.stack||e);}
 process.exit(0);
},800);

/* p2: world data — resources, mobs (styles + loot tables), bosses,
       NPCs, quests, dailies, the five maps, world builder, pathfinding */

/* ---------------- gatherable resources ---------------- */
const RES={
  T:{name:'Tree',skill:'woodcutting',lvl:1,xp:12,item:'logs',time:2200,respawn:6000,hp:3},
  O:{name:'Oak',skill:'woodcutting',lvl:5,xp:26,item:'oak_logs',time:2800,respawn:9000,hp:4},
  C:{name:'Copper Rock',skill:'mining',lvl:1,xp:14,item:'copper_ore',time:2400,respawn:7000,hp:3},
  I:{name:'Iron Rock',skill:'mining',lvl:8,xp:30,item:'iron_ore',time:3000,respawn:10000,hp:4},
};

/* ---------------- loot table helpers ----------------
   entries: {w, gold:[min,max]} | {w, item, q:[min,max]}
          | {w, gear:{line?, tierMin, tierMax}}  (line omitted = random)
   Boss tables get rarityBoost + a guaranteed roll. */
function lootRoll(table){
  const tot=table.reduce((a,e)=>a+e.w,0);
  let r=Math.random()*tot;
  for(const e of table){r-=e.w;if(r<0)return e;}
  return table[0];
}

/* ---------------- mobs ----------------
   style: 'melee'|'ranged'|'magic' (combat triangle:
   melee beats ranged beats magic beats melee) */
const MOBS={
  goblin:{name:'Goblin',lvl:3,hp:12,style:'melee',acc:6,pow:4,def:3,spd:2600,range:1,
    aggro:false,xp:22,gold:[3,9],
    loot:[{w:50,gold:[3,9]},{w:18,item:'bone',q:[1,1]},{w:10,item:'bread',q:[1,1]},
          {w:8,item:'arrows',q:[4,10]},{w:8,gear:{tierMin:1,tierMax:2}},{w:6,item:'cooked_meat',q:[1,1]}]},
  wolf:{name:'Wolf',lvl:6,hp:20,style:'melee',acc:9,pow:6,def:5,spd:2200,range:1,
    aggro:true,xp:34,gold:[0,0],
    loot:[{w:46,item:'wolf_pelt',q:[1,1]},{w:22,item:'cooked_meat',q:[1,2]},
          {w:20,item:'bone',q:[1,2]},{w:12,gear:{tierMin:1,tierMax:2}}]},
  rat:{name:'Cave Rat',lvl:4,hp:16,style:'melee',acc:7,pow:5,def:4,spd:2400,range:1,
    aggro:false,xp:26,gold:[2,6],
    loot:[{w:52,gold:[2,6]},{w:22,item:'bone',q:[1,1]},{w:14,gear:{tierMin:1,tierMax:2}},
          {w:12,item:'runes',q:[3,8]}]},
  skeleton:{name:'Skeleton Archer',lvl:10,hp:26,style:'ranged',acc:12,pow:8,def:7,spd:2800,range:4,
    aggro:true,xp:52,gold:[5,14],
    loot:[{w:34,gold:[5,14]},{w:22,item:'arrows',q:[8,20]},{w:16,item:'bone',q:[1,3]},
          {w:16,gear:{tierMin:2,tierMax:3}},{w:12,item:'iron_ore',q:[1,1]}]},
  cultist:{name:'Cultist',lvl:16,hp:34,style:'magic',acc:16,pow:11,def:9,spd:2800,range:4,
    aggro:true,xp:74,gold:[8,20],
    loot:[{w:30,gold:[8,20]},{w:22,item:'runes',q:[6,16]},{w:18,item:'ancient_dust',q:[1,2]},
          {w:18,gear:{tierMin:2,tierMax:4}},{w:12,item:'meat_pie',q:[1,1]}]},
  gargoyle:{name:'Gargoyle',lvl:24,hp:52,style:'melee',acc:22,pow:15,def:16,spd:2600,range:1,
    aggro:true,xp:120,gold:[12,30],
    loot:[{w:30,gold:[12,30]},{w:22,item:'ancient_dust',q:[1,3]},{w:20,gear:{tierMin:3,tierMax:5}},
          {w:16,item:'gem',q:[1,1]},{w:12,item:'iron_ore',q:[1,2]}]},
  bogstalker:{name:'Bog Stalker',lvl:32,hp:66,style:'ranged',acc:28,pow:19,def:20,spd:2600,range:4,
    aggro:true,xp:170,gold:[16,40],
    loot:[{w:28,gold:[16,40]},{w:24,item:'swamp_herb',q:[1,3]},{w:20,gear:{tierMin:4,tierMax:5}},
          {w:16,item:'arrows',q:[15,35]},{w:12,item:'stew',q:[1,1]}]},
  hagspawn:{name:'Hag Spawn',lvl:38,hp:78,style:'magic',acc:34,pow:23,def:24,spd:2800,range:4,
    aggro:true,xp:220,gold:[20,50],
    loot:[{w:26,gold:[20,50]},{w:24,item:'runes',q:[12,28]},{w:20,gear:{tierMin:4,tierMax:6}},
          {w:18,item:'swamp_herb',q:[2,4]},{w:12,item:'gem',q:[1,1]}]},
  /* ------- zone bosses: big sprite, best loot, ~5 min respawn ------- */
  goblin_king:{name:'Goblin King',lvl:12,hp:90,style:'melee',acc:16,pow:11,def:10,spd:2400,range:1,
    aggro:true,xp:300,gold:[40,90],boss:true,respawn:300000,rarityBoost:2,
    loot:[{w:40,gear:{tierMin:2,tierMax:3}},{w:30,gold:[40,90]},{w:18,item:'meat_pie',q:[1,2]},
          {w:12,item:'gem',q:[1,1]}]},
  rock_horror:{name:'Rock Horror',lvl:22,hp:150,style:'melee',acc:24,pow:16,def:20,spd:2800,range:1,
    aggro:true,xp:520,gold:[70,150],boss:true,respawn:300000,rarityBoost:2,
    loot:[{w:40,gear:{tierMin:3,tierMax:4}},{w:28,gold:[70,150]},{w:18,item:'gem',q:[1,2]},
          {w:14,item:'iron_ore',q:[2,4]}]},
  lich:{name:'Lich Ardun',lvl:36,hp:230,style:'magic',acc:38,pow:26,def:26,spd:2600,range:5,
    aggro:true,xp:900,gold:[120,260],boss:true,respawn:300000,rarityBoost:3,
    loot:[{w:42,gear:{tierMin:4,tierMax:6}},{w:26,gold:[120,260]},{w:18,item:'ancient_dust',q:[3,6]},
          {w:14,item:'runes',q:[20,40]}]},
  swamp_hag:{name:'The Swamp Hag',lvl:46,hp:320,style:'magic',acc:48,pow:32,def:34,spd:2600,range:5,
    aggro:true,xp:1400,gold:[200,420],boss:true,respawn:300000,rarityBoost:3,
    loot:[{w:44,gear:{tierMin:5,tierMax:6}},{w:24,gold:[200,420]},{w:18,item:'gem',q:[1,3]},
          {w:14,item:'swamp_herb',q:[3,6]}]},
};

/* ---------------- NPCs & dialogue ---------------- */
const NPCS={
  banker:{name:'Banker Mira',role:'bank'},
  smith:{name:'Smith Torvald',role:'shop'},
  elder:{name:'Elder Rowan',role:'quests'},
  guard:{name:'Guard Bram',role:'chat',lines:["Stay on the roads, traveller.",
    "The ruins north of the forest... nothing good comes from there.",
    "They say the swamp hag hoards treasures beyond counting."]},
  skillmaster:{name:'Master Aldric',role:'capes'},
};

/* ---------------- quests ---------------- */
const QUESTS={
  fresh:{name:'Fresh Timber',giver:'elder',desc:'Chop 3 logs for the town stockpile.',
    kind:'gather',item:['logs'],need:3,reward:{gold:30,xp:{woodcutting:40}}},
  ore:{name:'Copper for the Forge',giver:'smith',desc:'Mine 3 copper ore for Torvald.',
    kind:'gather',item:['copper_ore'],need:3,reward:{gold:35,xp:{mining:45}}},
  goblins:{name:'Goblin Trouble',giver:'guard',desc:'Slay 4 goblins in Whisper Forest.',
    kind:'kill',mob:['goblin'],need:4,reward:{gold:60,xp:{attack:40,strength:40}}},
  iron:{name:'Iron Will',giver:'smith',desc:'Bring 2 iron ore from the deep mines.',
    kind:'gather',item:['iron_ore'],need:2,reward:{gold:90,xp:{mining:90},gear:{id:'g_m_2_weapon',r:1}}},
  bones:{name:'Restless Dead',giver:'elder',desc:'Destroy 3 skeletons in the mines.',
    kind:'kill',mob:['skeleton'],need:3,reward:{gold:120,xp:{defence:80},gear:{id:'g_m_2_body',r:1}}},
  lichbane:{name:'The Lich of the Ruins',giver:'elder',desc:'Defeat Lich Ardun in the Sunken Ruins.',
    kind:'kill',mob:['lich'],need:1,reward:{gold:600,xp:{magic:300,defence:200}}},
  hagsend:{name:"The Hag's End",giver:'elder',desc:'Slay the Swamp Hag and free the marsh.',
    kind:'kill',mob:['swamp_hag'],need:1,reward:{gold:1500,xp:{attack:300,strength:300,ranged:300}}},
};
const QUEST_ORDER=['fresh','ore','goblins','iron','bones','lichbane','hagsend'];

/* ---------------- daily task pool ---------------- */
const DAILY_POOL=[
  {id:'d_logs',desc:'Chop 10 logs',kind:'gather',item:['logs','oak_logs'],need:10,gold:40},
  {id:'d_ore',desc:'Mine 8 ore',kind:'gather',item:['copper_ore','iron_ore'],need:8,gold:45},
  {id:'d_kill',desc:'Defeat 6 monsters',kind:'kill',mob:null,need:6,gold:50},
  {id:'d_gob',desc:'Slay 4 goblins',kind:'kill',mob:['goblin'],need:4,gold:40},
  {id:'d_gold',desc:'Earn 150 gold',kind:'gold',need:150,gold:60},
  {id:'d_skel',desc:'Destroy 3 skeletons',kind:'kill',mob:['skeleton'],need:3,gold:55},
  {id:'d_ranged',desc:'Land 15 ranged or magic kills or hits',kind:'stylehit',need:15,gold:55},
  {id:'d_boss',desc:'Defeat any zone boss',kind:'kill',mob:['goblin_king','rock_horror','lich','swamp_hag'],need:1,gold:120},
  {id:'d_ruins',desc:'Defeat 5 monsters in the ruins',kind:'killmap',map:'ruins',need:5,gold:70},
  {id:'d_swamp',desc:'Defeat 5 monsters in the swamp',kind:'killmap',map:'swamp',need:5,gold:90},
];

/* ---------------- maps ----------------
   Tiles: . grass  , cave floor  ; ruin floor  : swamp floor
   X rock wall  # cave wall  F forest edge  U ruin wall  S swamp edge
   R roof  W bank  P path  E exit marker  Q quest board  M monument
   G gravestone-decor  A skillmaster porch  T/O/C/I resources  ~ water */
const MAPS={
 /* Emberbrook — modelled on the old town of St. Vith: an egg-shaped ring wall
    (wide + rounded to the north, tapering to a point at the south where the
    Büchelturm stands), the Hauptstraße spine running N→S, and St-Vitus church
    east of it. Grid + streets + gates are generated by buildTownGrid below;
    'B' = building footprint (blocked, drawn as an oblique billboard in p6). */
 town:{name:'Emberbrook',ground:'.',w:40,h:36,spawn:[20,17],rows:[],
  buildings:[
   {x:9, y:4, w:3,d:3,type:'house_a'},
   {x:14,y:4, w:4,d:3,type:'house_c',label:'BÄCKEREI'},
   {x:24,y:4, w:4,d:3,type:'house_b'},
   {x:29,y:4, w:3,d:3,type:'house_a'},
   {x:8, y:9, w:4,d:3,type:'bank',  label:'BANK'},
   {x:23,y:9, w:5,d:5,type:'church',label:'ST-VITUS'},
   {x:30,y:9, w:3,d:3,type:'house_c'},
   {x:8, y:16,w:4,d:3,type:'house_a'},
   {x:13,y:16,w:4,d:4,type:'hall',  label:'RATHAUS'},
   {x:29,y:16,w:4,d:3,type:'forge', label:'FORGE'},
   {x:13,y:23,w:4,d:3,type:'house_b'},
   {x:24,y:23,w:4,d:3,type:'inn',   label:'HOTEL'},
   {x:30,y:23,w:3,d:3,type:'house_a'},
   {x:19,y:29,w:3,d:3,type:'tower', label:'BÜCHELTURM'}],
  npcs:[{id:'banker',x:9,y:12},{id:'smith',x:30,y:19},{id:'elder',x:14,y:20},
        {id:'skillmaster',x:25,y:14},{id:'guard',x:22,y:26}],
  mobs:[],exits:[],labels:[]},
 forest:{name:'Whisper Forest',ground:'.',rows:[
  "FFFFFFFFFFFFFFFFFFFFFFFFFF",
  "F..T....T.....T......TFEEF",
  "F....................T...F",
  "F..T.....T....FF....T....F",
  "F.............FF.......O.F",
  "F...T....T...............F",
  "F........................F",
  "F......T.............O...F",
  "EPPPP....................F",
  "EPPPP....................F",
  "F........T...............F",
  "F.............FF.......O.F",
  "F...T....................F",
  "F..........T.........O...F",
  "F........................F",
  "F....T.........T.........F",
  "F........................F",
  "FFFFFFFFFFFFFFFFFFFFFFFFFF"],
  npcs:[],
  mobs:[{t:'goblin',x:8,y:4},{t:'goblin',x:12,y:7},{t:'goblin',x:9,y:12},{t:'goblin',x:14,y:10},
        {t:'goblin',x:16,y:5},{t:'wolf',x:20,y:11},{t:'wolf',x:22,y:13},{t:'wolf',x:19,y:3},
        {t:'goblin_king',x:6,y:15}],
  exits:[{x:0,y:8,map:'town',tx:34,ty:14},{x:0,y:9,map:'town',tx:34,ty:15},
         {x:23,y:1,map:'ruins',tx:2,ty:15},{x:24,y:1,map:'ruins',tx:3,ty:15}],labels:[]},
 mines:{name:'Old Copper Mines',ground:',',rows:[
  "###########MM###########",
  "#,,,,,,,,,,,,,,,,,,,,,,#",
  "#,,C,,,,,,,,,,,,,C,,,,,#",
  "#,,,,,,,,#####,,,,,,,,,#",
  "#,C,,,,,,#,,,,,,,,C,,,,#",
  "#,,,,,,,,#,,,,,,,,,,,,,#",
  "#,,,,C,,,#,,,,,,C,,,,,,#",
  "#,,,,,,,,,,,,,,,,,,,,,,#",
  "#,,,,####,,,,,,####,,,,#",
  "#,,,,,,,,,,,,,,,,,,,,,,#",
  "#,I,,,,,,,,,,,,,,,,,I,,#",
  "#,,,,,,,,,,I,,,,,,,,,,,#",
  "#,,,,,,,,,,,,,,,,,,,,,,#",
  "#,,,I,,,,,,,,,,,,,I,,,,#",
  "#,,,,,,,,,,,,,,,,,,,,,,E",
  "#######################E"],
  npcs:[],
  mobs:[{t:'rat',x:6,y:3},{t:'rat',x:15,y:5},{t:'rat',x:3,y:7},
        {t:'skeleton',x:8,y:11},{t:'skeleton',x:15,y:12},{t:'skeleton',x:20,y:13},
        {t:'rock_horror',x:2,y:12}],
  exits:[{x:11,y:0,map:'town',tx:19,ty:26},{x:12,y:0,map:'town',tx:20,ty:26},
         {x:23,y:14,map:'swamp',tx:1,ty:2},{x:23,y:15,map:'swamp',tx:1,ty:2}],labels:[]},
 ruins:{name:'Sunken Ruins',ground:';',rows:[
  "UUUUUUUUUUUUUUUUUUUUUUUU",
  "U;;;;;;;U;;;;;;;;U;;;;;U",
  "U;;G;;;;;;;;~~;;;;;;G;;U",
  "U;;;;;;U;;;;~~;;;U;;;;;U",
  "U;;;;;;U;;;;;;;;;U;;;;;U",
  "U;G;;;;;;;;;;;;;;;;;;G;U",
  "U;;;;;;;;;UUUU;;;;;;;;;U",
  "U;;;;;;;;;U;;;;;;;;;;;;U",
  "U;;~~;;;;;U;;;;;;;~~;;;U",
  "U;;~~;;;;;;;;;;;;;~~;;;U",
  "U;;;;;;;;;;;;;;;;;;;;;;U",
  "U;G;;;;;;;;;;;;;;;;;G;;U",
  "U;;;;;;;;UU;;UU;;;;;;;;U",
  "U;;;;;;;;U;;;;U;;;;;;;;U",
  "U;;;;;;;;;;;;;;;;;;;;;;U",
  "U;EE;;;;;;;;;;;;;;;;;;;U",
  "UUUUUUUUUUUUUUUUUUUUUUUU"],
  npcs:[],
  mobs:[{t:'cultist',x:6,y:4},{t:'cultist',x:16,y:3},{t:'cultist',x:4,y:10},{t:'cultist',x:20,y:10},
        {t:'gargoyle',x:12,y:8},{t:'gargoyle',x:18,y:13},{t:'gargoyle',x:6,y:14},
        {t:'lich',x:12,y:13}],
  exits:[{x:2,y:15,map:'forest',tx:23,ty:2},{x:3,y:15,map:'forest',tx:24,ty:2}],labels:[]},
 swamp:{name:'Mirefen Swamp',ground:':',rows:[
  "SSSSSSSSSSSSSSSSSSSSSSSS",
  "S::::::~~::::::::::::::S",
  "E::::::~~::::::~~~:::::S",
  "E:::::::::::::::~~:::::S",
  "S:::T::::::::::::::::T:S",
  "S::::::::~~~:::::::::::S",
  "S:::::::~~~~:::::::::::S",
  "S::::::::~~::::::::::::S",
  "S:T::::::::::::::~~::::S",
  "S::::::::::::::::~~::::S",
  "S:::::~~:::::::::::::::S",
  "S:::::~~::::T::::::::::S",
  "S::::::::::::::::::::::S",
  "S:::::::::~~~::::::::::S",
  "S:T::::::::~~::::::::::S",
  "S::::::::::::::::::::::S",
  "SSSSSSSSSSSSSSSSSSSSSSSS"],
  npcs:[],
  mobs:[{t:'bogstalker',x:6,y:3},{t:'bogstalker',x:14,y:6},{t:'bogstalker',x:5,y:12},
        {t:'hagspawn',x:18,y:4},{t:'hagspawn',x:12,y:10},{t:'hagspawn',x:19,y:13},
        {t:'swamp_hag',x:20,y:8}],
  exits:[{x:0,y:2,map:'mines',tx:22,ty:14},{x:0,y:3,map:'mines',tx:22,ty:14}],labels:[]},
};
const BLOCKED=new Set(['X','R','W','F','#','Q','U','S','~','H','B']);

/* ---- generate the St. Vith town grid: egg-shaped ring wall + streets ----
   Interior is walkable grass; the ring + Hauptstraße + cross-lanes are 'P';
   building footprints are 'B'. Gates are punched where the ring meets the
   forest (east) and mines (south-west), and the matching return targets in
   forest/mines are wired up here. Runs once at load so buildWorld sees it. */
(function buildTownGrid(){
  const t=MAPS.town,W=t.w,H=t.h;
  const g=Array.from({length:H},()=>new Array(W).fill('.'));
  const set=(x,y,c)=>{if(x>=0&&x<W&&y>=0&&y<H)g[y][x]=c;};
  const road=(x,y)=>{if(x>=0&&x<W&&y>=0&&y<H&&g[y][x]==='.')g[y][x]='P';};
  const vl=(x,y0,y1)=>{for(let y=y0;y<=y1;y++)road(x,y);};
  const hl=(x0,x1,y)=>{for(let x=x0;x<=x1;x++)road(x,y);};
  const rect=(x,y,w,d,c)=>{for(let j=0;j<d;j++)for(let i=0;i<w;i++)set(x+i,y+j,c);};
  /* egg-shaped ring wall: wide rounded north, tapering to a southern point */
  const cx=20,cyc=16,ryc=17,rx=16,yTop=2,yBot=33,L=[],Rr=[];
  for(let y=yTop;y<=yBot;y++){
    const tt=(y-cyc)/ryc,base=Math.sqrt(Math.max(0,1-tt*tt)),taper=tt>0?1-0.5*tt:1;
    const hw=rx*base*taper;L[y]=Math.round(cx-hw);Rr[y]=Math.round(cx+hw);
  }
  for(let y=yTop;y<=yBot;y++){
    road(L[y],y);road(Rr[y],y);
    if(y>yTop){ /* staircase-fill so the wall stays one closed loop */
      for(let x=Math.min(L[y],L[y-1]);x<=Math.max(L[y],L[y-1]);x++)road(x,y);
      for(let x=Math.min(Rr[y],Rr[y-1]);x<=Math.max(Rr[y],Rr[y-1]);x++)road(x,y);
    }
  }
  for(let x=L[yTop];x<=Rr[yTop];x++)road(x,yTop); /* rounded northern cap */
  /* Hauptstraße spine + named cross-lanes + Orts-/Kirchstraße side lanes */
  vl(19,6,28);vl(20,6,28);
  const cross=y=>hl(L[y]+1,Rr[y]-1,y);cross(8);cross(15);cross(22);
  vl(12,9,24);vl(28,9,22);
  /* buildings, then square furniture, churchyard graves, the Teich pond, greens */
  for(const b of t.buildings)rect(b.x,b.y,b.w,b.d,'B');
  set(17,17,'Q');set(22,17,'H');set(21,13,'G');set(29,13,'G');
  rect(32,13,2,2,'~');
  set(15,26,'T');set(17,27,'O');set(26,26,'T');
  for(const[x,y]of[[2,9],[3,22],[36,10],[37,25],[6,34],[34,34],[2,28],[10,33]])set(x,y,'T');
  /* gates: east → forest, south-west → mines (the ring tile is the arrival) */
  const gE1=Rr[13],gE2=Rr[14],gW1=L[24],gW2=L[25];
  set(gE1+1,13,'E');set(gE2+1,14,'E');set(gW1-1,24,'E');set(gW2-1,25,'E');
  t.exits=[{x:gE1+1,y:13,map:'forest',tx:1,ty:8},{x:gE2+1,y:14,map:'forest',tx:1,ty:9},
           {x:gW1-1,y:24,map:'mines',tx:11,ty:1},{x:gW2-1,y:25,map:'mines',tx:12,ty:1}];
  MAPS.forest.exits[0].tx=gE1;MAPS.forest.exits[0].ty=13;
  MAPS.forest.exits[1].tx=gE2;MAPS.forest.exits[1].ty=14;
  MAPS.mines.exits[0].tx=gW1;MAPS.mines.exits[0].ty=24;
  MAPS.mines.exits[1].tx=gW2;MAPS.mines.exits[1].ty=25;
  /* street + landmark labels (rendered above the town in p6) */
  t.labels=[{x:20,y:6.4,t:'HAUPTSTR.'},{x:cx,y:8.4,t:'BLEICHSTR.'},{x:28,y:11.4,t:'KIRCHSTR.'},
    {x:17,y:16.4,t:'MARKT'},{x:9,y:24.4,t:'PRÜMER TOR'},{x:36,y:13.4,t:'OSTTOR'},
    ...t.buildings.filter(b=>b.label).map(b=>({x:b.x+b.w/2,y:b.y+b.d-0.7,t:b.label}))];
  t.rows=g.map(r=>r.join(''));
})();

/* ---------------- runtime world ---------------- */
const world={};
function buildWorld(){
  for(const id in MAPS){
    const m=MAPS[id];
    const w=Math.max(...m.rows.map(r=>r.length));
    m.rows=m.rows.map(r=>r.padEnd(w,m.ground));
    const grid=m.rows.map(r=>r.split(''));
    const res=[],mobs=[];
    grid.forEach((row,y)=>row.forEach((ch,x)=>{
      if(RES[ch]) res.push({id:id+':'+x+':'+y,type:ch,x,y,alive:true,respawnAt:0});
    }));
    m.mobs.forEach((s,i)=>{
      const d=MOBS[s.t];
      mobs.push({id:id+':m'+i,type:s.t,hx:s.x,hy:s.y,tx:s.x,ty:s.y,px:s.x*TILE,py:s.y*TILE,
        hp:d.hp,alive:true,respawnAt:0,moving:null,aggro:false,atkT:0,wanderT:rand(1000,4000)});
    });
    world[id]={grid,w,h:grid.length,res,mobs,drops:[],buildings:m.buildings||[],
      exits:m.exits,labels:m.labels||[],
      npcs:m.npcs.map((n,i)=>({...n,...NPCS[n.id],tx:n.x,ty:n.y,hx:n.x,hy:n.y,
        px:n.x*TILE,py:n.y*TILE,moving:null,path:[],facing:-1,wanderT:2200+i*700}))};
        /* wanderT is deterministic (no rand at build) so the RNG stream — and
           thus combat-balance tests — stay identical; NPCs re-randomise at runtime */
  }
}
function tileAt(map,x,y){const W=world[map];if(x<0||y<0||x>=W.w||y>=W.h)return'X';return W.grid[y][x];}
function walkable(map,x,y){const c=tileAt(map,x,y);return !BLOCKED.has(c)&&!RES[c];}
function resAt(map,x,y){return world[map].res.find(r=>r.x===x&&r.y===y);}
function mobAt(map,x,y){return world[map].mobs.find(m=>m.alive&&m.tx===x&&m.ty===y);}
function npcAt(map,x,y){return world[map].npcs.find(n=>n.tx===x&&n.ty===y);}
function exitAt(map,x,y){return world[map].exits.find(e=>e.x===x&&e.y===y);}
function dropAt(map,x,y){return world[map].drops.find(d=>d.x===x&&d.y===y);}

/* BFS path; adjacentOk => stop on a 4-neighbour of dest */
function findPath(map,sx,sy,dx,dy,adjacentOk){
  const W=world[map];
  if(sx===dx&&sy===dy)return[];
  const key=(x,y)=>y*W.w+x;
  const prev=new Map();prev.set(key(sx,sy),null);
  const q=[[sx,sy]];
  const goal=(x,y)=>adjacentOk?(Math.abs(x-dx)+Math.abs(y-dy)===1):(x===dx&&y===dy);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(q.length){
    const [x,y]=q.shift();
    if(goal(x,y)){
      const path=[];let k=key(x,y);
      while(k!==null){path.push([k%W.w,(k/W.w)|0]);k=prev.get(k);}
      path.pop();path.reverse();return path;
    }
    for(const[ddx,ddy]of dirs){
      const nx=x+ddx,ny=y+ddy,nk=key(nx,ny);
      if(prev.has(nk)||!walkable(map,nx,ny))continue;
      prev.set(nk,key(x,y));q.push([nx,ny]);
    }
  }
  return null;
}

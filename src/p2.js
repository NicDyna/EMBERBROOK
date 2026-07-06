/* p2: world data — resources, biome mobs (styles + loot tables), dungeon
       semi-bosses & bosses, NPCs, quests, dailies, the walled town + four
       huge biome regions (Forest→Mountains→Plains→Desert) each with a
       dungeon, procedural region builder, and pathfinding.

   World shape (single linear chain, town has ONE south gate):
     Town → Forest → Mountains → Plains → Desert
     each region holds a Dungeon (semi-boss + boss, the best loot). */

/* ---------------- gatherable resources ----------------
   RS-style tiered ladders for both skills. `hp` is now the node's CHARGE count:
   how many items it yields before depleting & respawning. Low-tier = 1 (chop & go),
   high-tier = 3–5 (the efficient deep-zone farm). Higher tiers also pay more xp. */
const RES={
  /* woodcutting */
  T:{name:'Tree',      skill:'woodcutting',lvl:1, xp:12, item:'logs',      time:2200,respawn:6000, hp:1},
  O:{name:'Oak',       skill:'woodcutting',lvl:5, xp:26, item:'oak_logs',  time:2800,respawn:9000, hp:2},
  Y:{name:'Frostpine', skill:'woodcutting',lvl:15,xp:44, item:'oak_logs',  time:3200,respawn:11000,hp:2},
  J:{name:'Maple',     skill:'woodcutting',lvl:30,xp:86, item:'maple_logs',time:3600,respawn:14000,hp:3},
  L:{name:'Yew',       skill:'woodcutting',lvl:45,xp:150,item:'yew_logs',  time:4200,respawn:20000,hp:4},
  /* mining */
  C:{name:'Copper Rock', skill:'mining',lvl:1, xp:14, item:'copper_ore', time:2400,respawn:7000, hp:1},
  I:{name:'Iron Rock',   skill:'mining',lvl:8, xp:30, item:'iron_ore',   time:3000,respawn:10000,hp:2},
  Z:{name:'Crystal Vein',skill:'mining',lvl:18,xp:58, item:'gem',        time:3600,respawn:15000,hp:2},
  A:{name:'Coal Seam',   skill:'mining',lvl:20,xp:64, item:'coal',       time:3400,respawn:13000,hp:3},
  e:{name:'Mithril Vein',skill:'mining',lvl:30,xp:96, item:'mithril_ore',time:3800,respawn:16000,hp:3},
  u:{name:'Adamant Vein',skill:'mining',lvl:40,xp:150,item:'adamant_ore',time:4200,respawn:20000,hp:4},
  j:{name:'Runite Vein', skill:'mining',lvl:50,xp:230,item:'runite_ore', time:4800,respawn:26000,hp:5},
};

/* ---------------- loot table helpers ----------------
   entries: {w, gold:[min,max]} | {w, item, q:[min,max]}
          | {w, gear:{line?, tierMin, tierMax}}  (line omitted = random)
   Boss/semi tables get rarityBoost + a second roll (see rollLoot in p5). */
function lootRoll(table){
  const tot=table.reduce((a,e)=>a+e.w,0);
  let r=Math.random()*tot;
  for(const e of table){r-=e.w;if(r<0)return e;}
  return table[0];
}

/* ---------------- mobs ----------------
   style: 'melee'|'ranged'|'magic' (combat triangle:
   melee beats ranged beats magic beats melee).
   boss:true → big 2× sprite, ~5-min respawn. semi:true → elite (double loot
   roll + rarity boost, faster respawn). Both live inside dungeons. */
const MOBS={
  /* ===== Dense Forest — Whisperwood (lvl 3–12) ===== */
  spider:{name:'Forest Spider',lvl:4,hp:12,style:'melee',acc:7,pow:4,def:3,spd:2400,range:1,
    aggro:false,xp:24,gold:[2,7],
    loot:[{w:48,gold:[2,7]},{w:20,item:'bone',q:[1,1]},{w:12,item:'bread',q:[1,1]},
          {w:10,gear:{tierMin:1,tierMax:2}},{w:10,item:'cooked_meat',q:[1,1]},{w:12,item:'spider_silk',q:[1,2]}]},
  boar:{name:'Wild Boar',lvl:6,hp:16,style:'melee',acc:8,pow:5,def:4,spd:2400,range:1,
    aggro:true,xp:34,gold:[0,4],
    loot:[{w:44,item:'wolf_pelt',q:[1,1]},{w:24,item:'cooked_meat',q:[1,2]},
          {w:20,item:'bone',q:[1,2]},{w:12,gear:{tierMin:1,tierMax:2}}]},
  bandit:{name:'Forest Bandit',lvl:9,hp:22,style:'ranged',acc:11,pow:6,def:5,spd:2800,range:4,
    aggro:true,xp:46,gold:[6,16],
    loot:[{w:34,gold:[6,16]},{w:22,item:'arrows',q:[6,14]},{w:16,item:'bread',q:[1,2]},
          {w:16,gear:{tierMin:1,tierMax:2}},{w:12,item:'copper_ore',q:[1,1]}]},

  /* ===== Frostpeak Mountains — snow (lvl 14–24) ===== */
  frost_wolf:{name:'Frost Wolf',lvl:15,hp:40,style:'melee',acc:16,pow:11,def:10,spd:2100,range:1,
    aggro:true,xp:72,gold:[4,12],
    loot:[{w:40,item:'wolf_pelt',q:[1,2]},{w:24,item:'cooked_meat',q:[1,2]},
          {w:18,item:'bone',q:[1,3]},{w:18,gear:{tierMin:2,tierMax:3}},{w:16,item:'thick_fur',q:[1,2]}]},
  ice_sprite:{name:'Ice Sprite',lvl:18,hp:36,style:'magic',acc:19,pow:13,def:10,spd:2800,range:4,
    aggro:true,xp:92,gold:[8,20],
    loot:[{w:30,gold:[8,20]},{w:24,item:'runes',q:[6,16]},{w:18,item:'gem',q:[1,1]},
          {w:18,gear:{tierMin:2,tierMax:4}},{w:10,item:'meat_pie',q:[1,1]}]},
  snow_troll:{name:'Snow Troll',lvl:20,hp:56,style:'melee',acc:20,pow:13,def:15,spd:2800,range:1,
    aggro:true,xp:130,gold:[10,26],
    loot:[{w:30,gold:[10,26]},{w:22,item:'iron_ore',q:[1,2]},{w:20,gear:{tierMin:3,tierMax:4}},
          {w:16,item:'bone',q:[2,4]},{w:12,item:'gem',q:[1,1]}]},

  /* ===== Golden Plains — savanna (lvl 26–36) ===== */
  steppe_lion:{name:'Steppe Lion',lvl:26,hp:74,style:'melee',acc:25,pow:16,def:16,spd:2200,range:1,
    aggro:true,xp:150,gold:[12,30],
    loot:[{w:34,item:'wolf_pelt',q:[1,3]},{w:24,item:'cooked_meat',q:[2,3]},
          {w:20,gear:{tierMin:3,tierMax:4}},{w:12,item:'gem',q:[1,1]},{w:10,item:'meat_pie',q:[1,1]},{w:14,item:'lion_fang',q:[1,2]}]},
  war_hawk:{name:'War Hawk',lvl:30,hp:58,style:'ranged',acc:28,pow:18,def:15,spd:2600,range:4,
    aggro:true,xp:176,gold:[14,34],
    loot:[{w:30,gold:[14,34]},{w:26,item:'arrows',q:[12,28]},{w:20,gear:{tierMin:3,tierMax:5}},
          {w:14,item:'gem',q:[1,1]},{w:10,item:'stew',q:[1,1]}]},
  nomad:{name:'Steppe Nomad',lvl:34,hp:82,style:'magic',acc:34,pow:22,def:22,spd:2800,range:4,
    aggro:true,xp:212,gold:[18,44],
    loot:[{w:28,gold:[18,44]},{w:24,item:'runes',q:[12,26]},{w:20,gear:{tierMin:4,tierMax:5}},
          {w:16,item:'ancient_dust',q:[1,2]},{w:12,item:'gem',q:[1,2]}]},

  /* ===== Ashen Desert — dunes (lvl 38–49) ===== */
  scorpion:{name:'Sand Scorpion',lvl:38,hp:80,style:'melee',acc:34,pow:20,def:20,spd:2400,range:1,
    aggro:true,xp:212,gold:[16,40],
    loot:[{w:30,gold:[16,40]},{w:24,item:'gem',q:[1,2]},{w:20,gear:{tierMin:4,tierMax:5}},
          {w:14,item:'bone',q:[2,4]},{w:12,item:'stew',q:[1,1]},{w:16,item:'scarab_shell',q:[1,2]}]},
  sand_wraith:{name:'Sand Wraith',lvl:42,hp:86,style:'magic',acc:40,pow:26,def:24,spd:2800,range:4,
    aggro:true,xp:250,gold:[20,50],
    loot:[{w:28,gold:[20,50]},{w:24,item:'runes',q:[14,30]},{w:20,item:'ancient_dust',q:[1,3]},
          {w:18,gear:{tierMin:4,tierMax:6}},{w:10,item:'gem',q:[1,2]}]},
  dune_raider:{name:'Dune Raider',lvl:44,hp:86,style:'ranged',acc:42,pow:25,def:23,spd:2600,range:4,
    aggro:true,xp:280,gold:[24,56],
    loot:[{w:28,gold:[24,56]},{w:24,item:'arrows',q:[18,40]},{w:20,gear:{tierMin:5,tierMax:6}},
          {w:16,item:'gem',q:[1,2]},{w:12,item:'stew',q:[1,2]}]},

  /* ===== Dungeon semi-bosses (elite: double loot + rarity boost) ===== */
  spider_matron:{name:'Spider Matron',lvl:14,hp:70,style:'melee',acc:16,pow:11,def:10,spd:2500,range:1,
    aggro:true,xp:150,gold:[15,35],semi:true,respawn:120000,rarityBoost:1,
    loot:[{w:40,gear:{tierMin:2,tierMax:3}},{w:26,gold:[15,35]},{w:18,item:'gem',q:[1,1]},
          {w:16,item:'meat_pie',q:[1,2]}]},
  ice_warden:{name:'Ice Warden',lvl:28,hp:150,style:'magic',acc:30,pow:20,def:22,spd:2600,range:5,
    aggro:true,xp:560,gold:[70,150],semi:true,respawn:120000,rarityBoost:2,
    loot:[{w:42,gear:{tierMin:3,tierMax:4}},{w:26,gold:[70,150]},{w:18,item:'gem',q:[1,2]},
          {w:14,item:'runes',q:[16,32]}]},
  barrow_wight:{name:'Barrow Wight',lvl:38,hp:180,style:'magic',acc:36,pow:24,def:26,spd:2600,range:5,
    aggro:true,xp:720,gold:[100,220],semi:true,respawn:120000,rarityBoost:2,
    loot:[{w:42,gear:{tierMin:4,tierMax:5}},{w:24,gold:[100,220]},{w:18,item:'ancient_dust',q:[2,4]},
          {w:16,item:'gem',q:[1,2]}]},
  tomb_guardian:{name:'Tomb Guardian',lvl:46,hp:220,style:'melee',acc:46,pow:30,def:34,spd:2600,range:1,
    aggro:true,xp:1000,gold:[160,340],semi:true,respawn:120000,rarityBoost:3,
    loot:[{w:44,gear:{tierMin:5,tierMax:6}},{w:24,gold:[160,340]},{w:18,item:'gem',q:[2,3]},
          {w:14,item:'ancient_dust',q:[3,5]}]},

  /* ===== Dungeon bosses (big 2× sprite, ~5-min respawn, best loot) ===== */
  bandit_king:{name:'The Bandit King',lvl:16,hp:100,style:'melee',acc:18,pow:12,def:12,spd:2400,range:1,
    aggro:true,xp:360,gold:[50,110],boss:true,respawn:300000,rarityBoost:2,unique:'u_bandit_coat',
    loot:[{w:42,gear:{tierMin:2,tierMax:3}},{w:28,gold:[50,110]},{w:18,item:'meat_pie',q:[1,2]},
          {w:12,item:'gem',q:[1,1]},{w:16,item:'spider_silk',q:[2,4]}]},
  frost_giant:{name:'The Frost Giant',lvl:32,hp:190,style:'melee',acc:26,pow:16,def:24,spd:2800,range:1,
    aggro:true,xp:640,gold:[90,200],boss:true,respawn:300000,rarityBoost:2,unique:'u_frostmaul',
    loot:[{w:42,gear:{tierMin:3,tierMax:5}},{w:26,gold:[90,200]},{w:18,item:'gem',q:[1,2]},
          {w:14,item:'iron_ore',q:[2,4]},{w:18,item:'thick_fur',q:[2,4]}]},
  plains_warlord:{name:'The Plains Warlord',lvl:42,hp:220,style:'melee',acc:40,pow:24,def:30,spd:2400,range:1,
    aggro:true,xp:900,gold:[140,300],boss:true,respawn:300000,rarityBoost:3,unique:'u_warlord_bulwark',
    loot:[{w:44,gear:{tierMin:4,tierMax:6}},{w:24,gold:[140,300]},{w:18,item:'gem',q:[2,3]},
          {w:14,item:'ancient_dust',q:[2,4]},{w:18,item:'lion_fang',q:[2,4]}]},
  sand_pharaoh:{name:'The Sand Pharaoh',lvl:50,hp:260,style:'magic',acc:48,pow:30,def:36,spd:2600,range:5,
    aggro:true,xp:1600,gold:[240,480],boss:true,respawn:300000,rarityBoost:3,unique:'u_pharaoh_sceptre',
    loot:[{w:46,gear:{tierMin:5,tierMax:6}},{w:22,gold:[240,480]},{w:18,item:'gem',q:[2,4]},
          {w:14,item:'ancient_dust',q:[4,7]},{w:20,item:'scarab_shell',q:[2,4]}]},
};

/* region order (overworld chain) + per-biome overworld gear-line bias.
   Fodder in a region drops that line so each biome has a gear identity and the
   player naturally collects all three lines across the journey (melee → ranged
   → magic → ranged); dungeon bosses/semis ignore this and drop any line. */
const REGION_ORDER=['forest','mountains','plains','desert'];
const BIOME_LINE={forest:'m',forest_dungeon:'m',mountains:'r',mountains_dungeon:'r',
  plains:'g',plains_dungeon:'g',desert:'r',desert_dungeon:'r'};
const BIOME_MAT={forest:'spider_silk',mountains:'thick_fur',plains:'lion_fang',desert:'scarab_shell'};

/* ---------------- NPCs & dialogue ---------------- */
const NPCS={
  banker:{name:'Banker Mira',role:'bank'},
  smith:{name:'Smith Torvald',role:'shop'},
  elder:{name:'Elder Rowan',role:'quests'},
  guard:{name:'Guard Bram',role:'chat',lines:["Stay on the roads, traveller.",
    "The only way out is the south gate — mind what waits beyond.",
    "Whisperwood, then the frozen peaks, the plains, and the deep desert. Few return.",
    "The real treasures lie in the dungeons. So do the things that guard them."]},
  skillmaster:{name:'Master Aldric',role:'capes'},
};

/* ---------------- quests (7, linear) ---------------- */
const QUESTS={
  fresh:{name:'Fresh Timber',giver:'elder',desc:'Chop 3 logs for the town stockpile.',
    kind:'gather',item:['logs'],need:3,reward:{gold:30,xp:{woodcutting:40}}},
  ore:{name:'Copper for the Forge',giver:'smith',desc:'Mine 3 copper ore for Torvald.',
    kind:'gather',item:['copper_ore'],need:3,reward:{gold:35,xp:{mining:45}}},
  spiders:{name:'Along Came Spiders',giver:'guard',desc:'Slay 4 forest spiders in Whisperwood.',
    kind:'kill',mob:['spider'],need:4,reward:{gold:60,xp:{attack:40,strength:40}}},
  warren:{name:'The Bandit King',giver:'elder',desc:'Enter the Hollow Warren and defeat the Bandit King.',
    kind:'kill',mob:['bandit_king'],need:1,reward:{gold:200,xp:{attack:120,defence:100},gear:{id:'g_m_3_body',r:1}}},
  frost:{name:'Thaw the Deep',giver:'elder',desc:'Defeat the Frost Giant in the Glacial Cavern.',
    kind:'kill',mob:['frost_giant'],need:1,reward:{gold:500,xp:{strength:260,defence:200}}},
  barrow:{name:'Warlord of the Plains',giver:'elder',desc:'Defeat the Plains Warlord in the Sunken Barrow.',
    kind:'kill',mob:['plains_warlord'],need:1,reward:{gold:900,xp:{ranged:300,magic:300}}},
  pharaoh:{name:'The Sand Pharaoh',giver:'elder',desc:'Descend the Pharaoh\'s Tomb and end the Sand Pharaoh.',
    kind:'kill',mob:['sand_pharaoh'],need:1,reward:{gold:2000,xp:{attack:350,strength:350,magic:350}}},
};
const QUEST_ORDER=['fresh','ore','spiders','warren','frost','barrow','pharaoh'];

/* ---------------- daily task pool ---------------- */
const DAILY_POOL=[
  {id:'d_logs',desc:'Chop 10 logs',kind:'gather',item:['logs','oak_logs'],need:10,gold:40},
  {id:'d_ore',desc:'Mine 8 ore',kind:'gather',item:['copper_ore','iron_ore'],need:8,gold:45},
  {id:'d_kill',desc:'Defeat 6 monsters',kind:'kill',mob:null,need:6,gold:50},
  {id:'d_spider',desc:'Slay 4 forest spiders',kind:'kill',mob:['spider'],need:4,gold:40},
  {id:'d_gold',desc:'Earn 150 gold',kind:'gold',need:150,gold:60},
  {id:'d_frost',desc:'Destroy 3 frost wolves',kind:'kill',mob:['frost_wolf'],need:3,gold:60},
  {id:'d_ranged',desc:'Land 15 ranged or magic kills or hits',kind:'stylehit',need:15,gold:55},
  {id:'d_boss',desc:'Defeat any dungeon boss',kind:'kill',mob:['bandit_king','frost_giant','plains_warlord','sand_pharaoh'],need:1,gold:140},
  {id:'d_mountains',desc:'Defeat 5 monsters in the mountains',kind:'killmap',map:'mountains',need:5,gold:75},
  {id:'d_desert',desc:'Defeat 5 monsters in the desert',kind:'killmap',map:'desert',need:5,gold:110},
];

/* ---------------- maps ----------------
   Tiles: . grass  s snow  a savanna  d desert sand  , dungeon floor  ~ water
   K town wall  X rock/cliff  F forest edge  # dungeon wall  k cactus (blocked)
   P path/road  E exit gate  D dungeon entrance  Q quest board  H monument
   B building footprint  G grave decor  T/O/Y trees  C/I/Z ore/crystal
   Town is generated by buildTownGrid; the four regions + four dungeons by
   buildRegions — both run once at load so buildWorld sees finished grids. */
const MAPS={
 town:{name:'Emberbrook',ground:'.',w:40,h:36,spawn:[20,17],rows:[],gate:[20,33],
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
   {x:24,y:26,w:3,d:3,type:'tower', label:'BÜCHELTURM'}],
  npcs:[{id:'banker',x:9,y:12},{id:'smith',x:30,y:19},{id:'elder',x:14,y:20},
        {id:'skillmaster',x:25,y:14},{id:'guard',x:22,y:26}],
  mobs:[],exits:[],labels:[]},
 forest:{name:'Whisperwood',ground:'.',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
 mountains:{name:'Frostpeak Mountains',ground:'s',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
 plains:{name:'Golden Plains',ground:'a',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
 desert:{name:'Ashen Desert',ground:'d',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
 forest_dungeon:{name:'Hollow Warren',ground:',',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
 mountains_dungeon:{name:'Glacial Cavern',ground:',',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
 plains_dungeon:{name:'Sunken Barrow',ground:',',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
 desert_dungeon:{name:"Pharaoh's Tomb",ground:',',rows:[],npcs:[],mobs:[],exits:[],labels:[]},
};
const BLOCKED=new Set(['X','R','W','F','#','Q','U','S','~','H','B','K','k','V','N']);

/* ---- generate the St. Vith town grid: egg-shaped stone wall + one south gate
   Interior is walkable grass/road; the egg ring is now a solid WALL 'K'
   (blocking). The Hauptstraße spine runs down to a single southern gate 'E'
   that leads to Whisperwood; all other gates are gone. 'B' = building. ---- */
(function buildTownGrid(){
  const t=MAPS.town,W=t.w,H=t.h;
  const g=Array.from({length:H},()=>new Array(W).fill('.'));
  const set=(x,y,c)=>{if(x>=0&&x<W&&y>=0&&y<H)g[y][x]=c;};
  const wall=(x,y)=>{if(x>=0&&x<W&&y>=0&&y<H&&g[y][x]==='.')g[y][x]='K';};
  const road=(x,y)=>{if(x>=0&&x<W&&y>=0&&y<H&&(g[y][x]==='.'))g[y][x]='P';};
  const vl=(x,y0,y1)=>{for(let y=y0;y<=y1;y++)road(x,y);};
  const hl=(x0,x1,y)=>{for(let x=x0;x<=x1;x++)road(x,y);};
  const rect=(x,y,w,d,c)=>{for(let j=0;j<d;j++)for(let i=0;i<w;i++)set(x+i,y+j,c);};
  /* egg-shaped stone wall: wide rounded north, tapering to a southern point */
  const cx=20,cyc=16,ryc=17,rx=16,yTop=2,yBot=33,L=[],Rr=[];
  for(let y=yTop;y<=yBot;y++){
    const tt=(y-cyc)/ryc,base=Math.sqrt(Math.max(0,1-tt*tt)),taper=tt>0?1-0.5*tt:1;
    const hw=rx*base*taper;L[y]=Math.round(cx-hw);Rr[y]=Math.round(cx+hw);
  }
  for(let y=yTop;y<=yBot;y++){
    wall(L[y],y);wall(Rr[y],y);
    if(y>yTop){ /* staircase-fill so the wall stays one closed loop */
      for(let x=Math.min(L[y],L[y-1]);x<=Math.max(L[y],L[y-1]);x++)wall(x,y);
      for(let x=Math.min(Rr[y],Rr[y-1]);x<=Math.max(Rr[y],Rr[y-1]);x++)wall(x,y);
    }
  }
  for(let x=L[yTop];x<=Rr[yTop];x++)wall(x,yTop); /* rounded northern cap */
  /* Hauptstraße spine (down to the gate) + named cross-lanes + side lanes */
  vl(19,6,31);vl(20,6,32);
  const cross=y=>hl(L[y]+1,Rr[y]-1,y);cross(8);cross(15);cross(22);
  vl(12,9,24);vl(28,9,22);
  /* buildings, then square furniture, churchyard graves, the Teich pond, greens */
  for(const b of t.buildings)rect(b.x,b.y,b.w,b.d,'B');
  set(17,17,'Q');set(22,17,'H');set(21,13,'G');set(29,13,'G');
  rect(32,13,2,2,'~');
  set(15,26,'T');set(17,27,'O');set(26,26,'T');
  for(const[x,y]of[[2,9],[3,22],[36,10],[37,25],[6,34],[34,34],[2,28],[10,33]])set(x,y,'T');
  /* the single southern gate (egg tip ≈ x20,y33) → Whisperwood */
  const gx=t.gate[0],gy=t.gate[1];
  set(gx,gy,'E');set(gx,gy-1,'P');
  t.exits=[{x:gx,y:gy,map:'forest',tx:30,ty:1}];
  /* street + landmark labels (rendered above the town in p6) */
  t.labels=[{x:20,y:6.4,t:'HAUPTSTR.'},{x:cx,y:8.4,t:'BLEICHSTR.'},{x:28,y:11.4,t:'KIRCHSTR.'},
    {x:17,y:16.4,t:'MARKT'},{x:20,y:31.4,t:'SÜDTOR'},
    ...t.buildings.filter(b=>b.label).map(b=>({x:b.x+b.w/2,y:b.y+b.d-0.7,t:b.label}))];
  t.rows=g.map(r=>r.join(''));
})();

/* ---- generate the four huge biome regions + their dungeons ----------------
   60×45 open fields bordered by blocking biome edges; sparse scattered
   resources & decor (isolated tiles never disconnect the field); a north gate
   back to the previous area, a south gate onward, and one dungeon mouth 'D'.
   A dedicated seeded RNG keeps generation OFF Math.random so the gameplay/loot
   stream (and the balance tests) stay identical run to run. */
(function buildRegions(){
  const RW=60,RH=45,RCx=30,DGx=14,DGy=14; /* region size, gate col, dungeon mouth */
  function mkRng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;
    let x=Math.imul(s^s>>>15,1|s);x=(x+Math.imul(x^x>>>7,61|x))^x;return((x^x>>>14)>>>0)/4294967296;};}
  /* res entries are [char, count, band] — 'safe' nodes cluster in the calm belt
     near the north gate, 'deep' (higher-tier) nodes in the mob-dense far end.
     Each region's deep zone stocks the next tier up, so you skill AND fight to
     climb the ladder (danger-zoned maps, §2/§3 of DESIGN-v3). */
  const SPECS=[
   {id:'forest',ground:'.',edge:'F',north:'town',south:'mountains',dungeon:'forest_dungeon',
    res:[['T',24,'safe'],['C',8,'safe'],['O',12,'deep'],['I',6,'deep']],decor:[['X',6]],water:2,
    mobs:{spider:9,boar:6,bandit:5}},
   {id:'mountains',ground:'s',edge:'V',north:'forest',south:'plains',dungeon:'mountains_dungeon',
    res:[['Y',14,'safe'],['I',8,'safe'],['Z',5,'deep'],['A',7,'deep'],['e',5,'deep']],decor:[['X',34]],water:0,
    mobs:{frost_wolf:8,ice_sprite:6,snow_troll:5}},
   {id:'plains',ground:'a',edge:'X',north:'mountains',south:'desert',dungeon:'plains_dungeon',
    res:[['Y',10,'safe'],['A',7,'safe'],['J',8,'deep'],['e',5,'deep'],['u',5,'deep']],decor:[['X',10]],water:3,
    mobs:{steppe_lion:8,war_hawk:6,nomad:5}},
   {id:'desert',ground:'d',edge:'N',north:'plains',south:null,dungeon:'desert_dungeon',
    res:[['J',8,'safe'],['u',6,'safe'],['L',6,'deep'],['j',5,'deep'],['Z',5,'deep']],decor:[['k',18],['X',12]],water:2,
    mobs:{scorpion:8,sand_wraith:6,dune_raider:5}},
  ];
  const DUNG={
   forest_dungeon:{adds:['spider','spider','bandit'],semi:'spider_matron',boss:'bandit_king'},
   mountains_dungeon:{adds:['frost_wolf','ice_sprite','snow_troll'],semi:'ice_warden',boss:'frost_giant'},
   plains_dungeon:{adds:['steppe_lion','war_hawk','nomad'],semi:'barrow_wight',boss:'plains_warlord'},
   desert_dungeon:{adds:['scorpion','sand_wraith','dune_raider'],semi:'tomb_guardian',boss:'sand_pharaoh'},
  };
  const townGate=MAPS.town.gate;

  function buildRegion(spec,seed){
    const g=Array.from({length:RH},()=>new Array(RW).fill(spec.ground));
    const rng=mkRng(seed),mobs=[];
    const key=(x,y)=>x+','+y, reserved=new Set();
    const reserve=(x,y,r)=>{for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)reserved.add(key(x+i,y+j));};
    /* solid biome border */
    for(let x=0;x<RW;x++){g[0][x]=spec.edge;g[RH-1][x]=spec.edge;}
    for(let y=0;y<RH;y++){g[y][0]=spec.edge;g[y][RW-1]=spec.edge;}
    /* reserve gates, dungeon mouth + a clear central corridor */
    reserve(RCx,1,2);reserve(RCx,RH-2,2);reserve(DGx,DGy,2);
    for(let y=1;y<RH-1;y++)reserved.add(key(RCx,y));
    /* random interior ground tile in the row band [yLo,yHi], not reserved */
    const openTile=(yLo,yHi)=>{
      yLo=yLo||1;yHi=yHi||(RH-2);
      for(let tries=0;tries<50;tries++){
        const x=1+Math.floor(rng()*(RW-2)),y=yLo+Math.floor(rng()*(yHi-yLo+1));
        if(g[y]&&g[y][x]===spec.ground&&!reserved.has(key(x,y)))return[x,y];
      }return null;};
    /* row bands: safe skilling belt up north, contested deep zone down south */
    const SAFE=[2,16], DEEP=[18,RH-2], MOBLO=15;
    /* water pools (small, blocking via '~') */
    for(let i=0;i<spec.water;i++){const p=openTile();if(!p)continue;
      for(let j=0;j<2;j++)for(let k=0;k<2;k++)if(g[p[1]+j]&&g[p[1]+j][p[0]+k]===spec.ground)g[p[1]+j][p[0]+k]='~';}
    /* decor (blocking) then resources — resources banded by safe/deep */
    for(const[ch,n]of spec.decor)for(let i=0;i<n;i++){const p=openTile();if(p)g[p[1]][p[0]]=ch;}
    for(const[ch,n,band]of spec.res){const[yLo,yHi]=band==='deep'?DEEP:SAFE;
      for(let i=0;i<n;i++){const p=openTile(yLo,yHi);if(p){g[p[1]][p[0]]=ch;reserved.add(key(p[0],p[1]));}}}
    /* mobs cluster in the deep zone, leaving the northern skilling belt calm */
    for(const t in spec.mobs)for(let i=0;i<spec.mobs[t];i++){const p=openTile(MOBLO,RH-2);if(p){mobs.push({t,x:p[0],y:p[1]});reserved.add(key(p[0],p[1]));}}
    /* gates + dungeon mouth (force-clear their tiles + approaches) */
    g[0][RCx]='E';g[1][RCx]=spec.ground;
    const exits=[];
    const northArr = spec.north==='town' ? [townGate[0],townGate[1]-1] : [RCx,RH-2];
    exits.push({x:RCx,y:0,map:spec.north,tx:northArr[0],ty:northArr[1]});
    if(spec.south){g[RH-1][RCx]='E';g[RH-2][RCx]=spec.ground;
      exits.push({x:RCx,y:RH-1,map:spec.south,tx:RCx,ty:1});}
    g[DGy][DGx]='D';g[DGy+1][DGx]=spec.ground;
    exits.push({x:DGx,y:DGy,map:spec.dungeon,tx:12,ty:15});
    return{rows:g.map(r=>r.join('')),mobs,exits};
  }

  function buildDungeon(id,rid,seed){
    const W=24,H=18,d=DUNG[id],rng=mkRng(seed),mobs=[];
    const g=Array.from({length:H},()=>new Array(W).fill('#'));
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)g[y][x]=',';
    /* a few rubble pillars for texture (kept off the central aisle) */
    for(let i=0;i<10;i++){const x=2+Math.floor(rng()*(W-4)),y=2+Math.floor(rng()*(H-6));
      if(Math.abs(x-12)>2)g[y][x]='X';}
    /* back-exit to the region, spawn just inside */
    g[H-1][12]='E';g[H-2][12]=',';g[H-3][12]=',';
    mobs.push({t:d.boss,x:12,y:3});
    mobs.push({t:d.semi,x:12,y:8});
    d.adds.forEach((t,i)=>mobs.push({t,x:6+i*5,y:11}));
    /* clear tiles under every entity so nothing spawns in a pillar */
    for(const m of mobs){g[m.y][m.x]=',';}
    const exits=[{x:12,y:H-1,map:rid,tx:DGx,ty:DGy+1}];
    return{rows:g.map(r=>r.join('')),mobs,exits,ground:','};
  }

  SPECS.forEach((spec,i)=>{
    const r=buildRegion(spec,0x51ed+i*0x1000);
    MAPS[spec.id].rows=r.rows;MAPS[spec.id].mobs=r.mobs;MAPS[spec.id].exits=r.exits;
    const dg=buildDungeon(spec.dungeon,spec.id,0x9a1c+i*0x1000);
    MAPS[spec.dungeon].rows=dg.rows;MAPS[spec.dungeon].mobs=dg.mobs;MAPS[spec.dungeon].exits=dg.exits;
  });
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
      if(RES[ch]) res.push({id:id+':'+x+':'+y,type:ch,x,y,alive:true,respawnAt:0,
        charges:RES[ch].hp||1}); /* hp = yield charges before depletion */
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
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
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
      /* a diagonal step may not slip through a wall corner */
      if(ddx&&ddy&&(!walkable(map,x+ddx,y)||!walkable(map,x,y+ddy)))continue;
      prev.set(nk,key(x,y));q.push([nx,ny]);
    }
  }
  return null;
}

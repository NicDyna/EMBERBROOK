/* ============================================================
   EMBERBROOK v2 — a tiny medieval RPG (single player)
   Built as: src/p1..p8.js -> static/game.js (see README)
   ------------------------------------------------------------
   p1: constants, skills & XP, items, gear generation, rarity
   ============================================================ */
'use strict';
const TILE=32, INV_CAP=20, MAX_LVL=50, SAVE_VERSION=2;
const $=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
let T=0; // game time in ms (advances only while playing)

/* ---------------- skills ---------------- */
const SKILLS={
  attack:     {name:'Attack',     color:'#d9534f', icon:'sword'},
  strength:   {name:'Strength',   color:'#e07a5f', icon:'fist'},
  defence:    {name:'Defence',    color:'#7f9bd1', icon:'shield'},
  ranged:     {name:'Ranged',     color:'#7fb069', icon:'bow'},
  magic:      {name:'Magic',      color:'#9b7fd1', icon:'staff'},
  woodcutting:{name:'Woodcutting',color:'#8a9a5b', icon:'axe'},
  mining:     {name:'Mining',     color:'#a08c78', icon:'pick'},
};
const SKILL_ORDER=['attack','strength','defence','ranged','magic','woodcutting','mining'];
const xpAt=l=>Math.floor(45*Math.pow(l-1,1.8));
/* Level is capped at 50; XP itself keeps counting (overflow). */
function lvlFor(xp){let l=1;while(l<MAX_LVL&&xp>=xpAt(l+1))l++;return l;}

/* ---------------- rarity (stat-roll multipliers, pure RNG) -------- */
const RARITY=[
  {id:0,name:'',          color:'#cfc9bd',mult:1.00,w:620},
  {id:1,name:'Uncommon ', color:'#7fd17f',mult:1.10,w:250},
  {id:2,name:'Rare ',     color:'#6fb7ff',mult:1.25,w:100},
  {id:3,name:'Epic ',     color:'#c98bff',mult:1.45,w:25},
  {id:4,name:'Legendary ',color:'#f0c419',mult:1.70,w:5},
];
function rollRarity(boost){ // boost shifts weight toward high tiers (bosses)
  const b=boost||0;
  const ws=RARITY.map((r,i)=>r.w*(1+b*i*i)); // quadratic boost favors top end
  const tot=ws.reduce((a,x)=>a+x,0);
  let roll=Math.random()*tot;
  for(let i=0;i<ws.length;i++){roll-=ws[i];if(roll<0)return i;}
  return 0;
}

/* ---------------- gear generation ----------------
   3 style lines x 6 tiers x slots. IDs: g_<line>_<tier>_<slot>.
   Armour: def + hp (flat HP comes only from gear).
   Leather adds a small ranged power boost, cloth a magic boost. */
const TIER_REQ=[1,5,15,25,35,45];
const LINE_DEFS={
  m:{name:'melee', tiers:['Bronze','Iron','Steel','Mithril','Adamant','Rune'],
     slots:{weapon:'Sword',shield:'Shield',helmet:'Helm',body:'Platebody',legs:'Platelegs'},
     reqSkill:{weapon:'attack',shield:'defence',helmet:'defence',body:'defence',legs:'defence'},
     metal:['#a9714b','#b8c4cf','#8f9aa5','#6fb7ff','#5f9e6e','#59c1c9']},
  r:{name:'ranged',tiers:['Leather','Hard Leather','Studded','Carapace','Drakehide','Wyrmhide'],
     slots:{weapon:'Bow',helmet:'Coif',body:'Body',legs:'Chaps'},
     reqSkill:{weapon:'ranged',helmet:'defence',body:'defence',legs:'defence'},
     metal:['#a9825b','#96754e','#8a6d48','#7f9a5b','#5f8a4e','#4e8a6d']},
  g:{name:'magic', tiers:['Cloth','Woven','Mystic','Enchanted','Arcane','Runecloth'],
     slots:{weapon:'Staff',helmet:'Hat',body:'Robe Top',legs:'Robe Bottom'},
     reqSkill:{weapon:'magic',helmet:'defence',body:'defence',legs:'defence'},
     metal:['#9a8ca8','#8a7fa0','#7f6fb0',' #6f5fc0','#8f5fb0','#b05fa0']},
};
const GEAR={};
(function buildGear(){
  for(const L in LINE_DEFS){
    const ld=LINE_DEFS[L];
    for(let t=1;t<=6;t++){
      for(const slot in ld.slots){
        const id=`g_${L}_${t}_${slot}`;
        const name=`${ld.tiers[t-1]} ${ld.slots[slot]}`;
        const g={id,name,line:L,tier:t,slot,req:TIER_REQ[t-1],
                 reqSkill:ld.reqSkill[slot],color:ld.metal[t-1].trim(),stats:{}};
        if(slot==='weapon'){
          g.stats.acc=3+4*t; g.stats.pow=2+3*t;
          g.spd = L==='m'?2400:3000;
          if(L==='r')g.ammo='arrows';
          if(L==='g')g.ammo='runes';
        }else{
          const defBase = slot==='body'?2+2*t : slot==='legs'?1+Math.round(1.5*t)
                        : slot==='shield'?2+2*t : 1+t;
          const hpBase  = slot==='body'?2+t : slot==='shield'?1+t : 1+Math.ceil(t/2);
          const lineDef = L==='m'?1 : 0.75;
          g.stats.def=Math.max(1,Math.round(defBase*lineDef));
          g.stats.hp=hpBase;
          if(L==='r')g.stats.rpow=Math.ceil(t/2);
          if(L==='g')g.stats.mpow=Math.ceil(t/2);
        }
        GEAR[id]=g;
      }
    }
  }
})();
/* effective stats of an owned gear piece {id, r} */
function gearStats(piece){
  const g=GEAR[piece.id]; if(!g)return{};
  const m=RARITY[piece.r||0].mult, out={};
  for(const k in g.stats)out[k]=Math.max(1,Math.round(g.stats[k]*m));
  return out;
}
function gearName(piece){const g=GEAR[piece.id];return RARITY[piece.r||0].name+g.name;}
function gearColor(piece){return RARITY[piece.r||0].color;}
/* shop stocks tier 1 of each line (Q7: shop basics, drops above) */
function gearPrice(g){return Math.round(20*Math.pow(2.1,g.tier-1)*(g.slot==='weapon'?1.6:1));}
function gearSellValue(piece){const g=GEAR[piece.id];
  return Math.max(1,Math.round(gearPrice(g)*0.25*RARITY[piece.r||0].mult));}

/* ---------------- capes ---------------- */
const CAPES={
  cape_attack:{skill:'attack',name:'Attack Cape',color:'#d9534f',perk:'+5% accuracy',price:5000},
  cape_strength:{skill:'strength',name:'Strength Cape',color:'#e07a5f',perk:'+5% melee damage',price:5000},
  cape_defence:{skill:'defence',name:'Defence Cape',color:'#7f9bd1',perk:'-5% damage taken',price:5000},
  cape_ranged:{skill:'ranged',name:'Ranged Cape',color:'#7fb069',perk:'10% chance to save arrows',price:5000},
  cape_magic:{skill:'magic',name:'Magic Cape',color:'#9b7fd1',perk:'10% chance to save runes',price:5000},
  cape_woodcutting:{skill:'woodcutting',name:'Woodcutting Cape',color:'#8a9a5b',perk:'+10% chop speed',price:5000},
  cape_mining:{skill:'mining',name:'Mining Cape',color:'#a08c78',perk:'+10% mine speed',price:5000},
  cape_max:{skill:null,name:'Max Cape',color:'#f0c419',perk:'All cape perks combined',price:25000},
};
function capePerkActive(capeId){
  const worn=P.gear.cape&&P.gear.cape.id;
  return worn===capeId||worn==='cape_max';
}

/* ---------------- consumables & materials ---------------- */
const ITEMS={
  logs:{name:'Logs',price:0,sell:3,stack:true},
  oak_logs:{name:'Oak Logs',price:0,sell:8,stack:true},
  copper_ore:{name:'Copper Ore',price:0,sell:5,stack:true},
  iron_ore:{name:'Iron Ore',price:0,sell:12,stack:true},
  bone:{name:'Bones',price:0,sell:2,stack:true},
  wolf_pelt:{name:'Wolf Pelt',price:0,sell:9,stack:true},
  ancient_dust:{name:'Ancient Dust',price:0,sell:18,stack:true},
  swamp_herb:{name:'Swamp Herb',price:0,sell:14,stack:true},
  gem:{name:'Gemstone',price:0,sell:60,stack:true},
  arrows:{name:'Arrows',price:2,sell:1,stack:true,ammo:true},
  runes:{name:'Runes',price:3,sell:1,stack:true,ammo:true},
  bread:{name:'Bread',price:8,sell:2,stack:true,heal:6},
  cooked_meat:{name:'Cooked Meat',price:0,sell:4,stack:true,heal:8},
  meat_pie:{name:'Meat Pie',price:25,sell:8,stack:true,heal:14},
  stew:{name:'Hearty Stew',price:55,sell:18,stack:true,heal:22},
};
/* tools (gathering) — implicit-best, bought at the forge */
const TOOLS={
  bronze_axe:{name:'Bronze Axe',slot:'axe',tier:1,speed:1,icon:['axe','#a9714b']},
  iron_axe:{name:'Iron Axe',slot:'axe',tier:2,speed:.7,price:120,icon:['axe','#b8c4cf']},
  steel_axe:{name:'Steel Axe',slot:'axe',tier:3,speed:.55,price:600,icon:['axe','#8f9aa5']},
  bronze_pick:{name:'Bronze Pickaxe',slot:'pick',tier:1,speed:1,icon:['pick','#a9714b']},
  iron_pick:{name:'Iron Pickaxe',slot:'pick',tier:2,speed:.7,price:120,icon:['pick','#b8c4cf']},
  steel_pick:{name:'Steel Pickaxe',slot:'pick',tier:3,speed:.55,price:600,icon:['pick','#8f9aa5']},
};
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
 town:{name:'Emberbrook',ground:'.',rows:[
  "XXXXXXXXXXXXXXXXXXXXXX",
  "X.RRRRR.......RRRRR..X",
  "X.RRRRR.......RRRRR..X",
  "X.RRRRR.......RRRRR..X",
  "X.........PP.....RRR.X",
  "X.........PP.....RRR.X",
  "X........QPP.........X",
  "XPPPPPPPPPPPPPPPPPPPPE",
  "XPPPPPPPPPPPPPPPPPPPPE",
  "X.........PP.........X",
  "X....H....PP.........X",
  "X..WWW....PP.........X",
  "X..WWW....PP.........X",
  "X.........PP.........X",
  "X.........PP.........X",
  "XXXXXXXXXXMMXXXXXXXXXX"],
  npcs:[{id:'banker',x:4,y:4},{id:'smith',x:16,y:4},{id:'elder',x:12,y:9},
        {id:'guard',x:19,y:9},{id:'skillmaster',x:18,y:6}],
  mobs:[],
  exits:[{x:21,y:7,map:'forest',tx:1,ty:8},{x:21,y:8,map:'forest',tx:1,ty:9},
         {x:10,y:15,map:'mines',tx:11,ty:1},{x:11,y:15,map:'mines',tx:12,ty:1}],
  labels:[{x:3.5,y:0.8,t:'BANK'},{x:16.5,y:0.8,t:'FORGE'},{x:18.5,y:3.7,t:'CAPES'},
          {x:5.5,y:9.7,t:'TROPHIES'}]},
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
  exits:[{x:0,y:8,map:'town',tx:20,ty:7},{x:0,y:9,map:'town',tx:20,ty:8},
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
  exits:[{x:11,y:0,map:'town',tx:10,ty:14},{x:12,y:0,map:'town',tx:11,ty:14},
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
const BLOCKED=new Set(['X','R','W','F','#','Q','U','S','~','H']);

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
    world[id]={grid,w,h:grid.length,res,mobs,drops:[],
      exits:m.exits,npcs:m.npcs.map(n=>({...n,...NPCS[n.id]})),labels:m.labels||[]};
  }
}
function tileAt(map,x,y){const W=world[map];if(x<0||y<0||x>=W.w||y>=W.h)return'X';return W.grid[y][x];}
function walkable(map,x,y){const c=tileAt(map,x,y);return !BLOCKED.has(c)&&!RES[c];}
function resAt(map,x,y){return world[map].res.find(r=>r.x===x&&r.y===y);}
function mobAt(map,x,y){return world[map].mobs.find(m=>m.alive&&m.tx===x&&m.ty===y);}
function npcAt(map,x,y){return world[map].npcs.find(n=>n.x===x&&n.y===y);}
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
  const zl=$('zone');zl.textContent=MAPS[P.map].name;
  zl.classList.remove('go');void zl.offsetWidth;zl.classList.add('go');
  save();
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
  if((att==='melee'&&def==='ranged')||(att==='ranged'&&def==='magic')||(att==='magic'&&def==='melee'))return 1.25;
  return 0.8;
}
/* player attack + max hit from skills, gear, style, capes */
function playerAttack(){
  const b=gearBonus(),m=combatMode();
  let accSkill = m==='ranged'?lvl('ranged') : m==='magic'?lvl('magic') : lvl('attack');
  let powSkill = m==='ranged'?lvl('ranged') : m==='magic'?lvl('magic') : lvl('strength');
  const w=P.gear.weapon&&GEAR[P.gear.weapon.id];
  const ws=w?gearStats(P.gear.weapon):{acc:2,pow:1};
  let acc = accSkill*2 + (ws.acc||0)*1.5 + 8;
  let pow = 1 + powSkill*0.35 + (ws.pow||0)*0.5
          + (m==='ranged'?b.rpow:m==='magic'?b.mpow:0)*0.5;
  if(m==='melee'&&P.style==='accurate')acc*=1.12;
  if(m==='melee'&&P.style==='aggressive')pow*=1.1;
  if(capePerkActive('cape_attack'))acc*=1.05;
  if(m==='melee'&&capePerkActive('cape_strength'))pow*=1.05;
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
  routeToTarget(n.x,n.y,true);
}
function setLoot(d){
  P.action={kind:'loot',x:d.x,y:d.y};
  routeToTarget(d.x,d.y,false); /* walk onto the drop tile */
}
function routeToTarget(x,y,adj){
  const path=findPath(P.map,P.tx,P.ty,x,y,adj);
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
          if(it.gear.r===4){P.stats.legendaries++;levelFlash('LEGENDARY! '+nm);}
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
  const rolls=d.boss?2:1;
  for(let i=0;i<rolls;i++){
    const e=lootRoll(d.loot);
    if(e.gold)out.gold+=rand(e.gold[0],e.gold[1]);
    else if(e.item)out.items.push({id:e.item,qty:rand(e.q[0],e.q[1])});
    else if(e.gear){
      const tier=rand(e.gear.tierMin,e.gear.tierMax);
      const lines=e.gear.line?[e.gear.line]:['m','r','g'];
      const line=lines[rand(0,lines.length-1)];
      const slots=Object.keys(LINE_DEFS[line].slots);
      const slot=slots[rand(0,slots.length-1)];
      out.items.push({gear:{id:`g_${line}_${tier}_${slot}`,r:rollRarity(d.rarityBoost||0)}});
    }
  }
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
    if(d.skill==='woodcutting'&&capePerkActive('cape_woodcutting'))speed*=0.9;
    if(d.skill==='mining'&&capePerkActive('cape_mining'))speed*=0.9;
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
        const saveCape=mode==='ranged'?'cape_ranged':'cape_magic';
        if(!(capePerkActive(saveCape)&&Math.random()<0.10))removeItem(ammo,1);
        if(invCount(ammo)===50)toast('Only 50 '+ITEMS[ammo].name+' left','bad');
      }
      P.atkT=T;
      const md=MOBS[t.type];
      const tri=triangle(mode,md.style);
      const chance=hitChance(atk.acc*(tri>1?1.1:tri<1?0.9:1), md.def*2+8);
      let dmg=0;
      if(Math.random()<chance)dmg=Math.max(1,Math.round(rand(1,atk.maxHit)*tri));
      if(mode==='ranged'){shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#d8d5c8');sfx('shoot');}
      else if(mode==='magic'){shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#b06fd1');sfx('zap');}
      else sfx('hit');
      t.hp-=dmg;
      floater(t.px+16,t.py-6,dmg>0?'-'+dmg:'miss',dmg>0?'#e85b4a':'#9aa');
      if(dmg>0){
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
  P.stats.kills++;
  if(d.boss){
    P.stats.bossKills[m.type]=(P.stats.bossKills[m.type]||0)+1;
    levelFlash(d.name+' defeated!');
  }
  questEvent('kill',m.type,P.map);
  const next=nearestMob(m.type,P.tx,P.ty);
  if(next)setFight(next);else P.action=null;
  save();
}
function hurtPlayer(dmg){
  if(capePerkActive('cape_defence'))dmg=Math.max(0,Math.round(dmg*0.95));
  if(dmg<=0){floater(P.px+16,P.py-10,'miss','#9aa');return;}
  P.hp-=dmg;P.lastHurt=T;sfx('hurt');
  floater(P.px+16,P.py-10,'-'+dmg,'#e85b4a');
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
  P.map='town';P.tx=11;P.ty=10;P.px=P.tx*TILE;P.py=P.ty*TILE;
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
          const chance=hitChance(d.acc*2+8,playerDefence()*(tri>1?0.92:1));
          let dmg=0;
          if(Math.random()<chance)dmg=Math.max(1,Math.round(rand(1,Math.max(1,Math.floor(1+d.pow*0.45)))*tri));
          if(d.style==='ranged')shoot(m.px+16,m.py+8,P.px+16,P.py+8,'#d8d5c8');
          if(d.style==='magic')shoot(m.px+16,m.py+8,P.px+16,P.py+8,'#b06fd1');
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
  updateHUD();
}
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
/* p7: UI panels — inventory (equip/eat/drop), equipment paper-doll,
       skills with overflow + capes, shop (buy tabs + bulk sell by rarity),
       bank (items + gear), quest log & board, trophy monument,
       Master Aldric's capes, settings (sound/save/export/sync) */
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const ICONURL={};
function iconURL(id){
  if(!ICONURL[id]&&ICON[id])ICONURL[id]=ICON[id].toDataURL();
  return ICONURL[id]||'';
}
function openPanel(title,html){
  $('ptitle').textContent=title;
  $('pbody').innerHTML=html;
  $('panel').classList.add('open');
}
function closePanel(){$('panel').classList.remove('open');}
function closeDialog(){$('dialog').classList.remove('open');}

function nameOf(s){ // inventory entry display name
  return s.gear?gearName(s.gear):(ITEMS[s.id]?ITEMS[s.id].name:s.id);
}
function slotHtml(s,i,act){
  const id=s.gear?s.gear.id:s.id;
  const rim=s.gear?' style="box-shadow:inset 0 0 0 2px '+gearColor(s.gear)+'55"':'';
  return '<div class="slot" data-act="'+act+'" data-arg="'+i+'"'+rim+'>'+
    '<img src="'+iconURL(id)+'" alt=""><span class="qty">'+(!s.gear&&s.qty>1?s.qty:'')+'</span></div>';
}

/* ---------------- inventory ---------------- */
function openInventory(){
  let h='<div class="grid">';
  P.inv.forEach((s,i)=>h+=slotHtml(s,i,'invinfo'));
  for(let i=P.inv.length;i<INV_CAP;i++)h+='<div class="slot empty"></div>';
  h+='</div><div id="iteminfo" class="iteminfo"></div>';
  h+='<button class="btn" data-act="openequip">⚔ Equipment</button>';
  openPanel('Inventory ('+P.inv.length+'/'+INV_CAP+')',h);
}
function invInfoHtml(i){
  const s=P.inv[i];if(!s)return'';
  if(s.gear){
    const st=gearStats(s.gear),g=GEAR[s.gear.id];
    const stats=Object.entries(st).map(([k,v])=>k+' +'+v).join(' · ');
    const chk=canEquip(s.gear);
    return '<b style="color:'+gearColor(s.gear)+'">'+esc(gearName(s.gear))+'</b><br>'+
      esc(stats)+'<br><span class="hint">'+SKILLS[g.reqSkill].name+' '+g.req+
      (g.spd?' · speed '+(g.spd/1000)+'s':'')+ (g.ammo?' · uses '+ITEMS[g.ammo].name:'')+'</span><br>'+
      (chk.ok?'<button class="btn small" data-act="equip" data-arg="'+i+'">Equip</button>'
             :'<span class="tag locked">'+esc(chk.why)+'</span>')+
      ' <button class="btn small danger" data-act="drop" data-arg="'+i+'">Drop</button>';
  }
  const def=ITEMS[s.id];
  return esc(def.name)+' × '+s.qty+(def.heal?' · heals '+def.heal:'')+' · sells '+def.sell+'g'+
    '<br>'+(def.heal?'<button class="btn small" data-act="eat" data-arg="'+i+'">Eat</button> ':'')+
    '<button class="btn small danger" data-act="drop" data-arg="'+i+'">Drop</button>';
}

/* ---------------- equipment ---------------- */
const SLOT_LABEL={weapon:'Weapon',shield:'Shield',helmet:'Helmet',body:'Body',legs:'Legs',cape:'Cape'};
function openEquipment(){
  const b=gearBonus();
  let h='<div class="equipgrid">';
  for(const slot of ['helmet','cape','weapon','body','shield','legs']){
    const pc=P.gear[slot];
    if(pc&&(GEAR[pc.id]||CAPES[pc.id])){
      const nm=CAPES[pc.id]?CAPES[pc.id].name:gearName(pc);
      const col=CAPES[pc.id]?CAPES[pc.id].color:gearColor(pc);
      h+='<div class="eqslot" data-act="unequip" data-arg="'+slot+'" style="border-color:'+col+'88">'+
        '<img src="'+iconURL(pc.id)+'" alt=""><span>'+esc(nm)+'</span></div>';
    }else h+='<div class="eqslot empty"><span>'+SLOT_LABEL[slot]+'</span></div>';
  }
  h+='</div>';
  h+='<div class="hint">Tap a piece to unequip · HP +'+(maxHp()-10)+' from gear</div>';
  h+='<div class="statline">acc +'+Math.round(b.acc)+' · pow +'+Math.round(b.pow)+
     ' · def +'+Math.round(b.def)+(b.rpow?' · ranged +'+b.rpow:'')+(b.mpow?' · magic +'+b.mpow:'')+'</div>';
  if(combatMode()==='melee'){
    h+='<div class="sect">Melee style — trains the chosen skill</div><div class="stylerow">';
    for(const[st,label,sk]of[['accurate','🎯 Accurate','attack'],['aggressive','⚔️ Aggressive','strength'],['defensive','🛡️ Defensive','defence']])
      h+='<button class="btn small'+(P.style===st?' sel':'')+'" data-act="style" data-arg="'+st+'">'+label+'<br><span class="hint">'+SKILLS[sk].name+'</span></button>';
    h+='</div>';
  }else h+='<div class="hint">'+(combatMode()==='ranged'?'Bow equipped — combat trains Ranged (uses Arrows)':'Staff equipped — combat trains Magic (uses Runes)')+'</div>';
  openPanel('Equipment',h);
}

/* ---------------- skills ---------------- */
function fmtXp(n){return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':''+n;}
function openSkills(){
  let h='';
  for(const s of SKILL_ORDER){
    const l=lvl(s),cur=P.xp[s]-xpAt(l),need=xpAt(l+1)-xpAt(l);
    const capeB=P.capes.includes('cape_'+s)?' <span class="tag gold">🎽</span>':'';
    h+='<div class="skillrow"><div class="skillname">'+SKILLS[s].name+capeB+
      '</div><div class="skilllvl">'+l+'</div>'+
      '<div class="bar"><div class="fill" style="width:'+(l>=MAX_LVL?100:100*cur/need)+'%;background:'+SKILLS[s].color+'"></div></div>'+
      '<div class="xpnum">'+(l>=MAX_LVL?'MAX · '+fmtXp(P.xp[s])+' xp':cur+' / '+need+' xp')+'</div></div>';
  }
  h+='<div class="skillrow"><div class="skillname"><b>Total level</b></div><div class="skilllvl"><b>'+totalLevel()+'</b></div><div></div><div class="xpnum">'+(SKILL_ORDER.length*MAX_LVL)+' max</div></div>';
  h+='<div class="hint">Unlocks — Woodcutting 5: Oaks · Mining 8: Iron · gear tiers at 1/5/15/25/35/45</div>';
  openPanel('Skills',h);
}

/* ---------------- quests & dailies ---------------- */
function questRow(id){
  const q=QUESTS[id],st=questState(id);
  const prog=P.questProg[id]||0;
  let right='';
  if(st==='locked')right='<span class="tag locked">locked</span>';
  else if(st==='available')right='<span class="tag">'+esc(NPCS[q.giver].name)+'</span>';
  else if(st==='active')right='<span class="tag active">'+prog+' / '+q.need+'</span>';
  else if(st==='ready')right='<span class="tag ready">turn in!</span>';
  else right='<span class="tag done">✓ done</span>';
  return '<div class="qrow'+(st==='locked'?' dim':'')+'"><span>'+esc(q.name)+'</span>'+right+'</div>';
}
function dailyRows(){
  let h='';
  (P.daily.tasks||[]).forEach(tid=>{
    const t=DAILY_POOL.find(d=>d.id===tid);if(!t)return;
    const prog=P.daily.prog[tid]||0;
    let btn;
    if(P.daily.claimed.includes(tid))btn='<span class="tag done">✓</span>';
    else if(prog>=t.need)btn='<button class="btn small" data-act="claimdaily" data-arg="'+tid+'">Claim '+t.gold+'g</button>';
    else btn='<span class="tag active">'+Math.min(prog,t.need)+' / '+t.need+'</span>';
    h+='<div class="qrow"><span>'+esc(t.desc)+'</span>'+btn+'</div>';
  });
  h+='<div class="hint">New tasks daily · login streak: '+P.login.streak+' 🔥</div>';
  return h;
}
function openQuests(){
  let h='<div class="sect">Quests</div>';
  QUEST_ORDER.forEach(id=>h+=questRow(id));
  h+='<div class="sect">Daily tasks</div>'+dailyRows();
  openPanel('Quest Log',h);
}
function openQuestBoard(){
  openPanel('Quest Board',
    '<div class="sect">Daily tasks — '+todayStr()+'</div>'+dailyRows()+
    '<div class="sect">Notices</div>'+QUEST_ORDER.map(questRow).join(''));
}

/* ---------------- monument (personal trophy hall) ---------------- */
function fmtPlay(ms){const h=Math.floor(ms/36e5),m=Math.floor(ms/6e4)%60;return h+'h '+m+'m';}
function openMonument(){
  const s=P.stats;
  const bosses=Object.keys(MOBS).filter(k=>MOBS[k].boss);
  let h='<div class="sect">Hero of Emberbrook</div>';
  h+='<div class="qrow"><span>Total level</span><b>'+totalLevel()+' / '+(SKILL_ORDER.length*MAX_LVL)+'</b></div>';
  h+='<div class="qrow"><span>Play time</span><b>'+fmtPlay(s.playMs)+'</b></div>';
  h+='<div class="qrow"><span>Monsters slain</span><b>'+s.kills+'</b></div>';
  h+='<div class="qrow"><span>Deaths</span><b>'+s.deaths+'</b></div>';
  h+='<div class="qrow"><span>Logs · Ores</span><b>'+s.chopped+' · '+s.mined+'</b></div>';
  h+='<div class="qrow"><span>Legendary drops</span><b>'+s.legendaries+'</b></div>';
  if(s.bestDrop)h+='<div class="qrow"><span>Finest treasure</span><b>'+esc(s.bestDrop)+'</b></div>';
  h+='<div class="sect">Bosses</div>';
  for(const b of bosses)
    h+='<div class="qrow"><span>'+esc(MOBS[b].name)+'</span>'+
      ((P.stats.bossKills[b]||0)>0?'<b>× '+P.stats.bossKills[b]+'</b>':'<span class="tag locked">unseen</span>')+'</div>';
  h+='<div class="sect">Capes of Accomplishment</div><div class="qrow" style="flex-wrap:wrap;gap:4px">';
  const owned=Object.keys(CAPES).filter(c=>P.capes.includes(c));
  if(owned.length)owned.forEach(c=>h+='<span class="tag gold" style="border-color:'+CAPES[c].color+'">'+esc(CAPES[c].name)+'</span>');
  else h+='<span class="hint">None yet — master a skill to 50!</span>';
  h+='</div>';
  openPanel('Town Monument',h);
}

/* ---------------- bank ---------------- */
function openBank(){
  let h='<div class="sect">Your bag — tap to deposit</div><div class="grid small">';
  P.inv.forEach((s,i)=>h+=slotHtml(s,i,'deposit'));
  if(!P.inv.length)h+='<div class="hint" style="grid-column:1/-1">Bag is empty</div>';
  h+='</div><div class="sect">Vault — tap to withdraw</div><div class="grid small">';
  const keys=Object.keys(P.bank).filter(k=>P.bank[k]>0);
  keys.forEach(k=>h+='<div class="slot" data-act="withdraw" data-arg="'+k+'">'+
    '<img src="'+iconURL(k)+'" alt=""><span class="qty">'+P.bank[k]+'</span></div>');
  P.bankGear.forEach((pc,i)=>h+='<div class="slot" data-act="withdrawgear" data-arg="'+i+
    '" style="box-shadow:inset 0 0 0 2px '+gearColor(pc)+'55"><img src="'+iconURL(pc.id)+'" alt=""></div>');
  if(!keys.length&&!P.bankGear.length)h+='<div class="hint" style="grid-column:1/-1">Vault is empty</div>';
  h+='</div><button class="btn" data-act="depositall">Deposit everything</button>';
  openPanel('Bank of Emberbrook',h);
}

/* ---------------- shop ---------------- */
let shopTab='buy';
function openShop(){
  let h='<div class="stylerow">'+
    '<button class="btn small'+(shopTab==='buy'?' sel':'')+'" data-act="shoptab" data-arg="buy">Buy</button>'+
    '<button class="btn small'+(shopTab==='sell'?' sel':'')+'" data-act="shoptab" data-arg="sell">Sell</button></div>';
  if(shopTab==='buy'){
    h+='<div class="sect">Starter gear (better gear drops from monsters)</div>';
    for(const L of['m','r','g']){
      for(const slot in LINE_DEFS[L].slots){
        const g=GEAR['g_'+L+'_1_'+slot],pr=gearPrice(g);
        h+='<div class="qrow"><span><img class="mini" src="'+iconURL(g.id)+'" alt=""> '+esc(g.name)+'</span>'+
          '<button class="btn small'+(P.gold<pr?' dim':'')+'" data-act="buygear" data-arg="'+g.id+'">'+pr+'g</button></div>';
      }
    }
    h+='<div class="sect">Supplies</div>';
    for(const[id,q]of[['arrows',25],['runes',25],['bread',1],['meat_pie',1],['stew',1]]){
      const def=ITEMS[id],pr=def.price*q;
      h+='<div class="qrow"><span><img class="mini" src="'+iconURL(id)+'" alt=""> '+esc(def.name)+(q>1?' × '+q:'')+'</span>'+
        '<button class="btn small'+(P.gold<pr?' dim':'')+'" data-act="buyitem" data-arg="'+id+':'+q+'">'+pr+'g</button></div>';
    }
    h+='<div class="sect">Tools</div>';
    for(const id in TOOLS){
      const t=TOOLS[id];if(!t.price)continue;
      const owned=P.ownedTools.includes(id);
      h+='<div class="qrow"><span><img class="mini" src="'+iconURL(id)+'" alt=""> '+esc(t.name)+'</span>'+
        (owned?'<span class="tag done">owned</span>'
        :'<button class="btn small'+(P.gold<t.price?' dim':'')+'" data-act="buytool" data-arg="'+id+'">'+t.price+'g</button>')+'</div>';
    }
  }else{
    h+='<div class="sect">Tap a stack or piece to sell</div><div class="grid small">';
    let any=false;
    P.inv.forEach((s,i)=>{
      if(s.gear){any=true;h+=slotHtml(s,i,'sellgear');}
      else if(ITEMS[s.id]&&ITEMS[s.id].sell){any=true;h+=slotHtml(s,i,'sell');}
    });
    if(!any)h+='<div class="hint" style="grid-column:1/-1">Nothing to sell — go adventuring!</div>';
    h+='</div><div class="sect">Bulk sell gear by rarity</div><div class="stylerow" style="flex-wrap:wrap">';
    for(let r=0;r<RARITY.length;r++){
      const n=P.inv.filter(s=>s.gear&&(s.gear.r||0)===r).length;
      if(n)h+='<button class="btn small" data-act="bulksell" data-arg="'+r+'" style="border-color:'+RARITY[r].color+'">'+
        (RARITY[r].name||'Common ').trim()+' × '+n+'</button>';
    }
    h+='</div>';
  }
  openPanel("Torvald's Forge — gold: "+P.gold,h);
}

/* ---------------- Master Aldric (capes) ---------------- */
function openCapes(){
  let h='<div class="sect">Capes of Accomplishment — 5,000g each at level 50</div>';
  for(const s of SKILL_ORDER){
    const cid='cape_'+s,c=CAPES[cid];
    const at50=lvl(s)>=MAX_LVL,owned=P.capes.includes(cid);
    h+='<div class="qrow"><span><img class="mini" src="'+iconURL(cid)+'" alt=""> '+esc(c.name)+
      ' <span class="hint">'+esc(c.perk)+'</span></span>'+
      (owned?'<button class="btn small" data-act="wearcape" data-arg="'+cid+'">Wear</button>'
      :at50?'<button class="btn small'+(P.gold<c.price?' dim':'')+'" data-act="buycape" data-arg="'+cid+'">'+c.price+'g</button>'
      :'<span class="tag locked">'+SKILLS[s].name+' 50</span>')+'</div>';
  }
  const allMax=SKILL_ORDER.every(s=>lvl(s)>=MAX_LVL);
  const mc=CAPES.cape_max,mcOwned=P.capes.includes('cape_max');
  h+='<div class="sect">The Max Cape</div>';
  h+='<div class="qrow"><span><img class="mini" src="'+iconURL('cape_max')+'" alt=""> '+esc(mc.name)+
    ' <span class="hint">'+esc(mc.perk)+'</span></span>'+
    (mcOwned?'<button class="btn small" data-act="wearcape" data-arg="cape_max">Wear</button>'
    :allMax?'<button class="btn small'+(P.gold<mc.price?' dim':'')+'" data-act="buycape" data-arg="cape_max">'+mc.price+'g</button>'
    :'<span class="tag locked">All skills 50</span>')+'</div>';
  openPanel("Master Aldric's Capes",h);
}

/* ---------------- settings + cloud sync ---------------- */
function syncStatusText(){
  return SYNC.state==='ok'?'✓ synced '+new Date(SYNC.lastOk).toLocaleTimeString()
    :SYNC.state==='err'?'⚠ '+SYNC.err:SYNC.state==='off'?'off':'…';
}
function openSettings(){
  const tok=store.get('eb_token')||'';
  openPanel('Settings',
    '<div class="qrow"><span>Sound</span><button class="btn small" data-act="togglesound">'+(soundOn?'On':'Off')+'</button></div>'+
    '<div class="qrow"><span>Save</span><button class="btn small" data-act="savenow">Save now</button></div>'+
    '<div class="sect">Cloud sync (this server)</div>'+
    '<div class="qrow"><span>Secret token</span></div>'+
    '<input id="tokinput" class="tokinput" type="password" placeholder="EMBERBROOK_TOKEN" value="'+esc(tok)+'">'+
    '<div class="qrow"><span>Status: <span id="syncstat">'+syncStatusText()+'</span></span>'+
    '<button class="btn small" data-act="syncnow">Sync now</button></div>'+
    '<div class="hint">Same token on phone and desktop = shared character. Newest save wins.</div>'+
    '<div class="sect">Backup</div>'+
    '<div class="qrow"><span>Export / import save</span>'+
    '<button class="btn small" data-act="exportsave">Export</button> '+
    '<button class="btn small" data-act="importsave">Import</button></div>'+
    '<textarea id="savetext" class="tokinput" rows="3" placeholder="Save code appears / paste here"></textarea>'+
    '<div class="qrow"><span>Reset character</span><button class="btn small danger" data-act="reset">Reset</button></div>'+
    (store.mem?'<div class="hint">⚠ Storage unavailable — progress lasts this session only.</div>':'')+
    '<div class="hint">Emberbrook v2 — tap to move · tap things to act</div>');
}

/* ---------------- NPC dialog ---------------- */
const NPC_LINE={banker:'Your valuables are safe with me.',
  smith:'Finest steel in the valley. Care to trade?',
  elder:'Emberbrook needs able hands, traveller.',
  skillmaster:'Only true masters may wear my capes.'};
function openDialog(npc){
  $('dname').textContent=npc.name;
  const lines=NPCS[npc.id].lines;
  $('dtext').textContent=lines?lines[rand(0,lines.length-1)]:(NPC_LINE[npc.id]||'Well met.');
  const opts=$('dopts');opts.innerHTML='';
  for(const qid of QUEST_ORDER){
    if(QUESTS[qid].giver!==npc.id)continue;
    const st=questState(qid),q=QUESTS[qid];
    if(st==='available')addOpt(opts,'📜 '+q.name,()=>{
      P.quests[qid]='active';P.questProg[qid]=0;
      $('dtext').textContent=q.desc;opts.innerHTML='';addOpt(opts,"I'll get it done.",closeDialog);
      save();
    });
    if(st==='ready')addOpt(opts,'✅ Turn in: '+q.name,()=>{
      P.quests[qid]='done';P.stats.questsDone++;
      const r=q.reward;
      if(r.gold){addGold(r.gold);sfx('coin');toast('+'+r.gold+'g','gold');}
      if(r.xp)for(const s in r.xp)gainXp(s,r.xp[s]);
      if(r.gear){
        if(addGear(r.gear))toast('+ '+gearName(r.gear),'gold');
        else{spawnDrop(P.map,P.tx,P.ty,{items:[{gear:r.gear}]});toast('Bag full — reward dropped at your feet!','bad');}
      }
      $('dtext').textContent='Well done, traveller!';opts.innerHTML='';addOpt(opts,'Thanks!',closeDialog);
      save();
    });
    if(st==='active')addOpt(opts,'📜 '+q.name+' ('+(P.questProg[qid]||0)+'/'+q.need+')',()=>{
      $('dtext').textContent=q.desc;});
  }
  if(npc.role==='bank')addOpt(opts,'🏦 Open bank',()=>{closeDialog();openBank();});
  if(npc.role==='shop')addOpt(opts,'⚒ Trade',()=>{closeDialog();openShop();});
  if(npc.role==='capes')addOpt(opts,'🎽 Capes of Accomplishment',()=>{closeDialog();openCapes();});
  addOpt(opts,'Farewell.',closeDialog);
  $('dialog').classList.add('open');
}
function addOpt(container,label,fn){
  const b=document.createElement('button');b.className='btn dopt';b.textContent=label;
  b.addEventListener('click',fn);container.appendChild(b);
}

/* ---------------- panel action delegation ---------------- */
function bindUI(){
$('pclose').addEventListener('click',closePanel);
$('dclose').addEventListener('click',closeDialog);
$('panel').addEventListener('click',ev=>{if(ev.target.id==='panel')closePanel();});
$('dialog').addEventListener('click',ev=>{if(ev.target.id==='dialog')closeDialog();});
$('pbody').addEventListener('click',ev=>{
  const el=ev.target.closest('[data-act]');if(!el)return;
  const act=el.dataset.act,arg=el.dataset.arg;
  if(act==='invinfo'){$('iteminfo').innerHTML=invInfoHtml(+arg);}
  else if(act==='equip'){equipGear(+arg);rebuildPlayerSprite();openInventory();}
  else if(act==='unequip'){unequip(arg);rebuildPlayerSprite();openEquipment();}
  else if(act==='openequip'){openEquipment();}
  else if(act==='eat'){eatFood(+arg);openInventory();}
  else if(act==='style'){P.style=arg;save();openEquipment();updateHUD();}
  else if(act==='drop'){
    const s=P.inv[+arg];if(!s)return;
    P.inv.splice(+arg,1);
    spawnDrop(P.map,P.tx,P.ty,s.gear?{items:[{gear:s.gear}]}:{items:[{id:s.id,qty:s.qty}]});
    openInventory();
  }
  else if(act==='deposit'){
    const s=P.inv[+arg];if(!s)return;
    if(s.gear)P.bankGear.push(s.gear);
    else P.bank[s.id]=(P.bank[s.id]||0)+s.qty;
    P.inv.splice(+arg,1);openBank();
  }
  else if(act==='depositall'){
    P.inv.forEach(s=>{if(s.gear)P.bankGear.push(s.gear);else P.bank[s.id]=(P.bank[s.id]||0)+s.qty;});
    P.inv=[];openBank();
  }
  else if(act==='withdraw'){const q=P.bank[arg]||0;if(q&&addItem(arg,q)){delete P.bank[arg];openBank();}else if(q)toast('Bag is full!');}
  else if(act==='withdrawgear'){const pc=P.bankGear[+arg];if(pc&&addGear(pc)){P.bankGear.splice(+arg,1);openBank();}else toast('Bag is full!');}
  else if(act==='shoptab'){shopTab=arg;openShop();}
  else if(act==='sell'){const s=P.inv[+arg];if(s&&ITEMS[s.id]){const g=ITEMS[s.id].sell*s.qty;P.inv.splice(+arg,1);addGold(g);sfx('coin');toast('Sold for '+g+'g','gold');openShop();}}
  else if(act==='sellgear'){const s=P.inv[+arg];if(s&&s.gear){const g=gearSellValue(s.gear);P.inv.splice(+arg,1);addGold(g);sfx('coin');toast('Sold '+gearName(s.gear)+' for '+g+'g','gold');openShop();}}
  else if(act==='bulksell'){
    const r=+arg;let g=0,n=0;
    P.inv=P.inv.filter(s=>{if(s.gear&&(s.gear.r||0)===r){g+=gearSellValue(s.gear);n++;return false;}return true;});
    if(n){addGold(g);sfx('coin');toast('Sold '+n+' pieces for '+g+'g','gold');}
    openShop();
  }
  else if(act==='buygear'){
    const g=GEAR[arg],pr=gearPrice(g);
    if(P.gold<pr){toast('Not enough gold.');return;}
    if(P.inv.length>=INV_CAP){toast('Inventory full!');return;}
    P.gold-=pr;addGear({id:arg,r:0});sfx('coin');openShop();updateHUD();
  }
  else if(act==='buyitem'){
    const[id,q]=arg.split(':');const def=ITEMS[id],pr=def.price*(+q);
    if(P.gold<pr){toast('Not enough gold.');return;}
    if(!addItem(id,+q)){toast('Inventory full!');return;}
    P.gold-=pr;sfx('coin');openShop();updateHUD();
  }
  else if(act==='buytool'){
    const t=TOOLS[arg];
    if(P.gold<t.price){toast('Not enough gold.');return;}
    P.gold-=t.price;P.ownedTools.push(arg);
    if(TOOLS[P.tools[t.slot]].tier<t.tier)P.tools[t.slot]=arg;
    sfx('coin');toast('⚒ '+t.name+' ready!','gold');openShop();updateHUD();
  }
  else if(act==='buycape'){
    const c=CAPES[arg];
    if(P.gold<c.price){toast('Not enough gold.');return;}
    P.gold-=c.price;P.capes.push(arg);
    sfx('level');toast('🎽 '+c.name+' earned!','gold');
    openCapes();updateHUD();save();
  }
  else if(act==='wearcape'){equipCape(arg);rebuildPlayerSprite();openCapes();}
  else if(act==='claimdaily'){
    const t=DAILY_POOL.find(d=>d.id===arg);
    if(t&&!P.daily.claimed.includes(arg)&&(P.daily.prog[arg]||0)>=t.need){
      P.daily.claimed.push(arg);addGold(t.gold);sfx('coin');
      toast('Daily reward: +'+t.gold+'g','gold');save();openQuestBoard();
    }
  }
  else if(act==='togglesound'){soundOn=!soundOn;openSettings();}
  else if(act==='savenow'){save();toast('Game saved.');}
  else if(act==='syncnow'){
    const tok=($('tokinput')&&$('tokinput').value.trim())||'';
    store.set('eb_token',tok);
    syncNow(true).then(()=>{const el=$('syncstat');if(el)el.textContent=syncStatusText();});
  }
  else if(act==='exportsave'){
    $('savetext').value=btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))));
    $('savetext').select();toast('Save code ready — copy it somewhere safe.');
  }
  else if(act==='importsave'){
    try{
      const txt=$('savetext').value.trim();if(!txt)return toast('Paste a save code first.','bad');
      const d=JSON.parse(decodeURIComponent(escape(atob(txt))));
      applySave(d);rebuildPlayerSprite();save();
      toast('Save imported!','good');closePanel();
    }catch(e){toast('Invalid save code.','bad');}
  }
  else if(act==='reset'){if(confirm('Delete this character and start over?'))resetSave();}
});
$('bInv').addEventListener('click',()=>{ensureAudio();openInventory();});
$('bEquip').addEventListener('click',()=>{ensureAudio();openEquipment();});
$('bSkills').addEventListener('click',()=>{ensureAudio();openSkills();});
$('bQuests').addEventListener('click',()=>{ensureAudio();openQuests();});
$('bGear').addEventListener('click',()=>{ensureAudio();openSettings();});
const sb=$('stylebtn');
if(sb)sb.addEventListener('click',()=>{
  const order=['accurate','aggressive','defensive'];
  P.style=order[(order.indexOf(P.style)+1)%order.length];
  toast('Style: '+P.style+' (trains '+SKILLS[trainSkill()].name+')');
  updateHUD();save();
});
}
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
cv.addEventListener('pointerdown',ev=>{
  ensureAudio();
  if($('panel').classList.contains('open')||$('dialog').classList.contains('open'))return;
  const rect=cv.getBoundingClientRect();
  const{camx,camy}=camera();
  const wx=(ev.clientX-rect.left)/SCALE+camx,wy=(ev.clientY-rect.top)/SCALE+camy;
  const tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE);
  /* priority: drop > mob (incl. boss body) > npc > resource/canopy > board/monument > walk */
  const d=dropAt(P.map,tx,ty);
  if(d){setLoot(d);clickMark={x:tx,y:ty,t0:T};return;}
  const m=mobAt(P.map,tx,ty)||world[P.map].mobs.find(mm=>{
    if(!mm.alive)return false;
    const big=MOBS[mm.type].boss?30:18;
    return Math.abs(mm.px+16-wx)<big&&Math.abs(mm.py+16-(MOBS[mm.type].boss?16:0)-wy)<big;
  });
  if(m){setFight(m);clickMark={x:m.tx,y:m.ty,t0:T};return;}
  const n=npcAt(P.map,tx,ty);
  if(n){setTalk(n);clickMark={x:n.x,y:n.y,t0:T};return;}
  let r=resAt(P.map,tx,ty);
  if(!r){ /* canopy: trees render one tile tall above their base */
    const below=resAt(P.map,tx,ty+1);
    if(below&&RES[below.type].skill==='woodcutting')r=below;
  }
  if(tileAt(P.map,tx,ty)==='Q'){openQuestBoard();clickMark={x:tx,y:ty,t0:T};return;}
  if(tileAt(P.map,tx,ty)==='H'){openMonument();clickMark={x:tx,y:ty,t0:T};return;}
  if(r&&r.alive){setGather(r);clickMark={x:r.x,y:r.y,t0:T};return;}
  if(walkable(P.map,tx,ty)){
    P.action=null;
    const path=findPath(P.map,P.tx,P.ty,tx,ty,false);
    if(path){P.path=path;clickMark={x:tx,y:ty,t0:T};}
  }
});
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
    P.gear.weapon={id:'g_m_1_weapon',r:0};addItem('bread',5);rebuildPlayerSprite();
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
window.EB={world,MAPS,ITEMS,TOOLS,GEAR,MOBS,CAPES,RARITY,QUESTS,
 update,camera,setGather,setFight,setLoot,openBank,openShop,openInventory,openEquipment,
 openSkills,openQuests,openQuestBoard,openSettings,openDialog,openMonument,openCapes,
 addItem,addGear,invCount,equipGear,unequip,gearBonus,playerAttack,rollLoot,rollRarity,
 spawnDrop,pickupDrop,killMob,eatFood,save,load,serialize,applySave,migrateV1,
 hurtPlayer,die,maxHp,lvlFor,totalLevel,questState,freshPlayer,rebuildPlayerSprite,
 syncNow,syncPull,syncPush,
 get P(){return P},set P(v){P=v},get T(){return T},get SCALE(){return SCALE}};
boot();

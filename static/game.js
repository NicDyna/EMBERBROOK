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
/* ambient RNG — a self-contained LCG for cosmetic randomness (NPC milling,
   idle timing) kept OFF Math.random so it never perturbs the gameplay/loot
   stream (which keeps combat-balance tests deterministic). */
let _amb=0x9e3779b9>>>0;
const _ambNext=()=>{_amb=(Math.imul(_amb,1664525)+1013904223)>>>0;return _amb/4294967296;};
const ambRand=(a,b)=>a+Math.floor(_ambNext()*(b-a+1));
const ambChance=p=>_ambNext()<p;
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
/* p2: world data — resources, biome mobs (styles + loot tables), dungeon
       semi-bosses & bosses, NPCs, quests, dailies, the walled town + four
       huge biome regions (Forest→Mountains→Plains→Desert) each with a
       dungeon, procedural region builder, and pathfinding.

   World shape (single linear chain, town has ONE south gate):
     Town → Forest → Mountains → Plains → Desert
     each region holds a Dungeon (semi-boss + boss, the best loot). */

/* ---------------- gatherable resources ----------------
   Overworld gathering. Y/Z are the high-tier biome nodes (mountains/desert). */
const RES={
  T:{name:'Tree',skill:'woodcutting',lvl:1,xp:12,item:'logs',time:2200,respawn:6000,hp:3},
  O:{name:'Oak',skill:'woodcutting',lvl:5,xp:26,item:'oak_logs',time:2800,respawn:9000,hp:4},
  Y:{name:'Frostpine',skill:'woodcutting',lvl:15,xp:44,item:'oak_logs',time:3200,respawn:11000,hp:5},
  C:{name:'Copper Rock',skill:'mining',lvl:1,xp:14,item:'copper_ore',time:2400,respawn:7000,hp:3},
  I:{name:'Iron Rock',skill:'mining',lvl:8,xp:30,item:'iron_ore',time:3000,respawn:10000,hp:4},
  Z:{name:'Crystal Vein',skill:'mining',lvl:18,xp:58,item:'gem',time:3600,respawn:15000,hp:5},
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
  spider:{name:'Forest Spider',lvl:4,hp:14,style:'melee',acc:7,pow:4,def:3,spd:2400,range:1,
    aggro:false,xp:24,gold:[2,7],
    loot:[{w:48,gold:[2,7]},{w:20,item:'bone',q:[1,1]},{w:12,item:'bread',q:[1,1]},
          {w:10,gear:{tierMin:1,tierMax:2}},{w:10,item:'cooked_meat',q:[1,1]}]},
  boar:{name:'Wild Boar',lvl:6,hp:22,style:'melee',acc:9,pow:6,def:5,spd:2200,range:1,
    aggro:true,xp:34,gold:[0,4],
    loot:[{w:44,item:'wolf_pelt',q:[1,1]},{w:24,item:'cooked_meat',q:[1,2]},
          {w:20,item:'bone',q:[1,2]},{w:12,gear:{tierMin:1,tierMax:2}}]},
  bandit:{name:'Forest Bandit',lvl:9,hp:28,style:'ranged',acc:12,pow:7,def:6,spd:2800,range:4,
    aggro:true,xp:46,gold:[6,16],
    loot:[{w:34,gold:[6,16]},{w:22,item:'arrows',q:[6,14]},{w:16,item:'bread',q:[1,2]},
          {w:16,gear:{tierMin:1,tierMax:2}},{w:12,item:'copper_ore',q:[1,1]}]},

  /* ===== Frostpeak Mountains — snow (lvl 14–24) ===== */
  frost_wolf:{name:'Frost Wolf',lvl:15,hp:40,style:'melee',acc:16,pow:11,def:10,spd:2100,range:1,
    aggro:true,xp:72,gold:[4,12],
    loot:[{w:40,item:'wolf_pelt',q:[1,2]},{w:24,item:'cooked_meat',q:[1,2]},
          {w:18,item:'bone',q:[1,3]},{w:18,gear:{tierMin:2,tierMax:3}}]},
  ice_sprite:{name:'Ice Sprite',lvl:18,hp:36,style:'magic',acc:19,pow:13,def:10,spd:2800,range:4,
    aggro:true,xp:92,gold:[8,20],
    loot:[{w:30,gold:[8,20]},{w:24,item:'runes',q:[6,16]},{w:18,item:'gem',q:[1,1]},
          {w:18,gear:{tierMin:2,tierMax:4}},{w:10,item:'meat_pie',q:[1,1]}]},
  snow_troll:{name:'Snow Troll',lvl:22,hp:68,style:'melee',acc:22,pow:15,def:18,spd:2800,range:1,
    aggro:true,xp:130,gold:[10,26],
    loot:[{w:30,gold:[10,26]},{w:22,item:'iron_ore',q:[1,2]},{w:20,gear:{tierMin:3,tierMax:4}},
          {w:16,item:'bone',q:[2,4]},{w:12,item:'gem',q:[1,1]}]},

  /* ===== Golden Plains — savanna (lvl 26–36) ===== */
  steppe_lion:{name:'Steppe Lion',lvl:26,hp:74,style:'melee',acc:25,pow:16,def:16,spd:2200,range:1,
    aggro:true,xp:150,gold:[12,30],
    loot:[{w:34,item:'wolf_pelt',q:[1,3]},{w:24,item:'cooked_meat',q:[2,3]},
          {w:20,gear:{tierMin:3,tierMax:4}},{w:12,item:'gem',q:[1,1]},{w:10,item:'meat_pie',q:[1,1]}]},
  war_hawk:{name:'War Hawk',lvl:30,hp:58,style:'ranged',acc:28,pow:18,def:15,spd:2600,range:4,
    aggro:true,xp:176,gold:[14,34],
    loot:[{w:30,gold:[14,34]},{w:26,item:'arrows',q:[12,28]},{w:20,gear:{tierMin:3,tierMax:5}},
          {w:14,item:'gem',q:[1,1]},{w:10,item:'stew',q:[1,1]}]},
  nomad:{name:'Steppe Nomad',lvl:34,hp:82,style:'magic',acc:34,pow:22,def:22,spd:2800,range:4,
    aggro:true,xp:212,gold:[18,44],
    loot:[{w:28,gold:[18,44]},{w:24,item:'runes',q:[12,26]},{w:20,gear:{tierMin:4,tierMax:5}},
          {w:16,item:'ancient_dust',q:[1,2]},{w:12,item:'gem',q:[1,2]}]},

  /* ===== Ashen Desert — dunes (lvl 38–49) ===== */
  scorpion:{name:'Sand Scorpion',lvl:38,hp:92,style:'melee',acc:36,pow:23,def:24,spd:2400,range:1,
    aggro:true,xp:212,gold:[16,40],
    loot:[{w:30,gold:[16,40]},{w:24,item:'gem',q:[1,2]},{w:20,gear:{tierMin:4,tierMax:5}},
          {w:14,item:'bone',q:[2,4]},{w:12,item:'stew',q:[1,1]}]},
  sand_wraith:{name:'Sand Wraith',lvl:42,hp:86,style:'magic',acc:40,pow:26,def:24,spd:2800,range:4,
    aggro:true,xp:250,gold:[20,50],
    loot:[{w:28,gold:[20,50]},{w:24,item:'runes',q:[14,30]},{w:20,item:'ancient_dust',q:[1,3]},
          {w:18,gear:{tierMin:4,tierMax:6}},{w:10,item:'gem',q:[1,2]}]},
  dune_raider:{name:'Dune Raider',lvl:45,hp:98,style:'ranged',acc:44,pow:28,def:26,spd:2600,range:4,
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
  bandit_king:{name:'The Bandit King',lvl:16,hp:120,style:'melee',acc:18,pow:12,def:12,spd:2400,range:1,
    aggro:true,xp:360,gold:[50,110],boss:true,respawn:300000,rarityBoost:2,
    loot:[{w:42,gear:{tierMin:2,tierMax:3}},{w:28,gold:[50,110]},{w:18,item:'meat_pie',q:[1,2]},
          {w:12,item:'gem',q:[1,1]}]},
  frost_giant:{name:'The Frost Giant',lvl:32,hp:260,style:'melee',acc:26,pow:18,def:24,spd:2800,range:1,
    aggro:true,xp:640,gold:[90,200],boss:true,respawn:300000,rarityBoost:2,
    loot:[{w:42,gear:{tierMin:3,tierMax:5}},{w:26,gold:[90,200]},{w:18,item:'gem',q:[1,2]},
          {w:14,item:'iron_ore',q:[2,4]}]},
  plains_warlord:{name:'The Plains Warlord',lvl:42,hp:300,style:'melee',acc:40,pow:26,def:30,spd:2400,range:1,
    aggro:true,xp:900,gold:[140,300],boss:true,respawn:300000,rarityBoost:3,
    loot:[{w:44,gear:{tierMin:4,tierMax:6}},{w:24,gold:[140,300]},{w:18,item:'gem',q:[2,3]},
          {w:14,item:'ancient_dust',q:[2,4]}]},
  sand_pharaoh:{name:'The Sand Pharaoh',lvl:50,hp:360,style:'magic',acc:50,pow:34,def:36,spd:2600,range:5,
    aggro:true,xp:1600,gold:[240,480],boss:true,respawn:300000,rarityBoost:3,
    loot:[{w:46,gear:{tierMin:5,tierMax:6}},{w:22,gold:[240,480]},{w:18,item:'gem',q:[2,4]},
          {w:14,item:'ancient_dust',q:[4,7]}]},
};

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
const BLOCKED=new Set(['X','R','W','F','#','Q','U','S','~','H','B','K','k']);

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
  const SPECS=[
   {id:'forest',ground:'.',edge:'F',north:'town',south:'mountains',dungeon:'forest_dungeon',
    res:[['T',34],['O',12],['C',8]],decor:[['X',6]],water:2,
    mobs:{spider:9,boar:6,bandit:5}},
   {id:'mountains',ground:'s',edge:'X',north:'forest',south:'plains',dungeon:'mountains_dungeon',
    res:[['Y',20],['I',10],['Z',6]],decor:[['X',34]],water:0,
    mobs:{frost_wolf:8,ice_sprite:6,snow_troll:5}},
   {id:'plains',ground:'a',edge:'X',north:'mountains',south:'desert',dungeon:'plains_dungeon',
    res:[['T',14],['I',8]],decor:[['X',10]],water:3,
    mobs:{steppe_lion:8,war_hawk:6,nomad:5}},
   {id:'desert',ground:'d',edge:'X',north:'plains',south:null,dungeon:'desert_dungeon',
    res:[['Z',9]],decor:[['k',18],['X',12]],water:2,
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
    const openTile=()=>{ /* random interior ground tile, not reserved */
      for(let tries=0;tries<40;tries++){
        const x=1+Math.floor(rng()*(RW-2)),y=1+Math.floor(rng()*(RH-2));
        if(g[y][x]===spec.ground&&!reserved.has(key(x,y)))return[x,y];
      }return null;};
    /* water pools (small, blocking via '~') */
    for(let i=0;i<spec.water;i++){const p=openTile();if(!p)continue;
      for(let j=0;j<2;j++)for(let k=0;k<2;k++)if(g[p[1]+j]&&g[p[1]+j][p[0]+k]===spec.ground)g[p[1]+j][p[0]+k]='~';}
    /* decor (blocking) then resources */
    for(const[ch,n]of spec.decor)for(let i=0;i<n;i++){const p=openTile();if(p)g[p[1]][p[0]]=ch;}
    for(const[ch,n]of spec.res)for(let i=0;i<n;i++){const p=openTile();if(p){g[p[1]][p[0]]=ch;reserved.add(key(p[0],p[1]));}}
    /* mobs on open ground */
    for(const t in spec.mobs)for(let i=0;i<spec.mobs[t];i++){const p=openTile();if(p){mobs.push({t,x:p[0],y:p[1]});reserved.add(key(p[0],p[1]));}}
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
/* p3: player state, save/load + v1 migration, inventory & equipment,
       XP with overflow, quests, dailies, login bonus, feedback (floaters,
       toasts, level flash, xp bar, sfx) */

function freshPlayer(){return{
  v:SAVE_VERSION,
  map:'town',tx:20,ty:17,px:20*TILE,py:17*TILE,facing:1,
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
  /* migrate stale saves: a map that no longer exists (old Mines/Ruins/Swamp)
     would crash the renderer — send the hero home to town instead. */
  if(!MAPS[P.map]){const s=MAPS.town.spawn;P.map='town';P.tx=s[0];P.ty=s[1];P.px=P.tx*TILE;P.py=P.ty*TILE;P.path=[];P.moving=null;}
  if(P.grave&&!MAPS[P.grave.map])P.grave=null;
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
  const rolls=(d.boss||d.semi)?2:1; /* bosses + dungeon semi-bosses roll twice */
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
          const chance=hitChance(d.acc*2+8,playerDefence()*(tri>1?0.92:1));
          let dmg=0;
          if(Math.random()<chance)dmg=Math.max(1,Math.round(rand(1,Math.max(1,Math.floor(1+d.pow*0.45)))*tri));
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
        const tspr=r.type==='O'?SPR.oak:r.type==='Y'?SPR.pine:SPR.tree;
        ctx.drawImage(r.alive?tspr:SPR.stump,r.x*TILE+sway,r.y*TILE-(r.alive?16:0));
      }else{
        const rspr=r.type==='I'?SPR.rock_i:r.type==='Z'?SPR.crystal:SPR.rock_c;
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
      : ch==='k'?'#3f7a3a' : MM_GROUND[ch]||(RES[ch]?gnd:'#33302a');
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
$('bMap').addEventListener('click',()=>{ensureAudio();toggleMinimap();});
$('minimap').addEventListener('click',()=>{minimapOn=false;$('minimap').classList.remove('open');});
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
  if($('panel').classList.contains('open'))return; /* full-screen menu open: ignore world taps */
  /* tapping the world while chatting closes the bottom sheet and abandons the
     conversation (re-talking starts from scratch), then the tap still acts */
  if($('dialog').classList.contains('open'))closeDialog();
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
    const sx=P.moving?P.moving.txx:P.tx, sy=P.moving?P.moving.tyy:P.ty;
    const path=findPath(P.map,sx,sy,tx,ty,false);
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

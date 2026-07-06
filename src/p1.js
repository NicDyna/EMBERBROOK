/* ============================================================
   EMBERBROOK v2 — a tiny medieval RPG (single player)
   Built as: src/p1..p8.js -> static/game.js (see README)
   ------------------------------------------------------------
   p1: constants, skills & XP, items, gear generation, rarity
   ============================================================ */
'use strict';
const TILE=32, INV_CAP=20, MAX_LVL=50, SAVE_VERSION=3;
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
  crafting:   {name:'Crafting',   color:'#c98b50', icon:'hammer'},
};
const SKILL_ORDER=['attack','strength','defence','ranged','magic','woodcutting','mining','crafting'];
/* XP curve (v3): steepened from 45·(l-1)^1.8 so maxing is a long ACTIVE grind
   — total XP to 50 roughly doubled (~50k → ~99k). Higher-tier nodes/mobs pay
   proportionally more. Revert this one line to restore the old, faster pacing. */
const xpAt=l=>Math.floor(50*Math.pow(l-1,1.95));
/* Level is capped at 50; XP itself keeps counting (overflow). */
function lvlFor(xp){let l=1;while(l<MAX_LVL&&xp>=xpAt(l+1))l++;return l;}

/* ---------------- rarity (stat-roll multipliers, pure RNG) -------- */
const RARITY=[
  {id:0,name:'',          color:'#cfc9bd',mult:1.00,w:620},
  {id:1,name:'Uncommon ', color:'#7fd17f',mult:1.10,w:250},
  {id:2,name:'Rare ',     color:'#6fb7ff',mult:1.25,w:100},
  {id:3,name:'Epic ',     color:'#c98bff',mult:1.45,w:25},
  {id:4,name:'Legendary ',color:'#f0c419',mult:1.70,w:5},
  {id:5,name:'Unique ',    color:'#ff8a3a',mult:1.00,w:0}, // boss drops only (never rolled)
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
          const hpBase  = slot==='body'?4+2*t : slot==='legs'?2+t
                        : slot==='shield'?2+t : 1+t; /* helmet */
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
/* ---------------- boss uniques (best-in-slot chase items with a perk) ----
   Registered into GEAR so equip / stats / icons / paper-doll all work; they
   drop only from their boss and wear the 'Unique' rarity (r=5). */
const UNIQUES={
  u_frostmaul:{name:'Frostmaul',line:'m',slot:'weapon',req:45,reqSkill:'attack',color:'#8fe0ff',
    perk:'meleedmg',perkDesc:'+5% melee damage',stats:{acc:30,pow:27},spd:2400},
  u_bandit_coat:{name:"Bandit King's Coat",line:'r',slot:'body',req:45,reqSkill:'defence',color:'#caa15a',
    perk:'savearrow',perkDesc:'10% chance to save arrows',stats:{def:15,hp:22,rpow:5}},
  u_warlord_bulwark:{name:"Warlord's Bulwark",line:'m',slot:'shield',req:45,reqSkill:'defence',color:'#d0a83a',
    perk:'dmgred',perkDesc:'-5% damage taken',stats:{def:19,hp:16}},
  u_pharaoh_sceptre:{name:"Pharaoh's Sceptre",line:'g',slot:'weapon',req:45,reqSkill:'magic',color:'#7af0c9',
    perk:'saverune',perkDesc:'10% chance to save runes',stats:{acc:28,pow:25},spd:3000},
};
(function buildUniques(){
  for(const id in UNIQUES){const u=UNIQUES[id];
    const g={id,name:u.name,line:u.line,tier:6,slot:u.slot,req:u.req,reqSkill:u.reqSkill,
             color:u.color,stats:{...u.stats},unique:true,perk:u.perk,perkDesc:u.perkDesc};
    if(u.slot==='weapon'){g.spd=u.spd;if(u.line==='r')g.ammo='arrows';if(u.line==='g')g.ammo='runes';}
    GEAR[id]=g;
  }
})();
/* ============================================================
   FUSION WEAPONS (Phase 4) — special melee weapons layered on top of the
   bronze→rune tiers. A Terraria-style tree: 10 tier-1 specials (each a rare
   drop from a creature) fuse 10→6→3→1 into the endgame Godsword. Each carries
   fixed on-hit EFFECTS; the Crafting-skill upgrade roll at fuse time may bump an
   effect to its "greater" variant. Melee-only for now (DESIGN-v3 §4).
   ============================================================ */
/* the 11 combat effect keywords (§9). `mag` = base, `g` = greater variant.
   dot:true → damage-over-time applied to the mob and ticked in updateMobs. */
const EFFECTS={
  burn:     {name:'Burn',     dot:true, color:'#ff8a3a', mag:{dmg:3,ticks:3},   g:{dmg:5,ticks:4},   desc:'Ignites the foe'},
  poison:   {name:'Poison',   dot:true, color:'#7fd17f', mag:{dmg:2,ticks:5},   g:{dmg:4,ticks:5},   desc:'Poisons over time'},
  bleed:    {name:'Bleed',    dot:true, color:'#d9534f', mag:{dmg:4,ticks:3},   g:{dmg:6,ticks:4},   desc:'Deep bleeding wounds'},
  cleave:   {name:'Cleave',   color:'#e8c451', mag:{pct:0.6},         g:{pct:1.0},         desc:'Strikes every foe around you'},
  pierce:   {name:'Pierce',   color:'#8fe0ff', mag:{range:2},         g:{range:3},         desc:'Runs foes through in a line'},
  knockback:{name:'Knockback',color:'#cfc9bd', mag:{tiles:1},         g:{tiles:2},         desc:'Hurls the target back'},
  reach:    {name:'Reach',    color:'#b9c6d4', mag:{range:1},         g:{range:2},         desc:'Extends your attack range'},
  crush:    {name:'Crush',    color:'#a08c78', mag:{pct:0.25},        g:{pct:0.5},         desc:'Ignores part of armour'},
  execute:  {name:'Execute',  color:'#ff6a5a', mag:{pct:0.5,hp:0.25}, g:{pct:1.0,hp:0.30}, desc:'Devastates wounded foes'},
  lifesteal:{name:'Lifesteal',color:'#c98bff', mag:{pct:0.10},        g:{pct:0.20},        desc:'Heals you as you strike'},
  slashwave:{name:'Slash Wave',color:'#f0c419',mag:{every:3,pct:0.6}, g:{every:2,pct:0.8}, desc:'Looses a blade of force'},
};
function effDesc(k,greater){ /* human-readable magnitude for the current variant */
  const e=EFFECTS[k],m=greater?e.g:e.mag,gp=greater?'Greater ':'';
  if(e.dot)return gp+e.name+' ('+m.dmg+' dmg × '+m.ticks+')';
  if(k==='cleave')return gp+e.name+' ('+Math.round(m.pct*100)+'% splash)';
  if(k==='pierce')return gp+e.name+' (line of '+m.range+')';
  if(k==='knockback')return gp+e.name+' (+'+m.tiles+' tile)';
  if(k==='reach')return gp+e.name+' (+'+m.range+' range)';
  if(k==='crush')return gp+e.name+' (−'+Math.round(m.pct*100)+'% armour)';
  if(k==='execute')return gp+e.name+' (+'+Math.round(m.pct*100)+'% <'+Math.round(m.hp*100)+'% HP)';
  if(k==='lifesteal')return gp+e.name+' ('+Math.round(m.pct*100)+'% heal)';
  if(k==='slashwave')return gp+e.name+' (every '+m.every+' hits)';
  return gp+e.name;
}
/* the 20-weapon tree. tier 1 = drops; 2/3/4 = fused. All melee weapons. */
const FUSIONS={
  /* --- tier 1: 10 signature drops (drop-source in `drop`) --- */
  fw_venomfang:  {name:'Venomfang Dirk', tier:1,req:40,color:'#7ad17f',stats:{acc:30,pow:22},fx:['poison'],   drop:'spider'},
  fw_ripper:     {name:'Ripper Blade',   tier:1,req:40,color:'#d9534f',stats:{acc:29,pow:23},fx:['bleed'],    drop:'bandit'},
  fw_boarcleaver:{name:'Boar Cleaver',   tier:1,req:40,color:'#c98b50',stats:{acc:28,pow:24},fx:['cleave'],   drop:'boar'},
  fw_frostbrand: {name:'Frostbrand',     tier:1,req:41,color:'#8fe0ff',stats:{acc:30,pow:22},fx:['burn'],     drop:'frost_wolf'},
  fw_piercer:    {name:'Shardpiercer',   tier:1,req:41,color:'#bfe0ff',stats:{acc:31,pow:22},fx:['pierce'],   drop:'ice_sprite'},
  fw_tremor:     {name:'Tremor Maul',    tier:1,req:42,color:'#a08c78',stats:{acc:28,pow:25},fx:['knockback'],drop:'snow_troll'},
  fw_glaive:     {name:"Reachglaive",    tier:1,req:42,color:'#d0a83a',stats:{acc:30,pow:23},fx:['reach'],    drop:'steppe_lion'},
  fw_sunderer:   {name:'Sunderer',       tier:1,req:43,color:'#9fb0bd',stats:{acc:29,pow:24},fx:['crush'],    drop:'nomad'},
  fw_reaperedge: {name:"Reaper's Edge",  tier:1,req:43,color:'#ff6a5a',stats:{acc:31,pow:23},fx:['execute'],  drop:'scorpion'},
  fw_leechblade: {name:'Leechblade',     tier:1,req:44,color:'#c98bff',stats:{acc:30,pow:23},fx:['lifesteal'],drop:'sand_wraith'},
  /* --- tier 2: 6 weapons (2 inputs, 5,000g) --- */
  fw_plaguecleaver:{name:'Plaguecleaver',tier:2,req:45,color:'#8fd17f',stats:{acc:34,pow:28},fx:['poison','cleave']},
  fw_gorehowl:     {name:'Gorehowl',     tier:2,req:45,color:'#d96a53',stats:{acc:33,pow:29},fx:['bleed','knockback']},
  fw_flamereach:   {name:'Flamereach',   tier:2,req:45,color:'#ffb04a',stats:{acc:35,pow:27},fx:['burn','reach']},
  fw_impaler:      {name:'Impaler',      tier:2,req:45,color:'#9fd0e0',stats:{acc:34,pow:28},fx:['pierce','crush']},
  fw_soulrender:   {name:'Soulrender',   tier:2,req:45,color:'#d08bff',stats:{acc:34,pow:28},fx:['execute','lifesteal']},
  fw_wolfsbane:    {name:'Wolfsbane',    tier:2,req:45,color:'#9ad9a0',stats:{acc:33,pow:29},fx:['burn','poison']},
  /* --- tier 3: 3 weapons (2 inputs, 25,000g) --- */
  fw_doomblade:    {name:'Doomblade',    tier:3,req:48,color:'#c0504a',stats:{acc:40,pow:34},fx:['poison','cleave','bleed']},
  fw_worldpiercer: {name:'Worldpiercer', tier:3,req:48,color:'#7fbfe0',stats:{acc:40,pow:34},fx:['pierce','crush','knockback']},
  fw_reaperofsouls:{name:'Reaper of Souls',tier:3,req:48,color:'#b06fd1',stats:{acc:41,pow:35},fx:['execute','lifesteal','burn']},
  /* --- tier 4: the Godsword (3 inputs, 100,000g) --- */
  fw_godsword:     {name:'Godsword of Emberbrook',tier:4,req:50,color:'#f0c419',stats:{acc:48,pow:42},fx:['cleave','execute','lifesteal','slashwave']},
};
(function buildFusions(){
  for(const id in FUSIONS){const f=FUSIONS[id];
    GEAR[id]={id,name:f.name,line:'m',tier:6,slot:'weapon',req:f.req,reqSkill:'attack',
      color:f.color,stats:{...f.stats},spd:2400,fusion:true,ftier:f.tier,fx:f.fx};
  }
})();
/* recipes: result → inputs + gold fee. Gated on Attack level (result.req). */
const FUSE_RECIPES={
  fw_plaguecleaver:{in:['fw_venomfang','fw_boarcleaver'],gold:5000},
  fw_gorehowl:     {in:['fw_ripper','fw_tremor'],gold:5000},
  fw_flamereach:   {in:['fw_frostbrand','fw_glaive'],gold:5000},
  fw_impaler:      {in:['fw_piercer','fw_sunderer'],gold:5000},
  fw_soulrender:   {in:['fw_reaperedge','fw_leechblade'],gold:5000},
  fw_wolfsbane:    {in:['fw_frostbrand','fw_venomfang'],gold:5000},
  fw_doomblade:    {in:['fw_plaguecleaver','fw_gorehowl'],gold:25000},
  fw_worldpiercer: {in:['fw_flamereach','fw_impaler'],gold:25000},
  fw_reaperofsouls:{in:['fw_soulrender','fw_wolfsbane'],gold:25000},
  fw_godsword:     {in:['fw_doomblade','fw_worldpiercer','fw_reaperofsouls'],gold:100000},
};
const FUSE_ORDER=Object.keys(FUSE_RECIPES);
/* creature → the tier-1 fusion weapon it can rarely drop (see rollLoot) */
const MOB_FUSION_DROP={};
for(const _id in FUSIONS)if(FUSIONS[_id].drop)MOB_FUSION_DROP[FUSIONS[_id].drop]=_id;
const FUSION_DROP_CHANCE=0.05; /* per-kill chance for the source creature */
/* effect list for an owned weapon piece, applying its per-instance greater
   upgrades (piece.up = array of upgraded effect keys, rolled at fuse time). */
function weaponEffects(piece){
  if(!piece)return[];
  const g=GEAR[piece.id];if(!g||!g.fx)return[];
  const up=piece.up||[];
  return g.fx.map(k=>({k,greater:up.includes(k)}));
}
/* upgrade chance scales with Crafting level: ~5% @1 → ~60% @50 */
function fuseUpgradeChance(){return 0.05+(clamp(lvl('crafting'),1,MAX_LVL)-1)/(MAX_LVL-1)*0.55;}

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
  cape_crafting:{skill:'crafting',name:'Crafting Cape',color:'#c98b50',perk:'10% chance to save materials',price:5000},
  cape_max:{skill:null,name:'Max Cape',color:'#f0c419',perk:'All cape perks combined',price:25000},
};
function capePerkActive(capeId){
  const worn=P.gear.cape&&P.gear.cape.id;
  return worn===capeId||worn==='cape_max';
}
/* generalized perk lookup: a perk effect is active if granted by the worn cape
   (or Max Cape) or by any equipped unique. Effects:
   acc, meleedmg, dmgred, savearrow, saverune, chop, mine */
const CAPE_EFFECT={cape_attack:'acc',cape_strength:'meleedmg',cape_defence:'dmgred',
  cape_ranged:'savearrow',cape_magic:'saverune',cape_woodcutting:'chop',cape_mining:'mine',
  cape_crafting:'craftsave'};
function perkActive(effect){
  const worn=P.gear.cape&&P.gear.cape.id;
  if(worn==='cape_max')return true;
  if(worn&&CAPE_EFFECT[worn]===effect)return true;
  for(const slot in P.gear){const pc=P.gear[slot];if(pc&&GEAR[pc.id]&&GEAR[pc.id].perk===effect)return true;}
  return false;
}

/* ---------------- consumables & materials ---------------- */
const ITEMS={
  logs:{name:'Logs',price:0,sell:3,stack:true},
  oak_logs:{name:'Oak Logs',price:0,sell:8,stack:true},
  maple_logs:{name:'Maple Logs',price:0,sell:20,stack:true},
  yew_logs:{name:'Yew Logs',price:0,sell:44,stack:true},
  copper_ore:{name:'Copper Ore',price:0,sell:5,stack:true},
  iron_ore:{name:'Iron Ore',price:0,sell:12,stack:true},
  coal:{name:'Coal',price:0,sell:16,stack:true},
  mithril_ore:{name:'Mithril Ore',price:0,sell:34,stack:true},
  adamant_ore:{name:'Adamant Ore',price:0,sell:64,stack:true},
  runite_ore:{name:'Runite Ore',price:0,sell:120,stack:true},
  /* smithed bars — crafting products (sell for gold, feed base-gear smithing) */
  bronze_bar:{name:'Bronze Bar',price:0,sell:14,stack:true},
  iron_bar:{name:'Iron Bar',price:0,sell:28,stack:true},
  steel_bar:{name:'Steel Bar',price:0,sell:60,stack:true},
  mithril_bar:{name:'Mithril Bar',price:0,sell:120,stack:true},
  adamant_bar:{name:'Adamant Bar',price:0,sell:230,stack:true},
  rune_bar:{name:'Runite Bar',price:0,sell:440,stack:true},
  bone:{name:'Bones',price:0,sell:2,stack:true},
  wolf_pelt:{name:'Wolf Pelt',price:0,sell:9,stack:true},
  ancient_dust:{name:'Ancient Dust',price:0,sell:18,stack:true},
  swamp_herb:{name:'Swamp Herb',price:0,sell:14,stack:true},
  gem:{name:'Gemstone',price:0,sell:60,stack:true},
  /* biome signature drops (sell for gold; region identity) */
  spider_silk:{name:'Spider Silk',price:0,sell:16,stack:true},
  thick_fur:{name:'Thick Fur',price:0,sell:28,stack:true},
  lion_fang:{name:'Lion Fang',price:0,sell:46,stack:true},
  scarab_shell:{name:'Scarab Shell',price:0,sell:72,stack:true},
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

/* ---------------- crafting recipes (the base-item grind) ----------------
   Leveled at the Forge (Smith Torvald). Three chains:
     Smelting  — ore (+coal) → metal bar
     Fletching — logs → arrows
     Smithing  — bars → base melee gear (Common, r=0; sell or wield)
   Recipe: {name,cat,lvl,xp, in:{item:qty,...}, out:{item:qty} | gear:'g_..id'}.
   'lvl' gates on the Crafting skill; higher tiers pay proportionally more xp. */
const BAR_BY_TIER=['bronze_bar','iron_bar','steel_bar','mithril_bar','adamant_bar','rune_bar'];
const CRAFT_LVL_BY_TIER=[1,10,20,30,40,50];
const SMELT_XP_BY_TIER=[12,20,32,50,75,110];
const SLOT_BARS={weapon:2,shield:3,helmet:1,body:5,legs:3};
const RECIPES={
  /* --- Smelting: 1 ore (+coal from steel up) → 1 bar --- */
  bronze_bar:{name:'Bronze Bar',cat:'Smelting',lvl:1, xp:12, in:{copper_ore:1},           out:{bronze_bar:1}},
  iron_bar:  {name:'Iron Bar',  cat:'Smelting',lvl:10,xp:20, in:{iron_ore:1},              out:{iron_bar:1}},
  steel_bar: {name:'Steel Bar', cat:'Smelting',lvl:20,xp:32, in:{iron_ore:1,coal:1},       out:{steel_bar:1}},
  mithril_bar:{name:'Mithril Bar',cat:'Smelting',lvl:30,xp:50,in:{mithril_ore:1,coal:2},   out:{mithril_bar:1}},
  adamant_bar:{name:'Adamant Bar',cat:'Smelting',lvl:40,xp:75,in:{adamant_ore:1,coal:3},   out:{adamant_bar:1}},
  rune_bar:  {name:'Runite Bar',cat:'Smelting',lvl:50,xp:110,in:{runite_ore:1,coal:4},      out:{rune_bar:1}},
  /* --- Fletching: logs → arrows --- */
  arrows:      {name:'Arrows ×15',    cat:'Fletching',lvl:1, xp:8,  in:{logs:1},       out:{arrows:15}},
  arrows_oak:  {name:'Arrows ×30',    cat:'Fletching',lvl:15,xp:18, in:{oak_logs:1},   out:{arrows:30}},
  arrows_maple:{name:'Arrows ×60',    cat:'Fletching',lvl:35,xp:40, in:{maple_logs:1}, out:{arrows:60}},
};
/* --- Smithing: generate melee-line base gear from bars (buildGear ran above) --- */
(function buildGearRecipes(){
  for(let t=1;t<=6;t++){
    const bar=BAR_BY_TIER[t-1], lvl=CRAFT_LVL_BY_TIER[t-1], sx=SMELT_XP_BY_TIER[t-1];
    for(const slot in LINE_DEFS.m.slots){
      const gid='g_m_'+t+'_'+slot, n=SLOT_BARS[slot];
      RECIPES['craft_'+gid]={name:'Smith '+GEAR[gid].name,cat:'Smithing',lvl,
        xp:Math.round(n*sx*0.9), in:{[bar]:n}, gear:gid};
    }
  }
})();

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
          g.spd = L==='m'?2000:2600; /* v3.2 pacing: snappier swings across the board */
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
    perk:'meleedmg',perkDesc:'+5% melee damage',stats:{acc:30,pow:27},spd:2000},
  u_bandit_coat:{name:"Bandit King's Coat",line:'r',slot:'body',req:45,reqSkill:'defence',color:'#caa15a',
    perk:'savearrow',perkDesc:'10% chance to save arrows',stats:{def:15,hp:22,rpow:5}},
  u_warlord_bulwark:{name:"Warlord's Bulwark",line:'m',slot:'shield',req:45,reqSkill:'defence',color:'#d0a83a',
    perk:'dmgred',perkDesc:'-5% damage taken',stats:{def:19,hp:16}},
  u_pharaoh_sceptre:{name:"Pharaoh's Sceptre",line:'g',slot:'weapon',req:45,reqSkill:'magic',color:'#7af0c9',
    perk:'saverune',perkDesc:'10% chance to save runes',stats:{acc:28,pow:25},spd:2600},
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
      color:f.color,stats:{...f.stats},spd:2000,fusion:true,ftier:f.tier,fx:f.fx};
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

/* ---------------- special attacks (⚡ spec energy) ----------------
   One active special per weapon, fired from the big ⚡ button while fighting.
   Energy 0–100 regenerates over time; every special costs SPEC_COST.
   Fusion weapons get a signature special keyed on their FIRST effect; base &
   unique weapons get their line's generic. Resolution: useSpecial() in p5. */
const SPEC_MAX=100, SPEC_COST=40, SPEC_REGEN=100/45000; /* full bar in 45 s */
const SPECIALS={
  melee:    {name:'Power Strike', desc:'A guaranteed hit for 180% damage'},
  ranged:   {name:'Rapid Volley', desc:'Three instant shots at 80% damage'},
  magic:    {name:'Arcane Burst', desc:'140% hit that splashes foes near the target'},
  poison:   {name:'Envenom',      desc:'130% hit + virulent poison'},
  burn:     {name:'Immolate',     desc:'130% hit + fierce burn'},
  bleed:    {name:'Rend',         desc:'130% hit + deep bleed'},
  cleave:   {name:'Whirlwind',    desc:'Full damage to every adjacent foe'},
  pierce:   {name:'Skewer',       desc:'A full-damage lance through 4 tiles'},
  knockback:{name:'Ground Slam',  desc:'Damages and hurls back all adjacent foes'},
  reach:    {name:'Great Sweep',  desc:'140% hit across the target row'},
  crush:    {name:'Shatter',      desc:'160% hit that ignores all armour'},
  execute:  {name:'Guillotine',   desc:'140% hit; executes below half HP'},
  lifesteal:{name:'Drain Life',   desc:'150% hit, healing all damage dealt'},
  slashwave:{name:'Judgement',    desc:'A full-damage blade wave plus the strike'},
};
function specKeyForWeapon(){
  const w=P.gear.weapon&&GEAR[P.gear.weapon.id];
  if(!w)return'melee';
  if(w.fx&&w.fx.length&&SPECIALS[w.fx[0]])return w.fx[0];
  return w.line==='r'?'ranged':w.line==='g'?'magic':'melee';
}

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
  spider:{name:'Forest Spider',lvl:4,hp:10,style:'melee',acc:7,pow:4,def:3,spd:2400,range:1,
    aggro:false,xp:24,gold:[2,7],
    loot:[{w:48,gold:[2,7]},{w:20,item:'bone',q:[1,1]},{w:12,item:'bread',q:[1,1]},
          {w:10,gear:{tierMin:1,tierMax:2}},{w:10,item:'cooked_meat',q:[1,1]},{w:12,item:'spider_silk',q:[1,2]}]},
  boar:{name:'Wild Boar',lvl:6,hp:13,style:'melee',acc:8,pow:5,def:4,spd:2400,range:1,
    aggro:true,xp:34,gold:[0,4],
    loot:[{w:44,item:'wolf_pelt',q:[1,1]},{w:24,item:'cooked_meat',q:[1,2]},
          {w:20,item:'bone',q:[1,2]},{w:12,gear:{tierMin:1,tierMax:2}}]},
  bandit:{name:'Forest Bandit',lvl:9,hp:18,style:'ranged',acc:11,pow:6,def:5,spd:2800,range:4,
    aggro:true,xp:46,gold:[6,16],
    loot:[{w:34,gold:[6,16]},{w:22,item:'arrows',q:[6,14]},{w:16,item:'bread',q:[1,2]},
          {w:16,gear:{tierMin:1,tierMax:2}},{w:12,item:'copper_ore',q:[1,1]}]},

  /* ===== Frostpeak Mountains — snow (lvl 14–24) ===== */
  frost_wolf:{name:'Frost Wolf',lvl:15,hp:32,style:'melee',acc:16,pow:11,def:10,spd:2100,range:1,
    aggro:true,xp:72,gold:[4,12],
    loot:[{w:40,item:'wolf_pelt',q:[1,2]},{w:24,item:'cooked_meat',q:[1,2]},
          {w:18,item:'bone',q:[1,3]},{w:18,gear:{tierMin:2,tierMax:3}},{w:16,item:'thick_fur',q:[1,2]}]},
  ice_sprite:{name:'Ice Sprite',lvl:18,hp:29,style:'magic',acc:19,pow:13,def:10,spd:2800,range:4,
    aggro:true,xp:92,gold:[8,20],
    loot:[{w:30,gold:[8,20]},{w:24,item:'runes',q:[6,16]},{w:18,item:'gem',q:[1,1]},
          {w:18,gear:{tierMin:2,tierMax:4}},{w:10,item:'meat_pie',q:[1,1]}]},
  snow_troll:{name:'Snow Troll',lvl:20,hp:45,style:'melee',acc:20,pow:13,def:15,spd:2800,range:1,
    aggro:true,xp:130,gold:[10,26],
    loot:[{w:30,gold:[10,26]},{w:22,item:'iron_ore',q:[1,2]},{w:20,gear:{tierMin:3,tierMax:4}},
          {w:16,item:'bone',q:[2,4]},{w:12,item:'gem',q:[1,1]}]},

  /* ===== Golden Plains — savanna (lvl 26–36) ===== */
  steppe_lion:{name:'Steppe Lion',lvl:26,hp:59,style:'melee',acc:25,pow:16,def:16,spd:2200,range:1,
    aggro:true,xp:150,gold:[12,30],
    loot:[{w:34,item:'wolf_pelt',q:[1,3]},{w:24,item:'cooked_meat',q:[2,3]},
          {w:20,gear:{tierMin:3,tierMax:4}},{w:12,item:'gem',q:[1,1]},{w:10,item:'meat_pie',q:[1,1]},{w:14,item:'lion_fang',q:[1,2]}]},
  war_hawk:{name:'War Hawk',lvl:30,hp:46,style:'ranged',acc:28,pow:18,def:15,spd:2600,range:4,
    aggro:true,xp:176,gold:[14,34],
    loot:[{w:30,gold:[14,34]},{w:26,item:'arrows',q:[12,28]},{w:20,gear:{tierMin:3,tierMax:5}},
          {w:14,item:'gem',q:[1,1]},{w:10,item:'stew',q:[1,1]}]},
  nomad:{name:'Steppe Nomad',lvl:34,hp:66,style:'magic',acc:34,pow:22,def:22,spd:2800,range:4,
    aggro:true,xp:212,gold:[18,44],
    loot:[{w:28,gold:[18,44]},{w:24,item:'runes',q:[12,26]},{w:20,gear:{tierMin:4,tierMax:5}},
          {w:16,item:'ancient_dust',q:[1,2]},{w:12,item:'gem',q:[1,2]}]},

  /* ===== Ashen Desert — dunes (lvl 38–49) ===== */
  scorpion:{name:'Sand Scorpion',lvl:38,hp:64,style:'melee',acc:34,pow:20,def:20,spd:2400,range:1,
    aggro:true,xp:212,gold:[16,40],
    loot:[{w:30,gold:[16,40]},{w:24,item:'gem',q:[1,2]},{w:20,gear:{tierMin:4,tierMax:5}},
          {w:14,item:'bone',q:[2,4]},{w:12,item:'stew',q:[1,1]},{w:16,item:'scarab_shell',q:[1,2]}]},
  sand_wraith:{name:'Sand Wraith',lvl:42,hp:69,style:'magic',acc:40,pow:26,def:24,spd:2800,range:4,
    aggro:true,xp:250,gold:[20,50],
    loot:[{w:28,gold:[20,50]},{w:24,item:'runes',q:[14,30]},{w:20,item:'ancient_dust',q:[1,3]},
          {w:18,gear:{tierMin:4,tierMax:6}},{w:10,item:'gem',q:[1,2]}]},
  dune_raider:{name:'Dune Raider',lvl:44,hp:69,style:'ranged',acc:42,pow:25,def:23,spd:2600,range:4,
    aggro:true,xp:280,gold:[24,56],
    loot:[{w:28,gold:[24,56]},{w:24,item:'arrows',q:[18,40]},{w:20,gear:{tierMin:5,tierMax:6}},
          {w:16,item:'gem',q:[1,2]},{w:12,item:'stew',q:[1,2]}]},

  /* ===== event creature: a fleeing treasure critter (never placed in maps;
     spawned by the living-world event roller in p5, despawns if not caught) ===== */
  gilded_scarab:{name:'Gilded Scarab',lvl:1,hp:1,style:'melee',acc:0,pow:0,def:1,spd:99999,range:1,
    aggro:false,xp:60,gold:[0,0],flee:true,
    loot:[{w:55,gold:[80,220]},{w:30,item:'gem',q:[1,2]},{w:15,gold:[200,400]}]},

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
  forgemaster:{name:'Forgemaster Hilde',role:'fuse'},
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
        {id:'skillmaster',x:25,y:14},{id:'guard',x:22,y:26},{id:'forgemaster',x:28,y:20}],
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
/* p3: player state, save/load + v1 migration, inventory & equipment,
       XP with overflow, quests, dailies, login bonus, feedback (floaters,
       toasts, level flash, xp bar, sfx) */

function freshPlayer(){return{
  v:SAVE_VERSION,
  map:'town',tx:20,ty:17,px:20*TILE,py:17*TILE,facing:1,
  hp:14,
  xp:{attack:0,strength:0,defence:0,ranged:0,magic:0,woodcutting:0,mining:0,crafting:0},
  style:'accurate', // melee training style: accurate|aggressive|defensive
  spec:SPEC_MAX,     // special-attack energy 0–100 (⚡ button)
  autoRetal:true,    // auto-retaliate: fight back when attacked while idle
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
  reached:{},        // region ids the player has set foot in (unlocks fast travel)
  bestiary:{},       // {creatureType:{dropKey:totalReceived}} — collection log
  discovered:{},     // gearId -> true for fusion/unique weapons ever obtained (fusion silhouettes)
  grave:null,        // {map,x,y,items:[...],gold,left}  left = ms remaining
  stats:{kills:0,deaths:0,chopped:0,mined:0,bossKills:{},mobKills:{},legendaries:0,
         playMs:0,bestDrop:null,questsDone:0},
  ts:0,              // save timestamp (Date.now) for cloud LWW
  moving:null,path:[],action:null,
};}
let P=freshPlayer();
const lvl=s=>lvlFor(P.xp[s]);
function totalLevel(){return SKILL_ORDER.reduce((a,s)=>a+lvl(s),0);}
function maxHp(){
  let hp=14; /* flat base; the rest comes from gear */
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
  /* strip runtime-only fields: T-relative combat timers must NOT persist —
     T resets to 0 each load, so a saved atkT/eatT would read as "in the
     future" and freeze attacking/eating until the clock catches up. */
  const {moving,path,action,atkT,eatT,lastHurt,regenT,retimer,...clean}=P;
  clean.ts=Date.now();
  /* persist ground drops per map so loot survives reload */
  clean.worldDrops={};
  for(const m in world)clean.worldDrops[m]=world[m].drops;
  return clean;
}
let _resetting=false; /* set by resetSave so autosave/unload can't re-write the wiped save */
function save(){
  if(_resetting)return;
  P.ts=Date.now();
  try{store.set(SAVE_KEY,JSON.stringify(serialize()));}catch(e){}
  syncPushSoon();
}
function applySave(d){
  const fp=freshPlayer();
  P={...fp,...d,moving:null,path:[],action:null};
  /* zero the T-relative timers — T is 0 at load, so old saves that baked in a
     high atkT/eatT would otherwise block attacking/eating on first load. */
  P.atkT=0;P.eatT=0;P.lastHurt=0;P.regenT=0;P.retimer=0;
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
/* full reset: wipe the local save, the cloud copy (if syncing), and the cached
   app code + service worker, then reload into a brand-new game. */
async function resetSave(){
  _resetting=true; /* block any further autosave/unload writes from this session */
  store.del(SAVE_KEY);store.del(OLD_KEY);
  try{ if(typeof syncEnabled==='function'&&syncEnabled())
    await fetch('/api/save',{method:'POST',headers:syncHeaders(),
      body:JSON.stringify({save:{...freshPlayer(),ts:Date.now()}})}); }catch(e){}
  try{ if(window.caches){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));} }catch(e){}
  try{ if('serviceWorker'in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()));} }catch(e){}
  location.reload();
}

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
/* quick-eat picker: the food whose heal best fits the missing HP (largest heal
   that doesn't overheal; if everything overheals, the smallest). -1 = no food. */
function bestFoodIndex(){
  const missing=maxHp()-P.hp;
  let fit=-1,fitHeal=0,small=-1,smallHeal=1e9;
  P.inv.forEach((s,i)=>{
    if(s.gear)return;const d=ITEMS[s.id];if(!d||!d.heal)return;
    if(d.heal<=missing&&d.heal>fitHeal){fit=i;fitHeal=d.heal;}
    if(d.heal<smallHeal){small=i;smallHeal=d.heal;}
  });
  return fit>=0?fit:small;
}
function foodCount(){return P.inv.reduce((a,s)=>a+((!s.gear&&ITEMS[s.id]&&ITEMS[s.id].heal)?s.qty:0),0);}

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

/* ---------------- crafting (base items — the Crafting skill grind) ----------
   A recipe consumes `in` materials and yields either a stackable `out` or a
   `gear` piece (Common). Gated on the Crafting level; the Crafting cape's
   'craftsave' perk gives a 10% chance to refund the materials. Returns how many
   were actually crafted (0 = couldn't). */
function craftReq(r){ /* is every input present at least once? */
  for(const id in r.in)if(invCount(id)<r.in[id])return false;
  return true;
}
function craftMax(r){ /* how many times this recipe can currently be made */
  let n=Infinity;
  for(const id in r.in)n=Math.min(n,Math.floor(invCount(id)/r.in[id]));
  return n===Infinity?0:n;
}
function doCraft(recipeId,count){
  const r=RECIPES[recipeId];if(!r)return 0;
  if(lvl('crafting')<r.lvl){toast('Requires Crafting level '+r.lvl,'bad');return 0;}
  let made=0;count=count||1;
  for(let k=0;k<count;k++){
    if(!craftReq(r)){if(made===0)toast('Not enough materials.','bad');break;}
    /* space check: a gear piece or a NEW stack needs a free slot */
    if(r.gear){if(P.inv.length>=INV_CAP){toast('Inventory full!','bad');break;}}
    else{const outId=Object.keys(r.out)[0];
      if(!invGet(outId)&&P.inv.length>=INV_CAP){toast('Inventory full!','bad');break;}}
    /* consume inputs (craftsave perk may refund the whole batch of inputs) */
    const saved=perkActive('craftsave')&&Math.random()<0.10;
    if(!saved)for(const id in r.in)removeItem(id,r.in[id]);
    /* produce output */
    if(r.gear)addGear({id:r.gear,r:0});
    else for(const id in r.out)addItem(id,r.out[id]);
    gainXp('crafting',r.xp);
    made++;
  }
  if(made){sfx('equip');
    const label=r.gear?GEAR[r.gear].name:ITEMS[Object.keys(r.out)[0]].name;
    toast('Crafted '+label+(made>1?' × '+made:''),'gold');
    updateHUD();save();}
  return made;
}

/* ---------------- fusion (special-weapon crafting at the Forgemaster) --------
   Consumes the recipe's input weapons + a gold fee; the result keeps the highest
   input rarity. A per-effect upgrade roll (scales with Crafting level) may bump an
   effect to its "greater" variant. Discovery: an input's recipe stays a silhouette
   until you've obtained ≥1 of its ingredients (tracked in P.discovered). */
function markDiscovered(id){if(GEAR[id]&&(GEAR[id].fusion||GEAR[id].unique)){(P.discovered||(P.discovered={}))[id]=true;}}
function doFuse(resultId){
  const rec=FUSE_RECIPES[resultId];if(!rec)return false;
  const res=GEAR[resultId];
  if(lvl('attack')<res.req){toast('Requires Attack '+res.req,'bad');return false;}
  if(P.gold<rec.gold){toast('Need '+rec.gold+'g to fuse.','bad');return false;}
  /* locate one inventory piece per input (distinct slots) */
  const idxs=[];
  for(const inId of rec.in){
    const i=P.inv.findIndex((s,k)=>s.gear&&s.gear.id===inId&&!idxs.includes(k));
    if(i<0){toast('Missing '+GEAR[inId].name,'bad');return false;}
    idxs.push(i);
  }
  let maxR=0;for(const i of idxs)maxR=Math.max(maxR,P.inv[i].gear.r||0);
  idxs.sort((a,b)=>b-a).forEach(i=>P.inv.splice(i,1)); /* consume high→low so indices stay valid */
  P.gold-=rec.gold;
  const up=[],chance=fuseUpgradeChance();
  for(const k of res.fx)if(Math.random()<chance)up.push(k);
  const piece={id:resultId,r:maxR,up};
  addGear(piece);markDiscovered(resultId);
  gainXp('crafting',400*res.ftier); /* fusing is a major Crafting reward */
  sfx('level');itemPopup(piece);
  const ups=up.length?' — Greater '+up.map(k=>EFFECTS[k].name).join(' & '):'';
  toast('⚔ Forged '+GEAR[resultId].name+'!'+ups,'gold');
  P.stats.bestDrop=gearName(piece);
  updateHUD();save();
  return true;
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
function floater(x,y,txt,color,size){floaters.push({x,y,txt,color,t0:T,life:1100,size:size||9});}
/* transient spark particles (hits, kills, damage) — rendered in p6 */
const particles=[];
function spawnParticles(x,y,color,n,power){
  n=n||6;power=power||1;
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,sp=(30+Math.random()*60)*power;
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-30*power,t0:T,
      life:360+Math.random()*180,color,size:1+(Math.random()*2|0)});}
}
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
/* rare-drop popup: a non-blocking banner (Epic+); Legendary/Unique add a
   screen dim + particle burst. Auto-fades — never blocks play. */
function itemPopup(piece){
  const g=GEAR[piece.id];if(!g)return;
  const r=piece.r||0;
  $('itempopIcon').src=iconURL(piece.id);
  const nm=$('itempopName');nm.textContent=gearName(piece);
  nm.style.color=g.fusion&&r<3?g.color:RARITY[r].color;
  $('itempopKind').textContent=(g.fusion?'special':g.unique?'unique':(RARITY[r].name.trim()||'item')).toUpperCase();
  const el=$('itempop');el.classList.remove('go','deluxe');void el.offsetWidth;el.classList.add('go');
  if(r>=4||g.ftier>=3){el.classList.add('deluxe');
    const dim=$('popdim');dim.classList.add('go');setTimeout(()=>dim.classList.remove('go'),1900);
    spawnParticles(P.px+16,P.py,g.fusion?g.color:RARITY[r].color,22,2);}
  sfx('rare');
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
function ensureAudio(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}startAmbient();}
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
    case'warp':beep(440,.08,'sine',.05);beep(660,.1,'sine',.05,.07);beep(880,.14,'sine',.04,.15);break;
    case'spec':beep(300,.06,'square',.06);beep(450,.08,'square',.06,.05);beep(700,.12,'sawtooth',.05,.11);break;
  }
}
/* ---- subtle biome ambient pad (very low volume; follows the sound toggle) ---- */
let AMB=null;
function ambientFreq(){const m=P.map;
  if(m.indexOf('dungeon')>=0)return 82;
  if(m==='desert')return 98; if(m==='mountains')return 165;
  if(m==='plains')return 131; if(m==='forest')return 123; return 110; /* town */}
function startAmbient(){
  if(!AC||!soundOn||AMB)return;
  try{
    const g=AC.createGain();g.gain.value=0.009;g.connect(AC.destination);
    const f=ambientFreq();
    const o1=AC.createOscillator();o1.type='sine';o1.frequency.value=f;o1.connect(g);
    const o2=AC.createOscillator();o2.type='sine';o2.frequency.value=f*1.006;o2.connect(g);
    const lfo=AC.createOscillator();lfo.type='sine';lfo.frequency.value=0.1;
    const lg=AC.createGain();lg.gain.value=0.005;lfo.connect(lg);lg.connect(g.gain);
    o1.start();o2.start();lfo.start();
    AMB={o1,o2,lfo,g};
  }catch(e){}
}
function stopAmbient(){if(AMB){try{AMB.o1.stop();AMB.o2.stop();AMB.lfo.stop();}catch(e){}AMB=null;}}
function ambientBiome(){if(AMB&&AC){try{const f=ambientFreq();
  AMB.o1.frequency.setTargetAtTime(f,AC.currentTime,0.5);
  AMB.o2.frequency.setTargetAtTime(f*1.006,AC.currentTime,0.5);}catch(e){}}}
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
  /* ---- biome grounds (snow / savanna / desert sand) — characterful ---- */
  SPR['s']=mkPix(32,32,(g,q)=>{
    g.fillStyle='#e6edf4';g.fillRect(0,0,32,32);
    [[3,5,8,4],[19,4,9,4],[22,20,7,5],[4,23,7,4],[13,13,7,3]].forEach(([x,y,w,h])=>q(x,y,w,h,'#dbe4ee'));
    [[7,10],[24,9],[10,26],[27,24]].forEach(([x,y])=>q(x,y,3,1,'#cdd8e6'));
    q(12,7,1,1,'#ffffff');q(21,15,1,1,'#ffffff');q(6,20,1,1,'#ffffff');q(28,12,1,1,'#bfe0ff');});
  SPR['a']=mkPix(32,32,(g,q)=>{
    g.fillStyle='#a89a4e';g.fillRect(0,0,32,32);
    [[3,4,7,3],[18,6,9,4],[24,22,6,4],[4,24,7,3],[13,14,7,3]].forEach(([x,y,w,h])=>q(x,y,w,h,'#9c8f45'));
    [[6,9],[16,5],[25,12],[9,20],[20,25],[28,18],[12,28]].forEach(([x,y])=>{
      q(x,y-2,1,3,'#8f833c');q(x-1,y-1,1,2,'#8f833c');q(x+1,y-1,1,2,'#8f833c');});
    q(7,7,1,1,'#c8b95e');q(22,16,1,1,'#c8b95e');});
  SPR['d']=mkPix(32,32,(g,q)=>{
    g.fillStyle='#d8c489';g.fillRect(0,0,32,32);
    for(const y of [5,13,21,29])for(let x=0;x<32;x++){const o=Math.round(Math.sin((x+y)/4)*1.5);
      q(x,y+o,1,1,'#c9b06f');q(x,y+o-1,1,1,'#e6d6a0');}
    q(6,3,1,1,'#efe0b0');q(22,9,1,1,'#c9b06f');q(27,24,1,1,'#efe0b0');});
  /* ---- biome border cliffs (blocking): snow-capped peak, sandstone ---- */
  SPR['V']=mk(32,32,(g,p)=>{g.fillStyle='#6b7079';g.fillRect(0,0,32,32);
    for(let r=0;r<4;r++)for(let c2=0;c2<4;c2++){const off=r%2?2:0;
      p((c2*4+off)%16,r*4,3,3,'#767b84');p((c2*4+off)%16,r*4,3,1,'#828892');}
    p(0,0,16,2,'#eaf1f8');p(0,2,16,1,'#cdd8e6');p(2,3,3,1,'#f2f7fb');p(9,3,4,1,'#f2f7fb');});
  SPR['N']=mk(32,32,(g,p)=>{g.fillStyle='#c2a266';g.fillRect(0,0,32,32);
    for(let r=0;r<8;r++)p(0,r*2,16,1,r%2?'#b08f57':'#cdae72');
    p(0,0,16,1,'#d8bd85');p(4,2,1,5,'#9c7d4a');p(11,7,1,6,'#9c7d4a');p(7,10,1,4,'#9c7d4a');});
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
  /* higher-tier trees: recoloured canopies over the oak trunk */
  const mkTree=(fol,folL,folD)=>mk(32,48,(g,p)=>{
    p(6,16,4,8,'#4e3b29');p(5,22,6,2,'#42311f');
    p(2,2,12,12,fol);p(0,6,16,6,fol);p(4,0,8,4,fol);
    p(3,3,5,3,folL);p(10,6,4,3,folL);p(2,10,4,2,folD);p(7,4,2,2,folL);});
  SPR.maple=mkTree('#7a4a24','#a8702f','#5c3618'); /* amber autumn maple */
  SPR.yew=mkTree('#1e3a24','#2f5a34','#152a1a');   /* deep rich yew */
  /* ore veins: rock body with a tier-coloured mineral fleck */
  const mkOre=(fleck)=>mk(32,32,(g,p)=>{
    p(3,6,10,8,'#4e4c4a');p(5,4,7,3,'#4e4c4a');p(2,9,12,4,'#44423f');
    p(4,5,4,2,'#5b5956');p(6,8,2,2,fleck);p(10,10,2,2,fleck);p(4,11,2,1,fleck);p(9,6,2,2,fleck);});
  SPR.coal=mkOre('#2b2b2b');
  SPR.mithril_rock=mkOre('#6fb7ff');
  SPR.adamant_rock=mkOre('#5f9e6e');
  SPR.runite_rock=mkOre('#59c1c9');

  /* ---- player paper-doll (rebuilt whenever equipment changes) ---- */
  rebuildPlayerSprite();

  /* ---- biome mobs: 32x40 detailed 1px art, feet ~y37, shadow y38 (drawn
     with a -8px anchor offset in p6 so feet stay on the tile) ---- */
  /* ===== Whisperwood ===== */
  SPR.spider=mkPix(32,40,(g,q)=>{
    q(5,38,22,2,'#00000030');
    q(1,24,6,1,'#241d1a');q(0,20,2,5,'#241d1a');q(2,31,5,1,'#241d1a');q(1,32,2,5,'#241d1a');
    q(25,24,6,1,'#241d1a');q(30,20,2,5,'#241d1a');q(25,31,5,1,'#241d1a');q(29,32,2,5,'#241d1a');
    q(3,18,5,1,'#312723');q(24,18,5,1,'#312723');q(2,15,2,4,'#312723');q(28,15,2,4,'#312723');
    q(8,18,16,17,'#241d1a');q(9,19,14,14,'#3f2f28');q(10,20,12,9,'#4c3a30');q(9,19,14,1,'#5a463a');
    q(13,22,6,2,'#c94f3f');q(14,26,4,2,'#c94f3f');q(15,21,2,1,'#e8785f');q(13,30,6,1,'#2c221e');
    q(10,6,12,14,'#31261f');q(11,7,10,11,'#4c3a30');q(10,6,12,1,'#5a463a');
    q(11,10,4,4,'#d94a3a');q(17,10,4,4,'#d94a3a');q(12,11,1,1,'#ffb09a');q(18,11,1,1,'#ffb09a');
    q(13,9,2,1,'#7a1f16');q(19,9,2,1,'#7a1f16');q(14,8,1,1,'#d94a3a');q(17,8,1,1,'#d94a3a');
    q(13,18,2,4,'#171210');q(17,18,2,4,'#171210');q(13,21,1,1,'#e8e2c8');q(18,21,1,1,'#e8e2c8');});
  SPR.boar=mkPix(32,40,(g,q)=>{
    q(3,38,26,2,'#00000030');
    q(4,14,18,15,'#4c3729');q(5,15,16,11,'#5e4636');q(6,16,14,7,'#6e5442');q(4,14,18,1,'#7d6350');
    q(5,11,13,4,'#3a2a1f');q(7,10,9,2,'#31231a');q(9,9,5,2,'#3a2a1f');
    q(1,17,4,9,'#4c3729');q(2,18,2,6,'#5e4636');q(0,19,2,3,'#3a2a1f');
    q(20,10,10,14,'#5e4636');q(21,11,8,10,'#6e5442');q(20,10,10,1,'#7d6350');
    q(26,7,3,4,'#4c3729');q(21,7,3,4,'#4c3729');q(27,8,1,2,'#8a6f5a');q(22,8,1,2,'#8a6f5a');
    q(27,18,4,6,'#8a6f5a');q(27,23,4,1,'#3a2a1f');q(29,20,1,1,'#241b12');
    q(23,14,3,3,'#1d1712');q(24,15,1,1,'#e8785f');
    q(26,24,2,5,'#efece0');q(30,22,1,4,'#efece0');q(26,24,1,1,'#c9c6b8');
    q(6,29,4,8,'#3a2a1f');q(12,29,4,8,'#4c3729');q(18,28,4,9,'#3a2a1f');q(23,28,4,9,'#4c3729');
    q(6,37,4,1,'#241b12');q(12,37,4,1,'#241b12');q(18,37,4,1,'#241b12');q(23,37,4,1,'#241b12');});
  SPR.bandit=mkPix(32,40,(g,q)=>{
    q(7,38,17,2,'#00000030');
    q(24,4,2,22,'#8a6a42');q(23,3,1,4,'#8a6a42');q(23,24,1,4,'#8a6a42');q(26,7,1,16,'#d8d5c8');
    q(9,14,14,16,'#2c3f26');q(10,15,12,14,'#3a5233');q(9,14,14,1,'#46613d');q(10,28,12,2,'#22301d');
    q(6,16,4,10,'#2c3f26');q(22,16,3,8,'#2c3f26');q(6,25,4,2,'#c9a97a');
    q(8,2,16,12,'#22301d');q(9,3,14,10,'#2c3f26');q(8,2,16,1,'#3a5233');
    q(10,7,12,5,'#12100c');q(12,8,3,2,'#e8e2c8');q(17,8,3,2,'#e8e2c8');
    q(13,9,1,1,'#241b10');q(18,9,1,1,'#241b10');
    q(12,19,8,2,'#5b4632');q(15,19,2,2,'#c9982c');
    q(11,30,4,7,'#241b12');q(17,30,4,7,'#2e2418');q(11,37,4,1,'#12100c');q(17,37,4,1,'#12100c');});
  /* ===== Frostpeak Mountains ===== */
  SPR.frost_wolf=mkPix(32,40,(g,q)=>{
    q(3,38,26,2,'#00000030');
    q(0,12,4,7,'#b3c2d2');q(1,13,2,4,'#dbe6f0');
    q(3,16,20,13,'#b3c2d2');q(4,17,18,9,'#c9d6e2');q(5,18,16,5,'#dbe6f0');q(3,16,20,1,'#eef4fa');
    q(5,14,14,3,'#eef4fa');q(8,25,12,2,'#a6b6c8');
    q(19,8,10,12,'#c9d6e2');q(20,9,8,8,'#dbe6f0');q(19,8,10,1,'#eef4fa');
    q(25,5,3,4,'#a6b6c8');q(21,5,3,4,'#a6b6c8');q(26,6,1,2,'#dbe6f0');q(22,6,1,2,'#dbe6f0');
    q(27,13,4,4,'#c9d6e2');q(29,15,2,2,'#5a6a7a');q(31,14,1,1,'#241b12');
    q(23,11,3,2,'#1d3a52');q(24,11,1,1,'#66e0ff');q(22,17,5,1,'#8a9aac');
    q(5,29,3,8,'#8a9aac');q(10,29,3,8,'#a6b6c8');q(16,29,3,8,'#8a9aac');q(21,28,3,9,'#a6b6c8');
    q(5,37,3,1,'#5f6f80');q(10,37,3,1,'#5f6f80');q(16,37,3,1,'#5f6f80');q(21,37,3,1,'#5f6f80');});
  SPR.ice_sprite=mkPix(32,40,(g,q)=>{
    q(11,36,10,2,'#00000022');
    q(4,10,4,2,'#c9fff066');q(24,10,4,2,'#c9fff066');q(2,14,5,1,'#c9fff044');q(25,14,5,1,'#c9fff044');
    q(6,8,3,6,'#8fe0ff');q(23,8,3,6,'#8fe0ff');q(7,9,1,4,'#e6f9ff');q(24,9,1,4,'#e6f9ff');
    q(11,10,10,16,'#5ac8f0');q(12,11,8,13,'#8fe0ff');q(13,12,6,7,'#bfefff');q(11,10,10,1,'#e6f9ff');
    q(12,4,8,8,'#8fe0ff');q(13,5,6,6,'#bfefff');q(12,4,8,1,'#e6f9ff');
    q(13,7,2,2,'#1f6f9a');q(17,7,2,2,'#1f6f9a');q(13,7,1,1,'#0d3a52');q(17,7,1,1,'#0d3a52');
    q(15,2,2,3,'#e6f9ff');q(11,3,2,2,'#bfefff');q(19,3,2,2,'#bfefff');
    q(13,26,2,4,'#8fe0ff');q(17,26,2,4,'#8fe0ff');q(15,28,2,5,'#5ac8f0');q(15,32,2,2,'#bfefff');
    q(8,18,3,1,'#c9fff0');q(21,18,3,1,'#c9fff0');q(14,15,1,1,'#ffffff');q(17,13,1,1,'#ffffff');});
  SPR.snow_troll=mkPix(32,40,(g,q)=>{
    q(4,38,25,2,'#00000030');
    q(5,12,22,20,'#aebccb');q(6,13,20,16,'#cdd8e2');q(7,14,18,10,'#dde7ef');q(5,12,22,1,'#eef4fa');
    q(1,16,5,15,'#9fb0bd');q(2,17,3,11,'#b9c6d4');q(1,30,5,4,'#8a9aac');q(1,33,5,1,'#5f6f80');
    q(26,16,5,15,'#9fb0bd');q(27,17,3,11,'#b9c6d4');q(26,30,5,4,'#8a9aac');q(26,33,5,1,'#5f6f80');
    q(8,4,16,11,'#cdd8e2');q(9,5,14,9,'#dde7ef');q(8,4,16,1,'#eef4fa');
    q(10,2,4,3,'#8a9aac');q(18,2,4,3,'#8a9aac');
    q(10,8,4,3,'#1d3a52');q(18,8,4,3,'#1d3a52');q(11,9,2,1,'#66e0ff');q(19,9,2,1,'#66e0ff');
    q(11,13,10,2,'#8a9aac');q(12,11,2,3,'#efece0');q(18,11,2,3,'#efece0');
    q(12,24,8,3,'#8497aa');q(13,25,6,1,'#6f8296');
    q(8,32,6,5,'#8a9aac');q(18,32,6,5,'#8a9aac');q(8,37,6,1,'#5f6f80');q(18,37,6,1,'#5f6f80');});
  /* ===== Golden Plains ===== */
  SPR.steppe_lion=mkPix(32,40,(g,q)=>{
    q(3,38,26,2,'#00000030');
    q(3,17,18,12,'#b98d52');q(4,18,16,8,'#cba064');q(5,19,14,4,'#d8b078');q(3,17,18,1,'#e6c48e');
    q(0,15,3,3,'#a9793f');q(0,13,2,3,'#a9793f');q(1,12,2,2,'#8a6a42');
    q(17,4,14,20,'#8a5a28');q(18,5,12,17,'#a9793f');q(19,7,10,3,'#8a5a28');
    q(20,9,10,11,'#cba064');q(21,10,8,7,'#d8b078');q(20,9,10,1,'#e6c48e');
    q(22,6,3,3,'#a9793f');q(27,6,3,3,'#a9793f');
    q(23,13,3,2,'#241b12');q(24,13,1,1,'#e8b64c');q(28,16,3,2,'#8a6a42');q(29,17,2,1,'#241b12');
    q(23,19,5,2,'#e6c48e');q(24,20,2,1,'#4c3a28');
    q(5,29,4,8,'#a9793f');q(11,29,4,8,'#b98d52');q(17,29,4,8,'#a9793f');q(23,28,4,9,'#b98d52');
    q(5,37,4,1,'#6e4f28');q(11,37,4,1,'#6e4f28');q(17,37,4,1,'#6e4f28');q(23,37,4,1,'#6e4f28');});
  SPR.war_hawk=mkPix(32,40,(g,q)=>{
    q(8,38,16,2,'#00000030');
    q(10,8,12,22,'#5e4630');q(11,9,10,18,'#6e5236');q(12,10,8,10,'#7d6144');q(10,8,12,1,'#8a6f52');
    q(4,10,7,14,'#4e3826');q(5,11,5,10,'#5e4630');q(4,23,6,3,'#42301f');q(5,10,4,1,'#6e5236');
    q(21,10,7,14,'#4e3826');q(22,11,5,10,'#5e4630');q(22,23,6,3,'#42301f');q(23,10,4,1,'#6e5236');
    q(11,2,10,9,'#7d6144');q(12,3,8,7,'#8a6f52');q(11,2,10,1,'#9a7f5f');
    q(12,5,3,3,'#f0c419');q(18,5,3,3,'#f0c419');q(13,6,1,1,'#241b12');q(19,6,1,1,'#241b12');
    q(14,8,4,3,'#e8b64c');q(15,11,2,2,'#c98b2c');q(15,10,2,1,'#8a5a1c');
    q(12,27,8,4,'#efe6d2');q(13,28,6,2,'#d8cfb8');
    q(12,31,3,5,'#42301f');q(17,31,3,5,'#42301f');
    q(11,36,4,2,'#e8b64c');q(17,36,4,2,'#e8b64c');q(11,37,4,1,'#c98b2c');q(17,37,4,1,'#c98b2c');});
  SPR.nomad=mkPix(32,40,(g,q)=>{
    q(7,38,17,2,'#00000030');
    q(25,2,2,32,'#6b5138');q(25,2,1,32,'#8a6a42');
    q(23,0,6,5,'#e8b64c');q(24,1,4,3,'#ffe98a');q(25,2,2,1,'#fff7c9');
    q(8,13,15,17,'#8f7745');q(9,14,13,15,'#b89a5e');q(8,13,15,1,'#c7aa6c');q(9,28,13,2,'#6e5a33');
    q(10,20,11,2,'#7a3f2a');q(14,20,3,2,'#c9982c');
    q(5,15,4,10,'#8f7745');q(5,24,4,2,'#c9a97a');
    q(9,2,14,4,'#d6bb7e');q(8,4,16,3,'#c7aa6c');q(9,2,14,1,'#e6d29a');q(21,5,3,4,'#b89a5e');
    q(10,7,12,6,'#c98b5c');q(11,8,10,4,'#d8a06c');
    q(12,9,3,2,'#241b12');q(17,9,3,2,'#241b12');q(13,9,1,1,'#e8e2c8');q(18,9,1,1,'#e8e2c8');
    q(12,13,8,2,'#3a2a1a');
    q(10,30,5,7,'#5a4a2a');q(17,30,5,7,'#6e5a33');q(10,37,5,1,'#3a2f1a');q(17,37,5,1,'#3a2f1a');});
  /* ===== Ashen Desert ===== */
  SPR.scorpion=mkPix(32,40,(g,q)=>{
    q(3,38,26,2,'#00000030');
    q(19,14,3,5,'#a9793f');q(20,9,3,6,'#b98d52');q(22,5,4,5,'#cba064');q(25,7,3,3,'#d8b078');
    q(27,9,2,3,'#241b12');q(27,8,2,1,'#4c2a1a');
    q(5,20,18,10,'#8a6a3a');q(6,21,16,7,'#a9793f');q(7,22,14,4,'#b98d52');q(5,20,18,1,'#cba064');
    q(8,24,12,1,'#6e522c');q(8,27,12,1,'#6e522c');
    q(0,18,5,3,'#a9793f');q(0,15,3,4,'#b98d52');q(0,13,4,3,'#cba064');q(0,13,2,2,'#8a6a3a');
    q(27,18,5,3,'#a9793f');q(29,15,3,4,'#b98d52');q(28,13,4,3,'#cba064');q(30,13,2,2,'#8a6a3a');
    q(7,18,3,3,'#241b12');q(13,18,2,2,'#241b12');q(8,18,1,1,'#e8785f');q(13,18,1,1,'#e8785f');
    q(5,30,3,7,'#6e522c');q(11,30,3,7,'#8a6a3a');q(17,30,3,7,'#6e522c');q(22,30,3,7,'#8a6a3a');
    q(5,37,3,1,'#4c3a1e');q(11,37,3,1,'#4c3a1e');q(17,37,3,1,'#4c3a1e');q(22,37,3,1,'#4c3a1e');});
  SPR.sand_wraith=mkPix(32,40,(g,q)=>{
    q(9,37,14,2,'#00000018');
    q(3,8,3,3,'#e8b64c33');q(26,16,3,3,'#e8b64c33');q(5,24,2,2,'#e8b64c22');
    q(8,10,16,20,'#a89a78');q(9,11,14,17,'#c9bfa0');q(10,12,12,10,'#d8cfb2');q(8,10,16,1,'#e6ddc2');
    q(9,29,3,5,'#a89a78');q(14,30,3,6,'#c9bfa0');q(20,29,3,4,'#a89a78');
    q(10,31,1,3,'#8a7d5e');q(16,33,1,3,'#a89a78');
    q(9,3,14,9,'#8a7d5e');q(10,4,12,7,'#a89a78');q(9,3,14,1,'#c9bfa0');
    q(11,6,10,5,'#241b10');
    q(12,7,3,3,'#e8b64c');q(17,7,3,3,'#e8b64c');q(13,8,1,1,'#fff0a0');q(18,8,1,1,'#fff0a0');
    q(6,14,3,10,'#8a7d5e');q(23,14,3,10,'#8a7d5e');q(6,23,3,2,'#c9bfa0');q(23,23,3,2,'#c9bfa0');});
  SPR.dune_raider=mkPix(32,40,(g,q)=>{
    q(7,38,17,2,'#00000030');
    q(24,4,2,22,'#8a6a42');q(23,3,1,4,'#8a6a42');q(23,24,1,4,'#8a6a42');q(26,7,1,16,'#d8d5c8');
    q(9,14,14,16,'#5e4630');q(10,15,12,14,'#7a5a3a');q(9,14,14,1,'#8a6a45');q(10,28,12,2,'#46331f');
    q(10,17,12,2,'#c9982c');q(10,22,12,1,'#46331f');
    q(6,16,4,10,'#5e4630');q(22,16,3,8,'#5e4630');q(6,25,4,2,'#c9a97a');
    q(8,2,16,12,'#8a5a28');q(9,3,14,10,'#a9793f');q(8,2,16,1,'#b98d52');
    q(9,6,14,5,'#241b10');q(12,7,3,2,'#e8e2c8');q(17,7,3,2,'#e8e2c8');
    q(13,8,1,1,'#241b10');q(18,8,1,1,'#241b10');
    q(8,12,16,2,'#8a5a28');q(21,3,3,6,'#c9a06a');
    q(11,30,4,7,'#3a2c18');q(17,30,4,7,'#46331f');q(11,37,4,1,'#241b0e');q(17,37,4,1,'#241b0e');});
  /* ---- dungeon semi-bosses: 32x40 elites (name bar in p6) ---- */
  SPR.spider_matron=mkPix(32,40,(g,q)=>{
    q(3,38,26,2,'#00000030');
    q(0,22,7,1,'#1a1512');q(0,17,2,6,'#1a1512');q(1,30,6,1,'#1a1512');q(0,31,2,6,'#1a1512');
    q(25,22,7,1,'#1a1512');q(30,17,2,6,'#1a1512');q(25,30,6,1,'#1a1512');q(30,31,2,6,'#1a1512');
    q(2,14,3,4,'#241d1a');q(27,14,3,4,'#241d1a');
    q(6,16,20,19,'#1f1815');q(7,17,18,16,'#332824');q(8,18,16,10,'#443229');q(7,17,18,1,'#55433a');
    q(11,20,10,3,'#7a3f8a');q(13,25,6,2,'#7a3f8a');q(12,21,3,1,'#b06fd1');q(15,29,3,2,'#5a2f66');
    q(22,26,6,7,'#d8d5c8');q(23,27,4,5,'#efece0');q(24,28,2,2,'#c9c6b8');
    q(9,4,14,14,'#2a201b');q(10,5,12,11,'#443229');q(9,4,14,1,'#55433a');
    q(11,8,3,3,'#d94a3a');q(18,8,3,3,'#d94a3a');q(12,9,1,1,'#ffb09a');q(19,9,1,1,'#ffb09a');
    q(13,6,2,2,'#a83428');q(17,6,2,2,'#a83428');q(13,6,1,1,'#e8785f');q(18,6,1,1,'#e8785f');
    q(12,16,3,5,'#12100c');q(17,16,3,5,'#12100c');q(12,20,1,1,'#e8e2c8');q(18,20,1,1,'#e8e2c8');});
  SPR.ice_warden=mkPix(32,40,(g,q)=>{
    q(6,38,19,2,'#00000030');
    q(26,0,2,32,'#4a6a7a');q(26,0,1,32,'#7a9aac');
    q(24,0,6,7,'#8fe0ff');q(25,1,4,5,'#bfefff');q(26,2,2,2,'#e6f9ff');q(24,6,6,1,'#5ac8f0');
    q(8,13,16,17,'#2f5a72');q(9,14,14,15,'#376a86');q(8,13,16,1,'#4a86a6');q(9,28,14,2,'#204152');
    q(12,17,8,6,'#66e0ff');q(14,19,4,3,'#c9fff0');q(13,18,2,1,'#ffffff');
    q(4,12,5,8,'#8fe0ff');q(23,12,5,8,'#8fe0ff');q(5,13,3,5,'#bfefff');q(24,13,3,5,'#bfefff');
    q(4,20,5,6,'#2f5a72');q(23,20,5,6,'#2f5a72');q(5,25,3,2,'#bfefff');q(24,25,3,2,'#bfefff');
    q(9,2,14,11,'#bfefff');q(10,3,12,9,'#dbe6f0');q(9,2,14,1,'#e6f9ff');
    q(11,6,4,3,'#1f6f9a');q(17,6,4,3,'#1f6f9a');q(12,7,2,1,'#66e0ff');q(18,7,2,1,'#66e0ff');
    q(12,11,8,1,'#8fa8b8');q(8,0,4,3,'#8fe0ff');q(20,0,4,3,'#8fe0ff');
    q(10,30,5,7,'#204152');q(17,30,5,7,'#2f5a72');q(10,37,5,1,'#12283a');q(17,37,5,1,'#12283a');});
  SPR.barrow_wight=mkPix(32,40,(g,q)=>{
    q(7,38,17,2,'#00000030');
    q(25,4,2,26,'#3a3020');q(25,4,1,26,'#5a4c33');
    q(23,1,6,6,'#6f6352');q(24,2,4,4,'#8a7d68');q(25,3,2,2,'#4c4234');
    q(8,13,16,17,'#232c27');q(9,14,14,15,'#33403a');q(8,13,16,1,'#3e4d45');q(9,28,14,2,'#18201b');
    q(10,17,12,2,'#5a6a3a');q(10,23,12,1,'#18201b');q(15,17,2,2,'#c9982c');
    q(5,15,4,9,'#232c27');q(23,15,4,9,'#232c27');q(5,23,4,3,'#8a9a86');q(23,23,4,3,'#8a9a86');
    q(9,3,14,11,'#8a9a86');q(10,4,12,9,'#a2b2a0');q(9,3,14,1,'#b8c8b2');
    q(11,7,4,3,'#12100c');q(17,7,4,3,'#12100c');q(12,8,2,2,'#9bffb0');q(18,8,2,2,'#9bffb0');
    q(13,12,6,1,'#12100c');q(13,12,1,1,'#8a9a86');q(16,12,1,1,'#8a9a86');
    q(8,0,16,4,'#c9982c');q(8,0,16,1,'#e8c451');q(10,0,2,3,'#e8c451');q(15,0,2,3,'#e8c451');q(20,0,2,3,'#e8c451');
    q(11,2,2,2,'#7af0c9');q(19,2,2,2,'#7af0c9');
    q(10,30,4,6,'#18201b');q(18,30,4,6,'#232c27');q(9,36,6,2,'#33403a');q(17,36,6,2,'#33403a');});
  SPR.tomb_guardian=mkPix(32,40,(g,q)=>{
    q(6,38,20,2,'#00000030');
    q(25,2,2,24,'#7a5a2a');q(24,1,6,3,'#d0a83a');q(25,0,4,2,'#e6c451');q(28,3,3,4,'#e6c451');q(29,4,2,2,'#d0a83a');
    q(8,15,16,15,'#8a6a1c');q(9,16,14,13,'#b8912c');q(8,15,16,1,'#d0a83a');
    q(8,19,16,2,'#2b3a5a');q(8,24,16,1,'#2b3a5a');q(14,20,4,1,'#66e0ff');
    q(5,16,4,9,'#8a6a1c');q(23,16,4,9,'#8a6a1c');q(5,24,4,3,'#d0a83a');q(23,24,4,3,'#d0a83a');
    q(10,2,12,13,'#0f0d0a');q(11,3,10,11,'#1d1812');
    q(7,2,4,10,'#d0a83a');q(21,2,4,10,'#d0a83a');q(7,2,4,1,'#e6c451');q(21,2,4,1,'#e6c451');
    q(7,10,4,2,'#2b3a5a');q(21,10,4,2,'#2b3a5a');
    q(9,0,14,3,'#d0a83a');q(9,0,14,1,'#e6c451');q(15,1,2,2,'#e8642c');
    q(12,7,3,3,'#e8642c');q(17,7,3,3,'#e8642c');q(13,8,1,1,'#ffd060');q(18,8,1,1,'#ffd060');
    q(13,12,6,1,'#3a2f1a');q(14,4,4,2,'#2b3a5a');
    q(9,30,5,7,'#5a431a');q(18,30,5,7,'#6e5320');q(9,37,5,1,'#3a2c10');q(18,37,5,1,'#3a2c10');});
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
  SPR.gilded_scarab=mkPix(32,32,(g,q)=>{ /* event treasure critter */
    q(10,27,12,2,'#00000030');
    q(11,14,10,11,'#c9982c');q(12,15,8,9,'#f0c419');q(11,14,10,1,'#ffe98a');
    q(15,15,2,9,'#c9982c');                                   /* wing split */
    q(12,9,8,6,'#c9982c');q(13,10,6,4,'#e8b64c');             /* head */
    q(13,11,1,1,'#2b2b2b');q(18,11,1,1,'#2b2b2b');
    q(9,16,2,1,'#8a6a42');q(8,19,3,1,'#8a6a42');q(9,22,2,1,'#8a6a42');
    q(21,16,2,1,'#8a6a42');q(21,19,3,1,'#8a6a42');q(21,22,2,1,'#8a6a42');
    q(14,7,1,2,'#8a6a42');q(17,7,1,2,'#8a6a42');              /* antennae */
    q(13,17,2,2,'#fff0a0');q(17,20,1,1,'#fff0a0');});          /* glint */
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
  forgemaster:{body:'#4a4038',hair:'#6a2a1a',skin:'#c98b6e',prop:'hammer',apron:1,trim:'#f0c419'},
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
/* proper pixel-art icons: dark outline, base fill, top-light + bottom-shade,
   one specular glint. 16-unit grid drawn 2x (mk), parameterised by colour c. */
function iconShape(p,shape,c){
  const d=shade(c,-0.35),l=shade(c,0.3),o='#241b10',
        wd='#8a6a42',wdL='#a4855c',wdD='#5b4632',gold='#c9982c',goldL='#e8c451';
  switch(shape){
    case'sword':
      p(7,0,2,1,'#eef1f5');p(6,1,1,9,o);p(9,1,1,9,o);
      p(7,1,2,9,c);p(7,1,1,9,l);p(8,8,1,2,d);
      p(3,10,10,2,gold);p(3,10,10,1,goldL);p(3,10,1,2,o);p(12,10,1,2,o);
      p(7,12,2,3,wdD);p(7,12,1,3,wd);
      p(6,14,4,2,gold);p(6,14,4,1,goldL);break;
    case'bow':
      p(4,1,2,2,c);p(3,3,2,3,c);p(3,6,2,4,d);p(3,10,2,3,c);p(4,13,2,2,c);
      p(4,1,1,2,l);p(3,3,1,3,l);
      p(6,2,1,1,'#e8e2c8');p(7,3,1,10,'#e8e2c8');p(6,13,1,1,'#e8e2c8');
      p(8,7,5,1,wd);p(12,6,2,1,'#d8d5c8');p(12,8,2,1,'#d8d5c8');p(13,7,2,1,'#b8c4cf');break;
    case'staff':
      p(7,4,2,11,wd);p(7,4,1,11,wdL);p(7,14,2,1,wdD);
      p(5,0,6,1,o);p(4,1,1,4,o);p(11,1,1,4,o);p(5,5,6,1,o);
      p(5,1,6,4,c);p(6,2,4,2,l);p(7,2,1,1,'#ffffff');
      p(4,4,1,1,shade(c,0.5));p(11,1,1,1,shade(c,0.5));break;
    case'shield':
      p(3,2,10,1,o);p(2,3,1,6,o);p(13,3,1,6,o);p(3,9,1,2,o);p(12,9,1,2,o);
      p(4,11,1,2,o);p(11,11,1,2,o);p(5,13,2,1,o);p(9,13,2,1,o);p(7,14,2,1,o);
      p(3,3,10,6,c);p(4,9,8,2,c);p(5,11,6,2,c);p(7,13,2,1,c);
      p(3,3,10,1,l);p(4,4,1,4,l);p(10,4,2,6,d);p(8,11,3,2,d);
      p(6,5,4,4,gold);p(7,6,2,2,goldL);break;
    case'helm_m':
      p(4,2,8,1,o);p(3,3,1,8,o);p(12,3,1,8,o);p(7,1,2,1,goldL);
      p(4,3,8,4,c);p(4,3,8,1,l);p(4,4,1,3,l);
      p(4,7,2,4,c);p(10,7,2,4,c);p(4,10,2,1,d);p(10,10,2,1,d);
      p(6,7,4,1,d);p(6,8,4,3,'#12100c');p(7,9,1,1,'#e8642c');break;
    case'helm_r':
      p(4,3,8,1,o);p(3,4,1,6,o);p(12,4,1,6,o);
      p(4,4,8,3,c);p(4,4,8,1,l);p(3,7,3,5,c);p(10,7,3,5,c);
      p(3,11,3,1,d);p(10,11,3,1,d);p(6,7,4,2,'#12100c');p(6,9,4,1,d);break;
    case'helm_g':
      p(7,0,2,1,l);p(7,1,2,3,c);p(6,3,4,3,c);p(5,6,6,2,c);p(3,8,10,2,c);
      p(2,10,12,1,d);p(2,11,12,1,o);
      p(7,1,1,3,l);p(6,3,1,3,l);p(3,8,1,2,l);p(11,8,2,2,d);p(9,4,1,2,d);break;
    case'body':
      p(5,2,6,1,o);p(3,3,2,1,o);p(11,3,2,1,o);p(1,4,1,4,o);p(14,4,1,4,o);
      p(2,4,3,4,c);p(11,4,3,4,c);p(2,7,3,1,d);p(11,7,3,1,d);
      p(4,3,8,9,c);p(4,3,8,1,l);p(4,4,1,7,l);p(10,4,2,8,d);
      p(4,11,8,1,d);p(4,12,8,1,o);p(7,5,2,6,d);p(6,6,1,1,goldL);break;
    case'legs':
      p(4,2,8,1,o);p(3,3,1,3,o);p(12,3,1,3,o);
      p(4,3,8,3,c);p(4,3,8,1,l);p(7,6,2,2,d);
      p(4,6,3,8,c);p(9,6,3,8,c);p(4,6,1,8,l);p(11,6,1,8,d);
      p(4,14,3,1,o);p(9,14,3,1,o);break;
    case'cape':
      p(4,1,8,1,o);p(3,2,1,11,o);p(12,2,1,11,o);
      p(4,2,8,11,c);p(4,2,8,1,l);p(4,3,1,9,l);
      p(4,13,3,1,c);p(9,13,3,1,c);p(5,14,2,1,d);p(9,14,2,1,d);
      p(9,3,2,10,d);p(6,5,1,7,d);p(5,2,1,1,goldL);p(10,2,1,1,goldL);break;
    case'axe':
      p(8,2,2,12,wd);p(8,2,1,12,wdL);p(8,14,2,1,wdD);
      p(3,1,4,1,o);p(2,2,1,6,o);p(3,8,3,1,o);p(7,2,1,2,o);
      p(3,2,4,6,c);p(3,2,4,1,l);p(3,3,1,4,l);p(5,6,2,2,d);p(6,3,1,3,d);break;
    case'pick':
      p(8,3,2,11,wd);p(8,3,1,11,wdL);p(8,13,2,1,wdD);
      p(2,3,12,1,o);p(1,2,2,1,o);p(13,2,2,1,o);
      p(2,2,3,1,c);p(11,2,3,1,c);p(3,4,10,1,c);p(4,4,8,1,l);
      p(1,3,1,2,d);p(14,3,1,2,d);break;
    case'arrow':
      p(7,0,2,1,'#eef1f5');p(6,1,4,2,'#b8c4cf');p(7,3,2,1,'#8f9aa5');
      p(7,4,1,8,wd);p(8,4,1,8,wdD);
      p(5,11,2,3,c);p(9,11,2,3,c);p(6,13,1,2,c);p(9,13,1,2,c);
      p(5,11,1,2,shade(c,0.3));p(10,12,1,2,d);break;
    case'rune':
      p(5,2,6,1,o);p(4,3,1,10,o);p(11,3,1,10,o);p(5,13,6,1,o);
      p(5,3,6,10,c);p(5,3,6,1,l);p(5,4,1,8,l);p(10,4,1,9,d);
      p(7,5,2,1,'#ffffff');p(6,6,1,3,'#ffffff');p(9,6,1,3,'#ffffff');p(7,9,2,1,'#ffffff');break;
    case'logs':
      p(3,4,9,3,shade(wd,-0.1));p(3,4,9,1,wdL);p(12,4,2,3,wdD);p(2,5,1,2,wdD);
      p(2,8,11,1,o);p(2,9,11,4,wd);p(2,9,11,1,wdL);p(2,12,11,1,wdD);
      p(13,8,2,5,wdD);p(13,9,1,3,wdL);p(14,10,1,1,'#c9a97a');break;
    case'ore':
      p(4,6,8,1,o);p(3,7,1,6,o);p(12,7,1,6,o);p(4,13,8,1,o);
      p(4,7,8,6,'#57524b');p(4,7,8,1,'#6b665e');p(4,12,8,1,'#44413c');
      p(6,8,2,2,c);p(9,10,2,2,c);p(5,11,2,1,c);
      p(6,8,1,1,shade(c,0.45));p(9,10,1,1,shade(c,0.45));break;
    case'bone':
      p(2,6,3,2,'#efece0');p(2,9,3,2,'#efece0');p(11,6,3,2,'#efece0');p(11,9,3,2,'#efece0');
      p(4,7,8,3,'#e0ddd0');p(4,7,8,1,'#efece0');p(4,9,8,1,'#b9b6a8');
      p(2,8,1,1,'#b9b6a8');p(13,8,1,1,'#b9b6a8');p(5,8,2,1,'#f7f4e8');break;
    case'pelt':
      p(4,3,8,1,o);p(3,4,1,8,o);p(12,4,1,8,o);
      p(4,4,8,8,c);p(4,4,8,1,shade(c,0.25));
      p(4,12,2,2,c);p(10,12,2,2,c);p(7,12,2,3,c);p(4,13,1,1,d);p(11,13,1,1,d);
      p(6,6,4,4,shade(c,0.15));p(7,7,2,2,shade(c,-0.2));break;
    case'dust':
      p(5,10,6,2,c);p(4,12,8,2,shade(c,-0.2));p(6,9,4,1,shade(c,0.3));p(4,14,8,1,shade(c,-0.4));
      p(4,4,1,1,c);p(8,2,1,1,shade(c,0.45));p(11,5,1,1,c);p(9,7,1,1,shade(c,0.3));p(6,6,1,1,shade(c,0.45));break;
    case'herb':
      p(8,6,1,7,'#3a6a2c');p(7,13,3,1,'#2c521f');p(9,8,2,1,'#3a6a2c');p(6,10,2,1,'#3a6a2c');
      p(5,3,3,3,c);p(9,4,3,3,c);p(6,7,3,3,c);p(11,8,2,2,c);
      p(6,4,1,1,shade(c,0.45));p(10,5,1,1,shade(c,0.45));p(7,8,1,1,shade(c,0.45));break;
    case'gem':
      p(6,3,4,1,o);p(4,4,2,1,o);p(10,4,2,1,o);p(3,5,1,3,o);p(12,5,1,3,o);
      p(5,8,1,2,o);p(10,8,1,2,o);p(7,11,2,2,o);p(6,10,1,1,o);p(9,10,1,1,o);
      p(6,4,4,1,l);p(4,5,8,3,c);p(6,8,4,2,d);p(7,10,2,1,shade(c,-0.5));
      p(5,5,1,2,'#ffffff');p(7,4,2,1,'#ffffff');p(9,6,2,2,d);break;
    case'bread':
      p(4,5,8,1,o);p(3,6,1,5,o);p(12,6,1,5,o);p(4,11,8,1,o);
      p(4,6,8,5,c);p(4,6,8,2,shade(c,0.3));p(4,10,8,1,d);
      p(6,7,1,3,d);p(9,7,1,3,d);p(5,6,1,1,'#fff0d0');break;
    case'meat':
      p(4,5,7,1,o);p(3,6,1,5,o);p(11,6,1,4,o);p(4,11,7,1,o);
      p(4,6,7,5,c);p(4,6,7,2,shade(c,0.25));p(4,10,7,1,d);
      p(11,6,3,3,'#efece0');p(12,5,2,2,'#efece0');p(13,8,1,1,'#c9c6b8');
      p(5,7,3,2,shade(c,0.35));break;
    case'pie':
      p(3,6,10,1,o);p(2,7,1,4,o);p(13,7,1,4,o);p(3,11,10,1,o);
      p(3,7,10,4,c);p(3,7,10,1,shade(c,0.35));p(3,10,10,1,d);
      p(4,5,2,2,c);p(7,4,2,3,c);p(10,5,2,2,c);p(7,4,1,1,shade(c,0.35));
      p(5,9,1,1,d);p(8,9,1,1,d);p(11,9,1,1,d);break;
    case'stew':
      p(3,8,10,1,o);p(2,9,1,3,o);p(13,9,1,3,o);p(3,12,10,1,o);p(5,13,6,1,'#4c4841');
      p(3,9,10,3,'#6d6a63');p(3,9,10,1,'#8a877f');
      p(4,7,8,2,c);p(4,7,8,1,shade(c,0.3));p(6,7,2,1,'#e8dcc3');p(10,8,1,1,'#e8dcc3');
      p(5,4,1,2,'#e8dcc366');p(10,3,1,2,'#e8dcc366');break;
    case'coin':
      p(6,3,4,1,o);p(4,4,2,1,o);p(10,4,2,1,o);p(3,5,1,6,o);p(12,5,1,6,o);
      p(4,11,2,1,o);p(10,11,2,1,o);p(6,12,4,1,o);
      p(4,5,8,6,c);p(6,4,4,1,c);p(6,11,4,1,c);
      p(6,4,3,1,shade(c,0.4));p(4,5,2,4,shade(c,0.25));p(10,7,2,4,d);
      p(7,6,2,4,d);p(6,7,1,2,shade(c,-0.15));p(5,5,1,1,'#fff0a0');break;
    case'bar':
      p(3,7,10,1,o);p(2,8,1,4,o);p(13,8,1,4,o);p(3,12,10,1,o);
      p(3,8,10,4,c);p(3,8,10,1,shade(c,0.4));p(3,11,10,1,shade(c,-0.35));
      p(4,9,3,1,shade(c,0.55));p(11,9,1,2,d);break;
  }
}
const ITEM_ICON={
  logs:['logs','#8a6a42'],oak_logs:['logs','#5b4632'],
  maple_logs:['logs','#a8702f'],yew_logs:['logs','#2f5a34'],
  copper_ore:['ore','#c47f3e'],
  coal:['ore','#2b2b2b'],mithril_ore:['ore','#6fb7ff'],adamant_ore:['ore','#5f9e6e'],runite_ore:['ore','#59c1c9'],
  bronze_bar:['bar','#a9714b'],iron_bar:['bar','#b8c4cf'],steel_bar:['bar','#8f9aa5'],
  mithril_bar:['bar','#6fb7ff'],adamant_bar:['bar','#5f9e6e'],rune_bar:['bar','#59c1c9'],
  iron_ore:['ore','#9fb0bd'],bone:['bone','#d8d5c8'],wolf_pelt:['pelt','#8b8b8b'],
  ancient_dust:['dust','#b0a0e0'],swamp_herb:['herb','#7af0c9'],gem:['gem','#66e0ff'],
  spider_silk:['pelt','#d8d5e8'],thick_fur:['pelt','#b9c6d4'],lion_fang:['bone','#e6c48e'],scarab_shell:['gem','#6a8a4e'],
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
/* hold-to-steer state (written by input in p8, consumed by update below) */
const HOLD={down:false,cx:0,cy:0,t0:0,onDrop:false,steer:false};
/* virtual joystick state (bottom-centre pad in p8; dx/dy are -1|0|1 sectors) */
const JOY={active:false,dx:0,dy:0,moved:false};
/* living-world event scheduler (ambient RNG only — see rollWorldEvent) */
const EVT={next:0};
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
  if(REGION_ORDER.includes(P.map)){if(!P.reached)P.reached={};P.reached[P.map]=true;}
  ambientBiome();
  const zl=$('zone');zl.textContent=MAPS[P.map].name;
  zl.classList.remove('go');void zl.offsetWidth;zl.classList.add('go');
  save();
}

/* ---------------- fast travel ----------------
   Home to town + any region already reached on foot; blocked while a mob is
   actively attacking you (can't teleport out of a fight). Arrives at the safe
   top-of-region tile. Dungeons are not travel targets — enter them on foot. */
const WARP={town:[20,17],forest:[30,2],mountains:[30,2],plains:[30,2],desert:[30,2]};
function underAttack(){return world[P.map].mobs.some(m=>m.alive&&m.aggro);}
function warpTo(dest){
  if(!world[dest]||!WARP[dest])return;
  if(dest===P.map){toast('You are already here.');return;}
  if(underAttack()){toast('Cannot travel while under attack!','bad');return;}
  const[x,y]=WARP[dest];
  P.map=dest;P.tx=x;P.ty=y;P.px=x*TILE;P.py=y*TILE;
  P.path=[];P.moving=null;P.action=null;
  world[dest].mobs.forEach(m=>m.aggro=false);
  if(REGION_ORDER.includes(dest)){if(!P.reached)P.reached={};P.reached[dest]=true;}
  ambientBiome();
  const zl=$('zone');zl.textContent=MAPS[dest].name;zl.classList.remove('go');void zl.offsetWidth;zl.classList.add('go');
  sfx('warp');save();
}

/* ---------------- current combat mode from weapon ---------------- */
function combatMode(){ // 'melee'|'ranged'|'magic'
  const w=P.gear.weapon&&GEAR[P.gear.weapon.id];
  if(!w)return'melee';
  return w.line==='r'?'ranged':w.line==='g'?'magic':'melee';
}
function weaponRange(){
  const m=combatMode();
  if(m!=='melee')return m==='ranged'?4:5;
  let r=1; /* the 'reach' effect extends melee range */
  for(const e of weaponEffects(P.gear.weapon))
    if(e.k==='reach')r+=(e.greater?EFFECTS.reach.g:EFFECTS.reach.mag).range;
  return r;
}
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
  /* softened so fighting off-style is a mild penalty, not a death sentence */
  if((att==='melee'&&def==='ranged')||(att==='ranged'&&def==='magic')||(att==='magic'&&def==='melee'))return 1.18;
  return 0.88;
}
/* player attack + max hit from skills, gear, style, capes */
function playerAttack(){
  const b=gearBonus(),m=combatMode();
  let accSkill = m==='ranged'?lvl('ranged') : m==='magic'?lvl('magic') : lvl('attack');
  let powSkill = m==='ranged'?lvl('ranged') : m==='magic'?lvl('magic') : lvl('strength');
  const w=P.gear.weapon&&GEAR[P.gear.weapon.id];
  const ws=w?gearStats(P.gear.weapon):{acc:2,pow:1};
  let acc = accSkill*2 + (ws.acc||0)*1.5 + 8;
  let pow = 2 + powSkill*0.38 + (ws.pow||0)*0.5
          + (m==='ranged'?b.rpow:m==='magic'?b.mpow:0)*0.5;
  if(m==='melee'&&P.style==='accurate')acc*=1.12;
  if(m==='melee'&&P.style==='aggressive')pow*=1.1;
  if(perkActive('acc'))acc*=1.05;
  if(m==='melee'&&perkActive('meleedmg'))pow*=1.05;
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
/* collection log: credit `amt` of `key` to creature `src`. No-op when untagged —
   player-dropped / quest / gravestone loot carries no source creature. */
function bestiaryCredit(src,key,amt){
  if(!src||!key||amt<=0)return;
  const b=P.bestiary||(P.bestiary={}),e=b[src]||(b[src]={});
  e[key]=(e[key]||0)+amt;
}
function spawnDrop(map,x,y,payload){ // payload {gold?, items?:[{id,qty}|{gear}], src?}
  let d=dropAt(map,x,y);
  if(!d){d={x,y,gold:0,items:[],ts:T,grave:false};world[map].drops.push(d);}
  d.ts=T;
  const src=payload.src;
  if(payload.gold){d.gold+=payload.gold;if(src)d.goldSrc=src;}
  if(payload.items)for(const it of payload.items){
    if(it.gear){d.items.push({gear:it.gear,src});continue;}
    const ex=d.items.find(s=>s.id===it.id&&!s.gear);
    if(ex){ex.qty+=it.qty;if(src)ex.src=src;}else d.items.push({id:it.id,qty:it.qty,src});
  }
  return d;
}
function bestRarityOf(d){
  let r=0;for(const it of d.items)if(it.gear&&(it.gear.r||0)>r)r=it.gear.r;
  return r;
}
function pickupDrop(d){
  const W=world[P.map];
  if(d.gold>0){addGold(d.gold);floater(P.px+16,P.py-10,'+'+d.gold+'g','#e8b64c');sfx('coin');
    bestiaryCredit(d.goldSrc,'gold',d.gold);d.gold=0;}
  const remain=[];
  for(const it of d.items){
    if(it.gear){
      if(addGear(it.gear)){
        const nm=gearName(it.gear),r=it.gear.r||0,g0=GEAR[it.gear.id],special=g0&&(g0.fusion||g0.unique);
        bestiaryCredit(it.src,special?it.gear.id:'gear',1);
        if(special)markDiscovered(it.gear.id);
        if(r>=3||special){itemPopup(it.gear);P.stats.bestDrop=nm;if(r>=4)P.stats.legendaries++;}
        else{toast('+ '+nm,r>=2?'gold':'drop');sfx('loot');}
      }else{remain.push(it);toast('Inventory full','bad');}
    }else{
      if(addItem(it.id,it.qty)){bestiaryCredit(it.src,it.id,it.qty);
        toast('+'+it.qty+' '+ITEMS[it.id].name,'drop');sfx('loot');}
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
/* selective pickup for the long-tap floor menu: take ONE entry ('gold' or a
   specific item-entry object). Returns true | 'full' | false. */
function pickupOne(d,spec){
  const W=world[P.map];
  if(spec==='gold'){
    if(d.gold<=0)return false;
    addGold(d.gold);floater(P.px+16,P.py-10,'+'+d.gold+'g','#e8b64c');sfx('coin');
    bestiaryCredit(d.goldSrc,'gold',d.gold);d.gold=0;
  }else{
    const idx=d.items.indexOf(spec);if(idx<0)return false;
    const it=spec;
    if(it.gear){
      if(!addGear(it.gear))return 'full';
      const nm=gearName(it.gear),r=it.gear.r||0,g0=GEAR[it.gear.id],special=g0&&(g0.fusion||g0.unique);
      bestiaryCredit(it.src,special?it.gear.id:'gear',1);
      if(special)markDiscovered(it.gear.id);
      if(r>=3||special){itemPopup(it.gear);P.stats.bestDrop=nm;if(r>=4)P.stats.legendaries++;}
      else{toast('+ '+nm,r>=2?'gold':'drop');sfx('loot');}
    }else{
      if(!addItem(it.id,it.qty))return 'full';
      bestiaryCredit(it.src,it.id,it.qty);toast('+'+it.qty+' '+ITEMS[it.id].name,'drop');sfx('loot');
    }
    d.items.splice(idx,1);
  }
  if(!d.items.length&&d.gold<=0){if(d.grave)P.grave=null;W.drops.splice(W.drops.indexOf(d),1);}
  save();return true;
}

/* ---------------- loot generation ---------------- */
function rollLoot(mob){
  const d=MOBS[mob.type];
  const out={gold:0,items:[]};
  const rolls=(d.boss||d.semi)?2:1; /* bosses + dungeon semi-bosses roll twice */
  /* fodder drops the biome's gear line; bosses/semis stay any-line jackpots */
  const biomeLine=(d.boss||d.semi)?null:BIOME_LINE[P.map];
  for(let i=0;i<rolls;i++){
    const e=lootRoll(d.loot);
    if(e.gold)out.gold+=rand(e.gold[0],e.gold[1]);
    else if(e.item)out.items.push({id:e.item,qty:rand(e.q[0],e.q[1])});
    else if(e.gear){
      const tier=rand(e.gear.tierMin,e.gear.tierMax);
      const lines=e.gear.line?[e.gear.line]:(biomeLine?[biomeLine]:['m','r','g']);
      const line=lines[rand(0,lines.length-1)];
      const slots=Object.keys(LINE_DEFS[line].slots);
      const slot=slots[rand(0,slots.length-1)];
      out.items.push({gear:{id:`g_${line}_${tier}_${slot}`,r:rollRarity(d.rarityBoost||0)}});
    }
  }
  /* boss signature drop: ~14% chance to also drop its unique (rarity 5) */
  if(d.unique&&GEAR[d.unique]&&Math.random()<0.14)out.items.push({gear:{id:d.unique,r:5}});
  /* fusion ingredient: the source creature rarely drops its tier-1 special */
  const fd=MOB_FUSION_DROP[mob.type];
  if(fd&&GEAR[fd]&&Math.random()<FUSION_DROP_CHANCE)out.items.push({gear:{id:fd,r:rollRarity(d.rarityBoost||0)}});
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

/* ---------------- special attacks (⚡ button) ----------------
   Guaranteed-hit signature moves resolved by weapon (see SPECIALS in p1).
   Costs SPEC_COST energy; energy regenerates over time in update(). */
function specDamage(t,dmg){ /* one packet of special damage, with feedback */
  t.hp-=dmg;t.aggro=true;
  floater(t.px+16,t.py-6,'-'+dmg,'#ffd24a',13);
  spawnParticles(t.px+16,t.py+8,'#ffe98a',8,1.5);
  gainXp(trainSkill(),dmg*4);
  if(t.hp<=0)killMob(t);
}
function useSpecial(){
  if((P.spec||0)<SPEC_COST){toast('⚡ Not enough energy','bad');return;}
  const t=P.action&&P.action.kind==='fight'?findTarget():null;
  if(!t||!t.alive){toast('Attack a target first, then unleash ⚡');return;}
  if(distTiles(P.tx,P.ty,t.tx,t.ty)>weaponRange()){toast('Too far away!');return;}
  if(T-(P.eatT||0)<900)return; /* just ate */
  const atk=playerAttack(),mode=atk.mode,md=MOBS[t.type];
  const key=specKeyForWeapon(),sp=SPECIALS[key];
  const ammo=ammoFor(mode);
  if(ammo){const need=key==='ranged'?3:1;
    if(invCount(ammo)<need){toast('Not enough '+ITEMS[ammo].name+'!','bad');return;}
    removeItem(ammo,need);}
  P.spec-=SPEC_COST;P.atkT=T;P.specT=T;
  const tri=triangle(mode,md.style);
  const base=mult=>Math.max(1,Math.round(atk.maxHit*mult*tri*(rand(88,100)/100)));
  sfx('spec');shake(4);
  floater(P.px+16,P.py-20,sp.name+'!','#f0c419',12);
  const others=fn=>{for(const m of world[P.map].mobs){if(m!==t&&m.alive)fn(m);}};
  switch(key){
    case'melee':specDamage(t,base(1.8));break;
    case'ranged':{for(let i=0;i<3;i++){shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#ffd24a');
      if(t.alive)specDamage(t,base(0.8));}sfx('shoot');break;}
    case'magic':{shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#c9a5ff');specDamage(t,base(1.4));
      const s=base(0.6);others(m=>{if(distTiles(m.tx,m.ty,t.tx,t.ty)<=1)specDamage(m,s);});break;}
    case'poison':case'burn':case'bleed':{specDamage(t,base(1.3));
      if(t.alive){const g=EFFECTS[key].g;addDot(t,key,g.dmg*2,g.ticks);}break;}
    case'cleave':{specDamage(t,base(1.0));
      others(m=>{if(distTiles(m.tx,m.ty,P.tx,P.ty)<=1)specDamage(m,base(1.0));});break;}
    case'pierce':{specDamage(t,base(1.0));
      const dx=Math.sign(t.tx-P.tx),dy=Math.sign(t.ty-P.ty);
      for(let i=1;i<=4;i++){const m=mobAt(P.map,P.tx+dx*i,P.ty+dy*i);
        if(m&&m!==t&&m.alive)specDamage(m,base(0.8));}break;}
    case'knockback':{specDamage(t,base(1.2));if(t.alive)knockbackMob(t,2);
      others(m=>{if(distTiles(m.tx,m.ty,P.tx,P.ty)<=1){specDamage(m,base(0.8));if(m.alive)knockbackMob(m,2);}});break;}
    case'reach':{specDamage(t,base(1.4));
      others(m=>{if(distTiles(m.tx,m.ty,t.tx,t.ty)<=1&&distTiles(m.tx,m.ty,P.tx,P.ty)<=weaponRange())specDamage(m,base(0.9));});break;}
    case'crush':specDamage(t,base(1.6));break;
    case'execute':specDamage(t,base(t.hp/md.hp<=0.5?2.2:1.4));break;
    case'lifesteal':{const d0=base(1.5);specDamage(t,d0);
      const heal=Math.min(maxHp()-P.hp,d0);
      if(heal>0){P.hp+=heal;floater(P.px+8,P.py-28,'+'+heal,'#c98bff',10);}break;}
    case'slashwave':{specDamage(t,base(1.2));const wave=base(1.0);
      shoot(P.px+16,P.py+8,P.px+16+P.facing*120,P.py+8,'#f0c419');
      for(let i=1;i<=4;i++){const m=mobAt(P.map,P.tx+P.facing*i,P.ty);
        if(m&&m!==t&&m.alive)specDamage(m,wave);}break;}
  }
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
    if(P.tx===t.x&&P.ty===t.y){
      if(P.action.one){if(pickupOne(t,P.action.one)==='full')toast('Inventory full!','bad');}
      else pickupDrop(t);
      P.action=null;
    }
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
    if(d.skill==='woodcutting'&&perkActive('chop'))speed*=0.9;
    if(d.skill==='mining'&&perkActive('mine'))speed*=0.9;
    P.action.prog=(P.action.prog||0)+FRAME_DT;
    if(P.action.prog>=speed){
      P.action.prog=0;
      addItem(d.item,1);
      gainXp(d.skill,d.xp);
      sfx(d.skill==='woodcutting'?'chop':'mine');
      toast('+1 '+ITEMS[d.item].name,'drop');
      questEvent('gather',d.item);
      if(d.skill==='woodcutting')P.stats.chopped++;else P.stats.mined++;
      /* node charges: keep working the same node until its charges run out */
      t.charges=(t.charges!=null?t.charges:(d.hp||1))-1;
      if(t.charges>0)return; /* still yields — stay on this node next tick */
      t.alive=false;t.respawnAt=T+d.respawn;
      const next=nearestRes(t.type,t.x,t.y);
      if(next)setGather(next);else{P.action=null;toast('Node depleted. Tap another resource.');}
    }
    return;
  }
  if(P.action.kind==='fight'){
    t.aggro=true;
    if(T-(P.eatT||0)<900)return; /* just ate (snappier than the old 1.2 s) */
    if(T-(P.atkT||0)>=weaponSpeed()){
      const atk=playerAttack();
      const mode=atk.mode;
      /* ammo check + consumption (cape perk: chance to save) */
      const ammo=ammoFor(mode);
      if(ammo){
        if(invCount(ammo)<=0){toast('Out of '+ITEMS[ammo].name+'!','bad');P.action=null;return;}
        const saveEff=mode==='ranged'?'savearrow':'saverune';
        if(!(perkActive(saveEff)&&Math.random()<0.10))removeItem(ammo,1);
        if(invCount(ammo)===50)toast('Only 50 '+ITEMS[ammo].name+' left','bad');
      }
      P.atkT=T;
      const md=MOBS[t.type];
      const tri=triangle(mode,md.style);
      const fx=mode==='melee'?weaponEffects(P.gear.weapon):[]; /* fusion on-hit effects */
      /* crush: ignore part of the target's armour */
      let defRoll=md.def*2+8;
      for(const e of fx)if(e.k==='crush')defRoll*=(1-(e.greater?EFFECTS.crush.g:EFFECTS.crush.mag).pct);
      const chance=hitChance(atk.acc*(tri>1?1.07:tri<1?0.93:1), defRoll);
      let dmg=0;
      if(Math.random()<chance){
        dmg=Math.max(1,Math.round(rand(Math.ceil(atk.maxHit*0.35),atk.maxHit)*tri));
        /* execute: extra damage to wounded foes */
        for(const e of fx)if(e.k==='execute'){const em=e.greater?EFFECTS.execute.g:EFFECTS.execute.mag;
          if(t.hp/md.hp<=em.hp)dmg=Math.round(dmg*(1+em.pct));}
      }
      if(mode==='ranged'){shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#d8d5c8');sfx('shoot');}
      else if(mode==='magic'){shoot(P.px+16,P.py+8,t.px+16,t.py+8,'#b06fd1');sfx('zap');}
      else sfx('hit');
      t.hp-=dmg;
      const big=dmg>0&&dmg>=atk.maxHit*0.75;
      floater(t.px+16,t.py-6,dmg>0?'-'+dmg:'miss',dmg>0?(big?'#ffd24a':'#ffe3a0'):'#9aa',dmg>0?(big?13:10):9);
      if(dmg>0){
        spawnParticles(t.px+16,t.py+8,mode==='magic'?'#c9a5ff':mode==='ranged'?'#e8e2c8':'#ffd27a',big?9:5,big?1.6:1);
        gainXp(trainSkill(),dmg*4);
        if(mode!=='melee')dailyEvent('stylehit',null,1);
        if(fx.length)applyOnHit(t,dmg,fx);
      }
      if(fx.length)slashSwing(t,fx,atk); /* slashwave counts every swing, hit or miss */
      if(t.hp<=0)killMob(t);
    }
  }
}
/* ---------------- fusion weapon on-hit effects (§9) ---------------- */
const DOT_INTERVAL=600; /* ms between damage-over-time ticks */
function addDot(m,k,dmg,ticks){
  m.dots=m.dots||[];
  const ex=m.dots.find(d=>d.k===k);
  if(ex){ex.dmg=Math.max(ex.dmg,dmg);ex.ticks=Math.max(ex.ticks,ticks);}
  else m.dots.push({k,dmg,ticks,next:T+DOT_INTERVAL,skill:trainSkill()});
}
function tickDots(m){
  if(!m.dots||!m.dots.length)return;
  for(let i=m.dots.length-1;i>=0;i--){
    const dt=m.dots[i];if(T<dt.next)continue;
    dt.next=T+DOT_INTERVAL;dt.ticks--;
    m.hp-=dt.dmg;
    floater(m.px+16,m.py-6,'-'+dt.dmg,EFFECTS[dt.k].color,9);
    spawnParticles(m.px+16,m.py+6,EFFECTS[dt.k].color,3,0.7);
    gainXp(dt.skill,dt.dmg*2);
    if(dt.ticks<=0)m.dots.splice(i,1);
    if(m.hp<=0){killMob(m);return;}
  }
}
function knockbackMob(m,tiles){
  if(m.moving)return;
  const dx=Math.sign(m.tx-P.tx),dy=Math.sign(m.ty-P.ty);
  if(!dx&&!dy)return;
  let nx=m.tx,ny=m.ty;
  for(let i=0;i<tiles;i++){const tx=nx+dx,ty=ny+dy;
    if(walkable(P.map,tx,ty)&&!mobAt(P.map,tx,ty)&&!(tx===P.tx&&ty===P.ty)){nx=tx;ny=ty;}else break;}
  if(nx!==m.tx||ny!==m.ty){m.tx=nx;m.ty=ny;m.px=nx*TILE;m.py=ny*TILE;}
}
function cleaveHit(primary,dmg,pct){ /* splash to every other foe around the player */
  const extra=Math.max(1,Math.round(dmg*pct));
  for(const m of world[P.map].mobs){
    if(m===primary||!m.alive)continue;
    if(distTiles(m.tx,m.ty,P.tx,P.ty)<=1){
      m.hp-=extra;m.aggro=true;floater(m.px+16,m.py-6,'-'+extra,'#e8c451',9);
      if(m.hp<=0)killMob(m);
    }
  }
}
function pierceHit(primary,dmg,range){ /* run through foes in a line beyond the target */
  const dx=Math.sign(primary.tx-P.tx),dy=Math.sign(primary.ty-P.ty);
  if(!dx&&!dy)return;
  const extra=Math.max(1,Math.round(dmg*0.6));
  for(let i=1;i<=range;i++){const m=mobAt(P.map,P.tx+dx*i,P.ty+dy*i);
    if(m&&m!==primary&&m.alive){m.hp-=extra;m.aggro=true;floater(m.px+16,m.py-6,'-'+extra,'#8fe0ff',9);if(m.hp<=0)killMob(m);}}
}
function slashSwing(t,fx,atk){ /* every Nth swing looses a blade wave along facing */
  for(const e of fx)if(e.k==='slashwave'){
    const sm=e.greater?EFFECTS.slashwave.g:EFFECTS.slashwave.mag;
    P.swing=(P.swing||0)+1;
    if(P.swing%sm.every!==0)continue;
    const wave=Math.max(1,Math.round(atk.maxHit*sm.pct));
    shoot(P.px+16,P.py+8,P.px+16+P.facing*90,P.py+8,'#f0c419');
    for(let i=1;i<=3;i++){const m=mobAt(P.map,P.tx+P.facing*i,P.ty);
      if(m&&m.alive){m.hp-=wave;m.aggro=true;floater(m.px+16,m.py-6,'-'+wave,'#f0c419',10);if(m.hp<=0)killMob(m);}}
  }
}
function applyOnHit(t,dmg,fx){
  const alive=t.hp>0;
  for(const e of fx){
    const k=e.k,mg=e.greater?EFFECTS[k].g:EFFECTS[k].mag;
    if(EFFECTS[k].dot){if(alive)addDot(t,k,mg.dmg,mg.ticks);}
    else if(k==='lifesteal'){const heal=Math.max(1,Math.round(dmg*mg.pct));
      if(P.hp<maxHp()){P.hp=Math.min(maxHp(),P.hp+heal);floater(P.px+8,P.py-20,'+'+heal,'#c98bff',9);updateHUD();}}
    else if(k==='knockback'){if(alive)knockbackMob(t,mg.tiles);}
    else if(k==='cleave')cleaveHit(t,dmg,mg.pct);
    else if(k==='pierce')pierceHit(t,dmg,mg.range);
  }
}
function killMob(m){
  const d=MOBS[m.type];
  m.alive=false;m.aggro=false;m.dots=[];m.respawnAt=T+(d.respawn||9000);
  gainXp(trainSkill(),d.xp);
  const loot=rollLoot(m);loot.src=m.type; /* tag for the bestiary */
  if(m.elite){ /* elites: double XP + two bonus loot rolls */
    gainXp(trainSkill(),d.xp);
    for(let i=0;i<2;i++){const ex=rollLoot(m);loot.gold+=ex.gold;loot.items.push(...ex.items);}
    floater(m.px+16,m.py-14,'ALPHA SLAIN','#f0c419',12);
  }
  spawnDrop(P.map,m.tx,m.ty,loot);
  if(d.flee){sfx('rare');spawnParticles(m.px+16,m.py+8,'#ffd700',26,2.2);toast('✨ Caught it! The scarab bursts with treasure!','gold');}
  sfx('kill');
  spawnParticles(m.px+16,m.py+10,d.boss?'#ffcf5a':'#e8b070',d.boss?22:12,d.boss?2.2:1.4);
  P.stats.kills++;
  (P.stats.mobKills||(P.stats.mobKills={}))[m.type]=(P.stats.mobKills[m.type]||0)+1;
  if(d.boss){
    P.stats.bossKills[m.type]=(P.stats.bossKills[m.type]||0)+1;
    levelFlash(d.name+' defeated!');shake(6);
  }
  questEvent('kill',m.type,P.map);
  /* only auto-chain to the next foe when we were actually fighting — an off-screen
     DoT/cleave/pierce kill must not hijack gathering or walking */
  if(P.action&&P.action.kind==='fight'){
    const next=nearestMob(m.type,P.tx,P.ty);
    if(next)setFight(next);else P.action=null;
  }
  save();
}
function hurtPlayer(dmg){
  if(perkActive('dmgred'))dmg=Math.max(0,Math.round(dmg*0.95));
  if(dmg<=0){floater(P.px+16,P.py-10,'miss','#9aa');return;}
  P.hp-=dmg;P.lastHurt=T;sfx('hurt');
  shake(Math.min(9,2.5+dmg*0.5));
  spawnParticles(P.px+16,P.py+8,'#e85b4a',5,1);
  floater(P.px+16,P.py-10,'-'+dmg,'#ff6a5a',11);
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
      if(!m.temp&&T>=m.respawnAt){m.alive=true;m.hp=d.hp;m.dots=[];m.tx=m.hx;m.ty=m.hy;m.px=m.tx*TILE;m.py=m.ty*TILE;m.moving=null;
        /* rare ELITE respawn: tougher, meaner, triple loot (ambient RNG so the
           gameplay/loot stream — and the smoke tests — stay undisturbed) */
        m.elite=(!d.boss&&!d.semi&&!d.flee&&ambChance(0.04));
        if(m.elite)m.hp=Math.round(d.hp*1.6);
      }
      continue;
    }
    tickDots(m);
    if(!m.alive)continue; /* a DoT tick may have killed it */
    stepEntity(m);
    if(m.moving)continue;
    if(m.tx===P.tx&&m.ty===P.ty){ /* the player stepped under it — shuffle aside */
      for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const nx=m.tx+a,ny=m.ty+b;
        if(walkable(P.map,nx,ny)&&!mobAt(P.map,nx,ny)){m.path=[[nx,ny]];startStep(m,140);break;}
      }
      continue;
    }
    if(d.flee){ /* treasure critter: skitters away, escapes if not caught */
      if(m.expireAt&&T>m.expireAt){m.alive=false;toast('✨ The scarab burrowed away…');continue;}
      if(distTiles(m.tx,m.ty,P.tx,P.ty)<=6){
        const dx=Math.sign(m.tx-P.tx),dy=Math.sign(m.ty-P.ty);
        for(const[a,b]of[[dx,dy],[dx,0],[0,dy],[dx,-dy],[-dx,dy]]){
          if(!a&&!b)continue;
          const nx=m.tx+a,ny=m.ty+b;
          if(walkable(P.map,nx,ny)&&!mobAt(P.map,nx,ny)&&!(nx===P.tx&&ny===P.ty)){
            m.path=[[nx,ny]];startStep(m,190);break;}
        }
      }
      continue;
    }
    if(d.aggro&&!m.aggro&&distTiles(m.tx,m.ty,P.tx,P.ty)<=4)m.aggro=true;
    if(m.aggro){
      const dist=distTiles(m.tx,m.ty,P.tx,P.ty);
      if(dist>12){m.aggro=false;continue;}
      if(dist<=d.range&&dist>=1){
        m.atkT=m.atkT||T+400;
        if(T>=m.atkT){
          m.atkT=T+d.spd;
          const tri=triangle(d.style,combatMode());
          const chance=hitChance(d.acc*2+8,playerDefence()*(tri>1?0.95:1));
          let dmg=0;
          if(Math.random()<chance)dmg=Math.max(1,Math.round(rand(1,Math.max(1,Math.floor(1+d.pow*0.40)))*tri));
          if(m.elite)dmg=Math.round(dmg*1.3);
          if(d.style==='ranged')shoot(m.px+16,m.py+8,P.px+16,P.py+8,'#d8d5c8');
          if(d.style==='magic')shoot(m.px+16,m.py+8,P.px+16,P.py+8,'#b06fd1');
          m.lungeT=T; /* renderer lunges the mob toward the player briefly */
          hurtPlayer(dmg);
          /* auto-retaliate: an idle player fights back. Never steals an active
             action, never interrupts walking/steering/joystick flight, and
             skips if the hit just killed us (die() warped us to town). */
          if(P.autoRetal&&m.alive&&world[P.map]===W&&!P.action&&!P.moving&&!P.path.length
             &&!HOLD.steer&&!(JOY.active&&(JOY.dx||JOY.dy)))setFight(m);
        }
      }else{
        const path=findPath(P.map,m.tx,m.ty,P.tx,P.ty,true);
        if(path&&path.length){m.path=[path[0]];startStep(m,d.boss?MOB_STEP*1.2:MOB_STEP);}
      }
    }else{
      m.atkT=0;
      /* leash: a mob that chased far from home marches back to its spawn
         area instead of freezing where the pursuit ended */
      if(!m.temp&&distTiles(m.tx,m.ty,m.hx,m.hy)>3){
        const path=findPath(P.map,m.tx,m.ty,m.hx,m.hy,false);
        if(path&&path.length){m.path=[path[0]];startStep(m,MOB_STEP*0.8);}
        continue;
      }
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
  /* temp (event) mobs vanish once dead — they never respawn */
  for(let i=W.mobs.length-1;i>=0;i--)if(W.mobs[i].temp&&!W.mobs[i].alive)W.mobs.splice(i,1);
  for(let i=W.res.length-1;i>=0;i--){const r=W.res[i];
    if(r.temp){ /* event nodes: remove when depleted or timed out */
      if(!r.alive||T>r.expireAt){W.grid[r.y][r.x]=MAPS[P.map].ground;W.res.splice(i,1);}
    }else if(!r.alive&&T>=r.respawnAt){r.alive=true;r.charges=RES[r.type].hp||1;}
  }
}

/* ---------------- living-world events (ambient RNG only) ----------------
   Every few minutes in the wilds, something happens: a meteor with rich ore,
   an ambush, or a treasure scarab. Temp mobs/nodes are runtime-only. */
function evtSpot(W,minD,maxD){
  for(let tries=0;tries<60;tries++){
    const x=1+ambRand(0,W.w-3),y=1+ambRand(0,W.h-3);
    const dd=distTiles(x,y,P.tx,P.ty);
    if(dd>=minD&&dd<=maxD&&walkable(P.map,x,y)&&!mobAt(P.map,x,y)&&!resAt(P.map,x,y)&&!dropAt(P.map,x,y))return[x,y];
  }
  return null;
}
const METEOR_NODE={forest:'I',mountains:'Z',plains:'e',desert:'u'}; /* region-appropriate ore */
function evtMeteor(W){
  const spot=evtSpot(W,8,26);if(!spot)return;
  const[x,y]=spot,type=METEOR_NODE[P.map]||'Z';
  let placed=0;
  for(const[cx,cy]of[[x,y],[x+1,y],[x,y+1],[x-1,y],[x,y-1]]){
    if(placed>=3)break;
    if(!walkable(P.map,cx,cy)||resAt(P.map,cx,cy)||mobAt(P.map,cx,cy))continue;
    W.grid[cy][cx]=type;
    W.res.push({id:'evt:'+cx+':'+cy,type,x:cx,y:cy,alive:true,respawnAt:0,
      charges:4,temp:true,expireAt:T+180000});
    placed++;
  }
  if(placed){toast('☄️ A meteor crashed nearby — rich '+RES[type].name+'s for 3 minutes!','gold');sfx('rare');shake(5);}
}
function evtAmbush(W){
  const pool=[...new Set(W.mobs.filter(m=>{const d=MOBS[m.type];return d&&!d.boss&&!d.semi&&!d.flee;}).map(m=>m.type))];
  if(!pool.length)return;
  const n=ambRand(2,3);let spawned=0;
  for(let tries=0;tries<40&&spawned<n;tries++){
    const ang=ambRand(0,359)*Math.PI/180,dd=ambRand(4,6);
    const x=P.tx+Math.round(Math.cos(ang)*dd),y=P.ty+Math.round(Math.sin(ang)*dd);
    if(!walkable(P.map,x,y)||mobAt(P.map,x,y))continue;
    const t=pool[ambRand(0,pool.length-1)],d=MOBS[t];
    W.mobs.push({id:P.map+':evt'+(T|0)+':'+spawned,type:t,hx:x,hy:y,tx:x,ty:y,px:x*TILE,py:y*TILE,
      hp:d.hp,alive:true,respawnAt:0,moving:null,aggro:true,atkT:T+600,wanderT:0,temp:true});
    spawned++;
  }
  if(spawned){toast('⚔️ Ambush! '+spawned+' foes leap from hiding!','bad');sfx('hurt');shake(6);}
}
function evtScarab(W){
  const spot=evtSpot(W,5,10);if(!spot)return;
  const[x,y]=spot;
  W.mobs.push({id:P.map+':scarab'+(T|0),type:'gilded_scarab',hx:x,hy:y,tx:x,ty:y,px:x*TILE,py:y*TILE,
    hp:1,alive:true,respawnAt:0,moving:null,aggro:false,atkT:0,wanderT:0,temp:true,expireAt:T+45000});
  toast('✨ A Gilded Scarab scuttles nearby — catch it before it burrows!','gold');sfx('coin');
}
function rollWorldEvent(){
  const W=world[P.map],r=ambRand(1,100);
  if(r<=40)evtMeteor(W);else if(r<=75)evtAmbush(W);else evtScarab(W);
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
  P.spec=Math.min(SPEC_MAX,(P.spec==null?SPEC_MAX:P.spec)+dt*SPEC_REGEN);
  stepEntity(P);
  /* virtual joystick: continuous 8-dir movement while the pad is held */
  if(JOY.active&&(JOY.dx||JOY.dy)){
    if(!JOY.moved){JOY.moved=true;P.action=null;P.path=[];}
    if(!P.moving){
      const dx=JOY.dx,dy=JOY.dy;
      const ok=(x,y)=>walkable(P.map,x,y);
      let nx=P.tx,ny=P.ty;
      if(dx&&dy&&ok(P.tx+dx,P.ty+dy)&&ok(P.tx+dx,P.ty)&&ok(P.tx,P.ty+dy)){nx+=dx;ny+=dy;}
      else if(dx&&ok(P.tx+dx,P.ty))nx+=dx;
      else if(dy&&ok(P.tx,P.ty+dy))ny+=dy;
      if(nx!==P.tx||ny!==P.ty)P.path=[[nx,ny]];
    }
  }else JOY.moved=false;
  /* hold-to-steer: press & hold walks continuously toward the pointer */
  if(HOLD.down&&!HOLD.onDrop&&T-HOLD.t0>220){
    if(!HOLD.steer){HOLD.steer=true;P.action=null;P.path=[];}
    if(!P.moving){
      const rect=cv.getBoundingClientRect(),cam=camera();
      const wx=(HOLD.cx-rect.left)/SCALE+cam.camx,wy=(HOLD.cy-rect.top)/SCALE+cam.camy;
      const ttx=Math.floor(wx/TILE),tty=Math.floor(wy/TILE);
      if(ttx!==P.tx||tty!==P.ty){
        const dx=Math.sign(ttx-P.tx),dy=Math.sign(tty-P.ty);
        const ok=(x,y)=>walkable(P.map,x,y);
        let nx=P.tx,ny=P.ty;
        /* diagonal only when both cardinals are open (no corner-cutting) */
        if(dx&&dy&&ok(P.tx+dx,P.ty+dy)&&ok(P.tx+dx,P.ty)&&ok(P.tx,P.ty+dy)){nx+=dx;ny+=dy;}
        else if(dx&&ok(P.tx+dx,P.ty))nx+=dx;
        else if(dy&&ok(P.tx,P.ty+dy))ny+=dy;
        if(nx!==P.tx||ny!==P.ty)P.path=[[nx,ny]];
      }
    }
  }
  if(!P.moving){
    const ex=exitAt(P.map,P.tx,P.ty);
    if(ex){switchMap(ex);return;}
    doAction(); /* before the next step: lets ranged/magic stop at range */
  }
  /* living-world events: every few minutes in the wilds, something happens */
  if(REGION_ORDER.includes(P.map)){
    if(!EVT.next)EVT.next=T+ambRand(90000,180000);
    if(T>=EVT.next){EVT.next=T+ambRand(150000,300000);rollWorldEvent();}
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
  for(let i=particles.length-1;i>=0;i--)if(T-particles[i].t0>particles[i].life)particles.splice(i,1);
  updateHUD();
}
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
        if(m.elite||d.flee){ /* gold aura: alpha elites + the treasure scarab */
          const pulse=0.28+0.14*Math.sin(T/240);
          ctx.globalAlpha=pulse;ctx.strokeStyle='#f0c419';ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(m.px+16,m.py+16,15,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
        }
        const spr=SPR[m.type],yo=spr.height-32; /* 40px fodder anchors at the feet */
        drawFlipped(spr,mx,my-yo,facing);
        const mh=m.elite?Math.round(d.hp*1.6):d.hp;
        if(d.semi||m.elite){ /* semi-boss or alpha elite: name bar + wide health bar */
          ctx.fillStyle='#000000aa';ctx.fillRect(m.px+2,m.py-8-yo,28,4);
          ctx.fillStyle='#c9584a';ctx.fillRect(m.px+3,m.py-7-yo,26*(m.hp/mh),2);
          ctx.font='bold 8px monospace';ctx.textAlign='center';
          ctx.fillStyle=m.elite?'#f0c419':'#d9a5f0';
          ctx.fillText((m.elite?'Alpha ':'')+d.name,m.px+16,m.py-11-yo);
        }else if(m.hp<mh){
          ctx.fillStyle='#000000aa';ctx.fillRect(m.px+6,m.py-6-yo,20,4);
          ctx.fillStyle='#c9584a';ctx.fillRect(m.px+7,m.py-5-yo,18*(m.hp/mh),2);
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
        const th=(SPR[tgt.type]&&SPR[tgt.type].height||32)-32;
        bx=MOBS[tgt.type].boss?[tgt.px-16,tgt.py-32,64,64]:[tgt.px,tgt.py-th,32,32+th];
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
  drawWeather(camx,camy);
  ctx.restore();
  if(minimapOn)drawMinimap();
}
/* ---------------- ambient biome weather (cosmetic, ambient RNG only) ------
   Drifting leaves / snow / pollen / sand wisps over the four wild regions —
   ~2 dozen 1.6px motes wrapped to the viewport; pure atmosphere, zero gameplay. */
const WEATHER={
  forest:   {c:['#7fb069','#5d7a33','#c9a24a'],vy:[8,18], vx:[-6,6],  n:26,sway:1},
  mountains:{c:['#ffffff','#dbe4ee'],          vy:[10,22],vx:[-4,4],  n:34,sway:1},
  plains:   {c:['#e6cf49','#c8b95e'],          vy:[-2,2], vx:[10,26], n:18,sway:0},
  desert:   {c:['#e6d6a0','#cbb677'],          vy:[-3,3], vx:[18,40], n:22,sway:0},
};
let wparts=[],wmap='';
function drawWeather(camx,camy){
  const cfg=WEATHER[P.map];
  if(!cfg){if(wparts.length){wparts=[];wmap='';}return;}
  const vw=VW/SCALE,vh=VH/SCALE;
  if(wmap!==P.map){wmap=P.map;wparts=[];
    for(let i=0;i<cfg.n;i++)wparts.push({
      x:camx+ambRand(0,vw|0),y:camy+ambRand(0,vh|0),
      vx:ambRand(cfg.vx[0],cfg.vx[1]),vy:ambRand(cfg.vy[0],cfg.vy[1]),
      c:cfg.c[i%cfg.c.length],ph:ambRand(0,628)/100});}
  for(const p of wparts){
    p.x+=p.vx*FRAME_DT/1000;p.y+=p.vy*FRAME_DT/1000;
    const sx=p.x+(cfg.sway?Math.sin(T/700+p.ph)*3:0),sy=p.y;
    if(sx<camx-8)p.x+=vw+16; if(sx>camx+vw+8)p.x-=vw+16;
    if(sy<camy-8)p.y+=vh+16; if(sy>camy+vh+8)p.y-=vh+16;
    ctx.globalAlpha=0.5;ctx.fillStyle=p.c;ctx.fillRect(sx,sy,1.6,1.6);
  }
  ctx.globalAlpha=1;
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
  /* ⚡ special energy (fill from the bottom; glows when an use is banked) */
  const spec=Math.round(P.spec==null?SPEC_MAX:P.spec);
  if(spec!==_hud.spec){
    const bs=$('bSpec');
    if(bs){$('specfill').style.height=spec+'%';bs.classList.toggle('ready',spec>=SPEC_COST);}
  }
  /* 🍖 quick-eat (hidden when the bag holds no food) */
  const food=foodCount();
  if(food!==_hud.food){
    const bf=$('bFood');
    if(bf){bf.style.display=food>0?'':'none';$('foodqty').textContent=food;}
  }
  _hud={hp:P.hp,mh,gold:P.gold,mode,style:P.style,a,ammo,spec,food};
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
    g.fillStyle=(MOBS[m.type].boss||MOBS[m.type].flee)?'#f0c419':m.elite?'#ff8a3a':'#c9584a';
    g.fillRect(m.tx*cell,m.ty*cell,cell,cell);}
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
      (g.spd?' · speed '+(g.spd/1000)+'s':'')+ (g.ammo?' · uses '+ITEMS[g.ammo].name:'')+'</span>'+
      (g.unique&&g.perkDesc?'<br><span style="color:#ff8a3a">✦ '+esc(g.perkDesc)+'</span>':'')+
      (g.fusion?weaponEffects(s.gear).map(e=>'<br><span style="color:'+EFFECTS[e.k].color+'">✦ '+esc(effDesc(e.k,e.greater))+'</span>').join(''):'')+'<br>'+
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
  const wpn=P.gear.weapon;
  if(wpn&&GEAR[wpn.id]&&GEAR[wpn.id].fusion){
    h+='<div class="sect">Weapon effects</div>';
    for(const e of weaponEffects(wpn))
      h+='<div class="qrow"><span style="color:'+EFFECTS[e.k].color+'">✦ '+esc(effDesc(e.k,e.greater))+'</span><span class="hint">'+esc(EFFECTS[e.k].desc)+'</span></div>';
  }
  {const sp=SPECIALS[specKeyForWeapon()];
   h+='<div class="qrow"><span style="color:var(--gold)">⚡ '+esc(sp.name)+'</span><span class="hint">'+esc(sp.desc)+'</span></div>';}
  h+='<div class="qrow"><span>Auto-retaliate <span class="hint">fight back when attacked</span></span>'+
     '<button class="btn small'+(P.autoRetal?' sel':'')+'" data-act="autoretal">'+(P.autoRetal?'On':'Off')+'</button></div>';
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
  h+='<div class="hint">Unlocks — WC 5/30/45: Oak·Maple·Yew · Mining 8/20/30/40/50: Iron·Coal·Mithril·Adamant·Runite · Crafting: smelt bars &amp; smith gear at the Forge</div>';
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

/* ---------------- bestiary (collection log) ----------------
   Every creature's full drop list; each drop is a silhouette until first
   obtained, then shows its icon + cumulative amount received (see p5). */
function creatureDrops(type){
  const d=MOBS[type],out=[],seen=new Set();
  const add=(key,kind,label)=>{if(!seen.has(key)){seen.add(key);out.push({key,kind,label});}};
  let hasGear=false;
  for(const e of d.loot){
    if(e.gold)add('gold','gold','Gold');
    else if(e.item)add(e.item,'item',ITEMS[e.item]?ITEMS[e.item].name:e.item);
    else if(e.gear)hasGear=true;
  }
  if(hasGear)add('gear','gear','Equipment');
  if(d.unique&&GEAR[d.unique])add(d.unique,'unique',GEAR[d.unique].name);
  return out;
}
function bestiarySlot(dr,n){
  if(n<=0)return '<div class="slot empty" title="???" style="font-weight:700;color:var(--dim)">?</div>';
  const qty=n>9999?fmtXp(n):n;
  const inner=dr.kind==='gear'?'<span style="font-size:19px">⚔️</span>'
    :'<img src="'+iconURL(dr.kind==='gold'?'gold':dr.key)+'" alt="">';
  return '<div class="slot" title="'+esc(dr.label)+'">'+inner+'<span class="qty">'+qty+'</span></div>';
}
function openBestiary(){
  let h='',lastCat='',totalGot=0,totalAll=0;
  for(const type in MOBS){
    const d=MOBS[type],drops=creatureDrops(type),rec=(P.bestiary&&P.bestiary[type])||{};
    const got=drops.filter(dr=>(rec[dr.key]||0)>0).length;
    totalGot+=got;totalAll+=drops.length;
    const cat=d.boss?'Bosses':d.semi?'Dungeon Elites':'Creatures';
    if(cat!==lastCat){h+='<div class="sect">'+cat+'</div>';lastCat=cat;}
    const kills=(P.stats.mobKills&&P.stats.mobKills[type])||0;
    const done=drops.length>0&&got===drops.length;
    h+='<div class="qrow" style="flex-direction:column;align-items:stretch;gap:6px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center">'+
      '<span>'+esc(d.name)+(done?' <span class="tag done">✓</span>':'')+'</span>'+
      '<span class="tag'+(done?' ready':'')+'">'+got+'/'+drops.length+(kills?' · '+kills+' slain':'')+'</span></div>'+
      '<div class="grid small" style="margin:0">'+drops.map(dr=>bestiarySlot(dr,rec[dr.key]||0)).join('')+'</div></div>';
  }
  openPanel('Bestiary — '+totalGot+'/'+totalAll+' logged',h);
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

/* ---------------- reforge (raise a piece's rarity with materials) --------
   Ladder gated by biome materials (Legendary needs the desert shell); gold
   scales with the piece's tier. Uniques are already best and can't reforge. */
const REFORGE=[null,
  {gold:150, mats:{iron_ore:3, spider_silk:1}},        // →Uncommon
  {gold:500, mats:{iron_ore:5, gem:1, thick_fur:2}},   // →Rare
  {gold:1500,mats:{gem:3, lion_fang:2}},               // →Epic
  {gold:4000,mats:{gem:5, scarab_shell:3}}];            // →Legendary
function canReforge(piece){
  const g=GEAR[piece.id],r=piece.r||0;
  if(!g||g.unique||r>=4)return null;
  const c=REFORGE[r+1],gold=Math.round(c.gold*g.tier);
  const ok=P.gold>=gold && Object.entries(c.mats).every(([id,q])=>invCount(id)>=q);
  return {gold, mats:c.mats, toR:r+1, ok};
}
function doReforge(i){
  const s=P.inv[i];if(!s||!s.gear)return false;
  const c=canReforge(s.gear);if(!c||!c.ok)return false;
  P.gold-=c.gold;for(const id in c.mats)removeItem(id,c.mats[id]);
  s.gear.r=c.toR;sfx('rare');updateHUD();save();return true;
}

/* ---------------- shop ---------------- */
let shopTab='buy';
function openShop(){
  let h='<div class="stylerow">'+
    '<button class="btn small'+(shopTab==='buy'?' sel':'')+'" data-act="shoptab" data-arg="buy">Buy</button>'+
    '<button class="btn small'+(shopTab==='sell'?' sel':'')+'" data-act="shoptab" data-arg="sell">Sell</button>'+
    '<button class="btn small'+(shopTab==='reforge'?' sel':'')+'" data-act="shoptab" data-arg="reforge">Reforge</button></div>';
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
  }else if(shopTab==='sell'){
    h+='<div class="sect">Tap a stack or piece to sell</div><div class="grid small">';
    let any=false;
    P.inv.forEach((s,i)=>{
      if(s.gear){any=true;h+=slotHtml(s,i,'sellgear');}
      else if(ITEMS[s.id]&&ITEMS[s.id].sell){any=true;h+=slotHtml(s,i,'sell');}
    });
    if(!any)h+='<div class="hint" style="grid-column:1/-1">Nothing to sell — go adventuring!</div>';
    h+='</div><div class="sect">Bulk sell gear by rarity</div><div class="stylerow" style="flex-wrap:wrap">';
    for(let r=0;r<5;r++){ /* never bulk-sell Uniques (r=5) */
      const n=P.inv.filter(s=>s.gear&&(s.gear.r||0)===r).length;
      if(n)h+='<button class="btn small" data-act="bulksell" data-arg="'+r+'" style="border-color:'+RARITY[r].color+'">'+
        (RARITY[r].name||'Common ').trim()+' × '+n+'</button>';
    }
    h+='</div>';
  }else{ /* reforge */
    h+='<div class="sect">Reforge — raise a piece\'s rarity with materials</div>';
    let any=false;
    P.inv.forEach((s,i)=>{
      if(!s.gear)return;const c=canReforge(s.gear);if(!c)return;any=true;
      const matStr=Object.entries(c.mats).map(([id,q])=>q+'× '+ITEMS[id].name+
        (invCount(id)>=q?'':' <span style="color:#f0b0a5">('+invCount(id)+')</span>')).join(', ');
      h+='<div class="qrow"><span><img class="mini" src="'+iconURL(s.gear.id)+'" alt=""> '+esc(gearName(s.gear))+
        ' <span class="hint">→ '+RARITY[c.toR].name.trim()+'</span><br><span class="hint">'+c.gold+'g · '+matStr+'</span></span>'+
        '<button class="btn small'+(c.ok?'':' dim')+'" data-act="reforge" data-arg="'+i+'">Reforge</button></div>';
    });
    if(!any)h+='<div class="hint">No eligible gear here. Reforging raises Common→Legendary using ore, gems, and biome materials (silk → fur → fang → shell).</div>';
  }
  openPanel("Torvald's Forge — gold: "+P.gold,h);
}

/* ---------------- crafting station (recipe list at the Forge) ---------------- */
let craftCat='Smelting';
function openCraft(){
  const cats=['Smelting','Fletching','Smithing'];
  let h='<div class="stylerow">'+cats.map(c=>
    '<button class="btn small'+(craftCat===c?' sel':'')+'" data-act="crafttab" data-arg="'+c+'">'+c+'</button>').join('')+'</div>';
  h+='<div class="hint">Gather → craft base items → sell. Crafting level '+lvl('crafting')+'.</div>';
  let any=false;
  for(const id in RECIPES){
    const r=RECIPES[id];if(r.cat!==craftCat)continue;any=true;
    const outId=r.gear?r.gear:Object.keys(r.out)[0];
    const outName=r.gear?GEAR[r.gear].name
      :(r.out[outId]>1?ITEMS[outId].name+' × '+r.out[outId]:ITEMS[outId].name);
    const locked=lvl('crafting')<r.lvl;
    const inStr=Object.entries(r.in).map(([iid,q])=>{
      const have=invCount(iid);
      return '<span style="color:'+(have>=q?'var(--dim)':'#f0b0a5')+'">'+q+'× '+esc(ITEMS[iid].name)+'</span>';
    }).join(' · ');
    const maxN=locked?0:craftMax(r);
    h+='<div class="qrow"><span><img class="mini" src="'+iconURL(outId)+'" alt=""> '+esc(outName)+
      '<br><span class="hint">'+inStr+' · '+r.xp+' xp</span></span>';
    if(locked)h+='<span class="tag locked">Crafting '+r.lvl+'</span>';
    else h+='<span style="display:flex;gap:4px">'+
      '<button class="btn small'+(maxN>0?'':' dim')+'" data-act="craft" data-arg="'+id+':1">Make</button>'+
      (maxN>1?'<button class="btn small" data-act="craft" data-arg="'+id+':all">×'+maxN+'</button>':'')+'</span>';
    h+='</div>';
  }
  if(!any)h+='<div class="hint">No recipes here yet.</div>';
  openPanel('Forge — Crafting '+lvl('crafting'),h);
}

/* ---------------- Forgemaster Hilde (special-weapon fusion) ---------------- */
function fuseDot(k){return '<span title="'+esc(effDesc(k,false))+'" style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+EFFECTS[k].color+';margin-right:2px"></span>';}
function openFuse(){
  const upPct=Math.round(fuseUpgradeChance()*100);
  let h='<div class="hint">Fuse special weapons into stronger ones — 10 → 6 → 3 → 1. Inputs are consumed; the result keeps the highest input rarity. Crafting '+lvl('crafting')+' → '+upPct+'% chance to upgrade each effect to its Greater form.</div>';
  let discoveredCount=0,total=0;
  for(let tier=2;tier<=4;tier++){
    const ids=FUSE_ORDER.filter(id=>GEAR[id].ftier===tier);
    h+='<div class="sect">Tier '+tier+(tier===4?' — the Godsword':'')+'</div>';
    for(const id of ids){
      total++;
      const rec=FUSE_RECIPES[id],g=GEAR[id];
      const discovered=rec.in.some(inId=>P.discovered&&P.discovered[inId]);
      if(discovered)discoveredCount++;
      if(!discovered){
        h+='<div class="qrow dim"><span><b style="color:var(--dim)">?</b> &nbsp;???</span><span class="tag locked">undiscovered</span></div>';
        continue;
      }
      const inStr=rec.in.map(inId=>{const have=P.inv.some(s=>s.gear&&s.gear.id===inId);
        return '<span style="color:'+(have?'var(--dim)':'#f0b0a5')+'">'+esc(GEAR[inId].name)+(have?'':' ✗')+'</span>';}).join(' + ');
      const fxStr=g.fx.map(k=>fuseDot(k)+EFFECTS[k].name).join(' &nbsp;');
      const need=[];const idxs=[];
      for(const inId of rec.in){const i=P.inv.findIndex((s,k)=>s.gear&&s.gear.id===inId&&!idxs.includes(k));
        if(i<0)need.push(inId);else idxs.push(i);}
      const haveAll=need.length===0,atkOk=lvl('attack')>=g.req,goldOk=P.gold>=rec.gold;
      const can=haveAll&&atkOk&&goldOk;
      h+='<div class="qrow"><span><img class="mini" src="'+iconURL(id)+'" alt=""> '+esc(g.name)+
        '<br><span class="hint">'+inStr+' &nbsp;+ '+rec.gold+'g · Atk '+g.req+'</span>'+
        '<br><span class="hint">'+fxStr+'</span></span>'+
        (can?'<button class="btn small" data-act="fuse" data-arg="'+id+'">Fuse</button>'
            :!atkOk?'<span class="tag locked">Atk '+g.req+'</span>'
            :!haveAll?'<span class="tag locked">need parts</span>'
            :'<span class="tag locked">'+rec.gold+'g</span>')+'</div>';
    }
  }
  openPanel('Forgemaster — '+discoveredCount+'/'+total+' known · '+P.gold+'g',h);
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

/* ---------------- fast travel ---------------- */
function openTravel(){
  const busy=underAttack();
  let h='<div class="sect">Fast travel</div>';
  const dests=[['town','Emberbrook (Town)']];
  for(const r of REGION_ORDER)if(P.reached&&P.reached[r])dests.push([r,MAPS[r].name]);
  for(const[id,name]of dests){
    const here=id===P.map;
    h+='<div class="qrow"><span>'+esc(name)+(here?' <span class="hint">— here</span>':'')+'</span>'+
      (here?'<span class="tag">•</span>'
        :busy?'<span class="tag locked">under attack</span>'
        :'<button class="btn small" data-act="warp" data-arg="'+id+'">Travel</button>')+'</div>';
  }
  h+='<div class="hint">Reach a region on foot once to unlock travel to it. Dungeons are entered from inside their region.</div>';
  openPanel('Travel',h);
}

/* ---------------- settings + cloud sync ---------------- */
function syncStatusText(){
  return SYNC.state==='ok'?'✓ synced '+new Date(SYNC.lastOk).toLocaleTimeString()
    :SYNC.state==='err'?'⚠ '+SYNC.err:SYNC.state==='off'?'off':'…';
}
function openSettings(){
  const tok=store.get('eb_token')||'';
  /* the build a device is actually running = the ?v= its HTML loaded */
  const src=(document.querySelector('script[src*="game.js"]')||{}).getAttribute
    ?document.querySelector('script[src*="game.js"]').getAttribute('src'):'';
  const build=(src.match(/v=([\w.]+)/)||[])[1]||'dev';
  openPanel('Settings',
    '<div class="qrow"><span>Build</span><span class="tag gold">v'+esc(build)+'</span></div>'+
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
  if(npc.role==='shop')addOpt(opts,'🔨 Craft',()=>{closeDialog();openCraft();});
  if(npc.role==='capes')addOpt(opts,'🎽 Capes of Accomplishment',()=>{closeDialog();openCapes();});
  if(npc.role==='fuse')addOpt(opts,'⚔ Fuse special weapons',()=>{closeDialog();openFuse();});
  addOpt(opts,'Farewell.',closeDialog);
  $('dialog').classList.add('open');
}
function addOpt(container,label,fn){
  const b=document.createElement('button');b.className='btn dopt';b.textContent=label;
  b.addEventListener('click',fn);container.appendChild(b);
}

/* ---------------- floor-item menu (long-tap a ground pile) ----------------
   Lists everything on a tile; take one, take all, and swap-when-full. */
let floorDrop=null, swapPending=null;
function floorEntryRow(icon,rim,label,arg){
  return '<div class="qrow"><span><img class="mini" src="'+icon+'"'+rim+'> '+label+'</span>'+
    '<button class="btn small" data-act="takeone" data-arg="'+arg+'">Take</button></div>';
}
function openFloorMenu(d){
  if(!d||(!d.items.length&&d.gold<=0)){closePanel();floorDrop=null;return;}
  floorDrop=d;swapPending=null;
  const far=!(P.tx===d.x&&P.ty===d.y);
  let h='<div class="hint">'+(far?'Tap an item to walk over and grab just that one.':'Tap an item to grab it.')+'</div>';
  if(d.gold>0)h+=floorEntryRow(iconURL('gold'),'',d.gold+' gold','gold');
  d.items.forEach((it,i)=>{
    const label=it.gear?esc(gearName(it.gear)):esc(ITEMS[it.id].name)+(it.qty>1?' × '+it.qty:'');
    const rim=it.gear?' style="box-shadow:inset 0 0 0 2px '+gearColor(it.gear)+'55"':'';
    h+=floorEntryRow(iconURL(it.gear?it.gear.id:it.id),rim,label,''+i);
  });
  h+='<button class="btn" data-act="takeall">Take everything</button>';
  openPanel('On the ground',h);
}
function floorTake(spec){
  const d=floorDrop;if(!d)return;
  if(spec==='all'){
    if(P.tx===d.x&&P.ty===d.y)pickupDrop(d);else setLoot(d);
    closePanel();floorDrop=null;return;
  }
  const entry=spec==='gold'?'gold':d.items[+spec];
  if(!entry){openFloorMenu(d);return;}
  if(P.tx===d.x&&P.ty===d.y){
    if(pickupOne(d,entry)==='full')openSwapMenu(d,entry);
    else openFloorMenu(d); /* refresh remaining / auto-close if empty */
  }else{
    P.action={kind:'loot',x:d.x,y:d.y,one:entry};
    routeToTarget(d.x,d.y,false);closePanel();floorDrop=null;
  }
}
function openSwapMenu(d,entry){
  const want=entry==='gold'?'gold':(entry.gear?gearName(entry.gear):ITEMS[entry.id].name);
  swapPending={d,entry};
  let h='<div class="sect">Bag full — drop something to make room for '+esc(want)+'</div><div class="grid small">';
  P.inv.forEach((s,i)=>h+=slotHtml(s,i,'swapdrop'));
  if(!P.inv.length)h+='<div class="hint" style="grid-column:1/-1">Bag is empty</div>';
  h+='</div><button class="btn" data-act="floorback">Cancel</button>';
  openPanel('Make room',h);
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
  else if(act==='autoretal'){P.autoRetal=!P.autoRetal;
    toast(P.autoRetal?'Auto-retaliate on — you fight back when attacked':'Auto-retaliate off','good');
    save();openEquipment();}
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
  else if(act==='crafttab'){craftCat=arg;openCraft();}
  else if(act==='craft'){
    const[rid,cnt]=arg.split(':');
    const n=cnt==='all'?craftMax(RECIPES[rid]):+cnt;
    if(n>0)doCraft(rid,n);openCraft();
  }
  else if(act==='fuse'){doFuse(arg);openFuse();}
  else if(act==='sell'){const s=P.inv[+arg];if(s&&ITEMS[s.id]){const g=ITEMS[s.id].sell*s.qty;P.inv.splice(+arg,1);addGold(g);sfx('coin');toast('Sold for '+g+'g','gold');openShop();}}
  else if(act==='sellgear'){const s=P.inv[+arg];if(s&&s.gear){const g=gearSellValue(s.gear);P.inv.splice(+arg,1);addGold(g);sfx('coin');toast('Sold '+gearName(s.gear)+' for '+g+'g','gold');openShop();}}
  else if(act==='bulksell'){
    const r=+arg;let g=0,n=0;
    P.inv=P.inv.filter(s=>{if(s.gear&&(s.gear.r||0)===r){g+=gearSellValue(s.gear);n++;return false;}return true;});
    if(n){addGold(g);sfx('coin');toast('Sold '+n+' pieces for '+g+'g','gold');}
    openShop();
  }
  else if(act==='reforge'){
    const s=P.inv[+arg];
    if(s&&s.gear&&doReforge(+arg))toast('Reforged into '+gearName(s.gear)+'!','gold');
    else toast('Not enough materials or gold.','bad');
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
  else if(act==='togglesound'){soundOn=!soundOn;if(soundOn){ensureAudio();startAmbient();}else stopAmbient();openSettings();}
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
  else if(act==='reset'){if(confirm('Reset Emberbrook?\n\nThis deletes your saved character and starts a brand-new game in the current world. This cannot be undone.'))resetSave();}
  else if(act==='warp'){warpTo(arg);if(P.map===arg)closePanel();else openTravel();}
  else if(act==='takeone'){floorTake(arg);}
  else if(act==='takeall'){floorTake('all');}
  else if(act==='swapdrop'){
    const i=+arg,s=P.inv[i];if(!s||!swapPending)return;
    const dd=swapPending.d,entry=swapPending.entry;swapPending=null;
    P.inv.splice(i,1);
    spawnDrop(P.map,P.tx,P.ty,s.gear?{items:[{gear:s.gear}]}:{items:[{id:s.id,qty:s.qty}]});
    pickupOne(dd,entry);openFloorMenu(dd);
  }
  else if(act==='floorback'){openFloorMenu(floorDrop);}
});
$('bInv').addEventListener('click',()=>{ensureAudio();openInventory();});
$('bEquip').addEventListener('click',()=>{ensureAudio();openEquipment();});
$('bSkills').addEventListener('click',()=>{ensureAudio();openSkills();});
$('bQuests').addEventListener('click',()=>{ensureAudio();openQuests();});
{const bb=$('bBestiary');if(bb)bb.addEventListener('click',()=>{ensureAudio();openBestiary();});}
$('bMap').addEventListener('click',()=>{ensureAudio();toggleMinimap();});
$('minimap').addEventListener('click',()=>{minimapOn=false;$('minimap').classList.remove('open');});
$('bGear').addEventListener('click',()=>{ensureAudio();openSettings();});
{const bt=$('bTravel');if(bt)bt.addEventListener('click',()=>{ensureAudio();openTravel();});}
/* grouped HUD: the main button toggles its flyout (one open at a time);
   pressing any sub-button closes the group again */
document.querySelectorAll('.hgroup .main').forEach(b=>b.addEventListener('click',()=>{
  ensureAudio();
  const g=b.parentElement,was=g.classList.contains('open');
  document.querySelectorAll('.hgroup.open').forEach(x=>x.classList.remove('open'));
  if(!was)g.classList.add('open');
}));
document.querySelectorAll('.hgroup .sub .hbtn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.hgroup.open').forEach(x=>x.classList.remove('open'));
}));
{const bs=$('bSpec');if(bs)bs.addEventListener('click',()=>{ensureAudio();useSpecial();});}
{const bf=$('bFood');if(bf)bf.addEventListener('click',()=>{ensureAudio();
  const i=bestFoodIndex();if(i<0)toast('No food in your bag','bad');else eatFood(i);});}
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
  let press=null;
  const endPress=()=>{if(press){clearTimeout(press.timer);press=null;}};
  /* the world tap action (drop > mob > npc > resource > board/monument > walk) */
  function tapAt(tx,ty,wx,wy){
    const d=dropAt(P.map,tx,ty);
    if(d){setLoot(d);clickMark={x:tx,y:ty,t0:T};return;}
    const m=mobAt(P.map,tx,ty)||world[P.map].mobs.find(mm=>{
      if(!mm.alive)return false;
      const boss=MOBS[mm.type].boss;
      const big=boss?30:20, cy=boss?mm.py:mm.py+12; /* fodder sprites are 40px tall now */
      return Math.abs(mm.px+16-wx)<big&&Math.abs(cy-wy)<big;
    });
    if(m){setFight(m);clickMark={x:m.tx,y:m.ty,t0:T};return;}
    const n=npcAt(P.map,tx,ty);
    if(n){setTalk(n);clickMark={x:n.tx,y:n.ty,t0:T};return;}
    let r=resAt(P.map,tx,ty);
    if(!r){const below=resAt(P.map,tx,ty+1); /* tree canopy renders a tile above its base */
      if(below&&RES[below.type].skill==='woodcutting')r=below;}
    if(tileAt(P.map,tx,ty)==='Q'){openQuestBoard();clickMark={x:tx,y:ty,t0:T};return;}
    if(tileAt(P.map,tx,ty)==='H'){openMonument();clickMark={x:tx,y:ty,t0:T};return;}
    if(r&&r.alive){setGather(r);clickMark={x:r.x,y:r.y,t0:T};return;}
    if(walkable(P.map,tx,ty)){
      P.action=null;
      const sx=P.moving?P.moving.txx:P.tx, sy=P.moving?P.moving.tyy:P.ty;
      const path=findPath(P.map,sx,sy,tx,ty,false);
      if(path){P.path=path;clickMark={x:tx,y:ty,t0:T};}
    }
  }
  cv.addEventListener('pointerdown',ev=>{
    ensureAudio();endPress();
    if($('panel').classList.contains('open'))return; /* full-screen menu open: ignore world taps */
    /* a world tap while chatting closes the sheet + abandons the conversation */
    if($('dialog').classList.contains('open'))closeDialog();
    const rect=cv.getBoundingClientRect(),{camx,camy}=camera();
    const wx=(ev.clientX-rect.left)/SCALE+camx,wy=(ev.clientY-rect.top)/SCALE+camy;
    const tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE);
    press={sx:ev.clientX,sy:ev.clientY,tx,ty,wx,wy,timer:0};
    const drop=dropAt(P.map,tx,ty); /* long-tap a pile → itemised pickup menu */
    if(drop)press.timer=setTimeout(()=>{press=null;openFloorMenu(drop);},450);
    /* hold-to-steer: update() (p5) starts steering after ~220 ms held */
    HOLD.down=true;HOLD.cx=ev.clientX;HOLD.cy=ev.clientY;HOLD.t0=T;HOLD.onDrop=!!drop;HOLD.steer=false;
  });
  cv.addEventListener('pointermove',ev=>{
    if(HOLD.down){HOLD.cx=ev.clientX;HOLD.cy=ev.clientY;}
    if(press&&(Math.abs(ev.clientX-press.sx)>12||Math.abs(ev.clientY-press.sy)>12))endPress();
  });
  cv.addEventListener('pointerup',()=>{
    const steered=HOLD.steer;HOLD.down=false;HOLD.steer=false;
    if(!press)return;const p=press;endPress();
    if(steered)return; /* the hold consumed this gesture — no tap on release */
    tapAt(p.tx,p.ty,p.wx,p.wy);
  });
  cv.addEventListener('pointercancel',()=>{HOLD.down=false;HOLD.steer=false;endPress();});
  /* ---- virtual joystick (bottom-centre pad) ---- */
  const joy=$('joy'),knob=$('joyknob');
  if(joy){
    const R=30; /* knob travel radius (px) */
    let pid=null;
    const setFrom=ev=>{
      const r=joy.getBoundingClientRect();
      const dx=ev.clientX-(r.left+r.width/2),dy=ev.clientY-(r.top+r.height/2);
      const mag=Math.hypot(dx,dy)||1,cl=Math.min(mag,R);
      knob.style.transform='translate('+(dx/mag*cl).toFixed(1)+'px,'+(dy/mag*cl).toFixed(1)+'px)';
      if(mag<11){JOY.dx=0;JOY.dy=0;return;} /* deadzone */
      JOY.dx=Math.abs(dx)/mag>0.383?Math.sign(dx):0; /* 8 sectors (22.5° splits) */
      JOY.dy=Math.abs(dy)/mag>0.383?Math.sign(dy):0;
    };
    joy.addEventListener('pointerdown',ev=>{ensureAudio();pid=ev.pointerId;
      try{joy.setPointerCapture(pid);}catch(e){}
      JOY.active=true;setFrom(ev);ev.preventDefault();});
    joy.addEventListener('pointermove',ev=>{if(JOY.active&&ev.pointerId===pid)setFrom(ev);});
    const jend=()=>{JOY.active=false;JOY.dx=0;JOY.dy=0;pid=null;knob.style.transform='';};
    joy.addEventListener('pointerup',jend);joy.addEventListener('pointercancel',jend);
  }
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
    P.gear.weapon={id:'g_m_1_weapon',r:0};
    P.gear.body={id:'g_m_1_body',r:0};P.gear.legs={id:'g_m_1_legs',r:0};
    P.hp=maxHp();addItem('bread',5);rebuildPlayerSprite();
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
window.EB={world,MAPS,ITEMS,TOOLS,GEAR,MOBS,CAPES,RARITY,QUESTS,RES,RECIPES,
 FUSIONS,FUSE_RECIPES,FUSE_ORDER,EFFECTS,MOB_FUSION_DROP,weaponEffects,
 update,camera,setGather,setFight,setLoot,openBank,openShop,openInventory,openEquipment,
 openSkills,openQuests,openQuestBoard,openSettings,openDialog,openMonument,openCapes,openBestiary,
 openCraft,doCraft,craftMax,craftReq,openFuse,doFuse,
 addItem,addGear,invCount,equipGear,unequip,gearBonus,playerAttack,rollLoot,rollRarity,
 spawnDrop,pickupDrop,pickupOne,openFloorMenu,killMob,eatFood,save,load,serialize,applySave,migrateV1,
 hurtPlayer,die,maxHp,lvlFor,totalLevel,questState,freshPlayer,rebuildPlayerSprite,
 syncNow,syncPull,syncPush,
 get P(){return P},set P(v){P=v},get T(){return T},get SCALE(){return SCALE}};
boot();

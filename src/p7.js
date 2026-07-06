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
      (g.unique&&g.perkDesc?'<br><span style="color:#ff8a3a">✦ '+esc(g.perkDesc)+'</span>':'')+'<br>'+
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
  if(npc.role==='shop')addOpt(opts,'🔨 Craft',()=>{closeDialog();openCraft();});
  if(npc.role==='capes')addOpt(opts,'🎽 Capes of Accomplishment',()=>{closeDialog();openCapes();});
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
const sb=$('stylebtn');
if(sb)sb.addEventListener('click',()=>{
  const order=['accurate','aggressive','defensive'];
  P.style=order[(order.indexOf(P.style)+1)%order.length];
  toast('Style: '+P.style+' (trains '+SKILLS[trainSkill()].name+')');
  updateHUD();save();
});
}

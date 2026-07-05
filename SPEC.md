# Emberbrook v2 — Design Spec

Single-player, RuneScape-inspired top-down 2D RPG for mobile browser (and
desktop), designed for short casual sessions. One player (the owner), two
devices, shared progress via a tiny sync server. No accounts, no multiplayer,
no anti-cheat — the secret token in `EMBERBROOK_TOKEN` is the only guard.

## Skills (7, level cap 50)
Attack, Strength, Defence, Ranged, Magic, Woodcutting, Mining.
- XP curve: `xpAt(l) = 45·(l−1)^1.8`. Levels cap at 50; XP keeps counting
  past the cap (overflow shown on the skills panel).
- Melee combat trains via a style selector: Accurate→Attack (slightly faster
  swings), Aggressive→Strength (+10% damage), Defensive→Defence.
- Bows train Ranged, staves train Magic. XP = 4 × damage per hit, plus the
  mob's kill XP.

## Combat (RS-lite math)
- Accuracy roll vs defence roll: `hit% = att/(att+def)`, clamped 5–95%.
  Player att = skill·2 + weaponAcc·1.5 + 8. Player def = Defence·2 +
  gearDef·1.2 + 8.
- Max hit from the power skill + weapon power (+ leather/cloth line bonuses
  for Ranged/Magic).
- Weapon speeds: melee 2400 ms, bow/staff 3000 ms.
- Ranges: melee 1, bow 4, staff 5 tiles. Ranged/magic attackers hold
  position at range; mobs with ranged/magic styles do the same.
- Combat triangle: melee > ranged > magic > melee. Advantage = ×1.25 damage
  and +10% accuracy; disadvantage = ×0.8 damage and −10% accuracy.
- Ammo: bows consume Arrows, staves consume Runes (stackables, shop-bought).
  Out of ammo stops the attack. Low-ammo warning at 50.
- Healing: food only (Bread 6 / Cooked Meat 8 / Meat Pie 14 / Stew 22, with
  a 1.2 s attack delay after eating) plus slow out-of-combat regen
  (1 HP / 3 s after 4 s unhurt). Base HP is flat 10; all extra HP comes
  from gear.

## Gear
- 6 slots: weapon, shield, helmet, body, legs, cape.
- 3 style lines: metal (melee: Bronze→Iron→Steel→Mithril→Adamant→Rune),
  leather (ranged: Leather→…→Wyrmhide), cloth (magic: Cloth→…→Runecloth).
- 6 tiers with hard level gates at 1/5/15/25/35/45 (weapon gates on its
  style skill, armour on Defence). Shields exist in the metal line only.
- Generated data model: `GEAR['g_<line>_<tier>_<slot>']` with formula-based
  stats; leather adds ranged power, cloth adds magic power, metal has the
  highest raw defence.
- Rarity on every dropped piece: Common/Uncommon/Rare/Epic/Legendary =
  stat multipliers 1.0/1.1/1.25/1.45/1.7, weights 62/25/10/2.5/0.5%,
  pure RNG (no pity). Bosses roll with a quadratic boost toward high tiers.
- Shop sells tier-1 gear of all lines, ammo, food, and tools; everything
  above tier 1 is drop-only.
- Selling: 25% of formula price × rarity multiplier; bulk-sell buttons by
  rarity in the shop's Sell tab.

## Loot & death
- Kills drop loot on the ground (RS-style): tap to walk over and pick up.
  Drops merge per tile, despawn after 90 s of game time, persist in the save.
- Death: carried inventory + gold drop as a gravestone at the death tile;
  equipped gear is kept. The gravestone lasts 2 minutes of *in-game* time
  (timer pauses when the game is closed) and is persisted in the save.
  Respawn in town at full HP.

## World (walled town + 4 biome regions, each with a dungeon)
A single linear overworld chain. The town is fully enclosed by a stone wall
with **one south gate**; everything else flows from it. Regions are huge
(60×45), procedurally generated with a seeded RNG kept OFF the gameplay/loot
stream, bordered by blocking biome edges, with sparse scattered resources.
Town (bank, forge/shop, elder, guard, quest board, Skill Master Aldric,
trophy monument) → **Whisperwood** (spiders, boars, forest bandits) →
**Frostpeak Mountains** (frost wolves, ice sprites, snow trolls) →
**Golden Plains** (steppe lions, war hawks, nomads) →
**Ashen Desert** (sand scorpions, sand wraiths, dune raiders).
The overworld holds only biome fodder; each region has a **dungeon** mouth
('D') leading to a semi-boss + boss with the best loot:
Hollow Warren (Spider Matron / Bandit King), Glacial Cavern (Ice Warden /
Frost Giant), Sunken Barrow (Barrow Wight / Plains Warlord), and Pharaoh's
Tomb (Tomb Guardian / **Sand Pharaoh**, the final boss).
Bosses: big 2× sprites, ~5-min respawns, 2 loot rolls + rarity boost.
Semi-bosses: elites (double loot roll + rarity boost, 2-min respawn).

## Retention & goals
- 7 linear quests (the last four clear each region's dungeon boss, ending
  with the Sand Pharaoh).
- 3 daily tasks from a pool of 10 (seeded by date), login streak bonus.
- Skillcapes at level 50 from Master Aldric (5,000 g) with small perks
  (+5% acc / +5% melee dmg / −5% dmg taken / 10% ammo save ×2 /
  +10% gather speed ×2); Max Cape (25,000 g, all 7 at 50) stacks all perks.
- Town monument = personal trophy hall: total level, playtime, kills,
  deaths, boss tallies, legendary count, best drop, owned capes.

## Persistence & sync
- Save schema v2 in localStorage (`emberbrook_v2`); autosave 8 s + on hide.
  v1 saves migrate automatically (combat XP → Attack/Str/Def evenly).
- Cloud: `GET/POST /api/save` with `x-eb-token` header; Postgres if
  `DATABASE_URL` is set, else a JSON file. Last-write-wins by the save's
  own `ts` (client compares on pull; server just stores).
- Client: pull on boot + tab focus, push throttled to one per 30 s + on hide.
  Offline is silently tolerated; localStorage remains the source of truth.
- PWA: manifest + network-first service worker (`static/sw.js`) — bump the
  CACHE constant on every release.

## Code architecture
`static/game.js` = concat of `src/p1..p8.js`:
p1 constants/items/gear/rarity/capes · p2 world data + pathfinding ·
p3 player state/saves/migration/inventory/XP/quests/dailies ·
p4 procedural sprites (paper-doll player rebuilt on equip changes) ·
p5 combat engine, ground loot, death, mob AI, main update ·
p6 canvas rendering + HUD · p7 all UI panels · p8 sync client, input, boot.
Debug handle: `window.EB` (used by `smoke.js`).

## Known trade-offs (intentional)
- No kiting AI: ranged players hold position; melee mobs will close in.
- Gravestone timer ticks on any map while the game runs (not only the
  death map).
- Balance numbers are first-pass; tune from playtesting (mob stats in
  `src/p2.js`, gear formulas in `src/p1.js`).

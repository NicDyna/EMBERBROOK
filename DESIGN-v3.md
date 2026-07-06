# Emberbrook v3 — Design Notes

**Status:** agreed design, grill session 2026-07-06. Source of truth for the next
build phase. Companion: `emberbrook-weapons.md` (full 20-weapon fusion spec — should
be committed into the repo), `SPEC.md` (current design), `BUILD_REPORT.md`.

## Pillars
Turn gathering from a dead-end into a real economy, and give the endgame a chase:

> **gather (tiered nodes) → craft base items = Crafting XP → sell for gold + level up
> → fuse special weapons, better fuses at high Crafting → collect it all (Bestiary + Forge).**

Active grind (no idle), steep exponential XP, danger-zoned maps, tile-grid movement kept but smoothed.

---

## 1. Skills & progression
- **New 8th skill: `Crafting`.** Joins `SKILL_ORDER`, counts toward total level, earns a
  cape at 50, appears in the skills panel. Leveled by **repeatable base-crafting** (§3).
- **Global XP pacing (all skills):** steepen the curve (raise the `45·(l−1)^1.8` exponent,
  stretch the top end) so maxing is a long *active* grind; higher-tier resources **and**
  mobs give proportionally more XP. Numbers/time-to-max target = OPEN.
- **No idle.** Log out mid-activity → it stops. Player's responsibility. (Idle continuation
  was considered and dropped.)

## 2. Gathering & resources
- **More resources, RS-style tiered progression** (real trees, real ore chains). Extend `RES`.
- **Node charges (yield):** repurpose the currently-unused `hp` field on `RES` as a **charge
  count** — a plain tree = 1 log then deplete/respawn; a rich node = 3–5 items before
  depleting. Higher-tier nodes = more charges + more XP each (the efficient farm).
- **Danger-zoned maps (Feature "map split", option A):** each biome region splits into a
  **safe skilling belt** (low-tier nodes, few/weak mobs, near the gate) and a **contested
  deep area** (high-tier nodes among the tough mobs). Ongoing risk, **no permanent unlock** —
  you fight as you skill. Rework `buildRegions` to **cluster nodes by tier** (low by the gate,
  high in the mob-dense deep end) instead of scattering randomly.

## 3. Crafting — base items (the repeatable grind)
- Consumes gathered materials → base items that are **sellable/usable**: ore→bars→base gear,
  logs→arrows/ammo, raw→cooked food, etc. This is what **levels the Crafting skill** and drives
  the gold economy ("farm a lot, craft a lot, sell").
- **Interface: OPEN/deferred** (recipe station vs the 3-slot combine). Note: the 3-slot combine
  UI the user described (inventory + slot 1/2/3, add 2–3 items → combined item) maps most
  naturally onto the **fusion** UI (§4), not necessarily base crafting.

## 4. Special-weapon fusion tree  *(full spec: `emberbrook-weapons.md`)*
Adopt the doc's model wholesale — **retire the earlier "hidden recipes / random elemental
traits" idea.**
- **Terraria-style tree 10 → 6 → 3 → 1**, 20 melee specials layered on top of bronze→rune
  (base tiers untouched). **Forgemaster NPC** in town, **visible recipe list**, each recipe a
  **silhouette until you've held ≥1 ingredient** (the discovery/collection hook).
- **3-slot combine UI** (2 inputs for T2/T3, 3 for the final Godsword). Consumes inputs + gold
  fee (5k / 25k / 100k). **Result rarity = highest input rarity** (multipliers carry over).
- **Effects engine (§9)** — 11 keywords, incl. real DoTs (currently the combat engine has none).
  Effects are **fixed & curated per weapon**.
- **Crafting-skill upgrade roll:** the fixed effect is the floor ("always there"); a chance that
  **scales with Crafting level (~5% @1 → ~60% @50)** upgrades it to a **"greater" variant** —
  one extra tier per effect (e.g. burn → *infernal*). ~11 variants to author (names/magnitudes = OPEN).
- Fusion gated by **Atk req + gold**; Crafting level affects **only** the upgrade roll (you don't
  need max Crafting to fuse, only to fuse *well*).

### OPEN items on the fusion spec
| Item | Note |
|---|---|
| **Drop-source remap** | Doc references old **ruins/swamp/mines**; current world is **Forest→Mountains→Plains→Desert** + dungeons. Remap the 10 T1 drops onto current biomes/bosses (`bandit_king`, `frost_giant`, `plains_warlord`, `sand_pharaoh` + semis). Table TBD. |
| **Stat rescale** | Doc assumes rune ≈ +38 str; live rune weapon ≈ **+20 pow**. Rescale numbers ~0.5× to the real curve. |
| **Scope** | **Melee-only for now** (20 weapons). Ranged/magic specials + armour augments = later extension. |

## 5. Bestiary + Collection (Feature 2)
- Rename Collection Log → **Bestiary**. One **unified Collection UI, two tabs: Bestiary**
  (creatures) **+ Forge** (the fusion tree). Same silhouette mechanic.
- **Every creature** (fodder + semi + boss) gets an entry: kill count + its **full loot table**
  (yes, *all* drops incl. gold/bones — not just chase items).
- Each drop shows **silhouette until first obtained**, then reveals with a **cumulative
  "amount received"** count.
- **Save data:** new `P.bestiary[creatureType][dropId] = totalReceived`, incremented wherever
  loot is granted.
- **Rewards:** per-creature 100% → small gold/token payout; global milestones → monument
  trophies (**Forge Master** @ all 10 fusions, **Godsmith** @ the Godsword, **Bestiary Complete**).

## 6. Rare-item popup (Feature 3)
- Fires **on pickup**. **Epic+ and any special/fusion weapon** → **non-blocking** centre-screen
  banner (icon + rarity-coloured name + distinct jingle, ~2 s auto-fade).
- **Unique / Legendary** → deluxe: screen dim + particles + longer hold + heavier sound.
- **Rare and below** → keep the existing quiet toast + sound (no interrupt).

## 7. Floor-item pickup menu (Feature 4)
- **Short-tap** a drop → unchanged (walk over, take everything).
- **Long-tap (~450 ms)** → itemised menu at the drop: gold + each stack/gear, **per-item "take"**
  + **"Take all."** Opens **from any distance**; acting on an entry walks you there. New selective
  `pickupOne` (pickup currently grabs the whole pile).
- **Bag full → swap:** the menu lets you drop a chosen junk item to make room for the wanted one.

## 8. Movement smoothing (Feature 5) — keep tile-grid, decisively
Diagnosis: it's *feel*, not perf. Three fixes:
1. **Camera device-pixel rounding** — `camera()` rounds to whole *world* px then scales by a
   fractional zoom, so the world jitters against the player. Change to `camx = Math.round(camx*SCALE)/SCALE`.
2. **8-directional movement** — `findPath` is 4-way, so diagonals stairstep. Add diagonals
   (guard corner-cutting through walls); `stepEntity` already interpolates any vector.
3. **Dirty-flag `updateHUD`** — it writes DOM styles every frame (60 Hz reflow on mobile); only
   touch the DOM when HP/gold/ammo actually change.

## 9. Combat engine additions (cross-cutting — required by §4 effects)
Currently every hit resolves instantly with no status/over-time. Add one `applyOnHit(effects,
attacker, target)` + timed effect entries on mob state, covering the 11 keywords:
`burn / poison / bleed` (DoTs), `cleave` (90° arc), `pierce` (line ≤2), `knockback` (+1 tile push),
`reach` (+1 range), `crush(x%)` (ignore def), `execute` (+50% <25% HP), `lifesteal(x%)`,
`slashwave` (every-3rd-swing projectile). Rescale magnitudes to the live curve.

## 10. Open decisions (need input / numbers)
- Base-crafting **interface** (recipe station vs combine).
- XP **curve numbers** + time-to-max target.
- Fusion **drop-source remap table** + **stat rescale** numbers.
- Effect **"greater" variant** names + magnitudes (11).
- **Save-version bump + migration** for: Crafting skill, node charges, weapon effect data,
  bestiary map. (Existing `applySave` already tolerates unknown maps / missing fields.)

## 11. Suggested build order
1. **Movement fixes (§8)** — quick, low-risk, improves the whole game immediately.
2. **Bestiary + rare popup + floor menu (§5–7)** — mostly additive UI/data, high polish payoff.
3. **Crafting skill + base crafting + tiered resources/node-charges + danger-zoned maps (§1–3)**
   — the economy backbone.
4. **Effects engine + fusion tree (§9, §4)** — the endgame payoff; depends on 3 + the effects engine.

Each phase: edit `src/`, rebuild `static/game.js`, bump `sw.js`, run + extend `smoke.js`.

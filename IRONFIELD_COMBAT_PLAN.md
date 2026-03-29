# IRONFIELD — Combat System Implementation Plan
*Prepared: 2026-03-29*

---

## Overview

This document plans the full combat system for IRONFIELD, designed to integrate cleanly with the existing WeGo architecture without restructuring what already works. Every change is additive — the turn plan, resolution, and DB sync pipelines are untouched in design; combat slots into them.

---

## 1. What Already Exists (and can be reused)

| System | Status | Combat relevance |
|---|---|---|
| `getCoverage(mech)` | ✓ Working | Returns `{full[], half[]}` triangle sets — **this is your fire arc** |
| LOS ray-march | ✓ Working | `drawLOS()` already measures distance in triangle units |
| `mechs[]` array | ✓ Working | Needs new fields: `armour`, `structure`, `weapons`, `destroyed` |
| `submitPlan()` | ✓ Working | `plan.mech_orders[]` needs a `fire_orders[]` array added |
| `resolveTurn(plans)` | ✓ Working | Movement applied here — combat resolution added after movement |
| `captureState()` / `loadStateFromGame()` | ✓ Working | Must include new mech fields |
| `buildRoster()` | ✓ Working | Needs armour/structure bars added |
| `MECH_CLASSES` | ✓ Working | Needs weapon loadout added per class |

---

## 2. Data Structure Changes

### 2a. Mech object — new fields

```js
// Current mech object
{ id, player, name, cls, facing, wx, wy, mpSpent }

// Combat-extended mech object
{
  id, player, name, cls, facing, wx, wy, mpSpent,

  // --- NEW ---
  armour:    { head:2, ct:8, lt:6, rt:6, la:4, ra:4, ll:5, rl:5 },
  structure: { head:1, ct:4, lt:3, rt:3, la:2, ra:2, ll:3, rl:3 },
  destroyed: false,        // true = this mech is out of the game
  mpSpentLastTurn: 0,      // copied from mpSpent at end of resolution — used for ballistic hit modifier
}
```

These values differ per class. Define them in `MECH_CLASSES`:

```js
const MECH_CLASSES = {
  scout:  {
    label:'SCOUT', mpMax:18, color:'#55ffbb',
    weapons: ['laser_light', 'missile_srm2'],
    baseArmour:    { head:2, ct:6,  lt:4,  rt:4,  la:3,  ra:3,  ll:4,  rl:4  },
    baseStructure: { head:1, ct:3,  lt:2,  rt:2,  la:1,  ra:1,  ll:2,  rl:2  },
  },
  medium: {
    label:'MEDIUM', mpMax:12, color:'#00ff88',
    weapons: ['laser_medium', 'ballistic_ac5'],
    baseArmour:    { head:3, ct:10, lt:8,  rt:8,  la:6,  ra:6,  ll:7,  rl:7  },
    baseStructure: { head:1, ct:5,  lt:4,  rt:4,  la:3,  ra:3,  ll:4,  rl:4  },
  },
  heavy:  {
    label:'HEAVY', mpMax:6, color:'#88ff44',
    weapons: ['laser_large', 'ballistic_ac10', 'missile_lrm5'],
    baseArmour:    { head:3, ct:16, lt:12, rt:12, la:10, ra:10, ll:11, rl:11 },
    baseStructure: { head:1, ct:8,  lt:6,  rt:6,  la:5,  ra:5,  ll:7,  rl:7  },
  },
};
```

### 2b. Weapon definitions

A new top-level constant, lives near `MECH_CLASSES`:

```js
const WEAPONS = {
  laser_light:   { label:'LT LASER',  type:'laser',     range:6,  damage:3,  tn:10 },
  laser_medium:  { label:'MD LASER',  type:'laser',     range:9,  damage:5,  tn:10 },
  laser_large:   { label:'LG LASER',  type:'laser',     range:14, damage:8,  tn:10 },
  ballistic_ac5: { label:'AC/5',      type:'ballistic', range:10, damage:5,  tn:10 },
  ballistic_ac10:{ label:'AC/10',     type:'ballistic', range:7,  damage:10, tn:10 },
  missile_srm2:  { label:'SRM-2',     type:'missile',   range:6,  damage:4,  tn:10, salvo:2 },
  missile_lrm5:  { label:'LRM-5',     type:'missile',   range:18, damage:5,  tn:10, salvo:5 },
};
// `tn` = base target number (roll >= tn to hit, 3D6)
// `range` = max range in hex units (to be measured via the existing LOS distance calc)
```

---

## 3. Fire Orders — Adding to the Plan

### 3a. submitPlan() change

The existing plan object:
```js
plan = {
  submitted_at: ...,
  mech_orders: [ { mech_id, wx, wy, final_facing, mp_spent } ]
}
```

Add a parallel array:
```js
plan = {
  submitted_at: ...,
  mech_orders: [ ... ],          // unchanged
  fire_orders: [                  // NEW
    {
      attacker_id: 'p1a',         // firing mech
      target_id:   'p2b',         // target mech
      weapon:      'laser_medium' // weapon key from WEAPONS
    },
    // one entry per firing mech (or omit if not firing)
  ]
}
```

Each player can assign at most one fire order per mech they control. The UI will need a way to express this — see Section 6.

### 3b. No DB schema change required

`plan` is already a JSONB blob. Adding `fire_orders` to it is transparent — the DB doesn't care.

---

## 4. Combat Resolution Algorithm

This runs inside `resolveTurn()`, **after** the existing movement application block.

### 4a. Dice

```js
function roll3d6() {
  const d = [1,2,3].map(() => Math.ceil(Math.random() * 6));
  const doubles = d[0]===d[1] || d[1]===d[2] || d[0]===d[2];
  return { total: d.reduce((a,b)=>a+b,0), doubles, dice: d };
}
```

### 4b. Hit location table

```js
const HIT_LOC = {
  3:'head', 4:'ra', 5:'rt', 6:'rl', 7:'ll',
  8:'lt', 9:'ct', 10:'ct', 11:'ct', 12:'la',
  13:'rt', 14:'lt', 15:'rl', 16:'ll', 17:'la', 18:'head'
};
// Centre torso on rolls 9/10/11 (peak of 3D6 bell) = ~34% chance.
// Head only on 3 and 18 (extremes) = ~0.9% each — appropriately rare.
```

### 4c. To-hit modifier calculation

```js
function calcToHit(attacker, target, weapon) {
  let tn = weapon.tn; // base = 10

  // Range penalty — measure hex distance using existing LOS distance calc
  const dist = hexDist(attacker, target); // see Section 5
  if (dist > weapon.range)       return null; // out of range — no shot
  if (dist > weapon.range * 0.6) tn += 2;    // long range band
  if (dist <= 3)                 tn -= 1;    // point blank

  // Attacker moved — harder to aim
  if (attacker.mpSpent > 0)      tn += 1;
  if (attacker.mpSpent >= mechMpMax(attacker) * 0.5) tn += 1; // sprinting

  // Target moved — harder to hit
  const tgtMovedLast = target.mpSpentLastTurn ?? 0;
  if (weapon.type === 'ballistic') {
    if (tgtMovedLast >= 6)  tn += 1;  // ballistic: target movement matters most
    if (tgtMovedLast >= 12) tn += 1;
  } else {
    if (tgtMovedLast >= 9)  tn += 1;  // lasers/missiles: less sensitive to target speed
  }

  // Arc check — is target in attacker's fire arc?
  // (use existing getCoverage — if target hex is in full[], no penalty; if half[], +2; if neither, no shot)
  // See Section 5 for arc check helper.

  return Math.max(3, Math.min(18, tn)); // clamp to valid 3d6 range
}
```

### 4d. Per-weapon resolution

**Laser:**
```
roll 3D6
if total >= tn → HIT
  roll 3D6 → location
  if doubles → +1 damage (clean beam, focused energy)
apply damage to armour[loc], overflow to structure[loc]
if structure[loc] <= 0 → location destroyed
if structure.ct <= 0 → mech.destroyed = true
```

**Ballistic:**
```
roll 3D6
if total >= tn → HIT
  roll 3D6 → location
  if doubles → penetrating: apply 2 damage directly to structure, bypassing armour
else → MISS (no scatter for ballistics — misses are clean)
```

**Missile:**
```
Step 1 — Lock-on roll: roll 3D6 vs tn
  if miss → all missiles miss
  if doubles → guided: all salvo.count missiles hit same location
  if hit (no doubles) → roll 1D6, take min(result, salvo.count) missiles hit

Step 2 — For each missile that hits:
  roll 3D6 → location (each missile scatters independently if not guided)
  apply (weapon.damage / salvo.count) per missile hit
```

### 4e. Destruction cascade

```js
function applyDamage(mech, location, rawDamage, penetrating=false) {
  if (penetrating) {
    mech.structure[location] -= rawDamage;
  } else {
    const absorbed = Math.min(mech.armour[location], rawDamage);
    mech.armour[location]   -= absorbed;
    mech.structure[location] -= (rawDamage - absorbed);
  }
  mech.structure[location] = Math.max(0, mech.structure[location]);

  if (mech.structure[location] <= 0) {
    // Location destroyed
    if (location === 'ct') mech.destroyed = true; // core hit
    if (location === 'head') mech.destroyed = true; // cockpit
    if (location === 'la' || location === 'ra') { /* weapon arm gone */ }
    if (location === 'll' || location === 'rl') { /* movement impaired — future: mp penalty */ }
  }
}
```

### 4f. Win condition check

After all combat is applied in `resolveTurn()`:
```js
const p1alive = mechs.filter(m => m.player===1 && !m.destroyed).length;
const p2alive = mechs.filter(m => m.player===2 && !m.destroyed).length;
if (p1alive === 0 || p2alive === 0) {
  // write status:'complete', winner: p1alive>0?1:2 to DB
  // show victory screen
}
```

---

## 5. Helper Functions Needed

Two small utility functions that don't exist yet:

### hexDist(mechA, mechB)
Converts world coordinates to hex coords using the existing `w2hex()`, then computes hex distance using the standard cube-coordinate formula. About 8 lines.

### isInFireArc(attacker, target)
Uses the existing `getCoverage(attacker)` result. Converts target world position to its hex, checks if any triangle in that hex appears in `full[]` or `half[]`. Returns `'full'`, `'half'`, or `'none'`. About 12 lines.

These go near the other geometry helpers (around line 1440).

---

## 6. UI Changes

### 6a. New toolbar button

Add `[ FIRE ]` mode to the toolbar alongside SELECT / MOVE / ROTATE / LOS. When in fire mode with a mech selected, clicking an enemy mech assigns a fire order to that mech's entry in the pending plan.

```html
<button class="tb" style="color:#ff6644;border-color:#3a1100;" 
        id="b-fire" onclick="setMode('fire')">[ FIRE ]</button>
```

### 6b. Roster card additions

Each mech card in `buildRoster()` needs:
- Armour bar (green, depletes to yellow then red)
- Structure bar (red, shorter — underlies armour)
- "FIRE → TARGET" line when a fire order is assigned
- Greyed/crossed out if `mech.destroyed`

### 6c. Right panel additions

When a mech is selected, show weapon list with range and current tn estimate. This sits between COVERAGE and MOVEMENT POINTS in the right panel.

### 6d. Fire order visual on canvas

When in fire mode, draw a red dashed line from selected mech to assigned target (similar to how LOS line is drawn). This is a one-liner reusing the LOS draw pattern.

---

## 7. State Persistence Changes

### captureState() — add new fields
```js
mechs: mechs.map(m => ({
  id, player, name, cls, facing, wx, wy, mpSpent,
  armour:           m.armour,
  structure:        m.structure,
  destroyed:        m.destroyed,
  mpSpentLastTurn:  m.mpSpentLastTurn,
}))
```

### loadStateFromGame() — restore new fields
```js
armour:          saved.armour          ?? MECH_CLASSES[saved.cls].baseArmour,
structure:       saved.structure       ?? MECH_CLASSES[saved.cls].baseStructure,
destroyed:       saved.destroyed       ?? false,
mpSpentLastTurn: saved.mpSpentLastTurn ?? 0,
```

The `?? default` pattern means old saved games without these fields load gracefully.

### buildStartState() — initialise new fields
Each mech entry gets `armour`, `structure`, `destroyed:false`, `mpSpentLastTurn:0` from `MECH_CLASSES[cls].baseArmour/baseStructure`.

---

## 8. resolveTurn() — Full New Flow

```
1. [EXISTING] Apply movement orders from both plans
2. [NEW] Record mpSpentLastTurn on each mech (copy mpSpent before reset)
3. [EXISTING] Reset mpSpent = 0
4. [NEW] Collect all fire_orders from both plans
5. [NEW] For each fire order:
     a. Look up attacker + target mech
     b. Look up weapon from WEAPONS
     c. Check isInFireArc — skip if 'none'
     d. calcToHit → get tn (or null if out of range)
     e. roll3d6 → resolve hit/miss per weapon type
     f. If hit: roll3d6 for location, applyDamage()
     g. addLog() with full result string
6. [NEW] Check win condition
7. [EXISTING] captureState(), write to DB, increment turn
```

---

## 9. Implementation Sequence (suggested order)

Work in this order — each step is independently testable:

1. **Data layer** — extend `MECH_CLASSES`, add `WEAPONS`, update `buildStartState()` / `captureState()` / `loadStateFromGame()`. No visible change, but state now carries armour/structure.

2. **Dice + resolution functions** — `roll3d6()`, `HIT_LOC`, `hexDist()`, `isInFireArc()`, `calcToHit()`, `applyDamage()`. Pure functions, easily tested in the browser console.

3. **Fire order in submitPlan** — extend plan object with `fire_orders[]`. Add a minimal "fire mode" that lets you click enemy mechs to assign targets. Confirm the array appears in Supabase after submission.

4. **resolveTurn combat block** — wire up the resolution. Test with `[ NEW TURN ]` button first (which bypasses Supabase) to confirm dice logic and logging work before going multiplayer.

5. **buildRoster armour bars** — visual feedback that damage is being tracked. A destroyed mech shown as greyed-out is the win condition indicator.

6. **Win condition** — final check after combat block writes `status:'complete'` to DB and shows a winner screen.

---

## 10. What Not To Touch

- Canvas rendering pipeline (`draw()`, `drawHexLayer()`, etc.) — nothing combat-related needs to change here except the optional fire-order line, which is a 10-line addition to `drawLOS()` or a new `drawFireOrders()` called from `draw()`.
- Auth, lobby, waiting room — entirely separate.
- Realtime subscription — unchanged. Combat results arrive via the `onGameUpdate` path that already works.
- A* pathfinding — unchanged.

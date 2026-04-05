# IRONFIELD — Development Roadmap v4
*Updated: 2026-04-05*

---

## How to use this document

Pass this file and the current `index.html` into a new chat session. The session will have everything needed to continue development without requiring conversation history.

**Key facts for a new session:**
- Single HTML file (`index.html`), ~3781 lines, no build step
- Supabase backend: project `ffztxyeevdqlhvxzcopn`, hosted at `https://mrghost27.github.io/Ironfields/`
- GitHub repo: `https://github.com/MrGhost27/Ironfields`
- 2-player WeGo tactical mech game — both players submit plans simultaneously, host resolves
- All game logic in a single HTML/JS file; Supabase stores game state as JSONB

---

## Current State (as of v3)

The core skirmish game is complete and playable. Terrain system is now fully implemented.

### ✅ Completed — Multiplayer infrastructure
- Supabase auth (callsign/password via `@thedeck.game` email trick; legacy `@ironfield.game` fallback)
- Lobby: create game / join by 6-character code
- Waiting room: 2-seat claim system, realtime sync via `postgres_changes`
- WeGo simultaneous planning: both players submit `ironfield_turn_plans`, host resolves when both are in
- `isResolving` guard prevents double-resolution race conditions
- Rejoin on reconnect; abandoned game cleanup
- Supabase pattern: use separate `.select()` fetch after `.update()` — RLS SELECT policies are restrictive

### ✅ Completed — Map and movement
- Hex grid (29×21), subdivided into 6 triangles per hex for sub-hex granularity
- Triangle tiles addressed as `q,r:t` matching the `tKey` convention
- A* pathfinding on vertex graph; terrain-aware edge costs (see Tier 2)
- Rotation in 30° increments; facing wheel display
- Coverage template: rotating hex showing full/half fire arcs
- LOS ray-march sampling triangles along the line; terrain-aware (see Tier 2)
- Map pan (middle-mouse drag, scrollbars, two-finger touch)

### ✅ Completed — Combat system
- 3D6 to-hit: `calcToHit` with modifiers for arc, range bands, attacker movement, target movement
- Hit location table (`HIT_LOC`): 8 locations, CT/head kills, arm/leg have consequences
- `applyDamage` returns array of log strings; cascade consequences on location destruction
- Three weapon types with differentiated mechanics:
  - **Laser**: doubles = focused beam (+1 dmg)
  - **Ballistic**: doubles = penetrating (bypasses armour)
  - **Missile**: lock roll, scatter on non-doubles, guided on doubles

### ✅ Completed — Tier 1.1: Weapon selection UI
- Right panel shows `// WEAPONS` section in FIRE mode
- One button per weapon: label, type, range, damage, heat cost
- Live TN readout updates as cursor hovers over enemies
- Green/amber/red TN colour coding
- Disabled/impossible weapons shown with NO SHOT or OFFLINE label
- CLEAR ORDER button; weapon pre-selected when revisiting a mech with an existing order

### ✅ Completed — Tier 1.2: Location-destruction consequences
- `mountedIn` field on every weapon (`ra`, `la`, or `ct`)
- Arm destroyed → weapons mounted there go offline; shown in roster card and weapon picker
- Leg destroyed → `mech.legDestroyed = true` → `mechMpMax` halves the return value (floor 1)
- `mech.disabledLocs[]` array persisted through state serialisation
- Roster card shows ⚠ status lines for offline weapons and halved movement

### ✅ Completed — Tier 1.3: Heat system
- `heatCap` per class: Scout 18, Medium 24, Heavy 30
- `heat` value per weapon: LT Laser 2, MD Laser 4, LG Laser 8, AC/5 1, AC/10 2, SRM-2 2, LRM-5 2
- `HEAT_DISSIPATION = 8` per turn, applied at start of resolution before new heat added
- Heat TN penalties: ≥50% cap → +1 TN; ≥75% cap → +2 TN (applied in `calcToHit`)
- Shutdown at ≥100% cap: roll 3D6, on 7 or less mech shuts down for one turn
- Shut-down mech cannot move or fire; auto-restarts next turn
- Heat bar on roster cards: blue → amber → orange → red-pulsing at critical
- `mech.heat` and `mech.shutDown` persisted through state serialisation

### ✅ Completed — Tier 1.4: Pilot skill system
- `gunnery` (default 0): subtracted from TN on all fire rolls
- `piloting` (default 0): raises the sprint threshold (formula: `0.5 + piloting × 0.1` of mpMax)
- `pilotName` assigned at game start from fixed callsign arrays (ARCHER/VOSS/KIMURA vs REYES/THORN/VALE)
- Pilot name and skills shown on roster cards (under mech name) and in right panel PILOT row
- All three fields persisted through state serialisation; backward compatible (defaults to 0/0/'—')
- Ready for campaign progression to upgrade skills between battles

### ✅ Completed — Tier 1.5: Battle log export
- `battleLog[]` array accumulates every `addLog()` call as plain text during the match
- Reset to `[]` when a new match starts — no bleed between games
- Victory screen has a cyan **⬇ DOWNLOAD BATTLE LOG** button
- Downloads as `ironfield-log-YYYY-MM-DD.txt` with header (date, pilot names, turn count) + full chronological play-by-play
- No DB changes required — log is built entirely in memory

### ✅ Completed — Armour/structure bars
- ARM and STR bars on every roster card, colour-coded by percentage
- Win condition: all enemy mechs destroyed → victory screen with survival summary

### ✅ Completed — Tier 2: Terrain system
- `TERRAIN_TYPES` constant: 8 tile types, each with `mpCost`, `losMod`, `coverTN`, render `color`
- `terrainTiles` state: `tKey → type` map; serialised in `captureState` / loaded in `loadStateFromGame`
- Both players always see identical terrain (stored in Supabase JSONB alongside mechs)

**Tile types implemented:**

| Type | MP cost | LOS effect | Cover TN |
|---|---|---|---|
| open | 1 | none | 0 |
| woods_light | 2 | partial (+1 TN per tile) | +1 |
| woods_heavy | 3 | block | +2 |
| rubble | 2 | none | +1 |
| water | 2 | none | 0 |
| river | ∞ (impassable) | none | 0 |
| building | ∞ (impassable) | block | — |
| ruin | 3 | partial | +2 |

**A* pathfinding:** Edge cost now uses `terrainMpCost()` — midpoint of each vertex-to-vertex edge is sampled; impassable tiles cost 999 (effectively blocked).

**LOS ray-march:** `drawLOS` colour-codes tiles blue/amber/red (clear/partial/blocked). Label shows `CLEAR`, `+N TN`, or `BLOCKED`. `calcToHit` walks the same ray — fully blocked returns null (no shot); each partial tile adds +1 TN.

**Cover:** `terrainCoverTN(target)` adds the target's tile cover bonus to TN in `calcToHit`.

**Rendering:** `drawHexLayer` paints terrain fills at triangle resolution before the hex grid overlay. In terrain editor mode, `drawTriGrid` shows tile type labels instead of triangle index numbers.

**Map presets (4 included):**
- `open` — Open Plains (blank map)
- `river` — River Crossing (impassable river col 14, ford at mid-map, woods P1 side, rubble P2 side)
- `urban` — Urban Combat (building blocks centre, ruins and rubble scatter)
- `wooded` — Wooded Hills (heavy woods clumps, light woods surround, rubble ridge centre)

**Terrain editor:** `[ TERRAIN ]` toolbar button enters editor mode. Right panel shows all 8 tile types with colour swatches, MP cost, LOS mod, and cover TN tooltips. Click or drag to paint. CLEAR ALL button wipes the map.

**Lobby preset picker:** Host selects a map preset in the lobby before START; selected preset highlighted; applies immediately and is included in the initial game state sent to Supabase.

---

## Architecture notes for new sessions

**Key data structures:**

```javascript
// Mech object (all fields)
{
  id, player, name, cls, facing, wx, wy,
  mpSpent, mpSpentLastTurn,
  destroyed, armour{}, structure{},
  disabledLocs[], legDestroyed,
  heat, shutDown,
  gunnery, piloting, pilotName
}

// Fire order
{ attacker_id, target_id, weapon }

// Game state (captureState / loadStateFromGame)
{ mechs: [...], terrain: { 'q,r:t': 'type_key', ... }, turn: N }

// MECH_CLASSES keys: 'scout' | 'medium' | 'heavy'
// WEAPONS keys: 'laser_light' | 'laser_medium' | 'laser_large' |
//               'ballistic_ac5' | 'ballistic_ac10' |
//               'missile_srm2' | 'missile_lrm5'
// TERRAIN_TYPES keys: 'open' | 'woods_light' | 'woods_heavy' |
//                     'rubble' | 'water' | 'river' | 'building' | 'ruin'
```

**Key functions:**
- `calcToHit(attacker, target, weapon)` → TN or null (includes LOS terrain + cover)
- `applyDamage(mech, location, rawDamage, penetrating)` → string[]
- `resolveFire(attacker, target, weaponKey)` → string[]
- `resolveTurn(plans)` → async, host only; movement → combat → heat → DB write
- `captureState()` / `loadStateFromGame(state)` — serialisation pair (includes terrain)
- `mechMpMax(mech)` — respects `legDestroyed`
- `mechWeaponDisabled(mech, weaponKey)` — checks `disabledLocs`
- `heatTnPenalty(mech)` — returns 0, 1, or 2
- `mechShutDown(mech)` — returns bool
- `terrainMpCost(wx, wy)` — MP cost to enter triangle at world coords
- `terrainLosMod(tKey)` → 'none' | 'partial' | 'block'
- `terrainCoverTN(mech)` → 0, 1, or 2
- `applyMapPreset(key)` — loads a preset into `terrainTiles`, logs it, redraws
- `updateTerrainPanel()` — refreshes terrain editor UI in right panel
- `downloadBattleLog()` — builds and triggers .txt download
- `updateWeaponPicker(hovEnemy)` — refreshes FIRE mode panel
- `buildRoster()` / `updatePanel()` — UI refresh

**Key state variables:**
- `terrainTiles` — `{}` map of tKey → terrain type key; empty = all open
- `battleLog` — string[] of plain-text log entries for the current match
- `activePreset` — tracks which map preset is loaded (for UI highlight)
- `selectedTerrainType` — terrain type currently selected in editor (default `'woods_light'`)

**Supabase tables:**
- `ironfield_games` — one row per game, `state` JSONB column (now includes `terrain`)
- `ironfield_turn_plans` — one row per player per turn, `plan` JSONB
- `ironfield_events` — event log (non-critical)
- `profiles` — username lookup

### ✅ Completed — Tier 3.3: Lance composition
- `LANCE_CHASSIS` constant: 3 chassis (scout 3pts, medium 5pts, heavy 8pts) with descriptions
- `LANCE_BUDGET = 12` points per player; `LANCE_SIZE = 3` mechs per lance
- `lancePicksP1` / `lancePicksP2` state arrays (default: scout/medium/heavy)
- Waiting room expanded to 520px with inline lance builder panel:
  - Three dropdowns (A/B/C slots), each showing chassis label + cost
  - Live budget counter (green = at budget, amber = under, red = over)
  - Chassis description line on focus/change
  - Status line: over-budget warning, remaining pts, or "Lance locked in ✓"
  - Seat rows show each player's lance summary + budget check
  - START GAME button gated on both lances being ≤ budget
- Picks stored in `state.lancePicks.{p1,p2}` JSONB (no schema migration needed)
- `saveLancePicks()` reads current state, patches picks, writes back on every slot change
- `renderWaiting()` syncs both players' picks from DB on each poll (realtime-driven)
- `buildStartState()` uses `lancePicksP1/P2` to spawn chosen chassis; mech IDs p1a/p1b/p1c etc.
- `doStartGame()` validates budgets before writing `status: active`
- `loadStateFromGame()` restores `lancePicks` from saved state (backward-compatible)
- `resetMultiState()` resets picks to default scout/medium/heavy

---

### 2.4 Elevation *(not yet implemented)*
Three-level model (low/mid/high) stored per triangle. Height advantage: +1 effective range per level, -1 TN shooting downhill, +1 TN shooting uphill. Rendered as stepped tint on triangle fill.

---

## TIER 3 — Expanded mech roster

### 3.1 Additional chassis

| Chassis | Class | Weapons | MP | Notes |
|---|---|---|---|---|
| LANCE-S (Striker) | Scout variant | dual laser_light | 20 | Fragile, very fast |
| LANCE-A (Assault) | New: assault | ballistic_ac20, missile_lrm10 | 4 | Highest armour |
| LANCE-E (Electronic) | Medium variant | laser_light, ecm_suite | 10 | ECM jams missile locks |
| LANCE-F (Fire support) | Heavy variant | missile_lrm15 ×2 | 5 | Long range only |
| LANCE-B (Brawler) | Heavy variant | ballistic_ac10, missile_srm6, laser_medium | 6 | Close quarters |

### 3.2 Additional weapons

| Key | Label | Range | Damage | Special |
|---|---|---|---|---|
| `laser_pulse` | PULSE LAS | 7 | 3 | Fires twice; second at +1 TN |
| `ballistic_ac20` | AC/20 | 4 | 20 | Huge heat; devastating CQB |
| `ballistic_gauss` | GAUSS | 15 | 15 | No heat; ammo explosion risk on CT destroy |
| `missile_srm6` | SRM-6 | 6 | 12 | Salvo 6; dangerous scatter |
| `missile_lrm10` | LRM-10 | 21 | 10 | Indirect fire capable |
| `missile_lrm15` | LRM-15 | 21 | 15 | Ditto |
| `ecm_suite` | ECM | — | — | +2 TN on missile locks within 3 hexes |
| `flamer` | FLAMER | 3 | 2 | Adds 3 heat to target |

### 3.3 Lance composition (pre-game)
Currently lances are fixed (scout/medium/heavy). Allow players to build a three-mech force from a point budget in the waiting room before START. Each chassis has a point cost.

---

## TIER 4 — VS AI mode

### 4.1 Architecture
AI runs entirely in the browser. Acts as synthetic Player 2 using the same plan submission interface. After human submits, AI generates and immediately submits its plan.

### 4.2 Difficulty levels
- **BASIC (Greedy):** Move toward nearest enemy, stop at weapon range, fire
- **STANDARD (Tactical):** Target low-armour mechs, use cover, spread fire intelligently
- **HARD (Threat-aware):** Score hexes by safety/coverage, focus fire, protect damaged units. Can use Claude API for genuine strategic reasoning — prompt with board state JSON, receive plan object

---

## TIER 5 — Strategic campaign mode

### 5.1 Structure
Territory map with nodes connected by routes. Players choose contested territories to fight over. Winning gives resources; losing costs them. Campaign ends when one player controls all territory or runs out of mechs.

### 5.2 Persistent pilot roster
Pilots survive between battles (unless head destroyed — then wounded, unavailable for one battle). Progression uses the `gunnery`/`piloting` fields already on each mech:

| XP threshold | Rank | Gunnery bonus | Piloting bonus |
|---|---|---|---|
| 0 | Green | 0 | 0 |
| 3 battles | Regular | 1 | 0 |
| 8 battles | Veteran | 1 | 1 |
| 15 battles | Elite | 2 | 1 |
| 25 battles | Legendary | 2 | 2 |

### 5.3 Salvage and repair
Winner salvages one destroyed enemy mech. Repair costs resources, takes time (measured in battles).

### 5.4 DB schema additions
```sql
ironfield_campaigns (
  id, join_code, status, p1_id, p2_id,
  map JSONB,    -- territory nodes and connections
  state JSONB   -- resources, pilot roster, mech roster per player
)
-- ironfield_games gets: campaign_id (nullable FK)
```

### 5.5 Campaign map UI
New `scr-campaign` overlay: territory graph, colour-coded by owner, contested territories highlighted. Both players confirm before a battle starts.

---

## TIER 6 — Quality of life and replayability

### 6.1 Replay system
Store full sequence of plans in `ironfield_events` (infrastructure already present). Step through battle turn by turn — both plans revealed simultaneously.

**Commander's commentary (per-match toggle):** Each player can write a one-line note before submitting their turn. Notes hidden during live play, revealed in replay. Stored as `plan.commander_note`. Minimal cost: one boolean on `ironfield_games`, one text field in plan blob.

### 6.2 Spectator mode
Third party joins read-only — subscribes to `onGameUpdate` but never writes to `ironfield_turn_plans`.

### 6.3 Multiple concurrent games
Track `gameId` per tab rather than globally.

### 6.4 Scenario objectives
| Scenario | Win condition |
|---|---|
| Breakthrough | Get any mech off enemy map edge |
| Last Stand | Defender holds zone for N turns |
| Salvage | Destroy mechs without destroying CT |
| Escort | Designated mech reaches target hex |
| Assassination | Kill the named mech |

### 6.5 Turn timer
Optional per-turn time limit. Server-side timestamp + client countdown. Auto-submits current plan on expiry.

### 6.6 Sound design
Weapon fire (per type), hit confirmation, mech destruction, turn resolution. Web Audio API, no dependencies.

### 6.7 Mobile / touch improvements
Larger touch targets, swipe-to-pan, pinch-to-zoom, bottom-sheet weapon picker.

---

## Recommended next sessions

1. **Elevation (2.4)** — Completes the terrain system. Triangle-level height data, TN modifiers for uphill/downhill shots, stepped tint rendering.
2. **VS AI — Basic difficulty (4.1/4.2)** — Allows solo play. Greedy AI (move toward enemy, fire) is a single session and makes the game testable without a second player.
3. **Additional chassis (3.1/3.2)** — Add the remaining LANCE-S/A/E/F/B chassis and their new weapons to `LANCE_CHASSIS`, making the composition picker meaningful with more variety.
4. **VS AI — Hard difficulty with Claude API** — Natural follow-on; prompt board state JSON, receive plan object.
5. **Campaign mode (Tier 5)** — Largest remaining scope; multi-session.

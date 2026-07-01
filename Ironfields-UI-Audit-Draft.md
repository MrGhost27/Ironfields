# Ironfields — UI Audit & Redesign Draft
*Working document — v1*

**Step 1 — UI Style Switcher infrastructure — worked on: 2026-07-01 08:42**

## 1. Purpose

Before touching mobile layout, we need to separate three different problems that are currently tangled together in one flat toolbar + panel structure:

1. **Core gameplay actions** — things a player must be able to do every turn.
2. **Planning aids / display toggles** — things that help you see what's going on, but aren't actions themselves.
3. **Dev/debug tools** — things that exist because we're mid-development, not because a real player needs them.

Right now all three live in the same toolbar and panels with equal visual weight. That's the root cause of both the PC clutter and the mobile "unplayable" problem — mobile just has zero slack left to absorb it.

This doc also proposes a **runtime UI Style Switcher** so you can flip between layout variants live (via the settings cog) and compare them side by side during development, instead of committing to one layout per rewrite.

Mech token visual redesign (the hex outline vs. the pilot-avatar/facing-cone rendering) is **out of scope for this doc** — noted as a follow-up per your request.

---

## 2. Current UI Inventory

### 2.1 Header bar (`<header>`)
| Element | Type | Notes |
|---|---|---|
| TURN / MODE / FACING / PHASE | Status readout | Not interactive. Currently plain text, competes for space with logo. |
| PILOT name | Status | |
| v2.7 tag | Status | Dev-only info, low value to players |
| LOBBY button | Action | Rare use (once per session) |
| END GAME button | Action | Rare, destructive — currently same visual weight as LOBBY |

**On your screenshot:** this row already wraps/truncates on a phone ("PILOT: Dad1" gets cut off, the mode/facing labels overlap). It's the first thing that breaks.

### 2.2 Plan bar (floats over canvas, top-center)
YOUR PLAN status · OPPONENT status · SUBMIT PLAN · RECALL

Core gameplay — this is the entire point of WeGo. Should stay prominent.

### 2.3 Toolbar (floats over canvas, bottom-center) — `.tbar`
| Button | Category | Real necessity |
|---|---|---|
| SELECT | **Core** | Default mode, always needed |
| MOVE | **Core** | |
| ROTATE | **Core** | |
| LOS | Planning aid | Useful, not used every turn |
| FIRE | **Core** | |
| TERRAIN | Dev/host tool | Map editing — arguably shouldn't be in the live match toolbar at all |
| UNDO | **Core** | |
| TRI GRID | Debug display | Sub-triangle grid overlay — dev tool |
| OUTLINE | Display toggle | Actually fairly important (shows facing/footprint) — but rarely needs to be *toggled* mid-game |
| HALF TRIS | Debug display | Coverage detail — dev tool |
| VERTICES | Display toggle | Needed for MOVE mode to work visually — should probably be tied to mode, not a manual toggle |
| NEW TURN | **Dev-only, arguably dangerous** | Bypasses `resolveTurn()` entirely — resets MP locally without going through WeGo resolution or syncing to the opponent. This should not be reachable by real players in a live multiplayer match. |

That's **12 buttons** in one row, ~7 of which are dev/debug tools that happen to be permanently visible.

### 2.4 Right panel — UNIT DATA (`.rpan`)
SELECTED / PILOT / ANCHOR / FACING / COVERAGE (full:x half:y) / MP bar / CURSOR / facing wheel / move hint / weapon picker (contextual) / LOG

COVERAGE and CURSOR are debug-level detail (raw triangle counts, raw coordinates) with no obvious player-facing value. LOG is essential but currently always fully expanded, competing for vertical space with everything else.

### 2.5 Left panel — LANCE ROSTER (`.side`)
Per-mech cards: avatar, pilot name+skills, class, facing, MP, pip row, armor/structure/heat bars, **8-cell armor location grid**, **weapons online/offline list**, fire-order annotations, status flags.

This is genuinely dense — good depth for PC, but it's a lot of simultaneous information architecture for a 200px-wide column, and far too much for mobile as-is.

### 2.6 Settings cog panel (already exists — good pattern to build on)
THEME (dark/light) · BRIGHTNESS slider · TEXT SIZE · COMBAT FEEDBACK (weapon labels on hover) · RESET DEFAULTS

This is the right *shape* of solution — persisted via `localStorage`, applied via a body-level class/attribute, no page reload needed. We can extend this exact pattern for layout switching.

---

## 3. Readability Problems (PC)

- **Font sizes are very small by default** — `.ms` (9px), `.mc-armor-cell` (7px), `.wp-btn .wstats` (8px), HUD tooltip rows (8px). The TEXT SIZE slider only scales `--log-size`, which doesn't touch most of these.
- **Low contrast on secondary text** — `--dim: #005522` on `--bg: #060a07` is a very dark green-on-black, on-brand but genuinely hard to read at a glance, especially the armor-grid structure sub-values.
- **Two floating bars compete for the same vertical space** — plan bar (top) and toolbar (bottom) both float over the canvas independently, with no shared layout logic. On short viewports (see §4) they collide.
- **Debug and gameplay controls have identical visual styling** — nothing distinguishes "SELECT" from "TRI GRID" at a glance; you have to already know which of the 12 buttons matter each turn.
- **COVERAGE / CURSOR readouts** are raw internal state, not information a player needs to make a decision.

---

## 4. What Actually Breaks on Mobile (from your screenshot)

- Header wraps and truncates (PILOT name cut off entirely).
- Plan bar's SUBMIT PLAN button is present but the toolbar underneath it is **entirely gone** — no visible mode switching at all below the fold.
- Roster panel occupies the full width in portrait, canvas is a ~120px sliver, right panel presumably off-screen entirely.
- Nothing here is really "responsive" — it's the desktop 3-column flex layout attempting to survive at 360–400px width, and losing.

This isn't a CSS-tweak problem. It's confirmation that mobile needs a **different layout mode**, not a squeezed version of the same one — which is exactly why trimming the desktop UI first will make that job smaller.

---

## 5. Proposed Approach

### 5.1 Bucket everything into three tiers

**Tier 1 — Always visible, core gameplay:**
SELECT / MOVE / ROTATE / FIRE, UNDO, SUBMIT PLAN / RECALL, roster (collapsed/summary on mobile), selected-unit readout, log (collapsed by default, expandable).

**Tier 2 — Contextual, shown when relevant:**
LOS (only meaningful when actively checking sightlines), weapon picker (already contextual — good), TERRAIN tools (only in an explicit "edit map" mode, arguably only available pre-match in the waiting room, not mid-match at all).

**Tier 3 — Dev/debug, hidden behind a toggle:**
TRI GRID, HALF TRIS, VERTICES, NEW TURN, COVERAGE/CURSOR readouts. Move these into the **settings cog** under a new "DEVELOPER" section, or gate the whole section behind a `?debug=1` query param / long-press on the version tag — something that isn't in a normal player's way at all, but is still one click away for you.

This alone would take the toolbar from 12 buttons to ~5–6, which is a much easier thing to fit on a phone screen without a totally separate interaction model.

### 5.2 UI Style Switcher (dev comparison tool)

Extend the existing settings pattern with a new control:

```
LAYOUT
[ CLASSIC ]  [ COMPACT ]  [ MOBILE ]
```

- Persisted the same way as `if_theme` / `if_brightness` (a `localStorage` key, e.g. `if_ui_layout`).
- Applied as `document.body.dataset.uiLayout = 'compact'`, with CSS scoped under `body[data-ui-layout="compact"] { ... }`.
- Lets you flip layouts live, on the same device, without a rebuild — including on your phone, so you can compare CLASSIC vs COMPACT vs MOBILE side by side while deciding what to keep.
- Once you've settled on a direction, we delete the losing variants rather than maintaining three forever — this is explicitly a *comparison* tool for the design phase, not a permanent player-facing feature (though there's no harm in leaving it in if you want that flexibility down the line).

This is a small, self-contained piece of infrastructure we could build first, before touching the actual layouts — it de-risks everything after it, since you can bail out of a bad direction instantly instead of it being a full rewrite each time.

### 5.3 PC: "Compact" layout direction

- Toolbar trimmed to Tier 1 actions only (~5–6 buttons), debug toggles moved to settings.
- Merge plan bar and toolbar into a single bottom control strip so they stop competing for space.
- Roster cards get a collapsed default state (name, class, HP bars only) with tap/click-to-expand for the full armor grid and weapons list — most of the time you don't need 8 armor cells visible for every mech simultaneously.
- Drop COVERAGE/CURSOR from the always-visible panel; keep them available in a debug section if useful for you.

### 5.4 Mobile: layout built *on top of* the compact core

- Canvas is the base layer, full screen, always.
- Roster / Unit Data / Log become full-screen (or bottom-sheet) overlays, switched via a small persistent tab bar — not simultaneous columns.
- Tier 1 action buttons become a bottom icon strip sized for touch (44px+ targets), replacing the current 12-button row.
- Plan bar collapses to a compact status pill + SUBMIT button that doesn't compete with the action strip.

*(Touch-vs-hover interaction for MOVE/FIRE preview — tap-to-preview, tap-to-confirm — is a separate, slightly bigger piece of work than pure layout, flagged here but not detailed in this draft.)*

---

## 6. Suggested Order of Work

1. **UI Style Switcher infrastructure** (settings cog extension + `data-ui-layout` plumbing) — small, self-contained, unlocks everything else.
2. **Tier the existing controls** — move debug tools into settings, trim the toolbar, without changing visual style yet. This alone should meaningfully help *current* PC users.
3. **"Compact" PC layout variant** — collapsible roster cards, merged bottom control strip.
4. **"Mobile" layout variant** — tab-based full-screen panels, touch-sized controls.
5. **(Later, separate doc)** Mech token visual redesign.
6. **(Later)** Touch-native interaction model for MOVE/ROTATE/FIRE.

---

## 7. Open Questions for You

- Should **TERRAIN** editing be removed from the live-match toolbar entirely and restricted to the waiting-room map-preset flow, or do you actually want to hand-edit terrain mid-match sometimes?
  **Answer:** Removed entirely. Terrain editing is a map-editor function, and we don't currently have a map editor. It has no place in the live-match toolbar.

- Is **NEW TURN** purely a dev tool (should be debug-gated), or is there a real player-facing use case for it I'm missing?
  **Answer:** No value seen in it — it's a leftover from an earlier version (predates WeGo plan submission/resolution) and should be removed outright, not just debug-gated.

- For the roster panel on PC — collapsed-by-default with expand, or keep it fully expanded but let *you* toggle density via the style switcher?
  **Answer:** Collapsed-by-default, expandable. Even collapsed, a card should still show the essentials at a glance: mech name, armour, structure, and heat.

- Any layout names/branding preference, or is CLASSIC/COMPACT/MOBILE fine as working labels for now?
  **Answer:** CLASSIC / COMPACT / MOBILE is fine for now — may revisit naming later.

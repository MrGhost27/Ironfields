# Ironfields — UI Audit & Redesign Draft
*Working document — v1*

**Step 4 — "Mobile" layout variant — worked on: 2026-07-01**

Implemented the §5.4 mobile layout direction, scoped under
`body[data-ui-layout="mobile"]` — CLASSIC and COMPACT are untouched.

- **Persistent tab bar.** New fixed bottom bar with three tabs — MAP /
  ROSTER / UNIT — replacing the simultaneous three-column layout. Only one
  of `.carea` / `.side` / `.rpan` renders at a time, driven by
  `body[data-ui-layout="mobile"][data-mobile-panel="…"]`. Switching tabs is
  handled by a new `setMobilePanel()` function; canvas dimensions are
  re-synced via `resize()` whenever you switch back to MAP, since `.carea`
  going `display:none` while off-screen can leave its size stale after a
  resize/rotation.
- **Canvas as the default view.** MAP is the tab you land on whenever you
  switch into mobile layout (`setUiLayout('mobile')` resets
  `mobilePanel` to `'carea'`). One interpretation note: §5.4 says the canvas
  is the base layer "always" — I read the intent as *canvas is always the
  default/anchor view*, and implemented ROSTER/UNIT as genuinely full-screen
  (not a translucent overlay with the canvas visible underneath), matching
  the literal "full-screen... overlays" wording later in the same bullet.
  Flagging this in case you pictured something closer to a true overlay.
- **Touch-sized Tier 1 action strip.** The toolbar buttons get larger
  touch targets (46×46px minimum) in mobile, still only SELECT / MOVE /
  ROTATE / LOS / FIRE / OUTLINE / UNDO from the Step 2 trim. Only shown on
  the MAP tab, since the actions need the canvas to click against.
- **Compact plan pill.** Added a small colour-coded status dot (`#planPill`)
  next to the existing plan-bar markup — grey = not submitted, amber =
  submitted/waiting on opponent, green = both in, resolving. In mobile the
  verbose "YOUR PLAN: not submitted / OPPONENT: waiting…" text is hidden and
  the pill + SUBMIT/RECALL buttons are what's shown. CLASSIC/COMPACT keep
  the full text, unaffected.
- **Header trimmed for phone width.** MODE and FACING readouts are hidden
  (redundant with the active toolbar button + the UNIT tab), and the v2.7
  dev tag is hidden — directly addressing the header wrap/truncation problem
  from §4 ("PILOT: Dad1" getting cut off).
- **Settings cog repositioned** slightly higher so it doesn't collide with
  the new tab bar.

**Known gap, called out on purpose, not fixed here:** switching to FIRE mode
on the MAP tab doesn't auto-jump you to the UNIT tab where the weapon picker
lives — you have to switch tabs manually mid-order. This is exactly the
"touch-vs-hover interaction... tap-to-preview, tap-to-confirm" work §5.4
explicitly flags as separate and out of scope for this step, so I left it
alone rather than improvising a fix that isn't part of the agreed plan.

**Net effect:** all four steps in §6's order of work are now done. Switching
between CLASSIC / COMPACT / MOBILE via the settings cog should show a real,
distinct layout at each setting, all on the same build, all still respecting
the same underlying game logic. Mech token visual redesign and the
touch-native interaction model are the two follow-ups flagged for separate
docs.

---

**Step 3 — "Compact" PC layout variant — worked on: 2026-07-01**

Implemented the §5.3 compact layout direction, scoped entirely under
`body[data-ui-layout="compact"]` so CLASSIC is untouched — this is the payoff
of building the Style Switcher in Step 1: nothing here is a rewrite, it's all
additive CSS + a bit of JS gated on the layout attribute.

- **Merged bottom control strip.** The plan bar and toolbar (`#planbar` and
  `#tbar`) are now both children of a new `#bottomStrip` wrapper div. In
  CLASSIC this wrapper is inert — the children keep their existing absolute
  positioning against `.carea` (the wrapper itself establishes no new
  positioning context, so nothing changes visually). In COMPACT,
  `#bottomStrip` becomes a flex row pinned to the bottom centre, and the two
  bars go `position: static` and lay out side-by-side as one strip instead of
  floating independently top-centre / bottom-centre.
- **Collapsible roster cards.** Each card in the LANCE ROSTER now has a small
  ▸/▾ expand toggle in its header. In COMPACT layout, cards default to
  collapsed — showing name, pilot line, class, facing, MP, and the ARM/STR/HT
  bars, exactly what's needed to plan a turn at a glance. The full 8-cell
  armour grid and weapons list are hidden until you click the toggle to
  expand that specific card (tracked per-mech in `expandedRosterCards`, reset
  each new match). In CLASSIC, `.mc-extra` has no `display:none` rule applied
  to it, so cards render fully expanded exactly as before — the toggle button
  itself is also CSS-hidden outside compact mode so it doesn't clutter
  CLASSIC at all.
- **One deviation worth flagging:** §7 says a collapsed card should show "mech
  name, armour, structure, and heat." I kept CLASS/FACING/MP visible too,
  since without a visible MP number you'd have to expand every card just to
  plan movement, which defeats the point of collapsing. Only the armour grid
  and weapons list — the two things §5.3 explicitly calls out as
  expand-on-demand — are gated. Easy to trim further (e.g. also collapse the
  pilot skill line or MP pips) if you want a denser default.

**Net effect:** switching to COMPACT via the settings cog now visibly does
something — bottom strip merges, roster cards shrink to essentials. Still no
changes to CLASSIC's appearance or behaviour. Mobile layout (Step 4) is next.

---

**Step 2 — Tier the existing controls — worked on: 2026-07-01**

Implemented the §5.1 tiering without changing visual style, per the plan and the
answers to §7's open questions:

- **Toolbar trimmed from 12 buttons to 7**: SELECT / MOVE / ROTATE / LOS / FIRE /
  OUTLINE / UNDO remain. Everything else was either relocated or removed.
- **TRI GRID, HALF TRIS, VERTICES** moved out of the toolbar into a new
  **// DEVELOPER** section in the settings cog panel, under a "DEBUG OVERLAYS"
  row. Still call the same `togFlag()` function and respect the same default
  states (`half`/`verts` on, `tri` off) — just relocated, not reworked.
- **TERRAIN** button removed entirely from the live-match toolbar per your
  answer in §7 (no map editor exists yet; map presets in the waiting room
  already cover pre-match terrain setup). The underlying terrain-paint mode
  code (`mode === 'terrain'`, `updateTerrainPanel()`, etc.) is left in place
  but is no longer reachable — it was already effectively dead code, since
  `updateTerrainPanel()` targets a `#wpanel` element that doesn't exist in the
  current DOM, so it silently no-ops. Worth knowing if a real map-editor tool
  gets built later: this code is a reasonable starting point, but currently
  has no working UI regardless of toolbar access.
- **NEW TURN** removed outright (button *and* function deleted), per your
  answer — it bypassed `resolveTurn()` entirely and had no legitimate use in
  the current WeGo flow.
- **COVERAGE / CURSOR** readouts in the UNIT DATA panel are now hidden by
  default (`.dev-only` class, `display:none`), toggled via a new
  "SHOW COVERAGE / CURSOR" checkbox in the settings panel's DEVELOPER section.
  Same DOM elements, same live-updating behaviour — just off by default so a
  normal player never sees raw triangle counts or world coordinates.
- Settings panel now has a `// DEVELOPER` divider separating player-facing
  display settings (layout, theme, brightness, text size, combat feedback)
  from dev/debug controls, so it's visually clear which section is which.

**Net effect:** the always-visible toolbar+panel surface area is meaningfully
smaller heading into the mobile work, without touching layout structure or
visual style yet — that's still Step 3/4.

---

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

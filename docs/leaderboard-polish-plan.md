# Experience Archaeology Leaderboard — Polish Plan (Phase 1+2+3)

**Source recommendations:** `docs/archepal-leaderboard-recommendations.md`
**Target files:** `src/pages/BoothBattleLeaderboard.tsx`, `src/pages/BoothBattleSubmit.tsx` (submit-form restyle was added after the original plan; see Amendments)
**Estimated effort:** ~1h45m
**Status:** ✅ Shipped 2026-04-30 — see "Amendments after execution" for divergences from the original plan.

---

## Locked decisions

1. **No Rank column.** Top 3 get inline medal chips on the visitor name only.
2. **Pinned C54 is always rank 1** and always wears the gold chip. Other rows get silver/bronze by sort order (`archePalSpotted` desc, `bestSubmittedAt` asc tie-break).
3. **Brass `#b8860b` is the single primary accent** — used on the CTA, top-row left border, medal gradients (gold tier), header band underline, and progress-bar fills.
4. **Third stat = "Top observer"** (visitor with the highest `objectsSpotted`). "Most observed booth" was rejected because it's always redundant with rank 2 under the current sort.
5. **Top-row brass left border is approved.**

---

## Constraints

- One file change only: `src/pages/BoothBattleLeaderboard.tsx`.
- No new npm packages.
- No new Firestore reads beyond what's already in place (`scores`, `recordedCounts`, `siteNames`).
- No asset additions (no SVG/PNG/font drops).
- All existing data semantics preserved:
  - `objectsSpotted` = visitor's submitted keyword count (`bestKeywords.length`)
  - `archePalSpotted` = ArchePal's recorded keyword count for that booth (most recent `DigitalDiary.keywords.length`)
  - C54 hardcoded row (objectsSpotted=100, archePalSpotted=100) stays pinned at top.

---

## Phase 1 — Layout & polish

### 1.1 Header band
- Replace the standalone `<h1>` and the bottom-of-page Submit-a-score button with a single flex row at the top.
- Left side: existing serif-style title + new subtitle _"Top spotters at the booth — refreshed live."_ (`text-sm text-amber-200/70`).
- Right side: Submit-a-score button restyled in brass — `bg-[#b8860b] hover:bg-[#9a7308] text-[#1a0f08] font-semibold`.
- Delete the existing `<div className="text-center pt-2">…</div>` block at the bottom.

### 1.2 Column headers
- Change header `<tr>` styling from `text-slate-400` (currently `text-amber-100/70`) to `text-xs uppercase tracking-[0.12em] font-semibold text-amber-200/80`.
- Keep `<br/>` line breaks on "Objects Spotted" / "ArchePal Spotted" so column width stays compact.

### 1.3 Drop duplicate visitor name
- Inside the Name cell, remove the second `<div className="text-slate-400">{row.visitorName}</div>`.
- Keep only the bold name + medal chip (1.5) inline before it.

### 1.4 Top row tint
- The first row in `ranked` (always the pinned C54) gets `bg-[#5b3a22]` plus a 2px brass left border `border-l-2 border-[#b8860b]`.
- Achieved by passing the row's index into the row component and conditionally applying classes.

### 1.5 Medal chips on top 3
- Render a circular chip immediately before the visitor name when the row's index in `ranked` is `< 3`.
- Chip markup: `<span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-[#1a0f08] shadow ...">{index+1}</span>`.
- Background classes by index:
  - Index 0 (gold) — `bg-gradient-to-br from-[#f5d572] to-[#b8860b]`
  - Index 1 (silver) — `bg-gradient-to-br from-[#e8e8e8] to-[#9a9a9a]`
  - Index 2 (bronze) — `bg-gradient-to-br from-[#d4a574] to-[#8b5a2b]`
- Name cell layout becomes a flex row: `<div className="flex items-center gap-2">{chip}{name}</div>`.

### 1.6 Zebra striping
- Add `even:bg-[#3f2718]/40` to `<tr>`. The top-row tint (1.4) is applied directly and wins via Tailwind's source order.
- Even-row tint deliberately subtle (~3% lighter than the page) so it doesn't fight the brand palette.

### 1.7 Hover
- Existing `hover:bg-[#5b3621]/50` stays. No lift / shadow animation in this phase — deferred to Phase 4 (motion).

---

## Phase 2 — Within-row progress bars

Inside both numeric cells (`Objects Spotted` and `ArchePal Spotted`):

- Number stays right-aligned, tabular-nums.
- Below the number, add a thin bar:
  - Track: `h-1 mt-1 bg-[#1a0f08] rounded-full overflow-hidden`
  - Fill: `h-full bg-[#b8860b]` with inline `style={{ width: `${pct}%` }}`
  - `pct = Math.round((count / rowMax) * 100)` where `rowMax = Math.max(objectsSpotted, archePalSpotted, 1)`
- If `objectsSpotted === 0 && archePalSpotted === 0`, skip both bars.

This makes the participant-vs-ArchePal comparison readable at a glance per row. Pinned C54 with 100/100 shows both bars at 100% (intentional).

---

## Phase 3 — Stats strip

Inserted between the header band and the leaderboard card.

### Layout
- Container: `grid grid-cols-3 gap-3 sm:gap-4` (collapses to `grid-cols-1` below `sm` → already responsive).
- Each stat card:
  - Wrapper: `bg-[#3a2415] border border-[#6a4226] rounded-lg p-3 sm:p-4`
  - Label: `text-xs uppercase tracking-[0.1em] text-amber-200/60`
  - Value: `text-xl sm:text-2xl font-bold text-[#d4a96a]` (brass tone, slightly lighter than CTA for hierarchy)

### Metrics

| Card | Computation |
|---|---|
| **Total objects spotted** | `ranked.reduce((sum, r) => sum + r.objectsSpotted, 0)` (includes pinned C54) |
| **Booths visited** | `new Set(ranked.map(r => r.siteId)).size` |
| **Top observer** | `ranked` row with max `objectsSpotted`; tie-break = earliest `bestSubmittedAt`. Display `visitorName` (no count) |

All three derive from existing in-memory state — no extra reads.

---

## Open questions

None. All three are resolved.

---

## Out of scope (deferred)

- Phase 4 — motion (row fade-in, count-up on score change, pulsing leader row).
- Phase 5 — mobile card-stack reflow + focus rings + contrast audit.
- Phase 6 — decorative (topographic SVG bg, paper-grain overlay, footer illustration, recently-spotted artifact feed).
- Help FAB recolor — lives in a separate component, not yet located.
- Re-adding a Rank column — explicitly ruled out.

---

## Verification after execution

- `npx tsc --noEmit -p tsconfig.app.json` — no new errors in `BoothBattleLeaderboard.tsx`.
- Manual visual check at `/#/booth-battle`:
  - Header band has title + subtitle + brass Submit CTA on right; nothing left at the bottom.
  - Stats strip shows three cards with sensible numbers.
  - Top row (C54) tinted, gold chip, brass left border.
  - Rows 2–3 show silver/bronze chips on real submissions.
  - Even rows zebra-striped subtly.
  - Each numeric cell shows a brass progress bar proportional to that row's max.
  - Mobile (390×844): stats stack to single column, table still scrolls horizontally as before.

---

## Amendments after execution

These are intentional divergences from the original plan, captured live during the same session. The committed code reflects the amendments — the sections above describe the original intent, not the final state.

### A1. Removed "Total Objects Spotted" stat card
- **What changed:** Stats strip reduced from 3 cards to 2.
- **Final cards:** `Booths Visited` · `Top Observer`. Total Objects Spotted is gone.
- **Layout:** `grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4` (was `sm:grid-cols-3`).
- **Reason:** User judged the total to be noise — not a meaningful KPI for this audience.
- **Cleanup:** `totalObjectsSpotted` field removed from the `stats` `useMemo`.

### A2. Removed medal chips from the Name column
- **What changed:** Phase 1.5 (gold/silver/bronze chips before visitor name) was reverted.
- **Final state:** Name cell renders just the bold visitor name. No inline rank numerals.
- **Reason:** User found the inline `1`/`2`/`3` chips confusing — they read as a rank column even though we'd explicitly removed Rank earlier.
- **What stays:** The pinned C54 row still has its parchment tint + 2px brass left border (Phase 1.4). That alone is now the only "you are #1" cue.
- **Cleanup:** `MedalChip` component and `MEDAL_GRADIENTS` constant deleted. `idx < 3` branch removed from the row map (the `idx === 0` check for top-row tint stays).

### A3. Submit form (`BoothBattleSubmit.tsx`) restyled to match
- **What changed:** Originally out-of-scope (one-file change to leaderboard only). After leaderboard shipped, user asked to extend the brown/brass palette to `/booth-battle/submit` because it looked isolated.
- **Surfaces touched in `src/pages/BoothBattleSubmit.tsx`** — UI only, zero functional changes:
  - Page wrapper: `bg-background` → `bg-[#4a2c1a] text-slate-100`.
  - "Booth Battle" header badge: emerald → brass `text-[#d4a96a]`.
  - Title `text-slate-50`; subtitle `text-amber-200/70`.
  - All four cards (form, submitting, thanks, error): `bg-[#3a2415] border-[#6a4226]`. Thanks card keeps a 2px brass left border.
  - Inputs (name, email, keyword draft, picker trigger): extracted to `inputClass` constant — `bg-[#2a1a10] border-[#6a4226] text-slate-100 placeholder:text-amber-200/30 focus-visible:ring-[#b8860b]`.
  - Booth picker popover: dark brown surface (`bg-[#2a1a10]`), brass-tinted Check icon, brass `aria-selected` highlight (`bg-[#5b3621]`).
  - Keyword chips: emerald → translucent brass — `bg-[#b8860b]/20 text-[#d4a96a] border-[#b8860b]/30`. Chip-X hover `bg-[#b8860b]/30`.
  - Counter ("N / 100 keywords"): `text-amber-200/60`.
  - Primary buttons (Submit, Submit another, Back to form): extracted to `brassButtonClass` constant — `bg-[#b8860b] hover:bg-[#9a7308] text-[#1a0f08] font-semibold focus-visible:ring-[#b8860b]`.
  - View leaderboard outline button: brown surface, amber hover.
  - Bottom "View leaderboard" link: `text-amber-200/60 hover:text-amber-100`.
  - Inline error text: `text-destructive` → `text-red-400` (legible on brown).
- **Functionality untouched:** zod schema, react-hook-form wiring, `BoothBattleService.submitAttempt`, success/error view states, keyword normalization/dedup logic — all preserved.

### A4. Removed "FW Team #" column from the leaderboard
- **What changed:** The empty `FW Team #` column (header existed but every row rendered `&nbsp;`) was removed from the leaderboard table.
- **Final columns:** `Name` · `Team Name` · `Objects Spotted` · `ArchePal Spotted` (4 columns; was 5).
- **Reason:** Column had no data source and was never going to — pure visual debt. User flagged it directly.
- **Touched:** one `<th>` and one `<td>` removed from `src/pages/BoothBattleLeaderboard.tsx`. No state, type, or sort-logic changes.

---

## Final shipped state — quick reference

| Surface | Before | After |
|---|---|---|
| Leaderboard page bg | slate-950 | `#4a2c1a` (logo brown) |
| Leaderboard cards / table | slate-900 / slate-800 | `#3a2415` / `#6a4226` |
| Submit form page bg | `bg-background` | `#4a2c1a` |
| Submit form cards | default | `#3a2415` / `#6a4226` |
| Submit form inputs | default | `#2a1a10` / `#6a4226` brass focus ring |
| Keyword chips | emerald | brass translucent |
| Primary CTAs | default | brass `#b8860b` solid |
| Stats strip | (none) | 2 cards: Booths Visited · Top Observer |
| Medal chips on top 3 | (none) | tried, then reverted (A2) |
| Top row treatment | (none) | parchment tint + 2px brass left border |
| Within-row progress bars | (none) | brass fill, normalized to row max |
| Leaderboard columns | Rank · Name · FW Team # · Team Name · Objects · ArchePal (6) | Name · Team Name · Objects · ArchePal (4) — Rank removed earlier, FW Team # removed in A4 |

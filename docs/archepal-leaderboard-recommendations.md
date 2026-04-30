# Experience Archaeology Leaderboard — Look & Feel Recommendations

_Page: /#/booth-battle_

> **Implementation status (2026-04-30):** A first polish pass has been shipped against this doc. See `docs/leaderboard-polish-plan.md` for the executed plan and the live divergences. The recommendations below are annotated inline with `[shipped]`, `[shipped, then reverted]`, `[deferred]`, or `[rejected]`. The same brown/brass palette was extended to `/#/booth-battle/submit` in the same session.

## Overall Impression

The page has a strong, cohesive earthy palette (deep brown background with a serif headline) that suits the archaeology theme — but it currently feels flat, sparse, and unfinished. The table dominates a huge empty canvas, hierarchy is weak, and there is no personality or motion. Much of the data is also redundant (e.g. "C54 / C54 / C54").

---

## 1. Layout & Composition

- Constrain content to a centered max-width container (~900–1000px) so it does not drift on wide screens. _[shipped — `max-w-4xl` (~896px), already in place before this pass]_
- Add a header band with the title on the left and the **+ Submit a score** CTA on the right (instead of orphaned below the table). _[shipped]_
- Add a short subtitle, e.g. _"Top spotters at the booth — refreshed live."_ _[shipped — exact copy used]_
- Introduce a faint topographic / dig-site SVG pattern behind the title for a sense of place. _[deferred — needs asset]_
- Balance the page with a footer area so the leaderboard feels anchored. _[deferred]_

## 2. Color & Texture

- Move from a single flat brown to **three tonal layers**: darker page background, warmer card surface, parchment/cream highlights. _[shipped — `#4a2c1a` page · `#3a2415` cards · `#5b3a22` parchment top row · `#3f2718/40` zebra]_
- Add a soft inner shadow or 1px warm-gold border on the table to lift it off the background. _[partial — brown card border `#6a4226` instead of warm-gold; warm-gold accent reserved for the brass CTA / left border / progress bars]_
- Apply a very low-opacity paper/grain texture overlay for mood. _[deferred — needs asset]_
- Introduce an accent color: muted **terracotta**, **ochre**, or **brass-gold**. Use it for:
  - Top-rank row _[shipped — 2px brass left border `#b8860b`]_
  - Primary CTA button _[shipped — solid brass on Submit a score, plus all submit-form CTAs]_
  - Link hover states _[shipped — amber hover on bottom link]_
  - Focus rings _[shipped — `focus-visible:ring-[#b8860b]` on inputs/buttons]_

  _Picked **brass-gold `#b8860b`** as the single accent. Lighter brass `#d4a96a` used for stat values and the "Booth Battle" badge to give a two-step hierarchy._

## 3. Typography & Hierarchy

- Keep the serif headline; pair with a clean humanist sans (Inter, Source Sans, Public Sans) for tabular data. _[deferred — keeping the existing app stack, no font drop in this pass]_
- Clarify the stacked two-line cell pattern (Name above role/team) or collapse it — the duplicate "C54 / C54" reads like a placeholder bug. _[shipped — duplicate visitor-name line removed; Team Name column now resolves Firestore site doc → `name` (e.g. "C50") instead of doc ID]_
- Uppercase column headers with slight letter-spacing for a museum-label feel. _[shipped — `text-xs uppercase tracking-[0.12em] font-semibold text-amber-200/80`]_
- Enable **tabular figures** (CSS: font-variant-numeric: tabular-nums) so numeric columns align. _[shipped — `tabular-nums` already on the numeric cells]_

## 4. Leaderboard Polish

> **Final shipped columns:** `Name` · `Team Name` · `Objects Spotted` · `ArchePal Spotted` (4). The pre-existing `Rank` and `FW Team #` columns were both removed during this session — Rank was rejected (see below) and FW Team # was an empty column with no data source.

- **Add a Rank (#) column** — it is a leaderboard, rank is the point. _[rejected — user explicitly removed Rank earlier in the session and ruled out re-adding it. Top-row brass left border is the sole "you are #1" cue.]_
- Style top three with **gold / silver / bronze medallion badges**. _[shipped, then reverted — implemented as inline circular `1`/`2`/`3` chips before the visitor name; reverted because user read them as a re-introduced rank column. See `leaderboard-polish-plan.md` § Amendments A2.]_
- Add inline **progress bars** inside the "Objects Spotted" and "ArchePal Spotted" cells for at-a-glance comparison. _[shipped — within-row normalization: bar width = `count / max(objectsSpotted, archePalSpotted)`. Brass fill on dark track. Skipped when both counts are 0.]_
- Zebra-stripe rows with a 3–5% lighter brown. _[shipped — `even:bg-[#3f2718]/40`. Top row tint overrides via source order.]_
- Add a soft hover state (lift + border glow) so rows feel interactive. _[partial — `hover:bg-[#5b3621]/50` shipped; lift / border glow deferred to motion phase.]_
- Show a small avatar or team-color dot next to each name. _[deferred — not aligned with anonymous-visitor model.]_

## 5. Filling the Empty Space

The lower half of the page is a vast empty rectangle. Fill it with supporting content:

- A **stats strip**: _"Total objects spotted: 156 · Active teams: 4 · Time remaining: 2h 14m"_. _[partial — shipped as 2 cards: **Booths Visited** · **Top Observer**. Total Objects Spotted was tried then removed (user judged it noise). "Time remaining" dropped — no event-end timestamp available.]_
- A **"Recently spotted" feed** with thumbnails of artifacts. _[deferred — bigger lift, would need a new query against DigitalDiary.]_
- A mini map or illustration of the booth layout. _[deferred — no spatial data on Sites.]_
- A decorative footer illustration (trowel, brush, or dig-grid line art) in low-opacity ochre. _[deferred — needs asset.]_

## 6. Micro-interactions & Motion

- Rows fade-and-slide in on load. _[deferred]_
- Leader row gets a gentle pulsing highlight. _[deferred]_
- Score updates animate with a **count-up**. _[deferred]_
- CTA button: clear hover (lift + shadow + color shift) and active press state. _[partial — color-shift hover shipped (`hover:bg-[#9a7308]`); lift / shadow / pressed-state deferred to motion phase.]_
- Restyle the help FAB — the bright blue currently clashes; switch it to brass/ochre to match the palette. _[deferred — FAB lives in a separate component, not yet located.]_

## 7. Accessibility & Responsive

- Check contrast on muted secondary text (the lighter "C54" subtitle is borderline). _[partial — duplicate subtitle line removed entirely (so the borderline case is gone); broader contrast audit deferred.]_
- On mobile, reflow the table into a card stack rather than horizontal scroll. _[deferred — table still scrolls horizontally on small viewports; stats strip does collapse to single-column.]_
- Visible focus rings in the accent color for keyboard users. _[shipped on the leaderboard CTA and submit-form fields/buttons (`focus-visible:ring-[#b8860b]`); a11y audit across the rest of the app still pending.]_
- Ensure all interactive elements have accessible names and roles. _[partial — picker keeps `role="combobox"`/`aria-expanded`; broader audit deferred.]_

---

## Quick-Win Priority List

If you only do five things, do these:

1. Add a **Rank column** with medal styling for the top three. _[rejected — Rank ruled out; medal chips were tried and reverted, see § 4 above.]_
2. Introduce an **ochre / brass accent color**. _[shipped — brass `#b8860b` is the single primary accent across CTA, top-row border, progress bars, focus rings.]_
3. Add **inline progress bars** to the spotted columns. _[shipped — within-row normalization.]_
4. Fill the empty lower area with a **stats strip or artifact feed**. _[partial — 2-card stats strip shipped; artifact feed deferred.]_
5. Restyle the **help FAB** to match the warm palette. _[deferred — separate component.]_

These alone will transform the page from "data dump" to "branded experience."

---

## Bonus shipped (not in original doc): Submit form restyle

After the leaderboard pass, the same brown/brass palette was extended to `/#/booth-battle/submit` to keep the experience cohesive. UI only — no functional changes to the form, validation, or submission flow.

Mapped surfaces:
- Page bg `#4a2c1a` · cards `#3a2415` / `#6a4226` · inputs `#2a1a10` / `#6a4226`
- Header "Booth Battle" badge: emerald → brass `#d4a96a`
- Keyword chips: emerald → translucent brass (`bg-[#b8860b]/20 text-[#d4a96a]`)
- Primary CTAs (Submit / Submit another / Back to form): solid brass
- Booth picker popover: dark brown surface, brass-tinted Check icon, brass `aria-selected` highlight
- Inline error text: `text-destructive` → `text-red-400`

See `leaderboard-polish-plan.md` § Amendments A3 for the full diff inventory.

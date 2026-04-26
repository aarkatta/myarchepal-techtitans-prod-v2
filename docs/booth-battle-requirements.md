# Requirements: Booth Battle Mode — ArchePal

**Project:** FLL 2026 World Championship · Houston
**Org:** First Championship Houston (`vD4x5sGreTsscAp66FgA`)
**Target ship date:** Wednesday, competition day 1
**Status:** Shipped (initial fixed-5-keyword version), revised to variable-keyword model on 2026-04-25

> **Revision — 2026-04-25:** the original spec required exactly 5 recorded keywords and exactly 5 submitted keywords. Both have been relaxed:
> - **Recorded keywords:** the diary keyword extractor (`extractDiaryKeywords` Cloud Function) no longer caps output at 5 — it returns every distinctive keyword the booth description supports. Field count varies per booth.
> - **Submitted keywords:** the visitor form now accepts **1-100** keywords entered as chips in a single input (Enter or comma to add) instead of 5 fixed text boxes.
> - **Email captured:** the visitor form now collects a required email address (RFC-shaped, ≤200 chars). Stored on the submission doc only (not on the public leaderboard). The submissions collection's `list` permission was revoked at the same time so the public can't enumerate emails.
> - **Scoring formula unchanged:** still `matches × 50`. The maximum achievable score per submission therefore equals `min(submitted_count, recorded_count) × 50`, which can far exceed the original 250 cap.
>
> This document has been updated in place; sections marked with `(revised)` reflect the new model.

---

## 1. Overview

Booth Battle is a competitive add-on to ArchePal that turns the existing Sites and Diary functionality into a multi-team scoring game for the FLL 2026 Championship. Each of the 160 sites under the org `First Championship Houston` represents a competing team's booth.

The game flow is *(revised)*:

1. Our team members visit each booth on the floor, photograph it, and record a Diary entry for that booth. A Cloud Function (`extractDiaryKeywords`) auto-extracts every distinctive keyword from the description via OpenAI — the count varies per booth (typically 5-15).
2. When a member of another team visits **our** booth, they are asked to submit the keywords they remember describing **their own** booth. The visitor enters between 1 and 100 keywords as chips in a single input.
3. We compare their submitted keywords to the recorded keywords we extracted for that booth. **Each match scores 50 points.** Maximum score per submission = `min(submitted_count, recorded_count) × 50`.
4. All scores are aggregated into a public leaderboard.

This document covers three new pieces of functionality required to support Booth Battle.

---

## 2. Cross-Cutting Requirement — Org Gating

> **The entire Booth Battle feature set is available only for the org with ID `vD4x5sGreTsscAp66FgA` (First Championship Houston).**
> This applies to all three pieces of functionality covered in this document: keyword display on site screens, the visitor keyword submission form (§3), and the Booth Battle leaderboard screen (§4). Outside this org, none of these elements should be reachable, visible, or returnable from the API.

### 2.1 The rule

```
isBoothBattleOrg(org_id) := org_id == "vD4x5sGreTsscAp66FgA"
```

This check should live in a single shared utility used everywhere it applies. Centralizing it makes the rule consistent across surfaces and easy to expand later if additional championship orgs are added.

### 2.2 What is gated

| Surface | Behavior outside the org |
|---|---|
| Keywords on site detail screen | Field is not rendered. No placeholder, no empty label, no DOM presence. |
| Keywords in site list / search snippets | Not surfaced. |
| Keywords in Diary entry detail and previews | Not surfaced. |
| Keywords in exports, share, or print views | Not included. |
| **Visitor keyword submission form (§3)** | Route is not reachable. Entry points (Create menu, deep links, banners) are absent. The site dropdown does not populate. The submission API endpoint rejects the request. |
| **Booth Battle leaderboard screen (§4)** | Route is not reachable. Entry points are absent. The leaderboard API endpoint returns no data (or `404 Not Found`) for any other org. |

For all other orgs, keyword data continues to be stored normally on the backend — it is **hidden in the UI**, not deleted. This avoids losing data and keeps Booth Battle scoring from leaking into normal archaeology workflows where it would be inappropriate or confusing.

### 2.3 Defense in depth

Both the client UI and the API must enforce the gate independently. Client-only hiding can be defeated by inspecting requests; the server is the source of truth.

- **Client:** `isBoothBattleOrg(currentOrg.id)` controls every render path and route listed above. Booth Battle routes redirect to a "not found" state for non-matching orgs, not a styled error.
- **API:** Every Booth Battle endpoint validates `org_id == "vD4x5sGreTsscAp66FgA"` against the authenticated user's active org and returns `403 Forbidden` (or `404 Not Found`, if we prefer to hide the feature's existence) for any other org.

### 2.4 Acceptance criteria

- A user under `First Championship Houston` sees keywords on site screens, can reach and submit the visitor keyword form, and can view the Booth Battle leaderboard.
- A user under any other org (e.g., a normal archaeology org viewing Town Creek Indian Mound) sees no keywords section, has no path to the submission form, and has no path to the leaderboard.
- Direct URL navigation to a Booth Battle route while authenticated to a non-Booth-Battle org resolves to a not-found state, not a partial render.
- Direct API calls to Booth Battle endpoints from a non-Booth-Battle org session are rejected.
- Keyword fields are not present in the rendered DOM for non-Booth-Battle sites (cannot be revealed by inspecting the page).

---

## 3. Feature 2 — Visitor Keyword Submission Form *(revised)*

A new form available at `/booth-battle/submit` (also embeddable in iframes on team websites) that lets a visiting team member submit the keywords they remember from their own booth.

> **Availability:** Gated by §2. This form, its entry points, and its API endpoint are only present, reachable, and functional when the active org is `vD4x5sGreTsscAp66FgA`.

### 3.1 Form fields *(revised)*

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 1 | **Booth visited** | Searchable Select | Yes | Populated with all 160 sites under org `vD4x5sGreTsscAp66FgA`. Display format: bare site name (`C1`, `C25`, …) — natural sort so `C2 < C19`. |
| 2 | **Your team or name** | Text | Yes | Free text, max 80 chars. Used for display on leaderboard and audit. |
| 3 | **Email address** | Email | Yes | Standard `<input type="email">` with zod email validation, max 200 chars. Stored on the submission only (not propagated to the public leaderboard doc). Used by the host team for follow-up / contact. |
| 4 | **Keywords from the booth** | Chip Input | Yes | Single text box. Type a keyword and press **Enter** or **comma** to add it as a chip. **Backspace** on empty input removes the last chip. Each chip has an `X` to remove individually. Range: **1-100 keywords**. Duplicates (case-insensitive, normalized) are silently rejected. The input disables itself once the 100-chip cap is reached. A live counter (`N / 100`) is shown beneath. |

### 3.2 Behavior *(revised)*

- The booth picker is the **visitor's own booth** — i.e., the booth they came from. Visitors should not be able to submit keywords for someone else's site.
- The **Submit** button is enabled once a booth is selected, a name is entered, and at least one keyword chip is present.
- Keywords are normalized for matching: trimmed, lowercased, NFKD-normalized, and stripped of non-alphanumeric characters. Display preserves the original casing the visitor typed.
- Retakes are allowed: any number of submissions per `(site, visitor name)` pair are accepted; the system **keeps the highest score** and shows previous best vs. this attempt on the result card. (See §3.5.)
- Comma-separated paste: pasting `"robot, lego, hydraulic"` into the input adds three chips at once, after dedupe.

### 3.3 Scoring logic on submit *(revised)*

```
recorded_keywords  = the keywords extracted by extractDiaryKeywords for this site
                     (variable count, typically 5-15)
submitted_keywords = between 1 and 100 keywords entered by the visitor

normalize(k) = lowercase → NFKD → strip non-[a-z0-9 ] → collapse whitespace → trim
matches = | { normalize(s) | s ∈ submitted_keywords } ∩
            { normalize(r) | r ∈ recorded_keywords  } |
score   = matches × 50

max possible score = min(submitted_count, recorded_count) × 50
```

Scoring runs **server-side** in the `processBoothBattleSubmission` Cloud Function trigger. Clients write a `pending` submission and listen on it via `onSnapshot`; the trigger writes the score back into the same submission doc with `status='scored'`.

### 3.4 Acceptance criteria *(revised)*

- The booth picker lists exactly the 160 sites under `First Championship Houston`, naturally sorted (`C1`, `C2`, …, `C160`).
- The form validates: booth selected, name non-empty (≤80 chars), email non-empty + RFC-shaped (≤200 chars), between **1 and 100** keyword chips present.
- A submission's result card appears within ~2 seconds of submit (real-time `onSnapshot` on the submission doc).
- Resubmitting from the same person for the same site is allowed; the leaderboard `boothBattleScores` doc keeps the highest score, with `bestSubmittedAt` recording when that high score was first achieved.

### 3.5 Result UI

After submitting, the form swaps to a result card showing one of:

- **First scored attempt:** "You scored N/M (T points)."
- **New personal best:** "Previous best: P · This attempt: N (🎉 New best!)"
- **Best holds:** "Best stays at P."
- **Rejected:** "No recorded keywords for this booth yet — try later." (when the booth has no diary keywords yet)

A **Submit another** button resets the form (preserving the visitor name).

---

## 4. Feature 3 — Booth Battle Leaderboard Screen

A dedicated screen that displays all submitted scores, sorted by score descending.

> **Availability:** Gated by §2. The leaderboard route, its entry points, and its API endpoint are only present, reachable, and functional when the active org is `vD4x5sGreTsscAp66FgA`.

### 4.1 Screen contents *(partially revised)*

**Header**
- Title: "Booth Battle"
- Subtitle: "FLL 2026 · Houston"
- Summary stats:
  - Total players scored
  - Top score
  - Number of "perfect 5/5" submissions
    > **Known caveat (post-2026-04-25 revision):** this stat was defined when both submitted and recorded counts were exactly 5. Under the variable-keyword model it now counts entries with `bestScore == 250` (i.e., 5 matches × 50). It no longer represents an absolute "perfect" since visitors may submit more than 5 keywords and exceed 250. Treat this stat as legacy until reworked.

**Top 3 podium**
- 1st place: full-width card with gold accent
- 2nd & 3rd place: side-by-side cards with silver and bronze accents

**Full ranked list**
- All other entries below the podium
- Each row displays:
  - Rank
  - **Site Name** (bare booth ID — `C25`)
  - Visitor's name (smaller, secondary)
  - Keyword indicator dots (currently rendered as 5 dots — legacy from fixed-5 model; no longer accurate under variable counts and may be reworked)
  - Total score (best score)
  - `PERFECT` badge at score == 250 (legacy semantics; see caveat above)
  - `↑` retake indicator if `latestScore != bestScore`

### 4.2 Sorting and ties

- Primary sort: score descending
- Tie-breaker: earliest submission timestamp wins (rewards the team that came by our booth first)

### 4.3 Real-time updates

- The leaderboard should reflect new submissions without requiring a full refresh.
- Recommended: poll every 5–10 seconds, or use shared storage / a websocket if available.
- Multiple devices on our team must see the same data — booth hosts may be running this on more than one phone simultaneously.

### 4.4 Host controls

The host (our team) needs the ability to:

- **Edit** an existing score (in case of typo on the visitor's name or accidental wrong site).
- **Delete** an entry (in case of test submissions or duplicates the system didn't catch).
- **Reset all** scores (for end of competition, or testing). Must be behind a confirmation dialog.

These controls should only be visible to authenticated members of our own team — not to visitors filling out the form.

### 4.5 Acceptance criteria

- All current submissions are visible, ranked correctly.
- Stats summary updates as entries are added or removed.
- A perfect 5/5 score is visually distinguished from a 5/5 that lost on a tie-breaker.
- Host edit/delete/reset actions work and are gated on team-member auth.
- The screen is usable on a phone-sized viewport (this will be operated from phones on the floor).

---

## 5. Data Model

### 5.1 Site (existing, unchanged)

Existing site model. The 160 booth sites are created under `org_id = vD4x5sGreTsscAp66FgA`.

### 5.2 Recorded keywords *(revised)*

Each Diary entry linked to a site under the Booth Battle org carries a `keywords: string[]` field populated by the `extractDiaryKeywords` Cloud Function. The function calls OpenAI with a prompt that instructs it to extract **every** distinctive keyword the description supports (no fixed count). The function is idempotent — once `keywords.length > 0` it skips re-extraction unless the array is cleared.

Matching reads from the **most recent** Diary entry per site, ordered by `keywordsExtractedAt desc`.

### 5.3 Score submission *(revised)*

`boothBattleSubmissions/{auto-id}` — write-once request, read by submitter:

```ts
interface BoothBattleSubmission {
  // Set by client on create:
  orgId: 'vD4x5sGreTsscAp66FgA';
  siteId: string;                 // visitor's own booth
  visitorName: string;            // free text, original casing, ≤80 chars
  visitorEmail: string;           // RFC-shaped, lowercased, ≤200 chars (added 2026-04-25)
  submittedKeywords: string[];    // between 1 and 100 keywords (was: exactly 5)
  status: 'pending';              // becomes 'scored' or 'rejected' after processing
  clientSubmittedAt: Timestamp;   // server timestamp at create time

  // Filled by Cloud Function:
  matches?: number;               // 0..min(submittedCount, recordedCount)
  score?: number;                 // matches × 50
  previousBestScore?: number;     // best before this attempt (0 if first)
  currentBestScore?: number;      // best after this attempt
  isNewBest?: boolean;
  processedAt?: Timestamp;
  rejectionReason?: string;       // when status='rejected'
}
```

`boothBattleScores/{siteId}_{slug(visitorName)}` — derived state, read-only to clients:

```ts
interface BoothBattleScore {
  orgId: 'vD4x5sGreTsscAp66FgA';
  siteId: string;
  visitorName: string;
  visitorNameKey: string;
  bestScore: number;              // multiples of 50
  bestKeywords: string[];         // keywords from the best attempt (variable length)
  bestSubmittedAt: Timestamp;     // tie-breaker
  latestScore: number;
  latestKeywords: string[];
  latestSubmittedAt: Timestamp;
  attemptCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Validation enforced at three layers** (defense in depth):

| Layer | Rule |
|---|---|
| Client (`BoothBattleService.submitAttempt`) | `submittedKeywords.length` ∈ [1, 100]; `visitorEmail` non-empty, ≤200 chars (zod `.email()` enforces shape in form) |
| Firestore rules (`firestore.rules`) | `submittedKeywords.size() >= 1 && <= 100`; `visitorEmail` is string, 1-200 chars, matches `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
| Cloud Function (`boothBattleScoring.ts`) | `submittedKeywords.length` ∈ [`MIN_KEYWORDS`=1, `MAX_KEYWORDS`=100] — else rejects with "Invalid submission payload." (Email is not re-validated server-side; rules already guarantee it.) |

**Privacy note.** Email is collected on the submission but **not** copied to `boothBattleScores`, which is the publicly-readable leaderboard doc. Submission docs themselves are now `get`-by-ID only — the `list` permission was revoked when emails were added (2026-04-25), so the public can no longer enumerate the submissions collection to harvest emails. Visitors with their own submission doc ID can still listen for the scored result via `onSnapshot`.

Identity key for derived `boothBattleScores`: `(siteId, slug(visitorName))`. Retakes are allowed; one score doc per identity holds best + latest. Tie-breaker = earliest `bestSubmittedAt` (the moment the high score was first achieved).

---

## 6. Out of Scope

The following are explicitly **not** part of this work and should not be built:

- Authentication for visitors (anyone can submit keywords from any device).
- Penalties for wrong keywords.
- Cross-org leaderboards (only `vD4x5sGreTsscAp66FgA` participates).
- Persistent leaderboard after the competition — data may be wiped post-event.

---

## 7. Open Questions

1. Should visitors see their own score immediately after submitting, or only see it appear on the public leaderboard?
2. Should keyword matching allow partial matches (e.g., "robot" matches "robotics") or require exact normalized matches only?
3. What happens if two visitors from the same booth submit different keywords? Both scores are kept independently? (Current spec assumes yes.)

These should be resolved before Wednesday morning.

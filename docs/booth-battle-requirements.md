# Requirements: Booth Battle Mode — ArchePal

**Project:** FLL 2026 World Championship · Houston
**Org:** First Championship Houston (`vD4x5sGreTsscAp66FgA`)
**Target ship date:** Wednesday, competition day 1
**Status:** New functionality

---

## 1. Overview

Booth Battle is a competitive add-on to ArchePal that turns the existing Sites and Diary functionality into a multi-team scoring game for the FLL 2026 Championship. Each of the 160 sites under the org `First Championship Houston` represents a competing team's booth.

The game flow is:

1. Our team members visit each booth on the floor, photograph it, and record **5 unique keywords** describing that booth using the existing Diary feature.
2. When a member of another team visits **our** booth, they are asked to submit 5 keywords describing **their own** booth.
3. We compare their submitted keywords to the keywords we recorded for that booth. **Each match scores 50 points.** Maximum score per visiting team: **250 points**.
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

## 3. Feature 2 — Visitor Keyword Submission Form

A new form available from the Create flow (or a direct deep link from the booth host's device) that lets a visiting team member submit their 5 keywords.

> **Availability:** Gated by §2. This form, its entry points, and its API endpoint are only present, reachable, and functional when the active org is `vD4x5sGreTsscAp66FgA`.

### 3.1 Form fields

| # | Field | Type | Required | Notes |
|---|---|---|---|---|
| 1 | **Site Name** | Dropdown / Searchable Select | Yes | Populated with all 160 sites under org `vD4x5sGreTsscAp66FgA`. Display format: `Booth ID — Site Name` (e.g., `C25 — Brick Builders`). |
| 2 | **Your Name** | Text | Yes | Free text. Used for display on leaderboard and audit. |
| 3 | **Keyword 1** | Text | Yes | Single word or short phrase. |
| 4 | **Keyword 2** | Text | Yes | Single word or short phrase. |
| 5 | **Keyword 3** | Text | Yes | Single word or short phrase. |
| 6 | **Keyword 4** | Text | Yes | Single word or short phrase. |
| 7 | **Keyword 5** | Text | Yes | Single word or short phrase. |

### 3.2 Behavior

- The Site Name dropdown is the **visitor's own booth** — i.e., the booth they came from. Visitors should not be able to submit keywords for someone else's site.
- All 5 keyword fields are required to submit. The submit button is disabled until all are filled.
- Keywords are normalized on submit: trimmed, lowercased, and stripped of punctuation before being compared to our recorded keywords. Display, however, preserves the original casing.
- Duplicate submissions for the same `(site, your name)` pair should overwrite the previous entry rather than create a new one — prevents people from gaming the scoring by submitting multiple times.

### 3.3 Scoring logic on submit

```
recorded_keywords = our team's 5 keywords for this site (from Diary)
submitted_keywords = the 5 keywords just entered in this form

matches = count of submitted_keywords that appear in recorded_keywords
          (case-insensitive, normalized)
score   = matches × 50
```

The resulting `(site, your name, score)` record is persisted and shown on the leaderboard immediately.

### 3.4 Acceptance criteria

- The dropdown lists exactly the 160 sites under `First Championship Houston`, sorted by Booth ID.
- All 7 fields validate before submission.
- A submission immediately appears on the Booth Battle leaderboard (Feature 3).
- Resubmitting from the same person for the same site updates the existing score rather than duplicating.

---

## 4. Feature 3 — Booth Battle Leaderboard Screen

A dedicated screen that displays all submitted scores, sorted by score descending.

> **Availability:** Gated by §2. The leaderboard route, its entry points, and its API endpoint are only present, reachable, and functional when the active org is `vD4x5sGreTsscAp66FgA`.

### 4.1 Screen contents

**Header**
- Title: "Booth Battle"
- Subtitle: "FLL 2026 · Houston"
- Summary stats:
  - Total teams scored
  - Top score
  - Number of perfect 5/5 submissions

**Top 3 podium**
- 1st place: full-width card with gold accent
- 2nd & 3rd place: side-by-side cards with silver and bronze accents

**Full ranked list**
- All other entries below the podium
- Each row displays:
  - Rank
  - **Team / Site Name** (combined: `Booth ID — Team Name`)
  - Visitor's name (smaller, secondary)
  - Keywords matched indicator (5 dots, filled/unfilled)
  - Total score
  - `PERFECT` badge if score is 250

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

### 5.2 Recorded keywords (existing field, displayed per §2 and matched against submissions per §3)

Each site under the Booth Battle org has 5 keywords stored as part of the Diary entry our team made when visiting that booth. No schema change required — we are already using the existing description / keyword field.

### 5.3 Score submission (new)

```
{
  id: string,
  org_id: "vD4x5sGreTsscAp66FgA",
  site_id: string,                 // foreign key to Site
  visitor_name: string,
  submitted_keywords: [string × 5],
  matches: number,                 // 0–5
  score: number,                   // matches × 50
  submitted_at: timestamp,
  updated_at: timestamp
}
```

Unique constraint: `(site_id, visitor_name)` — enforces the overwrite-on-duplicate behavior from §3.2.

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

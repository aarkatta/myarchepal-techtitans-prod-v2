# Booth Battle — Implementation Plan

**Spec:** `docs/booth-battle-requirements.md`
**Org:** First Championship Houston (`vD4x5sGreTsscAp66FgA`)
**Target ship:** Wednesday, FLL 2026 World Championship · Houston

---

## Locked decisions

1. **Site naming** — display bare site name (`"C1"`, `"C25"`). No `"Booth ID — Team Name"` pattern. Team names are literally `C1`…`C160`.
2. **Real-time** — Firestore `onSnapshot` (not polling).
3. **Keyword matching** — exact normalized match only. No partial matches.
4. **Retakes** — visitors may submit any number of times. **Keep the highest score.** Submit screen shows previous best vs. this attempt.
5. **No auth** — submission and leaderboard pages are public. Must work **embedded inside an iframe** on team websites.
6. **Timezone** — display in `America/Chicago` (CDT in April 2026). Storage stays UTC.
7. **Scoring runs on the server** — clients never compute or write the final score. They write a submission; a Cloud Function reads recorded keywords (admin SDK), computes the score, and writes both back.

---

## Architecture — server-side scoring

The flow, end to end:

```
1. Visitor submits form on /booth-battle/submit (anonymous, possibly in iframe)
            │
            ▼
2. Client writes boothBattleSubmissions/{auto-id} with status='pending'
       Firestore rules validate:
         · orgId == 'vD4x5sGreTsscAp66FgA'
         · status == 'pending'
         · payload shape (siteId, visitorName, exactly 5 keywords)
         · NO pre-populated score / matches / bestScore fields
            │
            ▼
3. processBoothBattleSubmission trigger fires (onDocumentCreated)
       · reads recorded keywords via Admin SDK (bypasses rules)
       · DigitalDiary where siteId == this AND keywords != null
         ORDER BY keywordsExtractedAt desc LIMIT 1
       · computes matches = count of submittedKeywords ∩ recordedKeywords
         (normalized, exact)
       · score = matches × 50
            │
            ▼
4. Trigger UPSERTS boothBattleScores/{siteId}_{slug(visitorName)}
   inside a transaction:
       · read existing doc → capture previousBestScore (0 if first attempt)
       · always update latest* fields and increment attemptCount
       · update best* fields only if newScore > existing bestScore
            │
            ▼
5. In the same transaction, trigger writes back to the submission doc:
       status='scored', matches, score,
       previousBestScore, currentBestScore, isNewBest, processedAt
   (or status='rejected' + rejectionReason if no recorded keywords)
            │
            ▼
6. Client's onSnapshot on its own submission doc fires when
   status flips 'pending' → 'scored' / 'rejected'
            │
            ▼
7. Client renders the result card:
       "Previous best: 150 · This attempt: 200 · 🎉 New best!"
   (or "Best stays at 250" / "No recorded keywords yet — try later")

Leaderboard page (separate route) reads boothBattleScores via onSnapshot.
```

**Why this shape:** the score is uncheatable. The client only ever asks "score this for me" — it cannot fabricate a 250 by writing directly to `boothBattleScores` (rules block all client writes there) and it cannot pre-populate score fields on the submission (rules reject those keys on create). The submission doc doubles as audit log AND result-delivery channel — a single doc the client listens to.

---

## Data model

### `boothBattleSubmissions/{auto-id}` — write-once request, read by submitter

```ts
interface BoothBattleSubmission {
  // Set by client on create:
  orgId: 'vD4x5sGreTsscAp66FgA';
  siteId: string;                 // visitor's own booth
  visitorName: string;            // free text, original casing
  submittedKeywords: string[];    // exactly 5
  status: 'pending';              // becomes 'scored' or 'rejected' after processing
  clientSubmittedAt: Timestamp;   // server timestamp at create time

  // Filled by Cloud Function:
  matches?: number;               // 0–5
  score?: number;                 // matches × 50
  previousBestScore?: number;     // best before this attempt (0 if first)
  currentBestScore?: number;      // best after this attempt
  isNewBest?: boolean;
  processedAt?: Timestamp;
  rejectionReason?: string;       // when status='rejected'
}
```

### `boothBattleScores/{siteId}_{slug(visitorName)}` — derived state, read-only to clients

```ts
interface BoothBattleScore {
  orgId: 'vD4x5sGreTsscAp66FgA';
  siteId: string;
  visitorName: string;            // display casing (from latest submission)
  visitorNameKey: string;         // slugified — lookup key
  bestScore: number;              // 0, 50, 100, 150, 200, 250
  bestKeywords: string[];         // 5 keywords from the best attempt
  bestSubmittedAt: Timestamp;     // tie-breaker
  latestScore: number;
  latestKeywords: string[];
  latestSubmittedAt: Timestamp;
  attemptCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**One doc per `(siteId, visitorName)`:** leaderboard query is `where orgId == ... orderBy bestScore desc, bestSubmittedAt asc` — no aggregation.

**Tie-breaker semantics:** earliest `bestSubmittedAt` wins — *time the best score was first achieved*. Team A who hit 250 on attempt 1 beats Team B who hit 250 on attempt 3.

---

## Firestore rules

```
match /boothBattleSubmissions/{id} {
  allow read:   if true;                                        // visitor reads own doc by ID
  allow create: if request.resource.data.orgId == 'vD4x5sGreTsscAp66FgA'
             && request.resource.data.status == 'pending'
             && request.resource.data.submittedKeywords is list
             && request.resource.data.submittedKeywords.size() == 5
             && request.resource.data.visitorName is string
             && request.resource.data.visitorName.size() > 0
             && request.resource.data.siteId is string
             // Reject pre-populated score fields — only the function may set these.
             && !('score' in request.resource.data)
             && !('matches' in request.resource.data)
             && !('previousBestScore' in request.resource.data)
             && !('currentBestScore' in request.resource.data)
             && !('isNewBest' in request.resource.data)
             && !('processedAt' in request.resource.data)
             && !('rejectionReason' in request.resource.data);
  allow update, delete: if false;                               // function (admin SDK) only
}

match /boothBattleScores/{id} {
  allow read:   if true;                                        // public leaderboard
  allow write:  if false;                                       // function (admin SDK) only
}
```

Public read on submissions is acceptable: no PII beyond a self-chosen visitor name and 5 keywords. Without auth there is no other way for the client to read its own scored result.

---

## Iframe-friendly rendering

- `/booth-battle/submit` and `/booth-battle` render with **no `AppHeader`, no `BottomNav`** — bare page chrome.
- `vercel.json` headers: `Content-Security-Policy: frame-ancestors *` for `/booth-battle/*`. Remove any `X-Frame-Options: DENY`.
- Pages do not call `useUser()` in a render-blocking way — visitors are anonymous.
- Mobile-first layout (390×844 baseline).

---

## Phase breakdown

### Phase 0 — Foundation (~30 min)

| Task | File |
|---|---|
| `isBoothBattleOrg`, `normalizeKeyword`, `slugifyName`, `formatHoustonTime` helpers | `src/lib/boothBattle.ts` |
| `BoothBattleSubmission`, `BoothBattleScore` interfaces | `src/types/boothBattle.ts` |
| Firestore rules: submissions create-only with payload constraints; scores read-only | `firestore.rules` |
| Composite index: `boothBattleScores` ordered by `orgId asc, bestScore desc, bestSubmittedAt asc` | `firestore.indexes.json` |
| `frame-ancestors *` for `/booth-battle/*` | `vercel.json` |

### Phase 1 — Keyword Display Gating (~45 min)

Wrap every keyword surface with `isBoothBattleOrg(organization?.id)`:

- `src/pages/SiteDetails.tsx` — keyword chip row on site detail
- `src/pages/DigitalDiary.tsx` — keyword chips on diary entry cards
- `src/pages/SiteLists.tsx` — keyword snippets in list view (if any)
- Any export / share / print path

For non-Booth-Battle orgs, keywords are **not rendered at all** (no DOM presence per §2.4). Data is preserved server-side.

### Phase 2 — Scoring Cloud Function (~1.5h)

| Task | File |
|---|---|
| `processBoothBattleSubmission` v2 trigger on `boothBattleSubmissions/{id}` onDocumentCreated | `functions/src/processBoothBattleSubmission.ts` |
| Validate payload, look up recorded keywords from `DigitalDiary`, normalize-match, transactional write to both collections | same |
| Re-export from index | `functions/src/index.ts` |

**Recorded-keywords lookup:** query `DigitalDiary` where `siteId == event.data.siteId` AND `keywords` is non-empty, ORDER BY `keywordsExtractedAt desc` LIMIT 1. Normalized exact match against `submittedKeywords`. If no recorded entry exists yet → `status="rejected"`, `rejectionReason="No recorded keywords for this booth yet."`

**Idempotency:** trigger is `onDocumentCreated` so it fires exactly once per submission. Function checks `status === 'pending'` before processing.

**Region:** `us-central1` (matches `extractDiaryKeywords`).

### Phase 3 — Visitor Submission Form (~2h)

| Task | File |
|---|---|
| Service: `listBoothBattleSites`, `submitBoothBattleAttempt(payload) → submissionDocRef` | `src/services/boothBattle.ts` |
| Submission page (chromeless, react-hook-form + zod) | `src/pages/BoothBattleSubmit.tsx` |
| Searchable site picker — natural sort so `C2 < C19` | inside page |
| After submit: `onSnapshot(submissionDocRef)` → wait for `status !== 'pending'` (with timeout fallback) | inside page |
| Result card: previous best, this attempt, current best, "🎉 New best!" or "Best stays at 250" + Submit Another CTA | inside page |
| Reject card if `status='rejected'` (no recorded keywords yet) | inside page |
| Route `/booth-battle/submit` (no auth wrapper; internal redirect if non-target org session) | `src/App.tsx` |

### Phase 4 — Leaderboard Screen (~2h)

| Task | File |
|---|---|
| Leaderboard page (chromeless, real-time `onSnapshot` on `boothBattleScores` for the org) | `src/pages/BoothBattleLeaderboard.tsx` |
| Stats header — total players, top score, perfect-5/5 count (derived live from snapshot) | inside page |
| Top-3 podium component | `src/components/boothBattle/Podium.tsx` |
| Ranked list: rank, site name, visitor, 5 keyword dots, score, `↑` retake icon if `latestScore != bestScore`, PERFECT badge if 250 | inside page |
| Houston-tz timestamps via `formatHoustonTime` | inside page |
| Route `/booth-battle` (chromeless) | `src/App.tsx` |

### Phase 5 — Host Controls (~1h)

Visible only when `isAdmin && isBoothBattleOrg`, on a separate authenticated route `/booth-battle/admin` (so iframe-embedded `/booth-battle` never shows them):

- Edit drawer per row — visitor name, keywords (re-scores via the same Cloud Function path: write a new submission tagged as admin override)
- Delete with confirm dialog (admin SDK call via callable function, since rules block client deletes)
- "Reset all" → `AlertDialog` → callable function deletes the entire `boothBattleScores` AND `boothBattleSubmissions` collections

| Task | File |
|---|---|
| Callable function `boothBattleAdminAction` for edit/delete/reset (verifies caller is `ORG_ADMIN` of target org) | `functions/src/boothBattleAdminAction.ts` |
| Admin page | `src/pages/BoothBattleAdmin.tsx` |
| Route `/booth-battle/admin` under `<AdminRoute>` | `src/App.tsx` |

### Phase 6 — Verification (~30 min)

- **End-to-end:** submit from a fresh browser → submission doc lands → function fires → score appears on leaderboard within ~2s
- **Iframe smoke test:** load `/booth-battle/submit` and `/booth-battle` inside `<iframe>` on a sandbox HTML file → render, no `X-Frame-Options` console errors, fonts, taps
- **Retake matrix:** first attempt 0/5, second 5/5 (best updates) → third 3/5 (best holds at 5/5)
- **Tie-breaker:** two perfects, first-try beats retake-perfect
- **Spoofing test:** attempt direct write to `boothBattleScores` from console → rejected by rules
- **Rejection path:** submit for a site that has no Diary entry with keywords → submission rejected, friendly UI message
- **Other-org session** navigating to `/booth-battle` → redirected
- **Mobile viewport** (390×844) — both pages fit

---

## Estimate

**~7.5 hours.** Phase 0 → 5 sequential. Phase 1 can ship before Phase 2.

---

## Out of scope (per spec §6 and decisions)

- Visitor authentication
- Penalties for wrong keywords
- Cross-org leaderboards
- Persistent leaderboard after the event

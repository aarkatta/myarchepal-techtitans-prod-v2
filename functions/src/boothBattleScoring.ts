import * as admin from "firebase-admin";

export const TARGET_ORG_ID = "vD4x5sGreTsscAp66FgA";
export const POINTS_PER_MATCH = 50;
export const MIN_KEYWORDS = 1;
export const MAX_KEYWORDS = 100;

export function normalizeKeyword(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function countMatches(submitted: string[], recorded: string[]): number {
  const recordedSet = new Set(
    recorded.map(normalizeKeyword).filter((k) => k.length > 0),
  );
  const seen = new Set<string>();
  let matches = 0;
  for (const raw of submitted) {
    const n = normalizeKeyword(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    if (recordedSet.has(n)) matches += 1;
  }
  return matches;
}

export type ScoringOutcome =
  | { kind: "scored"; matches: number; score: number; previousBestScore: number; currentBestScore: number; isNewBest: boolean }
  | { kind: "rejected"; reason: string };

/**
 * Scores a single pending submission. Mutates Firestore atomically:
 *  - upserts boothBattleScores/{siteId}_{slug}
 *  - updates the submission doc with status='scored' or 'rejected' + result fields
 * Safe to call multiple times — re-checks status==='pending' inside the
 * transaction and is a no-op for already-processed submissions.
 */
export async function scoreSubmission(
  submissionRef: FirebaseFirestore.DocumentReference,
): Promise<ScoringOutcome | { kind: "skipped"; reason: string }> {
  const db = admin.firestore();
  const snap = await submissionRef.get();
  if (!snap.exists) return { kind: "skipped", reason: "missing" };
  const submission = snap.data() ?? {};

  if (submission.orgId !== TARGET_ORG_ID) {
    return { kind: "skipped", reason: "orgId-mismatch" };
  }
  if (submission.status !== "pending") {
    return { kind: "skipped", reason: `status=${submission.status}` };
  }

  const siteId: string | undefined = submission.siteId;
  const visitorName: string | undefined = submission.visitorName;
  const submittedKeywords: unknown = submission.submittedKeywords;

  if (
    !siteId ||
    !visitorName ||
    !Array.isArray(submittedKeywords) ||
    submittedKeywords.length < MIN_KEYWORDS ||
    submittedKeywords.length > MAX_KEYWORDS
  ) {
    await submissionRef.update({
      status: "rejected",
      rejectionReason: "Invalid submission payload.",
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { kind: "rejected", reason: "Invalid submission payload." };
  }

  const diarySnap = await db
    .collection("DigitalDiary")
    .where("siteId", "==", siteId)
    .orderBy("keywordsExtractedAt", "desc")
    .limit(1)
    .get();

  const noKeywords = diarySnap.empty
    || !Array.isArray(diarySnap.docs[0].data().keywords)
    || diarySnap.docs[0].data().keywords.length === 0;

  if (noKeywords) {
    await submissionRef.update({
      status: "rejected",
      rejectionReason: "No recorded keywords for this booth yet.",
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { kind: "rejected", reason: "No recorded keywords for this booth yet." };
  }

  const recorded = diarySnap.docs[0].data().keywords as unknown[];
  const submittedAsStrings = submittedKeywords.map((k) => String(k ?? ""));
  const recordedAsStrings = recorded.map((k) => String(k ?? ""));
  const matches = countMatches(submittedAsStrings, recordedAsStrings);
  const score = matches * POINTS_PER_MATCH;

  const slug = slugifyName(visitorName);
  if (!slug) {
    await submissionRef.update({
      status: "rejected",
      rejectionReason: "Invalid visitor name.",
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { kind: "rejected", reason: "Invalid visitor name." };
  }

  const scoreDocId = `${siteId}_${slug}`;
  const scoreRef = db.collection("boothBattleScores").doc(scoreDocId);

  const now = admin.firestore.Timestamp.now();
  const submittedAt: admin.firestore.Timestamp =
    submission.clientSubmittedAt instanceof admin.firestore.Timestamp
      ? submission.clientSubmittedAt
      : now;

  let outcome: ScoringOutcome = {
    kind: "scored",
    matches,
    score,
    previousBestScore: 0,
    currentBestScore: score,
    isNewBest: true,
  };

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(submissionRef);
    if (!fresh.exists || fresh.data()?.status !== "pending") {
      outcome = {
        kind: "rejected",
        reason: "submission already processed",
      };
      return;
    }

    const existing = await tx.get(scoreRef);
    const previousBestScore = existing.exists
      ? Number(existing.data()?.bestScore ?? 0)
      : 0;
    const previousAttemptCount = existing.exists
      ? Number(existing.data()?.attemptCount ?? 0)
      : 0;
    const isNewBest = !existing.exists || score > previousBestScore;
    const currentBestScore = isNewBest ? score : previousBestScore;

    const baseUpdate: Record<string, unknown> = {
      orgId: TARGET_ORG_ID,
      siteId,
      visitorName,
      visitorNameKey: slug,
      latestScore: score,
      latestKeywords: submittedAsStrings,
      latestSubmittedAt: submittedAt,
      attemptCount: previousAttemptCount + 1,
      updatedAt: now,
    };

    if (!existing.exists) {
      baseUpdate.createdAt = now;
      baseUpdate.bestScore = score;
      baseUpdate.bestKeywords = submittedAsStrings;
      baseUpdate.bestSubmittedAt = submittedAt;
    } else if (isNewBest) {
      baseUpdate.bestScore = score;
      baseUpdate.bestKeywords = submittedAsStrings;
      baseUpdate.bestSubmittedAt = submittedAt;
    }

    tx.set(scoreRef, baseUpdate, { merge: true });
    tx.update(submissionRef, {
      status: "scored",
      matches,
      score,
      previousBestScore,
      currentBestScore,
      isNewBest,
      processedAt: now,
    });

    outcome = {
      kind: "scored",
      matches,
      score,
      previousBestScore,
      currentBestScore,
      isNewBest,
    };
  });

  return outcome;
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_KEYWORDS = exports.MIN_KEYWORDS = exports.POINTS_PER_MATCH = exports.TARGET_ORG_ID = void 0;
exports.normalizeKeyword = normalizeKeyword;
exports.slugifyName = slugifyName;
exports.countMatches = countMatches;
exports.scoreSubmission = scoreSubmission;
const admin = __importStar(require("firebase-admin"));
exports.TARGET_ORG_ID = "vD4x5sGreTsscAp66FgA";
exports.POINTS_PER_MATCH = 50;
exports.MIN_KEYWORDS = 1;
exports.MAX_KEYWORDS = 100;
function normalizeKeyword(input) {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function slugifyName(input) {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}
function countMatches(submitted, recorded) {
    const recordedSet = new Set(recorded.map(normalizeKeyword).filter((k) => k.length > 0));
    const seen = new Set();
    let matches = 0;
    for (const raw of submitted) {
        const n = normalizeKeyword(raw);
        if (!n || seen.has(n))
            continue;
        seen.add(n);
        if (recordedSet.has(n))
            matches += 1;
    }
    return matches;
}
/**
 * Scores a single pending submission. Mutates Firestore atomically:
 *  - upserts boothBattleScores/{siteId}_{slug}
 *  - updates the submission doc with status='scored' or 'rejected' + result fields
 * Safe to call multiple times — re-checks status==='pending' inside the
 * transaction and is a no-op for already-processed submissions.
 */
async function scoreSubmission(submissionRef) {
    const db = admin.firestore();
    const snap = await submissionRef.get();
    if (!snap.exists)
        return { kind: "skipped", reason: "missing" };
    const submission = snap.data() ?? {};
    if (submission.orgId !== exports.TARGET_ORG_ID) {
        return { kind: "skipped", reason: "orgId-mismatch" };
    }
    if (submission.status !== "pending") {
        return { kind: "skipped", reason: `status=${submission.status}` };
    }
    const siteId = submission.siteId;
    const visitorName = submission.visitorName;
    const submittedKeywords = submission.submittedKeywords;
    if (!siteId ||
        !visitorName ||
        !Array.isArray(submittedKeywords) ||
        submittedKeywords.length < exports.MIN_KEYWORDS ||
        submittedKeywords.length > exports.MAX_KEYWORDS) {
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
    const recorded = diarySnap.docs[0].data().keywords;
    const submittedAsStrings = submittedKeywords.map((k) => String(k ?? ""));
    const recordedAsStrings = recorded.map((k) => String(k ?? ""));
    const matches = countMatches(submittedAsStrings, recordedAsStrings);
    const score = matches * exports.POINTS_PER_MATCH;
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
    const submittedAt = submission.clientSubmittedAt instanceof admin.firestore.Timestamp
        ? submission.clientSubmittedAt
        : now;
    let outcome = {
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
        const baseUpdate = {
            orgId: exports.TARGET_ORG_ID,
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
        }
        else if (isNewBest) {
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
//# sourceMappingURL=boothBattleScoring.js.map
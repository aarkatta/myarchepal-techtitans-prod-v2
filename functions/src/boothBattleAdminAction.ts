import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import {
  scoreSubmission,
  slugifyName,
  TARGET_ORG_ID,
  MIN_KEYWORDS,
  MAX_KEYWORDS,
} from "./boothBattleScoring";

interface EditPayload {
  action: "edit";
  scoreId: string;
  visitorName: string;
  submittedKeywords: string[];
}

interface DeletePayload {
  action: "delete";
  scoreId: string;
}

interface ResetPayload {
  action: "reset";
}

interface ReprocessPayload {
  action: "reprocess";
}

type ActionPayload = EditPayload | DeletePayload | ResetPayload | ReprocessPayload;

async function assertCallerIsBoothBattleAdmin(uid: string): Promise<void> {
  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User not found.");
  }
  const data = userSnap.data() ?? {};
  const role = String(data.role ?? "");
  if (role !== "SUPER_ADMIN" && role !== "ORG_ADMIN") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
  if (role !== "SUPER_ADMIN" && data.organizationId !== TARGET_ORG_ID) {
    throw new HttpsError(
      "permission-denied",
      "You can only manage your own organization.",
    );
  }
}

async function deleteCollectionInBatches(
  collectionPath: string,
  batchSize = 250,
): Promise<number> {
  const db = admin.firestore();
  const ref = db.collection(collectionPath);
  let totalDeleted = 0;
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    totalDeleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return totalDeleted;
}

export const boothBattleAdminAction = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const callerUid = request.auth.uid;
    await assertCallerIsBoothBattleAdmin(callerUid);

    const payload = request.data as ActionPayload | undefined;
    if (!payload || typeof payload.action !== "string") {
      throw new HttpsError("invalid-argument", "Missing action.");
    }

    const db = admin.firestore();

    if (payload.action === "delete") {
      if (!payload.scoreId) {
        throw new HttpsError("invalid-argument", "scoreId required.");
      }
      const ref = db.collection("boothBattleScores").doc(payload.scoreId);
      const snap = await ref.get();
      if (!snap.exists) {
        return { ok: true, deleted: 0 };
      }
      if (snap.data()?.orgId !== TARGET_ORG_ID) {
        throw new HttpsError(
          "permission-denied",
          "Score does not belong to this org.",
        );
      }
      await ref.delete();
      logger.info(`[admin ${callerUid}] deleted score ${payload.scoreId}`);
      return { ok: true, deleted: 1 };
    }

    if (payload.action === "edit") {
      if (!payload.scoreId) {
        throw new HttpsError("invalid-argument", "scoreId required.");
      }
      if (
        !payload.visitorName ||
        !Array.isArray(payload.submittedKeywords) ||
        payload.submittedKeywords.length < MIN_KEYWORDS ||
        payload.submittedKeywords.length > MAX_KEYWORDS
      ) {
        throw new HttpsError(
          "invalid-argument",
          `visitorName and ${MIN_KEYWORDS}-${MAX_KEYWORDS} keywords required.`,
        );
      }
      const visitorName = String(payload.visitorName).trim();
      if (!visitorName) {
        throw new HttpsError("invalid-argument", "visitorName required.");
      }
      const keywords = payload.submittedKeywords.map((k) =>
        String(k ?? "").trim(),
      );
      if (keywords.some((k) => k.length === 0)) {
        throw new HttpsError("invalid-argument", "Keywords cannot be empty.");
      }

      const oldRef = db.collection("boothBattleScores").doc(payload.scoreId);
      const oldSnap = await oldRef.get();
      if (!oldSnap.exists) {
        throw new HttpsError("not-found", "Score not found.");
      }
      const oldData = oldSnap.data() ?? {};
      if (oldData.orgId !== TARGET_ORG_ID) {
        throw new HttpsError(
          "permission-denied",
          "Score does not belong to this org.",
        );
      }
      const siteId = String(oldData.siteId ?? "");
      if (!siteId) {
        throw new HttpsError("failed-precondition", "Score missing siteId.");
      }

      // Wipe the old derived score so the trigger can build a fresh one
      // (clean attemptCount=1 view of the corrected entry).
      await oldRef.delete();

      // If the slug changed, also delete the new-slug doc if one exists
      // so the trigger doesn't merge with an unrelated entry.
      const newSlug = slugifyName(visitorName);
      if (!newSlug) {
        throw new HttpsError("invalid-argument", "visitorName invalid.");
      }
      const newScoreId = `${siteId}_${newSlug}`;
      if (newScoreId !== payload.scoreId) {
        const newRef = db.collection("boothBattleScores").doc(newScoreId);
        const newExisting = await newRef.get();
        if (newExisting.exists && newExisting.data()?.orgId === TARGET_ORG_ID) {
          await newRef.delete();
        }
      }

      // Write a fresh pending submission. The trigger will score it and
      // produce a new boothBattleScores doc.
      await db.collection("boothBattleSubmissions").add({
        orgId: TARGET_ORG_ID,
        siteId,
        visitorName,
        submittedKeywords: keywords,
        status: "pending",
        clientSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        adminEditBy: callerUid,
      });

      logger.info(
        `[admin ${callerUid}] edited score ${payload.scoreId} → ${newScoreId}`,
      );
      return { ok: true, newScoreId };
    }

    if (payload.action === "reset") {
      const submissionsDeleted = await deleteCollectionInBatches(
        "boothBattleSubmissions",
      );
      const scoresDeleted = await deleteCollectionInBatches(
        "boothBattleScores",
      );
      logger.warn(
        `[admin ${callerUid}] RESET booth battle: deleted ${submissionsDeleted} submissions, ${scoresDeleted} scores`,
      );
      return { ok: true, submissionsDeleted, scoresDeleted };
    }

    if (payload.action === "reprocess") {
      const pendingSnap = await db
        .collection("boothBattleSubmissions")
        .where("orgId", "==", TARGET_ORG_ID)
        .where("status", "==", "pending")
        .get();

      let scored = 0;
      let rejected = 0;
      let skipped = 0;
      for (const doc of pendingSnap.docs) {
        try {
          const result = await scoreSubmission(doc.ref);
          if (result.kind === "scored") scored += 1;
          else if (result.kind === "rejected") rejected += 1;
          else skipped += 1;
        } catch (err) {
          logger.error(`[reprocess ${doc.id}] failed`, err);
          skipped += 1;
        }
      }
      logger.info(
        `[admin ${callerUid}] reprocess: scored=${scored} rejected=${rejected} skipped=${skipped} of ${pendingSnap.size}`,
      );
      return { ok: true, scored, rejected, skipped, total: pendingSnap.size };
    }

    throw new HttpsError("invalid-argument", "Unknown action.");
  },
);

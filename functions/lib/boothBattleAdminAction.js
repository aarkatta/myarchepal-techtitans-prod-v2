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
exports.boothBattleAdminAction = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const admin = __importStar(require("firebase-admin"));
const boothBattleScoring_1 = require("./boothBattleScoring");
async function assertCallerIsBoothBattleAdmin(uid) {
    const db = admin.firestore();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("permission-denied", "User not found.");
    }
    const data = userSnap.data() ?? {};
    const role = String(data.role ?? "");
    if (role !== "SUPER_ADMIN" && role !== "ORG_ADMIN") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    if (role !== "SUPER_ADMIN" && data.organizationId !== boothBattleScoring_1.TARGET_ORG_ID) {
        throw new https_1.HttpsError("permission-denied", "You can only manage your own organization.");
    }
}
async function deleteCollectionInBatches(collectionPath, batchSize = 250) {
    const db = admin.firestore();
    const ref = db.collection(collectionPath);
    let totalDeleted = 0;
    while (true) {
        const snap = await ref.limit(batchSize).get();
        if (snap.empty)
            break;
        const batch = db.batch();
        for (const doc of snap.docs)
            batch.delete(doc.ref);
        await batch.commit();
        totalDeleted += snap.size;
        if (snap.size < batchSize)
            break;
    }
    return totalDeleted;
}
exports.boothBattleAdminAction = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    }
    const callerUid = request.auth.uid;
    await assertCallerIsBoothBattleAdmin(callerUid);
    const payload = request.data;
    if (!payload || typeof payload.action !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Missing action.");
    }
    const db = admin.firestore();
    if (payload.action === "delete") {
        if (!payload.scoreId) {
            throw new https_1.HttpsError("invalid-argument", "scoreId required.");
        }
        const ref = db.collection("boothBattleScores").doc(payload.scoreId);
        const snap = await ref.get();
        if (!snap.exists) {
            return { ok: true, deleted: 0 };
        }
        if (snap.data()?.orgId !== boothBattleScoring_1.TARGET_ORG_ID) {
            throw new https_1.HttpsError("permission-denied", "Score does not belong to this org.");
        }
        await ref.delete();
        firebase_functions_1.logger.info(`[admin ${callerUid}] deleted score ${payload.scoreId}`);
        return { ok: true, deleted: 1 };
    }
    if (payload.action === "edit") {
        if (!payload.scoreId) {
            throw new https_1.HttpsError("invalid-argument", "scoreId required.");
        }
        if (!payload.visitorName ||
            !Array.isArray(payload.submittedKeywords) ||
            payload.submittedKeywords.length < boothBattleScoring_1.MIN_KEYWORDS ||
            payload.submittedKeywords.length > boothBattleScoring_1.MAX_KEYWORDS) {
            throw new https_1.HttpsError("invalid-argument", `visitorName and ${boothBattleScoring_1.MIN_KEYWORDS}-${boothBattleScoring_1.MAX_KEYWORDS} keywords required.`);
        }
        const visitorName = String(payload.visitorName).trim();
        if (!visitorName) {
            throw new https_1.HttpsError("invalid-argument", "visitorName required.");
        }
        const keywords = payload.submittedKeywords.map((k) => String(k ?? "").trim());
        if (keywords.some((k) => k.length === 0)) {
            throw new https_1.HttpsError("invalid-argument", "Keywords cannot be empty.");
        }
        const oldRef = db.collection("boothBattleScores").doc(payload.scoreId);
        const oldSnap = await oldRef.get();
        if (!oldSnap.exists) {
            throw new https_1.HttpsError("not-found", "Score not found.");
        }
        const oldData = oldSnap.data() ?? {};
        if (oldData.orgId !== boothBattleScoring_1.TARGET_ORG_ID) {
            throw new https_1.HttpsError("permission-denied", "Score does not belong to this org.");
        }
        const siteId = String(oldData.siteId ?? "");
        if (!siteId) {
            throw new https_1.HttpsError("failed-precondition", "Score missing siteId.");
        }
        // Wipe the old derived score so the trigger can build a fresh one
        // (clean attemptCount=1 view of the corrected entry).
        await oldRef.delete();
        // If the slug changed, also delete the new-slug doc if one exists
        // so the trigger doesn't merge with an unrelated entry.
        const newSlug = (0, boothBattleScoring_1.slugifyName)(visitorName);
        if (!newSlug) {
            throw new https_1.HttpsError("invalid-argument", "visitorName invalid.");
        }
        const newScoreId = `${siteId}_${newSlug}`;
        if (newScoreId !== payload.scoreId) {
            const newRef = db.collection("boothBattleScores").doc(newScoreId);
            const newExisting = await newRef.get();
            if (newExisting.exists && newExisting.data()?.orgId === boothBattleScoring_1.TARGET_ORG_ID) {
                await newRef.delete();
            }
        }
        // Write a fresh pending submission. The trigger will score it and
        // produce a new boothBattleScores doc.
        await db.collection("boothBattleSubmissions").add({
            orgId: boothBattleScoring_1.TARGET_ORG_ID,
            siteId,
            visitorName,
            submittedKeywords: keywords,
            status: "pending",
            clientSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
            adminEditBy: callerUid,
        });
        firebase_functions_1.logger.info(`[admin ${callerUid}] edited score ${payload.scoreId} → ${newScoreId}`);
        return { ok: true, newScoreId };
    }
    if (payload.action === "reset") {
        const submissionsDeleted = await deleteCollectionInBatches("boothBattleSubmissions");
        const scoresDeleted = await deleteCollectionInBatches("boothBattleScores");
        firebase_functions_1.logger.warn(`[admin ${callerUid}] RESET booth battle: deleted ${submissionsDeleted} submissions, ${scoresDeleted} scores`);
        return { ok: true, submissionsDeleted, scoresDeleted };
    }
    if (payload.action === "reprocess") {
        const pendingSnap = await db
            .collection("boothBattleSubmissions")
            .where("orgId", "==", boothBattleScoring_1.TARGET_ORG_ID)
            .where("status", "==", "pending")
            .get();
        let scored = 0;
        let rejected = 0;
        let skipped = 0;
        for (const doc of pendingSnap.docs) {
            try {
                const result = await (0, boothBattleScoring_1.scoreSubmission)(doc.ref);
                if (result.kind === "scored")
                    scored += 1;
                else if (result.kind === "rejected")
                    rejected += 1;
                else
                    skipped += 1;
            }
            catch (err) {
                firebase_functions_1.logger.error(`[reprocess ${doc.id}] failed`, err);
                skipped += 1;
            }
        }
        firebase_functions_1.logger.info(`[admin ${callerUid}] reprocess: scored=${scored} rejected=${rejected} skipped=${skipped} of ${pendingSnap.size}`);
        return { ok: true, scored, rejected, skipped, total: pendingSnap.size };
    }
    throw new https_1.HttpsError("invalid-argument", "Unknown action.");
});
//# sourceMappingURL=boothBattleAdminAction.js.map
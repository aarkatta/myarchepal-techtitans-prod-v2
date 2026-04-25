"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBoothBattleSubmission = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const boothBattleScoring_1 = require("./boothBattleScoring");
/**
 * Triggered on creation of `boothBattleSubmissions/{id}`.
 * Delegates to the shared `scoreSubmission` helper so the same logic is
 * reused by the admin reprocess action.
 */
exports.processBoothBattleSubmission = (0, firestore_1.onDocumentCreated)({
    document: "boothBattleSubmissions/{submissionId}",
    region: "us-central1",
}, async (event) => {
    const submissionId = event.params.submissionId;
    const snap = event.data;
    if (!snap) {
        firebase_functions_1.logger.warn(`[${submissionId}] no snapshot — skip`);
        return;
    }
    const result = await (0, boothBattleScoring_1.scoreSubmission)(snap.ref);
    firebase_functions_1.logger.info(`[${submissionId}] ${JSON.stringify(result)}`);
});
//# sourceMappingURL=processBoothBattleSubmission.js.map
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { scoreSubmission } from "./boothBattleScoring";

/**
 * Triggered on creation of `boothBattleSubmissions/{id}`.
 * Delegates to the shared `scoreSubmission` helper so the same logic is
 * reused by the admin reprocess action.
 */
export const processBoothBattleSubmission = onDocumentCreated(
  {
    document: "boothBattleSubmissions/{submissionId}",
    region: "us-central1",
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const snap = event.data;
    if (!snap) {
      logger.warn(`[${submissionId}] no snapshot — skip`);
      return;
    }
    const result = await scoreSubmission(snap.ref);
    logger.info(`[${submissionId}] ${JSON.stringify(result)}`);
  },
);

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  Timestamp,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import firebaseApp from '@/lib/firebase';
import {
  BOOTH_BATTLE_ORG_ID,
  type BoothBattleSubmission,
} from '@/types/boothBattle';
import { naturalSiteCompare } from '@/lib/boothBattle';

export interface BoothBattleSiteOption {
  id: string;
  name: string;
}

export interface SubmitBoothBattlePayload {
  siteId: string;
  visitorName: string;
  visitorEmail: string;
  submittedKeywords: string[];
}

export class BoothBattleService {
  /**
   * Lists all sites belonging to the booth-battle org, sorted naturally
   * (so "C2" precedes "C19"). Returns the bare display name.
   */
  static async listSites(): Promise<BoothBattleSiteOption[]> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const q = query(
      collection(db, 'Sites'),
      where('organizationId', '==', BOOTH_BATTLE_ORG_ID),
    );
    const snap = await getDocs(q);
    const sites: BoothBattleSiteOption[] = snap.docs
      .map((d) => {
        const data = d.data() as { name?: string; status?: string };
        return {
          id: d.id,
          name: String(data.name ?? '').trim(),
          status: data.status,
        };
      })
      .filter((s) => s.name.length > 0 && s.status !== 'archived')
      .map(({ id, name }) => ({ id, name }));
    sites.sort((a, b) => naturalSiteCompare(a.name, b.name));
    return sites;
  }

  /**
   * Writes a pending submission. Score fields are NOT included — Firestore
   * rules reject any pre-populated score keys. The Cloud Function trigger
   * computes and writes the result.
   */
  static async submitAttempt(
    payload: SubmitBoothBattlePayload,
  ): Promise<DocumentReference> {
    if (!db) throw new Error('Firebase is not properly initialized');
    if (payload.submittedKeywords.length < 1) {
      throw new Error('Add at least one keyword.');
    }
    if (payload.submittedKeywords.length > 100) {
      throw new Error('Up to 100 keywords allowed.');
    }
    const trimmedName = payload.visitorName.trim();
    if (!trimmedName) {
      throw new Error('Visitor name is required.');
    }
    const trimmedEmail = payload.visitorEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      throw new Error('Email is required.');
    }
    if (trimmedEmail.length > 200) {
      throw new Error('Email is too long.');
    }
    if (!payload.siteId) {
      throw new Error('Booth selection is required.');
    }

    const submission: Omit<BoothBattleSubmission, 'id'> = {
      orgId: BOOTH_BATTLE_ORG_ID,
      siteId: payload.siteId,
      visitorName: trimmedName,
      visitorEmail: trimmedEmail,
      submittedKeywords: payload.submittedKeywords.map((k) => k.trim()),
      status: 'pending',
      // Use server timestamp so Firestore validates clock authoritatively.
      clientSubmittedAt: serverTimestamp() as unknown as Timestamp,
    };

    return await addDoc(collection(db, 'boothBattleSubmissions'), submission);
  }

  /** Builds a DocumentReference for a submission id (used by listeners). */
  static submissionRef(submissionId: string): DocumentReference {
    if (!db) throw new Error('Firebase is not properly initialized');
    return doc(db, 'boothBattleSubmissions', submissionId);
  }

  // ---- Admin actions (callable function) ----

  private static getCallable() {
    if (!firebaseApp) throw new Error('Firebase is not properly initialized');
    const fns = getFunctions(firebaseApp, 'us-central1');
    return httpsCallable<unknown, AdminActionResult>(
      fns,
      'boothBattleAdminAction',
    );
  }

  static async adminEditScore(
    scoreId: string,
    visitorName: string,
    submittedKeywords: string[],
  ): Promise<AdminActionResult> {
    const call = this.getCallable();
    const res = await call({
      action: 'edit',
      scoreId,
      visitorName,
      submittedKeywords,
    });
    return res.data;
  }

  static async adminDeleteScore(scoreId: string): Promise<AdminActionResult> {
    const call = this.getCallable();
    const res = await call({ action: 'delete', scoreId });
    return res.data;
  }

  static async adminResetAll(): Promise<AdminActionResult> {
    const call = this.getCallable();
    const res = await call({ action: 'reset' });
    return res.data;
  }

  static async adminReprocessPending(): Promise<AdminActionResult> {
    const call = this.getCallable();
    const res = await call({ action: 'reprocess' });
    return res.data;
  }
}

export interface AdminActionResult {
  ok: boolean;
  deleted?: number;
  newScoreId?: string;
  submissionsDeleted?: number;
  scoresDeleted?: number;
  scored?: number;
  rejected?: number;
  skipped?: number;
  total?: number;
}

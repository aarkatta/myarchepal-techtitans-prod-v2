import { Timestamp } from 'firebase/firestore';

export const BOOTH_BATTLE_ORG_ID = 'vD4x5sGreTsscAp66FgA';

export type BoothBattleSubmissionStatus = 'pending' | 'scored' | 'rejected';

export interface BoothBattleSubmission {
  id: string;
  orgId: typeof BOOTH_BATTLE_ORG_ID;
  siteId: string;
  visitorName: string;
  submittedKeywords: string[];
  status: BoothBattleSubmissionStatus;
  clientSubmittedAt: Timestamp;

  matches?: number;
  score?: number;
  previousBestScore?: number;
  currentBestScore?: number;
  isNewBest?: boolean;
  processedAt?: Timestamp;
  rejectionReason?: string;
}

export interface BoothBattleScore {
  id: string;
  orgId: typeof BOOTH_BATTLE_ORG_ID;
  siteId: string;
  visitorName: string;
  visitorNameKey: string;
  bestScore: number;
  bestKeywords: string[];
  bestSubmittedAt: Timestamp;
  latestScore: number;
  latestKeywords: string[];
  latestSubmittedAt: Timestamp;
  attemptCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

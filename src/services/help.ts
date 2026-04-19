import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface HelpVideo {
  id?: string;
  youtubeId: string;
  title: string;
  order?: number | string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export class HelpService {
  static async listVideos(): Promise<HelpVideo[]> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const ref = collection(db, 'Help');
    const snap = await getDocs(ref);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HelpVideo, 'id'>) }));
    // Client-side sort: tolerant of missing `order` or string values like "1"
    return rows.sort((a, b) => {
      const ao = Number(a.order ?? Number.POSITIVE_INFINITY);
      const bo = Number(b.order ?? Number.POSITIVE_INFINITY);
      return ao - bo;
    });
  }
}

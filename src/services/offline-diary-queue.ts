import { openDB } from 'idb';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const DB_NAME = 'ArchePalOfflineDB';
const DB_VERSION = 3; // Must match across all services using the same DB
const STORE_NAME = 'offlineDiaryEntries';

export interface OfflineDiaryEntry {
  id?: string; // Will be prefixed with 'offline-' for display
  numericId?: number; // Original numeric ID from IndexedDB
  userId: string;
  title: string;
  content: string;
  category: 'site' | 'artifact' | 'other';
  aiImageSummary?: string;
  imageUrl?: string; // For compatibility with DiaryEntry
  localImagePath?: string;
  createdAt: string;
  date: string;
  time: string;
  status: 'pending';
  isOffline: true;
}

export const OfflineDiaryQueueService = {
  async initDB() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create all stores needed across the app to prevent version conflicts
        if (!db.objectStoreNames.contains('offlineArtifacts')) {
          db.createObjectStore('offlineArtifacts', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('sitesCache')) {
          db.createObjectStore('sitesCache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('artifactsCache')) {
          db.createObjectStore('artifactsCache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('siteDetailsCache')) {
          db.createObjectStore('siteDetailsCache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('artifactDetailsCache')) {
          db.createObjectStore('artifactDetailsCache', { keyPath: 'id' });
        }
      },
    });
  },

  async queueDiaryEntry(data: Omit<OfflineDiaryEntry, 'id' | 'localImagePath' | 'status' | 'isOffline'>, imageBlob?: Blob): Promise<void> {
    const db = await this.initDB();
    let imagePath: string | null = null;

    if (imageBlob) {
      const fileName = `${Date.now()}_diary.jpg`;
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageBlob);
      });

      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Data
        });
        imagePath = fileName;
      } catch (e) {
        console.warn('Could not save image locally:', e);
      }
    }

    await db.put(STORE_NAME, {
      ...data,
      localImagePath: imagePath,
      status: 'pending',
      isOffline: true
    });

    console.log('📴 Diary entry queued for offline sync');
  },

  async getQueue(): Promise<OfflineDiaryEntry[]> {
    const db = await this.initDB();
    return db.getAll(STORE_NAME);
  },

  async getQueueCount(): Promise<number> {
    const db = await this.initDB();
    const all = await db.getAll(STORE_NAME);
    return all.length;
  },

  async removeFromQueue(id: number, imagePath?: string): Promise<void> {
    const db = await this.initDB();
    await db.delete(STORE_NAME, id);

    if (imagePath) {
      try {
        await Filesystem.deleteFile({ path: imagePath, directory: Directory.Data });
      } catch (e) {
        console.warn('Could not delete local diary image', e);
      }
    }
  },

  async getLocalImageAsBlob(imagePath: string): Promise<Blob | null> {
    try {
      const result = await Filesystem.readFile({
        path: imagePath,
        directory: Directory.Data
      });

      // Convert base64 to blob
      const base64Data = result.data as string;
      const byteString = atob(base64Data.split(',')[1] || base64Data);
      const mimeType = base64Data.split(';')[0]?.split(':')[1] || 'image/jpeg';
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);

      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      return new Blob([ab], { type: mimeType });
    } catch (e) {
      console.warn('Could not read local diary image:', e);
      return null;
    }
  },

  async updateOfflineEntry(numericId: number, updates: Partial<OfflineDiaryEntry>): Promise<void> {
    const db = await this.initDB();
    const existing = await db.get(STORE_NAME, numericId);
    if (existing) {
      await db.put(STORE_NAME, {
        ...existing,
        ...updates,
        id: numericId, // Keep the numeric ID for IndexedDB
      });
      console.log('📝 Offline diary entry updated');
    }
  },

  async getEntryById(numericId: number): Promise<OfflineDiaryEntry | undefined> {
    const dbInstance = await this.initDB();
    return dbInstance.get(STORE_NAME, numericId);
  },

  async syncOfflineData(): Promise<{ synced: number; failed: number }> {
    const queue = await this.getQueue();
    if (queue.length === 0) {
      return { synced: 0, failed: 0 };
    }

    console.log(`🔄 Syncing ${queue.length} offline diary entries...`);

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        // Get the numeric ID (stored in 'id' field in IndexedDB)
        const numericId = typeof item.id === 'number' ? item.id : item.numericId;

        if (!numericId) {
          console.error('❌ No numeric ID found for item:', item);
          failed++;
          continue;
        }

        // Prepare entry data for Firestore (excluding offline-specific fields)
        const entryData = {
          userId: item.userId,
          title: item.title,
          content: item.content,
          category: item.category,
          aiImageSummary: item.aiImageSummary || '',
          createdAt: Timestamp.fromDate(new Date(item.createdAt)),
          date: item.date,
          time: item.time,
        };

        // Create diary entry in Firestore
        const docRef = await addDoc(collection(db, 'DigitalDiary'), entryData);
        console.log(`✅ Diary entry synced with ID: ${docRef.id}`);

        // Upload image if exists
        if (item.localImagePath) {
          try {
            const fileData = await Filesystem.readFile({
              path: item.localImagePath,
              directory: Directory.Data
            });

            // Convert base64 to blob
            const base64Data = fileData.data as string;
            const response = await fetch(`data:image/jpeg;base64,${base64Data}`);
            const blob = await response.blob();
            const file = new File([blob], 'diary_image.jpg', { type: 'image/jpeg' });

            // Upload to Firebase Storage
            const imageRef = ref(storage, `diaryImages/${item.userId}/${docRef.id}/diary_image.jpg`);
            await uploadBytes(imageRef, file);
            const imageUrl = await getDownloadURL(imageRef);

            // Update the document with image URL
            await updateDoc(doc(db, 'DigitalDiary', docRef.id), { imageUrl });
            console.log(`📸 Image uploaded: ${imageUrl}`);
          } catch (imageError) {
            console.warn('⚠️ Could not upload image, but entry was synced:', imageError);
          }
        }

        // Remove from offline queue
        await this.removeFromQueue(numericId, item.localImagePath);
        synced++;

      } catch (error) {
        console.error(`❌ Failed to sync diary entry:`, error);
        failed++;
      }
    }

    console.log(`📊 Sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }
};

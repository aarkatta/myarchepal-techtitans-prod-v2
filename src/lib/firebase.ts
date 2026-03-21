import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  Firestore,
} from 'firebase/firestore';
import { getAuth, Auth, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

const isConfigValid =
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId && !!firebaseConfig.appId;

if (!isConfigValid) {
  console.warn('⚠️ Firebase configuration is missing. Check your .env file.');
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

// Always initialize with current config — getApps() reuse can carry stale credentials
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error('❌ Firebase app initialization failed:', e);
}

// Firestore — initializeFirestore throws if already called on this app (HMR), fall back to getFirestore
if (app) {
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    try {
      db = getFirestore(app);
    } catch (e) {
      console.error('❌ Firestore initialization failed:', e);
    }
  }
}

// Auth — each service initializes independently so one failure never blocks another
if (app) {
  try {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
    } else {
      auth = getAuth(app);
    }
  } catch (e) {
    console.error('❌ Firebase Auth initialization failed:', e);
  }
}

// Storage
if (app) {
  try {
    storage = getStorage(app);
  } catch (e) {
    console.error('❌ Firebase Storage initialization failed:', e);
  }
}

export { db, auth, storage };
export default app;

/**
 * Seed Script: Help Videos
 *
 * Populates the `Help` Firestore collection with tutorial YouTube videos
 * shown on the Help & Tutorials page (src/pages/Help.tsx).
 *
 * Document shape:
 *   { youtubeId: string, title: string, order: number, createdAt, updatedAt }
 *
 * Setup:
 *   1. Firebase Console → Project Settings → Service Accounts
 *   2. "Generate new private key" → Download JSON file
 *   3. Save as: scripts/serviceAccountKey.json
 *
 * Run:
 *   node scripts/seed-help-videos.js
 *   node scripts/seed-help-videos.js --dry-run
 *   node scripts/seed-help-videos.js --wipe   (deletes all Help docs first)
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Firebase Admin Init ────────────────────────────────────────────────────

try {
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  console.error('   Make sure scripts/serviceAccountKey.json exists');
  console.error('   Error:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();
const DRY_RUN = process.argv.includes('--dry-run');
const WIPE = process.argv.includes('--wipe');

// ─── Video List ─────────────────────────────────────────────────────────────
// Edit this list to add/remove help videos. `order` controls display sequence.

const VIDEOS = [
  {
    youtubeId: '2jiy1DVv8mw',
    title: 'ArchePal — The future of the past is in our hands!',
    order: 1,
  },
  // Add more videos here, e.g.:
  // { youtubeId: 'XXXXXXXXXXX', title: 'Creating your first site', order: 2 },
  // { youtubeId: 'XXXXXXXXXXX', title: 'Uploading a filled paper form', order: 3 },
];

// ─── Run ────────────────────────────────────────────────────────────────────

async function run() {
  const col = db.collection('Help');

  if (WIPE) {
    console.log('🗑  Wiping existing Help docs...');
    const snap = await col.get();
    if (DRY_RUN) {
      console.log(`   [dry-run] would delete ${snap.size} docs`);
    } else {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      console.log(`   deleted ${snap.size} docs`);
    }
  }

  console.log(`\n📼 Seeding ${VIDEOS.length} help video(s)...`);
  for (const video of VIDEOS) {
    const payload = { ...video, createdAt: now, updatedAt: now };
    if (DRY_RUN) {
      console.log(`   [dry-run] ${video.order}. ${video.title} (${video.youtubeId})`);
      continue;
    }
    const ref = await col.add(payload);
    console.log(`   ✅ ${video.order}. ${video.title} — ${ref.id}`);
  }

  console.log('\n🎉 Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

/**
 * One-time Migration Script: Archaeologists → Users
 *
 * This script uses Firebase Admin SDK to bypass security rules.
 *
 * Setup:
 * 1. Go to Firebase Console → Project Settings → Service Accounts
 * 2. Click "Generate new private key" → Download JSON file
 * 3. Save it as: scripts/serviceAccountKey.json
 *
 * Run:
 *   node scripts/migrate-archaeologists.js
 *
 * Options:
 *   --dry-run     Preview without making changes
 *   --org-id      Target organization ID (default: default-org)
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  ROOT_ORG_ID: 'root-org',
  DEFAULT_ORG_ID: 'default-org',
  ROOT_ORG_NAME: 'FLL Global IT',
  DEFAULT_ORG_NAME: 'Public Sandbox',
};

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TARGET_ORG_ID = args.find(a => a.startsWith('--org-id='))?.split('=')[1] || CONFIG.DEFAULT_ORG_ID;

// Initialize Firebase Admin
try {
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  console.error('   Make sure scripts/serviceAccountKey.json exists');
  console.error('   Download it from: Firebase Console → Project Settings → Service Accounts');
  console.error('   Error:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

async function seedOrganizations() {
  console.log('\n🌱 Seeding organizations...');

  // Seed Root Organization
  const rootRef = db.collection('organizations').doc(CONFIG.ROOT_ORG_ID);
  const rootDoc = await rootRef.get();

  if (!rootDoc.exists) {
    await rootRef.set({
      id: CONFIG.ROOT_ORG_ID,
      name: CONFIG.ROOT_ORG_NAME,
      type: 'ROOT',
      parentId: null,
      subscriptionLevel: 'Enterprise',
      status: 'ACTIVE',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ Created Root organization');
  } else {
    console.log('   ⏭️  Root organization already exists');
  }

  // Seed Default Organization
  const defaultRef = db.collection('organizations').doc(CONFIG.DEFAULT_ORG_ID);
  const defaultDoc = await defaultRef.get();

  if (!defaultDoc.exists) {
    await defaultRef.set({
      id: CONFIG.DEFAULT_ORG_ID,
      name: CONFIG.DEFAULT_ORG_NAME,
      type: 'DEFAULT',
      parentId: null,
      subscriptionLevel: 'Free',
      status: 'ACTIVE',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ Created Default organization');
  } else {
    console.log('   ⏭️  Default organization already exists');
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function migrateArchaeologists() {
  console.log('\n📦 Migrating archaeologists to users...');
  console.log(`   Target Organization: ${TARGET_ORG_ID}`);
  console.log(`   Dry Run: ${DRY_RUN}`);

  // Fetch all archaeologists
  const archaeologistsSnapshot = await db.collection('archaeologists').get();
  const total = archaeologistsSnapshot.size;
  console.log(`   Found ${total} archaeologists`);

  if (total === 0) {
    console.log('   ✅ No archaeologists to migrate');
    return { migrated: 0, skipped: 0, errors: 0 };
  }

  // Fetch existing users to skip
  const usersSnapshot = await db.collection('users').get();
  const existingUids = new Set(usersSnapshot.docs.map(doc => doc.data().uid));
  console.log(`   Found ${existingUids.size} existing users`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of archaeologistsSnapshot.docs) {
    const archaeologist = doc.data();
    const uid = archaeologist.uid;

    // Skip if already migrated
    if (existingUids.has(uid)) {
      console.log(`   ⏭️  Skipping ${uid} (already exists)`);
      skipped++;
      continue;
    }

    // Build user object (only include defined fields)
    const user = {
      id: uid,
      uid: uid,
      email: archaeologist.email,
      organizationId: TARGET_ORG_ID,
      role: 'MEMBER',
      status: archaeologist.status === 'approved' ? 'ACTIVE' : 'PENDING',
      invitedBy: null,
      createdAt: archaeologist.approvedAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add optional fields only if they exist
    if (archaeologist.displayName) user.displayName = archaeologist.displayName;
    if (archaeologist.photoURL) user.photoURL = archaeologist.photoURL;
    if (archaeologist.institution) user.institution = archaeologist.institution;
    if (archaeologist.specialization) user.specialization = archaeologist.specialization;
    if (archaeologist.credentials) user.credentials = archaeologist.credentials;
    if (archaeologist.activeProjectId) user.activeProjectId = archaeologist.activeProjectId;

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would migrate: ${uid} (${archaeologist.email})`);
      migrated++;
    } else {
      try {
        await db.collection('users').doc(uid).set(user);
        console.log(`   ✅ Migrated: ${uid} (${archaeologist.email})`);
        migrated++;
      } catch (error) {
        console.error(`   ❌ Error migrating ${uid}: ${error.message}`);
        errors++;
      }
    }
  }

  return { migrated, skipped, errors };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('  ARCHAEOLOGISTS → USERS MIGRATION SCRIPT');
  console.log('═'.repeat(60));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Step 1: Seed organizations
    if (!DRY_RUN) {
      await seedOrganizations();
    }

    // Step 2: Migrate archaeologists
    const result = await migrateArchaeologists();

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('  MIGRATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Migrated: ${result.migrated}`);
    console.log(`  Skipped:  ${result.skipped}`);
    console.log(`  Errors:   ${result.errors}`);
    console.log('═'.repeat(60));

    if (result.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));

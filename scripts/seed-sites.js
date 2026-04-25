/**
 * Seed Script: 160 Sites for a Specific Organization
 *
 * Creates 160 Sites documents named c1, c2, c3, ..., c160 under
 * organizationId = vD4x5sGreTsscAp66FgA.
 *
 * Setup:
 *   1. Firebase Console → Project Settings → Service Accounts
 *   2. "Generate new private key" → save as scripts/serviceAccountKey.json
 *
 * Run:
 *   node scripts/seed-sites.js                 # writes to Firestore
 *   node scripts/seed-sites.js --dry-run       # preview, no writes
 *   node scripts/seed-sites.js --count=50      # custom count
 *   node scripts/seed-sites.js --prefix=test   # custom name prefix
 *   node scripts/seed-sites.js --org=<ID>      # custom organization
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI args ────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const getArg = (name, fallback) => {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.split('=')[1] : fallback;
};

const ORG_ID = getArg('org', 'vD4x5sGreTsscAp66FgA');
const PREFIX = getArg('prefix', 'C');
const COUNT = parseInt(getArg('count', '160'), 10);

// ─── Firebase Admin Init ─────────────────────────────────────────────────────

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
const now = admin.firestore.Timestamp.now();

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seedSites() {
  console.log('\n🌱 Seeding sites…');
  console.log(`   Organization : ${ORG_ID}`);
  console.log(`   Prefix       : ${PREFIX}`);
  console.log(`   Count        : ${COUNT}`);
  if (DRY_RUN) console.log('\n⚠️  DRY RUN — no writes will be made\n');

  const sitesCol = db.collection('Sites');

  // Skip names that already exist in this org (so the script is re-runnable).
  const existingSnap = await sitesCol
    .where('organizationId', '==', ORG_ID)
    .get();
  const existingNames = new Set(
    existingSnap.docs.map((d) => d.data().name).filter(Boolean)
  );
  console.log(`   Existing sites in org: ${existingNames.size}`);

  const plannedNames = [];
  for (let i = 1; i <= COUNT; i++) plannedNames.push(`${PREFIX}${i}`);
  const namesToCreate = plannedNames.filter((n) => !existingNames.has(n));

  console.log(`   To create            : ${namesToCreate.length}`);
  console.log(`   Skipped (duplicates) : ${plannedNames.length - namesToCreate.length}`);

  if (namesToCreate.length === 0) {
    console.log('\n✅ Nothing to do — all names already exist.\n');
    return;
  }

  if (DRY_RUN) {
    console.log('\nFirst 3 site documents that would be written:');
    console.log(
      JSON.stringify(
        namesToCreate.slice(0, 3).map((name) => buildSiteDoc(name)),
        null,
        2
      )
    );
    console.log(`\n${namesToCreate.length} sites would be created.\n`);
    return;
  }

  // Firestore batches cap at 500 writes — chunk for safety.
  const CHUNK_SIZE = 450;
  let written = 0;
  for (let i = 0; i < namesToCreate.length; i += CHUNK_SIZE) {
    const chunk = namesToCreate.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    for (const name of chunk) {
      const docRef = sitesCol.doc(); // auto-id
      batch.set(docRef, buildSiteDoc(name));
    }
    await batch.commit();
    written += chunk.length;
    console.log(`   ✅ Wrote batch ${i / CHUNK_SIZE + 1} — ${written}/${namesToCreate.length}`);
  }

  console.log(`\n✅ Seeded ${written} sites under org ${ORG_ID}\n`);
}

function buildSiteDoc(name) {
  return {
    name,
    description: `First Championship ${name}`,
    location: {
      latitude: 29.76,
      longitude: -95.37,
      country: 'USA',
      region: 'Texas',
    },
    dateDiscovered: now,
    status: 'active',
    organizationId: ORG_ID,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  SEED: SITES');
  console.log('═'.repeat(60));

  try {
    await seedSites();
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));

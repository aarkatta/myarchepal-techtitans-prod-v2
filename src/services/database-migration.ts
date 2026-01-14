import {
  collection,
  getDocs,
  doc,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArchaeologistService, Archaeologist } from './archaeologists';
import { UserService } from './users';
import { DatabaseSeedService } from './database-seed';
import {
  User,
  DEFAULT_ORGANIZATION_ID,
  ROOT_ORGANIZATION_ID,
} from '@/types/organization';

/**
 * Database Migration Service
 *
 * Handles migration from the legacy archaeologists collection to the new
 * multi-tenant users collection.
 *
 * Migration Steps:
 * 1. Ensure database is seeded (Root & Default orgs exist)
 * 2. Read all archaeologists from the legacy collection
 * 3. Transform and write to users collection
 * 4. Preserve original archaeologists collection (for rollback)
 */

export interface MigrationResult {
  success: boolean;
  totalArchaeologists: number;
  migratedCount: number;
  skippedCount: number;
  errors: Array<{ uid: string; error: string }>;
}

export interface MigrationOptions {
  /**
   * Organization ID to assign migrated users to.
   * Defaults to DEFAULT_ORGANIZATION_ID.
   */
  targetOrganizationId?: string;

  /**
   * Default role for migrated users.
   * Defaults to 'MEMBER'.
   */
  defaultRole?: 'ORG_ADMIN' | 'MEMBER';

  /**
   * Whether to skip users that already exist in the users collection.
   * Defaults to true.
   */
  skipExisting?: boolean;

  /**
   * Dry run mode - logs what would happen without making changes.
   * Defaults to false.
   */
  dryRun?: boolean;

  /**
   * List of UIDs to promote to ORG_ADMIN.
   */
  orgAdminUids?: string[];

  /**
   * List of UIDs to promote to SUPER_ADMIN (assigned to Root org).
   */
  superAdminUids?: string[];
}

const DEFAULT_OPTIONS: Required<Omit<MigrationOptions, 'orgAdminUids' | 'superAdminUids'>> = {
  targetOrganizationId: DEFAULT_ORGANIZATION_ID,
  defaultRole: 'MEMBER',
  skipExisting: true,
  dryRun: false,
};

export class DatabaseMigrationService {
  /**
   * Run the full migration from archaeologists to users
   */
  static async migrateArchaeologistsToUsers(
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const result: MigrationResult = {
      success: false,
      totalArchaeologists: 0,
      migratedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      console.log('🚀 Starting archaeologists → users migration...');
      console.log('Options:', {
        targetOrganizationId: config.targetOrganizationId,
        defaultRole: config.defaultRole,
        skipExisting: config.skipExisting,
        dryRun: config.dryRun,
      });

      // Step 1: Ensure database is seeded
      if (!config.dryRun) {
        const isSeeded = await DatabaseSeedService.isSeeded();
        if (!isSeeded) {
          console.log('📦 Database not seeded, initializing...');
          await DatabaseSeedService.initialize();
        }
      }

      // Step 2: Fetch all archaeologists
      const archaeologists = await ArchaeologistService.getAllArchaeologists();
      result.totalArchaeologists = archaeologists.length;

      console.log(`📊 Found ${archaeologists.length} archaeologists to migrate`);

      if (archaeologists.length === 0) {
        console.log('✅ No archaeologists to migrate');
        result.success = true;
        return result;
      }

      // Step 3: Process each archaeologist
      for (const archaeologist of archaeologists) {
        try {
          const migrated = await this.migrateOneArchaeologist(
            archaeologist,
            config
          );

          if (migrated) {
            result.migratedCount++;
          } else {
            result.skippedCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            uid: archaeologist.uid,
            error: errorMessage,
          });
          console.error(`❌ Error migrating ${archaeologist.uid}:`, errorMessage);
        }
      }

      result.success = result.errors.length === 0;

      console.log('📊 Migration Summary:');
      console.log(`   Total: ${result.totalArchaeologists}`);
      console.log(`   Migrated: ${result.migratedCount}`);
      console.log(`   Skipped: ${result.skippedCount}`);
      console.log(`   Errors: ${result.errors.length}`);

      return result;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      result.success = false;
      return result;
    }
  }

  /**
   * Migrate a single archaeologist to the users collection
   */
  private static async migrateOneArchaeologist(
    archaeologist: Archaeologist,
    config: Required<Omit<MigrationOptions, 'orgAdminUids' | 'superAdminUids'>> & MigrationOptions
  ): Promise<boolean> {
    const { uid, email, displayName, photoURL, institution, specialization, credentials, activeProjectId } = archaeologist;

    // Check if user already exists
    if (config.skipExisting) {
      const existing = await UserService.getByUid(uid);
      if (existing) {
        console.log(`⏭️  Skipping ${uid} (already exists)`);
        return false;
      }
    }

    // Determine role and organization
    let role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MEMBER' = config.defaultRole;
    let organizationId = config.targetOrganizationId;

    // Check if this user should be a Super Admin
    if (config.superAdminUids?.includes(uid)) {
      role = 'SUPER_ADMIN';
      organizationId = ROOT_ORGANIZATION_ID;
    }
    // Check if this user should be an Org Admin
    else if (config.orgAdminUids?.includes(uid)) {
      role = 'ORG_ADMIN';
    }

    if (config.dryRun) {
      console.log(`[DRY RUN] Would migrate ${uid} as ${role} to org ${organizationId}`);
      return true;
    }

    // Create the user object, filtering out undefined values
    const now = Timestamp.now();
    const user: Record<string, unknown> = {
      id: uid,
      uid,
      email,
      organizationId,
      role,
      status: archaeologist.status === 'approved' ? 'ACTIVE' : 'PENDING',
      invitedBy: null,
      createdAt: archaeologist.approvedAt || now,
      updatedAt: now,
    };

    // Only add optional fields if they have values (Firestore rejects undefined)
    if (displayName !== undefined) user.displayName = displayName;
    if (photoURL !== undefined) user.photoURL = photoURL;
    if (institution !== undefined) user.institution = institution;
    if (specialization !== undefined) user.specialization = specialization;
    if (credentials !== undefined) user.credentials = credentials;
    if (activeProjectId !== undefined) user.activeProjectId = activeProjectId;

    // Write to Firestore
    if (!db) throw new Error('Firestore not initialized');

    const userDoc = doc(db, 'users', uid);
    await setDoc(userDoc, user);

    console.log(`✅ Migrated ${uid} as ${role}`);
    return true;
  }

  /**
   * Batch migrate archaeologists (more efficient for large datasets)
   */
  static async batchMigrateArchaeologistsToUsers(
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const result: MigrationResult = {
      success: false,
      totalArchaeologists: 0,
      migratedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      if (!db) throw new Error('Firestore not initialized');

      console.log('🚀 Starting batch migration...');

      // Ensure seeded
      if (!config.dryRun) {
        await DatabaseSeedService.initialize();
      }

      // Fetch all archaeologists
      const archaeologists = await ArchaeologistService.getAllArchaeologists();
      result.totalArchaeologists = archaeologists.length;

      if (archaeologists.length === 0) {
        result.success = true;
        return result;
      }

      // Get existing users to skip
      const existingUserUids = new Set<string>();
      if (config.skipExisting) {
        const existingUsers = await UserService.getAll();
        existingUsers.forEach(u => existingUserUids.add(u.uid));
      }

      // Process in batches of 500 (Firestore limit)
      const BATCH_SIZE = 500;
      const toMigrate = archaeologists.filter(a => !existingUserUids.has(a.uid));

      result.skippedCount = archaeologists.length - toMigrate.length;

      if (config.dryRun) {
        console.log(`[DRY RUN] Would migrate ${toMigrate.length} archaeologists`);
        result.migratedCount = toMigrate.length;
        result.success = true;
        return result;
      }

      for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = toMigrate.slice(i, i + BATCH_SIZE);

        for (const archaeologist of chunk) {
          const { uid, email, displayName, photoURL, institution, specialization, credentials, activeProjectId } = archaeologist;

          let role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MEMBER' = config.defaultRole;
          let organizationId = config.targetOrganizationId;

          if (options.superAdminUids?.includes(uid)) {
            role = 'SUPER_ADMIN';
            organizationId = ROOT_ORGANIZATION_ID;
          } else if (options.orgAdminUids?.includes(uid)) {
            role = 'ORG_ADMIN';
          }

          const now = Timestamp.now();
          const user: Record<string, unknown> = {
            id: uid,
            uid,
            email,
            organizationId,
            role,
            status: archaeologist.status === 'approved' ? 'ACTIVE' : 'PENDING',
            invitedBy: null,
            createdAt: archaeologist.approvedAt || now,
            updatedAt: now,
          };

          // Only add optional fields if they have values (Firestore rejects undefined)
          if (displayName !== undefined) user.displayName = displayName;
          if (photoURL !== undefined) user.photoURL = photoURL;
          if (institution !== undefined) user.institution = institution;
          if (specialization !== undefined) user.specialization = specialization;
          if (credentials !== undefined) user.credentials = credentials;
          if (activeProjectId !== undefined) user.activeProjectId = activeProjectId;

          const userDoc = doc(db, 'users', uid);
          batch.set(userDoc, user);
        }

        await batch.commit();
        result.migratedCount += chunk.length;
        console.log(`📦 Batch complete: ${result.migratedCount}/${toMigrate.length}`);
      }

      result.success = true;
      console.log('✅ Batch migration complete!');

      return result;
    } catch (error) {
      console.error('❌ Batch migration failed:', error);
      result.success = false;
      return result;
    }
  }

  /**
   * Verify migration integrity
   */
  static async verifyMigration(): Promise<{
    isComplete: boolean;
    archaeologistCount: number;
    userCount: number;
    missingUids: string[];
  }> {
    const archaeologists = await ArchaeologistService.getAllArchaeologists();
    const users = await UserService.getAll();

    const userUids = new Set(users.map(u => u.uid));
    const missingUids = archaeologists
      .filter(a => !userUids.has(a.uid))
      .map(a => a.uid);

    return {
      isComplete: missingUids.length === 0,
      archaeologistCount: archaeologists.length,
      userCount: users.length,
      missingUids,
    };
  }
}

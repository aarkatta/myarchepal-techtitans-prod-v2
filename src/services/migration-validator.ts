/**
 * Migration Validator
 *
 * Use this to validate Steps 1, 2, and 3 of the database migration.
 *
 * Usage (in browser console or component):
 *
 *   import { MigrationValidator } from '@/services/migration-validator';
 *   await MigrationValidator.runAll();
 *
 * Or run individual checks:
 *   await MigrationValidator.validateStep1_Schema();
 *   await MigrationValidator.validateStep2_Seeding();
 *   await MigrationValidator.validateStep3_Migration();
 */

import { db } from '@/lib/firebase';
import { OrganizationService } from './organizations';
import { UserService } from './users';
import { TeamService, TeamMemberService } from './teams';
import { InvitationService } from './invitations';
import { DatabaseSeedService } from './database-seed';
import { DatabaseMigrationService } from './database-migration';
import { ArchaeologistService } from './archaeologists';
import { RoleService } from './roles';
import { UserRoleService } from './userRoles';
import {
  ROOT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ID,
  ROLE_IDS,
} from '@/types/organization';

export interface ValidationResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: unknown;
}

export class MigrationValidator {
  private static results: ValidationResult[] = [];

  private static log(result: ValidationResult) {
    this.results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${result.step}] ${result.message}`);
    if (result.details) {
      console.log('   Details:', result.details);
    }
  }

  /**
   * Run all validation checks
   */
  static async runAll(): Promise<ValidationResult[]> {
    this.results = [];
    console.log('\n🔍 Starting Migration Validation...\n');
    console.log('=' .repeat(50));

    await this.validateStep1_Schema();
    console.log('-'.repeat(50));

    await this.validateStep2_Seeding();
    console.log('-'.repeat(50));

    await this.validateStep3_Migration();
    console.log('-'.repeat(50));

    await this.validateStep4_Roles();
    console.log('='.repeat(50));

    // Summary
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;

    console.log(`\n📊 Summary: ${passed} passed, ${failed} failed, ${warned} warnings\n`);

    return this.results;
  }

  /**
   * Step 1: Validate Schema/Types are correctly defined
   */
  static async validateStep1_Schema(): Promise<void> {
    console.log('\n📋 Step 1: Schema Validation\n');

    // Check Firestore connection
    if (db) {
      this.log({
        step: 'Step 1.1',
        status: 'PASS',
        message: 'Firestore connection available',
      });
    } else {
      this.log({
        step: 'Step 1.1',
        status: 'FAIL',
        message: 'Firestore not initialized',
      });
      return;
    }

    // Check OrganizationService is callable
    try {
      const orgs = await OrganizationService.getAll();
      this.log({
        step: 'Step 1.2',
        status: 'PASS',
        message: `OrganizationService working (${orgs.length} organizations found)`,
      });
    } catch (error) {
      this.log({
        step: 'Step 1.2',
        status: 'FAIL',
        message: 'OrganizationService error',
        details: error,
      });
    }

    // Check UserService is callable
    try {
      const users = await UserService.getAll();
      this.log({
        step: 'Step 1.3',
        status: 'PASS',
        message: `UserService working (${users.length} users found)`,
      });
    } catch (error) {
      this.log({
        step: 'Step 1.3',
        status: 'FAIL',
        message: 'UserService error',
        details: error,
      });
    }

    // Check TeamService is callable
    try {
      // Just verify the service class is accessible
      const teamExists = typeof TeamService.getById === 'function';
      const memberExists = typeof TeamMemberService.getByTeam === 'function';
      this.log({
        step: 'Step 1.4',
        status: teamExists && memberExists ? 'PASS' : 'FAIL',
        message: 'TeamService and TeamMemberService available',
      });
    } catch (error) {
      this.log({
        step: 'Step 1.4',
        status: 'FAIL',
        message: 'TeamService error',
        details: error,
      });
    }

    // Check InvitationService is callable
    try {
      const inviteExists = typeof InvitationService.create === 'function';
      this.log({
        step: 'Step 1.5',
        status: inviteExists ? 'PASS' : 'FAIL',
        message: 'InvitationService available',
      });
    } catch (error) {
      this.log({
        step: 'Step 1.5',
        status: 'FAIL',
        message: 'InvitationService error',
        details: error,
      });
    }
  }

  /**
   * Step 2: Validate Database Seeding
   */
  static async validateStep2_Seeding(): Promise<void> {
    console.log('\n🌱 Step 2: Database Seeding Validation\n');

    // Check seeding status
    const seedStatus = await DatabaseSeedService.getStatus();

    this.log({
      step: 'Step 2.1',
      status: seedStatus.hasRootOrg ? 'PASS' : 'WARN',
      message: seedStatus.hasRootOrg
        ? 'Root organization exists'
        : 'Root organization NOT found (run DatabaseSeedService.initialize())',
    });

    this.log({
      step: 'Step 2.2',
      status: seedStatus.hasDefaultOrg ? 'PASS' : 'WARN',
      message: seedStatus.hasDefaultOrg
        ? 'Default organization exists'
        : 'Default organization NOT found (run DatabaseSeedService.initialize())',
    });

    // Verify Root org details if exists
    if (seedStatus.hasRootOrg) {
      const rootOrg = await OrganizationService.getById(ROOT_ORGANIZATION_ID);
      this.log({
        step: 'Step 2.3',
        status: rootOrg?.type === 'ROOT' ? 'PASS' : 'FAIL',
        message: `Root org type: ${rootOrg?.type}`,
        details: { name: rootOrg?.name, status: rootOrg?.status },
      });
    }

    // Verify Default org details if exists
    if (seedStatus.hasDefaultOrg) {
      const defaultOrg = await OrganizationService.getById(DEFAULT_ORGANIZATION_ID);
      this.log({
        step: 'Step 2.4',
        status: defaultOrg?.type === 'DEFAULT' ? 'PASS' : 'FAIL',
        message: `Default org type: ${defaultOrg?.type}`,
        details: { name: defaultOrg?.name, status: defaultOrg?.status },
      });
    }

    // Check for super admin
    this.log({
      step: 'Step 2.5',
      status: seedStatus.hasSuperAdmin ? 'PASS' : 'WARN',
      message: seedStatus.hasSuperAdmin
        ? `Super admin exists (${seedStatus.superAdminCount} found)`
        : 'No super admin found (optional - can be created later)',
    });
  }

  /**
   * Step 3: Validate Migration from Archaeologists to Users
   */
  static async validateStep3_Migration(): Promise<void> {
    console.log('\n📦 Step 3: Migration Validation\n');

    // Get archaeologists count
    let archaeologistCount = 0;
    try {
      const archaeologists = await ArchaeologistService.getAllArchaeologists();
      archaeologistCount = archaeologists.length;
      this.log({
        step: 'Step 3.1',
        status: 'PASS',
        message: `Found ${archaeologistCount} archaeologists in legacy collection`,
      });
    } catch (error) {
      this.log({
        step: 'Step 3.1',
        status: 'FAIL',
        message: 'Could not read archaeologists collection',
        details: error,
      });
    }

    // Get users count
    let userCount = 0;
    try {
      const users = await UserService.getAll();
      userCount = users.length;
      this.log({
        step: 'Step 3.2',
        status: 'PASS',
        message: `Found ${userCount} users in new collection`,
      });
    } catch (error) {
      this.log({
        step: 'Step 3.2',
        status: 'FAIL',
        message: 'Could not read users collection',
        details: error,
      });
    }

    // Check migration completeness
    if (archaeologistCount > 0) {
      const verification = await DatabaseMigrationService.verifyMigration();

      if (verification.isComplete) {
        this.log({
          step: 'Step 3.3',
          status: 'PASS',
          message: 'All archaeologists have been migrated to users',
        });
      } else {
        this.log({
          step: 'Step 3.3',
          status: 'WARN',
          message: `${verification.missingUids.length} archaeologists not yet migrated`,
          details: {
            missingUids: verification.missingUids.slice(0, 5),
            hint: 'Run DatabaseMigrationService.migrateArchaeologistsToUsers()',
          },
        });
      }
    } else {
      this.log({
        step: 'Step 3.3',
        status: 'PASS',
        message: 'No archaeologists to migrate (collection empty)',
      });
    }

    // Dry run test
    try {
      const dryRunResult = await DatabaseMigrationService.migrateArchaeologistsToUsers({
        dryRun: true,
      });
      this.log({
        step: 'Step 3.4',
        status: 'PASS',
        message: 'Migration dry-run successful',
        details: {
          total: dryRunResult.totalArchaeologists,
          wouldMigrate: dryRunResult.migratedCount,
          wouldSkip: dryRunResult.skippedCount,
        },
      });
    } catch (error) {
      this.log({
        step: 'Step 3.4',
        status: 'FAIL',
        message: 'Migration dry-run failed',
        details: error,
      });
    }
  }

  /**
   * Step 4: Validate Roles Setup
   */
  static async validateStep4_Roles(): Promise<void> {
    console.log('\n🔐 Step 4: Roles Validation\n');

    // Check if roles are seeded
    try {
      const roles = await RoleService.getAll();
      const isSeeded = await RoleService.isSeeded();

      this.log({
        step: 'Step 4.1',
        status: isSeeded ? 'PASS' : 'WARN',
        message: isSeeded
          ? `Roles collection seeded (${roles.length} roles found)`
          : 'Roles not seeded (run MigrationValidator.seedRoles())',
        details: roles.map(r => ({ roleId: r.roleId, roleName: r.roleName })),
      });

      // Check specific roles exist
      const superAdminRole = roles.find(r => r.roleId === ROLE_IDS.SUPER_ADMIN);
      const orgAdminRole = roles.find(r => r.roleId === ROLE_IDS.ORG_ADMIN);
      const memberRole = roles.find(r => r.roleId === ROLE_IDS.MEMBER);

      this.log({
        step: 'Step 4.2',
        status: superAdminRole ? 'PASS' : 'WARN',
        message: superAdminRole ? 'SUPER_ADMIN role exists' : 'SUPER_ADMIN role missing',
      });

      this.log({
        step: 'Step 4.3',
        status: orgAdminRole ? 'PASS' : 'WARN',
        message: orgAdminRole ? 'ORG_ADMIN role exists' : 'ORG_ADMIN role missing',
      });

      this.log({
        step: 'Step 4.4',
        status: memberRole ? 'PASS' : 'WARN',
        message: memberRole ? 'MEMBER role exists' : 'MEMBER role missing',
      });
    } catch (error) {
      this.log({
        step: 'Step 4.1',
        status: 'FAIL',
        message: 'Could not read roles collection',
        details: error,
      });
    }
  }

  /**
   * Seed roles only (without full database initialization)
   */
  static async seedRoles(): Promise<void> {
    console.log('\n🔐 Seeding roles collection...\n');

    try {
      await RoleService.seedDefaultRoles();
      console.log('✅ Roles seeded successfully!');

      // Show what was created
      const roles = await RoleService.getAll();
      console.log('\nRoles created:');
      roles.forEach(role => {
        console.log(`  - ${role.roleId}: ${role.roleName}`);
      });
    } catch (error) {
      console.error('❌ Error seeding roles:', error);
      throw error;
    }
  }

  /**
   * Create user_roles entry for an existing user
   */
  static async assignUserRole(
    userId: string,
    roleId: string,
    organizationId: string
  ): Promise<void> {
    console.log(`\n🔐 Assigning role ${roleId} to user ${userId}...\n`);

    try {
      const mapping = await UserRoleService.assignRole(userId, roleId, organizationId);
      console.log('✅ Role assigned successfully!');
      console.log('Mapping:', mapping);
    } catch (error) {
      console.error('❌ Error assigning role:', error);
      throw error;
    }
  }

  /**
   * Run seeding (actually creates Root and Default orgs)
   */
  static async runSeeding(superAdminUid?: string, superAdminEmail?: string): Promise<void> {
    console.log('\n🌱 Running database seeding...\n');

    const result = await DatabaseSeedService.initialize({
      superAdminUid,
      superAdminEmail,
    });

    console.log('Root Org:', result.rootOrg);
    console.log('Default Org:', result.defaultOrg);
    if (result.superAdmin) {
      console.log('Super Admin:', result.superAdmin);
    }
  }

  /**
   * Run migration (actually migrates archaeologists to users)
   */
  static async runMigration(options?: {
    dryRun?: boolean;
    orgAdminUids?: string[];
    superAdminUids?: string[];
  }): Promise<void> {
    console.log('\n📦 Running migration...\n');

    const result = await DatabaseMigrationService.migrateArchaeologistsToUsers({
      dryRun: options?.dryRun ?? false,
      orgAdminUids: options?.orgAdminUids,
      superAdminUids: options?.superAdminUids,
    });

    console.log('Migration Result:', result);
  }
}

// Export for easy console access
if (typeof window !== 'undefined') {
  (window as any).MigrationValidator = MigrationValidator;
}

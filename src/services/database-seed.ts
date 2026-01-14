import { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrganizationService } from './organizations';
import { UserService } from './users';
import { RoleService } from './roles';
import { UserRoleService } from './userRoles';
import {
  Organization,
  User,
  ROOT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ID,
  SUBSCRIPTION_LEVELS,
  ROLE_IDS,
} from '@/types/organization';

/**
 * Database Seeding Service
 *
 * This service handles the initial seeding of critical data:
 * 1. Root Organization (FLL Global IT)
 * 2. Default Organization (Public Sandbox)
 * 3. First Super Admin (optional, if UID provided)
 *
 * Usage:
 * - Call `DatabaseSeedService.initialize()` during app startup
 * - The seeding is idempotent - safe to call multiple times
 */

export interface SeedConfig {
  rootOrgName?: string;
  defaultOrgName?: string;
  superAdminUid?: string;
  superAdminEmail?: string;
}

const DEFAULT_CONFIG: Required<Omit<SeedConfig, 'superAdminUid' | 'superAdminEmail'>> = {
  rootOrgName: 'FLL Global IT',
  defaultOrgName: 'Public Sandbox',
};

export class DatabaseSeedService {
  /**
   * Initialize the database with required seed data
   * This is idempotent - safe to call on every app startup
   */
  static async initialize(config: SeedConfig = {}): Promise<{
    rootOrg: Organization;
    defaultOrg: Organization;
    superAdmin?: User;
  }> {
    console.log('🌱 Starting database initialization...');

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // 1. Seed Roles first (needed for user role assignments)
    await RoleService.seedDefaultRoles();
    console.log('✅ Roles seeded');

    // 2. Seed Root Organization
    const rootOrg = await this.seedRootOrganization(mergedConfig.rootOrgName);
    console.log('✅ Root organization ready:', rootOrg.name);

    // 3. Seed Default Organization
    const defaultOrg = await this.seedDefaultOrganization(mergedConfig.defaultOrgName);
    console.log('✅ Default organization ready:', defaultOrg.name);

    // 4. Seed Super Admin (if provided)
    let superAdmin: User | undefined;
    if (config.superAdminUid && config.superAdminEmail) {
      superAdmin = await this.seedSuperAdmin(
        config.superAdminUid,
        config.superAdminEmail
      );
      console.log('✅ Super admin ready:', superAdmin.email);
    }

    console.log('🌱 Database initialization complete!');

    return { rootOrg, defaultOrg, superAdmin };
  }

  /**
   * Seed the Root Organization
   */
  static async seedRootOrganization(name: string): Promise<Organization> {
    // Check if already exists
    const existing = await OrganizationService.getById(ROOT_ORGANIZATION_ID);

    if (existing) {
      return existing;
    }

    // Create the Root organization
    return OrganizationService.create(
      {
        name,
        type: 'ROOT',
        parentId: null,
        subscriptionLevel: SUBSCRIPTION_LEVELS.ENTERPRISE,
      },
      ROOT_ORGANIZATION_ID
    );
  }

  /**
   * Seed the Default Organization
   */
  static async seedDefaultOrganization(name: string): Promise<Organization> {
    // Check if already exists
    const existing = await OrganizationService.getById(DEFAULT_ORGANIZATION_ID);

    if (existing) {
      return existing;
    }

    // Create the Default organization
    return OrganizationService.create(
      {
        name,
        type: 'DEFAULT',
        parentId: null,
        subscriptionLevel: SUBSCRIPTION_LEVELS.FREE,
      },
      DEFAULT_ORGANIZATION_ID
    );
  }

  /**
   * Seed the first Super Admin user
   */
  static async seedSuperAdmin(uid: string, email: string): Promise<User> {
    // Check if user already exists
    const existing = await UserService.getByUid(uid);

    if (existing) {
      // If user exists but is not super admin, promote them
      if (existing.role !== 'SUPER_ADMIN') {
        await UserService.updateRole(uid, 'SUPER_ADMIN');
        // Also update user_roles
        await UserRoleService.assignRole(uid, ROLE_IDS.SUPER_ADMIN, ROOT_ORGANIZATION_ID);
        return { ...existing, role: 'SUPER_ADMIN' };
      }
      // Ensure user_roles entry exists
      const userRole = await UserRoleService.getUserRoleInOrganization(uid, ROOT_ORGANIZATION_ID);
      if (!userRole) {
        await UserRoleService.create({
          userId: uid,
          roleId: ROLE_IDS.SUPER_ADMIN,
          organizationId: ROOT_ORGANIZATION_ID,
        });
      }
      return existing;
    }

    // Create the Super Admin user
    const user = await UserService.create({
      uid,
      email,
      organizationId: ROOT_ORGANIZATION_ID,
      role: 'SUPER_ADMIN',
    });

    // Create user_roles entry
    await UserRoleService.create({
      userId: uid,
      roleId: ROLE_IDS.SUPER_ADMIN,
      organizationId: ROOT_ORGANIZATION_ID,
    });

    return user;
  }

  /**
   * Check if the database has been seeded
   */
  static async isSeeded(): Promise<boolean> {
    const rootOrg = await OrganizationService.getById(ROOT_ORGANIZATION_ID);
    const defaultOrg = await OrganizationService.getById(DEFAULT_ORGANIZATION_ID);
    const rolesSeeded = await RoleService.isSeeded();

    return rootOrg !== null && defaultOrg !== null && rolesSeeded;
  }

  /**
   * Get seeding status details
   */
  static async getStatus(): Promise<{
    isSeeded: boolean;
    hasRootOrg: boolean;
    hasDefaultOrg: boolean;
    hasRoles: boolean;
    hasSuperAdmin: boolean;
    superAdminCount: number;
    roleCount: number;
  }> {
    const rootOrg = await OrganizationService.getById(ROOT_ORGANIZATION_ID);
    const defaultOrg = await OrganizationService.getById(DEFAULT_ORGANIZATION_ID);
    const roles = await RoleService.getAll();
    const rolesSeeded = await RoleService.isSeeded();

    let superAdminCount = 0;
    if (rootOrg) {
      const rootUsers = await UserService.getByOrganization(ROOT_ORGANIZATION_ID);
      superAdminCount = rootUsers.filter(u => u.role === 'SUPER_ADMIN').length;
    }

    return {
      isSeeded: rootOrg !== null && defaultOrg !== null && rolesSeeded,
      hasRootOrg: rootOrg !== null,
      hasDefaultOrg: defaultOrg !== null,
      hasRoles: rolesSeeded,
      hasSuperAdmin: superAdminCount > 0,
      superAdminCount,
      roleCount: roles.length,
    };
  }
}

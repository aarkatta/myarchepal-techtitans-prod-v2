/**
 * Development Tools
 *
 * This file exposes useful utilities on the window object for browser console access.
 * Only use in development!
 *
 * Usage in browser console:
 *   await DevTools.seedRoles()
 *   await DevTools.seedAll()
 *   await DevTools.assignRole('userId', 'SUPER_ADMIN', 'root-org')
 */

import { RoleService } from '@/services/roles';
import { UserRoleService } from '@/services/userRoles';
import { DatabaseSeedService } from '@/services/database-seed';
import { UserService } from '@/services/users';
import { OrganizationService } from '@/services/organizations';
import { ROLE_IDS, DEFAULT_ORGANIZATION_ID, ROOT_ORGANIZATION_ID } from '@/types/organization';

export const DevTools = {
  /**
   * Seed roles collection with default roles
   */
  async seedRoles() {
    console.log('🔐 Seeding roles...');
    await RoleService.seedDefaultRoles();
    const roles = await RoleService.getAll();
    console.log('✅ Roles seeded:', roles.map(r => r.roleId));
    return roles;
  },

  /**
   * Seed everything (roles + organizations)
   */
  async seedAll(superAdminUid?: string, superAdminEmail?: string) {
    console.log('🌱 Seeding database...');
    const result = await DatabaseSeedService.initialize({
      superAdminUid,
      superAdminEmail,
    });
    console.log('✅ Database seeded!');
    console.log('  - Root Org:', result.rootOrg.name);
    console.log('  - Default Org:', result.defaultOrg.name);
    if (result.superAdmin) {
      console.log('  - Super Admin:', result.superAdmin.email);
    }
    return result;
  },

  /**
   * Assign a role to a user
   */
  async assignRole(userId: string, roleId: string, organizationId: string) {
    console.log(`🔐 Assigning ${roleId} to ${userId} in ${organizationId}...`);
    const mapping = await UserRoleService.assignRole(userId, roleId, organizationId);
    console.log('✅ Role assigned!', mapping);
    return mapping;
  },

  /**
   * Make a user a Super Admin
   */
  async makeSuperAdmin(userId: string) {
    console.log(`👑 Making ${userId} a Super Admin...`);

    // First ensure user has required fields (status, etc.)
    await this.fixUser(userId);

    // Update user record
    await UserService.updateRole(userId, 'SUPER_ADMIN');

    // Also update organizationId to root-org for super admins
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    if (db) {
      const userDoc = doc(db, 'users', userId);
      await updateDoc(userDoc, {
        organizationId: ROOT_ORGANIZATION_ID,
        updatedAt: Timestamp.now(),
      });
    }

    // Create/update user_roles entry
    const mapping = await UserRoleService.assignRole(userId, ROLE_IDS.SUPER_ADMIN, ROOT_ORGANIZATION_ID);

    console.log('✅ User is now Super Admin!');
    return mapping;
  },

  /**
   * Fix a user document by adding missing required fields
   */
  async fixUser(userId: string) {
    console.log(`🔧 Fixing user ${userId}...`);

    const { doc, getDoc, updateDoc, Timestamp } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userDoc = doc(db, 'users', userId);
    const userSnap = await getDoc(userDoc);

    if (!userSnap.exists()) {
      throw new Error(`User ${userId} not found`);
    }

    const userData = userSnap.data();
    const updates: Record<string, unknown> = {};

    // Add missing status field
    if (!userData.status) {
      updates.status = 'ACTIVE';
      console.log('  - Adding status: ACTIVE');
    }

    // Add missing timestamps
    if (!userData.createdAt) {
      updates.createdAt = Timestamp.now();
      console.log('  - Adding createdAt');
    }

    if (!userData.updatedAt) {
      updates.updatedAt = Timestamp.now();
      console.log('  - Adding updatedAt');
    }

    // Add missing id field
    if (!userData.id) {
      updates.id = userId;
      console.log('  - Adding id');
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(userDoc, updates);
      console.log('✅ User fixed!');
    } else {
      console.log('✅ User already has all required fields');
    }

    return updates;
  },

  /**
   * Get all roles
   */
  async getRoles() {
    const roles = await RoleService.getAll();
    console.table(roles.map(r => ({ roleId: r.roleId, roleName: r.roleName, description: r.description })));
    return roles;
  },

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string) {
    const roles = await UserRoleService.getByUserId(userId);
    console.table(roles);
    return roles;
  },

  /**
   * Get all users
   */
  async getUsers() {
    const users = await UserService.getAll();
    console.table(users.map(u => ({ uid: u.uid, email: u.email, role: u.role, orgId: u.organizationId })));
    return users;
  },

  /**
   * Get seeding status
   */
  async getStatus() {
    const status = await DatabaseSeedService.getStatus();
    console.log('📊 Database Status:');
    console.log('  - Root Org:', status.hasRootOrg ? '✅' : '❌');
    console.log('  - Default Org:', status.hasDefaultOrg ? '✅' : '❌');
    console.log('  - Roles:', status.hasRoles ? `✅ (${status.roleCount})` : '❌');
    console.log('  - Super Admins:', status.superAdminCount);
    return status;
  },

  // Constants for easy reference
  ROLE_IDS,
  ROOT_ORG: ROOT_ORGANIZATION_ID,
  DEFAULT_ORG: DEFAULT_ORGANIZATION_ID,
};

// Expose on window in development
if (typeof window !== 'undefined') {
  (window as any).DevTools = DevTools;
  console.log('🛠️ DevTools available! Try: DevTools.getStatus()');
}

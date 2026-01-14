import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  UserRoleMapping,
  CreateUserRoleMappingInput,
  UserRole,
  ROLE_IDS,
} from '@/types/organization';

const COLLECTION_NAME = 'user_roles';

export class UserRoleService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get a user role mapping by document ID
   */
  static async getById(id: string): Promise<UserRoleMapping | null> {
    try {
      if (!db) return null;

      const mappingDoc = doc(db, COLLECTION_NAME, id);
      const mappingSnap = await getDoc(mappingDoc);

      if (mappingSnap.exists()) {
        return { id: mappingSnap.id, ...mappingSnap.data() } as UserRoleMapping;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching user role mapping by id:', error);
      return null;
    }
  }

  /**
   * Get all role mappings for a user
   */
  static async getByUserId(userId: string): Promise<UserRoleMapping[]> {
    try {
      if (!db) return [];

      const mappingsCollection = collection(db, COLLECTION_NAME);
      const q = query(mappingsCollection, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as UserRoleMapping));
    } catch (error) {
      console.error('❌ Error fetching user role mappings by userId:', error);
      return [];
    }
  }

  /**
   * Get user's role in a specific organization
   */
  static async getUserRoleInOrganization(
    userId: string,
    organizationId: string
  ): Promise<UserRoleMapping | null> {
    try {
      if (!db) return null;

      const mappingsCollection = collection(db, COLLECTION_NAME);
      const q = query(
        mappingsCollection,
        where('userId', '==', userId),
        where('organizationId', '==', organizationId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const mappingDoc = querySnapshot.docs[0];
        return { id: mappingDoc.id, ...mappingDoc.data() } as UserRoleMapping;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching user role in organization:', error);
      return null;
    }
  }

  /**
   * Get all users with a specific role in an organization
   */
  static async getUsersByRoleInOrganization(
    roleId: string,
    organizationId: string
  ): Promise<UserRoleMapping[]> {
    try {
      if (!db) return [];

      const mappingsCollection = collection(db, COLLECTION_NAME);
      const q = query(
        mappingsCollection,
        where('roleId', '==', roleId),
        where('organizationId', '==', organizationId)
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as UserRoleMapping));
    } catch (error) {
      console.error('❌ Error fetching users by role in organization:', error);
      return [];
    }
  }

  /**
   * Get all role mappings for an organization
   */
  static async getByOrganization(organizationId: string): Promise<UserRoleMapping[]> {
    try {
      if (!db) return [];

      const mappingsCollection = collection(db, COLLECTION_NAME);
      const q = query(mappingsCollection, where('organizationId', '==', organizationId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as UserRoleMapping));
    } catch (error) {
      console.error('❌ Error fetching role mappings by organization:', error);
      return [];
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /**
   * Create a new user role mapping
   */
  static async create(input: CreateUserRoleMappingInput): Promise<UserRoleMapping> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Check if user already has a role in this organization
      const existing = await this.getUserRoleInOrganization(
        input.userId,
        input.organizationId
      );

      if (existing) {
        throw new Error('User already has a role in this organization');
      }

      const now = Timestamp.now();
      // Use composite key: userId_organizationId
      const mappingId = `${input.userId}_${input.organizationId}`;

      const mapping: UserRoleMapping = {
        id: mappingId,
        userId: input.userId,
        roleId: input.roleId,
        organizationId: input.organizationId,
        assignedBy: input.assignedBy || null,
        createdAt: now,
        updatedAt: now,
      };

      const mappingDoc = doc(db, COLLECTION_NAME, mappingId);
      await setDoc(mappingDoc, mapping);

      console.log('✅ User role mapping created:', mappingId);
      return mapping;
    } catch (error) {
      console.error('❌ Error creating user role mapping:', error);
      throw error;
    }
  }

  /**
   * Update user's role in an organization
   */
  static async updateRole(
    userId: string,
    organizationId: string,
    newRoleId: string,
    assignedBy?: string
  ): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const mappingId = `${userId}_${organizationId}`;
      const mappingDoc = doc(db, COLLECTION_NAME, mappingId);

      const updateData: Record<string, unknown> = {
        roleId: newRoleId,
        updatedAt: Timestamp.now(),
      };

      if (assignedBy) {
        updateData.assignedBy = assignedBy;
      }

      await updateDoc(mappingDoc, updateData);

      console.log('✅ User role updated:', mappingId, newRoleId);
    } catch (error) {
      console.error('❌ Error updating user role:', error);
      throw error;
    }
  }

  /**
   * Remove user's role from an organization
   */
  static async delete(userId: string, organizationId: string): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const mappingId = `${userId}_${organizationId}`;
      const mappingDoc = doc(db, COLLECTION_NAME, mappingId);
      await deleteDoc(mappingDoc);

      console.log('✅ User role mapping deleted:', mappingId);
    } catch (error) {
      console.error('❌ Error deleting user role mapping:', error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check if user has a specific role in any organization
   */
  static async hasRole(userId: string, roleId: string): Promise<boolean> {
    try {
      if (!db) return false;

      const mappingsCollection = collection(db, COLLECTION_NAME);
      const q = query(
        mappingsCollection,
        where('userId', '==', userId),
        where('roleId', '==', roleId)
      );
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error('❌ Error checking user role:', error);
      return false;
    }
  }

  /**
   * Check if user is a Super Admin
   */
  static async isSuperAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, ROLE_IDS.SUPER_ADMIN);
  }

  /**
   * Check if user is an Org Admin in any organization
   */
  static async isOrgAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, ROLE_IDS.ORG_ADMIN);
  }

  /**
   * Check if user is an admin (Super Admin or Org Admin) in any organization
   */
  static async isAdmin(userId: string): Promise<boolean> {
    const [isSuperAdmin, isOrgAdmin] = await Promise.all([
      this.isSuperAdmin(userId),
      this.isOrgAdmin(userId),
    ]);
    return isSuperAdmin || isOrgAdmin;
  }

  /**
   * Get the highest privilege role for a user
   * Returns: SUPER_ADMIN > ORG_ADMIN > MEMBER > null
   */
  static async getHighestRole(userId: string): Promise<UserRole | null> {
    const roles = await this.getByUserId(userId);

    if (roles.length === 0) return null;

    // Check for highest privilege
    if (roles.some(r => r.roleId === ROLE_IDS.SUPER_ADMIN)) {
      return 'SUPER_ADMIN';
    }
    if (roles.some(r => r.roleId === ROLE_IDS.ORG_ADMIN)) {
      return 'ORG_ADMIN';
    }
    if (roles.some(r => r.roleId === ROLE_IDS.MEMBER)) {
      return 'MEMBER';
    }

    return null;
  }

  /**
   * Assign a role to a user (creates or updates)
   */
  static async assignRole(
    userId: string,
    roleId: string,
    organizationId: string,
    assignedBy?: string
  ): Promise<UserRoleMapping> {
    const existing = await this.getUserRoleInOrganization(userId, organizationId);

    if (existing) {
      await this.updateRole(userId, organizationId, roleId, assignedBy);
      return { ...existing, roleId, updatedAt: Timestamp.now() };
    }

    return this.create({
      userId,
      roleId,
      organizationId,
      assignedBy,
    });
  }
}

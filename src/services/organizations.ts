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
  Organization,
  CreateOrganizationInput,
  OrganizationType,
  OrganizationStatus,
  ROOT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ID,
  SUBSCRIPTION_LEVELS,
} from '@/types/organization';

const COLLECTION_NAME = 'organizations';

export class OrganizationService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get an organization by ID
   */
  static async getById(id: string): Promise<Organization | null> {
    try {
      if (!db) return null;

      const orgDoc = doc(db, COLLECTION_NAME, id);
      const orgSnap = await getDoc(orgDoc);

      if (orgSnap.exists()) {
        return { id: orgSnap.id, ...orgSnap.data() } as Organization;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching organization:', error);
      return null;
    }
  }

  /**
   * Get the Root organization
   */
  static async getRootOrganization(): Promise<Organization | null> {
    return this.getById(ROOT_ORGANIZATION_ID);
  }

  /**
   * Get the Default organization (fallback for unassigned users)
   */
  static async getDefaultOrganization(): Promise<Organization | null> {
    return this.getById(DEFAULT_ORGANIZATION_ID);
  }

  /**
   * Get all organizations
   */
  static async getAll(): Promise<Organization[]> {
    try {
      if (!db) return [];

      const orgsCollection = collection(db, COLLECTION_NAME);
      const querySnapshot = await getDocs(orgsCollection);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Organization));
    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      return [];
    }
  }

  /**
   * Get organizations by type
   */
  static async getByType(type: OrganizationType): Promise<Organization[]> {
    try {
      if (!db) return [];

      const orgsCollection = collection(db, COLLECTION_NAME);
      const q = query(orgsCollection, where('type', '==', type));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Organization));
    } catch (error) {
      console.error('❌ Error fetching organizations by type:', error);
      return [];
    }
  }

  /**
   * Get child organizations of a parent
   */
  static async getChildren(parentId: string): Promise<Organization[]> {
    try {
      if (!db) return [];

      const orgsCollection = collection(db, COLLECTION_NAME);
      const q = query(orgsCollection, where('parentId', '==', parentId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Organization));
    } catch (error) {
      console.error('❌ Error fetching child organizations:', error);
      return [];
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /**
   * Create a new organization
   * Only SUPER_ADMINs should be able to call this
   */
  static async create(input: CreateOrganizationInput, customId?: string): Promise<Organization> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const now = Timestamp.now();
      const orgId = customId || doc(collection(db, COLLECTION_NAME)).id;

      const organization: Organization = {
        id: orgId,
        name: input.name,
        type: input.type,
        parentId: input.parentId ?? null,
        subscriptionLevel: input.subscriptionLevel ?? SUBSCRIPTION_LEVELS.FREE,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };

      const orgDoc = doc(db, COLLECTION_NAME, orgId);
      await setDoc(orgDoc, organization);

      console.log('✅ Organization created:', orgId);
      return organization;
    } catch (error) {
      console.error('❌ Error creating organization:', error);
      throw error;
    }
  }

  /**
   * Update an organization
   */
  static async update(
    id: string,
    updates: Partial<Pick<Organization, 'name' | 'subscriptionLevel' | 'status'>>
  ): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Prevent modification of Root and Default orgs' critical fields
      if (id === ROOT_ORGANIZATION_ID || id === DEFAULT_ORGANIZATION_ID) {
        // Only allow status updates for system orgs
        const allowedUpdates = { status: updates.status };
        const filteredUpdates = Object.fromEntries(
          Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
        );

        if (Object.keys(filteredUpdates).length === 0) {
          console.warn('Cannot modify system organization fields');
          return;
        }

        updates = filteredUpdates;
      }

      const orgDoc = doc(db, COLLECTION_NAME, id);
      await updateDoc(orgDoc, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      console.log('✅ Organization updated:', id);
    } catch (error) {
      console.error('❌ Error updating organization:', error);
      throw error;
    }
  }

  /**
   * Update organization status
   */
  static async updateStatus(id: string, status: OrganizationStatus): Promise<void> {
    return this.update(id, { status });
  }

  /**
   * Suspend an organization (sets status to SUSPENDED)
   */
  static async suspend(id: string): Promise<void> {
    if (id === ROOT_ORGANIZATION_ID) {
      throw new Error('Cannot suspend the Root organization');
    }
    return this.updateStatus(id, 'SUSPENDED');
  }

  /**
   * Activate an organization (sets status to ACTIVE)
   */
  static async activate(id: string): Promise<void> {
    return this.updateStatus(id, 'ACTIVE');
  }

  /**
   * Delete an organization
   * Only SUPER_ADMINs should be able to call this
   */
  static async delete(id: string): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Prevent deletion of system organizations
      if (id === ROOT_ORGANIZATION_ID || id === DEFAULT_ORGANIZATION_ID) {
        throw new Error('Cannot delete system organizations');
      }

      const orgDoc = doc(db, COLLECTION_NAME, id);
      await deleteDoc(orgDoc);

      console.log('✅ Organization deleted:', id);
    } catch (error) {
      console.error('❌ Error deleting organization:', error);
      throw error;
    }
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Check if an organization exists
   */
  static async exists(id: string): Promise<boolean> {
    const org = await this.getById(id);
    return org !== null;
  }

  /**
   * Check if an organization is active
   */
  static async isActive(id: string): Promise<boolean> {
    const org = await this.getById(id);
    return org?.status === 'ACTIVE';
  }

  /**
   * Check if user can access organization (for multi-tenant isolation)
   */
  static async canAccess(userOrgId: string, targetOrgId: string, userRole: string): Promise<boolean> {
    // Super admins can access all organizations
    if (userRole === 'SUPER_ADMIN') {
      return true;
    }

    // Regular users can only access their own organization
    return userOrgId === targetOrgId;
  }
}

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Role,
  CreateRoleInput,
  DEFAULT_ROLES,
} from '@/types/organization';

const COLLECTION_NAME = 'roles';

export class RoleService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get a role by document ID
   */
  static async getById(id: string): Promise<Role | null> {
    try {
      if (!db) return null;

      const roleDoc = doc(db, COLLECTION_NAME, id);
      const roleSnap = await getDoc(roleDoc);

      if (roleSnap.exists()) {
        return { id: roleSnap.id, ...roleSnap.data() } as Role;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching role by id:', error);
      return null;
    }
  }

  /**
   * Get a role by roleId (e.g., 'SUPER_ADMIN')
   */
  static async getByRoleId(roleId: string): Promise<Role | null> {
    try {
      if (!db) return null;

      const rolesCollection = collection(db, COLLECTION_NAME);
      const q = query(rolesCollection, where('roleId', '==', roleId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const roleDoc = querySnapshot.docs[0];
        return { id: roleDoc.id, ...roleDoc.data() } as Role;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching role by roleId:', error);
      return null;
    }
  }

  /**
   * Get all roles
   */
  static async getAll(): Promise<Role[]> {
    try {
      if (!db) return [];

      const rolesCollection = collection(db, COLLECTION_NAME);
      const querySnapshot = await getDocs(rolesCollection);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Role));
    } catch (error) {
      console.error('❌ Error fetching all roles:', error);
      return [];
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /**
   * Create a new role
   */
  static async create(input: CreateRoleInput): Promise<Role> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const now = Timestamp.now();
      // Use roleId as document ID for easy lookup
      const roleDocId = input.roleId;

      const role: Role = {
        id: roleDocId,
        roleId: input.roleId,
        roleName: input.roleName,
        description: input.description || '',
        permissions: input.permissions || [],
        createdAt: now,
        updatedAt: now,
      };

      const roleDoc = doc(db, COLLECTION_NAME, roleDocId);
      await setDoc(roleDoc, role);

      console.log('✅ Role created:', roleDocId);
      return role;
    } catch (error) {
      console.error('❌ Error creating role:', error);
      throw error;
    }
  }

  // ============================================================================
  // SEED OPERATIONS
  // ============================================================================

  /**
   * Seed default roles if they don't exist
   */
  static async seedDefaultRoles(): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      console.log('🌱 Seeding default roles...');

      for (const roleInput of DEFAULT_ROLES) {
        const existingRole = await this.getByRoleId(roleInput.roleId);

        if (!existingRole) {
          await this.create(roleInput);
          console.log(`✅ Created role: ${roleInput.roleId}`);
        } else {
          console.log(`⏭️ Role already exists: ${roleInput.roleId}`);
        }
      }

      console.log('✅ Default roles seeding complete');
    } catch (error) {
      console.error('❌ Error seeding default roles:', error);
      throw error;
    }
  }

  /**
   * Check if roles collection is seeded
   */
  static async isSeeded(): Promise<boolean> {
    const roles = await this.getAll();
    return roles.length >= DEFAULT_ROLES.length;
  }
}

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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import {
  User,
  CreateUserInput,
  UserRole,
  UserStatus,
  DEFAULT_ORGANIZATION_ID,
} from '@/types/organization';

const COLLECTION_NAME = 'users';

export class UserService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get a user by their document ID
   */
  static async getById(id: string): Promise<User | null> {
    try {
      if (!db) return null;

      const userDoc = doc(db, COLLECTION_NAME, id);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() } as User;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching user by id:', error);
      return null;
    }
  }

  /**
   * Get a user by their Firebase Auth UID
   */
  static async getByUid(uid: string): Promise<User | null> {
    try {
      if (!db) return null;

      const usersCollection = collection(db, COLLECTION_NAME);
      const q = query(usersCollection, where('uid', '==', uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return { id: userDoc.id, ...userDoc.data() } as User;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching user by uid:', error);
      return null;
    }
  }

  /**
   * Get all users in an organization
   */
  static async getByOrganization(organizationId: string): Promise<User[]> {
    try {
      if (!db) return [];

      const usersCollection = collection(db, COLLECTION_NAME);
      const q = query(usersCollection, where('organizationId', '==', organizationId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as User));
    } catch (error) {
      console.error('❌ Error fetching users by organization:', error);
      return [];
    }
  }

  /**
   * Get all users (SUPER_ADMIN only)
   */
  static async getAll(): Promise<User[]> {
    try {
      if (!db) return [];

      const usersCollection = collection(db, COLLECTION_NAME);
      const querySnapshot = await getDocs(usersCollection);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as User));
    } catch (error) {
      console.error('❌ Error fetching all users:', error);
      return [];
    }
  }

  /**
   * Get users by role within an organization
   */
  static async getByRole(organizationId: string, role: UserRole): Promise<User[]> {
    try {
      if (!db) return [];

      const usersCollection = collection(db, COLLECTION_NAME);
      const q = query(
        usersCollection,
        where('organizationId', '==', organizationId),
        where('role', '==', role)
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as User));
    } catch (error) {
      console.error('❌ Error fetching users by role:', error);
      return [];
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /**
   * Create a new user
   * Called during registration or when accepting an invitation
   */
  static async create(input: CreateUserInput): Promise<User> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const now = Timestamp.now();
      // Use UID as document ID for easy lookup
      const userId = input.uid;

      // Build user object with required fields
      const user: Record<string, unknown> = {
        id: userId,
        uid: input.uid,
        email: input.email,
        organizationId: input.organizationId || DEFAULT_ORGANIZATION_ID,
        role: input.role || 'MEMBER',
        status: 'ACTIVE',
        invitedBy: input.invitedBy ?? null,
        createdAt: now,
        updatedAt: now,
      };

      // Only add optional fields if they have values (Firestore rejects undefined)
      if (input.displayName !== undefined) user.displayName = input.displayName;
      if (input.photoURL !== undefined) user.photoURL = input.photoURL;
      if (input.institution !== undefined) user.institution = input.institution;
      if (input.specialization !== undefined) user.specialization = input.specialization;
      if (input.credentials !== undefined) user.credentials = input.credentials;

      const userDoc = doc(db, COLLECTION_NAME, userId);
      await setDoc(userDoc, user);

      console.log('✅ User created:', userId);
      return user as User;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    uid: string,
    updates: Partial<Pick<User, 'displayName' | 'photoURL' | 'institution' | 'specialization' | 'credentials' | 'activeProjectId'>>
  ): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Filter out undefined values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      if (Object.keys(filteredUpdates).length === 0) {
        console.log('No valid updates to apply');
        return;
      }

      const userDoc = doc(db, COLLECTION_NAME, uid);
      await updateDoc(userDoc, {
        ...filteredUpdates,
        updatedAt: Timestamp.now(),
      });

      console.log('✅ User profile updated:', uid);
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Update user role (ORG_ADMIN or SUPER_ADMIN only)
   */
  static async updateRole(uid: string, role: UserRole): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const userDoc = doc(db, COLLECTION_NAME, uid);
      await updateDoc(userDoc, {
        role,
        updatedAt: Timestamp.now(),
      });

      console.log('✅ User role updated:', uid, role);
    } catch (error) {
      console.error('❌ Error updating user role:', error);
      throw error;
    }
  }

  /**
   * Update user status
   */
  static async updateStatus(uid: string, status: UserStatus): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const userDoc = doc(db, COLLECTION_NAME, uid);
      await updateDoc(userDoc, {
        status,
        updatedAt: Timestamp.now(),
      });

      console.log('✅ User status updated:', uid, status);
    } catch (error) {
      console.error('❌ Error updating user status:', error);
      throw error;
    }
  }

  /**
   * Move user to default organization (e.g., when subscription expires)
   */
  static async moveToDefaultOrganization(uid: string): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const userDoc = doc(db, COLLECTION_NAME, uid);
      await updateDoc(userDoc, {
        organizationId: DEFAULT_ORGANIZATION_ID,
        role: 'MEMBER', // Demote to member when moving to default
        updatedAt: Timestamp.now(),
      });

      console.log('✅ User moved to default organization:', uid);
    } catch (error) {
      console.error('❌ Error moving user to default organization:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  static async delete(uid: string): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Get user to check for profile picture
      const user = await this.getByUid(uid);

      // Delete profile picture from Storage if exists
      if (user?.photoURL && storage) {
        try {
          await this.deleteProfilePicture(user.photoURL);
        } catch (error) {
          console.warn('Could not delete profile picture:', error);
        }
      }

      const userDoc = doc(db, COLLECTION_NAME, uid);
      await deleteDoc(userDoc);

      console.log('✅ User deleted:', uid);
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw error;
    }
  }

  // ============================================================================
  // PROFILE PICTURE OPERATIONS
  // ============================================================================

  /**
   * Upload profile picture to Firebase Storage
   */
  static async uploadProfilePicture(uid: string, file: File): Promise<string> {
    try {
      if (!storage) {
        throw new Error('Firebase Storage is not properly initialized');
      }

      const timestamp = Date.now();
      const filename = `profile-pictures/${uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, filename);

      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update user profile with new photo URL
      await this.updateProfile(uid, { photoURL: downloadURL });

      console.log('✅ Profile picture uploaded:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Error uploading profile picture:', error);
      throw error;
    }
  }

  /**
   * Delete profile picture from Firebase Storage
   */
  static async deleteProfilePicture(photoURL: string): Promise<void> {
    try {
      if (!storage) {
        throw new Error('Firebase Storage is not properly initialized');
      }

      const imageRef = ref(storage, photoURL);
      await deleteObject(imageRef);
      console.log('✅ Profile picture deleted');
    } catch (error) {
      console.error('❌ Error deleting profile picture:', error);
    }
  }

  // ============================================================================
  // ACTIVE PROJECT OPERATIONS (Legacy archaeologist functionality)
  // ============================================================================

  /**
   * Set active project for a user
   */
  static async setActiveProject(uid: string, siteId: string | null): Promise<void> {
    return this.updateProfile(uid, { activeProjectId: siteId ?? undefined });
  }

  /**
   * Get active project ID for a user
   */
  static async getActiveProjectId(uid: string): Promise<string | null> {
    const user = await this.getByUid(uid);
    return user?.activeProjectId || null;
  }

  // ============================================================================
  // PERMISSION CHECKS
  // ============================================================================

  /**
   * Check if user exists
   */
  static async exists(uid: string): Promise<boolean> {
    const user = await this.getByUid(uid);
    return user !== null;
  }

  /**
   * Check if user is active
   */
  static async isActive(uid: string): Promise<boolean> {
    const user = await this.getByUid(uid);
    return user?.status === 'ACTIVE';
  }

  /**
   * Check if user is a Super Admin
   */
  static async isSuperAdmin(uid: string): Promise<boolean> {
    const user = await this.getByUid(uid);
    return user?.role === 'SUPER_ADMIN';
  }

  /**
   * Check if user is an Org Admin
   */
  static async isOrgAdmin(uid: string): Promise<boolean> {
    const user = await this.getByUid(uid);
    return user?.role === 'ORG_ADMIN';
  }

  /**
   * Check if user has admin privileges (SUPER_ADMIN or ORG_ADMIN)
   */
  static async isAdmin(uid: string): Promise<boolean> {
    const user = await this.getByUid(uid);
    return user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN';
  }

  /**
   * Check if user can manage another user
   */
  static async canManageUser(managerUid: string, targetUid: string): Promise<boolean> {
    const manager = await this.getByUid(managerUid);
    const target = await this.getByUid(targetUid);

    if (!manager || !target) return false;

    // Super admins can manage anyone
    if (manager.role === 'SUPER_ADMIN') return true;

    // Org admins can only manage users in their organization
    if (manager.role === 'ORG_ADMIN') {
      return manager.organizationId === target.organizationId;
    }

    return false;
  }

  /**
   * Legacy compatibility: Check if user is an approved archaeologist
   * In the new system, any active user in a subscribed org is considered "approved"
   */
  static async isArchaeologist(uid: string): Promise<boolean> {
    const user = await this.getByUid(uid);
    if (!user) return false;

    // User must be active and not in the default organization
    return user.status === 'ACTIVE' && user.organizationId !== DEFAULT_ORGANIZATION_ID;
  }
}

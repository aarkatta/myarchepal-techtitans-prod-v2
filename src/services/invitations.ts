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
  Invitation,
  CreateInvitationInput,
  InvitationStatus,
} from '@/types/organization';

const COLLECTION_NAME = 'invitations';

// Default invitation expiry in days
const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Generate a unique invitation token
 */
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export class InvitationService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get an invitation by ID
   */
  static async getById(id: string): Promise<Invitation | null> {
    try {
      if (!db) return null;

      const inviteDoc = doc(db, COLLECTION_NAME, id);
      const inviteSnap = await getDoc(inviteDoc);

      if (inviteSnap.exists()) {
        return { id: inviteSnap.id, ...inviteSnap.data() } as Invitation;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching invitation:', error);
      return null;
    }
  }

  /**
   * Get an invitation by token
   */
  static async getByToken(token: string): Promise<Invitation | null> {
    try {
      if (!db) return null;

      const invitesCollection = collection(db, COLLECTION_NAME);
      const q = query(invitesCollection, where('token', '==', token));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const inviteDoc = querySnapshot.docs[0];
        return { id: inviteDoc.id, ...inviteDoc.data() } as Invitation;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching invitation by token:', error);
      return null;
    }
  }

  /**
   * Get all invitations for an email
   */
  static async getByEmail(email: string): Promise<Invitation[]> {
    try {
      if (!db) return [];

      const invitesCollection = collection(db, COLLECTION_NAME);
      const q = query(invitesCollection, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invitation));
    } catch (error) {
      console.error('❌ Error fetching invitations by email:', error);
      return [];
    }
  }

  /**
   * Get all pending invitations for an organization
   */
  static async getPendingByOrganization(organizationId: string): Promise<Invitation[]> {
    try {
      if (!db) return [];

      const invitesCollection = collection(db, COLLECTION_NAME);
      const q = query(
        invitesCollection,
        where('organizationId', '==', organizationId),
        where('status', '==', 'PENDING')
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invitation));
    } catch (error) {
      console.error('❌ Error fetching pending invitations:', error);
      return [];
    }
  }

  /**
   * Get invitations sent by a user
   */
  static async getByInviter(invitedBy: string): Promise<Invitation[]> {
    try {
      if (!db) return [];

      const invitesCollection = collection(db, COLLECTION_NAME);
      const q = query(invitesCollection, where('invitedBy', '==', invitedBy));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invitation));
    } catch (error) {
      console.error('❌ Error fetching invitations by inviter:', error);
      return [];
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /**
   * Create a new invitation
   */
  static async create(input: CreateInvitationInput): Promise<Invitation> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Check if there's already a pending invitation for this email in this org
      const existing = await this.getPendingInvitation(
        input.email.toLowerCase(),
        input.organizationId
      );

      if (existing) {
        throw new Error('A pending invitation already exists for this email');
      }

      const now = Timestamp.now();
      const expiryDays = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const inviteId = doc(collection(db, COLLECTION_NAME)).id;
      const token = generateToken();

      // Generate the invite link if baseUrl is provided
      const baseUrl = input.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
      const inviteLink = baseUrl ? `${baseUrl}/#/accept-invite?token=${token}` : undefined;

      const invitation: Invitation = {
        id: inviteId,
        email: input.email.toLowerCase(),
        organizationId: input.organizationId,
        invitedBy: input.invitedBy,
        role: input.role,
        status: 'PENDING',
        token: token,
        inviteLink: inviteLink,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: now,
      };

      const inviteDoc = doc(db, COLLECTION_NAME, inviteId);
      await setDoc(inviteDoc, invitation);

      console.log('✅ Invitation created:', inviteId);
      console.log('📧 Invite link:', inviteLink);
      console.log('🔑 Token:', token);
      return invitation;
    } catch (error) {
      console.error('❌ Error creating invitation:', error);
      throw error;
    }
  }

  /**
   * Accept an invitation
   */
  static async accept(token: string): Promise<Invitation> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const invitation = await this.getByToken(token);

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'PENDING') {
        throw new Error(`Invitation is ${invitation.status.toLowerCase()}`);
      }

      // Check if expired
      const now = new Date();
      const expiresAt = invitation.expiresAt instanceof Timestamp
        ? invitation.expiresAt.toDate()
        : invitation.expiresAt;

      if (now > expiresAt) {
        // Mark as expired
        await this.updateStatus(invitation.id, 'EXPIRED');
        throw new Error('Invitation has expired');
      }

      // Mark as accepted
      await this.updateStatus(invitation.id, 'ACCEPTED');

      return { ...invitation, status: 'ACCEPTED' };
    } catch (error) {
      console.error('❌ Error accepting invitation:', error);
      throw error;
    }
  }

  /**
   * Update invitation status
   */
  static async updateStatus(id: string, status: InvitationStatus): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const inviteDoc = doc(db, COLLECTION_NAME, id);
      await updateDoc(inviteDoc, { status });

      console.log('✅ Invitation status updated:', id, status);
    } catch (error) {
      console.error('❌ Error updating invitation status:', error);
      throw error;
    }
  }

  /**
   * Resend an invitation (generates a new token and extends expiry)
   */
  static async resend(id: string, expiresInDays: number = DEFAULT_EXPIRY_DAYS): Promise<Invitation> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const invitation = await this.getById(id);

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const updates = {
        token: generateToken(),
        status: 'PENDING' as InvitationStatus,
        expiresAt: Timestamp.fromDate(expiresAt),
      };

      const inviteDoc = doc(db, COLLECTION_NAME, id);
      await updateDoc(inviteDoc, updates);

      console.log('✅ Invitation resent:', id);
      return { ...invitation, ...updates };
    } catch (error) {
      console.error('❌ Error resending invitation:', error);
      throw error;
    }
  }

  /**
   * Delete an invitation
   */
  static async delete(id: string): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const inviteDoc = doc(db, COLLECTION_NAME, id);
      await deleteDoc(inviteDoc);

      console.log('✅ Invitation deleted:', id);
    } catch (error) {
      console.error('❌ Error deleting invitation:', error);
      throw error;
    }
  }

  /**
   * Cancel a pending invitation
   */
  static async cancel(id: string): Promise<void> {
    return this.delete(id);
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Get pending invitation for email in organization
   */
  static async getPendingInvitation(
    email: string,
    organizationId: string
  ): Promise<Invitation | null> {
    try {
      if (!db) return null;

      const invitesCollection = collection(db, COLLECTION_NAME);
      const q = query(
        invitesCollection,
        where('email', '==', email.toLowerCase()),
        where('organizationId', '==', organizationId),
        where('status', '==', 'PENDING')
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const inviteDoc = querySnapshot.docs[0];
        return { id: inviteDoc.id, ...inviteDoc.data() } as Invitation;
      }

      return null;
    } catch (error) {
      console.error('❌ Error checking pending invitation:', error);
      return null;
    }
  }

  /**
   * Validate an invitation token
   * Returns the invitation if valid, null otherwise
   */
  static async validateToken(token: string): Promise<Invitation | null> {
    const invitation = await this.getByToken(token);

    if (!invitation) return null;
    if (invitation.status !== 'PENDING') return null;

    // Check expiry
    const now = new Date();
    const expiresAt = invitation.expiresAt instanceof Timestamp
      ? invitation.expiresAt.toDate()
      : invitation.expiresAt;

    if (now > expiresAt) {
      // Auto-expire the invitation
      await this.updateStatus(invitation.id, 'EXPIRED');
      return null;
    }

    return invitation;
  }

  /**
   * Clean up expired invitations
   * Should be called periodically (e.g., via a cloud function)
   */
  static async cleanupExpired(): Promise<number> {
    try {
      if (!db) return 0;

      const invitesCollection = collection(db, COLLECTION_NAME);
      const q = query(invitesCollection, where('status', '==', 'PENDING'));
      const querySnapshot = await getDocs(q);

      const now = new Date();
      let expiredCount = 0;

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const expiresAt = data.expiresAt instanceof Timestamp
          ? data.expiresAt.toDate()
          : data.expiresAt;

        if (now > expiresAt) {
          await this.updateStatus(docSnap.id, 'EXPIRED');
          expiredCount++;
        }
      }

      console.log(`✅ Cleaned up ${expiredCount} expired invitations`);
      return expiredCount;
    } catch (error) {
      console.error('❌ Error cleaning up invitations:', error);
      return 0;
    }
  }
}

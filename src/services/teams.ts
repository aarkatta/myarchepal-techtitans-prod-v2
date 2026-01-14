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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Team,
  CreateTeamInput,
  TeamMember,
  CreateTeamMemberInput,
} from '@/types/organization';

const TEAMS_COLLECTION = 'teams';
const TEAM_MEMBERS_COLLECTION = 'teamMembers';

// ============================================================================
// TEAM SERVICE
// ============================================================================

export class TeamService {
  /**
   * Get a team by ID
   */
  static async getById(id: string): Promise<Team | null> {
    try {
      if (!db) return null;

      const teamDoc = doc(db, TEAMS_COLLECTION, id);
      const teamSnap = await getDoc(teamDoc);

      if (teamSnap.exists()) {
        return { id: teamSnap.id, ...teamSnap.data() } as Team;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching team:', error);
      return null;
    }
  }

  /**
   * Get all teams in an organization
   */
  static async getByOrganization(organizationId: string): Promise<Team[]> {
    try {
      if (!db) return [];

      const teamsCollection = collection(db, TEAMS_COLLECTION);
      const q = query(teamsCollection, where('organizationId', '==', organizationId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Team));
    } catch (error) {
      console.error('❌ Error fetching teams by organization:', error);
      return [];
    }
  }

  /**
   * Get teams created by a specific user
   */
  static async getByCreator(createdBy: string): Promise<Team[]> {
    try {
      if (!db) return [];

      const teamsCollection = collection(db, TEAMS_COLLECTION);
      const q = query(teamsCollection, where('createdBy', '==', createdBy));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Team));
    } catch (error) {
      console.error('❌ Error fetching teams by creator:', error);
      return [];
    }
  }

  /**
   * Create a new team
   */
  static async create(input: CreateTeamInput): Promise<Team> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const now = Timestamp.now();
      const teamId = doc(collection(db, TEAMS_COLLECTION)).id;

      const team: Team = {
        id: teamId,
        name: input.name,
        organizationId: input.organizationId,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };

      const teamDoc = doc(db, TEAMS_COLLECTION, teamId);
      await setDoc(teamDoc, team);

      console.log('✅ Team created:', teamId);
      return team;
    } catch (error) {
      console.error('❌ Error creating team:', error);
      throw error;
    }
  }

  /**
   * Update a team
   */
  static async update(id: string, updates: Partial<Pick<Team, 'name'>>): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const teamDoc = doc(db, TEAMS_COLLECTION, id);
      await updateDoc(teamDoc, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      console.log('✅ Team updated:', id);
    } catch (error) {
      console.error('❌ Error updating team:', error);
      throw error;
    }
  }

  /**
   * Delete a team and all its memberships
   */
  static async delete(id: string): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Delete all team memberships first
      const members = await TeamMemberService.getByTeam(id);
      const batch = writeBatch(db);

      for (const member of members) {
        const memberDoc = doc(db, TEAM_MEMBERS_COLLECTION, member.id);
        batch.delete(memberDoc);
      }

      // Delete the team
      const teamDoc = doc(db, TEAMS_COLLECTION, id);
      batch.delete(teamDoc);

      await batch.commit();

      console.log('✅ Team and memberships deleted:', id);
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      throw error;
    }
  }

  /**
   * Check if a team exists
   */
  static async exists(id: string): Promise<boolean> {
    const team = await this.getById(id);
    return team !== null;
  }
}

// ============================================================================
// TEAM MEMBER SERVICE
// ============================================================================

export class TeamMemberService {
  /**
   * Get a team member by ID
   */
  static async getById(id: string): Promise<TeamMember | null> {
    try {
      if (!db) return null;

      const memberDoc = doc(db, TEAM_MEMBERS_COLLECTION, id);
      const memberSnap = await getDoc(memberDoc);

      if (memberSnap.exists()) {
        return { id: memberSnap.id, ...memberSnap.data() } as TeamMember;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching team member:', error);
      return null;
    }
  }

  /**
   * Get all members of a team
   */
  static async getByTeam(teamId: string): Promise<TeamMember[]> {
    try {
      if (!db) return [];

      const membersCollection = collection(db, TEAM_MEMBERS_COLLECTION);
      const q = query(membersCollection, where('teamId', '==', teamId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as TeamMember));
    } catch (error) {
      console.error('❌ Error fetching team members:', error);
      return [];
    }
  }

  /**
   * Get all teams a user belongs to
   */
  static async getByUser(userId: string): Promise<TeamMember[]> {
    try {
      if (!db) return [];

      const membersCollection = collection(db, TEAM_MEMBERS_COLLECTION);
      const q = query(membersCollection, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as TeamMember));
    } catch (error) {
      console.error('❌ Error fetching user teams:', error);
      return [];
    }
  }

  /**
   * Add a user to a team
   */
  static async add(input: CreateTeamMemberInput): Promise<TeamMember> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      // Check if user is already a member
      const existing = await this.isMember(input.teamId, input.userId);
      if (existing) {
        throw new Error('User is already a member of this team');
      }

      const memberId = doc(collection(db, TEAM_MEMBERS_COLLECTION)).id;

      const member: TeamMember = {
        id: memberId,
        teamId: input.teamId,
        userId: input.userId,
        joinedAt: Timestamp.now(),
      };

      const memberDoc = doc(db, TEAM_MEMBERS_COLLECTION, memberId);
      await setDoc(memberDoc, member);

      console.log('✅ User added to team:', input.userId, input.teamId);
      return member;
    } catch (error) {
      console.error('❌ Error adding team member:', error);
      throw error;
    }
  }

  /**
   * Remove a user from a team
   */
  static async remove(teamId: string, userId: string): Promise<void> {
    try {
      if (!db) throw new Error('Firestore not initialized');

      const membersCollection = collection(db, TEAM_MEMBERS_COLLECTION);
      const q = query(
        membersCollection,
        where('teamId', '==', teamId),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('User is not a member of this team');
      }

      const memberDoc = doc(db, TEAM_MEMBERS_COLLECTION, querySnapshot.docs[0].id);
      await deleteDoc(memberDoc);

      console.log('✅ User removed from team:', userId, teamId);
    } catch (error) {
      console.error('❌ Error removing team member:', error);
      throw error;
    }
  }

  /**
   * Check if a user is a member of a team
   */
  static async isMember(teamId: string, userId: string): Promise<boolean> {
    try {
      if (!db) return false;

      const membersCollection = collection(db, TEAM_MEMBERS_COLLECTION);
      const q = query(
        membersCollection,
        where('teamId', '==', teamId),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error('❌ Error checking team membership:', error);
      return false;
    }
  }

  /**
   * Get team IDs for a user
   */
  static async getTeamIds(userId: string): Promise<string[]> {
    const memberships = await this.getByUser(userId);
    return memberships.map(m => m.teamId);
  }
}

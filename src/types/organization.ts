import { Timestamp } from 'firebase/firestore';

// ============================================================================
// ENUMS
// ============================================================================

export type OrganizationType = 'ROOT' | 'SUBSCRIBED' | 'DEFAULT';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MEMBER';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';
export type InvitableRole = 'ORG_ADMIN' | 'MEMBER';

// ============================================================================
// ORGANIZATION ENTITY
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  parentId: string | null;
  subscriptionLevel: string;
  status: OrganizationStatus;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface CreateOrganizationInput {
  name: string;
  type: OrganizationType;
  parentId?: string | null;
  subscriptionLevel?: string;
}

// ============================================================================
// USER ENTITY
// ============================================================================

export interface User {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName?: string;
  photoURL?: string;
  organizationId: string;
  role: UserRole;
  status: UserStatus;
  invitedBy: string | null;
  // Legacy archaeologist fields (preserved for compatibility)
  institution?: string;
  specialization?: string;
  credentials?: string;
  activeProjectId?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface CreateUserInput {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  organizationId: string;
  role?: UserRole;
  invitedBy?: string | null;
  institution?: string;
  specialization?: string;
  credentials?: string;
}

// ============================================================================
// TEAM ENTITY
// ============================================================================

export interface Team {
  id: string;
  name: string;
  organizationId: string;
  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface CreateTeamInput {
  name: string;
  organizationId: string;
  createdBy: string;
}

// ============================================================================
// TEAM MEMBER ENTITY
// ============================================================================

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: Date | Timestamp;
}

export interface CreateTeamMemberInput {
  teamId: string;
  userId: string;
}

// ============================================================================
// INVITATION ENTITY
// ============================================================================

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  invitedBy: string;
  role: InvitableRole;
  status: InvitationStatus;
  token: string;
  inviteLink?: string; // Full invitation URL for easy access
  expiresAt: Date | Timestamp;
  createdAt: Date | Timestamp;
}

export interface CreateInvitationInput {
  email: string;
  organizationId: string;
  invitedBy: string;
  role: InvitableRole;
  expiresInDays?: number;
  baseUrl?: string; // Used to generate the invite link
}

// ============================================================================
// ROLE ENTITY
// ============================================================================

export interface Role {
  id: string;
  roleId: string; // e.g., 'SUPER_ADMIN', 'ORG_ADMIN', 'MEMBER'
  roleName: string; // e.g., 'Super Administrator', 'Organization Admin', 'Member'
  description?: string;
  permissions?: string[]; // Optional: list of permissions for this role
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface CreateRoleInput {
  roleId: string;
  roleName: string;
  description?: string;
  permissions?: string[];
}

// ============================================================================
// USER ROLE ENTITY (Junction table for user-role mapping)
// ============================================================================

export interface UserRoleMapping {
  id: string;
  userId: string; // Firebase Auth UID
  roleId: string; // References Role.roleId
  organizationId: string; // The organization context for this role
  assignedBy?: string; // Who assigned this role
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface CreateUserRoleMappingInput {
  userId: string;
  roleId: string;
  organizationId: string;
  assignedBy?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Well-known organization IDs (seeded on app initialization)
export const ROOT_ORGANIZATION_ID = 'root-org';
export const DEFAULT_ORGANIZATION_ID = 'default-org';

// Well-known role IDs
export const ROLE_IDS = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  MEMBER: 'MEMBER',
} as const;

// Default roles to seed
export const DEFAULT_ROLES: CreateRoleInput[] = [
  {
    roleId: 'SUPER_ADMIN',
    roleName: 'Super Administrator',
    description: 'Full system access. Can manage all organizations and users.',
    permissions: ['*'],
  },
  {
    roleId: 'ORG_ADMIN',
    roleName: 'Organization Admin',
    description: 'Can manage users and settings within their organization.',
    permissions: ['org:manage', 'users:invite', 'users:manage', 'content:manage'],
  },
  {
    roleId: 'MEMBER',
    roleName: 'Member',
    description: 'Standard member with basic access.',
    permissions: ['content:read', 'content:create'],
  },
];

// Default subscription levels
export const SUBSCRIPTION_LEVELS = {
  FREE: 'Free',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
} as const;

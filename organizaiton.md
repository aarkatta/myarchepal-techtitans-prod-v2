# Architecture Update: Multi-Tenant Organization & RBAC Implementation

## Context
We are refactoring the database and backend logic to support a **Multi-Tenant SaaS Architecture**.
**Core Principle:** Every user **must** belong to an Organization. Data isolation between organizations is strict, except for the "Root" organization which has global oversight.

---

## 1. Database Schema Changes

### A. New Entity: `Organization`
Create a new table/collection for Organizations.
* **Attributes:**
    * `id`: Primary Key (UUID)
    * `name`: String
    * `type`: Enum [`ROOT`, `SUBSCRIBED`, `DEFAULT`]
    * `parentId`: Foreign Key (nullable, references `Organization.id` for hierarchical orgs)
    * `subscriptionLevel`: String (e.g., 'Free', 'Pro', 'Enterprise')
    * `status`: Enum [`ACTIVE`, `SUSPENDED`, `INACTIVE`]
    * `createdAt`: Timestamp
    * `updatedAt`: Timestamp

### B. New Entity: `User`
Copy the archaeologists collection to Users entity. UID in the schema references UID in Authentication collection.
* **Attributes:**
    * `id`: Primary Key (UUID)
    * `uid`: String (references Authentication collection)
    * `email`: String
    * `displayName`: String (optional)
    * `photoURL`: String (optional)
    * `organizationId`: Foreign Key (NOT NULL, linked to `Organization.id`)
    * `role`: Enum [`SUPER_ADMIN`, `ORG_ADMIN`, `MEMBER`]
    * `status`: Enum [`ACTIVE`, `PENDING`, `INACTIVE`, `SUSPENDED`]
    * `invitedBy`: Foreign Key (nullable, references `User.id`)
    * `institution`: String (optional)
    * `specialization`: String (optional)
    * `credentials`: String (optional)
    * `activeProjectId`: String (optional)
    * `createdAt`: Timestamp
    * `updatedAt`: Timestamp

### C. New Entity: `Team`
* **Attributes:**
    * `id`: Primary Key (UUID)
    * `name`: String
    * `organizationId`: Foreign Key (NOT NULL, linked to `Organization.id`)
    * `createdBy`: Foreign Key (references `User.id`)
    * `createdAt`: Timestamp
    * `updatedAt`: Timestamp

### D. New Entity: `TeamMember`
* **Attributes:**
    * `id`: Primary Key (UUID)
    * `teamId`: Foreign Key (NOT NULL, linked to `Team.id`)
    * `userId`: Foreign Key (NOT NULL, linked to `User.id`)
    * `joinedAt`: Timestamp

### E. New Entity: `Invitation`
* **Attributes:**
    * `id`: Primary Key (UUID)
    * `email`: String
    * `organizationId`: Foreign Key (NOT NULL, linked to `Organization.id`)
    * `invitedBy`: Foreign Key (NOT NULL, references `User.id`)
    * `role`: Enum [`ORG_ADMIN`, `MEMBER`]
    * `status`: Enum [`PENDING`, `ACCEPTED`, `EXPIRED`]
    * `token`: String (unique invite token)
    * `expiresAt`: Timestamp
    * `createdAt`: Timestamp

### F. New Entity: `Role` (Normalized RBAC)
* **Attributes:**
    * `id`: Primary Key (UUID)
    * `roleId`: String (e.g., 'SUPER_ADMIN', 'ORG_ADMIN', 'MEMBER')
    * `roleName`: String (human-readable name)
    * `description`: String (optional)
    * `permissions`: Array of Strings (optional)
    * `createdAt`: Timestamp
    * `updatedAt`: Timestamp

### G. New Entity: `UserRoleMapping` (user_roles collection)
* **Attributes:**
    * `id`: Primary Key (format: `{userId}_{organizationId}`)
    * `userId`: String (Firebase Auth UID)
    * `roleId`: String (references Role.roleId)
    * `organizationId`: String (references Organization.id)
    * `assignedBy`: String (optional, user who assigned the role)
    * `createdAt`: Timestamp
    * `updatedAt`: Timestamp

---

## 2. Organization Types & Logic

### Type 1: Root Organization (The IT Admin Tenant)
* **Purpose:** Reserved for the internal IT/Dev team.
* **Permissions:** Users in this org (Super Admins) have global visibility across *all* organizations.
* **Setup:** Must be seeded via script. Cannot be deleted.
* **ID:** `root-org` (constant)

### Type 2: Parent Organizations (Subscribed Tenants)
* **Purpose:** The actual customers (Archaeology teams/universities).
* **Access:** Full feature access (Sites, Artifacts, Articles) dependent on subscription status.
* **Isolation:** Users in "Org A" generally cannot see data from "Org B".

### Type 3: Default Organization (The Fallback)
* **Purpose:** A holding pen for users who sign up without an invite or valid subscription.
* **Access:** Read-only or extremely limited feature set.
* **Setup:** Must be seeded via script. ID must be known/constant.
* **ID:** `default-org` (constant)

---

## 3. Role-Based Access Control (RBAC) Definition

### Role: SUPER ADMIN
* **Scope:** Global (System-wide).
* **Belongs To:** Root Organization ONLY.
* **Capabilities:**
    * Create/Delete Organizations (Onboard new archaeology teams).
    * Manage global system settings.
    * View all users across the platform.
    * Promote/Demote Org Admins.

### Role: ORG ADMIN
* **Scope:** Organization-wide (Local).
* **Belongs To:** Parent Organizations.
* **Capabilities:**
    * **User Management:** Invite `MEMBER` users via email to their specific Org.
    * **Content Management:** Create/Edit/Delete `Sites`, `Artifacts`, `Articles`, and `Teams` within their Org.
    * **Settings:** Manage their own Org profile.

### Role: MEMBER (Implied Team Member)
* **Scope:** Organization-wide (Local).
* **Belongs To:** Parent Organizations.
* **Capabilities:**
    * View Sites/Artifacts within their Org.
    * Edit data *only* if assigned to a specific Team/Site (depending on granular permissions).

---

## 4. Business Rules & Constraints

### A. User & Organization Rules
| Rule | Policy |
|------|--------|
| Can a user belong to multiple organizations? | **No** - One organization per user. |
| What happens when subscription expires? | User is moved to **Default Organization**. |
| Can users be transferred between orgs? | **No** - Not supported. |
| Can users be removed from an org? | **Yes** - IT Admins (Super Admins) only. |

### B. Org Admin Capabilities
| Capability | Allowed |
|------------|---------|
| Invite other Org Admins | **No** - Can only invite Members. |
| Create/Delete projects | **Yes** |
| Assign roles to users | **Yes** |
| View billing information | **Yes** |
| Manage subscription plans | **Yes** |
| Access audit logs | **Yes** |
| Customize organization settings | **Yes** |

### C. Data Isolation Rules
| Rule | Policy |
|------|--------|
| Can Org Admins see other organizations? | **No** |
| Can Org Admins see other org's users? | **No** |
| Can Org Admins see other org's projects? | **No** |

---

## 5. Implementation Status

### A. Completed Implementation

#### Types & Interfaces (`src/types/organization.ts`)
- [x] `Organization` interface with all attributes
- [x] `User` interface with all attributes
- [x] `Team` and `TeamMember` interfaces
- [x] `Invitation` interface
- [x] `Role` interface for normalized RBAC
- [x] `UserRoleMapping` interface for user-role junction table
- [x] Type enums: `OrganizationType`, `UserRole`, `UserStatus`, `InvitationStatus`
- [x] Constants: `ROOT_ORGANIZATION_ID`, `DEFAULT_ORGANIZATION_ID`, `ROLE_IDS`
- [x] `DEFAULT_ROLES` array with predefined role definitions

#### Services (`src/services/`)
- [x] `OrganizationService` (`organizations.ts`) - CRUD operations for organizations
- [x] `UserService` (`users.ts`) - CRUD operations for users, profile management, permission checks
- [x] `TeamService` & `TeamMemberService` (`teams.ts`) - Team management
- [x] `InvitationService` (`invitations.ts`) - Invitation flow management
- [x] `RoleService` (`roles.ts`) - Role management and seeding
- [x] `UserRoleService` (`userRoles.ts`) - User-role mapping management
- [x] `DatabaseSeedService` (`database-seed.ts`) - Seeds root org, default org, roles, and super admin
- [x] `DatabaseMigrationService` (`database-migration.ts`) - Migrates archaeologists to users

#### Firestore Security Rules (`firestore.rules`)
- [x] Helper functions for RBAC: `isUser()`, `isSuperAdmin()`, `isOrgAdmin()`, `isAnyAdmin()`, `belongsToOrg()`, `canAccessOrg()`
- [x] Rules for `organizations` collection
- [x] Rules for `users` collection
- [x] Rules for `roles` collection
- [x] Rules for `user_roles` collection
- [x] Rules for `teams` and `teamMembers` collections
- [x] Rules for `invitations` collection

#### Hooks (`src/hooks/`)
- [x] `useUser` hook (`use-user.tsx`) - Fetches user data, roles, organization, and provides computed properties:
  - `user`, `organization`, `userRoles`, `highestRole`
  - `isUser`, `isSuperAdmin`, `isOrgAdmin`, `isAdmin`, `isMember`
  - `refreshUser()` function
- [x] `useOrganizationAccess` hook - Checks if user has access to specific organization

#### Authentication (`src/components/ArchaeologistAuth.tsx`)
- [x] Updated sign-in to check `user_roles` collection for user's role
- [x] Updated sign-up to create entry in `user_roles` collection with MEMBER role
- [x] Uses `UserService` instead of legacy `ArchaeologistService`

#### Admin Dashboard (`src/pages/AdminDashboard.tsx`)
- [x] Stats cards showing total orgs, active orgs, subscribed tenants, total users
- [x] Organizations table with CRUD operations
- [x] All Users table with full pagination
- [x] Search by name/email
- [x] Filter by role, status, organization
- [x] Configurable rows per page (5, 10, 20, 50, 100)
- [x] View User Details dialog
- [x] Edit User dialog (change role, status, organization)
- [x] Create Organization dialog

#### Developer Tools (`src/utils/dev-tools.ts`)
- [x] Browser console accessible via `window.DevTools`
- [x] `DevTools.seedRoles()` - Seeds the roles collection
- [x] `DevTools.seedAll(uid?, email?)` - Seeds everything (orgs + roles + optional super admin)
- [x] `DevTools.assignRole(userId, roleId, orgId)` - Assigns role to user
- [x] `DevTools.makeSuperAdmin(userId)` - Makes user a super admin
- [x] `DevTools.fixUser(userId)` - Adds missing required fields (status, timestamps)
- [x] `DevTools.getRoles()` - Lists all roles
- [x] `DevTools.getUserRoles(userId)` - Lists user's roles
- [x] `DevTools.getUsers()` - Lists all users
- [x] `DevTools.getStatus()` - Shows database seeding status

#### Migration Validator (`src/services/migration-validator.ts`)
- [x] `MigrationValidator.runAll()` - Runs all validation checks
- [x] Step 1: Schema validation
- [x] Step 2: Seeding validation (root org, default org)
- [x] Step 3: Migration validation (archaeologists to users)
- [x] Step 4: Roles validation
- [x] Helper methods: `seedRoles()`, `runSeeding()`, `runMigration()`, `assignUserRole()`

---

## 6. Setup Instructions

### Step 1: Deploy Firestore Rules
Copy the contents of `firestore.rules` to Firebase Console:
1. Go to Firebase Console → Firestore Database → Rules
2. Paste the rules content
3. Click "Publish"

Or use Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

### Step 2: Seed the Database
Open browser console on the app and run:
```javascript
// Check current status
await DevTools.getStatus()

// Seed roles first
await DevTools.seedRoles()

// Seed organizations (root-org and default-org)
await DevTools.seedAll()

// Or seed with a super admin
await DevTools.seedAll('YOUR_USER_UID', 'your-email@example.com')
```

### Step 3: Make Yourself Super Admin
```javascript
// First fix any missing fields on your user document
await DevTools.fixUser('YOUR_USER_UID')

// Then make yourself super admin
await DevTools.makeSuperAdmin('YOUR_USER_UID')
```

### Step 4: Verify Setup
```javascript
// Check status again
await DevTools.getStatus()

// Should show:
// - Root Org: ✅
// - Default Org: ✅
// - Roles: ✅ (3)
// - Super Admins: 1
```

---

## 7. File Structure

```
src/
├── types/
│   └── organization.ts          # All types and interfaces
├── services/
│   ├── organizations.ts         # OrganizationService
│   ├── users.ts                 # UserService
│   ├── teams.ts                 # TeamService, TeamMemberService
│   ├── invitations.ts           # InvitationService
│   ├── roles.ts                 # RoleService
│   ├── userRoles.ts             # UserRoleService
│   ├── database-seed.ts         # DatabaseSeedService
│   ├── database-migration.ts    # DatabaseMigrationService
│   └── migration-validator.ts   # MigrationValidator
├── hooks/
│   └── use-user.tsx             # useUser, useOrganizationAccess hooks
├── utils/
│   └── dev-tools.ts             # DevTools for browser console
├── pages/
│   ├── AdminDashboard.tsx       # Super Admin dashboard
│   └── OrgAdminDashboard.tsx    # Org Admin dashboard
├── components/
│   └── ArchaeologistAuth.tsx    # Updated auth component
└── main.tsx                     # Imports dev-tools for console access
```

---

## 8. Firestore Collections

| Collection | Document ID Format | Description |
|------------|-------------------|-------------|
| `organizations` | Auto-generated or `root-org`, `default-org` | Organization documents |
| `users` | User's Firebase Auth UID | User documents |
| `roles` | Role ID (e.g., `SUPER_ADMIN`) | Role definitions |
| `user_roles` | `{userId}_{organizationId}` | User-role mappings |
| `teams` | Auto-generated | Team documents |
| `teamMembers` | Auto-generated | Team membership documents |
| `invitations` | Auto-generated | Invitation documents |

---

## 9. API Reference

### UserService Methods
```typescript
UserService.getById(id: string): Promise<User | null>
UserService.getByUid(uid: string): Promise<User | null>
UserService.getByOrganization(orgId: string): Promise<User[]>
UserService.getAll(): Promise<User[]>
UserService.getByRole(orgId: string, role: UserRole): Promise<User[]>
UserService.create(input: CreateUserInput): Promise<User>
UserService.updateProfile(uid: string, updates: Partial<User>): Promise<void>
UserService.updateRole(uid: string, role: UserRole): Promise<void>
UserService.updateStatus(uid: string, status: UserStatus): Promise<void>
UserService.delete(uid: string): Promise<void>
UserService.exists(uid: string): Promise<boolean>
UserService.isActive(uid: string): Promise<boolean>
UserService.isSuperAdmin(uid: string): Promise<boolean>
UserService.isOrgAdmin(uid: string): Promise<boolean>
UserService.isAdmin(uid: string): Promise<boolean>
```

### OrganizationService Methods
```typescript
OrganizationService.getById(id: string): Promise<Organization | null>
OrganizationService.getAll(): Promise<Organization[]>
OrganizationService.getByType(type: OrganizationType): Promise<Organization[]>
OrganizationService.create(input: CreateOrganizationInput): Promise<Organization>
OrganizationService.update(id: string, updates: Partial<Organization>): Promise<void>
OrganizationService.delete(id: string): Promise<void>
OrganizationService.suspend(id: string): Promise<void>
OrganizationService.activate(id: string): Promise<void>
```

### RoleService Methods
```typescript
RoleService.getById(id: string): Promise<Role | null>
RoleService.getByRoleId(roleId: string): Promise<Role | null>
RoleService.getAll(): Promise<Role[]>
RoleService.create(input: CreateRoleInput): Promise<Role>
RoleService.seedDefaultRoles(): Promise<void>
RoleService.isSeeded(): Promise<boolean>
```

### UserRoleService Methods
```typescript
UserRoleService.getById(id: string): Promise<UserRoleMapping | null>
UserRoleService.getByUserId(userId: string): Promise<UserRoleMapping[]>
UserRoleService.getUserRoleInOrganization(userId: string, orgId: string): Promise<UserRoleMapping | null>
UserRoleService.create(input: CreateUserRoleMappingInput): Promise<UserRoleMapping>
UserRoleService.updateRole(userId: string, orgId: string, newRoleId: string): Promise<void>
UserRoleService.delete(userId: string, orgId: string): Promise<void>
UserRoleService.assignRole(userId: string, roleId: string, orgId: string): Promise<UserRoleMapping>
UserRoleService.hasRole(userId: string, roleId: string): Promise<boolean>
UserRoleService.isSuperAdmin(userId: string): Promise<boolean>
UserRoleService.isOrgAdmin(userId: string): Promise<boolean>
UserRoleService.isAdmin(userId: string): Promise<boolean>
UserRoleService.getHighestRole(userId: string): Promise<UserRole | null>
```

---

## 10. Security Considerations

### Current State (Bootstrap Mode)
The Firestore rules are currently **permissive** to allow initial setup:
- Public read access on organizations, users, roles, user_roles
- Create access for anyone (needed for seeding)
- Update/delete requires authentication

### Production Hardening (TODO)
Before going to production, update rules to:
1. Restrict role/user_role creation to admins only
2. Add organization-based isolation for user reads
3. Restrict organization updates to Super Admins
4. Add rate limiting considerations

---

## 11. Troubleshooting

### User can't see Admin Dashboard
1. Check user has `status: 'ACTIVE'` in their document
2. Check user has `role: 'SUPER_ADMIN'` in users collection
3. Check user has entry in `user_roles` collection
4. Run `DevTools.fixUser('USER_UID')` to add missing fields

### Permission Errors
1. Ensure Firestore rules are deployed
2. Check user is authenticated
3. Verify the collection rules allow the operation

### Seeding Fails
1. Deploy Firestore rules first
2. Ensure you're authenticated in the app
3. Check browser console for specific error messages

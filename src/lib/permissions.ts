import { PolicyEngine } from 'permzplus';

/**
 * Central PermzPlus PolicyEngine for ArchePal.
 *
 * Role hierarchy (higher level inherits all lower-level permissions):
 *   MEMBER (1) < ORG_ADMIN (2) < SUPER_ADMIN (3)
 *
 * This is the single source of truth for client-side permission checks.
 * Firestore security rules remain the server-side authority and are unchanged.
 */
export const policy = new PolicyEngine();

// MEMBER — field consultants filling assigned forms
policy.addRole({
  name: 'MEMBER',
  level: 1,
  permissions: [
    'sites:read',
    'content:read',
    'content:create',
    'assignments:view-own',
    'submissions:create',
    'submissions:read-own',
    'forms:upload',
  ],
});

// ORG_ADMIN — manages templates, sites, assignments within their org
// Automatically inherits all MEMBER permissions (level 2 > level 1)
policy.addRole({
  name: 'ORG_ADMIN',
  level: 2,
  permissions: [
    'sites:create',
    'sites:edit',
    'sites:delete',
    'templates:read',
    'templates:create',
    'templates:edit',
    'templates:delete',
    'templates:publish',
    'content:edit',
    'content:delete',
    'assignments:manage',
    'submissions:read-all',
    'submissions:edit-protected',
    'submissions:export',
    'org:manage',
    'admin:users',
  ],
});

// SUPER_ADMIN — full access across all organisations
// Automatically inherits all ORG_ADMIN + MEMBER permissions (level 3 > level 2 > level 1)
policy.addRole({
  name: 'SUPER_ADMIN',
  level: 3,
  permissions: [
    'admin:panel',
  ],
});

export type AppPermission =
  // Sites
  | 'sites:read'
  | 'sites:create'
  | 'sites:edit'
  | 'sites:delete'
  // Templates
  | 'templates:read'
  | 'templates:create'
  | 'templates:edit'
  | 'templates:delete'
  | 'templates:publish'
  // Content (Artifacts, Articles, Events)
  | 'content:read'
  | 'content:create'
  | 'content:edit'
  | 'content:delete'
  // Assignments
  | 'assignments:view-own'
  | 'assignments:manage'
  // Submissions / Form filling
  | 'submissions:create'
  | 'submissions:read-own'
  | 'submissions:read-all'
  | 'submissions:edit-protected'
  | 'submissions:export'
  | 'forms:upload'
  // Admin / Org
  | 'org:manage'
  | 'admin:users'
  | 'admin:panel';

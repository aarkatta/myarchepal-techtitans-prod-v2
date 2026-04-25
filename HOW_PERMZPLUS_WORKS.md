# How PermzPlus Works: Deep Dive

## Overview

PermzPlus is a **role-based access control (RBAC) + attribute-based access control (ABAC)** library. It's a small (~5.9 KB gzipped), zero-dependency system for managing permissions in TypeScript applications.

**Core concept:** Define roles with hierarchies and permissions, then check if a user (bound to a role) can perform an action.

---

## The Three Main Components

### 1. **PolicyEngine** — The Core
The central permission registry that:
- Stores role definitions + permission sets
- Manages role hierarchies (inheritance)
- Evaluates permission checks
- Caches results for performance

### 2. **Roles** — Who can do what
Hierarchical role definitions with:
- Role name (e.g., `MEMBER`, `ORG_ADMIN`)
- Level (numeric, determines inheritance)
- Permissions (string array)
- Optional conditions (MongoDB-style filters)

### 3. **PermissionContext** — Per-request binding
A short-lived object that:
- Binds a user's role(s) to the engine
- Provides a convenient API for permission checks
- Supports resource-level conditions
- Can handle multiple roles at once

---

## How It Works: Step-by-Step

### Step 1: Initialize PolicyEngine
```typescript
import { PolicyEngine } from 'permzplus';

const policy = new PolicyEngine();
// Empty engine, no roles yet
```

### Step 2: Define Roles with Permissions
```typescript
policy.addRole({
  name: 'MEMBER',
  level: 1,
  permissions: [
    'sites:read',
    'assignments:view-own',
    'submissions:create',
    'forms:upload',
  ]
});

policy.addRole({
  name: 'ORG_ADMIN',
  level: 2,  // Higher level = inherits MEMBER permissions
  permissions: [
    'sites:create',
    'templates:publish',
    'submissions:export',
    'assignments:manage',
  ]
});

policy.addRole({
  name: 'SUPER_ADMIN',
  level: 3,  // Inherits both MEMBER + ORG_ADMIN
  permissions: [
    'admin:panel',
  ]
});
```

**Key:** Higher level roles automatically inherit all permissions from lower levels.

```
SUPER_ADMIN (3)
    ↓ inherits
ORG_ADMIN (2)
    ↓ inherits
MEMBER (1)
```

Result: `SUPER_ADMIN` has 4 + 4 + 1 = ~9 permissions total.

### Step 3: Create a PermissionContext (Bind User Role)
```typescript
// When user logs in, get their role from Firebase
const userRole = 'ORG_ADMIN'; // or MEMBER, SUPER_ADMIN

// Create a context binding that role to the engine
const ctx = policy.createContext(userRole);
// Now ctx knows about the engine and this user's role
```

### Step 4: Check Permissions
```typescript
// Simple check
const canPublish = ctx.can('templates:publish');
// → true (ORG_ADMIN has this permission)

const canEditAdmin = ctx.can('admin:panel');
// → false (ORG_ADMIN does not have this)

const canReadSites = ctx.can('sites:read');
// → true (ORG_ADMIN inherits from MEMBER)
```

### Step 5: Optional Conditions (Resource-Level)
```typescript
// Check permission + custom condition
const canEditPost = ctx.can('posts:edit', () => {
  return post.authorId === userId;  // Must own the post
});
// Both checks must pass for can() to return true
```

---

## Core Concepts

### Hierarchical Role Inheritance
```
Level 3: SUPER_ADMIN
  Permissions: [admin:panel]
  Effective: [admin:panel] + [all ORG_ADMIN perms] + [all MEMBER perms]

Level 2: ORG_ADMIN
  Permissions: [sites:create, templates:publish, ...]
  Effective: [sites:create, templates:publish, ...] + [all MEMBER perms]

Level 1: MEMBER
  Permissions: [sites:read, submissions:create, ...]
  Effective: [sites:read, submissions:create, ...]
```

**Engine resolves effective permissions** by collecting all permissions from roles at the same level OR lower.

### Memoization & Caching
PermzPlus uses **three-layer caching** for performance:

```
┌─────────────────────────────────┐
│ Input: (role, permission)       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Layer 1: Memoized permCache     │
│ (resolved permission sets)      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Layer 2: Role inheritance       │
│ (collect perms from lower roles)│
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Layer 3: Bitwise operations     │
│ (fast boolean check)            │
└────────────┬────────────────────┘
             │
             ▼
        Return: true/false
```

**Cache invalidates** on any mutation (addRole, removeRole, etc.).

### Wildcard Patterns
```typescript
// Exact match
policy.can(role, 'sites:read');  // Only 'sites:read'

// Wildcard for all site actions
policy.can(role, 'sites:*');  // Matches sites:read, sites:create, sites:delete

// Wildcard for everything
policy.can(role, '*');  // Matches any permission
```

---

## React Integration (Your App)

### PermissionProvider (v1.1.0)
```tsx
import { PermissionProvider } from 'permzplus/react';
import { policy } from '@/lib/permissions';

export const PermissionsWrapper = ({ children }) => {
  const { effectiveRole } = useUser();  // Get role from Firebase
  
  return (
    <PermissionProvider engine={policy} role={effectiveRole}>
      {children}
    </PermissionProvider>
  );
};
```

**What it does:**
- Wraps your app with React Context
- Makes the policy engine + role available to all child components
- Re-renders when role changes

### usePermission Hook
```tsx
import { usePermission } from 'permzplus/react';

function MyComponent() {
  const canEdit = usePermission('templates:edit');
  
  return canEdit ? <EditButton /> : null;
}
```

**Behind the scenes:**
1. Hook gets the policy engine from React Context
2. Hook gets the current role from Context
3. Calls `engine.can(role, 'templates:edit')`
4. Returns boolean
5. Component re-renders if value changes

---

## Your Implementation in ArchePal

### How Your App Uses It

```
User logs in (Firebase Auth)
    │
    ▼
useAuth() gets authUser
    │
    ▼
useUser() fetches from Firestore
    ├─ users/{uid} → user.role (legacy)
    ├─ user_roles/{uid} → highestRole (new)
    │
    ▼
Calculate effectiveRole (highest of both)
    │
    ▼
<PermissionsWrapper role={effectiveRole}>
  Passes role to PermissionProvider
    │
    ▼
Components use useCan('templates:edit')
    │
    ▼
PermissionProvider checks policy engine
    │
    ▼
policy.can('ORG_ADMIN', 'templates:edit')
    │
    ▼
Engine looks up ORG_ADMIN role
    ├─ Level 2, so inherits from Level 1
    ├─ Resolves effective permissions (cached)
    ├─ Checks if 'templates:edit' is in set
    │
    ▼
Return true/false
```

### Your Permission Hierarchy
```typescript
// MEMBER (Level 1) — Field consultants
permissions: [
  'sites:read',
  'content:read',
  'assignments:view-own',
  'submissions:create',
  'submissions:read-own',
  'forms:upload',
]

// ORG_ADMIN (Level 2) — Org managers
// Inherits: all MEMBER permissions +
permissions: [
  'sites:create',
  'sites:edit',
  'sites:delete',
  'templates:read',
  'templates:create',
  'templates:edit',
  'templates:delete',
  'templates:publish',
  'submissions:read-all',        // Key: can read all, not just own
  'submissions:edit-protected',
  'submissions:export',
  'assignments:manage',
  'org:manage',
  'admin:users',
]

// SUPER_ADMIN (Level 3) — Global admin
// Inherits: all MEMBER + all ORG_ADMIN +
permissions: [
  'admin:panel',
]
```

---

## Permission Check Examples

### Check Single Permission
```typescript
const { useCan } = useUser();
const canCreate = useCan('sites:create');  // Boolean

if (canCreate) {
  // Render create button
}
```

### Check Multiple Permissions (ALL)
```typescript
const { useAllPerms } = useUser();
const canPublish = useAllPerms(['templates:edit', 'templates:publish']);
// true only if user has BOTH permissions
```

### Check Multiple Permissions (ANY)
```typescript
const { useAnyPerm } = useUser();
const canModify = useAnyPerm(['sites:edit', 'sites:delete']);
// true if user has EITHER permission
```

### Conditional Permission Check
```typescript
ctx.can('posts:edit', () => {
  return post.ownerId === currentUserId;  // Custom condition
});
```

---

## Firestore Integration (Your Backend Authority)

PermzPlus is **client-side only**. The real authority is Firestore rules:

```firestore
// Firestore rules use the same role concept
match /siteTemplates/{templateId} {
  allow read: if canAccessOrg(resource.data.orgId);
  allow create: if isAnyAdmin() && canAccessOrg(request.resource.data.orgId);
  allow update: if isAnyAdmin() && canAccessOrg(resource.data.orgId);
}
```

**Flow:**
```
Frontend: useCan('templates:edit') → Shows edit button
    ↓
User clicks Edit
    ↓
Frontend: POST /api/templates/{id}
    ↓
Firestore rules: isAnyAdmin() && canAccessOrg(...)
    ├─ Read users/{uid}.role from Firestore
    ├─ Check if 'ORG_ADMIN' or 'SUPER_ADMIN'
    ├─ Check if orgId matches
    │
    ▼
Allow/Deny update
```

**Important:** PermzPlus only controls UI. Firestore is the real authority.

---

## Performance: Why It's Fast

### Bitwise Operations
```typescript
// Instead of: permissions = ['sites:read', 'sites:create', ...]
// Engine uses bitmasks:
permissions = 0b101101...  // Each permission = one bit

// Checking permission becomes a single bitwise AND:
hasPermission = (roleBitmask & permissionBit) !== 0;
// Microseconds, not milliseconds
```

### Memoization
```typescript
// First call: resolves SUPER_ADMIN permissions (expensive)
// Cached: 0b1111...11111 (all bits set)

// Subsequent calls: lookup from permCache (free)
// Cache invalidates only on role/permission mutation (rare)
```

### Result: 1.1–1.7× faster than CASL

---

## Summary: The Mental Model

```
┌─────────────────────────────────────────┐
│ 1. Create a PolicyEngine                │
│    = empty permission system            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 2. Define roles with permissions        │
│    e.g., MEMBER, ORG_ADMIN, SUPER_ADMIN │
│    with hierarchy (level-based)         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 3. Get user's role from Firebase        │
│    e.g., user.role = 'ORG_ADMIN'        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 4. Create PermissionContext             │
│    = bind role to engine                │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 5. Check permissions                    │
│    ctx.can('templates:edit')            │
│    = fast bitwise lookup                │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 6. Firestore enforces server-side       │
│    = ultimate authority                 │
└─────────────────────────────────────────┘
```

---

## Key Takeaways

| Aspect | How It Works |
|--------|-------------|
| **Hierarchy** | Level-based inheritance (higher level = more perms) |
| **Speed** | Bitwise + memoized caching = microseconds |
| **Size** | 5.9 KB gzipped, zero deps |
| **React** | PermissionProvider Context + usePermission hooks |
| **Security** | Client-side UX only; Firestore is authority |
| **Scalability** | Wildcard patterns, permission groups, denies |
| **Flexibility** | Supports conditions for resource-level checks |

---

## In Your App Specifically

- **Defined in:** `src/lib/permissions.ts`
- **Provided by:** `<PermissionsWrapper>` in App.tsx
- **Consumed by:** `useCan()`, `useAllPerms()`, `useAnyPerm()` hooks
- **Protected routes:** `<PermissionProtectedRoute>` wrapper
- **Server authority:** Firestore rules + FastAPI endpoint checks

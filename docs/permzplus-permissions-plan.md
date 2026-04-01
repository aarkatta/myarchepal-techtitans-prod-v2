# PermzPlus Permissions Integration Plan
### Stack: React 18 · TypeScript · Firebase Auth · PermzPlus v1.1.0

> **Goal:** Replace the scattered `isOrgAdmin` / `isSuperAdmin` / `isMember` boolean checks
> throughout ~40 files with a centralised, declarative `can('resource:action')` permission
> system backed by [PermzPlus](https://www.npmjs.com/package/permzplus).
>
> PermzPlus is a zero-dependency, hierarchical RBAC library.
> Roles inherit permissions downward from higher privilege levels.
> Permissions use `resource:action` strings with wildcard support (`sites:*`, `*`).
> **Firestore security rules are NOT replaced** — they remain the server-side authority.
> PermzPlus governs client-side UI rendering and frontend route guards only.

---

## Reference Files

- `src/hooks/use-user.tsx` — current role source of truth (reads Firestore `users/{uid}.role`)
- `src/components/RoleProtectedRoute.tsx` — existing `AdminRoute`, `SuperAdminRoute`, `ProtectedRoute`
- `docs/dynamic-site-templates-plan.md` — feature context for permissions design
- `firestore.rules` — server-side rules (remain unchanged)

---

## Role Hierarchy (PermzPlus levels — higher number = more privilege)

| Role | Level | Inherits From |
|---|---|---|
| `MEMBER` | 1 | — |
| `ORG_ADMIN` | 2 | `MEMBER` |
| `SUPER_ADMIN` | 3 | `ORG_ADMIN` → `MEMBER` |

PermzPlus automatically propagates all `MEMBER` permissions to `ORG_ADMIN`,
and all `ORG_ADMIN` permissions to `SUPER_ADMIN`.

---

## Permission Matrix

### Sites
| Permission | MEMBER | ORG_ADMIN | SUPER_ADMIN |
|---|---|---|---|
| `sites:read` | ✅ | ✅ (inherit) | ✅ (inherit) |
| `sites:create` | ❌ | ✅ | ✅ (inherit) |
| `sites:edit` | ❌ | ✅ | ✅ (inherit) |
| `sites:delete` | ❌ | ✅ | ✅ (inherit) |

### Templates
| Permission | MEMBER | ORG_ADMIN | SUPER_ADMIN |
|---|---|---|---|
| `templates:read` | ❌ | ✅ | ✅ (inherit) |
| `templates:create` | ❌ | ✅ | ✅ (inherit) |
| `templates:edit` | ❌ | ✅ | ✅ (inherit) |
| `templates:delete` | ❌ | ✅ | ✅ (inherit) |
| `templates:publish` | ❌ | ✅ | ✅ (inherit) |

### Content (Artifacts · Articles · Events)
| Permission | MEMBER | ORG_ADMIN | SUPER_ADMIN |
|---|---|---|---|
| `content:read` | ✅ | ✅ (inherit) | ✅ (inherit) |
| `content:create` | ✅ | ✅ (inherit) | ✅ (inherit) |
| `content:edit` | ❌ | ✅ | ✅ (inherit) |
| `content:delete` | ❌ | ✅ | ✅ (inherit) |

### Assignments
| Permission | MEMBER | ORG_ADMIN | SUPER_ADMIN |
|---|---|---|---|
| `assignments:view-own` | ✅ | ✅ (inherit) | ✅ (inherit) |
| `assignments:manage` | ❌ | ✅ | ✅ (inherit) |

### Submissions / Form Filling
| Permission | MEMBER | ORG_ADMIN | SUPER_ADMIN |
|---|---|---|---|
| `submissions:create` | ✅ | ✅ (inherit) | ✅ (inherit) |
| `submissions:read-own` | ✅ | ✅ (inherit) | ✅ (inherit) |
| `submissions:read-all` | ❌ | ✅ | ✅ (inherit) |
| `submissions:edit-protected` | ❌ | ✅ | ✅ (inherit) |
| `submissions:export` | ❌ | ✅ | ✅ (inherit) |
| `forms:upload` | ✅ | ✅ (inherit) | ✅ (inherit) |

### Admin / Org Management
| Permission | MEMBER | ORG_ADMIN | SUPER_ADMIN |
|---|---|---|---|
| `org:manage` | ❌ | ✅ | ✅ (inherit) |
| `admin:users` | ❌ | ✅ | ✅ (inherit) |
| `admin:panel` | ❌ | ❌ | ✅ |

---

## Task Overview

| Task | Name | Output Files | Depends On | Complexity |
|---|---|---|---|---|
| **P.1** | Install & Policy Engine | `src/lib/permissions.ts` | — | S |
| **P.2** | Permissions Context + Hook | `src/contexts/PermissionsContext.tsx` · `src/hooks/use-permissions.ts` | P.1 | S |
| **P.3** | PermissionGate Component | `src/components/PermissionGate.tsx` | P.2 | S |
| **P.4** | Update Route Guards | `src/components/RoleProtectedRoute.tsx` | P.2 | S |
| **P.5** | Extend useUser Hook | `src/hooks/use-user.tsx` | P.2 | S |
| **P.6** | Migrate Pages & Components | ~40 files (see list below) | P.2, P.3 | M |
| **P.7** | Wire Provider in App.tsx | `src/App.tsx` | P.2 | S |

**Complexity:** S = Small < half day · M = Medium 1–2 days

### Build Order
```
P.1 → P.2 → P.3 → P.4 → P.5 → P.7 → P.6
```

---

## PHASE P.1 — Install & Policy Engine

### Install

```bash
npm install permzplus
```

### File: `src/lib/permissions.ts`

Define the single `PolicyEngine` instance used across the entire app.

```typescript
import { PolicyEngine } from 'permzplus';

/**
 * Central PermzPlus policy engine.
 * Role hierarchy: MEMBER (1) < ORG_ADMIN (2) < SUPER_ADMIN (3)
 * Higher-level roles automatically inherit all lower-level permissions.
 */
export const policy = new PolicyEngine();

// --- MEMBER (level 1) ---
policy.addRole('MEMBER', 1, [
  'sites:read',
  'content:read',
  'content:create',
  'assignments:view-own',
  'submissions:create',
  'submissions:read-own',
  'forms:upload',
]);

// --- ORG_ADMIN (level 2) — inherits all MEMBER permissions ---
policy.addRole('ORG_ADMIN', 2, [
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
]);

// --- SUPER_ADMIN (level 3) — inherits all ORG_ADMIN + MEMBER permissions ---
policy.addRole('SUPER_ADMIN', 3, [
  'admin:panel',
]);

export type AppPermission =
  | 'sites:read'     | 'sites:create'     | 'sites:edit'     | 'sites:delete'
  | 'templates:read' | 'templates:create' | 'templates:edit' | 'templates:delete' | 'templates:publish'
  | 'content:read'   | 'content:create'   | 'content:edit'   | 'content:delete'
  | 'assignments:view-own' | 'assignments:manage'
  | 'submissions:create'   | 'submissions:read-own' | 'submissions:read-all'
  | 'submissions:edit-protected' | 'submissions:export'
  | 'forms:upload'
  | 'org:manage'   | 'admin:users'   | 'admin:panel';
```

---

## PHASE P.2 — Permissions Context + Hook

### File: `src/contexts/PermissionsContext.tsx`

Wraps `PermissionContext` from PermzPlus around the app.
Reads the user's role from `useUser()` and builds a scoped context per session.

```tsx
import React, { createContext, useContext, useMemo } from 'react';
import { policy, AppPermission } from '@/lib/permissions';
import { useUser } from '@/hooks/use-user';

interface PermissionsContextValue {
  can: (permission: AppPermission) => boolean;
  cannot: (permission: AppPermission) => boolean;
  role: string | null;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  can: () => false,
  cannot: () => true,
  role: null,
});

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { highestRole } = useUser();

  const value = useMemo<PermissionsContextValue>(() => {
    if (!highestRole) {
      return { can: () => false, cannot: () => true, role: null };
    }
    const ctx = policy.createContext({ role: highestRole });
    return {
      can: (permission) => ctx.can(permission),
      cannot: (permission) => !ctx.can(permission),
      role: highestRole,
    };
  }, [highestRole]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissionsContext = () => useContext(PermissionsContext);
```

### File: `src/hooks/use-permissions.ts`

Thin convenience hook — the primary API components will call.

```typescript
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import { AppPermission } from '@/lib/permissions';

export const usePermissions = () => {
  const { can, cannot, role } = usePermissionsContext();
  return { can, cannot, role };
};
```

**Usage anywhere in the app:**
```tsx
const { can } = usePermissions();

// Instead of: if (isOrgAdmin) { ... }
if (can('templates:edit')) { ... }

// Instead of: {isAdmin && <Button>Delete</Button>}
{can('sites:delete') && <Button>Delete</Button>}
```

---

## PHASE P.3 — PermissionGate Component

### File: `src/components/PermissionGate.tsx`

Declarative gate for conditional rendering — replaces inline boolean JSX guards.

```tsx
import { usePermissions } from '@/hooks/use-permissions';
import { AppPermission } from '@/lib/permissions';

interface PermissionGateProps {
  permission: AppPermission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user has the given permission.
 * Renders fallback (default: nothing) otherwise.
 *
 * @example
 * <PermissionGate permission="templates:edit">
 *   <EditTemplateButton />
 * </PermissionGate>
 *
 * <PermissionGate permission="admin:panel" fallback={<AccessDenied />}>
 *   <SuperAdminPanel />
 * </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  fallback = null,
  children,
}) => {
  const { can } = usePermissions();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
};
```

---

## PHASE P.4 — Update Route Guards

### File: `src/components/RoleProtectedRoute.tsx`

`RoleProtectedRoute` already handles auth + role checks. Back the role checks with PermzPlus
so the route guard and component-level checks use the same policy engine.

**Change:** Replace `allowedRoles.includes(user.role)` with `policy.can(user.role, permission)`.
Keep `AdminRoute` and `SuperAdminRoute` convenience wrappers — just change their internal
implementation to use a permission check rather than a role list.

```tsx
// Before
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN']}>
    {children}
  </RoleProtectedRoute>
);

// After — uses permission instead of role list
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionProtectedRoute permission="org:manage">
    {children}
  </PermissionProtectedRoute>
);

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PermissionProtectedRoute permission="admin:panel">
    {children}
  </PermissionProtectedRoute>
);
```

Add a new `PermissionProtectedRoute` that accepts an `AppPermission` and calls `policy.can()`.

---

## PHASE P.5 — Extend useUser Hook

Add a `can` shorthand to `useUser()` return value so existing callers get a migration
path without immediately touching every file.

```typescript
// src/hooks/use-user.tsx — add to UseUserResult interface:
can: (permission: AppPermission) => boolean;

// In the hook body:
import { policy } from '@/lib/permissions';

const can = useCallback(
  (permission: AppPermission) => highestRole ? policy.can(highestRole, permission) : false,
  [highestRole]
);

// Return it:
return { ..., can };
```

This means files can migrate incrementally:
```tsx
// Old (still works during migration):
const { isOrgAdmin } = useUser();
if (isOrgAdmin) { ... }

// New (preferred):
const { can } = useUser();
if (can('templates:edit')) { ... }
```

---

## PHASE P.6 — Migrate Inline Checks

### Priority order (highest to lowest impact)

#### Tier 1 — Route-level guards in `src/App.tsx`
All `<AdminRoute>` and `<SuperAdminRoute>` wrappers automatically get PermzPlus backing
once Phase P.4 is done. No file-by-file changes needed here.

#### Tier 2 — Nav components (affect every page)
| File | Current check | Replace with |
|---|---|---|
| `src/components/SideNav.tsx` | `isAdmin`, `isMember`, `isSuperAdmin` | `can('org:manage')`, `can('assignments:view-own')`, `can('admin:panel')` |
| `src/components/BottomNav.tsx` | `isAdmin`, `isMember` | `can('org:manage')`, `can('assignments:view-own')` |

#### Tier 3 — Admin pages
| File | Key checks to migrate |
|---|---|
| `src/pages/TemplateList.tsx` | `isAdmin` → `can('templates:read')` |
| `src/pages/TemplateEditor.tsx` | `isAdmin` → `can('templates:edit')` |
| `src/pages/TemplateBuilder.tsx` | `isAdmin` → `can('templates:create')` |
| `src/pages/TemplateImportPDF.tsx` | `isAdmin` → `can('templates:create')` |
| `src/pages/AdminSiteAssignments.tsx` | `isAdmin` → `can('assignments:manage')` |
| `src/pages/AssignForm.tsx` | `isAdmin` → `can('assignments:manage')` |
| `src/pages/AdminDashboard.tsx` | `isSuperAdmin` → `can('admin:panel')` |
| `src/pages/AdminUsers.tsx` | `isAdmin` → `can('admin:users')` |
| `src/pages/OrgAdminDashboard.tsx` | `isOrgAdmin` → `can('org:manage')` |

#### Tier 4 — Content pages
| File | Key checks to migrate |
|---|---|
| `src/pages/SiteDetails.tsx` | `isAdmin` / `isMember` → `can('sites:edit')` / `can('submissions:create')` |
| `src/pages/SiteLists.tsx` | `isAdmin` → `can('sites:create')` |
| `src/pages/NewSite.tsx` | `isAdmin` → `can('sites:create')` |
| `src/pages/EditSite.tsx` | `isAdmin` → `can('sites:edit')` |
| `src/pages/CreateArtifact.tsx` | role check → `can('content:create')` |
| `src/pages/CreateArticle.tsx` | role check → `can('content:create')` |
| `src/pages/CreateEvent.tsx` | role check → `can('content:create')` |
| `src/pages/SubmissionDetail.tsx` | `isAdmin` → `can('submissions:edit-protected')` / `can('submissions:export')` |
| `src/pages/MyAssignments.tsx` | `isMember` → `can('assignments:view-own')` |
| `src/pages/FormFill.tsx` | `isMember` / `isAdmin` → `can('submissions:create')` |
| `src/pages/UploadFilledForm.tsx` | role check → `can('forms:upload')` |

#### Tier 5 — Shared components
| File | Key checks to migrate |
|---|---|
| `src/components/templates/ConsultantPicker.tsx` | `isAdmin` → `can('assignments:manage')` |
| `src/components/AppHeader.tsx` | role checks → permission checks |
| `src/components/AccountButton.tsx` | role checks → permission checks |

---

## PHASE P.7 — Wire Provider in App.tsx

Wrap the app in `<PermissionsProvider>` after `<QueryClientProvider>` so the context
is available to all routes.

```tsx
// src/App.tsx
import { PermissionsProvider } from '@/contexts/PermissionsContext';

// Inside the App component return:
<QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <PermissionsProvider>        {/* ← add this */}
      <HashRouter>
        ...routes...
      </HashRouter>
    </PermissionsProvider>
    <Toaster />
  </ThemeProvider>
</QueryClientProvider>
```

---

## What Stays Unchanged

| Layer | Why |
|---|---|
| `firestore.rules` | Server-side enforcement — PermzPlus is client-only |
| `users/{uid}.role` Firestore field | Still the source of truth; PermzPlus reads it |
| `useUser()` boolean flags (`isOrgAdmin`, etc.) | Kept during migration, deprecated gradually |
| `ProtectedRoute` (auth-only guard) | Unchanged — handles unauthenticated redirect |

---

## Migration Checklist

- [ ] P.1 — `npm install permzplus` + `src/lib/permissions.ts`
- [ ] P.2 — `src/contexts/PermissionsContext.tsx` + `src/hooks/use-permissions.ts`
- [ ] P.3 — `src/components/PermissionGate.tsx`
- [ ] P.4 — Update `src/components/RoleProtectedRoute.tsx`
- [ ] P.5 — Extend `src/hooks/use-user.tsx` with `can()`
- [ ] P.7 — Wrap `<PermissionsProvider>` in `src/App.tsx`
- [ ] P.6 Tier 1 — App.tsx route guards (auto-done by P.4)
- [ ] P.6 Tier 2 — SideNav + BottomNav
- [ ] P.6 Tier 3 — Admin pages (9 files)
- [ ] P.6 Tier 4 — Content pages (11 files)
- [ ] P.6 Tier 5 — Shared components (3 files)

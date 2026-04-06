# PermzPlus v2 — Upgrade Plan
### Bringing PermzPlus to CASL / Permify level for ArchePal

> **Context:** Phase 1 wired PermzPlus as a role-only RBAC system (`can('sites:edit')` returns
> true/false based on role alone). This is equivalent to a basic ACL — the same gap that makes
> CASL and Permify more powerful. This plan closes that gap without replacing PermzPlus.
>
> **Navigation reference:** `docs/navigation/navigation-restructure-plan.md` — the Guest column
> in the role-visibility matrix and the new TopHeader auth pattern both require changes here.

---

## What CASL / Permify do that PermzPlus Phase 1 doesn't

| Capability | CASL | Permify | PermzPlus P1 | Plan target |
|---|---|---|---|---|
| Role-based checks | ✅ | ✅ | ✅ | — |
| **Subject/instance-level checks** | ✅ `can('edit', post)` | ✅ ReBAC | ❌ | **P2.2** |
| **User-context conditions** | ✅ `AbilityBuilder` | ✅ schema | ❌ | **P2.2** |
| **Stable `can()` function** (not a hook) | ✅ `useAbility()` | ✅ | ❌ | **P2.3** |
| **Guest / unauthenticated role** | ✅ | ✅ | ❌ | **P2.1** |
| **Field-level permissions** | ✅ `permittedFieldsOf()` | ✅ | ❌ | **P2.6** |
| **`<Can I="edit" a={post}>`** | ✅ | — | partial | **P2.5** |
| **Policy serialization** | ✅ JSON pack | ✅ | partial | **P2.7** |
| **Backend consistency** | via serialization | dedicated service | ❌ | **P2.7** |

---

## Why instance-level checks matter for ArchePal

Current Phase 1 checks only confirm *"does this role have this permission?"* — not *"does this
user have this permission on this specific resource?"* Three cases in ArchePal fail silently:

| Scenario | Phase 1 result | Correct result |
|---|---|---|
| MEMBER tries to fill a site not assigned to them | `can('submissions:create')` → ✅ (wrong) | ❌ `site.assignedConsultantId !== user.uid` |
| ORG_ADMIN edits a site in a different org | `can('sites:edit')` → ✅ (wrong) | ❌ `site.organizationId !== user.organizationId` |
| MEMBER reads a submission they didn't create | `can('submissions:read-own')` → ✅ (wrong) | ❌ `submission.consultantId !== user.uid` |

Firestore rules catch all three at the server level, but the UI currently lets users *attempt*
the action, then fails with a Firestore error. With instance-level checks the UI gates correctly
before the Firestore call is ever made.

---

## Task Overview

| Task | Name | Output Files | Depends On | Complexity |
|---|---|---|---|---|
| **P2.1** | GUEST role + unauthenticated context | `src/lib/permissions.ts` | — | S |
| **P2.2** | `defineAbilityFor(user)` — subject-aware builder | `src/lib/defineAbility.ts` | P2.1 | M |
| **P2.3** | `useAbility()` hook + `AbilityContext` | `src/contexts/AbilityContext.tsx` · `src/hooks/use-ability.ts` | P2.2 | S |
| **P2.4** | Update `PermissionsWrapper` | `src/components/PermissionsWrapper.tsx` | P2.3 | S |
| **P2.5** | `<Can>` component with subject support | `src/components/Can.tsx` | P2.3 | S |
| **P2.6** | Field-level permission helpers | `src/lib/fieldPermissions.ts` | P2.2 | S |
| **P2.7** | Policy serialization + FastAPI sync | `scripts/export-permissions.ts` · `api/services/permissions.py` | P2.1 | S |
| **P2.8** | Nav plan integration — TopHeader + Guest | `src/components/TopHeader.tsx` (N.1) | P2.3 | M |

**Complexity:** S = Small < half day · M = Medium 1 day

### Build order
```
P2.1 → P2.2 → P2.3 → P2.4 → P2.5 → P2.6
                  ↘
                P2.7   P2.8 (parallel with P2.5+)
```

---

## PHASE P2.1 — GUEST role

Add a `GUEST` role (level 0) to the policy engine. The nav plan's role-visibility matrix has
an explicit Guest column. `PermissionsWrapper` will pass `'GUEST'` when no user is authenticated.

### Changes to `src/lib/permissions.ts`

```typescript
// Add before MEMBER:
policy.addRole({
  name: 'GUEST',
  level: 0,
  permissions: [
    'sites:read',
    'content:read',
  ],
});

// Add to AppPermission type — no new strings needed, GUEST uses existing ones
```

### Changes to `src/components/PermissionsWrapper.tsx`

```tsx
// Pass 'GUEST' when unauthenticated instead of empty string
<PermissionProvider engine={policy} role={highestRole ?? 'GUEST'}>
```

**Nav plan alignment:** TopHeader (N.1) shows "Sign In / Sign Up" to Guests.
`can('org:manage')` → false for GUEST → Admin nav items hidden. ✅

---

## PHASE P2.2 — `defineAbilityFor(user)` — Subject-Aware Ability Builder

The core upgrade. Inspired directly by CASL's `AbilityBuilder` pattern. Takes the full `User`
object and returns a `UserAbility` that knows both the role AND the user's identity/org,
enabling conditions against actual resource instances.

### File: `src/lib/defineAbility.ts`

```typescript
import { policy } from '@/lib/permissions';
import type { AppPermission } from '@/lib/permissions';
import type { User } from '@/types/organization';
import type { Site } from '@/services/sites';
import type { SiteTemplate } from '@/types/siteTemplates';
import type { SiteSubmission } from '@/types/siteSubmissions';

// ── Subject union ─────────────────────────────────────────────────────────────
// Every domain object that permissions can be checked against.
// Add new subjects here as the app grows.
export type AppSubject =
  | { kind: 'Site'; data: Pick<Site, 'organizationId' | 'assignedConsultantId'> }
  | { kind: 'SiteTemplate'; data: Pick<SiteTemplate, 'orgId'> }
  | { kind: 'Submission'; data: Pick<SiteSubmission, 'consultantId' | 'organizationId'> }
  | { kind: 'Any' }; // for checks that don't need a subject

// ── UserAbility ───────────────────────────────────────────────────────────────
export interface UserAbility {
  /**
   * Check a permission, optionally against a specific resource instance.
   *
   * @example
   * ability.can('sites:edit')              // role-only check
   * ability.can('sites:edit', { kind: 'Site', data: site })  // role + org membership
   * ability.can('submissions:fill', { kind: 'Site', data: site }) // role + assignment
   */
  can(permission: AppPermission, subject?: AppSubject): boolean;

  /** Inverse of can(). */
  cannot(permission: AppPermission, subject?: AppSubject): boolean;

  /** The resolved role string ('GUEST' | 'MEMBER' | 'ORG_ADMIN' | 'SUPER_ADMIN'). */
  role: string;

  /** The Firebase user uid, or null for guests. */
  userId: string | null;

  /** The user's organizationId, or null for guests / SUPER_ADMIN. */
  organizationId: string | null;
}

// ── Builder ───────────────────────────────────────────────────────────────────
/**
 * Builds a UserAbility for the given user (or guest).
 * This is the ArchePal equivalent of CASL's `defineAbilityFor(user)`.
 *
 * Subject conditions are applied ON TOP of the role check:
 *   - SUPER_ADMIN: no org/assignment conditions (cross-org access)
 *   - ORG_ADMIN:   sites/templates/submissions must be in their org
 *   - MEMBER:      can only fill forms assigned to them; read own submissions
 *   - GUEST:       no conditions needed (read-only, no resource ownership)
 */
export function defineAbilityFor(user: User | null): UserAbility {
  const role = resolveRole(user);
  const ctx = policy.createContext(role);

  const can = (permission: AppPermission, subject?: AppSubject): boolean => {
    // 1. Role-level check via PermzPlus
    if (!ctx.can(permission)) return false;

    // 2. No subject → role check is sufficient
    if (!subject || subject.kind === 'Any') return true;

    // 3. SUPER_ADMIN bypasses all instance-level conditions
    if (role === 'SUPER_ADMIN') return true;

    // 4. Subject-level conditions
    switch (subject.kind) {
      case 'Site': {
        const { organizationId, assignedConsultantId } = subject.data;
        // Org membership check for all site mutations
        if (['sites:edit', 'sites:delete', 'assignments:manage'].includes(permission)) {
          return user?.organizationId === organizationId;
        }
        // Consultant assignment check for form filling
        if (permission === 'submissions:create') {
          return user?.uid === assignedConsultantId || user?.organizationId === organizationId;
        }
        return true;
      }

      case 'SiteTemplate': {
        const { orgId } = subject.data;
        if (['templates:edit', 'templates:delete', 'templates:publish'].includes(permission)) {
          return user?.organizationId === orgId;
        }
        return true;
      }

      case 'Submission': {
        const { consultantId, organizationId } = subject.data;
        if (permission === 'submissions:read-own') {
          return user?.uid === consultantId;
        }
        if (permission === 'submissions:edit-protected' || permission === 'submissions:export') {
          return user?.organizationId === organizationId;
        }
        return true;
      }
    }
  };

  return {
    can,
    cannot: (permission, subject) => !can(permission, subject),
    role,
    userId: user?.uid ?? null,
    organizationId: user?.organizationId ?? null,
  };
}

function resolveRole(user: User | null): string {
  if (!user) return 'GUEST';
  return user.role ?? 'GUEST';
}
```

---

## PHASE P2.3 — `useAbility()` hook + AbilityContext

The key difference from Phase 1: `useAbility()` returns a **stable object**, not a hook.
You call `ability.can(...)` as a regular function anywhere — in JSX, event handlers, loops,
`useMemo`, wherever. No rules of hooks violated.

### File: `src/contexts/AbilityContext.tsx`

```tsx
import { createContext, useContext, useMemo } from 'react';
import { defineAbilityFor, type UserAbility } from '@/lib/defineAbility';
import { useUser } from '@/hooks/use-user';

const AbilityContext = createContext<UserAbility | null>(null);

export const AbilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const ability = useMemo(() => defineAbilityFor(user), [user]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
};

export const useAbilityContext = () => {
  const ctx = useContext(AbilityContext);
  if (!ctx) throw new Error('useAbilityContext must be inside AbilityProvider');
  return ctx;
};
```

### File: `src/hooks/use-ability.ts`

```typescript
import { useAbilityContext } from '@/contexts/AbilityContext';

/**
 * Returns a stable UserAbility for the current user.
 * Call ability.can() anywhere — it's a plain function, not a hook.
 *
 * @example
 * const ability = useAbility();
 *
 * // Role-only check (same as Phase 1 useCan)
 * ability.can('templates:edit')
 *
 * // Instance-level check (new in Phase 2)
 * ability.can('sites:edit', { kind: 'Site', data: site })
 * ability.can('submissions:fill', { kind: 'Site', data: site })
 *
 * // In JSX
 * {ability.can('org:manage') && <AdminMenu />}
 *
 * // In a loop
 * sites.filter(s => ability.can('sites:edit', { kind: 'Site', data: s }))
 */
export const useAbility = () => useAbilityContext();
```

---

## PHASE P2.4 — Update `PermissionsWrapper`

Add `AbilityProvider` alongside the existing `PermissionProvider`. Both are needed:
- `PermissionProvider` (from permzplus/react) powers `useCan()` / `<PermissionGate>` (Phase 1)
- `AbilityProvider` powers `useAbility()` / `<Can>` (Phase 2)

```tsx
// src/components/PermissionsWrapper.tsx
import { PermissionProvider } from 'permzplus/react';
import { AbilityProvider } from '@/contexts/AbilityContext';
import { useUser } from '@/hooks/use-user';
import { policy } from '@/lib/permissions';

export const PermissionsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { highestRole } = useUser();

  return (
    <PermissionProvider engine={policy} role={highestRole ?? 'GUEST'}>
      <AbilityProvider>
        {children}
      </AbilityProvider>
    </PermissionProvider>
  );
};
```

---

## PHASE P2.5 — `<Can>` component with subject support

CASL-style API: `<Can do="..." on={subject}>`. The `on` prop is the resource instance.
Wraps `useAbility()` so it works with instance-level checks.

### File: `src/components/Can.tsx`

```tsx
import { useAbility } from '@/hooks/use-ability';
import type { AppPermission } from '@/lib/permissions';
import type { AppSubject } from '@/lib/defineAbility';

interface CanProps {
  /** The permission to check. e.g. "sites:edit" */
  do: AppPermission;
  /** Optional resource instance for subject-level check. */
  on?: AppSubject;
  /** Rendered when the check fails. Defaults to null. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children when the current user has the given permission,
 * optionally against a specific resource instance.
 *
 * @example
 * // Role-only check
 * <Can do="templates:edit">
 *   <EditButton />
 * </Can>
 *
 * // Instance-level check — only renders if this specific site is in user's org
 * <Can do="sites:edit" on={{ kind: 'Site', data: site }}>
 *   <EditSiteButton />
 * </Can>
 *
 * // With fallback
 * <Can do="admin:panel" fallback={<p>Access denied</p>}>
 *   <SuperAdminPanel />
 * </Can>
 */
export const Can: React.FC<CanProps> = ({ do: permission, on: subject, fallback = null, children }) => {
  const ability = useAbility();
  return ability.can(permission, subject) ? <>{children}</> : <>{fallback}</>;
};
```

**Usage comparison:**

```tsx
// Phase 1 (still works — role-only)
<PermissionGate permission="sites:edit">
  <EditButton />
</PermissionGate>

// Phase 2 (instance-level — CASL parity)
<Can do="sites:edit" on={{ kind: 'Site', data: site }}>
  <EditButton />
</Can>
```

---

## PHASE P2.6 — Field-Level Permission Helpers

Permify and CASL both support field-level rules. In ArchePal, `TemplateField.isProtected`
controls whether a field is visible to MEMBER. This needs a clean helper so
`DynamicFormRenderer.tsx` and `SubmissionDetail.tsx` can gate field rendering correctly.

### File: `src/lib/fieldPermissions.ts`

```typescript
import type { TemplateField } from '@/types/siteTemplates';
import type { UserAbility } from '@/lib/defineAbility';

/**
 * Returns true if the user can see this field.
 * Protected fields are hidden from MEMBER role.
 *
 * @example
 * const ability = useAbility();
 * const visibleFields = fields.filter(f => canViewField(ability, f));
 */
export function canViewField(ability: UserAbility, field: TemplateField): boolean {
  if (!field.isProtected) return true;
  // Protected fields require edit-protected permission (ORG_ADMIN+)
  return ability.can('submissions:edit-protected');
}

/**
 * Returns true if the user can edit this field's value.
 * Protected fields can only be edited by ORG_ADMIN+.
 *
 * @example
 * const canEdit = canEditField(ability, field);
 * <input disabled={!canEdit} />
 */
export function canEditField(ability: UserAbility, field: TemplateField): boolean {
  if (!field.isProtected) return true;
  return ability.can('submissions:edit-protected');
}

/**
 * Filters a field array down to fields the user may see.
 * Drop-in replacement for manual isProtected checks in DynamicFormRenderer.
 */
export function permittedFields(ability: UserAbility, fields: TemplateField[]): TemplateField[] {
  return fields.filter(f => canViewField(ability, f));
}
```

**Where to use:**
- `src/components/DynamicFormRenderer.tsx` — replace inline `isProtected` checks
- `src/pages/SubmissionDetail.tsx` — replace `isAdmin &&` checks on protected fields
- `src/pages/FormFill.tsx` — gate field editing

---

## PHASE P2.7 — Policy Serialization + FastAPI Sync

CASL can serialize its ability rules to JSON so the frontend and backend share the same
permission map. We do the same with `policy.toJSON()`.

### Script: `scripts/export-permissions.ts`

```typescript
import { policy } from '../src/lib/permissions';
import { writeFileSync } from 'fs';

const snapshot = policy.toJSON();
writeFileSync(
  'api/permissions_policy.json',
  JSON.stringify(snapshot, null, 2),
);
console.log('Permissions snapshot written to api/permissions_policy.json');
```

Run with: `npx tsx scripts/export-permissions.ts`

### File: `api/services/permissions.py`

```python
import json
from pathlib import Path

_POLICY_PATH = Path(__file__).parent.parent / "permissions_policy.json"
_policy: dict | None = None

def _load() -> dict:
    global _policy
    if _policy is None:
        _policy = json.loads(_POLICY_PATH.read_text())
    return _policy

def can(role: str, permission: str) -> bool:
    """
    Mirror of the frontend policy.can(role, permission).
    Used in FastAPI endpoints to gate actions beyond Firestore token checks.
    """
    policy = _load()
    role_def = next((r for r in policy["roles"] if r["name"] == role), None)
    if not role_def:
        return False
    # Collect all roles at or below this level (inheritance)
    level = role_def["level"]
    effective = set()
    for r in policy["roles"]:
        if r["level"] <= level:
            effective.update(r["permissions"])
    # Subtract explicit denies for this role
    denied = set(policy.get("denies", {}).get(role, []))
    effective -= denied
    # Wildcard check
    return permission in effective or "*" in effective
```

**Usage in FastAPI:**
```python
from api.services.permissions import can

@router.get("/submissions/{site_id}/{submission_id}/export-pdf")
async def export_pdf(role: str = Depends(get_user_role)):
    if not can(role, "submissions:export"):
        raise HTTPException(403, "Insufficient permissions")
```

---

## PHASE P2.8 — Nav Plan Integration (TopHeader + Guest)

**Reference:** `docs/navigation/navigation-restructure-plan.md` → Task N.1 + N.5

The TopHeader (N.1) requires permission-aware rendering:
- Guest: show "Sign In / Sign Up"
- Authenticated: show "Welcome, {name}" + Logout

With Phase 2, `TopHeader` uses `useAbility()`:

```tsx
// src/components/TopHeader.tsx
const ability = useAbility();
const { user } = useUser();
const { logout } = useAuth();

// Guest check — no role, so can('org:manage') is false, can('sites:read') is true
const isGuest = ability.role === 'GUEST';
```

This is cleaner than importing `useAuth` + checking `isAuthenticated` separately — the ability
already encodes the auth state via the role.

**Also from nav plan — visibility matrix wired to Phase 2 permissions:**

| Nav item | Permission check (Phase 2) |
|---|---|
| Admin menu | `ability.can('org:manage')` |
| Super Admin item | `ability.can('admin:panel')` |
| My Assignments | `ability.can('assignments:view-own') && !ability.can('org:manage')` |
| Create FAB | `isArchaeologist \|\| ability.can('content:create')` |
| Sign In/Up (header) | `ability.role === 'GUEST'` |
| Welcome/Logout (header) | `ability.role !== 'GUEST'` |

---

## Migration Guide — Phase 1 → Phase 2

All Phase 1 code continues to work. Migrate incrementally:

```tsx
// Phase 1 (still valid — role-only, no subject)
const canEdit = useCan('sites:edit');
<PermissionGate permission="sites:edit">...</PermissionGate>

// Phase 2 — same check, stable function style
const ability = useAbility();
const canEdit = ability.can('sites:edit');

// Phase 2 — instance-level (new capability, no P1 equivalent)
const canEditThisSite = ability.can('sites:edit', { kind: 'Site', data: site });
<Can do="sites:edit" on={{ kind: 'Site', data: site }}>...</Can>

// Phase 2 — field-level (new capability)
const visibleFields = permittedFields(ability, template.fields);
```

**Files to migrate first (highest impact):**
1. `src/pages/SiteDetails.tsx` — Edit/Delete button visibility against current site
2. `src/pages/FormFill.tsx` — Form fill guard against `assignedConsultantId`
3. `src/pages/SubmissionDetail.tsx` — Protected field edit guard
4. `src/components/DynamicFormRenderer.tsx` — `permittedFields()` for field rendering
5. `src/components/TopHeader.tsx` — Guest vs authenticated via `ability.role`

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/lib/permissions.ts` | Add GUEST role (level 0) |
| `src/lib/defineAbility.ts` | **Create** — subject-aware ability builder |
| `src/lib/fieldPermissions.ts` | **Create** — field-level helpers |
| `src/contexts/AbilityContext.tsx` | **Create** — stable ability context |
| `src/hooks/use-ability.ts` | **Create** — `useAbility()` hook |
| `src/components/Can.tsx` | **Create** — `<Can do="" on={}>` component |
| `src/components/PermissionsWrapper.tsx` | Add `AbilityProvider`, pass `'GUEST'` fallback |
| `scripts/export-permissions.ts` | **Create** — policy snapshot export |
| `api/services/permissions.py` | **Create** — Python mirror of policy |
| `src/components/TopHeader.tsx` (N.1) | **Create** — uses `useAbility()` for guest/auth display |

No Firestore rule changes. No service changes.

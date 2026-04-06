# Navigation Restructure Plan

**Reference:** `docs/navigation/navigation.png` (access matrix) + `docs/navigation/mockup.png` (visual layout)
**Branch:** create `feature/nav-restructure` from `main`

---

## Target Layout (from mockup)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] ArchePal          Sign In / Sign Up | Logout | Welcome│  ← TopHeader (new)
├──────────────┬──────────────────────────────────────────────┤
│ Home         │                                              │
│ Sites        │         Main Content Area                    │
│ Diary        │                                              │
│ Artifacts    │                                              │
│ Articles     │                                              │
│ Events       │                                              │
│ Gift Shop  ▾ │                                              │
│ Admin      ▾ │                                              │
│ Account    ▾ │                                              │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│         About Us | Contact Us | Giveback | Help             │  ← Footer (updated)
└─────────────────────────────────────────────────────────────┘
```

---

## Tasks

### N.1 — Create `TopHeader` component (new file)
**File:** `src/components/TopHeader.tsx`

**Visible on all screen sizes.** Fixed top, full width, sits above SideNav and content.

**Left side:**
- ArchePal logo (`/archepal.png`) + "ArchePal" wordmark → navigates to `/`

**Right side — desktop only (`hidden lg:flex` on auth controls):**
- Unauthenticated: "Sign In / Sign Up" link → `/authentication/sign-in`
- Authenticated: "Welcome, {user.displayName || user.email}!" | Logout button

**Right side — mobile:**
- Auth controls hidden (BottomNav handles Sign In / Logout on mobile)
- Theme toggle only (or hamburger if needed in future)

**Styling:** dark navy background (match mockup), white text, `h-14`, `z-50`, `fixed top-0 left-0 right-0`.

**Role visibility:** always visible on all roles + guest, all screen sizes.

---

### N.2 — Update `SideNav` (`src/components/SideNav.tsx`)

#### Remove
- Logo/branding section at top (moves to `TopHeader`)
- `Explore` collapsible and its sub-items
- `Create` collapsible and its sub-items
- `Sign In / Create Account` button section at bottom (moves to `TopHeader`)
- Theme toggle at bottom (moves to `TopHeader`)
- `About Us`, `Contact Us`, `Give Feedback` from Account sub-items (move to Footer)

#### New flat top-level structure (in order)

```
Home                            (all roles + guest)
Sites                           (all roles + guest)
Diary                           (all roles + guest)
Artifacts                       (all roles + guest)
Articles                        (all roles + guest)
Events                          (all roles + guest)
Gift Shop ▾                     (all roles + guest)
  └ Merchandise    → /gift-shop
  └ 3D Artifacts   → /artifacts?type=3d   (filtered view of Artifacts page)
Admin ▾                         (SUPER_ADMIN + ORG_ADMIN only)
  └ Site Forms     → /templates
  └ Organization   → /org-dashboard
  └ Sites          → /admin-assignments
  └ Users          → /admin-users         (new page)
  └ Super Admin    → /admin               (SUPER_ADMIN only)
──────────────────── (divider)
My Assignments      → /my-assignments     (MEMBER role only, not shown to admins)
──────────────────── (divider)
Account ▾                       (authenticated only)
  └ Profile              → /account
  └ Change Password      → /edit-profile
  └ Preferences          → /account       (Settings tab)
  └ Deactivate Account   → /deactivate    (separate route)
  └ Logout
```

#### Active state updates
- `isExploreActive` → remove (no Explore group)
- Add individual `isActive` checks for Sites, Diary, Artifacts, Articles, Events
- `isAdminActive` — update to include `/admin-users`
- `isGiftShopActive` — update to include `/3d-artifacts`

#### `SideNav` top offset
Starts below the header: `top-14` (was `top-0`).

---

### N.3 — Update `Footer` (`src/components/Footer.tsx`)

**Add nav links row** above the copyright line:

```
About Us | Contact Us | Giveback | Help
```

| Link | Route |
|------|-------|
| About Us | `/about-us` |
| Contact Us | `/contact` |
| Giveback | `/donations` |
| Help | `/help` (new page — YouTube video content planned) |

Keep existing copyright line. Keep Testimonials link.

---

### N.4 — Update `BottomNav` (`src/components/BottomNav.tsx`)

#### Bottom tab bar (5 tabs)

| Slot | Current | Proposed |
|------|---------|----------|
| 1 | Home | Home (unchanged) |
| 2 | Explore | Explore → opens sheet (updated items) |
| 3 (FAB) | + Create (archaeologist only) | + Create (admins + members) |
| 4 | Diary | **Gift Shop** → opens sheet |
| 5 | Account/More | Account/More (unchanged) |

#### Explore sheet (updated)
Remove: Collaborate (`/team`), Chat (`/chat`)
New list:
- Sites → `/site-lists`
- Diary → `/digital-diary`
- Artifacts → `/artifacts`
- Articles → `/articles`
- Events → `/events`

#### Gift Shop sheet (new, replaces Diary tab)
- Merchandise → `/gift-shop`
- 3D Artifacts → `/3d-artifacts`

#### Create FAB
Change guard: was `isArchaeologist` only → now `isArchaeologist || isMember || isAdmin`

#### Account/More sheet changes
**Remove from account items array:**
- About Us (moves to Footer)
- Contact Us (moves to Footer)
- Give Feedback (removed entirely)

**Add to account items array:**
- Deactivate Account → `/deactivate` (separate route)

**Footer strip inside BottomNav** (`© ArchePal | Testimonials | Tech Titans`):
- Keep as-is (mobile only, small strip) — About Us / Help links are in desktop Footer

---

### N.5 — Update `ResponsiveLayout` (`src/components/ResponsiveLayout.tsx`)

1. Import and render `<TopHeader />` at the very top — visible on all screen sizes.
2. Content area: add `pt-14` (all screens) to offset content below the fixed header.
3. `SideNav` self-offsets using `top-14` internally (was `top-0`).
4. On mobile, `BottomNav` still handles auth — `TopHeader` shows logo only (auth controls hidden on mobile).

```tsx
// Updated layout structure:
<div className="min-h-screen bg-background safe-top">
  <TopHeader />                         {/* new — fixed, all screen sizes */}
  <SideNav />                           {/* fixed, starts at top-14 on desktop */}
  <div className={`
    min-h-screen
    lg:ml-64 xl:ml-72
    pt-14                               {/* offset below TopHeader on all screens */}
    ${showBottomNav ? 'pb-nav lg:pb-0' : ''}
    ...
  `}>
    ...
  </div>
  {showBottomNav && <BottomNav />}
</div>
```

---

## Role-Based Visibility Matrix

| Nav Item | SUPER_ADMIN | ORG_ADMIN | MEMBER | Guest |
|----------|-------------|-----------|--------|-------|
| Home | ✓ | ✓ | ✓ | ✓ |
| Sites | ✓ full CRUD | ✓ full CRUD | ✓ (own org) | Read only |
| Diary | ✓ full CRUD | ✓ full CRUD | ✓ (own org) | Read only |
| Artifacts | ✓ full CRUD | ✓ full CRUD | ✓ (own org) | Read only, can submit to OSA |
| Articles | ✓ full CRUD | ✓ full CRUD | ✓ (own org) | Read only |
| Events | ✓ full CRUD | ✓ full CRUD | ✓ (own org) | Read only |
| Gift Shop | ✓ full | ✓ full | ✓ full | No Create/Update/Delete |
| Admin | ✓ (all orgs) | ✓ (own org) | — | — |
| My Assignments | — | — | ✓ | — |
| Account | ✓ (no Deactivate) | ✓ (no Deactivate) | ✓ | — |
| Header (Sign In/Up) | — | — | — | ✓ |
| Header (Welcome/Logout) | ✓ | ✓ | ✓ | — |
| Footer links | ✓ | ✓ | ✓ | ✓ |

---

## Files Changed Summary

| File | Change Type |
|------|------------|
| `src/components/TopHeader.tsx` | **Create new** |
| `src/components/SideNav.tsx` | **Major rewrite** |
| `src/components/BottomNav.tsx` | **Moderate update** |
| `src/components/Footer.tsx` | **Minor update** |
| `src/components/ResponsiveLayout.tsx` | **Minor update** (add TopHeader, add pt-14) |
| `src/pages/AdminUsers.tsx` | **Create new** (stub — `/admin-users`) |
| `src/pages/Help.tsx` | **Create new** (stub — `/help`, YouTube videos planned) |
| `src/pages/Deactivate.tsx` | **Create new** (stub — `/deactivate`) |
| `src/App.tsx` | **Add 3 new routes** |

No service changes. No Firestore rule changes.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | 3D Artifacts page | Filtered view → `/artifacts?type=3d` (no new page) |
| 2 | Users under Admin | New page → `/admin-users` |
| 3 | Help page | New page → `/help` (YouTube video content planned) |
| 4 | Deactivate Account | Separate route → `/deactivate` |
| 5 | TopHeader on mobile | TopHeader visible on mobile (logo only); BottomNav handles auth on mobile |
| 6 | Give Feedback | Removed entirely from nav |

# ArchePal — Claude Code Project Context

**Project:** ArchePal — FIRST LEGO League COMMUNICATE Challenge
**Purpose:** Digital platform for NC archaeology — site management, artifacts, articles, events,
and a dynamic form system for digitizing ~100 archaeological site form types (65,000+ sites).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3 + TypeScript + Vite 7 |
| Routing | React Router DOM 6 with **HashRouter** (required for Capacitor) |
| UI | shadcn/ui (Radix UI) + Tailwind CSS 3 |
| Forms | React Hook Form 7 + Zod 3 |
| State | TanStack React Query 5 |
| Database | Firebase Firestore (SDK v12) |
| Auth | Firebase Auth (SDK v12) |
| Storage | Firebase Storage (SDK v12) |
| Mobile | Capacitor 8 (iOS + Android) |
| Backend | Python FastAPI (`api/` — Vercel Python serverless functions) |
| AI / PDF parsing | Claude Sonnet 4.6 via Azure AI Foundry |
| Deployment | Vercel (frontend static + backend as Python serverless via `api/`) |
| Toast notifications | Sonner |
| Path alias | `@/` → `src/` |

---

## Development Commands

```bash
npm run dev            # starts frontend (Vite) + backend (FastAPI) concurrently
npm run dev:frontend   # Vite only
npm run dev:backend    # cd backend && python run.py
npm run build          # production build
npm run cap:sync       # sync Capacitor after build
npm run ios            # build + open Xcode
npm run android        # build + open Android Studio
```

---

## Project Structure

```
src/
  pages/          # One file per route — PascalCase (e.g. NewSite.tsx)
  components/     # Reusable components — PascalCase
  components/ui/  # shadcn/ui primitives — do not edit directly
  services/       # Firebase CRUD — static class pattern (e.g. SitesService)
  hooks/          # Custom React hooks — use-*.tsx naming
  types/          # TypeScript interfaces — camelCase files (e.g. organization.ts)
  lib/
    firebase.ts   # Firebase app, db, auth, storage init — already has offline persistence
  App.tsx         # ALL routes registered here — HashRouter
backend/          # Python FastAPI — empty, currently being scaffolded
docs/             # Feature docs + planning (dynamic-site-templates-plan.md)
firestore.rules   # Firestore security rules
storage.rules     # Firebase Storage rules
firestore.indexes.json
```

---

## Routing Conventions

- **All routes** are in `src/App.tsx` using `<HashRouter>` — never `BrowserRouter`
- Route protection uses existing wrapper components:
  - `<ProtectedRoute>` — requires authentication
  - `<AdminRoute>` — requires `ORG_ADMIN` or `SUPER_ADMIN`
  - `<SuperAdminRoute>` — requires `SUPER_ADMIN` only
- Import from `src/components/RoleProtectedRoute.tsx`

```tsx
// Pattern for adding a new protected route in App.tsx:
import NewPage from './pages/NewPage';
<Route path="/new-page" element={<AdminRoute><NewPage /></AdminRoute>} />
```

---

## Firebase Patterns

### Collection Names
Legacy content collections use **PascalCase**: `Sites`, `Articles`, `Artifacts`, `Events`,
`DigitalDiary`, `Merchandise`

New collections use **camelCase**: `siteTemplates`, `organizations`, `users`, `invitations`,
`user_roles`, `roles`, `teams`

### Service Class Pattern
All Firebase CRUD lives in `src/services/` as static class methods. Always check `db` is
initialized before use (can be `undefined`). Always include `updatedAt: Timestamp.now()` on
creates and updates.

```typescript
// Correct pattern — follow src/services/sites.ts exactly:
import { collection, doc, getDocs, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export class ExampleService {
  static async create(data: Omit<Example, 'id'>): Promise<string> {
    if (!db) throw new Error('Firebase is not properly initialized');
    const ref = collection(db, 'CollectionName');
    const docRef = await addDoc(ref, { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    return docRef.id;
  }
}
```

### Firebase Init — `src/lib/firebase.ts`
- Already uses `persistentLocalCache()` for offline support (Firestore v12 pattern)
- Uses `indexedDBLocalPersistence` for Auth on Capacitor native platforms
- **Do not add** `enableMultiTabIndexedDbPersistence` — it was removed in v12

### Firebase Offline Persistence (v12 correct pattern)
```typescript
// Already configured in src/lib/firebase.ts — DO NOT duplicate
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
const db = initializeFirestore(app, { localCache: persistentLocalCache() });
```

---

## Role & Auth System

Roles are stored in **Firestore** (`users/{uid}.role`), not Firebase Auth custom claims.

| Role value | Meaning |
|---|---|
| `SUPER_ADMIN` | Full access across all organizations |
| `ORG_ADMIN` | Manage org templates, sites, assign consultants |
| `MEMBER` | Fill assigned forms, read content |

### Frontend Role Checks — use `useUser()` hook
```typescript
import { useUser } from '@/hooks/use-user';
const { isOrgAdmin, isMember, isSuperAdmin, isAdmin, user, organization } = useUser();
```

### Firestore Rule Helper Functions (already defined in `firestore.rules`)
```
isSuperAdmin()      — checks users/{uid}.role == 'SUPER_ADMIN'
isOrgAdmin()        — checks users/{uid}.role == 'ORG_ADMIN'
isAnyAdmin()        — SUPER_ADMIN or ORG_ADMIN
belongsToOrg(orgId) — checks users/{uid}.organizationId == orgId
canAccessOrg(orgId) — isSuperAdmin() OR belongsToOrg(orgId)
getUserData()       — get(users/{uid}).data
```

**Always use these existing helpers** when writing new Firestore rules — never introduce
Firebase Auth custom claims (`request.auth.token.role`).

---

## UI Conventions

- **Components:** shadcn/ui from `src/components/ui/` — use existing ones before installing new
- **Dialogs/Alerts:** `AlertDialog` for destructive actions, `Dialog` for forms
- **Searchable dropdowns:** `Command` + `Popover` (see `ConsultantPicker` pattern)
- **Toasts:** `import { toast } from 'sonner'` — `toast.success()`, `toast.error()`
- **Icons:** `lucide-react` only
- **Loading states:** Use shadcn `Skeleton` components
- **Forms:** Always `react-hook-form` + `zod` resolver — never uncontrolled inputs for complex forms

```typescript
// Standard form pattern:
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1) });
const form = useForm({ resolver: zodResolver(schema) });
```

---

## Environment Variables

**Frontend** (`VITE_` prefix — all in `.env`):
```
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID, VITE_FIREBASE_DATABASE_URL
VITE_AZURE_OPENAI_ENDPOINT, VITE_AZURE_OPENAI_API_KEY   ← existing GPT-4o (chat features)
VITE_ARCHAEOLOGIST_VERIFICATION_CODE
VITE_FEEDBACK_VALIDATION_CODE
VITE_APP_URL, VITE_MAX_UPLOAD_MB                        ← to be added
```

**Backend** (no prefix — in `backend/.env`, never expose to client):
```
Azure_PROJECT_ENDPOINT    ← Azure AI Foundry endpoint for Claude Sonnet 4.6
AZURE_PROJECT_API_KEY     ← Azure AI Foundry API key
FIREBASE_SERVICE_ACCOUNT_PATH
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
```

---

## FastAPI Backend (`api/`)

Lives in `api/` (Vercel Python serverless convention). Entry point: `api/index.py` exports
a FastAPI `app`. `npm run dev:backend` runs `cd api && uvicorn index:app --reload --port 8000`.

**Vercel routing:** `vercel.json` rewrites `/api/*` → `api/index.py`.
**`requirements.txt` at project root** — not inside `api/`.
**Firebase Admin credentials:** env var `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON string) —
never a file path (Vercel filesystem is ephemeral).
**Secrets in production:** Vercel Environment Variables dashboard — no `.env` deployed.
**Local secrets:** `api/.env` (git-ignored).

**GPT-4o integration pattern** (`api/services/claude_parser.py`):
```python
from openai import AzureOpenAI
client = AzureOpenAI(
    azure_endpoint=os.environ["VITE_AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["VITE_AZURE_OPENAI_API_KEY"],
    api_version=os.environ.get("VITE_AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
)
response = client.chat.completions.create(model=os.environ.get("VITE_AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o"), ...)
```

**pip packages:** `fastapi uvicorn pdfplumber openai python-multipart firebase-admin aiosmtplib python-dotenv reportlab`

**Vercel plan:** Pro recommended — PDF parsing takes 15-30s (Hobby cap is 60s, Pro is 300s).

---

## Feature In Development: Dynamic Archaeology Site Templates

Full plan: `docs/dynamic-site-templates-plan.md`

**New Firestore collections:**
- `siteTemplates/{id}` + subcollections `fields/`, `sections/`
- `Sites/{siteId}/submissions/{submissionId}` — subcollection under existing `Sites`

**Existing `Sites` collection gains 4 new fields:**
`linkedTemplateId`, `assignedConsultantId`, `assignedConsultantEmail`, `submissionStatus`

**Key new files being added:**
```
src/types/siteTemplates.ts, siteSubmissions.ts
src/services/siteTemplates.ts, siteSubmissions.ts, siteAssignments.ts
src/components/DynamicFormRenderer.tsx          ← core shared component
src/components/formFields/                      ← one component per FieldType
src/lib/conditionalLogic.ts, reliabilityScore.ts, coordinateSchemas.ts, mediaQueue.ts
src/pages/TemplateList, TemplateEditor, TemplateBuilder, TemplateImportPDF
src/pages/AdminSiteAssignments, AssignForm
src/pages/MyAssignments, FormFill, SubmissionDetail
scripts/seed-cemetery-template.ts
backend/routers/pdf.py, export.py, notify.py
backend/services/claude_parser.py, firebase_admin.py, pdf_builder.py
```

**Implementation order:** Phase 1 (types + rules) → Phase 4 (DynamicFormRenderer) →
Phase 2 (admin template UI) → Phase 5 (FastAPI backend) → Phase 3 (site assignment) →
Phase 4 (form fill + offline) → Phase 6 (routing) → Phase 7 (validation)

---

## Key Decisions & Constraints

- **HashRouter is mandatory** — BrowserRouter breaks Capacitor deep links
- **No Firebase Auth custom claims** — all role checks read from `users/{uid}.role` in Firestore
- **MEMBER role = Field Consultant** — no new role type needed
- **`Sites` collection name is capital S** — legacy; all new collections are camelCase
- **Services use static class pattern** — not standalone functions, not hooks
- **`db` can be `undefined`** — always guard with `if (!db) throw new Error(...)`
- **No `react-firebase-hooks` package** — use custom hooks in `src/hooks/` instead
- **Firebase SDK v12** — use `persistentLocalCache()` not deprecated `enableMultiTabIndexedDbPersistence`
- **All exports from `@react-pdf/renderer` must be client-only** (not in FastAPI — use `reportlab`)
- **Capacitor plugins available:** Camera, Geolocation, Network, Filesystem, Keyboard, Haptics

## Where we left off

**Branch:** `dynamic-form`

**Completed Tasks:**
- ✅ 1.1 — TypeScript interfaces (`src/types/siteTemplates.ts`, `src/types/siteSubmissions.ts`)
- ✅ 1.2 — Firestore security rules (`firestore.rules`)
- ✅ 1.3 — Firebase Storage rules (`storage.rules`)
- ✅ 1.4 — Service layer (`src/services/siteTemplates.ts`, `siteSubmissions.ts`, `siteAssignments.ts`)
- ✅ 1.5 — Dynamic PDF → Claude pipeline (`api/index.py`, `api/routers/pdf.py`, `api/services/claude_parser.py`, `src/services/pdfParser.ts`, `src/pages/TemplateImportPDF.tsx`)
- ✅ 4.2 — DynamicFormRenderer + all 10 field components (`src/components/DynamicFormRenderer.tsx`, `src/components/formFields/`, `src/lib/conditionalLogic.ts`)
- ✅ 2.1 — Template list page (`src/pages/TemplateList.tsx`, SideNav + App.tsx routes)
- ✅ 2.2 — New Template choice modal (`src/components/templates/NewTemplateModal.tsx`)
- ✅ 2.3 — Template editor with property panel (`src/pages/TemplateEditor.tsx`, `src/services/siteTemplates.ts` + `saveField`/`saveSection`/`deleteField`)
- ✅ 2.4 — Drag-and-drop reordering in TemplateEditor via `@dnd-kit` + extracted `src/components/templates/FieldEditor.tsx`
- ✅ 2.5 — Blank canvas form builder (`src/pages/TemplateBuilder.tsx`) with field palette + 3 pre-built archaeological blocks
- ✅ 3.1 — Admin Site Assignments list (`src/pages/AdminSiteAssignments.tsx`, `/admin-assignments` route, SideNav entry)
- ✅ 3.2 — Extend Site Creation: `stateSiteNumber` + `siteType` + `linkedTemplateId` fields added to `NewSite.tsx`, `Site` interface in `sites.ts`, and Form Assignment card added to `SiteDetails.tsx`
- ✅ 3.4 — Consultant Picker component (`src/components/templates/ConsultantPicker.tsx`)
- ✅ 3.3 — Assign Form to Consultant (`src/pages/AssignForm.tsx`, `/assign-form/:siteId` route)
- ✅ 4.1 — My Assignments page (`src/pages/MyAssignments.tsx`, `/my-assignments` route, BottomNav + SideNav MEMBER-only entries)
- ✅ 4.3 — FormFill page (`src/pages/FormFill.tsx`, `/form/:siteId` route) — auto-save (2s debounce), progress bar, submit with site status update; `DynamicFormRenderer` extended with `onChange` prop
- ✅ 4.5 — File Upload Field with Firebase Storage (`src/components/formFields/FileUploadField.tsx`) — per-file progress bars via `uploadBytesResumable`, max size validation (`VITE_MAX_UPLOAD_MB`), delete from Storage + Firestore; React Context (`src/contexts/FormFillContext.tsx`) provides `siteId/submissionId/orgId` to field components without threading through `DynamicFormRenderer`; `FormFill.tsx` wraps renderer with `<FormFillContext.Provider>`
- ✅ 5.3 — PDF Export endpoint (`api/routers/export.py` + `api/services/pdf_builder.py`) — `GET /api/submissions/{siteId}/{submissionId}/export-pdf`; verifies Firebase ID token to determine role; protected sections included only for ORG_ADMIN/SUPER_ADMIN; reportlab layout with section headers, field label/value pairs, repeating_group mini-tables, branded header/footer
- ✅ 5.4 — CSV Export endpoint (`api/routers/export.py`) — `GET /api/submissions/{siteId}/{submissionId}/export-csv`; serializes first `repeating_group` field to CSV using Python's `csv` module; respects protected field visibility
- ✅ 5.5 — Consultant Notification endpoint (`api/routers/notify.py`) — `POST /api/notify-consultant`; looks up site name + consultant display name from Firestore; sends branded HTML+text email via `aiosmtplib`; gracefully skips if `SMTP_HOST` not configured; returns `{"ok": true}` regardless (frontend is fire-and-forget)
- ✅ Firebase Admin SDK init (`api/services/fb_admin.py`) — singleton pattern, reads `FIREBASE_SERVICE_ACCOUNT_JSON` env var; `get_db()` + `verify_id_token()` helpers
- ✅ `api/index.py` updated — registers `export` + `notify` routers

**Backend fixed:**
- `pip3 install -r requirements.txt` — packages now installed (fastapi, uvicorn, anthropic, etc.)
- `vite.config.ts` — Vite proxy `/api/*` → `http://localhost:8000`
- `package.json` `dev:backend` — changed to `uvicorn api.index:app --reload --port 8000` (run from project root)
- `api/index.py` CORS — added `http://localhost:8080`

- ✅ 6.3 — Integration with existing screens:
  - `SiteDetails.tsx` — "Fill Form" / "Continue Form" CTA card for MEMBER when `assignedConsultantId === user.uid`; shows template name + status; hidden after submission
  - `SiteLists.tsx` — submission status badge on site cards (amber = Pending, blue = In Progress, green = Submitted/Reviewed)
  - `OrgAdminDashboard.tsx` — "Site Assignments" tab added alongside Members tab; shows 4 stat cards (Total / Unassigned / In Progress / Submitted) + "Manage All Site Assignments" link
- ✅ 6.4 — Firestore composite indexes (`firestore.indexes.json`) — 4 indexes: siteTemplates (orgId+status+updatedAt), Sites (organizationId+assignedConsultantId+updatedAt), Sites (organizationId+submissionStatus), submissions collectionGroup (consultantId)

- ✅ 7.1 — Reliability score lib (`src/lib/reliabilityScore.ts`) — `calculateReliability(fields, formData)` returns `{ score, label }` where label is Complete/Incomplete/Unreliable; `FormFill.tsx` updated to use it with colour-coded progress bar
- ✅ 7.2 — Coordinate validation schemas (`src/lib/coordinateSchemas.ts`) — `LatLngSchema` + `UTMSchema` (Zod); `CoordinatesLatLngField.tsx` + `CoordinatesUTMField.tsx` updated with Controller `rules.validate` that handle optional vs required coordinates and range checks
- ✅ 7.3 — Submission Detail page (`src/pages/SubmissionDetail.tsx`, route `/submission/:siteId/:submissionId`) — read-only field display grouped by section; file thumbnails + links; repeating-group tables; data reliability bar + export PDF/CSV buttons (calls FastAPI with Bearer token); ORG_ADMIN can edit protected section text/number/date/textarea fields inline

**Next tasks:** Phase 7 is complete. All planned dynamic-form feature phases are implemented.

**AI model:**
- PDF parsing backend uses **GPT-4o via Azure OpenAI** (`openai` SDK, `AzureOpenAI` client)
- Env vars: `VITE_AZURE_OPENAI_ENDPOINT`, `VITE_AZURE_OPENAI_API_KEY`, `VITE_AZURE_OPENAI_DEPLOYMENT_NAME`, `VITE_AZURE_OPENAI_API_VERSION`
- PDF text extracted via `pdfplumber` before sending to GPT-4o (no native PDF block support)
- Frontend artifact/article image analysis (`src/services/azure-openai.ts`) also uses same deployment

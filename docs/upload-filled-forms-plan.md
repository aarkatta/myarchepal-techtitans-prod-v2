# Upload Filled Forms — Development Tasks
### Stack: React 18 · Vite · TypeScript · Firebase (Firestore · Auth · Storage) · FastAPI · Capacitor · Vercel

> **Feature:** Archaeologists (MEMBER role) and ORG_ADMINs can upload a photo or scan of an
> already-filled-out paper form. The system extracts both the form structure (template) and the
> filled values using Claude AI. If a matching template already exists, values are mapped to it.
> If not, a new template is auto-generated as a draft and queued for admin review. A site is
> either selected from existing records or created on the spot. The result is a pre-populated
> submission the user can review, correct, and submit.

---

## Project Conventions (Follow Throughout)

Same conventions as `docs/dynamic-site-templates-plan.md`. Key reminders:
- All new routes go in `src/App.tsx` with `<HashRouter>`
- Backend lives in `api/` (Vercel Python serverless) — entry point `api/index.py`
- Firebase Admin SDK via `api/services/fb_admin.py` (`get_db()`, `verify_id_token()`)
- Static class pattern for all service files in `src/services/`
- `CLAUDE_API_KEY` env var for all Anthropic API calls
- Never add `undefined` values to Firestore documents — strip with `Object.entries` filter

---

## What Already Exists (Reusable)

| Existing piece | Location | How it's reused |
|---|---|---|
| Blank PDF → template structure | `api/services/claude_parser.py` | Prompt pattern and JSON schema reused in new filled-form parser |
| Image → field values (template known) | `api/services/form_image_parser.py` | Prompt pattern reused; extended to also return structure |
| `DynamicFormRenderer` | `src/components/DynamicFormRenderer.tsx` | Used in Review step to display pre-populated form |
| `reliabilityScore.ts` | `src/lib/reliabilityScore.ts` | Used in Review step for completeness bar |
| Firebase Admin SDK | `api/services/fb_admin.py` | Used in new site creation and notify endpoints |
| `notify.py` router | `api/routers/notify.py` | Extended with admin template-review notification |
| `FormFillContext` | `src/contexts/FormFillContext.tsx` | Provides siteId/submissionId/orgId to field components |
| `SiteSubmissionsService` | `src/services/siteSubmissions.ts` | Used to create/update the pre-populated submission |
| `SiteTemplatesService` | `src/services/siteTemplates.ts` | Used to save auto-generated template |

---

## Design Decisions & Assumptions

| Decision | Choice | Rationale |
|---|---|---|
| Who can use this | MEMBER + ORG_ADMIN (both) | Admins should be able to do everything members can |
| Site creation by MEMBER | Allowed via backend endpoint only | Keeps Firestore rules clean; Admin SDK bypasses client rules |
| Template approval gate | `pending_template` status — MEMBER sees data but can't officially submit | Protects submission integrity until template is validated |
| File formats supported | PDF, JPEG, PNG, WEBP | Matches what Claude natively supports |
| Template matching threshold | ≥80% label overlap = auto-match · 50–79% = show user a choice · <50% = new template | Balances false positives vs. unnecessary new templates |
| MEMBER visibility while pending | Full read-only DynamicFormRenderer preview of their extracted data | Better UX than a blank waiting screen |
| Claude model for filled forms | `claude-opus-4-6` for PDFs · `claude-sonnet-4-6` for images | Matches existing service precedents |

---

## Task Overview

### Phase Summary

| Phase | Name | Tasks | Description |
|---|---|---|---|
| A | Backend: Filled Form Parser + Matcher | A.1 – A.3 | New Claude pipeline that extracts both template structure AND field values; server-side template matching |
| B | Backend: MEMBER Site Creation | B.1 – B.2 | Firebase Admin SDK endpoint for site creation; register new routers |
| C | Types & Services | C.1 – C.3 | New TypeScript types, frontend service helpers, Firestore/Storage rule updates |
| D | Frontend: Upload Filled Form Wizard | D.1 | 5-step upload wizard page |
| E | Admin: Pending Template Review | E.1 – E.3 | Template list filter, dashboard stat card, admin notification email |
| F | Routing & Navigation | F.1 | App.tsx routes, BottomNav tab, MyAssignments CTA |

---

### All Tasks

| Task | Name | Key Output | Depends On | Complexity |
|---|---|---|---|---|
| **A.1** | Filled Form Parser Service | `api/services/filled_form_parser.py` | — | M |
| **A.2** | Template Matcher Service | `api/services/template_matcher.py` | A.1 | M |
| **A.3** | Parse Filled Form Endpoint | `api/routers/filled_form.py` | A.1, A.2 | S |
| **B.1** | MEMBER Site Creation Endpoint | `api/routers/sites.py` | — | S |
| **B.2** | Register New Routers | `api/index.py` | A.3, B.1 | S |
| **C.1** | Type Updates | `src/types/siteTemplates.ts` · `src/types/siteSubmissions.ts` | — | S |
| **C.2** | Frontend Service Updates | `src/services/siteTemplates.ts` · `src/services/siteAssignments.ts` | C.1 | S |
| **C.3** | Firestore & Storage Rule Updates | `firestore.rules` · `storage.rules` | C.1 | S |
| **D.1** | Upload Filled Form Wizard | `src/pages/UploadFilledForm.tsx` | A.3, B.1, C.2 | L |
| **E.1** | Pending Review UI — Template List | `src/pages/TemplateList.tsx` | C.1 | S |
| **E.2** | Pending Review UI — Dashboard | `src/pages/OrgAdminDashboard.tsx` | C.1 | S |
| **E.3** | Admin Notification Email | `api/routers/notify.py` (extend) | A.3 | S |
| **F.1** | Routes + Nav + Assignments CTA | `src/App.tsx` · `src/components/BottomNav.tsx` · `src/pages/MyAssignments.tsx` | D.1 | S |

**Complexity:** S = Small < 1 day · M = Medium 1–2 days · L = Large 2–4 days

---

### Recommended Build Order

```
A.1 → A.2 → A.3      (Backend parser + matcher — unblocks everything)
B.1 → B.2             (Site creation endpoint + register routers)
C.1 → C.2 → C.3      (Types + services + rules)
D.1                   (Upload wizard — depends on A.3, B.1, C.2)
E.1 → E.2 → E.3      (Admin review UI + notification — depends on C.1, A.3)
F.1                   (Routes + nav — last, depends on D.1)
```

---

## PHASE A — Backend: Filled Form Parser + Matcher

### Task A.1 — Filled Form Parser Service

**File:** `api/services/filled_form_parser.py`

New Claude pipeline that does **both jobs in one call**: extract the form structure (sections +
fields) AND read the filled-in values. This is the core new capability — neither
`claude_parser.py` (structure only) nor `form_image_parser.py` (values only, needs template
upfront) covers this case.

**Two input modes — same service, different content blocks:**

| Mode | Input | Claude content block | Model |
|---|---|---|---|
| PDF | base64-encoded PDF | `{ type: "document", source: { type: "base64", media_type: "application/pdf", data: ... } }` | `claude-opus-4-6` |
| Image | base64-encoded image | `{ type: "image", source: { type: "base64", media_type: ..., data: ... } }` | `claude-sonnet-4-6` |

**Return schema:**

```python
{
  "template_name": str,           # e.g. "Cemetery Site Form"
  "site_type": str,               # e.g. "Cemetery"
  "suggested_site_name": str,     # extracted from form header (e.g. "Oakdale Cemetery — 31WK002")
                                  # empty string if not found
  "sections": [                   # same schema as claude_parser.py
    {
      "id": "section-0",
      "title": str,
      "order": int,
      "isCollapsible": True,
      "isProtected": bool
    }
  ],
  "fields": [                     # same schema as claude_parser.py
    {
      "id": str,                  # e.g. "field-0"
      "sectionId": str,
      "fieldType": str,
      "order": int,
      "isRequired": bool,
      "isHidden": False,
      "isProtected": bool,
      "options": list[str] | None,
      "conditionalLogic": dict | None,
      "placeholder": str | None,
      "helpText": str | None,
      "groupFields": list | None
    }
  ],
  "form_data": {                  # NEW — { field_label_normalized: extracted_value }
    str: any                      # key = normalized field label (not id — matched later)
  }
}
```

> **Note:** `form_data` keys are normalized field labels (not IDs) because IDs don't exist yet
> when parsing a new template. The template matcher in A.2 remaps them to real field IDs once
> a match is found. For new templates, the frontend maps by index/label after saving fields.

**Claude prompt outline (PARSE_FILLED_PROMPT):**

```
You are reading a filled-out archaeological site recording form.

Your task has TWO parts — do both completely:

PART 1 — STRUCTURE: Extract the complete form structure (every section and field).
  Follow the same rules as blank form parsing: extract EVERY field, no skipping, no truncation.
  Output sections[] and fields[] using the exact JSON schema below.

PART 2 — VALUES: For each field, also read what was written/checked/selected on THIS specific
  filled form.
  - text/textarea/number: the written value as a string
  - date: "YYYY-MM-DD" if clear, otherwise as written
  - radio/select: the selected option string
  - multiselect/checkbox: array of selected option strings
  - coordinates_latlong: { "lat": number, "lng": number }
  - coordinates_utm: { "zone": str, "easting": str, "northing": str }
  - If blank, illegible, or not visible: OMIT the key entirely

Also extract:
  - "suggested_site_name": any site name, site number, or location identifier visible in the
    form header or first section (empty string if absent)

Return ONLY valid JSON — no markdown, no explanation:

{
  "templateName": "...",
  "siteType": "...",
  "suggestedSiteName": "...",
  "sections": [...],
  "fields": [...],
  "formData": { "normalizedFieldLabel": value, ... }
}
```

**Python function signature:**

```python
def parse_filled_form_with_claude(
    base64_data: str,
    media_type: str,           # "application/pdf" | "image/jpeg" | "image/png" | "image/webp"
) -> dict:
    """
    Returns { template_name, site_type, suggested_site_name, sections, fields, form_data }.
    form_data keys are normalized field labels (lowercase, stripped punctuation).
    Raises ValueError on empty/unparseable response.
    """
```

Include the same truncation repair helper from `claude_parser.py` — attempt to close
uncomplete JSON if max_tokens is hit.

---

### Task A.2 — Template Matcher Service

**File:** `api/services/template_matcher.py`

Compares the extracted field/section structure against all published templates in the
organization's Firestore collection. Runs server-side so the MEMBER never needs read access
to all templates.

**Matching algorithm:**

1. Load all published `siteTemplates` docs where `orgId == org_id` from Firestore (via
   `get_db()`)
2. For each template, load its `fields` subcollection
3. Normalize all field labels (lowercase, strip punctuation and whitespace)
4. Compute **overlap score**: `len(intersection(extracted_labels, template_labels)) / len(extracted_labels)`
5. Return the best-scoring template if score ≥ 0.50; otherwise return `None`

**Return value:**

```python
{
  "matched_template_id": str | None,
  "matched_template_name": str | None,
  "confidence": float,          # 0.0–1.0
  "confidence_level": str,      # "high" (≥0.80) | "possible" (0.50–0.79) | "none" (<0.50)
  "field_id_map": dict          # { normalized_label: field_id } — empty if no match
                                # used by frontend to remap form_data keys to real field IDs
}
```

**Python function signature:**

```python
def match_template(
    org_id: str,
    extracted_labels: list[str],   # normalized labels from filled_form_parser output
) -> dict:
    """
    Returns match result. confidence_level drives frontend UX branching.
    field_id_map lets the frontend remap form_data keys to real Firestore field IDs.
    """
```

---

### Task A.3 — Parse Filled Form Endpoint

**File:** `api/routers/filled_form.py`

Single endpoint that orchestrates A.1 + A.2 in one request.

```
POST /api/parse-filled-form
Rate limit: 5/minute
Auth: not required at endpoint level (frontend passes org_id; no sensitive data returned)
```

**Request model:**

```python
class ParseFilledFormRequest(BaseModel):
    base64_data: str        # base64-encoded PDF or image (no data URI prefix)
    media_type: str         # "application/pdf" | "image/jpeg" | "image/png" | "image/webp"
    file_name: str          # for logging
    org_id: str             # used for template matching
```

**Response model:**

```python
class ParseFilledFormResponse(BaseModel):
    template_name: str
    site_type: str
    suggested_site_name: str
    sections: list
    fields: list
    form_data: dict             # { normalized_label: value }
    matched_template_id: str | None
    matched_template_name: str | None
    confidence: float
    confidence_level: str       # "high" | "possible" | "none"
    field_id_map: dict          # { normalized_label: real_field_id } — empty if no match
```

**Endpoint logic:**

```
1. parse_filled_form_with_claude(base64_data, media_type)
   → { template_name, site_type, suggested_site_name, sections, fields, form_data }

2. normalized_labels = [normalize(f["label"]) for f in fields]

3. match_template(org_id, normalized_labels)
   → { matched_template_id, matched_template_name, confidence, confidence_level, field_id_map }

4. Return combined response
```

---

## PHASE B — Backend: MEMBER Site Creation

### Task B.1 — MEMBER Site Creation Endpoint

**File:** `api/routers/sites.py`

MEMBERs cannot create `Sites` documents via Firestore rules (client-side). This endpoint
uses the Firebase Admin SDK to create a minimal site document on their behalf.

```
POST /api/sites/create-from-upload
Auth: Firebase ID token required (Bearer header) — any authenticated role
```

**Request model:**

```python
class CreateSiteFromUploadRequest(BaseModel):
    site_name: str
    site_type: str
    id_token: str           # Firebase ID token for auth verification
```

**Endpoint logic:**

```python
1. uid = verify_id_token(body.id_token)["uid"]
2. user_doc = get_db().collection("users").document(uid).get()
3. org_id = user_doc.get("organizationId")
4. if not org_id: raise 403

5. site_ref = get_db().collection("Sites").document()
6. site_ref.set({
     "name": body.site_name,
     "siteType": body.site_type,
     "organizationId": org_id,
     "status": "draft",
     "createdBy": uid,
     "createdAt": SERVER_TIMESTAMP,
     "updatedAt": SERVER_TIMESTAMP,
   })

7. return { "site_id": site_ref.id }
```

**Response model:**

```python
class CreateSiteResponse(BaseModel):
    site_id: str
```

---

### Task B.2 — Register New Routers

**File:** `api/index.py`

Add the two new routers:

```python
from api.routers.filled_form import router as filled_form_router
from api.routers.sites import router as sites_router

app.include_router(filled_form_router, prefix="/api")
app.include_router(sites_router, prefix="/api")
```

---

## PHASE C — Types & Services

### Task C.1 — Type Updates

**File:** `src/types/siteTemplates.ts`

Add `'filled_form_upload'` to the `TemplateSourceType` union:

```typescript
export type TemplateSourceType = 'pdf_digitized' | 'customized' | 'blank_canvas' | 'filled_form_upload';
```

**File:** `src/types/siteSubmissions.ts`

Add `'pending_template'` to the `SubmissionStatus` union:

```typescript
export type SubmissionStatus = 'assigned' | 'in_progress' | 'submitted' | 'reviewed' | 'pending_template';
```

`pending_template` means: a submission was created from an uploaded filled form but the
auto-generated template is still a `draft` awaiting admin review. The MEMBER can see their
data but cannot officially submit yet.

---

### Task C.2 — Frontend Service Updates

**File:** `src/services/siteAssignments.ts`

Add `createSiteFromUpload()` — calls `/api/sites/create-from-upload`:

```typescript
static async createSiteFromUpload(
  siteName: string,
  siteType: string,
  idToken: string
): Promise<string>
// Returns siteId
```

Add `parseFilledForm()` — calls `/api/parse-filled-form`:

```typescript
static async parseFilledForm(
  base64Data: string,
  mediaType: string,
  fileName: string,
  orgId: string
): Promise<ParseFilledFormResult>

interface ParseFilledFormResult {
  templateName: string;
  siteType: string;
  suggestedSiteName: string;
  sections: TemplateSection[];
  fields: TemplateField[];
  formData: Record<string, unknown>;          // normalized_label → value
  matchedTemplateId: string | null;
  matchedTemplateName: string | null;
  confidence: number;
  confidenceLevel: 'high' | 'possible' | 'none';
  fieldIdMap: Record<string, string>;         // normalized_label → real field ID
}
```

> Put `parseFilledForm` in `siteAssignments.ts` to keep form-upload flow together, or create
> a new `src/services/filledFormUpload.ts` if it grows. The latter is preferred.

**Preferred:** create `src/services/filledFormUpload.ts` as a new service with both
`parseFilledForm()` and `createSiteFromUpload()` methods. Keeps concerns separate.

---

### Task C.3 — Firestore & Storage Rule Updates

**File:** `firestore.rules`

The `pending_template` submission status must be writable by MEMBER (same as `in_progress`
draft). No new rule block needed — verify the existing update rule already allows it:

```
// Existing rule already covers this — verify only:
allow update: if request.auth != null
               && (isAnyAdmin()
                   || (getUserData().role == 'MEMBER'
                       && resource.data.consultantId == request.auth.uid
                       && resource.data.isDraft == true));
```

`pending_template` submissions will have `isDraft: true`, so the existing rule covers it.
**No change needed if this is confirmed by reading the current rules.**

Also update the `Sites` create rule to allow MEMBERs to create sites **only via the backend
endpoint** — the Admin SDK bypasses client rules entirely, so **no Firestore rule change is
needed for site creation**.

**File:** `storage.rules`

Verify the existing submission attachment rule covers the new upload path:

```
// Already covers: orgs/{orgId}/sites/{siteId}/submissions/{allPaths=**}
// No change needed — confirm by reading current storage.rules
```

---

## PHASE D — Frontend: Upload Filled Form Wizard

### Task D.1 — Upload Filled Form Wizard Page

**File:** `src/pages/UploadFilledForm.tsx`
**Route:** `/upload-filled-form` — wrapped in `<ProtectedRoute>` (MEMBER + ORG_ADMIN)

5-step wizard. Uses `useState<Step>` to control flow. Steps are rendered conditionally — not
separate routes.

```typescript
type Step = 'upload' | 'parsing' | 'template' | 'site' | 'review';
```

---

#### Step 1 — Upload

UI elements:
- Drag-and-drop zone (dashed border, shadcn `Card`)
- File picker button (accepts `.pdf, .jpg, .jpeg, .png, .webp`)
- On mobile (Capacitor): "Take Photo" button — `Camera.getPhoto({ resultType: CameraResultType.Base64 })`
- File thumbnail preview (image) or filename badge (PDF)
- "Analyze Form" primary button → triggers parse, advances to Step 2

State captured: `file: File | null`, `base64Data: string`, `mediaType: string`, `fileName: string`

Error handling:
- File size > `VITE_MAX_UPLOAD_MB` → `toast.error()`
- Unsupported type → inline error message

---

#### Step 2 — Parsing

Full-screen skeleton with animated status messages cycling through:
1. *"Reading form layout..."*
2. *"Extracting field values..."*
3. *"Checking against existing templates..."*

Calls `FilledFormUploadService.parseFilledForm(base64Data, mediaType, fileName, orgId)`.

On success → advance to Step 3 with the `ParseFilledFormResult`.
On error → show error card with "Try Again" button back to Step 1.

---

#### Step 3 — Template Confirmation

Three sub-states based on `confidenceLevel`:

**3a. `"high"` (≥80% match):**
> Green check icon. "Matched to: **Cemetery Site Form** (94% confidence)"
> Subtitle: "We'll use this existing template to map your form data."
> Two buttons: "Confirm" (advance to Step 4) · "Use Different Template" (open template picker)

**3b. `"possible"` (50–79% match):**
> Amber warning icon. "Possible match: **Roadway Survey Form** (67% confidence)"
> Subtitle: "Not sure if this is the right template. You can confirm or start a new one."
> Three buttons: "Yes, use this template" · "No, create new template" · "Pick a different template"

**3c. `"none"` (<50% — new template):**
> Blue info icon. "New form type detected: **[templateName]**"
> Info banner: *"A draft template will be created from this form. An admin will review it — your data is saved and visible to you while you wait."*
> One button: "Continue" (advance to Step 4)

In all cases: show a collapsible "Detected Fields" section listing extracted section titles +
field count so the user can verify.

---

#### Step 4 — Site Assignment

Two sub-states:

**4a. Site name/number was extracted (`suggestedSiteName` is non-empty):**
> "We found a site reference on the form:"
> Read-only badge: `suggestedSiteName` value
> Radio choice:
>   - "Link to an existing site" → searchable dropdown of `Sites` in their org (same
>     `Command + Popover` pattern as `ConsultantPicker`)
>   - "Create new site with this name" → pre-fills site name field, user confirms site type
>   - "Enter a different site name" → open text field

**4b. No site extracted:**
> "Which site does this form belong to?"
> Same radio choice as 4a but without the pre-filled suggestion.

Site creation flow (if "Create new site" is chosen):
- Show minimal inline form: Site Name (pre-filled if suggested) + Site Type (select)
- On "Confirm" → call `FilledFormUploadService.createSiteFromUpload()` → get `siteId`
- Show a green "Site created" confirmation badge

---

#### Step 5 — Review

Pre-populated `DynamicFormRenderer` with the extracted values loaded as `initialValues`.

**Value remapping logic (run before rendering):**

```typescript
function remapFormData(
  formData: Record<string, unknown>,     // normalized_label → value
  fields: TemplateField[],               // for new templates
  fieldIdMap: Record<string, string>,    // normalized_label → real field ID (matched template)
  matchedTemplateId: string | null
): Record<string, unknown> {
  // If matched: use fieldIdMap to convert label keys → field IDs
  // If new:     match by normalizing field labels from the parsed fields array
}
```

UI elements:
- Page header: site name + template name
- Reliability score bar (reuse `calculateReliability()`)
- `DynamicFormRenderer` in `mode="fill"` — user corrects any extraction errors
- Two footer buttons:
  - **"Save Draft"** — creates submission with `status: 'in_progress'` (matched template) or
    `status: 'pending_template'` (new template), `isDraft: true`
  - **"Submit"** — only enabled if template is not `pending_template`; creates submission with
    `status: 'submitted'`, `isDraft: false`

**Submission creation flow:**
1. If no submission yet: `SiteSubmissionsService.createSubmission(siteId, { ... })`
2. If submission exists: `SiteSubmissionsService.updateSubmission(siteId, submissionId, { formData })`
3. Update `Sites/{siteId}` with `{ linkedTemplateId, assignedConsultantId: uid, submissionStatus }`
4. If new template was auto-generated: call `POST /api/notify-admin-template-review`
5. Navigate to `/my-assignments` (or `/submission/:siteId/:submissionId` if submitted)

**`pending_template` state in Review:**
- Show amber banner: *"Your data is saved. Waiting for an admin to review the generated form template before you can submit."*
- "Submit" button is disabled with tooltip: *"Waiting for template review"*
- "Save Draft" remains enabled

---

## PHASE E — Admin: Pending Template Review

### Task E.1 — Pending Review UI — Template List

**File:** `src/pages/TemplateList.tsx`

Add a "Needs Review" filter tab alongside the existing draft/published filters.

- Query: `siteTemplates` where `orgId == orgId && sourceType == 'filled_form_upload' && status == 'draft'`
- Show amber badge "Auto-generated — needs review" on each matching row
- Add count badge to the tab: "Needs Review (3)"
- Clicking "Edit" on these rows goes to `/templates/:id/edit` (existing `TemplateEditor`)

---

### Task E.2 — Pending Review UI — Dashboard

**File:** `src/pages/OrgAdminDashboard.tsx`

Add a 5th stat card in the Site Assignments tab:

```
Pending Template Reviews
[count of siteTemplates where sourceType == 'filled_form_upload' && status == 'draft']
"Review Now" link → /templates?filter=needs_review
```

---

### Task E.3 — Admin Notification Email

**File:** `api/routers/notify.py`

Add a new endpoint alongside the existing `POST /api/notify-consultant`:

```
POST /api/notify-admin-template-review
```

**Request body:**

```python
class NotifyAdminTemplateReviewRequest(BaseModel):
    template_id: str
    template_name: str
    uploaded_by_uid: str
    site_name: str
    org_id: str
```

**Logic:**
1. Look up ORG_ADMINs in `users` where `organizationId == org_id && role == 'ORG_ADMIN'`
2. Send branded HTML email to each admin:
   - Subject: *"New form template needs review — [template_name]"*
   - Body: who uploaded it, site name, link to `/templates/:template_id/edit`
3. Gracefully skip if `SMTP_HOST` not configured
4. Return `{ "ok": True }` regardless (fire-and-forget)

---

## PHASE F — Routing & Navigation

### Task F.1 — Routes + Nav + Assignments CTA

**File:** `src/App.tsx`

Add new route:

```tsx
import UploadFilledForm from './pages/UploadFilledForm';

<Route
  path="/upload-filled-form"
  element={<ProtectedRoute><UploadFilledForm /></ProtectedRoute>}
/>
```

**File:** `src/components/BottomNav.tsx`

Add "Upload" tab (visible to MEMBER and ORG_ADMIN):

```tsx
{ path: '/upload-filled-form', icon: Upload, label: 'Upload Form' }
```

Place between the "My Assignments" and any existing right-side tabs.

**File:** `src/pages/MyAssignments.tsx`

Add a secondary CTA button below the page header (above the assignments list):

```tsx
<Button variant="outline" onClick={() => navigate('/upload-filled-form')}>
  <Upload className="mr-2 h-4 w-4" />
  Upload a Paper Form
</Button>
```

Also update the `STATUS_CONFIG` in `MyAssignments.tsx` to handle the new `'pending_template'`
status:

```typescript
pending_template: {
  label: 'Pending Review',
  variant: 'secondary',
  icon: Clock,
  description: 'Waiting for admin to review the generated template'
}
```

---

## Summary of New & Modified Files

### New Files

| File | Type | Purpose |
|---|---|---|
| `api/services/filled_form_parser.py` | Backend | Claude call — extracts structure + values from filled PDF or image |
| `api/services/template_matcher.py` | Backend | Fuzzy-matches extracted labels against existing org templates |
| `api/routers/filled_form.py` | Backend | `POST /api/parse-filled-form` — orchestrates parser + matcher |
| `api/routers/sites.py` | Backend | `POST /api/sites/create-from-upload` — MEMBER site creation via Admin SDK |
| `src/services/filledFormUpload.ts` | Frontend | `parseFilledForm()` + `createSiteFromUpload()` service methods |
| `src/pages/UploadFilledForm.tsx` | Frontend | 5-step upload wizard |

### Modified Files

| File | Change |
|---|---|
| `api/index.py` | Register `filled_form_router` + `sites_router` |
| `api/routers/notify.py` | Add `POST /api/notify-admin-template-review` endpoint |
| `src/types/siteTemplates.ts` | Add `'filled_form_upload'` to `TemplateSourceType` |
| `src/types/siteSubmissions.ts` | Add `'pending_template'` to `SubmissionStatus` |
| `src/pages/MyAssignments.tsx` | Add "Upload a Paper Form" CTA + `pending_template` status config |
| `src/pages/TemplateList.tsx` | Add "Needs Review" filter tab for auto-generated templates |
| `src/pages/OrgAdminDashboard.tsx` | Add "Pending Template Reviews" stat card |
| `src/App.tsx` | Register `/upload-filled-form` route |
| `src/components/BottomNav.tsx` | Add "Upload Form" tab |

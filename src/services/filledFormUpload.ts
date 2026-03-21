import type { TemplateSection, TemplateField } from '@/types/siteTemplates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParseFilledFormResult {
  // Extracted structure
  templateName: string;
  siteType: string;
  suggestedSiteName: string;
  sections: TemplateSection[];
  fields: TemplateField[];
  // Extracted values from the filled form — key is the raw field label as
  // Claude read it from the form (not a Firestore field ID)
  formData: Record<string, unknown>;
  // Template match result
  matchedTemplateId: string | null;
  matchedTemplateName: string | null;
  confidence: number;
  /** "high" (≥80%) | "possible" (50–79%) | "none" (<50%) */
  confidenceLevel: 'high' | 'possible' | 'none';
  /**
   * Maps normalized field label → real Firestore field ID for the matched template.
   * Empty object when confidenceLevel === "none".
   * Use this to remap formData keys to real field IDs before saving a submission.
   */
  fieldIdMap: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FilledFormUploadService {
  /**
   * Sends a base64-encoded PDF or image to the backend for parsing.
   * Returns the extracted template structure, filled values, and template match result.
   *
   * @param base64Data  Base64-encoded file contents (no data URI prefix)
   * @param mediaType   MIME type — "application/pdf" | "image/jpeg" | "image/png" | "image/webp"
   * @param fileName    Original filename (used server-side for logging only)
   * @param orgId       The user's organization ID (used for template matching)
   */
  static async parseFilledForm(
    base64Data: string,
    mediaType: string,
    fileName: string,
    orgId: string,
  ): Promise<ParseFilledFormResult> {
    const res = await fetch('/api/parse-filled-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64_data: base64Data,
        media_type: mediaType,
        file_name: fileName,
        org_id: orgId,
      }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail ?? `Parsing failed (${res.status})`);
    }

    const data = await res.json();

    return {
      templateName: data.template_name,
      siteType: data.site_type,
      suggestedSiteName: data.suggested_site_name ?? '',
      sections: data.sections ?? [],
      fields: data.fields ?? [],
      formData: data.form_data ?? {},
      matchedTemplateId: data.matched_template_id ?? null,
      matchedTemplateName: data.matched_template_name ?? null,
      confidence: data.confidence ?? 0,
      confidenceLevel: data.confidence_level ?? 'none',
      fieldIdMap: data.field_id_map ?? {},
    };
  }

  /**
   * Creates a minimal Sites document via the backend (Admin SDK).
   * Used when a MEMBER needs to create a new site during the upload flow,
   * since client-side Firestore rules restrict site creation to admins.
   *
   * @param siteName  Display name for the new site
   * @param siteType  Site type (e.g. "Cemetery", "Habitation")
   * @param idToken   Firebase ID token for the current user (from user.getIdToken())
   * @returns         The new Firestore document ID
   */
  static async createSiteFromUpload(
    siteName: string,
    siteType: string,
    idToken: string,
  ): Promise<string> {
    const res = await fetch('/api/sites/create-from-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_name: siteName,
        site_type: siteType,
        id_token: idToken,
      }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail ?? `Site creation failed (${res.status})`);
    }

    const data = await res.json();
    return data.site_id as string;
  }

  /**
   * Remaps form_data keys from raw field labels to real Firestore field IDs.
   *
   * When a template match is found, Claude's extracted formData uses field labels
   * as keys. This function normalizes those labels and uses the fieldIdMap returned
   * by the backend to produce a formData object keyed by real Firestore field IDs,
   * ready to be saved as a SiteSubmission.formData.
   *
   * For unmatched labels (new templates), the raw label is kept as-is so the data
   * isn't lost — the wizard will use field order/label matching after template save.
   *
   * @param formData    Raw { label: value } from parseFilledForm result
   * @param fieldIdMap  { normalizedLabel: fieldId } from parseFilledForm result
   * @returns           { fieldId: value } where possible, raw label otherwise
   */
  static remapFormData(
    formData: Record<string, unknown>,
    fieldIdMap: Record<string, string>,
  ): Record<string, unknown> {
    const remapped: Record<string, unknown> = {};

    for (const [rawLabel, value] of Object.entries(formData)) {
      const normalized = _normalizeLabel(rawLabel);
      const fieldId = fieldIdMap[normalized];
      // Use the real field ID if we have a mapping; fall back to the raw label
      remapped[fieldId ?? rawLabel] = value;
    }

    return remapped;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Must match the normalization used in api/services/filled_form_parser.py */
function _normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

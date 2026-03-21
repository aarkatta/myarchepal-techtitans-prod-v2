import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Upload, Camera, FileText, ArrowLeft, ArrowRight,
  CheckCircle2, AlertTriangle, Info, Loader2, Save, Send,
} from 'lucide-react';

import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import DynamicFormRenderer from '@/components/DynamicFormRenderer';
import { FormFillContext } from '@/contexts/FormFillContext';

import { SiteTemplatesService } from '@/services/siteTemplates';
import { SiteSubmissionsService } from '@/services/siteSubmissions';
import { SitesService } from '@/services/sites';
import { FilledFormUploadService, type ParseFilledFormResult } from '@/services/filledFormUpload';
import { useAuth } from '@/hooks/use-auth';
import { useUser } from '@/hooks/use-user';
import { calculateReliability } from '@/lib/reliabilityScore';

import type { Site } from '@/services/sites';
import type { TemplateField, TemplateSection } from '@/types/siteTemplates';
import type { MediaAttachment } from '@/types/siteSubmissions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_TYPES = [
  'Cemetery', 'Habitation', 'Rock Art', 'Structural', 'Shell Midden',
  'Roadway', 'Agricultural', 'Industrial', 'Other',
];

const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 20);

type Step = 'upload' | 'parsing' | 'template' | 'site' | 'processing' | 'review';

/** Must match normalization in api/services/filled_form_parser.py */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UploadFilledForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();

  const [step, setStep] = useState<Step>('upload');

  // --- Step 1 state ---
  const [file, setFile] = useState<File | null>(null);
  const [base64Data, setBase64Data] = useState('');
  const [mediaType, setMediaType] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Step 2/3 state (parse result + template decision) ---
  const [parseResult, setParseResult] = useState<ParseFilledFormResult | null>(null);
  // "matched" = use matchedTemplateId, "new" = generate new template
  const [useMatch, setUseMatch] = useState(true);

  // --- Step 4 state (site) ---
  const [orgSites, setOrgSites] = useState<Site[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [createNewSite, setCreateNewSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteType, setNewSiteType] = useState('');

  // --- Step 5 state (review) ---
  const [resolvedSiteId, setResolvedSiteId] = useState('');
  const [resolvedSiteName, setResolvedSiteName] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [finalFields, setFinalFields] = useState<TemplateField[]>([]);
  const [finalSections, setFinalSections] = useState<TemplateSection[]>([]);
  const [finalFormData, setFinalFormData] = useState<Record<string, unknown>>({});
  const [isPendingTemplate, setIsPendingTemplate] = useState(false);
  const [currentValues, setCurrentValues] = useState<Record<string, unknown>>({});
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Step 1: read file to base64 ----
  const readFile = useCallback((f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (f.size > MAX_MB * 1024 * 1024) {
        reject(new Error(`File exceeds ${MAX_MB} MB limit`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    }), []);

  const handleFileChosen = useCallback(async (f: File) => {
    try {
      const b64 = await readFile(f);
      setFile(f);
      setBase64Data(b64);
      setMediaType(f.type || 'image/jpeg');
    } catch (err: any) {
      toast.error(err.message ?? 'Could not read file');
    }
  }, [readFile]);

  // ---- Step 1 → 2: parse ----
  const handleAnalyze = useCallback(async () => {
    if (!base64Data || !organization?.id) return;
    setStep('parsing');
    try {
      const result = await FilledFormUploadService.parseFilledForm(
        base64Data, mediaType, file?.name ?? 'upload', organization.id,
      );
      setParseResult(result);
      // Default: accept a high match; leave "possible" for user to decide
      setUseMatch(result.confidenceLevel === 'high');
      // Pre-fill new site name from form header if available
      if (result.suggestedSiteName) setNewSiteName(result.suggestedSiteName);
      if (result.siteType) setNewSiteType(result.siteType);
      // Load org sites for the site picker (concurrent, non-blocking)
      SitesService.getSitesByOrganization(organization.id)
        .then(sites => { setOrgSites(sites); setSitesLoaded(true); })
        .catch(() => setSitesLoaded(true));
      setStep('template');
    } catch (err: any) {
      toast.error(err.message ?? 'Form parsing failed. Try a clearer image.');
      setStep('upload');
    }
  }, [base64Data, mediaType, file, organization?.id]);

  // ---- Step 3 → 4 ----
  const handleTemplateConfirmed = useCallback(() => setStep('site'), []);

  // ---- Step 4 → processing → review ----
  const handleSiteConfirmed = useCallback(async () => {
    if (!parseResult || !user?.uid || !organization?.id) return;

    const siteIsNew = createNewSite;
    if (siteIsNew && (!newSiteName.trim() || !newSiteType)) {
      toast.error('Please enter a site name and type');
      return;
    }
    if (!siteIsNew && !selectedSiteId) {
      toast.error('Please select a site or choose to create a new one');
      return;
    }

    setStep('processing');

    try {
      // 1. Resolve site
      let siteId = selectedSiteId;
      let siteName = selectedSiteName;
      if (siteIsNew) {
        const idToken = await user.getIdToken();
        siteId = await FilledFormUploadService.createSiteFromUpload(
          newSiteName.trim(), newSiteType, idToken,
        );
        siteName = newSiteName.trim();
      }

      const isNewTemplate = !useMatch || !parseResult.matchedTemplateId;
      let templateId = parseResult.matchedTemplateId ?? '';
      let fields: TemplateField[] = [];
      let sections: TemplateSection[] = [];

      // 2. Create or load template
      if (isNewTemplate) {
        templateId = await SiteTemplatesService.createTemplate({
          orgId: organization.id,
          name: parseResult.templateName,
          siteType: parseResult.siteType,
          sourceType: 'filled_form_upload',
          status: 'draft',
          createdBy: user.uid,
          fieldCount: parseResult.fields.length,
        });
        await Promise.all([
          SiteTemplatesService.batchSaveFields(templateId, parseResult.fields),
          SiteTemplatesService.batchSaveSections(templateId, parseResult.sections),
        ]);
        fields = parseResult.fields;
        sections = parseResult.sections;
      } else {
        [fields, sections] = await Promise.all([
          SiteTemplatesService.getTemplateFields(templateId),
          SiteTemplatesService.getTemplateSections(templateId),
        ]);
      }

      // 3. Remap form_data keys (field labels → field IDs)
      const idMap = isNewTemplate
        ? Object.fromEntries(fields.map(f => [normalizeLabel(f.label), f.id]))
        : parseResult.fieldIdMap;
      const remappedData = FilledFormUploadService.remapFormData(parseResult.formData, idMap);

      // 4. Link template + consultant to site
      const submissionStatus = isNewTemplate ? 'pending_template' : 'in_progress';
      await SitesService.updateSite(siteId, {
        linkedTemplateId: templateId,
        assignedConsultantId: user.uid,
        assignedConsultantEmail: user.email ?? '',
        submissionStatus,
      });

      // 5. Create pre-populated submission
      const newSubmissionId = await SiteSubmissionsService.createSubmission(siteId, {
        siteId,
        templateId,
        consultantId: user.uid,
        organizationId: organization.id,
        formData: remappedData,
        mediaAttachments: [],
        status: submissionStatus,
        isDraft: true,
        lastSavedAt: null as any,
      });

      // 6. Notify admin if new template (fire-and-forget)
      if (isNewTemplate) {
        fetch('/api/notify-admin-template-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: templateId,
            template_name: parseResult.templateName,
            uploaded_by_uid: user.uid,
            site_name: siteName,
            org_id: organization.id,
          }),
        }).catch(() => {});
      }

      // 7. Advance to review
      setResolvedSiteId(siteId);
      setResolvedSiteName(siteName);
      setSubmissionId(newSubmissionId);
      setFinalFields(fields);
      setFinalSections(sections);
      setFinalFormData(remappedData);
      setCurrentValues(remappedData);
      setIsPendingTemplate(isNewTemplate);
      setStep('review');
    } catch (err: any) {
      console.error('Upload flow processing error:', err);
      toast.error(err.message ?? 'Something went wrong. Please try again.');
      setStep('site');
    }
  }, [
    parseResult, user, organization,
    createNewSite, newSiteName, newSiteType,
    selectedSiteId, selectedSiteName, useMatch,
  ]);

  // ---- Review: media change ----
  const handleMediaChange = useCallback(async (updated: MediaAttachment[]) => {
    setMediaAttachments(updated);
    if (!resolvedSiteId || !submissionId) return;
    try {
      await SiteSubmissionsService.updateSubmission(resolvedSiteId, submissionId, {
        mediaAttachments: updated,
      });
    } catch (err) {
      console.error('Failed to save attachments:', err);
    }
  }, [resolvedSiteId, submissionId]);

  // ---- Review: save draft ----
  const handleSaveDraft = useCallback(async () => {
    if (!resolvedSiteId || !submissionId) return;
    setIsSaving(true);
    try {
      await SiteSubmissionsService.updateSubmission(resolvedSiteId, submissionId, {
        formData: currentValues,
        isDraft: true,
      });
      toast.success('Draft saved');
    } catch {
      toast.error('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [resolvedSiteId, submissionId, currentValues]);

  // ---- Review: submit ----
  const handleSubmit = useCallback(async (values: Record<string, unknown>) => {
    if (!resolvedSiteId || !submissionId || isPendingTemplate) return;
    setIsSubmitting(true);
    try {
      await SiteSubmissionsService.updateSubmission(resolvedSiteId, submissionId, {
        formData: values,
      });
      await SiteSubmissionsService.submitForm(resolvedSiteId, submissionId);
      await SitesService.updateSite(resolvedSiteId, { submissionStatus: 'submitted' });
      toast.success('Form submitted successfully!');
      navigate('/my-assignments');
    } catch {
      toast.error('Submission failed. Please try again.');
      setIsSubmitting(false);
    }
  }, [resolvedSiteId, submissionId, isPendingTemplate, navigate]);

  const { score: reliabilityScore, label: reliabilityLabel } = calculateReliability(
    finalFields, currentValues,
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-3 border-b border-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost" size="icon" className="shrink-0 h-8 w-8"
            onClick={() => step === 'review' ? navigate('/my-assignments') : navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="font-semibold text-sm">Upload Filled Form</p>
            <p className="text-xs text-muted-foreground capitalize">
              {step === 'processing' ? 'Setting up your form...' : `Step: ${step}`}
            </p>
          </div>
          {/* Step indicator dots */}
          <div className="ml-auto flex items-center gap-1.5">
            {(['upload', 'template', 'site', 'review'] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  step === s ? 'bg-primary' :
                  (['template', 'site', 'review'].indexOf(step) > i - 1 &&
                   ['template', 'site', 'review', 'processing'].includes(step))
                    ? 'bg-primary/40' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 pb-32 sm:p-6 space-y-4">

        {/* ================================================================
            STEP 1 — UPLOAD
            ================================================================ */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Upload a Filled Form</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a PDF or photo of a paper form you've already filled out. Claude will
                extract the values and create a digital record.
              </p>
            </div>

            {/* Drop zone */}
            <Card
              className={`border-2 border-dashed cursor-pointer hover:border-primary/60 transition-colors ${
                file ? 'border-primary/40 bg-primary/5' : 'border-muted-foreground/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
                {file ? (
                  <>
                    <FileText className="w-10 h-10 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Click to upload a form</p>
                      <p className="text-xs text-muted-foreground">PDF, JPEG, PNG or WEBP · max {MAX_MB} MB</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              aria-label="Upload filled form file"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); }}
            />

            {/* Camera button (mobile) */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
              Take a Photo
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              // eslint-disable-next-line react/no-unknown-property
              capture="environment"
              aria-label="Take a photo of the form"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); }}
            />

            <Button
              className="w-full gap-2"
              disabled={!file}
              onClick={handleAnalyze}
            >
              <ArrowRight className="w-4 h-4" />
              Analyze Form
            </Button>
          </div>
        )}

        {/* ================================================================
            STEP 2 — PARSING
            ================================================================ */}
        {step === 'parsing' && <ParsingStep />}

        {/* ================================================================
            STEP 3 — TEMPLATE CONFIRMATION
            ================================================================ */}
        {step === 'template' && parseResult && (
          <TemplateStep
            result={parseResult}
            useMatch={useMatch}
            onUseMatch={setUseMatch}
            onContinue={handleTemplateConfirmed}
          />
        )}

        {/* ================================================================
            STEP 4 — SITE ASSIGNMENT
            ================================================================ */}
        {step === 'site' && parseResult && (
          <SiteStep
            suggestedSiteName={parseResult.suggestedSiteName}
            orgSites={orgSites}
            sitesLoaded={sitesLoaded}
            sitePickerOpen={sitePickerOpen}
            onSitePickerOpenChange={setSitePickerOpen}
            selectedSiteId={selectedSiteId}
            selectedSiteName={selectedSiteName}
            onSelectSite={(id, name) => {
              setSelectedSiteId(id);
              setSelectedSiteName(name);
              setCreateNewSite(false);
            }}
            createNewSite={createNewSite}
            onCreateNewSite={() => { setCreateNewSite(true); setSelectedSiteId(''); }}
            newSiteName={newSiteName}
            onNewSiteName={setNewSiteName}
            newSiteType={newSiteType}
            onNewSiteType={setNewSiteType}
            onContinue={handleSiteConfirmed}
          />
        )}

        {/* ================================================================
            STEP: PROCESSING
            ================================================================ */}
        {step === 'processing' && <ProcessingStep />}

        {/* ================================================================
            STEP 5 — REVIEW
            ================================================================ */}
        {step === 'review' && resolvedSiteId && submissionId && (
          <FormFillContext.Provider
            value={{
              siteId: resolvedSiteId,
              submissionId,
              orgId: organization!.id,
              mediaAttachments,
              onMediaChange: handleMediaChange,
            }}
          >
            <ReviewStep
              siteName={resolvedSiteName}
              templateName={parseResult?.templateName ?? ''}
              isPendingTemplate={isPendingTemplate}
              fields={finalFields}
              sections={finalSections}
              initialValues={finalFormData}
              reliabilityScore={reliabilityScore}
              reliabilityLabel={reliabilityLabel}
              isSaving={isSaving}
              isSubmitting={isSubmitting}
              onValuesChange={setCurrentValues}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmit}
            />
          </FormFillContext.Provider>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default UploadFilledForm;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ParsingStep() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Analyzing your form...</h2>
        <p className="text-sm text-muted-foreground">
          Claude is reading the layout and extracting filled values. This may take 15–30 seconds.
        </p>
      </div>
      {[
        'Reading form layout...',
        'Extracting field values...',
        'Checking against existing templates...',
      ].map((msg, i) => (
        <div key={i} className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
          <Skeleton className="h-4 flex-1 rounded" />
          <span className="text-xs text-muted-foreground hidden sm:block">{msg}</span>
        </div>
      ))}
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ProcessingStep() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Setting up your form...</h2>
        <p className="text-sm text-muted-foreground">
          Saving the template and creating your submission. Just a moment.
        </p>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

// --------------- TemplateStep ---------------

function TemplateStep({
  result,
  useMatch,
  onUseMatch,
  onContinue,
}: {
  result: ParseFilledFormResult;
  useMatch: boolean;
  onUseMatch: (v: boolean) => void;
  onContinue: () => void;
}) {
  const [showFields, setShowFields] = useState(false);
  const hasMatch = !!result.matchedTemplateId;
  const level = result.confidenceLevel;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Template Detected</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We identified the form type. Confirm how to proceed.
        </p>
      </div>

      {/* Match banner */}
      {hasMatch && level === 'high' && useMatch && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-4 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Matched: <span className="font-semibold">{result.matchedTemplateName}</span>
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                {Math.round(result.confidence * 100)}% confidence — your data will be mapped to this template.
              </p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-green-700 dark:text-green-400"
                onClick={() => onUseMatch(false)}
              >
                This is a different form type
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasMatch && level === 'possible' && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Possible match: <span className="font-semibold">{result.matchedTemplateName}</span>
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {Math.round(result.confidence * 100)}% confidence — not certain. Is this the right form?
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={useMatch ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUseMatch(true)}
                >
                  Yes, use this template
                </Button>
                <Button
                  variant={!useMatch ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUseMatch(false)}
                >
                  No, create new template
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(!hasMatch || !useMatch) && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="py-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                New form type: <span className="font-semibold">{result.templateName}</span>
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                A draft template will be created. An admin will review it. Your data is saved
                and visible while you wait.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detected fields preview */}
      <Collapsible open={showFields} onOpenChange={setShowFields}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            {showFields ? 'Hide' : 'Show'} detected fields ({result.fields.length})
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="py-3 space-y-2 max-h-64 overflow-y-auto">
              {result.sections.map(section => (
                <div key={section.id}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {section.title}
                  </p>
                  {result.fields
                    .filter(f => f.sectionId === section.id && f.fieldType !== 'section_header' && f.fieldType !== 'divider')
                    .map(f => (
                      <div key={f.id} className="flex items-center gap-2 py-0.5">
                        <span className="text-sm">{f.label}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{f.fieldType}</Badge>
                        {result.formData[f.label] !== undefined && (
                          <Badge variant="secondary" className="text-xs shrink-0">filled</Badge>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Button className="w-full gap-2" onClick={onContinue}>
        <ArrowRight className="w-4 h-4" />
        Continue to Site Assignment
      </Button>
    </div>
  );
}

// --------------- SiteStep ---------------

function SiteStep({
  suggestedSiteName,
  orgSites,
  sitesLoaded,
  sitePickerOpen,
  onSitePickerOpenChange,
  selectedSiteId,
  selectedSiteName,
  onSelectSite,
  createNewSite,
  onCreateNewSite,
  newSiteName,
  onNewSiteName,
  newSiteType,
  onNewSiteType,
  onContinue,
}: {
  suggestedSiteName: string;
  orgSites: Site[];
  sitesLoaded: boolean;
  sitePickerOpen: boolean;
  onSitePickerOpenChange: (v: boolean) => void;
  selectedSiteId: string;
  selectedSiteName: string;
  onSelectSite: (id: string, name: string) => void;
  createNewSite: boolean;
  onCreateNewSite: () => void;
  newSiteName: string;
  onNewSiteName: (v: string) => void;
  newSiteType: string;
  onNewSiteType: (v: string) => void;
  onContinue: () => void;
}) {
  const canContinue = createNewSite
    ? !!newSiteName.trim() && !!newSiteType
    : !!selectedSiteId;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Assign to a Site</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Link this form to an existing site record, or create a new one.
        </p>
      </div>

      {suggestedSiteName && (
        <Card className="border-muted bg-muted/30">
          <CardContent className="py-3 flex items-center gap-3">
            <Info className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Found on form</p>
              <p className="text-sm font-medium truncate">{suggestedSiteName}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => { onCreateNewSite(); onNewSiteName(suggestedSiteName); }}
            >
              Use this name
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing site picker */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Link to existing site</Label>
        <Popover open={sitePickerOpen} onOpenChange={onSitePickerOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal"
            >
              {selectedSiteName || 'Search sites...'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by site name..." />
              {!sitesLoaded && (
                <div className="p-3">
                  <Skeleton className="h-8 w-full" />
                </div>
              )}
              <CommandEmpty>No sites found.</CommandEmpty>
              <CommandGroup className="max-h-52 overflow-y-auto">
                {orgSites.map(s => (
                  <CommandItem
                    key={s.id}
                    value={s.name}
                    onSelect={() => {
                      onSelectSite(s.id!, s.name);
                      onSitePickerOpenChange(false);
                    }}
                  >
                    <CheckCircle2
                      className={`mr-2 h-4 w-4 ${selectedSiteId === s.id ? 'opacity-100 text-primary' : 'opacity-0'}`}
                    />
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.siteType && (
                      <Badge variant="outline" className="text-xs ml-2 shrink-0">{s.siteType}</Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-muted" />
        <span className="px-3 text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t border-muted" />
      </div>

      {/* Create new site */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Create a new site</Label>
        <Input
          placeholder="Site name"
          value={newSiteName}
          onChange={e => { onNewSiteName(e.target.value); onCreateNewSite(); }}
        />
        <Select value={newSiteType} onValueChange={v => { onNewSiteType(v); onCreateNewSite(); }}>
          <SelectTrigger>
            <SelectValue placeholder="Site type" />
          </SelectTrigger>
          <SelectContent>
            {SITE_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button className="w-full gap-2" disabled={!canContinue} onClick={onContinue}>
        <ArrowRight className="w-4 h-4" />
        Continue
      </Button>
    </div>
  );
}

// --------------- ReviewStep ---------------

function ReviewStep({
  siteName,
  templateName,
  isPendingTemplate,
  fields,
  sections,
  initialValues,
  reliabilityScore,
  reliabilityLabel,
  isSaving,
  isSubmitting,
  onValuesChange,
  onSaveDraft,
  onSubmit,
}: {
  siteName: string;
  templateName: string;
  isPendingTemplate: boolean;
  fields: TemplateField[];
  sections: TemplateSection[];
  initialValues: Record<string, unknown>;
  reliabilityScore: number;
  reliabilityLabel: string;
  isSaving: boolean;
  isSubmitting: boolean;
  onValuesChange: (v: Record<string, unknown>) => void;
  onSaveDraft: () => void;
  onSubmit: (v: Record<string, unknown>) => void;
}) {
  const progressColor =
    reliabilityLabel === 'Complete' ? 'text-green-600 dark:text-green-400' :
    reliabilityLabel === 'Incomplete' ? 'text-amber-600 dark:text-amber-400' :
    'text-destructive';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Review Extracted Data</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Check and correct any fields Claude extracted. Then save or submit.
        </p>
      </div>

      {/* Site + template info */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{siteName}</Badge>
        <Badge variant="outline">{templateName}</Badge>
      </div>

      {/* Reliability bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Required fields</span>
          <span className={`font-medium ${progressColor}`}>
            {reliabilityLabel} ({reliabilityScore}%)
          </span>
        </div>
        <Progress value={reliabilityScore} className="h-1.5" />
      </div>

      {/* Pending template banner */}
      {isPendingTemplate && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Your data is saved. An admin is reviewing the generated template.
              You can save a draft now — the Submit button will unlock once the template is approved.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pre-populated form */}
      <DynamicFormRenderer
        sections={sections}
        fields={fields}
        initialValues={initialValues}
        userRole="member"
        mode="fill"
        onChange={onValuesChange}
        onSubmit={isPendingTemplate ? undefined : onSubmit}
      />

      {/* Footer actions — save draft always available */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          disabled={isSaving}
          onClick={onSaveDraft}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Draft
        </Button>
        {!isPendingTemplate && (
          <Button
            className="flex-1 gap-2"
            disabled={isSubmitting}
            onClick={() => onSubmit(initialValues)}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}

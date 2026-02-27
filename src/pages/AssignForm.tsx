import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserCheck, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { PageHeader } from '@/components/PageHeader';
import { AccountButton } from '@/components/AccountButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { SitesService, type Site } from '@/services/sites';
import { SiteTemplatesService } from '@/services/siteTemplates';
import { SiteAssignmentsService } from '@/services/siteAssignments';
import { ConsultantPicker } from '@/components/templates/ConsultantPicker';
import { useUser } from '@/hooks/use-user';
import type { SiteTemplate } from '@/types/siteTemplates';

const AssignForm = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { organization } = useUser();

  const [site, setSite] = useState<Site | null>(null);
  const [template, setTemplate] = useState<SiteTemplate | null>(null);
  const [loadingSite, setLoadingSite] = useState(true);

  const [selectedUid, setSelectedUid] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    setLoadingSite(true);
    SitesService.getSiteById(siteId)
      .then(async s => {
        setSite(s);
        if (s?.linkedTemplateId) {
          const tmpl = await SiteTemplatesService.getTemplate(s.linkedTemplateId);
          setTemplate(tmpl);
        }
        // Pre-fill existing assignment if any
        if (s?.assignedConsultantId) setSelectedUid(s.assignedConsultantId);
        if (s?.assignedConsultantEmail) setSelectedEmail(s.assignedConsultantEmail);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load site details');
      })
      .finally(() => setLoadingSite(false));
  }, [siteId]);

  const handleAssign = async () => {
    if (!siteId || !selectedUid || !selectedEmail) return;
    setSaving(true);
    try {
      await SiteAssignmentsService.assignConsultant(siteId, selectedUid, selectedEmail);
      toast.success('Consultant assigned successfully');
      navigate('/admin-assignments');
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign consultant. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin-assignments')}
          className="gap-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assignments
        </Button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <UserCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Assign Form</h1>
        </div>

        {loadingSite ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ) : !site ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Site not found.</AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Site info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Site Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Site Name</span>
                  <span className="font-medium">{site.name}</span>
                </div>
                {site.stateSiteNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State Site #</span>
                    <span className="font-mono">{site.stateSiteNumber}</span>
                  </div>
                )}
                {site.siteType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Site Type</span>
                    <span>{site.siteType}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Template</span>
                  <span className={template ? 'font-medium' : 'italic text-muted-foreground'}>
                    {template ? template.name : 'None'}
                  </span>
                </div>
                {site.assignedConsultantEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currently Assigned</span>
                    <span className="text-blue-600 dark:text-blue-400">{site.assignedConsultantEmail}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* No template warning */}
            {!site.linkedTemplateId && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This site has no linked template. Please edit the site to link a form template before assigning it.
                </AlertDescription>
              </Alert>
            )}

            {/* Consultant picker */}
            {site.linkedTemplateId && organization?.id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Field Consultant</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose a MEMBER from your organization to fill out this form.
                  </p>
                  <ConsultantPicker
                    orgId={organization.id}
                    value={selectedUid}
                    onSelect={(uid, email) => {
                      setSelectedUid(uid);
                      setSelectedEmail(email);
                    }}
                  />

                  <Button
                    className="w-full"
                    onClick={handleAssign}
                    disabled={!selectedUid || saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        {site.assignedConsultantId ? 'Reassign Consultant' : 'Assign Consultant'}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default AssignForm;

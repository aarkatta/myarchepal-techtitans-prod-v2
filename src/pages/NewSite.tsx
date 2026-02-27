import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, FileText, Save, Loader2, Upload, Image as ImageIcon, Mic, MicOff, Globe, Lock, AlertCircle } from "lucide-react";
import { useKeyboard } from "@/hooks/use-keyboard";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { SitesService } from "@/services/sites";
import { SiteTemplatesService } from "@/services/siteTemplates";
import { Timestamp } from "firebase/firestore";
import type { SiteTemplate } from "@/types/siteTemplates";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Default coordinates for Raleigh, North Carolina
const DEFAULT_LOCATION = {
  latitude: 35.7796,
  longitude: -78.6382
};

const NewSite = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { organization, isOrgAdmin, isSuperAdmin } = useUser();
  const { isArchaeologist, loading: archaeologistLoading, canCreate: baseCanCreate } = useArchaeologist();
  const { hideKeyboard } = useKeyboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [publishedTemplates, setPublishedTemplates] = useState<SiteTemplate[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');

  // For Pro/Enterprise orgs: Only org admins can create new sites
  // For Free/Default orgs: Any archaeologist can create sites (personal use)
  const canCreateInOrg = isProOrg ? (isOrgAdmin || isSuperAdmin) : true;
  const canCreate = baseCanCreate && canCreateInOrg;

  // Handle tap outside inputs to dismiss keyboard
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTap = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactiveElements = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'LABEL'];
      if (interactiveElements.includes(target.tagName)) return;
      if (target.closest('button') || target.closest('a') || target.closest('label')) return;
      hideKeyboard();
    };

    container.addEventListener('touchstart', handleTap, { passive: true });
    return () => container.removeEventListener('touchstart', handleTap);
  }, [hideKeyboard]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    researchAnalysis: "",
    location: {
      latitude: "",
      longitude: ""
    },
    period: "",
    status: "active",
    dateDiscovered: new Date().toISOString().split('T')[0],
    notes: "",
    stateSiteNumber: "",
    siteType: "",
    linkedTemplateId: "",
  });

  // Get user's location on component mount
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setFormData(prev => ({
              ...prev,
              location: {
                latitude: position.coords.latitude.toString(),
                longitude: position.coords.longitude.toString()
              }
            }));
            setLocationLoading(false);
            console.log('✅ User location obtained:', position.coords.latitude, position.coords.longitude);
            toast({
              title: "Location Detected",
              description: "Your current location has been set",
            });
          },
          (error) => {
            console.warn('⚠️ Location permission denied or unavailable:', error.message);
            console.log('🏛️ Using default location: Raleigh, NC');
            setFormData(prev => ({
              ...prev,
              location: {
                latitude: DEFAULT_LOCATION.latitude.toString(),
                longitude: DEFAULT_LOCATION.longitude.toString()
              }
            }));
            setLocationLoading(false);
            toast({
              title: "Default Location Set",
              description: "Using Raleigh, NC as default location",
            });
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } else {
        console.warn('⚠️ Geolocation is not supported by this browser');
        console.log('🏛️ Using default location: Raleigh, NC');
        setFormData(prev => ({
          ...prev,
          location: {
            latitude: DEFAULT_LOCATION.latitude.toString(),
            longitude: DEFAULT_LOCATION.longitude.toString()
          }
        }));
        setLocationLoading(false);
      }
    };

    getUserLocation();
  }, [toast]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setFormData(prev => ({
              ...prev,
              notes: prev.notes + finalTranscript
            }));
          }
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          toast({
            title: "Speech Recognition Error",
            description: "Unable to recognize speech. Please try again.",
            variant: "destructive"
          });
        };

        recognitionInstance.onend = () => {
          setIsRecording(false);
        };

        setRecognition(recognitionInstance);
      }
    }
  }, [toast]);

  // Load published templates for ORG_ADMIN
  useEffect(() => {
    if (!organization?.id || !isOrgAdmin) return;
    SiteTemplatesService.listTemplates(organization.id)
      .then(tmpls => setPublishedTemplates(tmpls.filter(t => t.status === 'published')))
      .catch(console.error);
  }, [organization?.id, isOrgAdmin]);

  const toggleRecording = () => {
    if (!recognition) {
      toast({
        title: "Speech Recognition Not Available",
        description: "Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.",
        variant: "destructive"
      });
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        recognition.start();
        setIsRecording(true);
        toast({
          title: "Recording Started",
          description: "Speak now to add notes...",
        });
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast({
          title: "Error",
          description: "Failed to start recording. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith("location.")) {
      const locationField = name.split(".")[1];
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSelectChange = (value: string, field: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Debug: Log user information
    console.log('🏛️ Creating site - User info:', {
      user: user,
      uid: user?.uid,
      email: user?.email,
      isAuthenticated: !!user
    });

    // Basic validation
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Please provide a site name",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be signed in to create a site",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const siteData = {
        name: formData.name,
        description: formData.description || "",
        researchAnalysis: formData.researchAnalysis || "",
        location: {
          latitude: formData.location.latitude ? parseFloat(formData.location.latitude) : DEFAULT_LOCATION.latitude,
          longitude: formData.location.longitude ? parseFloat(formData.location.longitude) : DEFAULT_LOCATION.longitude
        },
        period: formData.period || "",
        status: formData.status as "active" | "inactive" | "archived",
        dateDiscovered: Timestamp.fromDate(new Date(formData.dateDiscovered)),
        artifacts: [],
        images: [],
        createdBy: user?.uid || "anonymous",
        notes: formData.notes || "",
        organizationId: organization?.id,
        visibility: isProOrg ? visibility : 'private',
        ...(formData.stateSiteNumber && { stateSiteNumber: formData.stateSiteNumber }),
        ...(formData.siteType && { siteType: formData.siteType }),
        ...(formData.linkedTemplateId && { linkedTemplateId: formData.linkedTemplateId }),
      };

      const siteId = await SitesService.createSite(siteData);

      // Upload image if selected
      if (selectedImage && siteId) {
        try {
          const imageUrl = await SitesService.uploadSiteImage(siteId, selectedImage);
          await SitesService.updateSiteImages(siteId, [imageUrl]);
        } catch (imageError) {
          console.error("Error uploading image:", imageError);
          toast({
            title: "Warning",
            description: "Site created but image upload failed",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "Success!",
        description: "Archaeological site has been added successfully",
      });

      // Navigate to site lists after successful creation
      setTimeout(() => {
        navigate("/site-lists");
      }, 1500);

    } catch (error) {
      console.error("Error creating site:", error);
      toast({
        title: "Error",
        description: "Failed to create site. Please check your Firebase configuration.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveLayout>
      <div ref={containerRef}>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      {/* Auth & Archaeologist Status */}
      <div className="p-4 lg:p-6 bg-muted/50 mx-auto max-w-7xl">
          <div className="text-sm space-y-1">
            <div>
              <strong>Auth Status:</strong> {user ? `✅ Signed in as ${user.email}` : '❌ Not signed in'}
            </div>
            <div>
              <strong>Archaeologist Status:</strong> {
                archaeologistLoading ? '⏳ Checking...' :
                isArchaeologist ? '✅ Verified Archaeologist' : '❌ Not an archaeologist'
              }
            </div>
            <div>
              <strong>Can Create:</strong> {canCreate ? '✅ Yes' : '❌ No'}
            </div>
          </div>
        </div>

        {/* Show message for non-archaeologists or restricted Pro org members */}
        {!canCreate && (
          <div className="p-4">
            <Card>
              <CardContent className="pt-6 text-center">
                {/* Pro org member restriction message */}
                {isProOrg && !canCreateInOrg ? (
                  <Alert variant="default" className="mb-4 text-left">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Site Creation Restricted</AlertTitle>
                    <AlertDescription>
                      In Pro/Enterprise organizations, only organization administrators can create new sites.
                      As a member, you can edit sites where you've been assigned as a site admin.
                      Contact your organization admin to create new sites or to be added as a site admin.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-muted-foreground mb-4">
                    {!user ? 'Please sign in as an archaeologist to create archaeological sites.' :
                     !isArchaeologist ? 'Only verified archaeologists can create sites.' :
                     'Loading...'}
                  </p>
                )}
                {!user && (
                  <Button
                    onClick={() => navigate('/authentication/sign-in')}
                    variant="outline"
                  >
                    Sign In as Archaeologist
                  </Button>
                )}
                {isProOrg && !canCreateInOrg && (
                  <Button
                    onClick={() => navigate('/site-lists')}
                    variant="outline"
                  >
                    View Existing Sites
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Form - Only show if user can create */}
        {canCreate && (
        <form onSubmit={handleSubmit} className="p-4 lg:p-6 space-y-4 mx-auto max-w-7xl">
          {/* Image Upload Section - Moved to top */}
          <Card className="p-6 border-border">
            {imagePreview ? (
              <div className="relative flex justify-center">
                <img
                  src={imagePreview}
                  alt="Site preview"
                  className="max-w-full max-h-64 object-contain rounded-lg mb-4"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="flex items-center justify-center h-48 bg-muted rounded-lg mb-4 hover:bg-muted/80 transition-colors">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to add site image</p>
                    <p className="text-xs text-muted-foreground mt-1">Max 5MB (JPG, PNG, GIF)</p>
                  </div>
                </div>
              </label>
            )}
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <label htmlFor="image-upload">
              <Button variant="outline" className="w-full" size="sm" type="button" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {selectedImage ? 'Change Image' : 'Upload Image'}
                </span>
              </Button>
            </label>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Site Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Ancient Roman Villa"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* NC-specific fields — shown for Org Admins in Pro/Enterprise orgs */}
              {isProOrg && isOrgAdmin && (
                <>
                  <div>
                    <Label htmlFor="stateSiteNumber">State Site Number (Optional)</Label>
                    <Input
                      id="stateSiteNumber"
                      name="stateSiteNumber"
                      placeholder="31-___"
                      value={formData.stateSiteNumber}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <Label htmlFor="siteType">Site Type (Optional)</Label>
                    <Select
                      value={formData.siteType}
                      onValueChange={value => handleSelectChange(value, "siteType")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select site type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cemetery">Cemetery</SelectItem>
                        <SelectItem value="Habitation">Habitation</SelectItem>
                        <SelectItem value="Rock Art">Rock Art</SelectItem>
                        <SelectItem value="Lithic Scatter">Lithic Scatter</SelectItem>
                        <SelectItem value="Midden">Midden</SelectItem>
                        <SelectItem value="Shell Ring">Shell Ring</SelectItem>
                        <SelectItem value="Earthwork">Earthwork</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="linkedTemplateId">Form Template (Optional)</Label>
                    <Select
                      value={formData.linkedTemplateId}
                      onValueChange={value => handleSelectChange(value, "linkedTemplateId")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Link a published template" />
                      </SelectTrigger>
                      <SelectContent>
                        {publishedTemplates
                          .filter(t => !formData.siteType || t.siteType === formData.siteType)
                          .map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        {publishedTemplates.length === 0 && (
                          <SelectItem value="__none" disabled>
                            No published templates yet
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Provide a detailed description of the archaeological site..."
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="researchAnalysis">Research and Analysis (Optional)</Label>
                <Textarea
                  id="researchAnalysis"
                  name="researchAnalysis"
                  placeholder="Provide research findings, analysis, and interpretations..."
                  value={formData.researchAnalysis}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="period">Historical Period (Optional)</Label>
                <Input
                  id="period"
                  name="period"
                  placeholder="e.g., Roman Empire, Bronze Age"
                  value={formData.period}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="dateDiscovered">Date Discovered (Optional)</Label>
                <Input
                  id="dateDiscovered"
                  name="dateDiscovered"
                  type="date"
                  value={formData.dateDiscovered}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="status">Status (Optional)</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleSelectChange(value, "status")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Visibility Toggle - Only for Pro/Enterprise organizations */}
              {isProOrg && (
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="visibility" className="text-foreground flex items-center gap-2">
                      {visibility === 'public' ? (
                        <Globe className="w-4 h-4 text-green-600" />
                      ) : (
                        <Lock className="w-4 h-4 text-amber-600" />
                      )}
                      Visibility
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {visibility === 'public'
                        ? 'This site will be visible to all users'
                        : 'This site will only be visible to your organization members'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${visibility === 'private' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      Private
                    </span>
                    <Switch
                      id="visibility"
                      checked={visibility === 'public'}
                      onCheckedChange={(checked) => setVisibility(checked ? 'public' : 'private')}
                    />
                    <span className={`text-sm ${visibility === 'public' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      Public
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Field Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Field Notes (Speech-to-Text)
                </div>
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleRecording}
                  className="gap-2"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Record
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Field notes, site observations, initial impressions... (You can type or use voice recording)"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={6}
                />
                {isRecording && (
                  <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                    <span>Recording in progress... Speak now</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Use the microphone button to record voice notes, or type manually. Perfect for capturing site observations while in the field.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location Coordinates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {locationLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Detecting location...</span>
                </div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    Location has been automatically detected. You can modify the coordinates below if needed.
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="location.latitude">Latitude</Label>
                      <Input
                        id="location.latitude"
                        name="location.latitude"
                        type="number"
                        step="0.000001"
                        placeholder="35.7796"
                        value={formData.location.latitude}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div>
                      <Label htmlFor="location.longitude">Longitude</Label>
                      <Input
                        id="location.longitude"
                        name="location.longitude"
                        type="number"
                        step="0.000001"
                        placeholder="-78.6382"
                        value={formData.location.longitude}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Site...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Archaeological Site
                </>
              )}
            </Button>
          </div>
        </form>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default NewSite;
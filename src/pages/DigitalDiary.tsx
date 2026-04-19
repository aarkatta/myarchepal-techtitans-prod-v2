import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Calendar, Clock, Image as ImageIcon, Mic, MicOff, Plus, Trash2, Loader2, MapPin, Package, Layers, Pencil, WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { useDiarySync } from "@/hooks/use-diary-sync";
import { useKeyboard } from "@/hooks/use-keyboard";
import { OfflineDiaryQueueService, OfflineDiaryEntry } from "@/services/offline-diary-queue";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, Timestamp, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { AzureOpenAIService } from "@/services/azure-openai";
import { SitesService, type Site } from "@/services/sites";
import { SiteTemplatesService } from "@/services/siteTemplates";
import { useUser } from "@/hooks/use-user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DiaryEntry {
  id?: string;
  userId: string;
  title: string;
  content: string;
  category: "site" | "artifact" | "other";
  imageUrl?: string;
  aiImageSummary?: string;
  createdAt: Timestamp;
  date: string;
  time: string;
  siteId?: string;
  // Offline-specific fields
  isOffline?: boolean;
  status?: 'pending';
  localImagePath?: string;
}

const DigitalDiary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { organization } = useUser();
  const { isOnline, isSyncing, syncOfflineDiaryData } = useDiarySync();
  const { hideKeyboard } = useKeyboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<(DiaryEntry | OfflineDiaryEntry)[]>([]);

  // Handle tap outside inputs to dismiss keyboard
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTap = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactiveElements = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'LABEL'];
      if (interactiveElements.includes(target.tagName)) return;
      if (target.closest('button') || target.closest('a') || target.closest('label') || target.closest('[role="dialog"]')) return;
      hideKeyboard();
    };

    container.addEventListener('touchstart', handleTap, { passive: true });
    return () => container.removeEventListener('touchstart', handleTap);
  }, [hideKeyboard]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchingEntries, setFetchingEntries] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | OfflineDiaryEntry | null>(null);
  const [editingOfflineId, setEditingOfflineId] = useState<number | null>(null);
  const [linkedSite, setLinkedSite] = useState<Site | null>(null);
  const [loadingLinkedSite, setLoadingLinkedSite] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechTargetMode, setSpeechTargetMode] = useState<"create" | "edit">("create");
  const speechTargetModeRef = useRef<"create" | "edit">("create");
  const [recognition, setRecognition] = useState<any>(null);
  const [interimText, setInterimText] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [analyzingImage, setAnalyzingImage] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "artifact" as "site" | "artifact" | "other",
  });

  const [siteMode, setSiteMode] = useState<"new" | "existing">("new");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [existingSites, setExistingSites] = useState<Site[]>([]);
  const [loadingExistingSites, setLoadingExistingSites] = useState(false);

  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    category: "artifact" as "site" | "artifact" | "other",
  });

  // Load the organization's existing sites whenever the create dialog opens
  // with category=site, so the user can pick one instead of creating a new one
  useEffect(() => {
    if (!isCreateDialogOpen || formData.category !== "site" || !isOnline) return;

    let cancelled = false;
    setLoadingExistingSites(true);

    const loader = organization?.id
      ? SitesService.getSitesByOrganization(organization.id)
      : SitesService.getAllSites();

    loader
      .then(sites => {
        if (cancelled) return;
        const usable = sites.filter(s => s.status !== "archived" && !s.deletedAt);
        usable.sort((a, b) => a.name.localeCompare(b.name));
        setExistingSites(usable);
      })
      .catch(err => {
        console.warn("Could not load sites:", err);
        if (!cancelled) setExistingSites([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingExistingSites(false);
      });

    return () => { cancelled = true; };
  }, [isCreateDialogOpen, formData.category, isOnline, organization?.id]);

  // Fetch linked site when the edit dialog opens for a site-linked entry
  useEffect(() => {
    if (!isEditDialogOpen || !editingEntry) {
      setLinkedSite(null);
      return;
    }
    const siteId = 'siteId' in editingEntry ? editingEntry.siteId : undefined;
    if (!siteId) {
      setLinkedSite(null);
      return;
    }
    let cancelled = false;
    setLoadingLinkedSite(true);
    SitesService.getSiteById(siteId)
      .then(site => {
        if (!cancelled) setLinkedSite(site);
      })
      .catch(err => {
        console.warn('Could not load linked site:', err);
        if (!cancelled) setLinkedSite(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLinkedSite(false);
      });
    return () => { cancelled = true; };
  }, [isEditDialogOpen, editingEntry]);

  // Fetch diary entries (both online and offline)
  useEffect(() => {
    const fetchEntries = async () => {
      if (!user) {
        setFetchingEntries(false);
        return;
      }

      try {
        setFetchingEntries(true);

        // Always try to get offline queued entries first
        let offlineEntries: OfflineDiaryEntry[] = [];
        try {
          const queue = await OfflineDiaryQueueService.getQueue();
          offlineEntries = queue
            .filter((item: any) => item.userId === user.uid)
            .map((item: any): OfflineDiaryEntry => ({
              ...item,
              id: item.id ? `offline-${item.id}` : undefined,
              numericId: item.id,
              isOffline: true,
              status: 'pending',
            }));
          setOfflineCount(offlineEntries.length);
          console.log(`📴 Found ${offlineEntries.length} offline diary entries`);
        } catch (offlineError) {
          console.warn('Could not fetch offline diary queue:', offlineError);
        }

        // Try to fetch online entries if connected
        let onlineEntries: DiaryEntry[] = [];
        if (isOnline) {
          try {
            const q = query(
              collection(db, "DigitalDiary"),
              where("userId", "==", user.uid)
            );

            const querySnapshot = await getDocs(q);

            querySnapshot.forEach((doc) => {
              onlineEntries.push({
                id: doc.id,
                ...doc.data()
              } as DiaryEntry);
            });

            // Sort online entries by createdAt (newest first)
            onlineEntries.sort((a, b) => {
              const timeA = a.createdAt?.toMillis() || 0;
              const timeB = b.createdAt?.toMillis() || 0;
              return timeB - timeA;
            });

            console.log(`🌐 Fetched ${onlineEntries.length} online diary entries`);
          } catch (onlineError) {
            console.error('Error fetching online diary entries:', onlineError);
            if (offlineEntries.length === 0) {
              toast({
                title: "Error",
                description: "Failed to load diary entries. Please check your connection.",
                variant: "destructive"
              });
            }
          }
        } else {
          console.log('📴 Offline mode - showing only local diary entries');
        }

        // Merge offline and online entries (offline first to show pending items at top)
        const mergedEntries = [...offlineEntries, ...onlineEntries];
        setEntries(mergedEntries);
      } catch (error) {
        console.error("Error fetching diary entries:", error);
        toast({
          title: "Error",
          description: "Failed to load diary entries",
          variant: "destructive"
        });
      } finally {
        setFetchingEntries(false);
      }
    };

    fetchEntries();
  }, [user, toast, isOnline]);

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

          // Only process NEW results starting from resultIndex to avoid duplication
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Show interim text in real-time (gray text indicator)
          setInterimText(interimTranscript);

          // When we have final text, append it to the content
          if (finalTranscript) {
            setInterimText(''); // Clear interim since it's now final
            if (speechTargetModeRef.current === "edit") {
              setEditFormData(prev => ({
                ...prev,
                content: prev.content + finalTranscript
              }));
            } else {
              setFormData(prev => ({
                ...prev,
                content: prev.content + finalTranscript
              }));
            }
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

  const toggleRecording = (mode: "create" | "edit" = "create") => {
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
      setInterimText(''); // Clear any remaining interim text
    } else {
      try {
        setSpeechTargetMode(mode);
        speechTargetModeRef.current = mode;
        recognition.start();
        setIsRecording(true);
        toast({
          title: "Recording Started",
          description: "Speak now to add to your diary entry...",
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

  const analyzeImageWithAI = async (file: File) => {
    try {
      setAnalyzingImage(true);
      console.log('Starting AI analysis...');

      const summary = await AzureOpenAIService.analyzeArtifactImage(file);
      setAiSummary(summary);

      toast({
        title: "AI Analysis Complete",
        description: "Image has been analyzed and summary generated",
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: "AI Analysis Failed",
        description: "Could not analyze image, but you can still save the entry",
        variant: "destructive"
      });
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }

      setSelectedImage(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Start AI analysis
      analyzeImageWithAI(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAiSummary("");
    setAnalyzingImage(false);
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be signed in to create diary entries",
        variant: "destructive"
      });
      return;
    }

    if (!formData.title && !formData.content) {
      toast({
        title: "Validation Error",
        description: "Please add a title or content",
        variant: "destructive"
      });
      return;
    }

    if (formData.category === "site" && siteMode === "new" && !formData.title.trim()) {
      toast({
        title: "Site Name Required",
        description: "Please enter a site name to create a new site",
        variant: "destructive"
      });
      return;
    }

    if (formData.category === "site" && siteMode === "existing" && !selectedSiteId) {
      toast({
        title: "Site Required",
        description: "Please pick an existing site or switch to 'Create New Site'",
        variant: "destructive"
      });
      return;
    }

    if (formData.category === "site" && !isOnline) {
      toast({
        title: "Connection Required",
        description: "Linking a site requires an internet connection. Please reconnect and try again.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const now = new Date();
      const entryData = {
        userId: user.uid,
        title: formData.title || "Untitled Entry",
        content: formData.content,
        category: formData.category,
        createdAt: isOnline ? Timestamp.fromDate(now) : now.toISOString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        aiImageSummary: aiSummary || "",
      };

      // Handle offline mode - queue entry locally
      if (!isOnline) {
        console.log('📴 Offline - queueing diary entry locally');

        // Convert selected image to blob if exists
        let imageBlob: Blob | undefined;
        if (selectedImage) {
          imageBlob = selectedImage;
        }

        await OfflineDiaryQueueService.queueDiaryEntry(
          {
            ...entryData,
            createdAt: now.toISOString(),
          },
          imageBlob
        );

        toast({
          title: "Saved Offline",
          description: "Diary entry will be uploaded when you're back online.",
        });

        // Reset form
        setFormData({ title: "", content: "", category: "artifact" });
        setSelectedImage(null);
        setImagePreview(null);
        setAiSummary("");
        setAnalyzingImage(false);
        setSiteMode("new");
        setSelectedSiteId("");
        setIsCreateDialogOpen(false);

        // Refresh entries to show the new offline entry
        const queue = await OfflineDiaryQueueService.getQueue();
        const offlineEntriesRefresh = queue
          .filter((item: any) => item.userId === user.uid)
          .map((item: any): OfflineDiaryEntry => ({
            ...item,
            id: item.id ? `offline-${item.id}` : undefined,
            numericId: item.id,
            isOffline: true,
            status: 'pending',
          }));

        setOfflineCount(offlineEntriesRefresh.length);
        setEntries(offlineEntriesRefresh);
        return;
      }

      // Online mode - save to Firebase
      const docRef = await addDoc(collection(db, "DigitalDiary"), entryData);

      // Upload image if selected
      if (selectedImage && docRef.id) {
        try {
          const imageRef = ref(storage, `diaryImages/${user.uid}/${docRef.id}/${selectedImage.name}`);
          await uploadBytes(imageRef, selectedImage);
          const imageUrl = await getDownloadURL(imageRef);

          // Update the entry with image URL
          await updateDoc(doc(db, "DigitalDiary", docRef.id), { imageUrl });
        } catch (imageError) {
          console.error("Error uploading image:", imageError);
          toast({
            title: "Warning",
            description: "Entry created but image upload failed",
            variant: "destructive"
          });
        }
      }

      // If category is "site", either create a new Site or link to an existing one
      if (formData.category === "site") {
        try {
          let siteId: string;
          let createdNew = false;
          let usedDefaultTemplate = false;
          let siteDisplayName = formData.title.trim();

          if (siteMode === "existing" && selectedSiteId) {
            siteId = selectedSiteId;
            const picked = existingSites.find(s => s.id === selectedSiteId);
            if (picked?.name) siteDisplayName = picked.name;
          } else {
            const systemTemplates = await SiteTemplatesService.listSystemTemplates();
            const defaultTemplate = systemTemplates[0];
            usedDefaultTemplate = !!defaultTemplate;

            siteId = await SitesService.createSite({
              name: formData.title.trim(),
              description: formData.content.trim(),
              status: 'draft',
              location: { latitude: 0, longitude: 0 },
              dateDiscovered: new Date(),
              createdBy: user.uid,
              organizationId: organization?.id,
              visibility: 'private',
              artifacts: [],
              images: [],
              ...(defaultTemplate ? {
                linkedTemplateId: defaultTemplate.id,
                assignedConsultantId: user.uid,
                assignedConsultantEmail: user.email ?? '',
                submissionStatus: 'in_progress' as const,
              } : {}),
            });
            createdNew = true;

            if (selectedImage) {
              try {
                const url = await SitesService.uploadSiteImage(siteId, selectedImage);
                await SitesService.updateSiteImages(siteId, [url]);
              } catch (imgErr) {
                console.warn('Site image upload failed:', imgErr);
              }
            }
          }

          // Link the diary entry to the site (new or existing)
          try {
            await updateDoc(doc(db, "DigitalDiary", docRef.id), { siteId });
          } catch (linkErr) {
            console.warn('Could not link diary entry to site:', linkErr);
          }

          toast({
            title: createdNew ? "Site Created!" : "Linked to Site",
            description: createdNew
              ? usedDefaultTemplate
                ? `"${siteDisplayName}" added to Sites with default form template.`
                : `"${siteDisplayName}" added to Sites.`
              : `Diary entry linked to "${siteDisplayName}".`,
          });
        } catch (siteError) {
          console.error('Error handling site for diary entry:', siteError);
          toast({
            title: "Partial Success",
            description: siteMode === "existing"
              ? "Diary entry saved, but linking to the site failed."
              : "Diary entry saved, but site creation failed. You can create the site manually.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Success!",
          description: "Diary entry has been created",
        });
      }

      // Reset form
      setFormData({ title: "", content: "", category: "artifact" });
      setSelectedImage(null);
      setImagePreview(null);
      setAiSummary("");
      setAnalyzingImage(false);
      setSiteMode("new");
      setSelectedSiteId("");
      setIsCreateDialogOpen(false);

      // Refresh entries
      const q = query(
        collection(db, "DigitalDiary"),
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const entriesData: DiaryEntry[] = [];
      querySnapshot.forEach((doc) => {
        entriesData.push({ id: doc.id, ...doc.data() } as DiaryEntry);
      });

      // Sort by createdAt on client side (newest first)
      entriesData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      // Also include any offline entries at the top
      const offlineQueue = await OfflineDiaryQueueService.getQueue();
      const offlineEntriesForMerge = offlineQueue
        .filter((item: any) => item.userId === user.uid)
        .map((item: any): OfflineDiaryEntry => ({
          ...item,
          id: item.id ? `offline-${item.id}` : undefined,
          numericId: item.id,
          isOffline: true,
          status: 'pending',
        }));

      setOfflineCount(offlineEntriesForMerge.length);
      setEntries([...offlineEntriesForMerge, ...entriesData]);

    } catch (error) {
      console.error("Error creating diary entry:", error);
      toast({
        title: "Error",
        description: "Failed to create diary entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this diary entry?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "DigitalDiary", entryId));
      setEntries(entries.filter(entry => entry.id !== entryId));
      toast({
        title: "Success",
        description: "Diary entry deleted",
      });
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Error",
        description: "Failed to delete diary entry",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (entry: DiaryEntry | OfflineDiaryEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      title: entry.title,
      content: entry.content,
      category: entry.category,
    });
    // Track if editing offline entry
    if ('isOffline' in entry && entry.isOffline && 'numericId' in entry && entry.numericId) {
      setEditingOfflineId(entry.numericId);
    } else {
      setEditingOfflineId(null);
    }
    setIsEditDialogOpen(true);
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !editingEntry?.id) {
      toast({
        title: "Error",
        description: "Unable to update entry",
        variant: "destructive"
      });
      return;
    }

    if (!editFormData.title && !editFormData.content) {
      toast({
        title: "Validation Error",
        description: "Please add a title or content",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Check if this is an offline entry
      if (editingOfflineId !== null) {
        // Update offline entry in IndexedDB
        await OfflineDiaryQueueService.updateOfflineEntry(editingOfflineId, {
          title: editFormData.title || "Untitled Entry",
          content: editFormData.content,
          category: editFormData.category,
        });

        // Update local state
        setEntries(entries.map(entry =>
          entry.id === editingEntry.id
            ? {
                ...entry,
                title: editFormData.title || "Untitled Entry",
                content: editFormData.content,
                category: editFormData.category,
              }
            : entry
        ));

        toast({
          title: "Success!",
          description: "Offline diary entry has been updated",
        });
      } else {
        // Update online entry in Firestore
        const entryRef = doc(db, "DigitalDiary", editingEntry.id);
        await updateDoc(entryRef, {
          title: editFormData.title || "Untitled Entry",
          content: editFormData.content,
          category: editFormData.category,
        });

        // Update local state
        setEntries(entries.map(entry =>
          entry.id === editingEntry.id
            ? {
                ...entry,
                title: editFormData.title || "Untitled Entry",
                content: editFormData.content,
                category: editFormData.category,
              }
            : entry
        ));

        toast({
          title: "Success!",
          description: "Diary entry has been updated",
        });
      }

      setIsEditDialogOpen(false);
      setEditingEntry(null);
      setEditingOfflineId(null);
      setEditFormData({ title: "", content: "", category: "artifact" });

    } catch (error) {
      console.error("Error updating diary entry:", error);
      toast({
        title: "Error",
        description: "Failed to update diary entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <ResponsiveLayout>
        <header className="bg-card p-4 border-b border-border sticky top-0 z-10 lg:static">
          <div className="flex items-center justify-between">
            <PageHeader />
            <AccountButton />
          </div>
        </header>
        <div className="p-4 lg:p-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Please sign in to access your digital diary
              </p>
              <Button
                onClick={() => navigate('/authentication/sign-in')}
                variant="outline"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div ref={containerRef}>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      <div className="p-4 lg:p-6 space-y-4 mx-auto max-w-7xl">
          {/* Header with Create Button */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-foreground">My Digital Diary</h1>
                {!isOnline && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
                {offlineCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <CloudOff className="w-3 h-3" />
                    {offlineCount} pending
                  </span>
                )}
                {isSyncing && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Syncing...
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Record your thoughts and memories</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Manual sync button - only show when online and have pending items */}
              {isOnline && offlineCount > 0 && !isSyncing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={syncOfflineDiaryData}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync
                </Button>
              )}
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Entry
              </Button>
            </div>
          </div>

          {/* Entries List */}
          {fetchingEntries ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No diary entries yet. Start writing your first entry!
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create First Entry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => {
                const isOfflineEntry = 'isOffline' in entry && entry.isOffline;
                return (
                  <Card
                    key={entry.id}
                    className={`border-border ${isOfflineEntry ? 'border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg">{entry.title}</CardTitle>
                            {isOfflineEntry && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <CloudOff className="w-3 h-3" />
                                Pending Sync
                              </span>
                            )}
                            {entry.category && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                                entry.category === "site"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : entry.category === "artifact"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                              }`}>
                                {entry.category === "site" ? <MapPin className="w-3 h-3" /> : null}
                                {entry.category === "artifact" ? <Package className="w-3 h-3" /> : null}
                                {entry.category === "other" ? <Layers className="w-3 h-3" /> : null}
                                {entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {entry.date}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {entry.time}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Edit button - works for both online and offline entries */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(entry)}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id!)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={isOfflineEntry}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {'imageUrl' in entry && entry.imageUrl && (
                        <img
                          src={entry.imageUrl}
                          alt="Diary entry"
                          className="max-w-full h-auto rounded-lg mb-3"
                        />
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap">{entry.content}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Entry Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Diary Entry</DialogTitle>
              <DialogDescription>
                Write about your day, thoughts, or experiences
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateEntry} className="space-y-4">
              {/* Image Upload */}
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-full h-auto rounded-lg"
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
                <label htmlFor="diary-image" className="cursor-pointer">
                  <div className="flex items-center justify-center h-32 bg-muted rounded-lg hover:bg-muted/80 transition-colors border border-dashed border-border">
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Add a photo (optional)</p>
                    </div>
                  </div>
                </label>
              )}
              <input
                id="diary-image"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              {/* AI Image Analysis Section */}
              {(selectedImage || aiSummary) && (
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    🤖 AI Image Analysis
                    {analyzingImage && <Loader2 className="w-4 h-4 animate-spin" />}
                  </Label>
                  {aiSummary ? (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="text-sm text-muted-foreground mb-2">Generated analysis:</p>
                      <p className="text-sm">{aiSummary}</p>
                    </div>
                  ) : analyzingImage ? (
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-border">
                      <p className="text-sm text-muted-foreground">Analyzing image with AI...</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-border">
                      <p className="text-sm text-muted-foreground">AI analysis will appear here after image upload</p>
                    </div>
                  )}
                </div>
              )}

              {/* Category Selection */}
              <div className="space-y-3">
                <Label>Entry Type</Label>
                <RadioGroup
                  value={formData.category}
                  onValueChange={(value: "site" | "artifact" | "other") => {
                    // Defer setState so Radix's internal flushSync in RovingFocusGroup
                    // doesn't collide with our render. Avoids a dev-only React warning.
                    queueMicrotask(() =>
                      setFormData((prev) => ({ ...prev, category: value })),
                    );
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="site" id="site" />
                    <Label htmlFor="site" className="cursor-pointer flex items-center gap-2 font-normal">
                      <MapPin className="w-4 h-4" />
                      Site
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="artifact" id="artifact" />
                    <Label htmlFor="artifact" className="cursor-pointer flex items-center gap-2 font-normal">
                      <Package className="w-4 h-4" />
                      Artifact
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="cursor-pointer flex items-center gap-2 font-normal">
                      <Layers className="w-4 h-4" />
                      Other
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Site link mode: pick existing or create new */}
              {formData.category === "site" && (
                <div className="space-y-2">
                  <Label>Site</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={siteMode === "new" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSiteMode("new");
                        setSelectedSiteId("");
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create New Site
                    </Button>
                    <Button
                      type="button"
                      variant={siteMode === "existing" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSiteMode("existing")}
                      className="w-full"
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      Use Existing Site
                    </Button>
                  </div>

                  {siteMode === "existing" && (
                    <div className="space-y-1">
                      <Select
                        value={selectedSiteId || undefined}
                        onValueChange={(v) => {
                          setSelectedSiteId(v);
                          // Pre-fill title with picked site name if user hasn't typed one
                          const picked = existingSites.find(s => s.id === v);
                          if (picked && !formData.title.trim()) {
                            setFormData(prev => ({ ...prev, title: picked.name }));
                          }
                        }}
                        disabled={loadingExistingSites || existingSites.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              loadingExistingSites
                                ? "Loading sites…"
                                : existingSites.length === 0
                                ? "No sites available"
                                : "Pick a site…"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {existingSites.map(s => (
                            <SelectItem key={s.id} value={s.id!}>
                              {s.name}{s.siteType ? ` — ${s.siteType}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!loadingExistingSites && existingSites.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No sites yet — switch to "Create New Site" to add one.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  {formData.category === "site" && siteMode === "new" ? (
                    <>Site Name <span className="text-destructive">*</span></>
                  ) : (
                    <>Title (optional)</>
                  )}
                </Label>
                <Input
                  id="title"
                  placeholder={
                    formData.category === "site" && siteMode === "new"
                      ? "e.g. Crowders Mountain Rockshelter"
                      : "Give your entry a title..."
                  }
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="border-border"
                  required={formData.category === "site" && siteMode === "new"}
                />
                {formData.category === "site" && siteMode === "new" && (
                  <p className="text-xs text-muted-foreground">
                    A new site will be created and added to your Sites list with the default form template.
                  </p>
                )}
              </div>

              {/* Content with Speech-to-Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Your Entry</Label>
                  <Button
                    type="button"
                    variant={isRecording && speechTargetMode === "create" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleRecording("create")}
                    className="gap-2"
                  >
                    {isRecording && speechTargetMode === "create" ? (
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
                </div>
                <Textarea
                  id="content"
                  placeholder="What's on your mind? (Type or use voice recording)"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="min-h-32 border-border"
                />
                {isRecording && speechTargetMode === "create" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                      <span>Recording in progress... Speak now</span>
                    </div>
                    {interimText && (
                      <div className="p-2 bg-muted/50 rounded-md border border-dashed border-muted-foreground/30">
                        <p className="text-sm text-muted-foreground italic">{interimText}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Save Entry
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Entry Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Diary Entry</DialogTitle>
              <DialogDescription>
                Make changes to your diary entry
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateEntry} className="space-y-4">
              {/* Linked Site (when diary entry was created with category=site) */}
              {(loadingLinkedSite || linkedSite) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                        <MapPin className="w-3 h-3" />
                        Linked Site
                      </div>
                      {loadingLinkedSite ? (
                        <p className="text-sm text-muted-foreground">Loading site…</p>
                      ) : linkedSite ? (
                        <>
                          <p className="text-sm font-medium truncate">{linkedSite.name}</p>
                          {linkedSite.siteType && (
                            <p className="text-xs text-muted-foreground truncate">{linkedSite.siteType}</p>
                          )}
                          {linkedSite.submissionStatus && (
                            <p className="text-xs text-muted-foreground capitalize">
                              Status: {linkedSite.submissionStatus.replace(/_/g, ' ')}
                            </p>
                          )}
                        </>
                      ) : null}
                    </div>
                    {linkedSite?.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditDialogOpen(false);
                          navigate(`/site/${linkedSite.id}`);
                        }}
                      >
                        View Site
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Show existing image if available */}
              {editingEntry?.imageUrl && (
                <div className="relative">
                  <img
                    src={editingEntry.imageUrl}
                    alt="Entry image"
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              )}

              {/* Category Selection */}
              <div className="space-y-3">
                <Label>Entry Type</Label>
                <RadioGroup
                  value={editFormData.category}
                  onValueChange={(value: "site" | "artifact" | "other") => {
                    queueMicrotask(() =>
                      setEditFormData((prev) => ({ ...prev, category: value })),
                    );
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="site" id="edit-site" />
                    <Label htmlFor="edit-site" className="cursor-pointer flex items-center gap-2 font-normal">
                      <MapPin className="w-4 h-4" />
                      Site
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="artifact" id="edit-artifact" />
                    <Label htmlFor="edit-artifact" className="cursor-pointer flex items-center gap-2 font-normal">
                      <Package className="w-4 h-4" />
                      Artifact
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="edit-other" />
                    <Label htmlFor="edit-other" className="cursor-pointer flex items-center gap-2 font-normal">
                      <Layers className="w-4 h-4" />
                      Other
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  placeholder="Give your entry a title..."
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="border-border"
                />
              </div>

              {/* Content with Speech-to-Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-content">Your Entry</Label>
                  <Button
                    type="button"
                    variant={isRecording && speechTargetMode === "edit" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleRecording("edit")}
                    className="gap-2"
                  >
                    {isRecording && speechTargetMode === "edit" ? (
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
                </div>
                <Textarea
                  id="edit-content"
                  placeholder="What's on your mind? (Type or use voice recording)"
                  value={editFormData.content}
                  onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                  className="min-h-32 border-border"
                />
                {isRecording && speechTargetMode === "edit" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                      <span>Recording in progress... Speak now</span>
                    </div>
                    {interimText && (
                      <div className="p-2 bg-muted/50 rounded-md border border-dashed border-muted-foreground/30">
                        <p className="text-sm text-muted-foreground italic">{interimText}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingEntry(null);
                    setEditFormData({ title: "", content: "", category: "artifact" });
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Pencil className="w-4 h-4" />
                      Update Entry
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  );
};

export default DigitalDiary;

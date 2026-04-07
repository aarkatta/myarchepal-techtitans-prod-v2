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
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { AzureOpenAIService } from "@/services/azure-openai";
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
  // Offline-specific fields
  isOffline?: boolean;
  status?: 'pending';
  localImagePath?: string;
}

const DigitalDiary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
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

  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    category: "artifact" as "site" | "artifact" | "other",
  });

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

          // Update the entry with image URL (we'll need to update the document)
          await addDoc(collection(db, "DigitalDiary"), {
            ...entryData,
            imageUrl
          });

          // Delete the old entry without image
          await deleteDoc(doc(db, "DigitalDiary", docRef.id));
        } catch (imageError) {
          console.error("Error uploading image:", imageError);
          toast({
            title: "Warning",
            description: "Entry created but image upload failed",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "Success!",
        description: "Diary entry has been created",
      });

      // Reset form
      setFormData({ title: "", content: "", category: "artifact" });
      setSelectedImage(null);
      setImagePreview(null);
      setAiSummary("");
      setAnalyzingImage(false);
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
                          className="w-full h-48 object-cover rounded-lg mb-3"
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
                    className="w-full h-48 object-cover rounded-lg"
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
                  onValueChange={(value: "site" | "artifact" | "other") =>
                    setFormData({ ...formData, category: value })
                  }
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

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="Give your entry a title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="border-border"
                />
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
              {/* Show existing image if available */}
              {editingEntry?.imageUrl && (
                <div className="relative">
                  <img
                    src={editingEntry.imageUrl}
                    alt="Entry image"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Category Selection */}
              <div className="space-y-3">
                <Label>Entry Type</Label>
                <RadioGroup
                  value={editFormData.category}
                  onValueChange={(value: "site" | "artifact" | "other") =>
                    setEditFormData({ ...editFormData, category: value })
                  }
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

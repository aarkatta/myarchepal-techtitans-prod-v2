import { useRef, useState } from 'react';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Camera, Images, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormFillContext } from '@/contexts/FormFillContext';
import type { MediaAttachment } from '@/types/siteSubmissions';

export const SITE_PHOTOS_FIELD_ID = '_site_photos_';

const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? '20');
const MAX_BYTES = MAX_MB * 1024 * 1024;

interface UploadingItem {
  tempId: string;
  name: string;
  progress: number;
  preview: string;
}

export default function SitePhotosPanel() {
  const { siteId, submissionId, orgId, mediaAttachments, onMediaChange } = useFormFillContext();

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadingItem[]>([]);

  // Keep a ref so async upload callbacks always use the latest list
  const mediaRef = useRef<MediaAttachment[]>(mediaAttachments);
  mediaRef.current = mediaAttachments;

  const photos = mediaAttachments.filter(a => a.linkedFieldId === SITE_PHOTOS_FIELD_ID);

  const handleFiles = (files: File[]) => {
    if (!storage) return;

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" is not an image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" exceeds the ${MAX_MB} MB limit.`);
        continue;
      }

      const tempId = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setUploading(prev => [...prev, { tempId, name: file.name, progress: 0, preview }]);

      const uniqueName = `${crypto.randomUUID()}_${file.name}`;
      const path = `orgs/${orgId}/sites/${siteId}/submissions/${submissionId}/${SITE_PHOTOS_FIELD_ID}/${uniqueName}`;
      const fileRef = storageRef(storage, path);
      const task = uploadBytesResumable(fileRef, file);

      task.on(
        'state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploading(prev =>
            prev.map(u => u.tempId === tempId ? { ...u, progress: pct } : u)
          );
        },
        err => {
          console.error('Photo upload error:', err);
          toast.error(`Failed to upload "${file.name}"`);
          setUploading(prev => prev.filter(u => u.tempId !== tempId));
          URL.revokeObjectURL(preview);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            const attachment: MediaAttachment = {
              id: crypto.randomUUID(),
              storagePath: path,
              downloadUrl,
              linkedFieldId: SITE_PHOTOS_FIELD_ID,
              fileName: file.name,
              fileSize: file.size,
              uploadedAt: Timestamp.now(),
            };
            // Merge: keep all non-site-photo attachments + existing photos + new one
            const latest = mediaRef.current;
            const updated = [
              ...latest.filter(a => a.linkedFieldId !== SITE_PHOTOS_FIELD_ID),
              ...latest.filter(a => a.linkedFieldId === SITE_PHOTOS_FIELD_ID),
              attachment,
            ];
            onMediaChange(updated);
          } catch (err) {
            console.error('Post-upload error:', err);
            toast.error(`Error finishing upload for "${file.name}"`);
          } finally {
            setUploading(prev => prev.filter(u => u.tempId !== tempId));
            URL.revokeObjectURL(preview);
          }
        }
      );
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    handleFiles(picked);
  };

  const handleDelete = async (photo: MediaAttachment) => {
    if (storage) {
      try {
        await deleteObject(storageRef(storage, photo.storagePath));
      } catch {
        // Already deleted — continue with local cleanup
      }
    }
    const updated = mediaAttachments.filter(a => a.id !== photo.id);
    onMediaChange(updated);
  };

  return (
    <Card>
      <CardHeader className="py-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Images className="w-4 h-4" />
            Site Photos
          </CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => galleryInputRef.current?.click()}
            >
              <Images className="h-3.5 w-3.5 mr-1.5" />
              Gallery
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              Camera
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {photos.length === 0 && uploading.length === 0 ? (
          <button
            type="button"
            className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => galleryInputRef.current?.click()}
          >
            <Camera className="w-8 h-8 opacity-40" />
            <span className="text-sm font-medium">Tap to add site photos</span>
            <span className="text-xs">or use the Camera / Gallery buttons above</span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map(photo => (
              <div key={photo.id} className="relative aspect-square group">
                <a href={photo.downloadUrl} target="_blank" rel="noreferrer">
                  <img
                    src={photo.downloadUrl}
                    alt={photo.fileName}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </a>
                <button
                  type="button"
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(photo)}
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            ))}

            {uploading.map(u => (
              <div
                key={u.tempId}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center"
              >
                <img
                  src={u.preview}
                  alt={u.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
                <div className="relative z-10 flex flex-col items-center gap-1.5 px-3 w-full">
                  <Loader2 className="h-5 w-5 animate-spin text-white drop-shadow" />
                  <Progress value={u.progress} className="h-1 w-full" />
                  <span className="text-xs text-white drop-shadow">{u.progress}%</span>
                </div>
              </div>
            ))}

            {/* Add more button */}
            <button
              type="button"
              className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => galleryInputRef.current?.click()}
            >
              <Images className="w-6 h-6 opacity-50" />
            </button>
          </div>
        )}

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
        />
      </CardContent>
    </Card>
  );
}

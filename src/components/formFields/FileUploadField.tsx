import { useRef, useState, useContext } from 'react';
import { Controller } from 'react-hook-form';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Paperclip, X, Loader2, Image as ImageIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldComponentProps } from './_types';
import type { MediaAttachment } from '@/types/siteSubmissions';
import { FormFillContext } from '@/contexts/FormFillContext';

const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? '20');
const MAX_BYTES = MAX_MB * 1024 * 1024;

interface UploadingFile {
  tempId: string;
  name: string;
  progress: number;
  preview: string | null; // non-null for images
}

function isImageFile(fileName: string) {
  return /\.(jpe?g|png|gif|webp|svg|heic)$/i.test(fileName);
}

export default function FileUploadField({ field, control, mode }: FieldComponentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ctx = useContext(FormFillContext);
  const canUpload = mode === 'fill' && ctx !== null && storage !== undefined;
  const disabled = mode === 'preview';

  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  // Refs to latest values to avoid stale closures in async upload callbacks
  const latestAttachmentsRef = useRef<MediaAttachment[]>([]);
  const latestAllMediaRef = useRef<MediaAttachment[]>(ctx?.mediaAttachments ?? []);

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? []}
      render={({ field: rhf }) => {
        const attachments: MediaAttachment[] = Array.isArray(rhf.value)
          ? (rhf.value as MediaAttachment[])
          : [];

        latestAttachmentsRef.current = attachments;
        if (ctx) latestAllMediaRef.current = ctx.mediaAttachments;

        const saveToFirestore = (thisFieldAttachments: MediaAttachment[]) => {
          if (!ctx) return;
          // Use the ref so async callbacks always see the latest full list
          const others = latestAllMediaRef.current.filter(a => a.linkedFieldId !== field.id);
          ctx.onMediaChange([...others, ...thisFieldAttachments]);
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!canUpload || !ctx || !storage) return;

          for (const file of picked) {
            if (file.size > MAX_BYTES) {
              toast.error(`"${file.name}" exceeds the ${MAX_MB} MB limit.`);
              continue;
            }

            const tempId = crypto.randomUUID();
            const preview = isImageFile(file.name) ? URL.createObjectURL(file) : null;
            setUploading(prev => [...prev, { tempId, name: file.name, progress: 0, preview }]);

            const path = `orgs/${ctx.orgId}/sites/${ctx.siteId}/submissions/${ctx.submissionId}/${field.id}/${file.name}`;
            const fileRef = storageRef(storage, path);
            const task = uploadBytesResumable(fileRef, file);

            task.on(
              'state_changed',
              snapshot => {
                const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setUploading(prev =>
                  prev.map(u => (u.tempId === tempId ? { ...u, progress: pct } : u))
                );
              },
              err => {
                console.error('Upload error:', err);
                toast.error(`Failed to upload "${file.name}"`);
                setUploading(prev => {
                  const item = prev.find(u => u.tempId === tempId);
                  if (item?.preview) URL.revokeObjectURL(item.preview);
                  return prev.filter(u => u.tempId !== tempId);
                });
              },
              async () => {
                try {
                  const downloadUrl = await getDownloadURL(task.snapshot.ref);
                  const attachment: MediaAttachment = {
                    id: crypto.randomUUID(),
                    storagePath: path,
                    downloadUrl,
                    linkedFieldId: field.id,
                    fileName: file.name,
                    fileSize: file.size,
                    uploadedAt: Timestamp.now(),
                  };
                  const next = [...latestAttachmentsRef.current, attachment];
                  latestAttachmentsRef.current = next;
                  rhf.onChange(next);
                  saveToFirestore(next);
                } catch (err) {
                  console.error('Post-upload error:', err);
                  toast.error(`Error finishing upload for "${file.name}"`);
                } finally {
                  setUploading(prev => {
                    const item = prev.find(u => u.tempId === tempId);
                    if (item?.preview) URL.revokeObjectURL(item.preview);
                    return prev.filter(u => u.tempId !== tempId);
                  });
                }
              }
            );
          }
        };

        const handleDelete = async (attachment: MediaAttachment) => {
          if (!ctx || !storage) return;
          try {
            await deleteObject(storageRef(storage, attachment.storagePath));
          } catch (err) {
            console.warn('Storage delete failed (may already be gone):', err);
          }
          const next = attachments.filter(a => a.id !== attachment.id);
          rhf.onChange(next);
          saveToFirestore(next);
        };

        // Split into images vs other files for display
        const imageAttachments = attachments.filter(a => isImageFile(a.fileName));
        const fileAttachments = attachments.filter(a => !isImageFile(a.fileName));
        const imageUploading = uploading.filter(u => u.preview !== null);
        const fileUploading = uploading.filter(u => u.preview === null);

        return (
          <div className="space-y-2">
            <Label>
              {field.label}
              {field.isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>

            {/* Image thumbnail grid */}
            {(imageAttachments.length > 0 || imageUploading.length > 0) && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {imageAttachments.map(a => (
                  <div key={a.id} className="relative aspect-square group">
                    <a href={a.downloadUrl} target="_blank" rel="noreferrer">
                      <img
                        src={a.downloadUrl}
                        alt={a.fileName}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </a>
                    {!disabled && canUpload && (
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(a)}
                      >
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>
                    )}
                  </div>
                ))}
                {imageUploading.map(u => (
                  <div
                    key={u.tempId}
                    className="relative aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center"
                  >
                    {u.preview && (
                      <img
                        src={u.preview}
                        alt={u.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                      />
                    )}
                    <div className="relative z-10 flex flex-col items-center gap-1.5 px-3 w-full">
                      <Loader2 className="h-5 w-5 animate-spin text-white drop-shadow" />
                      <Progress value={u.progress} className="h-1 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Non-image file list */}
            {fileAttachments.length > 0 && (
              <ul className="space-y-1">
                {fileAttachments.map(a => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1.5"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a
                      href={a.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate text-primary hover:underline"
                    >
                      {a.fileName}
                    </a>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(a.fileSize / 1024).toFixed(0)} KB
                    </span>
                    {!disabled && canUpload && (
                      <button type="button" onClick={() => handleDelete(a)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* In-progress non-image uploads */}
            {fileUploading.length > 0 && (
              <ul className="space-y-2">
                {fileUploading.map(u => (
                  <li key={u.tempId} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      <span className="flex-1 truncate">{u.name}</span>
                      <span className="text-xs shrink-0">{u.progress}%</span>
                    </div>
                    <Progress value={u.progress} className="h-1" />
                  </li>
                ))}
              </ul>
            )}

            {/* Upload trigger */}
            {!disabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={!canUpload}
                >
                  {imageAttachments.length > 0 || fileAttachments.length > 0 || uploading.length > 0 ? (
                    <>
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                      Add more
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                      Attach file
                    </>
                  )}
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleChange}
                />
              </>
            )}

            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );
      }}
    />
  );
}

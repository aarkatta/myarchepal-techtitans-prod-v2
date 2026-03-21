import { createContext, useContext } from 'react';
import type { MediaAttachment } from '@/types/siteSubmissions';

export interface FormFillContextValue {
  siteId: string;
  submissionId: string;
  orgId: string;
  /** Full flat list of all media attachments for the current submission. */
  mediaAttachments: MediaAttachment[];
  /** Replace the full mediaAttachments list. Persists to Firestore. */
  onMediaChange: (updated: MediaAttachment[]) => void;
}

export const FormFillContext = createContext<FormFillContextValue | null>(null);

export function useFormFillContext(): FormFillContextValue {
  const ctx = useContext(FormFillContext);
  if (!ctx) throw new Error('useFormFillContext must be used inside FormFillContext.Provider');
  return ctx;
}

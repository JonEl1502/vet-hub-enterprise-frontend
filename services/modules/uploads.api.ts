/**
 * Uploads API Module
 * Direct-to-storage uploads via presigned PUT (R2 / DO Spaces / S3 — provider
 * picked by backend env vars).
 *
 * Flow:
 *   1. Call requestSignedUrl({ scope, contentType, filename, sizeBytes })
 *   2. PUT the file body to result.uploadUrl with `Content-Type` header
 *   3. Persist result.publicUrl on the owning record (e.g. task attachment)
 */

import { post } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { ApiResponse } from '../api/types';

export type UploadScope = 'task' | 'note' | 'misc' | 'pet' | 'client' | 'clinic-doc' | 'supplier-doc';

export interface SignedUrlInput {
  scope: UploadScope;
  contentType: string;
  filename?: string;
  sizeBytes?: number;
}

export interface SignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export const uploadsAPI = {
  /** Request a short-lived presigned PUT URL from the backend. */
  requestSignedUrl: (input: SignedUrlInput): Promise<ApiResponse<SignedUrlResult>> =>
    post<SignedUrlResult>(ENDPOINTS.UPLOADS.SIGNED_URL, input),

  /**
   * Upload a File/Blob directly to storage using a presigned URL.
   * Uses fetch (not axios) to avoid wrapping interceptors that mutate
   * the request — the storage provider expects the bytes raw.
   */
  putToSignedUrl: async (uploadUrl: string, file: Blob, contentType: string): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Storage upload failed (${res.status}): ${text.slice(0, 200)}`);
    }
  },

  /**
   * Convenience: signed-url + PUT in one call. Returns the public URL the
   * caller should persist.
   */
  upload: async (file: File, scope: UploadScope = 'task'): Promise<SignedUrlResult> => {
    const signed = await uploadsAPI.requestSignedUrl({
      scope,
      contentType: file.type || 'application/octet-stream',
      filename: file.name,
      sizeBytes: file.size,
    });
    if (!signed.data) throw new Error(signed.message || 'Failed to get upload URL');
    await uploadsAPI.putToSignedUrl(signed.data.uploadUrl, file, file.type || 'application/octet-stream');
    return signed.data;
  },

  /**
   * Upload a raw Blob (e.g. a cropped image produced via canvas) where there's
   * no File object. Returns the public URL to persist.
   */
  uploadBlob: async (blob: Blob, opts: { scope: UploadScope; filename: string; contentType: string }): Promise<SignedUrlResult> => {
    const signed = await uploadsAPI.requestSignedUrl({
      scope: opts.scope,
      contentType: opts.contentType,
      filename: opts.filename,
      sizeBytes: blob.size,
    });
    if (!signed.data) throw new Error(signed.message || 'Failed to get upload URL');
    await uploadsAPI.putToSignedUrl(signed.data.uploadUrl, blob, opts.contentType);
    return signed.data;
  },
};

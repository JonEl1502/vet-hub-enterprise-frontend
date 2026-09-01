import { labAPI, imagingAPI } from '../../../../../services/modules/diagnostics.api';
import { uploadsAPI } from '../../../../../services/modules/uploads.api';
import { surgeryAPI } from '../../../../../services';

/**
 * Uploading a result file and hanging it on the right record.
 *
 * This exists because the three record types **store attachments in three
 * different shapes**, and that is exactly the kind of detail that rots when it
 * is written out twice:
 *
 *   lab      `attachments: { url, name, kind: 'IMAGE' | 'FILE' }[]`
 *   imaging  `images:      { url, description }[]`
 *   surgery  `images:      string[]`          ← a plain array of URLs
 *
 * Spreading an object into surgery's `images`, or a bare string into imaging's,
 * fails silently — the record saves and the attachment is simply not there.
 * Both the inline editor and the row's "Upload result" go through here so there
 * is one place to be right.
 */
export type ResultKind = 'lab' | 'imaging' | 'surgery';

export interface UploadedFile {
  url: string;
  name: string;
  isImage: boolean;
}

/**
 * Push files to storage via presigned PUTs.
 *
 * The bytes go browser → storage directly, so a 12MB radiograph never travels
 * through the API. Nothing is persisted on the record here: a failed upload
 * must not leave a broken reference behind.
 */
export const uploadResultFiles = async (files: File[]): Promise<UploadedFile[]> => {
  const out: UploadedFile[] = [];
  for (const file of files) {
    const signed: any = await uploadsAPI.requestSignedUrl({
      scope: 'task',
      contentType: file.type || 'application/octet-stream',
      filename: file.name,
      sizeBytes: file.size,
    });
    const d = signed?.data ?? signed;
    if (!d?.uploadUrl || !d?.publicUrl) throw new Error('Could not get an upload URL');
    await uploadsAPI.putToSignedUrl(d.uploadUrl, file, file.type || 'application/octet-stream');
    out.push({ url: d.publicUrl, name: file.name, isImage: (file.type || '').startsWith('image/') });
  }
  return out;
};

/**
 * The attachment field for `kind`, with `uploaded` appended to what the record
 * already holds. Returns a partial the caller merges into its own update call,
 * so notes/status can still go up in the same request.
 */
export const mergeAttachments = (
  kind: ResultKind,
  record: any,
  uploaded: UploadedFile[],
): Record<string, unknown> => {
  if (kind === 'lab') {
    const existing = record?.attachments ?? [];
    return {
      attachments: [
        ...existing,
        ...uploaded.map(u => ({ url: u.url, name: u.name, kind: u.isImage ? 'IMAGE' : 'FILE' })),
      ],
    };
  }
  if (kind === 'surgery') {
    // Plain string[] — append URLs, never objects.
    const existing: string[] = Array.isArray(record?.images) ? record.images : [];
    return { images: [...existing, ...uploaded.map(u => u.url)] };
  }
  // imaging — older rows stored bare strings, so normalise before appending.
  const existing = (record?.images ?? []).map((im: any) => (typeof im === 'string' ? { url: im } : im));
  return {
    images: [
      ...existing,
      // A non-image still attaches: an external lab's PDF is a result too.
      ...uploaded.map(u => ({ url: u.url, description: u.name })),
    ],
  };
};

/**
 * Upload and attach in one go, for callers with nothing else to save.
 * Returns how many files landed.
 */
export const uploadAndAttach = async (
  kind: ResultKind,
  record: any,
  files: File[],
): Promise<number> => {
  const recordId = record?.id;
  if (!recordId || !files.length) return 0;
  const uploaded = await uploadResultFiles(files);
  const payload = mergeAttachments(kind, record, uploaded);
  if (kind === 'lab') await labAPI.update(recordId, payload as any);
  else if (kind === 'surgery') await surgeryAPI.update(recordId, payload as any);
  else await imagingAPI.update(recordId, payload as any);
  return uploaded.length;
};

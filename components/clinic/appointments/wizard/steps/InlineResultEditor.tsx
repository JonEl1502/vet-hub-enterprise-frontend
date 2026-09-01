import React, { useRef, useState } from 'react';
import { Loader2, Upload, X, CheckCircle2, Save, ImagePlus, Paperclip } from 'lucide-react';
import { labAPI, imagingAPI, LabRecord, ImagingRecord } from '../../../../../services/modules/diagnostics.api';
import { uploadResultFiles, mergeAttachments } from './attachResults';
import { toast, surgeryAPI } from '../../../../../services';

/**
 * Record a diagnostic result WHERE THE REQUEST IS (user, 2026-08-22).
 *
 * The panel could only ever display a result and told you to go elsewhere to
 * attach one — "results are attached from the {category} page once uploaded".
 * That is a page change, a search for the same patient, and a walk back, for
 * the single most common action on a request. Typing the findings and dropping
 * the images belongs on the row that asked for them.
 *
 * Uploads go straight to storage through a presigned PUT, so a 12MB radiograph
 * never travels through the API. The URL is persisted on the record only after
 * the bytes land — a failed upload leaves no broken reference behind.
 */
type Props = {
  /** 2026-08-22: surgery records get the same inline editor — a surgeon
   *  photographing a site should not have to leave the visit to attach it. */
  kind: 'lab' | 'imaging' | 'surgery';
  lab?: LabRecord;
  imaging?: ImagingRecord;
  surgery?: any;
  onSaved: () => void;
};

const InlineResultEditor: React.FC<Props> = ({ kind, lab, imaging, surgery, onSaved }) => {
  const [text, setText] = useState<string>(
    kind === 'lab' ? (lab?.notes ?? '')
    : kind === 'surgery' ? (surgery?.findings ?? '')
    : (imaging?.findings ?? ''),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<{ url: string; name: string; isImage: boolean }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const recordId = kind === 'lab' ? lab?.id : kind === 'surgery' ? surgery?.id : imaging?.id;

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length || !recordId) return;
    setUploading(true);
    try {
      const uploaded = await uploadResultFiles(Array.from(files));
      setPending(prev => [...prev, ...uploaded]);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (markResulted: boolean) => {
    if (!recordId) return;
    setBusy(true);
    try {
      if (kind === 'lab') {
        await labAPI.update(recordId, {
          notes: text,
          ...mergeAttachments('lab', lab, pending),
          ...(markResulted ? { status: 'RESULTED' as any, resultDate: new Date().toISOString() } : {}),
        } as any);
      } else if (kind === 'surgery') {
        await surgeryAPI.update(recordId, {
          findings: text,
          ...mergeAttachments('surgery', surgery, pending),
          ...(markResulted ? { status: 'COMPLETED' as any } : {}),
        } as any);
      } else {
        await imagingAPI.update(recordId, {
          findings: text,
          ...mergeAttachments('imaging', imaging, pending),
          ...(markResulted ? { status: 'RESULTED' as any, studyDate: imaging?.studyDate || new Date().toISOString() } : {}),
        } as any);
      }
      setPending([]);
      toast.success(markResulted ? 'Result saved and marked resulted' : 'Result saved');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Could not save the result');
    } finally {
      setBusy(false);
    }
  };

  if (!recordId) return null;

  return (
    <div className="mt-2 pt-2 border-t border-cyan-100 dark:border-cyan-900/40 space-y-2">
      <textarea
        rows={3}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={kind === 'lab' ? 'Result notes — values, interpretation, anything the vet should read…' : 'Findings — what the images show…'}
        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px] text-slate-700 dark:text-zinc-200"
      />

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pending.map((p, i) => (
            <div key={i} className="relative group">
              {p.isImage
                ? <img src={p.url} className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-zinc-800" />
                : <div className="w-14 h-14 rounded-lg border border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-900 px-1">
                    <Paperclip size={12} className="text-slate-400" />
                    <span className="text-[7px] text-slate-400 truncate w-full text-center">{p.name}</span>
                  </div>}
              <button
                type="button"
                title="Remove — it has uploaded but is not attached until you save"
                onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-rose-500 shadow-sm">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden"
          onChange={e => pickFiles(e.target.files)} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          title="Attach images or a PDF — uploaded straight to storage, attached when you save"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50">
          {uploading ? <Loader2 size={10} className="animate-spin" /> : kind === 'imaging' ? <ImagePlus size={10} /> : <Upload size={10} />}
          {uploading ? 'Uploading…' : 'Attach'}
        </button>
        <button type="button" disabled={busy || uploading} onClick={() => save(false)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 text-[9px] font-black uppercase tracking-widest hover:bg-cyan-600 hover:text-white disabled:opacity-50">
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
        </button>
        <button type="button" disabled={busy || uploading} onClick={() => save(true)}
          title="Save and mark this result final"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50">
          <CheckCircle2 size={10} /> Save & mark resulted
        </button>
      </div>
    </div>
  );
};

export default InlineResultEditor;

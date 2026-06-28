import React, { useState, useEffect } from 'react';
import { Scissors, Save, Loader2, ImagePlus, X, CheckCircle2 } from 'lucide-react';
import { Visit } from '../../../types';
import { visitsAPI, groomingAPI, GroomingRecord } from '../../../services';
import ConsumablePicker from '../shared/ConsumablePicker';
import NotesFormatToggle from '../shared/NotesFormatToggle';

interface Props {
  appointment: Visit;
  onSaved?: () => void;
  // Opens the finalize gate (parent owns the reminder gate + settle flow).
  onFinalize?: () => void;
  // Paragraph/bullets toggle for the groomer notes (parent owns the record's displayFormat).
  notesFormat?: { value: string; onChange: (v: string) => void };
}

const TEMPERAMENTS = ['Calm', 'Anxious', 'Aggressive', 'Fractious'];
const VACC = ['Current', 'Expired', 'Unknown'];
const fieldCls = 'w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5';

// Downscale an image file to a compact JPEG data URL (keeps the report small
// and works without object storage; swaps to R2 uploads once that's configured).
const fileToDownscaledDataUrl = (file: File, max = 900, quality = 0.7): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const scale = Math.min(max / width, max / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

// Before/after photo strip with picker + remove.
const PhotoStrip: React.FC<{ label: string; urls: string[]; onChange: (urls: string[]) => void; disabled?: boolean }> = ({ label, urls, onChange, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const add = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      onChange([...urls, dataUrl]);
    } catch (e) { console.error('photo add failed', e); }
    finally { setUploading(false); }
  };
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 group">
            <img src={u} alt="" className="w-full h-full object-cover" />
            {!disabled && <button type="button" onClick={() => onChange(urls.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} className="text-white" /></button>}
          </div>
        ))}
        {urls.length === 0 && disabled && <span className="text-[10px] text-slate-400">No photos</span>}
        {!disabled && (
          <label className="w-16 h-16 rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:border-seafoam bg-slate-50 dark:bg-zinc-800">
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => add(e.target.files?.[0] ?? null)} />
            {uploading ? <Loader2 size={16} className="animate-spin text-seafoam" /> : <ImagePlus size={16} className="text-slate-400" />}
          </label>
        )}
      </div>
    </div>
  );
};

const GroomingPanel: React.FC<Props> = ({ appointment, onSaved, onFinalize, notesFormat }) => {
  const d = appointment.groomingDetail || {};
  // Lock the report card once the visit is checked out — i.e. finalized
  // (PENDING_PAYMENT), completed, or the bill is settled. Mirrors VisitDetailView's
  // `isFinalized` so a checked-out grooming visit can't be re-edited or re-checked-out.
  const locked = !!appointment.isPaid
    || (appointment.status as string) === 'COMPLETED'
    || (appointment.status as string) === 'PENDING_PAYMENT';
  // Visit-level intake stays a one-per-visit blob (groomingDetail JSON).
  const [temperament, setTemperament] = useState(d.temperament || '');
  const [vaccinationStatus, setVaccinationStatus] = useState(d.vaccinationStatus || '');
  const [specialInstructions, setSpecialInstructions] = useState(d.specialInstructions || '');
  const [groomerNotes, setGroomerNotes] = useState(d.groomerNotes || '');
  const [beforePhotos, setBeforePhotos] = useState<string[]>(d.beforePhotos || []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(d.afterPhotos || []);
  const [discount, setDiscount] = useState((d as any).discount != null ? String((d as any).discount) : '');

  // Per-service records now live in the grooming_records table (keyed by task_id,
  // so renaming/replacing a service no longer orphans its record). Opening the
  // panel backfills any missing rows server-side.
  const [records, setRecords] = useState<GroomingRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    groomingAPI.list({ appointmentId: appointment.id })
      .then(r => { if (alive) { if (r.success && r.data?.records) setRecords(r.data.records); setRecordsLoaded(true); } })
      .catch(() => { if (alive) setRecordsLoaded(true); });
    return () => { alive = false; };
  }, [appointment.id]);

  const patchRecord = (id: string, patch: Partial<GroomingRecord>) => setRecords(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  // Per-service status — persisted immediately so the backend syncs it to the
  // matching visit task (drives the visit's per-category progress + finalize gate).
  const setRecordStatus = async (id: string, status: string) => {
    if (locked) return;
    patchRecord(id, { status } as any);
    try { await groomingAPI.update(id, { status } as any); onSaved?.(); } catch { /* non-fatal */ }
  };
  const taskPrice = (taskId: string | null) => {
    const t = (appointment.tasks || []).find((x: any) => String(x.id) === String(taskId));
    return Number((t as any)?.price) || 0;
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      // Per-service records → table; visit-level intake → groomingDetail JSON.
      await Promise.all(records.map(r => groomingAPI.update(r.id, {
        difficulty: r.difficulty, billable: r.billable, steps: r.steps,
        temperature: r.temperature, weight: r.weight, beforePhotos: r.beforePhotos, afterPhotos: r.afterPhotos,
      })));
      const res = await visitsAPI.saveGrooming(appointment.id, {
        temperament, vaccinationStatus, specialInstructions, groomerNotes, beforePhotos, afterPhotos,
        discount: discount ? Number(discount) : 0,
      } as any);
      if (res.success) { setSaved(true); onSaved?.(); }
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Scissors size={18} className="text-seafoam" />
          <div>
            <h4 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Grooming Report Card</h4>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Intake, before/after & groomer notes</p>
          </div>
        </div>
      </div>

      {locked && (
        <div className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">🔒 Visit checked out — report card locked</div>
      )}

      {/* Intake */}
      <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Intake</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Temperament</label>
            <select className={fieldCls} value={temperament} onChange={e => setTemperament(e.target.value)} disabled={locked}>
              <option value="">Select…</option>{TEMPERAMENTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vaccination status</label>
            <select className={fieldCls} value={vaccinationStatus} onChange={e => setVaccinationStatus(e.target.value)} disabled={locked}>
              <option value="">Select…</option>{VACC.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Special instructions</label>
          <textarea className={fieldCls} rows={2} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} disabled={locked} placeholder="Sensitive ears; flea infestation noted; aggressive for nail trim" />
        </div>
      </section>

      {/* Photos */}
      <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Before &amp; after</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PhotoStrip label="Before photos" urls={beforePhotos} onChange={setBeforePhotos} disabled={locked} />
          <PhotoStrip label="After photos" urls={afterPhotos} onChange={setAfterPhotos} disabled={locked} />
        </div>
        <div>
          {notesFormat && <NotesFormatToggle value={notesFormat.value} onChange={notesFormat.onChange} className="mb-2.5" />}
          <label className={labelCls}>Groomer notes</label>
          <textarea className={fieldCls} rows={3} value={groomerNotes} onChange={e => setGroomerNotes(e.target.value)} disabled={locked} placeholder="Full groom completed; recommend de-shed treatment next visit" />
        </div>
      </section>

      {/* Grooming settings — one record per grooming service (grooming_records). */}
      <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Service details</p>
        <p className="text-[10px] text-slate-400 -mt-1">The grooming services on this visit. Open each to record its details &amp; products.</p>

        {!recordsLoaded && <div className="py-3 flex items-center gap-2 text-[11px] text-slate-400"><Loader2 size={13} className="animate-spin" /> Loading services…</div>}
        {recordsLoaded && records.length === 0 && (
          <p className="text-[11px] text-slate-400 py-2">No grooming services on this visit yet — add them via the visit's "Add service" or from a boarding/inpatient chart.</p>
        )}

        {records.map(r => {
          const price = taskPrice(r.taskId);
          const difficulty = r.difficulty ?? 5;
          // A completed service is locked for edits (use the status toggle to
          // reopen it). A newly-added service (PENDING) stays editable.
          const recLocked = locked || r.status === 'COMPLETED';
          return (
            <details key={r.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden" open>
              <summary className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer list-none">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-wide truncate">{r.serviceName}</span>
                  {/* Per-service status */}
                  <span className="flex gap-0.5 shrink-0">
                    {[{ v: 'PENDING', l: 'Pending', on: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }, { v: 'IN_PROGRESS', l: 'WIP', on: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' }, { v: 'COMPLETED', l: 'Done', on: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }].map(s => (
                      <button key={s.v} type="button" disabled={locked} onClick={(ev) => { ev.preventDefault(); setRecordStatus(r.id, s.v); }}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${(r.status || 'PENDING') === s.v ? s.on : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600'}`}>{s.l}</button>
                    ))}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {price > 0 && <span className="text-[11px] font-bold text-slate-400">KES {price.toLocaleString()}</span>}
                  <button type="button" disabled={recLocked} onClick={(ev) => { ev.preventDefault(); patchRecord(r.id, { billable: !r.billable }); }}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${r.billable ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                    {r.billable ? 'Billable' : 'Non-billable'}
                  </button>
                </span>
              </summary>
              <div className="px-3 pb-3 space-y-3 border-t border-slate-100 dark:border-zinc-800/60 pt-3">
                {/* Temp/Weight live at the visit/intake (category) level, not per service. */}
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 w-16 shrink-0">Difficulty</span>
                  <input type="range" min={1} max={10} value={difficulty} disabled={recLocked} onChange={ev => patchRecord(r.id, { difficulty: Number(ev.target.value) })} className="flex-1 accent-seafoam" />
                  <span className="w-7 text-center text-sm font-black text-pine dark:text-zinc-100">{difficulty}</span>
                </div>
                <input className={fieldCls} disabled={recLocked} placeholder="Steps taken (e.g. de-mat, clip #4, sanitary trim)" value={r.steps ?? ''} onChange={ev => patchRecord(r.id, { steps: ev.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <PhotoStrip label="Before" urls={r.beforePhotos} onChange={urls => patchRecord(r.id, { beforePhotos: urls })} disabled={recLocked} />
                  <PhotoStrip label="After" urls={r.afterPhotos} onChange={urls => patchRecord(r.id, { afterPhotos: urls })} disabled={recLocked} />
                </div>
                {!recLocked && <ConsumablePicker appointmentId={appointment.id} serviceTag={r.serviceName} onChanged={onSaved} title={`Products & consumables — ${r.serviceName}`} />}
              </div>
            </details>
          );
        })}

        <div>
          <label className={labelCls}>Discount (KES)</label>
          <input type="number" min="0" className={fieldCls} value={discount} onChange={e => setDiscount(e.target.value)} disabled={locked} placeholder="0" />
          <p className="text-[10px] text-slate-400 mt-1">Applied as a line on the bill when you save.</p>
        </div>
      </section>

      {!locked && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 disabled:opacity-50">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save report</>}
          </button>
          {saved && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Saved ✓</span>}
        </div>
      )}

      {/* Checkout — saves the report, marks every grooming service finished (the
          backend then completes the matching visit tasks), and opens the visit
          workflow. Finalize + settle happen there, NOT here. */}
      {!locked && onFinalize && (
        <button type="button" onClick={async () => {
          await save();
          try { await Promise.all(records.filter(r => r.status !== 'COMPLETED').map(r => groomingAPI.update(r.id, { status: 'COMPLETED' }))); } catch { /* non-fatal — workflow still opens */ }
          onSaved?.();
          onFinalize();
        }} disabled={saving}
          className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
          <CheckCircle2 size={15} /> Checkout
        </button>
      )}
    </div>
  );
};

export default GroomingPanel;

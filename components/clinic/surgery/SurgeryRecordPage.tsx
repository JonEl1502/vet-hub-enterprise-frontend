import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Slice, Loader2, X, ExternalLink, ImagePlus, CheckCircle2, Share2, Lock, PencilLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { surgeryAPI, SurgeryRecord } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import ShareWithClinics from '../shared/ShareWithClinics';
import ConsumablePicker from '../shared/ConsumablePicker';
import { renderFormatted } from './SurgeryView';

// Full-page surgery workflow — converted from the old right-side drawer.
// Multiple surgeries on the same visit render as TABS; a COMPLETED record
// locks (fields become read-only detail blocks) but stays fully readable,
// with a discreet "Reopen to edit" escape.

interface Props {
  recordId: string;
  onBack: () => void;
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

const STATUS_OPTS = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  IN_PROGRESS: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};
const fieldCls = 'w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5';

const fileToDataUrl = (file: File, max = 1000, quality = 0.7): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) { const s = Math.min(max / width, max / height); width = Math.round(width * s); height = Math.round(height * s); }
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        c.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('decode failed'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const SurgeryRecordPage: React.FC<Props> = ({ recordId, onBack, onOpenAppointment }) => {
  const { pets } = useData();
  // The page can hop between sibling surgeries of the same visit (tabs) —
  // currentId tracks which one is on screen; the prop is just the entry.
  const [currentId, setCurrentId] = useState(recordId);
  useEffect(() => { setCurrentId(recordId); }, [recordId]);

  const [rec, setRec] = useState<SurgeryRecord | null>(null);
  const [siblings, setSiblings] = useState<SurgeryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surgeryAPI.getById(currentId);
      if (res.success && res.data?.record) {
        const r = res.data.record;
        setRec(r);
        // All surgeries of the SAME visit → tabs (the fetched record stays the
        // fallback so a record without a visit still renders).
        if (r.appointmentId) {
          try {
            const sib = await surgeryAPI.list({ appointmentId: r.appointmentId });
            if (sib.success && sib.data?.records) setSiblings(sib.data.records);
          } catch { setSiblings([r]); }
        } else setSiblings([r]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [currentId]);
  useEffect(() => { setRec(null); load(); }, [currentId, load]);

  const petName = (r: SurgeryRecord) => r.pet?.name || pets.find((p: any) => String(p.id) === String(r.petId))?.name || 'Patient';
  const patch = (p: Partial<SurgeryRecord>) => setRec(r => r ? { ...r, ...p } : r);
  const locked = rec?.status === 'COMPLETED';
  // Once the visit is billed (finalized or paid), a completed surgery is
  // frozen for good — no reopen. Mirrors the server guard.
  const apptState: any = (rec as any)?.appointment || {};
  const billFinalized = !!(apptState.isPaid || apptState.status === 'PENDING_PAYMENT' || apptState.status === 'COMPLETED');

  const save = async (overrides?: Partial<SurgeryRecord>) => {
    if (!rec) return;
    setSaving(true);
    try {
      const body = { ...rec, ...(overrides || {}) };
      const res = await surgeryAPI.update(rec.id, {
        status: body.status, anesthesia: body.anesthesia, procedureNotes: body.procedureNotes,
        findings: body.findings, complications: body.complications, postOpInstructions: body.postOpInstructions,
        complexity: body.complexity, displayFormat: body.displayFormat,
        startedAt: body.startedAt, endedAt: body.endedAt, images: body.images, notes: body.notes,
      } as any);
      if (res.success && res.data) {
        toast.success('Surgery record saved');
        await load();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // Completed records lock; reopening flips back to IN_PROGRESS so edits are a
  // deliberate act (mirrors the lab page's "Edit result").
  const reopen = () => save({ status: 'IN_PROGRESS' });

  const addImage = async (file: File | null) => {
    if (!file || !rec) return;
    try { const url = await fileToDataUrl(file); patch({ images: [...(rec.images || []), url] }); }
    catch (e) { console.error(e); }
  };

  const setStatus = (s: string) => {
    if (!rec) return;
    // Status transitions auto-stamp the times: starting the surgery sets
    // Started, completing sets Ended (only when blank — backdating stays possible).
    const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const extra: any = {};
    if (s === 'IN_PROGRESS' && !rec.startedAt) extra.startedAt = nowLocal;
    if (s === 'COMPLETED') {
      if (!rec.startedAt) extra.startedAt = nowLocal;
      if (!rec.endedAt) extra.endedAt = nowLocal;
    }
    patch({ status: s, ...extra });
  };

  // Read-only detail block for locked records.
  const Detail: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
    const v = (value || '').trim();
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-lg text-sm text-slate-600 dark:text-zinc-300 min-h-[38px]">
          {v ? renderFormatted(v, rec?.displayFormat || 'PARAGRAPH') : <span className="text-slate-300 dark:text-zinc-600">—</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-300">
      {/* Header — back + rose banner */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-lg active:scale-95 shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 bg-gradient-to-br from-rose-700 to-rose-800 text-white p-4 sm:p-5 rounded-2xl flex items-start justify-between shadow-xl">
          <div className="min-w-0">
            <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Surgery record</p>
            <h2 className="text-lg font-black truncate flex items-center gap-2"><Slice size={16} /> {rec?.serviceName ?? '…'}</h2>
            {rec && <p className="text-[10px] text-white/70">{petName(rec)}{rec.pet?.species ? ` · ${rec.pet.species}` : ''} · {formatDate(rec.createdAt)}</p>}
          </div>
          {rec && locked && (
            <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[9px] font-black uppercase tracking-widest">
              <Lock size={10} /> Completed — locked
            </span>
          )}
        </div>
      </div>

      {/* Sibling tabs — every surgery on the SAME visit */}
      {siblings.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {siblings.map(s => (
            <button key={s.id} onClick={() => { if (String(s.id) !== String(currentId)) setCurrentId(String(s.id)); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${String(s.id) === String(currentId) ? 'bg-rose-700 text-white border-rose-700 shadow-md' : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-rose-400'}`}>
              {s.serviceName}
              <span className={`px-1.5 py-0.5 rounded text-[7px] ${String(s.id) === String(currentId) ? 'bg-white/20 text-white' : statusTone[s.status] || 'bg-slate-100 text-slate-500'}`}>{s.status.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      )}

      {loading && !rec ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : rec ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* MAIN — clinical narrative */}
          <div className="lg:col-span-2 space-y-4">
            <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
              {locked ? (
                <>
                  <Detail label="Anesthesia" value={rec.anesthesia} />
                  <Detail label="Procedure notes" value={rec.procedureNotes} />
                  <Detail label="Findings" value={rec.findings} />
                  <Detail label="Complications" value={rec.complications} />
                  <Detail label="Post-op instructions" value={rec.postOpInstructions} />
                </>
              ) : (
                <>
                  <div><label className={labelCls}>Anesthesia</label><textarea className={fieldCls} rows={2} value={rec.anesthesia ?? ''} onChange={e => patch({ anesthesia: e.target.value })} placeholder="Agent, dose, monitoring" /></div>
                  <div><label className={labelCls}>Procedure notes</label><textarea className={fieldCls} rows={4} value={rec.procedureNotes ?? ''} onChange={e => patch({ procedureNotes: e.target.value })} placeholder="Approach, technique, steps" /></div>
                  <div><label className={labelCls}>Findings</label><textarea className={fieldCls} rows={3} value={rec.findings ?? ''} onChange={e => patch({ findings: e.target.value })} /></div>
                  <div><label className={labelCls}>Complications</label><textarea className={fieldCls} rows={2} value={rec.complications ?? ''} onChange={e => patch({ complications: e.target.value })} placeholder="None" /></div>
                  <div><label className={labelCls}>Post-op instructions</label><textarea className={fieldCls} rows={2} value={rec.postOpInstructions ?? ''} onChange={e => patch({ postOpInstructions: e.target.value })} placeholder="Rest, meds, recheck, suture removal" /></div>
                </>
              )}
            </section>

            {/* Medications & consumables used — deduct stock (fractional ok) +
                bill, scoped to this surgery service. Locked records show none. */}
            {!locked && rec.appointmentId && (
              <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                <ConsumablePicker appointmentId={rec.appointmentId} serviceTag={`surgery:${rec.id}`} title="Medications & consumables used" />
              </section>
            )}

            {/* Images */}
            <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <label className={labelCls}>Images</label>
              <div className="flex flex-wrap gap-2">
                {(rec.images || []).map((u, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 group">
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    {!locked && (
                      <button type="button" onClick={() => patch({ images: rec.images.filter((_, idx) => idx !== i) })} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X size={10} className="text-white" /></button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <label className="w-24 h-24 rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:border-seafoam bg-slate-50 dark:bg-zinc-800">
                    <input type="file" accept="image/*" className="hidden" onChange={e => addImage(e.target.files?.[0] ?? null)} />
                    <ImagePlus size={18} className="text-slate-400" />
                  </label>
                )}
                {locked && (rec.images || []).length === 0 && <span className="text-xs text-slate-400">No images.</span>}
              </div>
            </section>
          </div>

          {/* SIDE — status, timing, complexity, actions */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {rec.appointmentId && onOpenAppointment && (
                  <button onClick={() => onOpenAppointment(rec.appointmentId!)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
                    <ExternalLink size={12} /> Open visit
                  </button>
                )}
                <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
                  <Share2 size={12} /> Share{rec.allowedClinicIds && rec.allowedClinicIds.length > 0 ? ` · ${rec.allowedClinicIds.length}` : ''}
                </button>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                {locked ? (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${statusTone.COMPLETED}`}>
                    <CheckCircle2 size={12} /> Completed{rec.endedAt ? ` · ${formatDate(rec.endedAt)}` : ''}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    {STATUS_OPTS.map(s => (
                      <button key={s} onClick={() => setStatus(s)}
                        className={`flex-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${rec.status === s ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{s.replace('_', ' ')}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Started</label>{locked
                  ? <p className="text-xs font-bold text-pine dark:text-zinc-200">{rec.startedAt ? `${formatDate(rec.startedAt)} · ${new Date(rec.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}</p>
                  : <input type="datetime-local" className={fieldCls} value={rec.startedAt ? String(rec.startedAt).slice(0, 16) : ''} onChange={e => patch({ startedAt: e.target.value || null })} />}</div>
                <div><label className={labelCls}>Ended</label>{locked
                  ? <p className="text-xs font-bold text-pine dark:text-zinc-200">{rec.endedAt ? `${formatDate(rec.endedAt)} · ${new Date(rec.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}</p>
                  : <input type="datetime-local" className={fieldCls} value={rec.endedAt ? String(rec.endedAt).slice(0, 16) : ''} onChange={e => patch({ endedAt: e.target.value || null })} />}</div>
              </div>

              <div>
                <label className={labelCls}>Complexity{locked ? ' · saved' : ''}</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => { if (locked) return; patch({ complexity: rec.complexity === n ? null : n }); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-black border transition-all ${rec.complexity === n ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'} ${locked ? 'cursor-default' : ''}`}>{n}</button>
                  ))}
                </div>
              </div>

              {!locked && (
                <div>
                  <label className={labelCls}>Notes format</label>
                  <div className="flex gap-1.5">
                    {['PARAGRAPH', 'BULLET'].map(f => (
                      <button key={f} onClick={() => patch({ displayFormat: f })}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${(rec.displayFormat || 'PARAGRAPH') === f ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{f === 'BULLET' ? 'Bullets' : 'Paragraph'}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              {locked ? (
                billFinalized ? (
                  <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <Lock size={11} /> Bill finalized — record locked
                  </p>
                ) : (
                  <button onClick={reopen} disabled={saving} className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:border-seafoam hover:text-seafoam transition-all disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <PencilLine size={13} />} Reopen to edit
                  </button>
                )
              ) : (
                <button onClick={() => save()} disabled={saving} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save record
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-sm text-slate-400">Surgery record not found.</div>
      )}

      {showShare && rec && (
        <ShareWithClinics recordType="surgery" recordId={rec.id} allowedClinicIds={rec.allowedClinicIds}
          onClose={() => setShowShare(false)} onSaved={(ids) => setRec(r => r ? { ...r, allowedClinicIds: ids } : r)} />
      )}
    </div>
  );
};

export default SurgeryRecordPage;

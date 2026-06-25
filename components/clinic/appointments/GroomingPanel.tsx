import React, { useState } from 'react';
import { Scissors, Save, Loader2, ImagePlus, X, Camera, CheckCircle2 } from 'lucide-react';
import { Appointment } from '../../../types';
import { appointmentsAPI } from '../../../services';
import ConsumablePicker from '../shared/ConsumablePicker';

interface Props {
  appointment: Appointment;
  onSaved?: () => void;
  // Opens the finalize gate (parent owns the reminder gate + settle flow).
  onFinalize?: () => void;
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

const GroomingPanel: React.FC<Props> = ({ appointment, onSaved, onFinalize }) => {
  const d = appointment.groomingDetail || {};
  // Lock the report card once the bill is settled / visit completed.
  const locked = !!appointment.isPaid || (appointment.status as string) === 'COMPLETED';
  const [temperament, setTemperament] = useState(d.temperament || '');
  const [vaccinationStatus, setVaccinationStatus] = useState(d.vaccinationStatus || '');
  const [specialInstructions, setSpecialInstructions] = useState(d.specialInstructions || '');
  const [groomerNotes, setGroomerNotes] = useState(d.groomerNotes || '');
  const [beforePhotos, setBeforePhotos] = useState<string[]>(d.beforePhotos || []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(d.afterPhotos || []);
  // Grooming settings (Epic D) — each performed service has its own difficulty (1-10).
  const [services, setServices] = useState<string[]>((d as any).services || []);
  const [serviceDifficulties, setServiceDifficulties] = useState<Record<string, number>>((d as any).serviceDifficulties || {});
  const [discount, setDiscount] = useState((d as any).discount != null ? String((d as any).discount) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleService = (s: string) => {
    setServices(prev => {
      if (prev.includes(s)) {
        setServiceDifficulties(d => { const n = { ...d }; delete n[s]; return n; });
        return prev.filter(x => x !== s);
      }
      setServiceDifficulties(d => ({ ...d, [s]: d[s] ?? 5 }));
      return [...prev, s];
    });
  };
  const setDiff = (s: string, v: number) => setServiceDifficulties(d => ({ ...d, [s]: Math.min(10, Math.max(1, v)) }));

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await appointmentsAPI.saveGrooming(appointment.id, {
        temperament, vaccinationStatus, specialInstructions, groomerNotes, beforePhotos, afterPhotos,
        services, serviceDifficulties, discount: discount ? Number(discount) : 0,
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
        <div className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">🔒 Bill settled — report card locked</div>
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
          <label className={labelCls}>Groomer notes</label>
          <textarea className={fieldCls} rows={3} value={groomerNotes} onChange={e => setGroomerNotes(e.target.value)} disabled={locked} placeholder="Full groom completed; recommend de-shed treatment next visit" />
        </div>
      </section>

      {/* Grooming settings */}
      <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Service details</p>
        <div>
          <label className={labelCls}>Services performed</label>
          <div className="flex flex-wrap gap-1.5">
            {['Bath', 'Shaving', 'Untangling', 'Nail trim', 'Ear cleaning', 'De-shedding', 'Teeth brushing'].map(s => (
              <button key={s} type="button" disabled={locked} onClick={() => toggleService(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${services.includes(s) ? 'bg-seafoam text-white border-seafoam' : 'bg-white dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800'} disabled:opacity-60`}>
                {services.includes(s) ? '✓ ' : ''}{s}
              </button>
            ))}
          </div>
        </div>
        {/* Per-service difficulty (1–10) — one record per performed service. */}
        {services.length > 0 && (
          <div className="space-y-2">
            <label className={labelCls}>Difficulty per service (1–10)</label>
            {services.map(s => (
              <div key={s} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl">
                <span className="text-xs font-bold text-pine dark:text-zinc-100 w-28 shrink-0 truncate">{s}</span>
                <input type="range" min={1} max={10} value={serviceDifficulties[s] ?? 5} disabled={locked} onChange={e => setDiff(s, Number(e.target.value))} className="flex-1 accent-seafoam" />
                <input type="number" min={1} max={10} value={serviceDifficulties[s] ?? 5} disabled={locked} onChange={e => setDiff(s, Number(e.target.value))} className="w-14 px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-black text-center text-pine dark:text-zinc-100" />
              </div>
            ))}
          </div>
        )}

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

      {/* Consumables & products used (shampoo, blades, etc.) — billable switch. */}
      {!locked && <ConsumablePicker appointmentId={appointment.id} onChanged={onSaved} title="Products & consumables used" />}

      {/* Finalize & checkout — saves the report, then opens the finalize gate. */}
      {!locked && onFinalize && (
        <button type="button" onClick={async () => { await save(); onFinalize(); }} disabled={saving}
          className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
          <CheckCircle2 size={15} /> Finalize &amp; checkout
        </button>
      )}
    </div>
  );
};

export default GroomingPanel;

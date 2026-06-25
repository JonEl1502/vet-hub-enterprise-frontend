import React, { useState } from 'react';
import { Scissors, Save, Loader2, ImagePlus, X, Camera } from 'lucide-react';
import { Appointment } from '../../../types';
import { appointmentsAPI } from '../../../services';
import ConsumablePicker from '../shared/ConsumablePicker';

interface Props {
  appointment: Appointment;
  onSaved?: () => void;
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

const GroomingPanel: React.FC<Props> = ({ appointment, onSaved }) => {
  const d = appointment.groomingDetail || {};
  // Lock the report card once the bill is settled / visit completed.
  const locked = !!appointment.isPaid || (appointment.status as string) === 'COMPLETED';
  const [temperament, setTemperament] = useState(d.temperament || '');
  const [vaccinationStatus, setVaccinationStatus] = useState(d.vaccinationStatus || '');
  const [specialInstructions, setSpecialInstructions] = useState(d.specialInstructions || '');
  const [groomerNotes, setGroomerNotes] = useState(d.groomerNotes || '');
  const [beforePhotos, setBeforePhotos] = useState<string[]>(d.beforePhotos || []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(d.afterPhotos || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await appointmentsAPI.saveGrooming(appointment.id, {
        temperament, vaccinationStatus, specialInstructions, groomerNotes, beforePhotos, afterPhotos,
      });
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

      {/* Photos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PhotoStrip label="Before photos" urls={beforePhotos} onChange={setBeforePhotos} disabled={locked} />
        <PhotoStrip label="After photos" urls={afterPhotos} onChange={setAfterPhotos} disabled={locked} />
      </div>

      <div>
        <label className={labelCls}>Groomer notes</label>
        <textarea className={fieldCls} rows={3} value={groomerNotes} onChange={e => setGroomerNotes(e.target.value)} disabled={locked} placeholder="Full groom completed; recommend de-shed treatment next visit" />
      </div>

      {!locked && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 disabled:opacity-50">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save report</>}
          </button>
          {saved && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Saved ✓</span>}
        </div>
      )}

      {/* Consumables & products used (shampoo, blades, etc.) — billable switch. */}
      {!locked && <ConsumablePicker appointmentId={appointment.id} onChanged={onSaved} title="Products & consumables used" />}
    </div>
  );
};

export default GroomingPanel;

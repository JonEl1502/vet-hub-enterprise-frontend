import React, { useState } from 'react';
import { Tag, Pencil, Check, X, Loader2 } from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';

interface Props {
  // Which clinic-wide default this edits.
  field: 'boardingDayRate' | 'inpatientDayRate';
  label?: string;
}

/**
 * Inline editor for a clinic-wide default daily rate. Staff set it once here and
 * the admit forms pre-fill from it, so the rate isn't retyped each admission.
 */
const DefaultRateEditor: React.FC<Props> = ({ field, label = 'Default daily rate' }) => {
  const { selectedClinics, updateClinic } = useClinic();
  const clinic = selectedClinics[0] ?? null;
  const current = (clinic?.[field] as number | null | undefined) ?? null;
  const currency = clinic?.currency || 'KES';

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  if (!clinic) return null;

  const start = () => { setValue(current != null ? String(current) : ''); setEditing(true); };

  const save = async () => {
    setSaving(true);
    try {
      const next = value.trim() === '' ? null : Number(value);
      await updateClinic(clinic.id, { [field]: next } as any);
      setEditing(false);
    } catch { /* updateClinic surfaces its own error */ }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm">
      <Tag size={13} className="text-slate-400 shrink-0" />
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 shrink-0">{label}</span>
      {editing ? (
        <>
          <span className="text-[10px] font-bold text-slate-400">{currency}</span>
          <input
            type="number"
            min="0"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="—"
            className="w-24 px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
          />
          <button onClick={save} disabled={saving} className="p-1 rounded-lg text-seafoam hover:bg-seafoam/10 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button onClick={() => setEditing(false)} disabled={saving} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X size={14} />
          </button>
        </>
      ) : (
        <button onClick={start} className="flex items-center gap-1.5 group">
          <span className="text-sm font-black text-pine dark:text-zinc-100">{current != null ? `${currency} ${current.toLocaleString()}` : 'Not set'}</span>
          <Pencil size={11} className="text-slate-300 group-hover:text-seafoam" />
        </button>
      )}
    </div>
  );
};

export default DefaultRateEditor;

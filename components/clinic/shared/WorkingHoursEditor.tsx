import React, { useMemo, useState } from 'react';
import { Clock, Check, Loader2, RotateCcw } from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';
import {
  WorkingHours, DayKey, DAY_ORDER, DAY_LABELS, DAY_SHORT,
  DEFAULT_WORKING_HOURS, hasWorkingHours,
} from './workingHours';

/**
 * Per-weekday opening-hours editor. Staff set the clinic's hours once here; the
 * New Visit screen reads them to auto-flag after-hours arrivals (still
 * overridable). Persists to the clinic's `workingHours` JSON column.
 */
const WorkingHoursEditor: React.FC = () => {
  const { selectedClinics, updateClinic } = useClinic();
  const clinic = selectedClinics[0] ?? null;

  const saved = (clinic?.workingHours as WorkingHours | null | undefined) ?? null;
  const [draft, setDraft] = useState<WorkingHours>(() =>
    hasWorkingHours(saved) ? { ...saved } : { ...DEFAULT_WORKING_HOURS }
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved ?? {}),
    [draft, saved]
  );

  if (!clinic) return null;

  const patchDay = (day: DayKey, patch: Partial<WorkingHours[DayKey]>) => {
    setDraft(prev => {
      const cur = prev[day] ?? { open: '08:00', close: '18:00', closed: false };
      return { ...prev, [day]: { ...cur, ...patch } };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateClinic(clinic.id, { workingHours: draft } as any);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch { /* updateClinic surfaces its own error */ }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="p-1.5 bg-seafoam text-white rounded-lg shadow-md"><Clock size={16} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Working Hours</h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            Set the clinic's opening hours per day. New visits booked outside these hours are flagged <span className="font-bold text-indigo-500">After-hours</span> automatically — staff can still override.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...DEFAULT_WORKING_HOURS })}
          className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-seafoam transition-colors shrink-0"
          title="Reset to a typical Mon–Sat schedule"
        >
          <RotateCcw size={12} /> Defaults
        </button>
      </div>

      <div className="space-y-1.5">
        {DAY_ORDER.map(day => {
          const d = draft[day] ?? { open: '08:00', close: '18:00', closed: false };
          return (
            <div key={day} className="flex flex-wrap items-center gap-2 py-1">
              <span className="w-9 sm:w-24 text-[11px] font-black text-pine dark:text-zinc-200 shrink-0">
                <span className="sm:hidden">{DAY_SHORT[day]}</span>
                <span className="hidden sm:inline">{DAY_LABELS[day]}</span>
              </span>
              <button
                type="button"
                onClick={() => patchDay(day, { closed: !d.closed })}
                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all shrink-0 ${
                  d.closed
                    ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                    : 'bg-seafoam/10 text-seafoam border-seafoam/30'
                }`}
              >
                {d.closed ? 'Closed' : 'Open'}
              </button>
              <div className={`flex items-center gap-1.5 transition-opacity ${d.closed ? 'opacity-30 pointer-events-none' : ''}`}>
                <input
                  type="time"
                  value={d.open}
                  disabled={d.closed}
                  onChange={e => patchDay(day, { open: e.target.value })}
                  className="field-input !py-1 !px-2 w-[6.5rem] text-[12px] tabular-nums"
                />
                <span className="text-slate-300 dark:text-zinc-600 text-xs">–</span>
                <input
                  type="time"
                  value={d.close}
                  disabled={d.closed}
                  onChange={e => patchDay(day, { close: e.target.value })}
                  className="field-input !py-1 !px-2 w-[6.5rem] text-[12px] tabular-nums"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {savedFlash && !dirty && (
          <span className="text-[10px] font-bold text-seafoam flex items-center gap-1"><Check size={12} /> Saved</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide bg-seafoam text-white shadow-sm hover:bg-seafoam/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Saving' : 'Save hours'}
        </button>
      </div>
    </div>
  );
};

export default WorkingHoursEditor;

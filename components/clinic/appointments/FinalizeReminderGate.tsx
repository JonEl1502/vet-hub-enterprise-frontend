import React, { useState, useMemo, useEffect } from 'react';
import { BellRing, Loader2, X, CalendarClock, ShieldAlert, HeartCrack } from 'lucide-react';
import { ReminderServiceType, REMINDER_SERVICE_META } from '../../../services';
import { localYMD } from '../../../services/utils/dateFormatter';

export interface ReminderDraft {
  serviceType: ReminderServiceType;
  title: string;
  notes: string;
  dueAt: string; // ISO
}

// An already-set reminder for this visit. When present, the gate updates it
// (with more data) rather than creating a duplicate.
export interface ExistingReminder {
  serviceType?: string;
  title?: string;
  notes?: string;
  dueAt?: string; // ISO
}

interface Props {
  open: boolean;
  petName: string;
  clientName: string;
  encounterType?: string;
  petDeceased: boolean;
  submitting: boolean;
  existing?: ExistingReminder | null;
  onCancel: () => void;
  // null = deceased bypass (finalize with no reminder)
  onConfirm: (reminder: ReminderDraft | null) => void;
}

const SERVICE_TYPES: ReminderServiceType[] = ['FOLLOW_UP', 'VACCINATION', 'DEWORMING', 'GROOMING', 'MEDICATION', 'CHECKUP', 'OTHER'];

const defaultServiceFor = (encounterType?: string): ReminderServiceType => {
  if (encounterType === 'GROOMING') return 'GROOMING';
  if (encounterType === 'VACCINATION') return 'VACCINATION';
  return 'FOLLOW_UP';
};

const dateInDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localYMD(d);
};

/**
 * Strict pre-finalize gate. A visit cannot be finalized without a follow-up
 * reminder — the only bypass is a deceased patient. Rendered full-screen.
 */
const FinalizeReminderGate: React.FC<Props> = ({ open, petName, clientName, encounterType, petDeceased, submitting, existing, onCancel, onConfirm }) => {
  const initialService = defaultServiceFor(encounterType);
  const [serviceType, setServiceType] = useState<ReminderServiceType>(initialService);
  const [dueAt, setDueAt] = useState<string>(dateInDays(REMINDER_SERVICE_META[initialService].days));
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [touchedDate, setTouchedDate] = useState(false);
  const isUpdate = !!existing;

  // (Re)seed the form each time the gate opens. If a reminder already exists,
  // prefill it so the user updates it with more data instead of starting over.
  useEffect(() => {
    if (!open) return;
    const svc = (existing?.serviceType as ReminderServiceType) || defaultServiceFor(encounterType);
    setServiceType(svc);
    setDueAt(existing?.dueAt ? existing.dueAt.slice(0, 10) : dateInDays(REMINDER_SERVICE_META[svc].days));
    setTitle(existing?.title || '');
    setNotes(existing?.notes || '');
    setTouchedDate(!!existing?.dueAt);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the service type changes, move the due date to its suggested offset
  // unless the user has hand-picked one.
  const pickService = (t: ReminderServiceType) => {
    setServiceType(t);
    if (!touchedDate) setDueAt(dateInDays(REMINDER_SERVICE_META[t].days));
  };

  const valid = useMemo(() => !!dueAt, [dueAt]);

  if (!open) return null;

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 bg-gradient-to-br from-pine to-seafoam text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              {petDeceased ? <HeartCrack size={22} /> : <BellRing size={22} />}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight uppercase">{petDeceased ? 'Finalize visit' : isUpdate ? 'Update the reminder' : 'Set the next reminder'}</h3>
              <p className="text-[11px] text-white/80 font-medium">{petName} · {clientName}</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={submitting} className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"><X size={18} /></button>
        </div>

        {petDeceased ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl">
              <HeartCrack size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">This patient is marked deceased, so no follow-up reminder is needed. The visit will be finalized and prior records remain visible.</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={onCancel} disabled={submitting} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
              <button onClick={() => onConfirm(null)} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine/90 active:scale-95 disabled:opacity-60">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />} Finalize without reminder
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-900/30 rounded-xl">
              <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">{isUpdate ? 'A reminder is already set for this visit — adjust it below to add more detail. It won’t create a duplicate.' : 'A follow-up reminder is required before this visit can be finalized. It drives the next appointment and shows on the Reminders page.'}</p>
            </div>

            <div>
              <label className={labelCls}>Service</label>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => pickService(t)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${serviceType === t ? 'bg-seafoam text-white border-seafoam shadow-sm' : 'bg-white dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam'}`}
                  >
                    {REMINDER_SERVICE_META[t].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}><CalendarClock size={11} className="inline mr-1 -mt-0.5" /> Due date</label>
              <input type="date" className={fieldCls} value={dueAt} onChange={e => { setDueAt(e.target.value); setTouchedDate(true); }} />
            </div>

            <div>
              <label className={labelCls}>Title <span className="text-slate-300 normal-case font-medium">(optional)</span></label>
              <input className={fieldCls} placeholder={`${REMINDER_SERVICE_META[serviceType].label} due for ${petName}`} value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Notes <span className="text-slate-300 normal-case font-medium">(optional)</span></label>
              <textarea rows={2} className={fieldCls} placeholder="e.g. recheck wound, next booster, etc." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={onCancel} disabled={submitting} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
              <button
                onClick={() => onConfirm({ serviceType, dueAt: new Date(dueAt).toISOString(), title: title.trim(), notes: notes.trim() })}
                disabled={submitting || !valid}
                className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} {isUpdate ? 'Update reminder & continue' : 'Set reminder & finalize'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinalizeReminderGate;

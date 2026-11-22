import React, { useState, useMemo, useEffect } from 'react';
import { BellRing, Loader2, X, CalendarClock, ShieldAlert, HeartCrack, Plus, CalendarCheck2 } from 'lucide-react';
import { ReminderServiceType, REMINDER_SERVICE_META } from '../../../services';
import { localYMD } from '../../../services/utils/dateFormatter';

export interface ReminderDraft {
  serviceType: ReminderServiceType;
  title: string;
  notes: string;
  dueAt: string; // ISO
}

/** The next appointment a vaccination/deworming visit books on its way out. */
export interface NextBookingDraft {
  scheduledAt: string; // ISO
}

/**
 * Owner's rule (2026-11-22): a vaccination or deworming visit ends with the
 * next appointment BOOKED as well as a reminder. The booking itself gets a
 * reminder 7 days before it, server-side.
 */
export interface NextAppointmentRequirement {
  kind: 'VACCINATION' | 'DEWORMING';
  /** The record's next-due date (YYYY-MM-DD), when the vet entered one. */
  defaultDate?: string | null;
  /** A qualifying future booking already exists — nothing more to book. */
  booked?: { scheduledAt: string } | null;
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
  /**
   * Where this visit will be asked for the follow-up AGAIN if it is skipped
   * here — e.g. "at discharge" when an inpatient stay is open, "at check-out"
   * for boarding. Both of those already raise this same gate, so skipping
   * DEFERS rather than drops. Leave undefined when nothing will ask again and
   * the Skip button says so instead of implying a safety net that isn't there.
   */
  askAgainAt?: string;
  /** Set on a vaccination/deworming visit: the gate then also books the next appointment. */
  nextAppointment?: NextAppointmentRequirement | null;
  /**
   * Text of the secondary button that calls `onCancel`. The pre-receipt gate
   * says "Take payment, set later" (owner, 2026-11-22: money first, then
   * flag): that button takes the payment and the visit is flagged as needing
   * follow-up. Defaults to "Cancel".
   */
  cancelLabel?: string;
  /** The header ✕ — just close. Defaults to `onCancel`. */
  onDismiss?: () => void;
  onCancel: () => void;
  // null = deceased bypass (finalize with no reminder). Otherwise one or more
  // drafts — "Add another reminder" lets grooming, a vaccination, and a
  // deworming, say, each go out on their own date from the same visit.
  // `booking` is the next appointment to create (vaccination/deworming only).
  onConfirm: (reminders: ReminderDraft[] | null, booking?: NextBookingDraft | null) => void;
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

const NEXT_DEFAULT_DAYS = { VACCINATION: 365, DEWORMING: 90 } as const;
const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayTime = (iso: string) => {
  const d = new Date(iso);
  return `${fmtDay(d)}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};
/** Mirrors the server: 7 days before, or today when that has already passed. */
const reminderDayFor = (scheduled: Date) => {
  const due = new Date(scheduled.getTime() - 7 * 24 * 60 * 60 * 1000);
  return due.getTime() > Date.now() ? fmtDay(due) : 'today';
};

/**
 * Pre-close follow-up prompt. Owner's rule (2026-11-22): every visit ends with
 * a reminder set, so this is a strict gate again. The **Skip for now** added on
 * 2026-08-04 survives ONLY when a stay is still open (`askAgainAt`): discharge
 * or check-out raises this same gate, so skipping there defers rather than
 * drops. A deceased patient is the other bypass. Vaccination and deworming
 * visits also book the next appointment here (`nextAppointment`). The server
 * never refuses a payment over this (owner, 2026-11-22: "money first, then
 * flag"): the pre-receipt use offers "Take payment, set later", and a visit
 * closed without its follow-up is flagged as needing it.
 */
const FinalizeReminderGate: React.FC<Props> = ({ open, petName, clientName, encounterType, petDeceased, submitting, existing, askAgainAt, nextAppointment, cancelLabel, onDismiss, onCancel, onConfirm }) => {
  const initialService = nextAppointment?.kind ?? defaultServiceFor(encounterType);
  const [serviceType, setServiceType] = useState<ReminderServiceType>(initialService);
  const [dueAt, setDueAt] = useState<string>(dateInDays(REMINDER_SERVICE_META[initialService].days));
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [touchedDate, setTouchedDate] = useState(false);
  // Extra reminders beyond the primary one above — e.g. deworming and grooming
  // alongside a vaccination follow-up, each on its own date. The primary slot
  // keeps the existing update-in-place behaviour; these are always new rows.
  const [extras, setExtras] = useState<ReminderDraft[]>([]);
  // Next appointment (vaccination/deworming visits).
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('09:00');
  const isUpdate = !!existing;
  const needsBooking = !!nextAppointment && !nextAppointment.booked;

  // (Re)seed the form each time the gate opens. If a reminder already exists,
  // prefill it so the user updates it with more data instead of starting over.
  useEffect(() => {
    if (!open) return;
    const svc = (existing?.serviceType as ReminderServiceType) || nextAppointment?.kind || defaultServiceFor(encounterType);
    setServiceType(svc);
    setDueAt(existing?.dueAt ? existing.dueAt.slice(0, 10) : dateInDays(REMINDER_SERVICE_META[svc].days));
    setTitle(existing?.title || '');
    setNotes(existing?.notes || '');
    setTouchedDate(!!existing?.dueAt);
    setExtras([]);
    if (nextAppointment) {
      const fallback = dateInDays(NEXT_DEFAULT_DAYS[nextAppointment.kind]);
      const fromRecord = nextAppointment.defaultDate ? nextAppointment.defaultDate.slice(0, 10) : '';
      setNextDate(fromRecord && fromRecord > localYMD(new Date()) ? fromRecord : fallback);
      setNextTime('09:00');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the service type changes, move the due date to its suggested offset
  // unless the user has hand-picked one.
  const pickService = (t: ReminderServiceType) => {
    setServiceType(t);
    if (!touchedDate) setDueAt(dateInDays(REMINDER_SERVICE_META[t].days));
  };

  // The booking must land in the future — a past slot would not book anything.
  const nextAt = useMemo(() => (nextDate && nextTime ? new Date(`${nextDate}T${nextTime}`) : null), [nextDate, nextTime]);
  const nextValid = !needsBooking || (!!nextAt && !Number.isNaN(nextAt.getTime()) && nextAt.getTime() > Date.now());
  const valid = useMemo(() => !!dueAt && extras.every(e => !!e.dueAt) && nextValid, [dueAt, extras, nextValid]);
  const kindLabel = nextAppointment?.kind === 'DEWORMING' ? 'deworming' : 'vaccination';

  const addExtra = () => setExtras(prev => [...prev, {
    serviceType: 'FOLLOW_UP',
    dueAt: dateInDays(REMINDER_SERVICE_META.FOLLOW_UP.days),
    title: '',
    notes: '',
  }]);
  const updateExtra = (i: number, patch: Partial<ReminderDraft>) =>
    setExtras(prev => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const removeExtra = (i: number) => setExtras(prev => prev.filter((_, idx) => idx !== i));

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
          <button onClick={onDismiss ?? onCancel} disabled={submitting} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"><X size={18} /></button>
        </div>

        {petDeceased ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl">
              <HeartCrack size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">This patient is marked deceased, so no follow-up reminder is needed. The visit will be finalized and prior records remain visible.</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={onDismiss ?? onCancel} disabled={submitting} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
              <button onClick={() => onConfirm(null)} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine/90 active:scale-95 disabled:opacity-60">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />} Finalize without reminder
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-900/30 rounded-xl">
              <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                {isUpdate ? 'A reminder is already set for this visit. Adjust it below to add more detail; it won’t create a duplicate.' : 'Every visit ends with a follow-up reminder. It drives the next appointment and shows on the Reminders page.'}
                {nextAppointment ? ` A ${kindLabel} visit also ends with the next appointment booked.` : ''}
              </p>
            </div>

            {nextAppointment && (
              <div className="p-3 space-y-3 rounded-xl border border-seafoam/30 bg-seafoam/5">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-pine dark:text-zinc-200">
                  <CalendarCheck2 size={12} className="text-seafoam" /> Next {kindLabel} appointment
                  {needsBooking && <span className="text-red-500">*</span>}
                </div>
                {nextAppointment.booked ? (
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                    Booked for <span className="font-bold">{fmtDayTime(nextAppointment.booked.scheduledAt)}</span>. Its reminder goes out {reminderDayFor(new Date(nextAppointment.booked.scheduledAt))}.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Date</label>
                        <input type="date" className={fieldCls} min={localYMD(new Date())} value={nextDate} onChange={e => setNextDate(e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Time</label>
                        <input type="time" className={fieldCls} value={nextTime} onChange={e => setNextTime(e.target.value)} />
                      </div>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${nextValid ? 'text-slate-500 dark:text-zinc-400' : 'text-red-600 dark:text-red-400'}`}>
                      {nextValid && nextAt
                        ? <>A reminder will be set for <span className="font-bold">{reminderDayFor(nextAt)}</span>, 7 days before the appointment.{nextAppointment.defaultDate ? '' : ` No next-due date on the record, so this defaults to ${nextAppointment.kind === 'DEWORMING' ? '3 months' : '1 year'} from today.`}</>
                        : 'Pick a date and time in the future.'}
                    </p>
                  </>
                )}
              </div>
            )}

            <div>
              <label className={labelCls}>{nextAppointment ? 'Visit reminder · service' : 'Service'}</label>
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

            {extras.map((ex, i) => (
              <div key={i} className="p-3 space-y-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">Reminder {i + 2}</span>
                  <button onClick={() => removeExtra(i)} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <X size={14} />
                  </button>
                </div>
                <div>
                  <label className={labelCls}>Service</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICE_TYPES.map(t => (
                      <button
                        key={t}
                        onClick={() => updateExtra(i, { serviceType: t })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${ex.serviceType === t ? 'bg-seafoam text-white border-seafoam shadow-sm' : 'bg-white dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam'}`}
                      >
                        {REMINDER_SERVICE_META[t].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}><CalendarClock size={11} className="inline mr-1 -mt-0.5" /> Due date</label>
                  <input type="date" className={fieldCls} value={ex.dueAt} onChange={e => updateExtra(i, { dueAt: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Title <span className="text-slate-300 normal-case font-medium">(optional)</span></label>
                  <input className={fieldCls} placeholder={`${REMINDER_SERVICE_META[ex.serviceType].label} due for ${petName}`} value={ex.title} onChange={e => updateExtra(i, { title: e.target.value })} />
                </div>
              </div>
            ))}

            <button
              onClick={addExtra}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam transition-colors"
            >
              <Plus size={13} /> Add another reminder
            </button>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button onClick={onCancel} disabled={submitting} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">{cancelLabel ?? 'Cancel'}</button>
              {/* Skip (user, 2026-08-04) survives only while a stay is open:
                  the patient is not leaving, and discharge/check-out raise this
                  same gate. Owner's rule (2026-11-22) removed it everywhere
                  else. `null` is the same "no reminder" signal the deceased
                  bypass sends, so every call site handles it. */}
              {askAgainAt && (
                <button
                  onClick={() => onConfirm(null)}
                  disabled={submitting}
                  title={`Continue now — you'll be asked for the follow-up again ${askAgainAt}`}
                  className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-seafoam hover:text-seafoam disabled:opacity-50"
                >
                  Skip for now
                </button>
              )}
              <button
                onClick={() => {
                  const primary: ReminderDraft = { serviceType, dueAt: new Date(dueAt).toISOString(), title: title.trim(), notes: notes.trim() };
                  const rest = extras.map(e => ({ ...e, dueAt: new Date(e.dueAt).toISOString(), title: e.title.trim(), notes: e.notes.trim() }));
                  onConfirm([primary, ...rest], needsBooking && nextAt ? { scheduledAt: nextAt.toISOString() } : null);
                }}
                disabled={submitting || !valid}
                className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} {needsBooking ? 'Book & set reminder' : isUpdate ? 'Update reminder & continue' : extras.length > 0 ? 'Set reminders & finalize' : 'Set reminder & finalize'}
              </button>
            </div>
            {/* Say what Skip does: it defers to a real later prompt. */}
            {askAgainAt && (
              <p className="text-[10px] font-bold leading-relaxed text-slate-400">
                Skipping is fine here: this patient isn't leaving yet, so you'll be asked again {askAgainAt}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinalizeReminderGate;

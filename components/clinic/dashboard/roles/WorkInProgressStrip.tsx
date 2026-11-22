import React from 'react';
import { Home, Stethoscope, Scissors, BedDouble, Syringe, CalendarClock, BellRing } from 'lucide-react';
import { Visit, ApptStatus } from '../../../../types';
import { remindersAPI, Reminder } from '../../../../services';
import { visitsInRange, hasCategory, inDayRange, DayRange } from './roleShared';
import { SOFT, toneFromClass } from '../../../shared/stats/ColorTiles';

/**
 * "Today's work in progress" — the one strip every role sees, so a groomer and
 * a vet share a picture of what the clinic is actually doing right now.
 *
 * Derived from the visits already in DataContext, plus one light self-fetch
 * for reminders (same pattern `StaffDashboard` uses) — kept self-contained so
 * this stays a drop-anywhere component, not something every caller has to
 * wire data into.
 */

interface Props {
  visits: Visit[];
  /**
   * Called with the block's DESTINATION VIEW key (not its own key), so the
   * caller just forwards it to navigate. Both dashboards used to ignore the
   * argument and send every card to `appointments`, which is what made the
   * strip feel dead — five different cards, one destination.
   */
  onOpen?: (view: string, params?: any) => void;
  /** Day the dashboard is pointed at. Omitted = today (user, 2026-08-04). */
  range?: DayRange;
}

const BLOCKS = [
  {
    // Every visit, whatever its category — the rollup the other blocks are a
    // breakdown OF. First in the row so the total lands before the split.
    key: 'appointments', label: 'Appointments', icon: CalendarClock, view: 'appointments',
    tint: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30',
    match: () => true,
  },
  {
    key: 'boarding', label: 'Boarding', icon: Home, view: 'boarding',
    tint: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30',
    match: (v: Visit) => v.encounterType === 'BOARDING' || hasCategory(v, 'board'),
  },
  {
    key: 'inpatient', label: 'Inpatient', icon: BedDouble, view: 'inpatient',
    tint: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30',
    /**
     * ⚠️ An ADMITTED admission, not merely one that exists.
     *
     * This matched on `hospitalizationId` being set, which a discharged patient
     * keeps forever — so the tile read 1 Inpatient while the Inpatient page
     * showed none (user, 2026-08-19: "no inpatient … but here 1"). Prod visit
     * 151 was the culprit: still IN_PROGRESS, but its admission was discharged
     * on 18 Aug. The visit is still open work; it is just no longer inpatient
     * work, and the Consultation tile already counts it.
     */
    match: (v: Visit) => v.hospitalizationId
      // There IS an admission record — it is the authority, and the leftover
      // "Inpatient Stay" charge on a discharged visit must not override it.
      // Visit 151 carries exactly that line; an `||` on the category would have
      // kept counting it after discharge.
      ? v.hospitalizationStatus !== 'DISCHARGED' && v.hospitalizationStatus !== 'CANCELLED'
      // No record to consult — fall back to what the visit was charged for.
      : hasCategory(v, 'inpatient', 'hospital'),
  },
  {
    // No dedicated consultations page — the visits list IS that view.
    key: 'consultation', label: 'Consultation', icon: Stethoscope, view: 'appointments',
    tint: 'text-seafoam bg-seafoam/10',
    match: (v: Visit) => v.encounterType === 'VET_VISIT' || hasCategory(v, 'consult'),
  },
  {
    key: 'surgery', label: 'Surgery', icon: Scissors, view: 'surgery',
    tint: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    match: (v: Visit) => hasCategory(v, 'surg'),
  },
  {
    key: 'grooming', label: 'Grooming', icon: Syringe, view: 'grooming',
    tint: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30',
    match: (v: Visit) => v.encounterType === 'GROOMING' || hasCategory(v, 'groom'),
  },
];

const WorkInProgressStrip: React.FC<Props> = ({ visits, onOpen, range }) => {
  /**
   * Work in progress = STARTED IN RANGE **or** STILL OPEN.
   *
   * ⚠️ Range alone is wrong for anything multi-day. A boarder admitted on the
   * 2nd and still in a kennel on the 6th is this morning's work every one of
   * those days, but `visitsInRange` only matched the day it began — so the
   * Boarding tile read 0 Active while the Boarding page listed the same animal
   * as Day 5 (user, 2026-08-06: "stats not accurate"). Same for inpatient.
   *
   * Only applied when the range IS today: looking back at a past day should
   * show that day, not leak today's still-open cases into it.
   */
  const inRange = visitsInRange(visits, range);
  const showingToday = !range || range.isToday;
  const stillOpen = React.useMemo(() => {
    if (!showingToday) return [];
    const seen = new Set(inRange.map(v => String(v.id)));
    return visits.filter(v => v.status === ApptStatus.IN_PROGRESS && !seen.has(String(v.id)));
  }, [inRange, visits, showingToday]);
  // `today` keeps its old meaning (in-range + carried-over) for the
  // Active/Waiting/Done breakdown below — a boarder from 3 days ago that is
  // still IN_PROGRESS is current work in that category, not stale data.
  const today = React.useMemo(() => [...inRange, ...stillOpen], [inRange, stillOpen]);

  // Reminders due — self-fetched, same pattern StaffDashboard already uses,
  // so this stays a drop-anywhere component (user, 2026-09-22: "show
  // appointments reminders stats too").
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  React.useEffect(() => {
    let alive = true;
    const req = showingToday ? remindersAPI.today() : remindersAPI.list({ scope: 'all' } as any);
    req.then((r: any) => {
      if (!alive || !r?.success || !r.data?.reminders) return;
      const rows = r.data.reminders as Reminder[];
      setReminders(showingToday ? rows : rows.filter(x => inDayRange(range, (x as any).dueAt) && x.status === 'PENDING'));
    }).catch(() => {});
    return () => { alive = false; };
  }, [showingToday, range?.start, range?.end]);
  const overdueReminders = reminders.filter(r => new Date(r.dueAt).getTime() < Date.now()).length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-3">
        {range && !range.isToday ? `Work in progress · ${range.label}` : "Today's work in progress"}
      </p>
      {/* Every card has the same three rows (user, 2026-11-22): the title on
          top, the figures in the middle, a footer line at the bottom — and the
          same size, whether or not it has a footer to show. */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 items-stretch">
        {BLOCKS.map(b => {
          // Started today (or on the picked day) — the number the strip's own
          // title promises. Carried-over (still open from before today) is
          // shown separately so it can never silently inflate "today"'s count
          // again (user, 2026-09-22).
          const startedToday = inRange.filter(b.match);
          const carriedOver = stillOpen.filter(b.match);
          const mine = today.filter(b.match);
          const active = mine.filter(v => v.status === ApptStatus.IN_PROGRESS).length;
          const waiting = mine.filter(v => v.status === ApptStatus.SCHEDULED).length;
          const done = mine.filter(v =>
            v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT).length;
          const tone = SOFT[toneFromClass(b.tint) ?? 'sky'];
          // These counts include visits opened on EARLIER days, so the page they
          // open must not then hide them behind a today-onwards date filter —
          // the tile said 5 and the list it opened said none (user,
          // 2026-08-19). `openOnly` tells the visits list to ignore dates and
          // show every unfinished visit.
          return (
            <WipCard
              key={b.key}
              tone={tone}
              icon={b.icon}
              label={b.label}
              onClick={onOpen ? () => onOpen(b.view, { openOnly: true }) : undefined}
              figures={[
                { value: startedToday.length, label: 'Total', cls: tone.num, big: true },
                { value: active, label: 'Active', cls: 'text-amber-600 dark:text-amber-400' },
                { value: waiting, label: 'Waiting', cls: 'text-slate-500 dark:text-zinc-400' },
                { value: done, label: 'Done', cls: 'text-emerald-600 dark:text-emerald-400' },
              ]}
              footer={carriedOver.length > 0 ? `+${carriedOver.length} more from before today` : 'Nothing carried over'}
              footerMuted={carriedOver.length === 0}
            />
          );
        })}

        {/* Reminders — not a visit, so no Active/Waiting/Done breakdown; just
            what's due and how much of that is already overdue. Same frame. */}
        <WipCard
          tone={SOFT.teal}
          icon={BellRing}
          label="Reminders"
          onClick={onOpen ? () => onOpen('reminders') : undefined}
          figures={[
            { value: reminders.length, label: 'Due', cls: SOFT.teal.num, big: true },
            { value: overdueReminders, label: 'Overdue', cls: overdueReminders ? 'text-rose-500' : 'text-slate-500 dark:text-zinc-400' },
          ]}
          footer={overdueReminders > 0 ? `${overdueReminders} need a call today` : 'All on time'}
          footerMuted={overdueReminders === 0}
        />
      </div>
    </div>
  );
};

export default WorkInProgressStrip;


/** One work-in-progress card: title row, figures row, footer row — fixed frame. */
const WipCard: React.FC<{
  tone: { tile: string; icon: string; num: string; ring: string };
  icon: React.ComponentType<any>;
  label: string;
  onClick?: () => void;
  figures: { value: number; label: string; cls: string; big?: boolean }[];
  footer: string;
  footerMuted?: boolean;
}> = ({ tone, icon: Icon, label, onClick, figures, footer, footerMuted }) => {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, title: `Open ${label}` } : {})}
      className={`h-full min-h-[136px] rounded-2xl border p-3 text-left flex flex-col transition-all ${tone.tile} ${
        onClick ? `hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${tone.ring}` : ''
      }`}
    >
      {/* Top: the title */}
      <span className={`self-start inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${tone.icon}`}>
        <Icon size={11} /> {label}
      </span>
      {/* Middle: the figures, on one baseline in four equal slots */}
      <div className="flex-1 grid grid-cols-4 items-end gap-1 py-3">
        {figures.map(f => (
          <span key={f.label} className="min-w-0">
            <span className={`block ${f.big ? 'text-xl' : 'text-sm'} font-black leading-none tabular-nums ${f.cls}`}>{f.value}</span>
            <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mt-1 truncate">{f.label}</span>
          </span>
        ))}
      </div>
      {/* Bottom: the footer line — always there, so every card is the same size */}
      <p className={`pt-2 border-t border-dashed border-slate-200/70 dark:border-zinc-700 text-[9px] font-bold truncate ${footerMuted ? 'text-slate-300 dark:text-zinc-600' : 'text-slate-500 dark:text-zinc-400'}`}>
        {footer}
      </p>
    </Tag>
  );
};

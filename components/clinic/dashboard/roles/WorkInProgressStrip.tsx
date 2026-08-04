import React from 'react';
import { Home, Stethoscope, Scissors, BedDouble, Syringe } from 'lucide-react';
import { Visit, ApptStatus } from '../../../../types';
import { visitsInRange, hasCategory, DayRange } from './roleShared';

/**
 * "Today's work in progress" — the one strip every role sees, so a groomer and
 * a vet share a picture of what the clinic is actually doing right now.
 *
 * Derived entirely from the visits already in DataContext; no extra fetch.
 */

interface Props {
  visits: Visit[];
  onOpen?: (filter: string) => void;
  /** Day the dashboard is pointed at. Omitted = today (user, 2026-08-04). */
  range?: DayRange;
}

const BLOCKS = [
  {
    key: 'boarding', label: 'Boarding', icon: Home,
    tint: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30',
    match: (v: Visit) => v.encounterType === 'BOARDING' || hasCategory(v, 'board'),
  },
  {
    key: 'inpatient', label: 'Inpatient', icon: BedDouble,
    tint: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30',
    match: (v: Visit) => !!(v as any).hospitalizationId || hasCategory(v, 'inpatient', 'hospital'),
  },
  {
    key: 'consultation', label: 'Consultation', icon: Stethoscope,
    tint: 'text-seafoam bg-seafoam/10',
    match: (v: Visit) => v.encounterType === 'VET_VISIT' || hasCategory(v, 'consult'),
  },
  {
    key: 'surgery', label: 'Surgery', icon: Scissors,
    tint: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    match: (v: Visit) => hasCategory(v, 'surg'),
  },
  {
    key: 'grooming', label: 'Grooming', icon: Syringe,
    tint: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30',
    match: (v: Visit) => v.encounterType === 'GROOMING' || hasCategory(v, 'groom'),
  },
];

const WorkInProgressStrip: React.FC<Props> = ({ visits, onOpen, range }) => {
  const today = visitsInRange(visits, range);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-3">
        {range && !range.isToday ? `Work in progress · ${range.label}` : "Today's work in progress"}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {BLOCKS.map(b => {
          const mine = today.filter(b.match);
          const active = mine.filter(v => v.status === ApptStatus.IN_PROGRESS).length;
          const waiting = mine.filter(v => v.status === ApptStatus.SCHEDULED).length;
          const done = mine.filter(v =>
            v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT).length;
          const Tag: any = onOpen ? 'button' : 'div';
          return (
            <Tag
              key={b.key}
              {...(onOpen ? { type: 'button', onClick: () => onOpen(b.key) } : {})}
              className={`rounded-2xl border border-slate-100 dark:border-zinc-800 p-3 text-left transition-all ${
                onOpen ? 'hover:border-seafoam cursor-pointer' : ''
              }`}
            >
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest mb-2 ${b.tint}`}>
                <b.icon size={11} /> {b.label}
              </span>
              <div className="flex items-end gap-3">
                <span className="min-w-0">
                  <span className="block text-xl font-black leading-none tabular-nums text-pine dark:text-zinc-100">{mine.length}</span>
                  <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Total</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-none tabular-nums text-amber-600 dark:text-amber-400">{active}</span>
                  <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Active</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-none tabular-nums text-slate-400">{waiting}</span>
                  <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Waiting</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-none tabular-nums text-emerald-600 dark:text-emerald-400">{done}</span>
                  <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Done</span>
                </span>
              </div>
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

export default WorkInProgressStrip;

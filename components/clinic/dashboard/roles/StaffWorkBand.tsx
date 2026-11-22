import React from 'react';
import { Users, Search, X, Briefcase } from 'lucide-react';
import { summariesAPI, StaffWork } from '../../../../services/modules/summaries.api';
import { useStaff } from '../../../../contexts/StaffContext';
import { DayRange } from './roleShared';

/**
 * WORK FOR <period> — what a person DID (user, 2026-11-22).
 *
 * The green band used to be clinic-wide conversion figures. It now answers
 * "what did this person get done": visits booked, appointments set, reminders
 * set and worked, visits led and finished, services attended, money collected,
 * bills approved — for today by default, or the picked day / span, and the
 * title says which ("Work for today", "Work for 21 Nov", "Work for 16 – 22 Nov").
 *
 * Owners and managers get a type-to-search staff picker above it ("Whole
 * clinic" by default); everyone else always sees their own work — the server
 * enforces that too, so the picker is a convenience, not the guard.
 */
interface Props {
  scopeId: string | number;
  range: DayRange;
  /** Owner / manager: may pick a person or the whole clinic. */
  canPick?: boolean;
  currency?: string;
}

const Block: React.FC<{ label: string; big: React.ReactNode; sub: React.ReactNode }> = ({ label, big, sub }) => (
  <div className="min-w-0">
    <p className="text-white/55 text-[9px] font-black uppercase tracking-widest leading-none mb-1.5">{label}</p>
    <p className="text-white font-black text-xl leading-tight tabular-nums">{big}</p>
    <p className="text-emerald-200/90 text-[10px] font-bold truncate mt-0.5">{sub}</p>
  </div>
);

const nameOf = (u: any) =>
  u?.name || [u?.profile?.firstName, u?.profile?.surname].filter(Boolean).join(' ') || u?.email || 'Staff';

const StaffWorkBand: React.FC<Props> = ({ scopeId, range, canPick, currency = 'KES' }) => {
  const { staff } = useStaff() as any;
  const [who, setWho] = React.useState<string>(canPick ? 'all' : '');
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<StaffWork | null>(null);

  React.useEffect(() => {
    let alive = true;
    summariesAPI.staffWork({ scopeId, start: range.start, end: range.end, userId: canPick ? who : null }, { silent: true } as any)
      .then(r => { if (alive && r.success && r.data) setData(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId, range.start, range.end, who, canPick]);

  const people = React.useMemo(() => ((staff || []) as any[])
    .map(u => ({ id: String(u.id), name: nameOf(u), role: String(u.role || '').replace(/_/g, ' ').toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name)), [staff]);
  const matches = people.filter(p => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);
  const picked = who === 'all' ? null : people.find(p => p.id === who);

  const period = range.isToday ? 'today' : range.label;
  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;
  const d = data;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 flex items-center gap-1.5">
          <Briefcase size={13} className="text-seafoam" />
          Work for {period}
          <span className="normal-case tracking-normal font-bold text-slate-500 dark:text-zinc-400">
            · {canPick ? (picked ? picked.name : 'whole clinic') : 'you'}
          </span>
        </p>
        {canPick && (
          <div className="relative w-full sm:w-72">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={open ? query : (picked ? picked.name : 'Whole clinic')}
              onChange={e => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => { setQuery(''); setOpen(true); }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Type a staff name…"
              aria-label="Show the work of"
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] font-semibold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
            />
            {picked && (
              <button type="button" onMouseDown={() => { setWho('all'); setQuery(''); }} aria-label="Back to the whole clinic"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500"><X size={13} /></button>
            )}
            {open && (
              <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                <button type="button" onMouseDown={() => { setWho('all'); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[13px] font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                  <Users size={13} className="text-seafoam" /> Whole clinic
                </button>
                {matches.map(p => (
                  <button key={p.id} type="button" onMouseDown={() => { setWho(p.id); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-zinc-800 ${who === p.id ? 'text-seafoam font-black' : 'text-pine dark:text-zinc-100 font-semibold'}`}>
                    {p.name} <span className="text-[11px] font-medium text-slate-400 capitalize">· {p.role}</span>
                  </button>
                ))}
                {matches.length === 0 && <p className="px-3 py-2 text-[12px] text-slate-400">No staff match “{query}”.</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine via-pine to-emerald-950 p-4 md:p-5 shadow-xl">
        <span className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5" />
        {!d ? (
          <div className="h-16 grid place-items-center text-white/50 text-[11px] font-bold">Loading…</div>
        ) : (
          <div className="relative grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-x-5 gap-y-4 items-start">
            <Block label="Visits booked" big={d.visitsBooked} sub="registered at the desk" />
            <Block label="Visits led" big={<>{d.visitsDone}<span className="text-white/40 text-sm"> / {d.visitsLed}</span></>}
              sub={`${d.visitsDone} done · ${d.visitsInProgress} in progress`} />
            <Block label="Appointments set" big={d.appointmentsSet} sub={`${d.appointmentsConverted} became visits`} />
            <Block label="Reminders" big={<>{d.remindersClosed}<span className="text-white/40 text-sm"> / {d.remindersDue}</span></>}
              sub={`${d.remindersSet} set · ${d.remindersConverted} booked`} />
            <Block label="Services attended" big={d.servicesAttended} sub="service lines worked" />
            <Block label="Collected" big={money(d.collected)} sub={`${d.paymentsCount} payment${d.paymentsCount === 1 ? '' : 's'}`} />
            <Block label="Bills approved" big={d.billsApproved} sub="signed off" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffWorkBand;

import React from 'react';
import { Activity } from 'lucide-react';
import { Visit, ApptStatus } from '../../../../types';
import { summariesAPI } from '../../../../services/modules/summaries.api';
import { DayRange, visitsInRange } from './roleShared';

/**
 * MY WORK — the analytics band a staff member was missing (user, 2026-08-04).
 *
 * The owner's dashboard opens with the clinic-wide conversion pulse; every
 * other role got no band at all. This is that band, scoped to the person: what
 * they were involved in and worked on over the picked day/range.
 *
 * Attendance comes from the SAME server rollup the owner's staff-activity card
 * uses (`/summaries/conversions` → `staffTallies`, which spans both attribution
 * tables — encounter-level 172 and service-line 106) so a nurse's number here
 * and the owner's number for them can never disagree.
 *
 * ⚠️ `internalFees` is INTERNAL clinic cost and is never billed to a client.
 * It is shown to the person it belongs to, and labelled.
 */

interface Props {
  visits: Visit[];
  range: DayRange;
  userId?: string | number | null;
  scopeId?: string | number | null;
  /** Greeting-line role label, e.g. "front office". */
  roleLabel?: string;
}

const Block: React.FC<{ label: string; big: React.ReactNode; sub: string }> = ({ label, big, sub }) => (
  <div className="min-w-0">
    <p className="text-white/50 text-[8px] font-black uppercase tracking-widest leading-none mb-1">{label}</p>
    <p className="text-white font-black text-lg leading-tight font-mono">{big}</p>
    <p className="text-seafoam text-[9px] font-bold truncate">{sub}</p>
  </div>
);

const StaffPulse: React.FC<Props> = ({ visits, range, userId, scopeId, roleLabel }) => {
  const [mine, setMine] = React.useState<{ encounters: number; services: number; internalFees: number } | null>(null);

  React.useEffect(() => {
    if (scopeId == null || userId == null) return;
    let alive = true;
    summariesAPI
      .conversions({ scopeId, start: range.start, end: range.end }, { silent: true } as any)
      .then(r => {
        if (!alive || !r.success) return;
        const rows = ((r.data as any)?.staffTallies || []) as any[];
        const row = rows.find(x => String(x.userId) === String(userId));
        setMine(row
          ? { encounters: row.encounters || 0, services: row.services || 0, internalFees: Number(row.internalFees || 0) }
          : { encounters: 0, services: 0, internalFees: 0 });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId, userId, range.start, range.end]);

  // The visit-side view of the same day: what is assigned to this person, from
  // the visits already loaded. `leadStaffId` is the visit's PRIMARY clinician —
  // service-line attendance is what `mine.services` counts.
  const dayVisits = visitsInRange(visits, range);
  const mineVisits = userId != null
    ? dayVisits.filter(v => String((v as any).leadStaffId ?? '') === String(userId))
    : [];
  const done = mineVisits.filter(v =>
    v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT).length;
  const active = mineVisits.filter(v => v.status === ApptStatus.IN_PROGRESS).length;
  const waiting = mineVisits.filter(v => v.status === ApptStatus.SCHEDULED).length;
  const attended = (mine?.encounters ?? 0) + (mine?.services ?? 0);

  const when = range.isToday ? 'today' : range.label.toLowerCase();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine via-pine to-emerald-950 p-4 md:p-5 shadow-xl">
      <Activity size={84} className="absolute -right-3 -top-4 text-white/5" />
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-x-5 gap-y-3 items-end">
        <Block
          label="My visits"
          big={<>{mineVisits.length}<span className="text-white/40 text-sm"> / {dayVisits.length}</span></>}
          sub={`assigned to me · ${when}`}
        />
        <Block label="Done" big={done} sub={`${active} in progress`} />
        <Block label="Waiting on me" big={waiting} sub={waiting ? 'not started yet' : 'nothing queued'} />
        <Block
          label="Attended"
          big={mine === null ? '—' : attended}
          sub={mine === null ? 'loading…' : `${mine.encounters} encounter${mine.encounters === 1 ? '' : 's'} · ${mine.services} service line${mine.services === 1 ? '' : 's'}`}
        />
        <Block
          label="My internal fees"
          big={mine === null ? '—' : Math.round(mine.internalFees).toLocaleString()}
          sub="clinic cost · never billed"
        />
      </div>
      {roleLabel && (
        <p className="relative z-10 mt-3 text-white/40 text-[9px] font-bold uppercase tracking-widest">
          Your {roleLabel} activity · {when}
        </p>
      )}
    </div>
  );
};

export default StaffPulse;

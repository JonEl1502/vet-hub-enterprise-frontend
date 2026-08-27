import React, { useCallback, useEffect, useState } from 'react';
import {
  Users, CalendarOff, CalendarDays, UserCheck, Loader2, AlertTriangle,
  BadgeCheck, ShieldAlert, Briefcase,
} from 'lucide-react';
import PageHeader from '../../shared/common/PageHeader';
import { hrAPI, HrOverview } from '../../../services/modules/hr.api';
import { Card, Stat, Pill, Empty, prettyDate, titleCase, EMPLOYMENT_TONE } from './hrShared';
import HrPeopleTab from './HrPeopleTab';
import HrLeaveTab from './HrLeaveTab';
import HrRotaTab from './HrRotaTab';
import HrAttendanceTab from './HrAttendanceTab';

type Tab = 'overview' | 'people' | 'leave' | 'rota' | 'attendance';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',   label: 'Overview',   icon: Briefcase },
  { id: 'people',     label: 'People',     icon: Users },
  { id: 'leave',      label: 'Leave',      icon: CalendarOff },
  { id: 'rota',       label: 'Rota',       icon: CalendarDays },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
];

/**
 * HR — Clinic Management ▸ HR.
 *
 * Four surfaces over one clinic's staff: the employment file, leave, the rota,
 * and attendance. Manager-and-above throughout; pay is narrower still (owner
 * only) and enforced server-side — see hr.controller.
 *
 * Payroll is deliberately absent. It writes real money and belongs to the S1
 * lane with statutory rates the user has to sign off; phase 2.
 */
const HrView: React.FC<{ initialTab?: Tab }> = ({ initialTab = 'overview' }) => {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-5">
      <PageHeader
        title="HR"
        subtitle="Employment, leave, rota and attendance"
        icon={Briefcase}
      />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              tab === t.id
                ? 'bg-seafoam text-white'
                : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100'
            }`}>
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview onGo={setTab} />}
      {tab === 'people' && <HrPeopleTab />}
      {tab === 'leave' && <HrLeaveTab />}
      {tab === 'rota' && <HrRotaTab />}
      {tab === 'attendance' && <HrAttendanceTab />}
    </div>
  );
};

const Overview: React.FC<{ onGo: (t: Tab) => void }> = ({ onGo }) => {
  const [data, setData] = useState<HrOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    hrAPI.overview()
      .then(r => setData(r.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;
  if (!data) return <Empty icon={Briefcase} title="HR could not load" hint="Try again in a moment." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Headcount" value={data.headcount} hint="Attached to this clinic" />
        <Stat label="On duty today" value={data.onDutyToday} hint="Rostered shifts" />
        <Stat label="Off today" value={data.offToday.length}
          tone={data.offToday.length ? 'text-violet-500' : undefined} hint="Approved leave" />
        <Stat label="Awaiting decision" value={data.pendingLeave}
          tone={data.pendingLeave ? 'text-amber-600' : undefined} hint="Leave requests" />
      </div>

      {/* The gap between "attached to the clinic" and "has an employment file"
          is the actionable number on this page — it is what HR still has to do. */}
      {data.missingRecord > 0 && (
        <Card className="p-4 border-amber-300 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                  {data.missingRecord} {data.missingRecord === 1 ? 'person has' : 'people have'} no employment file
                </p>
                <p className="text-[10px] font-bold text-amber-700/90 dark:text-amber-400/90">
                  They can work and be rostered — but there is no contract, no next of kin and nothing for payroll to read.
                </p>
              </div>
            </div>
            <button onClick={() => onGo('people')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-600 text-white hover:bg-amber-700 transition-all">
              Open People
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
        <Card className="p-4 flex flex-col">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Employment status</p>
          {Object.keys(data.byStatus).length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400">No employment files yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.byStatus).map(([s, n]) => (
                <div key={s} className="flex items-center justify-between">
                  <Pill tone={EMPLOYMENT_TONE[s as keyof typeof EMPLOYMENT_TONE] ?? 'slate'}>{titleCase(s)}</Pill>
                  <span className="text-[11px] font-black font-mono text-pine dark:text-zinc-100">{n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 flex flex-col">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Off today</p>
          {data.offToday.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400">Everyone is in.</p>
          ) : (
            <div className="space-y-2">
              {data.offToday.map(o => (
                <div key={o.userId} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{o.name}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-violet-500 shrink-0">
                    {o.leaveType} · back {prettyDate(o.endsOn, { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 flex flex-col">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Next 30 days
          </p>
          <div className="space-y-2">
            {data.probationEnding.map(p => (
              <div key={`p-${p.userId}`} className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{p.name}</span>
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 shrink-0">
                  Probation ends {prettyDate(p.probationEndsOn, { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
            {/* Certifications live on the staff profile; a lapsed practising
                licence is the CLINIC's risk, so it is surfaced here too. */}
            {data.expiringCertifications.map((c, i) => (
              <div key={`c-${c.userId}-${i}`} className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{c.name}</span>
                <span className="text-[9px] font-black uppercase tracking-wider text-rose-500 shrink-0 flex items-center gap-1">
                  <BadgeCheck size={9} /> {c.certification} expires {prettyDate(c.expiresAt, { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
            {data.probationEnding.length === 0 && data.expiringCertifications.length === 0 && (
              <p className="text-[10px] font-bold text-slate-400">Nothing expiring or ending.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HrView;

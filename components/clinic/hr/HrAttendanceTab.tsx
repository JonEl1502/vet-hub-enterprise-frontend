import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserCheck, Loader2, ChevronLeft, ChevronRight, Check, X, FileSpreadsheet } from 'lucide-react';
import { hrAPI, HrAttendanceRow, HrTimesheetRow, HrAttendanceStatus } from '../../../services/modules/hr.api';
import {
  Card, Empty, Field, INPUT, BTN_PRIMARY, BTN_GHOST, Pill, PersonChip,
  ATTENDANCE_TONE, titleCase, prettyDate, prettyTime, hoursMins, today, addDays, isoDay,
} from './hrShared';

const STATUSES: HrAttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'OFF_DUTY'];

/**
 * HR ▸ Attendance — one day at a time, plus a timesheet for a window.
 *
 * The day list is built from everyone attached to the clinic, so the people
 * with no row yet are visible: they are precisely who somebody still has to
 * mark. A blank row is the work, not an omission.
 */
const HrAttendanceTab: React.FC = () => {
  const [pane, setPane] = useState<'day' | 'timesheet'>('day');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800">
        {(['day', 'timesheet'] as const).map(p => (
          <button key={p} type="button" onClick={() => setPane(p)}
            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
              pane === p ? 'bg-seafoam text-white' : 'bg-white dark:bg-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}>
            {p === 'day' ? 'By day' : 'Timesheet'}
          </button>
        ))}
      </div>
      {pane === 'day' ? <ByDay /> : <Timesheet />}
    </div>
  );
};

const ByDay: React.FC = () => {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<HrAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    hrAPI.attendance(date)
      .then(r => setRows(r.data?.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);
  useEffect(load, [load]);

  /**
   * Clock someone in or out right now.
   *
   * ⚠️ Sends a full ISO instant, not a time-of-day. The server measures
   * lateness against the rostered start and needs a real point in time to do
   * it; a bare "09:15" would be read in the server's timezone, not the
   * clinic's.
   */
  const stamp = async (row: HrAttendanceRow, which: 'in' | 'out') => {
    setBusyId(row.userId);
    try {
      const now = new Date().toISOString();
      await hrAPI.markAttendance(row.userId, {
        workDate: date,
        clockIn: which === 'in' ? now : (row.attendance?.clockIn ?? now),
        ...(which === 'out' ? { clockOut: now } : {}),
      });
      toast.success(which === 'in' ? 'Clocked in' : 'Clocked out');
      load();
    } finally { setBusyId(null); }
  };

  const setStatus = async (row: HrAttendanceRow, status: HrAttendanceStatus) => {
    setBusyId(row.userId);
    try {
      await hrAPI.markAttendance(row.userId, {
        workDate: date, status,
        clockIn: row.attendance?.clockIn ?? null,
        clockOut: row.attendance?.clockOut ?? null,
      });
      load();
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        <button className={BTN_GHOST} onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={12} /></button>
        <input type="date" className={`${INPUT} max-w-[150px]`} value={date} onChange={e => setDate(e.target.value)} />
        <button className={BTN_GHOST} onClick={() => setDate(addDays(date, 1))}><ChevronRight size={12} /></button>
        {date !== today() && <button className={BTN_GHOST} onClick={() => setDate(today())}>Today</button>}
      </div>

      {loading ? <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      : rows.length === 0 ? <Empty icon={UserCheck} title="No staff" />
      : (
        <div className="space-y-2">
          {rows.map(r => {
            const a = r.attendance;
            return (
              <Card key={r.userId} className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <PersonChip name={r.name} url={r.avatarUrl}
                    sub={r.scheduled ? `Rostered ${r.scheduled.startsAt}–${r.scheduled.endsAt}` : 'Not rostered'} />

                  <div className="flex flex-wrap items-center gap-2">
                    {r.onLeave && <Pill tone="violet">On {r.onLeave.toLowerCase()}</Pill>}
                    {a && (
                      <>
                        <Pill tone={ATTENDANCE_TONE[a.status]}>{titleCase(a.status)}</Pill>
                        <span className="text-[9px] font-mono text-slate-500 dark:text-zinc-400">
                          {prettyTime(a.clockIn)} → {prettyTime(a.clockOut)}
                          {a.minutesWorked ? ` · ${hoursMins(a.minutesWorked)}` : ''}
                          {a.lateMinutes ? ` · ${a.lateMinutes}m late` : ''}
                        </span>
                      </>
                    )}
                    {!a && <Pill tone="slate">Not marked</Pill>}

                    {!a?.clockIn && (
                      <button className={BTN_PRIMARY} disabled={busyId === r.userId} onClick={() => stamp(r, 'in')}>
                        {busyId === r.userId ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Clock in
                      </button>
                    )}
                    {a?.clockIn && !a.clockOut && (
                      <button className={BTN_GHOST} disabled={busyId === r.userId} onClick={() => stamp(r, 'out')}>
                        <X size={11} /> Clock out
                      </button>
                    )}
                    <select className={`${INPUT} max-w-[130px]`} value={a?.status ?? ''}
                      onChange={e => e.target.value && setStatus(r, e.target.value as HrAttendanceStatus)}>
                      <option value="">Mark as…</option>
                      {STATUSES.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}
                    </select>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Timesheet: React.FC = () => {
  const [to, setTo] = useState(today());
  const [from, setFrom] = useState(() => addDays(today(), -29));
  const [rows, setRows] = useState<HrTimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    hrAPI.timesheet(from, to)
      .then(r => setRows(r.data?.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="From"><input type="date" className={`${INPUT} max-w-[150px]`} value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={`${INPUT} max-w-[150px]`} value={to} min={from} onChange={e => setTo(e.target.value)} /></Field>
      </div>

      {loading ? <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      : rows.length === 0 ? (
        <Empty icon={FileSpreadsheet} title="Nothing recorded"
          hint="No attendance was marked in this window. Mark a day under “By day” and it will total up here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800">
                <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Staff</th>
                {['Present', 'Late', 'Absent', 'On leave', 'Hours', 'Late mins'].map(h => (
                  <th key={h} className="text-right px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.userId} className="border-b border-slate-100 dark:border-zinc-800/60">
                  <td className="px-3 py-2"><PersonChip name={r.name} url={r.avatarUrl} /></td>
                  <td className="px-3 py-2 text-right text-[10px] font-black font-mono text-emerald-600">{r.daysPresent}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-mono text-amber-600">{r.daysLate || '—'}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-mono text-rose-500">{r.daysAbsent || '—'}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-mono text-violet-500">{r.daysOnLeave || '—'}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-black font-mono text-pine dark:text-zinc-100">{r.hoursWorked || '—'}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-mono text-slate-400">{r.lateMinutes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[9px] font-bold text-slate-400">
            Hours are worked time with the rostered break already deducted. A day with no clock-out counts zero hours,
            not "still running" — {prettyDate(from)} to {prettyDate(to)}.
          </p>
        </div>
      )}
    </div>
  );
};

export default HrAttendanceTab;

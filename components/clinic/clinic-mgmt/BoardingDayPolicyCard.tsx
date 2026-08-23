import React, { useState, useEffect } from 'react';
import { CalendarClock, Loader2, Check } from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';

/**
 * When a boarding / in-patient DAY starts and ends (migration 222).
 *
 * Until now a billable day was hard-coded to the local calendar date: the
 * boundary was midnight, so a pet collected at 00:30 was charged for a whole
 * extra day and one collected at 23:30 was not. Real kennels run a morning-to-
 * morning day — the user's example is 08:00 to 07:59 (2026-08-23).
 *
 * ⚠️ `preview()` deliberately duplicates the server's `computeNights` rule, the
 * same way LateFeePolicyCard mirrors `computeLateFee`. If the arithmetic in
 * `src/utils/stayBilling.ts` changes, change it here too — a preview that
 * disagrees with the invoice is worse than none, because staff set the policy
 * off this number.
 */

type Mode = 'CALENDAR' | 'ELAPSED';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => `${pad(h)}:00`);

const BoardingDayPolicyCard: React.FC = () => {
  const { selectedClinics, updateClinic } = useClinic();
  const clinic: any = selectedClinics[0] ?? null;

  const [dayStart, setDayStart] = useState('00:00');
  const [mode, setMode] = useState<Mode>('CALENDAR');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!clinic) return;
    setDayStart(clinic.boardingDayStart || '00:00');
    setMode((clinic.boardingDayMode as Mode) || 'CALENDAR');
  }, [clinic?.id, clinic?.boardingDayStart, clinic?.boardingDayMode]);

  if (!clinic) return null;

  const startMins = (() => {
    const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(dayStart);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  })();
  const endLabel = (() => {
    const e = (startMins + 24 * 60 - 1) % (24 * 60);
    return `${pad(Math.floor(e / 60))}:${pad(e % 60)}`;
  })();

  /**
   * Mirrors the server's `computeNights` exactly.
   *
   * ⚠️ The examples below are built with `Date.UTC`, i.e. as CLINIC WALL-CLOCK
   * milliseconds rather than real instants. The server computes the day index
   * as `floor((utcMs + clinicOffset - dayStart) / 86_400_000)`; feeding it
   * wall-clock ms makes the offset cancel out, so this preview is correct in
   * any viewer's timezone. Building the dates with `new Date(y, m, d, h)`
   * instead — the obvious way — silently shifts every example by the browser's
   * own offset and would have shown Nairobi staff the wrong day count.
   */
  const preview = (inMs: number, outMs: number): number => {
    if (mode === 'ELAPSED') return Math.max(1, Math.ceil((outMs - inMs) / 86_400_000));
    const idx = (ms: number) => Math.floor((ms - startMins * 60_000) / 86_400_000);
    return Math.max(1, idx(outMs) - idx(inMs));
  };

  // Dropped off Monday 10:00. These three pickups are chosen because they are
  // the ones the setting actually CHANGES — an example that reads the same
  // under every option teaches nothing.
  const base = Date.UTC(2026, 7, 3, 10, 0);
  const EXAMPLES: { label: string; out: number }[] = [
    { label: 'Out Tue 07:00', out: Date.UTC(2026, 7, 4, 7, 0) },
    { label: 'Out Wed 07:00', out: Date.UTC(2026, 7, 5, 7, 0) },
    { label: 'Out Wed 09:00', out: Date.UTC(2026, 7, 5, 9, 0) },
  ];

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateClinic(clinic.id, { boardingDayStart: dayStart, boardingDayMode: mode } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* updateClinic surfaces its own error */ }
    finally { setSaving(false); }
  };

  const changed = dayStart !== (clinic.boardingDayStart || '00:00')
    || mode !== ((clinic.boardingDayMode as Mode) || 'CALENDAR');

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="p-1.5 bg-sky-500 text-white rounded-lg shadow-md"><CalendarClock size={16} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Boarding Day</h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            When one billable day ends and the next begins. Applies to boarding stays and in-patient
            admissions alike. Every stay bills at least one day.
          </p>
        </div>
        <span className="shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400">
          {mode === 'ELAPSED' ? '24h blocks' : `${dayStart} – ${endLabel}`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">How days are counted</label>
          <select value={mode} onChange={e => setMode(e.target.value as Mode)} className="field-select">
            <option value="CALENDAR">Day windows crossed</option>
            <option value="ELAPSED">24-hour blocks from drop-off</option>
          </select>
          <p className="mt-1 text-[9px] text-slate-400">
            {mode === 'CALENDAR'
              ? 'Counts how many day windows the stay touches, whatever the clock says.'
              : 'Counts started 24-hour blocks from the exact drop-off time. The day-start below is ignored.'}
          </p>
        </div>
        <div>
          <label className="field-label">A day starts at</label>
          <select
            value={dayStart}
            onChange={e => setDayStart(e.target.value)}
            className="field-select"
            disabled={mode === 'ELAPSED'}
          >
            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <p className="mt-1 text-[9px] text-slate-400">
            {mode === 'ELAPSED'
              ? 'Not used in 24-hour-block mode.'
              : `So a day runs ${dayStart} to ${endLabel} the next morning.`}
          </p>
        </div>
      </div>

      {/* Worked example — the same three stays, priced by the current setting. */}
      <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 p-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
          Dropped off Monday 10:00 — days billed
        </p>
        <div className="grid grid-cols-3 gap-2">
          {EXAMPLES.map(ex => {
            const n = preview(base, ex.out);
            return (
              <div key={ex.label} className="text-center">
                <p className="text-[9px] font-bold text-slate-400">{ex.label}</p>
                <p className="text-sm font-black font-mono text-pine dark:text-zinc-100">
                  {n} day{n === 1 ? '' : 's'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Changing this re-prices stays that are STILL RUNNING. Say so before
          they save, not after a client queries their bill. */}
      {changed && (
        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-tight">
          Heads up: this changes what open stays will be billed at checkout. Stays already checked out
          and billed keep their existing charge.
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || !changed}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-pine hover:bg-pine/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default BoardingDayPolicyCard;

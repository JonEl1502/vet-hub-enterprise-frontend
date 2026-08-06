import React, { useState, useEffect } from 'react';
import { Clock, Loader2, Check } from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';

/**
 * Clinic-wide late-collection policy (migration 190).
 *
 * The charge itself has been enforced since 190 — `computeLateFee` on the
 * server bills it at checkout — but the three columns were only settable by
 * SQL. This is where a clinic sets them.
 *
 * ⚠️ `preview()` below deliberately duplicates the server's `computeLateFee`
 * arithmetic (grace first, then STARTED hours). If that rule ever changes,
 * change it here too — a preview that disagrees with the invoice is worse than
 * no preview, because staff price the policy off this number.
 */

type Mode = 'PER_HOUR' | 'FLAT';

const EXAMPLES = [30, 75, 200]; // minutes late, for the worked example row

const LateFeePolicyCard: React.FC = () => {
  const { selectedClinics, updateClinic } = useClinic();
  const clinic: any = selectedClinics[0] ?? null;
  const currency = clinic?.currency || 'KES';

  const [grace, setGrace] = useState('');
  const [mode, setMode] = useState<Mode>('PER_HOUR');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-seed whenever the clinic (or its saved policy) changes — this card is
  // mounted alongside the rate editors, which save through the same context.
  useEffect(() => {
    if (!clinic) return;
    setGrace(clinic.lateGraceMins != null ? String(clinic.lateGraceMins) : '');
    setMode((clinic.lateFeeMode as Mode) || 'PER_HOUR');
    setAmount(clinic.lateFeeAmount != null ? String(clinic.lateFeeAmount) : '');
  }, [clinic?.id, clinic?.lateGraceMins, clinic?.lateFeeMode, clinic?.lateFeeAmount]);

  if (!clinic) return null;

  const amt = Number(amount) || 0;
  const graceMins = Math.max(0, Number(grace) || 0);
  const active = amt > 0;

  /** Mirrors server `computeLateFee`: grace is free, the rest bills in started hours. */
  const preview = (lateMins: number): number => {
    if (!active) return 0;
    const billable = lateMins - graceMins;
    if (billable <= 0) return 0;
    return mode === 'FLAT' ? amt : Math.ceil(billable / 60) * amt;
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateClinic(clinic.id, {
        lateGraceMins: grace.trim() === '' ? null : graceMins,
        // Clearing the amount is how a clinic turns the policy OFF, so the mode
        // goes with it — leaving a stale mode behind would make the row look
        // configured in the DB when nothing is charged.
        lateFeeAmount: amount.trim() === '' ? null : amt,
        lateFeeMode: amount.trim() === '' ? null : mode,
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* updateClinic surfaces its own error */ }
    finally { setSaving(false); }
  };

  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-md"><Clock size={16} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Late Collection</h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            What a client owes for collecting after the expected pickup time. Applied automatically at boarding
            checkout and in-patient discharge. Leave the fee blank for no late charge.
          </p>
        </div>
        <span className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
          active
            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
            : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
        }`}>
          {active ? 'On' : 'Off'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="field-label">Grace period (minutes)</label>
          <input
            type="number" min="0" value={grace} onChange={e => setGrace(e.target.value)}
            placeholder="0" className="field-input"
          />
          <p className="mt-1 text-[9px] text-slate-400">Free minutes past pickup. Not billed at all.</p>
        </div>
        <div>
          <label className="field-label">Charge</label>
          <select value={mode} onChange={e => setMode(e.target.value as Mode)} className="field-select">
            <option value="PER_HOUR">Per hour late</option>
            <option value="FLAT">One flat fee</option>
          </select>
          <p className="mt-1 text-[9px] text-slate-400">
            {mode === 'PER_HOUR' ? 'Counts started hours after grace.' : 'Charged once, however late.'}
          </p>
        </div>
        <div>
          <label className="field-label">Amount ({currency})</label>
          <input
            type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="—" className="field-input"
          />
          <p className="mt-1 text-[9px] text-slate-400">Blank = no late fee.</p>
        </div>
      </div>

      {/* Worked example — staff set the number by seeing what it does to a bill. */}
      <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 p-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
          What a client would pay
        </p>
        <div className="grid grid-cols-3 gap-2">
          {EXAMPLES.map(m => {
            const v = preview(m);
            const h = Math.floor(m / 60);
            const mm = m % 60;
            return (
              <div key={m} className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">
                  {h > 0 ? `${h}h ${mm}m` : `${mm}m`} late
                </p>
                <p className={`text-sm font-black tabular-nums truncate ${
                  v > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-600'
                }`}>
                  {v > 0 ? fmt(v) : 'No charge'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button" onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save policy'}
        </button>
      </div>
    </div>
  );
};

export default LateFeePolicyCard;

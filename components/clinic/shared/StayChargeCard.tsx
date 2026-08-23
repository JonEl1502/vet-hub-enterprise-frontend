import React, { useMemo, useState } from 'react';
import { Calculator, Loader2, RotateCcw, Pencil, Check, X } from 'lucide-react';
import { dialog } from '../../../services/utils/dialog';

/**
 * What a stay is charging, why, and how to change it (2026-08-23).
 *
 * The stay total was DERIVED and invisible: days × rate happened server-side at
 * checkout and the page only ever showed the result. When it came out wrong —
 * an admission where nobody set a rate discharges at KES 0 — there was no way
 * to see which input was missing, and no way to fix it, because discharging had
 * already closed the visit (user, 2026-08-23: *"shouldnt the boarding or
 * inpatient the auto calculated from dates and allow edit n buton to auto calca
 * which uses current charge but user can click to edit"*).
 *
 * So this card shows the working — days from the dates, the rate in force, and
 * the product — and offers the two actions that were missing:
 *   **Recalculate** re-runs the auto-calculation with the CURRENT rate.
 *   **Edit rate** overrides the rate the stay is priced at.
 *
 * ⚠️ Editing the RATE, not the total. The total is derived from dates × rate,
 * and a hand-typed total would be silently re-derived away the next time
 * anything recalculated — a number the clinic set, quietly overwritten. Change
 * an input and the total follows; that is the difference between an override
 * that holds and one that looks like it did.
 */

interface Props {
  /** Days the stay spans, already computed by the caller's own rule. */
  days: number;
  /** Rate per day currently in force (stay's own, or the clinic default). */
  rate: number;
  /** Where that rate came from, for the "using clinic default" note. */
  rateSource: 'record' | 'clinic' | 'none';
  /** Food + consumables, shown so the card totals what the header totals. */
  extras: number;
  currency?: string;
  /** Closed records are read-only until reopened. */
  locked: boolean;
  lockedReason?: string;
  onSaveRate: (rate: number) => Promise<void>;
  /**
   * Re-run the server's auto-calculation onto the bill.
   *
   * Receives the rate the card is DISPLAYING. That matters when the rate shown
   * is the clinic default: the server only charges what is stored on the
   * record, so recalculating without pinning this number first wrote nothing
   * and the button looked broken (user, 2026-08-23: *"recalc doesnt update the
   * top figure"*). The handler pins it, so what you see is what is billed.
   */
  onRecalculate: (effectiveRate: number) => Promise<void>;
}

const StayChargeCard: React.FC<Props> = ({
  days, rate, rateSource, extras, currency = 'KES', locked, lockedReason, onSaveRate, onRecalculate,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'save' | 'calc' | null>(null);

  const stayTotal = useMemo(() => days * rate, [days, rate]);
  const money = (n: number) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const startEdit = () => { setDraft(rate ? String(rate) : ''); setEditing(true); };

  const save = async () => {
    const v = Number(draft);
    if (!Number.isFinite(v) || v < 0) {
      await dialog.alert({ title: 'Invalid rate', message: 'Enter a rate of 0 or more.' });
      return;
    }
    setBusy('save');
    try { await onSaveRate(v); setEditing(false); } finally { setBusy(null); }
  };

  const recalc = async () => {
    setBusy('calc');
    try { await onRecalculate(rate); } finally { setBusy(null); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500"><Calculator size={14} /></span>
        <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Stay charge</h3>
        {rateSource === 'clinic' && (
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Clinic default rate
          </span>
        )}
        {rateSource === 'none' && (
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-rose-500">
            No rate set
          </span>
        )}
      </div>

      {/* The working, not just the answer. */}
      <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 p-3">
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
          <span>{days} day{days === 1 ? '' : 's'} from the stay dates</span>
          <span>×</span>
          {editing ? (
            <span className="flex items-center gap-1.5">
              <input
                type="number" min="0" step="0.01" autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                className="w-24 px-2 py-1 rounded-lg border border-seafoam bg-white dark:bg-zinc-900 text-[11px] font-mono font-black text-pine dark:text-zinc-100 outline-none"
              />
              <button onClick={save} disabled={busy === 'save'} className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10" title="Save rate">
                {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button onClick={() => setEditing(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800" title="Cancel">
                <X size={13} />
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="font-mono font-black text-pine dark:text-zinc-100">{money(rate)}</span>
              {!locked && (
                <button onClick={startEdit} className="p-1 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800" title="Edit the daily rate">
                  <Pencil size={12} />
                </button>
              )}
            </span>
          )}
        </div>
        <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stay</span>
          <span className="text-sm font-black font-mono text-pine dark:text-zinc-100">{money(stayTotal)}</span>
        </div>
        {extras > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Food &amp; items</span>
              <span className="text-[11px] font-bold font-mono text-slate-500 dark:text-zinc-400">{money(extras)}</span>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
              <span className="text-sm font-black font-mono text-pine dark:text-zinc-100">{money(stayTotal + extras)}</span>
            </div>
          </>
        )}
      </div>

      {locked ? (
        <p className="text-[10px] font-bold text-slate-400 leading-tight">
          {lockedReason || 'This record is closed. Reopen it to change the charge.'}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-bold text-slate-400 leading-tight flex-1">
            Recalculate rewrites the charge on the visit using the dates and the rate above.
          </p>
          <button
            onClick={recalc}
            disabled={busy === 'calc' || rate <= 0}
            title={rate <= 0 ? 'Set a daily rate first — recalculating at 0 would bill nothing' : undefined}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-pine hover:bg-pine/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            {busy === 'calc' ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Recalculate
          </button>
        </div>
      )}
    </div>
  );
};

export default StayChargeCard;

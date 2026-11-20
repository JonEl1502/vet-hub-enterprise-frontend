import React, { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { toast } from '../../../services';
import { trialAPI } from '../../../services/modules/trial.api';
import { subscriptionPackagesAPI } from '../../../services/modules/subscriptionPackages.api';
import { fitsOwner } from '../subscriptions/RecordPaidSubscriptionDialog';

/**
 * 328 — COMPLIMENTARY PLAN for one clinic.
 *
 * The ordinary free trial stays what 327 made it (the entry plan's features,
 * everything else locked). Here an admin can instead give ONE clinic a chosen
 * plan for a set number of days — "Enterprise for a month" (user, 2026-11-20).
 * The clinic then reads "Complimentary Enterprise — N days left" instead of
 * "Free trial", and nothing is charged.
 *
 * Ending it early keeps the same end date and drops back to the normal trial,
 * so the clinic doesn't lose access the moment it is switched off.
 */
interface Props {
  clinicId: string;
  clinicName: string;
  currency: string;
  shell: string | null;
  trialEndsAt: string | null;
  complimentary: { packageId: string; name: string } | null;
  onChanged: () => void;
}

const DAY = 86_400_000;
const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const ComplimentaryTrialCard: React.FC<Props> = ({ clinicId, clinicName, currency, shell, trialEndsAt, complimentary, onChanged }) => {
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [packageId, setPackageId] = useState('');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<null | 'give' | 'end'>(null);

  useEffect(() => {
    let alive = true;
    subscriptionPackagesAPI.list()
      .then((r) => {
        if (!alive || !r.success) return;
        // Plans only (no trials, no add-ons) that fit this clinic's persona.
        const all = (r.data?.packages ?? []).filter((p: any) =>
          p.isActive !== false && !p.isTrial && !p.isAddon && fitsOwner(p, 'CLINIC', shell));
        // One row per plan name, preferring the clinic's own currency.
        const byName = new Map<string, any>();
        for (const p of all) {
          const had = byName.get(p.name);
          if (!had || (had.currency !== currency && p.currency === currency)) byName.set(p.name, p);
        }
        // Biggest plan first, so Enterprise is the default pick.
        const list = Array.from(byName.values())
          .sort((a, b) => (Number(b.tier ?? 0) - Number(a.tier ?? 0)) || (Number(b.price ?? b.amount ?? 0) - Number(a.price ?? a.amount ?? 0)))
          .map((p) => ({ id: String(p.id), name: String(p.name) }));
        setPlans(list);
        setPackageId((cur) => cur || complimentary?.packageId || list[0]?.id || '');
      })
      .catch(() => { /* picker stays empty */ });
    return () => { alive = false; };
  }, [currency, shell, complimentary?.packageId]);

  const left = trialEndsAt ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / DAY) : 0;
  const live = !!complimentary && left > 0;
  const n = Math.floor(Number(days));
  const valid = Number.isFinite(n) && n > 0 && n <= 3650 && !!packageId;
  const planName = plans.find((p) => p.id === packageId)?.name ?? 'this plan';

  const run = async (mode: 'give' | 'end') => {
    setBusy(true);
    try {
      const res = mode === 'give'
        ? await trialAPI.set({ entity: 'clinic', entityId: clinicId, days: n, complimentaryPackageId: packageId })
        : await trialAPI.set({ entity: 'clinic', entityId: clinicId, days: Math.max(left, 0) || null, complimentaryPackageId: null });
      if (res.success) {
        toast.success(mode === 'give' ? `${clinicName} has complimentary ${planName} for ${n} days` : `${clinicName} is back on the normal trial`);
        setConfirming(null);
        onChanged();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not update the trial');
    } finally {
      setBusy(false);
    }
  };

  const field = 'px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm font-bold text-pine dark:text-zinc-100 outline-none';

  return (
    <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
      <div className="flex items-center gap-2">
        <Gift size={14} className="text-seafoam" />
        <p className="text-xs font-black text-pine dark:text-zinc-100">Complimentary plan</p>
        {live && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-seafoam/15 text-seafoam text-[9px] font-black uppercase tracking-widest">
            {complimentary!.name} · {left}d left
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
        {live
          ? `${complimentary!.name} is free until ${fmt(new Date(trialEndsAt!))}. The clinic sees "Complimentary ${complimentary!.name}" instead of "Free trial".`
          : 'Give this clinic a plan free for a set time, instead of the normal trial. Nothing is charged.'}
      </p>

      {confirming === null && (
        <>
          <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className={`w-full ${field}`} aria-label="Plan to give">
            {plans.length === 0 && <option value="">Loading plans…</option>}
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex gap-2">
            <label className={`flex items-center gap-1.5 flex-1 ${field}`}>
              <input
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full bg-transparent outline-none"
                aria-label="Days"
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">days</span>
            </label>
            <button
              onClick={() => setConfirming('give')}
              disabled={!valid || busy}
              className="px-3 py-1.5 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              {live ? 'Update' : 'Give'}
            </button>
          </div>
          {live && (
            <button
              onClick={() => setConfirming('end')}
              disabled={busy}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest"
            >
              End complimentary plan
            </button>
          )}
        </>
      )}

      {confirming && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-pine dark:text-zinc-100">
            {confirming === 'give'
              ? `Give ${clinicName} ${planName} free until ${fmt(new Date(Date.now() + n * DAY))}?`
              : `End complimentary ${complimentary?.name ?? ''} for ${clinicName}? They keep the normal trial until the same date.`}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(null)} disabled={busy} className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest">Cancel</button>
            <button onClick={() => run(confirming)} disabled={busy} className="flex-1 px-3 py-2 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />} Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplimentaryTrialCard;

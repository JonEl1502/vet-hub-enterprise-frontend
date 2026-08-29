import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';
import { isOpenEndedTrial, trialDaysLeft } from '../../../services/entitlements';

/**
 * The supplier's plan, in one line.
 *
 * Deliberately the SAME treatment as the clinic's `TrialBanner` — slim, full
 * width, a check or a warning, one sentence, and a button only when there is
 * something to convert. The supplier side had a three-card onboarding strip
 * carrying this instead, which made "subscribe" shout twice on one screen and
 * still never mentioned that a new supplier is on a 40-day trial.
 *
 * ⚠️ NOT a copy of TrialBanner. That one self-fetches `/stripe/info` for a
 * CLINIC. A supplier's entitlements come from a different table with a
 * different key vocabulary, and are already resolved in `usePlanAccess`. What
 * is shared is the visual language, not the data path.
 */

interface Props {
  onChoosePlan?: () => void;
  className?: string;
}

const SupplierPlanBanner: React.FC<Props> = ({ onChoosePlan, className = '' }) => {
  const { access, loading } = usePlanAccess();

  // Nothing while we do not know — a banner that flips from "expired" to
  // "trial" a second after load is worse than a beat of silence.
  if (loading || !access) return null;

  const days = trialDaysLeft(access);
  const openEnded = isOpenEndedTrial(days);

  if (access.state === 'TRIAL') {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ${className}`}
      >
        <CheckCircle2 size={16} className="flex-shrink-0" />
        <p className="text-sm font-bold flex-1">
          {openEnded || days == null
            ? 'Complimentary access — no expiry date.'
            : `Free trial — ${days} day${days === 1 ? '' : 's'} left.`}
        </p>
        {/* Nothing is running out, so there is nothing to convert. Offering
            "Choose plan" beside open-ended access invites a supplier to pay for
            what they already have, indefinitely. */}
        {onChoosePlan && !openEnded && days != null && (
          <button
            onClick={onChoosePlan}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 whitespace-nowrap"
          >
            Choose plan
          </button>
        )}
      </div>
    );
  }

  // Locked WITH a package = a paid plan that lapsed. Locked WITHOUT one = they
  // never subscribed, which is the free tier and not a fault.
  if (access.state === 'LOCKED') {
    const lapsed = !!access.packageName;
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
          lapsed
            ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
            : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300'
        } ${className}`}
      >
        {lapsed ? (
          <AlertTriangle size={16} className="flex-shrink-0" />
        ) : (
          <CheckCircle2 size={16} className="flex-shrink-0" />
        )}
        <p className="text-sm font-bold flex-1">
          {lapsed
            ? `Your ${access.packageName} plan has ended. Subscribe to keep your catalogue visible to clinics.`
            : 'Free plan — subscribe to publish your catalogue to clinics.'}
        </p>
        {onChoosePlan && (
          <button
            onClick={onChoosePlan}
            className={`px-3 py-1.5 rounded-lg text-white text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
              lapsed ? 'bg-rose-600 hover:bg-rose-700' : 'bg-pine hover:opacity-90'
            }`}
          >
            {lapsed ? 'Subscribe' : 'Choose plan'}
          </button>
        )}
      </div>
    );
  }

  // ACTIVE — a paying supplier does not need a banner telling them so.
  return null;
};

export default SupplierPlanBanner;

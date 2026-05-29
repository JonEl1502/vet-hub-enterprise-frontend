/**
 * Compact trial-status banner shown on the clinic Dashboard + Treasury /
 * Billing screens. Self-fetches /stripe/info, so callers just drop it in
 * with a clinicId. Renders nothing while loading; renders nothing when the
 * clinic has an active subscription AND isn't in a trial. Otherwise shows
 * "X days left in trial" or "Trial expired — subscribe to continue".
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { stripeAPI, type BillingInfo } from '../../../services/modules/stripe.api';

interface TrialBannerProps {
  clinicId: string | null;
  onSubscribe?: () => void;
  /** Show subscription-days-left version when an active sub exists. Default off. */
  showWhenSubscribed?: boolean;
  className?: string;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ clinicId, onSubscribe, showWhenSubscribed = false, className = '' }) => {
  const [info, setInfo] = useState<BillingInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!clinicId) return;
    stripeAPI.getInfo(clinicId).then((res) => {
      if (!cancelled && res.success) setInfo(res.data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [clinicId]);

  if (!info) return null;

  const hasActiveSub = !!info.subscription && info.subscription.isActive;
  const inTrial = !!info.isInTrial;
  const trialDays = info.trialDaysLeft ?? 0;
  const subDays = info.subscriptionDaysLeft ?? 0;
  const accessLost = !hasActiveSub && !inTrial;

  // No subscription + in trial → show days-left in trial.
  if (!hasActiveSub && inTrial) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ${className}`}>
        <CheckCircle2 size={16} className="flex-shrink-0" />
        <p className="text-sm font-bold flex-1">
          Free trial — {trialDays} day{trialDays === 1 ? '' : 's'} left.
        </p>
        {onSubscribe && (
          <button onClick={onSubscribe} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700">
            Choose plan
          </button>
        )}
      </div>
    );
  }

  // No subscription + trial over → access lost.
  if (accessLost) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 ${className}`}>
        <AlertTriangle size={16} className="flex-shrink-0" />
        <p className="text-sm font-bold flex-1">
          Your free trial has ended. Subscribe to keep using VetHub.
        </p>
        {onSubscribe && (
          <button onClick={onSubscribe} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700">
            Subscribe
          </button>
        )}
      </div>
    );
  }

  // Active sub — show days-left only when caller opts in.
  if (hasActiveSub && showWhenSubscribed) {
    const expiringSoon = subDays <= 7;
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
        expiringSoon
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300'
      } ${className}`}>
        <CheckCircle2 size={16} className="flex-shrink-0" />
        <p className="text-sm font-bold flex-1">
          {subDays} day{subDays === 1 ? '' : 's'} left in your subscription cycle.
        </p>
      </div>
    );
  }

  return null;
};

export default TrialBanner;

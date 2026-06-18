import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCircle2, RefreshCw } from 'lucide-react';
import { dialog } from '../../../services';
import { useDisplayCurrency } from '../../../contexts/DisplayCurrencyContext';
import type { SubscriptionPackage } from '../../../services/modules/stripe.api';

interface PlanCardProps {
  pkg: SubscriptionPackage;
  isCurrent: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onPayWithMpesa?: () => void;
  onPayWithLipana?: (optionId: string | null, cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') => void;
  lipanaLoading?: boolean;
  /** Paystack hosted checkout (card + mobile money). Redirects off-site. */
  onPayWithPaystack?: (optionId: string | null, cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') => void;
  paystackLoading?: boolean;
  getPlanIcon: (name: string) => React.ElementType;
  delay: number;
  /** Current sub on this clinic — used to dim cycle-downgrade choices when
   *  the user is viewing their own package. */
  currentSubBillingCycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY' | null;
  /** Tier of the user's active package. Drives the cross-package
   *  downgrade gate (Pro user can't subscribe to Manager). */
  currentSubTier?: number | null;
  /** On the CURRENT plan card only: the next higher-tier package to upsell.
   *  When set, a prominent "Upgrade to {name}" CTA renders under the Current
   *  Plan chip. */
  upgradeTarget?: { name: string; tier: number } | null;
  upgradeTargetPrice?: number | null;
  upgradeTargetCurrency?: string | null;
  onUpgradeToTarget?: () => void;
}

const CYCLE_LABEL: Record<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY', string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: '6 Months',
  YEARLY: 'Yearly',
};
const CYCLE_DAYS_FE: Record<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY', number> = {
  MONTHLY: 30, QUARTERLY: 90, SEMIANNUAL: 180, YEARLY: 365,
};
const CYCLE_SUFFIX: Record<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY', string> = {
  MONTHLY: 'mo',
  QUARTERLY: '3mo',
  SEMIANNUAL: '6mo',
  YEARLY: 'yr',
};

export const PlanCard: React.FC<PlanCardProps> = ({ pkg, isCurrent, isLoading, onSelect, onPayWithMpesa, onPayWithLipana, lipanaLoading, onPayWithPaystack, paystackLoading, getPlanIcon, delay, currentSubBillingCycle, currentSubTier, upgradeTarget, upgradeTargetPrice, upgradeTargetCurrency, onUpgradeToTarget }) => {
  const Icon = getPlanIcon(pkg.name);
  const { formatPrice } = useDisplayCurrency();
  // For the user's CURRENT package: any cycle shorter than what they're on
  // is a downgrade — disable it. New packages are unaffected.
  const currentCycleDays = (isCurrent && currentSubBillingCycle) ? CYCLE_DAYS_FE[currentSubBillingCycle] : 0;
  const isCycleDowngrade = (c: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') =>
    isCurrent && currentCycleDays > 0 && CYCLE_DAYS_FE[c] < currentCycleDays;
  // Cross-package tier downgrade — user is on a higher-tier package and
  // viewing a lower-tier one. We don't offer downgrades, so the whole
  // card is dimmed and the Pay button hidden.
  const isTierDowngrade = !isCurrent && typeof currentSubTier === 'number' && pkg.tier < currentSubTier;
  // Tier 2 is the featured/recommended plan (Growth in the current catalog).
  // Highlighted with a glowing border, scale-up on desktop, and a "Most
  // Popular" ribbon. The current-plan styling still wins when both apply.
  const isFeatured = pkg.tier === 2;

  // Cycle selector — sourced from billingOptions when present; falls back to
  // a single MONTHLY synthetic option built from the legacy package columns.
  const cycleOptions = (pkg.billingOptions && pkg.billingOptions.length > 0)
    ? pkg.billingOptions
    : [{
        id: '',
        cycle: (pkg.billingCycle as 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') || 'MONTHLY',
        price: pkg.price,
        currency: pkg.currency || 'KES',
        discountPct: 0,
        lipanaStaticLinkUrl: pkg.lipanaStaticLinkUrl ?? null,
      }];
  // Default to the admin-chosen featured cycle when present (and an active
  // option exists for it); else first option's cycle.
  const featured = (pkg.featuredCycle || 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
  // On the user's CURRENT plan, preselect their ACTUAL cycle (so a Pro/6-Months
  // user isn't shown Monthly by default). Otherwise use the admin-featured
  // cycle, falling back to the first available option.
  const initialCycle =
    isCurrent && currentSubBillingCycle && cycleOptions.some((o) => o.cycle === currentSubBillingCycle)
      ? currentSubBillingCycle
      : (cycleOptions.find((o) => o.cycle === featured)?.cycle ?? cycleOptions[0].cycle);
  const [selectedCycle, setSelectedCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY'>(initialCycle);
  // "On current cycle" = the user is on this package AND has the same
  // cycle selected. Drives whether we show the 'Current Plan' chip vs an
  // 'Upgrade' Pay button. Declared here so selectedCycle is in scope.
  const onCurrentCycle = isCurrent && selectedCycle === currentSubBillingCycle;
  const [showCycleMenu, setShowCycleMenu] = useState(false);
  const selectedOption = cycleOptions.find((o) => o.cycle === selectedCycle) ?? cycleOptions[0];
  // Pay button shows whenever there's a priced option for this package
  // (Lipana is a platform-wide service driven by the secret key; per-cycle
  // URLs are optional marketing extras, not a payment gate).
  const lipanaEnabled = cycleOptions.some((o) => Number(o.price) > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
        isTierDowngrade
          ? 'border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 opacity-60'
          : isCurrent
          ? 'border-pine dark:border-seafoam bg-pine/5 dark:bg-pine/10'
          : isFeatured
          ? 'border-amber-400 dark:border-amber-500/70 bg-amber-50/40 dark:bg-amber-500/5 shadow-lg shadow-amber-500/10 lg:scale-[1.02]'
          : 'border-slate-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 hover:border-pine/50 dark:hover:border-seafoam/40'
      }`}
    >
      {isFeatured && !isCurrent && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 whitespace-nowrap">
          <span aria-hidden>⭐</span> Most Popular
        </span>
      )}
      {isCurrent && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-pine text-white text-[9px] font-black uppercase tracking-wider">
          Current
        </span>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isFeatured
            ? 'bg-amber-500/15 dark:bg-amber-500/20'
            : 'bg-pine/10 dark:bg-pine/20'
        }`}>
          <Icon size={18} className={isFeatured ? 'text-amber-600 dark:text-amber-400' : 'text-pine dark:text-seafoam'} />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
            {pkg.name}
            {isFeatured && <span className="text-amber-500" aria-hidden>⭐</span>}
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">{CYCLE_LABEL[selectedCycle]} billing</p>
        </div>
      </div>

      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">
          {formatPrice(selectedOption.price, selectedOption.currency)}
          <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 ml-1">
            /{CYCLE_SUFFIX[selectedCycle]}
          </span>
          {selectedOption.discountPct > 0 && (
            <span className="ml-2 align-middle inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
              SAVE {Math.round(selectedOption.discountPct)}%
            </span>
          )}
        </p>
        {cycleOptions.length > 1 && (
          <div className="relative mt-1">
            <button
              onClick={() => setShowCycleMenu((v) => !v)}
              className="text-[10px] font-bold uppercase tracking-widest text-pine dark:text-seafoam hover:underline flex items-center gap-1"
            >
              Change cycle <span aria-hidden>⌄</span>
            </button>
            {showCycleMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCycleMenu(false)} />
                <div className="absolute z-20 mt-1 left-0 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                  {cycleOptions.map((o) => {
                    const active = o.cycle === selectedCycle;
                    const downgrade = isCycleDowngrade(o.cycle);
                    // The user's CURRENT cycle on this package — labelled
                    // 'Current' and not clickable for re-purchase (no-op).
                    const isUsersCurrentCycle = isCurrent && o.cycle === currentSubBillingCycle;
                    const blocked = downgrade || isUsersCurrentCycle;
                    const handleBlockedClick = () => {
                      if (isUsersCurrentCycle) {
                        dialog.alert({
                          title: 'You’re already on this cycle',
                          message: `Your ${pkg.name} plan is on the ${CYCLE_LABEL[o.cycle]} cycle. Pick a longer cycle to upgrade.`,
                          variant: 'info',
                        });
                      } else if (downgrade) {
                        dialog.alert({
                          title: 'Downgrades aren’t supported',
                          message: `You can’t shorten your billing cycle (${CYCLE_LABEL[currentSubBillingCycle as 'MONTHLY']} → ${CYCLE_LABEL[o.cycle]}). To switch to a shorter cycle, cancel your active subscription first (Billing → Cancel subscription, choose "end of cycle") then re-subscribe once the current cycle ends.`,
                          variant: 'info',
                        });
                      }
                    };
                    return (
                      <button
                        key={o.cycle}
                        onClick={() => {
                          if (blocked) { handleBlockedClick(); return; }
                          setSelectedCycle(o.cycle);
                          setShowCycleMenu(false);
                        }}
                        className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs transition-colors ${
                          isUsersCurrentCycle
                            ? 'bg-pine/5 dark:bg-pine/20 text-pine dark:text-seafoam cursor-pointer'
                            : downgrade
                            ? 'text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-800'
                            : active
                            ? 'bg-pine/5 dark:bg-pine/20 text-pine dark:text-seafoam font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {active && !isUsersCurrentCycle && <Check size={11}/>}
                          {CYCLE_LABEL[o.cycle]}
                          {isUsersCurrentCycle && <span className="text-[9px] uppercase tracking-widest text-pine dark:text-seafoam font-black">Current</span>}
                          {downgrade && !isUsersCurrentCycle && <span className="text-[9px] uppercase tracking-widest text-slate-400">downgrade</span>}
                        </span>
                        <span className="font-mono">
                          {formatPrice(o.price, o.currency)}
                          {o.discountPct > 0 && !downgrade && !isUsersCurrentCycle && <span className="ml-1.5 text-[9px] text-emerald-500 font-black">−{Math.round(o.discountPct)}%</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Limits */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Patients', value: pkg.maxPatients >= 99999 ? '∞' : pkg.maxPatients.toLocaleString() },
          { label: 'Staff', value: pkg.maxStaff >= 9999 ? '∞' : pkg.maxStaff.toLocaleString() },
          { label: 'Storage', value: `${pkg.storageGb}GB` },
        ].map(({ label, value }) => (
          <div key={label} className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60">
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{value}</p>
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      {pkg.features.length > 0 && (
        <ul className="space-y-1.5">
          {pkg.features.slice(0, 4).map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <CheckCircle2 size={11} className="text-pine dark:text-seafoam flex-shrink-0" />
              {f}
            </li>
          ))}
          {pkg.features.length > 4 && (
            <li className="text-xs text-slate-400 dark:text-zinc-500 pl-5">
              +{pkg.features.length - 4} more features
            </li>
          )}
        </ul>
      )}

      {/* "Current plan" chip only when the user is on this package AND on
          this exact cycle. If they switch to a longer cycle in the popover,
          we hide the chip and show the Upgrade CTA below instead. */}
      {onCurrentCycle && (
        <div className="mt-auto w-full space-y-2">
          <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-pine/10 dark:bg-pine/20 text-pine dark:text-seafoam">
            <Check size={13} /> Current Plan
          </div>
          {/* Upsell the next tier up, if one exists. */}
          {upgradeTarget && onUpgradeToTarget && (
            <button
              onClick={onUpgradeToTarget}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all bg-gradient-to-r from-pine to-seafoam hover:opacity-95"
            >
              ⬆ Upgrade to {upgradeTarget.name}
              <span className="opacity-80 font-semibold">· Tier {upgradeTarget.tier}</span>
              {upgradeTargetPrice != null && (
                <span>— {formatPrice(upgradeTargetPrice, upgradeTargetCurrency || pkg.currency || 'KES')}</span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Tier-downgrade label in place of the Pay button — no offer to
          subscribe to a lower tier than the user already has. Clicking
          opens a VetHub dialog explaining why and what to do instead. */}
      {isTierDowngrade && (
        <button
          onClick={() => dialog.alert({
            title: 'Downgrades aren’t supported',
            message: `You’re currently on a higher-tier plan. To switch to ${pkg.name}, cancel your active subscription first (Billing → Cancel subscription, choose "end of cycle") then re-subscribe to ${pkg.name} once the current cycle ends.`,
            variant: 'info',
          })}
          className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
        >
          Downgrade — not available
        </button>
      )}

      {/* Pay CTA. Shows for:
          - New higher-tier packages (!isCurrent && !isTierDowngrade)
          - Current package on a longer cycle (cycle upgrade) — label says
            'Upgrade' instead of 'Pay' so the user knows what's happening.
          Hidden when the user is already on this exact cycle (chip above
          already covers that case) OR when this is a tier downgrade. */}
      {/* Payment options — the user chooses a method. M-Pesa (Lipana STK push)
          and/or Card + Mobile Money (Paystack hosted checkout). Amounts are
          identical; only the rail differs. */}
      {!onCurrentCycle && !isTierDowngrade && lipanaEnabled && (onPayWithLipana || onPayWithPaystack) && (
        <div className="mt-auto w-full space-y-2">
          {onPayWithLipana && (
            <button
              onClick={() => onPayWithLipana(selectedOption.id || null, selectedCycle)}
              disabled={lipanaLoading || paystackLoading || !(Number(selectedOption.price) > 0)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-pine to-seafoam hover:opacity-95"
              title={!(Number(selectedOption.price) > 0) ? 'No price set for this cycle' : undefined}
            >
              {lipanaLoading ? (
                <><RefreshCw size={14} className="animate-spin" /> Waiting for payment…</>
              ) : (
                <>📱 {isCurrent ? 'Upgrade' : 'Pay'} with M-Pesa — {formatPrice(selectedOption.price, selectedOption.currency)}</>
              )}
            </button>
          )}
          {onPayWithPaystack && (
            <button
              onClick={() => onPayWithPaystack(selectedOption.id || null, selectedCycle)}
              disabled={lipanaLoading || paystackLoading || !(Number(selectedOption.price) > 0)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-700"
              title={!(Number(selectedOption.price) > 0) ? 'No price set for this cycle' : 'Pay by card or mobile money via Paystack'}
            >
              {paystackLoading ? (
                <><RefreshCw size={14} className="animate-spin" /> Redirecting…</>
              ) : (
                <>💳 Card or Mobile — {formatPrice(selectedOption.price, selectedOption.currency)}</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Fallback CTA — used where no Lipana/Paystack handler is wired (e.g. the
          clinic Treasury tab), so the card still has a working action via onSelect. */}
      {!onCurrentCycle && !isTierDowngrade && !onPayWithLipana && !onPayWithPaystack && onSelect && (
        <button
          onClick={onSelect}
          disabled={isLoading || !(Number(selectedOption.price) > 0)}
          className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-pine to-seafoam hover:opacity-95"
        >
          {isLoading ? (
            <><RefreshCw size={14} className="animate-spin" /> Working…</>
          ) : (
            <>{isCurrent ? 'Upgrade' : 'Subscribe'} — {formatPrice(selectedOption.price, selectedOption.currency)}</>
          )}
        </button>
      )}
    </motion.div>
  );
};

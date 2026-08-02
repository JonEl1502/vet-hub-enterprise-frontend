import React from 'react';
import { CheckCircle2, Lock, Sparkles, ArrowUpRight, Package, Clock } from 'lucide-react';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';
import { KEY_LABEL, BASELINE_KEYS, FEATURE_COPY, hasFeature } from '../../../services/entitlements';
import { formatDate } from '../../../services/utils/dateFormatter';

/**
 * Clinic-facing "your plan" panel (§0f #7 — PLAN HALF ONLY).
 *
 * Shows what the clinic's plan includes and what a higher tier would add,
 * straight from the same `featureKeys` the gates run on — so this page can
 * never drift from what the plan actually grants.
 *
 * ⚠️ Deliberately NOT a permission matrix. The API gates on the global
 * `User.role` only; per-user `clinicRole`/grants are not enforced server-side,
 * so a "your receptionist can access X" claim here would be a lie
 * (`reference_role_gating_model`). Plan features only.
 */

interface Props {
  /** Jump back to the Current Billing tab, where upgrading actually happens. */
  onGoToPlans: () => void;
}

/** Clinic-audience catalog groups, in display order. */
const GROUPS: { title: string; prefix: string }[] = [
  { title: 'Modules', prefix: 'view:' },
  { title: 'Capabilities', prefix: 'capability:' },
  { title: 'Services', prefix: 'service:' },
];

const STATE_CHIP: Record<string, string> = {
  TRIAL: 'bg-cyan/10 text-cyan border-cyan/20',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  LOCKED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const PlanFeaturesPanel: React.FC<Props> = ({ onGoToPlans }) => {
  const { access, loading } = usePlanAccess();

  // The clinic-audience catalog — supplier/client/livestock keys are other
  // audiences' vocabularies and never appear on a clinic plan card.
  const catalogKeys = Object.keys(KEY_LABEL).filter(k =>
    GROUPS.some(g => k.startsWith(g.prefix)) && !BASELINE_KEYS.has(k),
  );

  const everything = !access || access.state === 'TRIAL' || access.featureKeys.includes('*');
  const included = everything ? catalogKeys : catalogKeys.filter(k => hasFeature(access, k));
  // The locked half sticks to FEATURE_COPY keys — those carry an accurate
  // "needs the X plan" line; guessing tiers for the rest would misquote pricing.
  const locked = everything ? [] : Object.keys(FEATURE_COPY).filter(k => !hasFeature(access, k));

  if (loading) {
    return <p className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Loading plan…</p>;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {/* ── Plan summary ── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2.5 rounded-xl bg-seafoam/10 text-seafoam shrink-0"><Package size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Your plan</p>
            <p className="text-base font-black text-pine dark:text-zinc-100 leading-tight">
              {access?.packageName || (access?.state === 'TRIAL' ? 'Free trial' : access ? 'No package' : 'Full access')}
            </p>
          </div>
          {access?.state && (
            <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${STATE_CHIP[String(access.state)] || 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
              {String(access.state)}
            </span>
          )}
          {(access?.addOns ?? []).map(a => (
            <span key={`${a.name}-${a.expiresAt}`}
              title={`Runs until ${formatDate(a.expiresAt)}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Sparkles size={10} /> {a.name || 'Add-on'}
            </span>
          ))}
        </div>
        {access?.graceFullAccessUntil && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            <Clock size={11} /> Full access held until {formatDate(access.graceFullAccessUntil)} while your payment settles.
          </p>
        )}
        {access?.state === 'LOCKED' && (
          <p className="mt-3 text-[11px] font-bold text-rose-500">
            Your subscription has lapsed — features are locked until a plan is active. Billing stays reachable so you can renew below.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ── Included ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Included in your plan</h3>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mb-4">
            {everything ? 'Everything — your plan (or trial) includes the full catalog.' : `${included.length} feature${included.length === 1 ? '' : 's'}, straight from what your plan grants.`}
          </p>
          {included.length === 0 ? (
            <p className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600">Nothing granted on this plan</p>
          ) : (
            <div className="space-y-4">
              {GROUPS.map(g => {
                const keys = included.filter(k => k.startsWith(g.prefix));
                if (!keys.length) return null;
                return (
                  <div key={g.title}>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{g.title}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                      {keys.map(k => (
                        <div key={k} className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                          <span className="text-[11px] font-bold text-pine dark:text-zinc-200 truncate">{KEY_LABEL[k]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Locked / upgradeable ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={14} className="text-amber-500" />
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Not in your plan</h3>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mb-4">
            {locked.length === 0 ? 'Nothing — there is no feature a higher tier would add.' : 'What a higher tier or add-on unlocks.'}
          </p>
          {locked.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <Sparkles size={22} className="text-emerald-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600">You have it all</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {locked.map(k => {
                const copy = FEATURE_COPY[k];
                return (
                  <div key={k} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/30">
                    <Lock size={13} className="text-slate-300 dark:text-zinc-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100">{copy.label}</p>
                        <span className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest bg-seafoam/10 text-seafoam border border-seafoam/20">
                          {copy.plan}
                        </span>
                      </div>
                      {copy.blurb && <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{copy.blurb}</p>}
                    </div>
                  </div>
                );
              })}
              <button onClick={onGoToPlans}
                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all">
                <ArrowUpRight size={12} /> View plans & upgrade
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanFeaturesPanel;

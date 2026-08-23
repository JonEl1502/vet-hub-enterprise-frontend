/**
 * Inline plan gate for a control inside an otherwise-allowed page — the image
 * uploader on a lab result, an export button, and so on.
 *
 * When the plan includes `featureKey` the children render untouched. When it
 * doesn't, the control is REPLACED by a compact dashed panel naming the
 * feature, the plan that unlocks it, and an Upgrade button that deep-links to
 * Billing. Nothing half-usable is left on screen.
 *
 *   <UpgradeGate feature="capability:attachments">
 *     <ImageUploader … />
 *   </UpgradeGate>
 *
 * For a whole page use the lock screen in App.tsx (driven by `allowsView`);
 * for a nav item use the sidebar's `planAllows` pruning.
 */
import React from 'react';
import { Lock, ArrowUpRight } from 'lucide-react';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';
import { featureCopy } from '../../../services/entitlements';
import { upgradeSentence } from '../../../services/entitlements';

interface UpgradeGateProps {
  /** Feature key required to render the children, e.g. 'capability:attachments'. */
  feature: string;
  children: React.ReactNode;
  /**
   * 'panel'  — dashed block with icon, copy, and CTA (default; best for a
   *            drop zone or a section the control owned).
   * 'inline' — one compact row with a lock + link, for a toolbar button slot.
   */
  variant?: 'panel' | 'inline';
  /** Override the auto-generated heading. */
  title?: string;
  /** Override the auto-generated blurb. */
  description?: string;
  /** Render nothing at all instead of the upsell (rare — prefer the upsell). */
  hideWhenLocked?: boolean;
  className?: string;
}

/** Navigate to Billing without coupling this component to the router. */
const goToBilling = () => {
  window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view: 'billing' } }));
};

const UpgradeGate: React.FC<UpgradeGateProps> = ({
  feature,
  children,
  variant = 'panel',
  title,
  description,
  hideWhenLocked = false,
  className = '',
}) => {
  const { can } = usePlanAccess();

  if (can(feature)) return <>{children}</>;
  if (hideWhenLocked) return null;

  const copy = featureCopy(feature);
  // Shared with the 403 upgrade modal — see `planPhrase` in entitlements.
  const heading = title ?? upgradeSentence(copy).replace(/\.$/, '');
  const blurb = description ?? copy.blurb;

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={goToBilling}
        title={`${heading} — click to upgrade`}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/60 text-[11px] font-bold text-slate-500 dark:text-zinc-400 hover:border-pine hover:text-pine dark:hover:text-seafoam transition-all ${className}`}
      >
        <Lock size={12} className="shrink-0" />
        <span className="truncate">{heading}</span>
        <ArrowUpRight size={12} className="shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-900/60 px-5 py-6 text-center ${className}`}
    >
      <div className="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-zinc-800 flex items-center justify-center mx-auto">
        <Lock size={16} className="text-slate-500 dark:text-zinc-400" />
      </div>
      <p className="mt-3 text-sm font-black text-slate-700 dark:text-zinc-200">{heading}</p>
      {blurb && (
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">{blurb}</p>
      )}
      <button
        type="button"
        onClick={goToBilling}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pine text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
      >
        <ArrowUpRight size={12} /> Upgrade plan
      </button>
    </div>
  );
};

export default UpgradeGate;

/**
 * THE page header. One component for every audience — clinic, admin, supplier,
 * livestock — so a page never invents its own title treatment.
 *
 * The codebase had two competing standards: `.page-header` (text-xl,
 * tracking-tighter, seafoam subtitle) on clinic pages, and the
 * back-button + icon-chip + text-lg treatment on admin and the Procedure
 * Editor. This is the second one, which is the reference the team settled on;
 * `.page-header` / `.page-subheader` in index.css were realigned to match, so
 * pages still using the raw classes converge without being edited.
 *
 * Page INSET is not set here — App.tsx's content wrapper
 * (`p-4 md:p-6 max-w-screen-2xl mx-auto`) owns that for every page. See
 * feedback_ui_padding_standard.
 */
import React from 'react';
import { ChevronLeft, type LucideIcon } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Left icon chip. Renders alongside the back control when both are set. */
  icon?: LucideIcon;
  /**
   * Renders the circular back control. Pass a handler for custom behaviour, or
   * `true` to use app history — the control then hides itself when there is
   * nowhere to go back to, rather than sitting there doing nothing.
   */
  onBack?: (() => void) | true;
  /** Small status pill beside the title (Active / Draft / Archived …). */
  badge?: { label: string; tone?: 'success' | 'neutral' | 'warning' | 'danger' };
  /** Buttons on the right. */
  actions?: React.ReactNode;
  className?: string;
}

const BADGE_TONE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  neutral: 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700',
};

/** App-history back, via the same event bus as `vethub:navigate`. */
const goBackGlobal = () => window.dispatchEvent(new CustomEvent('vethub:navigate-back'));

const PageHeader: React.FC<PageHeaderProps> = ({
  title, subtitle, icon: Icon, onBack, badge, actions, className = '',
}) => {
  // `true` = use history, but only if there IS history.
  const canGoBack = typeof window !== 'undefined' && (window as any).__vethubCanGoBack !== false;
  const backHandler = onBack === true ? (canGoBack ? goBackGlobal : null) : onBack ?? null;

  return (
  <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
    <div className="flex items-center gap-3 min-w-0">
      {backHandler && (
        <button
          onClick={backHandler}
          aria-label="Go back"
          className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100 transition-colors shrink-0"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {/* Back AND icon: the admin pages lead with an icon chip that gives
          them their identity — adding a back control shouldn't strip it. */}
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-seafoam" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="page-header truncate">{title}</h1>
          {badge && (
            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border shrink-0 ${
              BADGE_TONE[badge.tone ?? 'neutral']
            }`}>
              {badge.label}
            </span>
          )}
        </div>
        {subtitle && <p className="page-subheader">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
  );
};

export default PageHeader;

import React, { ReactNode, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * A sub-page INSIDE the portal shell.
 *
 * ⚠️ THIS IS NOT A MODAL, AND THAT IS THE WHOLE POINT.
 *
 * The first attempt at "make the long forms pages" was a flag on CpModal that
 * dropped its `maxWidth` and stood it up at `100dvh`. On a phone that is
 * genuinely a page. On a desktop it was a bug wearing a feature's clothes: the
 * overlay is `fixed inset-0 z-50`, so "Record a treatment" covered the top bar,
 * the side rail and the whole 1400px shell, and the form ran the full width of
 * a 2000px monitor. The farmer lost the one thing that told them where they
 * were — user, 2026-09-14: *"to be a page … keeping the Animals in sidebar
 * selected still."*
 *
 * So this renders in the normal document flow, as the view's own content. The
 * layout's rail, top bar and mobile tab bar are untouched, which means the
 * active nav item stays lit for free — there is no state to synchronise,
 * because we never left the route.
 *
 * The call site swaps content rather than stacking it:
 *
 *   if (txOpen) return <CpPage title="Record a treatment" onBack={close}>…</CpPage>;
 *
 * an early return, ABOVE the list's own return. A page is somewhere you went;
 * the thing you came from should not still be sitting underneath it.
 */
const CpPage: React.FC<{
  title: string;
  /** A line under the title — which animal, which herd, which farm. */
  subtitle?: ReactNode;
  onBack: () => void;
  children: ReactNode;
  /**
   * Forms read at a comfortable measure; a detail page with its own columns
   * can ask for more. Defaults to the width a two-up field grid wants.
   * Ignored when `aside` is given — a two-column page uses the shell's full
   * width instead of a single-column reading measure.
   */
  maxWidth?: string;
  /** Trailing controls in the header row — a delete, a status pill. */
  actions?: ReactNode;
  /**
   * Breadcrumb trail segment between "Portal" and the page title, e.g.
   * "Market". Optional — a page with no natural section (Settings, Plan)
   * just omits it and gets the title alone, same as before.
   */
  section?: string;
  /**
   * Right-column content on wide screens — a live preview, a summary rail.
   * Presence of this prop is what switches the page into the 2-column
   * layout: `children` on the left, `aside` on the right at `xl:` (1280px)
   * and up, stacked below it on anything narrower. `aside` is its own
   * `.cp-card`, sticky under the header at `xl:` so a long left-hand form
   * scrolls past a preview that stays in view.
   */
  aside?: ReactNode;
}> = ({ title, subtitle, onBack, children, maxWidth = '42rem', actions, section, aside }) => {
  // Arriving at a page from halfway down a long list should not deposit you
  // halfway down the page. ⚠️ The shell scrolls its `<main id="cp-main-scroll">`
  // now, not the document (2026-09-28, fixed-viewport shell) — `window.scrollTo`
  // would silently do nothing.
  useEffect(() => {
    document.getElementById('cp-main-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Escape leaves a page the same way the back arrow does. A phone has the
  // arrow; a desktop keyboard reaches for Escape out of modal habit, and
  // having it do nothing reads as the page being stuck.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="w-full" style={aside ? undefined : { maxWidth }}>
      {section && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold cp-muted">
          <span>Portal</span>
          <span aria-hidden="true">/</span>
          <span>{section}</span>
          <span aria-hidden="true">/</span>
          <span style={{ color: 'var(--cp-ink)' }} className="truncate">{title}</span>
        </nav>
      )}
      <div className="flex items-start gap-3 mb-3">
        <button
          onClick={onBack}
          className="cp-muted hover:opacity-70 shrink-0 mt-0.5 -ml-1 p-1"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-xl leading-tight truncate" style={{ color: 'var(--cp-ink)' }}>
            {title}
          </h1>
          {subtitle && <div className="mt-0.5 text-xs cp-muted">{subtitle}</div>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-1.5">{actions}</div>}
      </div>
      {aside ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
          <div className="cp-card p-4 sm:p-5 min-w-0">{children}</div>
          <div className="cp-card p-4 sm:p-5 min-w-0 xl:sticky xl:top-0">{aside}</div>
        </div>
      ) : (
        <div className="cp-card p-4 sm:p-5">{children}</div>
      )}
    </div>
  );
};

export default CpPage;

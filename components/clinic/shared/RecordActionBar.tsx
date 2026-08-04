import React from 'react';
import { MoreHorizontal } from 'lucide-react';

/**
 * The fixed bottom action bar for a clinical module record page.
 *
 * The record's actions and status used to sit in a card at the very bottom of a
 * long scrolling page, so on grooming you had to scroll past the whole report to
 * change the status or jump to the visit (user, 2026-08-04: "move the side panel
 * down and fixed bottom … if many button some can open as menu"). Pinned here
 * they are reachable at any scroll position.
 *
 * Overflow is a real constraint, not decoration: these pages already carry
 * Add-service / Linked-appointment / Share, and more per module. Everything past
 * `inlineLimit` collapses into a "More" menu so the bar never wraps into a second
 * row and start eating the page.
 *
 * ⚠️ Offset by `--vh-sidebar-w` so it doesn't sit under the nav — same as the
 * triage panel's bar. Render `<RecordActionBarSpacer />` at the end of the page
 * or the bar covers the last of the content.
 */

export interface BarAction {
  key: string;
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  /** Visually primary — kept inline even when the rest overflow. */
  primary?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'seafoam' | 'pink';
}

interface Props {
  actions: BarAction[];
  status?: { value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean };
  /** Small print — e.g. where finalize actually lives. */
  hint?: string;
  /** How many non-primary actions stay inline before collapsing. */
  inlineLimit?: number;
  /**
   * Components that own their own trigger AND popover (e.g. AddCategoryService)
   * — they can't be flattened into a `BarAction`, so they render as-is. Their
   * popovers open upward from a bar pinned to the bottom, so keep them short.
   */
  slot?: React.ReactNode;
}

const TONES: Record<string, string> = {
  default: 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:border-seafoam',
  seafoam: 'border-seafoam/40 bg-seafoam/10 text-seafoam hover:bg-seafoam/20',
  pink: 'border-pink-300 dark:border-pink-800/50 bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-950/40',
};

export const RecordActionBarSpacer: React.FC = () => <div className="h-24 sm:h-20" aria-hidden />;

const RecordActionBar: React.FC<Props> = ({ actions, status, hint, inlineLimit = 2, slot }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click — a fixed-position menu left open while the page
  // scrolls underneath reads as a stuck overlay.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const live = actions.filter(Boolean);
  const primary = live.filter(a => a.primary);
  const rest = live.filter(a => !a.primary);
  const inline = rest.slice(0, inlineLimit);
  const overflow = rest.slice(inlineLimit);

  const btn = (a: BarAction, full?: boolean) => {
    const Icon = a.icon;
    return (
      <button
        key={a.key} type="button" onClick={() => { a.onClick(); setMenuOpen(false); }} disabled={a.disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${TONES[a.tone || 'default']} ${full ? 'w-full justify-start' : ''}`}
      >
        {Icon && <Icon size={12} />} {a.label}
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 right-0 left-0 md:left-[var(--vh-sidebar-w,16rem)] z-40 px-3 sm:px-4 py-2 sm:py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm shadow-[0_-4px_16px_rgba(0,0,0,0.10)]">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {status && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-slate-400">Status</span>
            <div className="flex gap-1">
              {status.options.map(s => (
                <button
                  key={s} type="button" onClick={() => status.onChange(s)} disabled={status.disabled}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${status.value === s ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {hint && <span className="hidden lg:inline text-[9px] font-bold text-slate-400 dark:text-zinc-500 mr-1">{hint}</span>}
          {slot}
          {inline.map(a => btn(a))}

          {overflow.length > 0 && (
            <div className="relative" ref={menuRef}>
              <button
                type="button" onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all"
              >
                <MoreHorizontal size={13} /> More
              </button>
              {menuOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-56 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl space-y-1">
                  {overflow.map(a => btn(a, true))}
                </div>
              )}
            </div>
          )}

          {primary.map(a => (
            <button
              key={a.key} type="button" onClick={a.onClick} disabled={a.disabled}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest hover:bg-pine/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {a.icon && <a.icon size={13} />} {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecordActionBar;

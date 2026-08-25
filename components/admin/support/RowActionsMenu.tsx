import React from 'react';
import { MoreHorizontal } from 'lucide-react';

/**
 * The per-row action menu.
 *
 * The queue used to put every action inline on the row — Create, Contacted, a
 * chevron — which cost roughly a third of the table's width to buttons that are
 * pressed on one row in ten, and made a 53-row list read as a wall of green
 * (user, 2026-08-25). The row's job is to be scanned; the actions are one click
 * away and the destructive one is separated.
 *
 * Closes on outside click, on Escape, and on scroll — a menu that floats over a
 * table it is no longer attached to is worse than no menu.
 */

export interface RowAction {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number }>;
  /** Renders in red, below a divider. */
  danger?: boolean;
  hidden?: boolean;
}

const RowActionsMenu: React.FC<{ actions: RowAction[]; label?: string }> = ({ actions, label = 'Actions' }) => {
  const [open, setOpen] = React.useState(false);
  const [up, setUp] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const visible = actions.filter(a => !a.hidden);
  if (!visible.length) return null;

  const toggle = () => {
    // Flip upward near the bottom of the viewport, so the last rows of a long
    // table don't open a menu that is cut off by the fold.
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setUp(window.innerHeight - r.bottom < visible.length * 34 + 24);
    setOpen(o => !o);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`p-1.5 rounded-lg transition-colors ${open ? 'bg-slate-200 dark:bg-zinc-700 text-pine dark:text-zinc-100' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-pine dark:hover:text-zinc-100'}`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 min-w-[184px] rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-1 ${up ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {visible.map((a, i) => {
            const Icon = a.icon;
            const firstDanger = a.danger && !visible[i - 1]?.danger;
            return (
              <React.Fragment key={a.label}>
                {firstDanger && i > 0 && <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />}
                <button
                  role="menuitem"
                  onClick={() => { setOpen(false); a.onClick(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold transition-colors ${
                    a.danger
                      ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                      : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-pine dark:hover:text-zinc-100'
                  }`}
                >
                  {Icon && <Icon size={13} />} {a.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RowActionsMenu;

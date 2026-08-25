import React, { useState } from 'react';
import { Filter } from 'lucide-react';

/**
 * The list-page filter pattern, extracted (user, 2026-08-24: "put some filters
 * in collapsibles like in clients … they look good, so apply to admin n
 * supplier").
 *
 * Clients and Patients each grew their own version of this by hand. Admin and
 * supplier pages were about to grow a third and fourth, so it lives here now:
 * the controls people reach for every time stay on the surface, everything else
 * folds away behind one toggle.
 *
 * ⚠️ THE `activeCount` PROP IS NOT DECORATION. A filter that is both hidden and
 * silently narrowing the list is how a page comes to look empty for no visible
 * reason — the same bug that had to be fixed on Clients and Patients when their
 * date range moved into the panel. Count every filter you put in `more`, and
 * make `onClear` reset every one of them.
 */
interface Props {
  /** What the panel holds, in a few words: "dates · package · channel". */
  hint?: string;
  /** How many of the COLLAPSED filters are currently set. Drives the marker. */
  activeCount?: number;
  /** Clears the collapsed filters. Rendered inside the panel when given. */
  onClear?: () => void;
  /** Always visible: search, the one or two filters used every time, actions. */
  primary: React.ReactNode;
  /** Folded away until asked for. */
  more: React.ReactNode;
  /** Start expanded — e.g. when a filter inside is already on. */
  defaultOpen?: boolean;
  className?: string;
}

const CollapsibleFilters: React.FC<Props> = ({
  hint,
  activeCount = 0,
  onClear,
  primary,
  more,
  defaultOpen = false,
  className = '',
}) => {
  // Opens itself when something inside is already filtering, so a narrowed list
  // never has its reason hidden on first paint.
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        {primary}

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            activeCount > 0
              ? 'bg-seafoam text-white'
              : 'text-slate-400 hover:text-pine dark:hover:text-zinc-200'
          }`}
        >
          <Filter size={11} />
          More filters{hint ? ` — ${hint}` : ''}
          {activeCount > 0 ? ` · ${activeCount}` : ''} {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div className="bg-slate-100/80 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-4 space-y-3">
          {more}
          {onClear && activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500"
            >
              Clear these filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CollapsibleFilters;

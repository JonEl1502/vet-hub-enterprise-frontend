import React from 'react';
import { MoreHorizontal, ChevronUp } from 'lucide-react';

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
 * ── Mobile: the bar is a COLLAPSIBLE SHEET ────────────────────────────────
 * On a phone the full bar (status pills + weight field + 2 inline actions +
 * More + the primary button) does not fit one row, and wrapping it turned the
 * bar into a three-row block covering a third of the screen (user, 2026-08-04:
 * "Stuck bottom and allow to open up n collapse").
 *
 * So below `sm` it starts COLLAPSED: a grab handle and the primary action only.
 * Drag the handle up — or tap it — and the sheet expands to reveal the status
 * pills, the `slot`, and every secondary action, each on its own full-width
 * row. Drag down or tap again to collapse. From `sm` up nothing changes: the
 * bar is always expanded and lays out as one row, exactly as before.
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

/** Clears the collapsed bar; the sheet expands over the page, so this only ever
 *  has to cover the collapsed height. */
export const RecordActionBarSpacer: React.FC = () => <div className="h-24 sm:h-20" aria-hidden />;

/** True from Tailwind's `sm` breakpoint up, tracked live so a rotate re-lays out. */
const useIsWide = () => {
  const [wide, setWide] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const on = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
};

const RecordActionBar: React.FC<Props> = ({ actions, status, hint, inlineLimit = 2, slot }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isWide = useIsWide();

  // Wide screens have room for the single-row bar, so the sheet is always open
  // there — `open` only governs the phone layout.
  const expanded = isWide || open;

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

  // Collapsing must also close the overflow menu, or it stays painted over a
  // bar that is no longer showing its trigger.
  React.useEffect(() => { if (!expanded) setMenuOpen(false); }, [expanded]);

  // ── Drag the handle ──────────────────────────────────────────────────────
  // Pointer events (not touch) so a mouse drag on a narrow desktop window
  // behaves the same. A short travel is treated as a tap, so the handle works
  // for both gestures without a separate button.
  const dragFrom = React.useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragFrom.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from == null) return;
    const dy = e.clientY - from;
    if (Math.abs(dy) < 8) setOpen(o => !o);   // tap
    else if (dy < -24) setOpen(true);         // dragged up
    else if (dy > 24) setOpen(false);         // dragged down
  };

  const live = actions.filter(Boolean);
  const primary = live.filter(a => a.primary);
  const rest = live.filter(a => !a.primary);
  // Collapsed-on-phone shows the primary action only; expanded shows everything
  // stacked, so there is nothing left to hide behind "More".
  const inline = isWide ? rest.slice(0, inlineLimit) : rest;
  const overflow = isWide ? rest.slice(inlineLimit) : [];

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

  const hasSheetContent = !!status || !!slot || rest.length > 0 || !!hint;

  return (
    <div className="fixed bottom-0 right-0 left-0 md:left-[var(--vh-sidebar-w,16rem)] z-40 px-3 sm:px-4 pt-1 sm:pt-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm shadow-[0_-4px_16px_rgba(0,0,0,0.10)]">
      {/* Grab handle — phone only, and only when there is something to reveal. */}
      {hasSheetContent && (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={open ? 'Collapse actions' : 'Expand actions'}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
          className="sm:hidden flex items-center justify-center gap-2 -mx-3 px-3 py-2 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
          <ChevronUp
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pb-1 sm:pb-2.5">
        {/*
          The sheet body. On a phone this is a real box that collapses to
          height 0. From sm: up it becomes `display: contents` — the box stops
          generating a frame and its two children (status, actions) become
          direct flex items of the row above, which is exactly the one-row
          desktop bar this component has always rendered. That is why the
          collapse classes need `sm:` resets: `visibility` INHERITS through a
          contents box, so `invisible` alone would blank the desktop bar.
        */}
        <div
          className={`sm:contents overflow-hidden transition-all duration-200 ease-out ${
            expanded ? 'max-h-[60vh] overflow-y-auto opacity-100 visible' : 'max-h-0 opacity-0 invisible'
          } sm:max-h-none sm:opacity-100 sm:visible`}
        >
          {status && (
            <div className="flex items-center gap-1.5 shrink-0 py-1 sm:py-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Status</span>
              <div className="flex flex-wrap gap-1">
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

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto pb-1 sm:pb-0">
            {hint && <span className="hidden lg:inline text-[9px] font-bold text-slate-400 dark:text-zinc-500 mr-1">{hint}</span>}
            {/* Interacting with the slot CLOSES the overflow menu. The slot's
                content (AddCategoryService) has no positioning of its own, so
                its picker expands INLINE and grows the bar upward into the
                space this menu occupies — that is how "Share" ended up painted
                across the middle of the grooming picker.
                `onPointerDownCapture` rather than a prop on the slot: the slot
                is an opaque ReactNode, so the bar cannot reach into it, and
                capture fires before the child's own handler opens the picker.
                Together with the menu's z-50 this covers both orders — open the
                picker and the menu gets out of the way; open the menu second
                and it renders cleanly on top instead of interleaved. */}
            <div className="contents" onPointerDownCapture={() => setMenuOpen(false)}>
              {slot}
            </div>
            {inline.map(a => btn(a))}

            {overflow.length > 0 && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button" onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all"
                >
                  <MoreHorizontal size={13} /> More
                </button>
                {/* z-50 is load-bearing, not decoration. The `slot` renders
                    INLINE (AddCategoryService has no positioning of its own),
                    so opening its picker grows the bar upward into exactly the
                    space this absolutely-positioned menu occupies — the two
                    interleaved, and "Share" painted across the middle of the
                    grooming picker (user, 2026-08-04). An explicit z puts the
                    menu decisively on top instead of leaving it to DOM order
                    and whatever stacking context the slot's panel creates.
                    NOTE: this makes the overlap legible, it does not prevent
                    it — the bar hosts two independent popovers that don't know
                    about each other. Closing the slot's picker when this opens
                    needs the slot to expose its state. */}
                {menuOpen && (
                  <div className="absolute z-50 bottom-full right-0 mb-2 w-56 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl space-y-1">
                    {overflow.map(a => btn(a, true))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Primary action — the one thing that must never be a gesture away, so
            it sits OUTSIDE the collapsible region: full width on the collapsed
            phone bar, inline at the right end from sm: up. */}
        {primary.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {primary.map(a => (
              <button
                key={a.key} type="button" onClick={a.onClick} disabled={a.disabled}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest hover:bg-pine/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {a.icon && <a.icon size={13} />} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordActionBar;

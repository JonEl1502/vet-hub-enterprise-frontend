import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Delete, Equal, Minus } from 'lucide-react';
import BrandMark from './BrandMark';

/**
 * A small calculator that floats over whatever page you are on and can be
 * dragged anywhere (user, 2026-08-22).
 *
 * Why it exists: pricing a product means arithmetic the form does not do for
 * you — "150 bottles × 50 mL", "what is 13 per mL as a per-bottle cost",
 * "1,950 ÷ 37,500". People were reaching for a phone mid-form, and a phone is
 * where mistyped numbers come from.
 *
 * Deliberately NOT a modal: a modal would cover the very figures you are
 * copying from. It is a floating panel with no backdrop, so the form stays
 * readable and clickable underneath.
 *
 * It opens UNDER the navbar button that summons it (user, 2026-08-24) and can
 * then be dragged anywhere for the rest of the session.
 *
 * ⚠️ The dragged position is deliberately NOT persisted any more. It used to
 * be, and that is what made "open below the button" impossible: a position
 * stored from a previous session always won the race with the anchor. Opening
 * where you clicked beats opening where you last left it — you are looking at
 * the button at that moment, not at wherever the panel used to be.
 */

const PANEL_W = 232;
const PANEL_H = 328;

type Pos = { x: number; y: number };

/** Keep the panel on screen — after a resize, or a stored position from a
 *  bigger monitor, it could otherwise sit entirely outside the viewport. */
function clampToViewport(p: Pos): Pos {
  const maxX = Math.max(8, window.innerWidth - PANEL_W - 8);
  const maxY = Math.max(8, window.innerHeight - PANEL_H - 8);
  return {
    x: Math.min(Math.max(8, p.x), maxX),
    y: Math.min(Math.max(8, p.y), maxY),
  };
}

/**
 * Where to open: under the trigger, right edges aligned, so the panel reads as
 * belonging to the button that produced it. `clampToViewport` then keeps it on
 * screen — on a narrow window the button can sit closer to the right edge than
 * the panel is wide.
 */
function anchoredPos(anchor: HTMLElement | null): Pos {
  if (!anchor) return clampToViewport({ x: window.innerWidth - PANEL_W - 24, y: 96 });
  const r = anchor.getBoundingClientRect();
  return clampToViewport({ x: r.right - PANEL_W, y: r.bottom + 8 });
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The control that opens the panel — it opens directly beneath it. */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const PopCalculator: React.FC<Props> = ({ open, onClose, anchorRef }) => {
  const [pos, setPos] = useState<Pos>({ x: 24, y: 96 });
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [minimised, setMinimised] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Position on OPEN, not at module scope — reading window dimensions there
  // would break SSR and any pre-mount render, and the trigger has no rect
  // until it is laid out.
  useEffect(() => { if (open) setPos(anchoredPos(anchorRef?.current ?? null)); }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setPos(p => clampToViewport(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // ── Dragging ───────────────────────────────────────────────────────────
  // Pointer events (not mouse) so a stylus or touch drag works too, and
  // listeners live on `window` so a fast drag that outruns the header still
  // tracks instead of dropping the panel where the cursor left it.
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!open) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos(clampToViewport({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
    };
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [open]);

  // ── Evaluation ─────────────────────────────────────────────────────────
  /**
   * Arithmetic only. The expression is whitelist-checked before it is parsed,
   * so nothing but digits, the four operators, brackets, % and a decimal point
   * can ever reach the evaluator.
   */
  const evaluate = useCallback((raw: string): string | null => {
    const src = raw.replace(/×/g, '*').replace(/÷/g, '/').trim();
    if (!src) return null;
    if (!/^[0-9+\-*/().%\s]+$/.test(src)) return 'Err';
    try {
      /**
       * Implicit multiplication: `8(9-3)` is 48, not a syntax error (user,
       * 2026-08-24). Every calculator a person has used treats juxtaposition
       * as multiplication; JS's parser reads `8(...)` as calling 8 as a
       * function and throws, which is where the `Err` came from.
       *
       * Only the three unambiguous joins are inserted — value then `(`,
       * `)` then value, and `)(`. Nothing here can change the meaning of an
       * expression that already parsed, because JS has no other reading of
       * those sequences.
       */
      const joined = src
        .replace(/([\d).%])\s*\(/g, '$1*(')
        .replace(/\)\s*([\d.])/g, ')*$1');
      // Percent as a plain divide-by-100 — "15%" is 0.15, so "200*15%" is 30.
      const js = joined.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${js});`)() as unknown;
      if (typeof v !== 'number' || !isFinite(v)) return 'Err';
      return String(Math.round(v * 1e6) / 1e6);
    } catch { return 'Err'; }
  }, []);

  const push = (t: string) => { setExpr(e => e + t); setResult(null); };
  const clearAll = () => { setExpr(''); setResult(null); };
  const back = () => { setExpr(e => e.slice(0, -1)); setResult(null); };
  const equals = () => {
    const v = evaluate(expr);
    if (v == null) return;
    setResult(v);
  };
  // Chain off the answer: pressing an operator after "=" continues from it.
  const useResult = () => { if (result && result !== 'Err') { setExpr(result); setResult(null); } };

  // Keyboard, while open. Ignored whenever focus is in a field, so typing a
  // price into the form underneath never lands in the calculator.
  useEffect(() => {
    if (!open || minimised) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing) return;
      if (/^[0-9+\-*/().%]$/.test(e.key)) { e.preventDefault(); push(e.key); }
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, minimised, expr, result]);

  if (!open) return null;

  /**
   * ⚠️ PORTALLED TO <body>, and it has to be.
   *
   * The launcher lives in the Navbar, whose <nav> carries `backdrop-blur-xl`.
   * `backdrop-filter` makes an element a CONTAINING BLOCK for `position: fixed`
   * descendants, so rendering in place resolved `left/top` against a 64px-tall
   * bar instead of the viewport — the panel opened outside its parent's box and
   * was effectively invisible (user, 2026-08-22: "calculator not opening").
   * Same trap applies to `transform`, `filter` and `will-change`, so the portal
   * is the fix rather than hunting for one offending class.
   */

  const KEYS: { t: string; label?: string; kind?: 'op' | 'eq' | 'fn' }[] = [
    { t: 'C', kind: 'fn' }, { t: '(', kind: 'fn' }, { t: ')', kind: 'fn' }, { t: '÷', kind: 'op' },
    { t: '7' }, { t: '8' }, { t: '9' }, { t: '×', kind: 'op' },
    { t: '4' }, { t: '5' }, { t: '6' }, { t: '-', kind: 'op' },
    { t: '1' }, { t: '2' }, { t: '3' }, { t: '+', kind: 'op' },
    { t: '0' }, { t: '.' }, { t: '%', kind: 'fn' }, { t: '=', kind: 'eq' },
  ];

  return createPortal(
    <div
      className="fixed z-[80] select-none"
      style={{ left: pos.x, top: pos.y, width: PANEL_W }}
      role="dialog"
      aria-label="Calculator"
    >
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Drag handle. `touch-none` stops the browser scrolling the page
            instead of moving the panel on a touch drag. */}
        <div
          onPointerDown={onPointerDown}
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-pine to-seafoam text-white cursor-grab active:cursor-grabbing touch-none"
        >
          {/* The mark, not just a word. `currentColor` is required, not a
              shortcut: pine and seafoam are runtime CSS variables so a clinic
              can rebrand, and a hardcoded hex here would survive the rebrand
              and clash with the header it sits on. */}
          <span className="grid place-items-center w-5 h-5 rounded-md bg-white/15 ring-1 ring-white/25 shrink-0">
            <BrandMark className="w-3.5 h-3.5" color="currentColor" />
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest flex-1">Calculator</span>
          <button type="button" onClick={() => setMinimised(m => !m)} title={minimised ? 'Expand' : 'Minimise'}
            className="p-0.5 rounded hover:bg-white/15"><Minus size={13} /></button>
          <button type="button" onClick={onClose} title="Close (Esc)"
            className="p-0.5 rounded hover:bg-white/15"><X size={13} /></button>
        </div>

        {!minimised && (
          <>
            <div className="relative overflow-hidden px-3 py-2 bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-800">
              {/* Watermark: the mark is the backdrop, the number is the content.
                  `pointer-events-none` so it never steals the tap that
                  continues from the last answer. */}
              <BrandMark
                className="pointer-events-none absolute -left-3 -bottom-4 w-20 h-20 text-seafoam opacity-[0.07] dark:opacity-[0.12]"
                color="currentColor"
              />
              <p className="relative text-right text-[11px] font-bold text-slate-400 h-4 truncate">{expr || ' '}</p>
              <button
                type="button"
                onClick={useResult}
                title={result && result !== 'Err' ? 'Continue from this answer' : undefined}
                className="relative w-full text-right text-2xl font-black text-pine dark:text-zinc-100 tabular-nums truncate"
              >
                {result ?? (evaluate(expr) && evaluate(expr) !== 'Err' ? evaluate(expr) : '0')}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 p-2">
              {KEYS.map(k => (
                <button
                  key={k.t}
                  type="button"
                  onClick={() => {
                    if (k.t === 'C') return clearAll();
                    if (k.t === '=') return equals();
                    if (result && result !== 'Err' && !'0123456789.'.includes(k.t)) {
                      // Operator straight after "=" continues from the answer.
                      setExpr(result + k.t); setResult(null); return;
                    }
                    if (result) { setExpr(k.t); setResult(null); return; }
                    push(k.t);
                  }}
                  className={`h-9 rounded-lg text-sm font-black transition-colors ${
                    k.kind === 'eq'
                      ? 'bg-seafoam text-white hover:bg-seafoam/90'
                      : k.kind === 'op'
                      ? 'bg-slate-100 dark:bg-zinc-800 text-seafoam hover:bg-slate-200 dark:hover:bg-zinc-700'
                      : k.kind === 'fn'
                      ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      : 'bg-slate-50 dark:bg-zinc-800/60 text-pine dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {k.t === '=' ? <Equal size={14} className="mx-auto" /> : k.t}
                </button>
              ))}
              <button
                type="button"
                onClick={back}
                className="col-span-4 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800/60 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
              >
                <Delete size={12} /> Backspace
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default PopCalculator;

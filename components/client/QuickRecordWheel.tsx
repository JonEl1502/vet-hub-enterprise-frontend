import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, type LucideIcon } from 'lucide-react';
import BrandMark from '../shared/common/BrandMark';

export interface WheelAction {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the bubble (background + icon colour). */
  tone: string;
  onSelect: () => void;
}

interface Props {
  actions: WheelAction[];
  /** Accessible name for the centre button. */
  label?: string;
}

const RADIUS = 108;     // px from the hub to each bubble's centre
const ARC_START = 180;  // degrees, anticlockwise from 3 o'clock: the dial opens from the left…
const ARC_END = 0;      // …over the top to the right — a half dial that stays on a phone screen
const SPREAD = 62;      // bubbles sit within ±SPREAD° of straight up
const OPEN_MS = 380;
const CLOSE_MS = 320;

/**
 * The bottom bar's centre button: the VetHub "C" mark, raised above the bar.
 * Tap it and a tick-marked dial fans open above it with the record actions —
 * the Rekodi quick-add wheel, in portal colours.
 *
 * The overlay is portalled to <body> and its hub is placed exactly over the
 * real button (measured on open), so the button reads as one object that
 * rotates and turns into a close cross rather than a second one appearing.
 */
const QuickRecordWheel: React.FC<Props> = ({ actions, label = 'Record something' }) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // keeps the layer in the DOM while it folds away
  const [shown, setShown] = useState(false);     // what the styles follow
  const [hub, setHub] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setHub({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    setOpen((v) => !v);
  };

  // Mount closed, then flip to shown two frames later — mounting straight into
  // the open state skips the fan-out entirely on a phone.
  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS + 120);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Bubbles spread evenly either side of straight up.
  const angles = actions.length === 1
    ? [90]
    : actions.map((_, i) => 90 + SPREAD - (i * (2 * SPREAD)) / (actions.length - 1));

  const pick = (fn: () => void) => { setOpen(false); window.setTimeout(fn, 10); };

  // Each bubble starts folded on the left end of the arc and rotates along it to
  // its own place. rotate/translate/rotate keeps it upright while the angle
  // animates, so it travels on the circle instead of sliding in a straight line.
  const sweep = (deg: number, travel: number): React.CSSProperties => {
    const a = shown ? deg : ARC_START;
    return {
      transform: `rotate(${-a}deg) translateX(${RADIUS}px) rotate(${a}deg) scale(${shown ? 1 : 0.8})`,
      opacity: shown ? 1 : 0,
      transition: `transform ${shown ? OPEN_MS : CLOSE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${shown ? 180 : 200}ms ease ${shown ? '0ms' : `${Math.round(60 + (1 - travel) * 60)}ms`}`,
    };
  };

  const ticks = Array.from({ length: Math.floor((ARC_START - ARC_END) / 6) + 1 }, (_, i) => ARC_START - i * 6);
  const R_TRACK = RADIUS + 36;
  const size = (R_TRACK + 12) * 2;
  const pos = (deg: number, r: number) => ({
    x: Math.cos((deg * Math.PI) / 180) * r,
    y: -Math.sin((deg * Math.PI) / 180) * r,
  });

  return (
    <>
      <style>{`
        @keyframes qrw-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(229,106,60,.45), 0 10px 22px -8px rgba(229,106,60,.8); }
                              50%     { box-shadow: 0 0 0 9px rgba(229,106,60,0),  0 10px 22px -8px rgba(229,106,60,.8); } }
        .qrw-idle { animation: qrw-glow 2.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .qrw-idle { animation: none; } }
      `}</style>

      {mounted && hub && createPortal(
        <div
          className={`md:hidden fixed inset-0 z-[70] transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label={label}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <div className="absolute" style={{ left: hub.x, top: hub.y }} onClick={(e) => e.stopPropagation()}>
            <svg
              width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
              className="absolute pointer-events-none"
              style={{
                left: -size / 2, top: -size / 2,
                transform: `rotate(${shown ? 0 : -90}deg) scale(${shown ? 1 : 0.6})`,
                transition: `transform ${shown ? OPEN_MS : CLOSE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              }}
            >
              {ticks.map((t) => {
                const long = (ARC_START - t) % 30 === 0;
                const a = pos(t, R_TRACK);
                const b = pos(t, R_TRACK - (long ? 10 : 5));
                return (
                  <line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="white"
                        strokeOpacity={long ? 0.85 : 0.4} strokeWidth={long ? 2 : 1.2} strokeLinecap="round" />
                );
              })}
            </svg>

            {actions.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(a.onSelect)}
                aria-label={a.label}
                className="absolute -ml-9 -mt-9 w-[4.5rem] flex flex-col items-center gap-1 active:scale-90"
                style={sweep(angles[i], i / Math.max(1, actions.length - 1))}
              >
                <span className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center ${a.tone}`}>
                  <a.icon size={24} />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-white drop-shadow whitespace-nowrap">{a.label}</span>
              </button>
            ))}

            {/* The hub: the same C tile as the bar's button, turning into a cross. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -ml-7 -mt-7 w-14 h-14 rounded-2xl flex items-center justify-center text-white"
              style={{
                // Inline, not `.cp-logo-mark`: this layer is portalled to <body>,
                // outside the `.client-portal` wrapper that class is scoped to —
                // which left the hub transparent, with the dimmed real button
                // showing through it.
                background: 'linear-gradient(135deg, #f79b70 0%, #e56a3c 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 8px 16px -8px rgba(229,106,60,.8)',
                transform: `rotate(${shown ? 90 : 0}deg)`,
                transition: `transform ${shown ? OPEN_MS : CLOSE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              }}
            >
              <span className="absolute inset-0 p-2.5 transition-opacity duration-200" style={{ opacity: shown ? 0 : 1 }}>
                <BrandMark title="" />
              </span>
              <X size={26} className="absolute transition-opacity duration-200" style={{ opacity: shown ? 1 : 0, transform: 'rotate(-90deg)' }} />
            </button>
          </div>
        </div>,
        document.body
      )}

      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        className={`cp-logo-mark w-14 h-14 rounded-2xl flex items-center justify-center -translate-y-6 border-4 active:scale-90 transition-transform ${open ? '' : 'qrw-idle'}`}
        style={{ borderColor: 'var(--cp-surface)' }}
      >
        <span className="block w-full h-full p-2"><BrandMark title="" /></span>
      </button>
    </>
  );
};

export default QuickRecordWheel;

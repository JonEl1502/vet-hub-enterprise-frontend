import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, SkipForward } from 'lucide-react';
import { useTour } from '../../../../contexts/TourContext';

interface Rect { top: number; left: number; width: number; height: number; }

const PADDING = 6;
const CARD_OFFSET = 14;
const CARD_WIDTH = 320;
const CARD_HEIGHT_ESTIMATE = 220;

const findTarget = (selector: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(selector)}"]`);

// Poll for an element to appear (handles route transitions, async-rendered forms).
const waitForTarget = (selector: string, timeoutMs = 2500): Promise<HTMLElement | null> =>
  new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      const el = findTarget(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });

const TourOverlay: React.FC = () => {
  const { isActive, currentStep, currentIndex, activeTour, next, back, skip, autoSkip } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);

  // Find target whenever step changes; poll briefly to handle nav transitions.
  useEffect(() => {
    if (!isActive || !currentStep) return;
    let cancelled = false;
    let timeoutId: number | undefined;
    setRect(null);
    setMissing(false);
    setAwaiting(false);
    targetRef.current = null;

    const lockOnto = (el: HTMLElement) => {
      targetRef.current = el;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      timeoutId = window.setTimeout(measure, 350);
    };

    const run = async () => {
      // Some targets only mount after a route transition or async data load —
      // honour an explicit settle delay before we start looking.
      if (currentStep.waitMs) {
        await new Promise<void>(resolve => { timeoutId = window.setTimeout(resolve, currentStep.waitMs); });
        if (cancelled) return;
      }

      // awaitInteraction: the target only appears after the user does something
      // (e.g. picks an owner/client, which renders the dependent fields). If it
      // isn't present yet, go NON-BLOCKING and wait so the user can interact;
      // advance the moment the field appears.
      if (currentStep.awaitInteraction) {
        let el = findTarget(currentStep.target);
        if (!el) {
          setAwaiting(true);
          el = await waitForTarget(currentStep.target, 180000); // up to 3 min
          if (cancelled) return;
          setAwaiting(false);
        }
        if (!el) { autoSkip(); return; } // user never acted — skip on
        lockOnto(el);
        return;
      }

      // Optional steps (e.g. fields that only appear once a prior choice is
      // made) get a shorter window so auto-skip feels snappy.
      const el = await waitForTarget(currentStep.target, currentStep.optional ? 1200 : 2500);
      if (cancelled) return;
      if (!el) {
        if (currentStep.optional) { autoSkip(); return; }
        setMissing(true);
        return;
      }
      lockOnto(el);
    };
    run();

    return () => { cancelled = true; if (timeoutId) window.clearTimeout(timeoutId); };
  }, [isActive, currentStep?.target, currentIndex]);

  const measure = () => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  // Reposition on scroll / resize while step is open.
  useLayoutEffect(() => {
    if (!isActive) return;
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [isActive]);

  if (!isActive || !currentStep || !activeTour) return null;

  const totalSteps = activeTour.steps.length;
  const isLast = currentIndex === totalSteps - 1;
  const isFirst = currentIndex === 0;

  // Card placement — auto picks the side with more room, defaults to below.
  const placeCard = (): { top: number; left: number; arrow: 'top' | 'bottom' | 'left' | 'right' | 'none' } => {
    // While waiting for the user to act, sit at the bottom so the form above
    // stays visible and clickable.
    if (awaiting && !rect) {
      return {
        top: Math.max(20, window.innerHeight - CARD_HEIGHT_ESTIMATE - 24),
        left: Math.max(20, window.innerWidth / 2 - CARD_WIDTH / 2),
        arrow: 'none',
      };
    }
    if (!rect || missing) {
      return {
        top: Math.max(20, window.innerHeight / 2 - CARD_HEIGHT_ESTIMATE / 2),
        left: Math.max(20, window.innerWidth / 2 - CARD_WIDTH / 2),
        arrow: 'none',
      };
    }
    const preferred = currentStep.placement ?? 'auto';
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const spaceRight = window.innerWidth - (rect.left + rect.width);
    const spaceLeft = rect.left;

    let side: 'top' | 'bottom' | 'left' | 'right';
    if (preferred === 'auto') {
      const candidates = [
        { side: 'bottom' as const, space: spaceBelow },
        { side: 'top' as const, space: spaceAbove },
        { side: 'right' as const, space: spaceRight },
        { side: 'left' as const, space: spaceLeft },
      ];
      side = candidates.sort((a, b) => b.space - a.space)[0].side;
    } else {
      side = preferred;
    }

    let top = 0, left = 0;
    if (side === 'bottom') {
      top = rect.top + rect.height + CARD_OFFSET;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    } else if (side === 'top') {
      top = rect.top - CARD_HEIGHT_ESTIMATE - CARD_OFFSET;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    } else if (side === 'right') {
      top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2;
      left = rect.left + rect.width + CARD_OFFSET;
    } else {
      top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2;
      left = rect.left - CARD_WIDTH - CARD_OFFSET;
    }

    // Clamp into viewport
    left = Math.max(12, Math.min(window.innerWidth - CARD_WIDTH - 12, left));
    top = Math.max(12, Math.min(window.innerHeight - CARD_HEIGHT_ESTIMATE - 12, top));
    return { top, left, arrow: side };
  };

  const { top, left, arrow } = placeCard();

  // Spotlight cutout — SVG mask makes a hole at the target rect.
  const renderSpotlight = () => {
    // Awaiting a user action: dim lightly but let clicks pass through so the
    // user can actually make the selection that renders the next target.
    if (awaiting && !rect) {
      return <div className="fixed inset-0 bg-pine/20 dark:bg-black/30 pointer-events-none" style={{ zIndex: 999 }} />;
    }
    if (!rect || missing) {
      return <div className="fixed inset-0 bg-pine/60 dark:bg-black/70 backdrop-blur-[2px] pointer-events-auto" onClick={skip} />;
    }
    return (
      <svg
        className="fixed inset-0 w-screen h-screen pointer-events-auto"
        style={{ zIndex: 999 }}
        onClick={skip}
      >
        <defs>
          <mask id="tour-cutout">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - PADDING}
              y={rect.top - PADDING}
              width={rect.width + PADDING * 2}
              height={rect.height + PADDING * 2}
              rx={10}
              ry={10}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 47, 60, 0.65)"
          mask="url(#tour-cutout)"
        />
        {/* Glowing ring around target */}
        <rect
          x={rect.left - PADDING}
          y={rect.top - PADDING}
          width={rect.width + PADDING * 2}
          height={rect.height + PADDING * 2}
          rx={10}
          ry={10}
          fill="none"
          stroke="rgb(74, 222, 220)"
          strokeWidth={2}
          className="animate-pulse"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    );
  };

  const arrowClasses: Record<typeof arrow, string> = {
    top: 'absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-zinc-900 border-r border-b border-slate-200 dark:border-zinc-800',
    bottom: 'absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-zinc-900 border-l border-t border-slate-200 dark:border-zinc-800',
    left: 'absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-white dark:bg-zinc-900 border-t border-r border-slate-200 dark:border-zinc-800',
    right: 'absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-white dark:bg-zinc-900 border-b border-l border-slate-200 dark:border-zinc-800',
    none: 'hidden',
  };

  return createPortal(
    <>
      {renderSpotlight()}
      <div
        role="dialog"
        aria-label={currentStep.title}
        className="fixed bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-200"
        style={{ top, left, width: CARD_WIDTH, zIndex: 1000 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={arrowClasses[arrow]} />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <activeTour.icon size={14} className="text-seafoam shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-widest text-seafoam truncate">
              {activeTour.name} · Step {currentIndex + 1} of {totalSteps}
            </span>
          </div>
          <button
            onClick={skip}
            aria-label="Close tour"
            className="p-1 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X size={14} />
          </button>
        </div>

        <h3 className="text-pine dark:text-zinc-100 font-black text-sm mb-2 leading-tight">{currentStep.title}</h3>
        <p className="text-slate-500 dark:text-zinc-400 text-[11px] leading-relaxed font-medium mb-4">{currentStep.body}</p>

        {missing && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mb-3 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
            Couldn't find this element on screen. You can still continue the tour.
          </p>
        )}

        {awaiting && (
          <p className="text-[10px] text-seafoam font-bold mb-3 bg-seafoam/10 p-2 rounded-lg flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-seafoam animate-pulse shrink-0" />
            Make the selection above — the tour continues automatically once the fields appear.
          </p>
        )}

        <div className="flex items-center gap-1 mb-4">
          {activeTour.steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx === currentIndex ? 'bg-seafoam' : idx < currentIndex ? 'bg-seafoam/40' : 'bg-slate-200 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={skip}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors"
          >
            <SkipForward size={11} /> Skip
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={back}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              >
                <ArrowLeft size={11} /> Back
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-[10px] font-black uppercase tracking-widest shadow active:scale-95 transition-all"
            >
              {isLast ? 'Finish' : 'Next'} <ArrowRight size={11} />
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default TourOverlay;

/**
 * <Wizard> — shared multi-step form shell.
 *
 * Used by Clinic / Supplier / Freelancer add/edit flows so they all share
 * the same stepper UX and keyboard handling. The parent owns the form
 * state — this component only handles step navigation, validation gating,
 * and the surrounding chrome (header, stepper, footer).
 *
 * Validation: each step can supply a `validate()` returning either:
 *   - true                 → step is valid, allow Next
 *   - false                → invalid (no specific message; Next disabled)
 *   - string               → invalid with an error message shown below the body
 *
 * The final step's primary action says "Finish" (or whatever you pass via
 * `finishLabel`) and triggers `onFinish()` instead of advancing.
 */

import React, { ReactNode, useMemo, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react';

export interface WizardStep {
  /** Stable id (e.g. 'identity', 'branding'). */
  id: string;
  /** Short label shown in the stepper. */
  label: string;
  /** Optional icon for the step bubble. */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Optional sub-label / hint shown under the step title. */
  description?: string;
  /**
   * Optional gate. Return true to allow Next, false to block silently,
   * or a string to block with an inline error message.
   */
  validate?: () => boolean | string;
}

interface WizardProps {
  steps: WizardStep[];
  /** Big title shown at the top (e.g. "Add Clinic"). */
  title: string;
  /** Small subtitle under the title. */
  subtitle?: string;
  /** Called when the user clicks Cancel or the X in the header. */
  onCancel: () => void;
  /** Called when the user clicks the primary button on the final step. */
  onFinish: () => void | Promise<void>;
  /** Render-prop receiving the current step id. Parent decides what fields to show. */
  children: (currentStepId: string) => ReactNode;
  /** Override the primary button label on the last step. Defaults to "Finish". */
  finishLabel?: string;
  /** When true, footer's primary button shows a spinner and is disabled. */
  isSubmitting?: boolean;
  /** Top-level error banner (e.g. server error). */
  error?: string | null;
}

const Wizard: React.FC<WizardProps> = ({
  steps,
  title,
  subtitle,
  onCancel,
  onFinish,
  children,
  finishLabel = 'Finish',
  isSubmitting = false,
  error,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const current = steps[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === steps.length - 1;

  /** Run the current step's validate(); returns true if we can proceed. */
  const checkStep = useCallback(() => {
    if (!current?.validate) return true;
    const result = current.validate();
    if (result === true) {
      setStepError(null);
      return true;
    }
    setStepError(typeof result === 'string' ? result : null);
    return false;
  }, [current]);

  const handleNext = () => {
    if (!checkStep()) return;
    if (isLast) {
      void onFinish();
    } else {
      setCurrentIdx((i) => i + 1);
      setStepError(null);
    }
  };

  const handleBack = () => {
    if (isFirst) return;
    setCurrentIdx((i) => i - 1);
    setStepError(null);
  };

  // Click any prior step in the stepper to jump back to it (forward jumps
  // are blocked — must satisfy validation step-by-step).
  const handleJumpTo = (idx: number) => {
    if (idx >= currentIdx) return;
    setCurrentIdx(idx);
    setStepError(null);
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex items-center justify-between py-3 mb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-seafoam dark:text-zinc-400 font-bold mt-1 uppercase tracking-widest text-[9px]">
              {subtitle}
            </p>
          )}
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-pine shrink-0"
          title="Close"
        >
          <X size={16} />
        </button>
      </header>

      {/* Stepper */}
      <Stepper steps={steps} currentIdx={currentIdx} onJump={handleJumpTo} />

      {/* Body — parent renders fields based on current step id */}
      <div className="mt-4 mb-4">
        {children(current.id)}
      </div>

      {/* Inline step error */}
      {stepError && (
        <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-xs font-bold text-red-600 dark:text-red-400">{stepError}</p>
        </div>
      )}

      {/* Top-level error (e.g. server) */}
      {error && (
        <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-zinc-800 -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirst}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>

        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
          Step {currentIdx + 1} of {steps.length}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-md hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting
              ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
              : isLast
                ? <>{finishLabel} <Check size={12} /></>
                : <>Next <ArrowRight size={12} /></>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

/** The horizontal step indicator at the top. Bubble + label under it. */
const Stepper: React.FC<{
  steps: WizardStep[];
  currentIdx: number;
  onJump: (idx: number) => void;
}> = ({ steps, currentIdx, onJump }) => {
  return (
    <ol className="flex items-start justify-between gap-1 sm:gap-2">
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isClickable = idx < currentIdx;
        const Icon = step.icon;
        return (
          <React.Fragment key={step.id}>
            <li className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onJump(idx)}
                disabled={!isClickable}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[10px] font-black transition-all shrink-0 ${
                  isDone
                    ? 'bg-seafoam text-white shadow-sm hover:bg-seafoam/90 cursor-pointer'
                    : isCurrent
                      ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine ring-4 ring-pine/10 dark:ring-zinc-100/10 shadow-md'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                } ${!isClickable ? 'cursor-default' : ''}`}
                title={step.label}
              >
                {isDone
                  ? <Check size={14} />
                  : Icon
                    ? <Icon size={14} />
                    : <span>{idx + 1}</span>
                }
              </button>
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center leading-tight px-0.5 ${
                isCurrent
                  ? 'text-pine dark:text-zinc-100'
                  : isDone
                    ? 'text-seafoam'
                    : 'text-slate-400 dark:text-zinc-500'
              }`}>
                {step.label}
              </span>
            </li>
            {idx < steps.length - 1 && (
              <div
                className={`hidden sm:block flex-1 h-0.5 mt-4 sm:mt-4.5 rounded transition-colors ${
                  idx < currentIdx ? 'bg-seafoam' : 'bg-slate-100 dark:bg-zinc-800'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
};

export default Wizard;

import React from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface Step {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface Props {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

const StepIndicator: React.FC<Props> = ({ steps, currentStep, onStepClick }) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index < currentStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={`
                    relative w-10 h-10 rounded-full border-2 flex items-center justify-center
                    transition-all duration-300 mb-2
                    ${isCompleted
                      ? 'bg-seafoam border-seafoam text-white shadow-lg shadow-seafoam/30'
                      : isCurrent
                      ? 'bg-white dark:bg-zinc-900 border-seafoam text-seafoam shadow-lg'
                      : 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-400'
                    }
                    ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                  `}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <Check size={20} strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <span className="font-black text-sm">
                      {index + 1}
                    </span>
                  )}

                  {/* Pulse animation for current step */}
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-seafoam"
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </button>

                {/* Label */}
                <div className="text-center">
                  <p className={`
                    text-[10px] font-black uppercase tracking-widest transition-colors
                    ${isCurrent
                      ? 'text-seafoam'
                      : isCompleted
                      ? 'text-pine dark:text-zinc-100'
                      : 'text-slate-400 dark:text-zinc-600'
                    }
                  `}>
                    {step.label}
                  </p>
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-8 relative">
                  <div className="absolute inset-0 bg-slate-200 dark:bg-zinc-800 rounded-full" />
                  <motion.div
                    className="absolute inset-0 bg-seafoam rounded-full origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: index < currentStep ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;


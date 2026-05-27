import React from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Play, Compass } from 'lucide-react';
import { useTour } from '../../../../contexts/TourContext';

const TourMenu: React.FC = () => {
  const { isMenuOpen, closeMenu, tours, completedTours, startTour } = useTour();

  if (!isMenuOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-pine/60 dark:bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeMenu}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-seafoam" />
            <p className="text-pine dark:text-zinc-100 font-black text-sm">Take a tour</p>
          </div>
          <button
            onClick={closeMenu}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-pine dark:hover:text-zinc-100 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-3">
          <p className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium leading-relaxed">
            Pick a module to walk through. We'll highlight the key buttons and explain what each one does.
          </p>
        </div>

        <div className="p-3 space-y-2">
          {tours.map(tour => {
            const done = completedTours.includes(tour.id);
            return (
              <button
                key={tour.id}
                onClick={() => startTour(tour.id)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0">
                  <tour.icon size={18} className="text-seafoam" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-pine dark:text-zinc-100 font-black text-xs truncate">{tour.name}</p>
                    {done && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-widest">
                        <Check size={8} /> Done
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-medium mt-0.5 leading-tight line-clamp-2">
                    {tour.description}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {tour.steps.length} steps
                  </p>
                </div>
                <Play size={14} className="text-slate-300 group-hover:text-seafoam shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded font-mono">Esc</kbd> to exit · <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded font-mono">→</kbd> Next · <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded font-mono">←</kbd> Back
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TourMenu;

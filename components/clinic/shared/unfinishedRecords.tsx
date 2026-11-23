import React from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, ArrowRight, FlaskConical, ScanLine, Scissors, Slice, X } from 'lucide-react';

export interface OpenRecord { kind: string; id?: string; name: string; status: string }
export type UnfinishedChoice = { action: 'bill' } | { action: 'open'; rec: OpenRecord } | { action: 'close' };

const ICON: Record<string, React.ComponentType<any>> = { Lab: FlaskConical, Imaging: ScanLine, Surgery: Slice, Grooming: Scissors };

/**
 * "Something is still open" — with a way to EACH thing (2026-11-23, a clinic:
 * "say there was a grooming not marked completed — instead of just telling you
 * something isn't completed, take you to that thing itself, so you're not
 * confused"). The old confirm listed every open record but could only take you
 * to the FIRST one; this lists them all, each with its own Open button, and
 * keeps "Bill anyway" as the deliberate alternative.
 *
 * Imperative (returns a promise) so the two approve flows — the visit page and
 * the bill panel — read the same as the dialog.confirm they replace.
 */
export function askUnfinishedRecords(open: OpenRecord[]): Promise<UnfinishedChoice> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (c: UnfinishedChoice) => { root.unmount(); host.remove(); resolve(c); };
    const Dialog: React.FC = () => {
      React.useEffect(() => {
        const k = (e: KeyboardEvent) => { if (e.key === 'Escape') done({ action: 'close' }); };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
      }, []);
      return (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[2px]" onClick={() => done({ action: 'close' })}>
          <div role="dialog" aria-label="Records still open"
            className="w-full sm:max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 px-5 pt-5">
              <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0"><AlertTriangle size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black text-pine dark:text-zinc-100">
                  {open.length === 1 ? '1 thing is still open' : `${open.length} things are still open`}
                </p>
                <p className="text-[12px] text-slate-500 dark:text-zinc-400 mt-0.5">Approving locks the record, so finish these first. Tap one to go straight to it.</p>
              </div>
              <button onClick={() => done({ action: 'close' })} aria-label="Close" className="p-1 text-slate-400 hover:text-pine"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-2 max-h-[50vh] overflow-y-auto">
              {open.map((r, i) => {
                const Icon = ICON[r.kind] ?? AlertTriangle;
                return (
                  <button key={`${r.kind}-${r.id ?? i}`} type="button" onClick={() => done({ action: 'open', rec: r })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-seafoam hover:bg-seafoam/5 text-left active:scale-[0.98] transition">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center shrink-0"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-pine dark:text-zinc-100 truncate">{r.name}</span>
                      <span className="block text-[11px] text-slate-500">{r.kind} · <span className="text-amber-600 font-semibold">{r.status}</span></span>
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-seafoam">Open <ArrowRight size={13} /></span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button type="button" onClick={() => done({ action: 'close' })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-600 dark:text-zinc-300">Not now</button>
              <button type="button" onClick={() => done({ action: 'bill' })}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold active:scale-[0.98]">Bill anyway</button>
            </div>
          </div>
        </div>
      );
    };
    root.render(<Dialog />);
  });
}

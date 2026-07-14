import React from 'react';
import { createPortal } from 'react-dom';
import { X, Milestone, Zap, AlertTriangle, Coins, Info } from 'lucide-react';
import { JourneyEvent, JourneyKind } from './types';
import { formatDate, formatTime } from '../../../../services/utils/dateFormatter';

// The Patient Journey — a per-visit, timestamped roadmap of everything that
// happened. Reused in three surfaces: the wizard's live sidebar, the Journey
// drawer on the visit detail page, and (later) read-only visit views.

const KIND_STYLE: Record<JourneyKind, { dot: string; icon: React.ElementType }> = {
  milestone: { dot: 'bg-seafoam', icon: Milestone },
  action:    { dot: 'bg-slate-400 dark:bg-zinc-500', icon: Zap },
  alert:     { dot: 'bg-red-500', icon: AlertTriangle },
  billing:   { dot: 'bg-amber-500', icon: Coins },
  info:      { dot: 'bg-cyan-500', icon: Info },
};

export const JourneyTimeline: React.FC<{ events: JourneyEvent[]; compact?: boolean; onNavigate?: (e: JourneyEvent) => void }> = ({ events, compact, onNavigate }) => {
  if (events.length === 0) {
    return <p className="text-[10px] text-slate-400 dark:text-zinc-500 py-4 text-center">No journey events yet — actions during the visit appear here.</p>;
  }
  let lastDay = '';
  return (
    <ol className="relative ml-1.5 border-l border-slate-200 dark:border-zinc-800">
      {events.map(e => {
        const day = formatDate(e.at);
        const showDay = day !== lastDay;
        lastDay = day;
        const s = KIND_STYLE[e.kind] || KIND_STYLE.info;
        return (
          <li key={e.id} className="relative pl-4 pb-3 last:pb-0">
            {showDay && !compact && (
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1 -ml-1">{day}</p>
            )}
            <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${s.dot}`} />
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[9px] font-bold text-slate-400 dark:text-zinc-500 shrink-0">{formatTime(e.at)}</span>
              {onNavigate ? (
                <button type="button" onClick={() => onNavigate(e)} title="Jump to where this happened"
                  className={`text-left text-[11px] font-bold leading-snug hover:underline decoration-dotted underline-offset-2 transition-colors ${e.kind === 'alert' ? 'text-red-600 dark:text-red-400 hover:text-red-700' : 'text-pine dark:text-zinc-200 hover:text-seafoam dark:hover:text-seafoam'}`}>
                  {e.label}
                </button>
              ) : (
                <span className={`text-[11px] font-bold leading-snug ${e.kind === 'alert' ? 'text-red-600 dark:text-red-400' : 'text-pine dark:text-zinc-200'}`}>{e.label}</span>
              )}
            </div>
            {e.auto && !compact && <span className="ml-12 text-[7px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-400 px-1 py-0.5 rounded">auto</span>}
          </li>
        );
      })}
    </ol>
  );
};

// Slide-over drawer so the journey is reachable from ANY tab of the visit —
// not only inside the wizard.
export const JourneyDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  events: JourneyEvent[];
  petName?: string;
  // Clicking an event jumps to where it happened (wizard step / tab).
  onNavigate?: (e: JourneyEvent) => void;
}> = ({ open, onClose, events, petName, onNavigate }) => {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-br from-pine to-pine/90 text-white">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/60">Patient Journey</p>
            <h3 className="text-sm font-black uppercase tracking-tight">{petName ? `${petName} — this visit` : 'This visit'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <JourneyTimeline events={events} onNavigate={onNavigate} />
        </div>
        <div className="px-4 py-2 border-t border-slate-200 dark:border-zinc-800">
          <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{events.length} event{events.length === 1 ? '' : 's'} · timestamped roadmap of this visit</p>
        </div>
      </aside>
    </div>,
    document.body
  );
};

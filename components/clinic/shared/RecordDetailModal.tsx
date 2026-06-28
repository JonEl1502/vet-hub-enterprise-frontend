import React from 'react';
import { X } from 'lucide-react';

export interface DetailField { label: string; value?: React.ReactNode; }

/**
 * Generic read-only details modal (reminders, appointments, …). Shows a header,
 * a labelled field grid, and an optional action row passed as children.
 */
const RecordDetailModal: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  fields: DetailField[];
  onClose: () => void;
  children?: React.ReactNode;
}> = ({ title, subtitle, icon, fields, onClose, children }) => (
  <div className="fixed inset-0 z-[270] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl">
      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-pine shrink-0"><X size={18} /></button>
      </div>
      <div className="px-5 pb-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.filter(f => f.value !== undefined && f.value !== null && f.value !== '').map((f, i) => (
          <div key={i} className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{f.label}</p>
            <div className="text-[12px] font-bold text-pine dark:text-zinc-100 break-words">{f.value}</div>
          </div>
        ))}
      </div>
      {children && <div className="p-5 pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-2">{children}</div>}
    </div>
  </div>
);

export default RecordDetailModal;

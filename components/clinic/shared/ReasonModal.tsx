import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import BrandMark from '../../shared/common/BrandMark';

/**
 * Capture a reason (preset choice chips + free text) for an action like
 * cancelling an appointment or dismissing a reminder — so we know why it didn't
 * progress (e.g. reminder→appointment, appointment→visit). Clicking a chip adds
 * it to the text; the final text is returned to onConfirm.
 */
const ReasonModal: React.FC<{
  title: string;
  subtitle?: string;
  chips: string[];
  confirmLabel?: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}> = ({ title, subtitle, chips, confirmLabel = 'Confirm', submitting, onCancel, onConfirm }) => {
  const [text, setText] = useState('');
  const addChip = (c: string) => setText(t => (t.trim() ? `${t.trim()} · ${c}` : c));

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
        {/* Brand header — logo top-left */}
        <div className="flex items-center justify-between gap-3 -mt-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pine flex items-center justify-center p-1.5 shrink-0">
              <BrandMark color="#FFFFFF" />
            </div>
            <span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">VetHub Core</span>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-pine shrink-0"><X size={18} /></button>
        </div>
        <div>
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map(c => (
            <button key={c} type="button" onClick={() => addChip(c)} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-500 hover:border-seafoam hover:text-seafoam transition-all">{c}</button>
          ))}
        </div>

        <textarea
          autoFocus rows={3} value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a reason… (tap a chip above or type)"
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
        />

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Back</button>
          <button onClick={() => onConfirm(text.trim())} disabled={submitting || !text.trim()} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReasonModal;

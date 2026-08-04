import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Info, Loader2 } from 'lucide-react';
import BrandMark from './BrandMark';
import type { PromptOptions, DialogVariant } from '../../../services/utils/dialog';

/**
 * Themed replacement for native `prompt()` — a confirm that also collects a
 * line of text. The browser's own box says "app.vethubcore.com says", carries
 * no branding and cannot be styled (user, 2026-08-04: "modal please with logo").
 */
const TONE: Record<DialogVariant, { ring: string; head: string; btn: string; icon: any }> = {
  danger:  { ring: 'ring-rose-500/20',   head: 'bg-rose-600',    btn: 'bg-rose-600 hover:bg-rose-700',       icon: AlertTriangle },
  warning: { ring: 'ring-amber-500/20',  head: 'bg-amber-500',   btn: 'bg-amber-500 hover:bg-amber-600',     icon: AlertTriangle },
  info:    { ring: 'ring-seafoam/20',    head: 'bg-pine',        btn: 'bg-seafoam hover:bg-seafoam/90',      icon: Info },
};

const PromptDialog: React.FC<{
  open: boolean;
  opts: PromptOptions;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}> = ({ open, opts, onCancel, onConfirm }) => {
  const [value, setValue] = React.useState(opts.defaultValue ?? '');
  const [busy] = React.useState(false);
  React.useEffect(() => { if (open) setValue(opts.defaultValue ?? ''); }, [open, opts.defaultValue]);
  if (!open) return null;

  const tone = TONE[opts.variant ?? 'warning'];
  const canSubmit = !opts.required || value.trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-[900] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onCancel}>
      <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden ring-4 ${tone.ring} animate-in zoom-in-95 duration-200`}
        onClick={e => e.stopPropagation()}>
        <div className={`${tone.head} px-5 py-4 flex items-start gap-3`}>
          <span className="shrink-0 mt-0.5 w-6 h-6"><BrandMark className="w-6 h-6" color="currentColor" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.2em]">VetHub Core</p>
            <p className="text-base font-black text-white uppercase tracking-tight leading-tight">
              {opts.title || 'Confirm'}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 shrink-0"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12px] font-medium text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">{opts.message}</p>

          <div>
            {opts.label && (
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{opts.label}</label>
            )}
            <input
              type="text" autoFocus value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) onConfirm(value); if (e.key === 'Escape') onCancel(); }}
              placeholder={opts.placeholder}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
              {opts.cancelLabel || 'Cancel'}
            </button>
            <button onClick={() => onConfirm(value)} disabled={!canSubmit || busy}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 ${tone.btn}`}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <tone.icon size={13} />}
              {opts.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PromptDialog;

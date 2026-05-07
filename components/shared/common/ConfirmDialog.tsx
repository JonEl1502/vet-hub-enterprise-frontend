import React, { useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  /** When true, hides the cancel button — use for alert-style notices. */
  alertOnly?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  alertOnly = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  // Close on Escape, confirm on Enter — keeps keyboard parity with native confirm.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (alertOnly) onConfirm();
        else onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, alertOnly, onConfirm, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';
  const isInfo = variant === 'info';

  const iconBg = isDanger
    ? 'bg-red-100 dark:bg-red-950/40'
    : isInfo
    ? 'bg-seafoam/10 dark:bg-seafoam/20'
    : 'bg-amber-100 dark:bg-amber-950/40';
  const iconColor = isDanger
    ? 'text-red-600 dark:text-red-400'
    : isInfo
    ? 'text-seafoam'
    : 'text-amber-600 dark:text-amber-400';
  const confirmBg = isDanger
    ? 'bg-red-600 hover:bg-red-700'
    : isInfo
    ? 'bg-seafoam hover:bg-seafoam/90'
    : 'bg-amber-500 hover:bg-amber-600';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={alertOnly ? onConfirm : onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${iconBg}`}>
          {isInfo ? (
            <Info size={22} className={iconColor} />
          ) : (
            <AlertTriangle size={22} className={iconColor} />
          )}
        </div>

        {/* Text */}
        <div className="text-center">
          <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100 mb-1">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!alertOnly && (
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={loading}
            autoFocus
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50 ${confirmBg}`}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

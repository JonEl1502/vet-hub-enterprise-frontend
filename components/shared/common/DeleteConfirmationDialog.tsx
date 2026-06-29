import React from 'react';
import { X } from 'lucide-react';
import BrandMark from './BrandMark';

export type DeleteDialogTone = 'danger' | 'warning';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  entityName?: string;
  isDeleting?: boolean;
  confirmLabel?: string;
  busyLabel?: string;
  entityLabel?: string;
  warning?: string | null;
  tone?: DeleteDialogTone;
}

const TONE_STYLES: Record<DeleteDialogTone, {
  box: string;
  boxLabel: string;
  boxText: string;
  button: string;
}> = {
  danger: {
    box: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30',
    boxLabel: 'text-red-600 dark:text-red-400',
    boxText: 'text-red-700 dark:text-red-300',
    button: 'bg-red-600 hover:bg-red-700 shadow-red-600/20',
  },
  warning: {
    box: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30',
    boxLabel: 'text-amber-700 dark:text-amber-400',
    boxText: 'text-amber-800 dark:text-amber-300',
    button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
  },
};

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  entityName,
  isDeleting = false,
  confirmLabel = 'Delete',
  busyLabel,
  entityLabel = 'Entity to Delete:',
  warning = 'This action cannot be undone.',
  tone = 'danger',
}) => {
  if (!isOpen) return null;

  const styles = TONE_STYLES[tone];
  const busy = busyLabel || `${confirmLabel.replace(/e$/, '')}ing...`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pine flex items-center justify-center p-2 shrink-0">
              <BrandMark color="#FFFFFF" />
            </div>
            <div>
              <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                {title}
              </h2>
              <p className="text-[8px] font-bold text-seafoam/70 dark:text-zinc-500 uppercase tracking-widest mt-0.5">
                VetHubCore Enterprise
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            disabled={isDeleting}
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">
            {message}
          </p>
          {entityName && (
            <div className={`mt-4 p-4 border rounded-2xl ${styles.box}`}>
              <p className={`text-xs font-black uppercase tracking-wider mb-1 ${styles.boxLabel}`}>
                {entityLabel}
              </p>
              <p className={`text-sm font-bold ${styles.boxText}`}>
                {entityName}
              </p>
            </div>
          )}
          {warning && (
            <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500 italic">
              {warning}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={`flex-1 px-6 py-3 text-white rounded-xl font-black text-sm uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${styles.button}`}
          >
            {isDeleting ? busy : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationDialog;

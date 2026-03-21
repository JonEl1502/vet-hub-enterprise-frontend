import React from 'react';
import { XCircle } from 'lucide-react';

interface ErrorDialogProps {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

const ErrorDialog: React.FC<ErrorDialogProps> = ({
  open,
  title = 'Something went wrong',
  message,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto bg-red-100 dark:bg-red-950/40">
          <XCircle size={22} className="text-red-600 dark:text-red-400" />
        </div>

        {/* Text */}
        <div className="text-center">
          <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100 mb-1 uppercase tracking-wide">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{message}</p>
        </div>

        {/* Action */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-black text-white uppercase tracking-widest transition-all active:scale-95"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default ErrorDialog;

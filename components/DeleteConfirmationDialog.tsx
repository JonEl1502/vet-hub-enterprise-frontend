import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  entityName?: string;
  isDeleting?: boolean;
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  entityName,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            disabled={isDeleting}
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed">
            {message}
          </p>
          {entityName && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl">
              <p className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">
                Entity to Delete:
              </p>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">
                {entityName}
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500 italic">
            This action cannot be undone.
          </p>
        </div>

        {/* Footer */}
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
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationDialog;


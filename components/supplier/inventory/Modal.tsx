import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * The stockroom's own dialog frame — small enough that borrowing the clinic's
 * would couple two lanes for a header, a scrim and an Escape key.
 */
const Modal: React.FC<{
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ title, onClose, wide, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // A dialog that leaves the page scrolling behind it feels broken on touch.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        } max-h-[92vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-sm font-black uppercase tracking-wider text-pine dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-pine" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Modal;

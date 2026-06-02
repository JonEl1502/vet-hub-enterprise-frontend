import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

// Minimal portal-styled modal. Click backdrop or X to close.
const CpModal: React.FC<{ title: string; onClose: () => void; children: ReactNode; maxWidth?: string }> = ({
  title, onClose, children, maxWidth = '32rem',
}) => (
  <div className="client-portal fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
       style={{ background: 'rgba(31,61,57,0.4)' }}
       onClick={onClose}>
    <div className="cp-card w-full overflow-hidden rounded-b-none sm:rounded-3xl"
         style={{ maxWidth }}
         onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--cp-border)' }}>
        <h3 className="font-black text-lg" style={{ color: 'var(--cp-ink)' }}>{title}</h3>
        <button onClick={onClose} className="cp-muted hover:opacity-70"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

export default CpModal;

import React, { ReactNode } from 'react';
import { PawPrint } from 'lucide-react';

// Warm, friendly auth shell for the pet-owner portal. Centered card on the
// sand canvas — deliberately softer and rounder than the staff AuthShell.
const ClientAuthShell: React.FC<{ title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }> = ({
  title, subtitle, children, footer,
}) => (
  <div className="client-portal min-h-screen flex flex-col items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
             style={{ background: 'var(--cp-accent)' }}>
          <PawPrint className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--cp-ink)' }}>{title}</h1>
        {subtitle && <p className="text-sm cp-muted mt-1 text-center">{subtitle}</p>}
      </div>
      <div className="cp-card p-6">{children}</div>
      {footer && <div className="text-center mt-5 text-sm cp-muted">{footer}</div>}
    </div>
  </div>
);

export default ClientAuthShell;

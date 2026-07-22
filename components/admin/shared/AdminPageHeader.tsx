import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Shared admin page chrome — a compact, consistent header + page wrapper so
 * every platform page reads the same instead of each shipping its own giant
 * title and ad-hoc padding.
 *
 *   <AdminPage>
 *     <AdminPageHeader title="Plans" subtitle="…" icon={Layers} actions={…} />
 *     …content…
 *   </AdminPage>
 */

export const AdminPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`px-4 sm:px-6 py-5 max-w-7xl mx-auto space-y-5 animate-in fade-in duration-300 ${className}`}>
    {children}
  </div>
);

const AdminPageHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Right-aligned action buttons. */
  actions?: React.ReactNode;
  /** Optional left back button. */
  onBack?: () => void;
}> = ({ title, subtitle, icon: Icon, actions, onBack }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {onBack && (
        <button onClick={onBack} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
      )}
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-seafoam" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase truncate">{title}</h1>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export default AdminPageHeader;

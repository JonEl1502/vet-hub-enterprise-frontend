import React from 'react';
import PageHeader from '../../shared/common/PageHeader';
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

/**
 * Admin page shell.
 *
 * Adds NO page padding on purpose. Every admin view renders through App's
 * content wrapper (`p-4 md:p-6 max-w-screen-2xl mx-auto`), which is the single
 * place page inset is decided — the same wrapper clinic and supplier pages use.
 * This used to add `px-8 py-5` on top of that, so admin pages sat 56px in on
 * desktop against everyone else's 24px, and a cramped 48px on a phone.
 *
 * If a page needs more room, change the wrapper in App.tsx so every audience
 * moves together — don't re-add padding here.
 */
export const AdminPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`space-y-5 animate-in fade-in duration-300 ${className}`}>
    {children}
  </div>
);

const AdminPageHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onBack?: () => void;
  actions?: React.ReactNode;
}> = (props) => <PageHeader {...props} />;

export default AdminPageHeader;

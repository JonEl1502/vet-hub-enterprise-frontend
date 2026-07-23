import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, PawPrint, CalendarDays, MessageCircle, Receipt, CalendarPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClientPortal } from '../../contexts/ClientPortalContext';
import BrandMark from '../shared/common/BrandMark';
import NotificationBell from './NotificationBell';

const NAV = [
  { to: '/client', end: true, label: 'Home', icon: Home },
  { to: '/client/pets', label: 'Pets', icon: PawPrint },
  { to: '/client/appointments', label: 'Visits', icon: CalendarDays },
  { to: '/client/messages', label: 'Messages', icon: MessageCircle },
  { to: '/client/invoices', label: 'Invoices', icon: Receipt },
];

const ClientLayout: React.FC = () => {
  const { user } = useAuth();
  const { invoices, messages } = useClientPortal();
  const navigate = useNavigate();

  const unpaid = invoices.filter((i) => !i.isPaid).length;
  const unread = messages.filter((m) => !m.fromOwner && !m.isRead).length;
  const badgeFor = (to: string) => (to === '/client/invoices' ? unpaid : to === '/client/messages' ? unread : 0);

  const displayName = user?.name || user?.email || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `cp-rail-link ${isActive ? 'cp-rail-active' : ''}`;

  return (
    <div className="client-portal min-h-screen">
      {/* Top bar */}
      <header className="cp-topnav sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 h-16">
        <div className="flex items-center gap-2.5 font-black text-lg">
          <span className="cp-logo-mark w-9 h-9 rounded-xl flex items-center justify-center p-1">
            <BrandMark title="VetHubCore" />
          </span>
          <span>VetHubCore</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live notification center — clinic broadcasts + messages. */}
          <NotificationBell />
          {/* Account entry point — settings (and sign-out) live behind the
              avatar, deliberately out of the main chrome. */}
          <button className="flex items-center gap-3" onClick={() => navigate('/client/settings')} title="Account & settings">
            <span className="text-sm font-bold hidden sm:block">{displayName}</span>
            <span className="cp-avatar">{initial}</span>
          </button>
        </div>
      </header>

      <div className="flex max-w-6xl mx-auto w-full">
        {/* Desktop side rail */}
        <aside className="hidden md:block w-56 shrink-0 p-4 sticky top-16 self-start">
          <nav className="cp-rail flex flex-col gap-1 p-2.5">
            {NAV.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end} className={linkClasses}>
                <span className="cp-rail-icon"><Icon className="w-[18px] h-[18px]" /></span>
                <span className="flex-1">{label}</span>
                {badgeFor(to) > 0 && <span className="cp-chip">{badgeFor(to)}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="cp-rail-promo mt-3">
            <p className="text-sm font-extrabold">Time for a check-up?</p>
            <p className="text-[11px] text-white/70 mt-0.5 mb-2.5">Request a visit and your clinic confirms the time.</p>
            <button className="cp-btn" onClick={() => navigate('/client/appointments')}>
              <CalendarPlus className="w-4 h-4" /> Book a visit
            </button>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 flex border-t"
           style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-border)' }}>
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end}
                   className={({ isActive }) =>
                     `cp-tab flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold ${
                       isActive ? 'cp-tab-active' : ''
                     }`}>
            <Icon className="w-5 h-5" />
            {label}
            {badgeFor(to) > 0 && (
              <span className="absolute top-1.5 right-1/4 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center"
                    style={{ background: 'var(--cp-accent)' }}>{badgeFor(to)}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default ClientLayout;

import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, PawPrint, CalendarDays, MessageCircle, Receipt, CalendarPlus, Sprout, Beef,
  Stethoscope, UserRound,
  Settings, LogOut, Sun, Moon, Monitor, ChevronDown, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode, type ThemeMode } from '../../hooks/useThemeMode';
import { useClientPortal } from '../../contexts/ClientPortalContext';
import BrandMark from '../shared/common/BrandMark';
import NotificationBell from './NotificationBell';
import { usePortalMode } from './usePortalMode';

// Nav follows the portal MODE, not the account type — one login covers pets
// and farms, and a client with both switches between them (see usePortalMode).
const PET_NAV = [
  { to: '/client', end: true, label: 'Home', icon: Home },
  { to: '/client/pets', label: 'Pets', icon: PawPrint },
  { to: '/client/appointments', label: 'Visits', icon: CalendarDays },
  { to: '/client/messages', label: 'Messages', icon: MessageCircle },
  { to: '/client/invoices', label: 'Invoices', icon: Receipt },
];

/**
 * ⚠️ FARM nav carries FARM things only (user, 2026-08-29).
 *
 * "Visits" was here because the farm side inherited the pet client's nav
 * wholesale — and it opened "Appointments & Visits", a pet booking screen, for
 * someone who keeps cattle. The user's call: *"it should not be in the main
 * menu"*, to be re-sited as a farm-shaped screen later. Requesting a farm visit
 * still exists where it belongs: on the farm page itself.
 *
 * Messages and Invoices stay because a farmer genuinely gets both from their
 * clinic — but ⚠️ their CONTENT is still pet-shaped in places and is the next
 * thing to make farm-aware.
 */
const FARM_NAV = [
  { to: '/client/farm', end: true, label: 'My Farm', icon: Sprout },
  { to: '/client/farm/animals', label: 'Animals', icon: Beef },
  { to: '/client/farm/medical', label: 'Medical', icon: Stethoscope },
  { to: '/client/messages', label: 'Messages', icon: MessageCircle },
  // ⚠️ Invoices is NOT gone — it moved BEHIND Profile (user, 2026-08-29:
  // *"instead of invoices we can now have that one as profile"*). A farmer
  // checks a bill occasionally and their account rarely; neither earns a
  // permanent slot ahead of the animals, so the last tab holds both.
  { to: '/client/settings', label: 'Profile', icon: UserRound },
];

const ClientLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { invoices, messages } = useClientPortal();
  const navigate = useNavigate();
  const { mode, setMode, canSwitch, holdings, loading: modeLoading } = usePortalMode();
  const { pathname } = useLocation();

  /**
   * Keep the ROUTE and the MODE agreeing — they could not, before this.
   *
   * The switcher navigates when you click it, but nothing reconciled the two on
   * a fresh load. A farmer with no pets therefore opened the app to the FARM
   * chip lit, the farm nav rendered, and the PET dashboard underneath it saying
   * "here's what's happening with your pets" over "0 Pets". Three parts of one
   * screen disagreeing about who the user is.
   *
   * The rule is deliberately asymmetric, because the two kinds of route carry
   * different amounts of intent:
   *
   * · `/client` is the HOME route and belongs to whichever mode is current — so
   *   it follows the mode.
   * · `/client/pets` or `/client/farm` are SPECIFIC. Someone who asked for that
   *   page means it, and the mode should follow the ROUTE instead. That also
   *   makes a bookmark, a back button and a deep link behave, none of which
   *   know anything about a mode stored in localStorage.
   */
  useEffect(() => {
    if (modeLoading) return;
    if (pathname === '/client' && mode === 'FARM') {
      navigate('/client/farm', { replace: true });
    } else if (pathname.startsWith('/client/pets') && mode === 'FARM' && holdings?.hasPets) {
      setMode('PETS');
    } else if (pathname.startsWith('/client/farm') && mode === 'PETS' && holdings?.canUseFarmMode) {
      setMode('FARM');
    }
  }, [pathname, mode, modeLoading, holdings, navigate, setMode]);
  const { mode: theme, setMode: setTheme } = useThemeMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on an outside click or Escape. Both, because a menu that only closes
  // on Escape is unreachable by mouse and one that only closes on click traps
  // a keyboard user.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  /** The free record book — the rail promo sells the upgrade instead of 403ing. */
  const farmLocked = mode === 'FARM' && holdings?.farmTier !== 'FULL';
  const NAV = mode === 'FARM' ? FARM_NAV : PET_NAV;

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
      {/* ⚠️ `min-w-0` on BOTH halves is load-bearing, for the same reason it is
          on `<main>` in the clinic app (§0d responsive rule 1): a flex item's
          default `min-width: auto` means it can never shrink below its content,
          so `truncate` on the email does nothing and the header simply gets
          wider than the page. Measured: between 640px (where `sm:` reveals the
          email and the switcher labels) and ~700px this group wanted 452px
          inside a 390px parent, and the whole document scrolled sideways —
          a sticky navbar then spans only the viewport while the body does not,
          which is exactly what the user screenshotted. */}
      <header className="cp-topnav sticky top-0 z-20 flex items-center justify-between gap-2 px-4 sm:px-6 h-16">
        <div className="flex items-center gap-2.5 font-black text-lg min-w-0">
          <span className="cp-logo-mark w-9 h-9 rounded-xl flex items-center justify-center p-1 shrink-0">
            <BrandMark title="VetHubCore" />
          </span>
          <span className="truncate">VetHubCore</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Pets ⇄ Farm — shown only to an account that holds both, so a
              pet-only owner never sees farm chrome. */}
          {canSwitch && (
            <div className="flex bg-black/5 rounded-xl p-0.5">
              {([['PETS', 'Pets', PawPrint], ['FARM', 'Farm', Sprout]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); navigate(m === 'FARM' ? '/client/farm' : '/client'); }}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${
                    mode === m ? 'bg-white shadow text-pine' : 'text-slate-500'
                  }`}
                >
                  <Icon className="w-3 h-3" /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          )}
          {/* Live notification center — clinic broadcasts + messages. */}
          <NotificationBell />
          {/* Account menu. Was a bare button that jumped straight to Settings —
              which gave the theme switch nowhere to live and made "sign out" a
              two-step hunt. */}
          <div className="relative" ref={menuRef}>
            <button
              className="flex items-center gap-2 sm:gap-2.5 rounded-xl px-1.5 py-1 min-w-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Account"
            >
              <span className="text-sm font-bold hidden sm:block max-w-[220px] truncate">{displayName}</span>
              <span className="cp-avatar">{initial}</span>
              <ChevronDown size={14} className={`hidden sm:block opacity-50 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden z-50"
              >
                <div className="px-3.5 py-3 border-b border-slate-100 dark:border-zinc-800">
                  <p className="text-sm font-black text-slate-800 dark:text-zinc-100 truncate">{displayName}</p>
                  {holdings?.planName && (
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {holdings.planName} plan
                    </p>
                  )}
                </div>

                {/* Theme. Three states, not a toggle: "system" has to be
                    reachable or a user who picks dark once can never hand the
                    choice back to their OS. */}
                <div className="px-3.5 pt-3 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Appearance</p>
                  <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-xl p-0.5">
                    {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'Auto', Monitor]] as const).map(
                      ([value, label, Icon]) => (
                        <button
                          key={value}
                          onClick={() => setTheme(value as ThemeMode)}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            theme === value
                              ? 'bg-white dark:bg-zinc-700 shadow text-pine dark:text-zinc-100'
                              : 'text-slate-500 dark:text-zinc-400'
                          }`}
                        >
                          <Icon size={12} /> {label}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="py-1 border-t border-slate-100 dark:border-zinc-800">
                  {holdings?.farmTier === 'BASIC' && (
                    <button
                      role="menuitem"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                      onClick={() => { setMenuOpen(false); navigate('/client/plan'); }}
                    >
                      <Sparkles size={15} className="cp-accent-text" /> Upgrade
                    </button>
                  )}
                  <button
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    onClick={() => { setMenuOpen(false); navigate('/client/settings'); }}
                  >
                    <Settings size={15} /> Settings
                  </button>
                  <button
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    onClick={() => { setMenuOpen(false); logout(); }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ⚠️ `max-w-6xl` (1152px) was a PHONE layout centred on a desktop — on a
          1440px screen it left a dead margin either side and stretched every
          row until a herd's head count floated half a screen from its name.
          The portal is a real desktop app for a farmer doing their books, not
          only a phone companion. 1400px is wide enough for a two-column farm
          view and still short of the line-length where body text gets hard to
          track. `mx-auto` is correct HERE (unlike the clinic app, §0d) because
          this shell has no fixed sidebar to strand space beside. */}
      <div className="flex max-w-[1400px] mx-auto w-full">
        {/* Desktop side rail */}
        <aside className="hidden md:block w-52 lg:w-56 shrink-0 p-3 lg:pl-4 lg:pr-2 sticky top-16 self-start">
          <nav className="cp-rail flex flex-col gap-1 p-2.5">
            {NAV.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end} className={linkClasses}>
                <span className="cp-rail-icon"><Icon className="w-[18px] h-[18px]" /></span>
                <span className="flex-1">{label}</span>
                {badgeFor(to) > 0 && <span className="cp-chip">{badgeFor(to)}</span>}
              </NavLink>
            ))}
          </nav>
          {/* ⚠️ On the free farm tier this promo used to offer a farm visit the
              account cannot request — a live button leading to a 403. It now
              sells the plan instead (user, 2026-08-29: *"have it and as selling
              point there make them want to buy it"*). */}
          <div className="cp-rail-promo mt-3">
            <p className="text-sm font-extrabold">
              {farmLocked ? 'Get the vet to your farm'
                : mode === 'FARM' ? 'Need the vet on the farm?'
                : 'Time for a check-up?'}
            </p>
            <p className="text-[11px] text-white/70 mt-0.5 mb-2.5">
              {farmLocked
                ? 'Farm visits, feeding plans and your full history are on Farmer — KES 1,500/mo.'
                : mode === 'FARM'
                  ? 'Request a farm visit and your clinic confirms the time.'
                  : 'Request a visit and your clinic confirms the time.'}
            </p>
            <button
              className="cp-btn"
              onClick={() => navigate(farmLocked ? '/client/plan' : '/client/appointments')}
            >
              {farmLocked
                ? <><Sparkles className="w-4 h-4" /> See Farmer</>
                : <><CalendarPlus className="w-4 h-4" /> Book a visit</>}
            </button>
          </div>
        </aside>

        {/* Page content */}
        {/* ⚠️ Gutters, not padding-for-its-own-sake. `.cp-card` ships with NO
            padding of its own, so every card states its own inset — the page
            only needs enough edge to keep cards off the viewport. */}
        {/* ⚠️ `overflow-x-clip`, NEVER `-hidden`. `hidden` would make this a
            scroll container and silently kill every `position: sticky` in the
            portal — the topnav, the record-page headers and the farm herd rail.
            This is the same pairing the clinic app uses (§0d rule 2) and it is
            the guard that makes a sideways-scrolling page impossible rather
            than merely unlikely. */}
        <main className="flex-1 min-w-0 overflow-x-clip p-3 sm:p-4 lg:py-4 lg:pl-3 lg:pr-4 pb-24 md:pb-6">
          {/* ⚠️ Hold the HOME route until the mode is known. Without this a
              farmer sees "here's what's happening with your pets" flash on
              every single app open, because the pet dashboard renders while
              holdings are still in flight and only then gets redirected away.
              Only `/client` is held — every other route is already unambiguous
              and must not be delayed. */}
          {modeLoading && pathname === '/client'
            ? <div className="cp-card px-5 py-12 text-center text-sm text-slate-400">Loading…</div>
            : <Outlet />}
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

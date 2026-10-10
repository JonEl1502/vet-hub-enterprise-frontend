import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, PawPrint, CalendarDays, MessageCircle, Receipt, CalendarPlus, Sprout, Beef,
  Stethoscope, UserRound,
  Settings, LogOut, Sun, Moon, Monitor, ChevronDown, Sparkles, Users,
  type LucideIcon, Store, Package, Wheat, Milk, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode, type ThemeMode } from '../../hooks/useThemeMode';
import { useClientPortal } from '../../contexts/ClientPortalContext';
import BrandMark from '../shared/common/BrandMark';
import NotificationBell from './NotificationBell';
import { usePortalMode } from './usePortalMode';
import PortalSideChooser from './PortalSideChooser';
import { useFarmerPlan } from './useFarmerPlan';
import QuickRecordWheel, { type WheelAction } from './QuickRecordWheel';

/**
 * 288 — COMMUNITY IS FREE TO READ, SO IT IS IN BOTH NAVS.
 *
 * User, 2026-09-10, looking at the farm portal: *"i think we need to have
 * community here since all client have free access to it."* Right — the org
 * app got the entry, the portal didn't, and the portal is where the pet owners
 * and farmers are. They are the reason the space is worth reaching at all.
 *
 * ⚠️ NOT gated, on either side. Reading is open to every signed-in user
 * (`community.controller`: *"Reads are NOT gated at all"*), and a CLIENT can
 * never post as a business, so there is nothing here to withhold. Same entry,
 * same page, both modes.
 */
interface NavTab { to: string; label: string; icon: LucideIcon; end?: boolean }

const COMMUNITY_TAB: NavTab = { to: '/client/community', label: 'Community', icon: Users };

// Nav follows the portal MODE, not the account type — one login covers pets
// and farms, and a client with both switches between them (see usePortalMode).
const PET_NAV: NavTab[] = [
  { to: '/client', end: true, label: 'Home', icon: Home },
  { to: '/client/pets', label: 'Pets', icon: PawPrint },
  { to: '/client/appointments', label: 'Visits', icon: CalendarDays },
  { to: '/client/messages', label: 'Messages', icon: MessageCircle },
  COMMUNITY_TAB,
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
const FARM_NAV: NavTab[] = [
  { to: '/client/farm', end: true, label: 'My Farm', icon: Sprout },
  { to: '/client/farm/animals', label: 'Animals', icon: Beef },
  { to: '/client/farm/store', label: 'Store', icon: Package },
  { to: '/client/farm/medical', label: 'Medical', icon: Stethoscope },
  // 296 — animals and produce, farmer to farmer.
  { to: '/client/market', label: 'Market', icon: Store },
  { to: '/client/messages', label: 'Messages', icon: MessageCircle },
  COMMUNITY_TAB,
  // ⚠️ Invoices is NOT gone — it moved BEHIND Profile (user, 2026-08-29:
  // *"instead of invoices we can now have that one as profile"*). A farmer
  // checks a bill occasionally and their account rarely; neither earns a
  // permanent slot ahead of the animals, so the last tab holds both.
  { to: '/client/settings', label: 'Profile', icon: UserRound },
];

/**
 * FARM bottom bar on a phone (Rekodi style): four tabs around the centre "C"
 * button, with everything else behind More. Seven equal tabs left each label
 * squeezed to ~50px; four plus a button is what a thumb can actually hit.
 * The sidebar on a laptop is unchanged — it still lists all seven.
 */
const FARM_BAR_LEFT = ['/client/farm', '/client/farm/animals'];
const FARM_BAR_RIGHT = ['/client/farm/medical'];
const FARM_MORE = ['/client/farm/store', '/client/market', '/client/messages', '/client/community', '/client/settings'];

const ClientLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { invoices, messages } = useClientPortal();
  const navigate = useNavigate();
  const { mode, setMode, chooseSide, canSwitch, holdings, loading: modeLoading, needsSideChoice } = usePortalMode();
  const farmerPlan = useFarmerPlan();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [pathname]);

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
    /**
     * 290 — while the side question is open, the route must not answer it.
     *
     * `/client` redirects to `/client/farm` when the mode is FARM, and the mode
     * seeds from `suggestedMode` before anyone has chosen. Letting that run
     * behind the chooser would move the user to a side they are still being
     * asked about, and their answer would then look like it did nothing.
     */
    if (needsSideChoice) return;
    // ⚠️ The ROUTE is the single source of truth on a SPECIFIC route. The
    // switcher only navigates; it must NOT also call setMode.
    //
    // It used to do both, and the two fought: `setMode('PETS')` landed a render
    // before `navigate` had moved `pathname`, so this effect ran with the NEW
    // mode and the OLD `/client/farm` path and flipped the mode straight back.
    // Clicking Pets did nothing at all — reproduced on staging as
    // mode FARM → FARM, path /client/farm → /client/farm.
    if (pathname.startsWith('/client/farm')) {
      if (mode !== 'FARM' && holdings?.canUseFarmMode) setMode('FARM');
    } else if (pathname.startsWith('/client/pets')) {
      // ⚠️ No `hasPets` guard. An explicit navigation IS the intent, and a
      // farm-only owner has to be able to reach the screen that adds their
      // first pet — gating it on already having one is the closed loop 231 had.
      if (mode !== 'PETS') setMode('PETS');
    } else if (pathname === '/client' && mode === 'FARM') {
      // Only the HOME route follows the mode.
      navigate('/client/farm', { replace: true });
    }
  }, [pathname, mode, modeLoading, needsSideChoice, holdings, navigate, setMode]);
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

  // What the centre button offers. Each one lands on the farm page with the
  // matching record form already open (see ClientFarmRecords' `?record=`).
  const wheelActions: WheelAction[] = [
    { id: 'feed', label: 'Feeding', icon: Wheat, tone: 'bg-amber-400 text-amber-950', onSelect: () => navigate('/client/farm?record=FEED') },
    { id: 'produce', label: 'Produce', icon: Milk, tone: 'bg-emerald-400 text-emerald-950', onSelect: () => navigate('/client/farm?record=MILK_SALE') },
    { id: 'expense', label: 'Expense', icon: Receipt, tone: 'bg-rose-400 text-rose-950', onSelect: () => navigate('/client/farm?record=EXPENSE') },
  ];
  const barLeft = FARM_NAV.filter((t) => FARM_BAR_LEFT.includes(t.to));
  const barRight = FARM_NAV.filter((t) => FARM_BAR_RIGHT.includes(t.to));
  const moreTabs = FARM_NAV.filter((t) => FARM_MORE.includes(t.to));
  const moreActive = moreTabs.some((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
  const moreBadge = moreTabs.reduce((n, t) => n + badgeFor(t.to), 0);

  const displayName = user?.name || user?.email || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `cp-rail-link ${isActive ? 'cp-rail-active' : ''}`;

  return (
    // ⚠️ FIXED-VIEWPORT SHELL (2026-09-28, Rekodi pattern). Was `min-h-screen`
    // with the document itself scrolling, which is why the side rail — a plain
    // `sticky` box — only ever looked as tall as its OWN content (nav links +
    // promo card) and visibly stopped partway down a long page instead of
    // reading as a full-height pane. Pinning the shell to the viewport and
    // making `<main>` the ONLY scrolling element lets the rail be a true flex
    // sibling at `h-full` — it fills the pane by construction, not by faking
    // height with `sticky`. Also sidesteps the mobile `100vh`-includes-the-
    // collapsing-address-bar trap the same way Rekodi's shell does.
    <div className="client-portal fixed inset-0 flex flex-col overflow-hidden">
      {/* 290 — the one-time side question. Rendered OVER the portal rather than
          instead of it: the layout behind stays mounted, so answering does not
          remount the app and lose whatever was already fetched. */}
      {needsSideChoice && (
        <PortalSideChooser
          farmAvailable={holdings?.sides?.farm.available ?? !!holdings?.canUseFarmMode}
          onChoose={(side) => chooseSide(side, 'DEFAULT')}
        />
      )}
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
      <header className="cp-topnav shrink-0 z-20 flex items-center justify-between gap-2 px-4 sm:px-6 h-16">
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
                  // ⚠️ Navigate ONLY — the effect above owns the mode. And go to
                  // `/client/pets`, never `/client`: the home route FOLLOWS the
                  // mode, so sending Pets there would be redirected straight
                  // back to the farm.
                  onClick={() => navigate(m === 'FARM' ? '/client/farm' : '/client/pets')}
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
      <div className="flex-1 min-h-0 flex max-w-[1400px] mx-auto w-full">
        {/* Desktop side rail. `h-full` (a flex sibling in a height-constrained
            parent) replaces the old `sticky top-16 self-start`, which only
            ever looked as tall as its own content. The rail's own nav list
            scrolls internally (`overflow-y-auto` on the `<nav>`) if the item
            list ever outgrows the viewport; the promo card stays pinned below
            it at `shrink-0`, never scrolled out of reach. */}
        <aside className="hidden md:flex md:flex-col w-52 lg:w-56 shrink-0 h-full p-3 lg:pl-4 lg:pr-2">
          <nav className="cp-rail flex-1 flex flex-col gap-1 p-2.5 overflow-y-auto min-h-0">
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
          <div className="cp-rail-promo mt-3 shrink-0">
            <p className="text-sm font-extrabold">
              {farmLocked ? 'Get the vet to your farm'
                : mode === 'FARM' ? 'Need the vet on the farm?'
                : 'Time for a check-up?'}
            </p>
            <p className="text-[11px] text-white/70 mt-0.5 mb-2.5">
              {farmLocked
                /* 288 — catalogue price, not a hardcoded one. Drops the price
                   clause entirely rather than quoting a stale figure. */
                ? `Farm visits, feeding plans and your full history are on ${farmerPlan?.name ?? 'Farmer'}${farmerPlan ? ` — ${farmerPlan.currency} ${farmerPlan.price.toLocaleString()}/mo` : ''}.`
                : mode === 'FARM'
                  ? 'Request a farm visit and your clinic confirms the time.'
                  : 'Request a visit and your clinic confirms the time.'}
            </p>
            <button
              className="cp-btn"
              onClick={() => navigate(farmLocked ? '/client/plan' : '/client/appointments')}
            >
              {farmLocked
                ? <><Sparkles className="w-4 h-4" /> Upgrade to Farmer plan</>
                : <><CalendarPlus className="w-4 h-4" /> Book a visit</>}
            </button>
          </div>
        </aside>

        {/* Page content — the ONE scrolling element in the whole shell. */}
        {/* ⚠️ Gutters, not padding-for-its-own-sake. `.cp-card` ships with NO
            padding of its own, so every card states its own inset — the page
            only needs enough edge to keep cards off the viewport. */}
        {/* ⚠️ `overflow-x-clip`, NEVER `-hidden`. `hidden` would silently strip
            the vertical scrolling this element also needs. `overflow-y-auto`
            plus `overflow-x-clip` is a valid, independent pair — this box
            scrolls vertically and clips (never scrolls) horizontally. Any
            `position: sticky` element inside a page (record-page headers, the
            farm herd rail) now sticks relative to THIS box instead of the
            document, which is what Rekodi's shell also relies on — sticky only
            needs *a* scrolling ancestor, not specifically the document. */}
        <main
          id="cp-main-scroll"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-clip p-3 sm:p-4 lg:py-4 lg:pl-3 lg:pr-4 pb-24 md:pb-6"
        >
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

      {/* Mobile bottom bar. FARM mode gets the Rekodi layout — four tabs around
          the centre "C" button (a quick-record dial) with the rest under More. */}
      {mode === 'FARM' ? (
        <>
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 flex items-center border-t backdrop-blur-md"
               style={{ background: 'color-mix(in srgb, var(--cp-surface) 94%, transparent)', borderColor: 'var(--cp-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {barLeft.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end}
                       className={({ isActive }) =>
                         `cp-tab flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition-transform ${isActive ? 'cp-tab-active scale-105' : ''}`}>
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}

            <div className="flex-1 h-[52px] flex items-center justify-center">
              <QuickRecordWheel actions={wheelActions} />
            </div>

            {barRight.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end}
                       className={({ isActive }) =>
                         `cp-tab flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition-transform ${isActive ? 'cp-tab-active scale-105' : ''}`}>
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}

            <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}
                    className={`cp-tab flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition-transform ${moreOpen || moreActive ? 'cp-tab-active scale-105' : ''}`}>
              <LayoutGrid className="w-5 h-5" />
              More
              {moreBadge > 0 && !moreOpen && (
                <span className="absolute top-1.5 right-1/4 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center"
                      style={{ background: 'var(--cp-accent)' }}>{moreBadge}</span>
              )}
            </button>
          </nav>

          {moreOpen && (
            <div className="md:hidden fixed inset-0 z-30" onClick={() => setMoreOpen(false)}>
              <div className="absolute right-2 w-56 rounded-2xl border p-1.5 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 origin-bottom-right"
                   style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)', background: 'var(--cp-surface)', borderColor: 'var(--cp-border)' }}
                   onClick={(e) => e.stopPropagation()}>
                {moreTabs.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                           className={({ isActive }) =>
                             `relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-colors ${isActive ? 'cp-tab-on' : 'hover:bg-black/5'}`}>
                    <Icon className="w-5 h-5" />
                    {label}
                    {badgeFor(to) > 0 && (
                      <span className="ml-auto min-w-5 h-5 px-1 rounded-full text-white text-[10px] flex items-center justify-center"
                            style={{ background: 'var(--cp-accent)' }}>{badgeFor(to)}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
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
      )}
    </div>
  );
};

export default ClientLayout;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Sun, Moon,
} from 'lucide-react';
import ClinicLogo from '../../../clinic/clinic-mgmt/ClinicLogo';
import {
  Clinic, UserRole, FULL_ACCESS_ROLES, ClinicSubscription,
} from '../../../../types';
import {
  AUDIENCES, Audience, AudienceId, MenuItem, MenuSubItem,
  audiencesForRole, defaultAudienceForRole, getAudience,
} from './menus';
import AudienceSwitcher from './AudienceSwitcher';
import ClinicSearchDropdown from './ClinicSearchDropdown';
import SupplierSearchDropdown from './SupplierSearchDropdown';
import { useClinic } from '../../../../contexts/ClinicContext';
import { useSupplier } from '../../../../contexts/SupplierContext';

/** Same emoji-or-URL detector the appearance tab uses — keeps the sidebar
 *  in lockstep with how the supplier saved their logo. */
const isImageSrc = (s?: string | null): s is string =>
  !!s && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('/'));

interface SidebarProps {
  activeView: string;
  setView: (view: string) => void;
  clinic: Clinic;
  onClinicSwitch: () => void;
  role: UserRole;
  customPermissions?: string[];
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  subscription?: ClinicSubscription;
}

const AUDIENCE_STORAGE_KEY = 'vethub_sidebar_audience';

const Sidebar: React.FC<SidebarProps> = ({
  activeView, setView, clinic, role, customPermissions = [],
  isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen,
  isDarkMode, toggleDarkMode, subscription,
}) => {
  const { selectedClinics, selectedClinicIds } = useClinic();
  const supplierCtx = useSupplier();
  const allowed = useMemo(() => audiencesForRole(role), [role]);
  // Persist Super Admin's last audience pick across reloads. Other roles
  // don't get a switcher, so this state is effectively static for them.
  const [audience, setAudience] = useState<AudienceId | 'all'>(() => {
    if (allowed.length <= 1) return defaultAudienceForRole(role);
    try {
      const stored = localStorage.getItem(AUDIENCE_STORAGE_KEY) as AudienceId | 'all' | null;
      if (stored && (stored === 'all' || allowed.includes(stored as AudienceId))) {
        return stored;
      }
    } catch {}
    return defaultAudienceForRole(role);
  });

  // If the role's allowed list ever changes (re-login as different user),
  // snap back to a sensible default rather than leaving a stale audience.
  useEffect(() => {
    if (audience !== 'all' && !allowed.includes(audience as AudienceId)) {
      setAudience(defaultAudienceForRole(role));
    }
  }, [allowed, audience, role]);

  const updateAudience = (next: AudienceId | 'all') => {
    setAudience(next);
    try { localStorage.setItem(AUDIENCE_STORAGE_KEY, next); } catch {}
    // Notify theme listeners (Clinic / Supplier contexts) so the active
    // brand swaps in without forcing a page reload when the user flips
    // between admin/clinic/supplier audiences.
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new Event('audience-change')); } catch {}
    }
  };

  const closeOnMobile = () => setIsMobileOpen(false);
  const sidebarBg = isDarkMode ? 'bg-zinc-950' : 'bg-mist';

  // Resolve which sections to render. A specific audience renders one section
  // (no collapsible header); "all" renders every allowed audience as its own
  // collapsible group, each scrollable inside the nav body.
  const sections: Audience[] = useMemo(() => {
    if (audience === 'all') return allowed.map(id => getAudience(id));
    return [getAudience(audience as AudienceId)];
  }, [audience, allowed]);

  // Header branding: the sidebar shows the entity that "owns" the current
  // session. SUPPLIER role users always show their supplier; admins follow
  // the audience switcher (supplier audience → supplier brand, otherwise
  // clinic). For supplier branding, prefer the live mySupplier copy
  // (refreshed on appearance save) so logo / name swap in instantly.
  const isSupplierBranding =
    role === 'SUPPLIER' || (audience === 'supplier' && (supplierCtx.mySupplier || supplierCtx.selectedSuppliers.length === 1));
  const activeSupplier = isSupplierBranding
    ? supplierCtx.mySupplier
      ?? supplierCtx.selectedSuppliers[0]
      ?? null
    : null;

  const isMultiClinic = selectedClinicIds.length > 1;
  const primaryClinicName = clinic?.name || selectedClinics[0]?.name || 'VetHub';

  const headerTitle = isSupplierBranding && activeSupplier
    ? activeSupplier.name
    : isMultiClinic
      ? `All clinics (${selectedClinicIds.length})`
      : primaryClinicName;

  const headerSubtitle = isSupplierBranding && activeSupplier
    ? (activeSupplier.category || 'Supplier Portal')
    : isMultiClinic
      ? `${primaryClinicName} + ${selectedClinicIds.length - 1} more`
      : (subscription?.package?.name
          ? `${subscription.package.name} Plan`
          : clinic?.isDemo
            ? 'Demo Account'
            : 'Active Clinic');

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-[90] animate-in fade-in duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`${sidebarBg} flex flex-col h-screen fixed left-0 top-0 z-[100] transition-all duration-500 ease-in-out border-r border-seafoam/20 dark:border-zinc-800 shadow-xl
        w-64 ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-10 w-6 h-6 bg-seafoam rounded-full items-center justify-center text-white border-2 border-white dark:border-zinc-950 shadow-xl hover:scale-110 transition-transform z-[110]"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Brand + active entity chip — supplier portal substitutes the
            supplier's logo + name; everything else falls back to clinic. */}
        <div className="p-5 flex items-center gap-3 border-b border-seafoam/10 dark:border-zinc-800 h-20 shrink-0">
          <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-lg shadow-lg shrink-0 overflow-hidden">
            {isSupplierBranding && activeSupplier?.logoUrl ? (
              isImageSrc(activeSupplier.logoUrl) ? (
                <img
                  src={activeSupplier.logoUrl}
                  alt={activeSupplier.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span className="text-base">{activeSupplier.logoUrl}</span>
              )
            ) : isSupplierBranding ? (
              <span className="text-base">🚚</span>
            ) : (
              <ClinicLogo logo={clinic?.logo} fallback="🐾" />
            )}
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <div className="animate-in fade-in slide-in-from-left-2 overflow-hidden min-w-0">
              <h1 className="text-pine dark:text-zinc-100 font-black text-base tracking-tighter leading-none uppercase truncate">
                {headerTitle}
              </h1>
              <p className="text-seafoam/70 dark:text-zinc-500 text-[7px] font-black uppercase tracking-widest mt-0.5 truncate">
                {headerSubtitle}
              </p>
            </div>
          )}
        </div>

        {/* Audience switcher (Super Admin only) */}
        <AudienceSwitcher
          role={role}
          value={audience}
          onChange={updateAudience}
          isCollapsed={isCollapsed && !isMobileOpen}
        />

        {/* Searchable clinic dropdown — auto-hides when there's only one
            clinic. Admins can jump between clinics or pick "all" without
            opening the full Switch Context modal. */}
        <ClinicSearchDropdown isCollapsed={isCollapsed && !isMobileOpen} />

        {/* Sibling supplier dropdown — same UX, admin-only. Hidden for
            SUPPLIER users (they're auto-scoped server-side) and when the
            roster has 0/1 suppliers. */}
        <SupplierSearchDropdown isCollapsed={isCollapsed && !isMobileOpen} />

        {/* Nav body */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          {sections.map((section, i) => (
            <SectionBlock
              key={section.id}
              section={section}
              activeView={activeView}
              setView={setView}
              role={role}
              customPermissions={customPermissions}
              isCollapsed={isCollapsed}
              isMobileOpen={isMobileOpen}
              closeOnMobile={closeOnMobile}
              showHeader={audience === 'all'}
              defaultOpen={audience === 'all' ? i === 0 : true}
            />
          ))}
        </nav>

        {/* Theme toggle footer */}
        <div className="p-4 border-t border-seafoam/10 dark:border-zinc-800 shrink-0">
          <div className={`flex items-center bg-white/40 dark:bg-zinc-900/40 rounded-xl border border-seafoam/5 transition-all p-1 gap-1 ${isCollapsed ? 'flex-col' : 'justify-between'}`}>
            <button onClick={toggleDarkMode} className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center ${!isDarkMode ? 'bg-seafoam text-white shadow-md' : 'text-pine/30 dark:text-mist/30 hover:text-pine'}`}>
              <Sun size={isCollapsed ? 12 : 14} />
            </button>
            <button onClick={toggleDarkMode} className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center ${isDarkMode ? 'bg-seafoam text-white shadow-md' : 'text-pine/30 dark:text-mist/30 hover:text-pine'}`}>
              <Moon size={isCollapsed ? 12 : 14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// ─── One audience's nav block (header + items) ──────────────────────────────

interface SectionBlockProps {
  section: Audience;
  activeView: string;
  setView: (view: string) => void;
  role: UserRole;
  customPermissions: string[];
  isCollapsed: boolean;
  isMobileOpen: boolean;
  closeOnMobile: () => void;
  /** When true, show a collapsible section header (used in "All" mode). */
  showHeader: boolean;
  defaultOpen: boolean;
}

const SectionBlock: React.FC<SectionBlockProps> = ({
  section, activeView, setView, role, customPermissions,
  isCollapsed, isMobileOpen, closeOnMobile, showHeader, defaultOpen,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasFullAccess = FULL_ACCESS_ROLES.includes(role);
  const hasPerm = (perm?: string) =>
    !perm || hasFullAccess || customPermissions.includes(perm);

  const visible = section.items.filter(i => hasPerm(i.requiredPerm));
  if (visible.length === 0) return null;

  // Section header — only shown in "All" mode. Always an icon-only chip when
  // the sidebar is desktop-collapsed.
  const Header = showHeader ? (
    <button
      onClick={() => setOpen(!open)}
      className={`w-full flex items-center gap-2 px-3 pt-4 pb-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-colors ${
        isCollapsed && !isMobileOpen ? 'justify-center' : ''
      }`}
    >
      <section.icon size={12} />
      {(!isCollapsed || isMobileOpen) && (
        <>
          <span className="flex-1 text-left">{section.label}</span>
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </>
      )}
    </button>
  ) : null;

  return (
    <div className="border-b border-seafoam/5 dark:border-zinc-800/50 last:border-0">
      {Header}
      {(!showHeader || open) && (
        <div className="px-3 pb-3 pt-1 space-y-1">
          {visible.map(item => (
            <NavItem
              key={item.id}
              item={item}
              activeView={activeView}
              setView={setView}
              isCollapsed={isCollapsed}
              isMobileOpen={isMobileOpen}
              closeOnMobile={closeOnMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── A single nav item (handles sub-menus, hover tooltips, etc.) ────────────

interface NavItemProps {
  item: MenuItem;
  activeView: string;
  setView: (view: string) => void;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  closeOnMobile: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  item, activeView, setView, isCollapsed, isMobileOpen, closeOnMobile,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [hoveredTop, setHoveredTop] = useState(0);
  const [hovered, setHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  const isActive = activeView === item.id || (item.subItems?.some(s => s.id === activeView) ?? false);
  const effectivelyCollapsed = isCollapsed && !isMobileOpen;

  const handleClick = () => {
    if (effectivelyCollapsed) {
      if (!item.subItems) setView(item.id);
      return;
    }
    if (item.subItems) {
      const opening = !expanded;
      setExpanded(opening);
      if (opening) {
        setView(item.subItems[0].id);
        closeOnMobile();
      }
    } else {
      setView(item.id);
      closeOnMobile();
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!effectivelyCollapsed) return;
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTop(rect.top);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    if (!effectivelyCollapsed) return;
    hoverTimeoutRef.current = window.setTimeout(() => setHovered(false), 200);
  };

  return (
    <div
      className="relative group/menuitem"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black transition-all ${
          isActive
            ? 'bg-seafoam text-white shadow-lg shadow-seafoam/20'
            : 'text-pine/60 dark:text-zinc-500 hover:text-seafoam hover:bg-white/40 dark:hover:bg-white/5'
        }`}
      >
        <item.icon size={16} className="shrink-0 transition-transform group-hover/menuitem:scale-110" />
        {(!isCollapsed || isMobileOpen) && (
          <>
            <span className="uppercase tracking-widest truncate flex-1 text-left">{item.label}</span>
            {item.subItems && (
              <ChevronDown
                size={12}
                className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              />
            )}
          </>
        )}
      </button>

      {/* Collapsed-mode hover tooltip for leaf items */}
      {effectivelyCollapsed && !item.subItems && hovered && (
        <div
          className="fixed z-[200] flex items-center"
          style={{ top: hoveredTop + 8, left: 70 }}
          onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-4 h-8" />
          <div className="px-3 py-2 bg-pine text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-lg shadow-2xl border border-white/10 whitespace-nowrap relative">
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-pine rotate-45 border-l border-b border-white/10"></div>
            {item.label}
          </div>
        </div>
      )}

      {/* Collapsed-mode flyout submenu */}
      {effectivelyCollapsed && item.subItems && hovered && (
        <div
          className="fixed z-[200] flex items-start"
          style={{ top: hoveredTop, left: 70 }}
          onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-4 h-16" />
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[190px] overflow-hidden relative">
            <div className="absolute -left-1 top-6 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-l border-b border-slate-200 dark:border-zinc-800"></div>
            <p className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30">
              {item.label}
            </p>
            <div className="p-1 space-y-0.5">
              {item.subItems.map((sub: MenuSubItem) => (
                <button
                  key={sub.id}
                  onClick={() => { setView(sub.id); closeOnMobile(); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-left ${
                    activeView === sub.id
                      ? 'bg-seafoam/10 text-seafoam'
                      : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-pine dark:hover:text-zinc-100'
                  }`}
                >
                  <sub.icon size={14} className="shrink-0" />
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inline expanded submenu (non-collapsed sidebar) */}
      {(!isCollapsed || isMobileOpen) && item.subItems && expanded && (
        <div className="mt-1 ml-4 pl-4 border-l border-seafoam/20 space-y-1 animate-in slide-in-from-top-2 duration-200">
          {item.subItems.map((sub: MenuSubItem) => (
            <button
              key={sub.id}
              onClick={() => { setView(sub.id); closeOnMobile(); }}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                activeView === sub.id
                  ? 'text-seafoam bg-seafoam/5'
                  : 'text-pine/40 dark:text-zinc-500 hover:text-seafoam'
              }`}
            >
              <sub.icon size={14} />
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Sidebar;

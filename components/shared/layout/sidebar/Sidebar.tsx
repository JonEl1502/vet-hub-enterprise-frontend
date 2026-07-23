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
  applyBillableItemsLayout,
} from './menus';
import AudienceSwitcher from './AudienceSwitcher';
import ClinicSearchDropdown from './ClinicSearchDropdown';
import SupplierSearchDropdown from './SupplierSearchDropdown';
import { useClinic } from '../../../../contexts/ClinicContext';
import { staffScopeAPI, resolveCategoryMenuId, CATEGORY_GATED_MENU_IDS } from '../../../../services';
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
  /** Plan-tier gate: returns false for views the clinic's plan doesn't include
   *  (so locked modules are hidden from the nav, not just blocked on click). */
  planAllows?: (view: string) => boolean;
}

const AUDIENCE_STORAGE_KEY = 'vethub_sidebar_audience';

const Sidebar: React.FC<SidebarProps> = ({
  activeView, setView, clinic, role, customPermissions = [],
  isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen,
  isDarkMode, toggleDarkMode, subscription, planAllows,
}) => {
  const { selectedClinics, selectedClinicIds } = useClinic();
  const supplierCtx = useSupplier();
  const allowed = useMemo(() => audiencesForRole(role), [role]);

  // Epic C: category-scoped staff only see their assigned module pages. Fetch the
  // current user's scope for the active clinic; null = not scoped (see everything).
  const [scopedModuleIds, setScopedModuleIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    staffScopeAPI.myScope().then(res => {
      if (!alive) return;
      if (res.success && res.data?.scopedToCategories) {
        const ids = new Set<string>();
        (res.data.categoryNames || []).forEach(n => { const id = resolveCategoryMenuId(n); if (id) ids.add(id); });
        setScopedModuleIds(ids);
      } else setScopedModuleIds(null);
    }).catch(() => setScopedModuleIds(null));
    return () => { alive = false; };
  }, [selectedClinicIds.join(',')]);
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
  const primaryClinicName = clinic?.name || selectedClinics[0]?.name || 'VetHubCore';

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
          <div className="relative w-8 h-8 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-lg shadow-lg shrink-0">
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
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
            {/* Group marker — "M" superscript (top) for a main clinic, "B"
                subscript (bottom) for a branch. */}
            {!isSupplierBranding && !isMultiClinic && clinic && (
              (clinic as any).parentClinicId ? (
                <span
                  title="Branch clinic"
                  className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[7px] font-black flex items-center justify-center shadow ring-1 ring-white dark:ring-zinc-900"
                >B</span>
              ) : (
                <span
                  title="Main clinic"
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-seafoam text-white text-[7px] font-black flex items-center justify-center shadow ring-1 ring-white dark:ring-zinc-900"
                >M</span>
              )
            )}
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <div className="animate-in fade-in slide-in-from-left-2 overflow-hidden min-w-0">
              <h1 className="text-pine dark:text-zinc-100 font-black text-sm tracking-tight leading-tight break-words line-clamp-2">
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

        {/* Entity scope picker — show exactly one, matching the active
            audience: supplier view gets the suppliers dropdown, everything
            else (admin/clinic/all) gets the clinics dropdown. Never both.
            Each still self-hides at 0/1 entities. */}
        {audience === 'supplier' ? (
          <SupplierSearchDropdown isCollapsed={isCollapsed && !isMobileOpen} />
        ) : (
          <ClinicSearchDropdown isCollapsed={isCollapsed && !isMobileOpen} />
        )}

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
              planAllows={planAllows}
              scopedModuleIds={scopedModuleIds}
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
  planAllows?: (view: string) => boolean;
  scopedModuleIds: Set<string> | null;
}

const SectionBlock: React.FC<SectionBlockProps> = ({
  section, activeView, setView, role, customPermissions,
  isCollapsed, isMobileOpen, closeOnMobile, showHeader, defaultOpen, planAllows, scopedModuleIds,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasFullAccess = FULL_ACCESS_ROLES.includes(role);
  const hasPerm = (perm?: string) =>
    !perm || hasFullAccess || customPermissions.includes(perm);
  const planOk = planAllows ?? (() => true);
  // Billable Items taxonomy (M4) — rolled out to ALL clinics 2026-07-21 after
  // the prod_test pilot: Products/Services/Procedures/Packages replaces the
  // classic Inventory & Suppliers group in the clinic section.
  const sectionItems = applyBillableItemsLayout(section.items, section.id === 'clinic');

  // Role gate first, then plan-tier gate: prune sub-items the plan doesn't
  // include, drop groups left empty, and hide leaf items that aren't allowed.
  // Category-scoped staff (Epic C): in the clinic section, hide module pages for
  // categories they aren't assigned to. Core pages (clients/patients/visits/…) stay.
  const inScope = (id: string) =>
    !scopedModuleIds || section.id !== 'clinic' || !CATEGORY_GATED_MENU_IDS.has(id) || scopedModuleIds.has(id);
  const visible = sectionItems
    .filter(i => hasPerm(i.requiredPerm))
    .filter(i => inScope(i.id))
    .map(i => (i.subItems?.length ? { ...i, subItems: i.subItems.filter(s => planOk(s.id)) } : i))
    .filter(i => (i.subItems ? i.subItems.length > 0 : planOk(i.id)));
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
        data-tour={`nav-${item.id}`}
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

      {/* Collapsed-mode flyout submenu — top clamped so it never spills past
          the bottom of the viewport when a low group is hovered. */}
      {effectivelyCollapsed && item.subItems && hovered && (
        <div
          className="fixed z-[200] flex items-start"
          style={{
            top: Math.max(
              12,
              Math.min(
                hoveredTop,
                (typeof window !== 'undefined' ? window.innerHeight : 900) - (60 + item.subItems.length * 44) - 12,
              ),
            ),
            left: 70,
          }}
          onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-4 h-16" />
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[190px] max-h-[calc(100vh-24px)] overflow-y-auto relative">
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


import React, { useState, useRef } from 'react';
import ClinicLogo from './ClinicLogo';
import { UserRole, Clinic, Permission, FULL_ACCESS_ROLES, ClinicSubscription } from '../types';
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  Dog,
  Repeat,
  CircleDollarSign,
  Package,
  ShoppingCart,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Layers,
  ShieldCheck,
  CreditCard,
  Plus,
  Building2,
  Settings2,
  Receipt,
  Truck,
  TrendingUp,
  Upload,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setView: (view: string) => void;
  clinic: Clinic;
  onClinicSwitch: () => void;
  role: UserRole;
  customPermissions?: string[];
  /** Desktop: collapsed (icon-only) vs expanded */
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  /** Mobile: overlay open/closed */
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  subscription?: ClinicSubscription;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setView,
  clinic,
  role,
  customPermissions = [],
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  isDarkMode,
  toggleDarkMode,
  subscription
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredItemTop, setHoveredItemTop] = useState<number>(0);
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const hasFullAccess = FULL_ACCESS_ROLES.includes(role);
  const hasPerm = (perm: string) => hasFullAccess || customPermissions.includes(perm);
  const isPlatformAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.MERCHANT_ADMIN;

  const allNavItems: any[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredPerm: Permission.VIEW_DASHBOARD },
    { id: 'appointments', label: 'Appointments', icon: CalendarClock },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'patients', label: 'Patients', icon: Dog },
    {
      id: 'inventory_menu',
      label: 'Inventory & Suppliers',
      icon: Package,
      subItems: [
        { id: 'inventory', label: 'Stock Manager', icon: Package },
        { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
        { id: 'suppliers', label: 'Supplier Hub', icon: Truck },
      ]
    },
    { id: 'referrals', label: 'Partners', icon: Repeat, requiredPerm: Permission.VIEW_REFERRALS },
    {
      id: 'finance_menu',
      label: 'Finance',
      icon: CircleDollarSign,
      requiredPerm: Permission.VIEW_FINANCE,
      subItems: [
        { id: 'financial-overview', label: 'Financial Overview', icon: TrendingUp },
        { id: 'b2b-stats', label: 'B2B Stats', icon: Repeat },
        { id: 'transactions', label: 'Transactions', icon: Receipt },
        { id: 'financial-core', label: 'Financial Core', icon: CircleDollarSign },
      ]
    },
    // Platform-admin items live at the top level (no parent grouping).
    // SUPER_ADMIN / MERCHANT_ADMIN see these alongside clinic items so they
    // get one unified nav instead of a separate "admin mode".
    ...(isPlatformAdmin ? [
      { id: 'clinics',           label: 'Clinics',           icon: Building2 },
      { id: 'admin-suppliers',   label: 'Suppliers',         icon: Truck },
      { id: 'admin-freelancers', label: 'Freelancers',       icon: Users },
      { id: 'sub-packages',      label: 'Plans',             icon: Layers },
      { id: 'platform-settings', label: 'Platform Settings', icon: ShieldCheck },
      // Admin doesn't buy subscriptions, so "Manage Plan" is gone — only
      // billing/payments remains, lifted to a single top-level entry.
      { id: 'payment-processing', label: 'Billing',          icon: CreditCard },
    ] : []),
    {
      id: 'clinic_mgmt',
      label: 'Clinic Management',
      icon: Building2,
      requiredPerm: Permission.VIEW_CLINIC_MGMT,
      subItems: [
        { id: 'settings', label: 'Clinic Settings', icon: Settings2 },
        { id: 'staff', label: 'Staff Directory', icon: ShieldCheck },
        { id: 'import-data', label: 'Import Data', icon: Upload },
        { id: 'billing', label: 'Billing', icon: CreditCard },
      ]
    },
  ];

  // Filter out items the current user cannot access.
  const navItems = allNavItems
    .filter(item => !item.requiredPerm || hasPerm(item.requiredPerm));

  /** Only closes the mobile overlay — never touches desktop state */
  const closeOnMobile = () => setIsMobileOpen(false);

  const handleItemClick = (item: any) => {
    // On desktop in collapsed (icon-only) mode: single items navigate, sub-menu items do nothing (hover shows them)
    // isMobileOpen means we're in the mobile overlay — treat as expanded regardless of isCollapsed
    const effectivelyCollapsed = isCollapsed && !isMobileOpen;

    if (effectivelyCollapsed) {
      if (!item.subItems) { setView(item.id); }
      return;
    }
    if (item.subItems) {
      const isOpening = expandedId !== item.id;
      setExpandedId(isOpening ? item.id : null);
      if (isOpening) {
        setView(item.subItems[0].id);
        closeOnMobile();
      }
    } else {
      setView(item.id);
      closeOnMobile();
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, itemId: string) => {
    if (!isCollapsed || isMobileOpen) return;
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    // Use the middle of the icon for better visual centering
    setHoveredItemTop(rect.top);
    setActiveHoverId(itemId);
  };

  const handleMouseLeave = () => {
    if (!isCollapsed || isMobileOpen) return;
    hoverTimeoutRef.current = window.setTimeout(() => {
      setActiveHoverId(null);
    }, 200); // 200ms grace period to move mouse to the menu
  };

  const isItemActive = (item: any) => {
    return activeView === item.id || (item.subItems?.some((s: any) => s.id === activeView));
  };

  const sidebarBg = isDarkMode ? 'bg-zinc-950' : 'bg-mist';

  return (
    <>
      {/* Mobile overlay — only visible on small screens when mobile menu is open */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-[90] animate-in fade-in duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar
          Mobile  : always w-64; translate based on isMobileOpen
          Desktop : w-20 (collapsed) or w-64 (expanded); always visible (translate-x-0)
      */}
      <aside className={`${sidebarBg} flex flex-col h-screen fixed left-0 top-0 z-[100] transition-all duration-500 ease-in-out border-r border-seafoam/20 dark:border-zinc-800 shadow-xl
        w-64 ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      {/* Desktop-only collapse toggle — hidden on mobile */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="hidden md:flex absolute -right-3 top-10 w-6 h-6 bg-seafoam rounded-full items-center justify-center text-white border-2 border-white dark:border-zinc-950 shadow-xl hover:scale-110 transition-transform z-[110]"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className="p-5 flex items-center gap-3 border-b border-seafoam/10 dark:border-zinc-800 h-20 shrink-0">
        <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-lg shadow-lg shrink-0 overflow-hidden">
          <ClinicLogo logo={clinic?.logo} fallback="🐾" />
        </div>
        {(!isCollapsed || isMobileOpen) && (
          <div className="animate-in fade-in slide-in-from-left-2 overflow-hidden">
            <h1 className="text-pine dark:text-zinc-100 font-black text-base tracking-tighter leading-none uppercase">VetHub</h1>
            <p className="text-seafoam/70 dark:text-zinc-500 text-[7px] font-black uppercase tracking-widest mt-0.5">
              {subscription?.package?.name
                ? `${subscription.package.name} Plan`
                : clinic?.isDemo
                  ? 'Demo Account'
                  : 'Active Clinic'}
            </p>
          </div>
        )}
      </div>


      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = isItemActive(item);
          const isExpanded = expandedId === item.id;
          const isHovered = activeHoverId === item.id;

          return (
            <div 
              key={item.id} 
              className="relative group/menuitem"
              onMouseEnter={(e) => handleMouseEnter(e, item.id)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleItemClick(item)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black transition-all relative group/btn ${
                  isActive
                    ? 'bg-seafoam text-white shadow-lg shadow-seafoam/20'
                    : 'text-pine/60 dark:text-zinc-500 hover:text-seafoam hover:bg-white/40 dark:hover:bg-white/5'
                }`}
              >
                <item.icon size={16} className="shrink-0 transition-transform group-hover/btn:scale-110" />
                {/* Show labels when desktop is expanded OR when mobile overlay is open */}
                {(!isCollapsed || isMobileOpen) && (
                  <>
                    <span className="uppercase tracking-widest truncate flex-1 text-left">{item.label}</span>
                    {item.subItems && (
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </>
                )}
              </button>

              {/* Tooltip for collapsed single items - FIXED positioning */}
              {isCollapsed && !item.subItems && isHovered && (
                <div 
                  className="fixed z-[200] ml-0 animate-in fade-in slide-in-from-left-2 duration-150 flex items-center"
                  style={{ top: hoveredItemTop + 8, left: 70 }} // 70px to bridge the 10px gap between sidebar and menu
                  onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Transparent hover bridge */}
                  <div className="w-4 h-8" /> 
                  <div className="px-3 py-2 bg-pine text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-lg shadow-2xl border border-white/10 whitespace-nowrap flex items-center relative">
                    <div className="absolute -left-1 w-2 h-2 bg-pine rotate-45 border-l border-b border-white/10"></div>
                    {item.label}
                  </div>
                </div>
              )}

              {/* Collapsed Hover Submenu - FIXED positioning to avoid clipping */}
              {isCollapsed && item.subItems && isHovered && (
                <div 
                  className="fixed z-[200] ml-0 animate-in fade-in slide-in-from-left-1 duration-150 flex items-start"
                  style={{ top: hoveredItemTop, left: 70 }}
                  onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Transparent hover bridge */}
                  <div className="w-4 h-16" />
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[190px] overflow-hidden relative">
                    <div className="absolute -left-1 top-6 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-l border-b border-slate-200 dark:border-zinc-800"></div>
                    <p className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30">
                      {item.label}
                    </p>
                    <div className="p-1 space-y-0.5">
                      {item.subItems.map((sub: any) => (
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

              {/* Expanded Dropdown (desktop expanded OR mobile overlay open) */}
              {(!isCollapsed || isMobileOpen) && item.subItems && isExpanded && (
                <div className="mt-1 ml-4 pl-4 border-l border-seafoam/20 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {item.subItems.map((sub: any) => (
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
        })}
      </nav>

      <div className="p-4 border-t border-seafoam/10 dark:border-zinc-800 shrink-0">
        <div className={`flex items-center bg-white/40 dark:bg-zinc-900/40 rounded-xl border border-seafoam/5 transition-all p-1 gap-1 ${isCollapsed ? 'flex-col' : 'justify-between'}`}>
           <button onClick={toggleDarkMode} className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center ${!isDarkMode ? 'bg-seafoam text-white shadow-md' : 'text-pine/30 dark:text-mist/30 hover:text-pine'}`}>
             <div className="relative group/tool">
                <Sun size={isCollapsed ? 12 : 14} />
                {isCollapsed && (
                  <div className="fixed left-20 ml-2 px-2 py-1 bg-pine text-white text-[7px] font-black uppercase tracking-widest rounded opacity-0 group-hover/tool:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[300]">Light Mode</div>
                )}
             </div>
           </button>
           <button onClick={toggleDarkMode} className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center ${isDarkMode ? 'bg-seafoam text-white shadow-md' : 'text-pine/30 dark:text-mist/30 hover:text-pine'}`}>
             <div className="relative group/tool">
                <Moon size={isCollapsed ? 12 : 14} />
                {isCollapsed && (
                  <div className="fixed left-20 ml-2 px-2 py-1 bg-pine text-white text-[7px] font-black uppercase tracking-widest rounded opacity-0 group-hover/tool:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[300]">Dark Mode</div>
                )}
             </div>
           </button>
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;

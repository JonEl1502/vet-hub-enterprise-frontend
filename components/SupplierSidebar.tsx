import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  Receipt,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  ShoppingCart,
  Building2,
  CreditCard,
  Settings2,
} from 'lucide-react';

interface SupplierSidebarProps {
  activeView: string;
  setView: (view: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const SupplierSidebar: React.FC<SupplierSidebarProps> = ({
  activeView,
  setView,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  isDarkMode,
  toggleDarkMode
}) => {
  const { user } = useAuth();
  const supplierName = user?.supplier?.name || 'Supplier Portal';
  const [hoveredItemTop, setHoveredItemTop] = useState<number>(0);
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const [managementOpen, setManagementOpen] = useState(
    ['supplier-management', 'supplier-settings'].includes(activeView)
  );
  const hoverTimeoutRef = useRef<number | null>(null);

  const mainItems = [
    { id: 'supplier-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'supplier-products', label: 'Products', icon: Package },
    { id: 'supplier-inventory', label: 'Inventory', icon: ShoppingCart },
    { id: 'supplier-orders', label: 'Orders', icon: Receipt },
    { id: 'supplier-analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const managementSubItems = [
    { id: 'supplier-management', label: 'Account', icon: Building2 },
    { id: 'supplier-billing', label: 'Billing', icon: CreditCard },
  ];

  const isManagementActive = ['supplier-management', 'supplier-settings', 'supplier-billing'].includes(activeView);

  const handleMouseEnter = (e: React.MouseEvent, itemId: string) => {
    if (!isCollapsed || isMobileOpen) return;
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItemTop(rect.top);
    setActiveHoverId(itemId);
  };

  const handleMouseLeave = () => {
    if (!isCollapsed || isMobileOpen) return;
    hoverTimeoutRef.current = window.setTimeout(() => {
      setActiveHoverId(null);
    }, 200);
  };

  const sidebarBg = isDarkMode ? 'bg-zinc-950' : 'bg-mist';

  const NavItem = ({ item }: { item: { id: string; label: string; icon: React.FC<any> } }) => {
    const isActive = activeView === item.id || (item.id === 'supplier-employees' && activeView === 'supplier-employee-profile');
    const isHovered = activeHoverId === item.id;
    return (
      <div
        className="relative group/menuitem"
        onMouseEnter={(e) => handleMouseEnter(e, item.id)}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => { setView(item.id); setIsMobileOpen(false); }}
          className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black transition-all relative group/btn ${
            isActive
              ? 'bg-seafoam text-white shadow-lg shadow-seafoam/20'
              : 'text-pine/60 dark:text-zinc-500 hover:text-seafoam hover:bg-white/40 dark:hover:bg-white/5'
          }`}
        >
          <item.icon size={16} className="shrink-0 transition-transform group-hover/btn:scale-110" />
          {(!isCollapsed || isMobileOpen) && (
            <span className="uppercase tracking-widest truncate flex-1 text-left">{item.label}</span>
          )}
        </button>
        {isCollapsed && !isMobileOpen && isHovered && (
          <div
            className="fixed z-[200] animate-in fade-in slide-in-from-left-2 duration-150 flex items-center"
            style={{ top: hoveredItemTop + 8, left: 70 }}
            onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
            onMouseLeave={handleMouseLeave}
          >
            <div className="w-4 h-8" />
            <div className="px-3 py-2 bg-pine text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-lg shadow-2xl border border-white/10 whitespace-nowrap flex items-center relative">
              <div className="absolute -left-1 w-2 h-2 bg-pine rotate-45 border-l border-b border-white/10"></div>
              {item.label}
            </div>
          </div>
        )}
      </div>
    );
  };

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

        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-seafoam/10 dark:border-zinc-800 h-20 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-lg shadow-lg shrink-0">
            🏭
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <div className="animate-in fade-in slide-in-from-left-2 overflow-hidden min-w-0">
              <h1 className="text-pine dark:text-zinc-100 font-black text-base tracking-tighter leading-none uppercase truncate">{supplierName}</h1>
              <p className="text-seafoam/70 dark:text-zinc-500 text-[7px] font-black uppercase tracking-widest mt-0.5 truncate">Supplier Portal</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Main nav items */}
          {mainItems.map(item => <NavItem key={item.id} item={item} />)}

          {/* Supplier Management dropdown */}
          <div className={`pt-3 mt-2 border-t border-seafoam/10 dark:border-zinc-800`}>
            {(!isCollapsed || isMobileOpen) && (
              <p className="px-3 mb-1 text-[7px] font-black uppercase tracking-[0.3em] text-pine/30 dark:text-zinc-600">Management</p>
            )}

            {/* Dropdown trigger */}
            <div
              className="relative group/menuitem"
              onMouseEnter={(e) => (isCollapsed && !isMobileOpen) && handleMouseEnter(e, '__management')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => {
                  if (isCollapsed && !isMobileOpen) {
                    setView('supplier-management');
                  } else {
                    setManagementOpen(o => !o);
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black transition-all group/btn ${
                  isManagementActive
                    ? 'bg-seafoam/10 text-seafoam dark:text-seafoam'
                    : 'text-pine/60 dark:text-zinc-500 hover:text-seafoam hover:bg-white/40 dark:hover:bg-white/5'
                }`}
              >
                <Settings2 size={16} className="shrink-0 transition-transform group-hover/btn:scale-110" />
                {(!isCollapsed || isMobileOpen) && (
                  <>
                    <span className="uppercase tracking-widest flex-1 text-left">Management</span>
                    <ChevronDown
                      size={12}
                      className={`shrink-0 transition-transform duration-300 ${managementOpen ? 'rotate-180' : ''}`}
                    />
                  </>
                )}
              </button>

              {/* Collapsed tooltip */}
              {isCollapsed && !isMobileOpen && activeHoverId === '__management' && (
                <div
                  className="fixed z-[200] animate-in fade-in slide-in-from-left-2 duration-150 flex items-center"
                  style={{ top: hoveredItemTop + 8, left: 70 }}
                  onMouseEnter={() => { if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); }}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="w-4 h-8" />
                  <div className="px-3 py-2 bg-pine text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-lg shadow-2xl border border-white/10 whitespace-nowrap relative">
                    <div className="absolute -left-1 w-2 h-2 bg-pine rotate-45 border-l border-b border-white/10"></div>
                    Management
                  </div>
                </div>
              )}
            </div>

            {/* Sub-items (expanded only) */}
            {(!isCollapsed || isMobileOpen) && managementOpen && (
              <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-seafoam/20 dark:border-zinc-700 pl-3 animate-in slide-in-from-top-2 duration-200">
                {managementSubItems.map(item => {
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setView(item.id); setIsMobileOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        isActive
                          ? 'bg-seafoam text-white shadow-md shadow-seafoam/20'
                          : 'text-pine/50 dark:text-zinc-500 hover:text-seafoam hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    >
                      <item.icon size={13} className="shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Dark Mode Toggle */}
        <div className="p-4 border-t border-seafoam/10 dark:border-zinc-800 shrink-0">
          <div className={`flex items-center bg-white/40 dark:bg-zinc-900/40 rounded-xl border border-seafoam/5 transition-all p-1 gap-1 ${(isCollapsed && !isMobileOpen) ? 'flex-col' : 'justify-between'}`}>
            <button onClick={toggleDarkMode} className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center ${!isDarkMode ? 'bg-seafoam text-white shadow-md' : 'text-pine/30 dark:text-mist/30 hover:text-pine'}`}>
              <div className="relative group/tool">
                <Sun size={(isCollapsed && !isMobileOpen) ? 12 : 14} />
                {(isCollapsed && !isMobileOpen) && (
                  <div className="fixed left-20 ml-2 px-2 py-1 bg-pine text-white text-[7px] font-black uppercase tracking-widest rounded opacity-0 group-hover/tool:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[300]">Light Mode</div>
                )}
              </div>
            </button>
            <button onClick={toggleDarkMode} className={`flex-1 p-2 rounded-lg transition-all flex items-center justify-center ${isDarkMode ? 'bg-seafoam text-white shadow-md' : 'text-pine/30 dark:text-mist/30 hover:text-pine'}`}>
              <div className="relative group/tool">
                <Moon size={(isCollapsed && !isMobileOpen) ? 12 : 14} />
                {(isCollapsed && !isMobileOpen) && (
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

export default SupplierSidebar;

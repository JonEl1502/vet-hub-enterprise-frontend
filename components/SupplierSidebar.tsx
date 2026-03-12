import React, { useState, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  Receipt,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  ShoppingCart,
  Building2,
  Users,
  GitBranch
} from 'lucide-react';

interface SupplierSidebarProps {
  activeView: string;
  setView: (view: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const SupplierSidebar: React.FC<SupplierSidebarProps> = ({
  activeView,
  setView,
  isCollapsed,
  setIsCollapsed,
  isDarkMode,
  toggleDarkMode
}) => {
  const [hoveredItemTop, setHoveredItemTop] = useState<number>(0);
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const navGroups = [
    {
      items: [
        { id: 'supplier-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'supplier-profile', label: 'Profile', icon: Building2 },
        { id: 'supplier-products', label: 'Products', icon: Package },
        { id: 'supplier-inventory', label: 'Inventory', icon: ShoppingCart },
        { id: 'supplier-orders', label: 'Orders', icon: Receipt },
        { id: 'supplier-analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    {
      label: 'Settings',
      items: [
        { id: 'supplier-employees', label: 'Employees', icon: Users },
        { id: 'supplier-branches', label: 'Branches', icon: GitBranch },
      ]
    }
  ];
  const allNavItems = navGroups.flatMap(g => g.items);

  const handleMouseEnter = (e: React.MouseEvent, itemId: string) => {
    if (!isCollapsed) return;
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItemTop(rect.top);
    setActiveHoverId(itemId);
  };

  const handleMouseLeave = () => {
    if (!isCollapsed) return;
    hoverTimeoutRef.current = window.setTimeout(() => {
      setActiveHoverId(null);
    }, 200);
  };

  const sidebarBg = isDarkMode ? 'bg-zinc-950' : 'bg-mist';

  return (
    <>
      {/* Mobile Menu Overlay - shown when sidebar is open on mobile */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-[90] animate-in fade-in duration-300"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarBg} flex flex-col h-screen fixed left-0 top-0 z-[100] transition-all duration-500 ease-in-out border-r border-seafoam/20 dark:border-zinc-800 shadow-xl
        ${isCollapsed ? 'w-20' : 'w-64'}
        md:translate-x-0
        ${isCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 w-6 h-6 bg-seafoam rounded-full flex items-center justify-center text-white border-2 border-white dark:border-zinc-950 shadow-xl hover:scale-110 transition-transform z-[110]"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-seafoam/10 dark:border-zinc-800 h-20 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-lg shadow-lg shrink-0">
            🏭
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 overflow-hidden">
              <h1 className="text-pine dark:text-zinc-100 font-black text-base tracking-tighter leading-none uppercase">VetHub</h1>
              <p className="text-seafoam/70 dark:text-zinc-500 text-[7px] font-black uppercase tracking-widest mt-0.5">Supplier Portal</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
            {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'pt-3 mt-2 border-t border-seafoam/10 dark:border-zinc-800' : ''}>
              {group.label && !isCollapsed && (
                <p className="px-3 mb-1 text-[7px] font-black uppercase tracking-[0.3em] text-pine/30 dark:text-zinc-600">{group.label}</p>
              )}
              {group.items.map((item) => {
                const isActive = activeView === item.id || (item.id === 'supplier-employees' && activeView === 'supplier-employee-profile');
                const isHovered = activeHoverId === item.id;
                return (
                  <div
                    key={item.id}
                    className="relative group/menuitem"
                    onMouseEnter={(e) => handleMouseEnter(e, item.id)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      onClick={() => setView(item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black transition-all relative group/btn ${
                        isActive
                          ? 'bg-seafoam text-white shadow-lg shadow-seafoam/20'
                          : 'text-pine/60 dark:text-zinc-500 hover:text-seafoam hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    >
                      <item.icon size={16} className="shrink-0 transition-transform group-hover/btn:scale-110" />
                      {!isCollapsed && (
                        <span className="uppercase tracking-widest truncate flex-1 text-left">{item.label}</span>
                      )}
                    </button>

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && isHovered && (
                      <div
                        className="fixed z-[200] ml-0 animate-in fade-in slide-in-from-left-2 duration-150 flex items-center"
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
              })}
            </div>
          ))}
        </nav>

        {/* Dark Mode Toggle */}
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

export default SupplierSidebar;



import React, { useState } from 'react';
import { LogOut, Bell, Shield, ChevronRight, Sun, Moon, Building2, Menu } from 'lucide-react';
import { UserRole, Clinic } from '../types';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';

interface NavbarProps {
  activeView: string;
  clinic: Clinic | { id: string; name: string; logo: string; subdomain: string };
  userName: string;
  role: UserRole;
  isSidebarCollapsed: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  allClinics: (Clinic | { id: string; name: string; logo: string; subdomain: string })[];
  activeClinicIds: (number | string)[];
  onToggleClinic: () => void;
  onToggleSupplierBranch?: () => void;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  activeView,
  clinic,
  userName,
  role,
  isSidebarCollapsed,
  isDarkMode,
  toggleDarkMode,
  allClinics,
  activeClinicIds,
  onToggleClinic,
  onToggleSupplierBranch,
  onToggleSidebar,
  onLogout
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { branches, activeBranchIds } = useSupplierBranch();

  const canSwitchClinic = role === 'SUPER_ADMIN' || role === 'CLINIC_OWNER';

  const getBreadcrumbs = () => {
    const base = { label: 'Enterprise' };
    const map: Record<string, string> = {
      dashboard: 'Dashboard',
      appointments: 'Appointments',
      'appointment-detail': 'Visit Details',
      'view-appointment': 'Appointment',
      'new-appointment': 'New Appointment',
      clients: 'Clients',
      'client-profile': 'Client Profile',
      'register-client': 'Register Client',
      patients: 'Patients',
      'pet-profile': 'Patient Profile',
      'register-pet': 'Register Patient',
      inventory: 'Inventory',
      'purchase-orders': 'Purchase Orders',
      referrals: 'Partners',
      finance: 'Finance',
      'financial-overview': 'Financial Overview',
      transactions: 'Transactions',
      settings: 'Clinic Settings',
      staff: 'Staff Directory',
      billing: 'Billing',
      clinics: 'Clinics',
      suppliers: 'Supplier Hub',
      'supplier-verification': 'Verification',
      'subscription-management': 'Subscription',
      'payment-processing': 'Billing & Payments',
    };
    const label = map[activeView] || (activeView ? activeView.charAt(0).toUpperCase() + activeView.slice(1) : '');
    return label ? [base, { label }] : [base];
  };

  const crumbs = getBreadcrumbs();

  return (
    <nav className={`fixed top-0 left-0 right-0 h-16 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-slate-200 dark:border-zinc-800 z-[60] flex items-center justify-between px-3 md:px-6 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'md:left-20' : 'md:left-64'}`}>
      {/* Left — mobile menu btn + breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile sidebar toggle — bigger and more visible */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex items-center justify-center w-11 h-11 bg-seafoam text-white rounded-xl shadow-md hover:bg-seafoam/90 active:scale-95 transition-all shrink-0"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>

        {/* Breadcrumbs — shown on md+ always, hidden on mobile to save space */}
        <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
          {crumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={8} className="text-slate-300 dark:text-zinc-700 shrink-0" />}
              <span className={idx === crumbs.length - 1 ? 'text-pine dark:text-zinc-100' : 'text-seafoam dark:text-zinc-500'}>
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </div>
        {/* Mobile: just show current view label */}
        <span className="sm:hidden text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">
          {crumbs[crumbs.length - 1]?.label}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Supplier Branch Selector */}
        {role === 'SUPPLIER' && (
          <button
            onClick={onToggleSupplierBranch}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700 transition-all"
          >
            {branches.length === 0 ? (
              <>
                <Building2 size={14} className="text-slate-400 dark:text-zinc-500" />
                <span className="hidden sm:inline text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-tighter">No Branches</span>
              </>
            ) : (() => {
              const firstBranch = branches.find(b => activeBranchIds.includes(b.id)) || branches[0];
              const extraCount = activeBranchIds.length - 1;
              return (
                <>
                  <div className="w-6 h-6 rounded-full bg-seafoam/20 flex items-center justify-center">
                    <Building2 size={12} className="text-seafoam" />
                  </div>
                  <span className="hidden sm:inline text-[10px] font-black uppercase text-pine dark:text-zinc-300 tracking-tighter max-w-[100px] truncate">
                    {firstBranch.name}
                  </span>
                  {extraCount > 0 && <span className="text-[9px] font-black text-seafoam">+{extraCount}</span>}
                </>
              );
            })()}
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-100 transition-all rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-100 transition-all rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-cyan rounded-full border-2 border-white dark:border-zinc-950" />
        </button>

        <div className="h-8 w-px bg-slate-200 dark:border-zinc-800" />

        {/* Profile dropdown */}
        <div className="relative" onMouseEnter={() => setShowUserDropdown(true)} onMouseLeave={() => setShowUserDropdown(false)}>
          <button className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-seafoam to-pine flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="hidden lg:block text-left mr-1">
              <p className="text-pine dark:text-zinc-100 text-[11px] font-black leading-tight">{userName}</p>
              <p className="text-seafoam text-[8px] font-bold uppercase tracking-tighter">{role.replace('_', ' ')}</p>
            </div>
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-full pt-2 w-72 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-2">
                {/* User info */}
                <div className="px-4 py-4 border-b border-slate-100 dark:border-zinc-800">
                  <p className="text-pine dark:text-zinc-100 font-black text-xs">{userName}</p>
                  <p className="text-seafoam text-[9px] font-bold uppercase tracking-widest mt-0.5">{role.replace('_', ' ')}</p>
                </div>

                {/* Clinic section */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Clinic</p>
                  {canSwitchClinic ? (
                    <button
                      onClick={() => { setShowUserDropdown(false); onToggleClinic(); }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0">
                        {clinic?.logo || '🏥'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">{clinic?.name || 'Select Clinic'}</p>
                        {activeClinicIds.length > 1 && (
                          <p className="text-seafoam text-[8px] font-bold uppercase">{activeClinicIds.length} branches active</p>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0">
                        {clinic?.logo || '🏥'}
                      </div>
                      <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">{clinic?.name || 'Clinic'}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="py-1">
                  {/* Security Settings — commented out for now */}
                  {/* <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                    <Shield size={16} className="text-seafoam" />
                    <div>
                      <p className="text-[10px] font-bold uppercase">Security</p>
                      <p className="text-[8px] opacity-60 uppercase">Settings</p>
                    </div>
                  </button> */}
                  <button
                    onClick={() => { setShowUserDropdown(false); onLogout?.(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left hover:bg-slate-50 dark:hover:bg-zinc-800 text-red-500"
                  >
                    <LogOut size={16} className="text-red-400" />
                    <div>
                      <p className="text-[10px] font-bold uppercase">Sign Out</p>
                      <p className="text-[8px] opacity-60 uppercase">Disconnect session</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

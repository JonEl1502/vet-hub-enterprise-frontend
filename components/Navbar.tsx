
import React, { useState } from 'react';
import { User, Settings, LogOut, Bell, Shield, CreditCard, LifeBuoy, ChevronRight, Sun, Moon, Building2, Check, Menu } from 'lucide-react';
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

  const getViewLabel = (view: string) => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'appointments': return 'Appointments';
      case 'appointment-detail': return 'Visit Details';
      case 'clients': return 'Clients';
      case 'patients': return 'Patients';
      case 'pet-profile': return 'Patient Profile';
      case 'client-profile': return 'Client Profile';
      case 'inventory': return 'Inventory';
      case 'referrals': return 'Partners';
      case 'settings': return 'Settings';
      case 'subscription-management': return 'Subscription';
      case 'payment-processing': return 'Billing & Payments';
      case 'subscription-upgrade': return 'Change Plan';
      case 'supplier-registration': return 'Register Supplier';
      case 'supplier-onboarding': return 'Supplier Onboarding';
      case 'supplier-verification': return 'Verify Suppliers';
      case 'supplier-profile': return 'Supplier Profile';
      case 'supplier-products': return 'Products';
      case 'supplier-orders': return 'Orders';
      case 'supplier-analytics': return 'Analytics';
      case 'supplier-inventory': return 'Inventory';
      default: return view.charAt(0).toUpperCase() + view.slice(1);
    }
  };

  return (
    <nav className={`fixed top-0 right-0 h-16 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-slate-200 dark:border-zinc-800 z-[60] flex items-center justify-between px-4 md:px-8 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'md:left-20' : 'md:left-64'}`}>
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex items-center justify-center w-10 h-10 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} className="text-pine dark:text-zinc-100" />
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{getViewLabel(activeView)}</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Supplier Branch Selector — shown only for SUPPLIER role */}
        {role === 'SUPPLIER' && (
          <button
            onClick={onToggleSupplierBranch}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700 transition-all"
          >
            {branches.length === 0 ? (
              <>
                <Building2 size={14} className="text-slate-400 dark:text-zinc-500" />
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-tighter">No Branches</span>
              </>
            ) : (() => {
              const firstBranch = branches.find(b => activeBranchIds.includes(b.id)) || branches[0];
              const extraCount = activeBranchIds.length - 1;
              return (
                <>
                  <div className="w-6 h-6 rounded-full bg-seafoam/20 flex items-center justify-center">
                    <Building2 size={12} className="text-seafoam" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-pine dark:text-zinc-300 tracking-tighter max-w-[100px] truncate">
                    {firstBranch.name}
                  </span>
                  {extraCount > 0 && (
                    <span className="text-[9px] font-black text-seafoam">+{extraCount}</span>
                  )}
                </>
              );
            })()}
          </button>
        )}

        {/* Clinic Display - Show logos or single clinic name */}
        {/* Only allow switching for SUPER_ADMIN and CLINIC_OWNER roles */}
        {(role === 'SUPER_ADMIN' || role === 'CLINIC_OWNER') ? (
          <button
            onClick={onToggleClinic}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700 transition-all group"
          >
            {activeClinicIds.length === 1 ? (
              // Single clinic selected - show logo and name
              <>
                <div className="w-6 h-6 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-sm shadow-sm border border-slate-200 dark:border-zinc-700">
                  {clinic?.logo || '🏥'}
                </div>
                <span className="text-[10px] font-black uppercase text-pine dark:text-zinc-300 tracking-tighter max-w-[120px] truncate">
                  {clinic?.name || 'Branch'}
                </span>
              </>
            ) : (
              // Multiple clinics selected - show circular avatars
              <>
                <div className="flex -space-x-2">
                  {allClinics.filter(c => activeClinicIds.includes(c.id.toString())).slice(0, 3).map(c => (
                    <div
                      key={c.id}
                      className="w-6 h-6 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-xs shadow-sm border-2 border-slate-100 dark:border-zinc-900"
                      title={c.name}
                    >
                      {c.logo}
                    </div>
                  ))}
                  {activeClinicIds.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-seafoam flex items-center justify-center text-[9px] text-white shadow-sm border-2 border-slate-100 dark:border-zinc-900 font-bold">
                      +{activeClinicIds.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase text-pine dark:text-zinc-300 tracking-tighter">
                  {activeClinicIds.length} Branches
                </span>
              </>
            )}
          </button>
        ) : (
          // For other roles (VET, TECHNICIAN, RECEPTIONIST, etc.) - show read-only clinic display
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 rounded-full border border-slate-200 dark:border-zinc-700">
            <div className="w-6 h-6 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-sm shadow-sm border border-slate-200 dark:border-zinc-700">
              {clinic?.logo || '🏥'}
            </div>
            <span className="text-[10px] font-black uppercase text-pine dark:text-zinc-300 tracking-tighter max-w-[120px] truncate">
              {clinic?.name || 'Branch'}
            </span>
          </div>
        )}

        <button 
          onClick={toggleDarkMode}
          className="p-2 text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-100 transition-all rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="relative p-2 text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-100 transition-all rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-cyan rounded-full border-2 border-white dark:border-zinc-950" />
        </button>

        <div className="h-8 w-px bg-slate-200 dark:border-zinc-800" />

        <div className="relative" onMouseEnter={() => setShowUserDropdown(true)} onMouseLeave={() => setShowUserDropdown(false)}>
          <button className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-seafoam to-pine flex items-center justify-center text-white font-bold shadow-sm">
              {userName.charAt(0)}
            </div>
            <div className="hidden lg:block text-left mr-2">
              <p className="text-pine dark:text-zinc-100 text-[11px] font-black leading-tight">{userName}</p>
              <p className="text-seafoam text-[8px] font-bold uppercase tracking-tighter">{role.replace('_', ' ')}</p>
            </div>
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-full pt-2 w-64 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-2">
                <div className="px-4 py-4 border-b border-slate-100 dark:border-zinc-800">
                  <p className="text-pine dark:text-zinc-100 font-black text-xs">{userName}</p>
                  <p className="text-seafoam text-[9px] font-bold uppercase tracking-widest mt-0.5">Profile</p>
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group/item text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                    <Shield size={16} className="text-seafoam" />
                    <div>
                      <p className="text-[10px] font-bold uppercase">Security</p>
                      <p className="text-[8px] opacity-60 uppercase">Settings</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group/item text-left hover:bg-slate-50 dark:hover:bg-zinc-800 text-red-500"
                  >
                    <LogOut size={16} className="text-red-400" />
                    <div>
                      <p className="text-[10px] font-bold uppercase">Out</p>
                      <p className="text-[8px] opacity-60 uppercase">Disconnect</p>
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

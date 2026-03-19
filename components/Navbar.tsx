
import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Bell, Shield, ChevronRight, Sun, Moon, Building2, Menu, CalendarClock, Clock, User, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import ClinicLogo from './ClinicLogo';
import { UserRole, Clinic, Appointment } from '../types';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';
import { appointmentsAPI } from '../services';

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

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  SCHEDULED:   { label: 'Scheduled',   icon: <Clock size={10} />,         color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50' },
  IN_PROGRESS: { label: 'In Progress', icon: <AlertCircle size={10} />,   color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50' },
  COMPLETED:   { label: 'Completed',   icon: <CheckCircle2 size={10} />,  color: 'text-green-500 bg-green-50 dark:bg-green-950/50' },
  CANCELLED:   { label: 'Cancelled',   icon: <XCircle size={10} />,       color: 'text-red-400 bg-red-50 dark:bg-red-950/50' },
  NO_SHOW:     { label: 'No Show',     icon: <XCircle size={10} />,       color: 'text-slate-400 bg-slate-100 dark:bg-zinc-800' },
};

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
  const [showUserDropdown, setShowUserDropdown]   = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [todayAppts, setTodayAppts]               = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading]             = useState(false);

  const profileRef      = useRef<HTMLDivElement>(null);
  const notifRef        = useRef<HTMLDivElement>(null);

  const { branches, activeBranchIds } = useSupplierBranch();
  const canSwitchClinic = role === 'SUPER_ADMIN' || role === 'CLINIC_OWNER';

  // Close panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch today's appointments when notifications panel opens
  useEffect(() => {
    if (!showNotifications) return;
    const today = new Date();
    const start = today.toISOString().split('T')[0];
    const end   = start;
    setApptLoading(true);
    appointmentsAPI
      .getAll({ startDate: start, endDate: end, limit: 50 })
      .then(res => {
        if (res.success) setTodayAppts(res.data.appointments ?? []);
      })
      .catch(() => {})
      .finally(() => setApptLoading(false));
  }, [showNotifications]);

  const unreadCount = todayAppts.filter(a => a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS').length;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex items-center justify-center w-11 h-11 bg-seafoam text-white rounded-xl shadow-md hover:bg-seafoam/90 active:scale-95 transition-all shrink-0"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>

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
        <span className="sm:hidden text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">
          {crumbs[crumbs.length - 1]?.label}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">

        {/* ── Notifications ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(v => !v); setShowUserDropdown(false); }}
            className="relative p-2 text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-100 transition-all rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-cyan text-white text-[8px] font-black rounded-full border-2 border-white dark:border-zinc-950">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {unreadCount === 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-cyan rounded-full border-2 border-white dark:border-zinc-950" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full pt-2 w-80 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={14} className="text-seafoam" />
                    <p className="text-pine dark:text-zinc-100 font-black text-xs">Today's Appointments</p>
                  </div>
                  <span className="text-[9px] font-black uppercase text-seafoam bg-seafoam/10 px-2 py-0.5 rounded-full">
                    {new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Body */}
                <div className="max-h-72 overflow-y-auto">
                  {apptLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={20} className="text-seafoam animate-spin" />
                    </div>
                  ) : todayAppts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                      <CalendarClock size={28} className="text-slate-200 dark:text-zinc-700" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No appointments today</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-zinc-800">
                      {todayAppts.map(appt => {
                        const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG['SCHEDULED'];
                        return (
                          <div key={appt.id} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">
                                  {appt.pet?.name ?? `Pet #${appt.petId}`}
                                  <span className="text-slate-400 font-normal"> · {appt.client?.name ?? `Client #${appt.clientId}`}</span>
                                </p>
                                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{formatTime(appt.date)}</p>
                              </div>
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 ${cfg.color}`}>
                                {cfg.icon}{cfg.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {todayAppts.length > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 text-center">
                    <p className="text-[9px] font-black text-seafoam uppercase tracking-wider">
                      {todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''} today
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200 dark:border-zinc-800" />

        {/* ── Profile ── */}
        <div
          className="relative"
          ref={profileRef}
          onMouseEnter={() => setShowUserDropdown(true)}
          onMouseLeave={() => setShowUserDropdown(false)}
        >
          <button
            onClick={() => { setShowUserDropdown(v => !v); setShowNotifications(false); }}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
          >
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

                {/* Clinic / Branch section */}
                {role === 'SUPPLIER' ? (
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Branches</p>
                    <button
                      onClick={() => { setShowUserDropdown(false); onToggleSupplierBranch?.(); }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0">
                        <Building2 size={14} className="text-seafoam" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {branches.length === 0 ? (
                          <p className="text-slate-400 font-black text-[11px]">No branches</p>
                        ) : (
                          <>
                            <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">
                              {(branches.find(b => activeBranchIds.includes(b.id)) || branches[0])?.name}
                            </p>
                            <p className="text-seafoam text-[8px] font-bold uppercase">{activeBranchIds.length} {activeBranchIds.length === 1 ? 'branch' : 'branches'} active</p>
                          </>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Clinic</p>
                    {canSwitchClinic ? (
                      <button
                        onClick={() => { setShowUserDropdown(false); onToggleClinic(); }}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0 overflow-hidden">
                          <ClinicLogo logo={clinic?.logo} fallback="🏥" />
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
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0 overflow-hidden">
                          <ClinicLogo logo={clinic?.logo} fallback="🏥" />
                        </div>
                        <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">{clinic?.name || 'Clinic'}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="py-1">
                  <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-400" />}
                    <div>
                      <p className="text-[10px] font-bold uppercase text-pine dark:text-zinc-100">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</p>
                      <p className="text-[8px] opacity-60 uppercase text-pine dark:text-zinc-100">Switch appearance</p>
                    </div>
                  </button>
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

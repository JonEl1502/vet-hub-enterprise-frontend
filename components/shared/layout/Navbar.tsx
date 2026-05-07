
import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Bell, Shield, ChevronRight, Sun, Moon, Building2, Menu, CalendarClock, Clock, User, CheckCircle2, XCircle, AlertCircle, Loader2, ShoppingCart, Network, Zap, ArrowUpRight } from 'lucide-react';
import ClinicLogo from '../../clinic/clinic-mgmt/ClinicLogo';
import { UserRole, Clinic, Appointment, ClinicSubscription } from '../../../types';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import { appointmentsAPI, purchaseOrderAPI } from '../../../services';
import type { PurchaseOrder } from '../../../services';

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
  onNavigate?: (view: string, params?: Record<string, any>) => void;
  subscription?: ClinicSubscription;
  onUpgrade?: () => void;
}

const TITLES = ['Dr', 'Dr.', 'Mr', 'Mr.', 'Mrs', 'Mrs.', 'Ms', 'Ms.', 'Prof', 'Prof.'];
// Return "Dr. Otieno" for "Dr. Amina Otieno", or just "Otieno" for "Kevin Otieno".
const shortName = (full: string): string => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const [first, ...rest] = parts;
  const last = rest[rest.length - 1];
  return TITLES.includes(first) ? `${first} ${last}` : last;
};

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
  onLogout,
  onNavigate,
  subscription,
  onUpgrade,
}) => {
  const [showUserDropdown, setShowUserDropdown]     = useState(false);
  const [showNotifications, setShowNotifications]   = useState(false);
  const [notifTab, setNotifTab]                     = useState<'all' | 'appointments' | 'orders' | 'b2b'>('all');
  const [todayAppts, setTodayAppts]                 = useState<Appointment[]>([]);
  const [pendingAppts, setPendingAppts]             = useState<Appointment[]>([]);
  const [pendingPOs, setPendingPOs]                 = useState<PurchaseOrder[]>([]);
  const [apptLoading, setApptLoading]               = useState(false);
  const [poLoading, setPoLoading]                   = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);

  const { branches, activeBranchIds } = useSupplierBranch();
  // Admins (super + merchant) and clinic owners can open the unified
  // switcher — it lets them pick clinics, suppliers, and freelancers in one
  // place. SUPPLIER role users use the supplier branch switcher instead.
  const canSwitchClinic = role === 'SUPER_ADMIN' || role === 'MERCHANT_ADMIN' || role === 'CLINIC_OWNER';

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

  // Fetch today's appointments + pending-payment + pending POs when panel opens
  useEffect(() => {
    if (!showNotifications) return;

    const today = new Date();
    const start = today.toISOString().split('T')[0];
    const end   = start;

    // Today's scheduled/in-progress appointments
    setApptLoading(true);
    appointmentsAPI
      .getAll({ startDate: start, endDate: end, limit: 50 })
      .then(res => {
        if (res.success) setTodayAppts((res.data.appointments ?? []) as unknown as Appointment[]);
      })
      .catch(() => {})
      .finally(() => setApptLoading(false));

    // Pending-payment appointments (not date-filtered)
    appointmentsAPI
      .getAll({ status: 'PENDING_PAYMENT', limit: 20 } as any)
      .then(res => {
        if (res.success) setPendingAppts((res.data.appointments ?? []) as unknown as Appointment[]);
      })
      .catch(() => {});

    // Pending / incomplete purchase orders
    setPoLoading(true);
    purchaseOrderAPI
      .getAll({ limit: 50 } as any)
      .then(res => {
        if (res.success) {
          const all: PurchaseOrder[] = (res.data as any).data ?? [];
          const INCOMPLETE = ['PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'PROCESSING'];
          setPendingPOs(all.filter(po => INCOMPLETE.includes((po as any).status?.toUpperCase())));
        }
      })
      .catch(() => {})
      .finally(() => setPoLoading(false));
  }, [showNotifications]);

  const scheduledToday  = todayAppts.filter(a => a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS');
  const unreadCount     = scheduledToday.length + pendingAppts.length + pendingPOs.length;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
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

  // Demo / trial banner logic
  const isDemo = (clinic as Clinic)?.isDemo === true;
  const clinicCreatedAt = (clinic as Clinic)?.createdAt;
  const DEMO_TRIAL_DAYS = 40;
  const demoInfo = (() => {
    if (!isDemo && subscription?.status !== 'TRIAL') return null;
    const startDate = subscription?.startDate || clinicCreatedAt;
    if (!startDate) return { daysLeft: DEMO_TRIAL_DAYS, daysUsed: 0 };
    const start = new Date(startDate);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, DEMO_TRIAL_DAYS - elapsed);
    return { daysLeft, daysUsed: elapsed };
  })();

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

      {/* Demo / Trial Banner */}
      {demoInfo && (
        <div className={`hidden md:flex items-center gap-3 px-4 py-1.5 rounded-2xl border transition-all ${
          demoInfo.daysLeft <= 7
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            : demoInfo.daysLeft <= 14
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
              : 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800'
        }`}>
          <Zap size={12} className={demoInfo.daysLeft <= 7 ? 'text-red-500' : demoInfo.daysLeft <= 14 ? 'text-amber-500' : 'text-cyan-500'} />
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Demo Account</span>
            <span className={`text-[10px] font-black ${
              demoInfo.daysLeft <= 7 ? 'text-red-600 dark:text-red-400' : demoInfo.daysLeft <= 14 ? 'text-amber-600 dark:text-amber-400' : 'text-cyan-600 dark:text-cyan-400'
            }`}>
              {demoInfo.daysLeft === 0 ? 'Trial Expired' : `${demoInfo.daysLeft} days left`}
            </span>
          </div>
          <button
            onClick={onUpgrade || (() => onNavigate?.('subscription-management'))}
            className="flex items-center gap-1 px-3 py-1 bg-seafoam hover:bg-seafoam/90 text-white text-[8px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-sm"
          >
            Upgrade
            <ArrowUpRight size={10} />
          </button>
        </div>
      )}

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
            <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-[4.25rem] sm:top-full sm:pt-2 w-auto sm:w-96 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-seafoam" />
                    <p className="text-pine dark:text-zinc-100 font-black text-xs">Notifications</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="text-[9px] font-black uppercase text-white bg-cyan px-2 py-0.5 rounded-full">
                      {unreadCount} pending
                    </span>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="flex border-b border-slate-100 dark:border-zinc-800 px-1 pt-1 gap-0.5">
                  {[
                    { id: 'all',          label: 'All',         icon: <Bell size={10} /> },
                    { id: 'appointments', label: 'Appointments', icon: <CalendarClock size={10} /> },
                    { id: 'orders',       label: 'Orders',       icon: <ShoppingCart size={10} /> },
                    { id: 'b2b',          label: 'B2B',          icon: <Network size={10} /> },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setNotifTab(t.id as any)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-t-lg text-[9px] font-black uppercase tracking-widest transition-all ${notifTab === t.id ? 'bg-pine text-white' : 'text-slate-400 hover:text-pine'}`}
                    >
                      {t.icon}{t.label}
                    </button>
                  ))}
                </div>

                {/* Body */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-zinc-800/50">

                  {/* Appointments section */}
                  {(notifTab === 'all' || notifTab === 'appointments') && (
                    <>
                      {notifTab === 'all' && (scheduledToday.length > 0 || pendingAppts.length > 0) && (
                        <div className="px-5 py-2 bg-slate-50 dark:bg-zinc-800/40">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Appointments</p>
                        </div>
                      )}
                      {apptLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={18} className="text-seafoam animate-spin" />
                        </div>
                      ) : (
                        <>
                          {scheduledToday.map(appt => {
                            const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG['SCHEDULED'];
                            return (
                              <button
                                key={`appt-${appt.id}`}
                                onClick={() => { setShowNotifications(false); onNavigate?.('appointment-detail', { appointmentId: appt.id }); }}
                                className="w-full px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors text-left group"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">
                                      {(appt as any).pet?.name ?? `Pet #${appt.petId}`}
                                      <span className="text-slate-400 font-normal"> · {(appt as any).client?.name ?? `Client #${appt.clientId}`}</span>
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{formatTime(appt.date)} · <span className="text-seafoam group-hover:underline">Open workflow →</span></p>
                                  </div>
                                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 ${cfg.color}`}>
                                    {cfg.icon}{cfg.label}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          {pendingAppts.map(appt => (
                            <button
                              key={`pending-${appt.id}`}
                              onClick={() => { setShowNotifications(false); onNavigate?.('appointment-detail', { appointmentId: appt.id }); }}
                              className="w-full px-5 py-3 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors text-left group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">
                                    {(appt as any).pet?.name ?? `Pet #${appt.petId}`}
                                    <span className="text-slate-400 font-normal"> · {(appt as any).client?.name ?? `Client #${appt.clientId}`}</span>
                                  </p>
                                  <p className="text-[9px] text-amber-500 font-semibold mt-0.5">Pending payment · <span className="group-hover:underline">Process payment →</span></p>
                                </div>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 text-amber-600 bg-amber-50 dark:bg-amber-950/50">
                                  <AlertCircle size={10} />Unpaid
                                </span>
                              </div>
                            </button>
                          ))}
                          {(notifTab === 'appointments') && scheduledToday.length === 0 && pendingAppts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                              <CalendarClock size={24} className="text-slate-200 dark:text-zinc-700" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No appointment alerts</p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Purchase Orders section */}
                  {(notifTab === 'all' || notifTab === 'orders') && (
                    <>
                      {notifTab === 'all' && pendingPOs.length > 0 && (
                        <div className="px-5 py-2 bg-slate-50 dark:bg-zinc-800/40">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Purchase Orders</p>
                        </div>
                      )}
                      {poLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={18} className="text-seafoam animate-spin" />
                        </div>
                      ) : pendingPOs.length > 0 ? pendingPOs.map(po => (
                        <button
                          key={`po-${po.id}`}
                          onClick={() => { setShowNotifications(false); onNavigate?.('purchase-order-detail', { purchaseOrderId: po.id }); }}
                          className="w-full px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors text-left group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">
                                PO #{po.id}
                                {(po as any).supplierName && <span className="text-slate-400 font-normal"> · {(po as any).supplierName}</span>}
                              </p>
                              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{(po as any).status}{(po as any).totalCost ? ` · KES ${Number((po as any).totalCost).toLocaleString()}` : ''} · <span className="text-seafoam group-hover:underline">View order →</span></p>
                            </div>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0 text-orange-600 bg-orange-50 dark:bg-orange-950/50">
                              <ShoppingCart size={10} />Pending
                            </span>
                          </div>
                        </button>
                      )) : (notifTab === 'orders') ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                          <ShoppingCart size={24} className="text-slate-200 dark:text-zinc-700" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No pending orders</p>
                        </div>
                      ) : null}
                    </>
                  )}

                  {/* B2B section */}
                  {(notifTab === 'all' || notifTab === 'b2b') && (
                    <>
                      {notifTab === 'all' && (
                        <div className="px-5 py-2 bg-slate-50 dark:bg-zinc-800/40">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">B2B / Partners</p>
                        </div>
                      )}
                      <button
                        onClick={() => { setShowNotifications(false); onNavigate?.('referrals'); }}
                        className="w-full flex flex-col items-center justify-center py-8 gap-2 text-center px-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group"
                      >
                        <Network size={24} className="text-slate-200 dark:text-zinc-700 group-hover:text-seafoam transition-colors" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">View Partnership Hub →</p>
                      </button>
                    </>
                  )}

                  {/* All-empty state */}
                  {notifTab === 'all' && unreadCount === 0 && !apptLoading && !poLoading && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                      <CheckCircle2 size={28} className="text-emerald-300 dark:text-emerald-800" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">All clear!</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {unreadCount > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 text-center">
                    <p className="text-[9px] font-black text-seafoam uppercase tracking-wider">
                      {unreadCount} notification{unreadCount !== 1 ? 's' : ''} pending
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200 dark:border-zinc-800" />

        {/* ── Profile ── */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowUserDropdown(v => !v); setShowNotifications(false); }}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-seafoam to-pine flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="hidden lg:block text-left mr-1">
              <p className="text-pine dark:text-zinc-100 text-[11px] font-black leading-tight">{shortName(userName)}</p>
              <p className="text-seafoam text-[8px] font-bold uppercase tracking-tighter">{role.replace('_', ' ')}</p>
            </div>
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-full pt-2 w-72 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-2">
                {/* User info */}
                <div className="px-4 py-4 border-b border-slate-100 dark:border-zinc-800">
                  <p className="text-pine dark:text-zinc-100 font-black text-xs">{shortName(userName)}</p>
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
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      {activeClinicIds.length > 1 ? 'Active Clinics' : 'Active Clinic'}
                    </p>
                    {(() => {
                      // Build the label honestly: a single selection shows that
                      // one clinic's name; a multi-selection shows "All clinics
                      // (N)" so the dropdown doesn't lie about scope. Earlier
                      // bug: we always rendered selectedClinics[0]'s name, which
                      // made admins think only the first clinic was active even
                      // when their X-Clinic-Ids request was hitting all of them.
                      const isMulti = activeClinicIds.length > 1;
                      const primaryLabel = isMulti
                        ? `All clinics (${activeClinicIds.length})`
                        : (clinic?.name || 'Select Clinic');
                      const subLabel = isMulti
                        ? `${clinic?.name || ''}${activeClinicIds.length > 1 ? ` + ${activeClinicIds.length - 1} more` : ''}`.trim()
                        : null;

                      return canSwitchClinic ? (
                        <button
                          onClick={() => { setShowUserDropdown(false); onToggleClinic(); }}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0 overflow-hidden">
                            <ClinicLogo logo={clinic?.logo} fallback="🏥" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">{primaryLabel}</p>
                            {subLabel && (
                              <p className="text-seafoam text-[8px] font-bold uppercase truncate">{subLabel}</p>
                            )}
                          </div>
                          <ChevronRight size={14} className="text-slate-400 shrink-0" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 p-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0 overflow-hidden">
                            <ClinicLogo logo={clinic?.logo} fallback="🏥" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-black text-[11px] truncate">{primaryLabel}</p>
                            {subLabel && (
                              <p className="text-seafoam text-[8px] font-bold uppercase truncate">{subLabel}</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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

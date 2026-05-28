
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from './store';
import { useAuth } from './contexts/AuthContext';
import { useClinic } from './contexts/ClinicContext';
import { useData } from './contexts/DataContext';
import { useStaff } from './contexts/StaffContext';
import Sidebar from './components/shared/layout/sidebar/Sidebar';
import SupplierSidebar from './components/supplier/layout/SupplierSidebar';
import SupplierDashboard from './components/supplier/dashboard/SupplierDashboard';
import SupplierProductsView from './components/supplier/products/SupplierProductsView';
import SupplierProductFormPage from './components/supplier/products/SupplierProductFormPage';
import SupplierOrdersView from './components/supplier/orders/SupplierOrdersView';
import SupplierOrderDetailView from './components/supplier/orders/SupplierOrderDetailView';
import SupplierBranchesView from './components/supplier/branches/SupplierBranchesView';
import SupplierEmployeeListView from './components/supplier/employees/SupplierEmployeeListView';
import SupplierEmployeeProfileView from './components/supplier/employees/SupplierEmployeeProfileView';
import SupplierManagementView from './components/supplier/management/SupplierManagementView';
import SupplierBranchModal from './components/supplier/branches/SupplierBranchModal';
import { SupplierBranchProvider } from './contexts/SupplierBranchContext';
import Navbar from './components/shared/layout/Navbar';
import Breadcrumbs from './components/shared/layout/Breadcrumbs';
import LoginPage from './components/shared/auth/LoginPage';
import AuthShell from './components/shared/auth/AuthShell';
import LandingPage from './components/shared/marketing/LandingPage';
import PricingPage from './components/shared/marketing/PricingPage';
import ForgotPasswordPage from './components/shared/auth/ForgotPasswordPage';
import VerifyOTPPage from './components/shared/auth/VerifyOTPPage';
import ResetPasswordPage from './components/shared/auth/ResetPasswordPage';
import SignupWizard from './components/shared/auth/SignupWizard';
import SupplierRegistration from './components/supplier/onboarding/SupplierRegistration';
import NewAppointmentView from './components/clinic/appointments/NewAppointmentView';
import ReferralsView from './components/clinic/partnerships/ReferralsView';
import ClinicWallet from './components/clinic/clinic-mgmt/ClinicWallet';
import PlatformDashboard from './components/admin/platform/PlatformDashboard';
import ClinicManagementView from './components/clinic/clinic-mgmt/ClinicManagementView';
import ImportDataView from './components/shared/common/ImportDataView';
import BillingTiersView from './components/clinic/billing/BillingTiersView';
import AppointmentDetailView from './components/clinic/appointments/AppointmentDetailView';
import AppointmentsListView from './components/clinic/appointments/AppointmentsListView';
import AppointmentReadOnlyView from './components/clinic/appointments/AppointmentReadOnlyView';
import InventoryView from './components/clinic/inventory/InventoryView';
import ClientsView from './components/clinic/clients/ClientsView';
import ClientProfileView from './components/clinic/clients/ClientProfileView';
import PetsView from './components/clinic/pets/PetsView';
import PetProfileView from './components/clinic/pets/PetProfileView';
import RegisterClientView from './components/clinic/clients/RegisterClientView';
import RegisterPetView from './components/clinic/pets/RegisterPetView';
import EditClientView from './components/clinic/clients/EditClientView';
import EditPetModal from './components/clinic/pets/EditPetModal';
import EditAppointmentModal from './components/clinic/appointments/EditAppointmentModal';
import CommunicationPortal from './components/clinic/communication/CommunicationPortal';
import StaffListView from './components/clinic/staff/StaffListView';
import StaffProfileView from './components/clinic/staff/StaffProfileView';
import StaffRegistrationView from './components/clinic/staff/StaffRegistrationView';
import SupplierDetailView from './components/shared/marketplace/SupplierDetailView';
import SuppliersHubView from './components/shared/marketplace/SuppliersHubView';
import ClinicsManagementView from './components/admin/clinics/ClinicsManagementView';
import PurchaseOrdersView from './components/shared/marketplace/PurchaseOrdersView';
import SubscriptionManagement from './components/clinic/billing/SubscriptionManagement';
import SubPackagesAdminPage from './components/admin/subscriptions/SubPackagesAdminPage';
import SubscriptionPaymentsAdminPage from './components/admin/subscriptions/SubscriptionPaymentsAdminPage';
import SalesRepsAdminPage from './components/admin/sales-reps/SalesRepsAdminPage';
import PlatformSettingsPage from './components/admin/platform/PlatformSettingsPage';
import AdminClinicWizard from './components/admin/clinics/AdminClinicWizard';
import AdminFreelancersPage from './components/admin/freelancers/AdminFreelancersPage';
import BillingView from './components/clinic/billing/BillingView';
import PaymentProcessing from './components/clinic/billing/PaymentProcessing';
import SubscriptionUpgrade from './components/clinic/billing/SubscriptionUpgrade';
import SupplierOnboarding from './components/supplier/onboarding/SupplierOnboarding';
import SupplierVerification from './components/supplier/onboarding/SupplierVerification';
import SupplierProfileManagement from './components/supplier/profile/SupplierProfileManagement';
import PurchaseOrderDetailView from './components/shared/marketplace/PurchaseOrderDetailView';
import DateRangePicker from './components/shared/common/DateRangePicker';
import PurchaseOrderFormView from './components/shared/marketplace/PurchaseOrderFormView';
import ReceivePurchaseOrderModal from './components/shared/marketplace/ReceivePurchaseOrderModal';
import HandshakeDetailView from './components/clinic/partnerships/HandshakeDetailView';
import CreatePartnershipPage from './components/clinic/partnerships/CreatePartnershipPage';
import DeleteConfirmationDialog from './components/shared/common/DeleteConfirmationDialog';
import DialogHost from './components/shared/common/DialogHost';
import ClinicSwitcherModal from './components/clinic/clinic-mgmt/ClinicSwitcherModal';
import InitialClinicSelection from './components/clinic/clinic-mgmt/InitialClinicSelection';
import TransactionsView from './components/clinic/billing/TransactionsView';
import FinanceView from './components/clinic/billing/FinanceView';
import ToastContainer from './components/shared/common/ToastContainer';
import LoadingSpinner from './components/shared/common/LoadingSpinner';
import TourOverlay from './components/shared/common/tours/TourOverlay';
import TourMenu from './components/shared/common/tours/TourMenu';
import { TourProvider } from './contexts/TourContext';
import { TOURS } from './components/shared/common/tours/registry';
import { DisplayCurrencyProvider } from './contexts/DisplayCurrencyContext';
import { ApptStatus, ReferralStatus, ClientRegion, Referral, Appointment, TaskStatus, Clinic, Client, User, UserRole, HandshakeStatus, InventoryItem, Permission, FULL_ACCESS_ROLES, RESTRICTED_ROLES } from './types';
import { generateMedicalSummary, setClinicAIConfig } from './services/geminiService';
import { usersAPI, appointmentsAPI, inventoryAPI, suppliersAPI, purchaseOrderAPI, clientsAPI, petsAPI, toast, Supplier as APISupplier, PurchaseOrder, clinicSubscriptionAPI } from './services';
import { stripeAPI } from './services/modules/stripe.api';
import { walletAPI } from './services/modules/wallet.api';
import { CacheInvalidators } from './services/utils/cache';
import {
  Users, Calendar, Activity, Briefcase, RefreshCw, TrendingUp, Clock, MapPin, Network, Zap, HeartPulse, Check, X, Wallet, Building2, ChevronDown, ArrowUpRight, ArrowDownLeft, MessageSquare, Package, TrendingDown, BarChart3, Dna, UserCheck, Star, Shield, Lock, ShieldCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

interface NavState {
  view: string;
  params?: any;
}

// Wrapper component to fetch supplier from API
const SupplierDetailWrapper: React.FC<{
  supplierId: number | undefined;
  clinic: Clinic;
  transactions: any[];
  onBack: () => void;
  onAddToOrder?: (supplierId: string, product: any) => void;
}> = ({ supplierId, clinic, transactions, onBack, onAddToOrder }) => {
  const [supplier, setSupplier] = useState<APISupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      if (!supplierId) {
        setError('No supplier ID provided');
        setLoading(false);
        return;
      }

      try {
        console.log('[SupplierDetailWrapper] Fetching supplier:', supplierId);
        setLoading(true);
        const response = await suppliersAPI.getById(Number(supplierId));
        console.log('[SupplierDetailWrapper] Supplier response:', response);

        if (response.success && response.data.supplier) {
          setSupplier(response.data.supplier);
          setError(null);
        } else {
          setError('Supplier not found');
        }
      } catch (err: any) {
        console.error('[SupplierDetailWrapper] Failed to fetch supplier:', err);
        setError(err.message || 'Failed to load supplier');
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [supplierId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-seafoam mx-auto mb-4"></div>
          <p className="text-slate-400 font-bold">Loading supplier...</p>
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="mx-auto mb-4 text-slate-300" size={48} />
          <p className="text-slate-400 font-bold">{error || 'Supplier not found'}</p>
          <button onClick={onBack} className="mt-4 text-seafoam hover:text-pine font-bold underline">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <SupplierDetailView supplier={supplier as any} clinic={clinic} transactions={transactions} onBack={onBack} onAddToOrder={onAddToOrder} />;
};

interface AppProps {
  initialAuthView?: 'landing' | 'login' | 'forgot-password' | 'reset-password' | 'signup' | 'supplier-signup';
}

const App: React.FC<AppProps> = ({ initialAuthView = 'landing' }) => {
  const store = useStore();
  const { user, isAuthenticated, isLoading: authLoading, login, signup, logout } = useAuth();
  const { clinics: allClinics, selectedClinics, selectedClinicIds, canMultiSelect, needsInitialSelection, isLoading: clinicLoading, updateClinic } = useClinic();
  const { clients, pets, appointments, transactions, inventory, getClientById, getPetById, getClientPets, refreshAppointments, refreshClients, refreshPets, refreshTransactions, refreshInventory, ensureInventory, ensureClients, ensurePets, ensureAppointments, ensureTransactions, isLoadingClients, isLoadingPets, updateAppointmentLocally, updateAppointmentOptimistically, updateInventoryOptimistically, updatePetOptimistically, updateClientOptimistically, addAppointmentOptimistically } = useData();

  const suppliersLoaded = useRef(false);
  const { staff: allStaff, updateStaff, addStaff: addStaffMember, refreshStaff } = useStaff();
  // Views safe to persist across refresh/login (top-level only, no detail/form views)
  const PERSIST_VIEWS = new Set([
    'dashboard', 'appointments', 'clients', 'patients', 'inventory',
    'finance', 'transactions', 'staff', 'suppliers', 'purchase-orders',
    'billing', 'referrals', 'settings', 'import-data', 'supplier-dashboard',
    'supplier-products', 'supplier-orders', 'supplier-branches',
    'supplier-staff', 'supplier-management',
  ]);
  const VIEW_STORAGE_KEY = 'vethub_active_view';
  const VIEW_URL_PREFIX = '/app/';
  const viewToPath = (view: string) => `${VIEW_URL_PREFIX}${view}`;
  const pathToView = (pathname: string): string | null => {
    if (!pathname.startsWith(VIEW_URL_PREFIX)) return null;
    const v = pathname.slice(VIEW_URL_PREFIX.length).split('/')[0];
    return PERSIST_VIEWS.has(v) ? v : null;
  };

  // Set initial view based on user role and permissions, restoring last view on refresh
  const getInitialView = () => {
    // No user yet — auth screen is shown anyway, placeholder doesn't matter
    if (!user) return 'dashboard';

    // One-shot signal set by AuthContext on explicit login/signup: always land
    // on the dashboard, ignoring URL and saved-view from the previous session.
    const justLoggedIn = typeof window !== 'undefined'
      && sessionStorage.getItem('vethub_just_logged_in') === '1';
    if (justLoggedIn) {
      try { sessionStorage.removeItem('vethub_just_logged_in'); } catch {}
      if (user.role === UserRole.SUPPLIER) return 'supplier-dashboard';
      const perms = user.customPermissions ?? [];
      const hasFullAccess = FULL_ACCESS_ROLES.includes(user.role as UserRole);
      const canViewDashboard = hasFullAccess || perms.includes(Permission.VIEW_DASHBOARD);
      return canViewDashboard ? 'dashboard' : 'appointments';
    }

    // URL takes precedence — lets the back button and shareable links work
    const urlView = typeof window !== 'undefined' ? pathToView(window.location.pathname) : null;
    if (user.role === UserRole.SUPPLIER) {
      if (urlView && urlView.startsWith('supplier-')) return urlView;
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved && saved.startsWith('supplier-') && PERSIST_VIEWS.has(saved)) return saved;
      return 'supplier-dashboard';
    }
    const perms = user.customPermissions ?? [];
    const hasFullAccess = FULL_ACCESS_ROLES.includes(user.role as UserRole);
    const canViewDashboard = hasFullAccess || perms.includes(Permission.VIEW_DASHBOARD);
    if (urlView && !urlView.startsWith('supplier-')) {
      if (urlView === 'dashboard' && !canViewDashboard) { /* fall through */ }
      else return urlView;
    }
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved && PERSIST_VIEWS.has(saved) && !saved.startsWith('supplier-')) {
      if (saved === 'dashboard' && !canViewDashboard) { /* fall through */ }
      else return saved;
    }
    if (!canViewDashboard) return 'appointments';
    return 'dashboard';
  };

  const [navStack, setNavStack] = useState<NavState[]>([{ view: getInitialView() }]);
  const currentNav = navStack[navStack.length - 1];
  const activeView = currentNav.view;

  // Cache-miss fetch tracking — avoid duplicate API calls for individual records
  const [fetchingApptId, setFetchingApptId] = useState<number | null>(null);
  const apptFetchFailedRef = useRef<Set<number>>(new Set());

  // Lazy-load data on navigation — only fetch what the current view needs
  useEffect(() => {
    // Appointments list and detail views
    if (activeView === 'appointments' || activeView === 'appointment-detail' || activeView === 'view-appointment') {
      ensureAppointments();
    }
    // Workflow (appointment detail) needs inventory for the medication picker
    if (activeView === 'appointment-detail') {
      ensureInventory();
    }
    // Clients list and profile views also need appointments for history/stats
    if (activeView === 'clients' || activeView === 'client-profile') {
      ensureClients();
      ensureAppointments();
    }
    // Pet list and profile views
    if (activeView === 'patients' || activeView === 'pet-profile') {
      ensurePets();
      ensureClients();
      ensureAppointments();
    }
    // Finance and transaction views
    if (activeView === 'transactions' || activeView === 'finance') {
      ensureTransactions();
    }
    // Inventory
    if (activeView === 'inventory') ensureInventory();

    // Load suppliers on first visit to any supplier/inventory view
    if (!suppliersLoaded.current && (
      activeView === 'inventory' || activeView === 'suppliers' ||
      activeView === 'purchase-orders' || activeView.startsWith('supplier-')
    )) {
      suppliersLoaded.current = true;
      suppliersAPI.getAll({ page: 1, limit: 200 })
        .then((res: any) => {
          if (res.success && res.data?.data) {
            store.setSuppliers(res.data.data.map((s: any) => ({
              id: parseInt(s.id),
              name: s.name,
              category: s.category || '',
              contact: s.contactPhone || '',
              email: s.contactEmail || '',
              rating: Number(s.rating) || 0,
              preferredByClinics: [],
            })));
          }
        })
        .catch(() => {});
    }
  }, [activeView, ensureInventory, ensureAppointments, ensureClients, ensurePets, ensureTransactions]);

  // Cache-miss fallback: if appointment-detail navigated but appointment not in cache, fetch it
  useEffect(() => {
    if (activeView !== 'appointment-detail') return;
    const aId = currentNav.params?.appointmentId as number | undefined;
    if (!aId || typeof aId !== 'number') return;
    if (appointments.some(a => String(a.id) === String(aId))) return;
    if (fetchingApptId === aId || apptFetchFailedRef.current.has(aId)) return;

    setFetchingApptId(aId);
    (appointmentsAPI.getById(aId) as Promise<any>)
      .then((res: any) => {
        if (res.success && res.data?.appointment) {
          const a = res.data.appointment;
          addAppointmentOptimistically({
            id: parseInt(a.id),
            clinicId: parseInt(a.clinicId),
            clientId: parseInt(a.clientId),
            petId: parseInt(a.petId),
            date: a.scheduledAt,
            status: a.status,
            totalCost: a.totalCost,
            isPaid: a.isPaid,
            paymentMethod: a.paymentMethod,
            isHouseCall: a.isHouseCall,
            parentAppointmentId: a.parentAppointmentId ? parseInt(a.parentAppointmentId) : undefined,
            originReferralId: a.originReferralId ? parseInt(a.originReferralId) : undefined,
            leadStaffId: a.leadStaffId ? parseInt(a.leadStaffId) : undefined,
            leadStaff: a.leadStaff ? { id: parseInt(a.leadStaff.id), name: a.leadStaff.name, role: a.leadStaff.role } : undefined,
            client: a.client ? { id: parseInt(a.client.id), name: a.client.name, phone: a.client.phone, email: a.client.email } : undefined,
            pet: a.pet ? { id: parseInt(a.pet.id), name: a.pet.name, species: a.pet.species, breed: a.pet.breed } : undefined,
            tasks: (a.tasks || []).map((t: any) => ({
              id: parseInt(t.id),
              name: t.name,
              category: t.category,
              status: t.status,
              assignedStaffId: t.assignedStaffId ? parseInt(t.assignedStaffId) : undefined,
              assignedStaff: t.assignedStaff ? { id: parseInt(t.assignedStaff.id), name: t.assignedStaff.name } : undefined,
              price: t.price,
              notes: t.notes,
              sentiment: t.sentiment,
              selectedPhrases: t.selectedPhrases || [],
              medications: t.medications || [],
            })),
            medications: a.medications || [],
          });
        } else {
          apptFetchFailedRef.current.add(aId);
        }
      })
      .catch(() => { apptFetchFailedRef.current.add(aId); })
      .finally(() => setFetchingApptId(null));
  }, [activeView, currentNav.params?.appointmentId, appointments.length, fetchingApptId]);

  // Update view when user role changes (e.g., after login)
  useEffect(() => {
    if (isAuthenticated && user) {
      const initialView = getInitialView();
      if (navStack.length === 1 && navStack[0].view !== initialView) {
        setNavStack([{ view: initialView }]);
      }
      // Reflect the active view in the URL so back-button/refresh/share work.
      // replaceState (not pushState) so we don't add a phantom /login entry to history.
      try {
        if (window.location.pathname !== viewToPath(initialView)) {
          window.history.replaceState({ view: initialView }, '', viewToPath(initialView));
        }
      } catch {}
    }
  }, [user?.role, isAuthenticated]);
  const [showClinicSelector, setShowClinicSelector] = useState(false);
  const [showSupplierBranchModal, setShowSupplierBranchModal] = useState(false);
  // Staff add / edit are routed pages now ('staff-new' / 'staff-edit'),
  // not a modal. Old toggles removed.
  const [authView, setAuthView] = useState<'landing' | 'login' | 'forgot-password' | 'otp-verify' | 'reset-password' | 'signup' | 'demo-signup' | 'supplier-signup' | 'pricing'>(initialAuthView);
  const [isDemoSignup, setIsDemoSignup] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Handle return from Stripe checkout — sync subscription then clean URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get('billing');
    const sessionId = params.get('session_id');

    if (billingStatus === 'success' && sessionId) {
      // Sync subscription from the session — don't await, fire and let it complete
      stripeAPI.syncSession(sessionId).then(() => {
        // Navigate to billing view so the user sees the updated subscription
        navigateTo('billing');
      }).catch(() => {
        navigateTo('billing');
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (billingStatus === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('App Auth State:', {
      isAuthenticated,
      authLoading,
      clinicLoading,
      needsInitialSelection,
      user: user?.email
    });
  }, [isAuthenticated, authLoading, clinicLoading, needsInitialSelection, user]);

  // Set AI configuration when clinic changes
  useEffect(() => {
    if (selectedClinics.length > 0) {
      const firstClinic = selectedClinics[0];
      if (firstClinic.aiConfig) {
        setClinicAIConfig(firstClinic.aiConfig);
        console.log('🤖 AI Config set for clinic:', firstClinic.name, firstClinic.aiConfig);
      } else {
        // Use fallback if no config
        setClinicAIConfig({ provider: 'fallback' });
        console.log('🤖 Using fallback AI for clinic:', firstClinic.name);
      }
    }
  }, [selectedClinics]);

  const scrollPositions = useRef<Record<string, number>>({});

  // Flag to skip pushState when a navigation is triggered by the browser back button
  const suppressHistoryPush = useRef(false);
  // Set when goBack() initiates history.back() so the resulting popstate
  // doesn't pop the navStack a second time.
  const goBackInFlight = useRef(false);

  const navigateTo = (view: string, params?: any) => {
    // Save current scroll position before leaving
    scrollPositions.current[currentNav.view] = window.scrollY;
    if (view === 'appointment-detail' && currentNav.view === 'appointment-detail') {
       setNavStack(prev => [...prev.slice(0, -1), { view, params }]);
    } else {
       setNavStack(prev => [...prev, { view, params }]);
       // Push a history entry so the browser back button maps to goBack().
       // Use a real URL so refresh / share / browser back all line up with the view.
       if (!suppressHistoryPush.current) {
         try { window.history.pushState({ view, params }, '', viewToPath(view)); } catch {}
       }
    }
    // Persist top-level view so refresh restores the same page
    if (PERSIST_VIEWS.has(view)) localStorage.setItem(VIEW_STORAGE_KEY, view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const goBack = () => {
    if (navStack.length <= 1) return;
    const prevView = navStack[navStack.length - 2]?.view;
    setNavStack(prev => prev.slice(0, -1));
    // Mark this popstate as already handled so onPopState doesn't pop again.
    goBackInFlight.current = true;
    try { window.history.back(); } catch { goBackInFlight.current = false; }
    // Restore scroll position for the view we're returning to
    const savedPos = prevView ? (scrollPositions.current[prevView] ?? 0) : 0;
    requestAnimationFrame(() => window.scrollTo({ top: savedPos, behavior: 'instant' }));
  };

  // Wire browser Back button → in-app goBack without pushing another history entry.
  // If there's nothing to go back to internally, let the default (leave site) happen.
  useEffect(() => {
    const onPopState = () => {
      // If goBack() triggered this popstate, the navStack pop already happened.
      if (goBackInFlight.current) {
        goBackInFlight.current = false;
        return;
      }
      if (navStack.length > 1) {
        suppressHistoryPush.current = true;
        const prevView = navStack[navStack.length - 2]?.view;
        setNavStack(prev => prev.slice(0, -1));
        const savedPos = prevView ? (scrollPositions.current[prevView] ?? 0) : 0;
        requestAnimationFrame(() => window.scrollTo({ top: savedPos, behavior: 'instant' }));
        // Re-enable in next tick
        setTimeout(() => { suppressHistoryPush.current = false; }, 0);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [navStack.length]);

  const [dashboardTab, setDashboardTab] = useState<'finance-overview' | 'wallet' | 'b2b'>('finance-overview');
  // SUPER_ADMIN sees a Platform / Clinic toggle. Defaults to PLATFORM so the
  // admin lands on VetHub's own KPIs first; they can flip to CLINIC to drill
  // into the active clinic context.
  const [dashboardMode, setDashboardMode] = useState<'platform' | 'clinic'>('platform');
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('vethub-theme') === 'dark' || (!localStorage.getItem('vethub-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches));
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);
  const handleDashboardRefresh = async () => {
    setIsDashboardRefreshing(true);
    try {
      await Promise.all([refreshClients(), refreshPets(), refreshAppointments(), refreshTransactions(), refreshInventory()]);
    } finally {
      setIsDashboardRefreshing(false);
    }
  };

  const [metricsDateRange, setMetricsDateRange] = useState<{ start: Date | null; end: Date | null }>(() => {
    // Default the dashboard filter to *today only* — the previous default
    // (today → today + 1 year) silently swept in scheduled future
    // appointments. Picking a single calendar day matches what
    // operators expect to see when they open the dashboard.
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { start, end };
  });

  // Loading states for API operations
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
  const [isUpdatingAppointment, setIsUpdatingAppointment] = useState(false);

  // Purchase Order state
  const [receivePOModalOpen, setReceivePOModalOpen] = useState(false);
  const [selectedPOForReceive, setSelectedPOForReceive] = useState<PurchaseOrder | null>(null);

  // Edit state
  const [editingClient, setEditingClient] = useState<any>(null);
  const [editPetModalOpen, setEditPetModalOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<any>(null);
  const [editAppointmentModalOpen, setEditAppointmentModalOpen] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogConfig, setDeleteDialogConfig] = useState<{
    title: string;
    message: string;
    entityName?: string;
    onConfirm: () => void;
    confirmLabel?: string;
    busyLabel?: string;
    entityLabel?: string;
    warning?: string | null;
    tone?: 'danger' | 'warning';
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  type DeleteDialogExtras = {
    confirmLabel?: string;
    busyLabel?: string;
    entityLabel?: string;
    warning?: string | null;
    tone?: 'danger' | 'warning';
  };

  // Helper function to show delete confirmation dialog
  const showDeleteDialog = (
    title: string,
    message: string,
    entityName: string,
    onConfirm: () => void,
    extras: DeleteDialogExtras = {}
  ) => {
    setDeleteDialogConfig({ title, message, entityName, onConfirm, ...extras });
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogConfirm = async () => {
    if (!deleteDialogConfig) return;
    
    setIsDeleting(true);
    try {
      await deleteDialogConfig.onConfirm();
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteDialogConfig(null);
    }
  };
  const [editingAppointment, setEditingAppointment] = useState<any>(null);

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('vethub-theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('vethub-theme', 'light'); }
  }, [isDarkMode]);

  // Use ClinicContext data instead of legacy store
  const activeClinicsList = useMemo(() => selectedClinics, [selectedClinics]);
  const filteredAppointments = useMemo(() => {
    const selectedClinicIdsInt = selectedClinics.map(c => parseInt(c.id));
    return appointments.filter(a => selectedClinicIdsInt.includes(a.clinicId));
  }, [appointments, selectedClinics]);
  const firstActiveClinic = activeClinicsList[0] || selectedClinics[0];

  // Main wallet ID cache — avoids repeated ensure calls per session
  const mainWalletIdRef = useRef<string | null>(null);
  useEffect(() => { mainWalletIdRef.current = null; }, [firstActiveClinic?.id]);
  const getMainWalletId = async (): Promise<string | null> => {
    if (!firstActiveClinic?.id) return null;
    if (mainWalletIdRef.current) return mainWalletIdRef.current;
    try {
      const res = await walletAPI.ensure('CLINIC', String(firstActiveClinic.id));
      if (res.success) { mainWalletIdRef.current = res.data.wallet.id; return mainWalletIdRef.current; }
    } catch {}
    return null;
  };

  // Active subscription state
  const [activeClinicSubscription, setActiveClinicSubscription] = useState<import('./types').ClinicSubscription | undefined>(undefined);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  useEffect(() => {
    if (!firstActiveClinic?.id) { setActiveClinicSubscription(undefined); return; }
    setSubscriptionLoading(true);
    clinicSubscriptionAPI.getActive(firstActiveClinic.id)
      .then(res => {
        const sub = (res.data as any)?.subscription;
        if (!sub) { setActiveClinicSubscription(undefined); return; }
        const pkg = sub.package;
        setActiveClinicSubscription({
          id: parseInt(sub.id),
          clinicId: parseInt(sub.clinicId),
          packageId: parseInt(sub.packageId),
          status: sub.isActive ? 'ACTIVE' as any : 'EXPIRED' as any,
          startDate: sub.startedAt,
          endDate: sub.expiresAt,
          autoRenew: sub.autoRenew ?? false,
          package: pkg ? {
            id: parseInt(pkg.id),
            name: pkg.name,
            tier: pkg.tier as any,
            price: pkg.price,
            billingCycle: pkg.billingCycle,
            features: pkg.features ?? [],
            limits: {
              patients: pkg.maxPatients ?? -1,
              staff: pkg.maxStaff ?? -1,
              storageGb: pkg.storageGb ?? 0,
            },
            isActive: true,
          } : ({} as any),
        });
      })
      .catch(() => setActiveClinicSubscription(undefined))
      .finally(() => setSubscriptionLoading(false));
  }, [firstActiveClinic?.id]);

  const aggregateMetrics = useMemo(() => {
    const revenue = activeClinicsList.reduce((acc, c) => acc + c.balance, 0);
    const avgRating = activeClinicsList.reduce((acc, c) => acc + c.rating, 0) / (activeClinicsList.length || 1);
    const visits = store.appointments.filter(a => store.activeClinicIds.includes(a.clinicId)).length;
    return { revenue, avgRating, visits };
  }, [activeClinicsList, store.appointments]);

  // Wrapper functions that call API and refresh data
  const handleUpdateTaskStatus = async (apptId: number, taskId: number, status: TaskStatus) => {
    setIsUpdatingTask(true);
    // Optimistic update - update UI immediately
    updateAppointmentLocally(apptId, (appt) => ({
      ...appt,
      tasks: appt.tasks.map(t => t.id === taskId ? { ...t, status } : t)
    }));

    // Call API in background
    try {
      await appointmentsAPI.updateTask(apptId, taskId, { status });
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Revert on error by refreshing from server
      await refreshAppointments();
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleUpdateTaskDetails = async (apptId: number, taskId: number, data: any) => {
    setIsUpdatingTask(true);
    // Optimistic update
    updateAppointmentLocally(apptId, (appt) => ({
      ...appt,
      tasks: appt.tasks.map(t => t.id === taskId ? { ...t, ...data } : t)
    }));

    try {
      await appointmentsAPI.updateTask(apptId, taskId, data);
    } catch (error) {
      console.error('Failed to update task details:', error);
      await refreshAppointments();
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleReassignTask = async (apptId: number, taskId: number, staffId: number) => {
    setIsUpdatingTask(true);
    // Optimistic update
    updateAppointmentLocally(apptId, (appt) => ({
      ...appt,
      tasks: appt.tasks.map(t => t.id === taskId ? { ...t, assignedStaffId: staffId } : t)
    }));

    try {
      await appointmentsAPI.updateTask(apptId, taskId, { assignedStaffId: staffId });
    } catch (error) {
      console.error('Failed to reassign task:', error);
      await refreshAppointments();
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleInjectTask = async (apptId: number, taskData: any) => {
    setIsUpdatingTask(true);
    try {
      await appointmentsAPI.addTask(apptId, taskData);
      await refreshAppointments();
    } catch (error) {
      console.error('Failed to add task:', error);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleDeleteTask = async (apptId: number, taskId: number) => {
    setIsDeletingTask(true);
    try {
      await appointmentsAPI.deleteTask(apptId, taskId);
      await refreshAppointments();
    } catch (error) {
      console.error('Failed to delete task:', error);
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleProcessPayment = async (apptId: number, paymentMethod: string, discountType?: string, discountValue?: number, walletId?: string | null) => {
    setIsProcessingPayment(true);
    try {
      const appointment = appointments.find(a => a.id === apptId);
      if (!appointment) {
        console.error('Appointment not found');
        return;
      }

      // Backend handles: payment creation, status → COMPLETED, medication deduction,
      // medical record generation, and vaccination records
      const response = await appointmentsAPI.processPayment(apptId, {
        method: paymentMethod,
        clientId: appointment.clientId,
        paymentMethod,
        discountType,
        discountValue,
        ...(walletId ? { walletId } : {}),
      });

      // Update appointment state immediately with payment data — no re-fetch needed.
      // The backend response already returns the new transaction + receipt, so we
      // do NOT re-fetch the transactions list here — that was a redundant API call.
      // The Transactions page will re-fetch on its next mount via the existing
      // ensureTransactions / 1.5s in-flight de-dup window in DataContext.
      if (response && response.data) {
        const txn = response.data.transaction;
        const rcpt = response.data.receipt;
        updateAppointmentOptimistically(apptId, (appt) => ({
          ...appt,
          isPaid: true,
          paymentMethod: txn?.method,
          status: ApptStatus.COMPLETED,
          transactionId: txn?.id != null ? String(txn.id) : null,
          receiptNumber: rcpt?.receiptNumber ?? null,
        }));
      }
    } catch (error) {
      console.error('Failed to process payment:', error);
      throw error;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleUpdateApptStatus = async (apptId: number, status: ApptStatus, _diagnosis?: string, silent?: boolean) => {
    if (!silent) setIsUpdatingAppointment(true);
    const prevStatus = appointments.find(a => a.id === apptId)?.status;
    // Optimistic update immediately
    updateAppointmentOptimistically(apptId, (appt) => ({ ...appt, status }));
    try {
      // Backend handles all status transition logic (medical records, medications, etc.)
      // Response now contains full transformed appointment — use it to confirm state
      const response = await appointmentsAPI.update(apptId, { status });
      if (response?.success && response.data?.appointment) {
        const a = response.data.appointment;
        updateAppointmentOptimistically(apptId, appt => ({
          ...appt,
          status: a.status ?? appt.status,
          isPaid: a.isPaid ?? appt.isPaid,
          totalCost: a.totalCost ?? appt.totalCost,
          // tasks deliberately excluded — task state is managed by task-specific API calls
          // and overwriting here would clobber in-flight optimistic task updates
        }));
      }
    } catch (error) {
      console.error('Failed to update appointment status:', error);
      // Revert to previous status on failure
      if (prevStatus) updateAppointmentOptimistically(apptId, appt => ({ ...appt, status: prevStatus }));
    } finally {
      if (!silent) setIsUpdatingAppointment(false);
    }
  };

  // Inventory handlers
  const handleAddInventoryItem = async (item: Omit<InventoryItem, 'id' | 'status'>) => {
    try {
      console.log('[App] Adding inventory item:', item);
      const response = await inventoryAPI.create({
        name: item.name,
        category: item.category,
        sku: item.sku,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        minThreshold: item.minThreshold,
        unit: item.unit,
        price: item.price,
        costPrice: item.costPrice,
        expiryDate: item.expiryDate,
        supplierId: item.supplierId ? String(item.supplierId) : undefined,
      });

      if (response.success) {
        toast.success('Inventory item added successfully');
        CacheInvalidators.invalidateInventory();
        await refreshInventory();
      }
    } catch (error: any) {
      console.error('[App] Failed to add inventory item:', error);
      toast.error(error.message || 'Failed to add inventory item');
    }
  };

  const handleUpdateInventoryItem = async (id: number, data: Partial<InventoryItem>) => {
    try {
      console.log('[App] Updating inventory item:', id, data);

      // Optimistic update for immediate UI feedback
      updateInventoryOptimistically(String(id), (item) => ({ ...item, ...data }));

      const response = await inventoryAPI.update(id, {
        name: data.name,
        category: data.category,
        sku: data.sku,
        batchNumber: data.batchNumber,
        quantity: data.quantity,
        minThreshold: data.minThreshold,
        unit: data.unit,
        price: data.price,
        costPrice: data.costPrice,
        expiryDate: data.expiryDate,
        supplierId: data.supplierId ? String(data.supplierId) : undefined,
      });

      if (response.success) {
        toast.success('Inventory item updated successfully');
        CacheInvalidators.invalidateInventory(String(id));
        await refreshInventory();
      }
    } catch (error: any) {
      console.error('[App] Failed to update inventory item:', error);
      toast.error(error.message || 'Failed to update inventory item');
      CacheInvalidators.invalidateInventory(String(id));
      await refreshInventory();
    }
  };

  const handleUpdateStock = async (id: number, newQty: number) => {
    try {
      console.log('[App] Updating stock for item:', id, 'New quantity:', newQty);

      // Optimistic update for immediate UI feedback
      updateInventoryOptimistically(String(id), (item) => ({ ...item, quantity: newQty }));

      const response = await inventoryAPI.update(id, { quantity: newQty });

      if (response.success) {
        toast.success('Stock updated successfully');
        CacheInvalidators.invalidateInventory(String(id));
        await refreshInventory();
      }
    } catch (error: any) {
      console.error('[App] Failed to update stock:', error);
      toast.error(error.message || 'Failed to update stock');
      CacheInvalidators.invalidateInventory(String(id));
      await refreshInventory();
    }
  };

  // Client and Pet handlers
  const handleEditClient = async (id: number) => {
    // Try cache first
    let client = getClientById(id);
    if (client) {
      setEditingClient(client);
      navigateTo('edit-client');
      return;
    }
    // Not in DataContext cache — fetch from API
    try {
      const response: any = await clientsAPI.getById(id);
      if (response.success && response.data?.client) {
        const c = response.data.client;
        client = {
          id: parseInt(c.id),
          clinicId: parseInt(c.clinicId),
          title: c.title || '',
          firstName: c.firstName || '',
          secondName: c.secondName || '',
          surname: c.surname || '',
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          country: c.country || '',
          currency: c.currency || 'KES',
          gender: c.gender || 'Female',
          region: c.region || 'Local',
          dob: c.dob || '',
          lat: c.lat || null,
          lng: c.lng || null,
          clientType: c.clientType || null,
          clientTypeNote: c.clientTypeNote || '',
          maxDebt: c.maxDebt || null,
          clientRiskRate: c.clientRiskRate || null,
          internalNotes: c.internalNotes || null,
          avatar: c.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`,
          joinDate: c.joinedAt || new Date().toISOString().split('T')[0],
          totalSpent: Number(c.totalSpent) || 0,
          lastVisit: c.lastVisitAt || '',
        };
        setEditingClient(client);
        navigateTo('edit-client');
      } else {
        toast.error('Client not found');
      }
    } catch (error: any) {
      console.error('Failed to fetch client for editing:', error);
      toast.error('Failed to load client data');
    }
  };

  const handleUpdateClient = async (id: number, data: Partial<Client>) => {
    // Strip computed/server-derived fields the API shouldn't receive.
    // `name` is computed by the backend from title+firstName+secondName+surname.
    const { name, avatar, joinDate, totalSpent, lastVisitAt, joinedAt, petCount, appointmentCount, ...payload } = data;
    const response: any = await clientsAPI.update(id, payload);
    if (!response.success) {
      toast.error(response.message || 'Failed to update client');
      throw new Error(response.message || 'Failed to update client');
    }
    const updated = response.data?.client;
    if (updated) {
      updateClientOptimistically(id, (c) => ({
        ...c,
        ...updated,
        id: parseInt(updated.id),
        clinicId: parseInt(updated.clinicId),
      }));
    }
    CacheInvalidators.invalidateClients(String(id));
    toast.success('Client updated');
  };

  const handleDeleteClient = async (id: number) => {
    const client = getClientById(id);
    if (!client) return;

    // "Delete" is soft — the backend flips isActive=false. The client and
    // every record they own stays in the DB and remains visible to staff,
    // but no new pets / appointments can be attached. Wording reflects that.
    showDeleteDialog(
      'Deactivate Client',
      'Deactivate this client? Their profile and prior records (pets, appointments, invoices) stay visible, but no new pets or appointments can be created. You can reactivate later.',
      client.name,
      async () => {
        const response: any = await clientsAPI.delete(id);
        if (response.success) {
          toast.success('Client deactivated');
          CacheInvalidators.invalidateClients(String(id));
          await refreshClients();
        } else {
          throw new Error(response.message || 'Failed to deactivate client');
        }
      },
      {
        confirmLabel: 'Deactivate',
        busyLabel: 'Deactivating...',
        entityLabel: 'Client to Deactivate:',
        warning: 'You can reactivate this client later from the filters.',
        tone: 'warning',
      }
    );
  };

  const handleEditPet = async (id: number) => {
    // Try cache first
    let pet = getPetById(id);
    if (pet) {
      setEditingPet(pet);
      setEditPetModalOpen(true);
      return;
    }
    // Not in DataContext cache (paginated data) — fetch from API
    try {
      const response: any = await petsAPI.getById(id);
      if (response.success && response.data?.pet) {
        const p = response.data.pet;
        pet = {
          id: parseInt(p.id),
          clinicId: parseInt(p.clinicId),
          ownerId: parseInt(p.ownerId || p.clientId),
          name: p.name,
          species: p.species?.name || p.species || 'Dog',
          breed: p.breed?.name || p.breed || 'Mixed Breed',
          dob: p.dob ? new Date(p.dob).toISOString().split('T')[0] : '',
          gender: p.gender || 'Male',
          weight: p.weightValue ? `${p.weightValue} ${p.weightUnit || 'kg'}` : '0 kg',
          avatar: p.avatarUrl || (p.species === 'Cat' ? '🐱' : '🐶'),
          microchipId: p.rfidChipNumber || '',
          medicalHistory: [],
          vaccinations: [],
        };
        setEditingPet(pet);
        setEditPetModalOpen(true);
      } else {
        toast.error('Pet not found');
      }
    } catch (error: any) {
      console.error('Failed to fetch pet for editing:', error);
      toast.error('Failed to load pet data');
    }
  };

  const handleDeletePet = async (id: number) => {
    const pet = getPetById(id);
    if (!pet) return;

    showDeleteDialog(
      'Delete Pet',
      'Are you sure you want to delete this pet? This will also delete all associated appointments and medical records.',
      pet.name,
      async () => {
        const response: any = await petsAPI.delete(id);
        if (response.success) {
          toast.success('Pet deleted successfully');
          CacheInvalidators.invalidatePets(String(id));
          await refreshPets();
        } else {
          throw new Error(response.message || 'Failed to delete pet');
        }
      }
    );
  };

  const handleUpdatePet = async (id: number, data: Partial<any>) => {
    try {
      const response: any = await petsAPI.update(id, data as any);
      if (response.success) {
        // Update pet in local state optimistically
        updatePetOptimistically(id, (pet) => ({ ...pet, ...data }));
      } else {
        throw new Error(response.message || 'Failed to update pet');
      }
    } catch (error: any) {
      console.error('Failed to update pet:', error);
      toast.error(error.message || 'Failed to update pet');
      throw error;
    }
  };

  const handleEditAppointment = (id: number) => {
    const appointment = appointments.find(a => a.id === id);
    if (appointment) {
      setEditingAppointment(appointment);
      setEditAppointmentModalOpen(true);
    }
  };

  const handleDeleteAppointment = async (id: number) => {
    try {
      const response: any = await appointmentsAPI.delete(id);
      if (response.success) {
        toast.success('Appointment deleted successfully');
        await refreshAppointments();
      } else {
        throw new Error(response.message || 'Failed to delete appointment');
      }
    } catch (error: any) {
      console.error('Failed to delete appointment:', error);
      toast.error(error.message || 'Failed to delete appointment');
    }
  };

  // Show loading state while checking authentication or clinics
  if (authLoading || (isAuthenticated && clinicLoading)) {
    return (
      <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">
            🐾
          </div>
          <p className="text-[#438883] font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle authentication views
  if (!isAuthenticated || !user) {
    if (authView === 'landing') {
      return (
        <LandingPage
          onLogin={() => setAuthView('login')}
          onRegister={() => setAuthView('signup')}
          onDemo={() => { setIsDemoSignup(true); setAuthView('demo-signup'); }}
          onPricing={() => setAuthView('pricing')}
          onSupplierSignup={() => setAuthView('supplier-signup')}
        />
      );
    }

    if (authView === 'pricing') {
      return (
        <PricingPage
          onBack={() => setAuthView('landing')}
          onRegister={() => setAuthView('signup')}
        />
      );
    }

    // Login: dedicated full-page experience with crossfading pet photo background
    if (authView === 'login') {
      return (
        <LoginPage
          onLogin={async (data) => {
            store.login(data.user.email);
          }}
          onForgotPassword={() => setAuthView('forgot-password')}
          onSignup={() => setAuthView('signup')}
          onSupplierSignup={() => setAuthView('supplier-signup')}
          onBackToLanding={() => setAuthView('landing')}
        />
      );
    }

    // Password-recovery flow: same full-bleed pet-photo background as Login
    const authShellViews = ['forgot-password', 'otp-verify', 'reset-password'];
    if (authShellViews.includes(authView)) {
      const card =
        authView === 'forgot-password' ? (
          <ForgotPasswordPage
            onBackToLogin={() => setAuthView('login')}
            onEmailVerified={(email) => {
              setResetEmail(email);
              setAuthView('otp-verify');
            }}
          />
        ) : authView === 'otp-verify' ? (
          <VerifyOTPPage
            email={resetEmail}
            onBackToForgotPassword={() => setAuthView('forgot-password')}
            onOTPVerified={() => setAuthView('reset-password')}
          />
        ) : (
          <ResetPasswordPage
            email={resetEmail}
            onBackToLogin={() => setAuthView('login')}
          />
        );

      return <AuthShell>{card}</AuthShell>;
    }

    if (authView === 'signup' || authView === 'demo-signup') {
      return (
        <SignupWizard
          isDemo={authView === 'demo-signup'}
          onBackToLogin={() => { setIsDemoSignup(false); setAuthView('login'); }}
          onSignupSuccess={async (data) => {
            // Use the signup method from AuthContext
            await signup(data);
            // Also update the legacy store for backward compatibility
            store.login(data.user.email);
            setIsDemoSignup(false);
          }}
        />
      );
    }

    if (authView === 'supplier-signup') {
      return (
        <SupplierRegistration
          onSubmit={async (data) => {
            try {
              // Call the public supplier registration API via the
              // configured apiClient — was previously hardcoded to
              // http://localhost:5001 which broke registration on
              // staging / prod with a CORS error.
              const result = await suppliersAPI.register({
                name: data.companyName,
                category: data.category,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                address: data.address,
                isActive: true, // Auto-approved for now (manual verification assumed)
                userEmail: data.userEmail,
                userPassword: data.userPassword,
                userName: data.userName,
              });

              if (!result.success) {
                throw new Error(result.message || 'Failed to register supplier');
              }

              // Auto-login the newly created supplier user
              await login(data.userEmail, data.userPassword);

              // Update legacy store
              store.login(data.userEmail);
            } catch (error: any) {
              throw new Error(error?.response?.data?.message || error?.message || 'Failed to register supplier');
            }
          }}
          onCancel={() => setAuthView('login')}
        />
      );
    }

    // Fallback: go to landing
    return (
      <LandingPage
        onLogin={() => setAuthView('login')}
        onRegister={() => setAuthView('signup')}
        onDemo={() => { setIsDemoSignup(true); setAuthView('demo-signup'); }}
        onPricing={() => setAuthView('pricing')}
        onSupplierSignup={() => setAuthView('supplier-signup')}
      />
    );
  }

  // Show initial clinic selection screen if needed
  if (isAuthenticated && user && needsInitialSelection) {
    return (
      <InitialClinicSelection
        onComplete={() => {
          // After selection, the needsInitialSelection flag will be false
          // and the app will render the dashboard
          console.log('Initial clinic selection completed');
        }}
      />
    );
  }

  const renderOperations = () => {
    const b2bRequests = store.referrals.filter(r => store.activeClinicIds.includes(r.destClinicId));
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="compact-card">
              <p className="card-subtitle mb-1">Aggregate Revenue</p>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 font-mono tracking-tighter">{firstActiveClinic?.currency || 'KES'} {aggregateMetrics.revenue.toLocaleString()}</h3>
           </div>
           <div className="compact-card">
              <p className="card-subtitle mb-1">Average Rating</p>
              <div className="flex items-center gap-2">
                 <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter">{aggregateMetrics.avgRating.toFixed(1)}</h3>
                 <div className="flex text-amber-500"><Star size={12} fill="currentColor"/></div>
              </div>
           </div>
           <div className="compact-card">
              <p className="card-subtitle mb-1">Active Visits</p>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter">{aggregateMetrics.visits} Visits</h3>
           </div>
           <div className="compact-card">
              <p className="card-subtitle mb-1">Total Clinics</p>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter">{activeClinicsList.length}</h3>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Today's Appointments</h3>
                <div className="flex -space-x-2">
                   {activeClinicsList.map(c => <div key={c.id} className="w-8 h-8 rounded-full bg-slate-50 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-xs shadow-sm" title={c.name}>{c.logo}</div>)}
                </div>
             </div>
             <div className="space-y-3">
                {(() => {
                  // Get today's date at midnight
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  // Filter for today's appointments only
                  const todaysAppointments = filteredAppointments.filter(a => {
                    const apptDate = new Date(a.date);
                    return apptDate >= today && apptDate < tomorrow;
                  });

                  // Sort by time (closest to current time first)
                  const now = new Date();
                  const sortedAppointments = todaysAppointments.sort((a, b) => {
                    const aTime = Math.abs(new Date(a.date).getTime() - now.getTime());
                    const bTime = Math.abs(new Date(b.date).getTime() - now.getTime());
                    return aTime - bTime;
                  });

                  return sortedAppointments.length > 0 ? sortedAppointments.slice(0, 5).map(a => {
                    const pet = getPetById(a.petId);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700 hover:border-seafoam transition-all group">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform">{pet?.species === 'Dog' ? '🐶' : '🐱'}</div>
                            <div>
                               <p className="text-sm font-black text-pine dark:text-zinc-100 truncate uppercase leading-none">{pet?.name}</p>
                               <p className="text-slate-400 text-[8px] font-bold uppercase mt-1">Visit #{a.id} • {activeClinicsList.find(c=>c.id===a.clinicId)?.name}</p>
                            </div>
                         </div>
                         <button onClick={() => navigateTo('appointment-detail', { appointmentId: a.id })} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase text-pine dark:text-zinc-300 shadow-sm transition-all">Inspect</button>
                      </div>
                    );
                  }) : <div className="py-12 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">No Appointments Today</div>;
                })()}
             </div>
          </div>

          <div className="lg:col-span-4 bg-indigo-500 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:rotate-12 transition-transform duration-700"><Building2 size={100}/></div>
             <div className="relative z-10">
                <h3 className="text-lg font-black uppercase tracking-tighter mb-1">Enterprise Network</h3>
                <p className="text-indigo-100 text-[10px] font-bold mb-6">Aggregate Referral Traffic</p>
                <div className="space-y-3">
                   {b2bRequests.length > 0 ? b2bRequests.map(r => (
                     <div key={r.id} className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-md">
                        <p className="text-base font-black mt-1 leading-none uppercase tracking-tight truncate">{r.petName}</p>
                        <p className="text-[8px] font-bold opacity-80 mt-1.5 uppercase tracking-widest">{r.serviceName}</p>
                     </div>
                   )) : <p className="py-8 text-center opacity-40 uppercase font-black text-[8px] tracking-[0.3em]">Network Idle</p>}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMetrics = () => {
    // Filter appointments based on date range — clinic-TZ calendar dates
    // so today is always in range regardless of browser TZ.
    const toClinicDateStr = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(d);
      const y = parts.find(p => p.type === 'year')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${y}-${m}-${day}`;
    };
    const getFilteredAppointments = () => {
      if (!metricsDateRange.start || !metricsDateRange.end) {
        // Default to today if no range selected
        const todayStr = toClinicDateStr(new Date());
        return filteredAppointments.filter(a => toClinicDateStr(new Date(a.date)) === todayStr);
      }
      const startStr = toClinicDateStr(new Date(metricsDateRange.start));
      const endStr = toClinicDateStr(new Date(metricsDateRange.end));
      return filteredAppointments.filter(a => {
        const s = toClinicDateStr(new Date(a.date));
        return s >= startStr && s <= endStr;
      });
    };

    const rangeAppointments = getFilteredAppointments();

    // Calculate metrics
    const totalAppointments = rangeAppointments.length;
    const scheduledCount = rangeAppointments.filter(a => a.status === ApptStatus.SCHEDULED).length;
    const inProgressCount = rangeAppointments.filter(a => a.status === ApptStatus.IN_PROGRESS).length;
    const completedCount = rangeAppointments.filter(a => a.status === ApptStatus.COMPLETED).length;
    const potentialRevenue = rangeAppointments.reduce((sum, a) => sum + (a.totalCost || 0), 0);

    const dateRangeLabel = !metricsDateRange.start || !metricsDateRange.end
      ? "Today's Appointments"
      : `Appointments (${new Date(metricsDateRange.start).toLocaleDateString()} - ${new Date(metricsDateRange.end).toLocaleDateString()})`;

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
        {/* Date Range Picker */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">
            Appointment Metrics
          </h2>
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={metricsDateRange}
              onChange={setMetricsDateRange}
            />
            <button
              onClick={handleDashboardRefresh}
              disabled={isDashboardRefreshing}
              className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-pine dark:hover:border-zinc-500 transition-all disabled:opacity-50"
              title="Refresh all data"
            >
              <RefreshCw size={14} className={isDashboardRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Appointments */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <Calendar size={32} className="opacity-80" />
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Total</p>
                <h3 className="text-4xl font-black font-mono tracking-tighter">{totalAppointments}</h3>
              </div>
            </div>
            <p className="text-sm font-bold opacity-90">Appointments</p>
          </div>

          {/* Scheduled */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <Clock size={32} className="opacity-80" />
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Scheduled</p>
                <h3 className="text-4xl font-black font-mono tracking-tighter">{scheduledCount}</h3>
              </div>
            </div>
            <p className="text-sm font-bold opacity-90">Pending Visits</p>
          </div>

          {/* In Progress */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <Activity size={32} className="opacity-80" />
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-80">In Progress</p>
                <h3 className="text-4xl font-black font-mono tracking-tighter">{inProgressCount}</h3>
              </div>
            </div>
            <p className="text-sm font-bold opacity-90">Active Now</p>
          </div>

          {/* Completed */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <Check size={32} className="opacity-80" />
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Completed</p>
                <h3 className="text-4xl font-black font-mono tracking-tighter">{completedCount}</h3>
              </div>
            </div>
            <p className="text-sm font-bold opacity-90">Finished Visits</p>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-gradient-to-br from-pine to-seafoam text-white rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-2">Potential Revenue</p>
              <h3 className="text-3xl sm:text-5xl font-black font-mono tracking-tighter break-all">{firstActiveClinic?.currency || 'KES'} {potentialRevenue.toLocaleString()}</h3>
              <p className="text-sm font-bold opacity-90 mt-2">{dateRangeLabel}</p>
            </div>
            <TrendingUp size={48} className="opacity-20 shrink-0 hidden sm:block" />
          </div>
        </div>

        {/* Appointments List */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-8 shadow-sm">
          <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tighter mb-6">
            {dateRangeLabel}
          </h3>
          <div className="space-y-3">
            {rangeAppointments.length > 0 ? rangeAppointments.slice(0, 10).map(a => {
              const pet = getPetById(a.petId);
              const statusColors = {
                [ApptStatus.SCHEDULED]: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
                [ApptStatus.IN_PROGRESS]: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                [ApptStatus.COMPLETED]: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
                [ApptStatus.CANCELLED]: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
              };

              return (
                <div key={a.id} className="flex items-center justify-between gap-2 p-3 sm:p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700 hover:border-seafoam transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-inner group-hover:scale-105 transition-transform shrink-0">
                      {pet?.species === 'Dog' ? '🐶' : pet?.species === 'Cat' ? '🐱' : '🐾'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 truncate uppercase leading-none">{pet?.name}</p>
                      <p className="text-slate-400 text-[8px] font-bold uppercase mt-1 truncate">
                        {new Date(a.date).toLocaleDateString()} • {new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`hidden sm:inline px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${statusColors[a.status] || statusColors[ApptStatus.SCHEDULED]}`}>
                      {a.status}
                    </span>
                    <button
                      onClick={() => navigateTo('appointment-detail', { appointmentId: a.id })}
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-3 sm:px-4 py-1.5 rounded-xl text-[9px] font-black uppercase text-pine dark:text-zinc-300 shadow-sm hover:shadow-md transition-all"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="py-12 text-center text-slate-300 dark:text-zinc-600 text-xs font-bold uppercase tracking-widest">
                No Appointments Found
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderB2BStats = () => {
    // Filter referrals by date range
    let b2bReferrals = store.referrals.filter(r =>
      store.activeClinicIds.includes(r.destClinicId) || store.activeClinicIds.includes(r.originClinicId)
    );

    // Apply date range filter if set — clinic-TZ calendar dates
    if (metricsDateRange.start && metricsDateRange.end) {
      const toStr = (d: Date) => {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Nairobi',
          year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(d);
        const y = parts.find(p => p.type === 'year')?.value || '';
        const m = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        return `${y}-${m}-${day}`;
      };
      const startStr = toStr(new Date(metricsDateRange.start));
      const endStr = toStr(new Date(metricsDateRange.end));
      b2bReferrals = b2bReferrals.filter(r => {
        const s = toStr(new Date(r.createdAt || r.requestedAt));
        return s >= startStr && s <= endStr;
      });
    }

    const incomingReferrals = b2bReferrals.filter(r => store.activeClinicIds.includes(r.destClinicId));
    const outgoingReferrals = b2bReferrals.filter(r => store.activeClinicIds.includes(r.originClinicId));
    // Revenue generated = what we earned from incoming referrals (we performed the service)
    const revenueGenerated = incomingReferrals.reduce((sum, r) => sum + (r.payoutAmount || 0), 0);
    // Revenue provided = what we paid out for outgoing referrals (we sent to others)
    const revenueProvided = outgoingReferrals.reduce((sum, r) => sum + (r.payoutAmount || 0), 0);

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
        {/* Date Range Picker */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">
            B2B Partnership Statistics
          </h2>
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={metricsDateRange}
              onChange={setMetricsDateRange}
            />
            <button
              onClick={handleDashboardRefresh}
              disabled={isDashboardRefreshing}
              className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-pine dark:hover:border-zinc-500 transition-all disabled:opacity-50"
              title="Refresh all data"
            >
              <RefreshCw size={14} className={isDashboardRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="compact-card">
            <p className="card-subtitle mb-1">Total Referrals</p>
            <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter">{b2bReferrals.length}</h3>
          </div>
          <div className="compact-card">
            <p className="card-subtitle mb-1">Incoming</p>
            <h3 className="text-xl font-black text-emerald-600 tracking-tighter">{incomingReferrals.length}</h3>
          </div>
          <div className="compact-card">
            <p className="card-subtitle mb-1">Outgoing</p>
            <h3 className="text-xl font-black text-cyan tracking-tighter">{outgoingReferrals.length}</h3>
          </div>
          <div className="compact-card">
            <p className="card-subtitle mb-1">Revenue Generated</p>
            <h3 className="text-xl font-black text-emerald-600 font-mono tracking-tighter">{firstActiveClinic?.currency || 'KES'} {revenueGenerated.toLocaleString()}</h3>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">From incoming referrals</p>
          </div>
          <div className="compact-card">
            <p className="card-subtitle mb-1">Revenue Provided</p>
            <h3 className="text-xl font-black text-amber-600 font-mono tracking-tighter">{firstActiveClinic?.currency || 'KES'} {revenueProvided.toLocaleString()}</h3>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Paid for outgoing referrals</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-8 shadow-sm">
          <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tighter mb-6">B2B Partnership Statistics</h3>
          <div className="space-y-4">
            {b2bReferrals.length > 0 ? b2bReferrals.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-3 sm:p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm shrink-0">
                    {store.activeClinicIds.includes(r.destClinicId) ? '📥' : '📤'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase leading-none truncate">{r.petName}</p>
                    <p className="text-slate-400 text-[8px] font-bold uppercase mt-1 truncate">{r.serviceName} • {r.status}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black font-mono ${store.activeClinicIds.includes(r.destClinicId) ? 'text-emerald-600' : 'text-amber-600'}`}>KES {(r.payoutAmount || 0).toLocaleString()}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                    {store.activeClinicIds.includes(r.destClinicId) ? 'Revenue Generated' : 'Revenue Provided'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">No B2B Activity</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // SUPER_ADMIN dashboard mode toggle — Platform = VetHub-level metrics,
  // Clinic = per-clinic dashboard scoped to the active clinic selection.
  const DashboardModeToggle: React.FC<{
    mode: 'platform' | 'clinic';
    onChange: (m: 'platform' | 'clinic') => void;
  }> = ({ mode, onChange }) => (
    <div className="flex w-full sm:w-auto bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      {([
        { id: 'platform' as const, label: 'Platform Super View' },
        { id: 'clinic' as const, label: 'Clinic View' },
      ]).map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
            mode === opt.id
              ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-zinc-700'
              : 'text-slate-400 hover:text-pine'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const renderDashboard = () => {
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
    // SUPER_ADMIN gets the Platform Super View by default. Anyone else
    // (or the admin after flipping the toggle) sees the per-clinic dashboard.
    if (isSuperAdmin && dashboardMode === 'platform') {
      return (
        <div className="space-y-6 animate-in fade-in duration-300">
          <DashboardModeToggle mode={dashboardMode} onChange={setDashboardMode} />
          <PlatformDashboard />
        </div>
      );
    }
    // Demo trial card computation
    const isClinicDemo = firstActiveClinic?.isDemo === true;
    const DEMO_TRIAL_DAYS = 40;
    const demoTrialInfo = (() => {
      if (!isClinicDemo && activeClinicSubscription?.status !== 'TRIAL') return null;
      const startDate = activeClinicSubscription?.startDate || firstActiveClinic?.createdAt;
      if (!startDate) return { daysLeft: DEMO_TRIAL_DAYS, daysUsed: 0, registeredDate: 'N/A', expiresDate: 'N/A', progress: 0 };
      const start = new Date(startDate);
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, DEMO_TRIAL_DAYS - elapsed);
      const expires = new Date(start.getTime() + DEMO_TRIAL_DAYS * 24 * 60 * 60 * 1000);
      return {
        daysLeft,
        daysUsed: elapsed,
        registeredDate: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        expiresDate: expires.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        progress: Math.min(100, (elapsed / DEMO_TRIAL_DAYS) * 100),
      };
    })();

    return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {isSuperAdmin && (
        <DashboardModeToggle mode={dashboardMode} onChange={setDashboardMode} />
      )}
      {/* Clinics-in-scope KPI strip — visible to admin roles, shows how
          many clinics the current selection covers + active/inactive split.
          Quick at-a-glance answer to "how big is my fleet right now?". */}
      {isSuperAdmin && (() => {
        const total = allClinics.length;
        const inScope = selectedClinicIds.length || total;
        const active = allClinics.filter(c => c.isActive !== false).length;
        const inactive = total - active;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="compact-card">
              <p className="card-subtitle mb-1">Clinics in Scope</p>
              <h3 className="text-xl font-black text-seafoam tracking-tighter font-mono">{inScope}</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">of {total} total</p>
            </div>
            <div className="compact-card">
              <p className="card-subtitle mb-1">Active</p>
              <h3 className="text-xl font-black text-emerald-600 tracking-tighter font-mono">{active}</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">live clinics</p>
            </div>
            <div className="compact-card">
              <p className="card-subtitle mb-1">Inactive</p>
              <h3 className="text-xl font-black text-pine/40 dark:text-zinc-600 tracking-tighter font-mono">{inactive}</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">paused / off</p>
            </div>
            <div className="compact-card">
              <p className="card-subtitle mb-1">Active Clinic</p>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight truncate" title={firstActiveClinic?.name}>
                {firstActiveClinic?.name || '—'}
              </h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">primary scope</p>
            </div>
          </div>
        );
      })()}
      {/* Demo Trial Card */}
      {demoTrialInfo && (
        <div className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm ${
          demoTrialInfo.daysLeft <= 7
            ? 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200 dark:border-red-800'
            : 'bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20 border-cyan-200 dark:border-cyan-800'
        }`}>
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Zap size={80} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Zap size={16} className={demoTrialInfo.daysLeft <= 7 ? 'text-red-500' : 'text-cyan-500'} />
                <h3 className="text-sm font-black uppercase tracking-widest text-pine dark:text-zinc-100">
                  Demo Account
                </h3>
                <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full ${
                  demoTrialInfo.daysLeft <= 7
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400'
                }`}>
                  {demoTrialInfo.daysLeft === 0 ? 'Expired' : `${demoTrialInfo.daysLeft} days left`}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Registered</p>
                  <p className="text-xs font-black text-pine dark:text-zinc-200">{demoTrialInfo.registeredDate}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Expires</p>
                  <p className="text-xs font-black text-pine dark:text-zinc-200">{demoTrialInfo.expiresDate}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Trial Period</p>
                  <p className="text-xs font-black text-pine dark:text-zinc-200">{DEMO_TRIAL_DAYS} days</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-sm">
                <div className="h-1.5 bg-white/60 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      demoTrialInfo.daysLeft <= 7 ? 'bg-red-500' : demoTrialInfo.daysLeft <= 14 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${demoTrialInfo.progress}%` }}
                  />
                </div>
                <p className="text-[8px] font-bold text-slate-400 mt-1">{demoTrialInfo.daysUsed} of {DEMO_TRIAL_DAYS} days used</p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('subscription-management')}
              className="flex items-center gap-2 px-6 py-3 bg-seafoam hover:bg-seafoam/90 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-seafoam/20 transition-all active:scale-95 shrink-0"
            >
              <ArrowUpRight size={14} />
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      <div className="flex w-full sm:w-auto bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
        {[
          { id: 'finance-overview', label: 'Finance Overview' },
          { id: 'wallet', label: 'Finance Core' },
          { id: 'b2b', label: 'B2B Stats' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${dashboardTab === tab.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}>{tab.label}</button>
        ))}
      </div>
      {dashboardTab === 'finance-overview' ? (
        <FinanceView
          dateRange={metricsDateRange}
          onDateRangeChange={setMetricsDateRange}
          onRefresh={handleDashboardRefresh}
          isRefreshing={isDashboardRefreshing}
          clinicId={firstActiveClinic?.id}
          onGoToWallet={() => setDashboardTab('wallet')}
        />
      ) :
       dashboardTab === 'wallet' ? <ClinicWallet clinic={firstActiveClinic} allClinics={store.clinics} transactions={store.transactions} onAddTransaction={store.addTransaction} /> :
       renderB2BStats()}
    </div>
    );
  };

  // Returns true if the current user can access the given view
  const canAccess = (view: string): boolean => {
    const role = user?.role as UserRole;
    const perms = user?.customPermissions ?? [];
    const hasFullAccess = FULL_ACCESS_ROLES.includes(role);
    const hasPerm = (perm: string) => hasFullAccess || perms.includes(perm);

    // Views always open to all authenticated clinic users
    const openViews = ['appointments', 'new-appointment', 'appointment-detail', 'view-appointment',
                       'clients', 'client-profile', 'register-client',
                       'patients', 'pet-profile', 'register-pet'];
    if (openViews.includes(view)) return true;

    // Dashboard requires CLINIC_OWNER+ or explicit permission
    if (view === 'dashboard') return hasPerm(Permission.VIEW_DASHBOARD);

    // Inventory — open to all clinic staff
    if (['inventory', 'purchase-orders', 'purchase-order-detail', 'purchase-order-form'].includes(view))
      return true;

    // Finance group
    if (['finance', 'financial-overview', 'b2b-stats', 'transactions', 'financial-core'].includes(view))
      return hasPerm(Permission.VIEW_FINANCE);

    // Referrals / partners
    if (view === 'referrals') return hasPerm(Permission.VIEW_REFERRALS);

    // Clinic management group
    if (['settings', 'staff', 'staff-profile', 'billing', 'import-data'].includes(view))
      return hasPerm(Permission.VIEW_CLINIC_MGMT);

    // Suppliers hub — full-access roles or users with VIEW_SUPPLIERS permission
    if (['suppliers', 'supplier-detail'].includes(view))
      return hasPerm(Permission.VIEW_SUPPLIERS);

    // Everything else (platform-admin views, etc.) — full-access roles only
    return hasFullAccess;
  };

  const renderContent = () => {
    // Supplier-specific views — open to SUPPLIER's normal nav AND to admin
    // roles when they pick the Supplier audience in the sidebar. Without
    // the admin opening these wouldn't render at all (the activeView would
    // fall through to the regular switch below which doesn't know them).
    const isSupplierView =
      activeView.startsWith('supplier-')
      || activeView === 'supplier-detail'
      || activeView === 'supplier-employee-profile';
    const canRenderSupplierView =
      user?.role === UserRole.SUPPLIER
      || user?.role === UserRole.SUPER_ADMIN
      || user?.role === UserRole.MERCHANT_ADMIN;

    if (user?.role === UserRole.SUPPLIER || (isSupplierView && canRenderSupplierView)) {
      switch (activeView) {
        case 'supplier-dashboard': return <SupplierDashboard setView={navigateTo} />;
        case 'supplier-profile':
          return <SupplierProfileManagement
            supplier={{
              id: user.id || '1',
              name: user.name || 'Supplier Name',
              category: 'Pharmaceuticals',
              contactEmail: user.email,
              contactPhone: '+1234567890',
              address: '123 Main St',
              rating: 4.5,
              isActive: true,
              userId: user.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }}
            products={[]}
            onUpdateProfile={async (data) => {
              console.log('Update supplier profile:', data);
            }}
            onAddProduct={async (product) => {
              console.log('Add product:', product);
            }}
            onUpdateProduct={async (productId, data) => {
              console.log('Update product:', productId, data);
            }}
            onDeleteProduct={async (productId) => {
              console.log('Delete product:', productId);
            }}
          />;
        case 'supplier-products': return <SupplierProductsView setView={navigateTo} />;
        case 'supplier-inventory': return <SupplierProductsView setView={navigateTo} />;
        case 'supplier-product-new': return <SupplierProductFormPage setView={navigateTo} />;
        case 'supplier-product-edit': return <SupplierProductFormPage productId={currentNav.params?.productId} setView={navigateTo} />;
        case 'supplier-orders': return <SupplierOrdersView setView={navigateTo} />;
        case 'supplier-order-detail': return <SupplierOrderDetailView orderId={currentNav.params?.orderId} setView={navigateTo} />;
        case 'supplier-management': return <SupplierManagementView setView={navigateTo} initialTab="identity" />;
        case 'supplier-branches': return <SupplierManagementView setView={navigateTo} initialTab="branches" />;
        case 'supplier-employees': return <SupplierManagementView setView={navigateTo} initialTab="personnel" />;
        case 'supplier-employee-profile': return <SupplierEmployeeProfileView employeeId={String(currentNav.params?.employeeId)} onBack={goBack} />;
        case 'supplier-settings': return <SupplierManagementView setView={navigateTo} initialTab="identity" />;
        case 'supplier-billing': return <SupplierManagementView setView={navigateTo} initialTab="subscription" />;
        default: return <SupplierDashboard setView={navigateTo} />;
      }
    }

    // Regular clinic/admin views — enforce access control for restricted roles
    if (!canAccess(activeView)) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Lock className="text-slate-300 mb-4" size={48} />
          <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest">Access Restricted</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xs">
            You don't have permission to view this page. Contact your clinic owner to request access.
          </p>
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard': return renderDashboard();
      case 'appointments': return <AppointmentsListView pets={pets} clinics={store.clinics} allStaff={allStaff} onManageWorkflow={(id) => navigateTo('appointment-detail', { appointmentId: id })} onUpdateApptStatus={store.updateAppointmentStatus} onOpenBooking={() => navigateTo('new-appointment')} onProcessPayment={handleProcessPayment} onViewDetails={(id) => navigateTo('view-appointment', { appointmentId: id })} onEditAppointment={handleEditAppointment} onDeleteAppointment={handleDeleteAppointment} />;
      case 'new-appointment':
        return <NewAppointmentView
          clients={clients}
          pets={pets}
          appointments={appointments}
          onSave={async (appointmentData) => {
            setIsCreatingAppointment(true);
            try {
              console.log('Creating appointment:', appointmentData);
              const response = await appointmentsAPI.create(appointmentData);
              if (response.success) {
                console.log('✅ Appointment created successfully:', response.data);
                // Refresh appointments list to show the new appointment
                await refreshAppointments();
                navigateTo('appointments');
              } else {
                console.error('❌ Failed to create appointment:', response.message);
                toast.error('Failed to create appointment: ' + response.message);
              }
            } catch (error) {
              console.error('❌ Error creating appointment:', error);
              toast.error('Error creating appointment. Please try again.');
            } finally {
              setIsCreatingAppointment(false);
            }
          }}
          onCancel={goBack}
          initialClientId={currentNav.params?.initialClientId}
          initialPetId={currentNav.params?.initialPetId}
          initialCategoryId={currentNav.params?.initialCategoryId}
          initialParentApptId={currentNav.params?.initialParentApptId}
        />;
      case 'patients': return <PetsView clinics={store.clinics} onViewPet={(id, tab) => navigateTo('pet-profile', { petId: id, initialTab: tab })} onGenerateAiSummary={async (h) => { setLoadingAi(true); const s = await generateMedicalSummary(h); setAiSummary(s); setLoadingAi(false); }} loadingAi={loadingAi} onRegisterPet={() => navigateTo('register-pet')} onNewAppointment={(clientId, petId) => navigateTo('new-appointment', { initialClientId: clientId, initialPetId: petId })} onEditPet={handleEditPet} onDeletePet={handleDeletePet} />;
      case 'pet-profile':
        const pId = currentNav.params?.petId;
        // Type check: ensure pId is a valid number
        if (!pId || typeof pId !== 'number') {
          return (
            <div className="p-6">
              <button onClick={goBack} className="mb-4 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700">
                ← Back
              </button>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200">Invalid pet ID. Please try again.</p>
              </div>
            </div>
          );
        }
        // Get pet from context (should be available from auto-fetch cache)
        const pet = getPetById(pId);
        if (!pet) {
          // Pet not found in cache - this could happen if:
          // 1. The pet was just created and cache hasn't refreshed
          // 2. The pet is beyond the first 100 records
          // 3. The pet was deleted
          return (
            <div className="p-6">
              <button onClick={goBack} className="mb-4 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700">
                ← Back
              </button>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200">Pet not found. The pet may have been deleted or you may not have access to view it.</p>
                <button
                  onClick={() => refreshPets()}
                  className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Refresh Data
                </button>
              </div>
            </div>
          );
        }

        return <PetProfileView
          pet={pet}
          owner={getClientById(pet.ownerId)}
          activeClinic={firstActiveClinic}
          clinics={store.clinics}
          appointments={appointments.filter(a => a.petId === pId)}
          transactions={transactions}
          allPets={pets}
          onBack={goBack}
          initialTab={currentNav.params?.initialTab || 'overview'}
          onNavigatePet={(id) => navigateTo('pet-profile', { petId: id })}
          onOpenMessaging={(c) => navigateTo('messaging', { clientId: c.id })}
          allMessages={store.messages}
          aiSummary={aiSummary}
          loadingAi={loadingAi}
          onGenerateAiSummary={async () => { setLoadingAi(true); const s = await generateMedicalSummary(pet.medicalHistory); setAiSummary(s); setLoadingAi(false); }}
          onScheduleVaccine={(petId) => {
            const petObj = getPetById(petId);
            navigateTo('new-appointment', {
              initialPetId: petId,
              initialClientId: petObj?.ownerId,
              initialCategoryId: 'Vaccination',
            });
          }}
          onBookAppointment={(petId, clientId) => {
            navigateTo('new-appointment', {
              initialPetId: petId,
              initialClientId: clientId
            });
          }}
          onUpdatePet={handleUpdatePet}
          onProcessPayment={handleProcessPayment}
          onViewAppointment={(id) => navigateTo('view-appointment', { appointmentId: id })}
        />;
      case 'clients': return <ClientsView transactions={transactions} onViewClient={(id) => navigateTo('client-profile', { clientId: id })} onViewFinance={(id) => navigateTo('client-profile', { clientId: id, initialTab: 'ledger' })} onRegisterClient={() => navigateTo('register-client')} onAddPetForClient={(id) => navigateTo('register-pet', { preselectedClientId: id })} onPrebookAppointment={(clientId, petId) => navigateTo('new-appointment', { initialClientId: clientId, initialPetId: petId })} onEditClient={handleEditClient} onDeleteClient={handleDeleteClient} onViewPet={(id) => navigateTo('pet-profile', { petId: id })} onViewClientPets={(clientId) => navigateTo('client-profile', { clientId, initialTab: 'pets' })} />;
      case 'client-profile':
        const cId = currentNav.params?.clientId;
        // Type check: ensure cId is a valid number
        if (!cId || typeof cId !== 'number') {
          return (
            <div className="p-6">
              <button onClick={goBack} className="mb-4 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700">
                ← Back
              </button>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200">Invalid client ID. Please try again.</p>
              </div>
            </div>
          );
        }
        // Get client from context (should be available from auto-fetch cache)
        const client = getClientById(cId);
        if (!client) {
          // Client not found in cache - this could happen if:
          // 1. The client was just created and cache hasn't refreshed
          // 2. The client is beyond the first 100 records
          // 3. The client was deleted
          return (
            <div className="p-6">
              <button onClick={goBack} className="mb-4 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700">
                ← Back
              </button>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200">Client not found. The client may have been deleted or you may not have access to view them.</p>
                <button
                  onClick={() => refreshClients()}
                  className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Refresh Data
                </button>
              </div>
            </div>
          );
        }
        // Filter transactions by client's appointments
        const clientAppointments = appointments.filter(a => a.clientId === cId);
        const clientTransactions = transactions.filter(tx => {
          if (tx.appointmentId) {
            return clientAppointments.some(appt => appt.id === parseInt(tx.appointmentId || '0'));
          }
          // Also include direct client transactions
          return tx.fromId === cId || tx.toId === cId;
        });
        return <ClientProfileView client={client} pets={getClientPets(cId)} transactions={clientTransactions} appointments={clientAppointments} onBack={goBack} initialTab={currentNav.params?.initialTab || 'overview'} onViewPet={(id) => navigateTo('pet-profile', { petId: id })} onOpenMessaging={() => navigateTo('messaging', { clientId: cId })} allMessages={store.messages} onUpdateClient={handleUpdateClient} onProcessPayment={handleProcessPayment} onViewAppointment={(id) => navigateTo('view-appointment', { appointmentId: id })} onManageWorkflow={(id) => navigateTo('appointment-detail', { appointmentId: id })} onScheduleAppointment={() => navigateTo('new-appointment', { initialClientId: cId })} onAddPet={() => navigateTo('register-pet', { preselectedClientId: cId })} />;
      case 'register-client': return <RegisterClientView onCancel={goBack} />;
      case 'edit-client': return editingClient ? <EditClientView client={editingClient} onBack={() => { setEditingClient(null); goBack(); }} /> : null;
      case 'register-pet': return <RegisterPetView onCancel={goBack} onGoToNewClient={() => navigateTo('register-client')} initialClientId={currentNav.params?.preselectedClientId} />;
      case 'inventory':
        if (!firstActiveClinic) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Package className="mx-auto mb-4 text-slate-300" size={48} />
                <p className="text-slate-400 font-bold text-sm">Please select a clinic to view inventory</p>
              </div>
            </div>
          );
        }
        return <InventoryView clinic={firstActiveClinic} inventory={inventory} onUpdateStock={handleUpdateStock} onUpdateItem={handleUpdateInventoryItem} onAddItem={handleAddInventoryItem} suppliers={store.suppliers} onTogglePreferredSupplier={()=>{}} onViewSupplier={(sId) => navigateTo('supplier-detail', { supplierId: sId })} refreshInventory={refreshInventory} />;
      case 'purchase-orders':
        return <PurchaseOrdersView
          clinic={firstActiveClinic}
          onViewPurchaseOrder={(id) => navigateTo('purchase-order-detail', { purchaseOrderId: id })}
          onCreatePurchaseOrder={() => navigateTo('purchase-order-form')}
          onEditPurchaseOrder={(id) => navigateTo('purchase-order-form', { purchaseOrderId: id })}
        />;
      case 'purchase-order-detail':
        return <PurchaseOrderDetailView
          purchaseOrderId={currentNav.params?.purchaseOrderId}
          clinic={firstActiveClinic}
          onBack={goBack}
          onEdit={(id) => navigateTo('purchase-order-form', { purchaseOrderId: id })}
          onReceive={(po) => {
            setSelectedPOForReceive(po);
            setReceivePOModalOpen(true);
          }}
        />;
      case 'purchase-order-form':
        return <PurchaseOrderFormView
          clinic={firstActiveClinic}
          purchaseOrderId={currentNav.params?.purchaseOrderId}
          initialSupplierId={currentNav.params?.initialSupplierId}
          initialProducts={currentNav.params?.initialProducts}
          staffMembers={allStaff}
          onBack={goBack}
          onSuccess={() => {
            // Refresh purchase orders list if we navigate back to it
            if (navStack.length > 1 && navStack[navStack.length - 2].view === 'purchase-orders') {
              // Force re-render by updating the nav stack
              setNavStack(prev => [...prev.slice(0, -1)]);
            }
          }}
        />;
      case 'referrals':
        return <ReferralsView
          referrals={store.referrals}
          activeClinic={firstActiveClinic}
          clinics={store.clinics}
          pets={pets}
          handshakes={store.handshakes}
          currentUser={store.currentUser}
          onUpdateStatus={store.updateTaskStatus}
          onAddReferral={store.addReferral}
          onAcceptAndBook={onAcceptAndBook}
          onInitiateHandshake={store.addHandshake}
          onUpdateHandshake={store.updateHandshakeStatus}
          onViewHandshake={(hId) => navigateTo('handshake-detail', { handshakeId: hId })}
          onOpenCreatePartnership={() => navigateTo('create-partnership')}
          onRefreshHandshakes={store.refreshHandshakes}
        />;
      case 'create-partnership':
        return <CreatePartnershipPage
          activeClinic={firstActiveClinic}
          currentUser={store.currentUser}
          onBack={goBack}
          onSubmit={async (h) => {
            const created = await store.addHandshake(h);
            if (created) goBack();
          }}
        />;
      case 'handshake-detail':
        const hId = currentNav.params?.handshakeId;
        const handshake = store.handshakes.find(h => h.id === hId);
        if (!handshake) return null;
        return <HandshakeDetailView 
          handshake={handshake} 
          activeClinic={firstActiveClinic} 
          allClinics={store.clinics} 
          referrals={store.referrals} 
          onBack={goBack} 
        />;
      case 'finance':
        return <FinanceView
          clinicId={firstActiveClinic?.id}
          onViewTransaction={(transactionId) => navigateTo('transactions')}
        />;
      case 'financial-overview':
        return <FinanceView
          clinicId={firstActiveClinic?.id}
          dateRange={metricsDateRange}
          onDateRangeChange={setMetricsDateRange}
          onViewTransaction={(transactionId) => navigateTo('transactions')}
          onRefresh={handleDashboardRefresh}
          isRefreshing={isDashboardRefreshing}
        />;
      case 'b2b-stats':
        return renderB2BStats();
      case 'financial-core':
        return <ClinicWallet clinic={firstActiveClinic} allClinics={store.clinics} transactions={store.transactions} onAddTransaction={store.addTransaction} />;
      case 'transactions':
        return <TransactionsView
          onViewClient={(clientId) => navigateTo('client-profile', { clientId })}
          onViewAppointment={(appointmentId) => navigateTo('appointment-detail', { appointmentId })}
        />;
      case 'settings':
        if (!firstActiveClinic) {
          return (
            <div className="p-10 text-center">
              <h2 className="text-2xl font-black text-pine">No clinic selected</h2>
              <p className="text-pine/60 mt-2">Create or join a clinic before opening clinic settings.</p>
            </div>
          );
        }
        return <ClinicManagementView
          clinic={firstActiveClinic}
          allStaff={allStaff}
          billingSettings={store.billingSettings}
          onUpdateClinic={(id, data) => updateClinic(id.toString(), data)}
          onUpdateStaff={updateStaff}
          onAddStaff={() => navigateTo('staff-new')}
          onViewStaff={(s) => navigateTo('staff-profile', { staffId: s.id })}
          onEditStaff={(s) => navigateTo('staff-edit', { staffId: s.id })}
          onUpdateBilling={()=>{}}
        />;
      case 'staff': return <StaffListView staff={allStaff} clinics={store.clinics} onAddStaff={() => navigateTo('staff-new')} onEditStaff={(s) => navigateTo('staff-edit', { staffId: s.id })} onViewStaff={(s) => navigateTo('staff-profile', { staffId: s.id })} onDeleteStaff={()=>{}} />;
      case 'staff-new':
      case 'staff-edit': {
        const editId = currentNav.view === 'staff-edit' ? currentNav.params?.staffId : null;
        const editStaff = editId ? allStaff.find((s) => s.id === editId) ?? null : null;
        return (
          <StaffRegistrationView
            clinics={allClinics}
            editingStaff={editStaff}
            onCancel={() => navigateTo('staff')}
            onSave={async (data) => {
              try {
                if (editStaff) {
                  const response: any = await usersAPI.update(editStaff.id, data);
                  if (response.success) {
                    await refreshStaff();
                    toast.success('Staff member updated successfully!');
                  }
                } else {
                  const response: any = await usersAPI.create(data);
                  if (response.success) {
                    await refreshStaff();
                    toast.success('Staff member created successfully!');
                  }
                }
                navigateTo('staff');
              } catch (error) {
                console.error('Failed to save staff member:', error);
                toast.error('Failed to save staff member. Please try again.');
              }
            }}
          />
        );
      }
      case 'import-data':
        return <ImportDataView onBack={() => navigateTo('settings')} />;
      case 'billing': return <BillingView />;
      case 'staff-profile':
        const sId = currentNav.params?.staffId;
        const staffMember = allStaff.find(s => s.id === sId);
        if (!staffMember) return null;
        return <StaffProfileView staff={staffMember} clinics={store.clinics} appointments={appointments} onBack={goBack} />;
      case 'clinics':
        return <ClinicsManagementView onNavigate={navigateTo} />;
      case 'admin-clinic-new':
        return <AdminClinicWizard onClose={() => navigateTo('clinics')} />;
      case 'admin-clinic-edit':
        return <AdminClinicWizard clinicId={currentNav.params?.clinicId ?? null} onClose={() => navigateTo('clinics')} />;
      case 'admin-suppliers':
        // Admin lands on the same Supplier Dashboard a SUPPLIER user sees,
        // which renders extra role-gated KPI/list cards for admins. Scope is
        // driven by the unified switcher (X-Supplier-Id(s) header) — empty
        // selection means "all suppliers".
        return <SupplierDashboard setView={navigateTo} />;
      case 'admin-freelancers':
        return <AdminFreelancersPage onNavigate={navigateTo} />;
      case 'suppliers':
        return <SuppliersHubView onViewSupplier={(sId) => navigateTo('supplier-detail', { supplierId: sId })} />;
      case 'supplier-detail':
        return <SupplierDetailWrapper
          supplierId={currentNav.params?.supplierId}
          clinic={firstActiveClinic}
          transactions={store.transactions}
          onBack={goBack}
          onAddToOrder={(supplierId, product) => {
            console.log('[App] Adding product to order:', { supplierId, product });
            navigateTo('purchase-order-form', {
              initialSupplierId: supplierId,
              initialProducts: [product]
            });
          }}
        />;
      case 'supplier-registration':
        return <SupplierRegistration
          onSubmit={async (data) => {
            console.log('Supplier registration submitted:', data);
            // Navigate to onboarding after successful registration
            navigateTo('supplier-onboarding', { registrationData: data });
          }}
          onCancel={goBack}
        />;
      case 'supplier-onboarding':
        return <SupplierOnboarding
          onComplete={async (data) => {
            console.log('Supplier onboarding completed:', data);
            goBack();
          }}
          onSkip={() => {
            console.log('Supplier onboarding skipped');
            goBack();
          }}
        />;
      case 'supplier-verification':
        return <SupplierVerification
          applications={[]}
          onApprove={async (applicationId, notes) => {
            console.log('Approve supplier:', applicationId, notes);
          }}
          onReject={async (applicationId, reason) => {
            console.log('Reject supplier:', applicationId, reason);
          }}
        />;
      case 'subscription-management':
        return <SubscriptionManagement
          currentSubscription={activeClinicSubscription}
          availablePackages={[
            {
              id: 1,
              name: 'Basic',
              tier: 'BASIC' as any,
              price: 49,
              yearlyPrice: 490,
              billingCycle: 'MONTHLY',
              features: ['Up to 500 patients', 'Basic analytics', 'Email support'],
              limits: { patients: 500, staff: 5, storageGb: 10 },
              isActive: true
            },
            {
              id: 2,
              name: 'Professional',
              tier: 'PROFESSIONAL' as any,
              price: 99,
              yearlyPrice: 990,
              billingCycle: 'MONTHLY',
              features: ['Unlimited patients', 'Advanced analytics', 'Priority support'],
              limits: { patients: -1, staff: 20, storageGb: 100 },
              isActive: true,
              isPopular: true
            },
            {
              id: 3,
              name: 'Enterprise',
              tier: 'ENTERPRISE' as any,
              price: 199,
              yearlyPrice: 1990,
              billingCycle: 'MONTHLY',
              features: ['Unlimited everything', 'Custom integrations', '24/7 support'],
              limits: { patients: -1, staff: -1, storageGb: -1 },
              isActive: true
            }
          ]}
          loading={subscriptionLoading}
          onUpgrade={(packageId) => {
            navigateTo('subscription-upgrade', { packageId });
          }}
          onCancelSubscription={async () => {
            if (!firstActiveClinic?.id || !activeClinicSubscription) return;
            try {
              await clinicSubscriptionAPI.cancel(firstActiveClinic.id, String(activeClinicSubscription.id));
              setActiveClinicSubscription(prev => prev ? { ...prev, status: 'CANCELLED' as any } : undefined);
            } catch (err) {
              console.error('Cancel subscription failed:', err);
            }
          }}
        />;
      case 'sub-packages':
        return <SubPackagesAdminPage />;
      case 'sub-payments':
        return <SubscriptionPaymentsAdminPage />;
      case 'sales-reps':
        return <SalesRepsAdminPage />;
      case 'platform-settings':
        return <PlatformSettingsPage onBack={goBack} />;
      case 'payment-processing':
        return <PaymentProcessing
          subscription={{
            id: 1,
            clinicId: parseInt(firstActiveClinic?.id || '1'),
            packageId: 2,
            package: {
              id: 2,
              name: 'Professional',
              tier: 'PROFESSIONAL' as any,
              price: 99,
              yearlyPrice: 990,
              billingCycle: 'MONTHLY',
              features: [],
              limits: { patients: -1, staff: 20, storageGb: 100 },
              isActive: true
            },
            status: 'ACTIVE' as any,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            autoRenew: true
          }}
          paymentMethods={[]}
          invoices={[]}
          onAddPaymentMethod={async (method) => {
            console.log('Add payment method:', method);
          }}
          onRemovePaymentMethod={async (methodId) => {
            console.log('Remove payment method:', methodId);
          }}
          onSetDefaultPaymentMethod={async (methodId) => {
            console.log('Set default payment method:', methodId);
          }}
          onProcessPayment={async (amount, methodId) => {
            console.log('Process payment:', amount, methodId);
          }}
        />;
      case 'appointment-detail':
        const aId = currentNav.params?.appointmentId;
        // Use loose comparison (String) so string IDs from notifications match numeric store IDs
        const appt = appointments.find(a => String(a.id) === String(aId));
        if (!appt) {
          // Show spinner while fetching from API (cache miss)
          if (fetchingApptId === aId) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-seafoam border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-400 dark:text-zinc-500 text-sm font-medium">Loading appointment…</p>
                </div>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-center min-h-screen p-6">
              <div className="text-center">
                <button onClick={goBack} className="mb-6 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all mx-auto">
                  ← Back
                </button>
                <p className="text-slate-400 dark:text-zinc-500 font-bold text-sm uppercase tracking-widest">Visit not found</p>
                <p className="text-slate-300 dark:text-zinc-600 text-xs mt-2">This appointment may have been removed or is not accessible.</p>
              </div>
            </div>
          );
        }
        // Use full Pet/Client from context if loaded; fall back to embedded data in the appointment
        // to avoid triggering a full list reload just to show one record
        const apptPet = getPetById(appt.petId) ?? (appt.pet ? {
          id: parseInt((appt.pet as any).id ?? appt.petId),
          clinicId: appt.clinicId,
          ownerId: appt.clientId,
          name: (appt.pet as any).name || '',
          species: (appt.pet as any).species || '',
          breed: (appt.pet as any).breed || '',
          gender: 'Male' as const,
          age: 0,
          dob: '',
          weight: '',
          medicalHistory: [],
          vaccinations: [],
        } : null);
        const apptClient = getClientById(appt.clientId) ?? (appt.client ? {
          id: parseInt((appt.client as any).id ?? appt.clientId),
          clinicId: appt.clinicId,
          name: (appt.client as any).name || '',
          firstName: '',
          surname: '',
          email: (appt.client as any).email || '',
          phone: (appt.client as any).phone || '',
          address: '',
          country: 'Kenya',
          currency: 'KES',
          gender: 'Female' as const,
          region: 'Local' as const,
          dob: '',
          joinDate: '',
          totalSpent: 0,
        } : null);
        if (!apptPet || !apptClient) {
          return (
            <div className="flex items-center justify-center min-h-screen p-6">
              <div className="text-center">
                <button onClick={goBack} className="mb-6 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all mx-auto">← Back</button>
                <p className="text-slate-400 dark:text-zinc-500 font-bold text-sm uppercase tracking-widest">Patient not found</p>
                <p className="text-slate-300 dark:text-zinc-600 text-xs mt-2">This patient record may have been removed.</p>
              </div>
            </div>
          );
        }
        return <AppointmentDetailView appointment={appt} pet={apptPet} client={apptClient} staffMembers={allStaff} clinics={allClinics} activeClinic={firstActiveClinic} allAppointments={filteredAppointments} onUpdateStatus={handleUpdateTaskStatus} onUpdateTaskDetails={handleUpdateTaskDetails} onReassign={handleReassignTask} onDeleteTask={handleDeleteTask} onBack={goBack} onUpdateApptStatus={handleUpdateApptStatus} onInjectTask={handleInjectTask} onProcessPayment={handleProcessPayment} onScheduleFollowup={(pAppt) => navigateTo('new-appointment', { initialClientId: pAppt.clientId, initialPetId: pAppt.petId, initialParentApptId: pAppt.id })} onNavigateToVisit={(vId) => navigateTo('appointment-detail', { appointmentId: vId })} onNavigateToClient={(cId) => navigateTo('client-profile', { clientId: cId })} onNavigateToPet={(pId) => navigateTo('pet-profile', { petId: pId })} onNavigateToStaff={(sId) => navigateTo('staff-profile', { staffId: sId })} onRefreshDashboard={refreshAppointments} />;
      case 'view-appointment':
        const viewApptId = currentNav.params?.appointmentId;
        const viewAppt = appointments.find(a => a.id === viewApptId);
        if (!viewAppt) return null;
        const viewClinic = allClinics.find(c => c.id === String(viewAppt.clinicId));
        // Use full records from context or fall back to embedded appointment data
        const viewPet = getPetById(viewAppt.petId) ?? (viewAppt.pet ? {
          id: parseInt((viewAppt.pet as any).id ?? viewAppt.petId),
          clinicId: viewAppt.clinicId, ownerId: viewAppt.clientId,
          name: (viewAppt.pet as any).name || '', species: (viewAppt.pet as any).species || '',
          breed: (viewAppt.pet as any).breed || '', gender: 'Male' as const,
          age: 0, dob: '', weight: '', medicalHistory: [], vaccinations: [],
        } : null);
        const viewClient = getClientById(viewAppt.clientId) ?? (viewAppt.client ? {
          id: parseInt((viewAppt.client as any).id ?? viewAppt.clientId),
          clinicId: viewAppt.clinicId, name: (viewAppt.client as any).name || '',
          firstName: '', surname: '', email: (viewAppt.client as any).email || '',
          phone: (viewAppt.client as any).phone || '', address: '', country: 'Kenya',
          currency: 'KES', gender: 'Female' as const, region: 'Local' as const,
          dob: '', joinDate: '', totalSpent: 0,
        } : null);
        if (!viewPet || !viewClient || !viewClinic) return null;
        return <AppointmentReadOnlyView appointment={viewAppt} pet={viewPet} clinic={viewClinic as any} client={viewClient} onBack={goBack} onRefresh={refreshAppointments} onOpenWorkflow={() => navigateTo('appointment-detail', { appointmentId: viewApptId })} />;
      case 'messaging':
        const mId = currentNav.params?.clientId;
        const mc = getClientById(mId);
        if (!mc) return null;
        return <CommunicationPortal client={mc} onBack={goBack} onRecordMessage={store.recordMessage} />;
      default: return null;
    }
  };

  const onAcceptAndBook = (ref: Referral) => {
    store.updateAppointmentStatus(ref.id, ApptStatus.SCHEDULED);
    navigateTo('new-appointment', { initialPetId: ref.petId, initialClientId: getPetById(ref.petId)?.ownerId });
  };

  return (
    <>
      <ToastContainer />
      {/* Global loading overlay for API operations */}
      {(isProcessingPayment || isUpdatingTask || isDeletingTask || isCreatingAppointment || isUpdatingAppointment) && (
        <LoadingSpinner
          fullScreen
          message={
            isProcessingPayment ? 'Processing payment...' :
            isDeletingTask ? 'Deleting task...' :
            isCreatingAppointment ? 'Creating appointment...' :
            isUpdatingAppointment ? 'Updating appointment...' :
            'Updating task...'
          }
        />
      )}
      <SupplierBranchProvider>
      <DisplayCurrencyProvider>
      <TourProvider tours={TOURS} onNavigate={navigateTo}>
      <div className="flex min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-300">
        {user?.role === UserRole.SUPPLIER ? (
          <SupplierSidebar
            activeView={activeView}
            setView={(v) => navigateTo(v)}
            isCollapsed={isDesktopCollapsed}
            setIsCollapsed={setIsDesktopCollapsed}
            isMobileOpen={isMobileOpen}
            setIsMobileOpen={setIsMobileOpen}
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        ) : (
          <Sidebar
            activeView={activeView}
            setView={(v) => navigateTo(v)}
            clinic={firstActiveClinic}
            onClinicSwitch={() => {}}
            role={user?.role as UserRole || UserRole.VET}
            customPermissions={user?.customPermissions ?? []}
            isCollapsed={isDesktopCollapsed}
            setIsCollapsed={setIsDesktopCollapsed}
            isMobileOpen={isMobileOpen}
            setIsMobileOpen={setIsMobileOpen}
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            subscription={activeClinicSubscription}
          />
        )}
        <Navbar
          activeView={activeView}
          clinic={firstActiveClinic}
          userName={user?.name || 'User'}
          role={user?.role as UserRole || UserRole.VET}
          isSidebarCollapsed={isDesktopCollapsed}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          allClinics={allClinics}
          activeClinicIds={selectedClinicIds}
          onToggleClinic={() => setShowClinicSelector(true)}
          onToggleSupplierBranch={() => setShowSupplierBranchModal(true)}
          onToggleSidebar={() => setIsMobileOpen(prev => !prev)}
          onLogout={async () => {
            localStorage.removeItem(VIEW_STORAGE_KEY);
            await logout();
            setAuthView('login');
          }}
          onNavigate={navigateTo}
          subscription={activeClinicSubscription}
          onUpgrade={() => navigateTo('subscription-management')}
        />
        <main className={`flex-1 transition-all duration-500 overflow-x-hidden mt-16 ml-0 ${isDesktopCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
          <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
            {renderContent()}
          </div>
        </main>
        <ClinicSwitcherModal
          isOpen={showClinicSelector}
          onClose={() => setShowClinicSelector(false)}
        />

      {/* Receive Purchase Order Modal */}
      {selectedPOForReceive && (
        <ReceivePurchaseOrderModal
          purchaseOrder={selectedPOForReceive}
          isOpen={receivePOModalOpen}
          onClose={() => {
            setReceivePOModalOpen(false);
            setSelectedPOForReceive(null);
          }}
          onSuccess={() => {
            // Debit the clinic's main wallet — completed PO subtracts from balance
            const amount = Number(selectedPOForReceive?.totalAmount ?? 0);
            if (amount > 0) {
              getMainWalletId().then(walletId => {
                if (walletId) walletAPI.transferOut(walletId, {
                  amount,
                  note: 'Stock purchase',
                  reference: selectedPOForReceive?.orderNumber,
                }).catch(() => {});
              });
            }
            // Refresh transactions (new SUPPLIER expense record) and inventory (new stock)
            refreshTransactions().catch(() => {});
            refreshInventory().catch(() => {});
            // Refresh the purchase order detail view
            if (currentNav.view === 'purchase-order-detail') {
              const poId = currentNav.params?.purchaseOrderId;
              setNavStack(prev => [...prev.slice(0, -1), { view: 'purchase-order-detail', params: { purchaseOrderId: poId } }]);
            }
          }}
        />
      )}

      {/* Edit Pet Modal */}
      {editingPet && (
        <EditPetModal
          isOpen={editPetModalOpen}
          onClose={() => {
            setEditPetModalOpen(false);
            setEditingPet(null);
          }}
          pet={editingPet}
        />
      )}

      {/* Edit Appointment Modal */}
      {editingAppointment && (
        <EditAppointmentModal
          isOpen={editAppointmentModalOpen}
          onClose={() => {
            setEditAppointmentModalOpen(false);
            setEditingAppointment(null);
          }}
          appointment={editingAppointment}
        />
      )}
      <SupplierBranchModal
        isOpen={showSupplierBranchModal}
        onClose={() => setShowSupplierBranchModal(false)}
        onManageBranches={() => { setShowSupplierBranchModal(false); navigateTo('supplier-branches'); }}
      />

      {/* Delete Confirmation Dialog (legacy, used by App-local handlers) */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteDialogConfig(null);
        }}
        onConfirm={handleDeleteDialogConfirm}
        title={deleteDialogConfig?.title || ''}
        message={deleteDialogConfig?.message || ''}
        entityName={deleteDialogConfig?.entityName}
        isDeleting={isDeleting}
        confirmLabel={deleteDialogConfig?.confirmLabel}
        busyLabel={deleteDialogConfig?.busyLabel}
        entityLabel={deleteDialogConfig?.entityLabel}
        warning={deleteDialogConfig?.warning}
        tone={deleteDialogConfig?.tone}
      />

      {/* Global dialog host — drives dialog.confirm / dialog.alert / dialog.confirmDelete */}
      <DialogHost />
      {/* Tour overlay + module picker */}
      <TourOverlay />
      <TourMenu />
      </div>
      </TourProvider>
      </DisplayCurrencyProvider>
      </SupplierBranchProvider>
    </>
  );
};

export default App;

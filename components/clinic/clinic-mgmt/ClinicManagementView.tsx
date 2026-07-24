
import React, { useState, useEffect, useRef } from 'react';
import { Clinic, User, UserRole, BillingSettings, SubscriptionPackage, Transaction, PaymentMethod } from '../../../types';
import ClinicWallet from './ClinicWallet';
import ClinicLogo from './ClinicLogo';
import EmergencyBillablesTab from './EmergencyBillablesTab';
import BillingView from '../billing/BillingView';
import {
  Palette,
  Users,
  Globe,
  Shield,
  Save,
  Check,
  Layout,
  Sparkles,
  Image as ImageIcon,
  CreditCard,
  Box,
  Zap,
  Settings2,
  X,
  MousePointer2,
  Lock,
  Search,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  UserPlus,
  Briefcase,
  Coins,
  Wallet,
  Edit,
  Eye,
  CheckCircle2,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Crown,
  Rocket,
  Package,
  ArrowRight,
  Gift,
  AlertTriangle,
  RefreshCw,
  EyeOff,
  BadgeCheck,
  ChevronDown,
  Layers,
  Loader2,
  Siren,
  Star,
} from 'lucide-react';
import RatingsDashboardView from '../ratings/RatingsDashboardView';
import VerificationPanel from '../../shared/verification/VerificationPanel';
import { useClinic } from '../../../contexts/ClinicContext';
import { useManagementScope } from '../../../contexts/ManagementScopeContext';
import ManagingSwitcher from '../../shared/common/ManagingSwitcher';
import { COUNTRIES, CLINIC_SPECIALTIES } from '../../../constants';
import { roleShort, roleBadgeClasses } from '../../../constants/roles';
import BrandMark from '../../shared/common/BrandMark';
import PaymentGatewaysTab from '../billing/PaymentGatewaysTab';
import ServiceBundlesView from '../inventory/ServiceBundlesView';
import { categoriesAPI, servicesAPI, Category, Service, dialog, toast, clinicsAPI } from '../../../services';
import CountrySelect from '../../shared/common/CountrySelect';
import PhoneInput from '../../shared/common/PhoneInput';
import { COUNTRIES as ALL_COUNTRIES, type Country } from '../../../utils/countries';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import type { SubscriptionPackage as ApiPackage } from '../../../services/modules/stripe.api';
import { stripeAPI } from '../../../services/modules/stripe.api';
import { clinicSubscriptionAPI } from '../../../services/modules/clinicSubscription.api';
import type { ClinicSubscription as ApiSub, UpgradePreview } from '../../../services/modules/clinicSubscription.api';
import { PlanCard } from '../billing/PlanCard';

interface Props {
  clinic: Clinic;
  allStaff: User[];
  billingSettings: BillingSettings;
  onUpdateClinic: (id: number, data: Partial<Clinic>) => void | Promise<void>;
  onUpdateStaff: (id: number, data: Partial<User>) => void;
  onAddStaff: () => void;
  onViewStaff: (user: User) => void;
  onEditStaff: (user: User) => void;
  onUpdateBilling: (data: Partial<BillingSettings>) => void;
  transactions?: Transaction[];
  onAddTransaction?: (from: number, to: number, amount: number, type: Transaction['type'], method: PaymentMethod) => void;
  initialTabOverride?: 'branding' | 'branches' | 'visuals' | 'team' | 'categories' | 'catalog' | 'billing' | 'ai' | 'wallet' | 'gateways' | 'verification' | 'emergency' | 'ratings';
}

const ClinicManagementView: React.FC<Props> = ({
  clinic: clinicProp,
  allStaff,
  billingSettings,
  onUpdateClinic,
  onUpdateStaff,
  onAddStaff,
  onViewStaff,
  onEditStaff,
  onUpdateBilling,
  transactions = [],
  onAddTransaction,
  initialTabOverride
}) => {
  // Entity switcher source — lets an admin (or multi-clinic owner) pick which
  // clinic to manage from the top of the page. Mirrors the sidebar selection
  // (same selectedClinicIds storage), preselected to the current clinic.
  // `clinic` is the entity chosen in the shared "Managing" switcher
  // (ManagingSwitcher / ManagementScopeContext) — falls back to the prop.
  const { clinics: allClinicsForSwitch, selectedClinics, updateClinic } = useClinic();
  const { managedClinicId } = useManagementScope();
  const switchList = (selectedClinics?.length ? selectedClinics : (allClinicsForSwitch ?? []));
  const clinic = switchList.find((c: any) => String(c.id) === managedClinicId) || clinicProp;
  const [activeTab, setActiveTab] = useState<'branding' | 'branches' | 'visuals' | 'team' | 'categories' | 'catalog' | 'billing' | 'ai' | 'wallet' | 'gateways' | 'verification' | 'emergency' | 'ratings'>(initialTabOverride || 'branding');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks which action is in progress

  // Local state for live preview before saving
  const [localColors, setLocalColors] = useState(clinic.colors || { primary: '#1C7A5B', secondary: '#144E35' });
  const [localLogo, setLocalLogo] = useState(clinic.logo || '🐾');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLocalLogo(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const [localCurrency, setLocalCurrency] = useState(clinic.currency || 'KES');
  const [localSpecialties, setLocalSpecialties] = useState<string[]>(clinic.specialties || []);
  const formatCoord = (n: number | null | undefined) => (n != null ? Number(n).toFixed(4) : '');
  const [localLatitude, setLocalLatitude] = useState<string>(formatCoord(clinic.latitude));
  const [localLongitude, setLocalLongitude] = useState<string>(formatCoord(clinic.longitude));
  // Country drives countryCode + dialCode + region (and the displayed currency
  // — which the user can still override below).
  const [localCountryCode, setLocalCountryCode] = useState<string>(clinic.countryCode || '');
  const [localDialCode, setLocalDialCode] = useState<string>(clinic.dialCode || '');
  const [localRegion, setLocalRegion] = useState<string>(clinic.region || '');
  const [localCity, setLocalCity] = useState<string>(clinic.city || '');
  const handleCountryChange = (c: Country) => {
    setLocalCountryCode(c.code);
    setLocalDialCode(c.dialCode);
    setLocalRegion(c.region);
    // Keep currency in sync with the country pick — the user can still override
    // via the Currency dropdown below if they need a non-default.
    setLocalCurrency(c.currency);
  };
  const [locating, setLocating] = useState(false);
  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocalLatitude(pos.coords.latitude.toFixed(4));
        setLocalLongitude(pos.coords.longitude.toFixed(4));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // AI Configuration state
  const [localAIConfig, setLocalAIConfig] = useState(clinic.aiConfig || { provider: 'fallback' as const, apiKey: '', model: '' });
  const [showAIKey, setShowAIKey] = useState(false);

  // Categories and Services state
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Per-clinic catalog selection: which global categories/services are opted in,
  // plus per-service price overrides. Keyed by id; merged onto the grids/tables
  // above so the "select to my clinic" + price controls live on the same surface.
  const scope = (((clinic as any)?.catalogScope) ?? 'ALL') as 'ALL' | 'GENERAL' | 'CUSTOM';
  // Sub-tabs within "Categories & Services" — Catalog Scope sits above them.
  const [svcSubTab, setSvcSubTab] = useState<'categories' | 'services' | 'bundles'>('categories');
  const [catEnabled, setCatEnabled] = useState<Record<string, boolean>>({});
  const [svcOverride, setSvcOverride] = useState<Record<string, { enabled: boolean; priceOverride: number | null }>>({});
  const [savingCatId, setSavingCatId] = useState<string | null>(null);
  const [savingSvcId, setSavingSvcId] = useState<string | null>(null);
  const priceTimers = useRef<Record<string, number>>({});

  const setScope = async (next: 'ALL' | 'GENERAL' | 'CUSTOM') => {
    if (!clinic) return;
    try { await updateClinic(String(clinic.id), { catalogScope: next } as any); }
    catch (e: any) { toast.error(e?.message || 'Failed to set scope'); }
  };

  const toggleCategoryEnabled = async (cat: Category) => {
    const next = !(catEnabled[cat.id] ?? false);
    setCatEnabled(prev => ({ ...prev, [cat.id]: next }));
    setSavingCatId(cat.id);
    try { await categoriesAPI.setEnabled(cat.id, next); }
    catch (e: any) { toast.error(e?.message || 'Failed to update'); setCatEnabled(prev => ({ ...prev, [cat.id]: !next })); }
    finally { setSavingCatId(null); }
  };

  const saveServiceOverride = async (id: string, patch: { enabled?: boolean; priceOverride?: number | null }) => {
    setSavingSvcId(id);
    try {
      const res = await servicesAPI.upsertOverride(id, patch);
      setSvcOverride(prev => ({ ...prev, [id]: { enabled: res.enabled, priceOverride: res.priceOverride } }));
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally { setSavingSvcId(null); }
  };

  const toggleServiceEnabled = (svc: Service) => {
    const cur = svcOverride[svc.id];
    const next = !(cur?.enabled ?? true);
    setSvcOverride(prev => ({ ...prev, [svc.id]: { enabled: next, priceOverride: cur?.priceOverride ?? null } }));
    saveServiceOverride(svc.id, { enabled: next });
  };

  const setServicePrice = (svc: Service, raw: string) => {
    const trimmed = raw.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    const cur = svcOverride[svc.id];
    setSvcOverride(prev => ({ ...prev, [svc.id]: { enabled: cur?.enabled ?? true, priceOverride: next } }));
    if (priceTimers.current[svc.id]) window.clearTimeout(priceTimers.current[svc.id]);
    priceTimers.current[svc.id] = window.setTimeout(() => saveServiceOverride(svc.id, { priceOverride: next }), 500);
  };

  // Branches state. The API returns extra fields (address/phone/email/
  // isActive) that aren't on the local Clinic type, so we widen here.
  type BranchView = Clinic & {
    isMain?: boolean;
    isActive?: boolean;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  const [branches, setBranches] = useState<BranchView[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const blankBranch = {
    name: '',
    subdomain: '',
    address: '',
    phone: '',
    email: '',
    city: '',
    countryCode: '',
    dialCode: '',
    region: '',
    currency: clinic.currency || 'KES',
  };
  const [newBranch, setNewBranch] = useState<typeof blankBranch>(blankBranch);

  // Branch allowance from the plan (Enterprise-only). max = 0 → "Available in
  // Enterprise"; canAdd gates the Add-branch button (backend enforces too).
  const [branchAllowance, setBranchAllowance] = useState<{ count: number; max: number }>({ count: 0, max: 0 });
  const canAddBranch = branchAllowance.max > 0 && branchAllowance.count < branchAllowance.max;

  // Assign / clear the manager who runs a branch (clinics.manager_id, migration 089).
  const assignBranchManager = async (branchId: string, managerId: string) => {
    try {
      const res = await clinicsAPI.updateBranch(clinic.id, branchId, { managerId: managerId || null } as any);
      if (res.success) {
        setBranches(prev => prev.map(b => String(b.id) === String(branchId) ? ({ ...b, managerId: managerId || null } as any) : b));
        toast.success(managerId ? 'Branch manager assigned' : 'Branch manager cleared');
      }
    } catch { /* showError on the API handles the toast */ }
  };

  const loadBranches = async () => {
    setIsLoadingBranches(true);
    try {
      const res = await clinicsAPI.getBranches(clinic.id);
      if (res.success && (res.data as any)?.branches) {
        setBranches((res.data as any).branches);
      }
    } catch (e) {
      // Errors surface via the showError option on the api call.
    } finally {
      setIsLoadingBranches(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'branches') return;
    loadBranches();
    clinicSubscriptionAPI.getUsage(String(clinic.id))
      .then((r) => { if (r.success && r.data?.branches) setBranchAllowance(r.data.branches); })
      .catch(() => {});
  }, [activeTab, clinic.id]);

  const handleCreateBranch = async () => {
    if (!newBranch.name.trim()) {
      toast.error('Branch name is required');
      return;
    }
    if (!newBranch.subdomain.trim()) {
      toast.error('Subdomain is required (used for routing & QR codes)');
      return;
    }
    setIsCreatingBranch(true);
    try {
      const payload: Record<string, any> = {
        name: newBranch.name.trim(),
        subdomain: newBranch.subdomain.trim(),
        address: newBranch.address.trim() || undefined,
        phone: newBranch.phone.trim() || undefined,
        email: newBranch.email.trim() || undefined,
        city: newBranch.city.trim() || undefined,
        countryCode: newBranch.countryCode || undefined,
        dialCode: newBranch.dialCode || undefined,
        region: newBranch.region || undefined,
        currency: newBranch.currency || undefined,
      };
      const res = await clinicsAPI.createBranch(clinic.id, payload);
      if (res.success) {
        toast.success(`Branch "${newBranch.name}" created`);
        setShowAddBranchModal(false);
        setNewBranch(blankBranch);
        await loadBranches();
      }
    } catch (e) {
      // already shown by api client
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // Subscription state
  const [activeSub, setActiveSub] = useState<ApiSub | null>(null);
  const [apiPackages, setApiPackages] = useState<ApiPackage[]>([]);
  const [previews, setPreviews] = useState<Record<string, UpgradePreview>>({});
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [subError, setSubError] = useState<string | null>(null);

  const clinicStaff = allStaff.filter(s => s.clinicIds.some(id => String(id) === String(clinic.id)));
  const currentPlan = billingSettings.subscriptionPackages.find(p => p.id === clinic.currentPlanId) || billingSettings.subscriptionPackages[0];

  // Load subscription data whenever billing tab is relevant
  useEffect(() => {
    if (!clinic?.id) return;
    const id = String(clinic.id);
    clinicSubscriptionAPI.getActive(id).then(res => {
      if (res.success) setActiveSub(res.data.subscription);
    }).catch(() => {});
    // Load the available plans for the Change-Plan grid. Without this the grid
    // was stuck on "Loading plans…" forever (setApiPackages was never called).
    stripeAPI.getInfo(id).then(res => {
      if (res.success) setApiPackages(res.data.packages ?? []);
    }).catch(() => {});
  }, [clinic?.id]);

  // Once we know the active sub + packages, pre-fetch proration for all upgradeable packages
  useEffect(() => {
    if (!clinic?.id || !activeSub) return;
    const currentTier = activeSub.package?.tier ?? 0;
    const upgradeable = apiPackages.filter(p => p.tier > currentTier);
    upgradeable.forEach(pkg => {
      clinicSubscriptionAPI.previewUpgrade(String(clinic.id), pkg.id).then(res => {
        if (res.success) {
          setPreviews(prev => ({ ...prev, [pkg.id]: res.data.preview }));
        }
      }).catch(() => {});
    });
  }, [activeSub, apiPackages, clinic?.id]);

  // Honest active-sub price + cycle label, matching the Billing page: use the
  // subscription's actual billing cycle and the per-cycle option price (the
  // package's base monthly price doesn't move when a clinic buys a longer cycle).
  const CYCLE_LABEL: Record<string, string> = { MONTHLY: 'month', QUARTERLY: '3 months', SEMIANNUAL: '6 months', YEARLY: 'year' };
  const activeSubCycle = activeSub?.billingCycle ?? activeSub?.package?.billingCycle ?? 'MONTHLY';
  const activeSubPkg = activeSub ? apiPackages.find(p => p.id === activeSub.packageId) : null;
  const activeSubPrice = (activeSubPkg?.billingOptions?.find((o: any) => o.cycle === activeSubCycle)?.price)
    ?? activeSub?.package?.price ?? 0;
  const activeSubCycleLabel = CYCLE_LABEL[activeSubCycle] ?? 'cycle';

  // Same plan-icon mapping the Billing page uses, so the shared PlanCard renders identically here.
  const getPlanIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('enterprise') || n.includes('premium')) return Crown;
    if (n.includes('pro')) return Rocket;
    if (n.includes('basic') || n.includes('starter')) return Building2;
    return Zap;
  };

  const handleSubscribe = async (packageId: string) => {
    setSubError(null);
    setIsSubscribing(packageId);
    try {
      const res = await clinicSubscriptionAPI.subscribe(String(clinic.id), { packageId });
      if (res.success) {
        setActiveSub(res.data.subscription);
        setPreviews({});
      } else {
        setSubError((res as any).message ?? 'Subscription failed');
      }
    } catch (e: any) {
      setSubError(e?.response?.data?.message ?? e?.message ?? 'Subscription failed');
    } finally {
      setIsSubscribing(null);
    }
  };

  useEffect(() => {
    setLocalColors(clinic.colors || { primary: '#1C7A5B', secondary: '#144E35' });
    setLocalLogo(clinic.logo || '🐾');
    setLocalCurrency(clinic.currency || 'KES');
    setLocalSpecialties(clinic.specialties || []);
    setLocalAIConfig(clinic.aiConfig || { provider: 'fallback', apiKey: '', model: '' });
    setLocalLatitude(formatCoord(clinic.latitude));
    setLocalLongitude(formatCoord(clinic.longitude));
    setLocalCountryCode(clinic.countryCode || '');
    setLocalDialCode(clinic.dialCode || '');
    setLocalRegion(clinic.region || '');
    setLocalCity(clinic.city || '');
  }, [clinic.id, clinic.colors, clinic.logo, clinic.currency, clinic.specialties, clinic.aiConfig, clinic.latitude, clinic.longitude, clinic.countryCode, clinic.dialCode, clinic.region, clinic.city]);

  // Load categories and services when categories tab is active
  useEffect(() => {
    if (activeTab === 'categories') {
      loadCategories();
      loadServices();
    }
  }, [activeTab]);

  const loadCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const [data, catalog] = await Promise.all([
        categoriesAPI.getAll(),
        categoriesAPI.catalog().catch(() => []),
      ]);
      setCategories(data);
      setCatEnabled(Object.fromEntries(catalog.map(c => [c.id, c.enabled])));
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const loadServices = async () => {
    setIsLoadingServices(true);
    try {
      const [data, catalog] = await Promise.all([
        servicesAPI.getAll(),
        servicesAPI.catalog().catch(() => []),
      ]);
      setServices(data);
      setSvcOverride(Object.fromEntries(catalog.map(s => [s.id, { enabled: s.enabled, priceOverride: s.priceOverride }])));
    } catch (error) {
      console.error('Failed to load services:', error);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    const ok = await dialog.confirmDelete({
      title: 'Delete Category',
      message: 'This will permanently remove the category and all services under it. This action cannot be undone.',
      entityName: cat?.name || `Category #${categoryId}`,
    });
    if (!ok) return;
    setActionLoading(`delete-cat-${categoryId}`);
    try {
      await categoriesAPI.delete(categoryId);
      setCategories(categories.filter(c => c.id !== categoryId));
      setServices(services.filter(s => s.categoryId !== categoryId));
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category. It may be in use by existing appointments.');
    } finally { setActionLoading(null); }
  };

  const handleDeleteService = async (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    const ok = await dialog.confirmDelete({
      title: 'Delete Service',
      message: 'This will permanently remove the service. This action cannot be undone.',
      entityName: svc?.name || `Service #${serviceId}`,
    });
    if (!ok) return;
    setActionLoading(`delete-svc-${serviceId}`);
    try {
      await servicesAPI.delete(serviceId);
      setServices(services.filter(s => s.id !== serviceId));
    } catch (error) {
      console.error('Failed to delete service:', error);
      toast.error('Failed to delete service. It may be in use by existing appointments.');
    } finally { setActionLoading(null); }
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionLoading('add-category');
    const formData = new FormData(e.currentTarget);
    try {
      const newCategory = await categoriesAPI.create({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
      });
      setCategories([...categories, newCategory]);
      setShowAddCategoryModal(false);
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    } finally { setActionLoading(null); }
  };

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionLoading('add-service');
    const formData = new FormData(e.currentTarget);
    try {
      const newService = await servicesAPI.create({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        categoryId: formData.get('categoryId') as string,
        defaultPrice: parseFloat(formData.get('defaultPrice') as string) || undefined,
      });
      setServices([...services, newService]);
      setShowAddServiceModal(false);
    } catch (error) {
      console.error('Failed to create service:', error);
      toast.error('Failed to create service');
    } finally { setActionLoading(null); }
  };

  const handleUpdateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCategory) return;
    setActionLoading('update-category');
    const formData = new FormData(e.currentTarget);
    try {
      const updated = await categoriesAPI.update(editingCategory.id, {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
      });
      setCategories(categories.map(c => c.id === updated.id ? updated : c));
      setEditingCategory(null);
    } catch (error) {
      console.error('Failed to update category:', error);
      toast.error('Failed to update category');
    } finally { setActionLoading(null); }
  };

  const handleUpdateService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingService) return;
    setActionLoading('update-service');
    const formData = new FormData(e.currentTarget);
    try {
      const updated = await servicesAPI.update(editingService.id, {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        categoryId: formData.get('categoryId') as string,
        defaultPrice: parseFloat(formData.get('defaultPrice') as string) || undefined,
      });
      setServices(services.map(s => s.id === updated.id ? updated : s));
      setEditingService(null);
    } catch (error) {
      console.error('Failed to update service:', error);
      toast.error('Failed to update service');
    } finally { setActionLoading(null); }
  };

  const handleClinicUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      await onUpdateClinic(clinic.id, {
        name: formData.get('name') as string,
        subdomain: formData.get('subdomain') as string,
        slogan: formData.get('slogan') as string,
        currency: localCurrency,
        logo: localLogo,
        colors: localColors,
        aiConfig: localAIConfig,
        specialties: localSpecialties,
        latitude: localLatitude === '' ? null : parseFloat(localLatitude),
        longitude: localLongitude === '' ? null : parseFloat(localLongitude),
        countryCode: localCountryCode || null,
        dialCode: localDialCode || null,
        region: (localRegion || null) as any,
        city: localCity.trim() || null,
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
      toast.success('Clinic settings updated');
    } catch (error: any) {
      console.error('Failed to update clinic:', error);
      toast.error(error?.message || 'Failed to update clinic settings');
    } finally {
      setIsSaving(false);
    }
  };

  const colorPresets = [
    { p: '#6366f1', s: '#1e1b4b', label: 'Classic Indigo' },
    { p: '#10b981', s: '#064e3b', label: 'Healing Emerald' },
    { p: '#f59e0b', s: '#451a03', label: 'Vital Amber' },
    { p: '#1C7A5B', s: '#144E35', label: 'Enterprise Teal' },
    { p: '#2EA1B8', s: '#144E35', label: 'Ocean Cyan' },
    { p: '#ec4899', s: '#500724', label: 'Soft Petal' },
    { p: '#ef4444', s: '#450a0a', label: 'Urgent Red' },
    { p: '#8b5cf6', s: '#2e1065', label: 'Royal Purple' },
    { p: '#0ea5e9', s: '#0c4a6e', label: 'Sky Blue' },
    { p: '#f43f5e', s: '#4c0519', label: 'Rose Gold' },
    { p: '#16a34a', s: '#052e16', label: 'Forest' },
    { p: '#475569', s: '#1e293b', label: 'Slate Pro' },
  ];

  const logoPresets = ['🐾', '🏥', '🐶', '🐱', '🩺', '❤️', '🦴', '🦁', '🦜', '🐹', '🐰', '🐴', '🐢', '🐦', '🐠', '🐷', '💊', '🌿', '🔬', '🏡'];

  return (
    <div className="space-y-4 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      {/* Page-level C-paw loader while a save is in flight — not just the button. */}
      {isSaving && <LoadingSpinner contentArea message="Saving changes…" />}
      <ManagingSwitcher kind="clinic" />
      <div className="flex w-full bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
        {[
          { id: 'branding', label: 'Identity', icon: Globe },
          { id: 'branches', label: 'Branches', icon: Building2 },
          { id: 'visuals', label: 'Appearance', icon: Palette },
          { id: 'team', label: 'Personnel', icon: Users },
          { id: 'categories', label: 'Categories & Services', icon: Briefcase },
          { id: 'emergency', label: 'Billables', icon: Siren },
          { id: 'ai', label: 'AI', icon: Sparkles },
          { id: 'billing', label: 'Billing', icon: CreditCard },
          { id: 'wallet', label: 'Wallet', icon: Wallet },
          { id: 'gateways', label: 'Gateways', icon: Shield },
          { id: 'verification', label: 'Verification', icon: BadgeCheck },
          { id: 'ratings', label: 'Ratings', icon: Star },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-md'
                : 'text-seafoam dark:text-zinc-500 hover:text-pine'
            }`}
          >
            <tab.icon size={11} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* key forces a remount when the uncontrolled `defaultValue`
          inputs (name / subdomain / slogan) need to pick up new values
          after the in-memory clinic upgrades from auth-cache → live
          fetch. Specialties are NOT in the key — they have their own
          local state synced via useEffect and we don't want every
          chip toggle re-mounting the form. */}
      <form key={`clinic-form-${clinic.id}-${clinic.name ?? ''}-${clinic.subdomain ?? ''}-${clinic.slogan ?? ''}`} onSubmit={handleClinicUpdate} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
         <div className="lg:col-span-12">
            {activeTab === 'emergency' && <EmergencyBillablesTab currency={clinic.currency} />}
            {activeTab === 'branding' && (
               <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4 animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
                     <div className="p-1.5 bg-seafoam text-white rounded-lg shadow-md"><Globe size={16}/></div>
                     <h2 className="section-header">Core Identity</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Clinic Name</label>
                        <input name="name" defaultValue={clinic.name} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Subdomain</label>
                        <div className="flex items-center bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-seafoam/20">
                           <input name="subdomain" defaultValue={clinic.subdomain} className="bg-transparent border-none outline-none text-sm font-black text-pine dark:text-zinc-100 w-full" />
                           <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">.vethubcore.io</span>
                        </div>
                     </div>
                     <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Corporate Slogan</label>
                        <input name="slogan" defaultValue={clinic.slogan} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Country</label>
                        <CountrySelect
                          value={localCountryCode || null}
                          onChange={handleCountryChange}
                          className="w-full"
                          placeholder="Select country"
                        />
                        <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">
                          {localDialCode ? `Dial ${localDialCode}` : 'Dial —'}
                          {localRegion ? ` · Region ${localRegion}` : ''}
                        </p>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Currency</label>
                        <select
                          value={localCurrency}
                          onChange={e => setLocalCurrency(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 font-black outline-none appearance-none focus:ring-2 focus:ring-seafoam/20"
                        >
                           {(() => {
                             // Unique currencies from the full country list — dedup by ISO-4217 code.
                             const seen = new Set<string>();
                             const uniq = ALL_COUNTRIES.filter(c => {
                               if (seen.has(c.currency)) return false;
                               seen.add(c.currency);
                               return true;
                             });
                             return uniq.map(c => (
                               <option key={c.currency} value={c.currency}>{c.currency} ({c.name})</option>
                             ));
                           })()}
                        </select>
                     </div>
                     <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">City</label>
                        <input
                          type="text"
                          value={localCity}
                          onChange={(e) => setLocalCity(e.target.value)}
                          placeholder="e.g. Nairobi"
                          className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20"
                        />
                        <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">
                          Used by the platform admin to filter clinics geographically
                        </p>
                     </div>

                     <div className="md:col-span-2 space-y-2">
                        <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Clinical Specialties</label>
                        <div className="flex flex-wrap gap-2">
                           {(() => {
                             // Case-insensitive lookup so older records persisted with
                             // a different casing still light up their chip.
                             const selectedLower = new Set(localSpecialties.map(s => String(s).toLowerCase()));
                             return CLINIC_SPECIALTIES.map(({ value, label, icon }) => {
                               const active = selectedLower.has(value.toLowerCase());
                               return (
                                 <button
                                   key={value}
                                   type="button"
                                   onClick={() => setLocalSpecialties(prev => {
                                     const lower = value.toLowerCase();
                                     return active
                                       ? prev.filter(s => String(s).toLowerCase() !== lower)
                                       : [...prev, value];
                                   })}
                                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${active ? 'bg-seafoam text-white border-seafoam shadow-md' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'}`}
                                 >
                                   {icon}{label}
                                 </button>
                               );
                             });
                           })()}
                        </div>
                     </div>

                     <div className="md:col-span-2 space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Coordinates (Optional)</label>
                          <button
                            type="button"
                            onClick={useMyLocation}
                            disabled={locating}
                            className="text-[9px] font-black text-seafoam uppercase tracking-widest hover:underline disabled:opacity-50"
                          >
                            {locating ? 'Locating…' : 'Use my location'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            step="any"
                            value={localLatitude}
                            onChange={(e) => setLocalLatitude(e.target.value)}
                            placeholder="Latitude"
                            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20"
                          />
                          <input
                            type="number"
                            step="any"
                            value={localLongitude}
                            onChange={(e) => setLocalLongitude(e.target.value)}
                            placeholder="Longitude"
                            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20"
                          />
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'branches' && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-500 text-white rounded-lg shadow-md"><Building2 size={16}/></div>
                    <div>
                      <h2 className="section-header">Branches</h2>
                      <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase mt-0.5 tracking-widest">Manage additional locations under this clinic</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canAddBranch}
                    title={canAddBranch ? 'Add a branch' : 'Branches are available on the Enterprise plan'}
                    onClick={() => { setNewBranch(blankBranch); setShowAddBranchModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
                  >
                    <Plus size={13} />
                    Add Branch
                  </button>
                </div>

                {branchAllowance.max <= 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-3.5 py-2.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    Multiple branches are an Enterprise feature. Upgrade to the Enterprise plan to add branch clinics.
                  </div>
                )}

                {isLoadingBranches ? (
                  <div className="flex items-center justify-center py-10"><LoadingSpinner /></div>
                ) : branches.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Building2 size={28} className="mx-auto opacity-40 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No branches yet</p>
                    <p className="text-[9px] mt-1">Add a branch to manage multiple locations under one clinic.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branches.map(b => (
                      <div
                        key={b.id}
                        className={`p-3 rounded-xl border ${b.isMain ? 'border-seafoam/40 bg-seafoam/5' : 'border-slate-200 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-800/40'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-tight truncate">{b.name}</p>
                              {b.isMain && (
                                <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-seafoam text-white uppercase tracking-widest">Main</span>
                              )}
                            </div>
                            {b.subdomain && <p className="text-[10px] text-seafoam font-mono mt-0.5 truncate">/{b.subdomain}</p>}
                          </div>
                          <span className={`shrink-0 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${b.isActive === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{b.isActive === false ? 'Inactive' : 'Active'}</span>
                        </div>
                        <div className="mt-2 space-y-0.5 text-[10px] text-slate-500 dark:text-zinc-400">
                          {(b as any).city && <p><span className="font-black text-slate-400 mr-1">CITY</span>{(b as any).city}</p>}
                          {b.address && <p className="truncate"><span className="font-black text-slate-400 mr-1">ADDR</span>{b.address}</p>}
                          {b.phone && <p><span className="font-black text-slate-400 mr-1">PHONE</span>{b.phone}</p>}
                          {b.email && <p className="truncate"><span className="font-black text-slate-400 mr-1">EMAIL</span>{b.email}</p>}
                          <p><span className="font-black text-slate-400 mr-1">CURRENCY</span>{b.currency || '—'}</p>
                        </div>
                        {/* Branch manager — assign a staff member to run this branch. */}
                        <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-zinc-700/60">
                          <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Branch manager</label>
                          <select
                            value={(b as any).managerId || ''}
                            onChange={e => assignBranchManager(String(b.id), e.target.value)}
                            className="field-select !py-1.5 !text-[11px] mt-1"
                          >
                            <option value="">Unassigned</option>
                            {clinicStaff.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showAddBranchModal && (
              <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => !isCreatingBranch && setShowAddBranchModal(false)}>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-md"><Building2 size={14}/></div>
                      <h3 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-widest">New Branch</h3>
                    </div>
                    <button onClick={() => !isCreatingBranch && setShowAddBranchModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50" disabled={isCreatingBranch}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="field-label">Branch Name *</label>
                      <input
                        type="text"
                        value={newBranch.name}
                        onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                        placeholder={`${clinic.name} – Westlands`}
                        className="field-input"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="field-label">Subdomain *</label>
                      <input
                        type="text"
                        value={newBranch.subdomain}
                        onChange={(e) => setNewBranch({ ...newBranch, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        placeholder="clinic-westlands"
                        className="field-input"
                      />
                      <p className="text-[9px] text-slate-400 mt-1">Lowercase, dashes only. Used for routing and QR codes.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="field-label">Phone</label>
                        {/* The phone's country picker drives the branch country + currency. */}
                        <PhoneInput
                          countryCode={newBranch.countryCode || null}
                          dialCode={newBranch.dialCode || ''}
                          phone={newBranch.phone}
                          onChange={({ countryCode, dialCode, phone }) => {
                            const c = ALL_COUNTRIES.find((x) => x.code === countryCode);
                            setNewBranch({
                              ...newBranch, phone, countryCode, dialCode,
                              ...(c ? { region: c.region, currency: c.currency } : {}),
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className="field-label">Email</label>
                        <input type="email" value={newBranch.email} onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })} placeholder="branch@clinic.com" className="field-input" />
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Address</label>
                      <input type="text" value={newBranch.address} onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })} placeholder="Street, Building, Floor" className="field-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="field-label">City</label>
                        <input type="text" value={newBranch.city} onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })} placeholder="Nairobi" className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">Country <span className="text-slate-400 normal-case font-medium">· set by phone</span></label>
                        {(() => {
                          const c = ALL_COUNTRIES.find((x) => x.code === newBranch.countryCode);
                          return (
                            <div className="field-input flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                              {c ? <><span>{c.flag}</span><span className="font-bold text-pine dark:text-zinc-100">{c.name}</span><span className="text-[10px] font-mono">{c.dialCode}</span></> : <span className="text-slate-400">Pick a country in the phone field</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Currency</label>
                      <select
                        value={newBranch.currency}
                        onChange={(e) => setNewBranch({ ...newBranch, currency: e.target.value })}
                        className="field-select"
                      >
                        {(() => {
                          const seen = new Set<string>();
                          const opts: { code: string; label: string }[] = [];
                          for (const c of ALL_COUNTRIES) {
                            if (c.currency && !seen.has(c.currency)) {
                              seen.add(c.currency);
                              opts.push({ code: c.currency, label: c.currency });
                            }
                          }
                          return opts.sort((a, b) => a.code.localeCompare(b.code)).map(o => (
                            <option key={o.code} value={o.code}>{o.code}</option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setShowAddBranchModal(false)}
                      disabled={isCreatingBranch}
                      className="px-3 py-1.5 text-pine dark:text-zinc-300 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateBranch}
                      disabled={isCreatingBranch}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isCreatingBranch ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                      {isCreatingBranch ? 'Creating…' : 'Create Branch'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'visuals' && (
               <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6">
                     <div className="flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 pb-4">
                        <div className="p-2 bg-cyan text-white rounded-xl shadow-lg"><Palette size={20}/></div>
                        <h2 className="section-header">Visual Spectrum</h2>
                     </div>

                     <div className="space-y-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Theme Colors</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           {colorPresets.map(preset => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setLocalColors({ primary: preset.p, secondary: preset.s })}
                                className={`flex flex-col gap-2 p-3 rounded-xl border-2 transition-all hover:scale-105 ${localColors.primary === preset.p ? 'border-seafoam bg-seafoam/5' : 'border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950'}`}
                              >
                                 <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 shadow-md" style={{ backgroundColor: preset.p }}></div>
                                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 shadow-md" style={{ backgroundColor: preset.s }}></div>
                                 </div>
                                 <span className="text-[8px] font-black uppercase text-pine dark:text-zinc-400">{preset.label}</span>
                              </button>
                           ))}
                        </div>

                        {/* Custom color pickers — native color wheel + hex.
                            Click the swatch to open the OS color picker (with
                            wheel + RGB sliders); the hex input lets the user
                            paste a brand colour directly. Lives below the
                            preset palette so a one-click brand pick stays
                            obvious, but free-form is one click away. */}
                        <div className="pt-3">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-2">Custom Colors</p>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {([
                                { key: 'primary' as const,   label: 'Primary' },
                                { key: 'secondary' as const, label: 'Secondary' },
                              ]).map(({ key, label }) => {
                                const value = localColors[key];
                                const sanitize = (raw: string) => {
                                  let v = raw.trim();
                                  if (!v.startsWith('#')) v = '#' + v;
                                  // Allow up to 7 chars (# + 6 hex digits); reject anything else.
                                  if (!/^#[0-9a-fA-F]{0,6}$/.test(v)) return null;
                                  return v;
                                };
                                return (
                                  <div key={key} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                                    <label className="relative shrink-0">
                                      <span
                                        className="block w-10 h-10 rounded-lg border-2 border-white dark:border-zinc-900 shadow-md cursor-pointer"
                                        style={{ backgroundColor: value }}
                                        title="Open color wheel"
                                      />
                                      <input
                                        type="color"
                                        value={value}
                                        onChange={(e) => setLocalColors({ ...localColors, [key]: e.target.value })}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                      />
                                    </label>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                                      <input
                                        type="text"
                                        value={value}
                                        maxLength={7}
                                        onChange={(e) => {
                                          const next = sanitize(e.target.value);
                                          if (next !== null) setLocalColors({ ...localColors, [key]: next });
                                        }}
                                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded px-2 py-1 text-[11px] font-mono font-bold text-pine dark:text-zinc-100 uppercase outline-none focus:ring-2 focus:ring-seafoam/30"
                                        placeholder="#1C7A5B"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-zinc-800">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Symbolic Mark (Logo)</p>
                        <div className="flex flex-wrap gap-2">
                           {logoPresets.map(l => (
                              <button
                                key={l}
                                type="button"
                                onClick={() => setLocalLogo(l)}
                                className={`w-12 h-12 rounded-xl text-xl flex items-center justify-center transition-all border-2 ${localLogo === l ? 'bg-seafoam text-white border-seafoam shadow-lg scale-110' : 'bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-400'}`}
                              >
                                 {l}
                              </button>
                           ))}
                           <button type="button" onClick={() => logoInputRef.current?.click()} className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-300 hover:text-seafoam transition-colors" title="Upload image">
                             <ImageIcon size={18}/>
                           </button>
                           <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoImageUpload} />
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'team' && (
               <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
                  <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 dark:bg-zinc-800/30 gap-3">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"><Users size={20}/></div>
                        <div>
                           <h2 className="section-header">Staff Members</h2>
                           <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">Active staff members at this clinic</p>
                        </div>
                     </div>
                     <button
                       type="button"
                       onClick={onAddStaff}
                       className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg active:scale-95 transition-all flex items-center gap-2"
                     >
                        <UserPlus size={12}/> Add Staff
                     </button>
                  </div>
                  {clinicStaff.length === 0 ? (
                    <div className="py-12 text-center">
                      <Users size={28} className="mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
                      <p className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">No staff assigned to this clinic</p>
                      <p className="text-[10px] text-slate-300 dark:text-zinc-600 mt-1">Use "Add Staff" to assign team members</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {clinicStaff.map(staff => (
                        <div key={staff.id} className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 flex items-start gap-3 hover:shadow-md transition-all group">
                          <img src={staff.avatar} className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 shadow-sm shrink-0 group-hover:scale-105 transition-transform" alt="" />
                          <div className="min-w-0 flex-1">
                            <p className="text-pine dark:text-zinc-100 font-black text-[11px] leading-tight uppercase truncate">{staff.name}</p>
                            <p className="text-seafoam dark:text-zinc-500 text-[9px] font-bold mt-0.5 truncate">{staff.email}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border ${roleBadgeClasses(staff.role)}`}>
                                {roleShort(staff.role)}
                              </span>
                              <span className="text-[8px] font-black text-slate-400 font-mono uppercase">{staff.idNumber || 'TX-PENDING'}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button type="button" onClick={() => onViewStaff(staff)} className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-seafoam hover:bg-seafoam hover:text-white rounded-lg transition-all shadow-sm"><Eye size={12}/></button>
                            <button type="button" onClick={() => onEditStaff(staff)} className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-seafoam hover:bg-indigo-600 hover:text-white rounded-lg transition-all shadow-sm"><Edit size={12}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
            )}

            {activeTab === 'categories' && (
               <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  {/* Catalog scope switch — what staff pick from when building a visit */}
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm p-4 sm:p-5">
                     <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20"><Layers size={18} /></div>
                        <div>
                           <h2 className="section-header">Catalog Scope</h2>
                           <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">Which catalog staff pick from when building a visit</p>
                        </div>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {([
                           { value: 'ALL', label: 'Both', hint: 'General + custom' },
                           { value: 'GENERAL', label: 'General only', hint: 'Approved global catalog' },
                           { value: 'CUSTOM', label: 'Custom only', hint: 'Your selected + custom' },
                        ] as const).map(s => (
                           <button key={s.value} type="button" onClick={() => setScope(s.value)}
                              className={`px-3 py-2 rounded-xl text-left border transition-all ${scope === s.value ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-seafoam'}`}>
                              <span className="block text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                              <span className={`block text-[9px] ${scope === s.value ? 'text-white/80' : 'text-slate-400'}`}>{s.hint}</span>
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Sub-tabs: Categories · Services & Prices · Bundles */}
                  <div className="flex w-full bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
                     {([
                        { id: 'categories', label: 'Categories', icon: Briefcase },
                        { id: 'services', label: 'Services & Prices', icon: Settings2 },
                        { id: 'bundles', label: 'Bundles', icon: Layers },
                     ] as const).map(t => (
                        <button key={t.id} type="button" onClick={() => setSvcSubTab(t.id)}
                           className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${svcSubTab === t.id ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-md' : 'text-seafoam dark:text-zinc-500 hover:text-pine'}`}>
                           <t.icon size={12} /> <span>{t.label}</span>
                        </button>
                     ))}
                  </div>

                  {/* Categories Section */}
                  {svcSubTab === 'categories' && (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                     <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 dark:bg-zinc-800/30 gap-3">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-500/20"><Briefcase size={20}/></div>
                           <div>
                              <h2 className="section-header">Service Categories</h2>
                              <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">Manage service categories</p>
                           </div>
                        </div>
                        <button
                           type="button"
                           onClick={() => setShowAddCategoryModal(true)}
                           className="compact-button bg-purple-500 hover:bg-purple-600 text-white shadow-lg active:scale-95 transition-all flex items-center gap-2"
                        >
                           <Plus size={12} />
                           Add Category
                        </button>
                     </div>
                     <div className="p-4 sm:p-6">
                        {isLoadingCategories ? (
                           <div className="py-12"><LoadingSpinner size="lg" message="Loading categories..." /></div>
                        ) : categories.length === 0 ? (
                           <div className="text-center py-12">
                              <Briefcase size={48} className="mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
                              <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-2">No Categories Yet</h3>
                              <p className="text-seafoam dark:text-zinc-500 text-sm">
                                 Create your first service category to get started.
                              </p>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {/* The Catalog Scope filter applies here too: Both = all;
                                  General only = approved global; Custom only = your
                                  custom + the global ones you enabled. */}
                              {(scope === 'GENERAL' ? categories.filter(c => c.isApproved)
                                : scope === 'CUSTOM' ? categories.filter(c => !c.isApproved || catEnabled[c.id])
                                : categories).map(category => (
                                 <div key={category.id} className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 group hover:shadow-lg transition-all flex flex-col h-full">
                                    {editingCategory?.id === category.id ? (
                                       <form onSubmit={handleUpdateCategory} className="space-y-4">
                                          <input
                                             type="text"
                                             name="name"
                                             defaultValue={category.name}
                                             className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                                             required
                                          />
                                          <textarea
                                             name="description"
                                             defaultValue={category.description}
                                             className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
                                             rows={2}
                                          />
                                          <div className="flex gap-2">
                                             <button type="submit" disabled={actionLoading === 'update-category'} className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50">
                                                {actionLoading === 'update-category' ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save</>}
                                             </button>
                                             <button type="button" onClick={() => setEditingCategory(null)} className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2">
                                                <X size={14} /> Cancel
                                             </button>
                                          </div>
                                       </form>
                                    ) : (
                                       <>
                                          {/* Compact, uniform card: title row · 2-line description · bottom-pinned toggle. */}
                                          <div className="flex justify-between items-start gap-2 mb-1">
                                             <h3 className="text-[12px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight leading-tight">{category.name}</h3>
                                             <span className={`shrink-0 text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${category.isApproved ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>{category.isApproved ? 'Global' : 'Custom'}</span>
                                          </div>
                                          <p className="text-seafoam dark:text-zinc-400 text-[11px] leading-snug mb-2 line-clamp-2 flex-1">{category.description || 'No description'}</p>
                                          {category.isApproved ? (
                                             <button
                                                type="button"
                                                onClick={() => toggleCategoryEnabled(category)}
                                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${catEnabled[category.id] ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}
                                             >
                                                <span>{catEnabled[category.id] ? '✓ Used in clinic' : 'Not in clinic'}</span>
                                                {savingCatId === category.id
                                                   ? <Loader2 size={13} className="animate-spin" />
                                                   : <span className={`w-9 h-[18px] rounded-full relative transition-colors ${catEnabled[category.id] ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-600'}`}><span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${catEnabled[category.id] ? 'left-[19px]' : 'left-0.5'}`} /></span>}
                                             </button>
                                          ) : (
                                             <div className="px-2.5 py-1.5 rounded-lg bg-seafoam/10 text-seafoam border border-seafoam/40 text-[9px] font-black uppercase tracking-widest text-center">✓ In your clinic</div>
                                          )}
                                          {/* Edit/delete only exist for custom categories — global cards stay short. */}
                                          {!category.isApproved && (
                                             <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                   type="button"
                                                   onClick={() => setEditingCategory(category)}
                                                   className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded-lg font-bold text-[10px] uppercase flex items-center justify-center gap-1"
                                                >
                                                   <Edit2 size={11} /> Edit
                                                </button>
                                                <button
                                                   type="button"
                                                   onClick={() => handleDeleteCategory(category.id)}
                                                   className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded-lg font-bold text-[10px] uppercase flex items-center justify-center gap-1 disabled:opacity-50"
                                                   disabled={actionLoading === `delete-cat-${category.id}`}
                                                >
                                                   {actionLoading === `delete-cat-${category.id}` ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />} Delete
                                                </button>
                                             </div>
                                          )}
                                       </>
                                    )}
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>

                  )}

                  {/* Services Section */}
                  {svcSubTab === 'services' && (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                     <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 dark:bg-zinc-800/30 gap-3">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"><Settings2 size={20}/></div>
                           <div>
                              <h2 className="section-header">Services</h2>
                              <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">Manage individual services</p>
                           </div>
                        </div>
                        <div className="flex gap-3 items-center">
                           <select
                              value={selectedCategoryFilter}
                              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                              className="px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold text-xs"
                           >
                              <option value="ALL">All Categories</option>
                              {categories.map(cat => (
                                 <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                           </select>
                           <button
                              type="button"
                              onClick={() => setShowAddServiceModal(true)}
                              className="compact-button bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg active:scale-95 transition-all flex items-center gap-2"
                           >
                              <Plus size={12} />
                              Add Service
                           </button>
                        </div>
                     </div>
                     <div className="p-4 sm:p-6">
                        {isLoadingServices ? (
                           <div className="py-12"><LoadingSpinner size="lg" message="Loading services..." /></div>
                        ) : services.filter(s => selectedCategoryFilter === 'ALL' || s.categoryId === selectedCategoryFilter).length === 0 ? (
                           <div className="text-center py-12">
                              <Settings2 size={48} className="mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
                              <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-2">No Services Yet</h3>
                              <p className="text-seafoam dark:text-zinc-500 text-sm">
                                 Create your first service to get started.
                              </p>
                           </div>
                        ) : (
                           <div className="overflow-x-auto">
                              <table className="w-full">
                                 <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-800">
                                       <th className="compact-table-cell text-left table-header">Service Name</th>
                                       <th className="compact-table-cell text-left table-header">Category</th>
                                       <th className="compact-table-cell text-left table-header">Description</th>
                                       <th className="compact-table-cell text-left table-header">Default Price</th>
                                       <th className="compact-table-cell text-left table-header">Clinic Price</th>
                                       <th className="compact-table-cell text-center table-header">In Use</th>
                                       <th className="compact-table-cell text-right table-header">Actions</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {services.filter(s => selectedCategoryFilter === 'ALL' || s.categoryId === selectedCategoryFilter).map(service => (
                                       <tr key={service.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 group">
                                          <td className="compact-table-cell font-bold text-pine dark:text-zinc-100">{service.name}</td>
                                          <td className="compact-table-cell">
                                             <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-lg text-[8px] font-bold">
                                                {service.categoryName}
                                             </span>
                                          </td>
                                          <td className="compact-table-cell text-seafoam dark:text-zinc-400 text-xs">{service.description || '-'}</td>
                                          <td className="compact-table-cell font-mono font-bold text-pine dark:text-zinc-100 text-sm">
                                             {service.defaultPrice ? `${localCurrency} ${service.defaultPrice.toLocaleString()}` : '-'}
                                          </td>
                                          <td className="compact-table-cell">
                                             <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={svcOverride[service.id]?.priceOverride ?? ''}
                                                placeholder={service.defaultPrice != null ? `${service.defaultPrice}` : 'price'}
                                                onChange={(e) => setServicePrice(service, e.target.value)}
                                                className={`w-24 px-2 py-1 text-right text-sm font-mono rounded-lg border bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 ${svcOverride[service.id]?.priceOverride != null ? 'border-cyan-400' : 'border-slate-200 dark:border-zinc-700'}`}
                                                disabled={svcOverride[service.id]?.enabled === false}
                                             />
                                          </td>
                                          <td className="compact-table-cell text-center">
                                             <label className="inline-flex items-center cursor-pointer select-none align-middle">
                                                <input type="checkbox" checked={svcOverride[service.id]?.enabled ?? true} onChange={() => toggleServiceEnabled(service)} className="sr-only peer" />
                                                <span className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 rounded-full relative transition-colors peer-checked:bg-seafoam after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
                                             </label>
                                             {savingSvcId === service.id && <Loader2 size={12} className="animate-spin text-seafoam inline-block ml-1 align-middle" />}
                                          </td>
                                          <td className="compact-table-cell text-right">
                                             <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                   type="button"
                                                   onClick={() => setEditingService(service)}
                                                   className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                                                   disabled={service.isApproved}
                                                >
                                                   <Edit2 size={12} />
                                                </button>
                                                <button
                                                   type="button"
                                                   onClick={() => handleDeleteService(service.id)}
                                                   className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all disabled:opacity-50"
                                                   disabled={service.isApproved || actionLoading === `delete-svc-${service.id}`}
                                                >
                                                   {actionLoading === `delete-svc-${service.id}` ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                             </div>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                     </div>
                  </div>

                  )}

                  {/* Service Bundles — group services into bundled/itemized price packages */}
                  {svcSubTab === 'bundles' && (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                     <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3 bg-slate-50/50 dark:bg-zinc-800/30">
                        <div className="p-2 bg-cyan-500 text-white rounded-xl shadow-lg shadow-cyan-500/20"><Layers size={20}/></div>
                        <div>
                           <h2 className="section-header">Service Bundles & Prices</h2>
                           <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5 tracking-widest">Group services into priced packages</p>
                        </div>
                     </div>
                     <div className="p-4 sm:p-6">
                        <ServiceBundlesView />
                     </div>
                  </div>
                  )}
               </div>
            )}

            {/* Billing — the full Billing & Subscription page, embedded so the
                management tab and the standalone page are exactly the same. */}
            {activeTab === 'ratings' && <RatingsDashboardView />}
            {activeTab === 'billing' && (
               <div className="animate-in slide-in-from-bottom-4">
                  <BillingView />
               </div>
            )}

            {activeTab === 'ai' && (
               <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6">
                     <div className="flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 pb-4">
                        <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg"><Sparkles size={20}/></div>
                        <div>
                           <h2 className="section-header">AI Assistant Configuration</h2>
                           <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure AI-powered clinical assistance</p>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-3">
                           <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">AI Provider</label>
                           <select
                              value={localAIConfig.provider}
                              onChange={(e) => setLocalAIConfig({ ...localAIConfig, provider: e.target.value as any })}
                              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                           >
                              <option value="fallback">Fallback (No AI - Basic Templates)</option>
                              <option value="gemini">Google Gemini</option>
                              <option value="openai">OpenAI (Coming Soon)</option>
                           </select>
                           <p className="text-[8px] text-slate-400 px-1">Select your preferred AI provider for clinical note generation and diagnostic assistance</p>
                        </div>

                        {localAIConfig.provider !== 'fallback' && (
                           <>
                              <div className="space-y-3">
                                 <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">API Key</label>
                                 <div className="relative">
                                    <input
                                       type={showAIKey ? 'text' : 'password'}
                                       value={localAIConfig.apiKey || ''}
                                       onChange={(e) => setLocalAIConfig({ ...localAIConfig, apiKey: e.target.value })}
                                       placeholder={`Enter your ${localAIConfig.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key`}
                                       className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-4 pr-11 py-3 text-pine dark:text-zinc-100 font-mono outline-none focus:ring-2 focus:ring-seafoam/20"
                                    />
                                    <button type="button" onClick={() => setShowAIKey((v) => !v)} aria-label={showAIKey ? 'Hide API key' : 'Show API key'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                                       {showAIKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                 </div>
                                 <p className="text-[8px] text-slate-400 px-1">
                                    {localAIConfig.provider === 'gemini' && 'Get your API key from Google AI Studio: https://aistudio.google.com/apikey'}
                                    {localAIConfig.provider === 'openai' && 'Get your API key from OpenAI Platform: https://platform.openai.com/api-keys'}
                                 </p>
                              </div>

                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Model (Optional)</label>
                                 <input
                                    type="text"
                                    value={localAIConfig.model || ''}
                                    onChange={(e) => setLocalAIConfig({ ...localAIConfig, model: e.target.value })}
                                    placeholder={localAIConfig.provider === 'gemini' ? 'gemini-2.0-flash-exp (default)' : 'gpt-4 (default)'}
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-4 text-pine dark:text-zinc-100 font-mono outline-none focus:ring-4 focus:ring-seafoam/5"
                                 />
                                 <p className="text-[9px] text-slate-400 px-1">Leave blank to use the default model for your provider</p>
                              </div>
                           </>
                        )}

                        <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl">
                           <div className="flex items-start gap-3">
                              <Sparkles className="text-indigo-500 shrink-0 mt-1" size={20} />
                              <div className="space-y-2">
                                 <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">AI Features</h4>
                                 <ul className="text-[10px] text-indigo-600 dark:text-indigo-300 space-y-1">
                                    <li>• Generate professional clinical narratives from service observations</li>
                                    <li>• Create comprehensive visit summaries and discharge instructions</li>
                                    <li>• Get diagnostic suggestions and treatment recommendations</li>
                                    <li>• Analyze medical histories for quick clinical review</li>
                                 </ul>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'wallet' && (
               <div className="lg:col-span-12 animate-in slide-in-from-bottom-4">
                  <ClinicWallet
                    clinic={clinic}
                    transactions={transactions}
                    onAddTransaction={onAddTransaction ?? (() => {})}
                  />
               </div>
            )}

            {activeTab === 'gateways' && (
               <div className="lg:col-span-12 animate-in slide-in-from-bottom-4">
                  <PaymentGatewaysTab clinicId={clinic.id} />
               </div>
            )}

            {activeTab === 'verification' && (
               <div className="lg:col-span-12 animate-in slide-in-from-bottom-4">
                  <VerificationPanel entity="clinic" entityId={clinic.id} />
               </div>
            )}
         </div>

         {/* Live Preview + Save — floating hover card, top-right, on every tab.
             The content column runs full width underneath. z-50 keeps it UNDER
             the navbar (z-60) so the profile dropdown paints on top. */}
         <div className="hidden lg:block fixed top-24 right-6 z-50 w-60 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xl space-y-3 opacity-80 hover:opacity-100 transition-opacity">
            <div className="p-3 rounded-xl border shadow relative overflow-hidden" style={{ backgroundColor: localColors.primary }}>
               <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
               <div className="relative z-10 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center text-xl shadow border border-white/20 overflow-hidden shrink-0">
                    <ClinicLogo logo={localLogo} fallback="🐾" />
                  </div>
                  <div className="min-w-0">
                     <h4 className="text-white text-[11px] font-black uppercase tracking-tight leading-tight truncate">{clinic.name}</h4>
                     <p className="text-white/60 text-[7px] font-bold uppercase tracking-widest truncate">{clinic.slogan}</p>
                  </div>
               </div>
            </div>
            <button type="submit" disabled={isSaving} className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-2.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
               {isSaving ? <BrandMark animate color="currentColor" className="w-4 h-4" /> : savedFeedback ? <CheckCircle2 size={14}/> : <Save size={14}/>}
               {isSaving ? 'SAVING...' : savedFeedback ? 'CHANGES SAVED' : 'SAVE CHANGES'}
            </button>
         </div>

         {/* Mobile fallback — inline save at the end of the form. */}
         <div className="lg:hidden lg:col-span-12">
            <button type="submit" disabled={isSaving} className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
               {isSaving ? <BrandMark animate color="currentColor" className="w-4 h-4" /> : savedFeedback ? <CheckCircle2 size={14}/> : <Save size={14}/>}
               {isSaving ? 'SAVING...' : savedFeedback ? 'CHANGES SAVED' : 'SAVE CHANGES'}
            </button>
         </div>
      </form>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Add Category</h3>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold text-sm"
                  placeholder="e.g., Surgery, Grooming"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description (Optional)</label>
                <textarea
                  name="description"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 text-sm"
                  placeholder="Brief description of this category"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="flex-1 compact-button bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'add-category'}
                  className="flex-1 compact-button bg-purple-500 hover:bg-purple-600 text-white shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {actionLoading === 'add-category' ? <><RefreshCw size={12} className="animate-spin" /> Creating...</> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase">Add Service</h3>
              <button
                type="button"
                onClick={() => setShowAddServiceModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddService} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Service Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  placeholder="e.g., General Health Check"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                <select
                  name="categoryId"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description (Optional)</label>
                <textarea
                  name="description"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
                  placeholder="Brief description of this service"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Default Price (Optional)</label>
                <input
                  type="number"
                  name="defaultPrice"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-mono font-bold"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'add-service'}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {actionLoading === 'add-service' ? <><RefreshCw size={12} className="animate-spin" /> Creating...</> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase">Edit Service</h3>
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateService} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Service Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingService.name}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                <select
                  name="categoryId"
                  defaultValue={editingService.categoryId}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  required
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingService.description}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Default Price</label>
                <input
                  type="number"
                  name="defaultPrice"
                  defaultValue={editingService.defaultPrice || ''}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-mono font-bold"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'update-service'}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {actionLoading === 'update-service' ? <><RefreshCw size={12} className="animate-spin" /> Updating...</> : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicManagementView;

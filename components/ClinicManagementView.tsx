
import React, { useState, useEffect, useRef } from 'react';
import { Clinic, User, UserRole, BillingSettings, SubscriptionPackage, Transaction, PaymentMethod } from '../types';
import ClinicWallet from './ClinicWallet';
import ClinicLogo from './ClinicLogo';
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
} from 'lucide-react';
import { COUNTRIES, CLINIC_SPECIALTIES } from '../constants';
import PaymentGatewaysTab from './PaymentGatewaysTab';
import ClinicCatalogTab from './ClinicCatalogTab';
import { categoriesAPI, servicesAPI, Category, Service, dialog, toast } from '../services';
import CountrySelect from './CountrySelect';
import { COUNTRIES as ALL_COUNTRIES, type Country } from '../utils/countries';
import LoadingSpinner from './LoadingSpinner';
import type { SubscriptionPackage as ApiPackage } from '../services/modules/stripe.api';
import { clinicSubscriptionAPI } from '../services/modules/clinicSubscription.api';
import type { ClinicSubscription as ApiSub, UpgradePreview } from '../services/modules/clinicSubscription.api';

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
  initialTabOverride?: 'branding' | 'visuals' | 'team' | 'categories' | 'catalog' | 'billing' | 'ai' | 'wallet' | 'gateways';
}

const ClinicManagementView: React.FC<Props> = ({
  clinic,
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
  const [activeTab, setActiveTab] = useState<'branding' | 'visuals' | 'team' | 'categories' | 'catalog' | 'billing' | 'ai' | 'wallet' | 'gateways'>(initialTabOverride || 'branding');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks which action is in progress

  // Local state for live preview before saving
  const [localColors, setLocalColors] = useState(clinic.colors || { primary: '#438883', secondary: '#163C39' });
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
    setLocalColors(clinic.colors || { primary: '#438883', secondary: '#163C39' });
    setLocalLogo(clinic.logo || '🐾');
    setLocalCurrency(clinic.currency || 'KES');
    setLocalSpecialties(clinic.specialties || []);
    setLocalAIConfig(clinic.aiConfig || { provider: 'fallback', apiKey: '', model: '' });
    setLocalLatitude(formatCoord(clinic.latitude));
    setLocalLongitude(formatCoord(clinic.longitude));
    setLocalCountryCode(clinic.countryCode || '');
    setLocalDialCode(clinic.dialCode || '');
    setLocalRegion(clinic.region || '');
  }, [clinic.id, clinic.colors, clinic.logo, clinic.currency, clinic.specialties, clinic.aiConfig, clinic.latitude, clinic.longitude, clinic.countryCode, clinic.dialCode, clinic.region]);

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
      const data = await categoriesAPI.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const loadServices = async () => {
    setIsLoadingServices(true);
    try {
      const data = await servicesAPI.getAll();
      setServices(data);
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
    { p: '#438883', s: '#163C39', label: 'Enterprise Teal' },
    { p: '#2EA1B8', s: '#163C39', label: 'Ocean Cyan' },
    { p: '#ec4899', s: '#500724', label: 'Soft Petal' },
    { p: '#ef4444', s: '#450a0a', label: 'Urgent Red' },
  ];

  const logoPresets = ['🐾', '🏥', '🐶', '🐱', '🩺', '❤️', '🦴', '🦁', '🦜', '🐹'];

  return (
    <div className="space-y-4 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      <div className="flex w-full bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
        {[
          { id: 'branding', label: 'Identity', icon: Globe },
          { id: 'visuals', label: 'Appearance', icon: Palette },
          { id: 'team', label: 'Personnel', icon: Users },
          { id: 'categories', label: 'Services', icon: Briefcase },
          { id: 'catalog', label: 'Catalog', icon: Briefcase },
          { id: 'ai', label: 'AI', icon: Sparkles },
          { id: 'billing', label: 'Treasury', icon: CreditCard },
          { id: 'wallet', label: 'Wallet', icon: Wallet },
          { id: 'gateways', label: 'Gateways', icon: Shield },
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

      <form onSubmit={handleClinicUpdate} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
         <div className="lg:col-span-8">
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
                           <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">.vethub.io</span>
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
                              <span className="bg-white dark:bg-zinc-800 text-pine dark:text-zinc-300 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border border-slate-200 dark:border-zinc-700">
                                {staff.role.replace('_', ' ')}
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
                  {/* Categories Section */}
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
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {categories.map(category => (
                                 <div key={category.id} className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 group hover:shadow-lg transition-all">
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
                                          <div className="flex justify-between items-start mb-3">
                                             <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">{category.name}</h3>
                                             {category.isApproved && (
                                                <span className="bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">Global</span>
                                             )}
                                          </div>
                                          <p className="text-seafoam dark:text-zinc-400 text-sm mb-4">{category.description || 'No description'}</p>
                                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button
                                                type="button"
                                                onClick={() => setEditingCategory(category)}
                                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1"
                                                disabled={category.isApproved}
                                             >
                                                <Edit2 size={12} /> Edit
                                             </button>
                                             <button
                                                type="button"
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1 disabled:opacity-50"
                                                disabled={category.isApproved || actionLoading === `delete-cat-${category.id}`}
                                             >
                                                {actionLoading === `delete-cat-${category.id}` ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                                             </button>
                                          </div>
                                       </>
                                    )}
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Services Section */}
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
               </div>
            )}

            {activeTab === 'catalog' && <ClinicCatalogTab />}

            {activeTab === 'billing' && (
               <div className="space-y-6 animate-in slide-in-from-bottom-4">

                  {/* Current subscription summary */}
                  {activeSub ? (
                     <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-seafoam/10 flex items-center justify-center flex-shrink-0">
                           {activeSub.package?.tier === 1 ? <Zap size={20} className="text-seafoam" />
                             : activeSub.package?.tier === 2 ? <Crown size={20} className="text-seafoam" />
                             : activeSub.package?.tier === 3 ? <Rocket size={20} className="text-seafoam" />
                             : <Package size={20} className="text-seafoam" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-black text-pine dark:text-zinc-100">{activeSub.package?.name ?? 'Current Plan'}</span>
                              <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20">Tier {activeSub.package?.tier}</span>
                              <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Active</span>
                              {activeSub.autoRenew && <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20"><RefreshCw size={8} /> Auto-renew</span>}
                           </div>
                           <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                              {clinic.currency} {activeSub.package?.price.toFixed(2)}/mo · Expires {new Date(activeSub.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                           </p>
                        </div>
                        {activeSub.creditApplied > 0 && (
                           <div className="text-right flex-shrink-0">
                              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 flex items-center gap-1 justify-end"><Gift size={8} /> Credit Used</p>
                              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">− {clinic.currency} {activeSub.creditApplied.toFixed(2)}</p>
                           </div>
                        )}
                     </div>
                  ) : (
                     <div className="flex items-center gap-4 px-6 py-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                        <p className="text-xs font-bold text-amber-600">No active subscription. Choose a plan below.</p>
                     </div>
                  )}

                  {subError && (
                     <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs font-bold">
                        <AlertTriangle size={14} /> {subError}
                     </div>
                  )}

                  {/* Package grid */}
                  {apiPackages.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[...apiPackages].sort((a, b) => a.tier - b.tier).map(pkg => {
                           const currentTier = activeSub?.package?.tier ?? 0;
                           const isCurrent = activeSub?.packageId === pkg.id;
                           const isLower = pkg.tier < currentTier;
                           const isUpgrade = pkg.tier > currentTier;
                           const preview = previews[pkg.id];
                           const TierIcon = pkg.tier === 1 ? Zap : pkg.tier === 2 ? Crown : pkg.tier === 3 ? Rocket : Package;

                           return (
                              <div
                                 key={pkg.id}
                                 className={`relative rounded-2xl border p-6 flex flex-col gap-4 transition-all ${
                                    isCurrent
                                       ? 'border-seafoam bg-seafoam/5 shadow-lg shadow-seafoam/10'
                                       : isLower
                                       ? 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 opacity-50 pointer-events-none select-none'
                                       : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-seafoam/50 hover:shadow-md'
                                 }`}
                              >
                                 {/* Lock badge for lower tiers */}
                                 {isLower && (
                                    <span className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-slate-200 dark:bg-zinc-800 text-slate-400 border border-slate-300 dark:border-zinc-700">
                                       <Lock size={8} /> Not available
                                    </span>
                                 )}
                                 {isCurrent && (
                                    <span className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/30">
                                       <CheckCircle2 size={8} /> Current
                                    </span>
                                 )}

                                 {/* Plan header */}
                                 <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCurrent ? 'bg-seafoam/15' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                                       <TierIcon size={18} className={isCurrent ? 'text-seafoam' : 'text-slate-400 dark:text-zinc-500'} />
                                    </div>
                                    <div>
                                       <p className="font-black text-pine dark:text-zinc-100">{pkg.name}</p>
                                       <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Tier {pkg.tier}</p>
                                    </div>
                                 </div>

                                 {/* Price */}
                                 <div>
                                    <span className="text-2xl font-black text-pine dark:text-zinc-100">{clinic.currency} {pkg.price.toFixed(2)}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase ml-1">/ {pkg.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
                                 </div>

                                 {/* Limits */}
                                 <div className="grid grid-cols-3 gap-2">
                                    {[
                                       { label: 'Staff', val: pkg.maxStaff },
                                       { label: 'Patients', val: pkg.maxPatients >= 99999 ? '∞' : pkg.maxPatients },
                                       { label: 'Storage', val: `${pkg.storageGb}GB` },
                                    ].map(l => (
                                       <div key={l.label} className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-2 text-center">
                                          <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{l.label}</p>
                                          <p className="text-xs font-black text-pine dark:text-zinc-100">{l.val}</p>
                                       </div>
                                    ))}
                                 </div>

                                 {/* Features */}
                                 <ul className="space-y-1.5 flex-1">
                                    {pkg.features.slice(0, 4).map(f => (
                                       <li key={f} className="flex items-start gap-2 text-[10px] font-medium text-slate-600 dark:text-zinc-400">
                                          <CheckCircle2 size={10} className="text-seafoam flex-shrink-0 mt-0.5" /> {f}
                                       </li>
                                    ))}
                                 </ul>

                                 {/* Upgrade proration callout */}
                                 {isUpgrade && preview && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-1">
                                       <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                          <Gift size={8} /> Proration Applied
                                       </p>
                                       <div className="flex justify-between text-[10px]">
                                          <span className="text-slate-500 dark:text-zinc-400">Credit available</span>
                                          <span className="font-black text-emerald-600">− {clinic.currency} {preview.creditAvailable.toFixed(2)}</span>
                                       </div>
                                       <div className="flex justify-between text-[10px]">
                                          <span className="text-slate-500 dark:text-zinc-400">You pay today</span>
                                          <span className="font-black text-pine dark:text-zinc-100">{clinic.currency} {preview.amountDue.toFixed(2)}</span>
                                       </div>
                                    </div>
                                 )}

                                 {/* Action button */}
                                 {!isCurrent && !isLower && (
                                    <button
                                       onClick={() => handleSubscribe(pkg.id)}
                                       disabled={isSubscribing === pkg.id}
                                       className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg"
                                    >
                                       {isSubscribing === pkg.id ? (
                                          <RefreshCw size={12} className="animate-spin" />
                                       ) : (
                                          <><ArrowRight size={12} /> {activeSub ? 'Upgrade Plan' : 'Subscribe'}</>
                                       )}
                                    </button>
                                 )}
                                 {isCurrent && (
                                    <div className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-center text-seafoam border border-seafoam/30 bg-seafoam/5">
                                       Active Plan
                                    </div>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  ) : (
                     <div className="text-center py-16 text-slate-400 dark:text-zinc-600 text-sm font-bold">Loading plans…</div>
                  )}
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
                                 <input
                                    type="password"
                                    value={localAIConfig.apiKey || ''}
                                    onChange={(e) => setLocalAIConfig({ ...localAIConfig, apiKey: e.target.value })}
                                    placeholder={`Enter your ${localAIConfig.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key`}
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-mono outline-none focus:ring-2 focus:ring-seafoam/20"
                                 />
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
         </div>

         <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6 sticky top-24">
               <h3 className="section-header">Live Preview</h3>

               <div className="p-6 rounded-xl border shadow-xl relative overflow-hidden group" style={{ backgroundColor: localColors.primary }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                  <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                     <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center text-3xl shadow-lg border border-white/20 overflow-hidden">
                       <ClinicLogo logo={localLogo} fallback="🐾" />
                     </div>
                     <div>
                        <h4 className="text-white text-lg font-black uppercase tracking-tight leading-none">{clinic.name}</h4>
                        <p className="text-white/60 text-[8px] font-bold uppercase tracking-widest mt-1.5">{clinic.slogan}</p>
                     </div>
                  </div>
               </div>

               <div className="space-y-3 pt-4">
                  <button type="submit" disabled={isSaving} className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                     {isSaving ? <RefreshCw size={14} className="animate-spin" /> : savedFeedback ? <CheckCircle2 size={14}/> : <Save size={14}/>}
                     {isSaving ? 'SAVING...' : savedFeedback ? 'CHANGES SAVED' : 'SAVE CHANGES'}
                  </button>
                  <p className="text-[7px] font-black text-slate-400 uppercase text-center leading-relaxed">System updates will proliferate to all authorized practitioners instantly.</p>
               </div>
            </div>
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

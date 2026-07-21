import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Users,
  GitBranch,
  CreditCard,
  Wallet,
  Save,
  Check,
  Building2,
  Star,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Settings,
  Palette,
  Image,
  Link,
  MessageSquare,
  BadgeCheck,
  ChevronDown,
} from 'lucide-react';
import VerificationPanel from '../../shared/verification/VerificationPanel';
import { useManagementScope } from '../../../contexts/ManagementScopeContext';
import ManagingSwitcher from '../../shared/common/ManagingSwitcher';
import SupplierBranchesView from '../branches/SupplierBranchesView';
import SupplierEmployeeListView from '../employees/SupplierEmployeeListView';
import SupplierBillingView from '../billing/SupplierBillingView';
import SupplierWallet from '../billing/SupplierWallet';
import { useAuth } from '../../../contexts/AuthContext';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import { useSupplier } from '../../../contexts/SupplierContext';
import { suppliersAPI } from '../../../services/modules/suppliers.api';
import type { Supplier } from '../../../services/modules/suppliers.api';
import { toast } from '../../../services/utils/toast';
import { cache } from '../../../services/utils/cache';

const COLOR_PRESETS: { p: string; s: string; label: string }[] = [
  { p: '#6366f1', s: '#1e1b4b', label: 'Classic Indigo' },
  { p: '#10b981', s: '#064e3b', label: 'Healing Emerald' },
  { p: '#f59e0b', s: '#451a03', label: 'Vital Amber' },
  { p: '#1C7A5B', s: '#144E35', label: 'Enterprise Teal' },
  { p: '#2EA1B8', s: '#144E35', label: 'Ocean Cyan' },
  { p: '#ec4899', s: '#500724', label: 'Soft Petal' },
  { p: '#ef4444', s: '#450a0a', label: 'Urgent Red' },
  { p: '#8b5cf6', s: '#2e1065', label: 'Deep Violet' },
];

// Generic supplier-themed glyphs for one-click logo selection. Mirrors the
// clinic's logoPresets pattern. Stored in the same `logoUrl` field as URL
// uploads — the renderer (isImageSrc helper below) decides how to display.
const LOGO_PRESETS = [
  '🚚', '📦', '💊', '💉', '🧪', '🩺', '🏥',
  '🦴', '🐾', '🐕', '🐈', '🌡️', '🥼', '🧬',
];

/** Treat an `logoUrl` value as a URL only if it looks like one — otherwise
 *  render as text (emoji preset). Lets the same column hold both. */
const isImageSrc = (s?: string | null): s is string =>
  !!s && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('/'));

const sanitizeHex = (raw: string): string | null => {
  let v = raw.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (!/^#[0-9a-fA-F]{0,6}$/.test(v)) return null;
  return v;
};

type Tab = 'identity' | 'personnel' | 'branches' | 'subscription' | 'treasury' | 'appearance' | 'verification';

interface Props {
  setView?: (view: string, params?: any) => void;
  initialTab?: Tab;
}

const SUPPLIER_CATEGORIES = [
  'Pharmaceuticals',
  'Medical Equipment',
  'Surgical Supplies',
  'Laboratory Reagents',
  'Pet Food & Nutrition',
  'Vaccines & Biologicals',
  'Diagnostic Kits',
  'Dental Supplies',
  'Anesthesia & Sedation',
  'Wound Care',
  'Orthopedic Implants',
  'Imaging Supplies',
  'Disinfectants & Hygiene',
  'Protective Equipment',
  'Other',
];

const CURRENCIES = [
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'TZS', label: 'TZS — Tanzanian Shilling' },
  { code: 'UGX', label: 'UGX — Ugandan Shilling' },
  { code: 'INR', label: 'INR — Indian Rupee' },
];

const SupplierManagementView: React.FC<Props> = ({ setView, initialTab = 'identity' }) => {
  const { user } = useAuth();
  const { branches } = useSupplierBranch();
  // For admins, the supplier under edit is whichever one they've narrowed
  // to in the unified context switcher. SUPPLIER role users use their own.
  const supplierCtx = useSupplier();
  const role = user?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'MERCHANT_ADMIN';

  // Managed supplier comes from the shared "Managing" switcher (doesn't change
  // the sidebar selection).
  const { managedSupplierId } = useManagementScope();

  const supplier: Supplier | undefined = useMemo(() => {
    // SUPPLIER role: prefer the live SupplierContext copy (refreshes on
    // save) over the auth-payload snapshot which is frozen at login.
    if (role === 'SUPPLIER') {
      return (supplierCtx.mySupplier || (user?.supplier as any)) as Supplier | undefined;
    }
    if (isAdmin) {
      const list = supplierCtx.selectedSuppliers.length ? supplierCtx.selectedSuppliers : supplierCtx.suppliers;
      // Locally-chosen management target among the selected set.
      if (managedSupplierId) {
        const m = list.find(s => String(s.id) === managedSupplierId);
        if (m) return m;
      }
      if (supplierCtx.selectedSuppliers.length >= 1) return supplierCtx.selectedSuppliers[0];
      if (supplierCtx.selectedSupplierIds.length === 1) {
        return supplierCtx.suppliers.find(s => String(s.id) === supplierCtx.selectedSupplierIds[0]);
      }
    }
    if (user?.supplier) return user.supplier as any;
    return undefined;
  }, [role, user?.supplier, isAdmin, managedSupplierId, supplierCtx.mySupplier, supplierCtx.selectedSuppliers, supplierCtx.selectedSupplierIds, supplierCtx.suppliers]);

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Form state — the initial values come from `supplier`, but the source can
  // load asynchronously (especially for admins waiting on the roster fetch),
  // so we keep an effect to hydrate the inputs once data arrives.
  const [localName, setLocalName] = useState('');
  const [localCategory, setLocalCategory] = useState('');
  const [localCurrency, setLocalCurrency] = useState('KES');
  const [localContactEmail, setLocalContactEmail] = useState('');
  const [localContactPhone, setLocalContactPhone] = useState('');
  const [localAddress, setLocalAddress] = useState('');

  // Appearance state
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [slogan, setSlogan] = useState('');
  const [website, setWebsite] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1C7A5B');
  const [secondaryColor, setSecondaryColor] = useState('#144E35');

  // Hydrate every form field whenever the source supplier resolves or changes.
  // Without this, the defaultValue/value chain only captures the FIRST render
  // — typical for SUPPLIER users where `user.supplier` is on the auth payload,
  // but admins fetch the roster after auth and would see empty inputs.
  useEffect(() => {
    if (!supplier) return;
    setLocalName(supplier.name || '');
    setLocalCategory(supplier.category || '');
    setLocalCurrency(supplier.currency || 'KES');
    setLocalContactEmail(supplier.contactEmail || '');
    setLocalContactPhone(supplier.contactPhone || '');
    setLocalAddress(supplier.address || '');
    setLogoUrl(supplier.logoUrl || '');
    setSlogan(supplier.slogan || '');
    setWebsite(supplier.website || '');
    setPrimaryColor(supplier.primaryColor || '#1C7A5B');
    setSecondaryColor(supplier.secondaryColor || '#144E35');
  }, [supplier?.id, supplier?.name, supplier?.category, supplier?.currency,
      supplier?.contactEmail, supplier?.contactPhone, supplier?.address,
      supplier?.logoUrl, supplier?.slogan, supplier?.website,
      supplier?.primaryColor, supplier?.secondaryColor]);

  const handleAppearanceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier?.id) {
      toast.error('No supplier selected');
      return;
    }
    setAppearanceSaving(true);
    try {
      const res = await suppliersAPI.update(Number(supplier.id), {
        logoUrl: logoUrl.trim() || undefined,
        slogan: slogan.trim() || undefined,
        website: website.trim() || undefined,
        primaryColor: primaryColor || undefined,
        secondaryColor: secondaryColor || undefined,
      });
      if (res.success) {
        cache.invalidatePattern(new RegExp(`suppliers`));
        // Push the response payload straight into context — theme effect
        // re-runs with the picked colors before any background refetch
        // lands. Saves a roundtrip and removes the visible delay between
        // clicking Save and the brand updating.
        const updated = (res.data as any)?.supplier;
        if (updated) supplierCtx.applySupplierUpdate(updated as Supplier);
        // Background refetch keeps caches honest but no longer gates the UX.
        supplierCtx.refreshMySupplier().catch(() => {});
      }
      toast.success('Appearance settings saved');
    } catch {
      toast.error('Failed to save appearance settings');
    } finally {
      setAppearanceSaving(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supplier?.id) {
      toast.error('No supplier selected');
      return;
    }
    setSaving(true);
    try {
      const res = await suppliersAPI.update(Number(supplier.id), {
        name: localName.trim() || undefined,
        contactEmail: localContactEmail.trim() || undefined,
        contactPhone: localContactPhone.trim() || undefined,
        address: localAddress.trim() || undefined,
        category: localCategory || undefined,
        currency: localCurrency || undefined,
      });
      if (res.success) {
        cache.invalidatePattern(new RegExp(`suppliers`));
        const updated = (res.data as any)?.supplier;
        if (updated) supplierCtx.applySupplierUpdate(updated as Supplier);
        supplierCtx.refreshMySupplier().catch(() => {});
      }
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'identity',     label: 'Identity',     icon: Globe      },
    { id: 'personnel',    label: 'Personnel',    icon: Users      },
    { id: 'branches',     label: 'Branches',     icon: GitBranch  },
    { id: 'appearance',   label: 'Appearance',   icon: Palette    },
    { id: 'subscription', label: 'Billing', icon: CreditCard },
    { id: 'treasury',     label: 'Treasury',     icon: Wallet     },
    { id: 'verification', label: 'Verification', icon: BadgeCheck },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">

      <ManagingSwitcher kind="supplier" />

      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-xl"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${secondaryColor}, ${secondaryColor}E6, ${primaryColor})`,
          boxShadow: `0 25px 50px -12px ${primaryColor}33`,
        }}
      >
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative px-6 py-6 flex items-center gap-4">
          {supplier?.logoUrl && (
            isImageSrc(supplier.logoUrl) ? (
              <img
                src={supplier.logoUrl}
                alt={supplier.name}
                className="w-14 h-14 rounded-xl object-contain bg-white/10 border border-white/20 p-1 shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl shrink-0">
                {supplier.logoUrl}
              </div>
            )
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Management</p>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-none truncate">
              {supplier?.name || 'Supplier Management'}
            </h1>
            <p className="text-white/70 text-xs font-semibold mt-1.5">
              Welcome back, {user?.name}
              {supplier?.category && <span className="ml-2 opacity-60">· {supplier.category}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Admin-only banner — flag when no supplier is in scope so they
          know to pick one before editing. */}
      {!supplier && isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-700 dark:text-amber-400">
          <Building2 size={16} className="shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-black uppercase tracking-widest mb-1">No supplier selected</p>
            <p className="font-semibold">Use the supplier dropdown in the sidebar to narrow to a single supplier before editing identity / appearance.</p>
          </div>
        </div>
      )}

      {/* ── Tab nav ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-lg min-w-max sm:min-w-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-md'
                : 'text-seafoam dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>
      </div>

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      {activeTab === 'identity' && (
        <form onSubmit={handleProfileSave} className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-in slide-in-from-bottom-4">

          {/* Main form */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="p-1.5 bg-seafoam text-white rounded-lg"><Globe size={14} /></div>
                <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wide">Business Identity</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-seafoam uppercase tracking-widest px-0.5">Business Name</label>
                  <input
                    name="name"
                    value={localName}
                    onChange={e => setLocalName(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-seafoam uppercase tracking-widest px-0.5">Category</label>
                  <select
                    value={localCategory}
                    onChange={e => setLocalCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  >
                    <option value="">Select category…</option>
                    {SUPPLIER_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-seafoam uppercase tracking-widest px-0.5">Contact Email</label>
                  <input
                    name="contactEmail"
                    type="email"
                    value={localContactEmail}
                    onChange={e => setLocalContactEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-seafoam uppercase tracking-widest px-0.5">Contact Phone</label>
                  <input
                    name="contactPhone"
                    type="tel"
                    value={localContactPhone}
                    onChange={e => setLocalContactPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[9px] font-semibold text-seafoam uppercase tracking-widest px-0.5">Address</label>
                  <input
                    name="address"
                    value={localAddress}
                    onChange={e => setLocalAddress(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-seafoam uppercase tracking-widest px-0.5">Default Currency</label>
                  <select
                    value={localCurrency}
                    onChange={e => setLocalCurrency(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg font-semibold text-[10px] uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : savedFeedback ? (
                    <Check size={13} />
                  ) : (
                    <Save size={13} />
                  )}
                  {savedFeedback ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar snapshot */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3 sticky top-24">
              <h3 className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Account Snapshot</h3>

              {/* Mini brand card */}
              <div className="p-3 rounded-lg border border-seafoam/20 bg-pine/5 dark:bg-pine/10 relative overflow-hidden">
                <div className="absolute -right-3 -top-3 text-seafoam/5 rotate-12"><Building2 size={60} /></div>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-pine flex items-center justify-center text-white font-bold text-base shadow flex-shrink-0">
                    {(supplier?.name || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-pine dark:text-zinc-100 text-sm truncate">
                      {supplier?.name || '—'}
                    </p>
                    <p className="text-[9px] font-medium text-seafoam uppercase tracking-wide mt-0.5 truncate">
                      {localCategory || supplier?.category || 'Uncategorized'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Rating',    value: `${(supplier?.rating ?? 0).toFixed(1)} / 5`, icon: Star,         color: 'text-amber-500' },
                  { label: 'Status',    value: supplier?.isActive ? 'Active' : 'Inactive',   icon: supplier?.isActive ? CheckCircle2 : XCircle, color: supplier?.isActive ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Branches',  value: branches.length,                              icon: GitBranch,    color: 'text-seafoam'  },
                  { label: 'Currency',  value: localCurrency,                                icon: TrendingUp,   color: 'text-pine dark:text-seafoam' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 dark:bg-zinc-800/60 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <s.icon size={10} className={s.color} />
                      <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{s.label}</p>
                    </div>
                    <p className="font-semibold text-xs text-pine dark:text-zinc-100">{String(s.value)}</p>
                  </div>
                ))}
              </div>

              {/* Contact mini-list */}
              <div className="space-y-2 pt-1">
                {supplier?.contactEmail && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                    <Mail size={11} className="text-seafoam flex-shrink-0" />
                    <span className="truncate">{supplier.contactEmail}</span>
                  </div>
                )}
                {supplier?.contactPhone && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                    <Phone size={11} className="text-seafoam flex-shrink-0" />
                    <span>{supplier.contactPhone}</span>
                  </div>
                )}
                {supplier?.address && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                    <MapPin size={11} className="text-seafoam flex-shrink-0" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── Personnel ─────────────────────────────────────────────────────── */}
      {activeTab === 'personnel' && (
        <div className="animate-in slide-in-from-bottom-4">
          <SupplierEmployeeListView setView={setView} />
        </div>
      )}

      {/* ── Branches ──────────────────────────────────────────────────────── */}
      {activeTab === 'branches' && (
        <div className="animate-in slide-in-from-bottom-4">
          <SupplierBranchesView />
        </div>
      )}

      {/* ── Subscription ──────────────────────────────────────────────────── */}
      {/* Billing — the full Billing & Subscription page, embedded so the
          management tab and the standalone page are exactly the same. */}
      {activeTab === 'subscription' && (
        <div className="animate-in slide-in-from-bottom-4">
          <SupplierBillingView />
        </div>
      )}

      {activeTab === 'appearance' && (
        <form onSubmit={handleAppearanceSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 pb-4">
                <div className="p-2 bg-purple-500 text-white rounded-xl shadow-lg"><Palette size={20} /></div>
                <h2 className="section-header">Brand Appearance</h2>
              </div>

              {/* ── Theme Colors ─────────────────────────────────────────
                  Mirror the clinic's Visual Spectrum: preset palettes +
                  custom primary/secondary color pickers (native wheel +
                  hex input). The preset row is for one-click brand picks;
                  the custom row covers everything else. */}
              <div className="space-y-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Theme Colors</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {COLOR_PRESETS.map(preset => {
                    const isActive = primaryColor === preset.p && secondaryColor === preset.s;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => { setPrimaryColor(preset.p); setSecondaryColor(preset.s); }}
                        className={`flex flex-col gap-2 p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                          isActive
                            ? 'border-seafoam bg-seafoam/5'
                            : 'border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950'
                        }`}
                      >
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 shadow-md" style={{ backgroundColor: preset.p }} />
                          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 shadow-md" style={{ backgroundColor: preset.s }} />
                        </div>
                        <span className="text-[8px] font-black uppercase text-pine dark:text-zinc-400 truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-2">Custom Colors</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      { key: 'primary' as const, label: 'Primary', value: primaryColor, set: setPrimaryColor },
                      { key: 'secondary' as const, label: 'Secondary', value: secondaryColor, set: setSecondaryColor },
                    ]).map(({ key, label, value, set }) => (
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
                            onChange={(e) => set(e.target.value)}
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
                              const next = sanitizeHex(e.target.value);
                              if (next !== null) set(next);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded px-2 py-1 text-[11px] font-mono font-bold text-pine dark:text-zinc-100 uppercase outline-none focus:ring-2 focus:ring-seafoam/30"
                            placeholder="#1C7A5B"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logo presets — one-click glyph picker. Stored in the same
                  logoUrl column as URL uploads; the renderer (isImageSrc)
                  picks <img> vs emoji text at display time. */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Image size={10} /> Quick Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {LOGO_PRESETS.map(g => {
                    const isActive = logoUrl === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setLogoUrl(g)}
                        className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all border-2 hover:scale-105 ${
                          isActive
                            ? 'border-seafoam shadow-lg scale-110'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-700'
                        }`}
                        style={isActive ? { backgroundColor: `${primaryColor}1A` } : undefined}
                        title={`Use ${g}`}
                      >
                        {g}
                      </button>
                    );
                  })}
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all border-2 border-dashed border-slate-200 dark:border-zinc-700 text-slate-300 hover:text-red-500 hover:border-red-300"
                      title="Clear icon"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Logo URL — alternative to a preset, for hosted brand assets */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Image size={10} /> Or Logo URL
                </label>
                <input
                  type="url"
                  value={isImageSrc(logoUrl) ? logoUrl : ''}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
                />
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 px-1">Direct image URL for your company logo (PNG, JPG, SVG). Overrides the icon preset above.</p>
              </div>

              {/* Logo Preview */}
              {logoUrl && (
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                  {isImageSrc(logoUrl) ? (
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="w-16 h-16 object-contain rounded-xl border border-slate-200 dark:border-zinc-700 bg-white"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-3xl">
                      {logoUrl}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-black text-pine dark:text-zinc-100">Logo Preview</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">This is how your logo will appear to clinics</p>
                  </div>
                </div>
              )}

              {/* Slogan */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <MessageSquare size={10} /> Slogan / Tagline
                </label>
                <input
                  type="text"
                  value={slogan}
                  onChange={e => setSlogan(e.target.value)}
                  placeholder="e.g. Trusted supplies for every clinic"
                  maxLength={255}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
                />
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 px-1">{slogan.length}/255 characters</p>
              </div>

              {/* Website */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Link size={10} /> Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                <button
                  type="submit"
                  disabled={appearanceSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-60"
                >
                  {appearanceSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Appearance
                </button>
              </div>
            </div>
          </div>

          {/* Preview Card */}
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm sticky top-4">
              <h3 className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Profile Preview</h3>
              <div className="flex flex-col items-center text-center gap-3">
                {logoUrl && isImageSrc(logoUrl) ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-20 h-20 object-contain rounded-2xl border-2 bg-white dark:bg-zinc-800"
                    style={{ borderColor: primaryColor }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : logoUrl ? (
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center border-2 text-4xl"
                    style={{ backgroundColor: `${primaryColor}1A`, borderColor: primaryColor }}
                  >
                    {logoUrl}
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center border-2"
                    style={{ backgroundColor: `${primaryColor}1A`, borderColor: primaryColor }}
                  >
                    <Building2 size={32} style={{ color: primaryColor }} />
                  </div>
                )}
                <div>
                  <p className="font-black text-sm" style={{ color: secondaryColor }}>{localName || supplier?.name || 'Your Business'}</p>
                  {slogan && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 italic">"{slogan}"</p>}
                  {(localCategory || supplier?.category) && (
                    <span
                      className="inline-block mt-2 text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}
                    >
                      {localCategory || supplier?.category}
                    </span>
                  )}
                  {website && (
                    <p className="text-[10px] mt-2 truncate" style={{ color: primaryColor }}>{website}</p>
                  )}
                </div>

                {/* Color swatches strip */}
                <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-zinc-800 w-full justify-center">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 shadow" style={{ backgroundColor: primaryColor }} title={`Primary ${primaryColor}`} />
                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 shadow" style={{ backgroundColor: secondaryColor }} title={`Secondary ${secondaryColor}`} />
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Brand colors</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── Treasury ──────────────────────────────────────────────────────── */}
      {activeTab === 'treasury' && supplier && (
        <div className="animate-in slide-in-from-bottom-4">
          <SupplierWallet supplier={{ id: supplier.id, name: supplier.name, currency: supplier.currency }} />
        </div>
      )}

      {/* ── Verification ──────────────────────────────────────────────────── */}
      {activeTab === 'verification' && supplier && (
        <div className="animate-in slide-in-from-bottom-4">
          <VerificationPanel entity="supplier" entityId={supplier.id} />
        </div>
      )}
    </div>
  );
};

export default SupplierManagementView;

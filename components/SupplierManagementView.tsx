import React, { useState } from 'react';
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
} from 'lucide-react';
import SupplierBranchesView from './SupplierBranchesView';
import SupplierEmployeeListView from './SupplierEmployeeListView';
import SupplierBillingView from './SupplierBillingView';
import SupplierWallet from './SupplierWallet';
import { useAuth } from '../contexts/AuthContext';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';
import { suppliersAPI } from '../services/modules/suppliers.api';
import { toast } from '../services/utils/toast';

type Tab = 'identity' | 'personnel' | 'branches' | 'subscription' | 'treasury';

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
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const supplier = user?.supplier;
  const [localCurrency, setLocalCurrency] = useState(supplier?.currency || 'KES');
  const [localCategory, setLocalCategory] = useState(supplier?.category || '');

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supplier?.id) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await suppliersAPI.update(Number(supplier.id), {
        name: fd.get('name') as string,
        contactEmail: fd.get('contactEmail') as string,
        contactPhone: fd.get('contactPhone') as string,
        address: fd.get('address') as string,
        category: localCategory,
        currency: localCurrency,
      } as any);
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
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'treasury',     label: 'Treasury',     icon: Wallet     },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="page-header mb-1">Supplier Management</h1>
          <p className="page-subheader">
            Configuration panel for{' '}
            <span className="text-pine dark:text-zinc-300">{supplier?.name || 'your supplier account'}</span>
          </p>
        </div>

        {/* Tab nav — identical to ClinicManagementView style */}
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-lg overflow-x-auto">
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
      </header>

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      {activeTab === 'identity' && (
        <form onSubmit={handleProfileSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">

          {/* Main form */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 pb-4">
                <div className="p-2 bg-seafoam text-white rounded-xl shadow-lg"><Globe size={20} /></div>
                <h2 className="section-header">Business Identity</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Business Name</label>
                  <input
                    name="name"
                    defaultValue={supplier?.name}
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Category</label>
                  <select
                    value={localCategory}
                    onChange={e => setLocalCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                  >
                    <option value="">Select category…</option>
                    {SUPPLIER_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Contact Email</label>
                  <input
                    name="contactEmail"
                    type="email"
                    defaultValue={supplier?.contactEmail}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Contact Phone</label>
                  <input
                    name="contactPhone"
                    type="tel"
                    defaultValue={supplier?.contactPhone}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Address</label>
                  <input
                    name="address"
                    defaultValue={supplier?.address}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Default Currency</label>
                  <select
                    value={localCurrency}
                    onChange={e => setLocalCurrency(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
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
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4 sticky top-24">
              <h3 className="section-header">Account Snapshot</h3>

              {/* Mini brand card */}
              <div className="p-5 rounded-xl border border-seafoam/20 bg-pine/5 dark:bg-pine/10 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-seafoam/5 rotate-12"><Building2 size={80} /></div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-pine flex items-center justify-center text-white font-black text-xl shadow-lg flex-shrink-0">
                    {(supplier?.name || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-tight leading-tight">
                      {supplier?.name || '—'}
                    </p>
                    <p className="text-[9px] font-bold text-seafoam uppercase tracking-widest mt-0.5">
                      {localCategory || supplier?.category || 'Uncategorized'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Rating',    value: `${(supplier?.rating ?? 0).toFixed(1)} / 5`, icon: Star,         color: 'text-amber-500' },
                  { label: 'Status',    value: supplier?.isActive ? 'Active' : 'Inactive',   icon: supplier?.isActive ? CheckCircle2 : XCircle, color: supplier?.isActive ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Branches',  value: branches.length,                              icon: GitBranch,    color: 'text-seafoam'  },
                  { label: 'Currency',  value: localCurrency,                                icon: TrendingUp,   color: 'text-pine dark:text-seafoam' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon size={11} className={s.color} />
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{s.label}</p>
                    </div>
                    <p className="font-black text-sm text-pine dark:text-zinc-100">{String(s.value)}</p>
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
      {activeTab === 'subscription' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-8">
            <SupplierBillingView />
          </div>
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm sticky top-24 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg"><CreditCard size={18} /></div>
                <h3 className="section-header">Billing Info</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Account',       value: supplier?.name          || '—' },
                  { label: 'Billing Email', value: supplier?.contactEmail  || '—' },
                  { label: 'Currency',      value: supplier?.currency      || 'KES' },
                ].map(i => (
                  <div key={i.label} className="flex justify-between items-center text-[10px]">
                    <span className="font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{i.label}</span>
                    <span className="font-bold text-pine dark:text-zinc-100 truncate max-w-[55%] text-right">{i.value}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 text-[9px] text-slate-400 dark:text-zinc-500 flex items-start gap-2">
                <Settings size={11} className="flex-shrink-0 mt-0.5" />
                Payments processed by Stripe. Use the billing portal to manage invoices and payment methods.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Treasury ──────────────────────────────────────────────────────── */}
      {activeTab === 'treasury' && supplier && (
        <div className="animate-in slide-in-from-bottom-4">
          <SupplierWallet supplier={{ id: supplier.id, name: supplier.name, currency: supplier.currency }} />
        </div>
      )}
    </div>
  );
};

export default SupplierManagementView;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers, Plus, Trash2, RefreshCw, Eye, Settings2,
  CheckCircle2, X, Save, Loader2, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import {
  subscriptionPackagesAPI,
  FEATURE_CATALOG,
  type SubscriptionPackagePlan,
  type BillingOption,
  type BillingOptionCycle,
  type PackageAudience,
} from '../../../services/modules/subscriptionPackages.api';
import { dialog } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';

type Tab = 'features' | 'limits';

const emptyDraft: Partial<SubscriptionPackagePlan> = {
  name: '',
  price: 0,
  billingCycle: 'MONTHLY',
  tier: 1,
  maxPatients: 500,
  maxStaff: 5,
  storageGb: 10,
  isActive: true,
  features: [],
};

const SubPackagesAdminPage: React.FC = () => {
  const [packages, setPackages] = useState<SubscriptionPackagePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('features');
  const [search, setSearch] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState<Partial<SubscriptionPackagePlan>>(emptyDraft);
  const [savingNew, setSavingNew] = useState(false);
  const [savingFeatureId, setSavingFeatureId] = useState<string | null>(null);

  const refresh = async (silent = false) => {
    silent ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const res = await subscriptionPackagesAPI.list();
      if (res.success && res.data?.packages) {
        setPackages(res.data.packages);
        if (!selectedId && res.data.packages.length) setSelectedId(res.data.packages[0].id);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const selected = useMemo(() => packages.find(p => p.id === selectedId) || null, [packages, selectedId]);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(p => p.name.toLowerCase().includes(q));
  }, [packages, search]);

  const isFeatureAttached = (feature: string) =>
    !!selected && (selected.features || []).includes(feature);

  const toggleFeature = async (feature: string) => {
    if (!selected) return;
    setSavingFeatureId(selected.id);
    try {
      const fn = isFeatureAttached(feature)
        ? subscriptionPackagesAPI.removeFeature
        : subscriptionPackagesAPI.addFeature;
      const res = await fn(selected.id, feature);
      if (res.success && res.data?.package) {
        setPackages(prev => prev.map(p => p.id === selected.id ? res.data!.package : p));
      }
    } finally {
      setSavingFeatureId(null);
    }
  };

  const removeCustomFeature = async (feature: string) => {
    if (!selected) return;
    const res = await subscriptionPackagesAPI.removeFeature(selected.id, feature);
    if (res.success && res.data?.package) {
      setPackages(prev => prev.map(p => p.id === selected.id ? res.data!.package : p));
    }
  };

  const addCustomFeature = async () => {
    if (!selected) return;
    const value = window.prompt('Custom feature label (e.g. "Priority onboarding")')?.trim();
    if (!value) return;
    const res = await subscriptionPackagesAPI.addFeature(selected.id, value);
    if (res.success && res.data?.package) {
      setPackages(prev => prev.map(p => p.id === selected.id ? res.data!.package : p));
    }
  };

  const saveLimits = async () => {
    if (!selected) return;
    const res = await subscriptionPackagesAPI.update(selected.id, {
      tier: selected.tier,
      maxPatients: selected.maxPatients,
      maxClients: selected.maxClients,
      maxStaff: selected.maxStaff,
      storageGb: selected.storageGb,
      price: selected.price,
      currency: selected.currency,
      billingCycle: selected.billingCycle,
      isActive: selected.isActive,
      name: selected.name,
      lipanaStaticLinkUrl: selected.lipanaStaticLinkUrl ?? null,
      featuredCycle: selected.featuredCycle ?? 'MONTHLY',
      audiences: (selected.audiences && selected.audiences.length > 0) ? selected.audiences : ['CLINIC'],
    });
    if (res.success && res.data?.package) {
      setPackages(prev => prev.map(p => p.id === selected.id ? res.data!.package : p));
    }
  };

  const updateSelectedField = (key: keyof SubscriptionPackagePlan, value: any) => {
    if (!selected) return;
    setPackages(prev => prev.map(p => p.id === selected.id ? { ...p, [key]: value } : p));
  };

  const createPackage = async () => {
    if (!draft.name || draft.price == null) return;
    setSavingNew(true);
    try {
      const res = await subscriptionPackagesAPI.create({
        name: draft.name!,
        price: Number(draft.price),
        billingCycle: (draft.billingCycle as any) || 'MONTHLY',
        tier: Number(draft.tier ?? 1),
        maxPatients: Number(draft.maxPatients ?? 500),
        maxStaff: Number(draft.maxStaff ?? 5),
        storageGb: Number(draft.storageGb ?? 10),
        isActive: draft.isActive ?? true,
        features: draft.features || [],
      });
      if (res.success && res.data?.package) {
        setPackages(prev => [...prev, res.data!.package]);
        setSelectedId(res.data!.package.id);
        setShowNewForm(false);
        setDraft(emptyDraft);
      }
    } finally {
      setSavingNew(false);
    }
  };

  const deletePackage = async (id: string) => {
    const pkg = packages.find(p => p.id === id);
    const ok = await dialog.confirmDelete({
      title: 'Delete Subscription Package',
      message: 'This will permanently remove the package. This action cannot be undone.',
      entityName: pkg?.name || `Package #${id}`,
    });
    if (!ok) return;
    const res = await subscriptionPackagesAPI.delete(id);
    if (res.success) {
      setPackages(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
    <AdminPage className="pb-20">
      <AdminPageHeader
        title="Plans"
        subtitle="Configure subscription plans · attach views and services"
        icon={Layers}
        actions={
          <>
            <button
              onClick={() => refresh(true)}
              disabled={isRefreshing}
              className="h-9 px-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center gap-2 text-seafoam hover:text-pine hover:border-seafoam/40 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''}/>
              <span className="text-[9px] font-black uppercase tracking-widest">{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => setShowNewForm(v => !v)}
              className="h-9 px-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl flex items-center gap-2 shadow-lg active:scale-95"
            >
              <Plus size={13}/>
              <span className="text-[9px] font-black uppercase tracking-widest">New Package</span>
            </button>
          </>
        }
      />

      {/* New package form */}
      {showNewForm && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Create new package</p>
            <button onClick={() => setShowNewForm(false)} className="text-slate-400 hover:text-pine"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Name">
              <input value={draft.name || ''} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={inputCls}/>
            </Field>
            <Field label="Price">
              <input type="number" value={Number(draft.price ?? 0)} onChange={e => setDraft(d => ({ ...d, price: Number(e.target.value) }))} className={inputCls}/>
            </Field>
            <Field label="Billing Cycle">
              <select value={draft.billingCycle || 'MONTHLY'} onChange={e => setDraft(d => ({ ...d, billingCycle: e.target.value as any }))} className={inputCls}>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </Field>
            <Field label="Tier">
              <input type="number" value={Number(draft.tier ?? 1)} onChange={e => setDraft(d => ({ ...d, tier: Number(e.target.value) }))} className={inputCls}/>
            </Field>
            <Field label="Max Patients">
              <input type="number" value={Number(draft.maxPatients ?? 500)} onChange={e => setDraft(d => ({ ...d, maxPatients: Number(e.target.value) }))} className={inputCls}/>
            </Field>
            <Field label="Max Clients">
              <input type="number" value={Number(draft.maxClients ?? 1000)} onChange={e => setDraft(d => ({ ...d, maxClients: Number(e.target.value) }))} className={inputCls}/>
            </Field>
            <Field label="Max Staff">
              <input type="number" value={Number(draft.maxStaff ?? 5)} onChange={e => setDraft(d => ({ ...d, maxStaff: Number(e.target.value) }))} className={inputCls}/>
            </Field>
            <Field label="Storage (GB)">
              <input type="number" value={Number(draft.storageGb ?? 10)} onChange={e => setDraft(d => ({ ...d, storageGb: Number(e.target.value) }))} className={inputCls}/>
            </Field>
            <Field label="Active">
              <select value={draft.isActive ? 'true' : 'false'} onChange={e => setDraft(d => ({ ...d, isActive: e.target.value === 'true' }))} className={inputCls}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end">
            <button
              onClick={createPackage}
              disabled={savingNew || !draft.name}
              className="h-10 px-5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {savingNew ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Packages tab strip — horizontal across the top. Replaces the
          left-rail card list so the detail panel uses the full width. */}
      <div className="space-y-3">
        {filteredPackages.length > 3 && (
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam"/>
            <input
              placeholder="Search packages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
            />
          </div>
        )}

        {isLoading ? (
          <div className="py-3"><LoadingSpinner message="Loading packages..." /></div>
        ) : filteredPackages.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No packages</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
            {filteredPackages.map(pkg => {
              const active = selectedId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedId(pkg.id)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
                    active
                      ? 'bg-seafoam/10 border-seafoam shadow-sm'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className={`text-xs font-black uppercase tracking-tight ${active ? 'text-pine dark:text-seafoam' : 'text-pine dark:text-zinc-100'}`}>
                    {pkg.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                    {pkg.currency || 'USD'} {Number(pkg.price).toLocaleString()}
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                    pkg.isActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'
                  }`}>
                    {pkg.isActive ? 'Active' : 'Inactive'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected package detail — full width */}
      <div>
        <main className="space-y-4">
          {!selected ? (
            <div className="py-32 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
              <p className="text-[11px] font-black text-slate-300 dark:text-zinc-600 uppercase tracking-[0.4em]">Select a package</p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{selected.name}</h2>
                  <p className="text-seafoam text-[10px] font-black uppercase tracking-widest mt-1">
                    Plan ID: {selected.id} · Tier {selected.tier}
                  </p>
                </div>
                <button
                  onClick={() => deletePackage(selected.id)}
                  className="px-3 py-2 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-500/20 flex items-center gap-2"
                >
                  <Trash2 size={12}/> Delete
                </button>
              </div>

              {/* Tabs */}
              <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
                {[
                  { id: 'features' as Tab, label: 'Views & Services', icon: Eye },
                  { id: 'limits' as Tab, label: 'Limits & Pricing', icon: Settings2 },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      tab === t.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-seafoam dark:text-zinc-500'
                    }`}
                  >
                    <t.icon size={12}/> {t.label}
                  </button>
                ))}
              </div>

              {tab === 'features' ? (
                <div className="space-y-6">
                  <FeatureBucket
                    title="Views"
                    catalog={FEATURE_CATALOG.views}
                    isAttached={isFeatureAttached}
                    onToggle={toggleFeature}
                    busy={savingFeatureId === selected.id}
                  />
                  <FeatureBucket
                    title="Services"
                    catalog={FEATURE_CATALOG.services}
                    isAttached={isFeatureAttached}
                    onToggle={toggleFeature}
                    busy={savingFeatureId === selected.id}
                  />

                  {/* Custom features (anything attached that isn't in the catalog) */}
                  <CustomFeatures
                    selected={selected}
                    onAdd={addCustomFeature}
                    onRemove={removeCustomFeature}
                  />
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                  {/* Audience chips — which account types see this package.
                      At least one is required. */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Offered to</p>
                    <div className="flex flex-wrap gap-2">
                      {(['CLINIC', 'SUPPLIER', 'FREELANCER'] as PackageAudience[]).map((aud) => {
                        const list = (selected.audiences && selected.audiences.length > 0) ? selected.audiences : ['CLINIC'] as PackageAudience[];
                        const isOn = list.includes(aud);
                        return (
                          <button
                            key={aud}
                            type="button"
                            onClick={() => {
                              const next = isOn ? list.filter((a) => a !== aud) : [...list, aud];
                              // Always keep at least one — block toggling off
                              // the last remaining audience.
                              if (next.length === 0) return;
                              updateSelectedField('audiences', next as any);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                              isOn
                                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine dark:border-zinc-100'
                                : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-pine dark:hover:border-seafoam'
                            }`}
                          >
                            {aud}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Only the chosen audiences see this package on their billing screen.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="Name">
                      <input value={selected.name} onChange={e => updateSelectedField('name', e.target.value)} className={inputCls}/>
                    </Field>
                    <Field label="Price">
                      <input type="number" value={selected.price} onChange={e => updateSelectedField('price', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Currency">
                      <select value={selected.currency || 'USD'} onChange={e => updateSelectedField('currency', e.target.value)} className={inputCls}>
                        {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Billing Cycle">
                      <select value={selected.billingCycle} onChange={e => updateSelectedField('billingCycle', e.target.value)} className={inputCls}>
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                    </Field>
                    <Field label="Tier">
                      <input type="number" value={selected.tier} onChange={e => updateSelectedField('tier', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Max Patients">
                      <input type="number" value={selected.maxPatients} onChange={e => updateSelectedField('maxPatients', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Max Clients">
                      <input type="number" value={selected.maxClients ?? 1000} onChange={e => updateSelectedField('maxClients', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Max Staff">
                      <input type="number" value={selected.maxStaff} onChange={e => updateSelectedField('maxStaff', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Storage (GB)">
                      <input type="number" value={selected.storageGb} onChange={e => updateSelectedField('storageGb', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Active">
                      <select value={selected.isActive ? 'true' : 'false'} onChange={e => updateSelectedField('isActive', e.target.value === 'true')} className={inputCls}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </Field>
                    <Field label="Featured cycle (customer default)">
                      <select
                        value={(selected.featuredCycle ?? 'MONTHLY') as string}
                        onChange={(e) => updateSelectedField('featuredCycle', e.target.value as any)}
                        className={inputCls}
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly (3 mo)</option>
                        <option value="SEMIANNUAL">6 Months</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                    </Field>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800">
                        <input
                          type="checkbox"
                          checked={!!selected.lipanaStaticLinkUrl}
                          onChange={(e) => updateSelectedField('lipanaStaticLinkUrl', e.target.checked ? (selected.lipanaStaticLinkUrl || '') : null)}
                          className="mt-0.5 accent-pine"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-pine dark:text-zinc-100">Add a custom Lipana payment link</p>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                            Optional. The in-app Pay button doesn't need this — it runs Lipana STK directly. Set a link only when you want a shareable Lipana hosted page (marketing, WhatsApp, walk-in sales).
                          </p>
                        </div>
                      </label>
                      {selected.lipanaStaticLinkUrl !== null && selected.lipanaStaticLinkUrl !== undefined && (
                        <div className="mt-2">
                          <input
                            type="url"
                            placeholder="https://lipana.dev/pay/vethub-pro"
                            value={selected.lipanaStaticLinkUrl ?? ''}
                            onChange={e => updateSelectedField('lipanaStaticLinkUrl', e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={saveLimits}
                      className="h-10 px-5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-2"
                    >
                      <Save size={12}/> Save Changes
                    </button>
                  </div>

                  {/* ── Billing Options (per-cycle pricing) ─────────────── */}
                  <div className="pt-6 mt-2 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                    <div>
                      <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Billing Options</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        One row per cycle. Each has its own price, discount %, and Lipana payment link.
                      </p>
                    </div>
                    <BillingOptionsEditor
                      pkg={selected}
                      onSaved={(updatedOption) => {
                        const next: BillingOption[] = [...(selected.billingOptions || [])];
                        const idx = next.findIndex((o) => o.cycle === updatedOption.cycle);
                        if (idx >= 0) next[idx] = updatedOption;
                        else next.push(updatedOption);
                        next.sort((a, b) => a.sortOrder - b.sortOrder);
                        updateSelectedField('billingOptions', next as any);
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AdminPage>
  );
};

const inputCls = 'w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20';

// ISO 4217 codes we currently bill in. Keep the most-used local + regional
// currencies up top so the admin doesn't scroll.
const CURRENCY_OPTIONS = ['USD', 'KES', 'NGN', 'GHS', 'ZAR', 'EUR', 'GBP'];

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    {children}
  </div>
);

interface FeatureBucketProps {
  title: string;
  catalog: string[];
  isAttached: (f: string) => boolean;
  onToggle: (f: string) => void;
  busy: boolean;
}

const FeatureBucket: React.FC<FeatureBucketProps> = ({ title, catalog, isAttached, onToggle, busy }) => {
  const [expanded, setExpanded] = useState(true);
  const attachedCount = catalog.filter(isAttached).length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <div>
          <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{title}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {attachedCount} of {catalog.length} attached
          </p>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
      </button>
      {expanded && (
        <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {catalog.map(f => {
            const on = isAttached(f);
            return (
              <button
                key={f}
                onClick={() => onToggle(f)}
                disabled={busy}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition-all ${
                  on
                    ? 'bg-seafoam/5 border-seafoam text-pine dark:text-zinc-100'
                    : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-tight truncate">{f}</span>
                {on && <CheckCircle2 size={14} className="text-seafoam shrink-0"/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CustomFeatures: React.FC<{ selected: SubscriptionPackagePlan; onAdd: () => void; onRemove: (f: string) => void }> = ({ selected, onAdd, onRemove }) => {
  const allCatalog = new Set([...FEATURE_CATALOG.views, ...FEATURE_CATALOG.services]);
  const custom = (selected.features || []).filter(f => !allCatalog.has(f));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Custom Features</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Free-form labels not in the catalog
          </p>
        </div>
        <button
          onClick={onAdd}
          className="h-9 px-4 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md active:scale-95"
        >
          <Plus size={12}/> Add
        </button>
      </div>
      {custom.length === 0 ? (
        <p className="text-[10px] font-black text-slate-300 dark:text-zinc-600 uppercase tracking-widest py-4 text-center">No custom features</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {custom.map(f => (
            <span key={f} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-100 text-[10px] font-black uppercase tracking-tight">
              {f}
              <button onClick={() => onRemove(f)} className="text-slate-400 hover:text-red-500"><X size={10}/></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Billing Options Editor ───────────────────────────────────────────────────

const CYCLES: { value: BillingOptionCycle; label: string }[] = [
  { value: 'MONTHLY',    label: 'Monthly' },
  { value: 'QUARTERLY',  label: 'Quarterly (3 mo)' },
  { value: 'SEMIANNUAL', label: '6 Months' },
  { value: 'YEARLY',     label: 'Yearly' },
];

interface BillingOptionsEditorProps {
  pkg: SubscriptionPackagePlan;
  onSaved: (option: BillingOption) => void;
}

const BillingOptionsEditor: React.FC<BillingOptionsEditorProps> = ({ pkg, onSaved }) => {
  const options = pkg.billingOptions || [];

  return (
    <div className="space-y-2">
      {CYCLES.map((c) => {
        const existing = options.find((o) => o.cycle === c.value);
        return (
          <BillingOptionRow
            key={c.value}
            packageId={pkg.id}
            cycleLabel={c.label}
            cycle={c.value}
            existing={existing}
            defaultCurrency={pkg.currency}
            onSaved={onSaved}
          />
        );
      })}
    </div>
  );
};

interface BillingOptionRowProps {
  packageId: string;
  cycleLabel: string;
  cycle: BillingOptionCycle;
  existing?: BillingOption;
  defaultCurrency: string;
  onSaved: (option: BillingOption) => void;
}

const BillingOptionRow: React.FC<BillingOptionRowProps> = ({ packageId, cycleLabel, cycle, existing, defaultCurrency, onSaved }) => {
  const [price, setPrice] = useState<string>(existing ? String(existing.price) : '');
  const [discountPct, setDiscountPct] = useState<string>(existing ? String(existing.discountPct) : '');
  // Optional custom URL. Checkbox toggles visibility; default off so admins
  // don't have to think about it. URL is not used for payment — it's only
  // for shareable marketing pages.
  const [useUrl, setUseUrl] = useState<boolean>(!!existing?.lipanaStaticLinkUrl);
  const [url, setUrl] = useState<string>(existing?.lipanaStaticLinkUrl ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const priceNum = Number(price);
    if (!(priceNum > 0)) return;
    setSaving(true);
    try {
      const res = await subscriptionPackagesAPI.upsertBillingOption(packageId, cycle, {
        price: priceNum,
        currency: defaultCurrency,
        discountPct: discountPct ? Number(discountPct) : 0,
        lipanaStaticLinkUrl: useUrl ? (url.trim() || null) : null,
        isActive: true,
      });
      if (res.success && res.data?.option) onSaved(res.data.option);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_100px_auto] gap-3 items-end">
        <Field label={cycleLabel}>
          <div className={`${inputCls} flex items-center justify-between`}>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">{cycle}</span>
            {existing && <span className="text-emerald-500 text-[10px] font-black">SET</span>}
          </div>
        </Field>
        <Field label={`Price (${defaultCurrency})`}>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 2600"
            className={inputCls}
          />
        </Field>
        <Field label="Discount %">
          <input
            type="number"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </Field>
        <button
          onClick={save}
          disabled={saving || !price}
          className="h-10 px-4 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 active:scale-95 flex items-center gap-1"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </div>
      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={useUrl}
          onChange={(e) => setUseUrl(e.target.checked)}
          className="accent-pine"
        />
        <span>Add a custom Lipana payment link for this cycle (optional, marketing only)</span>
      </label>
      {useUrl && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://lipana.dev/pay/..."
          className={inputCls}
        />
      )}
    </div>
  );
};

export default SubPackagesAdminPage;

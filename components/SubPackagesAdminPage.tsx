import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers, Plus, Trash2, RefreshCw, Eye, Settings2,
  CheckCircle2, X, Save, Loader2, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import {
  subscriptionPackagesAPI,
  FEATURE_CATALOG,
  type SubscriptionPackagePlan,
} from '../services/modules/subscriptionPackages.api';

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
      maxStaff: selected.maxStaff,
      storageGb: selected.storageGb,
      price: selected.price,
      billingCycle: selected.billingCycle,
      isActive: selected.isActive,
      name: selected.name,
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
    if (!window.confirm('Delete this subscription package? This cannot be undone.')) return;
    const res = await subscriptionPackagesAPI.delete(id);
    if (res.success) {
      setPackages(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase flex items-center gap-3">
            <Layers className="text-seafoam" size={32}/> Sub-Packages
          </h1>
          <p className="text-seafoam dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest mt-1">
            Configure subscription plans · attach views and services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh(true)}
            disabled={isRefreshing}
            className="h-10 px-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center gap-2 text-seafoam hover:text-pine hover:border-seafoam/40 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/>
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </span>
          </button>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="h-10 px-4 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl flex items-center gap-2 shadow-lg active:scale-95"
          >
            <Plus size={14}/>
            <span className="text-[10px] font-black uppercase tracking-widest">New Package</span>
          </button>
        </div>
      </header>

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left — package list */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam"/>
            <input
              placeholder="Search packages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin mr-2" size={16}/>
              <span className="text-[10px] font-black uppercase tracking-widest">Loading packages...</span>
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No packages</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPackages.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedId(pkg.id)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                    selectedId === pkg.id
                      ? 'bg-seafoam/5 border-seafoam shadow-md'
                      : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase truncate">{pkg.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Tier {pkg.tier} · {pkg.billingCycle}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-pine dark:text-zinc-100 font-black text-sm font-mono">{Number(pkg.price).toLocaleString()}</p>
                      <span className={`inline-block mt-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${pkg.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                        {pkg.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 mt-2">{(pkg.features || []).length} features</p>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Right — selected package detail */}
        <main className="lg:col-span-8 space-y-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="Name">
                      <input value={selected.name} onChange={e => updateSelectedField('name', e.target.value)} className={inputCls}/>
                    </Field>
                    <Field label="Price">
                      <input type="number" value={selected.price} onChange={e => updateSelectedField('price', Number(e.target.value))} className={inputCls}/>
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
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={saveLimits}
                      className="h-10 px-5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-2"
                    >
                      <Save size={12}/> Save Changes
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const inputCls = 'w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20';

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

export default SubPackagesAdminPage;

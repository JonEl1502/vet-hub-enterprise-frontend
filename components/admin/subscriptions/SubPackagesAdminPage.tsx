import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers, Plus, Trash2, RefreshCw, Eye, Settings2,
  CheckCircle2, X, Save, Loader2, ChevronDown, ChevronUp, Search,
  Building2, Truck, Users, Sprout,
  Sparkles,
} from 'lucide-react';
import {
  subscriptionPackagesAPI,
  FEATURE_CATALOG,
  CATALOG_FOR_AUDIENCE,
  type SubscriptionPackagePlan,
  type BillingOption,
  type BillingOptionCycle,
  type PackageAudience,
  type Region,
} from '../../../services/modules/subscriptionPackages.api';
import { featureCopy } from '../../../services/entitlements';
import { dialog } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';

type Tab = 'features' | 'limits';

const REGION_OPTIONS: Region[] = ['AFRICA', 'ASIA', 'LATAM', 'MIDDLE_EAST', 'EUROPE', 'OCEANIA', 'NORTH_AMERICA'];

const emptyDraft: Partial<SubscriptionPackagePlan> = {
  name: '',
  price: 0,
  billingCycle: 'MONTHLY',
  // REQUIRED by the API — it rejects a create without them ("name, region,
  // currency, amount (or price) and billingCycle are required"). They were
  // never in the create payload, so creating a package from this page always
  // 400'd; it only surfaced once every tab got a New button. They are also
  // half of the uniqueness key (name, region, currency).
  region: 'AFRICA',
  currency: 'KES',
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
  // Which audience's plans are being managed — Clinics (this component) vs
  // Suppliers (the embedded SupplierPackagesAdminPage).
  const [audience, setAudience] = useState<'clinic' | 'supplier' | 'client' | 'livestock' | 'addon'>('clinic');
  const [search, setSearch] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState<Partial<SubscriptionPackagePlan>>(emptyDraft);
  const [savingNew, setSavingNew] = useState(false);
  const [savingFeatureId, setSavingFeatureId] = useState<string | null>(null);

  // ONE catalog, ONE api (user, 2026-08-03; backend 113): every audience —
  // Clinic, Supplier, Client, Livestock — and the add-ons live in
  // `clinic_subscription_packages`, told apart by the `audiences` tag
  // (+ `isAddon`). The supplier-only table and its api adapter are gone;
  // supplier-facing billing endpoints read the same rows server-side.
  const isSupplier = audience === 'supplier';
  const api = subscriptionPackagesAPI;

  const refresh = async (silent = false) => {
    silent ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const res = await api.list();
      if (res.success && res.data?.packages) {
        setPackages(res.data.packages);
        // Selection is owned by the filtered-list effect below — picking the
        // UNFILTERED first row here could select a package the current tab
        // doesn't even show.
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Switching to/from the supplier tab changes the TABLE being read, so the
  // list must be refetched — not merely re-filtered.
  useEffect(() => { setSelectedId(null); refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isSupplier]);

  const selected = useMemo(() => packages.find(p => p.id === selectedId) || null, [packages, selectedId]);

  // Clinic, Client and Livestock plans all live in `clinic_subscription_packages`
  // and are told apart by their `audiences` tag, so the list is scoped to the
  // tab you're on. An untagged legacy row counts as CLINIC.
  const audienceTag = audience.toUpperCase() as PackageAudience;
  const activeCatalog = CATALOG_FOR_AUDIENCE[audienceTag] ?? FEATURE_CATALOG;
  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inAudience = packages.filter((p) => {
      // 113: supplier plans are ordinary audiences=['SUPPLIER'] rows — the
      // tab is a plain filter now, like every other audience.
      if (isSupplier) return (p.audiences || []).includes('SUPPLIER' as any) && Number(p.tier) !== 0 && !p.isAddon;
      // An ADD-ON is tier 0: it layers over any plan rather than sitting at a
      // position in the ladder, which is exactly why it does not belong in the
      // Clinic Plans list next to Manager / Pro / Enterprise.
      // Match on EITHER marker. A row where the two disagree is broken, and
      // hiding it from this tab would put it out of reach of the only screen
      // that can repair it.
      // 231 — tier 0 alone no longer means "add-on". The client ladder has a
      // real tier-0 BASE rung: `Free`, priced 0, which every client is on and
      // nobody can buy. Filing it under Add-ons would hide the one screen where
      // its entitlements are editable.
      //
      // ⚠️ The either-marker rule below is kept for everything else on purpose:
      // a row whose tier and isAddon DISAGREE is broken, and hiding it from
      // this tab would put it out of reach of the only screen that can repair
      // it. A free base plan is the one shape that is legitimately tier 0
      // without being an add-on.
      const isFreeBaseRung = Number(p.tier) === 0 && !p.isAddon && Number(p.price) === 0;
      if (audience === 'addon') return !isFreeBaseRung && (Number(p.tier) === 0 || !!p.isAddon);
      if (!isFreeBaseRung && (Number(p.tier) === 0 || p.isAddon)) return false;
      const tags = (p.audiences && p.audiences.length > 0) ? p.audiences : (['CLINIC'] as PackageAudience[]);
      return tags.includes(audienceTag);
    });
    if (!q) return inAudience;
    return inAudience.filter(p => p.name.toLowerCase().includes(q));
  }, [packages, search, audienceTag, audience, isSupplier]);

  // No dead "select a package" state (user, 2026-08-03): when the tab's list
  // arrives, open the first package's editor — and SELF-HEAL a selection that
  // isn't in this tab's list (tab switches race the refetch: the first version
  // of this effect grabbed an id from the OUTGOING tab's table, which then
  // matched nothing and blanked the editor — user's screenshot, same day).
  useEffect(() => {
    // Add-ons are CARDS, not an always-open editor (user, 2026-08-03) — the
    // editor only opens from a card's menu there.
    if (audience === 'addon') return;
    if (filteredPackages.length === 0) return;
    if (selectedId == null || !filteredPackages.some(p => p.id === selectedId)) {
      setSelectedId(filteredPackages[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPackages, selectedId, audience]);
  useEffect(() => { if (audience === 'addon') setSelectedId(null); }, [audience]);

  // Persist a partial change straight from an add-on card (audiences, active).
  const patchPackage = async (id: string, patch: any) => {
    try {
      const res = await api.update(id, patch);
      if (res.success && res.data?.package) {
        setPackages(prev => prev.map(p => p.id === id ? res.data!.package : p));
      }
    } catch { /* api client surfaces the error */ }
  };

  // Catalog toggles operate on the GATING array (featureKeys) — what the
  // access gate actually reads. Custom bullets stay in `features` (display).
  const isFeatureAttached = (feature: string) =>
    !!selected && (selected.featureKeys || []).includes(feature);

  const toggleFeature = async (feature: string) => {
    if (!selected) return;
    setSavingFeatureId(selected.id);
    try {
      const fn = isFeatureAttached(feature)
        ? api.removeFeature
        : api.addFeature;
      const res = await fn(selected.id, feature);
      if (res.success && res.data?.package) {
        setPackages(prev => prev.map(p => p.id === selected.id ? res.data!.package : p));
      }
    } finally {
      setSavingFeatureId(null);
    }
  };

  // Custom bullets are display-only → edit the `features` array directly (NOT
  // featureKeys, which addFeature/removeFeature now target for gating).
  const removeCustomFeature = async (feature: string) => {
    if (!selected) return;
    const next = (selected.features || []).filter((f) => f !== feature);
    const res = await api.update(selected.id, { features: next } as any);
    if (res.success && res.data?.package) {
      setPackages(prev => prev.map(p => p.id === selected.id ? res.data!.package : p));
    }
  };

  const addCustomFeature = async () => {
    if (!selected) return;
    const value = window.prompt('Custom feature label (e.g. "Priority onboarding")')?.trim();
    if (!value) return;
    const next = [...(selected.features || []), value];
    const res = await api.update(selected.id, { features: next } as any);
    if (res.success && res.data?.package) {
      setPackages(prev => prev.map(p => p.id === selected.id ? res.data!.package : p));
    }
  };

  const saveLimits = async () => {
    if (!selected) return;
    const res = await api.update(selected.id, {
      tier: selected.tier,
      maxPatients: selected.maxPatients,
      maxClients: selected.maxClients,
      maxStaff: selected.maxStaff,
      maxBranches: selected.maxBranches ?? 0,
      maxFarms: selected.maxFarms ?? 0,
      isAddon: selected.isAddon ?? false,
      storageGb: selected.storageGb,
      price: selected.price,
      currency: selected.currency,
      billingCycle: selected.billingCycle,
      isActive: selected.isActive,
      name: selected.name,
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
      const base = {
        name: draft.name!,
        price: Number(draft.price),
        region: (draft.region || 'AFRICA') as Region,
        currency: draft.currency || (isSupplier ? 'USD' : 'KES'),
        billingCycle: (draft.billingCycle as any) || 'MONTHLY',
        // An add-on has no rung on the ladder, so it sits at tier 0 — but tier is
        // only how this LIST tells them apart. Entitlements resolve the base plan
        // by `isAddon`, so it has to be set here too. Without it a new add-on is
        // a tier-0 BASE plan: subscribing to it SUPERSEDES the clinic's real plan
        // and drops them to the add-on's handful of keys.
        tier: audience === 'addon' ? 0 : Number(draft.tier ?? 1),
        isAddon: audience === 'addon',
        maxStaff: Number(draft.maxStaff ?? 5),
        storageGb: Number(draft.storageGb ?? 10),
        isActive: draft.isActive ?? true,
        features: draft.features || [],
      };
      const res = await api.create({
        ...base,
        // Clinic-only caps zero out on supplier rows.
        maxPatients: isSupplier ? 0 : Number(draft.maxPatients ?? 500),
        // Tag the new plan with the tab it was created on, so it lists under
        // that audience and only that audience's billing screen offers it.
        // Add-ons are clinic-audience rows distinguished by tier 0.
        audiences: [audience === 'addon' ? 'CLINIC' : audienceTag],
      } as any);
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
    const res = await api.delete(id);
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
          (
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
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {audience === 'addon' ? 'New Add-on' : 'New Plan'}
                </span>
              </button>
            </>
          )
        }
      />

      {/* Audience tabs — filters over each package's `audiences` tag (§0f #5).
          Supplier is the one exception: its plans live in their own TABLE. */}
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
        {([
          ['clinic', 'Clinic Plans', Building2],
          ['supplier', 'Supplier Plans', Truck],
          ['client', 'Client Plans', Users],
          // "Farm Plans" (user, 2026-08-03): the buyer is a FARM business —
          // "Livestock" also names the clinic add-on, which read as the same
          // thing. Internal audience value stays LIVESTOCK (data unchanged).
          ['livestock', 'Farm Plans', Sprout],
          // Add-ons layer OVER a plan rather than replacing one, so they get
          // their own tab instead of sitting in the tier ladder.
          ['addon', 'Add-ons', Sparkles],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setAudience(key)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              audience === key ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
      {/* (user, 2026-08-03: "i dont want this") — the old amber "not a filter"
          disclaimer read as "this tab is broken". The tab creates and edits
          supplier packages exactly like the others; where they live is an
          implementation detail nobody at this screen needs shouted at them. */}

      {(
      <>
      {/* New package form */}
      {showNewForm && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
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
            <Field label="Region">
              <select value={draft.region || 'AFRICA'} onChange={e => setDraft(d => ({ ...d, region: e.target.value as Region }))} className={inputCls}>
                {REGION_OPTIONS.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              {/* Supplier plans have always been priced in USD — default to it. */}
              <select value={draft.currency || (isSupplier ? 'USD' : 'KES')} onChange={e => setDraft(d => ({ ...d, currency: e.target.value }))} className={inputCls}>
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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
            {/* Patients/clients caps are clinic concepts — hidden on the
                Supplier tab (the supplier payload never carried them). */}
            {!isSupplier && (
              <Field label="Max Patients">
                <input type="number" value={Number(draft.maxPatients ?? 500)} onChange={e => setDraft(d => ({ ...d, maxPatients: Number(e.target.value) }))} className={inputCls}/>
              </Field>
            )}
            {!isSupplier && (
              <Field label="Max Clients">
                <input type="number" value={Number(draft.maxClients ?? 1000)} onChange={e => setDraft(d => ({ ...d, maxClients: Number(e.target.value) }))} className={inputCls}/>
              </Field>
            )}
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
        ) : audience === 'addon' ? (
          /* ── Add-ons as CARDS (user, 2026-08-03): name/price/status + an
             "offer to" audience picker right on the card — attach the add-on
             to Clinic / Supplier / Client / Farm without opening an editor.
             The full key editor stays one click away via "Open editor". ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredPackages.map(pkg => {
              const auds = (pkg.audiences && pkg.audiences.length > 0 ? pkg.audiences : ['CLINIC']) as string[];
              return (
                <div key={pkg.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm space-y-3 ${selectedId === pkg.id ? 'border-seafoam' : 'border-slate-200 dark:border-zinc-800'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{pkg.name}</p>
                      <p className="text-[11px] font-black font-mono text-seafoam mt-0.5">{pkg.currency || 'KES'} {Number(pkg.price).toLocaleString()} <span className="text-slate-400 font-bold">/ {String((pkg as any).billingCycle || 'MONTHLY').toLowerCase()}</span></p>
                    </div>
                    <button
                      onClick={() => patchPackage(pkg.id, { isActive: !pkg.isActive })}
                      title={pkg.isActive ? 'Deactivate — stops being offered' : 'Activate'}
                      className={`shrink-0 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                        pkg.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'
                      }`}>
                      {pkg.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{(pkg.featureKeys || []).length} feature key{(pkg.featureKeys || []).length === 1 ? '' : 's'}</p>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Offer to</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['CLINIC', 'Clinic'], ['SUPPLIER', 'Supplier'], ['CLIENT', 'Client'], ['LIVESTOCK', 'Farm']] as [string, string][]).map(([aud, label]) => {
                        const on = auds.includes(aud);
                        return (
                          <button key={aud}
                            onClick={() => {
                              const next = on ? auds.filter(a => a !== aud) : [...auds, aud];
                              if (next.length === 0) return; // keep at least one
                              patchPackage(pkg.id, { audiences: next });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                              on ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine dark:border-zinc-100' : 'bg-white dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-pine'
                            }`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <button onClick={() => setSelectedId(selectedId === pkg.id ? null : pkg.id)}
                      className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam transition-all">
                      {selectedId === pkg.id ? 'Close editor' : 'Open editor'}
                    </button>
                    <button onClick={() => deletePackage(pkg.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
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
            // Add-on tab: the cards ARE the UI — no placeholder needed below.
            audience === 'addon' ? null : (
            <div className="py-32 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
              <p className="text-[11px] font-black text-slate-300 dark:text-zinc-600 uppercase tracking-[0.4em]">Select a package</p>
            </div>
            )
          ) : (
            <>
              {/* Detail header */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
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

              {/* WHO the plan is for — above the tabs, not inside one.
                  It lived under "Limits & Pricing", where it read as a pricing
                  setting; an audience is neither a limit nor a price, it is what
                  the package IS (user, 2026-08-23: *"offered to is not in
                  correct place"*). Up here it stays visible and editable
                  whichever tab you are working in. */}
                {!isSupplier && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Offered to</p>
                  <div className="flex flex-wrap gap-2">
                    {/* §0f #5: audiences ARE the source of truth — every
                        non-supplier audience is offerable (CLIENT and FARM
                        were missing, so a plan could sit on a tab no buyer
                        ever saw). Tabs are filters over this field. */}
                    {([
                      ['CLINIC', 'Clinic'],
                      ['FREELANCER', 'Freelancer'],
                      ['CLIENT', 'Client (pet owner)'],
                      ['LIVESTOCK', 'Farm (livestock)'],
                    ] as [PackageAudience, string][]).map(([aud, audLabel]) => {
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
                          {audLabel}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Only the chosen audiences see this package on their billing screen — and the tabs above filter by this same field, so admin placement and buyer visibility can never disagree.
                  </p>
                </div>
                )}

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
                    catalog={activeCatalog.views}
                    isAttached={isFeatureAttached}
                    onToggle={toggleFeature}
                    busy={savingFeatureId === selected.id}
                  />
                  <FeatureBucket
                    title="Capabilities"
                    catalog={activeCatalog.capabilities}
                    isAttached={isFeatureAttached}
                    onToggle={toggleFeature}
                    busy={savingFeatureId === selected.id}
                  />
                  <FeatureBucket
                    title="Services"
                    catalog={activeCatalog.services}
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
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
                  {/* Audience chips — which account types see this package.
                      At least one is required.
                      HIDDEN on the Supplier tab: a supplier package is supplier-only
                      by construction, so the control could only ever be set to what
                      the tab already decided, or set WRONG (cross-listing a supplier
                      plan onto clinic billing screens). `createPackage` stamps the
                      audience from the tab, so nothing is lost by not showing it. */}

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
                        <option value="BIENNIAL">2 Years</option>
                        <option value="TRIENNIAL">3 Years</option>
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
                    <Field label="Max Branches">
                      <input type="number" value={selected.maxBranches ?? 0} onChange={e => updateSelectedField('maxBranches', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    {/* 231 — 0 = UNLIMITED, the same convention as branches.
                        It only bites on a plan that also carries
                        `livestock:farms`; without that key the plan holds no
                        farms at all, which is what lets 0 keep meaning
                        "no limit" instead of "none". */}
                    <Field label="Max Farms (0 = unlimited)">
                      <input type="number" value={selected.maxFarms ?? 0} onChange={e => updateSelectedField('maxFarms', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Storage (GB)">
                      <input type="number" value={selected.storageGb} onChange={e => updateSelectedField('storageGb', Number(e.target.value))} className={inputCls}/>
                    </Field>
                    <Field label="Add-on">
                      {/* Flipping this moves the row between the Clinic Plans and
                          Add-ons tabs, so tier has to follow: an add-on has no rung
                          on the ladder (0), and a base plan needs a real one. */}
                      <select
                        value={selected.isAddon ? 'true' : 'false'}
                        onChange={e => {
                          const addon = e.target.value === 'true';
                          updateSelectedField('isAddon', addon);
                          if (addon) updateSelectedField('tier', 0);
                          else if (Number(selected.tier) === 0) updateSelectedField('tier', 1);
                        }}
                        className={inputCls}
                      >
                        <option value="false">Base plan</option>
                        <option value="true">Add-on (layers over a plan)</option>
                      </select>
                      {selected.isAddon && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          Grants its keys ON TOP of the clinic's plan. It never replaces one.
                        </p>
                      )}
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
                        One row per cycle — its own price and discount %.
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
      </>
      )}
    </AdminPage>
  );
};

// Denser by ~30% (2026-07-29, user): the create form and the editor pushed the
// package list and the tab bar off screen, so picking a plan meant scrolling up
// and down. Same class drives both, so shrinking here shrinks the whole page.
const inputCls = 'w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20';

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
                <span className="min-w-0">
                  {/* §0f #6: the human label leads; the raw key is secondary.
                      Reading 32 raw keys is how a plan ends up 0-of-32 unnoticed. */}
                  <span className="block text-[11px] font-black tracking-tight truncate">{featureCopy(f.toLowerCase()).label}</span>
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{f}</span>
                </span>
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
  // Union of EVERY audience's catalog — a key from any of them is a known key,
  // so only genuinely hand-written bullets show up as "custom".
  const allCatalog = new Set(Object.values(CATALOG_FOR_AUDIENCE).flatMap(c => [...c.views, ...c.capabilities, ...c.services]));
  const custom = (selected.features || []).filter(f => !allCatalog.has(f));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
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
  // 217 — multi-year prepay presets (user, 2026-08-22).
  { value: 'BIENNIAL',   label: '2 Years' },
  { value: 'TRIENNIAL',  label: '3 Years' },
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
    </div>
  );
};

export default SubPackagesAdminPage;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, RefreshCw, Truck, Package as PackageIcon,
  Eye, EyeOff, Layers, GripVertical,
} from 'lucide-react';
import {
  supplierSubscriptionPackagesAPI as api,
  type SupplierPackage,
  type CreateSupplierPackagePayload,
  type Region,
} from '../../../services/modules/supplierSubscriptionPackages.api';
import { toast } from '../../../services/utils/toast';

const REGIONS: Region[] = ['AFRICA', 'ASIA', 'LATAM', 'MIDDLE_EAST', 'EUROPE', 'OCEANIA', 'NORTH_AMERICA'];
const CURRENCIES = ['USD', 'KES', 'EUR', 'GBP', 'NGN', 'ZAR', 'TZS', 'UGX', 'RWF', 'GHS', 'INR', 'AED'];

type FormState = {
  name: string;
  region: Region;
  currency: string;
  price: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  tier: string;
  maxStaff: string;
  storageGb: string;
  features: string[];
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  region: 'NORTH_AMERICA',
  currency: 'USD',
  price: '',
  billingCycle: 'MONTHLY',
  tier: '1',
  maxStaff: '5',
  storageGb: '10',
  features: [],
  isActive: true,
});

const fromPackage = (p: SupplierPackage): FormState => ({
  name: p.name,
  region: p.region,
  currency: p.currency,
  price: String(p.price ?? ''),
  billingCycle: p.billingCycle,
  tier: String(p.tier ?? 1),
  maxStaff: String(p.maxStaff ?? 5),
  storageGb: String(p.storageGb ?? 10),
  features: [...(p.features || [])],
  isActive: p.isActive,
});

const SupplierPackagesAdminPage: React.FC = () => {
  const [packages, setPackages] = useState<SupplierPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierPackage | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [featureDraft, setFeatureDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SupplierPackage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchPackages = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.list();
      if (res.success) setPackages(res.data.packages || []);
    } catch {
      toast.error('Failed to load supplier plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPackages(); }, []);

  const sorted = useMemo(
    () => [...packages].sort((a, b) => (a.tier - b.tier) || (a.price - b.price)),
    [packages],
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFeatureDraft('');
    setModalOpen(true);
  };

  const openEdit = (p: SupplierPackage) => {
    setEditing(p);
    setForm(fromPackage(p));
    setFeatureDraft('');
    setModalOpen(true);
  };

  const addFeature = () => {
    const f = featureDraft.trim();
    if (!f) return;
    if (form.features.includes(f)) { setFeatureDraft(''); return; }
    setForm(s => ({ ...s, features: [...s.features, f] }));
    setFeatureDraft('');
  };

  const removeFeature = (f: string) =>
    setForm(s => ({ ...s, features: s.features.filter(x => x !== f) }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Plan name is required');
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) return toast.error('Enter a valid price');

    const payload: CreateSupplierPackagePayload = {
      name: form.name.trim(),
      region: form.region,
      currency: form.currency,
      price,
      billingCycle: form.billingCycle,
      tier: parseInt(form.tier, 10) || 1,
      maxStaff: parseInt(form.maxStaff, 10) || 0,
      storageGb: parseInt(form.storageGb, 10) || 0,
      features: form.features,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editing) {
        const res = await api.update(editing.id, payload);
        if (res.success) {
          setPackages(prev => prev.map(p => p.id === editing.id ? res.data.package : p));
          toast.success('Plan updated');
        }
      } else {
        const res = await api.create(payload);
        if (res.success) {
          setPackages(prev => [...prev, res.data.package]);
          toast.success('Plan created');
        }
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: SupplierPackage) => {
    setTogglingId(p.id);
    try {
      const res = await api.update(p.id, { isActive: !p.isActive });
      if (res.success) setPackages(prev => prev.map(x => x.id === p.id ? res.data.package : x));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update plan');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete(deleteTarget.id);
      if (res.success) {
        setPackages(prev => prev.filter(p => p.id !== deleteTarget.id));
        toast.success('Plan deleted');
        setDeleteTarget(null);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete plan');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-[0.3em]">Billing · Suppliers</p>
          <h1 className="text-2xl sm:text-3xl font-black text-pine dark:text-zinc-100 tracking-tight flex items-center gap-2">
            <Truck size={24} className="text-seafoam" /> Supplier Plans
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">
            These are the plans suppliers see on their billing screen. Edits publish immediately (the supplier package cache is refreshed on save).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPackages(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={`text-slate-500 dark:text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
          >
            <Plus size={14} /> New Plan
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center shadow-sm">
          <PackageIcon size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">No supplier plans yet</p>
          <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-xs uppercase hover:opacity-90 transition-all">
            Create first plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(p => (
            <div
              key={p.id}
              className={`relative flex flex-col bg-white dark:bg-zinc-900 border-2 rounded-2xl shadow-sm overflow-hidden ${p.isActive ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-200/60 dark:border-zinc-800/60 opacity-70'}`}
            >
              <div className="h-1 w-full bg-seafoam" />
              <div className="p-5 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-pine dark:text-zinc-100 truncate">{p.name}</h3>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">T{p.tier}</span>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{p.region.replace('_', ' ')} · {p.billingCycle.toLowerCase()}</p>
                  </div>
                  <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${p.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500'}`}>
                    {p.isActive ? 'Live' : 'Hidden'}
                  </span>
                </div>

                <div>
                  <span className="text-2xl font-black text-pine dark:text-zinc-100">{p.currency} {Number(p.price).toLocaleString()}</span>
                  <span className="text-slate-400 text-xs ml-1">/mo</span>
                </div>

                <ul className="space-y-1.5 flex-1">
                  {(p.features || []).slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                      <Check size={12} className="text-seafoam shrink-0 mt-0.5" /> <span className="min-w-0">{f}</span>
                    </li>
                  ))}
                  {(p.features?.length || 0) === 0 && (
                    <li className="text-[11px] text-slate-300 dark:text-zinc-600 italic">No feature bullets</li>
                  )}
                  {(p.features?.length || 0) > 6 && (
                    <li className="text-[10px] font-bold text-slate-400">+{(p.features!.length - 6)} more</li>
                  )}
                </ul>

                <div className="flex gap-2 text-[10px] text-slate-400">
                  <span>{p.maxStaff === -1 ? 'Unlimited' : p.maxStaff} staff</span>
                  {p.storageGb > 0 && <span>· {p.storageGb} GB</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/30">
                <button
                  onClick={() => toggleActive(p)}
                  disabled={togglingId === p.id}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 transition-colors"
                >
                  {togglingId === p.id ? <RefreshCw size={13} className="animate-spin" /> : p.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                  {p.isActive ? 'Hide' : 'Show'}
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(p)} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                <Layers size={15} className="text-seafoam" /> {editing ? 'Edit Supplier Plan' : 'New Supplier Plan'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
                <X size={16} className="text-slate-500 dark:text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
              <div className="space-y-1">
                <label className="field-label">Plan name *</label>
                <input className="field-input" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Starter" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Price *</label>
                  <input className="field-input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(s => ({ ...s, price: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Currency</label>
                  <select className="field-select" value={form.currency} onChange={e => setForm(s => ({ ...s, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Billing cycle</label>
                  <select className="field-select" value={form.billingCycle} onChange={e => setForm(s => ({ ...s, billingCycle: e.target.value as any }))}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="field-label">Tier (order)</label>
                  <input className="field-input" type="number" min="1" value={form.tier} onChange={e => setForm(s => ({ ...s, tier: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Region</label>
                  <select className="field-select" value={form.region} onChange={e => setForm(s => ({ ...s, region: e.target.value as Region }))}>
                    {REGIONS.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="field-label">Max staff</label>
                  <input className="field-input" type="number" value={form.maxStaff} onChange={e => setForm(s => ({ ...s, maxStaff: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="field-label">Storage (GB)</label>
                <input className="field-input" type="number" min="0" value={form.storageGb} onChange={e => setForm(s => ({ ...s, storageGb: e.target.value }))} />
              </div>

              {/* Features */}
              <div className="space-y-1.5">
                <label className="field-label">Feature bullets</label>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 -mt-0.5">Shown on the supplier's plan card. Tip: include a line like "Up to 100 product listings" — the supplier dashboard reads the listing limit from it.</p>
                <div className="flex gap-2">
                  <input
                    className="field-input flex-1"
                    value={featureDraft}
                    onChange={e => setFeatureDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                    placeholder="e.g. Up to 100 product listings"
                  />
                  <button onClick={addFeature} className="px-3 rounded-xl bg-seafoam/10 text-seafoam hover:bg-seafoam/20 transition-all">
                    <Plus size={16} />
                  </button>
                </div>
                {form.features.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {form.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                        <GripVertical size={12} className="text-slate-300 dark:text-zinc-600 shrink-0" />
                        <span className="text-xs font-semibold text-pine dark:text-zinc-200 flex-1 min-w-0 truncate">{f}</span>
                        <button onClick={() => removeFeature(f)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Active */}
              <button
                type="button"
                onClick={() => setForm(s => ({ ...s, isActive: !s.isActive }))}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${form.isActive ? 'border-seafoam bg-seafoam/5 text-seafoam' : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-400'}`}
              >
                <span className="text-xs font-black uppercase tracking-widest">{form.isActive ? 'Live — visible to suppliers' : 'Hidden from suppliers'}</span>
                <span className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
              <button onClick={() => setModalOpen(false)} disabled={saving} className="px-5 py-2.5 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-60">
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                {editing ? 'Save changes' : 'Create plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Delete plan?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                <span className="font-bold text-pine dark:text-zinc-200">{deleteTarget.name}</span> will be removed. Plans with active subscribers can't be deleted — hide them instead.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-all">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600 transition-all disabled:opacity-60">
                {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPackagesAdminPage;

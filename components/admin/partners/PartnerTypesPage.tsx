import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, Award, ArrowLeft, Link2 } from 'lucide-react';
import { partnerTypeAPI, type PartnerType, type PartnerEntity } from '../../../services/modules/partnerType.api';
import { clinicsAPI, suppliersAPI, usersAPI, toast } from '../../../services';

interface Props { onBack?: () => void }

type EntityOption = { id: string; label: string };

const PartnerTypesPage: React.FC<Props> = ({ onBack }) => {
  const [types, setTypes] = useState<PartnerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // New-tier form
  const [draft, setDraft] = useState({ name: '', rank: '', color: '#1C7A5B' });
  const [creating, setCreating] = useState(false);

  // Assign form
  const [entity, setEntity] = useState<PartnerEntity>('clinic');
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [assignTypeId, setAssignTypeId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await partnerTypeAPI.list();
      if (res.success && res.data?.types) setTypes(res.data.types);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // Load the entity list whenever the entity type changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEntities(true);
      setEntityId('');
      try {
        let opts: EntityOption[] = [];
        if (entity === 'clinic') {
          const r = await clinicsAPI.getAll();
          opts = ((r as any)?.data?.clinics ?? []).map((c: any) => ({ id: String(c.id), label: c.name }));
        } else if (entity === 'supplier') {
          const r = await suppliersAPI.getAll();
          opts = ((r as any)?.data?.data ?? (r as any)?.data?.suppliers ?? []).map((s: any) => ({ id: String(s.id), label: s.name }));
        } else {
          const r = await usersAPI.adminList({ role: 'FREELANCER' });
          opts = ((r as any)?.data?.users ?? []).map((u: any) => ({ id: String(u.id), label: u.name || u.email }));
        }
        if (!cancelled) setEntityOptions(opts);
      } catch {
        if (!cancelled) setEntityOptions([]);
      } finally {
        if (!cancelled) setLoadingEntities(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entity]);

  const createType = async () => {
    if (!draft.name.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const res = await partnerTypeAPI.create({
        name: draft.name.trim(),
        rank: draft.rank ? Number(draft.rank) : 0,
        color: draft.color || null,
      });
      if (res.success) {
        toast.success(`Added ${res.data.type.name}`);
        setDraft({ name: '', rank: '', color: '#1C7A5B' });
        load();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add tier');
    } finally { setCreating(false); }
  };

  const saveType = async (t: PartnerType, patch: Partial<PartnerType>) => {
    setSavingId(t.id);
    try {
      const res = await partnerTypeAPI.update(t.id, patch as any);
      if (res.success) setTypes((list) => list.map((x) => (x.id === t.id ? res.data.type : x)));
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally { setSavingId(null); }
  };

  const removeType = async (t: PartnerType) => {
    if (!window.confirm(`Delete "${t.name}"? Tagged clinics/suppliers/freelancers will lose this tier.`)) return;
    setSavingId(t.id);
    try {
      const res = await partnerTypeAPI.remove(t.id);
      if (res.success) setTypes((list) => list.filter((x) => x.id !== t.id));
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally { setSavingId(null); }
  };

  const doAssign = async () => {
    if (!entityId) { toast.error('Pick a clinic/supplier/freelancer'); return; }
    setAssigning(true);
    try {
      const res = await partnerTypeAPI.assign({ entity, entityId, partnerTypeId: assignTypeId || null });
      if (res.success) {
        const tierName = assignTypeId ? (types.find((t) => t.id === assignTypeId)?.name ?? 'tier') : 'no tier';
        toast.success(`Set ${tierName} on the selected ${entity}`);
        load(); // refresh counts
      }
    } catch (e: any) {
      toast.error(e?.message || 'Assign failed');
    } finally { setAssigning(false); }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6 pb-20">
      <header className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        {onBack && (
          <button onClick={onBack} className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-seafoam transition-all shadow-lg active:scale-95 shrink-0">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="page-header flex items-center gap-2"><Award size={20} /> Partner Tiers</h1>
          <p className="page-subheader mt-1">Tier clinics, suppliers &amp; freelancers — tiered clinics feature on the landing page.</p>
        </div>
      </header>

      {/* Tiers table */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <h2 className="section-header">Tiers</h2>
        </header>
        <div className="p-4">
          {loading ? (
            <div className="py-10 text-center"><Loader2 size={20} className="animate-spin text-seafoam mx-auto" /></div>
          ) : (
            <div className="space-y-2">
              {types.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <input type="color" value={t.color || '#1C7A5B'} onChange={(e) => saveType(t, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" title="Tier colour" />
                  <input defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && saveType(t, { name: e.target.value })} className="field-input flex-1 min-w-0" />
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rank</span>
                    <input type="number" defaultValue={t.rank} onBlur={(e) => Number(e.target.value) !== t.rank && saveType(t, { rank: Number(e.target.value) })} className="field-input w-16 text-center" title="Lower = more important" />
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">
                    {t.counts ? `${t.counts.clinics}c · ${t.counts.suppliers}s · ${t.counts.users}f` : ''}
                  </span>
                  {savingId === t.id && <Loader2 size={14} className="animate-spin text-seafoam" />}
                  <button onClick={() => removeType(t)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20" title="Delete tier"><Trash2 size={14} /></button>
                </div>
              ))}
              {/* New tier row */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700">
                <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="New tier name (e.g. Tier 4)" className="field-input flex-1 min-w-0" />
                <input type="number" value={draft.rank} onChange={(e) => setDraft({ ...draft, rank: e.target.value })} placeholder="rank" className="field-input w-16 text-center" />
                <button onClick={createType} disabled={creating} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40">
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Assign */}
      <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
          <h2 className="section-header flex items-center gap-2"><Link2 size={14} /> Assign a tier</h2>
        </header>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="field-label">Type</label>
            <select value={entity} onChange={(e) => setEntity(e.target.value as PartnerEntity)} className="field-select">
              <option value="clinic">Clinic</option>
              <option value="supplier">Supplier</option>
              <option value="user">Freelancer</option>
            </select>
          </div>
          <div>
            <label className="field-label">{entity === 'user' ? 'Freelancer' : entity === 'supplier' ? 'Supplier' : 'Clinic'}</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} disabled={loadingEntities} className="field-select">
              <option value="">{loadingEntities ? 'Loading…' : 'Select…'}</option>
              {entityOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Tier</label>
            <select value={assignTypeId} onChange={(e) => setAssignTypeId(e.target.value)} className="field-select">
              <option value="">— None (clear) —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button onClick={doAssign} disabled={assigning || !entityId} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40 h-9">
            {assigning ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Assign
          </button>
        </div>
        <p className="px-4 pb-4 text-[11px] text-slate-400">Only FULL-verified, active clinics with a tier appear in the landing-page promotions.</p>
      </section>
    </div>
  );
};

export default PartnerTypesPage;

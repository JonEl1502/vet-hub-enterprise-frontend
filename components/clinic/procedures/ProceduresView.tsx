import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Plus, Loader2, Trash2, Pencil, Search, Zap, FlaskConical, Pill, Package, Stethoscope, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { procedureTemplatesAPI, ProcedureTemplate } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface Props {
  currency?: string;
  onOpenEditor: (templateId: string | null, seed?: 'spay-example') => void;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  SERVICE: { label: 'Services', icon: <Stethoscope size={10} /> },
  MEDICATION: { label: 'Meds', icon: <Pill size={10} /> },
  CONSUMABLE: { label: 'Consumables', icon: <Package size={10} /> },
  LAB: { label: 'Lab', icon: <FlaskConical size={10} /> },
  IMAGING: { label: 'Imaging', icon: <FlaskConical size={10} /> },
  FEE: { label: 'Fees', icon: <Zap size={10} /> },
};

/**
 * Procedures — clinical recipe templates (Billable Items wave). Each template
 * bundles fees, medications, consumables and recommended diagnostics with
 * dynamic pricing rules; it auto-applies when its trigger service is added
 * to a visit.
 */
const ProceduresView: React.FC<Props> = ({ currency = 'KES', onOpenEditor }) => {
  const [templates, setTemplates] = useState<ProcedureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await procedureTemplatesAPI.list(true);
      if (res.success && res.data?.templates) setTemplates(res.data.templates);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t => `${t.name} ${t.code ?? ''} ${t.categoryName ?? ''} ${t.species.join(' ')}`.toLowerCase().includes(q));
  }, [templates, search]);

  const toggleActive = async (t: ProcedureTemplate) => {
    setBusyId(t.id);
    try {
      const res = await procedureTemplatesAPI.update(t.id, { isActive: !t.isActive } as any);
      if (res.success) { toast.success(t.isActive ? 'Procedure deactivated' : 'Procedure activated'); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
    finally { setBusyId(null); }
  };

  const remove = async (t: ProcedureTemplate) => {
    if (!confirm(`Delete procedure "${t.name}"? If it was ever applied to a visit it is deactivated instead (history kept).`)) return;
    setBusyId(t.id);
    try {
      const res = await procedureTemplatesAPI.remove(t.id);
      if (res.success) { toast.success(res.data?.deactivated ? 'Deactivated (kept — it has past applications)' : 'Deleted'); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
    finally { setBusyId(null); }
  };

  const typeCounts = (t: ProcedureTemplate) => {
    const counts: Record<string, number> = {};
    for (const i of t.items) {
      const key = i.itemType === 'LAB' || i.itemType === 'IMAGING' ? 'LAB' : i.itemType;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-100 dark:bg-teal-900/20 flex items-center justify-center"><ClipboardList size={22} className="text-teal-600 dark:text-teal-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Procedures</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{templates.length} recipe{templates.length === 1 ? '' : 's'} · fees + products + diagnostics + pricing rules in one template</p>
          </div>
        </div>
        <button onClick={() => onOpenEditor(null)} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> New procedure</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search procedures…" className="field-input field-icon-left" />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading procedures..." />
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-10 text-center space-y-3">
          <ClipboardList size={32} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">{search ? 'No procedures match your search.' : 'No procedures yet.'}</p>
          {!search && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => onOpenEditor(null)} className="px-4 py-2 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Build from scratch</button>
              <button onClick={() => onOpenEditor(null, 'spay-example')} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200"><Wand2 size={12} /> Start from Spay example</button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => {
            const counts = typeCounts(t);
            return (
              <div key={t.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm space-y-3 ${t.isActive ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-200 dark:border-zinc-800 opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{t.name}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                      {t.code ? `${t.code} · ` : ''}{t.categoryName ?? 'Uncategorised'}{t.species.length ? ` · ${t.species.join(', ')}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(t)}
                    disabled={busyId === t.id}
                    className={`shrink-0 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${t.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}
                  >
                    {busyId === t.id ? <Loader2 size={10} className="animate-spin" /> : t.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(counts).map(([k, n]) => (
                    <span key={k} className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      {TYPE_META[k]?.icon} {n} {TYPE_META[k]?.label ?? k}
                    </span>
                  ))}
                  {t.pricingRules.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[8px] font-black uppercase tracking-wider text-amber-600">
                      <Zap size={10} /> {t.pricingRules.length} rule{t.pricingRules.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                {t.triggerServiceName && (
                  <p className="text-[9px] text-slate-400 font-medium">Auto-applies with <span className="font-black text-seafoam">{t.triggerServiceName}</span></p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Est. total</p>
                    <p className="text-base font-black text-pine dark:text-zinc-100">{currency} {t.estimatedTotal.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onOpenEditor(t.id)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-pine" title="Edit"><Pencil size={14} /></button>
                    <button onClick={() => remove(t)} disabled={busyId === t.id} className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50" title="Delete">
                      {busyId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProceduresView;

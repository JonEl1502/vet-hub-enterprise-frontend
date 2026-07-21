import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft, Loader2, Plus, Trash2, Search, X, Zap, ArrowUp, ArrowDown,
  Stethoscope, Pill, Package, FlaskConical, ScanLine, Coins, Check, ClipboardList, Calculator,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import {
  procedureTemplatesAPI, servicesAPI, categoriesAPI,
  ProcedureTemplatePayload, ProcedureItemPayload, ProcedurePricingRule,
  ProcedureStage, ProcItemType, ProcQtyBasis, ProcedurePreview,
} from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface Props {
  templateId: string | null;
  seed?: 'spay-example';
  currency?: string;
  onBack: () => void;
}

type Tab = 'details' | 'components' | 'rules' | 'workflow' | 'summary';

interface DraftItem extends ProcedureItemPayload {
  key: string;             // local list key
  name: string;            // display name (service/inventory/custom)
  unit?: string | null;
  stock?: number | null;
  basePrice: number;       // effective price when no override
}

interface Draft {
  name: string; description: string; code: string;
  categoryId: string; species: string[]; defaultDurationMin: string;
  triggerServiceId: string; stages: ProcedureStage[]; discount: string; isActive: boolean;
  items: DraftItem[]; pricingRules: ProcedurePricingRule[];
}

const DEFAULT_STAGES: ProcedureStage[] = [
  { key: 'consultation', label: 'Consultation' },
  { key: 'pre-op-lab', label: 'Pre-op Lab' },
  { key: 'premedication', label: 'Pre-medication' },
  { key: 'anaesthesia', label: 'Anaesthesia' },
  { key: 'surgery', label: 'Surgery' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'medications', label: 'Medications' },
  { key: 'discharge', label: 'Discharge' },
  { key: 'follow-up', label: 'Follow-up' },
];

const EMPTY: Draft = {
  name: '', description: '', code: '', categoryId: '', species: [], defaultDurationMin: '',
  triggerServiceId: '', stages: DEFAULT_STAGES, discount: '', isActive: true, items: [], pricingRules: [],
};

// Fee-only starter based on the vet collaborator's worked Spay example — no
// FK dependencies, so it works on any clinic; products get added from the
// clinic's own inventory afterwards.
const SPAY_SEED: Partial<Draft> = {
  name: 'Spay – Dog (Routine)',
  description: 'Routine ovariohysterectomy (spay) for female dogs. Includes anaesthesia, surgery, monitoring, medications and consumables.',
  species: ['Dog'],
  defaultDurationMin: '90',
  items: [
    { key: 's1', itemType: 'FEE', customName: 'Pre-anaesthesia check', name: 'Pre-anaesthesia check', stageKey: 'consultation', qtyBasis: 'FIXED', quantity: 1, priceOverride: 800, basePrice: 800, billable: true, deductStock: false, optional: false },
    { key: 's2', itemType: 'FEE', customName: 'Anaesthesia (induction & maintenance)', name: 'Anaesthesia (induction & maintenance)', stageKey: 'anaesthesia', qtyBasis: 'FIXED', quantity: 1, priceOverride: 2500, basePrice: 2500, billable: true, deductStock: false, optional: false },
    { key: 's3', itemType: 'FEE', customName: 'Spay surgery fee', name: 'Spay surgery fee', stageKey: 'surgery', qtyBasis: 'FIXED', quantity: 1, priceOverride: 5000, basePrice: 5000, billable: true, deductStock: false, optional: false },
    { key: 's4', itemType: 'FEE', customName: 'Recovery & monitoring', name: 'Recovery & monitoring', stageKey: 'recovery', qtyBasis: 'FIXED', quantity: 1, priceOverride: 1000, basePrice: 1000, billable: true, deductStock: false, optional: false },
  ] as DraftItem[],
  pricingRules: [
    { name: 'In heat', enabled: true, conditions: { inHeat: true }, effects: { feeAmount: 2000, label: 'Heat cycle surcharge' } },
    { name: 'Pregnant', enabled: true, conditions: { pregnant: true }, effects: { feeAmount: 3000, label: 'Pregnancy surcharge' } },
    { name: 'Large dog (>25kg)', enabled: true, conditions: { weightMinKg: 25 }, effects: { feeAmount: 1500, label: 'Weight adjustment' } },
  ],
};

const TYPE_STYLE: Record<ProcItemType, { chip: string; label: string; icon: React.ReactNode }> = {
  SERVICE:    { chip: 'bg-sky-500/10 text-sky-600 border-sky-500/20',       label: 'Service',    icon: <Stethoscope size={11} /> },
  MEDICATION: { chip: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: 'Medication', icon: <Pill size={11} /> },
  CONSUMABLE: { chip: 'bg-orange-500/10 text-orange-600 border-orange-500/20', label: 'Consumable', icon: <Package size={11} /> },
  LAB:        { chip: 'bg-violet-500/10 text-violet-600 border-violet-500/20', label: 'Lab',        icon: <FlaskConical size={11} /> },
  IMAGING:    { chip: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', label: 'Imaging',    icon: <ScanLine size={11} /> },
  FEE:        { chip: 'bg-amber-500/10 text-amber-600 border-amber-500/20',   label: 'Fee',        icon: <Coins size={11} /> },
};

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Reptile', 'Rodent', 'Livestock', 'Equine'];
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'stage';
let keyCounter = 0;
const nextKey = () => `k${++keyCounter}`;

const ProcedureEditorPage: React.FC<Props> = ({ templateId, seed, currency = 'KES', onBack }) => {
  const { inventory, ensureInventory } = useData() as any;
  // Inventory loads lazily per page — force it here so the medication/
  // consumable pickers aren't empty when Stock Manager wasn't visited yet.
  useEffect(() => { ensureInventory?.(); }, [ensureInventory]);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, ...(seed === 'spay-example' && !templateId ? SPAY_SEED : {}) } as Draft);
  const [tab, setTab] = useState<Tab>('details');
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(templateId);

  const [catalog, setCatalog] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Add-component picker state
  const [pickType, setPickType] = useState<ProcItemType>('SERVICE');
  const [pickSearch, setPickSearch] = useState('');
  const [pickFocused, setPickFocused] = useState(false);
  const [componentFilter, setComponentFilter] = useState<'ALL' | ProcItemType>('ALL');
  const [feeName, setFeeName] = useState('');
  const [feeConsultant, setFeeConsultant] = useState('');
  const [feeAmount, setFeeAmount] = useState('');

  // Example-patient tester (rules tab)
  const [testWeight, setTestWeight] = useState('');
  const [testFlags, setTestFlags] = useState<{ inHeat: boolean; pregnant: boolean; emergency: boolean; outOfHours: boolean }>({ inHeat: false, pregnant: false, emergency: false, outOfHours: false });
  const [testResult, setTestResult] = useState<ProcedurePreview | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    servicesAPI.catalog().then(setCatalog).catch(() => {});
    categoriesAPI.getAll().then((cats: any[]) => setCategories(cats.map(c => ({ id: String(c.id), name: c.name })))).catch(() => {});
  }, []);

  const loadTemplate = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await procedureTemplatesAPI.getById(id);
      if (res.success && res.data?.template) {
        const t = res.data.template;
        setDraft({
          name: t.name, description: t.description ?? '', code: t.code ?? '',
          categoryId: t.categoryId ?? '', species: t.species ?? [],
          defaultDurationMin: t.defaultDurationMin != null ? String(t.defaultDurationMin) : '',
          triggerServiceId: t.triggerServiceId ?? '',
          stages: (t.stages?.length ? t.stages : DEFAULT_STAGES),
          discount: t.discount ? String(t.discount) : '', isActive: t.isActive,
          items: t.items.map(i => ({
            key: nextKey(), itemType: i.itemType, serviceId: i.serviceId, inventoryItemId: i.inventoryItemId,
            customName: i.customName, stageKey: i.stageKey, qtyBasis: i.qtyBasis, quantity: i.quantity,
            priceOverride: i.priceOverride, billable: i.billable, deductStock: i.deductStock,
            optional: i.optional, consultantName: i.consultantName, sortOrder: i.sortOrder,
            name: i.name, unit: i.unit, stock: i.availableQuantity, basePrice: i.effectivePrice,
          })),
          pricingRules: t.pricingRules.map(r => ({ ...r })),
        });
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to load procedure'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (templateId) loadTemplate(templateId); }, [templateId, loadTemplate]);

  // ------------------------------------------------------------- pick sources
  // Browsable pickers: an empty query lists the first matches for the picked
  // type (LAB/IMAGING pre-filter by category keyword) so the list is never
  // blank before typing.
  const serviceMatches = useMemo(() => {
    if (pickType === 'MEDICATION' || pickType === 'CONSUMABLE' || pickType === 'FEE') return [];
    const q = pickSearch.trim().toLowerCase();
    const pool = catalog.filter((s: any) => {
      if (s.enabled === false) return false;
      const cat = String(s.categoryName || '').toLowerCase();
      if (pickType === 'LAB') return cat.includes('lab') || cat.includes('diagnost');
      if (pickType === 'IMAGING') return cat.includes('imag') || cat.includes('radiolog') || cat.includes('scan') || cat.includes('ultrasound') || cat.includes('xray') || cat.includes('x-ray');
      return true;
    });
    if (!q) return pool.slice(0, 8);
    return pool.filter((s: any) => `${s.name} ${s.categoryName}`.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, pickSearch, pickType]);

  const inventoryMatches = useMemo(() => {
    if (pickType !== 'MEDICATION' && pickType !== 'CONSUMABLE') return [];
    const q = pickSearch.trim().toLowerCase();
    if (!q) return inventory.slice(0, 8);
    return inventory.filter((i: any) => `${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q)).slice(0, 8);
  }, [inventory, pickSearch, pickType]);

  const addServiceItem = (s: any) => {
    setDraft(d => ({
      ...d,
      items: [...d.items, {
        key: nextKey(), itemType: pickType, serviceId: String(s.id), inventoryItemId: null, customName: null,
        stageKey: null, qtyBasis: 'FIXED' as ProcQtyBasis, quantity: 1, priceOverride: null,
        billable: true, deductStock: false, optional: pickType === 'LAB' || pickType === 'IMAGING',
        consultantName: null, name: s.name, unit: null, stock: null,
        basePrice: Number(s.priceEffective ?? s.defaultPrice ?? 0),
      }],
    }));
    setPickSearch('');
  };

  const addInventoryItem = (i: any) => {
    setDraft(d => ({
      ...d,
      items: [...d.items, {
        key: nextKey(), itemType: pickType, serviceId: null, inventoryItemId: String(i.id), customName: null,
        stageKey: null, qtyBasis: 'FIXED' as ProcQtyBasis, quantity: 1, priceOverride: null,
        billable: i.billable !== false, deductStock: true, optional: false, consultantName: null,
        name: i.name, unit: i.unit, stock: Number(i.quantity), basePrice: Number(i.price) || 0,
      }],
    }));
    setPickSearch('');
  };

  const addFeeItem = () => {
    if (!feeName.trim() && !feeConsultant.trim()) { toast.error('Give the fee a name (or consultant)'); return; }
    setDraft(d => ({
      ...d,
      items: [...d.items, {
        key: nextKey(), itemType: 'FEE', serviceId: null, inventoryItemId: null,
        customName: feeName.trim() || 'Consultant fee', stageKey: null, qtyBasis: 'FIXED' as ProcQtyBasis,
        quantity: 1, priceOverride: feeAmount !== '' ? Number(feeAmount) : 0, billable: true, deductStock: false,
        optional: false, consultantName: feeConsultant.trim() || null,
        name: feeName.trim() || 'Consultant fee', unit: null, stock: null, basePrice: feeAmount !== '' ? Number(feeAmount) : 0,
      }],
    }));
    setFeeName(''); setFeeConsultant(''); setFeeAmount('');
  };

  const patchItem = (key: string, patch: Partial<DraftItem>) =>
    setDraft(d => ({ ...d, items: d.items.map(i => i.key === key ? { ...i, ...patch } : i) }));
  const removeItem = (key: string) => setDraft(d => ({ ...d, items: d.items.filter(i => i.key !== key) }));

  // ------------------------------------------------------------------ totals
  const itemLinePrice = (i: DraftItem) => {
    if (i.billable === false) return 0;
    const unit = i.priceOverride != null ? Number(i.priceOverride) : i.basePrice;
    const qty = i.qtyBasis === 'PER_KG' ? 1 : Number(i.quantity ?? 1); // per-kg shown at ×1kg baseline
    return unit * qty;
  };
  const totals = useMemo(() => {
    const groups: Record<string, number> = {};
    let subtotal = 0;
    for (const i of draft.items) {
      if (i.optional) continue;
      const p = itemLinePrice(i);
      const g = i.itemType === 'LAB' || i.itemType === 'IMAGING' ? 'Lab & Imaging' : TYPE_STYLE[i.itemType].label + 's';
      groups[g] = (groups[g] ?? 0) + p;
      subtotal += p;
    }
    const discount = Number(draft.discount) || 0;
    return { groups, subtotal, discount, total: Math.max(0, subtotal - discount) };
  }, [draft.items, draft.discount]);

  const filteredItems = useMemo(() =>
    componentFilter === 'ALL' ? draft.items : draft.items.filter(i =>
      componentFilter === 'LAB' ? (i.itemType === 'LAB' || i.itemType === 'IMAGING') : i.itemType === componentFilter),
    [draft.items, componentFilter]);

  // ------------------------------------------------------------------- rules
  const patchRule = (idx: number, patch: Partial<ProcedurePricingRule>) =>
    setDraft(d => ({ ...d, pricingRules: d.pricingRules.map((r, i) => i === idx ? { ...r, ...patch } : r) }));
  const patchRuleCond = (idx: number, cond: Partial<ProcedurePricingRule['conditions']>) =>
    setDraft(d => ({ ...d, pricingRules: d.pricingRules.map((r, i) => i === idx ? { ...r, conditions: { ...r.conditions, ...cond } } : r) }));
  const patchRuleEff = (idx: number, eff: Partial<ProcedurePricingRule['effects']>) =>
    setDraft(d => ({ ...d, pricingRules: d.pricingRules.map((r, i) => i === idx ? { ...r, effects: { ...r.effects, ...eff } } : r) }));
  const addRule = () => setDraft(d => ({ ...d, pricingRules: [...d.pricingRules, { name: 'New rule', enabled: true, conditions: {}, effects: {} }] }));
  const removeRule = (idx: number) => setDraft(d => ({ ...d, pricingRules: d.pricingRules.filter((_, i) => i !== idx) }));

  const runTest = async () => {
    if (!savedId) { toast.error('Save the procedure first — the tester quotes the saved version'); return; }
    setTesting(true);
    try {
      const res = await procedureTemplatesAPI.preview(savedId, {
        weightKg: testWeight !== '' ? Number(testWeight) : undefined,
        flags: testFlags,
      });
      if (res.success && res.data?.preview) setTestResult(res.data.preview);
    } catch (e: any) { toast.error(e?.message || 'Preview failed'); }
    finally { setTesting(false); }
  };

  // ------------------------------------------------------------------ stages
  const addStage = () => setDraft(d => {
    const label = `Stage ${d.stages.length + 1}`;
    return { ...d, stages: [...d.stages, { key: `${slug(label)}-${d.stages.length + 1}`, label }] };
  });
  const renameStage = (idx: number, label: string) =>
    setDraft(d => ({ ...d, stages: d.stages.map((s, i) => i === idx ? { ...s, label } : s) }));
  const moveStage = (idx: number, dir: -1 | 1) => setDraft(d => {
    const stages = [...d.stages];
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return d;
    [stages[idx], stages[j]] = [stages[j], stages[idx]];
    return { ...d, stages };
  });
  const removeStage = (idx: number) => setDraft(d => {
    const dead = d.stages[idx];
    return {
      ...d,
      stages: d.stages.filter((_, i) => i !== idx),
      items: d.items.map(i => i.stageKey === dead.key ? { ...i, stageKey: null } : i),
    };
  });

  // -------------------------------------------------------------------- save
  const save = async (activate?: boolean) => {
    if (!draft.name.trim()) { toast.error('Procedure name is required'); setTab('details'); return; }
    if (!draft.items.length) { toast.error('Add at least one component'); setTab('components'); return; }
    setSaving(true);
    try {
      const payload: ProcedureTemplatePayload = {
        name: draft.name.trim(),
        description: draft.description || undefined,
        code: draft.code || undefined,
        categoryId: draft.categoryId || null,
        species: draft.species,
        defaultDurationMin: draft.defaultDurationMin !== '' ? Number(draft.defaultDurationMin) : null,
        triggerServiceId: draft.triggerServiceId || null,
        stages: draft.stages,
        discount: draft.discount !== '' ? Number(draft.discount) : 0,
        isActive: activate ?? draft.isActive,
        items: draft.items.map((i, idx) => ({
          itemType: i.itemType, serviceId: i.serviceId ?? null, inventoryItemId: i.inventoryItemId ?? null,
          customName: i.customName ?? null, stageKey: i.stageKey ?? null, qtyBasis: i.qtyBasis ?? 'FIXED',
          quantity: Number(i.quantity ?? 1), priceOverride: i.priceOverride != null ? Number(i.priceOverride) : null,
          billable: i.billable !== false, deductStock: i.deductStock !== false, optional: i.optional === true,
          consultantName: i.consultantName ?? null, sortOrder: idx,
        })),
        pricingRules: draft.pricingRules.map((r, idx) => ({ ...r, sortOrder: idx })),
      };
      const res = savedId
        ? await procedureTemplatesAPI.update(savedId, payload)
        : await procedureTemplatesAPI.create(payload);
      if (res.success && res.data?.template) {
        setSavedId(res.data.template.id);
        if (activate !== undefined) setDraft(d => ({ ...d, isActive: activate }));
        toast.success(savedId ? 'Procedure saved' : 'Procedure created');
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading procedure..." />;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'details', label: '1. Details' },
    { id: 'components', label: `2. Components (${draft.items.length})` },
    { id: 'rules', label: `3. Rules & Pricing (${draft.pricingRules.length})` },
    { id: 'workflow', label: '4. Protocol Workflow' },
    { id: 'summary', label: '5. Summary' },
  ];

  const stageLabel = (key: string | null | undefined) => draft.stages.find(s => s.key === key)?.label ?? null;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine"><ChevronLeft size={16} /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase truncate">{draft.name || 'New procedure'}</h1>
              <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${draft.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>{draft.isActive ? 'Active' : 'Draft'}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Procedure recipe · fees + products + diagnostics + pricing rules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => save(false)} disabled={saving} className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50">Save draft</button>
          <button onClick={() => save(true)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save & activate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-zinc-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-seafoam text-seafoam' : 'border-transparent text-slate-400 hover:text-pine dark:hover:text-zinc-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px] gap-4 items-start">
        {/* ------------------------------------------------ main column */}
        <div className="space-y-4 min-w-0">
          {tab === 'details' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="field-label">Procedure name *</label><input className="field-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Spay – Dog (Routine)" /></div>
                <div><label className="field-label">Code</label><input className="field-input" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="PROC-SPAY-DOG-001" /></div>
                <div>
                  <label className="field-label">Category</label>
                  <select className="field-select" value={draft.categoryId} onChange={e => setDraft({ ...draft, categoryId: e.target.value })}>
                    <option value="">— None —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="field-label">Default duration (min)</label><input type="number" min={0} className="field-input" value={draft.defaultDurationMin} onChange={e => setDraft({ ...draft, defaultDurationMin: e.target.value })} placeholder="90" /></div>
              </div>
              <div>
                <label className="field-label">Species (empty = any)</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIES_OPTIONS.map(s => {
                    const on = draft.species.includes(s);
                    return (
                      <button key={s} type="button"
                        onClick={() => setDraft(d => ({ ...d, species: on ? d.species.filter(x => x !== s) : [...d.species, s] }))}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${on ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div><label className="field-label">Description</label><textarea className="field-textarea" rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="What this procedure includes…" /></div>
              <div>
                <label className="field-label">Trigger service — auto-applies this recipe when added to a visit</label>
                <select className="field-select" value={draft.triggerServiceId} onChange={e => setDraft({ ...draft, triggerServiceId: e.target.value })}>
                  <option value="">— No auto-apply (manual only) —</option>
                  {catalog.filter((s: any) => s.enabled !== false).map((s: any) => <option key={s.id} value={s.id}>{s.name} · {s.categoryName}</option>)}
                </select>
                <p className="text-[9px] text-slate-400 mt-1.5">When staff add this service to a visit, every non-optional component below lands on the bill automatically. Stock only deducts when the bill is settled.</p>
              </div>
              <div><label className="field-label">Procedure discount ({currency})</label><input type="number" min={0} className="field-input max-w-[180px]" value={draft.discount} onChange={e => setDraft({ ...draft, discount: e.target.value })} placeholder="0" /></div>
            </div>
          )}

          {tab === 'components' && (
            <div className="space-y-4">
              {/* Add component */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 flex items-center gap-2"><Plus size={13} className="text-seafoam" /> Add component</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TYPE_STYLE) as ProcItemType[]).map(t => (
                    <button key={t} type="button" onClick={() => { setPickType(t); setPickSearch(''); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${pickType === t ? TYPE_STYLE[t].chip : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                      {TYPE_STYLE[t].icon} {TYPE_STYLE[t].label}
                    </button>
                  ))}
                </div>
                {pickType === 'FEE' ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[160px]"><label className="field-label">Fee name</label><input className="field-input" value={feeName} onChange={e => setFeeName(e.target.value)} placeholder="Assistant fee / Consultant fee" /></div>
                    <div className="flex-1 min-w-[140px]"><label className="field-label">Consultant (optional)</label><input className="field-input" value={feeConsultant} onChange={e => setFeeConsultant(e.target.value)} placeholder="Dr. Collins Sakwa" /></div>
                    <div className="w-32"><label className="field-label">Amount</label><input type="number" min={0} className="field-input" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} placeholder="2000" /></div>
                    <button type="button" onClick={addFeeItem} className="px-4 py-2.5 bg-pine text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine/90">Add fee</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={pickSearch} onChange={e => setPickSearch(e.target.value)}
                      onFocus={() => setPickFocused(true)}
                      onBlur={() => setTimeout(() => setPickFocused(false), 150)}
                      className="field-input field-icon-left"
                      placeholder={pickType === 'MEDICATION' || pickType === 'CONSUMABLE' ? 'Search inventory (drug, suture, gloves…)' : 'Search catalog services…'} />
                    {(pickFocused || pickSearch.trim() !== '') && (serviceMatches.length > 0 || inventoryMatches.length > 0) && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
                        {serviceMatches.map((s: any) => (
                          <button type="button" key={s.id} onClick={() => addServiceItem(s)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                            <span className="min-w-0"><span className="block text-sm font-bold text-pine dark:text-zinc-100 truncate">{s.name}</span><span className="block text-[10px] text-slate-400">{s.categoryName}</span></span>
                            <span className="text-[11px] font-bold text-slate-400 shrink-0">{currency} {Number(s.priceEffective ?? s.defaultPrice ?? 0).toLocaleString()}</span>
                          </button>
                        ))}
                        {inventoryMatches.map((i: any) => (
                          <button type="button" key={i.id} onClick={() => addInventoryItem(i)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                            <span className="min-w-0"><span className="block text-sm font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span><span className="block text-[10px] text-slate-400">{Number(i.quantity)} {i.unit} in stock · {i.category}</span></span>
                            <span className="text-[11px] font-bold text-slate-400 shrink-0">{currency} {Number(i.price).toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1.5 overflow-x-auto">
                {(['ALL', 'SERVICE', 'MEDICATION', 'CONSUMABLE', 'LAB', 'FEE'] as const).map(f => (
                  <button key={f} onClick={() => setComponentFilter(f as any)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border ${componentFilter === f ? 'bg-pine text-white border-pine' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800'}`}>
                    {f === 'ALL' ? `All (${draft.items.length})` : f === 'LAB' ? 'Lab & Imaging' : TYPE_STYLE[f as ProcItemType].label + 's'}
                  </button>
                ))}
              </div>

              {/* Component rows */}
              {filteredItems.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-6">No components{componentFilter !== 'ALL' ? ' of this type' : ''} yet — add fees, medications, consumables and diagnostics above.</p>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map(i => (
                    <div key={i.key} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${TYPE_STYLE[i.itemType].chip}`}>{TYPE_STYLE[i.itemType].icon} {TYPE_STYLE[i.itemType].label}</span>
                        <span className="text-sm font-black text-pine dark:text-zinc-100 truncate">{i.name}{i.consultantName ? ` — ${i.consultantName}` : ''}</span>
                        {i.stock != null && <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${Number(i.stock) > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>Stock: {i.stock} {i.unit}</span>}
                        <button onClick={() => removeItem(i.key)} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="field-label">Qty basis</label>
                          <select className="field-select w-32" value={i.qtyBasis ?? 'FIXED'} onChange={e => patchItem(i.key, { qtyBasis: e.target.value as ProcQtyBasis })}>
                            <option value="FIXED">Fixed</option>
                            {(i.itemType === 'MEDICATION' || i.itemType === 'CONSUMABLE') && <option value="PER_KG">Per kg</option>}
                            <option value="MANUAL">Manual</option>
                          </select>
                        </div>
                        <div>
                          <label className="field-label">{i.qtyBasis === 'PER_KG' ? `Qty / kg${i.unit ? ` (${i.unit})` : ''}` : `Qty${i.unit ? ` (${i.unit})` : ''}`}</label>
                          <input type="number" min={0} step={0.01} className="field-input w-24" value={i.quantity ?? 1} onChange={e => patchItem(i.key, { quantity: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="field-label">Price ({currency})</label>
                          <input type="number" min={0} className="field-input w-28" value={i.priceOverride ?? ''} placeholder={String(i.basePrice)} onChange={e => patchItem(i.key, { priceOverride: e.target.value === '' ? null : Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="field-label">Stage</label>
                          <select className="field-select w-40" value={i.stageKey ?? ''} onChange={e => patchItem(i.key, { stageKey: e.target.value || null })}>
                            <option value="">— None —</option>
                            {draft.stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5 pb-0.5">
                          <button type="button" onClick={() => patchItem(i.key, { billable: !(i.billable !== false) })}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${i.billable !== false ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                            {i.billable !== false ? 'Billable' : 'No charge'}
                          </button>
                          {(i.itemType === 'MEDICATION' || i.itemType === 'CONSUMABLE') && (
                            <button type="button" onClick={() => patchItem(i.key, { deductStock: !(i.deductStock !== false) })}
                              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${i.deductStock !== false ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                              {i.deductStock !== false ? 'Deducts stock' : 'No deduction'}
                            </button>
                          )}
                          <button type="button" onClick={() => patchItem(i.key, { optional: !(i.optional === true) })}
                            title="Optional components are recommended, not auto-applied — the clinician ticks them on the visit"
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${i.optional ? 'bg-violet-500/10 text-violet-600 border-violet-500/30' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                            {i.optional ? 'Recommended' : 'Always'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 flex items-center gap-2"><Zap size={13} className="text-amber-500" /> Dynamic pricing rules</p>
                <button onClick={addRule} className="flex items-center gap-1.5 px-3 py-2 bg-pine text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-pine/90"><Plus size={12} /> Add rule</button>
              </div>
              {draft.pricingRules.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">No rules — the procedure prices as the flat sum of its components. Add rules like "In heat +2,000" or "Over 25kg +1,500".</p>}
              {draft.pricingRules.map((r, idx) => (
                <div key={idx} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input className="field-input max-w-[240px]" value={r.name} onChange={e => patchRule(idx, { name: e.target.value })} placeholder="Rule name" />
                    <button type="button" onClick={() => patchRule(idx, { enabled: !r.enabled })}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${r.enabled ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                      {r.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button onClick={() => removeRule(idx)} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><label className="field-label">Species</label><input className="field-input" value={r.conditions.species ?? ''} onChange={e => patchRuleCond(idx, { species: e.target.value || undefined })} placeholder="Any" /></div>
                    <div><label className="field-label">Weight ≥ (kg)</label><input type="number" className="field-input" value={r.conditions.weightMinKg ?? ''} onChange={e => patchRuleCond(idx, { weightMinKg: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
                    <div><label className="field-label">Weight &lt; (kg)</label><input type="number" className="field-input" value={r.conditions.weightMaxKg ?? ''} onChange={e => patchRuleCond(idx, { weightMaxKg: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
                    <div><label className="field-label">Age ≥ (months)</label><input type="number" className="field-input" value={r.conditions.ageMinMonths ?? ''} onChange={e => patchRuleCond(idx, { ageMinMonths: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {([['inHeat', 'In heat'], ['pregnant', 'Pregnant'], ['emergency', 'Emergency'], ['outOfHours', 'Out of hours']] as const).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => patchRuleCond(idx, { [k]: r.conditions[k] ? undefined : true } as any)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border ${r.conditions[k] ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-slate-100 dark:border-zinc-800">
                    <div><label className="field-label">Adjustment ({currency})</label><input type="number" className="field-input w-32" value={r.effects.feeAmount ?? ''} onChange={e => patchRuleEff(idx, { feeAmount: e.target.value === '' ? undefined : Number(e.target.value), feePercent: e.target.value === '' ? r.effects.feePercent : undefined })} placeholder="2000" /></div>
                    <div><label className="field-label">or % of subtotal</label><input type="number" className="field-input w-28" value={r.effects.feePercent ?? ''} onChange={e => patchRuleEff(idx, { feePercent: e.target.value === '' ? undefined : Number(e.target.value), feeAmount: e.target.value === '' ? r.effects.feeAmount : undefined })} placeholder="10" /></div>
                    <div className="flex-1 min-w-[180px]"><label className="field-label">Invoice line label</label><input className="field-input" value={r.effects.label ?? ''} onChange={e => patchRuleEff(idx, { label: e.target.value || undefined })} placeholder="Heat cycle surcharge" /></div>
                  </div>
                </div>
              ))}

              {/* Example patient tester */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 flex items-center gap-2"><Calculator size={13} className="text-seafoam" /> Example patient — test the quote</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div><label className="field-label">Weight (kg)</label><input type="number" min={0} className="field-input w-28" value={testWeight} onChange={e => setTestWeight(e.target.value)} placeholder="18" /></div>
                  {([['inHeat', 'In heat'], ['pregnant', 'Pregnant'], ['emergency', 'Emergency'], ['outOfHours', 'Out of hours']] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setTestFlags(f => ({ ...f, [k]: !f[k] }))}
                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border ${testFlags[k] ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                      {label}
                    </button>
                  ))}
                  <button onClick={runTest} disabled={testing} className="flex items-center gap-1.5 px-4 py-2 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-seafoam/90 disabled:opacity-50">
                    {testing ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />} Quote
                  </button>
                </div>
                {!savedId && <p className="text-[9px] text-slate-400">Save the procedure first — the tester quotes the saved version.</p>}
                {testResult && (
                  <div className="bg-slate-50 dark:bg-zinc-950/40 rounded-xl p-3 space-y-1 text-[11px]">
                    <div className="flex justify-between font-bold text-slate-500"><span>Components subtotal</span><span>{currency} {testResult.subtotal.toLocaleString()}</span></div>
                    {testResult.adjustments.map(a => <div key={a.ruleId} className="flex justify-between text-amber-600 font-bold"><span>{a.name}</span><span>+ {currency} {a.amount.toLocaleString()}</span></div>)}
                    {testResult.discount > 0 && <div className="flex justify-between text-emerald-600 font-bold"><span>Discount</span><span>− {currency} {testResult.discount.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-black text-pine dark:text-zinc-100 text-sm pt-1 border-t border-slate-200 dark:border-zinc-800"><span>Estimated total</span><span>{currency} {testResult.total.toLocaleString()}</span></div>
                    {testResult.skipped.length > 0 && (
                      <p className="text-[9px] text-rose-500 font-bold pt-1">{testResult.skipped.length} component(s) would skip: {testResult.skipped.map(s => `${s.name} (${s.reason})`).join('; ')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'workflow' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Stage editor */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200">Protocol stages</p>
                  <button onClick={addStage} className="flex items-center gap-1 px-2.5 py-1.5 bg-pine text-white rounded-lg font-black text-[9px] uppercase tracking-widest"><Plus size={11} /> Stage</button>
                </div>
                {draft.stages.map((s, idx) => (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <span className="w-5 text-center text-[10px] font-black text-slate-300">{idx + 1}</span>
                    <input className="field-input" value={s.label} onChange={e => renameStage(idx, e.target.value)} />
                    <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-pine disabled:opacity-30"><ArrowUp size={13} /></button>
                    <button onClick={() => moveStage(idx, 1)} disabled={idx === draft.stages.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-pine disabled:opacity-30"><ArrowDown size={13} /></button>
                    <button onClick={() => removeStage(idx)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                ))}
                <p className="text-[9px] text-slate-400">Assign each component to a stage on the Components tab — the visit page renders this as the procedure checklist.</p>
              </div>

              {/* Checklist preview */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 mb-3 flex items-center gap-2"><ClipboardList size={13} className="text-seafoam" /> Workflow preview</p>
                <div className="space-y-0.5">
                  {draft.stages.map((s, idx) => {
                    const stageItems = draft.items.filter(i => i.stageKey === s.key);
                    return (
                      <div key={s.key} className="relative pl-6 pb-3">
                        {idx < draft.stages.length - 1 && <span className="absolute left-[9px] top-5 bottom-0 w-px bg-slate-200 dark:bg-zinc-700" />}
                        <span className="absolute left-0 top-0.5 w-[18px] h-[18px] rounded-full bg-seafoam/15 border-2 border-seafoam flex items-center justify-center text-[8px] font-black text-seafoam">{idx + 1}</span>
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-wide">{s.label}</p>
                        {stageItems.length > 0 ? stageItems.map(i => (
                          <p key={i.key} className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                            · {i.name}{i.optional ? ' (recommended)' : ''}{i.billable === false ? ' — no charge' : ''}
                          </p>
                        )) : <p className="text-[9px] text-slate-300 dark:text-zinc-600 italic mt-0.5">no components</p>}
                      </div>
                    );
                  })}
                  {draft.items.some(i => !i.stageKey) && (
                    <p className="text-[9px] text-amber-600 font-bold">{draft.items.filter(i => !i.stageKey).length} component(s) not assigned to any stage.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'summary' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-zinc-950/40 rounded-xl p-3"><p className="text-lg font-black text-pine dark:text-zinc-100">{draft.items.length}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Components</p></div>
                <div className="bg-slate-50 dark:bg-zinc-950/40 rounded-xl p-3"><p className="text-lg font-black text-pine dark:text-zinc-100">{draft.items.filter(i => i.optional).length}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recommended</p></div>
                <div className="bg-slate-50 dark:bg-zinc-950/40 rounded-xl p-3"><p className="text-lg font-black text-pine dark:text-zinc-100">{draft.pricingRules.filter(r => r.enabled).length}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active rules</p></div>
                <div className="bg-slate-50 dark:bg-zinc-950/40 rounded-xl p-3"><p className="text-lg font-black text-pine dark:text-zinc-100">{draft.stages.length}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Stages</p></div>
              </div>
              <div className="space-y-1.5">
                {Object.entries(totals.groups).map(([g, amt]) => (
                  <div key={g} className="flex justify-between text-[12px] font-bold text-slate-500 dark:text-zinc-400"><span>{g}</span><span>{currency} {amt.toLocaleString()}</span></div>
                ))}
                {totals.discount > 0 && <div className="flex justify-between text-[12px] font-bold text-emerald-600"><span>Discount</span><span>− {currency} {totals.discount.toLocaleString()}</span></div>}
                <div className="flex justify-between font-black text-pine dark:text-zinc-100 pt-2 border-t border-slate-200 dark:border-zinc-800"><span>ESTIMATED TOTAL</span><span>{currency} {totals.total.toLocaleString()}</span></div>
                <p className="text-[9px] text-slate-400">Baseline estimate — weight-based doses priced at ×1 kg and rules excluded. Use the Rules tab tester for a patient-specific quote.</p>
              </div>
              {draft.items.some(i => i.billable === false && i.deductStock !== false) && (
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-950/40 rounded-xl p-3">
                  {draft.items.filter(i => i.billable === false && i.deductStock !== false).length} component(s) deduct stock without charging the client (e.g. gloves) — tracked for inventory, invisible on the invoice.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------ cost rail */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden xl:sticky xl:top-20">
          <div className="bg-pine text-white px-4 py-3"><p className="text-[10px] font-black uppercase tracking-widest">Cost & price summary</p></div>
          <div className="p-4 space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-zinc-400"><span>No. of components</span><span className="text-pine dark:text-zinc-100 font-black">{draft.items.length}</span></div>
            {Object.entries(totals.groups).map(([g, amt]) => (
              <div key={g} className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-zinc-400"><span>{g} total</span><span>{currency} {amt.toLocaleString()}</span></div>
            ))}
            {totals.discount > 0 && <div className="flex justify-between text-[11px] font-bold text-emerald-600"><span>Discount</span><span>− {currency} {totals.discount.toLocaleString()}</span></div>}
            <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-slate-200 dark:border-zinc-800">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estimated total</span>
              <span className="text-lg font-black text-pine dark:text-zinc-100">{currency} {totals.total.toLocaleString()}</span>
            </div>
            {draft.pricingRules.filter(r => r.enabled).length > 0 && (
              <p className="text-[9px] text-amber-600 font-bold flex items-center gap-1"><Zap size={10} /> {draft.pricingRules.filter(r => r.enabled).length} pricing rule(s) may adjust this per patient.</p>
            )}
            {draft.triggerServiceId && (
              <p className="text-[9px] text-slate-400 pt-1">Auto-applies when its trigger service is added to a visit.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcedureEditorPage;

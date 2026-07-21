import React, { useMemo } from 'react';
import { Pill, Scissors, ClipboardList, Package, Loader2, Plus, ExternalLink, Search } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L } from '../fields';
import { useData } from '../../../../../contexts/DataContext';
import { consumablesAPI, toast, procedureTemplatesAPI, ProcedureTemplate } from '../../../../../services';

const ROUTES = ['PO', 'IV', 'IM', 'SC', 'Topical', 'Other'];

interface MedRow {
  drug: string; dose: string; route: string; frequency: string; duration: string;
  // Set when the row was dispensed from stock (single merged flow): the
  // consumable line id lets removal restore stock; lineTotal shows the charge.
  consumableId?: string; qty?: number; unit?: string; lineTotal?: number;
}

// ONE medications flow (merged 2026-07-22): the drug picker searches the
// clinic INVENTORY — same source as the old "Consumables & items used"
// section — and Add dispenses through consumablesAPI.log, which deducts
// stock and puts the itemized charge on the bill. Dose/route/frequency/
// duration ride along as the prescription note. Gloves/syringes etc. are
// added the same way with the Rx fields left blank.

const TreatmentStep: React.FC<StepProps> = ({ visit, data, setData, emit, refreshVisit }) => {
  const d = data || {};
  const meds: MedRow[] = d.medications || [];
  const [draft, setDraft] = React.useState<MedRow & { itemId?: string; price?: number; stock?: number }>({ drug: '', dose: '', route: 'PO', frequency: '', duration: '', qty: 1 });
  const [drugFocus, setDrugFocus] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [removingIdx, setRemovingIdx] = React.useState<number | null>(null);
  const marCount = visit.medications?.length ?? 0;
  const { inventory, ensureInventory } = useData() as any;
  React.useEffect(() => { ensureInventory?.(); }, [ensureInventory]);

  // Inventory autocomplete — the ONLY source; picking an item is what enables
  // Add, so every row deducts real stock.
  const drugMatches = useMemo(() => {
    const q = draft.drug.trim().toLowerCase();
    if (q.length < 2) return [] as any[];
    return (inventory || [])
      .filter((it: any) => `${it.name} ${it.category ?? ''} ${it.sku ?? ''}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [inventory, draft.drug]);

  const pickItem = (it: any) => setDraft(prev => ({
    ...prev, drug: it.name, itemId: String(it.id), unit: it.unit,
    price: Number(it.price) || 0, stock: Number(it.quantity),
  }));

  const rxNote = (m: MedRow) => [m.dose, m.route, m.frequency, m.duration].filter(Boolean).join(' · ');

  const addMed = async () => {
    if (!draft.itemId) { toast.error('Pick a product from inventory — that\'s what deducts stock'); return; }
    const qty = Number(draft.qty) || 0;
    if (qty <= 0) { toast.error('Enter a quantity to dispense'); return; }
    if (draft.stock != null && qty > draft.stock) { toast.error(`Only ${draft.stock} ${draft.unit ?? ''} in stock`); return; }
    setBusy(true);
    try {
      const res = await consumablesAPI.log(visit.id, {
        inventoryItemId: draft.itemId,
        quantity: qty,
        notes: rxNote(draft) ? `Rx: ${rxNote(draft)}` : undefined,
      });
      if (res.success) {
        const lineTotal = (res.data as any)?.lineCost ?? (draft.price ?? 0) * qty;
        setData({ medications: [...meds, { drug: draft.drug, dose: draft.dose, route: draft.route, frequency: draft.frequency, duration: draft.duration, consumableId: (res.data as any)?.id, qty, unit: draft.unit, lineTotal }] });
        emit(`Medication dispensed — ${draft.drug} ×${qty}${draft.dose ? ` (${rxNote(draft)})` : ''} · stock deducted`, 'billing', true);
        setDraft({ drug: '', dose: '', route: 'PO', frequency: '', duration: '', qty: 1 });
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to dispense'); }
    finally { setBusy(false); }
  };

  // ---- Procedures Performed: only created recipes are selectable ---------
  type ProcRow = { name: string; applicationId?: string; total?: number };
  // Back-compat: rows saved by the old free-text editor are plain strings.
  const procRows: ProcRow[] = (d.procedures || []).map((p: any) => (typeof p === 'string' ? { name: p } : p));
  const [procTemplates, setProcTemplates] = React.useState<ProcedureTemplate[]>([]);
  const [procSearch, setProcSearch] = React.useState('');
  const [procFocus, setProcFocus] = React.useState(false);
  const [applyingProc, setApplyingProc] = React.useState(false);
  const [removingProcIdx, setRemovingProcIdx] = React.useState<number | null>(null);
  React.useEffect(() => {
    procedureTemplatesAPI.list().then(r => { if (r.success && r.data?.templates) setProcTemplates(r.data.templates); }).catch(() => {});
  }, []);
  const procMatches = useMemo(() => {
    const q = procSearch.trim().toLowerCase();
    const pool = procTemplates.filter(t => t.isActive !== false);
    if (!q) return pool.slice(0, 6);
    return pool.filter(t => `${t.name} ${t.code ?? ''} ${t.categoryName ?? ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [procTemplates, procSearch]);

  const applyProcedure = async (t: ProcedureTemplate) => {
    setApplyingProc(true);
    try {
      const res = await procedureTemplatesAPI.apply(t.id, { appointmentId: visit.id });
      if (res.success) {
        setData({ procedures: [...procRows, { name: t.name, applicationId: res.data?.applicationId, total: res.data?.total }] });
        emit(`Procedure performed — ${t.name} (recipe applied · ${res.data?.created?.tasks ?? 0} services, ${res.data?.created?.products ?? 0} products)`, 'billing', true);
        setProcSearch('');
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to apply procedure'); }
    finally { setApplyingProc(false); }
  };

  const removeProc = async (i: number) => {
    const p = procRows[i];
    if (!p.applicationId) { setData({ procedures: procRows.filter((_, j) => j !== i) }); return; }
    setRemovingProcIdx(i);
    try {
      const res = await procedureTemplatesAPI.removeApplication(p.applicationId);
      if (res.success) {
        toast.success('Procedure removed — its un-billed lines deleted');
        setData({ procedures: procRows.filter((_, j) => j !== i) });
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
    finally { setRemovingProcIdx(null); }
  };

  const removeMed = async (i: number) => {
    const m = meds[i];
    if (!m.consumableId) { setData({ medications: meds.filter((_, j) => j !== i) }); return; }
    setRemovingIdx(i);
    try {
      const res = await consumablesAPI.remove(m.consumableId);
      if (res.success) {
        toast.success('Removed · stock restored');
        setData({ medications: meds.filter((_, j) => j !== i) });
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
    finally { setRemovingIdx(null); }
  };

  return (
    <div className="space-y-4">
      <Section icon={Pill} title="Medications & Items Used (deducts stock · bills)">
        {marCount > 0 && (
          <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
            {marCount} medication{marCount === 1 ? '' : 's'} already recorded on this visit's MAR (Records &amp; Billing → Medications).
          </p>
        )}
        {meds.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-400 uppercase tracking-wider text-[8px] font-black">
                  <th className="py-1 pr-2">Drug / item</th><th className="py-1 px-2">Qty</th><th className="py-1 px-2">Dose</th><th className="py-1 px-2">Route</th>
                  <th className="py-1 px-2">Frequency</th><th className="py-1 px-2">Duration</th><th className="py-1 px-2">Charge</th><th className="py-1 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {meds.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-2 font-bold text-pine dark:text-zinc-100">{m.drug}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.qty ?? ''} {m.unit ?? ''}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.dose}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.route}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.frequency}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.duration}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-600 dark:text-zinc-300">{m.lineTotal != null ? m.lineTotal.toLocaleString() : ''}</td>
                    <td className="py-1.5 pl-2 text-right">
                      <button type="button" disabled={removingIdx === i} onClick={() => removeMed(i)} title={m.consumableId ? 'Remove — restores stock' : 'Remove'} className="text-slate-400 hover:text-red-500 disabled:opacity-50">
                        {removingIdx === i ? <Loader2 size={11} className="animate-spin inline" /> : '×'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Line 1: Drug (50%) + Qty + Dose · Line 2: Route / Frequency / Duration / Add */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end bg-slate-50 dark:bg-zinc-950 border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-2.5">
          <L label="Drug / item" className="col-span-2">
            <div className="relative">
              <input className="field-input" placeholder="Search inventory (drug, glove, syringe…)" value={draft.drug}
                onChange={e => setDraft({ ...draft, drug: e.target.value, itemId: undefined, unit: undefined, price: undefined, stock: undefined })}
                onFocus={() => setDrugFocus(true)}
                onBlur={() => setTimeout(() => setDrugFocus(false), 150)} />
              {drugFocus && drugMatches.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
                  {drugMatches.map((it: any) => (
                    <button key={it.id} type="button"
                      onMouseDown={() => pickItem(it)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-seafoam/5 transition-all">
                      <Package size={11} className="text-seafoam shrink-0" />
                      <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{it.quantity} {it.unit} in stock</span>
                    </button>
                  ))}
                </div>
              )}
              {draft.itemId && <p className="text-[9px] font-black text-seafoam mt-0.5 px-1">✓ from stock · {draft.stock} {draft.unit} available{draft.price ? ` · ${draft.price.toLocaleString()}/${draft.unit}` : ''}</p>}
            </div>
          </L>
          <L label={`Qty${draft.unit ? ` (${draft.unit})` : ''}`}><input type="number" min={0} step={0.01} className="field-input" value={draft.qty ?? ''} onChange={e => setDraft({ ...draft, qty: Number(e.target.value) })} /></L>
          <L label="Dose"><input className="field-input" placeholder="10 mg/kg" value={draft.dose} onChange={e => setDraft({ ...draft, dose: e.target.value })} /></L>
          <L label="Route">
            <select className="field-select" value={draft.route} onChange={e => setDraft({ ...draft, route: e.target.value })}>{ROUTES.map(r => <option key={r}>{r}</option>)}</select>
          </L>
          <L label="Frequency"><input className="field-input" placeholder="BID" value={draft.frequency} onChange={e => setDraft({ ...draft, frequency: e.target.value })} /></L>
          <L label="Duration"><input className="field-input" placeholder="5 days" value={draft.duration} onChange={e => setDraft({ ...draft, duration: e.target.value })} /></L>
          <button type="button" disabled={busy} onClick={addMed} className="h-9 px-3 self-end bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
          </button>
        </div>
        <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
          Adding dispenses from inventory: stock deducts and the charge lands on this visit's bill. Dose/route/frequency/duration are saved as the prescription note. Non-drug items (gloves, syringes…) go through the same search.
        </p>
      </Section>

      <Section icon={Scissors} title="Procedures Performed">
        {/* Only CREATED procedure recipes (Billable Items → Procedures) are
            selectable — picking one APPLIES the recipe to this visit (fees +
            products land on the bill). No match → create it on the Procedures
            page (opens in a new tab so this visit stays put). */}
        {procRows.length > 0 && (
          <div className="space-y-1.5">
            {procRows.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-950/40 rounded-lg">
                <span className="min-w-0 text-xs font-bold text-pine dark:text-zinc-100 truncate">{p.name}</span>
                {p.total != null && <span className="shrink-0 text-[10px] font-black text-slate-500 dark:text-zinc-400">{p.total.toLocaleString()}</span>}
                <button type="button" disabled={removingProcIdx === i} onClick={() => removeProc(i)}
                  title={p.applicationId ? 'Remove — deletes the recipe\'s un-billed lines' : 'Remove'}
                  className="shrink-0 text-slate-400 hover:text-red-500 disabled:opacity-50">
                  {removingProcIdx === i ? <Loader2 size={11} className="animate-spin" /> : '×'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="field-input field-icon-left" placeholder="Search your created procedures…"
            value={procSearch}
            onChange={e => setProcSearch(e.target.value)}
            onFocus={() => setProcFocus(true)}
            onBlur={() => setTimeout(() => setProcFocus(false), 150)} />
          {(procFocus || procSearch.trim() !== '') && (
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
              {procMatches.map(t => (
                <button key={t.id} type="button" disabled={applyingProc}
                  onMouseDown={() => applyProcedure(t)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-seafoam/5 transition-all disabled:opacity-50">
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{t.name}</span>
                    <span className="block text-[9px] text-slate-400">{t.categoryName ?? 'Procedure'} · {t.items.length} component{t.items.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-black text-slate-400">est. {t.estimatedTotal.toLocaleString()}</span>
                </button>
              ))}
              {procMatches.length === 0 && (
                <div className="px-3 py-2.5 space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-bold">{procSearch.trim() ? `No procedure matching "${procSearch.trim()}"` : 'No procedures created yet.'}</p>
                  <button type="button"
                    onMouseDown={() => window.open('/app/procedures', '_blank')}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline">
                    <Plus size={11} /> Create it on the Procedures page <ExternalLink size={10} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {applyingProc && <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><Loader2 size={11} className="animate-spin" /> Applying recipe — fees & products landing on the bill…</p>}
      </Section>

      <Section icon={ClipboardList} title="Treatment Plan & Instructions">
        <textarea className="field-textarea" rows={3} placeholder="In-clinic treatment given, plan for the next 24–72h, feeding/rest instructions…" value={d.plan ?? ''} onChange={e => setData({ plan: e.target.value })} />
        <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
          Hospitalisation or boarding? Use the admit actions on the visit header — the admission is tracked on the journey.
        </p>
      </Section>
    </div>
  );
};

export default TreatmentStep;

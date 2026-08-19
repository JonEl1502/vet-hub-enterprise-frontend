import React, { useEffect, useMemo, useState } from 'react';
import { Pill, Scissors, ClipboardList, Package, Loader2, Plus, ExternalLink, Search, Syringe } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, showsField } from '../fields';
import AppliedProcedurePanel from '../../../shared/AppliedProcedurePanel';
import VaccinationPanel from '../../VaccinationPanel';
import TreatmentPlanPanel from '../../../inpatient/TreatmentPlanPanel';
import QtyUnitControl, { sellUnitOf } from '../../../shared/QtyUnitControl';
import VisitFeeLines from '../../VisitFeeLines';
import { billsAPI } from '../../../../../services';
import { useData } from '../../../../../contexts/DataContext';
import { consumablesAPI, toast, procedureTemplatesAPI, ProcedureTemplate, vaccinationsAPI, vaccinePackagesAPI, VaccinePackage } from '../../../../../services';

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

const TreatmentStep: React.FC<StepProps> = ({ visit, pet, data, setData, emit, refreshVisit, visibleFields, currency = 'KES', onHospitalize }) => {
  const show = showsField(visibleFields);
  /**
   * TABS, not one long column (user, 2026-08-14: "i find this difficult … put
   * procedure n medication as tabs").
   *
   * Vaccinations, medications and procedures were three stacked cards, so
   * recording a vaccine meant scrolling past a drug form and a procedure search
   * that had nothing to do with it. They are separate acts on the same visit —
   * one at a time is how they are actually performed.
   *
   * ⚠️ Tabs sit ON TOP of `show()`, never instead of it: a workflow template
   * that hides Medications must still hide it, so a tab only appears when its
   * section would have rendered anyway.
   */
  const [txTab, setTxTab] = React.useState<'vaccinations' | 'medications' | 'procedures' | 'plan'>('medications');
  const d = data || {};
  const meds: MedRow[] = d.medications || [];
  const [draft, setDraft] = React.useState<MedRow & { itemId?: string; price?: number; stock?: number }>({ drug: '', dose: '', route: 'PO', frequency: '', duration: '', qty: 1 });
  const [drugFocus, setDrugFocus] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [removingIdx, setRemovingIdx] = React.useState<number | null>(null);
  const [feeRefresh, setFeeRefresh] = React.useState(0);
  const marCount = visit.medications?.length ?? 0;
  // A vaccination flow administers ON this step — it unlocks the vaccination
  // panel and widens the procedure search to packages + single vaccines.
  const isVaccinationFlow = (visit as any).visitType === 'VACCINATION'
    || (visit.tasks || []).some((t: any) => /vaccin|immuni/i.test(t.category || ''));

  // A vaccination visit opens on Vaccinations; a template that hides the
  // Medications field must not leave the step on a tab with nothing in it.
  React.useEffect(() => {
    const available = [
      isVaccinationFlow ? 'vaccinations' : null,
      show('medications') ? 'medications' : null,
      show('procedures') ? 'procedures' : null,
      show('plan') ? 'plan' : null,
    ].filter(Boolean) as typeof txTab[];
    if (available.length && !available.includes(txTab)) setTxTab(available[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVaccinationFlow, visibleFields]);

  // Vaccinations recorded on this visit — see the note in the Procedures
  // section. Best-effort: a failure leaves the strip empty rather than
  // blocking the consultation.
  const [vaccineRows, setVaccineRows] = useState<any[]>([]);
  useEffect(() => {
    let live = true;
    vaccinationsAPI.getByAppointment(String(visit.id))
      .then((recs: any) => { if (live) setVaccineRows(Array.isArray(recs) ? recs : []); })
      .catch(() => { /* strip stays empty */ });
    return () => { live = false; };
  }, [visit.id]);
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

  /** The full inventory row behind the draft — QtyUnitControl and the fees need it. */
  const draftItem = useMemo(
    () => (inventory || []).find((it: any) => String(it.id) === String(draft.itemId)) || null,
    [inventory, draft.itemId]);

  /**
   * Per-item service charges (`metadata.fees`, written by the product form and
   * the CSV import). They were STORED but nothing ever charged them — a vaccine
   * with a KES 300 injection fee configured billed only the vial (user,
   * 2026-08-03). Ticked fees are added as their own bill lines alongside the
   * dispense, so each can be edited or removed on its own.
   */
  const FEE_LABELS: Record<string, string> = {
    injection: 'Injection fee', admin: 'Administration fee',
    service: 'Service charge', prescription: 'Prescription fee',
  };
  const itemFees: { key: string; label: string; amount: number }[] = useMemo(() => {
    const fees = (draftItem as any)?.metadata?.fees || {};
    return Object.entries(fees)
      .filter(([, v]) => v != null && Number(v) > 0)
      .map(([k, v]) => ({ key: k, label: FEE_LABELS[k] || k, amount: Number(v) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftItem]);
  const [feesOn, setFeesOn] = useState<Record<string, boolean>>({});
  // Default every configured fee ON when a new item is picked — the clinic
  // set them up precisely so they get charged; untick to waive.
  useEffect(() => {
    setFeesOn(Object.fromEntries(itemFees.map(f => [f.key, true])));
  }, [draft.itemId]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // Each ticked fee becomes its OWN bill line so it can be edited or
        // deleted independently of the product it came with.
        const picked = itemFees.filter(f => feesOn[f.key]);
        for (const f of picked) {
          try {
            await billsAPI.addLine(visit.id, {
              name: `${f.label} — ${draft.drug}`,
              kind: 'SERVICE',
              quantity: 1,
              unitPrice: f.amount,
              category: 'Fees',
            } as any);
            emit(`${f.label} charged — ${currency} ${f.amount.toLocaleString()}`, 'billing', true);
          } catch { toast.error(`Could not add the ${f.label.toLowerCase()}`); }
        }

        setDraft({ drug: '', dose: '', route: 'PO', frequency: '', duration: '', qty: 1 });
        setFeeRefresh(n => n + 1);
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
    return pool.filter(t => `${t.name} ${t.code ?? ''} ${t.categoryName ?? ''} ${(t as any).type ?? ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [procTemplates, procSearch]);

  // On a VACCINATION flow the same box searches all three things staff might
  // reach for (user, 2026-08-02): a procedure recipe, a vaccine PACKAGE, or a
  // single vaccine off the shelf. Each lands on the visit by its own correct
  // route — a package is not a recipe and a vial is neither.
  const [vaccinePackages, setVaccinePackages] = useState<VaccinePackage[]>([]);
  useEffect(() => {
    if (!isVaccinationFlow) return;
    vaccinePackagesAPI.list(false, { silent: true } as any)
      .then(r => { if (r.success && r.data?.packages) setVaccinePackages(r.data.packages.filter(p => p.isActive !== false)); })
      .catch(() => { /* box still searches procedures */ });
  }, [isVaccinationFlow]);

  const pkgMatches = useMemo(() => {
    if (!isVaccinationFlow) return [];
    const q = procSearch.trim().toLowerCase();
    if (!q) return vaccinePackages.slice(0, 4);
    return vaccinePackages.filter(p => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q)).slice(0, 4);
  }, [isVaccinationFlow, vaccinePackages, procSearch]);

  const vaccineMatches = useMemo(() => {
    if (!isVaccinationFlow) return [];
    const q = procSearch.trim().toLowerCase();
    const isVax = (it: any) => /vaccin|immuni/i.test(`${it.category ?? ''} ${it.name ?? ''}`);
    const pool = (inventory || []).filter(isVax);
    if (!q) return pool.slice(0, 4);
    return pool.filter((it: any) => `${it.name} ${it.category ?? ''} ${it.sku ?? ''}`.toLowerCase().includes(q)).slice(0, 4);
  }, [isVaccinationFlow, inventory, procSearch]);

  const applyPackage = async (p: VaccinePackage) => {
    setApplyingProc(true);
    try {
      const res = await vaccinePackagesAPI.apply(p.id, visit.id);
      if (res.success) {
        emit(`Vaccine package applied — ${p.name}`, 'billing', true);
        setProcSearch('');
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to apply the package'); }
    finally { setApplyingProc(false); }
  };

  // A single vaccine is dispensed exactly like any other stock item — same
  // call as the Medications box above, so stock moves and the bill line is
  // created once, by one code path.
  const addVaccine = async (it: any) => {
    setApplyingProc(true);
    try {
      const res = await consumablesAPI.log(visit.id, { inventoryItemId: String(it.id), quantity: 1 });
      if (res.success) {
        emit(`Vaccine given — ${it.name} ×1 · stock deducted`, 'billing', true);
        setProcSearch('');
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to add the vaccine'); }
    finally { setApplyingProc(false); }
  };

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
    } catch (e: any) {
      /**
       * ⚠️ 404 MEANS IT IS ALREADY GONE — which is what was asked for.
       *
       * The draft keeps its own list of applied procedures, so an application
       * deleted elsewhere (or in an earlier failed attempt) leaves a row here
       * pointing at nothing. Clicking × then returned "Procedure application
       * not found" AND kept the row, so the only way to clear it was to press a
       * button that could never succeed (user, 2026-08-18).
       *
       * Treat absence as success: drop the row and say what happened, rather
       * than reporting a failure to reach a state we are already in.
       */
      if (e?.response?.status === 404) {
        setData({ procedures: procRows.filter((_, j) => j !== i) });
        refreshVisit?.();
        toast.success('That procedure was already removed — clearing it from the list');
      } else {
        toast.error(e?.response?.data?.message || e?.message || 'Failed to remove');
      }
    }
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

  // (`isVaccinationFlow` is defined at the top — the panel below and the
  // package/vaccine search both key off it.) Two vaccines in one visit are two
  // VaccinationRecords on the SAME encounter, not a second VACCINATION
  // encounter (172's unique index refuses the duplicate).
  return (
    <div className="space-y-4">
      {/* Treatment setting (spec 7b, vet clinical spec item 9): Outpatient |
          Inpatient, chosen ON the treatment plan. Inpatient runs the
          PAY-GATED admit flow (settle the accrued bill first; owner/manager
          health-danger override); the visit's medications carry onto the
          chart's instructions. Outpatient is recorded once on the journey. */}
      <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 bg-white dark:bg-zinc-900 flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Treat as</span>
        {visit.hospitalizationId ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            🏥 Inpatient — chart runs on the Admission step / linked chart
          </span>
        ) : (
          <>
            <button type="button"
              onClick={() => {
                if (data?.treatAs !== 'OUTPATIENT') {
                  setData({ treatAs: 'OUTPATIENT' });
                  emit('Treatment plan: OUTPATIENT', 'action', true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                /* Outpatient is the DEFAULT (user, 2026-08-18): most visits are
                   outpatient, and an unset value rendered BOTH buttons inactive,
                   which read as "nothing chosen" on a field that always has an
                   answer. Inpatient is an explicit act with a pay gate; it is
                   never what silence means. */
                (data?.treatAs ?? 'OUTPATIENT') === 'OUTPATIENT'
                  ? 'bg-seafoam text-white border-seafoam'
                  : 'bg-white dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
              }`}>
              Outpatient
            </button>
            <button type="button"
              disabled={!onHospitalize}
              title={onHospitalize ? 'Admit as inpatient — the current bill settles first, then the stay runs on its own estimate' : 'Hospitalization is available from the visit page'}
              onClick={() => onHospitalize?.()}
              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all disabled:opacity-40">
              Inpatient — admit
            </button>
            {data?.treatAs === 'OUTPATIENT' && (
              <span className="text-[9px] font-bold text-slate-400">Recorded on the journey — care continues on this visit.</span>
            )}
          </>
        )}
      </div>
      {/* INPATIENT TREATMENT PLAN, started right here (user, 2026-08-04).
          Only once the admission exists — the plan hangs off a hospitalization,
          and there is nothing to attach it to before admit.
          Entirely OPTIONAL: leave it blank and fill it from the daily log
          instead. Same panel and same data as the inpatient chart, so whichever
          end it is started from, it is one plan. */}
      {visit.hospitalizationId && (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-white dark:bg-zinc-900">
          <TreatmentPlanPanel hospitalizationId={visit.hospitalizationId} />
          <p className="mt-2 text-[9px] font-bold text-slate-400">
            Optional here — the same plan can be built or added to from the daily log on the chart.
          </p>
        </div>
      )}

      {/* One row of tabs for the three things a treatment step records, plus the
          plan. Only tabs whose section would render are offered. */}
      {(() => {
        const tabs = ([
          isVaccinationFlow ? { id: 'vaccinations' as const, label: 'Vaccinations' } : null,
          show('medications') ? { id: 'medications' as const, label: 'Medications & items' } : null,
          show('procedures') ? { id: 'procedures' as const, label: 'Procedures' } : null,
          show('plan') ? { id: 'plan' as const, label: 'Plan & instructions' } : null,
        ].filter(Boolean) as { id: typeof txTab; label: string }[]);
        if (tabs.length < 2) return null;
        // Land on a tab that exists — a vaccination visit opens on Vaccinations,
        // and a template hiding Medications must not leave a dead default.
        // ⚠️ Read-only here. Correcting a stale tab is done in the effect
        // below — a setState during render is a loop waiting to happen, and
        // this file already renders inside an IIFE where that is easy to miss.
        const active = tabs.some(t => t.id === txTab) ? txTab : tabs[0].id;
        return (
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-zinc-800 pb-2">
            {tabs.map(t => (
              <button key={t.id} type="button" onClick={() => setTxTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  active === t.id
                    ? 'bg-seafoam text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-seafoam'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}

      {isVaccinationFlow && txTab === 'vaccinations' && (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-white dark:bg-zinc-900">
          <VaccinationPanel appointment={visit} petId={pet.id} onSaved={() => refreshVisit?.()} />
        </div>
      )}
      {show('medications') && txTab === 'medications' && (
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
              {/* What it costs and what it leaves behind (user, 2026-08-02):
                  the sell-price line total, and stock before → after, so the
                  charge and the shelf are both visible BEFORE Add is pressed. */}
              {draft.itemId && (() => {
                const q = Number(draft.qty) || 0;
                const before = Number(draft.stock ?? 0);
                const after = before - q;
                const lineTotal = (draft.price ?? 0) * q;
                const feeTotal = itemFees.filter(f => feesOn[f.key]).reduce((t, f) => t + f.amount, 0);
                return (
                  <p className="text-[9px] font-black mt-0.5 px-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-seafoam">
                      ✓ {draft.price ? `${draft.price.toLocaleString()}/${draft.unit}` : 'from stock'}
                      {q > 0 && draft.price ? ` × ${q} = ${currency} ${lineTotal.toLocaleString()}` : ''}
                      {/* Fees are charged with it, so quote the REAL total. */}
                      {feeTotal > 0 && (
                        <> {' + '}{currency} {feeTotal.toLocaleString()} charges
                          {' = '}<b>{currency} {(lineTotal + feeTotal).toLocaleString()}</b>
                        </>
                      )}
                    </span>
                    <span className={after < 0 ? 'text-rose-500' : 'text-slate-400'}>
                      stock {before.toLocaleString()} → {after.toLocaleString()} {draft.unit}
                      {after < 0 ? ' · not enough' : ''}
                    </span>
                  </p>
                );
              })()}
            </div>
          </L>
          {/* Sell-unit aware qty (user, 2026-08-03) — the picker offers the
              item's own units (Dose / Box / ½ Box…) instead of a bare number,
              so a 25-dose vial can't be billed as a whole box by accident. */}
          <L label={`Qty${draft.itemId ? ` (${sellUnitOf(draftItem || {})})` : ''}`}>
            {draft.itemId ? (
              <QtyUnitControl
                item={draftItem || {}}
                value={Number(draft.qty) || 0}
                onChange={q => setDraft(d => ({ ...d, qty: q }))}
              />
            ) : (
              <input type="number" min={0} step={0.01} className="field-input" value={draft.qty ?? ''} onChange={e => setDraft({ ...draft, qty: Number(e.target.value) })} />
            )}
          </L>
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
        {/* Configured service charges for the picked item — tick what applies.
            Nothing read `metadata.fees` before, so these were set up and never
            billed (user, 2026-08-03). */}
        {itemFees.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Charges</span>
            {itemFees.map(f => (
              <button
                key={f.key} type="button"
                onClick={() => setFeesOn(m => ({ ...m, [f.key]: !m[f.key] }))}
                title={feesOn[f.key] ? 'Charged with this item — click to waive' : 'Waived — click to charge'}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  feesOn[f.key]
                    ? 'bg-seafoam/10 text-seafoam border-seafoam/40'
                    : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-700 line-through'
                }`}>
                {feesOn[f.key] ? '✓ ' : ''}{f.label} · {currency} {f.amount.toLocaleString()}
              </button>
            ))}
          </div>
        )}

        <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
          Adding dispenses from inventory: stock deducts and the charge lands on this visit's bill. Dose/route/frequency/duration are saved as the prescription note. Non-drug items (gloves, syringes…) go through the same search.
        </p>
      </Section>
      )}

      {/* Charges added alongside dispensed items — editable / removable. */}
      <VisitFeeLines
        visitId={visit.id}
        currency={currency}
        refreshKey={feeRefresh}
        onChanged={() => refreshVisit?.()}
      />

      {show('procedures') && txTab === 'procedures' && (
      <Section icon={Scissors} title="Procedures Performed">
        {/* Search FIRST, then what has been added (user, 2026-08-18).
            The picker sat below a list that grows, so on a visit with a
            few procedures the way to add another was pushed off screen —
            the control you came for should not be the one you scroll to. */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="field-input field-icon-left"
            placeholder={isVaccinationFlow ? 'Search procedures, vaccine packages or a single vaccine…' : 'Search your created procedures…'}
            value={procSearch}
            onChange={e => setProcSearch(e.target.value)}
            onFocus={() => setProcFocus(true)}
            onBlur={() => setTimeout(() => setProcFocus(false), 150)} />
          {(procFocus || procSearch.trim() !== '') && (
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
              {/* Vaccine PACKAGES — one click applies the whole package as a
                  single billed line (its doses expand into records). */}
              {pkgMatches.map(p => (
                <button key={`pkg-${p.id}`} type="button" disabled={applyingProc}
                  onMouseDown={() => applyPackage(p)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all disabled:opacity-50 border-b border-slate-50 dark:border-zinc-800">
                  <span className="min-w-0 flex items-center gap-2">
                    <Package size={12} className="text-amber-500 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{p.name}</span>
                      <span className="block text-[9px] text-slate-400">Vaccine package · {p.items.length} vaccine{p.items.length === 1 ? '' : 's'}</span>
                    </span>
                  </span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[8px] font-black uppercase tracking-wider">Package</span>
                    <span className="text-[10px] font-black text-slate-400">{Number(p.pricing?.sellAfterDiscount ?? 0).toLocaleString()}</span>
                  </span>
                </button>
              ))}
              {/* A SINGLE vaccine straight off the shelf. */}
              {vaccineMatches.map((it: any) => (
                <button key={`vax-${it.id}`} type="button" disabled={applyingProc}
                  onMouseDown={() => addVaccine(it)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all disabled:opacity-50 border-b border-slate-50 dark:border-zinc-800">
                  <span className="min-w-0 flex items-center gap-2">
                    <Syringe size={12} className="text-emerald-500 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                      <span className="block text-[9px] text-slate-400">{it.quantity} {it.unit} in stock</span>
                    </span>
                  </span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[8px] font-black uppercase tracking-wider">Vaccine</span>
                    <span className="text-[10px] font-black text-slate-400">{Number(it.price ?? 0).toLocaleString()}</span>
                  </span>
                </button>
              ))}
              {procMatches.map(t => (
                <button key={t.id} type="button" disabled={applyingProc}
                  onMouseDown={() => applyProcedure(t)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-seafoam/5 transition-all disabled:opacity-50">
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{t.name}</span>
                    <span className="block text-[9px] text-slate-400">{t.type ?? t.categoryName ?? 'Procedure'} · {t.items.length} component{t.items.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-black text-slate-400">est. {t.estimatedTotal.toLocaleString()}</span>
                </button>
              ))}
              {procMatches.length === 0 && pkgMatches.length === 0 && vaccineMatches.length === 0 && (
                <div className="px-3 py-2.5 space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-bold">{procSearch.trim() ? `Nothing matching "${procSearch.trim()}"` : 'No procedures created yet.'}</p>
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
        {/* Vaccinations recorded on this visit.
            A vaccination added on the vaccination page creates a
            VaccinationRecord + a visit task — NOT a ProcedureApplication — so
            it never appeared in the list below and this panel read as empty
            while the bill already carried the charge. Same clinical act showed
            or didn't depending on which door it came through. Read-only here:
            the vaccination page owns editing them. */}
        {vaccineRows.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {vaccineRows.map((v: any) => (
              <div key={`vax-${v.id}`} className="flex items-center justify-between gap-2 px-2.5 py-2 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{v.vaccineName}</span>
                  <span className="block text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    Vaccination · {v.status}
                  </span>
                </span>
                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-slate-400">On vaccination page</span>
              </div>
            ))}
          </div>
        )}

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
        {/* Every applied recipe in FULL — its meds, consumables and fees, with
            per-line qty edit / billable toggle / remove (user, 2026-08-02:
            "show all meds n consumables from the procedure and allow edit"). */}
        {procRows.length > 0 && (
          <div className="mt-2">
            <AppliedProcedurePanel appointmentId={visit.id} onChanged={() => refreshVisit?.()} />
          </div>
        )}
        {applyingProc && <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><Loader2 size={11} className="animate-spin" /> Applying recipe — fees & products landing on the bill…</p>}
      </Section>
      )}

      {show('plan') && txTab === 'plan' && (
      <Section icon={ClipboardList} title="Treatment Plan & Instructions">
        <textarea className="field-textarea" rows={3} placeholder="In-clinic treatment given, plan for the next 24–72h, feeding/rest instructions…" value={d.plan ?? ''} onChange={e => setData({ plan: e.target.value })} />
        <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
          Hospitalisation or boarding? Use the admit actions on the visit header — the admission is tracked on the journey.
        </p>
      </Section>
      )}
    </div>
  );
};

export default TreatmentStep;

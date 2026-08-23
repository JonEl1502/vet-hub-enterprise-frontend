import RecordPageHeader, { STICKY_RAIL } from '../shared/RecordPageHeader';
import { dialog } from '../../../services/utils/dialog';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Stethoscope, Loader2, LogOut, Plus, Dog, Activity, Thermometer, ClipboardList, CheckCircle2, Circle, Scissors, ExternalLink, Share2, Trash2, Receipt, Pencil, X, RotateCcw} from 'lucide-react';
import ShareWithClinics from '../shared/ShareWithClinics';
import TreatmentPlanPanel from './TreatmentPlanPanel';
import { inpatientAPI, Hospitalization, LogKind, DischargeOutcome, visitsAPI, toast, servicesAPI, consumablesAPI } from '../../../services';
import { formatDate, formatTime, calendarDaysBetween } from '../../../services/utils/dateFormatter';
import ConsumablePicker from '../shared/ConsumablePicker';
import StayChargeCard from '../shared/StayChargeCard';
import FinalizeReminderGate, { ReminderDraft } from '../appointments/FinalizeReminderGate';
import StandardRecordControls from '../shared/StandardRecordControls';
import NotesFormatToggle from '../shared/NotesFormatToggle';
import RecordActionBar, { RecordActionBarSpacer } from '../shared/RecordActionBar';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';

// Full-page inpatient chart — converted from the old right-side drawer so the
// chart is a real navigable page (deep-linkable via nav param hospId).

const FRACTIONAL_UNITS = new Set(['ml', 'mg', 'g', 'l', 'cc', 'mcg', 'iu']);
const stepFor = (unit?: string) => (unit && FRACTIONAL_UNITS.has(unit.toLowerCase()) ? 0.1 : 1);

interface Props {
  hospId: string; onBack: () => void; onChanged?: () => void; onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
  /** Rendered inside the visit wizard's Admission step — hides the page-level
   * back link (the wizard provides its own navigation). */
  embedded?: boolean;
  /**
   * Render ONE column instead of the two-column page (2026-08-22).
   *
   * The visit wizard shows this chart as tabs — Daily sheet, then Stay & plan —
   * so it needs the main column and the side rail separately. Omitted, the page
   * renders both side by side exactly as before.
   */
  pane?: 'chart' | 'plan';
}

const OUTCOMES: DischargeOutcome[] = ['RECOVERED', 'IMPROVED', 'UNCHANGED', 'DEFERRED', 'DECEASED'];
const LOG_KINDS: { value: LogKind; label: string }[] = [
  { value: 'TREATMENT_TASK', label: 'Treatment task' },
  { value: 'MEDICATION', label: 'Medication (MAR)' },
  { value: 'FLUID_INTAKE', label: 'Fluid intake' },
  { value: 'FLUID_OUTPUT', label: 'Fluid output' },
  { value: 'FEEDING', label: 'Feeding' },
  { value: 'ELIMINATION', label: 'Elimination' },
  { value: 'NURSING_NOTE', label: 'Nursing note' },
  { value: 'PROGRESS_NOTE', label: 'Progress note (SOAP)' },
  { value: 'COMM_LOG', label: 'Client communication' },
  { value: 'HANDOVER', label: 'Shift handover' },
];
const isTask = (k: LogKind) => k === 'TREATMENT_TASK' || k === 'MEDICATION';
const fieldCls = 'w-full px-2.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

/**
 * The FIELDS each kind records, in form order, so a saved entry can be read
 * back field-by-field instead of as one squashed sentence (user, 2026-08-22:
 * "just show me in details what was added … i find this lacking").
 */
const LOG_FIELDS: Record<string, Array<[string, string, string?]>> = {
  MEDICATION:     [['drug', 'Drug'], ['dose', 'Dose'], ['route', 'Route']],
  TREATMENT_TASK: [['task', 'Task']],
  FLUID_INTAKE:   [['type', 'Type'], ['amount', 'Amount', 'ml']],
  FLUID_OUTPUT:   [['type', 'Type'], ['amount', 'Amount', 'ml']],
  FEEDING:        [['food', 'Food'], ['offered', 'Offered'], ['eaten', 'Eaten']],
  ELIMINATION:    [['urination', 'Urination'], ['defecation', 'Defecation']],
};
const logFieldsFor = (kind: string): Array<[string, string, string?]> =>
  LOG_FIELDS[kind] ?? [['note', 'Note']];

const logSummary = (kind: LogKind, d: Record<string, any>): string => {
  switch (kind) {
    case 'MEDICATION': return [d.drug, d.dose, d.route].filter(Boolean).join(' · ');
    case 'TREATMENT_TASK': return d.task || '';
    case 'FLUID_INTAKE': return [d.type, d.amount && `${d.amount} ml`].filter(Boolean).join(' · ');
    case 'FLUID_OUTPUT': return [d.type, d.amount && `${d.amount} ml`].filter(Boolean).join(' · ');
    case 'FEEDING': return [d.food, d.offered && `offered ${d.offered}`, d.eaten && `ate ${d.eaten}`].filter(Boolean).join(' · ');
    case 'ELIMINATION': return [d.urination && `urine: ${d.urination}`, d.defecation && `stool: ${d.defecation}`].filter(Boolean).join(' · ');
    default: return d.note || '';
  }
};

const InpatientChartPage: React.FC<Props> = ({ hospId, onBack, onChanged, onOpenAppointment, embedded, pane }) => {
  const { selectedClinics } = useClinic();
  // Clinic default, used when nobody typed a rate on the admission itself.
  const clinicDayRate = (selectedClinics[0] as any)?.inpatientDayRate ?? null;
  const [h, setH] = useState<Hospitalization | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vital, setVital] = useState({ temperature: '', pulse: '', respiration: '', weight: '', mucousMembrane: '', crt: '' });
  // Whole-stay notes (192), mirroring the boarding stay page.
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  // Read inside the load callback, which closes over stale state otherwise —
  // a reload mid-typing would silently clobber what the user had written.
  const notesDirtyRef = React.useRef(false);
  React.useEffect(() => { notesDirtyRef.current = notesDirty; }, [notesDirty]);
  // Row-level deletes (user, 2026-08-06: "allow delete"), mirroring boarding.
  const [removing, setRemoving] = useState<string | null>(null);
  const [logKind, setLogKind] = useState<LogKind>('TREATMENT_TASK');
  const [logData, setLogData] = useState<Record<string, string>>({});
  const { inventory, updateInventoryOptimistically } = useData();
  const [drugItem, setDrugItem] = useState<any | null>(null);
  const [drugQty, setDrugQty] = useState<number>(1);
  const [drugBillable, setDrugBillable] = useState(true);
  const resetDrug = () => { setDrugItem(null); setDrugQty(1); setDrugBillable(true); };
  const [showDischarge, setShowDischarge] = useState(false);
  const [showDischargeGate, setShowDischargeGate] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const [showGroomPicker, setShowGroomPicker] = useState(false);
  const [groomServices, setGroomServices] = useState<{ id: string; name: string; defaultPrice?: number }[]>([]);
  useEffect(() => {
    if (showGroomPicker && groomServices.length === 0) {
      servicesAPI.catalog()
        .then(list => setGroomServices((list || [])
          .filter((s: any) => String(s.categoryName || '').toLowerCase().includes('groom'))
          .map((s: any) => ({ id: String(s.id), name: s.name, defaultPrice: (s.priceEffective ?? s.defaultPrice) ?? undefined }))))
        .catch(() => {});
    }
  }, [showGroomPicker]);
  const addGroomingService = async (svc?: { id?: string; name: string; defaultPrice?: number }) => {
    const apptId = h?.billing?.appointmentId || h?.appointmentId;
    if (!apptId) return;
    setBusy(true);
    try {
      await visitsAPI.addTask(Number(apptId), { name: svc?.name || 'Grooming service', category: 'Grooming', status: 'PENDING' as any, price: Number(svc?.defaultPrice ?? 0), serviceId: svc?.id } as any);
      toast.success(`Added "${svc?.name || 'Grooming service'}" — detail it on the Grooming page`);
      onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Failed to add grooming service'); }
    finally { setBusy(false); }
  };

  const [discharge, setDischarge] = useState({ outcome: 'RECOVERED' as DischargeOutcome, dischargeNotes: '', homeInstructions: '', finalWeight: '', dischargeReason: '' });

  /**
   * Is this an EARLY discharge? Compared by CALENDAR DAY, matching the server
   * (utils/earlyRelease) — an expected discharge of "Tuesday 15:00" must not
   * make a Tuesday-morning discharge "early" and demand an explanation.
   * No expected date ⇒ NOT early: the gate only bites where a plan exists.
   */
  const dischargeIsEarly = (() => {
    if (!h?.expectedDischargeAt) return false;
    const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return sod(new Date()) < sod(new Date(h.expectedDischargeAt));
  })();
  const dischargeBlocked = dischargeIsEarly && !discharge.dischargeReason.trim();

  // Per-day charges for the reconciliation sheet (user, 2026-08-02): the
  // stay's daily rate + billable consumables logged that day. Shown even at 0.
  const [consumables, setConsumables] = useState<any[]>([]);
  /**
   * Bumped whenever a consumable is added, edited or removed.
   *
   * ⚠️ THE BUG THIS FIXES (user, 2026-08-23: 404 "Consumable record not
   * found"). The fetch below keyed on `[appointmentId, h.logs.length]`.
   * Deleting an ITEM changes neither — same visit, same number of log entries —
   * so `load()` refreshed the hospitalization while `consumables` kept the row
   * that had just been deleted server-side. It stayed on screen, looking like
   * the delete had failed, and clicking it again asked the API to delete a row
   * that was already gone: 404. Adding an item had the mirror problem — it
   * would not appear until something unrelated changed.
   */
  const [consRefresh, setConsRefresh] = useState(0);
  // Back-fill (user, 2026-08-02): when set, the Add-to-daily-sheet form and the
  // consumables picker record entries AS this datetime — a paper day sheet can
  // be keyed in after the fact. Null = normal "now" logging.
  const [backfillAt, setBackfillAt] = useState<string | null>(null);
  /**
   * Which day's editor is open, and whether it is writing a NEW entry or
   * editing an existing one.
   *
   * The editor used to sit permanently open under every day: after pressing
   * "Add entry" the whole TPR grid, the kind chips and the drug fields were
   * still staring back at you, with the thing you had just recorded reduced to
   * a one-line strip below (user, 2026-08-22: "after i click add entry i dont
   * want to see this"). Now it opens on demand and closes on save.
   */
  const [openEditorDay, setOpenEditorDay] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  /** Which day of the stay the chart is showing — see BoardingStayPage. */
  const [careDay, setCareDay] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inpatientAPI.getById(hospId);
      if (res.success && res.data?.hospitalization) {
        setH(res.data.hospitalization);
        setNotesDraft(prev => (notesDirtyRef.current ? prev : (res.data!.hospitalization as any).notes ?? ''));
      }
    }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [hospId]);
  useEffect(() => { setH(null); load(); }, [hospId, load]);
  useEffect(() => {
    const apptId = h?.billing?.appointmentId;
    if (!apptId) { setConsumables([]); return; }
    let alive = true;
    consumablesAPI.list(apptId, { silent: true } as any)
      .then(r => { if (alive && r.success && Array.isArray(r.data)) setConsumables(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [h?.billing?.appointmentId, h?.logs?.length, consRefresh]);

  /** Any TPR field carrying a value. An all-blank row is not an observation. */
  const vitalHasValue = Object.values(vital).some(v => String(v ?? '').trim() !== '');

  const addVital = async () => {
    // ⚠️ Guard, not just a disabled button: Enter in any field reaches here
    // too. An empty row rendered as "09:47 am — — — — — —" on the chart, which
    // reads as "observed, all normal" rather than "nothing was recorded"
    // (user, 2026-08-06). On a clinical chart that difference matters.
    if (!vitalHasValue) {
      toast.error('Record at least one reading before adding a vitals row');
      return;
    }
    setBusy(true);
    try {
      await inpatientAPI.addVital(hospId, {
        temperature: vital.temperature ? Number(vital.temperature) : null,
        pulse: vital.pulse ? Number(vital.pulse) : null,
        respiration: vital.respiration ? Number(vital.respiration) : null,
        weight: vital.weight ? Number(vital.weight) : null,
        mucousMembrane: vital.mucousMembrane || null, crt: vital.crt || null,
        // Vitals ignored the back-fill time entirely, so filling Day 3 from the
        // paper sheet stamped them today (user, 2026-08-04). The API has always
        // honoured `recordedAt`; nothing was sending it.
        ...(backfillAt ? { recordedAt: new Date(backfillAt).toISOString() } : {}),
      } as any);
      setVital({ temperature: '', pulse: '', respiration: '', weight: '', mucousMembrane: '', crt: '' });
      await load();
    } finally { setBusy(false); }
  };

  const removeVital = async (vitalId: string) => {
    setRemoving(`v-${vitalId}`);
    try {
      await inpatientAPI.deleteVital(vitalId);
      toast.success('Vitals entry deleted');
      await load(); onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Could not delete the entry'); }
    finally { setRemoving(null); }
  };

  const removeLog = async (log: { id: string; kind: string }) => {
    /**
     * EVERY kind confirms now (user, 2026-08-22: "across app when user deletes
     * some things confirm first"). Only MEDICATION used to, so the trash icon
     * beside a treatment task deleted it on a single mis-click.
     *
     * A MEDICATION entry also does not own its stock or its charge —
     * administering a drug writes this log AND a separate consumable — so say
     * so rather than let someone assume the charge went with it.
     *
     * Uses the app dialog, not window.confirm: the native one cannot be styled,
     * is suppressed by some browsers, and looks nothing like the rest of VetHub.
     */
    const ok = await dialog.confirmDelete({
      entityName: log.kind.replace(/_/g, ' ').toLowerCase(),
      message: log.kind === 'MEDICATION'
        ? "Delete this medication entry? The drug's stock deduction and charge are a SEPARATE item on this day — remove that too if the dose was never given."
        : 'Delete this entry? This cannot be undone.',
    });
    if (!ok) return;
    setRemoving(`l-${log.id}`);
    try {
      await inpatientAPI.deleteLog(log.id);
      toast.success('Entry deleted');
      await load(); onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Could not delete the entry'); }
    finally { setRemoving(null); }
  };

  const removeConsumable = async (consId: string, name?: string) => {
    const ok = await dialog.confirmDelete({
      entityName: name || 'this item',
      message: 'Remove this item? It comes off the bill and the stock is returned.',
    });
    if (!ok) return;
    setRemoving(`c-${consId}`);
    try {
      await consumablesAPI.remove(consId as any);
      toast.success(`${name || 'Item'} removed — stock returned`);
      setConsRefresh(n => n + 1);
      await load(); onChanged?.();
    } catch (e: any) {
      /**
       * A 404 here means the row is ALREADY GONE — almost always a second
       * click on a row the UI failed to drop. Deleting something that no
       * longer exists is the outcome the user asked for, so refresh and move
       * on rather than showing an error for a job already done.
       */
      if (e?.status === 404 || /not found/i.test(e?.message || '')) {
        setConsRefresh(n => n + 1);
        await load(); onChanged?.();
      } else {
        toast.error(e?.message || 'Could not remove the item');
      }
    }
    finally { setRemoving(null); }
  };

  const addLog = async () => {
    if (logKind === 'MEDICATION' && drugItem && drugQty > Number(drugItem.quantity)) {
      toast.error(`Only ${Number(drugItem.quantity)} ${drugItem.unit} in stock`); return;
    }
    setBusy(true);
    try {
      if (editingLogId) {
        /**
         * EDITING an existing entry — same panel, same fields. Only the entry's
         * own data is patched: the drug it dispensed is a separate consumable
         * line with its own edit control, and re-logging it here would deduct
         * the stock a second time.
         */
        await inpatientAPI.updateLog(editingLogId, { data: { ...logData } });
        toast.success('Entry updated');
        setLogData({});
        resetDrug();
        setEditingLogId(null);
        setOpenEditorDay(null);
        await load();
        onChanged?.();
        return;
      }
      await inpatientAPI.addLog(hospId, { kind: logKind, status: isTask(logKind) ? 'due' : undefined, data: { ...logData }, ...(backfillAt ? { loggedAt: new Date(backfillAt).toISOString() } : {}) } as any);
      const apptId = h?.billing?.appointmentId;
      if (logKind === 'MEDICATION' && drugItem && apptId && drugQty > 0) {
        try {
          await consumablesAPI.log(apptId, {
            inventoryItemId: drugItem.id,
            quantity: drugQty,
            billable: drugBillable,
            unitPrice: drugBillable ? Number(drugItem.price) : undefined,
            notes: 'MAR',
            recordedAt: backfillAt ? new Date(backfillAt).toISOString() : undefined,
          });
          updateInventoryOptimistically(String(drugItem.id), (it: any) => ({ ...it, quantity: Number(it.quantity) - drugQty }));
          setConsRefresh(n => n + 1);
          toast.success(`${drugItem.name} · ${drugQty} ${drugItem.unit} deducted${drugBillable ? ` · KES ${(Number(drugItem.price) * drugQty).toLocaleString()}` : ''}`);
        } catch (e: any) { toast.error(e?.message || 'Logged, but stock deduction failed'); }
      }
      setLogData({});
      resetDrug();
      // Close the editor — what you just recorded is now shown as a summary
      // below, not as a form still waiting for input.
      setOpenEditorDay(null);
      await load();
      onChanged?.();
    } finally { setBusy(false); }
  };

  /** Reopen the SAME panel, prefilled, to correct an entry. */
  const startEditLog = (dayKey: string, log: { id: string; kind: string; data: Record<string, any> }) => {
    setOpenEditorDay(dayKey);
    setEditingLogId(log.id);
    setLogKind(log.kind as LogKind);
    setLogData({ ...(log.data || {}) });
    resetDrug();
  };

  const cancelEditor = () => {
    setOpenEditorDay(null);
    setEditingLogId(null);
    setLogData({});
    resetDrug();
  };

  const toggleTask = async (logId: string, status: string | null) => {
    await inpatientAPI.updateLog(logId, { status: status === 'done' ? 'due' : 'done' });
    await load();
  };

  const doDischarge = async (reminder: ReminderDraft | null) => {
    setBusy(true);
    try {
      const res = await inpatientAPI.discharge(hospId, {
        outcome: discharge.outcome, dischargeNotes: discharge.dischargeNotes || undefined,
        homeInstructions: discharge.homeInstructions || undefined,
        finalWeight: discharge.finalWeight ? Number(discharge.finalWeight) : undefined,
        dischargeReason: discharge.dischargeReason.trim() || undefined,
        reminder,
      });
      if (res.success) {
        setShowDischargeGate(false);
        onChanged?.();
        const apptId = (res.data as any)?.appointmentId || h?.billing?.appointmentId || h?.appointmentId;
        if (apptId) onOpenAppointment?.(String(apptId), false);
        else onBack();
      }
    } finally { setBusy(false); }
  };

  const F = (key: string, ph: string) => <input className={fieldCls} placeholder={ph} value={logData[key] || ''} onChange={e => setLogData(s => ({ ...s, [key]: e.target.value }))} />;

  const drugMatches = (() => {
    const q = (logData.drug || '').trim().toLowerCase();
    if (!q || drugItem) return [] as any[];
    return inventory.filter((i: any) => `${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q)).slice(0, 6);
  })();
  const pickDrug = (i: any) => {
    setDrugItem(i);
    setDrugQty(stepFor(i.unit));
    setDrugBillable(i.billable !== false);
    setLogData(s => ({ ...s, drug: i.name }));
  };
  const drugOverStock = drugItem ? drugQty > Number(drugItem.quantity) : false;

  const medicationFields = () => (
    <div className="space-y-2">
      <div className="relative">
        <input className={fieldCls} placeholder="Drug — search inventory or type a name"
          value={logData.drug || ''}
          onChange={e => { setLogData(s => ({ ...s, drug: e.target.value })); if (drugItem) resetDrug(); }} />
        {drugMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg overflow-hidden">
            {drugMatches.map((i: any) => (
              <button type="button" key={i.id} onClick={() => pickDrug(i)} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span>
                  <span className="block text-[9px] text-slate-400">{Number(i.quantity)} {i.unit} in stock{i.billable === false ? ' · non-billable' : ''}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 shrink-0">KES {Number(i.price).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">{F('dose', 'Dose (e.g. 5 mg/kg)')}{F('route', 'Route (IV/IM/SC/PO)')}</div>
      {drugItem && (
        <div className="flex flex-wrap items-end gap-2 p-2 bg-seafoam/5 border border-seafoam/30 rounded-lg">
          <div>
            <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-0.5">Deduct ({drugItem.unit})</label>
            <input type="number" min={0} step={stepFor(drugItem.unit)} value={drugQty} onChange={e => setDrugQty(Number(e.target.value))}
              className="w-20 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
          </div>
          <button type="button" onClick={() => setDrugBillable(b => !b)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${drugBillable ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
            {drugBillable ? 'Billable' : 'Non-billable'}
          </button>
          <button type="button" onClick={resetDrug} className="px-2 py-1.5 text-[9px] font-bold text-slate-400 hover:text-rose-500">Clear</button>
          <span className="ml-auto text-[9px] font-bold text-slate-400">deducts stock{drugBillable ? ` · KES ${(Number(drugItem.price) * drugQty).toLocaleString()}` : ''}</span>
          {drugOverStock && <p className="w-full text-[9px] font-bold text-rose-500">Only {Number(drugItem.quantity)} {drugItem.unit} in stock</p>}
        </div>
      )}
    </div>
  );

  const logFields = () => {
    switch (logKind) {
      case 'TREATMENT_TASK': return F('task', 'Task (e.g. flush catheter)');
      case 'MEDICATION': return medicationFields();
      case 'FLUID_INTAKE': return <div className="grid grid-cols-2 gap-2">{F('type', 'Type (LRS, NaCl…)')}{F('amount', 'Amount (ml)')}</div>;
      case 'FLUID_OUTPUT': return <div className="grid grid-cols-2 gap-2">{F('type', 'Urine / Vomit / Diarrhea')}{F('amount', 'Amount (ml)')}</div>;
      case 'FEEDING': return <div className="grid grid-cols-3 gap-2">{F('food', 'Food')}{F('offered', 'Offered')}{F('eaten', 'Eaten')}</div>;
      case 'ELIMINATION': return <div className="grid grid-cols-2 gap-2">{F('urination', 'Urination')}{F('defecation', 'Defecation')}</div>;
      default: return <textarea className={fieldCls} rows={2} placeholder="Note" value={logData.note || ''} onChange={e => setLogData(s => ({ ...s, note: e.target.value }))} />;
    }
  };

  const active = h?.status === 'ADMITTED';

  /**
   * Reopen a discharged admission so it can be corrected (2026-08-23).
   *
   * A stay discharged with no rate bills KES 0 and there was no way back: the
   * visit was COMPLETED, so every charge path refused. The server refuses once
   * the visit is PAID — that is the `BILLED ⇒ RECORD LOCKED` rule, and the way
   * past it is voiding the payment, deliberately not this button.
   */
  const reopenAdmission = useCallback(async () => {
    const ok = await dialog.confirm({
      title: 'Reopen this admission?',
      message: 'It goes back to ADMITTED and its visit reopens so charges can be corrected. Discharge again when you are done.',
      confirmLabel: 'Reopen',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await inpatientAPI.reopen(hospId);
      if (r.success) { toast.success('Admission reopened'); await load(); onChanged?.(); }
    } finally { setBusy(false); }
  }, [hospId, load, onChanged]);

  /** Re-run the server's days × rate calculation onto the visit's bill. */
  const recalcCharge = useCallback(async () => {
    const r = await inpatientAPI.bill(hospId, null);
    if (r.success) { toast.success('Charge recalculated'); await load(); onChanged?.(); }
  }, [hospId, load, onChanged]);

  const saveDailyRate = useCallback(async (rate: number) => {
    const r = await inpatientAPI.update(hospId, { dailyRate: rate } as any);
    if (r.success) { toast.success('Daily rate updated'); await load(); onChanged?.(); }
  }, [hospId, load, onChanged]);
  const billOutstanding = !!h?.billing && !h.billing.isPaid && (h.billing.totalCost ?? 0) > 0;

  return (
    <div className={`space-y-5 animate-in fade-in duration-300 ${embedded ? '' : 'pb-20'}`}>
      {/* Header — Lab-style back link + pine banner (link hidden when the
          page is embedded in the visit wizard's Admission step) */}
      {!embedded && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
          <ArrowLeft size={13} /> Inpatient
        </button>
      )}
      {/* PATIENT HEADER — STICKY, and CONDENSED once you scroll (user, 2026-08-04).
          Who the patient is must never scroll away on a clinical chart: every
          vital and every drug on the sheet below is recorded against this
          animal, and "which patient am I looking at?" is the one question the
          page must always answer.
          It condenses rather than pinning at full height because the budget is
          tight — nav 4rem + this + the pinned Discharge bar are all permanently
          off the chart. Full banner at rest, one line once moving.
          `top-16` clears the fixed 4rem navbar; z stays below its z-[60].
          NOT sticky when embedded in the wizard — the wizard owns its own
          chrome and a second pinned header would stack. */}
      {/* This page is where the sticky/condensing header was designed; it now
          uses the SHARED component so there is one implementation rather than
          two that drift. RELEASE is deliberately NOT here — it moved into the
          rail as a labelled control (user, 2026-08-04). */}
      <RecordPageHeader
        icon={Stethoscope}
        eyebrow="Inpatient chart"
        embedded={embedded}
        title={<><Dog size={16} /> {h?.pet?.name ?? '…'}</>}
        condensedMeta={h ? `${h.cage ? `· Cage ${h.cage}` : ''} ${h.inpatientNo || ''}` : ''}
        subtitle={h ? `${h.cage ? `Cage ${h.cage} · ` : ''}${h.inpatientNo || ''} · ${h.diagnosis || 'No diagnosis'}` : undefined}
        right={<>
          {/* RUNNING TOTAL — stay + food + consumables, every day, in one place.
              The per-day line already showed "stay X + items Y" but only for
              the day you were looking at, and the rail's accrual covered the
              STAY alone — so the one number staff actually want (what this
              admission has cost so far) existed nowhere (user, 2026-08-13).
              ⚠️ Same nights-based rule as the day rows: the final calendar day
              of a multi-day stay starts no new night, so it accrues no rate. */}
          {h && (() => {
            // Nights, not calendar days — the same rule the day rows and the
            // bill use, so this total can never disagree with them.
            /**
             * ⚠️ Two bugs lived in this one line (2026-08-23).
             *
             * 1. `calendarDaysBetween(h.admittedAt)` defaults its end to NOW, so
             *    a DISCHARGED admission kept accruing nights forever — a stay
             *    closed last week quoted this week's total.
             * 2. No fallback to the clinic's `inpatientDayRate`, so an admission
             *    where nobody typed a rate showed "stay KES 0" and looked free
             *    (user, 2026-08-23). Boarding already falls back; inpatient did
             *    not, which is why only this page showed zero.
             */
            const nights = Math.max(1, calendarDaysBetween(h.admittedAt, h.dischargedAt ?? undefined));
            const rate = Number(h.dailyRate ?? clinicDayRate ?? 0) || 0;
            const stayTotal = nights * rate;
            const itemsTotal = (consumables || []).reduce((sum: number, c: any) => sum + (c.billable
              ? Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0))
              : 0), 0);
            const money = (n: number) => `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            return (
              <span className="px-3 py-1.5 rounded-xl bg-white/15 border border-white/20 text-white text-right leading-tight">
                <span className="block text-[8px] font-black uppercase tracking-widest text-white/70">Charges so far</span>
                <span className="block text-sm font-black font-mono">{money(stayTotal + itemsTotal)}</span>
                <span className="block text-[8px] font-bold text-white/70">
                  stay {money(stayTotal)} + food &amp; items {money(itemsTotal)}
                </span>
              </span>
            );
          })()}
          {h && !active && (
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[9px] font-black uppercase tracking-widest">
              Discharged {h.dischargedAt ? formatDate(h.dischargedAt) : ''}{h.outcome ? ` · ${h.outcome}` : ''}
            </span>
          )}
          {/* Billing state of the linked visit — mirrors the Lab page. */}
          {h?.billing && (h.billing.isPaid || ['PENDING_PAYMENT', 'COMPLETED'].includes(String(h.billing.status))) && (
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[9px] font-black uppercase tracking-widest">
              {h.billing.isPaid ? '🔒 Bill settled — locked' : '💰 Billed — awaiting payment'}
            </span>
          )}
        </>}
      />

      {loading && !h ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : h ? (
        <div className={pane ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-3 gap-4 items-start'}>
          {/* MAIN — vitals + daily sheet */}
          <div className={`${pane ? (pane === 'chart' ? '' : 'hidden') : 'lg:col-span-2'} space-y-4`}>
            {/* Vitals */}
            <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              {/* ⚠️ Yes, a reading appears here AND on its day below — and that
                  is the point, not an oversight (user, 2026-08-22: "n that is
                  duplicate or?"). These answer different questions: this table
                  is the TREND across the whole stay, newest first, for spotting
                  a climbing temperature at a glance; the day card shows the same
                  reading beside the entry it was taken with. The heading says so
                  rather than leaving two identical-looking lists to be
                  reconciled by the reader. */}
              <div className="flex flex-wrap items-baseline gap-2 mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5"><Thermometer size={13} /> Monitoring (TPR)</p>
                <span className="text-[9px] font-bold text-slate-400">
                  Trend across the whole stay · last {Math.min(8, (h.vitals || []).length)} — each reading also shows on its own day below
                </span>
              </div>
              {/* The TPR inputs moved into the daily sheet, onto the day you are
                  filling (user, 2026-08-04: "move them to daily log similar to
                  boarding"). Recording is per-day; this stays the read-across. */}
              {h.vitals && h.vitals.length > 0 ? (
                <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr className="text-slate-400 text-left"><th className="py-1">Time</th><th>T</th><th>P</th><th>R</th><th>Wt</th><th>MM</th><th>CRT</th><th /></tr></thead>
                  <tbody>{h.vitals.slice(-8).reverse().map(v => <tr key={v.id} className="border-t border-slate-100 dark:border-zinc-800 text-pine dark:text-zinc-200"><td className="py-1 whitespace-nowrap">
                    {/* DATE as well as time (user, 2026-08-23). This table spans
                        the WHOLE stay, so "08:50 pm" alone cannot say which day
                        it belongs to — on a five-day admission that is the only
                        thing that makes the trend readable. */}
                    <span className="font-bold text-pine dark:text-zinc-200">{formatDate(v.recordedAt)}</span>
                    <span className="text-slate-400"> {formatTime(v.recordedAt)}</span>
                  </td><td>{v.temperature ?? '—'}</td><td>{v.pulse ?? '—'}</td><td>{v.respiration ?? '—'}</td><td>{v.weight ?? '—'}</td><td>{v.mucousMembrane ?? '—'}</td><td>{v.crt ?? '—'}</td><td className="text-right">{!h.dischargedAt && (
                    <button type="button" title="Delete this vitals entry" disabled={removing === `v-${v.id}`} onClick={() => removeVital(v.id)}
                      className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40">
                      {removing === `v-${v.id}` ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  )}</td></tr>)}</tbody></table></div>
              ) : <p className="text-[10px] text-slate-400">No vitals recorded.</p>}
            </section>

            {/* The standalone "Add to daily sheet" form is GONE — it lived at
                the top of the page while the sheet it wrote to was a scroll
                below, and "Fill this day" had to scroll you back up to it. Every
                field now sits INSIDE the day you are filling, boarding-style
                (user, 2026-08-04). */}
            {/* Daily sheet timeline */}
            <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Daily sheet — admission to {h.dischargedAt ? 'discharge' : 'today'}</p>
              {/* Per-day reconciliation (user, 2026-08-02): EVERY calendar day of the
                  stay renders, newest first — a day with nothing logged shows its
                  blank fields, so a missed day is visible instead of silently absent
                  and the stay can be reconciled by hand against the bill. */}
              {(() => {
                const dayKey = (d: string | Date) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
                const start = new Date(h.admittedAt); start.setHours(0, 0, 0, 0);
                const end = new Date(h.dischargedAt ?? Date.now()); end.setHours(0, 0, 0, 0);
                const days: Date[] = [];
                for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) days.push(new Date(d));
                const logsByDay = new Map<string, any[]>();
                (h.logs || []).forEach(l => { const k = dayKey(l.loggedAt); logsByDay.set(k, [...(logsByDay.get(k) || []), l]); });
                const vitalsByDay = new Map<string, number>();
                // The ROWS too, not just how many: a vitals reading belongs to
                // the entry it was taken with, so it has to be groupable.
                const vitalRowsByDay = new Map<string, any[]>();
                (h.vitals || []).forEach(v => {
                  const k = dayKey(v.recordedAt);
                  vitalsByDay.set(k, (vitalsByDay.get(k) || 0) + 1);
                  vitalRowsByDay.set(k, [...(vitalRowsByDay.get(k) || []), v]);
                });
                const BLANK_FIELDS = ['Vitals', 'Medication (MAR)', 'Feeding', 'Fluids', 'Nursing note'];
                const consByDay = new Map<string, any[]>();
                consumables.forEach(c => { const ck = dayKey(c.createdAt); consByDay.set(ck, [...(consByDay.get(ck) || []), c]); });
                const rate = Number(h.dailyRate ?? 0);
                const fmtK = (n: number) => `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                // Auto-generated day tabs — same as the boarding care log. A long
                // admission was a wall of stacked day cards to scroll past.
                const todayK = dayKey(new Date());
                const selKey = (careDay && days.some(d => dayKey(d) === careDay))
                  ? careDay
                  : (days.some(d => dayKey(d) === todayK) ? todayK : dayKey(days[days.length - 1]));

                return (
                  <div className="space-y-3">
                    <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1">
                      {days.map((d, i) => {
                        const k = dayKey(d);
                        const has = (logsByDay.get(k) || []).length > 0 || (vitalsByDay.get(k) || 0) > 0 || (consByDay.get(k) || []).length > 0;
                        const sel = k === selKey;
                        return (
                          <button
                            key={k} type="button"
                            onClick={() => {
                              setCareDay(k);
                              // Bind the record-as time to the day you opened, so
                              // everything typed below lands on THAT day. Today
                              // means "now" (null), any past day noon.
                              setBackfillAt(k === todayK ? null : `${k}T12:00`);
                            }}
                            className={`shrink-0 px-3 py-1.5 rounded-xl border text-left transition-all ${sel
                              ? 'bg-seafoam text-white border-seafoam shadow-sm'
                              : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-seafoam/50'}`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-widest">Day {i + 1}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${has ? (sel ? 'bg-white' : 'bg-emerald-500') : (sel ? 'bg-white/40' : 'bg-slate-300 dark:bg-zinc-700')}`} />
                            </span>
                            <span className={`block text-[8px] font-bold ${sel ? 'text-white/80' : 'text-slate-400'}`}>
                              {k === todayK ? 'Today' : formatDate(d)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {days.slice().reverse().map((d, ri) => {
                      const k = dayKey(d);
                      const dayNo = days.length - ri;
                      // Only the selected tab renders; the list is still walked
                      // so dayNo and the nights-based rate stay correct.
                      if (k !== selKey) return null;
                      const logs = logsByDay.get(k) || [];
                      const vitalsCount = vitalsByDay.get(k) || 0;
                      const dayVitals = vitalRowsByDay.get(k) || [];
                      const dayCons = consByDay.get(k) || [];
                      const itemsCost = dayCons.reduce((sum, c) => sum + (c.billable ? Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0)) : 0), 0);
                      // Stay charges are NIGHTS-based (calendarDaysBetween, min 1): the
                      // final calendar day of a multi-day stay starts no new night, so it
                      // shows stay KES 0 — matching what the bill accrues.
                      const dayRate = (days.length === 1 || dayNo < days.length) ? rate : 0;
                      const dayTotal = dayRate + itemsCost;
                      const empty = logs.length === 0 && vitalsCount === 0 && dayCons.length === 0;
                      return (
                        <div key={k}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-200">Day {dayNo} · {formatDate(d)}</span>
                            {empty && <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">Nothing recorded</span>}
                            {/* Charges shown for EVERY day, even zero (user) — stay rate + billed items. */}
                            <span className="ml-auto text-[9px] font-black text-emerald-600 dark:text-emerald-400">{fmtK(dayTotal)}<span className="text-slate-400 font-bold"> · stay {fmtK(dayRate)} + items {fmtK(itemsCost)}</span></span>
                          </div>

                          {/* ── THE day's editor. Everything that used to live in
                              two cards at the top of the page: TPR, every entry
                              kind, and the items used — all stamped with this
                              day's date. */}
                          {/* Closed by default — press to write. Leaving the
                              whole form open under every day meant the thing
                              you had just saved was buried under the form that
                              saved it. */}
                          {active && openEditorDay !== k && (
                            <button
                              type="button"
                              onClick={() => { setOpenEditorDay(k); setEditingLogId(null); setLogData({}); resetDrug(); }}
                              className="mb-3 w-full py-2 rounded-xl border border-dashed border-seafoam/40 bg-seafoam/[0.03] text-seafoam font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-seafoam/10 transition-colors"
                            >
                              <Plus size={13} /> Record on day {dayNo}
                            </button>
                          )}

                          {active && openEditorDay === k && (
                            <div className="mb-3 rounded-xl border border-seafoam/30 bg-seafoam/[0.04] dark:bg-seafoam/[0.06] p-3 space-y-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-seafoam">
                                  {editingLogId ? `Editing entry · day ${dayNo}` : `Record on day ${dayNo}`}
                                </span>
                                <button type="button" onClick={cancelEditor} title="Close without saving"
                                  className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-rose-500">
                                  <X size={13} />
                                </button>
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-auto">Time</label>
                                <input type="datetime-local" className={fieldCls + ' !w-auto'}
                                  value={backfillAt || ''} onChange={e => setBackfillAt(e.target.value || null)} />
                                {k === todayK && (
                                  <button type="button" onClick={() => setBackfillAt(null)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${backfillAt ? 'bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 border-slate-200 dark:border-zinc-700' : 'bg-seafoam/10 text-seafoam border-seafoam/30'}`}>Now</button>
                                )}
                              </div>

                              {/* Vitals (TPR) */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Monitoring (TPR)</p>
                                {/* PERSISTENT LABELS, not placeholders (2026-08-05).
                                    A placeholder disappears the moment you type, so six
                                    bare numbers were left with nothing saying which was
                                    which — on a clinical chart a value in the wrong box
                                    is invisible, and these feed the patient's record. */}
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                  {([
                                    ['Temp °C', 'temperature'], ['Pulse', 'pulse'], ['Resp', 'respiration'],
                                    ['Wt kg', 'weight'], ['MM', 'mucousMembrane'], ['CRT', 'crt'],
                                  ] as const).map(([label, key]) => (
                                    <label key={key} className="block">
                                      <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</span>
                                      <input className={fieldCls} value={(vital as any)[key]}
                                        onChange={e => setVital(s => ({ ...s, [key]: e.target.value }))} />
                                    </label>
                                  ))}
                                </div>
                                <button onClick={addVital} disabled={busy || !vitalHasValue}
                                  title={vitalHasValue ? undefined : 'Record at least one reading first'}
                                  className="mt-1.5 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-seafoam/10 text-seafoam rounded-lg text-[9px] font-black uppercase tracking-widest border border-seafoam/30 disabled:opacity-50">
                                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add vitals
                                </button>
                              </div>

                              {/* Every entry kind, chips not a dropdown. */}
                              <div className="pt-2 border-t border-seafoam/20">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Daily sheet entry</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {LOG_KINDS.map(kk => (
                                    <button key={kk.value} type="button"
                                      onClick={() => { setLogKind(kk.value); setLogData({}); resetDrug(); }}
                                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                                        logKind === kk.value
                                          ? 'bg-seafoam text-white border-seafoam shadow-sm'
                                          : 'bg-white dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:text-seafoam'
                                      }`}>
                                      {kk.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-2 space-y-2">{logFields()}</div>
                                {/* OUTLINE, not a solid full-width bar (2026-08-05). Add entry is the
                                    most REPEATED action on the page; Discharge is the
                                    irreversible one. A solid accent bar here made the
                                    routine action the loudest thing on screen and left
                                    the terminal action whispering — hierarchy inverted. */}
                                {/* ABOVE "Add entry", not below it. What you are
                                    injecting or administering IS part of the
                                    entry you are writing, so it has to be in
                                    the form you are filling — sitting under the
                                    button read as a separate, unrelated panel
                                    (user, 2026-08-05: "Consumables need to be
                                    above add entry … are for that entry").
                                    `flat` so it doesn't add a card inside the
                                    entry card. */}
                                {/* Hidden while EDITING: this picker logs a new
                                    consumable for the day, it does not belong to
                                    the entry being corrected. Leaving it open
                                    invited a second deduction for a dose that was
                                    only being reworded. Items already logged have
                                    their own edit control in the list below. */}
                                {h.billing?.appointmentId && !editingLogId && (
                                  <div className="mt-3 pt-3 border-t border-seafoam/20">
                                    <ConsumablePicker flat hideLoggedList appointmentId={h.billing.appointmentId}
                                      dayKey={k}
                                      recordedAt={backfillAt ? new Date(backfillAt).toISOString() : null}
                                      onChanged={() => { setConsRefresh(n => n + 1); load(); onChanged?.(); }}
                                      title="Given / administered with this entry" />
                                  </div>
                                )}

                                <div className="mt-3 flex items-center gap-2">
                                  <button onClick={cancelEditor} type="button"
                                    className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">
                                    Cancel
                                  </button>
                                  <button onClick={addLog} disabled={busy} className="flex-1 py-2 bg-white dark:bg-zinc-900 hover:bg-seafoam/10 text-seafoam border border-seafoam/40 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50">
                                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {editingLogId ? 'Save changes' : 'Add entry'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {empty ? (
                            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800">
                              {BLANK_FIELDS.map(f => (
                                <span key={f} className="text-[9px] text-slate-400"><span className="font-bold">{f}:</span> —</span>
                              ))}
                              {active && (
                                <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-slate-400">Fill it below ↓</span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {(() => {
                                /**
                                 * ONE CARD PER MOMENT (user, 2026-08-22: "an entry
                                 * is all together, not vitals separate from the
                                 * entry … entry in one card").
                                 *
                                 * ⚠️ HOW THINGS ARE GROUPED — and its limit.
                                 * Nothing in the database links a vitals reading or
                                 * a dispensed item to the log entry it was saved
                                 * with; they are three tables that only share a
                                 * timestamp. So grouping is BY TIME: a vital or an
                                 * item joins the nearest entry recorded within two
                                 * minutes of it.
                                 *
                                 * Entries themselves are NEVER merged with each
                                 * other — two entries a minute apart are two
                                 * entries, and folding them together would invent a
                                 * record nobody wrote. Anything with no entry
                                 * nearby keeps its own card, so nothing is hidden
                                 * by failing to match.
                                 */
                                const WINDOW = 2 * 60 * 1000;
                                const ms = (t: any) => { const d = new Date(t); return isNaN(d.getTime()) ? 0 : d.getTime(); };

                                type Group = { at: number; log?: any; vitals: any[]; items: any[] };
                                const groups: Group[] = logs
                                  .map(l => ({ at: ms(l.loggedAt), log: l, vitals: [] as any[], items: [] as any[] }))
                                  .sort((x, y) => x.at - y.at);

                                const nearest = (t: number) => {
                                  let best: Group | null = null;
                                  let bestGap = Infinity;
                                  for (const g of groups) {
                                    const gap = Math.abs(g.at - t);
                                    if (gap <= WINDOW && gap < bestGap) { best = g; bestGap = gap; }
                                  }
                                  return best;
                                };

                                const orphanVitals: any[] = [];
                                for (const v of dayVitals) {
                                  const g = nearest(ms(v.recordedAt));
                                  if (g) g.vitals.push(v); else orphanVitals.push(v);
                                }
                                const orphanItems: any[] = [];
                                for (const c of dayCons) {
                                  const g = nearest(ms((c as any).createdAt ?? (c as any).recordedAt));
                                  if (g) g.items.push(c); else orphanItems.push(c);
                                }
                                for (const v of orphanVitals) groups.push({ at: ms(v.recordedAt), vitals: [v], items: [] });
                                for (const c of orphanItems) groups.push({ at: ms((c as any).createdAt ?? (c as any).recordedAt), vitals: [], items: [c] });
                                groups.sort((x, y) => x.at - y.at);

                                const VITAL_COLS: Array<[string, string]> = [
                                  ['Temp', 'temperature'], ['Pulse', 'pulse'], ['Resp', 'respiration'],
                                  ['Wt', 'weight'], ['MM', 'mucousMembrane'], ['CRT', 'crt'],
                                ];

                                return groups.map((g, gi) => {
                                  const l = g.log;
                                  const fields = l
                                    ? logFieldsFor(l.kind)
                                        .map(([key, label, suffix]) => [label, l.data?.[key], suffix] as const)
                                        .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
                                    : [];
                                  const isEditing = !!l && editingLogId === l.id;
                                  return (
                                    <div key={l ? `l-${l.id}` : `g-${gi}`}
                                      className={`rounded-lg border overflow-hidden ${isEditing
                                        ? 'bg-seafoam/10 border-seafoam/40'
                                        : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800'}`}>
                                      {/* Header — time on EVERY card, whatever it holds. */}
                                      <div className="flex items-center gap-2 px-3 py-2">
                                        {l && isTask(l.kind) ? (
                                          <button onClick={() => toggleTask(l.id, l.status)} title={l.status === 'done' ? 'Done — click to reopen' : 'Due — click to mark done'} className="shrink-0">{l.status === 'done' ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Circle size={15} className="text-amber-500" />}</button>
                                        ) : <Activity size={13} className="text-seafoam shrink-0" />}
                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                          {l ? (LOG_KINDS.find(kk => kk.value === l.kind)?.label) : (g.vitals.length ? 'Vitals' : 'Items')}
                                        </span>
                                        {l?.status === 'done' && (
                                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Done</span>
                                        )}
                                        <span className="ml-auto text-[9px] text-slate-400 shrink-0">
                                          {formatTime(l ? l.loggedAt : (g.vitals[0]?.recordedAt ?? (g.items[0] as any)?.createdAt))}
                                        </span>
                                        {active && l && (
                                          <>
                                            <button type="button" title="Edit this entry"
                                              onClick={() => (isEditing ? cancelEditor() : startEditLog(k, { id: l.id, kind: l.kind, data: l.data || {} }))}
                                              className="shrink-0 p-1 rounded-md text-slate-300 hover:text-seafoam hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                                              <Pencil size={11} />
                                            </button>
                                            <button type="button" title="Delete this entry" disabled={removing === `l-${l.id}`}
                                              onClick={() => removeLog({ id: l.id, kind: l.kind })}
                                              className="shrink-0 p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40">
                                              {removing === `l-${l.id}` ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                            </button>
                                          </>
                                        )}
                                      </div>

                                      {l && (fields.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 px-3 pb-2 pl-[34px]">
                                          {fields.map(([label, value, suffix]) => (
                                            <div key={label} className="min-w-0">
                                              <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                                              <span className="block text-[11px] font-bold text-pine dark:text-zinc-200 break-words">
                                                {String(value)}{suffix ? ` ${suffix}` : ''}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="px-3 pb-2 pl-[34px] text-[10px] text-slate-400 italic">Nothing recorded on this entry.</p>
                                      ))}

                                      {/* Vitals taken with it — inside the card, not
                                          a separate strip pointing at a table. */}
                                      {g.vitals.map(v => (
                                        <div key={`v-${v.id}`} className="flex items-center gap-2 px-3 py-1.5 border-t border-slate-100 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40">
                                          <Thermometer size={11} className="text-seafoam shrink-0" />
                                          <span className="min-w-0 flex-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                                            {VITAL_COLS.filter(([, key]) => v[key] != null && String(v[key]).trim() !== '').map(([label, key]) => (
                                              <span key={key} className="text-[10px] text-pine dark:text-zinc-200">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label} </span>
                                                <strong>{String(v[key])}</strong>
                                              </span>
                                            ))}
                                          </span>
                                          <span className="text-[9px] text-slate-400 shrink-0">{formatTime(v.recordedAt)}</span>
                                          {active && (
                                            <button type="button" title="Delete this vitals reading" disabled={removing === `v-${v.id}`}
                                              onClick={() => removeVital(v.id)}
                                              className="shrink-0 p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40">
                                              {removing === `v-${v.id}` ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                            </button>
                                          )}
                                        </div>
                                      ))}

                                      {/* Items given with it. */}
                                      {g.items.map(c => {
                                        const fees = Object.entries(((c.inventoryItem as any)?.fees) || {})
                                          .filter(([, v]) => v != null && Number(v) > 0);
                                        return (
                                          <div key={`c-${c.id}`} className="flex items-center gap-2 px-3 py-1.5 border-t border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 shrink-0">Item</span>
                                            <span className="min-w-0 flex-1">
                                              <span className="block text-[10px] text-pine dark:text-zinc-200 truncate">
                                                {c.inventoryItem?.name} × {Number(c.quantity)} {c.inventoryItem?.unit || ''}
                                              </span>
                                              {c.billable && (
                                                <span className="block text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                                                  {fmtK(Number(c.unitPrice) || 0)} × {Number(c.quantity)} {c.inventoryItem?.unit || ''}
                                                </span>
                                              )}
                                              {fees.length > 0 && c.billable && (
                                                <span className="block text-[9px] font-bold text-violet-600 dark:text-violet-400">
                                                  Carries {fees.map(([k2, v]) => `${k2} ${fmtK(Number(v))}`).join(' · ')} — own bill line
                                                </span>
                                              )}
                                            </span>
                                            <span className="text-[9px] text-slate-400 shrink-0">{formatTime((c as any).createdAt)}</span>
                                            <span className="text-[9px] font-black text-emerald-600 shrink-0">{c.billable ? fmtK(Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0))) : 'no charge'}</span>
                                            {active && (
                                              <button type="button" title={`Remove ${c.inventoryItem?.name ?? 'this item'} — returns the stock and drops the charge`}
                                                disabled={removing === `c-${c.id}`} onClick={() => removeConsumable(String(c.id), c.inventoryItem?.name)}
                                                className="shrink-0 p-1 rounded-md text-emerald-600/60 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40">
                                                {removing === `c-${c.id}` ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>

            {/* Consumables moved into the day's editor above — logging an item
                is part of that day's care, not a separate card below it. */}

            {/* Stay notes + notes format in ONE card at the BOTTOM, mirroring
                the boarding stay page (user, 2026-08-06: "update same to
                inpatiant"). The format toggle styles the note it sits under,
                and on its own it was a whole bordered frame around two chips. */}
            <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              {/* admissionNotes and dischargeNotes are both moment-in-time, so
                  anything true of the WHOLE stay had nowhere to live and was
                  landing on whichever day happened to be open. */}
              <div className="space-y-1.5">
                <label className="field-label">Stay notes</label>
                <textarea
                  className="field-textarea"
                  rows={3}
                  disabled={!!h.dischargedAt}
                  placeholder="Anything about the whole stay — not tied to one day"
                  value={notesDraft}
                  onChange={e => { setNotesDraft(e.target.value); setNotesDirty(true); }}
                />
                {notesDirty && !h.dischargedAt && (
                  <button
                    type="button"
                    disabled={notesSaving}
                    onClick={async () => {
                      setNotesSaving(true);
                      try {
                        await inpatientAPI.update(hospId, { notes: notesDraft } as any);
                        setNotesDirty(false);
                        toast.success('Stay notes saved');
                        await load(); onChanged?.();
                      } catch (e: any) { toast.error(e?.message || 'Could not save the notes'); }
                      finally { setNotesSaving(false); }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                    {notesSaving ? 'Saving…' : 'Save notes'}
                  </button>
                )}
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                {/* No label here — NotesFormatToggle renders its own "Notes
                    format" heading, so the card was printing it twice. */}
                <NotesFormatToggle value={h.displayFormat || 'PARAGRAPH'} onChange={(v) => { inpatientAPI.update(hospId, { displayFormat: v }).then(() => { load(); onChanged?.(); }); }} />
              </div>
            </section>
          </div>

          {/* SIDE — admission context, actions, controls, discharge.
              STICKY (user, 2026-08-04): these are the actions and the reference
              you reach for WHILE reading the sheet, and the daily sheet is long
              enough to leave them far off-screen. `self-start` so the column
              takes its content height instead of stretching to the grid row —
              a stretched column can't stick. Its own `overflow-y-auto` because
              a long treatment plan would otherwise push the bottom of the rail
              (and Complexity) past the viewport with no way to reach it.
              lg only: on one column a sticky rail would cover the sheet. */}
          {/* As a TAB it is a full-width panel, so the sticky rail behaviour —
              which exists to keep it beside a long sheet — is dropped. */}
          <div className={pane ? (pane === 'plan' ? 'space-y-4' : 'hidden') : `space-y-4 ${STICKY_RAIL}`}>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              {h.admissionNotes && <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 text-xs text-slate-600 dark:text-zinc-300"><span className="font-black uppercase text-[9px] tracking-widest text-slate-400 mr-1.5">Admission</span>{h.admissionNotes}</div>}

              {/* EXPECTED DISCHARGE — moved out of the page header (user,
                  2026-08-04). A labelled control, not a naked input in a title
                  bar. This is also the date the early-discharge check reads. */}
              {active && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                    Expected discharge
                  </label>
                  <input
                    type="datetime-local"
                    className="field-input py-2 text-xs"
                    defaultValue={h.expectedDischargeAt ? (() => { const d = new Date(h.expectedDischargeAt!); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })() : ''}
                    onBlur={(e) => {
                      const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                      if ((v ?? null) === (h.expectedDischargeAt ?? null)) return;
                      inpatientAPI.update(hospId, { expectedDischargeAt: v }).then(() => { load(); onChanged?.(); });
                    }}
                  />
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-1">
                    Drives the checkout list on the dashboard. Blank means no planned date.
                  </p>
                </div>
              )}

              {(h.billing?.appointmentId || h.appointmentId) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onOpenAppointment?.((h.billing?.appointmentId || h.appointmentId)!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
                    <ExternalLink size={12} /> Open visit
                  </button>
                  {active && (
                    <button onClick={() => setShowGroomPicker(v => !v)} disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-300 dark:border-pink-900/50 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 transition-all disabled:opacity-50">
                      <Scissors size={12} /> Add grooming service
                    </button>
                  )}
                  <button onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
                    <Share2 size={12} /> Share{h.allowedClinicIds && h.allowedClinicIds.length > 0 ? ` · ${h.allowedClinicIds.length}` : ''}
                  </button>
                </div>
              )}

              {showGroomPicker && active && (
                <div className="rounded-xl border border-pink-200 dark:border-pink-900/40 bg-pink-50/50 dark:bg-pink-950/20 p-3 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-pink-600">Select grooming services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {groomServices.map(s => (
                      <button key={s.id} onClick={() => addGroomingService(s)} disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-pink-200 dark:border-pink-900/40 text-[10px] font-bold text-pine dark:text-zinc-100 hover:border-pink-400 transition-all disabled:opacity-50">
                        {s.name}{s.defaultPrice ? <span className="text-pink-500 font-mono">· {s.defaultPrice.toLocaleString()}</span> : null}
                      </button>
                    ))}
                    {groomServices.length === 0 && <span className="text-[10px] text-slate-400">No grooming services in your catalog yet.</span>}
                    <button onClick={() => addGroomingService()} disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-dashed border-pink-300 dark:border-pink-900/50 text-[10px] font-bold text-pink-600 hover:bg-pink-100 dark:hover:bg-pink-950/40 transition-all disabled:opacity-50">+ Custom</button>
                  </div>
                </div>
              )}

              {(h.intakeWeight != null || h.finalWeight != null) && (
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  {h.intakeWeight != null && <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500">Intake {h.intakeWeight} kg</span>}
                  {h.finalWeight != null && <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500">Discharge {h.finalWeight} kg</span>}
                  {h.weightChange != null && <span className={`px-2 py-1 rounded-lg ${h.weightChange >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>{h.weightChange >= 0 ? '+' : ''}{h.weightChange.toFixed(1)} kg</span>}
                </div>
              )}
              {/* The ORIGINAL free-text instructions. Kept visible rather than
                  dropped: 132 copied them into plan sections verbatim, and an
                  admission written before the structured plan must not look as
                  though it lost its instructions. */}
              {(h.feedingInstructions || h.medicationInstructions) && (
                <div className="space-y-1 text-[11px] text-slate-600 dark:text-zinc-300">
                  {h.feedingInstructions && <p><span className="font-black uppercase text-[9px] tracking-widest text-amber-600 mr-1.5">Feeding</span>{h.feedingInstructions}</p>}
                  {h.medicationInstructions && <p><span className="font-black uppercase text-[9px] tracking-widest text-indigo-500 mr-1.5">Meds</span>{h.medicationInstructions}</p>}
                </div>
              )}

              {/* Structured treatment plan (132) — sections the clinic names
                  itself, each holding planned meds / food / consumables. */}
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800">
                <TreatmentPlanPanel hospitalizationId={h.id} readOnly={!!h.dischargedAt} />
              </div>

              {/* Calendar dates crossed since admission — same maths as the
                  backend's computeNights. */}
              {/* Was a read-only "Accruing: N × rate" line that appeared ONLY
                  while active AND a rate was set — so the two cases you most
                  need it in, a discharged stay and one with no rate, showed
                  nothing at all. Now it always shows the working, and carries
                  the two actions to fix it. */}
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800">
                {(() => {
                  const days = Math.max(1, calendarDaysBetween(h.admittedAt, h.dischargedAt ?? undefined));
                  const ownRate = Number(h.dailyRate ?? 0) || 0;
                  const fallback = Number(clinicDayRate ?? 0) || 0;
                  const rate = ownRate || fallback;
                  const extras = (consumables || []).reduce((sum: number, c: any) => sum + (c.billable
                    ? Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0)) : 0), 0);
                  return (
                    <StayChargeCard
                      days={days}
                      rate={rate}
                      rateSource={ownRate ? 'record' : fallback ? 'clinic' : 'none'}
                      extras={extras}
                      locked={!active}
                      lockedReason="This admission is discharged. Reopen it to change the charge."
                      onSaveRate={saveDailyRate}
                      onRecalculate={recalcCharge}
                    />
                  );
                })()}
              </div>
              {/* ONE rail card (user, 2026-08-03: simpler) — complexity and
                  discharge fold in here instead of floating as their own cards. */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                <StandardRecordControls
                  complexity={{
                    value: h.complexity ?? null,
                    readOnly: !active,
                    onChange: (v) => { inpatientAPI.update(hospId, { complexity: v }).then(() => { load(); onChanged?.(); }); },
                  }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
              {active ? (
                !showDischarge ? (
                  /* Nothing rendered here on purpose. The trigger lives in the
                     PINNED bar, which is now always on screen, so the line that
                     used to say "Discharge from the bar at the bottom" was the
                     UI explaining where its own button is. Opening it reveals
                     the form right here. */
                  null
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200">Discharge</p>
                    <select className={fieldCls} value={discharge.outcome} onChange={e => setDischarge(s => ({ ...s, outcome: e.target.value as DischargeOutcome }))}>{OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}</select>
                    <input className={fieldCls} placeholder="Final weight (kg)" value={discharge.finalWeight} onChange={e => setDischarge(s => ({ ...s, finalWeight: e.target.value }))} />
                    <textarea className={fieldCls} rows={2} placeholder="Discharge notes" value={discharge.dischargeNotes} onChange={e => setDischarge(s => ({ ...s, dischargeNotes: e.target.value }))} />
                    <textarea className={fieldCls} rows={2} placeholder="Home instructions" value={discharge.homeInstructions} onChange={e => setDischarge(s => ({ ...s, homeInstructions: e.target.value }))} />

                    {/* EARLY-DISCHARGE GATE (user, 2026-08-04). Appears ONLY
                        when leaving before the expected date — on or after it,
                        and when no date was ever set, the reason is stamped
                        server-side and staff type nothing. The server enforces
                        this too; this is the affordance, not the rule. */}
                    {dischargeIsEarly && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                          Leaving before the expected date
                        </p>
                        <p className="text-[10px] text-slate-600 dark:text-zinc-400">
                          Expected {new Date(h.expectedDischargeAt!).toLocaleDateString()}. Say why the patient is going home early —
                          it is recorded on the chart.
                        </p>
                        <textarea
                          className={fieldCls} rows={2} autoFocus
                          placeholder="e.g. owner requested · improved faster than expected · referred out"
                          value={discharge.dischargeReason}
                          onChange={e => setDischarge(s => ({ ...s, dischargeReason: e.target.value }))}
                        />
                      </div>
                    )}

                    {billOutstanding && (
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Complete every service and settle the bill (KES {h.billing!.totalCost.toLocaleString()}) before discharge.</p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setShowDischarge(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
                      {billOutstanding ? (
                        <button onClick={() => doDischarge(null)} disabled={busy || dischargeBlocked} className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{dischargeBlocked ? 'Reason required' : 'Discharge & go to billing'}</button>
                      ) : (
                        <button onClick={() => doDischarge(null)} disabled={busy || dischargeBlocked} className="flex-1 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{busy ? 'Discharging…' : dischargeBlocked ? 'Reason required' : 'Confirm discharge'}</button>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discharged {h.dischargedAt ? formatDate(h.dischargedAt) : ''}{h.outcome ? ` · ${h.outcome}` : ''}</p>
                  {h.dischargedAt && (() => { const d = Math.max(1, calendarDaysBetween(h.admittedAt, h.dischargedAt)); return (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(h.admittedAt)} → {formatDate(h.dischargedAt)} · {d} day{d === 1 ? '' : 's'}</p>
                  ); })()}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      ) : <div className="p-10 text-center text-sm text-slate-400">Chart not found.</div>}

      {/* PINNED discharge — the chart's one terminal action. */}
      {h && active && !showDischarge && (
        <>
          <RecordActionBarSpacer />
          <RecordActionBar
            hint={billOutstanding ? 'Services or bill still open — discharge routes to billing' : undefined}
            actions={[
              { key: 'discharge', label: 'Discharge', icon: LogOut, onClick: () => setShowDischarge(true), primary: true },
              // See the boarding page — billing is the destination staff leave
              // for, and `settle: true` opens the visit ON the bill.
              ...((h.billing?.appointmentId || h.appointmentId) && onOpenAppointment ? [{
                key: 'billing', label: 'Go to billing', icon: Receipt, tone: 'seafoam' as const,
                onClick: () => onOpenAppointment(String(h.billing?.appointmentId || h.appointmentId), true),
              }] : []),
            ]}
          />
        </>
      )}

      {/* A closed admission needs its own bar — there was none, so a stay
          discharged at the wrong figure had no route back (user, 2026-08-23). */}
      {h && !active && h.status !== 'CANCELLED' && (
        <>
          <RecordActionBarSpacer />
          <RecordActionBar
            hint="Reopening restores the admission and its visit so charges can be corrected."
            actions={[
              { key: 'reopen', label: 'Reopen admission', icon: RotateCcw, onClick: reopenAdmission, primary: true, disabled: busy },
              ...((h.billing?.appointmentId || h.appointmentId) && onOpenAppointment ? [{
                key: 'billing', label: 'Go to billing', icon: Receipt, tone: 'seafoam' as const,
                onClick: () => onOpenAppointment(String(h.billing?.appointmentId || h.appointmentId), true),
              }] : []),
            ]}
          />
        </>
      )}

      <FinalizeReminderGate
        open={showDischargeGate}
        petName={h?.pet?.name ?? 'Patient'}
        clientName={h?.client?.name ?? 'Client'}
        encounterType="VET_VISIT"
        petDeceased={discharge.outcome === 'DECEASED'}
        submitting={busy}
        existing={h?.billing?.reminder ?? null}
        onCancel={() => setShowDischargeGate(false)}
        onConfirm={(reminder) => doDischarge(reminder)}
      />
      {showShare && h && (
        <ShareWithClinics recordType="inpatient" recordId={h.id} allowedClinicIds={h.allowedClinicIds}
          onClose={() => setShowShare(false)} onSaved={(ids) => setH(cur => cur ? { ...cur, allowedClinicIds: ids } : cur)} />
      )}
    </div>
  );
};

export default InpatientChartPage;

import React, { useState, useEffect, useCallback } from 'react';
import { dialog } from '../../../services/utils/dialog';
import { ArrowLeft, Home, Loader2, LogOut, Plus, Dog, ShieldCheck, ShieldAlert, Utensils, Footprints, Pill, ClipboardList, Camera, Scale, Scissors, ExternalLink, Share2, Trash2, Receipt, ChevronDown, RotateCcw } from 'lucide-react';
import { boardingAPI, BoardingStay, visitsAPI, toast, servicesAPI, consumablesAPI } from '../../../services';
import { sellUnitOf } from '../shared/QtyUnitControl';
import NotesFormatToggle from '../shared/NotesFormatToggle';
import RecordActionBar, { RecordActionBarSpacer } from '../shared/RecordActionBar';
import StayChargeCard from '../shared/StayChargeCard';
import RecordPageHeader, { STICKY_RAIL } from '../shared/RecordPageHeader';
import { formatDate, calendarDaysBetween } from '../../../services/utils/dateFormatter';
import ConsumablePicker from '../shared/ConsumablePicker';
import ShareWithClinics from '../shared/ShareWithClinics';
import FinalizeReminderGate, { ReminderDraft } from '../appointments/FinalizeReminderGate';
import UpgradeGate from '../../shared/common/UpgradeGate';
import { useClinic } from '../../../contexts/ClinicContext';
import AddCategoryService from '../shared/AddCategoryService';

// Full-page boarding stay — converted from the old right-side drawer so the
// stay is a real navigable page (deep-linkable via nav param stayId).

interface Props {
  stayId: string;
  onBack: () => void;
  onChanged?: () => void;
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
  onOpenGrooming?: (appointmentId: string) => void;
  /** Rendered inside the visit wizard's Boarding step — hides the page-level
   * back link (the wizard provides its own navigation). */
  embedded?: boolean;
  /**
   * Render ONE column instead of the two-column page (2026-08-23).
   *
   * Mirrors `InpatientChartPage.pane`: the visit wizard shows boarding as tabs
   * — Daily sheet, then Stay & plan — so it needs the main column and the side
   * rail separately. Omitted, the page renders both side by side as before.
   */
  pane?: 'chart' | 'plan';
}

const STOOL = ['normal', 'abnormal', 'none'];
const APPETITE = ['excellent', 'good', 'fair', 'poor', 'none'];

// All options visible at once (user, 2026-08-03: "not hidden by selection") —
// chips instead of dropdowns; tapping the active chip clears it.
const ChipPick: React.FC<{ label: string; options: string[]; value?: string; onChange: (v: string) => void }> = ({ label, options, value, onChange }) => (
  <div className="space-y-1">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-0.5">{label}</p>
    <div className="flex flex-wrap gap-1">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)}
          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
            value === o ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-seafoam'
          }`}>{o}</button>
      ))}
    </div>
  </div>
);

/**
 * Collapsed-by-default disclosure, matching the "More filters" pattern the
 * clients list uses (user, 2026-08-20: "make this info in a collapsible like
 * extra filters for clients that comes from below").
 *
 * On mobile the stay page is a long scroll — a week of care log with the facts
 * grid above it and the actions card below — and both of those are things you
 * consult occasionally rather than read every time.
 */
const Disclosure: React.FC<{
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, summary, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
      >
        <span className="min-w-0 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">{title}</span>
          {/* Keep the headline fact readable while collapsed, so closing it
              never hides the number you opened the page for. */}
          {!open && summary}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 sm:pb-5">{children}</div>}
    </div>
  );
};

const BoardingStayPage: React.FC<Props> = ({ stayId, onBack, onChanged, onOpenAppointment, onOpenGrooming, embedded, pane }) => {
  const [stay, setStay] = useState<BoardingStay | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // New daily-log draft
  const [dischargeWeight, setDischargeWeight] = useState('');
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  // Early-collection reason (178) — only ever asked when the animal is going
  // home before its expected pickup date.
  const [checkoutReason, setCheckoutReason] = useState('');
  const [askReason, setAskReason] = useState(false);
  const [showShare, setShowShare] = useState(false);
  /** Which logged item is being removed from a day summary. */
  const [removingCons, setRemovingCons] = useState<string | null>(null);
  /** Stay-wide note. Local draft so typing is not fought by every refetch. */
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  // Read inside `load`, which is a useCallback — a ref avoids re-creating it
  // (and re-firing the effect) on every keystroke.
  const notesDirtyRef = React.useRef(false);
  React.useEffect(() => { notesDirtyRef.current = notesDirty; }, [notesDirty]);

  // Spawn a grooming service onto this stay's linked appointment so it surfaces
  // (with real name + price) on the visit's SERVICES list and is attended on the
  // Grooming page. Picks from the catalog's grooming category; generic fallback.
  // The picker itself is `AddCategoryService` now (shared with the Grooming and
  // Surgery pages), so this page no longer keeps its own catalog copy — the two
  // had already drifted: the shared one also matches a service's workflowScope,
  // this one only its category name.
  // Grooming services already on the linked visit — shown below the actions
  // so staff see what was added and can jump to the Grooming page to detail it.
  const [groomTasks, setGroomTasks] = useState<{ id: number; name: string; status: string; price?: number }[]>([]);
  const linkedApptId = stay?.billing?.appointmentId || stay?.appointmentId;
  const loadGroomTasks = useCallback(async (apptId: string | number) => {
    try {
      const res = await visitsAPI.getById(Number(apptId), { cache: false } as any);
      const tasks = (res.data as any)?.appointment?.tasks || [];
      setGroomTasks(tasks
        .filter((t: any) => String(t.category || '').toLowerCase().includes('groom'))
        .map((t: any) => ({ id: Number(t.id), name: t.name, status: String(t.status || ''), price: t.price != null ? Number(t.price) : undefined })));
    } catch { /* non-blocking — the block just stays empty */ }
  }, []);
  useEffect(() => { if (linkedApptId) loadGroomTasks(linkedApptId); else setGroomTasks([]); }, [linkedApptId, loadGroomTasks]);

  const removeGroomTask = async (taskId: number) => {
    const apptId = stay?.billing?.appointmentId || stay?.appointmentId;
    if (!apptId) return;
    setBusy(true);
    try {
      await visitsAPI.deleteTask(Number(apptId), taskId);
      toast.success('Grooming service removed');
      loadGroomTasks(apptId);
      onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Failed to remove — settled bills are locked'); }
    finally { setBusy(false); }
  };

  // Per-day line editing (user, 2026-08-02): each care-log day opens a
  // collapsible editor (same fields as Log today's care) so paper records can
  // be back-filled — blank day → addLog with that logDate, existing → updateLog.
  // Stay & food pricing editor (user, 2026-08-02: a 300-meals/day typo billed
  // 540,000 and there was nowhere to see or fix it). Saving re-prices the
  // accrued lines server-side immediately.
  // Clinic-wide default from Billables → Default Daily Rates. The server
  // already copies it onto a stay AT ADMIT; a stay admitted before the default
  // was set keeps a null rate, so the page falls back to it for display and
  // pre-fills the editor with it (user, 2026-08-03: "auto pick daily rate").
  const { selectedClinics } = useClinic();
  const clinicDayRate = (selectedClinics[0] as any)?.boardingDayRate ?? null;
  const [pricingOpen, setPricingOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState<any>(null);
  const [priceSaving, setPriceSaving] = useState(false);
  // The form renders next to the accrual figures it re-prices, but its trigger
  // lives in the pinned bar at the bottom — so opening it has to bring it into
  // view, or the button appears to do nothing.
  const pricingRef = React.useRef<HTMLDivElement>(null);

  /**
   * The stay's days as { key, date }, for the per-day rate picker.
   *
   * ⚠️ Key is built from LOCAL date parts, matching the server's `stayDayKeys`
   * — `toISOString().slice(0,10)` is UTC, so in GMT+3 an evening day would key
   * itself to the next date and the rate would land on the wrong day.
   */
  const stayDayList = React.useMemo(() => {
    if (!stay?.dropOffAt) return [] as { key: string; date: Date }[];
    const n = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt ?? undefined));
    const first = new Date(stay.dropOffAt);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { key, date: d };
    });
  }, [stay?.dropOffAt, stay?.actualPickupAt]);
  const openPricing = () => {
    const fp: any = (stay as any)?.foodProgram || {};
    setPriceDraft({
      dailyRate: stay?.dailyRate ?? (clinicDayRate ?? ''), mealsPerDay: fp.mealsPerDay ?? '',
      ratePerMeal: fp.ratePerMeal ?? '', providedByClient: fp.providedByClient === true,
      feedingTimes: fp.feedingTimes ?? '',
      // Which past days take the new rate, plus "from now on".
      applyDays: [] as string[],
      applyForward: true,
    });
    setPricingOpen(o => {
      if (!o) setTimeout(() => pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return !o;
    });
  };
  const savePricing = async () => {
    if (!priceDraft) return;
    setPriceSaving(true);
    try {
      const fp: any = { ...((stay as any)?.foodProgram || {}) };
      fp.mealsPerDay = priceDraft.mealsPerDay === '' ? 0 : Number(priceDraft.mealsPerDay);
      fp.ratePerMeal = priceDraft.ratePerMeal === '' ? 0 : Number(priceDraft.ratePerMeal);
      fp.providedByClient = !!priceDraft.providedByClient;
      if (priceDraft.feedingTimes !== '') fp.feedingTimes = priceDraft.feedingTimes;
      const res = await boardingAPI.update(stayId, {
        dailyRate: priceDraft.dailyRate === '' ? undefined : Number(priceDraft.dailyRate),
        foodProgram: fp,
        // The server freezes untouched days before moving the base rate, so
        // these two decide exactly which days move. Sent only when a rate is
        // actually being set.
        ...(priceDraft.dailyRate === '' ? {} : {
          applyRateToDays: priceDraft.applyDays ?? [],
          applyRateGoingForward: priceDraft.applyForward !== false,
        }),
      } as any);
      if (res.success) { toast.success('Pricing updated — accrued charges re-priced'); setPricingOpen(false); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to update pricing'); }
    finally { setPriceSaving(false); }
  };

  const [editDay, setEditDay] = useState<string | null>(null);
  /**
   * Which day of the stay the care log is showing. The log used to render EVERY
   * day of the stay stacked vertically, so a two-week boarding was a wall of
   * cards you had to scroll through to reach today (user, 2026-08-04).
   * Null = "resolve to today, else the last day" — computed against the day list
   * below rather than stored, so it stays right as the stay grows.
   */
  const [careDay, setCareDay] = useState<string | null>(null);
  const [dayDraft, setDayDraft] = useState<any>({});
  const [daySaving, setDaySaving] = useState(false);
  const openDayEditor = (dateKey: string, existing?: any) => {
    setEditDay(editDay === dateKey ? null : dateKey);
    // `at`: the datetime the entry is recorded AS (defaults noon of that day; a
    // Now button snaps to the current moment). Drives logDate AND consumables.
    const day = dateKey.split('#')[0];
    const at = (existing?.recordedAt || existing?.logDate) ? (() => { const d = new Date(existing.recordedAt || existing.logDate); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })() : `${day}T12:00`;
    setDayDraft(existing ? { id: existing.id, at, mealPhoto: existing.mealPhoto || '', fedAm: !!existing.fedAm, fedPm: !!existing.fedPm, walked: !!existing.walked, medicationGiven: !!existing.medicationGiven, stool: existing.stool || '', appetite: existing.appetite || '', foodNotes: existing.foodNotes || '', notes: existing.notes || '' } : { at, mealPhoto: '', fedAm: false, fedPm: false, walked: false, medicationGiven: false, stool: '', appetite: '', foodNotes: '', notes: '' });
  };
  const saveDayDraft = async (dateKey: string) => {
    setDaySaving(true);
    try {
      const at = dayDraft.at ? new Date(dayDraft.at).toISOString() : `${dateKey.split('#')[0]}T12:00:00.000Z`;
      const payload: any = { fedAm: dayDraft.fedAm, fedPm: dayDraft.fedPm, walked: dayDraft.walked, medicationGiven: dayDraft.medicationGiven, stool: dayDraft.stool || undefined, appetite: dayDraft.appetite || undefined, foodNotes: dayDraft.foodNotes || undefined, notes: dayDraft.notes || undefined, mealPhoto: dayDraft.mealPhoto || undefined, logDate: at, recordedAt: at };
      const res = dayDraft.id
        ? await boardingAPI.updateLog(stayId, dayDraft.id, payload)
        : await boardingAPI.addLog(stayId, payload as any);
      if (res.success) { toast.success('Day updated'); setEditDay(null); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to save day'); }
    finally { setDaySaving(false); }
  };

  // Per-day charges for the reconciliation sheet (user, 2026-08-02): daily
  // boarding rate + billable consumables logged that day. Shown even at 0.
  const [consumables, setConsumables] = useState<any[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await boardingAPI.getById(stayId);
      if (res.success && res.data?.stay) {
        setStay(res.data.stay);
        // Only hydrate when the user is NOT mid-edit — chargeStay and the day
        // editor both refetch, and overwriting a half-typed note would lose it.
        setNotesDraft(prev => (notesDirtyRef.current ? prev : (res.data!.stay as any).notes ?? ''));
      }
    } catch (e) { console.error('Failed to load stay', e); }
    finally { setLoading(false); }
  }, [stayId]);

  /**
   * Patch one of the header facts (kennel · expected pickup) in place.
   * Optimistic on the local row so the grid doesn't flicker back to the old
   * value while the PATCH is in flight, then reloads to take the server's
   * version — expected pickup feeds the day count and the accruing charge, so
   * the authoritative row is the one worth showing.
   */
  const saveFact = async (patch: { kennel?: string | null; expectedPickupAt?: string | null }) => {
    setStay(prev => (prev ? { ...prev, ...patch } as BoardingStay : prev));
    try {
      const res = await boardingAPI.update(stayId, patch as any);
      if (res.success) { await load(); onChanged?.(); }
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
      await load(); // put the real value back — the optimistic one was wrong
    }
  };

  useEffect(() => { setStay(null); load(); }, [stayId, load]);
  /**
   * ⚠️ `consRefresh` is load-bearing.
   *
   * This used to re-run only when the appointment changed or the NUMBER OF
   * ENTRIES changed. Logging an item changes neither — so the row was written
   * to the database and this state kept the list it fetched before it. The item
   * only appeared once a new entry was saved and `dailyLogs.length` moved, which
   * is exactly how it was reported: "I can't see the item I have added till I
   * save entry", and before that "nothing added" (user, 2026-08-20). It HAD been
   * added — prod visit 161 holds two Beef & Carrot rows stamped 16:11, one per
   * click, because the first looked like it had failed.
   *
   * Anything that logs or removes an item must bump this.
   */
  const [consRefresh, setConsRefresh] = useState(0);
  const [savingConsQty, setSavingConsQty] = useState<string | null>(null);
  useEffect(() => {
    const apptId = stay?.billing?.appointmentId;
    if (!apptId) { setConsumables([]); return; }
    let alive = true;
    consumablesAPI.list(apptId, { silent: true } as any)
      .then(r => { if (alive && r.success && Array.isArray(r.data)) setConsumables(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [stay?.billing?.appointmentId, stay?.dailyLogs?.length, consRefresh]);


  /**
   * Is this an EARLY collection? Compared by CALENDAR DAY, matching the server
   * (utils/earlyRelease) — an expected pickup of "Tuesday 15:00" must not make
   * a Tuesday-morning collection "early" and demand an explanation.
   * No expected pickup ⇒ NOT early: the gate only bites where a plan exists,
   * and most stays are admitted without one.
   */
  const pickupIsEarly = (() => {
    if (!stay?.expectedPickupAt) return false;
    const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return sod(new Date()) < sod(new Date(stay.expectedPickupAt));
  })();

  const checkOut = async (reminder: ReminderDraft | null) => {
    // The server refuses an early check-out with no reason (178). Ask here so
    // the refusal never has to happen.
    if (pickupIsEarly && !checkoutReason.trim()) { setAskReason(true); return; }
    setBusy(true);
    try {
      const res = await boardingAPI.update(stayId, { status: 'CHECKED_OUT', ...(dischargeWeight ? { dischargeWeight: Number(dischargeWeight) } : {}), ...(checkoutReason.trim() ? { checkoutReason: checkoutReason.trim() } : {}), reminder });
      if (res.success) {
        setShowCheckoutGate(false);
        onChanged?.();
        // Route to the visit workflow to finalize + bill this stay (or add
        // another category/service). Pop the wallet when a bill is outstanding.
        const apptId = (res.data as any)?.appointmentId || stay?.billing?.appointmentId || stay?.appointmentId;
        const outstanding = !!stay?.billing && !stay.billing.isPaid && (stay.billing.totalCost ?? 0) > 0;
        if (apptId) onOpenAppointment?.(String(apptId), outstanding);
        else onBack();
      }
    } finally { setBusy(false); }
  };

  const Toggle: React.FC<{ on: boolean; onClick: () => void; icon: React.ElementType; label: string }> = ({ on, onClick, icon: Icon, label }) => (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
      <Icon size={12} /> {label}
    </button>
  );

  const active = stay?.status === 'ADMITTED';

  /**
   * Undo a checkout so the stay can be corrected (2026-08-23). Server refuses
   * once the visit is PAID — void the payment first, deliberately not here.
   */
  const reopenStay = useCallback(async () => {
    const ok = await dialog.confirm({
      title: 'Reopen this stay?',
      message: 'It goes back to ADMITTED and its visit reopens so charges can be corrected. Check out again when you are done.',
      confirmLabel: 'Reopen',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await boardingAPI.reopen(stayId);
      if (r.success) { toast.success('Stay reopened'); await load(); onChanged?.(); }
    } finally { setBusy(false); }
  }, [stayId, load, onChanged]);

  /**
   * Re-run days × rate onto the visit's bill.
   *
   * ⚠️ PINS THE RATE FIRST when the stay has none of its own — `chargeStay`
   * prices off `stay.dailyRate` alone and knows nothing about the clinic
   * default, so recalculating a stay showing the default charged nothing.
   */
  const recalcCharge = useCallback(async (effectiveRate: number) => {
    if (effectiveRate > 0 && Number(stay?.dailyRate ?? 0) !== effectiveRate) {
      const p = await boardingAPI.update(stayId, { dailyRate: effectiveRate } as any);
      if (!p.success) return;
    }
    const r = await boardingAPI.bill(stayId, null);
    if (r.success) { toast.success('Charge recalculated'); await load(); onChanged?.(); }
  }, [stayId, stay?.dailyRate, load, onChanged]);

  const saveDailyRate = useCallback(async (rate: number) => {
    const r = await boardingAPI.update(stayId, { dailyRate: rate } as any);
    if (r.success) { toast.success('Daily rate updated'); await load(); onChanged?.(); }
  }, [stayId, load, onChanged]);

  return (
    <div className={`space-y-5 animate-in fade-in duration-300 ${embedded ? '' : 'pb-20'}`}>
      {/* Header — Lab-style back link + pine banner (link hidden when the
          page is embedded in the visit wizard's Boarding step) */}
      {!embedded && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
          <ArrowLeft size={13} /> Boarding
        </button>
      )}
      {/* Shared sticky/condensing header (2026-08-04). Not sticky when embedded
          in the wizard's Boarding step — that shell has its own chrome. */}
      <RecordPageHeader
        icon={Home}
        eyebrow="Boarding stay"
        embedded={embedded}
        title={<><Dog size={16} /> {stay?.pet?.name ?? '…'}</>}
        condensedMeta={stay?.kennel ? `· Kennel ${stay.kennel}` : ''}
        // Gender belongs on the header (user, 2026-08-20) — it decides handling
        // and housing, and reading it off the patient record meant leaving the
        // stay. Omitted rather than shown blank when the pet has none.
        subtitle={stay
          ? [stay.pet?.breed, (stay.pet as any)?.gender, stay.pet?.species, `Owner: ${stay.client?.name}`]
              .filter(Boolean).join(' · ')
          : undefined}
        right={<>
          {stay && !active && (
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[9px] font-black uppercase tracking-widest">
              Checked out{stay.actualPickupAt ? ` ${formatDate(stay.actualPickupAt)}` : ''}
            </span>
          )}
          {/* Billing state of the linked visit — mirrors the Lab page. */}
          {stay?.billing && (stay.billing.isPaid || ['PENDING_PAYMENT', 'COMPLETED'].includes(String(stay.billing.status))) && (
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[9px] font-black uppercase tracking-widest">
              {stay.billing.isPaid ? '🔒 Bill settled — locked' : '💰 Billed — awaiting payment'}
            </span>
          )}
        </>}
      />

      {loading && !stay ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : stay ? (
        // One column (user, 2026-08-03): the stay context / actions / checkout
        // column used to sit beside the care sheet, squeezing the thing staff
        // actually work in into two thirds. It runs full width UNDER it now.
        <div className="space-y-4">
          {/* Stay facts FIRST (user, 2026-08-04): status / kennel / check-in /
              expected pickup are what you check on opening the page, so they
              lead rather than sitting under a scroll-length of care sheet.
              After check-out the grid shows the real check-in → check-out range
              and the billed day count. */}
          <Disclosure
            title="Stay details"
            summary={<span className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">
              {stay.status === 'ADMITTED' ? `Day ${Math.max(0, calendarDaysBetween(stay.dropOffAt)) + 1}` : 'Checked out'}
              {stay.kennel ? ` · ${stay.kennel}` : ''}
            </span>}
          >
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Fact label="Status" value={stay.status === 'ADMITTED'
                ? `Day ${Math.max(0, calendarDaysBetween(stay.dropOffAt)) + 1}`
                : stay.status === 'CHECKED_OUT' && stay.actualPickupAt
                  ? (() => { const d = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt)); return `Checked out · ${d} day${d === 1 ? '' : 's'}`; })()
                  : stay.status} />
              {/* Kennel + Expected pickup are EDITABLE in place (user,
                  2026-08-04): both are routinely unset at admission — the
                  animal is assigned a kennel once it's in, and the owner names
                  a pickup time later — and re-admitting was the only way to
                  set them. Locked once checked out: they describe a stay that
                  has ended, and Expected pickup is replaced by the real one. */}
              <EditableFact label="Kennel" value={stay.kennel || ''} display={stay.kennel || '—'}
                disabled={!active} placeholder="e.g. T2"
                onSave={v => saveFact({ kennel: v || null })} />
              <Fact label="Check-in" value={`${formatDate(stay.dropOffAt)} · ${new Date(stay.dropOffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
              {stay.status === 'CHECKED_OUT' && stay.actualPickupAt
                ? <Fact label="Check-out" value={`${formatDate(stay.actualPickupAt)} · ${new Date(stay.actualPickupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                : <EditableFact label="Expected pickup" type="datetime-local"
                    value={toLocalDatetimeInput(stay.expectedPickupAt)}
                    display={stay.expectedPickupAt ? `${formatDate(stay.expectedPickupAt)} · ${new Date(stay.expectedPickupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                    disabled={!active}
                    onSave={v => saveFact({ expectedPickupAt: v ? new Date(v).toISOString() : null })} />}
              {/* What the stay has cost SO FAR, up here with the other facts
                  (user, 2026-08-06). It was only visible as small print inside
                  the pricing editor, so the number staff are asked for at the
                  desk lived three scrolls down. Nights + food, the same maths
                  the accrual line below prints. */}
              {(() => {
                const days = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt ?? undefined));
                const r = (Number(stay.dailyRate ?? 0) || 0) || (Number(clinicDayRate ?? 0) || 0);
                const fp: any = (stay as any).foodProgram || {};
                const foodPerDay = fp.providedByClient === false
                  ? (Number(fp.ratePerMeal) || 0) * (Number(fp.mealsPerDay) || 0) : 0;
                // ⚠️ Items belong in this number too. It counted nights + food
                // only, so drugs and consumables logged against the stay were
                // invisible in the one figure staff quote at the desk (user,
                // 2026-08-13: "including food n consumables").
                const itemsTotal = (consumables || []).reduce((sum: number, c: any) => sum + (c.billable
                  ? Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0))
                  : 0), 0);
                const total = days * (r + foodPerDay) + itemsTotal;
                return (
                  <Fact
                    label={active ? 'Charges so far' : 'Stay charges'}
                    value={total > 0 ? `KES ${total.toLocaleString()}` : '—'} />
                );
              })()}
            </div>
          </Disclosure>

          {/* TWO COLUMNS, matching the inpatient chart (user, 2026-08-04).
              ⚠️ This REVERSES the 2026-08-03 one-column call ("the context
              column squeezed the thing staff actually work in into two
              thirds"). What changed is that the rail is now STICKY — it
              follows you down the care sheet instead of being a dead strip you
              scroll past — so the column earns its width. The care sheet keeps
              2/3, same split as inpatient. */}
          <div className={pane ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-3 gap-4 items-start'}>
          {/* MAIN — daily care logging + care log history */}
          <div className={`${pane ? (pane === 'chart' ? '' : 'hidden') : 'lg:col-span-2'} space-y-4`}>
            {/* ONE care card (§0f #2): log form ÷ consumables ÷ care-log history,
                divided — not three cards a scroll-length apart. */}
            <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            {/* The standalone "Log today's care" form was REMOVED (S2 → S3,
                user 2026-08-04). The per-day check-in below opens today by
                default and carries the same fields plus its own consumables
                picker, so the top form was a second way to write the same row —
                and the two could disagree about which day you were logging.
                Today is just the last day in the list; log it there. */}

            {/* Daily log history — same card, divided from the form above. */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Care log — check-in to {stay.actualPickupAt ? 'checkout' : 'today'}</p>
              {/* Per-day reconciliation (user, 2026-08-02): every calendar day of the
                  stay renders; a day with no log shows its blank fields so gaps are
                  visible and the stay reconciles by hand against the bill. */}
              {(() => {
                const dayKey = (d: string | Date) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
                const start = new Date(stay.dropOffAt); start.setHours(0, 0, 0, 0);
                const end = new Date(stay.actualPickupAt ?? Date.now()); end.setHours(0, 0, 0, 0);
                const days: Date[] = [];
                for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) days.push(new Date(d));
                const byDay = new Map<string, any[]>();
                (stay.dailyLogs || []).forEach(l => { const k = dayKey(l.logDate); byDay.set(k, [...(byDay.get(k) || []), l]); });
                const consByDay = new Map<string, any[]>();
                consumables.forEach(c => { const ck = dayKey(c.createdAt); consByDay.set(ck, [...(consByDay.get(ck) || []), c]); });
                // Falls back to the clinic default so a stay admitted before
                // the rate existed still reconciles — the server uses the same
                // number when the stay's own rate is null.
                const rate = (Number(stay.dailyRate ?? 0) || 0) || (Number(clinicDayRate ?? 0) || 0);
                const fmtK = (n: number) => `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                const dayEditor = (dateKey: string) => editDay === dateKey && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Toggle on={!!dayDraft.fedAm} onClick={() => setDayDraft((d: any) => ({ ...d, fedAm: !d.fedAm }))} icon={Utensils} label="Fed AM" />
                      <Toggle on={!!dayDraft.fedPm} onClick={() => setDayDraft((d: any) => ({ ...d, fedPm: !d.fedPm }))} icon={Utensils} label="Fed PM" />
                      <Toggle on={!!dayDraft.walked} onClick={() => setDayDraft((d: any) => ({ ...d, walked: !d.walked }))} icon={Footprints} label="Walked" />
                      <Toggle on={!!dayDraft.medicationGiven} onClick={() => setDayDraft((d: any) => ({ ...d, medicationGiven: !d.medicationGiven }))} icon={Pill} label="Meds" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ChipPick label="Stool" options={STOOL} value={dayDraft.stool} onChange={v => setDayDraft((d: any) => ({ ...d, stool: v }))} />
                      <ChipPick label="Appetite" options={APPETITE} value={dayDraft.appetite} onChange={v => setDayDraft((d: any) => ({ ...d, appetite: v }))} />
                    </div>
                    <input className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" placeholder="What did they eat?" value={dayDraft.foodNotes} onChange={e => setDayDraft((d: any) => ({ ...d, foodNotes: e.target.value }))} />
                    <textarea className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" rows={2} placeholder="Notes for this day (back-filled from the paper sheet?)" value={dayDraft.notes} onChange={e => setDayDraft((d: any) => ({ ...d, notes: e.target.value }))} />
                    {/* Recorded-as time: defaults noon of the day; Now = this moment. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Time</label>
                      <input type="datetime-local" className="px-2 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 [color-scheme:light] dark:[color-scheme:dark]" value={dayDraft.at || ''} onChange={e => setDayDraft((d: any) => ({ ...d, at: e.target.value }))} />
                      <button type="button" onClick={() => { const n = new Date(); setDayDraft((d: any) => ({ ...d, at: new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })); }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-700">Now</button>
                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:border-seafoam">
                        <Camera size={12} /> {dayDraft.mealPhoto ? 'Change photo' : 'Photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => { const img = new Image(); img.onload = () => {
                            const max = 640; const scale = Math.min(1, max / Math.max(img.width, img.height));
                            const canvas = document.createElement('canvas');
                            canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
                            canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                            setDayDraft((d: any) => ({ ...d, mealPhoto: canvas.toDataURL('image/jpeg', 0.7) }));
                          }; img.src = reader.result as string; };
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                      {dayDraft.mealPhoto && <img src={dayDraft.mealPhoto} alt="meal" className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-zinc-800" />}
                    </div>
                    {/* Consumables for THIS day — rows are recorded with the chosen time
                        (stock still moves now), so day costs land where they belong. */}
                    {stay.billing?.appointmentId && (
                      <div className="pt-1">
                        {/* dayKey, not just recordedAt: recordedAt decides which
                            day a NEW row is filed under, dayKey decides which
                            rows are LISTED. Without it the heading said "this
                            day" over the whole visit's items. */}
                        {/* Search only. The day block already prints this day's
                            items above, each with its own delete, so listing
                            them again here showed the morning's tin sitting
                            under the evening entry's search box as though it
                            were about to be added a second time. */}
                        {/* ⚠️ `dateKey` is COMPOSITE on the per-entry editor —
                            "2026-08-14#123" — because that is how the open
                            editor is keyed. The picker wants a real day, so
                            strip the entry id or its filter matches nothing. */}
                        <ConsumablePicker flat compact hideLoggedList appointmentId={stay.billing.appointmentId}
                          dayKey={dateKey.split('#')[0]}
                          recordedAt={dayDraft.at ? new Date(dayDraft.at).toISOString() : null}
                          onChanged={() => { load(); setConsRefresh(n => n + 1); onChanged?.(); }} title="Items used this day" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => saveDayDraft(dateKey)} disabled={daySaving} className="flex-1 py-1.5 bg-seafoam text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {daySaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {dayDraft.id ? 'Save changes' : 'Save day'}
                      </button>
                      <button onClick={() => setEditDay(null)} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Cancel</button>
                    </div>
                  </div>
                );
                // Auto-generated day tabs. Default to TODAY when the stay covers
                // it (the day you almost always want), else the latest day.
                const todayK = dayKey(new Date());
                const selKey = (careDay && days.some(d => dayKey(d) === careDay))
                  ? careDay
                  : (days.some(d => dayKey(d) === todayK) ? todayK : dayKey(days[days.length - 1]));

                return (
                  <div className="space-y-2">
                    {/* Horizontal, scrollable — one tab per day of the stay, with a
                        dot for "something recorded" so gaps stay visible without
                        having to open each day. */}
                    <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1">
                      {days.map((d, i) => {
                        const k = dayKey(d);
                        const has = (byDay.get(k) || []).length > 0 || (consByDay.get(k) || []).length > 0;
                        const sel = k === selKey;
                        return (
                          <button
                            key={k} type="button" onClick={() => setCareDay(k)}
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
                      // Only the selected tab's day renders. The full list is
                      // still walked so `dayNo` and the nights-based rate below
                      // stay correct for whichever day is shown.
                      if (k !== selKey) return null;
                      const logs = byDay.get(k) || [];
                      const dayCons = consByDay.get(k) || [];
                      const itemsCost = dayCons.reduce((sum, c) => sum + (c.billable ? Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0)) : 0), 0);
                      // Stay charges are NIGHTS-based (calendarDaysBetween, min 1): the
                      // final calendar day of a multi-day stay starts no new night, so it
                      // shows stay KES 0 — matching what the bill accrues.
                      const dayRate = (days.length === 1 || dayNo < days.length) ? rate : 0;
                      const dayTotal = dayRate + itemsCost;
                      // A mis-logged item was only removable by opening the day
                      // editor, even though the row is right here (user,
                      // 2026-08-06). Deleting restores stock and drops the
                      // charge, so it is gated on the stay still being open —
                      // a checked-out stay's bill is not ours to edit here.
                      const consRowsFor = (rows: any[]) => rows.map(c => (
                        <div key={`c-${c.id}`} className="mt-1.5 flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg px-3 py-1.5 border border-emerald-100 dark:border-emerald-900/40">
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 shrink-0">Item</span>
                          {/* PORTION IS EDITABLE IN PLACE (user, 2026-08-20:
                              "allow to edit the consumable portion, recalc
                              inventory"). Half a tin instead of a whole one used
                              to mean deleting the line and logging it again,
                              which moved stock twice. The server converts the
                              delta to STOCK units and adjusts the shelf, so a
                              1 → 0.5 edit returns exactly half a portion.
                              ⚠️ The unit shown is the SELL unit — `quantity` is
                              counted in what the item is billed in, not what it
                              is stocked in. */}
                          <span className="min-w-0 flex-1 text-[10px] text-pine dark:text-zinc-200 truncate flex items-center gap-1.5">
                            <span className="truncate">{c.inventoryItem?.name}</span>
                            <span className="shrink-0 text-slate-400">×</span>
                            {active ? (
                              <input
                                type="number" min="0" step="any"
                                defaultValue={Number(c.quantity)}
                                disabled={savingConsQty === String(c.id)}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                onBlur={async e => {
                                  const next = Number(e.target.value);
                                  const prev = Number(c.quantity);
                                  if (!Number.isFinite(next) || next <= 0) { e.target.value = String(prev); return; }
                                  if (Math.abs(next - prev) < 1e-9) return;
                                  setSavingConsQty(String(c.id));
                                  try {
                                    await consumablesAPI.update(c.id, { quantity: next });
                                    toast.success('Portion updated — stock adjusted');
                                    await load(); setConsRefresh(n => n + 1); onChanged?.();
                                  } catch (err: any) {
                                    e.target.value = String(prev);
                                    toast.error(err?.message || 'Could not update the portion');
                                  } finally { setSavingConsQty(null); }
                                }}
                                className="w-14 shrink-0 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/50 text-[10px] font-bold text-pine dark:text-zinc-100 text-center outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-50"
                              />
                            ) : <span className="shrink-0 font-bold">{Number(c.quantity)}</span>}
                            <span className="shrink-0 text-slate-400 truncate">{sellUnitOf(c.inventoryItem || {})}</span>
                            {savingConsQty === String(c.id) && <Loader2 size={10} className="animate-spin text-emerald-600 shrink-0" />}
                          </span>
                          <span className="text-[9px] font-black text-emerald-600 shrink-0">{c.billable ? fmtK(Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0))) : 'no charge'}</span>
                          {active && (
                            <button type="button" title={`Remove ${c.inventoryItem?.name ?? 'this item'} — returns the stock and drops the charge`}
                              disabled={removingCons === String(c.id)}
                              onClick={async () => {
                                // Confirm first — this returns stock AND drops
                                // the charge (user, 2026-08-22).
                                const ok = await dialog.confirmDelete({
                                  entityName: c.inventoryItem?.name ?? 'this item',
                                  message: 'Remove this item? It comes off the bill and the stock is returned.',
                                });
                                if (!ok) return;
                                setRemovingCons(String(c.id));
                                try {
                                  await consumablesAPI.remove(c.id);
                                  toast.success('Item removed — stock returned');
                                  await load(); setConsRefresh(n => n + 1); onChanged?.();
                                } catch (e: any) { toast.error(e?.message || 'Could not remove the item'); }
                                finally { setRemovingCons(null); }
                              }}
                              className="shrink-0 p-1 rounded-md text-emerald-600/60 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40">
                              {removingCons === String(c.id) ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            </button>
                          )}
                        </div>
                      ));
                      {/* Charges for EVERY day, even zero (user) — rate + billed items. */}
                      const chargeLine = (
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">{fmtK(dayTotal)}<span className="text-slate-400 font-bold"> · stay {fmtK(dayRate)} + items {fmtK(itemsCost)}</span></span>
                      );
                      if (logs.length === 0) return (
                        <div key={k} className={editDay === k
                          ? 'py-2'
                          : 'rounded-xl p-3 border border-dashed border-slate-200 dark:border-zinc-800'}>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-black text-pine dark:text-zinc-200">Day {dayNo} · {formatDate(d)}</span>
                            <span className="flex items-center gap-2">{dayCons.length === 0 && <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">Nothing recorded</span>}{chargeLine}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            <span className="font-bold">Fed AM:</span> — · <span className="font-bold">Fed PM:</span> — · <span className="font-bold">Walked:</span> — · <span className="font-bold">Meds:</span> — · <span className="font-bold">Stool:</span> — · <span className="font-bold">Appetite:</span> — · <span className="font-bold">Notes:</span> —
                          </p>
                          {/* No rounds logged this day, so every item is loose. */}
                          {consRowsFor(dayCons)}
                          <button onClick={() => openDayEditor(k)} className="mt-1.5 px-2.5 py-1 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/20">
                            {editDay === k ? 'Close' : '✎ Fill this day'}
                          </button>
                          {dayEditor(k)}
                        </div>
                      );
                      // ONE block per day, listing its timed entries (user,
                      // 2026-08-03). Care happens in rounds — morning, midday,
                      // evening — and rendering each log as its own "Day 3"
                      // card made three rounds look like three days.
                      const hhmm = (d: string | Date) =>
                        new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      // ⚠️ `logDate` is a DATE — no time in it. Reading it back
                      // gives midnight UTC, which showed as 03:00 for every
                      // entry in Nairobi and never changed however you set the
                      // picker. The moment lives on `recordedAt` (209).
                      const stamp = (l: any) => l.recordedAt ?? l.createdAt ?? l.logDate;
                      const ordered = [...logs].sort((x, y) =>
                        new Date(stamp(x)).getTime() - new Date(stamp(y)).getTime());

                      /**
                       * FILE EACH ITEM UNDER THE ROUND IT WAS LOGGED IN.
                       *
                       * Items used to print in one lump at the foot of the day,
                       * so a day with a morning and an evening feed showed both
                       * tins together and neither said which meal it belonged
                       * to (user, 2026-08-19: "each food/consumable to be under
                       * the entry").
                       *
                       * There is no entry id on a consumable row to join on —
                       * what they share is a TIME: logging from inside an entry
                       * stamps the row with that entry's `recordedAt`. So an
                       * item belongs to the LAST round at or before its own
                       * stamp, which also does the sensible thing for a row
                       * added outside the care log: it lands under the round it
                       * followed. Anything earlier than the first round of the
                       * day has no owner and stays at day level rather than
                       * being back-dated into a round it preceded.
                       */
                      const consForEntry = new Map<string, any[]>();
                      const consLoose: any[] = [];
                      for (const c of dayCons) {
                        const t = new Date(c.createdAt).getTime();
                        let owner: any = null;
                        for (const l of ordered) {
                          if (new Date(stamp(l)).getTime() <= t) owner = l; else break;
                        }
                        if (owner) consForEntry.set(String(owner.id), [...(consForEntry.get(String(owner.id)) || []), c]);
                        else consLoose.push(c);
                      }
                      return (
                        <div key={k} className={editDay === k
                          ? 'py-2'
                          : 'bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-slate-100 dark:border-zinc-800'}>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-black text-pine dark:text-zinc-200">
                              Day {dayNo} · {formatDate(d)}
                              <span className="ml-2 text-slate-400 font-bold">{ordered.length} entr{ordered.length === 1 ? 'y' : 'ies'}</span>
                            </span>
                            {chargeLine}
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {ordered.map(l => (
                              <div key={l.id} className="py-2 first:pt-0">
                                <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                                  <span className="shrink-0 w-12 text-[10px] font-black font-mono text-slate-500 dark:text-zinc-400 pt-0.5">
                                    {hhmm(stamp(l))}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
                                      {l.fedAm && <span className="text-emerald-600">Fed AM</span>}
                                      {l.fedPm && <span className="text-emerald-600">Fed PM</span>}
                                      {l.walked && <span className="text-seafoam">Walked</span>}
                                      {l.medicationGiven && <span className="text-indigo-500">Meds</span>}
                                      {l.appetite && <span className="text-slate-400">appetite {l.appetite}</span>}
                                      {l.stool && <span className="text-slate-400">stool {l.stool}</span>}
                                      {!l.fedAm && !l.fedPm && !l.walked && !l.medicationGiven && !l.appetite && !l.stool && (
                                        <span className="text-slate-300 dark:text-zinc-600">nothing ticked</span>
                                      )}
                                    </div>
                                    {(l.foodNotes || l.notes) && (
                                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                        {l.foodNotes ? `Ate: ${l.foodNotes}. ` : ''}{l.notes || ''}
                                      </p>
                                    )}
                                    {l.mealPhoto && <img src={l.mealPhoto} alt="meal" className="mt-1.5 w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-zinc-800" />}
                                  </div>
                                  <button onClick={() => openDayEditor(`${k}#${l.id}`, l)}
                                    className="shrink-0 px-2 py-0.5 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/20">
                                    {editDay === `${k}#${l.id}` ? 'Close' : '✎'}
                                  </button>
                                </div>
                                {/* This round's items, indented under it. */}
                                <div className="pl-12">
                                  {consRowsFor(consForEntry.get(String(l.id)) || [])}
                                </div>
                                {dayEditor(`${k}#${l.id}`)}
                              </div>
                            ))}
                          </div>
                          {/* Items with no round before them — kept at day level
                              rather than hidden under a round they predate. */}
                          {consRowsFor(consLoose)}
                          {/* Adding a round to THIS day — back-dated to it, so a
                              missed evening check can be filled in tomorrow. */}
                          <button onClick={() => openDayEditor(k)}
                            className="mt-2 px-2.5 py-1 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/20">
                            {editDay === k ? 'Close' : '+ Add entry'}
                          </button>
                          {dayEditor(k)}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            </section>
          </div>

          {/* SIDE RAIL — stay context: grooming on this visit, the vaccine
              gate, the accruing charge, notes format. STICKY_RAIL carries the
              load-bearing bits (self-start, own overflow) — see
              RecordPageHeader.tsx. The FACTS grid that used to open this card
              sits at the top of the page instead (user, 2026-08-04). */}
          {/* As a TAB it is a full-width panel, so the sticky rail — which
              exists to keep it beside a long sheet — is dropped. */}
          <div className={pane ? (pane === 'plan' ? 'space-y-4' : 'hidden') : `space-y-4 ${STICKY_RAIL}`}>
            {/* Collapsed by default (user, 2026-08-20: "this section to go to
                bottom collapsible"). On mobile the rail stacks under a week of
                care log, and every one of these — open visit, grooming, pricing,
                the vaccine gate, the accrual — is consulted occasionally rather
                than read on every visit to the page. The accruing total stays
                on the closed header so collapsing never hides the number. */}
            <Disclosure
              title="Actions & charges"
              summary={(() => {
                const days = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt ?? undefined));
                const r = (Number(stay.dailyRate ?? 0) || 0) || (Number(clinicDayRate ?? 0) || 0);
                const fp: any = (stay as any).foodProgram || {};
                const foodPerDay = fp.providedByClient === false
                  ? (Number(fp.ratePerMeal) || 0) * (Number(fp.mealsPerDay) || 0) : 0;
                const itemsTotal = (consumables || []).reduce((sum: number, c: any) => sum + (c.billable
                  ? Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0)) : 0), 0);
                const total = days * (r + foodPerDay) + itemsTotal;
                return total > 0
                  ? <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">KES {total.toLocaleString()}</span>
                  : null;
              })()}
            >
            <div className="space-y-3">
              {/* Secondary actions live HERE, not in the pinned bar (user,
                  2026-08-05) — mirrors the inpatient rail. */}
              <div className="flex flex-wrap items-center gap-2">
                {linkedApptId && (
                  <button onClick={() => onOpenAppointment?.(linkedApptId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
                    <ExternalLink size={12} /> Open visit
                  </button>
                )}
                {linkedApptId && (
                  <AddCategoryService
                    appointmentId={linkedApptId}
                    categoryKeyword="groom"
                    taskCategory="Grooming"
                    existingNames={groomTasks.map(t => t.name)}
                    existing={groomTasks.map(t => ({ id: t.id, name: t.name }))}
                    label="Add grooming service"
                    tone="pink"
                    onAdded={async () => { await load(); onChanged?.(); }}
                  />
                )}
                {/* Straight to the grooming record once there IS one. Adding a
                    service from here used to leave you on the stay with no way
                    through except scrolling to find the list further down
                    (user, 2026-08-13: "allow me to navigate to it n back").
                    Back returns here — `navigateTo` pushes, so the stay is
                    still underneath. */}
                {linkedApptId && groomTasks.length > 0 && (
                  <button onClick={() => onOpenGrooming?.(String(linkedApptId))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-300 dark:border-pink-900/60 bg-pink-50 dark:bg-pink-950/20 text-pink-600 text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 dark:hover:bg-pink-950/40 transition-all">
                    <Scissors size={12} /> Open grooming · {groomTasks.length}
                  </button>
                )}
                <button onClick={() => setShowShare(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
                  <Share2 size={12} /> Share{stay.allowedClinicIds && stay.allowedClinicIds.length > 0 ? ` · ${stay.allowedClinicIds.length}` : ''}
                </button>
                {active && (
                  <button onClick={openPricing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
                    <Plus size={12} /> {pricingOpen ? 'Close pricing' : 'Edit stay & food pricing'}
                  </button>
                )}
              </div>
              {/* Open visit · Add grooming service · Share all moved to the
                  PINNED bar (user, 2026-08-04: "move these too … to bottom
                  bar") — they are actions, and on a long care log they sat
                  above the fold of a page you scroll to the bottom of. */}

              {/* Grooming already on this visit — list + jump to the Grooming page */}
              {groomTasks.length > 0 && (
                <div className="rounded-xl border border-pink-200 dark:border-pink-900/40 bg-pink-50/40 dark:bg-pink-950/10 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-pink-600 flex items-center gap-1"><Scissors size={11} /> Grooming on this visit</p>
                    {linkedApptId && (
                      <button onClick={() => onOpenGrooming?.(String(linkedApptId))}
                        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-pink-600 hover:text-pink-700 transition-all">
                        Grooming page <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                  {groomTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-pink-100 dark:border-pink-900/30 hover:border-pink-300 transition-all">
                      <button onClick={() => linkedApptId && onOpenGrooming?.(String(linkedApptId))} className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left">
                        <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{t.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {t.price != null && t.price > 0 && <span className="text-[9px] font-mono text-slate-400">KES {t.price.toLocaleString()}</span>}
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${t.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>{t.status === 'COMPLETED' ? 'Done' : 'Pending'}</span>
                        </span>
                      </button>
                      {active && t.status !== 'COMPLETED' && (
                        <button onClick={() => removeGroomTask(t.id)} disabled={busy} title="Remove this grooming service"
                          className="shrink-0 p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-50">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Vaccine gate */}
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(stay.vaccineChecklist || {}).length === 0 ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400"><ShieldAlert size={12} /> No vaccine check recorded</span>
                ) : Object.entries(stay.vaccineChecklist).map(([k, v]) => (
                  <span key={k} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${v ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'}`}>
                    {v ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />} {k}
                  </span>
                ))}
              </div>

              {(stay.feedingInstructions || stay.medicationInstructions || stay.specialInstructions) && (
                <div className="space-y-2 text-xs">
                  {stay.feedingInstructions && <Instr label="Feeding" value={stay.feedingInstructions} />}
                  {stay.medicationInstructions && <Instr label="Medication" value={stay.medicationInstructions} />}
                  {stay.specialInstructions && <Instr label="Special" value={stay.specialInstructions} />}
                </div>
              )}

              {/* Accruing daily charge (added to the bill at checkout) —
                  calendar dates crossed since check-in, same maths as the
                  backend's computeNights. */}
              {(() => {
                const days = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt ?? undefined));
                const fp: any = (stay as any).foodProgram || {};
                const foodPerDay = fp.providedByClient === false ? (Number(fp.ratePerMeal) || 0) * (Number(fp.mealsPerDay) || 0) : 0;
                return (
                  <div className="space-y-1">
                    {/* Shows the WORKING and the two actions that fix it. The
                        old line rendered only while active AND a rate existed,
                        so a checked-out stay or one with no rate — the two
                        cases you need it most — showed nothing. */}
                    {(() => {
                      const ownRate = Number(stay.dailyRate ?? 0) || 0;
                      const fallback = Number(clinicDayRate ?? 0) || 0;
                      const rate = ownRate || fallback;
                      const itemsTotal = (consumables || []).reduce((sum: number, c: any) => sum + (c.billable
                        ? Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0)) : 0), 0);
                      return (
                        <StayChargeCard
                          days={days}
                          rate={rate}
                          rateSource={ownRate ? 'record' : fallback ? 'clinic' : 'none'}
                          /* Food is per-day but NOT part of the rate: the edit
                             saves this number as `dailyRate`, so folding food
                             into it would write rate+food back as the room
                             rate and double-charge food on the next recalc. */
                          extras={itemsTotal + days * foodPerDay}
                          locked={!active}
                          lockedReason="This stay is checked out. Reopen it to change the charge."
                          onSaveRate={saveDailyRate}
                          onRecalculate={recalcCharge}
                        />
                      );
                    })()}
                    {/* The FOOD accrual — visible so a meals/rate typo can't hide. */}
                    {foodPerDay > 0 && (
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        Food: {Number(fp.mealsPerDay)} meal{Number(fp.mealsPerDay) === 1 ? '' : 's'}/day × KES {Number(fp.ratePerMeal).toLocaleString()} = KES {foodPerDay.toLocaleString()}/day → <b className="text-pine dark:text-zinc-100">KES {(days * foodPerDay).toLocaleString()}</b>
                      </p>
                    )}
                    {/* Trigger moved to the pinned bar; the FORM stays here,
                        next to the accrual figures it re-prices. Opening it
                        from the bar scrolls it into view. */}
                    <div ref={pricingRef} />
                    {pricingOpen && priceDraft && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div><label className="field-label">Daily rate</label><input type="number" min="0" className="field-input" value={priceDraft.dailyRate} onChange={e => setPriceDraft((d: any) => ({ ...d, dailyRate: e.target.value }))} /></div>
                          <div><label className="field-label">Meals / day</label><input type="number" min="0" className="field-input" value={priceDraft.mealsPerDay} onChange={e => setPriceDraft((d: any) => ({ ...d, mealsPerDay: e.target.value }))} /></div>
                          <div><label className="field-label">Rate / meal</label><input type="number" min="0" className="field-input" value={priceDraft.ratePerMeal} onChange={e => setPriceDraft((d: any) => ({ ...d, ratePerMeal: e.target.value }))} /></div>
                        </div>
                        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                          <input type="checkbox" checked={!!priceDraft.providedByClient} onChange={e => setPriceDraft((d: any) => ({ ...d, providedByClient: e.target.checked }))} className="accent-seafoam" />
                          Food provided by the client (no food charge)
                        </label>

                        {/* WHICH DAYS the new rate applies to (191).
                            Editing the rate used to silently re-price the whole
                            stay backwards; the clinic could not raise a rate
                            mid-stay or fix today's typo without rewriting what
                            it had already quoted (user, 2026-08-06). */}
                        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1.5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Apply this rate to</p>
                          <label className="flex items-center gap-2 text-[10px] font-bold text-pine dark:text-zinc-200">
                            <input type="checkbox" className="accent-seafoam"
                              checked={priceDraft.applyForward !== false}
                              onChange={e => setPriceDraft((d: any) => ({ ...d, applyForward: e.target.checked }))} />
                            Now &amp; future days
                          </label>
                          {stayDayList.map(({ key: k, date: d }, i) => {
                            const on = (priceDraft.applyDays ?? []).includes(k);
                            return (
                              <label key={k} className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                                <input type="checkbox" className="accent-seafoam" checked={on}
                                  onChange={e => setPriceDraft((d2: any) => ({
                                    ...d2,
                                    applyDays: e.target.checked
                                      ? [...(d2.applyDays ?? []), k]
                                      : (d2.applyDays ?? []).filter((x: string) => x !== k),
                                  }))} />
                                Day {i + 1} · {formatDate(d)}
                              </label>
                            );
                          })}
                          <p className="text-[9px] font-bold text-slate-400">
                            Days you leave unticked keep the rate they were charged at.
                          </p>
                        </div>
                        <button onClick={savePricing} disabled={priceSaving} className="w-full py-2 bg-seafoam text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50">
                          {priceSaving ? <Loader2 size={12} className="animate-spin" /> : null} Save — re-price accrued charges
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            </Disclosure>

            {/* Billing (finalize · reminder · settle) lives ONLY on the visit
                workflow — checkout below completes the stay and routes there. */}

            {/* Check out moved to the PINNED bar at the bottom (user, 2026-08-04)
                — on a long care log it sat below everything, so ending a stay
                meant scrolling the whole sheet. The finished-stay summary stays
                inline: it is a fact, not an action. */}
            {!active && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              {(
                <div className="text-center space-y-1">
                  {stay.actualPickupAt && (() => { const d = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt)); return (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(stay.dropOffAt)} → {formatDate(stay.actualPickupAt)} · {d} day{d === 1 ? '' : 's'}</p>
                  ); })()}
                  {stay.weightChange != null && <p className="text-[10px] font-black uppercase tracking-widest"><span className={stay.weightChange >= 0 ? 'text-emerald-600' : 'text-amber-600'}>Weight {stay.weightChange >= 0 ? '+' : ''}{stay.weightChange.toFixed(1)} kg</span> <span className="text-slate-400">({stay.intakeWeight} → {stay.dischargeWeight} kg)</span></p>}
                </div>
              )}
            </div>
            )}

            {/* ONE card, not two (user, 2026-08-06: "combine the cards").
                A lone Notes-format toggle in its own bordered card was a whole
                frame around two chips. It belongs with the note it formats. */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              {/* The stay had no note field at all — every note had to go on a
                  DAY, so anything about the stay as a whole ("owner travelling,
                  reachable on the other number") had nowhere to live
                  (user, 2026-08-06: "i cant add notes"). */}
              <div className="space-y-1.5">
                <label className="field-label">Stay notes</label>
                <textarea
                  className="field-textarea"
                  rows={3}
                  disabled={!active}
                  placeholder="Anything about the whole stay — not tied to one day"
                  value={notesDraft}
                  onChange={e => { setNotesDraft(e.target.value); setNotesDirty(true); }}
                />
                {notesDirty && active && (
                  <button
                    type="button"
                    disabled={notesSaving}
                    onClick={async () => {
                      setNotesSaving(true);
                      try {
                        await boardingAPI.update(stayId, { notes: notesDraft } as any);
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
                {/* No label here — NotesFormatToggle renders its own heading. */}
                <NotesFormatToggle value={stay.displayFormat || 'PARAGRAPH'} onChange={(v) => { boardingAPI.update(stayId, { displayFormat: v } as any).then(() => { load(); onChanged?.(); }); }} />
              </div>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-sm text-slate-400">Stay not found.</div>
      )}

      {/* A checked-out stay had no bar at all, so one closed at the wrong
          figure had no route back (user, 2026-08-23). */}
      {stay && !active && stay.status !== 'CANCELLED' && (
        <>
          <RecordActionBarSpacer />
          <RecordActionBar
            hint="Reopening restores the stay and its visit so charges can be corrected."
            actions={[
              { key: 'reopen', label: 'Reopen stay', icon: RotateCcw, onClick: reopenStay, primary: true, disabled: busy },
              ...(linkedApptId && onOpenAppointment ? [{
                key: 'billing', label: 'Go to billing', icon: Receipt, tone: 'seafoam' as const,
                onClick: () => onOpenAppointment(String(linkedApptId), true),
              }] : []),
            ]}
          />
        </>
      )}

      {/* Check-out requires a follow-up reminder (hard gate). */}
      {/* PINNED checkout — the stay's one terminal action, always reachable. */}
      {stay && active && (
        <>
          <RecordActionBarSpacer />
          <RecordActionBar
            hint={stay.intakeWeight != null ? `Intake ${stay.intakeWeight} kg` : 'Weigh on the way out to record the change'}
            actions={[
              // ONLY the terminal action is pinned (user, 2026-08-05) — the
              // same rule the inpatient chart follows, where the rail carries
              // Open visit / Add grooming / Share and the bar carries just
              // Discharge. Everything on 2026-08-04 was moved INTO the bar,
              // which left the bar crowded and the rail nearly empty; the
              // secondary actions have gone back to the rail. Check out stays
              // here with the discharge-weight input, which it consumes.
              { key: 'checkout', label: busy ? 'Checking out…' : 'Check out', icon: LogOut, onClick: () => checkOut(null), primary: true, disabled: busy },
              // Billing is the one destination staff leave this page FOR
              // (user, 2026-08-06: "in all special pages add go to billing
              // button"), so it earns bar space the other rail actions don't.
              // `settle: true` opens the visit ON the bill, not beside it.
              ...(linkedApptId && onOpenAppointment ? [{
                key: 'billing', label: 'Go to billing', icon: Receipt, tone: 'seafoam' as const,
                onClick: () => onOpenAppointment(String(linkedApptId), true),
              }] : []),
            ]}
            slot={(
              /* The discharge weight stays in the BAR, not the rail: Check out
                 consumes it, so the two belong together. `slot` exists for
                 controls that aren't buttons. */
              <div className="flex items-center gap-1.5">
                <Scale size={14} className="text-slate-400 shrink-0" />
                <input type="number" min="0" step="0.1" placeholder="Discharge weight (kg)" value={dischargeWeight}
                  onChange={e => setDischargeWeight(e.target.value)}
                  className="w-40 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
              </div>
            )}
          />
        </>
      )}

      {/* EARLY-COLLECTION REASON (178, user 2026-08-04). Only ever shown when
          the animal is going home BEFORE its expected pickup date — on or
          after it, and when no pickup date was set, the reason is stamped
          server-side and nobody types anything. */}
      {askReason && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70" onClick={() => setAskReason(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">Going home early</p>
            <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">Why is {stay?.pet?.name || 'this patient'} leaving early?</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Expected pickup {stay?.expectedPickupAt ? new Date(stay.expectedPickupAt).toLocaleDateString() : ''}. The reason is recorded on the stay.
            </p>
            <textarea
              autoFocus rows={3} className="field-textarea"
              placeholder="e.g. owner collected early · space needed · transferred"
              value={checkoutReason}
              onChange={e => setCheckoutReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setAskReason(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
              <button
                disabled={!checkoutReason.trim()}
                onClick={() => { setAskReason(false); checkOut(null); }}
                className="flex-1 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                Check out
              </button>
            </div>
          </div>
        </div>
      )}

      <FinalizeReminderGate
        open={showCheckoutGate}
        petName={stay?.pet?.name ?? 'Patient'}
        clientName={stay?.client?.name ?? 'Client'}
        encounterType="BOARDING"
        petDeceased={false}
        submitting={busy}
        onCancel={() => setShowCheckoutGate(false)}
        onConfirm={(reminder) => checkOut(reminder)}
      />
      {showShare && stay && (
        <ShareWithClinics recordType="boarding" recordId={stay.id} allowedClinicIds={stay.allowedClinicIds}
          onClose={() => setShowShare(false)} onSaved={(ids) => setStay(s => s ? { ...s, allowedClinicIds: ids } : s)} />
      )}
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-xs font-bold text-pine dark:text-zinc-100 mt-0.5">{value}</p>
  </div>
);

/** `datetime-local` wants local wall-clock, not the ISO/UTC the API returns. */
const toLocalDatetimeInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/**
 * A Fact you can click to change. Reads as plain text until clicked, so the
 * grid stays a summary rather than turning into a form.
 *
 * Saves on blur/Enter and only when the value actually CHANGED — a click that
 * opens and closes the field must not fire a write. Escape restores the value
 * it opened with, so an abandoned edit leaves nothing behind.
 */
const EditableFact: React.FC<{
  label: string;
  value: string;
  display: string;
  onSave: (v: string) => Promise<void> | void;
  type?: 'text' | 'datetime-local';
  placeholder?: string;
  disabled?: boolean;
}> = ({ label, value, display, onSave, type = 'text', placeholder, disabled }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    setEditing(false);
    if (draft === value) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  return (
    <div className={`bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 ${disabled ? '' : 'cursor-text hover:ring-1 hover:ring-seafoam/40'}`}
      onClick={() => { if (!disabled && !editing) { setDraft(value); setEditing(true); } }}>
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
        {label}{saving && <span className="ml-1 text-seafoam">saving…</span>}
      </p>
      {editing && !disabled ? (
        <input
          type={type}
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          className="mt-0.5 w-full bg-white dark:bg-zinc-950 border border-seafoam rounded-lg px-1.5 py-1 text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none"
        />
      ) : (
        <p className={`text-xs font-bold mt-0.5 ${display === '—' ? 'text-slate-400' : 'text-pine dark:text-zinc-100'}`}>{display}</p>
      )}
    </div>
  );
};

const Instr: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <p><span className="font-black text-slate-400 uppercase text-[9px] tracking-widest mr-1.5">{label}:</span><span className="text-slate-600 dark:text-zinc-300">{value}</span></p>
);

export default BoardingStayPage;

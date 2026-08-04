import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home, Loader2, LogOut, Plus, Dog, ShieldCheck, ShieldAlert, Utensils, Footprints, Pill, ClipboardList, Camera, Scale, Scissors, ExternalLink, Share2, Trash2 } from 'lucide-react';
import { boardingAPI, BoardingStay, visitsAPI, toast, servicesAPI, consumablesAPI } from '../../../services';
import NotesFormatToggle from '../shared/NotesFormatToggle';
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

const BoardingStayPage: React.FC<Props> = ({ stayId, onBack, onChanged, onOpenAppointment, onOpenGrooming, embedded }) => {
  const [stay, setStay] = useState<BoardingStay | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // New daily-log draft
  const [dischargeWeight, setDischargeWeight] = useState('');
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [showShare, setShowShare] = useState(false);

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
  const openPricing = () => {
    const fp: any = (stay as any)?.foodProgram || {};
    setPriceDraft({ dailyRate: stay?.dailyRate ?? (clinicDayRate ?? ''), mealsPerDay: fp.mealsPerDay ?? '', ratePerMeal: fp.ratePerMeal ?? '', providedByClient: fp.providedByClient === true, feedingTimes: fp.feedingTimes ?? '' });
    setPricingOpen(o => !o);
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
      const res = await boardingAPI.update(stayId, { dailyRate: priceDraft.dailyRate === '' ? undefined : Number(priceDraft.dailyRate), foodProgram: fp } as any);
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
    const at = existing?.logDate ? (() => { const d = new Date(existing.logDate); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })() : `${day}T12:00`;
    setDayDraft(existing ? { id: existing.id, at, mealPhoto: existing.mealPhoto || '', fedAm: !!existing.fedAm, fedPm: !!existing.fedPm, walked: !!existing.walked, medicationGiven: !!existing.medicationGiven, stool: existing.stool || '', appetite: existing.appetite || '', foodNotes: existing.foodNotes || '', notes: existing.notes || '' } : { at, mealPhoto: '', fedAm: false, fedPm: false, walked: false, medicationGiven: false, stool: '', appetite: '', foodNotes: '', notes: '' });
  };
  const saveDayDraft = async (dateKey: string) => {
    setDaySaving(true);
    try {
      const at = dayDraft.at ? new Date(dayDraft.at).toISOString() : `${dateKey.split('#')[0]}T12:00:00.000Z`;
      const payload: any = { fedAm: dayDraft.fedAm, fedPm: dayDraft.fedPm, walked: dayDraft.walked, medicationGiven: dayDraft.medicationGiven, stool: dayDraft.stool || undefined, appetite: dayDraft.appetite || undefined, foodNotes: dayDraft.foodNotes || undefined, notes: dayDraft.notes || undefined, mealPhoto: dayDraft.mealPhoto || undefined, logDate: at };
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
      if (res.success && res.data?.stay) setStay(res.data.stay);
    } catch (e) { console.error('Failed to load stay', e); }
    finally { setLoading(false); }
  }, [stayId]);

  useEffect(() => { setStay(null); load(); }, [stayId, load]);
  useEffect(() => {
    const apptId = stay?.billing?.appointmentId;
    if (!apptId) { setConsumables([]); return; }
    let alive = true;
    consumablesAPI.list(apptId, { silent: true } as any)
      .then(r => { if (alive && r.success && Array.isArray(r.data)) setConsumables(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [stay?.billing?.appointmentId, stay?.dailyLogs?.length]);


  const checkOut = async (reminder: ReminderDraft | null) => {
    setBusy(true);
    try {
      const res = await boardingAPI.update(stayId, { status: 'CHECKED_OUT', ...(dischargeWeight ? { dischargeWeight: Number(dischargeWeight) } : {}), reminder });
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

  return (
    <div className={`space-y-5 animate-in fade-in duration-300 ${embedded ? '' : 'pb-20'}`}>
      {/* Header — Lab-style back link + pine banner (link hidden when the
          page is embedded in the visit wizard's Boarding step) */}
      {!embedded && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
          <ArrowLeft size={13} /> Boarding
        </button>
      )}
      <div>
        <div className="bg-gradient-to-br from-pine to-pine/90 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <Home size={20} className="text-seafoam shrink-0" />
            <div className="min-w-0">
              <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Boarding stay</p>
              <h2 className="text-lg font-black truncate flex items-center gap-2"><Dog size={16} /> {stay?.pet?.name ?? '…'}</h2>
              {stay && <p className="text-[10px] text-white/70">{stay.pet?.breed} · {stay.pet?.species} · Owner: {stay.client?.name}</p>}
            </div>
          </div>
          <div className="flex flex-row flex-wrap sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
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
          </div>
        </div>
      </div>

      {loading && !stay ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : stay ? (
        // One column (user, 2026-08-03): the stay context / actions / checkout
        // column used to sit beside the care sheet, squeezing the thing staff
        // actually work in into two thirds. It runs full width UNDER it now.
        <div className="space-y-4">
          {/* MAIN — daily care logging + care log history */}
          <div className="space-y-4">
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
              <NotesFormatToggle className="mb-3" value={stay.displayFormat || 'PARAGRAPH'} onChange={(v) => { boardingAPI.update(stayId, { displayFormat: v } as any).then(() => { load(); onChanged?.(); }); }} />
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
                const rate = Number(stay.dailyRate ?? clinicDayRate ?? 0);
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
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                        <ConsumablePicker compact appointmentId={stay.billing.appointmentId}
                          recordedAt={dayDraft.at ? new Date(dayDraft.at).toISOString() : null}
                          onChanged={() => { load(); onChanged?.(); }} title="Items used this day" />
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
                      const consRows = dayCons.map(c => (
                        <div key={`c-${c.id}`} className="mt-1.5 flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg px-3 py-1.5 border border-emerald-100 dark:border-emerald-900/40">
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 shrink-0">Item</span>
                          <span className="min-w-0 flex-1 text-[10px] text-pine dark:text-zinc-200 truncate">{c.inventoryItem?.name} × {Number(c.quantity)} {c.inventoryItem?.unit || ''}</span>
                          <span className="text-[9px] font-black text-emerald-600 shrink-0">{c.billable ? fmtK(Number(c.lineTotal ?? (Number(c.unitPrice) || 0) * (Number(c.quantity) || 0))) : 'no charge'}</span>
                        </div>
                      ));
                      {/* Charges for EVERY day, even zero (user) — rate + billed items. */}
                      const chargeLine = (
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">{fmtK(dayTotal)}<span className="text-slate-400 font-bold"> · stay {fmtK(dayRate)} + items {fmtK(itemsCost)}</span></span>
                      );
                      if (logs.length === 0) return (
                        <div key={k} className="rounded-xl p-3 border border-dashed border-slate-200 dark:border-zinc-800">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-black text-pine dark:text-zinc-200">Day {dayNo} · {formatDate(d)}</span>
                            <span className="flex items-center gap-2">{dayCons.length === 0 && <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">Nothing recorded</span>}{chargeLine}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            <span className="font-bold">Fed AM:</span> — · <span className="font-bold">Fed PM:</span> — · <span className="font-bold">Walked:</span> — · <span className="font-bold">Meds:</span> — · <span className="font-bold">Stool:</span> — · <span className="font-bold">Appetite:</span> — · <span className="font-bold">Notes:</span> —
                          </p>
                          {consRows}
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
                      const stamp = (l: any) => l.logDate ?? l.createdAt;
                      const ordered = [...logs].sort((x, y) =>
                        new Date(stamp(x)).getTime() - new Date(stamp(y)).getTime());
                      return (
                        <div key={k} className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-slate-100 dark:border-zinc-800">
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
                                {dayEditor(`${k}#${l.id}`)}
                              </div>
                            ))}
                          </div>
                          {consRows}
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

          {/* Stay context, actions, checkout — full width, below the sheet. */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              {/* Stay facts — after check-out the grid shows the real
                  check-in → check-out range and the billed day count. */}
              <div className="grid grid-cols-2 gap-3">
                <Fact label="Status" value={stay.status === 'ADMITTED'
                  ? `Day ${Math.max(0, calendarDaysBetween(stay.dropOffAt)) + 1}`
                  : stay.status === 'CHECKED_OUT' && stay.actualPickupAt
                    ? (() => { const d = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt)); return `Checked out · ${d} day${d === 1 ? '' : 's'}`; })()
                    : stay.status} />
                <Fact label="Kennel" value={stay.kennel || '—'} />
                <Fact label="Check-in" value={`${formatDate(stay.dropOffAt)} · ${new Date(stay.dropOffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                {stay.status === 'CHECKED_OUT' && stay.actualPickupAt
                  ? <Fact label="Check-out" value={`${formatDate(stay.actualPickupAt)} · ${new Date(stay.actualPickupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                  : <Fact label="Expected pickup" value={stay.expectedPickupAt ? `${formatDate(stay.expectedPickupAt)} · ${new Date(stay.expectedPickupAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'} />}
              </div>

              {/* Which appointment this stay belongs to + spawn a grooming service */}
              {(stay.billing?.appointmentId || stay.appointmentId) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onOpenAppointment?.((stay.billing?.appointmentId || stay.appointmentId)!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
                    <ExternalLink size={12} /> Open visit
                  </button>
                  {active && (
                    <AddCategoryService
                      appointmentId={(stay.billing?.appointmentId || stay.appointmentId)!}
                      categoryKeyword="groom"
                      taskCategory="Grooming"
                      existingNames={groomTasks.map(t => t.name)}
                      existing={groomTasks.map(t => ({ id: t.id, name: t.name }))}
                      label="Add grooming service"
                      tone="pink"
                      onAdded={async () => { await load(); onChanged?.(); }}
                    />
                  )}
                  <button onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
                    <Share2 size={12} /> Share{stay.allowedClinicIds && stay.allowedClinicIds.length > 0 ? ` · ${stay.allowedClinicIds.length}` : ''}
                  </button>
                </div>
              )}

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
                    {active && (stay.dailyRate ?? clinicDayRate) ? (() => {
                      const r = Number(stay.dailyRate ?? clinicDayRate);
                      return (
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                          Accruing: {days} day{days === 1 ? '' : 's'} × KES {r.toLocaleString()} = <b className="text-pine dark:text-zinc-100">KES {(days * r).toLocaleString()}</b> <span className="text-slate-400">(added at checkout)</span>
                          {stay.dailyRate == null && (
                            <span className="text-amber-500 font-bold"> · clinic default — save the price to pin it to this stay</span>
                          )}
                        </p>
                      );
                    })() : null}
                    {/* The FOOD accrual — visible so a meals/rate typo can't hide. */}
                    {foodPerDay > 0 && (
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        Food: {Number(fp.mealsPerDay)} meal{Number(fp.mealsPerDay) === 1 ? '' : 's'}/day × KES {Number(fp.ratePerMeal).toLocaleString()} = KES {foodPerDay.toLocaleString()}/day → <b className="text-pine dark:text-zinc-100">KES {(days * foodPerDay).toLocaleString()}</b>
                      </p>
                    )}
                    <button onClick={openPricing} className="px-2.5 py-1 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/20">
                      {pricingOpen ? 'Close' : '✎ Edit stay & food pricing'}
                    </button>
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
                        <button onClick={savePricing} disabled={priceSaving} className="w-full py-2 bg-seafoam text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50">
                          {priceSaving ? <Loader2 size={12} className="animate-spin" /> : null} Save — re-price accrued charges
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Billing (finalize · reminder · settle) lives ONLY on the visit
                workflow — checkout below completes the stay and routes there. */}

            {/* Check out — capture discharge weight for the weight-change record */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              {active ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Scale size={15} className="text-slate-400 shrink-0" />
                    <input type="number" min="0" step="0.1" placeholder={`Discharge weight (kg)${stay.intakeWeight != null ? ` · intake ${stay.intakeWeight}` : ''}`} value={dischargeWeight} onChange={e => setDischargeWeight(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
                  </div>
                  <button onClick={() => checkOut(null)} disabled={busy} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                    <LogOut size={15} /> Check out
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  {stay.actualPickupAt && (() => { const d = Math.max(1, calendarDaysBetween(stay.dropOffAt, stay.actualPickupAt)); return (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(stay.dropOffAt)} → {formatDate(stay.actualPickupAt)} · {d} day{d === 1 ? '' : 's'}</p>
                  ); })()}
                  {stay.weightChange != null && <p className="text-[10px] font-black uppercase tracking-widest"><span className={stay.weightChange >= 0 ? 'text-emerald-600' : 'text-amber-600'}>Weight {stay.weightChange >= 0 ? '+' : ''}{stay.weightChange.toFixed(1)} kg</span> <span className="text-slate-400">({stay.intakeWeight} → {stay.dischargeWeight} kg)</span></p>}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-sm text-slate-400">Stay not found.</div>
      )}

      {/* Check-out requires a follow-up reminder (hard gate). */}
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

const Instr: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <p><span className="font-black text-slate-400 uppercase text-[9px] tracking-widest mr-1.5">{label}:</span><span className="text-slate-600 dark:text-zinc-300">{value}</span></p>
);

export default BoardingStayPage;

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Home, Loader2, LogOut, Plus, Dog, ShieldCheck, ShieldAlert, Utensils, Footprints, Pill, ClipboardList, Camera, Scale, Scissors, ExternalLink, Share2, Trash2 } from 'lucide-react';
import { boardingAPI, BoardingStay, visitsAPI, toast, servicesAPI } from '../../../services';
import NotesFormatToggle from '../shared/NotesFormatToggle';
import { formatDate, calendarDaysBetween } from '../../../services/utils/dateFormatter';
import ConsumablePicker from '../shared/ConsumablePicker';
import ShareWithClinics from '../shared/ShareWithClinics';
import FinalizeReminderGate, { ReminderDraft } from '../appointments/FinalizeReminderGate';

// Full-page boarding stay — converted from the old right-side drawer so the
// stay is a real navigable page (deep-linkable via nav param stayId).

interface Props {
  stayId: string;
  onBack: () => void;
  onChanged?: () => void;
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
  onOpenGrooming?: (appointmentId: string) => void;
}

const STOOL = ['normal', 'abnormal', 'none'];
const APPETITE = ['excellent', 'good', 'fair', 'poor', 'none'];

const BoardingStayPage: React.FC<Props> = ({ stayId, onBack, onChanged, onOpenAppointment, onOpenGrooming }) => {
  const [stay, setStay] = useState<BoardingStay | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // New daily-log draft
  const [log, setLog] = useState({ fedAm: false, fedPm: false, walked: false, medicationGiven: false, stool: '', appetite: '', notes: '', mealPhoto: '', foodNotes: '' });
  const [dischargeWeight, setDischargeWeight] = useState('');
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Spawn a grooming service onto this stay's linked appointment so it surfaces
  // (with real name + price) on the visit's SERVICES list and is attended on the
  // Grooming page. Picks from the catalog's grooming category; generic fallback.
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

  const groomAdded = (name: string) => groomTasks.some(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());

  const addGroomingService = async (svc?: { name: string; defaultPrice?: number }) => {
    const apptId = stay?.billing?.appointmentId || stay?.appointmentId;
    if (!apptId) return;
    const name = svc?.name || 'Grooming service';
    // One instance per service — remove the existing one first to re-add.
    if (groomAdded(name)) { toast.error(`"${name}" is already on this visit`); return; }
    setBusy(true);
    try {
      await visitsAPI.addTask(Number(apptId), { name, category: 'Grooming', status: 'PENDING' as any, price: Number(svc?.defaultPrice ?? 0) } as any);
      toast.success(`Added "${name}" — detail it on the Grooming page`);
      loadGroomTasks(apptId);
      onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Failed to add grooming service'); }
    finally { setBusy(false); }
  };

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await boardingAPI.getById(stayId);
      if (res.success && res.data?.stay) setStay(res.data.stay);
    } catch (e) { console.error('Failed to load stay', e); }
    finally { setLoading(false); }
  }, [stayId]);

  useEffect(() => { setStay(null); load(); }, [stayId, load]);

  const saveLog = async () => {
    setBusy(true);
    try {
      const res = await boardingAPI.addLog(stayId, {
        fedAm: log.fedAm, fedPm: log.fedPm, walked: log.walked, medicationGiven: log.medicationGiven,
        stool: log.stool || null, appetite: log.appetite || null, notes: log.notes || null,
        mealPhoto: log.mealPhoto || null, foodNotes: log.foodNotes || null,
      });
      if (res.success) {
        setLog({ fedAm: false, fedPm: false, walked: false, medicationGiven: false, stool: '', appetite: '', notes: '', mealPhoto: '', foodNotes: '' });
        await load();
      }
    } finally { setBusy(false); }
  };

  // Downscale a meal photo to a small base64 data URL (R2 not configured yet).
  const onMealPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 640; const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setLog(s => ({ ...s, mealPhoto: canvas.toDataURL('image/jpeg', 0.7) }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

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
    <div className="space-y-5 pb-20 animate-in fade-in duration-300">
      {/* Header — Lab-style back link + pine banner */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Boarding
      </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* MAIN — daily care logging + care log history */}
          <div className="lg:col-span-2 space-y-4">
            {/* Add daily log */}
            {active && (
              <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5"><ClipboardList size={13} /> Log today's care</p>
                <div className="flex flex-wrap gap-2">
                  <Toggle on={log.fedAm} onClick={() => setLog(s => ({ ...s, fedAm: !s.fedAm }))} icon={Utensils} label="Fed AM" />
                  <Toggle on={log.fedPm} onClick={() => setLog(s => ({ ...s, fedPm: !s.fedPm }))} icon={Utensils} label="Fed PM" />
                  <Toggle on={log.walked} onClick={() => setLog(s => ({ ...s, walked: !s.walked }))} icon={Footprints} label="Walked" />
                  <Toggle on={log.medicationGiven} onClick={() => setLog(s => ({ ...s, medicationGiven: !s.medicationGiven }))} icon={Pill} label="Meds" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className="px-2 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" value={log.stool} onChange={e => setLog(s => ({ ...s, stool: e.target.value }))}>
                    <option value="">Stool…</option>{STOOL.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select className="px-2 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" value={log.appetite} onChange={e => setLog(s => ({ ...s, appetite: e.target.value }))}>
                    <option value="">Appetite…</option>{APPETITE.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <input className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" placeholder="What did they eat? (e.g. ½ cup A/D, ate fully)" value={log.foodNotes} onChange={e => setLog(s => ({ ...s, foodNotes: e.target.value }))} />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:border-seafoam">
                    <Camera size={13} /> {log.mealPhoto ? 'Change photo' : 'Meal photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => onMealPhoto(e.target.files?.[0])} />
                  </label>
                  {log.mealPhoto && <img src={log.mealPhoto} alt="meal" className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-zinc-800" />}
                  {log.mealPhoto && <button type="button" onClick={() => setLog(s => ({ ...s, mealPhoto: '' }))} className="text-[10px] font-bold text-rose-500">Remove</button>}
                </div>
                <textarea className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" rows={2} placeholder="Notes (e.g. bright and alert, vomited once)" value={log.notes} onChange={e => setLog(s => ({ ...s, notes: e.target.value }))} />
                <button onClick={saveLog} disabled={busy} className="w-full py-2 bg-seafoam text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add log
                </button>
              </section>
            )}

            {/* Daily log history — format toggle sits directly above the care-log notes. */}
            <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
              <NotesFormatToggle className="mb-3" value={stay.displayFormat || 'PARAGRAPH'} onChange={(v) => { boardingAPI.update(stayId, { displayFormat: v } as any).then(() => { load(); onChanged?.(); }); }} />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Care log</p>
              {stay.dailyLogs && stay.dailyLogs.length > 0 ? (
                <div className="space-y-2">
                  {stay.dailyLogs.map(l => (
                    <div key={l.id} className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-pine dark:text-zinc-200">{formatDate(l.logDate)}</span>
                        <div className="flex gap-1.5 text-[9px] font-bold">
                          {l.fedAm && <span className="text-emerald-600">AM</span>}
                          {l.fedPm && <span className="text-emerald-600">PM</span>}
                          {l.walked && <span className="text-seafoam">Walk</span>}
                          {l.medicationGiven && <span className="text-indigo-500">Med</span>}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {l.appetite && `Appetite: ${l.appetite}. `}{l.stool && `Stool: ${l.stool}. `}{l.foodNotes && `Ate: ${l.foodNotes}. `}{l.notes}
                      </p>
                      {l.mealPhoto && <img src={l.mealPhoto} alt="meal" className="mt-2 w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-zinc-800" />}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400 text-center py-4">No care logged yet.</p>}
            </section>

            {/* Consumables & items used (deduct stock + billable charge). */}
            {active && stay.billing?.appointmentId && (
              <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                <ConsumablePicker appointmentId={stay.billing.appointmentId} onChanged={() => { load(); onChanged?.(); }} title="Consumables & items used" />
              </section>
            )}
          </div>

          {/* SIDE — stay context, actions, checkout */}
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
                    <button onClick={() => setShowGroomPicker(v => !v)} disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-300 dark:border-pink-900/50 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 transition-all disabled:opacity-50">
                      <Scissors size={12} /> Add grooming service
                    </button>
                  )}
                  <button onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
                    <Share2 size={12} /> Share{stay.allowedClinicIds && stay.allowedClinicIds.length > 0 ? ` · ${stay.allowedClinicIds.length}` : ''}
                  </button>
                </div>
              )}

              {/* Grooming service picker — select real catalog services to add to
                  the linked visit (shown under GROOMING, attended on Grooming page). */}
              {showGroomPicker && active && (
                <div className="rounded-xl border border-pink-200 dark:border-pink-900/40 bg-pink-50/50 dark:bg-pink-950/20 p-3 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-pink-600">Select grooming services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {groomServices.map(s => groomAdded(s.name) ? (
                      <span key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {s.name} · Added
                      </span>
                    ) : (
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
              {active && stay.dailyRate ? (() => {
                const days = Math.max(1, calendarDaysBetween(stay.dropOffAt));
                return (
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                    Accruing: {days} day{days === 1 ? '' : 's'} × KES {stay.dailyRate.toLocaleString()} = <b className="text-pine dark:text-zinc-100">KES {(days * stay.dailyRate).toLocaleString()}</b> <span className="text-slate-400">(added at checkout)</span>
                  </p>
                );
              })() : null}
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

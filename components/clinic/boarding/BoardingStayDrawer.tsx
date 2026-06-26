import React, { useState, useEffect, useCallback } from 'react';
import { X, Home, Loader2, LogOut, Plus, Dog, ShieldCheck, ShieldAlert, Utensils, Footprints, Pill, ClipboardList, CreditCard, ArrowRight, Camera, Scale, Scissors, ExternalLink } from 'lucide-react';
import { boardingAPI, BoardingStay, appointmentsAPI, toast } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import ConsumablePicker from '../shared/ConsumablePicker';
import FinalizeReminderGate, { ReminderDraft } from '../appointments/FinalizeReminderGate';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';

interface Props {
  stayId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

const STOOL = ['normal', 'abnormal', 'none'];
const APPETITE = ['excellent', 'good', 'fair', 'poor', 'none'];

const daysBetween = (a: string, b?: string | null) => {
  const start = new Date(a).getTime();
  const end = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 86400000));
};

const BoardingStayDrawer: React.FC<Props> = ({ stayId, onClose, onChanged, onOpenAppointment }) => {
  const [stay, setStay] = useState<BoardingStay | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // New daily-log draft
  const [log, setLog] = useState({ fedAm: false, fedPm: false, walked: false, medicationGiven: false, stool: '', appetite: '', notes: '', mealPhoto: '', foodNotes: '' });
  const [dischargeWeight, setDischargeWeight] = useState('');
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [showSettleGate, setShowSettleGate] = useState(false);

  // Spawn a grooming service onto this stay's linked appointment so it surfaces
  // (with real name + price) on the visit's SERVICES list and is attended on the
  // Grooming page. Picks from the catalog's grooming category; generic fallback.
  const { categories: refCategories, getServicesByCategory } = useReferenceData();
  const [showGroomPicker, setShowGroomPicker] = useState(false);
  const groomCat = refCategories.find(c => c.name.toLowerCase().includes('groom'));
  const groomServices = groomCat ? getServicesByCategory(groomCat.id) : [];
  const addGroomingService = async (svc?: { name: string; defaultPrice?: number }) => {
    const apptId = stay?.billing?.appointmentId || stay?.appointmentId;
    if (!apptId) return;
    setBusy(true);
    try {
      await appointmentsAPI.addTask(Number(apptId), { name: svc?.name || 'Grooming service', category: groomCat?.name || 'Grooming', status: 'PENDING' as any, price: Number(svc?.defaultPrice ?? 0) } as any);
      toast.success(`Added "${svc?.name || 'Grooming service'}" — detail it on the Grooming page`);
      onChanged();
    } catch (e: any) { toast.error(e?.message || 'Failed to add grooming service'); }
    finally { setBusy(false); }
  };

  const settleBill = async (reminder: ReminderDraft | null) => {
    if (!stay?.billing) return;
    setBusy(true);
    try {
      const r = await boardingAPI.bill(stay.id, reminder);
      setShowSettleGate(false);
      onChanged();
      onOpenAppointment?.(r.data?.appointmentId || stay.billing.appointmentId, true);
    } catch { /* error toast shown by api */ } finally { setBusy(false); }
  };

  const load = useCallback(async () => {
    if (!stayId) return;
    setLoading(true);
    try {
      const res = await boardingAPI.getById(stayId);
      if (res.success && res.data?.stay) setStay(res.data.stay);
    } catch (e) { console.error('Failed to load stay', e); }
    finally { setLoading(false); }
  }, [stayId]);

  useEffect(() => { setStay(null); if (stayId) load(); }, [stayId, load]);

  if (!stayId) return null;

  const saveLog = async () => {
    if (!stayId) return;
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
    if (!stayId) return;
    setBusy(true);
    try {
      const res = await boardingAPI.update(stayId, { status: 'CHECKED_OUT', ...(dischargeWeight ? { dischargeWeight: Number(dischargeWeight) } : {}), reminder });
      if (res.success) { setShowCheckoutGate(false); onChanged(); onClose(); }
    } finally { setBusy(false); }
  };

  const Toggle: React.FC<{ on: boolean; onClick: () => void; icon: React.ElementType; label: string }> = ({ on, onClick, icon: Icon, label }) => (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
      <Icon size={12} /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-pine to-pine/90 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Home size={20} className="text-seafoam shrink-0" />
            <div className="min-w-0">
              <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Boarding stay</p>
              <h2 className="text-lg font-black truncate flex items-center gap-2"><Dog size={16} /> {stay?.pet?.name ?? '…'}</h2>
              {stay && <p className="text-[10px] text-white/70">{stay.pet?.breed} · {stay.pet?.species} · Owner: {stay.client?.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
        </div>

        {loading && !stay ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
        ) : stay ? (
          <div className="p-5 space-y-5">
            {/* Stay facts */}
            <div className="grid grid-cols-2 gap-3">
              <Fact label="Status" value={stay.status === 'ADMITTED' ? `Day ${daysBetween(stay.dropOffAt) + 1}` : stay.status} />
              <Fact label="Kennel" value={stay.kennel || '—'} />
              <Fact label="Drop-off" value={formatDate(stay.dropOffAt)} />
              <Fact label="Expected pickup" value={stay.expectedPickupAt ? formatDate(stay.expectedPickupAt) : '—'} />
            </div>

            {/* Which appointment this stay belongs to + spawn a grooming service */}
            {(stay.billing?.appointmentId || stay.appointmentId) && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onOpenAppointment?.((stay.billing?.appointmentId || stay.appointmentId)!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
                  <ExternalLink size={12} /> Linked appointment
                </button>
                {stay.status === 'ADMITTED' && (
                  <button onClick={() => setShowGroomPicker(v => !v)} disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-300 dark:border-pink-900/50 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 transition-all disabled:opacity-50">
                    <Scissors size={12} /> Add grooming service
                  </button>
                )}
              </div>
            )}

            {/* Grooming service picker — select real catalog services to add to
                the linked visit (shown under GROOMING, attended on Grooming page). */}
            {showGroomPicker && stay.status === 'ADMITTED' && (
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

            {/* Add daily log */}
            {stay.status === 'ADMITTED' && (
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
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
              </div>
            )}

            {/* Daily log history */}
            <div>
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
            </div>

            {/* Accruing per-night charge (added to the bill at checkout). */}
            {stay.status === 'ADMITTED' && stay.dailyRate ? (() => {
              const nights = Math.max(1, Math.ceil((Date.now() - new Date(stay.dropOffAt).getTime()) / 86400000));
              return (
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 px-1">
                  Accruing: {nights} night{nights === 1 ? '' : 's'} × KES {stay.dailyRate.toLocaleString()} = <b className="text-pine dark:text-zinc-100">KES {(nights * stay.dailyRate).toLocaleString()}</b> <span className="text-slate-400">(added at checkout)</span>
                </p>
              );
            })() : null}

            {/* Consumables & items used (deduct stock + billable charge). */}
            {stay.status === 'ADMITTED' && stay.billing?.appointmentId && (
              <ConsumablePicker appointmentId={stay.billing.appointmentId} onChanged={onChanged} title="Consumables & items used" />
            )}

            {/* Billing — gated: settling requires a follow-up reminder + finalize. */}
            {stay.billing && (
              <button onClick={() => stay.billing!.isPaid ? onOpenAppointment?.(stay.billing!.appointmentId) : setShowSettleGate(true)} disabled={busy} className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-seafoam transition-all disabled:opacity-50">
                <span className="flex items-center gap-2">
                  <CreditCard size={15} className={stay.billing.isPaid ? 'text-emerald-500' : 'text-amber-500'} />
                  <span className="text-left">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Bill {stay.billing.isPaid ? '· paid' : '· unpaid'}</span>
                    <span className="block text-sm font-black text-pine dark:text-zinc-100">KES {stay.billing.totalCost.toLocaleString()}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-seafoam text-right">{stay.billing.isPaid ? 'Receipt' : (stay.billing.hasReminder ? 'Finalize visit to enable billing' : 'Finalize visit & set reminder to enable billing')} <ArrowRight size={12} className="shrink-0" /></span>
              </button>
            )}

            {/* Check out — capture discharge weight for the weight-change record */}
            {stay.status === 'ADMITTED' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Scale size={15} className="text-slate-400 shrink-0" />
                  <input type="number" min="0" step="0.1" placeholder={`Discharge weight (kg)${stay.intakeWeight != null ? ` · intake ${stay.intakeWeight}` : ''}`} value={dischargeWeight} onChange={e => setDischargeWeight(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
                </div>
                <button onClick={() => setShowCheckoutGate(true)} disabled={busy} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                  <LogOut size={15} /> Check out & settle
                </button>
              </div>
            )}
            {stay.status === 'CHECKED_OUT' && (
              <div className="text-center space-y-1">
                {stay.actualPickupAt && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Checked out {formatDate(stay.actualPickupAt)}</p>}
                {stay.weightChange != null && <p className="text-[10px] font-black uppercase tracking-widest"><span className={stay.weightChange >= 0 ? 'text-emerald-600' : 'text-amber-600'}>Weight {stay.weightChange >= 0 ? '+' : ''}{stay.weightChange.toFixed(1)} kg</span> <span className="text-slate-400">({stay.intakeWeight} → {stay.dischargeWeight} kg)</span></p>}
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-400">Stay not found.</div>
        )}
      </div>

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
      {/* Settling the bill requires a follow-up reminder too. */}
      <FinalizeReminderGate
        open={showSettleGate}
        petName={stay?.pet?.name ?? 'Patient'}
        clientName={stay?.client?.name ?? 'Client'}
        encounterType="BOARDING"
        petDeceased={false}
        submitting={busy}
        onCancel={() => setShowSettleGate(false)}
        onConfirm={(reminder) => settleBill(reminder)}
      />
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

export default BoardingStayDrawer;

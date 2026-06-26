import React, { useState, useEffect, useCallback } from 'react';
import { X, Stethoscope, Loader2, LogOut, Plus, Dog, Activity, Thermometer, ClipboardList, CheckCircle2, Circle, CreditCard, ArrowRight, Scissors, ExternalLink } from 'lucide-react';
import { inpatientAPI, Hospitalization, LogKind, DischargeOutcome, appointmentsAPI, toast } from '../../../services';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import ConsumablePicker from '../shared/ConsumablePicker';
import FinalizeReminderGate, { ReminderDraft } from '../appointments/FinalizeReminderGate';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';

interface Props { hospId: string | null; onClose: () => void; onChanged: () => void; onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; }

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

// Readable one-liner from a log's structured data.
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

const InpatientChartDrawer: React.FC<Props> = ({ hospId, onClose, onChanged, onOpenAppointment }) => {
  const [h, setH] = useState<Hospitalization | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vital, setVital] = useState({ temperature: '', pulse: '', respiration: '', weight: '', mucousMembrane: '', crt: '' });
  const [logKind, setLogKind] = useState<LogKind>('TREATMENT_TASK');
  const [logData, setLogData] = useState<Record<string, string>>({});
  const [showDischarge, setShowDischarge] = useState(false);
  const [showDischargeGate, setShowDischargeGate] = useState(false);
  const [showSettleGate, setShowSettleGate] = useState(false);

  // Spawn a grooming service onto this hospitalization's linked appointment so
  // it surfaces (with real name + price) on the visit's SERVICES list and is
  // attended/detailed on the Grooming page. Picks from the catalog's grooming
  // category; falls back to a generic line.
  const { categories: refCategories, getServicesByCategory } = useReferenceData();
  const [showGroomPicker, setShowGroomPicker] = useState(false);
  const groomCat = refCategories.find(c => c.name.toLowerCase().includes('groom'));
  const groomServices = groomCat ? getServicesByCategory(groomCat.id) : [];
  const addGroomingService = async (svc?: { name: string; defaultPrice?: number }) => {
    const apptId = h?.billing?.appointmentId || h?.appointmentId;
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
    if (!h?.billing || !hospId) return;
    setBusy(true);
    try {
      const r = await inpatientAPI.bill(hospId, reminder);
      setShowSettleGate(false);
      onChanged();
      onOpenAppointment?.(r.data?.appointmentId || h.billing.appointmentId, true);
    } catch { /* api shows error */ } finally { setBusy(false); }
  };
  const [discharge, setDischarge] = useState({ outcome: 'RECOVERED' as DischargeOutcome, dischargeNotes: '', homeInstructions: '', finalWeight: '' });

  const load = useCallback(async () => {
    if (!hospId) return;
    setLoading(true);
    try { const res = await inpatientAPI.getById(hospId); if (res.success && res.data?.hospitalization) setH(res.data.hospitalization); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [hospId]);

  useEffect(() => { setH(null); if (hospId) load(); }, [hospId, load]);
  if (!hospId) return null;

  const addVital = async () => {
    if (!hospId) return;
    setBusy(true);
    try {
      await inpatientAPI.addVital(hospId, {
        temperature: vital.temperature ? Number(vital.temperature) : null,
        pulse: vital.pulse ? Number(vital.pulse) : null,
        respiration: vital.respiration ? Number(vital.respiration) : null,
        weight: vital.weight ? Number(vital.weight) : null,
        mucousMembrane: vital.mucousMembrane || null, crt: vital.crt || null,
      });
      setVital({ temperature: '', pulse: '', respiration: '', weight: '', mucousMembrane: '', crt: '' });
      await load();
    } finally { setBusy(false); }
  };

  const addLog = async () => {
    if (!hospId) return;
    setBusy(true);
    try {
      await inpatientAPI.addLog(hospId, { kind: logKind, status: isTask(logKind) ? 'due' : undefined, data: { ...logData } });
      setLogData({});
      await load();
    } finally { setBusy(false); }
  };

  const toggleTask = async (logId: string, status: string | null) => {
    await inpatientAPI.updateLog(logId, { status: status === 'done' ? 'due' : 'done' });
    await load();
  };

  const doDischarge = async (reminder: ReminderDraft | null) => {
    if (!hospId) return;
    setBusy(true);
    try {
      const res = await inpatientAPI.discharge(hospId, {
        outcome: discharge.outcome, dischargeNotes: discharge.dischargeNotes || undefined,
        homeInstructions: discharge.homeInstructions || undefined,
        finalWeight: discharge.finalWeight ? Number(discharge.finalWeight) : undefined,
        reminder,
      });
      if (res.success) { setShowDischargeGate(false); onChanged(); onClose(); }
    } finally { setBusy(false); }
  };

  // Adaptive fields for the "add log" form.
  const F = (key: string, ph: string) => <input className={fieldCls} placeholder={ph} value={logData[key] || ''} onChange={e => setLogData(s => ({ ...s, [key]: e.target.value }))} />;
  const logFields = () => {
    switch (logKind) {
      case 'TREATMENT_TASK': return F('task', 'Task (e.g. flush catheter)');
      case 'MEDICATION': return <div className="grid grid-cols-3 gap-2">{F('drug', 'Drug')}{F('dose', 'Dose')}{F('route', 'Route')}</div>;
      case 'FLUID_INTAKE': return <div className="grid grid-cols-2 gap-2">{F('type', 'Type (LRS, NaCl…)')}{F('amount', 'Amount (ml)')}</div>;
      case 'FLUID_OUTPUT': return <div className="grid grid-cols-2 gap-2">{F('type', 'Urine / Vomit / Diarrhea')}{F('amount', 'Amount (ml)')}</div>;
      case 'FEEDING': return <div className="grid grid-cols-3 gap-2">{F('food', 'Food')}{F('offered', 'Offered')}{F('eaten', 'Eaten')}</div>;
      case 'ELIMINATION': return <div className="grid grid-cols-2 gap-2">{F('urination', 'Urination')}{F('defecation', 'Defecation')}</div>;
      default: return <textarea className={fieldCls} rows={2} placeholder="Note" value={logData.note || ''} onChange={e => setLogData(s => ({ ...s, note: e.target.value }))} />;
    }
  };

  const active = h?.status === 'ADMITTED';

  return (
    <div className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-xl h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 bg-gradient-to-br from-pine to-pine/90 text-white p-5 flex items-start justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Stethoscope size={20} className="text-seafoam shrink-0" />
            <div className="min-w-0">
              <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Inpatient chart</p>
              <h2 className="text-lg font-black truncate flex items-center gap-2"><Dog size={16} /> {h?.pet?.name ?? '…'}</h2>
              {h && <p className="text-[10px] text-white/70">{h.cage ? `Cage ${h.cage} · ` : ''}{h.inpatientNo || ''} · {h.diagnosis || 'No diagnosis'}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
        </div>

        {loading && !h ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
        ) : h ? (
          <div className="p-5 space-y-5">
            {h.admissionNotes && <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 text-xs text-slate-600 dark:text-zinc-300"><span className="font-black uppercase text-[9px] tracking-widest text-slate-400 mr-1.5">Admission</span>{h.admissionNotes}</div>}

            {/* Which appointment this chart belongs to + spawn a grooming service */}
            {(h.billing?.appointmentId || h.appointmentId) && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onOpenAppointment?.((h.billing?.appointmentId || h.appointmentId)!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
                  <ExternalLink size={12} /> Linked appointment
                </button>
                {active && (
                  <button onClick={() => setShowGroomPicker(v => !v)} disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-300 dark:border-pink-900/50 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 transition-all disabled:opacity-50">
                    <Scissors size={12} /> Add grooming service
                  </button>
                )}
              </div>
            )}

            {/* Grooming service picker — select real catalog services to add to
                the linked visit (shown under GROOMING, attended on Grooming page). */}
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

            {/* Weight check: intake → discharge difference */}
            {(h.intakeWeight != null || h.finalWeight != null) && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                {h.intakeWeight != null && <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500">Intake {h.intakeWeight} kg</span>}
                {h.finalWeight != null && <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500">Discharge {h.finalWeight} kg</span>}
                {h.weightChange != null && <span className={`px-2 py-1 rounded-lg ${h.weightChange >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>{h.weightChange >= 0 ? '+' : ''}{h.weightChange.toFixed(1)} kg</span>}
              </div>
            )}
            {(h.feedingInstructions || h.medicationInstructions) && (
              <div className="space-y-1 text-[11px] text-slate-600 dark:text-zinc-300">
                {h.feedingInstructions && <p><span className="font-black uppercase text-[9px] tracking-widest text-amber-600 mr-1.5">Feeding</span>{h.feedingInstructions}</p>}
                {h.medicationInstructions && <p><span className="font-black uppercase text-[9px] tracking-widest text-indigo-500 mr-1.5">Meds</span>{h.medicationInstructions}</p>}
              </div>
            )}

            {/* Vitals */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5 mb-2"><Thermometer size={13} /> Monitoring (TPR)</p>
              {active && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                  <input className={fieldCls} placeholder="Temp °C" value={vital.temperature} onChange={e => setVital(s => ({ ...s, temperature: e.target.value }))} />
                  <input className={fieldCls} placeholder="Pulse" value={vital.pulse} onChange={e => setVital(s => ({ ...s, pulse: e.target.value }))} />
                  <input className={fieldCls} placeholder="Resp" value={vital.respiration} onChange={e => setVital(s => ({ ...s, respiration: e.target.value }))} />
                  <input className={fieldCls} placeholder="Wt kg" value={vital.weight} onChange={e => setVital(s => ({ ...s, weight: e.target.value }))} />
                  <input className={fieldCls} placeholder="MM" value={vital.mucousMembrane} onChange={e => setVital(s => ({ ...s, mucousMembrane: e.target.value }))} />
                  <input className={fieldCls} placeholder="CRT" value={vital.crt} onChange={e => setVital(s => ({ ...s, crt: e.target.value }))} />
                </div>
              )}
              {active && (
                <button onClick={addVital} disabled={busy} className="mb-3 flex items-center justify-center gap-1.5 px-4 py-2 bg-seafoam/10 hover:bg-seafoam/20 text-seafoam rounded-xl text-[10px] font-black uppercase tracking-widest border border-seafoam/30 disabled:opacity-50">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add entry
                </button>
              )}
              {h.vitals && h.vitals.length > 0 ? (
                <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr className="text-slate-400 text-left"><th className="py-1">Time</th><th>T</th><th>P</th><th>R</th><th>Wt</th><th>MM</th><th>CRT</th></tr></thead>
                  <tbody>{h.vitals.slice(-8).reverse().map(v => <tr key={v.id} className="border-t border-slate-100 dark:border-zinc-800 text-pine dark:text-zinc-200"><td className="py-1">{formatTime(v.recordedAt)}</td><td>{v.temperature ?? '—'}</td><td>{v.pulse ?? '—'}</td><td>{v.respiration ?? '—'}</td><td>{v.weight ?? '—'}</td><td>{v.mucousMembrane ?? '—'}</td><td>{v.crt ?? '—'}</td></tr>)}</tbody></table></div>
              ) : <p className="text-[10px] text-slate-400">No vitals recorded.</p>}
            </section>

            {/* Add daily-sheet entry */}
            {active && (
              <section className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5"><ClipboardList size={13} /> Add to daily sheet</p>
                <select className={fieldCls} value={logKind} onChange={e => { setLogKind(e.target.value as LogKind); setLogData({}); }}>
                  {LOG_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                {logFields()}
                <button onClick={addLog} disabled={busy} className="w-full py-2 bg-seafoam text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add entry</button>
              </section>
            )}

            {/* Daily sheet timeline */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Daily sheet</p>
              {h.logs && h.logs.length > 0 ? (
                <div className="space-y-1.5">
                  {h.logs.map(l => (
                    <div key={l.id} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2 border border-slate-100 dark:border-zinc-800">
                      {isTask(l.kind) ? (
                        <button onClick={() => toggleTask(l.id, l.status)} className="shrink-0">{l.status === 'done' ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Circle size={15} className="text-amber-500" />}</button>
                      ) : <Activity size={13} className="text-seafoam shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mr-1.5">{LOG_KINDS.find(k => k.value === l.kind)?.label}</span>
                        <span className="text-[11px] text-pine dark:text-zinc-200">{logSummary(l.kind, l.data)}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0">{formatTime(l.loggedAt)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[10px] text-slate-400">Nothing logged yet.</p>}
            </section>

            {/* Accruing per-night charge (added to the bill at discharge). */}
            {active && h.dailyRate ? (() => {
              const nights = Math.max(1, Math.ceil((Date.now() - new Date(h.admittedAt).getTime()) / 86400000));
              return (
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 px-1">
                  Accruing: {nights} night{nights === 1 ? '' : 's'} × KES {h.dailyRate.toLocaleString()} = <b className="text-pine dark:text-zinc-100">KES {(nights * h.dailyRate).toLocaleString()}</b> <span className="text-slate-400">(added at discharge)</span>
                </p>
              );
            })() : null}

            {/* Consumables & medication used (deduct stock + billable charge). */}
            {active && h.billing?.appointmentId && (
              <ConsumablePicker appointmentId={h.billing.appointmentId} onChanged={onChanged} title="Consumables & medication used" />
            )}

            {/* Billing — settle in place: materialize the bill, then open payment. */}
            {h.billing && (
              <button onClick={() => h.billing!.isPaid ? onOpenAppointment?.(h.billing!.appointmentId) : setShowSettleGate(true)} disabled={busy} className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-seafoam transition-all disabled:opacity-50">
                <span className="flex items-center gap-2">
                  <CreditCard size={15} className={h.billing.isPaid ? 'text-emerald-500' : 'text-amber-500'} />
                  <span className="text-left">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Bill {h.billing.isPaid ? '· paid' : '· unpaid'}</span>
                    <span className="block text-sm font-black text-pine dark:text-zinc-100">KES {h.billing.totalCost.toLocaleString()}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-seafoam text-right">{h.billing.isPaid ? 'Receipt' : (h.billing.hasReminder ? 'Finalize visit to enable billing' : 'Finalize visit & set reminder to enable billing')} <ArrowRight size={12} className="shrink-0" /></span>
              </button>
            )}

            {/* Discharge */}
            {active ? (
              !showDischarge ? (
                <button onClick={() => setShowDischarge(true)} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"><LogOut size={15} /> Discharge</button>
              ) : (
                <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-200">Discharge</p>
                  <select className={fieldCls} value={discharge.outcome} onChange={e => setDischarge(s => ({ ...s, outcome: e.target.value as DischargeOutcome }))}>{OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}</select>
                  <input className={fieldCls} placeholder="Final weight (kg)" value={discharge.finalWeight} onChange={e => setDischarge(s => ({ ...s, finalWeight: e.target.value }))} />
                  <textarea className={fieldCls} rows={2} placeholder="Discharge notes" value={discharge.dischargeNotes} onChange={e => setDischarge(s => ({ ...s, dischargeNotes: e.target.value }))} />
                  <textarea className={fieldCls} rows={2} placeholder="Home instructions" value={discharge.homeInstructions} onChange={e => setDischarge(s => ({ ...s, homeInstructions: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={() => setShowDischarge(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
                    <button onClick={() => setShowDischargeGate(true)} disabled={busy} className="flex-1 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{busy ? 'Discharging…' : 'Confirm discharge'}</button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discharged {h.dischargedAt ? formatDate(h.dischargedAt) : ''}{h.outcome ? ` · ${h.outcome}` : ''}</p>
            )}
          </div>
        ) : <div className="p-10 text-center text-sm text-slate-400">Chart not found.</div>}
      </div>

      {/* Discharge requires a follow-up reminder (a deceased outcome bypasses). */}
      <FinalizeReminderGate
        open={showDischargeGate}
        petName={h?.pet?.name ?? 'Patient'}
        clientName={h?.client?.name ?? 'Client'}
        encounterType="VET_VISIT"
        petDeceased={discharge.outcome === 'DECEASED'}
        submitting={busy}
        onCancel={() => setShowDischargeGate(false)}
        onConfirm={(reminder) => doDischarge(reminder)}
      />
      {/* Settling the bill requires a follow-up reminder too. */}
      <FinalizeReminderGate
        open={showSettleGate}
        petName={h?.pet?.name ?? 'Patient'}
        clientName={h?.client?.name ?? 'Client'}
        encounterType="VET_VISIT"
        petDeceased={false}
        submitting={busy}
        onCancel={() => setShowSettleGate(false)}
        onConfirm={(reminder) => settleBill(reminder)}
      />
    </div>
  );
};

export default InpatientChartDrawer;

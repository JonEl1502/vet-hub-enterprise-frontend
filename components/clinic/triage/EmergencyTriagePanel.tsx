import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, HeartPulse, Wind, Droplets, Brain, Thermometer, Syringe, Stethoscope, Bell, Loader2, Save, Plus, Clock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { triageAPI, consumablesAPI, EmergencyTriageRecord, TriageCategory, TriageOutcome } from '../../../services';
import { formatTime } from '../../../services/utils/dateFormatter';
import { STABILIZATION, billableKey, loadEmergencyBillables } from './emergencyBillables';

interface StaffOpt { id: number | string; name: string }
interface Props {
  appointmentId: number;
  petId: number;
  petName?: string;
  staff?: StaffOpt[];
  // Fires whenever the record's outcome/status changes so the parent can drop
  // the "stabilize first" gate once the patient is stabilized/improved.
  onStatusChange?: (rec: EmergencyTriageRecord) => void;
  // Fires after "discharge to vet visit" saves — the parent clears the
  // stabilize gate and moves the workflow on to the normal clinical flow.
  onDischarged?: () => void;
  // Stabilized/de-escalated visit: the triage stays VIEWABLE as the
  // emergency's medical/legal history but can no longer be edited.
  readOnly?: boolean;
}

// ── Triage categories ─────────────────────────────────────────────
const CATEGORIES: { value: TriageCategory; label: string; sub: string; tone: string }[] = [
  { value: 'CRITICAL', label: '🔴 Critical', sub: 'Immediate', tone: 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  { value: 'URGENT', label: '🟠 Urgent', sub: 'Within 15 min', tone: 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  { value: 'STABLE_URGENT', label: '🟡 Stable-urgent', sub: 'Monitor', tone: 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { value: 'NON_EMERGENCY', label: '🟢 Non-emergency', sub: 'Routine', tone: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
];

const OUTCOMES: { value: TriageOutcome; label: string; proceed: boolean }[] = [
  { value: 'STABILIZED', label: 'Stabilized', proceed: true },
  { value: 'IMPROVED', label: 'Improved', proceed: true },
  { value: 'UNCHANGED', label: 'Unchanged', proceed: false },
  { value: 'DETERIORATING', label: 'Deteriorating', proceed: false },
  { value: 'CPR', label: 'CPR initiated', proceed: false },
  { value: 'REFERRED', label: 'Referred', proceed: false },
  { value: 'HOSPITALIZED', label: 'Hospitalized', proceed: true },
  { value: 'EUTHANASIA', label: 'Euthanasia', proceed: false },
];

// ── ABCDE primary-survey schema (checkbox keys per section) ────────
const ABCDE: { key: string; title: string; icon: React.ElementType; checks: { k: string; label: string }[] }[] = [
  { key: 'airway', title: 'A · Airway', icon: Wind, checks: [
    { k: 'patent', label: 'Patent' }, { k: 'obstructed', label: 'Obstructed' }, { k: 'foreignBody', label: 'Foreign body' },
    { k: 'etTube', label: 'ET tube placed' }, { k: 'tracheostomy', label: 'Tracheostomy' }, { k: 'oxygen', label: 'O₂ supplementation' },
  ] },
  { key: 'breathing', title: 'B · Breathing', icon: Activity, checks: [
    { k: 'cyanosis', label: 'Cyanosis' }, { k: 'openMouth', label: 'Open-mouth breathing' }, { k: 'assistedVent', label: 'Assisted ventilation' },
    { k: 'thoracocentesis', label: 'Thoracocentesis' }, { k: 'chestDrain', label: 'Chest drain' },
  ] },
  { key: 'circulation', title: 'C · Circulation', icon: HeartPulse, checks: [
    { k: 'activeHaemorrhage', label: 'Active haemorrhage' }, { k: 'pressureBandage', label: 'Pressure bandage' }, { k: 'tourniquet', label: 'Tourniquet' },
    { k: 'ivCatheter', label: 'IV catheter' }, { k: 'ioCatheter', label: 'IO catheter' }, { k: 'fluidBolus', label: 'Fluid bolus' }, { k: 'transfusion', label: 'Transfusion' },
  ] },
  { key: 'disability', title: 'D · Disability', icon: Brain, checks: [
    { k: 'seizure', label: 'Seizure' }, { k: 'diazepam', label: 'Diazepam given' }, { k: 'mannitol', label: 'Mannitol' },
  ] },
  { key: 'exposure', title: 'E · Exposure', icon: Thermometer, checks: [
    { k: 'hypothermia', label: 'Hypothermia' }, { k: 'hyperthermia', label: 'Hyperthermia' }, { k: 'traumaAssessed', label: 'Trauma assessed' },
    { k: 'burns', label: 'Burns' }, { k: 'biteWounds', label: 'Bite wounds' }, { k: 'openFractures', label: 'Open fractures' },
  ] },
];

// Stabilization protocol groups + billables config live in
// ./emergencyBillables (shared with Clinic Management → Emergency Billables).

// Monitoring metrics shown in the add-reading row + trend.
const MONITOR_FIELDS: { k: string; label: string }[] = [
  { k: 'hr', label: 'HR' }, { k: 'rr', label: 'RR' }, { k: 'temp', label: 'Temp' }, { k: 'bp', label: 'BP' },
  { k: 'spo2', label: 'SpO₂' }, { k: 'glucose', label: 'Glucose' }, { k: 'lactate', label: 'Lactate' }, { k: 'crt', label: 'CRT' },
  { k: 'mmColour', label: 'MM' }, { k: 'urineOutput', label: 'Urine' }, { k: 'painScore', label: 'Pain' },
];
const TREND_METRICS = [{ k: 'hr', label: 'HR', tone: '#ef4444' }, { k: 'rr', label: 'RR', tone: '#06b6d4' }, { k: 'temp', label: 'Temp', tone: '#f59e0b' }];

// Tiny inline sparkline (no chart-lib overhead inside the panel).
const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (values.length < 2) return <div className="h-8 flex items-center text-[9px] text-slate-300">—</div>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24 - 2}`).join(' ');
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-8">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const CheckChip: React.FC<{ on: boolean; label: string; onClick: () => void }> = ({ on, label, onClick }) => (
  <button type="button" onClick={onClick}
    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'}`}>
    {label}
  </button>
);

const EmergencyTriagePanel: React.FC<Props> = ({ appointmentId, petId, petName, staff, onStatusChange, onDischarged, readOnly }) => {
  const [record, setRecord] = useState<EmergencyTriageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // editable fields
  const [category, setCategory] = useState<TriageCategory | null>(null);
  const [referralSource, setReferralSource] = useState('');
  const [triageNurseId, setTriageNurseId] = useState('');
  const [attendingVetId, setAttendingVetId] = useState('');
  const [primarySurvey, setPrimarySurvey] = useState<Record<string, any>>({});
  const [stabilization, setStabilization] = useState<Record<string, any>>({});
  const [painScore, setPainScore] = useState('');
  const [outcome, setOutcome] = useState<TriageOutcome | null>(null);
  const [notes, setNotes] = useState('');
  const [newReading, setNewReading] = useState<Record<string, string>>({});
  const [newEvent, setNewEvent] = useState('');
  // ABCDE mini-wizard position (A=0 … E=4).
  const [abcdeIdx, setAbcdeIdx] = useState(0);

  const hydrate = useCallback((r: EmergencyTriageRecord) => {
    setRecord(r);
    setCategory(r.triageCategory);
    setReferralSource(r.referralSource ?? '');
    setTriageNurseId(r.triageNurseId ?? '');
    setAttendingVetId(r.attendingVetId ?? '');
    setPrimarySurvey(r.primarySurvey ?? {});
    setStabilization(r.stabilization ?? {});
    setPainScore(r.painScore != null ? String(r.painScore) : '');
    setOutcome(r.outcome);
    setNotes(r.notes ?? '');
  }, []);

  // Load (or lazily create) the triage record for this visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await triageAPI.getByAppointment(appointmentId);
        if (cancelled) return;
        if (res.success && res.data?.record) hydrate(res.data.record);
        else {
          const created = await triageAPI.create({ appointmentId, petId });
          if (!cancelled && created.success && created.data?.record) hydrate(created.data.record);
        }
      } catch { /* surfaced by API layer */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [appointmentId, petId, hydrate]);

  const survey = (sec: string, k: string) => !!primarySurvey?.[sec]?.[k];
  const toggleSurvey = (sec: string, k: string) =>
    setPrimarySurvey(p => ({ ...p, [sec]: { ...(p[sec] || {}), [k]: !p?.[sec]?.[k] } }));
  const setSurveyField = (sec: string, k: string, v: any) =>
    setPrimarySurvey(p => ({ ...p, [sec]: { ...(p[sec] || {}), [k]: v } }));

  // Clinic-configured intervention fees + consumables (Clinic Management →
  // Emergency Billables). UI phase: read from localStorage.
  const billables = useMemo(() => loadEmergencyBillables(), []);

  const stab = (g: string, k: string) => !!stabilization?.[g]?.[k];
  const toggleStab = (g: string, k: string, label: string) => {
    const turningOn = !stabilization?.[g]?.[k];
    setStabilization(p => ({ ...p, [g]: { ...(p[g] || {}), [k]: !p?.[g]?.[k] } }));
    // Auto time-log when an intervention is started (legal/medical record).
    if (turningOn && record) triageAPI.addTimeLog(record.id, { event: label, auto: true })
      .then(r => { if (r.success && r.data?.record) setRecord(r.data.record); });
    // Auto-log the intervention's configured consumables — deducts stock and
    // bills them immediately (same consumables flow as boarding/grooming).
    if (turningOn) {
      const b = billables[billableKey(g, k)];
      if (b?.consumables?.length) {
        Promise.all(b.consumables.map(cn => consumablesAPI.log(appointmentId, {
          inventoryItemId: cn.inventoryItemId, quantity: cn.qty, billable: true, notes: `Emergency: ${label}`,
        }))).then(() => toast.success(`${label} — consumables logged (stock deducted & billed)`))
          .catch(() => toast.error(`${label}: failed to log consumables`));
      }
    }
  };

  // Priced interventions currently ticked → staged emergency charges.
  const stagedCharges = useMemo(() => {
    const lines: { label: string; price: number }[] = [];
    for (const g of STABILIZATION) for (const c of g.checks) {
      if (stabilization?.[g.key]?.[c.k]) {
        const b = billables[billableKey(g.key, c.k)];
        if (b?.price) lines.push({ label: c.label, price: b.price });
      }
    }
    return lines;
  }, [stabilization, billables]);

  const buildPayload = () => ({
    triageCategory: category, referralSource: referralSource || null,
    triageNurseId: triageNurseId || null, attendingVetId: attendingVetId || null,
    primarySurvey, stabilization, painScore: painScore === '' ? null : Number(painScore),
    outcome, notes: notes || null,
    status: outcome ? (OUTCOMES.find(o => o.value === outcome)?.proceed ? 'STABILIZED' : 'IN_PROGRESS') as any : 'IN_PROGRESS' as any,
  });

  const save = async () => {
    if (!record) return;
    setSaving(true);
    try {
      const res = await triageAPI.update(record.id, buildPayload());
      if (res.success && res.data?.record) {
        setRecord(res.data.record);
        toast.success('Triage saved');
        onStatusChange?.(res.data.record);
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // Patient stable → hand over to the normal vet-visit flow. Saves the triage
  // with a proceed-able outcome + STABILIZED status (clears the stabilize
  // gate), then lets the parent move the workflow on.
  const discharge = async () => {
    if (!record) return;
    setSaving(true);
    try {
      const finalOutcome = (outcome && OUTCOMES.find(o => o.value === outcome)?.proceed ? outcome : 'STABILIZED') as TriageOutcome;
      setOutcome(finalOutcome);
      const res = await triageAPI.update(record.id, { ...buildPayload(), outcome: finalOutcome, status: 'STABILIZED' as any });
      if (res.success && res.data?.record) {
        setRecord(res.data.record);
        toast.success('Patient stabilized — discharged to vet visit');
        onStatusChange?.(res.data.record);
        onDischarged?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to discharge'); }
    finally { setSaving(false); }
  };

  const addReading = async () => {
    if (!record) return;
    const reading: any = {};
    for (const f of MONITOR_FIELDS) {
      const v = newReading[f.k];
      if (v == null || v === '') continue;
      reading[f.k] = ['bp', 'crt', 'mmColour'].includes(f.k) ? v : Number(v);
    }
    if (!Object.keys(reading).length) { toast.error('Enter at least one value'); return; }
    const res = await triageAPI.addMonitoring(record.id, reading);
    if (res.success && res.data?.record) { setRecord(res.data.record); setNewReading({}); }
  };

  const addEvent = async () => {
    if (!record || !newEvent.trim()) return;
    const res = await triageAPI.addTimeLog(record.id, { event: newEvent.trim() });
    if (res.success && res.data?.record) { setRecord(res.data.record); setNewEvent(''); }
  };

  const monitoring = record?.monitoring ?? [];
  const timeLog = useMemo(() => [...(record?.timeLog ?? [])].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()), [record]);
  const sectionTitle = 'text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5';

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-seafoam" /></div>;

  return (
    <div className={`space-y-6 ${readOnly ? 'pointer-events-none select-none' : ''}`}>
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertTriangle size={16} />
        <h3 className="text-sm font-black uppercase tracking-tight">Emergency Triage & Stabilization{petName ? ` — ${petName}` : ''}</h3>
        {readOnly && <span className="ml-auto px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest">🔒 Closed — view only</span>}
      </div>

      {/* 1 · Arrival & Triage */}
      <section className="space-y-3">
        <p className={sectionTitle}><Clock size={11} /> Arrival & Triage</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map(c => (
            <button key={c.value} type="button" onClick={() => setCategory(c.value)}
              className={`px-2 py-2 rounded-xl border-2 text-left transition-all ${category === c.value ? c.tone : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-500'}`}>
              <p className="text-[11px] font-black">{c.label}</p>
              <p className="text-[8px] font-bold uppercase tracking-wider opacity-70">{c.sub}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="field-label">Arrival mode / referral source</label>
            <select className="field-select" value={referralSource} onChange={e => setReferralSource(e.target.value)}>
              <option value="">—</option>
              {/* Legacy free-text values still display as their own option. */}
              {referralSource && !['Walk-in', 'Referral — clinic', 'Referral — vet', 'Ambulance', 'Brought by owner', 'Other'].includes(referralSource) && (
                <option value={referralSource}>{referralSource}</option>
              )}
              {['Walk-in', 'Referral — clinic', 'Referral — vet', 'Ambulance', 'Brought by owner', 'Other'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          {staff && staff.length > 0 && (
            <>
              <div><label className="field-label">Triage nurse</label><select className="field-select" value={triageNurseId} onChange={e => setTriageNurseId(e.target.value)}><option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select></div>
              <div><label className="field-label">Attending vet</label><select className="field-select" value={attendingVetId} onChange={e => setAttendingVetId(e.target.value)}><option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select></div>
            </>
          )}
        </div>
        {record?.arrivalAt && <p className="text-[9px] text-slate-400">Arrived {formatTime(record.arrivalAt)} · triage started {record.triageStartedAt ? formatTime(record.triageStartedAt) : '—'}</p>}
      </section>

      {/* 2 · Primary survey (ABCDE) — mini-wizard: one letter at a time,
             mirroring how the survey is actually run. */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className={sectionTitle}><Stethoscope size={11} /> Primary Survey · ABCDE</p>
          <div className="flex items-center gap-1">
            {ABCDE.map((s, i) => {
              const secData = primarySurvey?.[s.key] || {};
              const hasData = Object.keys(secData).some(k => secData[k]);
              const active = i === abcdeIdx;
              const name = s.title.split('·')[1]?.trim() || s.title;
              return (
                <React.Fragment key={s.key}>
                  {i > 0 && <div className={`w-4 h-px mb-3.5 ${hasData ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-zinc-800'}`} />}
                  <button type="button" onClick={() => setAbcdeIdx(i)} title={s.title}
                    className="flex flex-col items-center gap-0.5 group">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-all
                      ${active ? 'bg-red-500 border-red-500 text-white'
                        : hasData ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-zinc-700 text-slate-400 group-hover:border-red-400'}`}>
                      {s.title.charAt(0)}
                    </span>
                    <span className={`text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${active ? 'text-red-600 dark:text-red-400' : hasData ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'}`}>
                      {name}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        {(() => {
          const sec = ABCDE[abcdeIdx];
          return (
            <div key={sec.key} className="border border-red-200 dark:border-red-900 rounded-xl p-3 space-y-2 bg-red-50/30 dark:bg-red-950/10">
              <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase flex items-center gap-1.5"><sec.icon size={12} className="text-red-500" /> {sec.title}</p>
              {sec.key === 'breathing' && (
                <div className="flex gap-1.5">{['NORMAL', 'MILD', 'SEVERE'].map(e => <CheckChip key={e} on={primarySurvey?.breathing?.effort === e} label={e === 'NORMAL' ? 'Normal' : e === 'MILD' ? 'Mild distress' : 'Severe distress'} onClick={() => setSurveyField('breathing', 'effort', e)} />)}</div>
              )}
              {sec.key === 'disability' && (
                <div className="flex flex-wrap gap-1.5">{['ALERT', 'DEPRESSED', 'OBTUNDED', 'STUPOROUS', 'COMATOSE'].map(m => <CheckChip key={m} on={primarySurvey?.disability?.mentation === m} label={m.charAt(0) + m.slice(1).toLowerCase()} onClick={() => setSurveyField('disability', 'mentation', m)} />)}</div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {sec.checks.map(c => <CheckChip key={c.k} on={survey(sec.key, c.k)} label={c.label} onClick={() => toggleSurvey(sec.key, c.k)} />)}
              </div>
              {/* a few quantitative vitals on the relevant sections */}
              {sec.key === 'circulation' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input className="field-input" placeholder="HR" value={primarySurvey?.circulation?.hr ?? ''} onChange={e => setSurveyField('circulation', 'hr', e.target.value)} />
                  <input className="field-input" placeholder="CRT" value={primarySurvey?.circulation?.crt ?? ''} onChange={e => setSurveyField('circulation', 'crt', e.target.value)} />
                  <input className="field-input" placeholder="MM colour" value={primarySurvey?.circulation?.mmColour ?? ''} onChange={e => setSurveyField('circulation', 'mmColour', e.target.value)} />
                  <input className="field-input" placeholder="Pulse quality" value={primarySurvey?.circulation?.pulseQuality ?? ''} onChange={e => setSurveyField('circulation', 'pulseQuality', e.target.value)} />
                </div>
              )}
              {sec.key === 'breathing' && <input className="field-input" placeholder="Resp. rate" value={primarySurvey?.breathing?.rr ?? ''} onChange={e => setSurveyField('breathing', 'rr', e.target.value)} />}
              {sec.key === 'exposure' && <input className="field-input" placeholder="Temperature" value={primarySurvey?.exposure?.temperature ?? ''} onChange={e => setSurveyField('exposure', 'temperature', e.target.value)} />}
              {sec.key === 'disability' && <input className="field-input" placeholder="Pupil size" value={primarySurvey?.disability?.pupilSize ?? ''} onChange={e => setSurveyField('disability', 'pupilSize', e.target.value)} />}
              <textarea className="field-textarea" rows={1} placeholder="Notes" value={primarySurvey?.[sec.key]?.notes ?? ''} onChange={e => setSurveyField(sec.key, 'notes', e.target.value)} />
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setAbcdeIdx(i => Math.max(0, i - 1))} disabled={abcdeIdx === 0}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-800 text-slate-500 disabled:opacity-40">
                  ← {abcdeIdx > 0 ? ABCDE[abcdeIdx - 1].title : ''}
                </button>
                {abcdeIdx < ABCDE.length - 1 ? (
                  <button type="button" onClick={() => setAbcdeIdx(i => Math.min(ABCDE.length - 1, i + 1))}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-colors">
                    {ABCDE[abcdeIdx + 1].title} →
                  </button>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Survey done — continue to stabilization below</span>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      {/* 3 · Stabilization protocols */}
      <section className="space-y-3">
        <p className={sectionTitle}><Syringe size={11} /> Immediate Stabilization</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STABILIZATION.map(g => (
            <div key={g.key} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase flex items-center gap-1.5"><g.icon size={12} className="text-seafoam" /> {g.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.checks.map(c => <CheckChip key={c.k} on={stab(g.key, c.k)} label={c.label} onClick={() => toggleStab(g.key, c.k, `${g.title}: ${c.label}`)} />)}
              </div>
            </div>
          ))}
        </div>
        {/* Clinic-priced interventions ticked above stage their fees here. */}
        {stagedCharges.length > 0 && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Emergency protocol charges (staged)</p>
            {stagedCharges.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between text-[11px]">
                <span className="font-bold text-slate-600 dark:text-zinc-300">{l.label}</span>
                <span className="font-black font-mono text-pine dark:text-zinc-100">{l.price.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-amber-200 dark:border-amber-800 pt-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Total</span>
              <span className="text-[12px] font-black font-mono text-amber-700 dark:text-amber-400">{stagedCharges.reduce((s, l) => s + l.price, 0).toLocaleString()}</span>
            </div>
            <p className="text-[8px] font-bold text-slate-400">Added to the visit bill at finalize (API phase) · configure in Clinic Management → Emergency Billables. Attached consumables bill &amp; deduct immediately.</p>
          </div>
        )}
        <div className="w-40"><label className="field-label">Pain score (0–10)</label><input className="field-input" type="number" min={0} max={10} value={painScore} onChange={e => setPainScore(e.target.value)} /></div>
      </section>

      {/* 4 · Monitoring + trend */}
      <section className="space-y-3">
        <p className={sectionTitle}><HeartPulse size={11} /> Emergency Monitoring</p>
        {monitoring.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {TREND_METRICS.map(m => {
                const vals = monitoring.map(r => Number((r as any)[m.k])).filter(v => !isNaN(v));
                return (
                  <div key={m.k} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-2">
                    <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: m.tone }}>{m.label}</p>
                    <Sparkline values={vals} color={m.tone} />
                    <p className="text-[9px] text-slate-400 font-bold">{vals.length ? vals[vals.length - 1] : '—'}</p>
                  </div>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="text-slate-400 uppercase tracking-wider text-left"><th className="py-1 pr-2">Time</th>{MONITOR_FIELDS.map(f => <th key={f.k} className="py-1 px-1">{f.label}</th>)}</tr></thead>
                <tbody>
                  {monitoring.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                      <td className="py-1 pr-2 font-bold whitespace-nowrap">{formatTime(r.at)}</td>
                      {MONITOR_FIELDS.map(f => <td key={f.k} className="py-1 px-1">{(r as any)[f.k] ?? ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex flex-wrap items-end gap-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2">
          {MONITOR_FIELDS.map(f => (
            <div key={f.k} className="w-16"><label className="field-label text-[8px]">{f.label}</label><input className="field-input !px-2 !py-1 text-xs" value={newReading[f.k] ?? ''} onChange={e => setNewReading(p => ({ ...p, [f.k]: e.target.value }))} /></div>
          ))}
          <button onClick={addReading} className="px-3 py-2 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Plus size={12} /> Reading</button>
        </div>
      </section>

      {/* 5 · Outcome */}
      <section className="space-y-2">
        <p className={sectionTitle}><CheckCircle2 size={11} /> Stabilization Outcome</p>
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map(o => (
            <button key={o.value} type="button" onClick={() => setOutcome(o.value)}
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${outcome === o.value ? (o.proceed ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-amber-600 text-white border-amber-600') : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <textarea className="field-textarea" rows={2} placeholder="Triage / stabilization notes" value={notes} onChange={e => setNotes(e.target.value)} />
      </section>

      {/* 6 · Emergency time log */}
      <section className="space-y-2">
        <p className={sectionTitle}><Clock size={11} /> Emergency Time Log</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {timeLog.length === 0 && <p className="text-[10px] text-slate-400">Interventions you tick are auto-timestamped here.</p>}
          {timeLog.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="font-mono font-bold text-slate-500 dark:text-zinc-400 w-14 shrink-0">{formatTime(e.at)}</span>
              <span className="text-slate-700 dark:text-zinc-300">{e.event}</span>
              {e.auto && <span className="text-[7px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-400 px-1 py-0.5 rounded">auto</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="field-input flex-1" placeholder="Log an event…" value={newEvent} onChange={e => setNewEvent(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEvent()} />
          <button onClick={addEvent} className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Plus size={12} /> Log</button>
        </div>
      </section>

      <div className="sticky bottom-0 bg-white dark:bg-zinc-900 pt-2 flex flex-col sm:flex-row gap-2">
        <button onClick={save} disabled={saving} className="flex-1 py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save triage
        </button>
        <button onClick={discharge} disabled={saving} title="Marks the patient stabilized and continues with the normal clinical flow"
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Stabilized → discharge to vet visit
        </button>
      </div>
    </div>
  );
};

export default EmergencyTriagePanel;

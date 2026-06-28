import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, HeartPulse, Wind, Droplets, Brain, Thermometer, Syringe, Stethoscope, Bell, Loader2, Save, Plus, Clock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { triageAPI, EmergencyTriageRecord, TriageCategory, TriageOutcome } from '../../../services';
import { formatTime } from '../../../services/utils/dateFormatter';

interface StaffOpt { id: number | string; name: string }
interface Props {
  appointmentId: number;
  petId: number;
  petName?: string;
  staff?: StaffOpt[];
  // Fires whenever the record's outcome/status changes so the parent can drop
  // the "stabilize first" gate once the patient is stabilized/improved.
  onStatusChange?: (rec: EmergencyTriageRecord) => void;
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

// ── Stabilization protocol groups ─────────────────────────────────
const STABILIZATION: { key: string; title: string; icon: React.ElementType; checks: { k: string; label: string }[] }[] = [
  { key: 'airway', title: 'Airway', icon: Wind, checks: [
    { k: 'oxygenCage', label: 'Oxygen cage' }, { k: 'flowByO2', label: 'Flow-by O₂' }, { k: 'maskO2', label: 'Mask O₂' }, { k: 'etTube', label: 'ET tube' }, { k: 'tracheostomy', label: 'Tracheostomy' },
  ] },
  { key: 'breathing', title: 'Breathing', icon: Activity, checks: [
    { k: 'thoracocentesis', label: 'Thoracocentesis' }, { k: 'chestDrain', label: 'Chest drain' }, { k: 'mechanicalVent', label: 'Mechanical ventilation' },
  ] },
  { key: 'circulation', title: 'Circulation / Shock', icon: HeartPulse, checks: [
    { k: 'ivCatheter', label: 'IV catheter' }, { k: 'secondIv', label: '2nd IV catheter' }, { k: 'crystalloidBolus', label: 'Crystalloid bolus' }, { k: 'colloid', label: 'Colloid' },
    { k: 'hypertonicSaline', label: 'Hypertonic saline' }, { k: 'transfusion', label: 'Blood transfusion' }, { k: 'plasma', label: 'Plasma' }, { k: 'vasopressors', label: 'Vasopressors' },
  ] },
  { key: 'bleeding', title: 'Bleeding', icon: Droplets, checks: [
    { k: 'directPressure', label: 'Direct pressure' }, { k: 'pressureBandage', label: 'Pressure bandage' }, { k: 'tourniquet', label: 'Tourniquet' }, { k: 'hemostatic', label: 'Hemostatic dressing' },
  ] },
  { key: 'gastrointestinal', title: 'Gastrointestinal', icon: Stethoscope, checks: [
    { k: 'stomachTube', label: 'Stomach tube' }, { k: 'gastricDecompression', label: 'Gastric decompression' }, { k: 'activatedCharcoal', label: 'Activated charcoal' }, { k: 'induceEmesis', label: 'Induce emesis' }, { k: 'enema', label: 'Enema' },
  ] },
  { key: 'urinary', title: 'Urinary', icon: Droplets, checks: [
    { k: 'urinaryCatheter', label: 'Urinary catheter' }, { k: 'cystocentesis', label: 'Cystocentesis' },
  ] },
  { key: 'pain', title: 'Pain', icon: Syringe, checks: [
    { k: 'methadone', label: 'Methadone' }, { k: 'morphine', label: 'Morphine' }, { k: 'fentanyl', label: 'Fentanyl' }, { k: 'ketamineCri', label: 'Ketamine CRI' }, { k: 'nsaid', label: 'NSAID' },
  ] },
  { key: 'seizure', title: 'Seizure control', icon: Brain, checks: [
    { k: 'diazepam', label: 'Diazepam' }, { k: 'midazolam', label: 'Midazolam' }, { k: 'phenobarbital', label: 'Phenobarbital' }, { k: 'propofol', label: 'Propofol' },
  ] },
  { key: 'poisoning', title: 'Poisoning', icon: AlertTriangle, checks: [
    { k: 'decontamination', label: 'Decontamination' }, { k: 'activatedCharcoal', label: 'Activated charcoal' }, { k: 'lipidTherapy', label: 'Lipid therapy' }, { k: 'antidote', label: 'Antidote' },
  ] },
];

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

const EmergencyTriagePanel: React.FC<Props> = ({ appointmentId, petId, petName, staff, onStatusChange }) => {
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

  const stab = (g: string, k: string) => !!stabilization?.[g]?.[k];
  const toggleStab = (g: string, k: string, label: string) => {
    const turningOn = !stabilization?.[g]?.[k];
    setStabilization(p => ({ ...p, [g]: { ...(p[g] || {}), [k]: !p?.[g]?.[k] } }));
    // Auto time-log when an intervention is started (legal/medical record).
    if (turningOn && record) triageAPI.addTimeLog(record.id, { event: label, auto: true })
      .then(r => { if (r.success && r.data?.record) setRecord(r.data.record); });
  };

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
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertTriangle size={16} />
        <h3 className="text-sm font-black uppercase tracking-tight">Emergency Triage & Stabilization{petName ? ` — ${petName}` : ''}</h3>
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
          <div><label className="field-label">Referral source</label><input className="field-input" value={referralSource} onChange={e => setReferralSource(e.target.value)} placeholder="Walk-in, referral…" /></div>
          {staff && staff.length > 0 && (
            <>
              <div><label className="field-label">Triage nurse</label><select className="field-select" value={triageNurseId} onChange={e => setTriageNurseId(e.target.value)}><option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select></div>
              <div><label className="field-label">Attending vet</label><select className="field-select" value={attendingVetId} onChange={e => setAttendingVetId(e.target.value)}><option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select></div>
            </>
          )}
        </div>
        {record?.arrivalAt && <p className="text-[9px] text-slate-400">Arrived {formatTime(record.arrivalAt)} · triage started {record.triageStartedAt ? formatTime(record.triageStartedAt) : '—'}</p>}
      </section>

      {/* 2 · Primary survey (ABCDE) */}
      <section className="space-y-3">
        <p className={sectionTitle}><Stethoscope size={11} /> Primary Survey · ABCDE</p>
        {ABCDE.map(sec => (
          <div key={sec.key} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase flex items-center gap-1.5"><sec.icon size={12} className="text-seafoam" /> {sec.title}</p>
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
          </div>
        ))}
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

      <div className="sticky bottom-0 bg-white dark:bg-zinc-900 pt-2">
        <button onClick={save} disabled={saving} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save triage
        </button>
      </div>
    </div>
  );
};

export default EmergencyTriagePanel;

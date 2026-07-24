import React, { useState, useMemo, useEffect } from 'react';
import { Stethoscope, Loader2, Search, Dog, ShieldCheck, ArrowLeft, CalendarClock } from 'lucide-react';
import { Pet } from '../../../types';
import { inpatientAPI, visitsAPI } from '../../../services';
import FoodProgramFields, { FoodProgram } from '../shared/FoodProgramFields';
import { VACCINES, hasVaccineRecorded } from '../../../constants/vaccines';
import { useData } from '../../../contexts/DataContext';
import { ownerAbbrev } from '../shared/ownerAbbrev';
import GateVaccineRecommend from '../shared/GateVaccineRecommend';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pets: Pet[];
  onAdmitted: () => void;
  initialPetId?: number;
  appointmentId?: string | number;
  // Clinic-wide default daily rate to pre-fill (overridable per stay).
  defaultRate?: number | null;
}

/**
 * Full-page inpatient admission — converted from the old full-screen modal so
 * admission is a real in-app page (sidebar + breadcrumb stay visible), same
 * pattern as the boarding/grooming gates. Callers render it IN PLACE of their
 * content while open. Same props + logic; the admission gate matches the
 * other gates: weight copy (<3 months), vaccination check with the
 * recommend-and-transfer escape, owner abbrev on the patient chip.
 */
const AdmitInpatientModal: React.FC<Props> = ({ isOpen, onClose, pets, onAdmitted, initialPetId, appointmentId, defaultRate }) => {
  const { clients } = useData();
  const ownerAbbrevOf = (pet: Pet) =>
    ownerAbbrev(clients.find(c => String(c.id) === String((pet as any).ownerId ?? (pet as any).owner?.id))?.name);

  const [petId, setPetId] = useState<number | null>(initialPetId ?? null);
  const [petSearch, setPetSearch] = useState('');
  const [inpatientNo, setInpatientNo] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  // Why is the patient being admitted — chips + free text; folded into the
  // admission notes so the chart carries the reason/observations.
  const [admitReason, setAdmitReason] = useState('');
  const ADMIT_REASON_CHIPS = ['Critical condition', 'Post-surgery care', 'Monitoring / observation', 'Client request'];
  const [cage, setCage] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [intakeWeight, setIntakeWeight] = useState('');
  const [weightCopied, setWeightCopied] = useState(false);
  const [foodProgram, setFoodProgram] = useState<FoodProgram>({ providedByClient: true });
  const [admissionNotes, setAdmissionNotes] = useState('');
  const [vaccines, setVaccines] = useState<Record<string, boolean>>({});
  // Gate escape when nothing is on record — see GateVaccineRecommend.
  const [recommended, setRecommended] = useState<Record<string, boolean>>({});
  const [clientAgreed, setClientAgreed] = useState(false);
  const [feedingInstructions, setFeedingInstructions] = useState('');
  const [medicationInstructions, setMedicationInstructions] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the daily rate from the clinic default when opening (unless typed).
  useEffect(() => {
    if (isOpen && defaultRate != null) setDailyRate(prev => prev === '' ? String(defaultRate) : prev);
  }, [isOpen, defaultRate]);

  // Seed the patient each time the page opens (component may stay mounted).
  useEffect(() => {
    if (isOpen) setPetId(initialPetId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPetId]);

  const selectedPet = useMemo(() => pets.find(p => String(p.id) === String(petId)) ?? null, [pets, petId]);

  // Copy the recorded weight when it's less than 3 months old.
  useEffect(() => {
    if (!selectedPet) return;
    const w = parseFloat(String((selectedPet as any).weight || ''));
    const ts = (selectedPet as any).updatedAt;
    const fresh = ts ? (Date.now() - new Date(ts).getTime()) < 90 * 24 * 60 * 60 * 1000 : false;
    if (w > 0 && fresh) { setIntakeWeight(String(w)); setWeightCopied(true); }
    else setWeightCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  const matches = useMemo(() => {
    const q = petSearch.trim().toLowerCase();
    if (!q) return [] as Pet[];
    return pets.filter(p => p.name?.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q)).slice(0, 8);
  }, [pets, petSearch]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPet) { setError('Select a patient to admit.'); return; }
    const clientId = (selectedPet as any).ownerId ?? (selectedPet as any).owner?.id;
    if (!clientId) { setError('This patient has no owner on record.'); return; }
    if (!intakeWeight || Number(intakeWeight) <= 0) { setError('Intake weight is required.'); return; }
    const recommendedList = VACCINES.filter(v => recommended[v.key]).map(v => v.label);
    if (!hasVaccineRecorded(vaccines) && recommendedList.length === 0) {
      setError('Record a vaccination — or recommend vaccines below to proceed.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await inpatientAPI.admit({
        petId: selectedPet.id, clientId, appointmentId,
        inpatientNo: inpatientNo || undefined, diagnosis: diagnosis || undefined,
        cage: cage || undefined,
        admissionNotes: [admitReason.trim() ? `Reason for admission: ${admitReason.trim()}` : '', admissionNotes].filter(Boolean).join('\n') || undefined,
        dailyRate: dailyRate ? Number(dailyRate) : undefined,
        intakeWeight: intakeWeight ? Number(intakeWeight) : undefined,
        vaccineChecklist: vaccines,
        foodProgram,
        feedingInstructions: feedingInstructions || undefined,
        medicationInstructions: medicationInstructions || undefined,
        emergencyContact: emergencyContact || undefined,
      });
      if (res.success) {
        // Journey log + (if agreed) vaccination work on the admission's visit —
        // same attribution as the grooming/boarding gates.
        const hosp: any = (res.data as any)?.hospitalization ?? res.data;
        const apptId = hosp?.appointmentId ?? hosp?.billing?.appointmentId ?? appointmentId;
        if (apptId && recommendedList.length > 0) {
          visitsAPI.addEvent(apptId, {
            label: `Vaccines recommended at inpatient gate: ${recommendedList.join(', ')} — ${clientAgreed ? 'client agreed; added to visit for vaccination' : 'awaiting client decision'}`,
            kind: 'action',
          }).catch(() => {});
          if (clientAgreed) {
            recommendedList.forEach(l => {
              visitsAPI.addTask(Number(apptId), { name: `${l} vaccination`, category: 'Vaccination', price: 0, status: 'PENDING' } as any).catch(() => {});
            });
          }
        }
        onAdmitted(); onClose();
      }
      else setError(res.message || 'Failed to admit');
    } catch (err: any) {
      setError(err?.message || 'Failed to admit. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onClose} disabled={submitting} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Inpatient
      </button>

      {/* Header banner — red/rose theme matching the inpatient chart page */}
      <div className="bg-gradient-to-br from-red-700 to-rose-600 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><Stethoscope size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Inpatient admission</p>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2 min-w-0">
            <Dog size={18} className="shrink-0" /> <span className="truncate">{selectedPet ? selectedPet.name : 'Admit to Hospitalization'}</span>
          </h1>
          <p className="text-[11px] text-white/70 truncate">
            {selectedPet ? `${selectedPet.breed ? `${selectedPet.breed} · ` : ''}${selectedPet.species ?? ''}` : 'Check a patient in for in-patient care'}
          </p>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/15 flex items-center gap-1.5">
          <CalendarClock size={12} /> New admission
        </span>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>}

        {/* Patient */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <label className="field-label">Patient *</label>
          {selectedPet ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl">
              <span className="flex items-center gap-2 text-sm font-bold text-pine dark:text-zinc-100 min-w-0">
                <Dog size={15} className="text-seafoam shrink-0" />
                <span className="truncate">{selectedPet.name} · {selectedPet.species} <span className="text-slate-400 font-semibold">{ownerAbbrevOf(selectedPet)}</span></span>
              </span>
              <button type="button" onClick={() => { setPetId(null); setPetSearch(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500">Change</button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={petSearch} onChange={e => setPetSearch(e.target.value)} placeholder="Search patient by name…" className="field-input field-icon-left" />
              {matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
                  {matches.map(p => (
                    <button key={p.id} type="button" onClick={() => { setPetId(p.id); setPetSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                      <Dog size={14} className="text-seafoam" /> <span className="font-bold text-pine dark:text-zinc-100">{p.name}</span> <span className="text-slate-400 text-xs">{p.species} · {p.breed}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Admission details */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="field-label">Inpatient no.</label><input className="field-input" value={inpatientNo} onChange={e => setInpatientNo(e.target.value)} placeholder="IP-001" /></div>
            <div><label className="field-label">Cage / Kennel</label><input className="field-input" value={cage} onChange={e => setCage(e.target.value)} placeholder="A1" /></div>
            <div><label className="field-label">Daily rate (KES)</label><input type="number" min="0" className="field-input" value={dailyRate} onChange={e => setDailyRate(e.target.value)} placeholder="3000" /></div>
          </div>
          <div>
            <label className="field-label">Reason for admission / observations</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ADMIT_REASON_CHIPS.map(c => (
                <button key={c} type="button" onClick={() => setAdmitReason(r => (r.trim() ? `${r.trim()} · ${c}` : c))}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-500 hover:border-seafoam hover:text-seafoam transition-all">{c}</button>
              ))}
            </div>
            <textarea className="field-textarea" rows={2} value={admitReason} onChange={e => setAdmitReason(e.target.value)} placeholder="Why is this patient being admitted? Observations…" />
          </div>
          <div><label className="field-label">Diagnosis</label><input className="field-input" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Parvoviral enteritis" /></div>
        </section>

        {/* Admission gate card — required */}
        <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><ShieldCheck size={13} /> Admission gate — required</p>
          <div className="max-w-[240px]">
            <label className="field-label">Intake weight (kg) *</label>
            <input type="number" min="0" step="0.1" required className="field-input" value={intakeWeight} onChange={e => { setIntakeWeight(e.target.value); setWeightCopied(false); }} placeholder="e.g. 12.4" />
            {weightCopied && <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1">Copied from record (&lt;3 months old) — confirm on the scale.</p>}
          </div>
          <div>
            <label className="field-label">Vaccination check *</label>
            <div className="flex flex-wrap gap-2">
              {VACCINES.map(v => (
                <button key={v.key} type="button" onClick={() => setVaccines(s => ({ ...s, [v.key]: !s[v.key] }))}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${vaccines[v.key] ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' : 'bg-white dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                  {vaccines[v.key] ? '✓ ' : ''}{v.label}
                </button>
              ))}
            </div>
            {!hasVaccineRecorded(vaccines) && (
              <GateVaccineRecommend
                recommended={recommended}
                onToggle={(k) => setRecommended(s => ({ ...s, [k]: !s[k] }))}
                clientAgreed={clientAgreed}
                onAgreed={setClientAgreed}
              />
            )}
          </div>
        </section>

        {/* Food program card */}
        <FoodProgramFields value={foodProgram} onChange={setFoodProgram} />

        {/* Care instructions */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div><label className="field-label">Admission notes (clinical / surgical + Dr orders)</label><textarea className="field-textarea" rows={3} value={admissionNotes} onChange={e => setAdmissionNotes(e.target.value)} placeholder="Stabilise, IV fluids @ X ml/hr, anti-emetics…" /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="field-label">Feeding instructions</label><textarea className="field-textarea" rows={2} value={feedingInstructions} onChange={e => setFeedingInstructions(e.target.value)} placeholder="NPO until stable, then A/D q6h" /></div>
            <div><label className="field-label">Medication instructions</label><textarea className="field-textarea" rows={2} value={medicationInstructions} onChange={e => setMedicationInstructions(e.target.value)} placeholder="Cerenia SID, antibiotics BID" /></div>
            <div><label className="field-label">Emergency contact</label><input className="field-input" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Name + phone" /></div>
          </div>
        </section>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-5 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 px-5 py-3 bg-red-600 text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20">
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Admitting…</> : <><Stethoscope size={18} /> Admit</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdmitInpatientModal;

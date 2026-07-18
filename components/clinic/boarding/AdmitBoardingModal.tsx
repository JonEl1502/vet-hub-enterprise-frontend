import React, { useState, useMemo, useEffect } from 'react';
import { Home, Loader2, Search, ShieldCheck, Dog, ArrowLeft, CalendarClock } from 'lucide-react';
import { Pet } from '../../../types';
import { boardingAPI } from '../../../services';
import FoodProgramFields, { FoodProgram } from '../shared/FoodProgramFields';
import { VACCINES, hasVaccineRecorded } from '../../../constants/vaccines';
import { useData } from '../../../contexts/DataContext';
import { ownerAbbrev } from '../shared/ownerAbbrev';

// Full-page boarding admission — converted from the old full-screen modal so
// admission is a real in-app page (sidebar + breadcrumb stay visible). Callers
// render it IN PLACE of their content while `isOpen` is true.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pets: Pet[];
  onCreated: () => void;
  // When admitting straight from a BOARDING appointment.
  initialPetId?: number;
  appointmentId?: string | number;
  // Clinic-wide default daily rate to pre-fill (overridable per stay).
  defaultRate?: number | null;
}

const AdmitBoardingModal: React.FC<Props> = ({ isOpen, onClose, pets, onCreated, initialPetId, appointmentId, defaultRate }) => {
  const { clients } = useData();
  // "(J.K. Lusisa)" next to the pet so staff confirm it's the right client.
  const ownerAbbrevOf = (pet: Pet) =>
    ownerAbbrev(clients.find(c => String(c.id) === String((pet as any).ownerId ?? (pet as any).owner?.id))?.name);
  const [petId, setPetId] = useState<number | null>(initialPetId ?? null);
  const [petSearch, setPetSearch] = useState('');
  const [dropOffAt, setDropOffAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [expectedPickupAt, setExpectedPickupAt] = useState('');
  const [kennel, setKennel] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [intakeWeight, setIntakeWeight] = useState('');
  const [foodProgram, setFoodProgram] = useState<FoodProgram>({ providedByClient: true });
  const [vaccines, setVaccines] = useState<Record<string, boolean>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [feedingInstructions, setFeedingInstructions] = useState('');
  const [medicationInstructions, setMedicationInstructions] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the daily rate from the clinic default each time the page opens
  // (only when the user hasn't already typed one).
  useEffect(() => {
    if (isOpen && defaultRate != null) setDailyRate(prev => prev === '' ? String(defaultRate) : prev);
  }, [isOpen, defaultRate]);

  // Seed the patient each time the page opens — the component stays mounted,
  // so the useState initializer doesn't re-run when opened from a visit's
  // Boarding chip with a fresh initialPetId.
  useEffect(() => {
    if (isOpen) setPetId(initialPetId ?? null);
  }, [isOpen, initialPetId]);

  const selectedPet = useMemo(() => pets.find(p => String(p.id) === String(petId)) ?? null, [pets, petId]);
  const matches = useMemo(() => {
    const q = petSearch.trim().toLowerCase();
    if (!q) return [] as Pet[];
    return pets.filter(p => p.name?.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q)).slice(0, 8);
  }, [pets, petSearch]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPet) { setError('Select a patient to board.'); return; }
    const clientId = (selectedPet as any).ownerId ?? (selectedPet as any).owner?.id;
    if (!clientId) { setError('This patient has no owner on record.'); return; }
    // Admission gate: intake weight + vaccination check are required.
    if (!intakeWeight || Number(intakeWeight) <= 0) { setError('Intake weight is required.'); return; }
    if (!hasVaccineRecorded(vaccines)) { setError('Record at least one vaccination (up-to-date) before admitting.'); return; }
    setSubmitting(true);
    try {
      const res = await boardingAPI.create({
        petId: selectedPet.id,
        clientId,
        appointmentId,
        dropOffAt: dropOffAt ? new Date(dropOffAt).toISOString() : undefined,
        expectedPickupAt: expectedPickupAt ? new Date(expectedPickupAt).toISOString() : undefined,
        kennel: kennel || undefined,
        dailyRate: dailyRate ? Number(dailyRate) : undefined,
        intakeWeight: intakeWeight ? Number(intakeWeight) : undefined,
        vaccineChecklist: vaccines,
        foodProgram,
        specialInstructions: specialInstructions || undefined,
        feedingInstructions: feedingInstructions || undefined,
        medicationInstructions: medicationInstructions || undefined,
        emergencyContact: emergencyContact || undefined,
      });
      if (res.success) { onCreated(); onClose(); }
      else setError(res.message || 'Failed to admit');
    } catch (err: any) {
      setError(err?.message || 'Failed to admit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onClose} disabled={submitting} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Boarding
      </button>

      {/* Header banner */}
      <div className="bg-gradient-to-br from-amber-600 to-orange-500 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><Home size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Boarding admission</p>
          <h1 className="text-xl font-black tracking-tight truncate flex items-center gap-2">
            <Dog size={18} /> {selectedPet ? `${selectedPet.name}` : 'Admit to Boarding'}
          </h1>
          <p className="text-[11px] text-white/70 truncate">
            {selectedPet ? `${selectedPet.breed ? `${selectedPet.breed} · ` : ''}${selectedPet.species ?? ''}` : 'Check a patient in for a boarding stay'}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/15 flex items-center gap-1.5">
          <CalendarClock size={12} /> New stay
        </span>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>}

        {/* Patient picker */}
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
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field-input field-icon-left" placeholder="Search patient by name…" value={petSearch} onChange={e => setPetSearch(e.target.value)} />
              {matches.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
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

        {/* Schedule & kennel card */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Schedule & kennel</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className="field-label">Drop-off</label><input type="datetime-local" className="field-input" value={dropOffAt} onChange={e => setDropOffAt(e.target.value)} /></div>
            <div><label className="field-label">Expected pickup</label><input type="datetime-local" className="field-input" value={expectedPickupAt} onChange={e => setExpectedPickupAt(e.target.value)} /></div>
            <div><label className="field-label">Kennel / Run</label><input className="field-input" placeholder="A1" value={kennel} onChange={e => setKennel(e.target.value)} /></div>
            <div><label className="field-label">Daily rate (KES)</label><input type="number" min="0" className="field-input" placeholder="1500" value={dailyRate} onChange={e => setDailyRate(e.target.value)} /></div>
          </div>
        </section>

        {/* Admission gate card — required */}
        <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><ShieldCheck size={13} /> Admission gate — required</p>
          <div className="max-w-[200px]">
            <label className="field-label">Intake weight (kg) *</label>
            <input type="number" min="0" step="0.1" required className="field-input" placeholder="e.g. 12.4" value={intakeWeight} onChange={e => setIntakeWeight(e.target.value)} />
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
          </div>
        </section>

        {/* Food program card */}
        <FoodProgramFields value={foodProgram} onChange={setFoodProgram} />

        {/* Instructions card */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Care instructions</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="field-label">Feeding instructions</label><textarea className="field-textarea" rows={2} value={feedingInstructions} onChange={e => setFeedingInstructions(e.target.value)} placeholder="2 cups dry AM/PM" /></div>
            <div><label className="field-label">Medication instructions</label><textarea className="field-textarea" rows={2} value={medicationInstructions} onChange={e => setMedicationInstructions(e.target.value)} placeholder="Apoquel 1 tab daily" /></div>
            <div><label className="field-label">Special instructions</label><textarea className="field-textarea" rows={2} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Anxious; separate from other dogs" /></div>
            <div><label className="field-label">Emergency contact</label><input className="field-input" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Name + phone" /></div>
          </div>
        </section>

        <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
          <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 px-6 py-3 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-seafoam/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-seafoam/20">
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Admitting…</> : <><Home size={18} /> Admit</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdmitBoardingModal;

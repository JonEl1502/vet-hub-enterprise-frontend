import React, { useState, useMemo, useEffect } from 'react';
import { X, Home, Loader2, Search, ShieldCheck, Dog, ArrowLeft } from 'lucide-react';
import { Pet } from '../../../types';
import { boardingAPI } from '../../../services';
import FoodProgramFields, { FoodProgram } from '../shared/FoodProgramFields';

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

const VACCINES = [
  { key: 'rabies', label: 'Rabies' },
  { key: 'dhpp', label: 'DHPP' },
  { key: 'kennelCough', label: 'Kennel Cough' },
];

const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

const AdmitBoardingModal: React.FC<Props> = ({ isOpen, onClose, pets, onCreated, initialPetId, appointmentId, defaultRate }) => {
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

  // Pre-fill the daily rate from the clinic default each time the modal opens
  // (only when the user hasn't already typed one).
  useEffect(() => {
    if (isOpen && defaultRate != null) setDailyRate(prev => prev === '' ? String(defaultRate) : prev);
  }, [isOpen, defaultRate]);

  const selectedPet = useMemo(() => pets.find(p => p.id === petId) ?? null, [pets, petId]);
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
    if (Object.keys(vaccines).length === 0) { setError('Record the vaccination check before admitting.'); return; }
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
    <div className="fixed inset-0 z-[200] bg-slate-50 dark:bg-zinc-950 overflow-y-auto animate-in fade-in duration-200">
      <div className="max-w-3xl mx-auto min-h-full">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl" disabled={submitting}><ArrowLeft size={20} className="text-slate-400" /></button>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <Home size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Admit to Boarding</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl" disabled={submitting}><X size={20} className="text-slate-400" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>}

          {/* Patient picker */}
          <div>
            <label className={labelCls}>Patient *</label>
            {selectedPet ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl">
                <span className="flex items-center gap-2 text-sm font-bold text-pine dark:text-zinc-100"><Dog size={15} className="text-seafoam" /> {selectedPet.name} · {selectedPet.species}</span>
                <button type="button" onClick={() => { setPetId(null); setPetSearch(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${fieldCls} pl-9`} placeholder="Search patient by name…" value={petSearch} onChange={e => setPetSearch(e.target.value)} />
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
          </div>

          {/* Schedule & kennel card */}
          <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Schedule & kennel</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className={labelCls}>Drop-off</label><input type="datetime-local" className={fieldCls} value={dropOffAt} onChange={e => setDropOffAt(e.target.value)} /></div>
              <div><label className={labelCls}>Expected pickup</label><input type="datetime-local" className={fieldCls} value={expectedPickupAt} onChange={e => setExpectedPickupAt(e.target.value)} /></div>
              <div><label className={labelCls}>Kennel / Run</label><input className={fieldCls} placeholder="A1" value={kennel} onChange={e => setKennel(e.target.value)} /></div>
              <div><label className={labelCls}>Daily rate (KES)</label><input type="number" min="0" className={fieldCls} placeholder="1500" value={dailyRate} onChange={e => setDailyRate(e.target.value)} /></div>
            </div>
          </section>

          {/* Admission gate card — required */}
          <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><ShieldCheck size={13} /> Admission gate — required</p>
            <div className="max-w-[200px]">
              <label className={labelCls}>Intake weight (kg) *</label>
              <input type="number" min="0" step="0.1" required className={fieldCls} placeholder="e.g. 12.4" value={intakeWeight} onChange={e => setIntakeWeight(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Vaccination check *</label>
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
          <section className="bg-slate-50/60 dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-seafoam">Care instructions</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Feeding instructions</label><textarea className={fieldCls} rows={2} value={feedingInstructions} onChange={e => setFeedingInstructions(e.target.value)} placeholder="2 cups dry AM/PM" /></div>
              <div><label className={labelCls}>Medication instructions</label><textarea className={fieldCls} rows={2} value={medicationInstructions} onChange={e => setMedicationInstructions(e.target.value)} placeholder="Apoquel 1 tab daily" /></div>
              <div><label className={labelCls}>Special instructions</label><textarea className={fieldCls} rows={2} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Anxious; separate from other dogs" /></div>
              <div><label className={labelCls}>Emergency contact</label><input className={fieldCls} value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Name + phone" /></div>
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
    </div>
  );
};

export default AdmitBoardingModal;

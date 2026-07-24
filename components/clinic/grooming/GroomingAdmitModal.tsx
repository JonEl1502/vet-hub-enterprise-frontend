import React, { useState, useMemo, useEffect } from 'react';
import { Scissors, Loader2, Search, ShieldCheck, Dog, ArrowLeft, Plus, CalendarClock } from 'lucide-react';
import { Pet } from '../../../types';
import { visitsAPI, servicesAPI } from '../../../services';
import { VACCINES, hasVaccineRecorded } from '../../../constants/vaccines';
import { useData } from '../../../contexts/DataContext';
import { ownerAbbrev } from '../shared/ownerAbbrev';
import GateVaccineRecommend from '../shared/GateVaccineRecommend';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pets: Pet[];
  onCreated: (visitId?: string) => void;
  initialPetId?: number;
}

const TEMPERAMENTS = ['Calm', 'Anxious', 'Aggressive', 'Playful', 'Fearful'];

/**
 * Grooming onboarding — mirrors Admit to Boarding: patient + schedule, an
 * admission gate (intake weight + vaccination check), grooming services to
 * perform, temperament + special instructions. Creates a GROOMING visit with the
 * picked services as tasks (grooming records auto-create from them) and stores
 * the intake on the visit's grooming detail.
 *
 * Renders as a full in-app page (was a full-screen modal) — the caller shows it
 * in place of its content while `isOpen` is true.
 */
const GroomingAdmitModal: React.FC<Props> = ({ isOpen, onClose, pets, onCreated, initialPetId }) => {
  const { clients } = useData();
  // "(J.K. Lusisa)" next to the pet so staff confirm it's the right client.
  const ownerAbbrevOf = (pet: Pet) =>
    ownerAbbrev(clients.find(c => String(c.id) === String((pet as any).ownerId ?? (pet as any).owner?.id))?.name);
  const [petId, setPetId] = useState<number | null>(initialPetId ?? null);
  const [petSearch, setPetSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [intakeWeight, setIntakeWeight] = useState('');
  const [weightCopied, setWeightCopied] = useState(false);
  const [vaccines, setVaccines] = useState<Record<string, boolean>>({});
  // Gate escape when nothing is on record: recommend vaccines (+ optional
  // client agreement → vaccination rides the visit). Logged on the journey.
  const [recommended, setRecommended] = useState<Record<string, boolean>>({});
  const [clientAgreed, setClientAgreed] = useState(false);
  const [temperament, setTemperament] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [services, setServices] = useState<{ id: string; name: string; defaultPrice?: number }[]>([]);
  const [picked, setPicked] = useState<Record<string, { name: string; price: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load grooming-category services from the catalog (once open).
  useEffect(() => {
    if (!isOpen || services.length) return;
    servicesAPI.catalog().then((list: any[]) => setServices((list || [])
      .filter(s => String(s.categoryName || '').toLowerCase().includes('groom'))
      .map(s => ({ id: String(s.id), name: s.name, defaultPrice: (s.priceEffective ?? s.defaultPrice) ?? undefined })))).catch(() => {});
  }, [isOpen]);

  const selectedPet = useMemo(() => pets.find(p => p.id === petId) ?? null, [pets, petId]);

  // Copy the recorded weight into the intake field when it was captured
  // less than 3 months ago — staff confirm on the scale, not re-type.
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

  const toggleSvc = (s: { id: string; name: string; defaultPrice?: number }) => setPicked(prev => {
    const next = { ...prev };
    if (next[s.id]) delete next[s.id]; else next[s.id] = { name: s.name, price: s.defaultPrice ?? 0 };
    return next;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPet) { setError('Select a patient to groom.'); return; }
    const clientId = (selectedPet as any).ownerId ?? (selectedPet as any).owner?.id;
    if (!clientId) { setError('This patient has no owner on record.'); return; }
    if (!intakeWeight || Number(intakeWeight) <= 0) { setError('Intake weight is required.'); return; }
    const recommendedList = VACCINES.filter(v => recommended[v.key]).map(v => v.label);
    if (!hasVaccineRecorded(vaccines) && recommendedList.length === 0) {
      setError('Record a vaccination — or recommend vaccines below to proceed.');
      return;
    }
    const tasks = Object.entries(picked).map(([id, v]) => ({ id: Math.floor(Math.random() * 1e6), name: v.name, category: 'Grooming', status: 'PENDING', price: v.price, serviceId: Number(id) }));
    if (tasks.length === 0) { setError('Pick at least one grooming service.'); return; }
    // Client agreed → the recommended vaccines ride this visit as vet work
    // (priced by the vet later; finalize turns them into vaccination records).
    const vaccTasks = clientAgreed
      ? recommendedList.map(l => ({ id: Math.floor(Math.random() * 1e6), name: `${l} vaccination`, category: 'Vaccination', status: 'PENDING', price: 0 }))
      : [];
    setSubmitting(true);
    try {
      const res = await visitsAPI.create({
        clientId, petId: selectedPet.id,
        apptDate: date, apptTime: time,
        encounterType: 'GROOMING', visitType: 'CONSULTATION',
        totalCost: tasks.reduce((s, t) => s + (t.price || 0), 0),
        tasks: [...tasks, ...vaccTasks],
        groomingDetail: { temperament, specialInstructions, vaccinationStatus: Object.keys(vaccines).filter(k => vaccines[k]).join(', '), intakeWeight: Number(intakeWeight) },
      } as any);
      if (res.success) {
        const newId = (res.data as any)?.appointment?.id;
        // Journey log = recommendation source + recommender (server stamps the user).
        if (newId && recommendedList.length > 0) {
          visitsAPI.addEvent(newId, {
            label: `Vaccines recommended at grooming gate: ${recommendedList.join(', ')} — ${clientAgreed ? 'client agreed; added to visit for vaccination' : 'awaiting client decision'}`,
            kind: 'action',
          }).catch(() => {});
        }
        onCreated(newId); onClose();
      }
      else setError(res.message || 'Failed to create grooming visit');
    } catch (err: any) { setError(err?.message || 'Failed to create grooming visit.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onClose} disabled={submitting} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Grooming
      </button>

      {/* Header banner — same fuchsia/pink theme as the grooming record page */}
      <div className="bg-gradient-to-br from-fuchsia-700 to-pink-600 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><Scissors size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Grooming admission</p>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2 min-w-0">
            <Dog size={18} className="shrink-0" /> <span className="truncate">{selectedPet ? selectedPet.name : 'New Grooming Visit'}</span>
          </h1>
          <p className="text-[11px] text-white/70 truncate">
            {selectedPet ? `${selectedPet.breed ? `${selectedPet.breed} · ` : ''}${selectedPet.species ?? ''}` : 'Check a patient in for grooming'}
          </p>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/15 flex items-center gap-1.5">
          <CalendarClock size={12} /> New visit
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
                  {matches.map(p => <button key={p.id} type="button" onClick={() => { setPetId(p.id); setPetSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-pine dark:text-zinc-100">{p.name} <span className="text-slate-400 text-xs">{p.species}</span></button>)}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Schedule */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-seafoam mb-3">Schedule</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">Date</label><input type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label className="field-label">Time</label><input type="time" className="field-input" value={time} onChange={e => setTime(e.target.value)} /></div>
          </div>
        </section>

        {/* Admission gate */}
        <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-3"><ShieldCheck size={14} /> Admission gate — required</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="field-label">Intake weight (kg) *</label>
              <input type="number" min="0" step="0.1" className="field-input" value={intakeWeight} onChange={e => { setIntakeWeight(e.target.value); setWeightCopied(false); }} placeholder="e.g. 12.4" />
              {weightCopied && <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1">Copied from record (&lt;3 months old) — confirm on the scale.</p>}
            </div>
            <div><label className="field-label">Temperament</label><select className="field-select" value={temperament} onChange={e => setTemperament(e.target.value)}><option value="">Select…</option>{TEMPERAMENTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
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
        </section>

        {/* Services */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-pink-600 dark:text-pink-400 mb-3"><Scissors size={14} /> Grooming services *</p>
          {services.length === 0 ? <p className="text-[11px] text-slate-400">No grooming services in the catalog — add them under Services.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {services.map(s => { const on = !!picked[s.id]; return (
                <button key={s.id} type="button" onClick={() => toggleSvc(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{s.name}{s.defaultPrice ? ` · ${s.defaultPrice}` : ''}</button>
              ); })}
            </div>
          )}
        </section>

        {/* Instructions */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <label className="field-label">Special instructions</label>
          <textarea rows={2} className="field-textarea" value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Sensitive ears, matting, etc." />
        </section>

        <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
          <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 px-6 py-3 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-seafoam/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-seafoam/20">
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : <><Plus size={18} /> Create grooming visit</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroomingAdmitModal;

import React, { useState, useMemo, useEffect } from 'react';
import { X, Scissors, Loader2, Search, ShieldCheck, Dog, ArrowLeft, Plus } from 'lucide-react';
import { Pet } from '../../../types';
import { visitsAPI, servicesAPI } from '../../../services';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pets: Pet[];
  onCreated: (visitId?: string) => void;
  initialPetId?: number;
}

const VACCINES = [
  { key: 'rabies', label: 'Rabies' },
  { key: 'dhpp', label: 'DHPP' },
  { key: 'kennelCough', label: 'Kennel Cough' },
];
const TEMPERAMENTS = ['Calm', 'Anxious', 'Aggressive', 'Playful', 'Fearful'];

const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

/**
 * Grooming onboarding — mirrors Admit to Boarding: patient + schedule, an
 * admission gate (intake weight + vaccination check), grooming services to
 * perform, temperament + special instructions. Creates a GROOMING visit with the
 * picked services as tasks (grooming records auto-create from them) and stores
 * the intake on the visit's grooming detail.
 */
const GroomingAdmitModal: React.FC<Props> = ({ isOpen, onClose, pets, onCreated, initialPetId }) => {
  const [petId, setPetId] = useState<number | null>(initialPetId ?? null);
  const [petSearch, setPetSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [intakeWeight, setIntakeWeight] = useState('');
  const [vaccines, setVaccines] = useState<Record<string, boolean>>({});
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
    if (Object.keys(vaccines).length === 0) { setError('Record the vaccination check before admitting.'); return; }
    const tasks = Object.entries(picked).map(([id, v]) => ({ id: Math.floor(Math.random() * 1e6), name: v.name, category: 'Grooming', status: 'PENDING', price: v.price, serviceId: Number(id) }));
    if (tasks.length === 0) { setError('Pick at least one grooming service.'); return; }
    setSubmitting(true);
    try {
      const res = await visitsAPI.create({
        clientId, petId: selectedPet.id,
        apptDate: date, apptTime: time,
        encounterType: 'GROOMING', visitType: 'CONSULTATION',
        totalCost: tasks.reduce((s, t) => s + (t.price || 0), 0),
        tasks,
        groomingDetail: { temperament, specialInstructions, vaccinationStatus: Object.keys(vaccines).filter(k => vaccines[k]).join(', '), intakeWeight: Number(intakeWeight) },
      } as any);
      if (res.success) { onCreated((res.data as any)?.appointment?.id); onClose(); }
      else setError(res.message || 'Failed to create grooming visit');
    } catch (err: any) { setError(err?.message || 'Failed to create grooming visit.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 dark:bg-zinc-950 overflow-y-auto animate-in fade-in duration-200">
      <div className="max-w-3xl mx-auto min-h-full">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl" disabled={submitting}><ArrowLeft size={20} className="text-slate-400" /></button>
            <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/20 flex items-center justify-center"><Scissors size={20} className="text-pink-600 dark:text-pink-400" /></div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">New Grooming Visit</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl" disabled={submitting}><X size={20} className="text-slate-400" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>}

          {/* Patient */}
          <div>
            <label className={labelCls}>Patient *</label>
            {selectedPet ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl">
                <span className="flex items-center gap-2 text-sm font-bold text-pine dark:text-zinc-100"><Dog size={15} className="text-seafoam" /> {selectedPet.name} · {selectedPet.species}</span>
                <button type="button" onClick={() => { setPetId(null); setPetSearch(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={petSearch} onChange={e => setPetSearch(e.target.value)} placeholder="Search patient by name…" className={`${fieldCls} pl-9`} />
                {matches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
                    {matches.map(p => <button key={p.id} type="button" onClick={() => { setPetId(p.id); setPetSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-pine dark:text-zinc-100">{p.name} <span className="text-slate-400 text-xs">{p.species}</span></button>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-seafoam mb-3">Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Date</label><input type="date" className={fieldCls} value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><label className={labelCls}>Time</label><input type="time" className={fieldCls} value={time} onChange={e => setTime(e.target.value)} /></div>
            </div>
          </div>

          {/* Admission gate */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 mb-3"><ShieldCheck size={14} /> Admission gate — required</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className={labelCls}>Intake weight (kg) *</label><input type="number" min="0" step="0.1" className={fieldCls} value={intakeWeight} onChange={e => setIntakeWeight(e.target.value)} placeholder="e.g. 12.4" /></div>
              <div><label className={labelCls}>Temperament</label><select className={fieldCls} value={temperament} onChange={e => setTemperament(e.target.value)}><option value="">Select…</option>{TEMPERAMENTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <label className={labelCls}>Vaccination check *</label>
            <div className="flex flex-wrap gap-2">
              {VACCINES.map(v => (
                <button key={v.key} type="button" onClick={() => setVaccines(s => ({ ...s, [v.key]: !s[v.key] }))}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all ${vaccines[v.key] ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-50 dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>{v.label}</button>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-pink-600 dark:text-pink-400 mb-3"><Scissors size={14} /> Grooming services *</p>
            {services.length === 0 ? <p className="text-[11px] text-slate-400">No grooming services in the catalog — add them under Services.</p> : (
              <div className="flex flex-wrap gap-1.5">
                {services.map(s => { const on = !!picked[s.id]; return (
                  <button key={s.id} type="button" onClick={() => toggleSvc(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{s.name}{s.defaultPrice ? ` · ${s.defaultPrice}` : ''}</button>
                ); })}
              </div>
            )}
          </div>

          <div><label className={labelCls}>Special instructions</label><textarea rows={2} className={fieldCls} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Sensitive ears, matting, etc." /></div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create grooming visit</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroomingAdmitModal;

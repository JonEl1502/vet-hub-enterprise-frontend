import React, { useState, useMemo } from 'react';
import { X, Stethoscope, Loader2, Search, Dog } from 'lucide-react';
import { Pet } from '../../../types';
import { inpatientAPI } from '../../../services';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pets: Pet[];
  onAdmitted: () => void;
  initialPetId?: number;
  appointmentId?: string | number;
}

const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

const AdmitInpatientModal: React.FC<Props> = ({ isOpen, onClose, pets, onAdmitted, initialPetId, appointmentId }) => {
  const [petId, setPetId] = useState<number | null>(initialPetId ?? null);
  const [petSearch, setPetSearch] = useState('');
  const [inpatientNo, setInpatientNo] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [cage, setCage] = useState('');
  const [admissionNotes, setAdmissionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!selectedPet) { setError('Select a patient to admit.'); return; }
    const clientId = (selectedPet as any).ownerId ?? (selectedPet as any).owner?.id;
    if (!clientId) { setError('This patient has no owner on record.'); return; }
    setSubmitting(true);
    try {
      const res = await inpatientAPI.admit({
        petId: selectedPet.id, clientId, appointmentId,
        inpatientNo: inpatientNo || undefined, diagnosis: diagnosis || undefined,
        cage: cage || undefined, admissionNotes: admissionNotes || undefined,
      });
      if (res.success) { onAdmitted(); onClose(); }
      else setError(res.message || 'Failed to admit');
    } catch (err: any) {
      setError(err?.message || 'Failed to admit. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center"><Stethoscope size={18} className="text-red-600 dark:text-red-400" /></div>
            <h2 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Admit inpatient</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl" disabled={submitting}><X size={18} className="text-slate-400" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>}

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

          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Inpatient no.</label><input className={fieldCls} value={inpatientNo} onChange={e => setInpatientNo(e.target.value)} placeholder="IP-001" /></div>
            <div><label className={labelCls}>Cage / Kennel</label><input className={fieldCls} value={cage} onChange={e => setCage(e.target.value)} placeholder="A1" /></div>
          </div>
          <div><label className={labelCls}>Diagnosis</label><input className={fieldCls} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Parvoviral enteritis" /></div>
          <div><label className={labelCls}>Admission notes (clinical / surgical + Dr orders)</label><textarea className={fieldCls} rows={3} value={admissionNotes} onChange={e => setAdmissionNotes(e.target.value)} placeholder="Stabilise, IV fluids @ X ml/hr, anti-emetics…" /></div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-5 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-5 py-3 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-seafoam/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-seafoam/20">
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Admitting…</> : <><Stethoscope size={18} /> Admit</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdmitInpatientModal;

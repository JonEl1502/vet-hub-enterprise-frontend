import React, { useState } from 'react';
import { X, UserPlus, Loader2, Dog, Zap } from 'lucide-react';
import { clientsAPI } from '../../../services';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: { client: any; pet: any }) => void;
}

const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Reptile', 'Other'];
const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

const WalkInModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addPet, setAddPet] = useState(true);
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('Dog');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => { setFirstName(''); setSurname(''); setPhone(''); setEmail(''); setPetName(''); setPetSpecies('Dog'); setAddPet(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !surname.trim() || !phone.trim()) { setError('First name, surname and phone are required.'); return; }
    setSubmitting(true);
    try {
      const res = await clientsAPI.walkIn({
        firstName: firstName.trim(), surname: surname.trim(), phone: phone.trim(),
        email: email.trim() || undefined,
        pet: addPet && petName.trim() ? { name: petName.trim(), species: petSpecies } : undefined,
      });
      if (res.success && res.data) { onCreated(res.data); reset(); onClose(); }
      else setError(res.message || 'Failed to register walk-in');
    } catch (err: any) {
      setError(err?.message || 'Failed to register. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center"><Zap size={18} className="text-seafoam" /></div>
            <div>
              <h2 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Walk-in</h2>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Brief capture — finish the record later</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl" disabled={submitting}><X size={18} className="text-slate-400" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>First name *</label><input className={fieldCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" autoFocus /></div>
            <div><label className={labelCls}>Surname *</label><input className={fieldCls} value={surname} onChange={e => setSurname(e.target.value)} placeholder="Doe" /></div>
            <div><label className={labelCls}>Phone *</label><input className={fieldCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="07…" /></div>
            <div><label className={labelCls}>Email</label><input className={fieldCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" /></div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={addPet} onChange={e => setAddPet(e.target.checked)} className="accent-seafoam" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5"><Dog size={13} className="text-seafoam" /> Add a patient too</span>
            </label>
            {addPet && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Pet name</label><input className={fieldCls} value={petName} onChange={e => setPetName(e.target.value)} placeholder="Rex" /></div>
                <div><label className={labelCls}>Species</label><select className={fieldCls} value={petSpecies} onChange={e => setPetSpecies(e.target.value)}>{SPECIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">This record will be flagged <b>“needs update”</b> — the rest can be filled later by you or the owner.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-5 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-5 py-3 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-seafoam/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-seafoam/20">
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><UserPlus size={18} /> Register</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalkInModal;

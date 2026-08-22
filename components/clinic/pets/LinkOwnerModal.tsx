import React, { useEffect, useState } from 'react';
import { X, Search, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { clientsAPI, petsAPI, toast } from '../../../services';

/**
 * Give an orphaned patient an owner — find an existing client, or make one.
 *
 * An orphan is a real operational problem, not a cosmetic one: with no owner
 * there is nobody to bill, remind, or call about this animal. The badge saying
 * "orphaned" was previously inert, and the only cure sat in a panel further
 * down the page — so the obvious thing to click did nothing.
 *
 * CREATE is here for a reason. Search alone assumes the owner already exists in
 * VetHub, which is exactly the case that fails after a migration: the pet came
 * across and its owner did not. Forcing the user to leave, create a client, and
 * come back is where an orphan quietly stays an orphan.
 */
type Found = { id: number; name: string; phone?: string };

const LinkOwnerModal: React.FC<{
  petId: number;
  petName: string;
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
}> = ({ petId, petName, open, onClose, onLinked }) => {
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setMode('search'); setFirstName(''); setSurname(''); setPhone(''); }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'search' || query.trim().length < 2) { setResults([]); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res: any = await clientsAPI.getAll({ page: 1, limit: 8, search: query.trim() }, { cache: false });
        if (alive && res?.data?.clients) {
          setResults(res.data.clients.map((c: any) => ({
            id: typeof c.id === 'string' ? parseInt(c.id) : c.id, name: c.name, phone: c.phone,
          })));
        }
      } catch { /* the search box should never throw at the user */ }
      finally { if (alive) setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, open, mode]);

  const link = async (clientId: number, label: string) => {
    setBusy(true);
    try {
      const res: any = await petsAPI.reassign(petId, clientId);
      if (res?.success !== false) {
        toast.success(`${petName} linked to ${label}`);
        onLinked();
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Could not link the owner');
    } finally { setBusy(false); }
  };

  const createAndLink = async () => {
    if (!firstName.trim() || !surname.trim() || !phone.trim()) {
      toast.error('First name, surname and phone are required');
      return;
    }
    setBusy(true);
    try {
      const res: any = await clientsAPI.create({
        firstName: firstName.trim(), surname: surname.trim(), phone: phone.trim(),
      } as any);
      const created = res?.data?.client ?? res?.data;
      const newId = created?.id ? (typeof created.id === 'string' ? parseInt(created.id) : created.id) : null;
      if (!newId) { toast.error('Client was not created'); return; }
      // Link in the same action — a client created here and left unlinked would
      // leave the orphan orphaned AND add a duplicate-looking client.
      await link(newId, `${firstName.trim()} ${surname.trim()}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Could not create the client');
    } finally { setBusy(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-black text-pine dark:text-zinc-100">Link an owner</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle size={12} /> {petName}</span> has no owner — nobody to bill, remind or call.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"><X size={18} /></button>
        </div>

        <div className="flex gap-1 p-3 border-b border-slate-100 dark:border-zinc-800">
          {(['search', 'create'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                mode === m ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200'}`}>
              {m === 'search' ? <Search size={13} /> : <UserPlus size={13} />}
              {m === 'search' ? 'Find existing' : 'Create new'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {mode === 'search' ? (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm" />
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
                {searching && <div className="px-3 py-4 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Searching…</div>}
                {!searching && query.trim().length >= 2 && !results.length && (
                  <div className="px-3 py-4 text-xs text-slate-400">
                    No client matches “{query.trim()}”. Their owner may not exist in VetHub yet — use <strong>Create new</strong>.
                  </div>
                )}
                {results.map(c => (
                  <button key={c.id} disabled={busy} onClick={() => link(c.id, c.name)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{c.name}</span>
                    {c.phone && <span className="text-xs text-slate-400 shrink-0">{c.phone}</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input autoFocus value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name *"
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm" />
                <input value={surname} onChange={e => setSurname(e.target.value)} placeholder="Surname *"
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm" />
              </div>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone *"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm" />
              <p className="text-[11px] text-slate-400">
                The client is created and linked to {petName} in one step, so a half-finished attempt cannot leave the patient orphaned with a stray client alongside it.
              </p>
              <button onClick={createAndLink} disabled={busy}
                className="w-full py-2.5 rounded-xl bg-seafoam text-white text-xs font-black uppercase tracking-widest disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Create & link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkOwnerModal;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, AlertTriangle, Loader2, Search, ArrowRight, Check, Trash2 } from 'lucide-react';
import { petsAPI, clientsAPI, OrphanedPet, Client, dialog } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAfterReassign?: () => void;
}

const OrphanedPetsModal: React.FC<Props> = ({ isOpen, onClose, onAfterReassign }) => {
  const [pets, setPets] = useState<OrphanedPet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-pet UI state: which one is being assigned, search results, picked client.
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedClientId, setPickedClientId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await petsAPI.orphaned();
      if (res.success) setPets(res.data.pets);
      else setError('Failed to load orphaned pets');
    } catch (e: any) {
      setError(e?.message || 'Failed to load orphaned pets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      load();
    } else {
      setActivePetId(null);
      setSearch('');
      setSearchResults([]);
      setPickedClientId(null);
      setDoneIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Debounced client search.
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (!activePetId || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await clientsAPI.getAll({ search: search.trim(), limit: 10 });
        if (res.success) setSearchResults(res.data.clients);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [search, activePetId]);

  const visiblePets = useMemo(() => pets.filter((p) => !doneIds.has(p.id)), [pets, doneIds]);

  const startAssign = (petId: string) => {
    setActivePetId(petId);
    setSearch('');
    setSearchResults([]);
    setPickedClientId(null);
  };
  const cancelAssign = () => {
    setActivePetId(null);
    setSearch('');
    setSearchResults([]);
    setPickedClientId(null);
  };

  // Auto-reassign: recover the former owner (recreate them as an active client
  // from the orphan's recorded details) and assign the pet — one click, no search.
  const [autoBusyId, setAutoBusyId] = useState<string | null>(null);
  const autoReassign = async (p: OrphanedPet) => {
    if (!p.formerOwner) { setError('No former owner on record to recover — use Reassign.'); return; }
    setAutoBusyId(p.id);
    setError(null);
    try {
      const name = (p.formerOwner.name || '').trim();
      const parts = name.split(/\s+/);
      const firstName = parts[0] || 'Recovered';
      const surname = parts.slice(1).join(' ') || 'Owner';
      const created = await clientsAPI.create({ firstName, surname, phone: p.formerOwner.phone || undefined, email: p.formerOwner.email || undefined } as any);
      const newId = (created.data as any)?.client?.id;
      if (!created.success || !newId) { setError('Could not recover the former owner.'); return; }
      const res = await petsAPI.reassign(p.id, String(newId));
      if (res.success) { setDoneIds((s) => new Set(s).add(p.id)); onAfterReassign?.(); }
      else setError('Auto-reassign failed');
    } catch (e: any) { setError(e?.message || 'Auto-reassign failed'); }
    finally { setAutoBusyId(null); }
  };

  const reassign = async () => {
    if (!activePetId || !pickedClientId) return;
    setReassigning(true);
    setError(null);
    try {
      const res = await petsAPI.reassign(activePetId, pickedClientId);
      if (res.success) {
        setDoneIds((s) => new Set(s).add(activePetId));
        cancelAssign();
        onAfterReassign?.();
      } else {
        setError('Reassignment failed');
      }
    } catch (e: any) {
      setError(e?.message || 'Reassignment failed');
    } finally {
      setReassigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-wider">
              Orphaned Pets
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="py-16"><LoadingSpinner message="Scanning pets…" /></div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">{error}</div>
          ) : visiblePets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-2xl mb-2">{doneIds.size > 0 ? '✅' : '✨'}</p>
              <p className="text-sm font-bold text-slate-500">
                {doneIds.size > 0
                  ? `${doneIds.size} pet${doneIds.size === 1 ? '' : 's'} reassigned. No more orphans in this clinic.`
                  : 'No orphaned pets in this clinic.'}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Pets become orphans when their owner is soft-deleted (e.g. after duplicate cleanup).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500">
                {visiblePets.length} pet{visiblePets.length === 1 ? '' : 's'} need a new owner.
                Pick a client by name, phone, or email.
              </p>
              {visiblePets.map((p) => {
                const isActive = activePetId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`border rounded-xl overflow-hidden ${isActive ? 'border-seafoam' : 'border-slate-200 dark:border-zinc-800'}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-zinc-800/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">
                          {p.name}
                          <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {p.species}{p.breed ? ` · ${p.breed}` : ''}{p.age ? ` · ${p.age}` : ''}
                          </span>
                        </p>
                        {p.formerOwner && (
                          <p className="text-[11px] text-slate-500 truncate">
                            former owner: <span className="line-through">{p.formerOwner.name}</span>
                            {p.formerOwner.phone ? ` · ${p.formerOwner.phone}` : ''}
                          </p>
                        )}
                      </div>
                      {!isActive && (
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button
                            onClick={() => startAssign(p.id)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-pine transition-colors"
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => autoReassign(p)}
                            disabled={!p.formerOwner || autoBusyId === p.id}
                            title={p.formerOwner ? `Recover former owner: ${p.formerOwner.name}` : 'No former owner on record'}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-seafoam/10 text-seafoam hover:bg-seafoam/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {autoBusyId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Auto-reassign
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await dialog.confirm({
                                title: `Delete ${p.name}?`,
                                message: 'Soft-delete — support can reverse this if needed.',
                                confirmLabel: 'Delete',
                                variant: 'danger',
                              });
                              if (!ok) return;
                              try {
                                await petsAPI.delete(Number(p.id));
                                setDoneIds((s) => new Set(s).add(p.id));
                                onAfterReassign?.();
                              } catch (e: any) {
                                setError(e?.message || 'Failed to delete pet');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-white dark:bg-zinc-900 border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center gap-1"
                            title="Delete this pet instead of reassigning"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {isActive && (
                      <div className="px-4 py-3 space-y-3 bg-white dark:bg-zinc-900">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          {searching && (
                            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-seafoam animate-spin" />
                          )}
                          <input
                            autoFocus
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPickedClientId(null); }}
                            placeholder="Search by name, phone, or email (min 2 chars)"
                            className="field-input field-icon-left"
                          />
                        </div>

                        {search.trim().length >= 2 && (
                          <div className="border border-slate-200 dark:border-zinc-800 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
                            {searchResults.length === 0 && !searching ? (
                              <p className="px-3 py-4 text-xs text-slate-400 text-center">No matches.</p>
                            ) : (
                              searchResults.map((c) => {
                                const cid = String(c.id);
                                const picked = pickedClientId === cid;
                                return (
                                  <button
                                    key={cid}
                                    onClick={() => setPickedClientId(cid)}
                                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${picked ? 'bg-seafoam/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                                  >
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${picked ? 'bg-seafoam text-white' : 'border border-slate-300 dark:border-zinc-600'}`}>
                                      {picked && <Check size={12} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold text-pine dark:text-zinc-100 truncate">
                                        {c.name || `${c.firstName} ${c.surname}`}
                                      </p>
                                      <p className="text-[11px] text-slate-500 truncate">
                                        {c.phone}{c.email ? ` · ${c.email}` : ''}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={cancelAssign}
                            disabled={reassigning}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={reassign}
                            disabled={!pickedClientId || reassigning}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {reassigning ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800">
          <p className="text-xs font-bold text-slate-500">
            {doneIds.size > 0
              ? `${doneIds.size} reassigned · ${visiblePets.length} remaining`
              : `${visiblePets.length} orphaned`}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrphanedPetsModal;

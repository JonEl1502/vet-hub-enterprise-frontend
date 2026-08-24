import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Siren, PawPrint, User, ChevronRight, AlertTriangle } from 'lucide-react';
import { petsAPI, clientsAPI, visitsAPI } from '../../../services';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { useData } from '../../../contexts/DataContext';
import { loadVisitFees, entryFeeFor } from '../shared/visitFees';
import { localYMD } from '../../../services/utils/dateFormatter';
import BrandMark from '../../shared/common/BrandMark';

/**
 * EMERGENCY QUICK ADD (user, 2026-08-24).
 *
 * An emergency arrives at the door with an animal, not with a form. The
 * existing path — Register Visit, pick the client, pick the pet, pick the
 * encounter, pick the visit type, save, then find the Triage tab — is six
 * decisions deep for a case where the only decision is *which animal*.
 *
 * So: search, pick, and the visit is created as a VET_VISIT / EMERGENCY and
 * opened on its Triage tab. Everything else the emergency needs is recorded in
 * triage, which is where the person is already looking.
 *
 * ⚠️ SEARCH IS SERVER-SIDE, deliberately. `useData()`'s `pets`/`clients` hold
 * the page the list view happened to load, so on a clinic with thousands of
 * patients most of them are simply absent from it — a local filter would say
 * "no patients found" for an animal that exists. See
 * `reference_context_cache_hides_history` for the same trap on visits.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the new visit's id once it exists — the caller opens triage. */
  onCreated: (visitId: number) => void;
}

type PetHit = {
  id: number | string;
  name: string;
  species?: string | null;
  breed?: string | null;
  ownerId?: number | string | null;
  ownerName?: string | null;
  isAlive?: boolean;
};

type ClientHit = {
  id: number | string;
  name: string;
  phone?: string | null;
};

const EmergencyQuickAddModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { categories } = useReferenceData();
  const { refreshAppointments } = useData();

  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [pets, setPets] = useState<PetHit[]>([]);
  const [clients, setClients] = useState<ClientHit[]>([]);
  /** A client was picked — show their animals, because a visit needs a patient. */
  const [ownerPets, setOwnerPets] = useState<{ client: ClientHit; pets: PetHit[] } | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on every open — a modal that remembers the last emergency's search is
  // one keystroke away from opening a visit on the wrong animal.
  useEffect(() => {
    if (!open) return;
    setQ(''); setPets([]); setClients([]); setOwnerPets(null);
    setError(null); setCreatingFor(null);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Debounced search. The last response wins — an earlier, slower one must not
  // overwrite the results for what is now in the box.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setPets([]); setClients([]); setSearching(false); return; }
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          petsAPI.getAll({ search: term, limit: 8, status: 'alive' }),
          clientsAPI.getAll({ search: term, limit: 6 }),
        ]);
        if (!live) return;
        setPets(((pRes as any)?.data?.pets ?? []) as PetHit[]);
        setClients(((cRes as any)?.data?.clients ?? []) as ClientHit[]);
      } catch {
        if (live) { setPets([]); setClients([]); }
      } finally {
        if (live) setSearching(false);
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, open]);

  /**
   * The one line the visit is created with.
   *
   * ⚠️ The price is the clinic's CONFIGURED emergency entry fee or nothing —
   * never a catalog fallback. Falling back to "the first service in the
   * Consultation category" is what once billed prod a KES 2,500 Behavioural
   * Consultation nobody chose (see `NewVisitView.vetVisitSeed`). The backend
   * requires at least one task, so the line itself is not optional; its price
   * is.
   */
  const seedTask = useCallback(() => {
    const configured = entryFeeFor(loadVisitFees(), 'VET_VISIT', 'EMERGENCY');
    const cat = categories.find((c: any) => c.name.toLowerCase().includes('emergen'))
      || categories.find((c: any) => c.name.toLowerCase().includes('consult'));
    return {
      id: Math.floor(Math.random() * 1e6),
      name: 'Emergency Fee',
      category: cat?.name || 'Consultation',
      status: 'PENDING',
      price: configured ?? 0,
      notes: '',
    };
  }, [categories]);

  const startEmergency = useCallback(async (pet: PetHit) => {
    if (!pet.ownerId) {
      setError(`${pet.name} has no owner on file — link an owner before opening a visit.`);
      return;
    }
    setError(null);
    setCreatingFor(String(pet.id));
    try {
      const now = new Date();
      const task = seedTask();
      const res = await visitsAPI.create({
        clientId: pet.ownerId,
        petId: pet.id,
        apptDate: localYMD(now),
        apptTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        encounterType: 'VET_VISIT',
        visitType: 'EMERGENCY',
        tasks: [task],
        totalCost: task.price,
      } as any);
      const visitId = (res.data as any)?.appointment?.id ?? (res.data as any)?.visit?.id;
      if (!res.success || !visitId) {
        setError(res.message || 'Could not open the emergency visit.');
        setCreatingFor(null);
        return;
      }
      // The detail view resolves the visit out of the cached list, so it has to
      // be there before we navigate — otherwise the page opens on "not found".
      await refreshAppointments();
      onCreated(Number(visitId));
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not open the emergency visit.');
      setCreatingFor(null);
    }
  }, [seedTask, refreshAppointments, onCreated, onClose]);

  const pickOwner = useCallback(async (client: ClientHit) => {
    setLoadingOwner(true);
    setError(null);
    try {
      const res = await petsAPI.getAll({ search: client.name, limit: 50, status: 'alive' });
      const all = ((res as any)?.data?.pets ?? []) as PetHit[];
      const theirs = all.filter(p => String(p.ownerId) === String(client.id));
      setOwnerPets({ client, pets: theirs });
    } catch {
      setOwnerPets({ client, pets: [] });
    } finally {
      setLoadingOwner(false);
    }
  }, []);

  const hasResults = pets.length > 0 || clients.length > 0;
  const petLine = (p: PetHit) => [p.breed, p.species].filter(Boolean).join(' • ');

  const row = (p: PetHit, owner?: string | null) => (
    <button
      key={`pet-${p.id}`}
      onClick={() => startEmergency(p)}
      disabled={creatingFor !== null}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border border-transparent hover:border-red-200 dark:hover:border-red-900/60 hover:bg-red-50/60 dark:hover:bg-red-950/20 transition-all disabled:opacity-50 disabled:cursor-wait group"
    >
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 shrink-0 group-hover:bg-red-100 dark:group-hover:bg-red-900/40 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
        {creatingFor === String(p.id) ? <Loader2 size={15} className="animate-spin" /> : <PawPrint size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{p.name}</span>
        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">
          {petLine(p) || 'Patient'}{owner ? ` · ${owner}` : p.ownerName ? ` · ${p.ownerName}` : ''}
        </span>
      </span>
      {!p.ownerId && (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase tracking-wider">
          <AlertTriangle size={9} /> No owner
        </span>
      )}
      <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-zinc-600 group-hover:text-red-500 transition-colors" />
    </button>
  );

  const body = useMemo(() => {
    if (ownerPets) {
      return (
        <div className="space-y-1">
          <button
            onClick={() => setOwnerPets(null)}
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-colors px-1 pb-1"
          >
            ← Back to results
          </button>
          <p className="px-1 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            {ownerPets.client.name}'s patients
          </p>
          {ownerPets.pets.length === 0
            ? <p className="px-3 py-6 text-center text-xs font-bold text-slate-400">No living patients on file for this owner.</p>
            : ownerPets.pets.map(p => row(p, ownerPets.client.name))}
        </div>
      );
    }

    if (q.trim().length < 2) {
      return (
        <div className="px-4 py-10 text-center space-y-2">
          <Search size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />
          <p className="text-xs font-bold text-slate-400 dark:text-zinc-500">
            Type a patient or owner name to begin.
          </p>
          <p className="text-[10px] font-bold text-slate-300 dark:text-zinc-600">
            Picking one opens an emergency visit and goes straight to triage.
          </p>
        </div>
      );
    }

    if (searching && !hasResults) {
      return (
        <div className="px-4 py-10 text-center">
          <Loader2 size={20} className="mx-auto animate-spin text-seafoam" />
        </div>
      );
    }

    if (!hasResults) {
      return (
        <p className="px-4 py-10 text-center text-xs font-bold text-slate-400">
          Nothing matches “{q.trim()}”.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {pets.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Patients</p>
            {pets.map(p => row(p))}
          </div>
        )}
        {clients.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Owners</p>
            {clients.map(c => (
              <button
                key={`client-${c.id}`}
                onClick={() => pickOwner(c)}
                disabled={loadingOwner || creatingFor !== null}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-all disabled:opacity-50 group"
              >
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 shrink-0">
                  {loadingOwner ? <Loader2 size={15} className="animate-spin" /> : <User size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{c.name}</span>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">
                    {c.phone || 'Owner'} · pick a patient
                  </span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-zinc-600 group-hover:text-seafoam transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
    // `row` closes over creatingFor/startEmergency, both in the dep list below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerPets, q, searching, hasResults, pets, clients, loadingOwner, creatingFor, startEmergency, pickOwner]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop. Clicking it closes — an emergency modal opened by mistake
          must not be a trap. */}
      <div className="fixed inset-0 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mt-[8vh] rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Brand header. The mark takes `currentColor` because pine/seafoam are
            runtime CSS variables — a hardcoded hex survives a clinic rebrand
            and clashes with the header it sits on. */}
        <div className="relative overflow-hidden px-4 py-3 bg-gradient-to-r from-pine to-seafoam text-white">
          <BrandMark
            className="pointer-events-none absolute -right-4 -top-6 w-28 h-28 opacity-10"
            color="currentColor"
          />
          <div className="relative flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-white/15 ring-1 ring-white/25 shrink-0">
              <BrandMark className="w-5 h-5" color="currentColor" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-widest leading-tight flex items-center gap-1.5">
                <Siren size={13} className="shrink-0" /> Emergency quick add
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/70 truncate">
                Find the patient — triage opens itself
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setOwnerPets(null); }}
              placeholder="Patient or owner name…"
              className="field-input field-icon-left"
              autoComplete="off"
            />
            {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-seafoam" />}
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-[11px] font-bold text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="p-3 max-h-[52vh] overflow-y-auto">{body}</div>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Deceased patients are not listed · Esc to close
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EmergencyQuickAddModal;

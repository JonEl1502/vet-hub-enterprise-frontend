/**
 * 233 — "who sees the Farmer rungs", on the tab where the rungs are edited.
 *
 * The CLIENT ladder carries two customers: a pet owner (Free, Plus) and a
 * farmer (Farmer, Farmer Pro, Farmer Pro+). Left ungated, every pet owner
 * opening their plan screen was offered "Farmer Pro+ — KES 5,000", which is
 * livestock software for a labrador.
 *
 * ⚠️ This is a VISIBILITY control, not a paywall, and the distinction is the
 * whole point. The Farmer rungs ARE the farm product — a paid unlock in front
 * of them would charge for the right to then buy the thing that actually grants
 * the farms. Clinics and suppliers keep the ONE paid Farms add-on, because for
 * them farms genuinely are a bolt-on to a business that is something else.
 *
 * Two levers, and the per-account one wins:
 *   • the platform MODE — everyone / farm accounts / nobody-but-my-picks
 *   • per-account GRANTS — "throw farm access to that client" (user,
 *     2026-08-25), e.g. when someone moves up to Plus and mentions a herd.
 *
 * ⚠️ Neither lever can hide a rung a client is PAYING for. The server floors on
 * "owns farms or holds a farm plan" before it reads either — a plan that
 * vanished from the screen you renew it on is a plan you cannot cancel either.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Sprout, Search, Loader2, X, Check, Minus, RefreshCw } from 'lucide-react';
import {
  platformSettingsAPI,
  adminFarmAccessAPI,
  type ClientFarmPlansMode,
  type FarmAccessClient,
} from '../../../services';

const MODES: Array<{ key: ClientFarmPlansMode; label: string; hint: string }> = [
  {
    key: 'FARM_ACCOUNTS',
    label: 'Farm accounts',
    hint: 'Clients flagged as keeping livestock, who own a farm, or who declared it themselves in the portal. The default.',
  },
  {
    key: 'ALL',
    label: 'Everyone',
    hint: 'Every client sees the Farmer rungs, pet owners included.',
  },
  {
    key: 'MANUAL',
    label: 'Only my picks',
    hint: 'Nobody sees them except the accounts granted below. Clients already paying for a farm plan keep theirs.',
  },
];

const badge = (c: FarmAccessClient) =>
  c.farmPlansOverride === true ? { text: 'Granted', cls: 'text-emerald-600 dark:text-emerald-400' }
  : c.farmPlansOverride === false ? { text: 'Withheld', cls: 'text-rose-600 dark:text-rose-400' }
  : { text: 'Follows the rules', cls: 'text-slate-400 dark:text-zinc-500' };

const FarmPlansAccessPanel: React.FC = () => {
  const [mode, setMode] = useState<ClientFarmPlansMode>('FARM_ACCOUNTS');
  const [savingMode, setSavingMode] = useState(false);
  const [overrides, setOverrides] = useState<FarmAccessClient[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<FarmAccessClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([
      platformSettingsAPI.get(),
      adminFarmAccessAPI.list(),
    ]);
    if (s.success && s.data) setMode(s.data.clientFarmPlansMode ?? 'FARM_ACCOUNTS');
    if (o.success && o.data) setOverrides(o.data.clients);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounced — the search hits every portal client on the platform, and
  // firing it per keystroke would scan the table for prefixes nobody wants.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await adminFarmAccessAPI.search(q.trim());
      setResults(r.success && r.data ? r.data.clients : []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const saveMode = async (m: ClientFarmPlansMode) => {
    const prev = mode;
    setMode(m);              // optimistic — the radio must not lag the click
    setSavingMode(true);
    const r = await platformSettingsAPI.update({ clientFarmPlansMode: m });
    setSavingMode(false);
    if (!r.success) setMode(prev);
  };

  const setOverride = async (c: FarmAccessClient, override: boolean | null) => {
    setBusyId(c.clientId);
    const r = await adminFarmAccessAPI.setOverride(c.clientId, override);
    setBusyId(null);
    if (!r.success) return;
    // Refresh both lists: one client row can appear in either, and the granted
    // list is what the admin actually reads back as "what did I decide".
    await load();
    setResults((rs) => rs.map((x) => (x.clientId === c.clientId ? { ...x, farmPlansOverride: override } : x)));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 flex justify-center">
        <Loader2 size={16} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprout size={14} className="text-seafoam" />
          <p className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
            Farm plans access
          </p>
          {savingMode && <Loader2 size={12} className="animate-spin text-slate-400" />}
        </div>
        <button onClick={load} className="text-slate-400 hover:text-pine dark:hover:text-zinc-200">
          <RefreshCw size={13} />
        </button>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-zinc-500 leading-relaxed">
        Who is offered <strong>Farmer</strong>, <strong>Farmer Pro</strong> and <strong>Farmer Pro+</strong> on
        their plan screen. Everyone else sees Free and Plus. This controls what is
        <em> shown</em> — the rungs themselves are still bought normally, and a client
        already paying for one always keeps seeing it.
      </p>

      {/* Mode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => saveMode(m.key)}
            className={`text-left p-3 rounded-xl border transition-all ${
              mode === m.key
                ? 'border-seafoam bg-seafoam/5 dark:bg-seafoam/10'
                : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                mode === m.key ? 'border-seafoam bg-seafoam' : 'border-slate-300 dark:border-zinc-700'
              }`} />
              <span className="text-[11px] font-black text-pine dark:text-zinc-100">{m.label}</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1 leading-snug">{m.hint}</p>
          </button>
        ))}
      </div>

      {/* Per-account grants */}
      <div className="pt-1 space-y-2">
        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
          Per-account
        </p>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a client by name, email or phone…"
            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg pl-8 pr-8 py-1.5 text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
          />
          {searching && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
          {!searching && q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine">
              <X size={12} />
            </button>
          )}
        </div>

        {q.trim().length >= 2 && results.length === 0 && !searching && (
          <p className="text-[11px] text-slate-400 dark:text-zinc-600 px-1">
            No portal clients match. Only clients with a portal login can be granted — a
            staff-managed contact has no plan screen to show the rungs on.
          </p>
        )}

        {results.map((c) => (
          <ClientRow key={c.clientId} c={c} busy={busyId === c.clientId} onSet={setOverride} />
        ))}

        {overrides.length > 0 && (
          <>
            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pt-2">
              Decided ({overrides.length})
            </p>
            {overrides.map((c) => (
              <ClientRow key={c.clientId} c={c} busy={busyId === c.clientId} onSet={setOverride} />
            ))}
          </>
        )}

        {overrides.length === 0 && mode === 'MANUAL' && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 px-1">
            Mode is <strong>Only my picks</strong> and nothing is picked — no client can see a
            farm plan right now (except anyone already paying for one).
          </p>
        )}
      </div>
    </div>
  );
};

const ClientRow: React.FC<{
  c: FarmAccessClient;
  busy: boolean;
  onSet: (c: FarmAccessClient, override: boolean | null) => void;
}> = ({ c, busy, onSet }) => {
  const b = badge(c);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">
          {c.name || 'Unnamed client'}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-zinc-600 truncate">
          {[c.email || c.phone, c.clinicName].filter(Boolean).join(' · ')}
          {c.farmCount > 0 && ` · ${c.farmCount} farm${c.farmCount === 1 ? '' : 's'}`}
        </p>
      </div>
      <span className={`text-[10px] font-black uppercase tracking-wider shrink-0 ${b.cls}`}>{b.text}</span>
      {busy ? (
        <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />
      ) : (
        <div className="flex gap-1 shrink-0">
          <IconBtn title="Grant farm plans" active={c.farmPlansOverride === true} onClick={() => onSet(c, true)}>
            <Check size={12} />
          </IconBtn>
          <IconBtn title="Follow the rules" active={c.farmPlansOverride === null} onClick={() => onSet(c, null)}>
            <Minus size={12} />
          </IconBtn>
          <IconBtn title="Never offer farm plans" active={c.farmPlansOverride === false} onClick={() => onSet(c, false)}>
            <X size={12} />
          </IconBtn>
        </div>
      )}
    </div>
  );
};

const IconBtn: React.FC<{
  title: string; active: boolean; onClick: () => void; children: React.ReactNode;
}> = ({ title, active, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
      active
        ? 'border-seafoam bg-seafoam text-white'
        : 'border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-pine dark:hover:text-zinc-200'
    }`}
  >
    {children}
  </button>
);

export default FarmPlansAccessPanel;

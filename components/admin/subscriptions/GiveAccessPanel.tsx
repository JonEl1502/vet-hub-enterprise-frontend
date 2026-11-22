import React, { useEffect, useRef, useState } from 'react';
import { Search, Gift, ReceiptText, KeyRound, Building2, Truck, User, X, Loader2 } from 'lucide-react';
import { adminOrgAPI, AccountHit } from '../../../services/modules/adminOrg.api';
import ComplimentaryTrialCard from '../clinics/ComplimentaryTrialCard';
import RecordPaidSubscriptionDialog from './RecordPaidSubscriptionDialog';

/**
 * GIVE ACCESS — find the account by what you know, then say what you're giving
 * (user, 2026-11-22: "search the name or the phone number … select whether
 * I'm giving them a free Pro or Enterprise, complimentary … or a paid plan,
 * like a recorded paid plan, a plan I've received cash for").
 *
 *  - Complimentary plan — a chosen plan free for N days (the 328 complimentary
 *    trial). Clinics only: that is where the complimentary plan lives.
 *  - Paid plan, cash received — the same "Record a paid subscription" the
 *    clinic page uses, so the money is on the books.
 *  - Single features — the per-key grant form below, filled in for this account.
 */
type Mode = 'complimentary' | 'paid' | 'features';

interface Props {
  /** Fill the feature-grant form below with this account and look it up. */
  onPickForFeatures: (kind: 'CLINIC' | 'SUPPLIER' | 'CLIENT', id: string) => void;
}

const KIND_ICON = { CLINIC: Building2, SUPPLIER: Truck, CLIENT: User } as const;

const GiveAccessPanel: React.FC<Props> = ({ onPickForFeatures }) => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<AccountHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<AccountHit | null>(null);
  const [mode, setMode] = useState<Mode>('complimentary');
  const [summary, setSummary] = useState<any | null>(null);
  const [paidOpen, setPaidOpen] = useState(false);
  const seq = useRef(0);

  // Debounced search by name, phone or email.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2 || picked) { setHits(null); return; }
    const n = ++seq.current;
    setSearching(true);
    const h = window.setTimeout(async () => {
      try {
        const r = await adminOrgAPI.search(t);
        if (n !== seq.current) return;
        setHits(r.success && r.data ? [...r.data.clinics, ...r.data.suppliers, ...r.data.clients] : []);
      } catch { if (n === seq.current) setHits([]); }
      finally { if (n === seq.current) setSearching(false); }
    }, 250);
    return () => window.clearTimeout(h);
  }, [q, picked]);

  // A clinic's current trial / complimentary state, for the complimentary card.
  const loadSummary = (id: string) => {
    setSummary(null);
    adminOrgAPI.clinicSummary(id).then(r => { if (r.success && r.data) setSummary(r.data); }).catch(() => {});
  };

  const pick = (h: AccountHit) => {
    setPicked(h); setHits(null); setQ('');
    setMode(h.kind === 'CLINIC' ? 'complimentary' : 'paid');
    if (h.kind === 'CLINIC') loadSummary(h.id);
    onPickForFeatures(h.kind, h.id);
  };

  const tabs: { id: Mode; label: string; Icon: React.FC<any>; off?: string }[] = [
    { id: 'complimentary', label: 'Complimentary plan', Icon: Gift, off: picked && picked.kind !== 'CLINIC' ? 'Clinics only for now' : undefined },
    { id: 'paid', label: 'Paid plan · cash received', Icon: ReceiptText },
    { id: 'features', label: 'Single features', Icon: KeyRound },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 mb-5">
      <h2 className="flex items-center gap-2 font-black text-pine dark:text-zinc-100 mb-1"><Gift size={15} /> Give access to an account</h2>
      <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">Search by name, phone or email, then choose what you're giving.</p>

      {/* Find the account */}
      {!picked ? (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Clinic, supplier or client — name, phone or email…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-semibold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
            autoComplete="off"
          />
          {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
          {hits && (
            <div className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1">
              {hits.length === 0 && <p className="px-3 py-2 text-[12px] text-slate-400">Nothing matches “{q}”.</p>}
              {hits.map(h => {
                const Icon = KIND_ICON[h.kind];
                return (
                  <button key={`${h.kind}-${h.id}`} type="button" onClick={() => pick(h)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2.5">
                    <Icon size={14} className="text-seafoam shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-pine dark:text-zinc-100 truncate">
                        {h.name}{!h.isActive && <span className="ml-1.5 text-[10px] font-bold text-rose-500">inactive</span>}
                      </span>
                      <span className="block text-[11px] text-slate-400 truncate">
                        {[h.kind.toLowerCase(), h.phone, h.email, h.hint].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
          {React.createElement(KIND_ICON[picked.kind], { size: 16, className: 'text-emerald-700 dark:text-emerald-300 shrink-0' })}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-pine dark:text-zinc-100 truncate">{picked.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{[picked.kind.toLowerCase(), `#${picked.id}`, picked.phone, picked.email].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={() => { setPicked(null); setSummary(null); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500" aria-label="Pick another account"><X size={15} /></button>
        </div>
      )}

      {/* What you're giving */}
      {picked && (
        <div className="mt-4 space-y-3">
          <div className="inline-flex flex-wrap rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
            {tabs.map(t => (
              <button key={t.id} type="button" disabled={!!t.off} title={t.off}
                onClick={() => { setMode(t.id); if (t.id === 'paid') setPaidOpen(true); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-black uppercase tracking-wide border-l first:border-l-0 border-slate-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed ${
                  mode === t.id ? 'bg-seafoam text-white' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-seafoam'}`}>
                <t.Icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {mode === 'complimentary' && picked.kind === 'CLINIC' && (
            summary
              ? <div className="max-w-md"><ComplimentaryTrialCard clinicId={picked.id} clinicName={picked.name} currency={summary.currency} shell={summary.shell}
                  trialEndsAt={summary.trialEndsAt} complimentary={summary.complimentary ?? null} onChanged={() => loadSummary(picked.id)} /></div>
              : <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Loading the clinic's plan…</p>
          )}
          {mode === 'paid' && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-slate-500 dark:text-zinc-400">Record a plan this account paid for outside the app (cash, M-Pesa, bank) — it lands on the books like any payment.</p>
              <button type="button" onClick={() => setPaidOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-pine text-white text-xs font-bold hover:opacity-90"><ReceiptText size={13} /> Record a paid plan</button>
            </div>
          )}
          {mode === 'features' && (
            <p className="text-xs text-slate-500 dark:text-zinc-400">The <b>Grant to one account</b> form below is filled in for {picked.name} — add the feature keys, days and reason there.</p>
          )}
        </div>
      )}

      {paidOpen && picked && (
        <RecordPaidSubscriptionDialog
          ownerKind={picked.kind}
          ownerId={picked.id}
          ownerName={picked.name}
          ownerShell={picked.shell}
          onClose={() => setPaidOpen(false)}
          onGranted={() => { setPaidOpen(false); if (picked.kind === 'CLINIC') loadSummary(picked.id); }}
        />
      )}
    </section>
  );
};

export default GiveAccessPanel;

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, CreditCard, Search } from 'lucide-react';
import { clientsAPI, toast } from '../../../services';
import { dialog } from '../../../services/utils/dialog';

/**
 * Carried-over debts — the bulk end of migration 212.
 *
 * A clinic arriving from another system brings balances that were never billed
 * HERE. They sit on the client as a remembered figure, deliberately outside
 * ageing and every revenue report, until someone actualises them into a real
 * LEGACY invoice. Doing that one client at a time is fine for a handful; the
 * first live migration landed 738 of them, which is why this screen exists.
 *
 * Actualising is a financial act, so nothing here is automatic: you pick the
 * rows, you confirm, and each one raises its own invoice. The server is
 * idempotent per client, so a retry after a partial failure cannot double-bill
 * anyone — which is what makes it safe to run the batch again.
 */
type Row = {
  id: string; name: string; phone?: string | null; code?: string | null;
  amount: number; source?: string | null; asAt?: string | null;
};

const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LegacyDebtsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; of: number; failed: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await clientsAPI.getLegacyBalances();
      const d = res?.data ?? res;
      setRows(d?.clients ?? []);
      setTotal(Number(d?.total ?? 0));
      setPicked(new Set());
    } catch (err: any) {
      toast.error(err?.message || 'Could not load carried-over debts');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.code || '').toLowerCase().includes(q));
  }, [rows, query]);

  const pickedTotal = useMemo(
    () => rows.filter(r => picked.has(r.id)).reduce((n, r) => n + Number(r.amount || 0), 0),
    [rows, picked],
  );

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  /**
   * Raise one invoice per selected client, SEQUENTIALLY.
   *
   * Not parallel on purpose: each call takes an invoice number from a shared
   * counter and writes a bill + invoice, and hammering that concurrently buys
   * nothing but lock contention on a 2-vCPU box. A failure is recorded and the
   * run continues, so one bad row cannot strand the other 737.
   */
  const actualiseSelected = async () => {
    const list = rows.filter(r => picked.has(r.id));
    if (!list.length) return;
    const sum = list.reduce((n, r) => n + Number(r.amount || 0), 0);
    const ok = await dialog.confirm({
      title: `Raise ${list.length} invoice${list.length === 1 ? '' : 's'}?`,
      message:
        `${money(sum)} across ${list.length} client${list.length === 1 ? '' : 's'}.\n\n` +
        `Each will owe their amount in VetHub and it will appear in reports and ageing. ` +
        `Invoices raised in error have to be voided one by one.`,
      confirmLabel: `Raise ${list.length}`,
      variant: 'warning',
    });
    if (!ok) return;

    setRunning(true);
    setProgress({ done: 0, of: list.length, failed: 0 });
    let done = 0, failed = 0;
    for (const r of list) {
      try {
        await clientsAPI.actualiseLegacyBalance(r.id);
        done += 1;
      } catch {
        failed += 1;
      }
      setProgress({ done, of: list.length, failed });
    }
    setRunning(false);
    if (failed) toast.error(`${done} raised, ${failed} failed — the failed ones keep their balance, so you can retry.`);
    else toast.success(`${done} invoice${done === 1 ? '' : 's'} raised`);
    await load();
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
      <Loader2 className="animate-spin" size={16} /> Loading carried-over debts…
    </div>;
  }

  if (!rows.length) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={28} />
        <p className="text-sm font-black text-pine dark:text-zinc-100">No carried-over debts outstanding.</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          Balances appear here after a migration, and disappear once actualised into an invoice.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>{rows.length} clients</strong> carry a balance from a system this clinic migrated off,
            totalling <strong>{money(total)}</strong>. Until you actualise one it is only a remembered
            figure — it is <strong>not</strong> in ageing, the debtors desk, or any revenue report,
            because this clinic never billed it. Actualising raises a real invoice for that client.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search name, phone or code…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
        </div>
        <button onClick={() => setPicked(new Set(shown.map(r => r.id)))}
          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-black uppercase tracking-widest text-pine dark:text-zinc-200">
          Select shown ({shown.length})
        </button>
        <button onClick={() => setPicked(new Set())}
          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-black uppercase tracking-widest text-pine dark:text-zinc-200">
          Clear
        </button>
        <button onClick={load} title="Reload"
          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500"><RefreshCw size={14} /></button>
        <button
          onClick={actualiseSelected}
          disabled={!picked.size || running}
          className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
          {running && progress
            ? `Raising ${progress.done}/${progress.of}${progress.failed ? ` · ${progress.failed} failed` : ''}`
            : `Actualise ${picked.size || ''} ${picked.size ? `· ${money(pickedTotal)}` : ''}`}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900 sticky top-0">
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`border-t border-slate-100 dark:border-zinc-800 cursor-pointer ${picked.has(r.id) ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}>
                  <td className="px-3 py-2"><input type="checkbox" readOnly checked={picked.has(r.id)} /></td>
                  <td className="px-3 py-2 font-bold text-pine dark:text-zinc-100">
                    {r.name}
                    {r.code && <span className="ml-2 text-[10px] font-mono text-slate-400">{r.code}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">{r.phone || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">{r.source || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-black text-amber-600 dark:text-amber-400">{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LegacyDebtsPanel;

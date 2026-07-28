/**
 * Stock take — count the shelf, post the difference.
 *
 * Counting happens while the clinic keeps working, so the sheet saves as you
 * type and only commits when you post. Two rules the UI has to make obvious,
 * because both are destructive if misread:
 *   - a BLANK line is "not counted", not zero — it is skipped at post time;
 *   - posting sets stock to what you counted, and that is not reversible from
 *     here, so the variance is shown before you commit.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Play, Loader2, Check, X, Search, AlertTriangle, History } from 'lucide-react';
import { stockTakesAPI, type StockTake } from '../../../services/modules/stockTakes.api';
import { toast, dialog } from '../../../services';

const fmtWhen = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const StockTakePanel: React.FC = () => {
  const [takes, setTakes] = useState<StockTake[]>([]);
  const [active, setActive] = useState<StockTake | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  /** Local edits, keyed by line id — flushed on save. */
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockTakesAPI.list();
      if (res.success && res.data?.stockTakes) {
        setTakes(res.data.stockTakes);
        setActive(res.data.stockTakes.find((t) => t.status === 'DRAFT') ?? null);
        setDraft({});
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    setBusy(true);
    try {
      const res = await stockTakesAPI.create({});
      if (res.success && res.data?.stockTake) {
        setActive(res.data.stockTake);
        setTakes((p) => [res.data!.stockTake, ...p]);
        toast.success(`${res.data.stockTake.reference} started — ${res.data.stockTake.totalLines} items to count`);
      }
    } finally { setBusy(false); }
  };

  const dirtyLines = useMemo(() => {
    if (!active) return [];
    return Object.entries(draft)
      .filter(([id, v]) => {
        const line = active.items.find((i) => i.id === id);
        if (!line) return false;
        const parsed = v.trim() === '' ? null : Number(v);
        return parsed !== line.countedQty;
      })
      .map(([id, v]) => ({ itemId: id, countedQty: v.trim() === '' ? null : Number(v) }));
  }, [draft, active]);

  const invalid = dirtyLines.filter((l) => l.countedQty != null && (!Number.isFinite(l.countedQty) || l.countedQty < 0));

  const save = async () => {
    if (!active || dirtyLines.length === 0) return;
    if (invalid.length) { toast.error('A counted quantity cannot be negative.'); return; }
    setBusy(true);
    try {
      const res = await stockTakesAPI.saveCounts(active.id, dirtyLines);
      if (res.success && res.data?.stockTake) {
        setActive(res.data.stockTake); setDraft({});
        toast.success(`${dirtyLines.length} count${dirtyLines.length > 1 ? 's' : ''} saved`);
      }
    } finally { setBusy(false); }
  };

  const post = async () => {
    if (!active) return;
    const willAdjust = active.items.filter((i) => i.countedQty != null && i.variance !== 0);
    const uncounted = active.totalLines - active.countedLines;
    const ok = await dialog.confirm({
      title: `Post ${active.reference}?`,
      message:
        `${willAdjust.length} item${willAdjust.length === 1 ? '' : 's'} will be adjusted to the counted figure.` +
        (uncounted > 0 ? ` ${uncounted} line${uncounted === 1 ? '' : 's'} left blank will be untouched.` : '') +
        ' This writes stock adjustments and cannot be undone here.',
      confirmLabel: 'Post counts',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await stockTakesAPI.complete(active.id);
      if (res.success) { toast.success('Stock take posted'); await load(); }
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!active) return;
    const ok = await dialog.confirm({
      title: 'Cancel this stock take?',
      message: 'The counts recorded so far are discarded. No stock is changed.',
      confirmLabel: 'Cancel count', variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try { await stockTakesAPI.cancel(active.id); await load(); toast.success('Stock take cancelled'); }
    finally { setBusy(false); }
  };

  const visible = useMemo(() => {
    if (!active) return [];
    const needle = q.trim().toLowerCase();
    return active.items.filter((i) => !needle || `${i.name ?? ''} ${i.sku ?? ''}`.toLowerCase().includes(needle));
  }, [active, q]);

  const history = takes.filter((t) => t.status !== 'DRAFT').slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
            <ClipboardCheck size={15} /> Stock Take
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Count the shelf, post the difference</p>
        </div>
        {!active && (
          <button onClick={start} disabled={busy || loading}
            className="px-4 py-2.5 rounded-xl bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Start a count
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center text-slate-400 gap-2 text-xs">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : active ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="text-[11px] text-amber-800 dark:text-amber-300">
              <span className="font-black">{active.reference}</span> in progress ·{' '}
              <span className="font-bold">{active.countedLines}</span>/{active.totalLines} counted ·{' '}
              <span className="font-bold">{active.varianceLines}</span> with a variance
            </div>
            <div className="flex items-center gap-2">
              <button onClick={cancel} disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 disabled:opacity-40">
                Cancel
              </button>
              <button onClick={save} disabled={busy || dirtyLines.length === 0}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200 disabled:opacity-40">
                Save {dirtyLines.length > 0 ? `(${dirtyLines.length})` : ''}
              </button>
              <button onClick={post} disabled={busy || active.countedLines === 0}
                className="px-3 py-1.5 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 disabled:opacity-40">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Post counts
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-400">
            Leave a line blank if you didn't count it — blank is skipped, and is not the same as counting zero.
          </p>

          <div className="relative max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="field-input pl-8" placeholder="Find an item…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden max-h-[26rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Item</th>
                  <th className="text-right px-3 py-2 font-semibold">System</th>
                  <th className="text-right px-3 py-2 font-semibold">Counted</th>
                  <th className="text-right px-3 py-2 font-semibold">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {visible.map((i) => {
                  const raw = draft[i.id] ?? (i.countedQty == null ? '' : String(i.countedQty));
                  const parsed = raw.trim() === '' ? null : Number(raw);
                  const variance = parsed == null ? null : parsed - i.expectedQty;
                  const bad = parsed != null && (!Number.isFinite(parsed) || parsed < 0);
                  return (
                    <tr key={i.id} className="text-slate-700 dark:text-zinc-300">
                      <td className="px-3 py-2">
                        <p className="text-xs font-bold truncate">{i.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{i.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{i.expectedQty} <span className="text-slate-400">{i.unit}</span></td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number" min="0" step="0.001" inputMode="decimal"
                          placeholder="—"
                          className={`field-input w-24 text-right py-1.5 ${bad ? 'border-rose-400 text-rose-600' : ''}`}
                          value={raw}
                          onChange={(e) => setDraft((p) => ({ ...p, [i.id]: e.target.value }))}
                        />
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${
                        variance == null ? 'text-slate-300' : variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {variance == null ? '—' : variance > 0 ? `+${variance}` : variance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-10 text-center">
          <ClipboardCheck size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-zinc-300">No count in progress</p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Starting a count snapshots what the system currently believes, so you can walk the
            shelves and post only the differences.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <History size={11} /> Recent counts
          </p>
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
            {history.map((t) => (
              <div key={t.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-zinc-300">{t.reference}</span>
                <span className="text-[11px] text-slate-500 flex items-center gap-2">
                  {t.status === 'CANCELLED'
                    ? <span className="text-slate-400">Cancelled</span>
                    : <>{t.countedLines}/{t.totalLines} counted · {t.varianceLines} adjusted</>}
                  {t.varianceLines > 0 && t.status === 'COMPLETED' && <AlertTriangle size={11} className="text-amber-500" />}
                </span>
                <span className="text-[10px] text-slate-400">{fmtWhen(t.completedAt ?? t.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTakePanel;

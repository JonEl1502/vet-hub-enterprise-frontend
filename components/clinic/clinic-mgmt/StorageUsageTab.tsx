import React from 'react';
import { HardDrive, Loader2, AlertTriangle, Database, Cloud, RefreshCw } from 'lucide-react';
import { clinicSubscriptionAPI, StorageUsage } from '../../../services/modules/clinicSubscription.api';

/**
 * STORAGE USAGE — what the clinic has actually uploaded, against what it pays for.
 *
 * Plans have always quoted a `storage_gb` limit with nothing measuring against
 * it (user, 2026-08-22). This counts every file on the clinic's records, sizes
 * each one, and shows the total against the plan.
 *
 * ⚠️ The headline number is a FLOOR, not a measurement, and the card says so.
 * Files whose size nothing recorded — object-storage URLs saved without
 * `sizeBytes`, which is every patient avatar today — are counted but add 0
 * bytes. Presenting the sum as exact would be the more comfortable lie.
 */

const fmtBytes = (n: number) => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  const v = n / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
};

interface Props { clinicId: number | string }

const StorageUsageTab: React.FC<Props> = ({ clinicId }) => {
  const [data, setData] = React.useState<StorageUsage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    clinicSubscriptionAPI.getStorage(String(clinicId), 25)
      .then(r => { if (r.success && r.data) setData(r.data); else setError('Could not read storage usage.'); })
      .catch(() => setError('Could not read storage usage.'))
      .finally(() => setLoading(false));
  }, [clinicId]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Measuring storage…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{error || 'No data.'}</p>
        <button onClick={() => load()} className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:underline">Retry</button>
      </div>
    );
  }

  const pct = data.limitBytes ? Math.min(100, (data.totalBytes / data.limitBytes) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Headline — used vs plan */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <HardDrive size={11} /> Storage used
            </p>
            <p className="mt-1 text-2xl font-black text-pine dark:text-zinc-100 font-mono">
              {fmtBytes(data.totalBytes)}
              {data.limitGb != null && (
                <span className="text-sm font-bold text-slate-400"> / {data.limitGb} GB</span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
              {data.totalFiles.toLocaleString()} file{data.totalFiles === 1 ? '' : 's'} across the clinic's records
            </p>
          </div>
          <button onClick={() => load(true)} title="Re-measure"
            className="shrink-0 p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-all">
            <RefreshCw size={13} />
          </button>
        </div>

        {pct != null && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-seafoam'}`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-bold text-slate-400">{pct < 0.1 ? 'under 0.1' : pct.toFixed(1)}% of the plan's allowance</p>
          </div>
        )}

        {/* The honesty line. Without it the total reads as exact. */}
        {data.unknownSizeFiles > 0 && (
          <p className="mt-3 text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-relaxed">
            <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />
            {data.unknownSizeFiles} file{data.unknownSizeFiles === 1 ? '' : 's'} {data.unknownSizeFiles === 1 ? 'was' : 'were'} saved
            without a recorded size, so {data.unknownSizeFiles === 1 ? 'it adds' : 'they add'} nothing to this total —
            the real figure is higher.
          </p>
        )}
      </div>

      {/* WHERE it lives. This split is the actionable part: base64 in Postgres
          is not in a bucket, it is in the database, slowing every query that
          reads the column and inflating every backup. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Cloud size={11} /> Object storage
          </p>
          <p className="mt-1 text-lg font-black text-pine dark:text-zinc-100 font-mono">{fmtBytes(data.objectBytes)}</p>
          <p className="text-[10px] font-bold text-slate-400">{data.objectFiles} file{data.objectFiles === 1 ? '' : 's'}</p>
        </div>
        <div className={`rounded-xl border p-3.5 ${
          data.inlineBytes > 0
            ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20'
            : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
        }`}>
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Database size={11} /> Inside the database
          </p>
          <p className="mt-1 text-lg font-black text-pine dark:text-zinc-100 font-mono">{fmtBytes(data.inlineBytes)}</p>
          <p className="text-[10px] font-bold text-slate-400">{data.inlineFiles} file{data.inlineFiles === 1 ? '' : 's'} stored as base64</p>
          {data.inlineBytes > 0 && (
            <p className="mt-1.5 text-[10px] font-bold text-amber-600/90 dark:text-amber-400/90 leading-relaxed">
              These sit in table rows rather than a bucket — they slow every query that reads the record
              and are copied into every backup.
            </p>
          )}
        </div>
      </div>

      {/* Per source */}
      {data.bySource.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <p className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-zinc-800">Where it comes from</p>
          {data.bySource.map(s => (
            <div key={s.source} className="px-4 py-2 flex items-center justify-between gap-3 border-b border-slate-50 dark:border-zinc-800/50 last:border-0">
              <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{s.source}</span>
              <span className="shrink-0 flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400">{s.files} file{s.files === 1 ? '' : 's'}</span>
                <span className="text-[11px] font-black font-mono text-pine dark:text-zinc-100 w-20 text-right">{fmtBytes(s.bytes)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Per file — the biggest first, which is what you act on. */}
      {data.largest.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <p className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-zinc-800">
            Largest files · top {data.largest.length}
          </p>
          <div className="max-h-80 overflow-y-auto">
            {data.largest.map((f, i) => (
              <div key={`${f.source}-${f.recordId}-${i}`} className="px-4 py-2 flex items-center justify-between gap-3 border-b border-slate-50 dark:border-zinc-800/50 last:border-0">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">
                    {f.label || f.kind || 'Untitled file'}
                  </span>
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 truncate">
                    {f.source} · #{f.recordId}
                    {f.inline && <span className="text-amber-600 dark:text-amber-400"> · in database</span>}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-black font-mono text-pine dark:text-zinc-100">
                  {f.bytes > 0 ? fmtBytes(f.bytes) : <span className="text-slate-300">size unknown</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totalFiles === 0 && (
        <p className="text-[11px] font-bold text-slate-400 p-4">No files uploaded on this clinic's records yet.</p>
      )}
    </div>
  );
};

export default StorageUsageTab;

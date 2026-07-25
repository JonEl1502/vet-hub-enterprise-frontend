import React from 'react';
import toast from 'react-hot-toast';
import { ReceiptText, Loader2, RefreshCw, History, AlertTriangle } from 'lucide-react';
import { billsAPI } from '../../../services';
import { BillQueueRow } from '../../../services/modules/bills.api';
import { useClinic } from '../../../contexts/ClinicContext';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Bills — the reception worklist (Revenue Cycle P1).
 *
 * Bills the vet has raised or approved, waiting to become invoices (P2).
 * Also the home of the admin backfill: visits from before the Bill entity
 * existed have no bill, so the queue and the future ledgers would be blind to
 * everything before today.
 */

const money = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-seafoam/15 text-seafoam',
  ISSUED: 'bg-amber-100 text-amber-700',
  INVOICED: 'bg-indigo-100 text-indigo-700',
  PAID: 'bg-emerald-100 text-emerald-700',
};

interface Props { onOpenVisit?: (visitId: number) => void }

const BillsQueuePage: React.FC<Props> = ({ onOpenVisit }) => {
  const { selectedClinics } = useClinic();
  const { user } = useAuth();
  const currency = (selectedClinics[0] as any)?.currency || 'KES';
  const canBackfill = ['SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER'].includes(String(user?.role));

  const [rows, setRows] = React.useState<BillQueueRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await billsAPI.list();
      if (res.success && res.data?.bills) setRows(res.data.bills);
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // Count first, then confirm — a backfill writes a row per historic visit and
  // there is no single-click undo.
  const backfill = async () => {
    setBusy(true);
    try {
      const preview = await billsAPI.backfill({ dryRun: true });
      const eligible = preview.data?.eligible ?? 0;
      if (!eligible) { toast.success('Nothing to backfill — every visit already has a bill.'); return; }
      const ok = confirm(
        `Backfill ${eligible} historic visit${eligible === 1 ? '' : 's'} (${money(preview.data?.totalValue ?? 0, currency)})?\n\n` +
        `A bill is created from what was already charged. They are flagged as backfilled — no vet reviewed them at the time of care.\n\n` +
        `Paid visits land APPROVED; unpaid ones land DRAFT. Visits that already have a bill are skipped.`,
      );
      if (!ok) return;
      const res = await billsAPI.backfill({ limit: 500 });
      toast.success(`Backfilled ${res.data?.created ?? 0} bill(s)`);
      await load();
    } catch (e: any) { toast.error(e?.message || 'Backfill failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-seafoam/10 flex items-center justify-center">
            <ReceiptText size={22} className="text-seafoam" />
          </div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Bills</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Raised by the vet at End Encounter — review and invoice</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={loading}
            className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 shadow-sm flex items-center gap-1.5">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
          {canBackfill && (
            <button type="button" onClick={backfill} disabled={busy}
              title="Create bills for visits that predate the Bill entity"
              className="compact-button bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 shadow-sm flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <History size={12} />} Backfill historic bills
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 size={20} className="animate-spin text-seafoam" /></div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-zinc-600">No results</p>
            <p className="text-[11px] text-slate-400 mt-1">No bills are waiting. They appear here once a vet raises one at End Encounter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-zinc-950">
                <tr className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-2.5">Bill</th>
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5 w-24">Status</th>
                  <th className="px-3 py-2.5 w-16 text-right">Lines</th>
                  <th className="px-4 py-2.5 w-32 text-right">Total</th>
                  <th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {rows.map(b => (
                  <tr key={b.id} className="text-[11px] hover:bg-slate-50/60 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-2.5">
                      <span className="font-black text-pine dark:text-zinc-100">{b.number ?? `#${b.id}`}</span>
                      {b.isSynthetic && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-amber-600" title="Backfilled — not reviewed at the time of care">
                          <AlertTriangle size={9} /> backfilled
                        </span>
                      )}
                      <span className="block text-[9px] font-bold text-slate-400">
                        {b.visitDate ? new Date(b.visitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-pine dark:text-zinc-100">{b.patient?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-zinc-400">{b.client?.name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${STATUS_CLS[b.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500 dark:text-zinc-400">{b.lineCount}</td>
                    <td className="px-4 py-2.5 text-right font-black font-mono text-pine dark:text-zinc-100">{money(b.total, currency)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {onOpenVisit && (
                        <button onClick={() => onOpenVisit(Number(b.visitId))}
                          className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70">Open →</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillsQueuePage;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, Check, AlertTriangle, ExternalLink, Search } from 'lucide-react';
import { clientsAPI, toast, dialog } from '../../../services';

/**
 * Reconciling a carried-over balance against the documents behind it (221).
 *
 * A migrated client arrives owing one opaque number — the balance the old
 * system's debtors report said. This panel shows the INVOICES that number is
 * made of, and lets the owner raise a real VetHub invoice for a **selection**
 * of them.
 *
 * ⚠️ Why selection, not all-or-nothing. A balance is usually older than any
 * history imported: on Westlands Paws, 5 of the top 10 debtors had **zero**
 * visits in the imported window — their debt entirely predates it. Forcing the
 * whole balance would make staff raise an invoice for money they cannot yet
 * explain to the client.
 *
 * Listing these does NOT make them receivable. They become real money only when
 * someone actualises them here.
 */

interface LegacyInvoice {
  id: string;
  sourceRef: string;
  issuedAt: string | null;
  status: string | null;
  detail: string | null;
  total: number;
  paid: number;
  balance: number;
  actualised: boolean;
  actualisedInvoiceNumber: string | null;
  matchedVisitId: string | null;
  matchedVisitAt: string | null;
}

interface Props {
  clientId: number | string;
  clientName: string;
  currency?: string;
  /** Refresh the parent once money has been raised. */
  onActualised?: () => void;
  onOpenVisit?: (visitId: string) => void;
}

const LegacyReconcilePanel: React.FC<Props> = ({ clientId, clientName, currency = 'KES', onActualised, onOpenVisit }) => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [showActualised, setShowActualised] = useState(false);

  const money = (n: number) => `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await clientsAPI.legacyInvoices(clientId);
      setData(res?.data ?? res);
      setPicked(new Set());
    } catch (e: any) {
      toast.error(e?.message || 'Could not load the carried-over invoices');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const rows: LegacyInvoice[] = data?.invoices ?? [];

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter(r => showActualised || !r.actualised)
      .filter(r => !needle || `${r.sourceRef} ${r.detail ?? ''} ${r.status ?? ''}`.toLowerCase().includes(needle));
  }, [rows, q, showActualised]);

  /**
   * ⚠️ Render a WINDOW, not the whole list.
   *
   * The heaviest real client (Jane Kanyotu, Westlands) carries **1,680** legacy
   * documents. Painting 1,680 selectable rows makes the panel crawl and is
   * useless to scan anyway. Filter first, then select — "Select N" acts on
   * everything the FILTER matches, not just what is painted, so bulk selection
   * still reaches rows below the cut.
   */
  const RENDER_CAP = 200;
  const shown = visible.slice(0, RENDER_CAP);

  const pickedTotal = useMemo(
    () => rows.filter(r => picked.has(r.id)).reduce((t, r) => t + Number(r.balance || 0), 0),
    [rows, picked],
  );

  const toggle = (id: string) => setPicked(p => {
    const next = new Set(p);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectableVisible = visible.filter(r => !r.actualised && r.balance > 0);
  const allVisiblePicked = selectableVisible.length > 0 && selectableVisible.every(r => picked.has(r.id));

  const actualise = async () => {
    if (!picked.size) return;
    const ok = await dialog.confirm({
      title: `Raise ${money(pickedTotal)}?`,
      message:
        `${picked.size} carried-over invoice${picked.size === 1 ? '' : 's'} for ${clientName}.\n\n` +
        `One VetHub invoice will be raised for ${money(pickedTotal)}. From then on it behaves like any ` +
        `other invoice — payable, settleable, and counted in reports and ageing. ` +
        `The rest of the carried-over balance stays as it is.\n\n` +
        `An invoice raised in error has to be voided; it cannot be undone from here.`,
      confirmLabel: `Raise ${money(pickedTotal)}`,
      variant: 'warning',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res: any = await clientsAPI.actualiseLegacyInvoices(clientId, [...picked]);
      const d = res?.data ?? res;
      toast.success(d?.invoiceNumber ? `Invoice ${d.invoiceNumber} raised` : 'Invoice raised');
      await load();
      onActualised?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Could not raise the invoice');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-seafoam" /></div>;
  }
  if (!rows.length) {
    return (
      <p className="text-[11px] text-slate-400 py-6 text-center">
        No carried-over invoices on file for {clientName}.
      </p>
    );
  }

  // The carried-over figure and what the documents say are two independent
  // numbers. Show BOTH when they disagree rather than averaging the difference
  // away — on Westlands 90% match to the shilling and 10% do not, and that gap
  // is usually a payment taken after the snapshot.
  const drift = Math.round((Number(data.openTotal || 0) - Number(data.balance || 0)) * 100) / 100;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Carried over</p>
          <p className="text-xl font-black text-pine dark:text-zinc-100">{money(data.balance)}</p>
          {data.balanceSource && <p className="text-[9px] font-bold text-slate-400">from {data.balanceSource}</p>}
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Documents outstanding</p>
          <p className="text-xl font-black text-pine dark:text-zinc-100">{money(data.openTotal)}</p>
          <p className="text-[9px] font-bold text-slate-400">{data.openCount} open of {rows.length}</p>
        </div>
        {Math.abs(drift) > 0.5 && (
          <p className="flex items-start gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 max-w-xs">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            The documents differ from the carried-over figure by {money(Math.abs(drift))} — usually a
            payment taken after the balance was captured.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search invoice no or detail…"
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
          />
        </div>
        <button type="button" onClick={() => setShowActualised(v => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${showActualised
            ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine'
            : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-700'}`}>
          {showActualised ? 'Hiding none' : 'Show actualised'}
        </button>
        <button type="button"
          onClick={() => setPicked(p => allVisiblePicked ? new Set() : new Set(selectableVisible.map(r => r.id)))}
          disabled={!selectableVisible.length}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-700 text-slate-500 disabled:opacity-40">
          {allVisiblePicked ? 'Clear' : `Select ${selectableVisible.length}`}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
          {shown.map(r => {
            const on = picked.has(r.id);
            return (
              <label key={r.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                  r.actualised ? 'opacity-55' : on ? 'bg-seafoam/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'}`}>
                <input
                  type="checkbox"
                  className="accent-seafoam shrink-0"
                  checked={on}
                  disabled={r.actualised || !(r.balance > 0)}
                  onChange={() => toggle(r.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black text-pine dark:text-zinc-100 truncate">
                    {r.sourceRef}
                    {r.actualised && (
                      <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                        <Check size={9} className="inline -mt-0.5" /> {r.actualisedInvoiceNumber || 'raised'}
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate">
                    {r.issuedAt
                      ? new Date(r.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : <span className="text-amber-600 font-bold">no date on file</span>}
                    {r.status ? ` · ${r.status}` : ''}
                    {r.detail ? ` · ${r.detail}` : ''}
                  </span>
                </span>
                {/* The visit this document already exists as, when we imported
                    one — the bridge between the money and the clinical record. */}
                {r.matchedVisitId && (
                  <button
                    type="button"
                    title="Open the imported visit for this invoice"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onOpenVisit?.(r.matchedVisitId!); }}
                    className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider text-seafoam border border-seafoam/40 hover:bg-seafoam hover:text-white transition-colors"
                  >
                    <ExternalLink size={9} /> Visit
                  </button>
                )}
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-black text-pine dark:text-zinc-100">{money(r.balance)}</span>
                  {r.paid > 0 && <span className="block text-[9px] text-slate-400">{money(r.paid)} paid of {money(r.total)}</span>}
                </span>
              </label>
            );
          })}
          {!visible.length && (
            <p className="px-3 py-6 text-[11px] text-slate-400 text-center">No invoices match.</p>
          )}
          {visible.length > RENDER_CAP && (
            <p className="px-3 py-2 text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-zinc-800/50">
              Showing {RENDER_CAP} of {visible.length}. Narrow with search — <strong>Select {selectableVisible.length}</strong> still
              covers every match, not just those listed.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
          {picked.size
            ? <>Selected <strong className="text-pine dark:text-zinc-100">{picked.size}</strong> · <strong className="text-pine dark:text-zinc-100">{money(pickedTotal)}</strong></>
            : 'Select invoices to raise them as a real VetHub invoice.'}
        </p>
        <button
          type="button"
          onClick={actualise}
          disabled={!picked.size || busy}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-pine text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          Actualise selected
        </button>
      </div>
    </div>
  );
};

export default LegacyReconcilePanel;

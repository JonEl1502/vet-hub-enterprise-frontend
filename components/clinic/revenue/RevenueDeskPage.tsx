import React from 'react';
import toast from 'react-hot-toast';
import {
  ReceiptText, RefreshCw, Search, FileText, Loader2, AlertTriangle,
  CircleDollarSign, Clock, CheckCircle2, Ban, ArrowRight, X,
} from 'lucide-react';
import PageHeader from '../../shared/common/PageHeader';
import { useClinic } from '../../../contexts/ClinicContext';
import { invoicesAPI } from '../../../services';
import revenueDeskAPI, {
  type DeskBillRow, type DeskInvoiceRow, type DeskBillStats, type DeskInvoiceStats,
} from '../../../services/modules/revenueDesk.api';

/**
 * Revenue Desk — the whole bill ⇒ invoice pipeline on one page.
 *
 * Two documents, one worklist. The tabs ARE the states, because the states are
 * the only question the front desk actually asks: what is still running, what
 * is finalized and waiting for a signature, what is approved and needs a
 * document raising, what has been invoiced, and what is still owed.
 *
 * ⚠️ **Every hook is declared above every early return.** This page's two
 * neighbours (`BillingView`, `BillPanel`) both shipped a hooks-after-early-return
 * that crashed them at runtime with a clean `tsc` — see the board, 2026-08-05.
 * There are no early returns in here at all; loading and empty are rendered as
 * states of the same tree.
 *
 * ⚠️ Rows are fetched ONCE per (document, window, search) with `status=ALL` and
 * filtered into tabs client-side, so switching tabs costs nothing. Tab COUNTS
 * come from the server's `byStatus`, which is aggregated over the whole window
 * rather than the fetched page — when the two disagree the page says so rather
 * than quietly under-reporting.
 */

// ── shape ────────────────────────────────────────────────────────────────────

type Doc = 'bills' | 'invoices';

interface TabDef {
  id: string;
  label: string;
  /** Which server states this tab shows. Empty ⇒ everything. */
  states: string[];
  /** Overdue is DERIVED (a due date in the past), not a status. */
  derived?: (r: DeskInvoiceRow) => boolean;
  tone?: 'warn' | 'good' | 'bad' | 'muted';
}

/**
 * Bill tabs, in pipeline order and named the way the desk says them —
 * "running" is DRAFT (charges still accruing on an open visit) and "finalized,
 * pending approval" is PENDING_REVIEW (the vet has ended the encounter and
 * someone still has to sign it off).
 */
const BILL_TABS: TabDef[] = [
  { id: 'all',       label: 'All',                 states: [] },
  { id: 'running',   label: 'Running',             states: ['DRAFT'] },
  { id: 'pending',   label: 'Pending approval',    states: ['PENDING_REVIEW'], tone: 'warn' },
  { id: 'approved',  label: 'Approved',            states: ['APPROVED'], tone: 'good' },
  { id: 'issued',    label: 'Quoted',              states: ['ISSUED'] },
  { id: 'invoiced',  label: 'Invoiced',            states: ['INVOICED'] },
  { id: 'settled',   label: 'Settled',             states: ['PAID', 'RECONCILED'], tone: 'good' },
  { id: 'void',      label: 'Void',                states: ['VOID'], tone: 'muted' },
];

const INVOICE_TABS: TabDef[] = [
  { id: 'all',      label: 'All',        states: [] },
  { id: 'open',     label: 'Open',       states: ['OPEN'], tone: 'warn' },
  { id: 'partial',  label: 'Part paid',  states: ['PARTIAL'], tone: 'warn' },
  { id: 'overdue',  label: 'Overdue',    states: ['OPEN', 'PARTIAL'], derived: (r) => r.overdue, tone: 'bad' },
  { id: 'paid',     label: 'Paid',       states: ['PAID'], tone: 'good' },
  { id: 'void',     label: 'Void',       states: ['VOID'], tone: 'muted' },
];

const WINDOWS = [
  { days: 30,        label: '30 days' },
  { days: 90,        label: '90 days' },
  { days: 365,       label: '12 months' },
  { days: undefined, label: 'All time' },
] as const;

const STATUS_CLS: Record<string, string> = {
  DRAFT:          'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED:       'bg-seafoam/15 text-seafoam',
  ISSUED:         'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  INVOICED:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  PAID:           'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  RECONCILED:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  VOID:           'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  OPEN:           'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PARTIAL:        'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

const TONE_TEXT: Record<string, string> = {
  warn:  'text-amber-600 dark:text-amber-400',
  bad:   'text-rose-600 dark:text-rose-400',
  good:  'text-emerald-600 dark:text-emerald-400',
  muted: 'text-slate-400 dark:text-zinc-500',
};

// ── small presentational pieces ──────────────────────────────────────────────

const StatTile: React.FC<{
  label: string; value: string; sub?: string; tone?: 'warn' | 'bad' | 'good';
}> = ({ label, value, sub, tone }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 min-w-0">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">{label}</p>
    <p className={`mt-1 text-lg font-black tabular-nums truncate ${tone ? TONE_TEXT[tone] : 'text-pine dark:text-zinc-100'}`}>
      {value}
    </p>
    {sub && <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 truncate">{sub}</p>}
  </div>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${
    STATUS_CLS[status] || STATUS_CLS.DRAFT
  }`}>
    {status.replace(/_/g, ' ')}
  </span>
);

// ── page ─────────────────────────────────────────────────────────────────────

interface Props { onOpenVisit?: (visitId: number) => void }

const RevenueDeskPage: React.FC<Props> = ({ onOpenVisit }) => {
  const { selectedClinics } = useClinic();
  const currency = (selectedClinics[0] as any)?.currency || 'KES';
  const multiClinic = selectedClinics.length > 1;

  const money = React.useCallback(
    (n: number) => `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    [currency],
  );

  const [doc, setDoc] = React.useState<Doc>('bills');
  const [tab, setTab] = React.useState('all');
  const [days, setDays] = React.useState<number | undefined>(90);
  const [search, setSearch] = React.useState('');
  // Debounced copy — the input stays instant while the fetch waits for a pause.
  const [query, setQuery] = React.useState('');

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [billRows, setBillRows] = React.useState<DeskBillRow[]>([]);
  const [billStats, setBillStats] = React.useState<DeskBillStats | null>(null);
  const [invRows, setInvRows] = React.useState<DeskInvoiceRow[]>([]);
  const [invStats, setInvStats] = React.useState<DeskInvoiceStats | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { status: 'ALL', days, search: query || undefined, limit: 500 };
      // Both documents in one pass: the tiles for one are read while the other
      // is on screen, and the pair is what makes the pipeline legible.
      const [b, i] = await Promise.all([
        revenueDeskAPI.bills(params),
        revenueDeskAPI.invoices(params),
      ]);
      if (b.success && b.data) { setBillRows(b.data.rows || []); setBillStats(b.data.stats || null); }
      if (i.success && i.data) { setInvRows(i.data.rows || []); setInvStats(i.data.stats || null); }
    } catch (e: any) {
      setError(e?.message || 'Could not load the revenue desk');
    } finally {
      setLoading(false);
    }
  }, [days, query]);

  React.useEffect(() => { load(); }, [load]);

  // Switching document resets to All — a bill tab id means nothing on invoices.
  const switchDoc = React.useCallback((next: Doc) => { setDoc(next); setTab('all'); }, []);

  const tabs = doc === 'bills' ? BILL_TABS : INVOICE_TABS;
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  /**
   * Counts come from the server aggregate (whole window) EXCEPT Overdue, which
   * needs a per-row due date and so can only be counted over what was fetched.
   */
  const countFor = React.useCallback((t: TabDef): number => {
    if (t.derived) return invRows.filter((r) => t.states.includes(r.status) && t.derived!(r)).length;
    const by = (doc === 'bills' ? billStats?.byStatus : invStats?.byStatus) || {};
    const states = t.states.length
      ? t.states
      : Object.keys(by);
    return states.reduce((a, s) => a + (by[s]?.count ?? 0), 0);
  }, [doc, billStats, invStats, invRows]);

  const visibleBills = React.useMemo(
    () => (active.states.length ? billRows.filter((r) => active.states.includes(r.status)) : billRows),
    [billRows, active],
  );

  const visibleInvoices = React.useMemo(() => {
    let rows = active.states.length ? invRows.filter((r) => active.states.includes(r.status)) : invRows;
    if (active.derived) rows = rows.filter(active.derived);
    return rows;
  }, [invRows, active]);

  // The server aggregates the whole window but returns at most 500 rows. Say so
  // rather than letting a tab quietly show fewer than its own count.
  const truncated = doc === 'bills'
    ? !!billStats && billRows.length < billStats.totalCount
    : !!invStats && invRows.length < invStats.totalCount;

  const generateInvoice = React.useCallback(async (row: DeskBillRow) => {
    setBusyId(row.id);
    try {
      const res = await invoicesAPI.generate(row.visitId);
      toast.success(`Invoice ${res.data?.invoice?.number ?? ''} raised${row.number ? ` from ${row.number}` : ''}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not raise the invoice');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const openVisit = React.useCallback((visitId?: string | null) => {
    if (visitId && onOpenVisit) onOpenVisit(Number(visitId));
  }, [onOpenVisit]);

  const fmtDate = React.useCallback(
    (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' }) : '—'),
    [],
  );

  const bs = billStats;
  const is = invStats;
  const rowCount = doc === 'bills' ? visibleBills.length : visibleInvoices.length;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title="Bills & Invoices"
        subtitle="The whole pipeline — what is running, what needs approving, what has been invoiced and what is still owed"
        icon={ReceiptText}
        onBack
        actions={(
          <div className="flex items-center gap-2">
            <select
              value={days ?? ''}
              onChange={(e) => setDays(e.target.value ? Number(e.target.value) : undefined)}
              className="field-select !py-1.5 !text-[11px] !w-auto"
              aria-label="Time window"
            >
              {WINDOWS.map((w) => (
                <option key={w.label} value={w.days ?? ''}>{w.label}</option>
              ))}
            </select>
            <button
              type="button" onClick={load} disabled={loading}
              className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 shadow-sm flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
            </button>
          </div>
        )}
      />

      {/* ── document switch ─────────────────────────────────────────────── */}
      <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/60">
        {([
          { id: 'bills' as Doc, label: 'Bills', count: bs?.totalCount },
          { id: 'invoices' as Doc, label: 'Invoices', count: is?.totalCount },
        ]).map((d) => (
          <button
            key={d.id} type="button" onClick={() => switchDoc(d.id)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              doc === d.id
                ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
            }`}
          >
            {d.label}
            {d.count != null && <span className="ml-1.5 tabular-nums opacity-60">{d.count}</span>}
          </button>
        ))}
      </div>

      {/* ── stats ───────────────────────────────────────────────────────── */}
      {doc === 'bills' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatTile
            label="Needs action" value={String(bs?.needsActionCount ?? 0)}
            sub={money(bs?.needsActionAmount ?? 0)} tone={bs?.needsActionCount ? 'warn' : undefined}
          />
          <StatTile
            label="Pending approval" value={String(bs?.byStatus?.PENDING_REVIEW?.count ?? 0)}
            sub={money(bs?.byStatus?.PENDING_REVIEW?.amount ?? 0)}
            tone={bs?.byStatus?.PENDING_REVIEW?.count ? 'warn' : undefined}
          />
          <StatTile
            label="Approved · to invoice" value={String(bs?.awaitingInvoiceCount ?? 0)}
            sub={money(bs?.awaitingInvoiceAmount ?? 0)}
          />
          <StatTile
            label="Invoiced" value={String(bs?.byStatus?.INVOICED?.count ?? 0)}
            sub={money(bs?.byStatus?.INVOICED?.amount ?? 0)}
          />
          <StatTile label="Total billed" value={money(bs?.totalAmount ?? 0)} sub={`${bs?.totalCount ?? 0} bills`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatTile
            label="Outstanding" value={money(is?.outstandingAmount ?? 0)}
            sub="Open + part paid" tone={is?.outstandingAmount ? 'warn' : undefined}
          />
          <StatTile
            label="Overdue" value={String(is?.overdueCount ?? 0)}
            sub={money(is?.overdueAmount ?? 0)} tone={is?.overdueCount ? 'bad' : undefined}
          />
          <StatTile label="Collected" value={money(is?.collectedAmount ?? 0)} sub="Against these invoices" tone="good" />
          <StatTile
            label="Paid in full" value={String(is?.byStatus?.PAID?.count ?? 0)}
            sub={money(is?.byStatus?.PAID?.amount ?? 0)}
          />
          <StatTile label="Total invoiced" value={money(is?.totalAmount ?? 0)} sub={`${is?.totalCount ?? 0} invoices`} />
        </div>
      )}

      {/* Every figure above is scoped to the chosen window — say so, so
          "Outstanding" is never read as the all-time receivables balance. */}
      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 -mt-2">
        {days ? `Last ${days === 365 ? '12 months' : `${days} days`}` : 'All time'}
        {query ? ` · matching "${query}"` : ''}
        {multiClinic ? ` · ${selectedClinics.length} clinics combined` : ''}
        {doc === 'invoices' ? ' · outstanding here covers this window only — Receivables holds the all-time balance' : ''}
      </p>

      {/* ── status tabs + search ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/60 gap-0.5">
            {tabs.map((t) => {
              const n = countFor(t);
              const on = t.id === active.id;
              return (
                <button
                  key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    on
                      ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 tabular-nums ${on && t.tone ? TONE_TEXT[t.tone] : 'opacity-60'}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient, client or number…"
            className="field-input !pl-8 !pr-8 !py-2 !text-[12px]"
          />
          {search && (
            <button
              type="button" onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {truncated && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40">
          <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
            The tab counts cover the whole window; the table shows the most recent 500.
            Narrow the window or search to see the rest.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40">
          <AlertTriangle size={13} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* ── table ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 dark:bg-zinc-800/50">
              <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                <th className="text-left px-4 py-3">{doc === 'bills' ? 'Bill' : 'Invoice'}</th>
                <th className="text-left px-4 py-3">Patient</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Client</th>
                <th className="text-left px-4 py-3">Status</th>
                {doc === 'bills' ? (
                  <>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Lines</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </>
                ) : (
                  <>
                    <th className="text-right px-4 py-3 hidden lg:table-cell">Total</th>
                    <th className="text-right px-4 py-3">Paid</th>
                    <th className="text-right px-4 py-3">Outstanding</th>
                  </>
                )}
                <th className="text-left px-4 py-3 hidden sm:table-cell">{doc === 'bills' ? 'Raised' : 'Issued'}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {loading && rowCount === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <Loader2 size={18} className="animate-spin text-seafoam mx-auto" />
                  </td>
                </tr>
              )}

              {!loading && rowCount === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <FileText size={20} className="text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Nothing {active.id === 'all' ? 'here' : `is ${active.label.toLowerCase()}`}
                    </p>
                  </td>
                </tr>
              )}

              {doc === 'bills' && visibleBills.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openVisit(r.visitId)}
                  className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 whitespace-nowrap">
                      {r.number || `Visit #${r.visitId}`}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                      {r.isSynthetic ? 'Backfilled · ' : ''}
                      {r.encounterType ? r.encounterType.replace(/_/g, ' ').toLowerCase() : `visit ${r.visitId}`}
                      {multiClinic && r.clinicName ? ` · ${r.clinicName}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate max-w-[140px]">
                      {r.patient?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate max-w-[160px]">
                      {r.client?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[11px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums">
                    {r.lineCount}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] font-black text-pine dark:text-zinc-100 tabular-nums whitespace-nowrap">
                    {money(r.total)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-[10px] font-bold text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                    {fmtDate(r.raisedAt || r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === 'APPROVED' ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); generateInvoice(r); }}
                        disabled={busyId === r.id}
                        className="compact-button bg-seafoam text-white shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                        Invoice
                      </button>
                    ) : (
                      <ArrowRight size={13} className="text-slate-300 dark:text-zinc-700 inline" />
                    )}
                  </td>
                </tr>
              ))}

              {doc === 'invoices' && visibleInvoices.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openVisit(r.visitId)}
                  className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 whitespace-nowrap">
                      {r.number || `Invoice #${r.id}`}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                      {r.billNumber || 'no bill number'}
                      {r.scope && r.scope !== 'FULL' ? ` · ${r.scope.toLowerCase()}` : ''}
                      {multiClinic && r.clinicName ? ` · ${r.clinicName}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate max-w-[140px]">
                      {r.patient?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate max-w-[160px]">
                      {r.client?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={r.status} />
                      {r.overdue && (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                          <Clock size={9} /> Overdue
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-right text-[11px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                    {money(r.total)}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                    {r.amountPaid ? money(r.amountPaid) : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right text-[11px] font-black tabular-nums whitespace-nowrap ${
                    r.outstanding ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-zinc-700'
                  }`}>
                    {r.status === 'VOID' ? '—' : money(r.outstanding)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-[10px] font-bold text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                    {fmtDate(r.issuedAt)}
                    {r.dueDate && <span className="block opacity-70">due {fmtDate(r.dueDate)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'VOID'
                      ? <Ban size={13} className="text-slate-300 dark:text-zinc-700 inline" />
                      : r.status === 'PAID'
                        ? <CheckCircle2 size={13} className="text-emerald-500 inline" />
                        : <ArrowRight size={13} className="text-slate-300 dark:text-zinc-700 inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            {rowCount} {doc === 'bills' ? (rowCount === 1 ? 'bill' : 'bills') : (rowCount === 1 ? 'invoice' : 'invoices')}
          </p>
          <p className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500">
            <CircleDollarSign size={11} /> Click a row to open the visit
          </p>
        </div>
      </div>
    </div>
  );
};

export default RevenueDeskPage;

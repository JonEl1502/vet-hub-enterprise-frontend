import React from 'react';
import toast from 'react-hot-toast';
import {
  Wallet, FileText, CreditCard, TrendingUp, CircleDollarSign, Filter, CalendarRange,
  ChevronDown, Eye, MoreVertical, Loader2, X, Plus, RotateCcw, HandCoins, Tag,
  ScrollText, Mail, Banknote, Pencil, FolderOpen, PiggyBank, Trash2,
} from 'lucide-react';
import { Client } from '../../../types';
import { clientsAPI, uploadsAPI } from '../../../services';
import { ClientBilling, ClientAttachment } from '../../../services/modules/clients.api';

/**
 * Client → Payments tab, account-hub layout (user reference design, 2026-08-02).
 *
 * Read-only view over the same `/clients/:id/billing` money the collect flow
 * uses: stat cards, a merged account timeline (invoices + payments), a donut
 * account summary, payment information and quick actions. Collection itself
 * stays on the Invoices tab (`ClientPaymentsTab`) — the quick actions jump
 * there rather than duplicating the allocation flow.
 */

interface Props {
  client: Client;
  billing: ClientBilling | null;
  credit: number;
  loading: boolean;
  currency: string;
  canCollect: boolean;
  onRefresh: () => void;
  onViewVisit?: (visitId: number) => void;
  onGoTab: (tab: string) => void;
}

const money = (n: number, c: string) =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

type TimelineKind = 'INVOICE' | 'PAYMENT' | 'CREDIT' | 'REFUND';

interface TimelineEntry {
  key: string;
  kind: TimelineKind;
  date: string;
  title: string;
  desc: string;
  ref: string;
  amount: number;
  status: 'PAID' | 'UNPAID' | 'PARTIAL' | 'VOIDED' | 'CREDIT';
  visitId?: number;
}

const KIND_STYLE: Record<TimelineKind, { label: string; text: string; chip: string }> = {
  INVOICE: { label: 'Invoice', text: 'text-indigo-600 dark:text-indigo-400', chip: 'bg-indigo-500/10 text-indigo-500' },
  PAYMENT: { label: 'Payment', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-500' },
  CREDIT: { label: 'Credit Note', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-500/10 text-amber-500' },
  REFUND: { label: 'Refund / Void', text: 'text-rose-600 dark:text-rose-400', chip: 'bg-rose-500/10 text-rose-500' },
};

const STATUS_BADGE: Record<TimelineEntry['status'], string> = {
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  UNPAID: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  PARTIAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  VOIDED: 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700',
  CREDIT: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

const PAGE = 8;

const ClientAccountHub: React.FC<Props> = ({
  client, billing, credit, loading, currency, canCollect, onRefresh, onViewVisit, onGoTab,
}) => {
  const [filter, setFilter] = React.useState<'ALL' | TimelineKind>('ALL');
  const [shown, setShown] = React.useState(PAGE);
  const [newTxOpen, setNewTxOpen] = React.useState(false);

  // Record-advance dialog — same endpoint the Invoices tab uses.
  const [advanceOpen, setAdvanceOpen] = React.useState(false);
  const [advanceAmt, setAdvanceAmt] = React.useState('');
  const [advanceMethod, setAdvanceMethod] = React.useState('CASH');
  const [advanceBusy, setAdvanceBusy] = React.useState(false);

  const invoices = billing?.invoices ?? [];
  const payments = billing?.payments ?? [];

  const outstanding = billing?.outstanding ?? client.outstandingBalance ?? 0;
  const openCount = invoices.filter(i => !i.isPaid).length;

  const yearAgo = React.useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.getTime();
  }, []);
  const invoiced12 = invoices.filter(i => new Date(i.date).getTime() >= yearAgo)
    .reduce((s, i) => s + (i.total || 0), 0);
  const paid12 = payments.filter(p => p.status !== 'VOIDED' && new Date(p.settledAt || p.createdAt).getTime() >= yearAgo)
    .reduce((s, p) => s + (p.amount || 0), 0);

  const invoicedAll = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const paidAll = payments.filter(p => p.status !== 'VOIDED').reduce((s, p) => s + (p.amount || 0), 0);
  const reliability = invoicedAll > 0 ? Math.min(100, Math.round((paidAll / invoicedAll) * 100)) : null;
  const reliabilityLabel = reliability == null ? 'No history'
    : reliability >= 90 ? 'Excellent' : reliability >= 70 ? 'Good' : reliability >= 50 ? 'Fair' : 'Poor';

  const entries = React.useMemo<TimelineEntry[]>(() => {
    const rows: TimelineEntry[] = [
      ...invoices.map((inv): TimelineEntry => ({
        key: `inv-${inv.visitId}`,
        kind: 'INVOICE',
        date: inv.date,
        title: 'Invoice',
        desc: `Visit #${inv.visitId}${inv.pet ? ` — ${inv.pet.name}` : ''}${
          inv.encounterType ? ` · ${String(inv.encounterType).replace(/_/g, ' ').toLowerCase()}` : ''}`,
        ref: inv.invoices?.[0]?.number || `VISIT-${inv.visitId}`,
        amount: inv.total,
        status: inv.isPaid ? 'PAID' : (inv.paid ?? 0) > 0 ? 'PARTIAL' : 'UNPAID',
        visitId: Number(inv.visitId),
      })),
      ...payments.map((p): TimelineEntry => ({
        key: `pay-${p.id}`,
        kind: p.status === 'VOIDED' ? 'REFUND' : 'PAYMENT',
        date: p.settledAt || p.createdAt,
        title: p.status === 'VOIDED' ? 'Voided payment' : 'Payment',
        desc: `Payment via ${String(p.method || '').replace(/_/g, ' ')}${
          p.receiptNumber ? ` · Ref: ${p.receiptNumber}` : ''}${
          p.coveredCount > 1 ? ` · ${p.coveredCount} invoices` : ''}`,
        ref: `PAY-${p.id}`,
        amount: p.amount,
        status: p.status === 'VOIDED' ? 'VOIDED' : 'PAID',
      })),
    ];
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, payments]);

  // Date-range filter (user, 2026-08-02: the chip used to be a static LABEL of
  // the data's own span and "Filters" only toasted "coming soon"). `from`/`to`
  // are yyyy-mm-dd; `to` is compared inclusively to the end of that day.
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [rangeOpen, setRangeOpen] = React.useState(false);
  const [minAmount, setMinAmount] = React.useState('');
  const [unpaidOnly, setUnpaidOnly] = React.useState(false);

  const inRange = React.useCallback((iso: string) => {
    const t = new Date(iso).getTime();
    if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && t > new Date(`${to}T23:59:59.999`).getTime()) return false;
    return true;
  }, [from, to]);

  const filtered = entries.filter(e =>
    (filter === 'ALL' || e.kind === filter)
    && inRange(e.date)
    && (!minAmount || Math.abs(e.amount) >= Number(minAmount))
    && (!unpaidOnly || (e.status !== 'PAID' && e.status !== 'VOIDED')));

  const activeFilterCount = (from || to ? 1 : 0) + (minAmount ? 1 : 0) + (unpaidOnly ? 1 : 0);
  const clearFilters = () => { setFrom(''); setTo(''); setMinAmount(''); setUnpaidOnly(false); };
  // Quick presets — the common questions ("what happened this month?").
  const applyPreset = (days: number | 'ytd') => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = days === 'ytd'
      ? `${now.getFullYear()}-01-01`
      : new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
    setFrom(start); setTo(end); setShown(PAGE);
  };
  const visible = filtered.slice(0, shown);
  // The chip reads the CHOSEN range when there is one; otherwise it keeps
  // describing the data's own span (which is all it ever did).
  const rangeLabel = (from || to)
    ? `${from ? fmt(from) : 'Start'} – ${to ? fmt(to) : 'Today'}`
    : entries.length
      ? `${fmt(entries[entries.length - 1].date)} – ${fmt(entries[0].date)}`
      : 'No transactions';

  // Donut segments — lifetime view of where the account stands.
  const segments = [
    { label: 'Paid', value: paidAll, color: 'text-emerald-500', dot: 'bg-emerald-500' },
    { label: 'Outstanding', value: outstanding, color: 'text-rose-500', dot: 'bg-rose-500' },
    { label: 'Credits', value: credit, color: 'text-purple-500', dot: 'bg-purple-500' },
  ];
  const segTotal = segments.reduce((s, x) => s + x.value, 0);

  const recordAdvance = async () => {
    const amount = Number(advanceAmt);
    if (!(amount > 0)) { toast.error('Enter an amount'); return; }
    setAdvanceBusy(true);
    try {
      const res = await clientsAPI.recordAdvance(client.id, { amount, paymentMethod: advanceMethod });
      if (res.success) {
        toast.success(`${money(amount, currency)} added to the payment account`);
        setAdvanceOpen(false); setAdvanceAmt('');
        onRefresh();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to record the advance'); }
    finally { setAdvanceBusy(false); }
  };

  const soon = (what: string) => toast(`${what} is coming soon`, { icon: '🛠️' });

  const QUICK_ACTIONS: { label: string; icon: any; onClick: () => void; disabled?: boolean }[] = [
    { label: 'New Invoice', icon: FileText, onClick: () => onGoTab('appointments') },
    { label: 'Receive Payment', icon: CircleDollarSign, onClick: () => onGoTab('invoices') },
    { label: 'Record Advance', icon: HandCoins, onClick: () => setAdvanceOpen(true), disabled: !canCollect },
    { label: 'Refund', icon: RotateCcw, onClick: () => soon('Refunds') },
    { label: 'Credit Note', icon: Tag, onClick: () => soon('Credit notes') },
    { label: 'Payment Plan', icon: CalendarRange, onClick: () => soon('Payment plans') },
    { label: 'Statement', icon: ScrollText, onClick: () => onGoTab('statements') },
    { label: 'Email Statement', icon: Mail, onClick: () => soon('Emailing statements') },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-seafoam" /></div>;
  }

  const STAT_CARDS = [
    {
      label: 'Current Balance', icon: Wallet, chip: 'bg-rose-500/10 text-rose-500',
      value: money(outstanding, currency), valueCls: outstanding > 0 ? 'text-rose-500' : 'text-pine dark:text-zinc-100',
      sub: openCount > 0 ? `From ${openCount} invoice${openCount === 1 ? '' : 's'}` : 'Nothing outstanding',
    },
    {
      label: 'Credit Available', icon: PiggyBank, chip: 'bg-emerald-500/10 text-emerald-500',
      value: money(credit, currency), valueCls: 'text-pine dark:text-zinc-100',
      sub: client.maxDebt != null ? `Credit Limit: ${money(client.maxDebt, currency)}` : 'No credit limit set',
    },
    {
      label: 'Total Invoiced', icon: FileText, chip: 'bg-indigo-500/10 text-indigo-500',
      value: money(invoiced12, currency), valueCls: 'text-pine dark:text-zinc-100',
      sub: 'Last 12 months',
    },
    {
      label: 'Total Paid', icon: Banknote, chip: 'bg-seafoam/10 text-seafoam',
      value: money(paid12, currency), valueCls: 'text-pine dark:text-zinc-100',
      sub: 'Last 12 months',
    },
    {
      label: 'Payment Reliability', icon: TrendingUp, chip: 'bg-emerald-500/10 text-emerald-500',
      value: reliability == null ? '—' : `${reliability} %`,
      valueCls: reliability != null && reliability >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-pine dark:text-zinc-100',
      sub: reliabilityLabel,
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {STAT_CARDS.map(card => (
          <div key={card.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex items-start gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${card.chip}`}><card.icon size={16} /></div>
            <div className="min-w-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
              <p className={`text-base font-black font-mono leading-tight truncate ${card.valueCls}`}>{card.value}</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ── Left: filters + account timeline ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* These are TIMELINE FILTERS, not navigation. Styled as tabs they
                read as duplicates of the page's own Invoices / Payments /
                Receipts tabs directly above (user, 2026-08-03: "tab
                repetition"), so they are chips behind a "Show" label — same
                behaviour, no longer pretending to be a second tab bar. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-0.5">Show</span>
              {([
                { id: 'ALL' as const, label: 'Everything' },
                { id: 'INVOICE' as const, label: 'Charges' },
                { id: 'PAYMENT' as const, label: 'Payments' },
                { id: 'CREDIT' as const, label: 'Credits' },
                { id: 'REFUND' as const, label: 'Refunds' },
              ]).map(f => (
                <button key={f.id} onClick={() => { setFilter(f.id); setShown(PAGE); }}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
                    filter === f.id
                      ? 'bg-seafoam text-white border-seafoam'
                      : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:text-seafoam'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 relative">
              <button type="button" onClick={() => setRangeOpen(o => !o)}
                title="Filter the timeline by date"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white dark:bg-zinc-900 text-[9px] font-black uppercase tracking-widest transition-all ${
                  (from || to)
                    ? 'border-seafoam text-seafoam'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam'
                }`}>
                <CalendarRange size={12} /> {rangeLabel}
              </button>
              <button type="button" onClick={() => setRangeOpen(o => !o)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white dark:bg-zinc-900 text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeFilterCount > 0
                    ? 'border-seafoam text-seafoam'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam'
                }`}>
                <Filter size={12} /> Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
              </button>

              {rangeOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setRangeOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-30 w-72 p-3 space-y-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex flex-wrap gap-1.5">
                      {([['30 days', 30], ['90 days', 90], ['Year to date', 'ytd']] as const).map(([label, v]) => (
                        <button key={label} type="button" onClick={() => applyPreset(v as any)}
                          className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-seafoam hover:text-white transition-all">
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="field-label">From</span>
                        <input type="date" value={from} max={to || undefined}
                          onChange={e => { setFrom(e.target.value); setShown(PAGE); }}
                          className="field-input !py-1.5 text-[11px]" />
                      </label>
                      <label className="space-y-1">
                        <span className="field-label">To</span>
                        <input type="date" value={to} min={from || undefined}
                          onChange={e => { setTo(e.target.value); setShown(PAGE); }}
                          className="field-input !py-1.5 text-[11px]" />
                      </label>
                    </div>
                    <label className="space-y-1 block">
                      <span className="field-label">Minimum amount ({currency})</span>
                      <input type="number" min={0} step="0.01" inputMode="decimal" placeholder="Any"
                        value={minAmount}
                        onChange={e => { setMinAmount(e.target.value); setShown(PAGE); }}
                        className="field-input !py-1.5 text-[11px]" />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={unpaidOnly}
                        onChange={e => { setUnpaidOnly(e.target.checked); setShown(PAGE); }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-seafoam focus:ring-seafoam" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300">Outstanding only</span>
                    </label>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-800">
                      <button type="button" onClick={clearFilters} disabled={activeFilterCount === 0}
                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 disabled:opacity-40 transition-all">
                        Clear all
                      </button>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {filtered.length} of {entries.length}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Account Timeline</h3>
              <p className="text-[10px] font-bold text-slate-400">All financial transactions for this client</p>
            </div>

            {visible.length === 0 && (
              <div className="py-14 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl opacity-40 uppercase font-black text-[10px] tracking-[0.2em]">
                No transactions {activeFilterCount > 0 ? 'match these filters' : filter !== 'ALL' ? 'of this type' : 'yet'}
              </div>
            )}

            <div>
              {visible.map((e, idx) => {
                const style = KIND_STYLE[e.kind];
                const isLast = idx === visible.length - 1;
                return (
                  <div key={e.key} className="flex items-start gap-3">
                    <div className="w-12 shrink-0 text-right pt-1.5">
                      <p className="text-[10px] font-black text-slate-500 dark:text-zinc-400 leading-tight">
                        {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400">{new Date(e.date).getFullYear()}</p>
                    </div>
                    <div className="flex flex-col items-center self-stretch shrink-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${style.chip}`}>
                        {e.kind === 'PAYMENT' ? <CreditCard size={15} /> : e.kind === 'REFUND' ? <RotateCcw size={15} /> : e.kind === 'CREDIT' ? <Tag size={15} /> : <FileText size={15} />}
                      </div>
                      {!isLast && <div className="w-px flex-1 min-h-[16px] bg-slate-200 dark:bg-zinc-800" />}
                    </div>
                    <div className={`flex-1 min-w-0 flex flex-wrap items-start gap-x-3 gap-y-1 ${isLast ? '' : 'pb-5'}`}>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[9px] font-black uppercase tracking-widest ${style.text}`}>{style.label}</p>
                        <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{e.desc}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">{e.ref}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black font-mono ${e.status === 'VOIDED' ? 'text-slate-400 line-through' : 'text-pine dark:text-zinc-100'}`}>
                          {money(e.amount, currency)}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border ${STATUS_BADGE[e.status]}`}>
                          {e.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pt-1">
                        {e.visitId != null && onViewVisit ? (
                          <button onClick={() => onViewVisit(e.visitId!)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam transition-all">
                            <Eye size={11} /> View
                          </button>
                        ) : (
                          <button onClick={() => onGoTab(e.kind === 'PAYMENT' || e.kind === 'REFUND' ? 'receipts' : 'invoices')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam transition-all">
                            <Eye size={11} /> View
                          </button>
                        )}
                        <button type="button" title="More actions coming soon" onClick={() => soon('Row actions')}
                          className="p-1.5 rounded-lg text-slate-300 dark:text-zinc-600 hover:text-slate-500 transition-colors">
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length > shown && (
              <div className="flex justify-center pt-3">
                <button onClick={() => setShown(s => s + PAGE)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam transition-all">
                  Load more transactions <ChevronDown size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: summary, payment info, quick actions ── */}
        <div className="space-y-4">
          {/* Account Summary */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Account Summary</h3>
              {canCollect && (
                <div className="relative">
                  <button onClick={() => setNewTxOpen(o => !o)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-seafoam text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-sm">
                    <Plus size={12} /> New Transaction <ChevronDown size={11} />
                  </button>
                  {newTxOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setNewTxOpen(false)} />
                      <div className="absolute right-0 top-10 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                        {[
                          { label: 'Receive payment', icon: CircleDollarSign, run: () => onGoTab('invoices') },
                          { label: 'Record advance', icon: HandCoins, run: () => setAdvanceOpen(true) },
                          { label: 'New invoice', icon: FileText, run: () => onGoTab('appointments') },
                        ].map(a => (
                          <button key={a.label} onClick={() => { setNewTxOpen(false); a.run(); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-seafoam/10 hover:text-seafoam transition-all">
                            <a.icon size={13} /> {a.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Donut */}
              <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0 -rotate-90">
                {segTotal > 0 ? (() => {
                  const C = 2 * Math.PI * 44;
                  let acc = 0;
                  return segments.filter(s => s.value > 0).map(s => {
                    const frac = s.value / segTotal;
                    const el = (
                      <circle key={s.label} cx="60" cy="60" r="44" fill="none" strokeWidth="14"
                        className={s.color} stroke="currentColor"
                        strokeDasharray={`${Math.max(frac * C - 2, 0.5)} ${C}`}
                        strokeDashoffset={-acc * C} strokeLinecap="butt" />
                    );
                    acc += frac;
                    return el;
                  });
                })() : (
                  <circle cx="60" cy="60" r="44" fill="none" strokeWidth="14" className="text-slate-100 dark:text-zinc-800" stroke="currentColor" />
                )}
              </svg>
              <div className="flex-1 min-w-0 space-y-1.5">
                {segments.map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 flex-1">{s.label}</span>
                    <span className="text-[10px] font-black font-mono text-pine dark:text-zinc-100">{money(s.value, currency)}</span>
                    <span className="text-[9px] font-bold text-slate-400 w-8 text-right">
                      {segTotal > 0 ? `${Math.round((s.value / segTotal) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                  <span className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-200 flex-1">Total Invoiced</span>
                  <span className="text-[10px] font-black font-mono text-pine dark:text-zinc-100">{money(invoicedAll, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Payment Information</h3>
              <button type="button" title="Editing payment information is coming soon" onClick={() => soon('Editing payment information')}
                className="p-1.5 rounded-lg text-slate-300 dark:text-zinc-600 hover:text-seafoam transition-colors">
                <Pencil size={13} />
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {[
                { label: 'Preferred Method', value: preferredMethod(payments) },
                { label: 'Credit Limit', value: client.maxDebt != null ? money(client.maxDebt, currency) : '—' },
                { label: 'Available Credit', value: money(credit, currency) },
                { label: 'Payment Terms', value: 'Immediate' },
                { label: 'Payment Plan', value: 'None' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2">
                  <span className="text-[10px] font-bold text-slate-400">{row.label}</span>
                  <span className="text-[11px] font-black text-pine dark:text-zinc-100">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-3">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} onClick={a.onClick} disabled={a.disabled}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-seafoam hover:bg-seafoam/5 transition-all disabled:opacity-40 group">
                  <span className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-400 group-hover:text-seafoam group-hover:bg-seafoam/10 transition-colors">
                    <a.icon size={15} />
                  </span>
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 text-center leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Record-advance dialog */}
      {advanceOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[800] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setAdvanceOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Record Advance</h2>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Money ahead of any bill — lands as spendable credit</p>
              </div>
              <button onClick={() => setAdvanceOpen(false)} className="text-slate-400 hover:text-pine"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="field-label">Amount ({currency})</label>
                <input type="number" min={0} value={advanceAmt} onChange={e => setAdvanceAmt(e.target.value)}
                  placeholder="0.00" autoFocus className="field-input text-right font-mono" />
              </div>
              <div>
                <label className="field-label">Method</label>
                <select value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value)} className="field-select">
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </select>
              </div>
              <button onClick={recordAdvance} disabled={advanceBusy}
                className="w-full flex items-center justify-center gap-2 py-3 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all disabled:opacity-50">
                {advanceBusy ? <Loader2 size={14} className="animate-spin" /> : <HandCoins size={14} />}
                {advanceBusy ? 'Recording…' : 'Record advance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Derive the client's preferred payment method from what they actually use.
export const preferredMethod = (payments: ClientBilling['payments']) => {
  const counts: Record<string, number> = {};
  payments.filter(p => p.status !== 'VOIDED').forEach(p => {
    const m = String(p.method || '').replace(/_/g, ' ');
    if (m) counts[m] = (counts[m] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '—';
};

/** Client → Statements tab: chronological charges/payments with running balance. */
export const ClientStatementTab: React.FC<{ clientId: string | number; currency: string }> = ({ clientId, currency }) => {
  const [rows, setRows] = React.useState<{
    date: string; kind: 'CHARGE' | 'PAYMENT'; description: string; visitId: string; charge: number; payment: number; balance: number;
  }[]>([]);
  const [totals, setTotals] = React.useState<{ balance: number; credit: number; totalCharged: number; totalPaid: number } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await clientsAPI.statement(clientId);
        if (live && res.success && res.data) {
          setRows(res.data.rows ?? []);
          setTotals({ balance: res.data.balance, credit: res.data.credit, totalCharged: res.data.totalCharged, totalPaid: res.data.totalPaid });
        }
      } catch { /* surfaced by the client */ }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [clientId]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-seafoam" /></div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Charged', value: money(totals.totalCharged, currency), cls: 'text-pine dark:text-zinc-100' },
            { label: 'Total Paid', value: money(totals.totalPaid, currency), cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Balance', value: money(totals.balance, currency), cls: totals.balance > 0 ? 'text-rose-500' : 'text-pine dark:text-zinc-100' },
            { label: 'Credit', value: money(totals.credit, currency), cls: 'text-purple-500' },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
              <p className={`text-base font-black font-mono ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Account Statement</h3>
          <p className="text-[10px] font-bold text-slate-400">Chronological charges and payments with running balance</p>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center opacity-40 uppercase font-black text-[10px] tracking-[0.2em]">No statement entries</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800">
                  {['Date', 'Description', 'Charge', 'Payment', 'Balance'].map(h => (
                    <th key={h} className={`px-4 sm:px-5 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest ${h !== 'Date' && h !== 'Description' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/60">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 sm:px-5 py-2.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap">{fmt(r.date)}</td>
                    <td className="px-4 sm:px-5 py-2.5 text-[11px] font-bold text-pine dark:text-zinc-100">{r.description}</td>
                    <td className="px-4 sm:px-5 py-2.5 text-[11px] font-black font-mono text-right text-rose-500">{r.charge > 0 ? money(r.charge, currency) : ''}</td>
                    <td className="px-4 sm:px-5 py-2.5 text-[11px] font-black font-mono text-right text-emerald-600 dark:text-emerald-400">{r.payment > 0 ? money(r.payment, currency) : ''}</td>
                    <td className="px-4 sm:px-5 py-2.5 text-[11px] font-black font-mono text-right text-pine dark:text-zinc-100">{money(r.balance, currency)}</td>
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

/**
 * Client → Files tab (backend 175). Bytes go straight to storage via the
 * presigned-URL flow (scope 'client'); the client row keeps only metadata.
 * Add/remove responses return the fresh attachments array, so the list never
 * needs a full profile refetch after a change.
 */
const FILE_KINDS = ['ID', 'CONSENT', 'INSURANCE', 'DOC', 'PHOTO', 'OTHER'] as const;

export const ClientFilesTab: React.FC<{ clientId: number | string; canEdit?: boolean }> = ({ clientId, canEdit = true }) => {
  const [files, setFiles] = React.useState<ClientAttachment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [removingIdx, setRemovingIdx] = React.useState<number | null>(null);
  const [kind, setKind] = React.useState<string>('DOC');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let alive = true;
    clientsAPI.getById(Number(clientId), { cache: false })
      .then(r => { if (alive && r.success && r.data?.client) setFiles((r.data.client as any).attachments || []); })
      .catch(() => { /* empty list */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientId]);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const stored = await uploadsAPI.upload(file, 'client');
      const res = await clientsAPI.addAttachment(clientId, {
        url: stored.publicUrl, key: stored.key, kind,
        contentType: file.type || undefined, sizeBytes: file.size, label: file.name,
      });
      if (res.success && res.data) { setFiles(res.data.attachments); toast.success('File uploaded'); }
    } catch (err: any) { toast.error(err?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const remove = async (idx: number) => {
    setRemovingIdx(idx);
    try {
      const res = await clientsAPI.removeAttachment(clientId, idx);
      if (res.success && res.data) { setFiles(res.data.attachments); toast.success('File removed'); }
    } catch (err: any) { toast.error(err?.message || 'Failed to remove'); }
    finally { setRemovingIdx(null); }
  };

  const sizeLabel = (b?: number | null) => b == null ? '' : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={kind} onChange={e => setKind(e.target.value)} className="field-select w-auto">
            {FILE_KINDS.map(k => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase()}</option>)}
          </select>
          <button type="button" onClick={pick} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-seafoam text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-50">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Upload file
          </button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" className="hidden" onChange={onFile} />
          <p className="text-[9px] font-bold text-slate-400 basis-full sm:basis-auto">Images or PDF. ID, consent forms, insurance documents…</p>
        </div>
      )}

      {loading && <div className="py-12 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-seafoam" /></div>}

      {!loading && files.length === 0 && (
        <div className="py-24 flex flex-col items-center justify-center gap-4 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem]">
          <FolderOpen size={32} className="text-slate-200 dark:text-zinc-700" />
          <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">No files yet</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium max-w-xs text-center">Documents and attachments uploaded for this client will appear here.</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((f, i) => {
            const isImage = (f.contentType || '').startsWith('image/');
            return (
              <div key={`${f.url}-${i}`} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                <a href={f.url} target="_blank" rel="noreferrer" className="block">
                  {isImage
                    ? <img src={f.url} alt={f.label || 'Attachment'} className="w-full h-32 object-cover bg-slate-50 dark:bg-zinc-950" />
                    : <div className="w-full h-32 flex items-center justify-center bg-slate-50 dark:bg-zinc-950"><FileText size={28} className="text-slate-300 dark:text-zinc-700" /></div>}
                </a>
                <div className="p-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate" title={f.label || undefined}>{f.label || 'File'}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                      {f.kind}{f.sizeBytes ? ` · ${sizeLabel(f.sizeBytes)}` : ''} · {new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canEdit && (
                    <button type="button" disabled={removingIdx === i} onClick={() => remove(i)} title="Remove file"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 disabled:opacity-50">
                      {removingIdx === i ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientAccountHub;

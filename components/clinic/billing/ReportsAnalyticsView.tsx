import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ContactDialog from '../../shared/common/ContactDialog';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Brush,
  ComposedChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Receipt, CircleDollarSign, Percent, FileText,
  CreditCard, ChevronRight, ChevronDown, Phone, Plus, Star, Loader2,
  AlertTriangle, PackageOpen, Sparkles, BarChart3, Info, ScrollText, FileSpreadsheet,
  Users, UserPlus, UserMinus, UserCheck, Landmark, PiggyBank,
} from 'lucide-react';
import PageHeader from '../../shared/common/PageHeader';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { summariesAPI, FinanceBI, SummaryResponse } from '../../../services/modules/summaries.api';
import { receivablesAPI, ArAgeing } from '../../../services/modules/receivables.api';
import { supplierApAPI, SupplierInvoice } from '../../../services/modules/supplierAp.api';
import { walletAPI, Wallet as WalletT } from '../../../services/modules/wallet.api';

/**
 * Finance → Reports & Analytics — the BI dashboard (user reference design,
 * 2026-08-02). Feeds from existing aggregates: /summaries (+ an equal-length
 * compare window), /summaries/finance-bi (splits), AR ageing, supplier A/P,
 * and the clinic wallet. Forecast, health score, and insights are DERIVED
 * client-side from those same numbers — no stored score anywhere.
 */

interface Props {
  clinicId?: number | string | null;
  onNavigate?: (view: string, params?: any) => void;
}

const C = {
  green: '#10b981', red: '#ef4444', purple: '#8b5cf6', indigo: '#6366f1',
  amber: '#f59e0b', sky: '#0ea5e9', teal: '#14b8a6', slate: '#94a3b8',
  pink: '#ec4899', lime: '#84cc16',
};
const DONUT_COLORS = [C.sky, C.teal, C.indigo, C.amber, C.purple, C.pink, C.lime, C.slate];

const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const iso = (d: Date) => d.toISOString().slice(0, 10);

type RangeKey = 'this-month' | 'last-month' | '30d' | '90d';
const rangeFor = (key: RangeKey): { from: Date; to: Date } => {
  const now = new Date();
  if (key === 'this-month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (key === 'last-month') return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) };
  const days = key === '30d' ? 30 : 90;
  return { from: new Date(now.getTime() - (days - 1) * 86_400_000), to: now };
};

const pctDelta = (cur: number, prev: number): number | null =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

const Stars: React.FC<{ n: number }> = ({ n }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={11} className={i <= n ? 'text-emerald-500 fill-emerald-500' : 'text-slate-200 dark:text-zinc-700'} />
    ))}
  </span>
);

const ReportsAnalyticsView: React.FC<Props> = ({ clinicId, onNavigate }) => {
  /**
   * Contacting a debtor opens OUR dialog, not the browser's protocol prompt
   * (user, 2026-08-23). See ContactDialog for why.
   */
  const [contact, setContact] = useState<{ name: string; phone: string; subtitle?: string } | null>(null);
  /**
   * Bills → invoices → receipts (user, 2026-08-23).
   *
   * A separate chart from Financial Performance on purpose: that one plots
   * money that ARRIVED. This plots documents RAISED, so a clinic billing work
   * that never becomes an invoice — or invoicing work that never becomes a
   * receipt — can see the gap. Money that never arrives is invisible on a
   * revenue chart by definition.
   */
  const [docFlow, setDocFlow] = useState<any>(null);
  const [docFlowPrev, setDocFlowPrev] = useState<any>(null);
  const [docMode, setDocMode] = useState<'value' | 'count'>('value');
  const [rangeKey] = useState<RangeKey>('this-month');
  // An explicit pick from the shared DateRangePicker wins over the default
  // window; clearing it (null) falls back to `rangeKey`.
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const { from, to } = useMemo(() => {
    if (customRange?.start && customRange?.end) return { from: customRange.start, to: customRange.end };
    return rangeFor(rangeKey);
  }, [customRange, rangeKey]);
  const spanMs = to.getTime() - from.getTime();
  // Compared-to is a PICKER too (user, 2026-08-03): an explicit pick wins;
  // clearing it falls back to the equal-length window ending just before `from`.
  const [compareRange, setCompareRange] = useState<DateRange | null>(null);
  // Off by default: a second pre-filled picker beside the first reads as a
  // required field, and it drives every "from KES x" delta on the page.
  const [compareOn, setCompareOn] = useState(false);
  const prevTo = useMemo(() => compareRange?.end ?? new Date(from.getTime() - 86_400_000), [compareRange, from]);
  const prevFrom = useMemo(() => compareRange?.start ?? new Date(prevTo.getTime() - spanMs), [compareRange, prevTo, spanMs]);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [compare, setCompare] = useState<SummaryResponse | null>(null);
  const [bi, setBi] = useState<FinanceBI | null>(null);
  const [ar, setAr] = useState<ArAgeing | null>(null);
  const [ap, setAp] = useState<{ total: number; suppliers: any[] } | null>(null);
  const [apInvoices, setApInvoices] = useState<SupplierInvoice[]>([]);
  const [wallets, setWallets] = useState<WalletT[]>([]);
  const [granularity, setGranularity] = useState<'Daily' | 'Weekly'>('Daily');
  const [cfGranularity, setCfGranularity] = useState<'Daily' | 'Weekly'>('Daily');
  const [quickOpen, setQuickOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const base = { scope: 'CLINIC' as const, scopeId: clinicId };
    try {
      const [s, cmp, biRes, arRes, apRes, invRes, wRes] = await Promise.all([
        summariesAPI.get({ ...base, from: iso(from), to: iso(to) }, { silent: true } as any),
        summariesAPI.get({ ...base, from: iso(prevFrom), to: iso(prevTo) }, { silent: true } as any).catch(() => null),
        summariesAPI.financeBI({ scopeId: clinicId, from: iso(from), to: iso(to) }, { silent: true } as any).catch(() => null),
        receivablesAPI.arAgeing().catch(() => null),
        supplierApAPI.summary().catch(() => null),
        supplierApAPI.listInvoices({ status: 'OPEN' }).catch(() => null),
        walletAPI.getByEntity('CLINIC', String(clinicId)).catch(() => null),
      ]);
      if (s?.success && s.data) setSummary(s.data);
      if (cmp?.success && cmp.data) setCompare(cmp.data);
      if (biRes?.success && biRes.data) setBi(biRes.data);
      if (arRes?.success && arRes.data) setAr(arRes.data);
      if (apRes?.success && apRes.data) setAp(apRes.data);
      if (invRes?.success && invRes.data?.invoices) setApInvoices(invRes.data.invoices);
      if (wRes?.success && wRes.data?.wallets) setWallets(wRes.data.wallets);
    } finally { setLoading(false); }
  }, [clinicId, from, to, prevFrom, prevTo]);
  useEffect(() => { load(); }, [load]);

  const currency = wallets[0]?.currency || 'KES';
  const money = useCallback((n: number) =>
    `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, [currency]);
  const moneyShort = useCallback((n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(Math.round(n));
  }, []);

  const totals = summary?.totals;
  const prevTotals = compare?.totals;
  const revenue = totals?.revenue ?? 0;
  const expenses = totals?.expenses ?? 0;
  const netProfit = totals?.netProfit ?? (revenue - expenses);
  const cashBalance = wallets.reduce((s, w) => s + Number(w.balance || 0), 0);
  const arTotal = ar?.total ?? 0;
  const apTotal = ap?.total ?? 0;
  const margin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const prevMargin = (prevTotals?.revenue ?? 0) > 0
    ? (((prevTotals!.revenue - prevTotals!.expenses) / prevTotals!.revenue) * 100) : null;

  // ── Series (weekly buckets collapse 7 days into one point) ──────────────
  const bucket = (series: NonNullable<SummaryResponse['series']>, weekly: boolean) => {
    if (!weekly) return series.map(p => ({ ...p, label: fmtDay(p.day) }));
    const out: { label: string; revenue: number; expenses: number; netProfit: number }[] = [];
    for (let i = 0; i < series.length; i += 7) {
      const chunk = series.slice(i, i + 7);
      out.push({
        label: fmtDay(chunk[0].day),
        revenue: chunk.reduce((s, p) => s + p.revenue, 0),
        expenses: chunk.reduce((s, p) => s + p.expenses, 0),
        netProfit: chunk.reduce((s, p) => s + p.netProfit, 0),
      });
    }
    return out;
  };
  useEffect(() => {
    let alive = true;
    const isoD = (d: Date) => d.toISOString().slice(0, 10);
    Promise.all([
      receivablesAPI.documentFlow(isoD(from), isoD(to)),
      compareOn ? receivablesAPI.documentFlow(isoD(prevFrom), isoD(prevTo)).catch(() => null) : Promise.resolve(null),
    ])
      .then(([cur, prev]: any[]) => {
        if (!alive) return;
        if (cur?.success) setDocFlow(cur.data ?? cur);
        setDocFlowPrev(prev?.success ? (prev.data ?? prev) : null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [from, to, prevFrom, prevTo, compareOn]);

  /**
   * Human labels for the two windows. Every comparison number on the page is
   * meaningless without them — "from KES 19,050" begs the question "over
   * what?" (user, 2026-08-23: *"shouldnt compare show 2 values totals for 1st
   * date rng n 2nd one"*).
   */
  const fmtWindow = useCallback((a: Date, b: Date) => {
    const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const sameDayAsToday = b.toDateString() === new Date().toDateString();
    return `${a.toLocaleDateString(undefined, opt)} – ${sameDayAsToday ? 'Today' : b.toLocaleDateString(undefined, opt)}`;
  }, []);
  const curLabel = useMemo(() => fmtWindow(from, to), [fmtWindow, from, to]);
  const cmpLabel = useMemo(() => fmtWindow(prevFrom, prevTo), [fmtWindow, prevFrom, prevTo]);
  const dayCount = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
  const curDays = useMemo(() => dayCount(from, to), [from, to]);
  const cmpDays = useMemo(() => dayCount(prevFrom, prevTo), [prevFrom, prevTo]);
  // A comparison of unequal length is stretched to fit. That must be SAID —
  // a dashed line spanning the chart implies day-for-day otherwise.
  const cmpStretched = compareOn && curDays !== cmpDays;

  /** Legend chip naming the comparison window, plus its length when stretched. */
  const CmpKey = () => (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
      <span className="w-4 border-t-2 border-dashed border-slate-400" />
      {cmpLabel}
      {cmpStretched && (
        <span
          className="normal-case tracking-normal font-bold text-amber-600 dark:text-amber-400"
          title={`The comparison window is ${cmpDays} day${cmpDays === 1 ? '' : 's'} and this one is ${curDays}. The dashed line is stretched to fit, so points do not line up day-for-day.`}
        >
          · {cmpDays}d stretched to {curDays}d
        </span>
      )}
    </span>
  );

  const docData = useMemo(() => {
    // The service returns `series` — reading `days` here is what made the chart
    // say "No documents in this range" while 220 bills sat in the window.
    const days: any[] = docFlow?.series || docFlow?.data?.series || [];
    const prevRaw: any[] = compareOn ? (docFlowPrev?.series || docFlowPrev?.data?.series || []) : [];
    // Same stretch as the other charts — see `resample`.
    const prevDays = prevRaw.length && days.length && prevRaw.length !== days.length
      ? Array.from({ length: days.length }, (_, i) =>
          prevRaw[days.length === 1 ? 0 : Math.round((i * (prevRaw.length - 1)) / (days.length - 1))])
      : prevRaw;
    const pick = (d: any, k: 'bills' | 'invoices' | 'receipts') =>
      d == null ? null : docMode === 'value' ? Number(d[`${k}Value`] || 0) : Number(d[k] || 0);
    return days.map((d, i) => ({
      label: String(d.date || '').slice(5),
      bills: pick(d, 'bills'),
      invoices: pick(d, 'invoices'),
      receipts: pick(d, 'receipts'),
      cmpBills: pick(prevDays[i], 'bills'),
      cmpInvoices: pick(prevDays[i], 'invoices'),
      cmpReceipts: pick(prevDays[i], 'receipts'),
      cmpDay: prevDays[i] ? String(prevDays[i].date || '').slice(5) : null,
    }));
  }, [docFlow, docFlowPrev, docMode, compareOn]);

  // Totals for both windows, printed under each chart so the comparison is a
  // number too — a dashed line alone does not tell you how far apart they are.
  const docTotals = useMemo(() => ({
    cur: docFlow?.totals ?? docFlow?.data?.totals ?? null,
    prev: docFlowPrev?.totals ?? docFlowPrev?.data?.totals ?? null,
  }), [docFlow, docFlowPrev]);

  /**
   * Comparison series are aligned **by position, not by date** — the two
   * windows are equal-length but sit at different points on the calendar, so
   * day 1 lines up with day 1. The X axis stays the CURRENT window's dates and
   * the comparison day is carried in `cmpLabel*` for the tooltip, otherwise a
   * reader has no way to tell which date a dashed point belongs to.
   */
  /**
   * Stretch the comparison window across the current one.
   *
   * Aligning by raw index assumed the two windows were the same length — true
   * of the DEFAULT compare (an equal span ending just before `from`), false the
   * moment someone picks their own. Comparing a 24-day window against a single
   * day drew the dashed series over index 0 alone: a 2px stub at the left edge
   * that reads as a rendering fault, not as data (user, 2026-08-23: *"graphs
   * seem confused"*). Resampling maps position→position so the shapes can
   * actually be compared, and the legend states both lengths so a stretched
   * line is never mistaken for a day-for-day one.
   */
  const resample = (prev: any[], n: number) => {
    if (!prev.length || n <= 0) return [];
    if (prev.length === n) return prev;
    return Array.from({ length: n }, (_, i) =>
      prev[n === 1 ? 0 : Math.round((i * (prev.length - 1)) / (n - 1))]);
  };

  const withCompare = (cur: any[], prevRaw: any[]) => {
    const prev = resample(prevRaw, cur.length);
    return cur.map((p, i) => ({
      ...p,
      cmpRevenue: prev[i]?.revenue ?? null,
      cmpExpenses: prev[i]?.expenses ?? null,
      cmpNetProfit: prev[i]?.netProfit ?? null,
      cmpDay: prev[i]?.label ?? null,
    }));
  };

  const perfData = useMemo(() => {
    const cur = bucket(summary?.series ?? [], granularity === 'Weekly');
    if (!compareOn || !compare?.series?.length) return cur;
    return withCompare(cur, bucket(compare.series, granularity === 'Weekly'));
  }, [summary, compare, compareOn, granularity]);

  const cashData = useMemo(() => {
    const cur = bucket(summary?.series ?? [], cfGranularity === 'Weekly').map(p => ({ ...p, out: -p.expenses }));
    if (!compareOn || !compare?.series?.length) return cur;
    return withCompare(cur, bucket(compare.series, cfGranularity === 'Weekly'));
  }, [summary, compare, compareOn, cfGranularity]);

  // ── Business health score — derived, explainable, current period ────────
  const health = useMemo(() => {
    const clamp5 = (n: number) => Math.max(0, Math.min(5, Math.round(n)));
    const posDays = (summary?.series ?? []).filter(p => p.netProfit > 0).length;
    const dayCount = Math.max(1, summary?.series?.length ?? 1);
    const dims = [
      { key: 'Cash Flow', stars: clamp5((posDays / dayCount) * 5 + (cashBalance > 0 ? 0.5 : 0)) },
      { key: 'Profitability', stars: clamp5(margin >= 30 ? 5 : margin >= 20 ? 4 : margin >= 10 ? 3 : margin > 0 ? 2 : 1) },
      { key: 'Receivables', stars: clamp5(revenue > 0 ? 5 - (arTotal / revenue) * 5 : 3) },
      { key: 'Payables', stars: clamp5(revenue > 0 ? 5 - (apTotal / revenue) * 4 : 3) },
      { key: 'Inventory', stars: clamp5(5 - ((totals?.lowStockItems ?? 0) > 5 ? 2 : (totals?.lowStockItems ?? 0) > 0 ? 1 : 0) - ((totals?.expiringInventory ?? 0) > 0 ? 1 : 0)) },
      { key: 'Growth', stars: clamp5((() => { const d = pctDelta(revenue, prevTotals?.revenue ?? 0); return d == null ? 3 : d >= 15 ? 5 : d >= 5 ? 4 : d >= 0 ? 3 : d >= -10 ? 2 : 1; })()) },
    ];
    const score = Math.round((dims.reduce((s, d) => s + d.stars, 0) / (dims.length * 5)) * 100);
    const label = score >= 85 ? 'Very Healthy' : score >= 70 ? 'Healthy' : score >= 50 ? 'Fair' : 'Needs Attention';
    return { score, label, dims };
  }, [summary, cashBalance, margin, revenue, arTotal, apTotal, totals, prevTotals]);

  // ── Forecast (next 30 days) — straight-line from the period's daily avg ──
  const forecast = useMemo(() => {
    const days = Math.max(1, summary?.series?.length ?? 1);
    const expRevenue = (revenue / days) * 30;
    const expExpenses = (expenses / days) * 30;
    return {
      revenue: expRevenue, expenses: expExpenses, profit: expRevenue - expExpenses,
      cash: cashBalance + (expRevenue - expExpenses),
    };
  }, [summary, revenue, expenses, cashBalance]);

  // ── Insights — rules over the same numbers ───────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: any; tone: string; text: string; go?: () => void }[] = [];
    const revDelta = pctDelta(revenue, prevTotals?.revenue ?? 0);
    if (revDelta != null) list.push({
      icon: revDelta >= 0 ? TrendingUp : TrendingDown,
      tone: revDelta >= 0 ? 'text-emerald-500' : 'text-rose-500',
      text: `Revenue has ${revDelta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(revDelta)}% compared to the previous period.`,
    });
    if ((ar?.clients?.length ?? 0) > 0) list.push({
      icon: Receipt, tone: 'text-amber-500',
      text: `${ar!.clients.length} client${ar!.clients.length === 1 ? ' has' : 's have'} overdue balances. Total outstanding: ${money(arTotal)}.`,
      go: () => onNavigate?.('receivables'),
    });
    const topCat = bi?.revenueByCategory?.[0];
    if (topCat) list.push({
      icon: BarChart3, tone: 'text-sky-500',
      text: `${topCat.category} is your top revenue source this period (${money(topCat.amount)}).`,
    });
    if ((totals?.expiringInventory ?? 0) > 0) list.push({
      icon: PackageOpen, tone: 'text-rose-500',
      text: `${totals!.expiringInventory} product${totals!.expiringInventory === 1 ? ' is' : 's are'} expiring in the next 30 days.`,
      go: () => onNavigate?.('inventory'),
    });
    if ((totals?.lowStockItems ?? 0) > 0) list.push({
      icon: AlertTriangle, tone: 'text-amber-500',
      text: `${totals!.lowStockItems} item${totals!.lowStockItems === 1 ? ' is' : 's are'} below their reorder level.`,
      go: () => onNavigate?.('inventory'),
    });
    if (prevMargin != null) {
      const d = Math.round((margin - prevMargin) * 10) / 10;
      list.push({
        icon: d >= 0 ? Sparkles : TrendingDown,
        tone: d >= 0 ? 'text-emerald-500' : 'text-rose-500',
        text: `Your profit margin has ${d >= 0 ? 'improved' : 'dropped'} by ${Math.abs(d)}%.`,
      });
    }
    return list;
  }, [revenue, prevTotals, ar, arTotal, bi, totals, margin, prevMargin, money, onNavigate]);

  const soon = (what: string) => toast(`${what} is coming soon`, { icon: '🛠️' });

  // ── KPI cards ────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total Revenue', value: money(revenue), icon: Landmark, chip: 'bg-emerald-500/10 text-emerald-500', delta: compareOn ? pctDelta(revenue, prevTotals?.revenue ?? 0) : null, prev: compareOn ? prevTotals?.revenue : undefined, cmpValue: money(prevTotals?.revenue ?? 0) },
    { label: 'Total Expenses', value: money(expenses), icon: Receipt, chip: 'bg-rose-500/10 text-rose-500', delta: compareOn ? pctDelta(expenses, prevTotals?.expenses ?? 0) : null, prev: compareOn ? prevTotals?.expenses : undefined, cmpValue: money(prevTotals?.expenses ?? 0), badDeltaUp: true },
    { label: 'Net Profit', value: money(netProfit), icon: CircleDollarSign, chip: 'bg-purple-500/10 text-purple-500', delta: compareOn ? pctDelta(netProfit, prevTotals?.netProfit ?? 0) : null, prev: compareOn ? prevTotals?.netProfit : undefined, cmpValue: money(prevTotals?.netProfit ?? (((prevTotals?.revenue ?? 0) - (prevTotals?.expenses ?? 0)))) },
    { label: 'Cash Balance', value: money(cashBalance), icon: Wallet, chip: 'bg-sky-500/10 text-sky-500', delta: null, prev: undefined, cmpValue: null, pointInTime: true },
    { label: 'Outstanding (AR)', value: money(arTotal), icon: FileText, chip: 'bg-amber-500/10 text-amber-600', delta: null, prev: undefined, cmpValue: null, pointInTime: true, badDeltaUp: true },
    { label: 'Payables (AP)', value: money(apTotal), icon: CreditCard, chip: 'bg-indigo-500/10 text-indigo-500', delta: null, prev: undefined, cmpValue: null, pointInTime: true, badDeltaUp: true },
    { label: 'Gross Profit Margin', value: `${margin.toFixed(1)}%`, icon: Percent, chip: 'bg-teal-500/10 text-teal-600', delta: compareOn && prevMargin != null ? Math.round((margin - prevMargin) * 10) / 10 : null, prev: undefined, cmpValue: prevMargin != null ? `${prevMargin.toFixed(1)}%` : null, isPoints: true },
  ];

  // Payables list — invoices with due dates first, fallback to A/P summary rows.
  const payableRows = useMemo(() => {
    const dated = apInvoices.filter(i => i.dueDate && i.outstanding > 0)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5)
      .map(i => ({
        key: `inv-${i.id}`, name: i.supplierName || `Supplier #${i.supplierId}`,
        due: i.dueDate!, amount: i.outstanding,
        status: i.overdue ? 'Overdue' : (new Date(i.dueDate!).getTime() - Date.now() < 7 * 86_400_000 ? 'Due Soon' : 'Upcoming'),
      }));
    if (dated.length) return dated;
    return (ap?.suppliers ?? []).slice(0, 5).map((s: any) => ({
      key: `sup-${s.supplierId}`, name: s.name, due: null as string | null,
      amount: s.outstanding, status: s.oldestDays > 30 ? 'Overdue' : 'Upcoming',
    }));
  }, [apInvoices, ap]);

  const STATUS_CHIP: Record<string, string> = {
    Overdue: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    'Due Soon': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    Upcoming: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  };

  const arTop = (ar?.clients ?? []).slice().sort((a, b) => b.total - a.total).slice(0, 5);
  const pmTotal = (bi?.paymentMethods ?? []).reduce((s, m) => s + m.amount, 0);
  const catTotal = (bi?.revenueByCategory ?? []).reduce((s, c) => s + c.amount, 0);
  const catRows = (bi?.revenueByCategory ?? []).slice(0, 6);
  const growth = bi?.clientGrowth;

  const axisProps = { tick: { fontSize: 10, fill: C.slate }, axisLine: false as const, tickLine: false as const };
  /**
   * Recharts labels the X point with the CURRENT window's date. A dashed point
   * belongs to a different day entirely, so without this the reader has no way
   * to tell which date it is.
   */
  const cmpTooltipLabel = (_: any, payload: any[]) => {
    const d = payload?.[0]?.payload;
    const base = d?.label ?? '';
    return compareOn && d?.cmpDay ? `${base}  ·  compared with ${d.cmpDay}` : base;
  };

  const tooltipStyle = {
    contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700 },
    formatter: (v: any, n: any) => [money(Math.abs(Number(v))), n],
  };

  const QUICK_REPORTS = [
    { label: 'Profit & Loss Statement', icon: FileText },
    { label: 'Balance Sheet', icon: ScrollText },
    { label: 'Cash Flow Statement', icon: BarChart3 },
    { label: 'Trial Balance', icon: FileSpreadsheet },
    { label: 'Revenue by Department', icon: PiggyBank },
    { label: 'Revenue by Vet', icon: Users },
    { label: 'A/R Aging Report', icon: Receipt },
    { label: 'A/P Aging Report', icon: CreditCard },
    { label: 'Custom Report', icon: Plus },
  ];

  if (!clinicId) {
    return <p className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Select a clinic first</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Finance & Business Intelligence"
        subtitle="Real-time financial overview and performance insights"
        icon={BarChart3}
        onBack
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {/* The app's shared range picker (user, 2026-08-02) — same control
                as Visits/Clients/Inpatient, instead of this page's own select.
                Clearing it falls back to the default This-Month window. */}
            <DateRangePicker
              value={customRange}
              onChange={r => setCustomRange(r && r.start && r.end ? r : null)}
            />
            {/* Comparison is OPT-IN (user, 2026-08-22).
                Two date pickers side by side, both pre-filled, read as "which
                one am I meant to set?" — and the second silently drives every
                "▾ 100% from KES x" figure on the page. Off by default there is
                one picker and one meaning; tick the box and the comparison
                appears next to it. */}
            <label className="hidden md:inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compareOn}
                onChange={e => { setCompareOn(e.target.checked); if (!e.target.checked) setCompareRange(null); }}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-zinc-600 text-seafoam focus:ring-seafoam"
              />
              Compare
            </label>
            {compareOn && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                to:
                <DateRangePicker
                  value={compareRange ?? { start: prevFrom, end: prevTo }}
                  onChange={r => setCompareRange(r && r.start && r.end ? r : null)}
                />
              </span>
            )}
            <div className="relative">
              <button onClick={() => setQuickOpen(o => !o)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-seafoam text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all shadow-sm">
                <Plus size={13} /> Quick Action
              </button>
              {quickOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setQuickOpen(false)} />
                  <div className="absolute right-0 top-11 w-52 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                    {[
                      // Wallet is its own page now, reached from here rather than
                      // living as a dashboard tab (user, 2026-08-03).
                      { label: 'Open wallet', run: () => onNavigate?.('financial-core') },
                      { label: 'New visit', run: () => onNavigate?.('new-appointment') },
                      { label: 'Collect a payment', run: () => onNavigate?.('clients') },
                      { label: 'Record purchase order', run: () => onNavigate?.('purchase-order-form') },
                      { label: 'View payables', run: () => onNavigate?.('payables') },
                    ].map(a => (
                      <button key={a.label} onClick={() => { setQuickOpen(false); a.run(); }}
                        className="w-full text-left px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-seafoam/10 hover:text-seafoam transition-all">
                        {a.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={22} className="animate-spin text-seafoam" /></div>
      ) : (
        <>
          {/* ── KPI cards — 3 / 2 / 2 rows (user, 2026-08-03) so the money
              values render whole instead of truncating at 7-across. ── */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            {kpis.map((k, ki) => {
              const up = (k.delta ?? 0) >= 0;
              const good = k.delta == null ? true : (k as any).badDeltaUp ? !up : up;
              return (
                <div key={k.label} className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 ${ki < 3 ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`p-2 rounded-xl ${k.chip}`}><k.icon size={14} /></span>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">{k.label}</p>
                  </div>
                  <p className="text-base font-black font-mono text-pine dark:text-zinc-100 leading-tight truncate" title={k.value}>{k.value}</p>
                  {/* When comparing, BOTH totals are shown with the window each
                      belongs to. A lone "70.3% from KES 19,050" made the reader
                      guess which dates the second figure covered — and never
                      showed the second figure at all for the point-in-time
                      tiles (user, 2026-08-23). */}
                  {compareOn ? (
                    <>
                      <p className="text-[8px] font-bold text-slate-400 truncate mt-0.5" title={curLabel}>{curLabel}</p>
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200 dark:border-zinc-800">
                        {(k as any).pointInTime ? (
                          <p className="text-[9px] font-bold text-slate-400 leading-tight">
                            Current position — a balance, not a period total, so it has no comparison.
                          </p>
                        ) : (
                          <>
                            <div className="flex items-baseline justify-between gap-1.5">
                              <p className="text-[11px] font-black font-mono text-slate-500 dark:text-zinc-400 truncate" title={(k as any).cmpValue ?? ''}>
                                {(k as any).cmpValue ?? '—'}
                              </p>
                              {k.delta != null && (
                                <span className={`shrink-0 text-[9px] font-black flex items-center gap-0.5 ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                  {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                  {Math.abs(k.delta)}{(k as any).isPoints ? ' pts' : '%'}
                                </span>
                              )}
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 truncate" title={cmpLabel}>{cmpLabel}</p>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[9px] font-bold text-slate-400">Current position</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Performance · Cash flow · Revenue mix ──
              2:1 (user, 2026-08-02): the two time-series charts STACK in the
              left two-thirds. Three equal columns squeezed both charts to ~1/3
              width, which is what crushed their axis labels. The right third
              holds the two donuts (user, 2026-08-27) — it swapped places with
              the health score, which now sits below. */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
            <div className="xl:col-span-2 flex flex-col gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Financial Performance</h3>
                  <p className="text-[10px] font-bold text-slate-400">Revenue, Expenses & Profit Over Time</p>
                </div>
                <select value={granularity} onChange={e => setGranularity(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[9px] font-black uppercase tracking-widest text-slate-500 outline-none">
                  <option>Daily</option><option>Weekly</option>
                </select>
              </div>
              <div className="flex items-center gap-4 mb-1 flex-wrap">
                {[['Revenue', C.green], ['Expenses', C.red], ['Profit', C.purple]].map(([l, c]) => (
                  <span key={l} className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {l}
                  </span>
                ))}
                {compareOn && <CmpKey />}
              </div>
              {/* Three lines, one visible. Without saying why, a chart showing a
                  single purple curve looks broken — it is not: with no expenses
                  recorded, Profit EQUALS Revenue and the green line sits exactly
                  underneath. */}
              {expenses === 0 && revenue > 0 && (
                <p className="mb-1 text-[9px] font-bold text-slate-400 leading-tight">
                  No expenses recorded in this period, so Profit equals Revenue — the green line is hidden directly beneath the purple one.
                </p>
              )}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={perfData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} tickFormatter={moneyShort} width={44} />
                    <Tooltip {...tooltipStyle} labelFormatter={cmpTooltipLabel} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke={C.green} strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke={C.red} strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="netProfit" name="Profit" stroke={C.purple} strokeWidth={2} dot={{ r: 2 }} />
                    {/* Comparison window, dashed and thinner so the current
                        period stays the subject of the chart. */}
                    {compareOn && (
                      <>
                        <Line type="monotone" dataKey="cmpRevenue" name={`Revenue · ${cmpLabel}`} stroke={C.green} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.55} connectNulls />
                        <Line type="monotone" dataKey="cmpExpenses" name={`Expenses · ${cmpLabel}`} stroke={C.red} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.55} connectNulls />
                        <Line type="monotone" dataKey="cmpNetProfit" name={`Profit · ${cmpLabel}`} stroke={C.purple} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.55} connectNulls />
                      </>
                    )}
                    {/* Zoom + scroll (user, 2026-08-22). Drag the handles to
                        narrow the window, drag the middle to slide it. Only
                        worth showing once there are enough points that a month
                        of daily data is unreadable at full width — below that
                        it is furniture. */}
                    {perfData.length > 12 && (
                      <Brush dataKey="label" height={22} travellerWidth={8} stroke={C.green}
                        fill="transparent" tickFormatter={() => ''} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bills → Invoices → Receipts (user, 2026-08-23).
                Three lines that SHOULD track each other. Where receipts fall
                away from invoices, that gap is the money not collected; where
                invoices fall away from bills, work was billed but never
                invoiced. Toggle value/count because the two answer different
                questions: value shows the shillings at stake, count shows
                whether the paperwork itself is keeping up. */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Bills → Invoices → Receipts</h3>
                  <p className="text-[10px] font-bold text-slate-400">Documents raised over time</p>
                </div>
                <select value={docMode} onChange={e => setDocMode(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[9px] font-black uppercase tracking-widest text-slate-500 outline-none">
                  <option value="value">Value</option><option value="count">Count</option>
                </select>
              </div>
              <div className="flex items-center gap-4 mb-1">
                {[['Bills', C.amber], ['Invoices', C.sky], ['Receipts', C.green]].map(([l, c]) => (
                  <span key={l} className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {l}
                  </span>
                ))}
                {compareOn && <CmpKey />}
              </div>
              {/* Both windows as NUMBERS. A dashed line shows the shape of the
                  difference; only the totals say how big it is. */}
              {docTotals.cur && (
                <div className="mb-1.5 grid grid-cols-3 gap-2 text-[9px]">
                  {([['bills', 'Bills'], ['invoices', 'Invoices'], ['receipts', 'Receipts']] as const).map(([key, lbl]) => {
                    const vk = `${key}Value` as const;
                    const cur = docMode === 'value' ? Number(docTotals.cur[vk] || 0) : Number(docTotals.cur[key] || 0);
                    const prev = docTotals.prev
                      ? (docMode === 'value' ? Number(docTotals.prev[vk] || 0) : Number(docTotals.prev[key] || 0))
                      : null;
                    const fmt = (n: number) => (docMode === 'value' ? money(n) : String(n));
                    return (
                      <div key={key} className="min-w-0">
                        <p className="font-black text-slate-400 uppercase tracking-widest truncate">{lbl}</p>
                        <p className="font-black font-mono text-pine dark:text-zinc-100 truncate" title={fmt(cur)}>{fmt(cur)}</p>
                        {compareOn && (
                          <p className="font-bold font-mono text-slate-400 truncate" title={prev == null ? '' : fmt(prev)}>
                            {prev == null ? '—' : fmt(prev)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="h-64">
                {docData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px] font-bold text-slate-400">
                    No documents in this range
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={docData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} tickFormatter={docMode === 'value' ? moneyShort : undefined} width={44} allowDecimals={false} />
                    {/* Count mode must not render "5 bills" as "KES 5.00". */}
                    <Tooltip
                      {...tooltipStyle}
                      formatter={docMode === 'value' ? tooltipStyle.formatter : ((v: any, n: any) => [String(Math.round(Number(v))), n]) as any}
                      labelFormatter={cmpTooltipLabel}
                    />
                    <Line type="monotone" dataKey="bills" name="Bills" stroke={C.amber} strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="invoices" name="Invoices" stroke={C.sky} strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="receipts" name="Receipts" stroke={C.green} strokeWidth={2} dot={{ r: 2 }} />
                    {compareOn && (
                      <>
                        <Line type="monotone" dataKey="cmpBills" name={`Bills · ${cmpLabel}`} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.55} connectNulls />
                        <Line type="monotone" dataKey="cmpInvoices" name={`Invoices · ${cmpLabel}`} stroke={C.sky} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.55} connectNulls />
                        <Line type="monotone" dataKey="cmpReceipts" name={`Receipts · ${cmpLabel}`} stroke={C.green} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.55} connectNulls />
                      </>
                    )}
                    {docData.length > 12 && (
                      <Brush dataKey="label" height={22} travellerWidth={8} stroke={C.green}
                        fill="transparent" tickFormatter={() => ''} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Cash Flow</h3>
                  <p className="text-[10px] font-bold text-slate-400">Money In vs Money Out</p>
                </div>
                <select value={cfGranularity} onChange={e => setCfGranularity(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[9px] font-black uppercase tracking-widest text-slate-500 outline-none">
                  <option>Daily</option><option>Weekly</option>
                </select>
              </div>
              <div className="flex items-center gap-3 mb-1">
                {[['Money In', C.green], ['Money Out', C.red], ['Net Cash Flow', C.purple]].map(([l, c]) => (
                  <span key={l} className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {l}
                  </span>
                ))}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} tickFormatter={moneyShort} width={44} />
                    <Tooltip {...tooltipStyle} labelFormatter={cmpTooltipLabel} />
                    <Bar dataKey="revenue" name="Money In" fill={C.green} radius={[2, 2, 0, 0]} maxBarSize={8} />
                    <Bar dataKey="out" name="Money Out" fill={C.red} radius={[2, 2, 0, 0]} maxBarSize={8} />
                    <Line type="monotone" dataKey="netProfit" name="Net Cash Flow" stroke={C.purple} strokeWidth={2} dot={false} />
                    {/* Bars are already two series; a third and fourth bar set
                        would be unreadable, so the comparison rides as a single
                        dashed net line. */}
                    {compareOn && (
                      <Line type="monotone" dataKey="cmpNetProfit" name={`Net Cash Flow · ${cmpLabel}`} stroke={C.purple} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.55} connectNulls />
                    )}
                    {cashData.length > 12 && (
                      <Brush dataKey="label" height={22} travellerWidth={8} stroke={C.green}
                        fill="transparent" tickFormatter={() => ''} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            </div>{/* /left 2-col stack */}

            {/* Right third (user, 2026-08-27). This column is as tall as the
                two stacked charts beside it (~850px), and NOTHING compact
                fills it: one centred health-score card left ~450px of void,
                and so did two donuts. It takes all three small cards —
                ~620px — to read as a column rather than a gap. If you move
                a card out of here, put something else in. */}
            <div className="flex flex-col gap-4">
              {/* Revenue by Department */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
                <div className="mb-2">
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Revenue by Department</h3>
                  <p className="text-[10px] font-bold text-slate-400">Breakdown of income sources</p>
                </div>
                {catRows.length === 0 ? (
                  <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600">No revenue in this period</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative w-28 h-28 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={catRows} dataKey="amount" nameKey="category" innerRadius={34} outerRadius={52} paddingAngle={2} strokeWidth={0}>
                            {catRows.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                          </Pie>
                          <Tooltip {...tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-pine dark:text-zinc-100">{currency} {moneyShort(catTotal)}</span>
                        <span className="text-[8px] font-bold text-slate-400">Total</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {catRows.map((c, i) => (
                        <div key={c.category} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 truncate flex-1">{c.category}</span>
                          <span className="text-[9px] font-black text-slate-400 w-8 text-right">{catTotal > 0 ? Math.round((c.amount / catTotal) * 100) : 0}%</span>
                          <span className="text-[9px] font-black font-mono text-pine dark:text-zinc-100 w-16 text-right">{currency} {moneyShort(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-2">Payment Methods</h3>
                {(bi?.paymentMethods?.length ?? 0) === 0 ? (
                  <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600">No payments in this period</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative w-28 h-28 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={bi!.paymentMethods} dataKey="amount" nameKey="method" innerRadius={34} outerRadius={52} paddingAngle={2} strokeWidth={0}>
                            {bi!.paymentMethods.map((_, i) => <Cell key={i} fill={[C.green, C.sky, C.purple, C.amber, C.pink, C.slate][i % 6]} />)}
                          </Pie>
                          <Tooltip {...tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-pine dark:text-zinc-100">{currency} {moneyShort(pmTotal)}</span>
                        <span className="text-[8px] font-bold text-slate-400">Total</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {bi!.paymentMethods.slice(0, 6).map((m, i) => (
                        <div key={m.method} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: [C.green, C.sky, C.purple, C.amber, C.pink, C.slate][i % 6] }} />
                          <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 truncate flex-1">{m.method.replace(/_/g, ' ')}</span>
                          <span className="text-[9px] font-black text-slate-400 w-8 text-right">{pmTotal > 0 ? Math.round((m.amount / pmTotal) * 100) : 0}%</span>
                          <span className="text-[9px] font-black font-mono text-pine dark:text-zinc-100 w-16 text-right">{currency} {moneyShort(m.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Business Health Score — LAST, and it absorbs the slack.
                  Three cards still come up ~230px short of the two charts, so
                  this one takes `flex-1` and centres itself in whatever height
                  is left: the column closes exactly instead of ending in a gap.
                  The donuts stay their natural size; only this one stretches. */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col justify-center flex-1">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-1">Business Health Score</h3>
                <div className="flex flex-col items-center">
                  <svg viewBox="0 0 200 110" className="w-44">
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" className="dark:opacity-20" />
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#healthGrad)" strokeWidth="14" strokeLinecap="round"
                      strokeDasharray={`${(health.score / 100) * 251} 251`} />
                    <defs>
                      <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={C.amber} />
                        <stop offset="60%" stopColor={C.lime} />
                        <stop offset="100%" stopColor={C.green} />
                      </linearGradient>
                    </defs>
                    <text x="100" y="82" textAnchor="middle" className="fill-pine dark:fill-zinc-100" style={{ fontSize: 34, fontWeight: 900 }}>{health.score}</text>
                    <text x="100" y="100" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11, fontWeight: 700 }}>/100</text>
                  </svg>
                  <span className="inline-flex items-center gap-1 -mt-1 mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    <Sparkles size={11} /> {health.label}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {health.dims.map(d => (
                    <div key={d.key} className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">{d.key}</span>
                      <Stars n={d.stars} />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[9px] font-bold text-slate-400 text-center">Score is based on current period performance</p>
              </div>
            </div>{/* /right third: donuts + health score */}

          </div>

          {/* ── Top vets · Client growth ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

            {/* Top Veterinarians */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-3">Top Veterinarians <span className="text-[9px] font-bold text-slate-400">(By Revenue)</span></h3>
              {(bi?.topStaff?.length ?? 0) === 0 ? (
                <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600">No attributed visits yet</p>
              ) : (
                <div className="space-y-3">
                  {bi!.topStaff.slice(0, 5).map(s => (
                    <div key={s.userId} className="flex items-center gap-2.5">
                      {s.avatarUrl
                        ? <img src={s.avatarUrl} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                        : <span className="w-8 h-8 rounded-full bg-seafoam/10 text-seafoam text-[10px] font-black flex items-center justify-center shrink-0">{s.name.split(' ').map(p => p[0]).slice(0, 2).join('')}</span>}
                      <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate flex-1">{s.name}</span>
                      <span className="text-[11px] font-black font-mono text-pine dark:text-zinc-100">{currency} {moneyShort(s.revenue)}</span>
                      {s.deltaPct != null && (
                        <span className={`text-[9px] font-black inline-flex items-center gap-0.5 ${s.deltaPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                          {s.deltaPct >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{Math.abs(s.deltaPct)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-3">Client Growth</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'New Clients', value: growth?.newClients ?? 0, icon: UserPlus, chip: 'bg-sky-500/10 text-sky-500', delta: pctDelta(growth?.newClients ?? 0, growth?.newClientsPrev ?? 0) },
                  { label: 'Returning Clients', value: growth?.returningClients ?? 0, icon: UserCheck, chip: 'bg-emerald-500/10 text-emerald-500', delta: null },
                  { label: 'Lost Clients', value: growth?.lostClients ?? 0, icon: UserMinus, chip: 'bg-rose-500/10 text-rose-500', delta: null, bad: true },
                  { label: 'Total Active Clients', value: growth?.totalActiveClients ?? 0, icon: Users, chip: 'bg-purple-500/10 text-purple-500', delta: null },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-2.5">
                    <span className={`p-2 rounded-xl shrink-0 ${r.chip}`}><r.icon size={13} /></span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 flex-1">{r.label}</span>
                    <span className="text-sm font-black font-mono text-pine dark:text-zinc-100">{r.value.toLocaleString()}</span>
                    {r.delta != null && (
                      <span className={`text-[9px] font-black inline-flex items-center gap-0.5 ${(r as any).bad ? 'text-rose-500' : r.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {r.delta >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{Math.abs(r.delta)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[9px] font-bold text-slate-400">Lost = no visit in the last 90 days.</p>
            </div>
          </div>

          {/* ── AR · AP · Insights · Forecast ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Top outstanding */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-2">Top 5 Outstanding Balances</h3>
              {arTop.length === 0 ? (
                <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600 flex-1">Nothing outstanding 🎉</p>
              ) : (
                <div className="flex-1">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-0 text-[8px] font-black text-slate-400 uppercase tracking-widest pb-1.5 border-b border-slate-100 dark:border-zinc-800">
                    <span>Client</span><span className="text-right">Days</span><span className="text-right">Amount</span><span />
                  </div>
                  {arTop.map(c => (
                    <div key={c.clientId} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center py-2 border-b border-slate-50 dark:border-zinc-800/60 last:border-b-0">
                      <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{c.name}</span>
                      <span className={`text-[10px] font-black text-right ${c.oldestDays > 30 ? 'text-rose-500' : 'text-slate-500'}`}>{c.oldestDays}</span>
                      <span className="text-[10px] font-black font-mono text-pine dark:text-zinc-100 text-right">{currency} {moneyShort(c.total)}</span>
                      {c.phone ? (
                        <button
                          type="button"
                          title={`Contact ${c.name}`}
                          onClick={() => setContact({ name: c.name, phone: String(c.phone), subtitle: `${currency} ${moneyShort(c.total)} owed · oldest ${c.oldestDays}d` })}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all justify-self-end">
                          <Phone size={11} />
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => onNavigate?.('receivables')}
                className="mt-3 w-full py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam transition-all">
                View All Receivables
              </button>
            </div>

            {/* Upcoming payables */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-2">Upcoming Payables</h3>
              {payableRows.length === 0 ? (
                <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600 flex-1">Nothing owed 🎉</p>
              ) : (
                <div className="flex-1">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 text-[8px] font-black text-slate-400 uppercase tracking-widest pb-1.5 border-b border-slate-100 dark:border-zinc-800">
                    <span>Supplier</span><span className="text-right">Amount</span><span className="text-right">Status</span>
                  </div>
                  {payableRows.map(r => (
                    <div key={r.key} className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center py-2 border-b border-slate-50 dark:border-zinc-800/60 last:border-b-0">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{r.name}</p>
                        <p className="text-[9px] font-bold text-slate-400">{r.due ? fmtDate(r.due) : 'No due date'}</p>
                      </div>
                      <span className="text-[10px] font-black font-mono text-pine dark:text-zinc-100 text-right">{currency} {moneyShort(r.amount)}</span>
                      <span className={`justify-self-end px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border ${STATUS_CHIP[r.status] || STATUS_CHIP.Upcoming}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => onNavigate?.('payables')}
                className="mt-3 w-full py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam transition-all">
                View All Payables
              </button>
            </div>

            {/* Insights */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-2">Business Alerts &amp; Insights</h3>
              {insights.length === 0 ? (
                <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600 flex-1">Nothing to flag</p>
              ) : (
                <div className="flex-1 divide-y divide-slate-50 dark:divide-zinc-800/60">
                  {insights.slice(0, 6).map((ins, i) => (
                    <button key={i} onClick={() => ins.go ? ins.go() : undefined}
                      className={`w-full flex items-start gap-2.5 py-2 text-left group ${ins.go ? '' : 'cursor-default'}`}>
                      <ins.icon size={14} className={`${ins.tone} shrink-0 mt-0.5`} />
                      <span className="text-[10.5px] font-bold text-slate-600 dark:text-zinc-300 leading-snug flex-1">{ins.text}</span>
                      {ins.go && <ChevronRight size={12} className="text-slate-300 group-hover:text-seafoam shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => soon('The insights hub')}
                className="mt-3 w-full py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam transition-all">
                View All Insights
              </button>
            </div>

            {/* Forecast */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight mb-3">Forecast <span className="text-[9px] font-bold text-slate-400">(Next 30 Days)</span></h3>
              <div className="flex-1 space-y-3">
                {[
                  { label: 'Expected Revenue', value: forecast.revenue, cls: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Expected Expenses', value: forecast.expenses, cls: 'text-rose-500' },
                  { label: 'Expected Profit', value: forecast.profit, cls: forecast.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500' },
                  { label: 'Projected Cash Balance', value: forecast.cash, cls: 'text-pine dark:text-zinc-100' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">{r.label}</span>
                    <span className={`text-[12px] font-black font-mono ${r.cls}`}>{money(r.value)}</span>
                  </div>
                ))}
                {forecastOpen && (
                  <p className="text-[9px] font-bold text-slate-400 leading-relaxed border-t border-slate-100 dark:border-zinc-800 pt-2">
                    Straight-line projection: this period's daily averages carried forward 30 days.
                    Projected cash = current wallet balance + expected profit. It is an estimate, not a promise.
                  </p>
                )}
              </div>
              <button onClick={() => setForecastOpen(o => !o)}
                className="mt-3 w-full py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam transition-all inline-flex items-center justify-center gap-1">
                View Forecast Details <ChevronDown size={11} className={`transition-transform ${forecastOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* ── Quick reports ── */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Quick Reports</h3>
              <button onClick={() => soon('The reports library')}
                className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-seafoam/70 inline-flex items-center gap-1">
                View All Reports <ChevronRight size={11} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_REPORTS.map(r => (
                <button key={r.label} onClick={() => soon(`"${r.label}"`)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam transition-all">
                  <r.icon size={12} /> {r.label}
                </button>
              ))}
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <Info size={11} /> Figures come from settled transactions, visit bills, AR/AP ledgers and the clinic wallet for the selected period. Forecast and health score are derived estimates.
          </p>
        </>
      )}
      <ContactDialog
        open={!!contact}
        onClose={() => setContact(null)}
        name={contact?.name ?? ''}
        phone={contact?.phone ?? ''}
        subtitle={contact?.subtitle}
      />
    </div>
  );
};

export default ReportsAnalyticsView;

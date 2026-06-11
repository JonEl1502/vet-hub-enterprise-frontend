import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  RefreshCw,
  ChevronRight,
  Package
} from 'lucide-react';
import { walletAPI, summariesAPI, SummaryResponse } from '../../../services';
import TrialBanner from '../../shared/common/TrialBanner';
import { purchaseOrderAPI } from '../../../services/modules/purchaseOrders.api';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { useFx } from '../../../contexts/FxContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import DateRangePicker from '../../shared/common/DateRangePicker';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { formatDate, formatTime, formatDateTime } from '../../../services/utils/dateFormatter';

interface Props {
  onViewTransaction?: (transactionId: string) => void;
  dateRange?: { start: Date | null; end: Date | null };
  onDateRangeChange?: (range: { start: Date | null; end: Date | null }) => void;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  clinicId?: string | number;
  onGoToWallet?: () => void;
  /** Hide the internal trial banner when embedded somewhere that already
   *  shows one (e.g. the dashboard). Defaults to true (standalone Finance). */
  showTrialBanner?: boolean;
}

const FinanceView: React.FC<Props> = ({ onViewTransaction, dateRange, onDateRangeChange, onRefresh, isRefreshing, clinicId, onGoToWallet, showTrialBanner = true }) => {
  const { transactions, appointments, isLoadingTransactions, ensureTransactions, ensureAppointments } = useData();
  const { selectedClinics } = useClinic();
  const { convert } = useFx();
  useEffect(() => { ensureTransactions(); ensureAppointments(); }, [ensureTransactions, ensureAppointments]);
  const [timeRange, setTimeRange] = useState<'WEEK' | 'MONTH' | 'YEAR'>('MONTH');

  // Wallet summary state
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  // Stock purchases state (from purchase orders)
  const [stockPurchases, setStockPurchases] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Backend-precomputed summary (preferred over the in-memory aggregation
  // below — keeps the in-memory path as a fallback for dev / before the
  // first cron run).
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  React.useEffect(() => {
    const opts: any = {
      scope: 'CLINIC',
      ...(clinicId ? { scopeId: String(clinicId) } : {}),
      ...(dateRange?.start ? { from: new Date(dateRange.start).toISOString().slice(0, 10) } : {}),
      ...(dateRange?.end ? { to: new Date(dateRange.end).toISOString().slice(0, 10) } : {}),
    };
    summariesAPI.get(opts)
      .then((res) => { if (res.success) setSummary(res.data); })
      .catch(() => setSummary(null));
  }, [clinicId, dateRange?.start, dateRange?.end]);

  React.useEffect(() => {
    if (!clinicId) return;
    setWalletLoading(true);
    walletAPI.getByEntity('CLINIC', String(clinicId))
      .then(res => { if (res.success) setWallets(res.data.wallets || []); })
      .catch(() => {})
      .finally(() => setWalletLoading(false));
  }, [clinicId]);

  // Fetch completed/received purchase orders for stock expense tracking
  React.useEffect(() => {
    setStockLoading(true);
    purchaseOrderAPI.getAll({ limit: 200 })
      .then(res => {
        if (res.success) {
          const received = (res.data.data || []).filter((po: any) =>
            ['RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED'].includes(po.status)
          );
          setStockPurchases(received);
        }
      })
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, []);

  // Filter transactions and appointments by date range.
  //
  // We compare *calendar dates* in the clinic TZ (Africa/Nairobi — same
  // as the dateFormatter util) rather than millisecond timestamps. Why:
  // setHours(23,59,59,999) on a Date is browser-TZ-local. When the user's
  // browser TZ differs from the clinic TZ (or even when it matches —
  // EAT-evening appointments stored at e.g. 18:00 UTC), the millisecond
  // comparison can drop the boundary day. Y-M-D string comparison is
  // exact and timezone-stable.
  const filteredData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) {
      return { transactions, appointments };
    }

    const toClinicDateStr = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(d);
      const y = parts.find(p => p.type === 'year')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${y}-${m}-${day}`;
    };

    const startStr = toClinicDateStr(new Date(dateRange.start));
    const endStr = toClinicDateStr(new Date(dateRange.end));

    const filteredTransactions = transactions.filter(tx => {
      if (!tx.createdAt) return false;
      const s = toClinicDateStr(new Date(tx.createdAt));
      return s >= startStr && s <= endStr;
    });

    const filteredAppointments = appointments.filter(a => {
      const s = toClinicDateStr(new Date(a.date));
      return s >= startStr && s <= endStr;
    });

    return { transactions: filteredTransactions, appointments: filteredAppointments };
  }, [transactions, appointments, dateRange]);

  // Resolve the active clinic + display currency early — metrics, charts,
  // and tables all share these values, and metrics needs displayCcy at the
  // top of its computation for the FX conversion below.
  const activeClinic = clinicId
    ? selectedClinics.find(c => String(c.id) === String(clinicId)) || selectedClinics[0]
    : selectedClinics[0];
  const currency = (activeClinic?.currency || transactions[0]?.currency || 'KES').toUpperCase();

  // Stock purchase total filtered by date range — POs may be in any
  // currency (supplier's preferred currency); FX-convert into the display
  // currency so the Total Expense card aggregates honestly. Uses the same
  // clinic-TZ calendar-date comparison as filteredData above.
  const stockExpenseTotal = useMemo(() => {
    const toClinicDateStr = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(d);
      const y = parts.find(p => p.type === 'year')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${y}-${m}-${day}`;
    };
    const startStr = dateRange?.start ? toClinicDateStr(new Date(dateRange.start)) : null;
    const endStr = dateRange?.end ? toClinicDateStr(new Date(dateRange.end)) : null;
    return stockPurchases
      .filter(po => {
        if (!startStr || !endStr) return true;
        const d = new Date(po.receivedAt || po.updatedAt || po.createdAt);
        const s = toClinicDateStr(d);
        return s >= startStr && s <= endStr;
      })
      .reduce((sum: number, po: any) => {
        const raw = Number(po.totalAmount) || 0;
        const src = (po.currency || currency).toUpperCase();
        if (src === currency) return sum + raw;
        const out = convert(raw, src, currency);
        return sum + (out ?? raw);
      }, 0);
  }, [stockPurchases, dateRange, currency, convert]);

  // Calculate financial metrics. We base **Revenue / paid counts** on the
  // filtered *appointments* (by their scheduled `date`) instead of the
  // backend summary (which buckets by transaction `createdAt`).
  //
  // Why: when the user picks a date range — e.g. "Today & Future" — they
  // expect the cards to match the visible appointments list. The backend
  // summary, on the other hand, counts a payment received TODAY for an
  // appointment from last week against today's revenue, which made the
  // dashboard say KES 13,000 in a window that only had one paid KES 2,000
  // appointment. Source of truth here is appointment.totalCost +
  // appointment.isPaid scoped to the date range. Expenses (PO/stock) stay
  // creation-date-based since that's how cash leaves the clinic.
  const metrics = useMemo(() => {
    const displayCcy = (activeClinic?.currency || 'KES').toUpperCase();
    const apptCcy = (activeClinic?.currency || 'KES').toUpperCase();
    const toDisplay = (amount: number, fromCcy?: string) => {
      const src = (fromCcy || displayCcy).toUpperCase();
      if (src === displayCcy) return amount;
      const out = convert(amount, src, displayCcy);
      return out ?? amount;
    };

    const paidAppts = filteredData.appointments.filter(a => a.isPaid);
    const unpaidAppts = filteredData.appointments.filter(a => !a.isPaid);
    const totalRevenue = paidAppts
      .reduce((sum, a) => sum + toDisplay(Number(a.totalCost) || 0, apptCcy), 0);

    // SUPPLIER transactions include PO-generated expenses; avoid double-counting
    // by using the max of transaction-based vs PO-based expenses
    const supplierTxExpenses = filteredData.transactions
      .filter(tx => tx.type === 'SUPPLIER' && tx.status === 'SETTLED')
      .reduce((sum, tx) => sum + toDisplay(tx.amount, tx.currency), 0);

    const totalExpenses = Math.max(supplierTxExpenses, stockExpenseTotal);

    const netProfit = totalRevenue - totalExpenses;

    // Payment method breakdown — driven by the same filtered, paid
    // appointments so the pie chart slices sum to the Revenue card.
    const paymentMethods = paidAppts.reduce((acc, a) => {
      const method = (a.paymentMethod || 'OTHER').toString();
      acc[method] = (acc[method] || 0) + toDisplay(Number(a.totalCost) || 0, apptCcy);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      transactionCount: transactions.length,
      paidAppointments: paidAppts.length,
      unpaidAppointments: unpaidAppts.length,
      paymentMethods,
    };
  }, [filteredData, stockExpenseTotal, activeClinic, convert, transactions.length]);

  // Revenue over time data — revenue is bucketed by appointment date (paid
  // appointments only), expenses by tx createdAt. Same FX normalisation
  // as the headline cards so the chart's totals reconcile with them.
  const revenueOverTime = useMemo(() => {
    const now = new Date();
    const daysToShow = timeRange === 'WEEK' ? 7 : timeRange === 'MONTH' ? 30 : 365;
    const data: { date: string; revenue: number; expenses: number }[] = [];
    const toDisplay = (amount: number, fromCcy?: string) => {
      const src = (fromCcy || currency).toUpperCase();
      if (src === currency) return amount;
      return convert(amount, src, currency) ?? amount;
    };

    // Bucket by *clinic-TZ* calendar date so an EAT-evening appointment
    // (stored at e.g. 19:00 UTC = 22:00 EAT) lands on its own day rather
    // than the next one according to the browser TZ.
    const dayKey = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d);
    const apptByDay = new Map<string, number>();
    for (const a of filteredData.appointments) {
      if (!a.isPaid) continue;
      const k = dayKey(new Date(a.date));
      apptByDay.set(k, (apptByDay.get(k) || 0) + toDisplay(Number(a.totalCost) || 0, currency));
    }
    const expByDay = new Map<string, number>();
    for (const tx of filteredData.transactions) {
      if (tx.type !== 'SUPPLIER' || tx.status !== 'SETTLED' || !tx.createdAt) continue;
      const k = dayKey(new Date(tx.createdAt));
      expByDay.set(k, (expByDay.get(k) || 0) + toDisplay(tx.amount, tx.currency));
    }

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = dayKey(date);

      const dayRevenue = apptByDay.get(dateStr) || 0;
      const dayExpenses = expByDay.get(dateStr) || 0;

      data.push({
        date: timeRange === 'YEAR' ? date.toLocaleDateString('en-US', { month: 'short' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
        expenses: dayExpenses,
      });
    }

    return data;
  }, [filteredData.transactions, filteredData.appointments, timeRange, currency, convert]);

  // Payment method pie chart data
  const paymentMethodData = useMemo(() => {
    return Object.entries(metrics.paymentMethods).map(([method, amount]) => ({
      name: method.replace('_', ' '),
      value: amount,
    }));
  }, [metrics.paymentMethods]);

  // Cumulative revenue data
  const cumulativeRevenueData = useMemo(() => {
    let cumulative = 0;
    return revenueOverTime.map(item => {
      cumulative += item.revenue;
      return {
        date: item.date,
        cumulative,
      };
    });
  }, [revenueOverTime]);

  // Recent transactions
  const recentTransactions = useMemo(() => {
    return [...filteredData.transactions]
      .filter(tx => tx.createdAt) // Filter out transactions without createdAt
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [filteredData.transactions]);

  // (activeClinic + currency are declared earlier so metrics/stock totals
  // can use them in their FX conversion.)
  const COLORS = ['#1C7A5B', '#20B2AA', '#5F9EA0', '#48D1CC', '#00CED1'];

  if (isLoadingTransactions) {
    return <LoadingSpinner message="Loading financial data..." />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Trial / subscription days-left banner */}
      {clinicId && showTrialBanner && (
        <TrialBanner clinicId={String(clinicId)} showWhenSubscribed />
      )}

      {/* Wallet Summary Card */}
      {clinicId && (
        <div className="bg-gradient-to-r from-pine to-seafoam dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <Wallet size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Clinic Wallets</p>
                {walletLoading ? (
                  <div className="h-6 w-24 bg-white/10 rounded animate-pulse mt-0.5" />
                ) : wallets.length === 0 ? (
                  <p className="text-sm font-black text-white/70">No wallet set up</p>
                ) : (
                  <p className="text-xl font-black font-mono text-white tracking-tight">
                    {wallets[0]?.currency || 'KES'}{' '}
                    {wallets.reduce((sum: number, w: any) => sum + (Number(w.balance) || 0), 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!walletLoading && wallets.length > 1 && (
                <div className="hidden sm:flex gap-2">
                  {wallets.slice(0, 3).map((w: any) => (
                    <div key={w.id} className="text-right">
                      <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">{w.type?.replace(/_/g,' ')}</p>
                      <p className="text-xs font-black font-mono text-white">{Number(w.balance || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
              {onGoToWallet && (
                <button
                  onClick={onGoToWallet}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shrink-0"
                >
                  Manage <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* <div>
          <h1 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Finance Overview</h1>
          <p className="text-slate-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
            Comprehensive Financial Analytics & Metrics
          </p>
        </div> */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {onDateRangeChange && (
            <DateRangePicker
              value={dateRange || { start: null, end: null }}
              onChange={onDateRangeChange}
              className="flex-1 md:flex-none"
              buttonClassName="w-full md:w-auto justify-between"
            />
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="shrink-0 ml-auto p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-pine dark:hover:border-zinc-500 transition-all disabled:opacity-50"
              title="Refresh all data"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          )}
          {/* {(['WEEK', 'MONTH', 'YEAR'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                timeRange === range
                  ? 'bg-seafoam text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-seafoam'
              }`}
            >
              {range}
            </button>
          ))} */}
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          className={`bg-white dark:bg-zinc-900 border-2 rounded-[2rem] p-6 shadow-sm transition-all ${
            metrics.totalRevenue >= 0
              ? 'border-teal-200 dark:border-teal-800 hover:border-teal-300'
              : 'border-red-200 dark:border-red-800 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest">Revenue</p>
            <div className={`p-2 rounded-lg ${
              metrics.totalRevenue >= 0
                ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-500'
                : 'bg-red-50 dark:bg-red-900/20 text-red-500'
            }`}>
              {metrics.totalRevenue >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <h3 className={`text-3xl font-black tracking-tighter ${
            metrics.totalRevenue >= 0 ? 'text-teal-600' : 'text-red-600'
          }`}>
            {currency} {metrics.totalRevenue.toLocaleString()}
          </h3>
          <p className="text-slate-400 text-[8px] font-black uppercase mt-2">
            {metrics.totalRevenue >= 0 ? 'Positive margin' : 'Negative margin'}
          </p>
        </motion.div>


        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-seafoam to-cyan rounded-xl p-4 text-white shadow-lg shadow-seafoam/20 relative overflow-hidden group"
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/70 text-[8px] font-black uppercase tracking-widest">Total Revenue</p>
              <div className="p-1.5 bg-white/20 rounded-lg">
                <TrendingUp size={14} />
              </div>
            </div>
            <h3 className="text-2xl font-black tracking-tighter">{currency} {metrics.totalRevenue.toLocaleString()}</h3>
            <p className="text-white/60 text-[7px] font-black uppercase mt-1">From {metrics.transactionCount} transactions</p>
          </div>
        </motion.div> */}

        {/* Total Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          className={`bg-white dark:bg-zinc-900 border-2 rounded-[2rem] p-6 shadow-sm transition-all ${
            metrics.totalExpenses >= 0
              ? 'border-orange-200 dark:border-orange-800 hover:border-orange-300'
              : 'border-red-200 dark:border-red-800 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest">Total Expense</p>
            <div className={`p-2 rounded-lg ${
              metrics.totalExpenses >= 0
                ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500'
                : 'bg-red-50 dark:bg-red-900/20 text-red-500'
            }`}>
              {metrics.totalExpenses >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <h3 className={`text-3xl font-black tracking-tighter ${
            metrics.totalExpenses >= 0 ? 'text-orange-600' : 'text-red-600'
          }`}>
            {currency} {Math.abs(metrics.totalExpenses).toLocaleString()}
          </h3>
          {stockLoading ? (
            <div className="h-3 w-20 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse mt-2" />
          ) : stockExpenseTotal > 0 ? (
            <div className="flex items-center gap-1 mt-2">
              <Package size={9} className="text-amber-500 shrink-0" />
              <p className="text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase">
                Stock: {currency} {stockExpenseTotal.toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-slate-400 text-[8px] font-black uppercase mt-2">
              {metrics.totalExpenses >= 0 ? 'Operational costs' : 'Negative margin'}
            </p>
          )}
        </motion.div>

        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          whileHover={{ scale: 1.02 }}
          className="compact-card hover:border-red-300 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="card-subtitle">Total Expenses</p>
            <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-500">
              <ArrowDownLeft size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter">{currency} {metrics.totalExpenses.toLocaleString()}</h3>
          <p className="text-slate-400 text-[7px] font-black uppercase mt-1">Operational costs</p>
        </motion.div> */}

        {/* Net Profit */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          className={`bg-white dark:bg-zinc-900 border-2 rounded-[2rem] p-6 shadow-sm transition-all ${
            metrics.netProfit >= 0
              ? 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-300'
              : 'border-red-200 dark:border-red-800 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest">Net Profit</p>
            <div className={`p-2 rounded-lg ${
              metrics.netProfit >= 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                : 'bg-red-50 dark:bg-red-900/20 text-red-500'
            }`}>
              {metrics.netProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <h3 className={`text-3xl font-black tracking-tighter ${
            metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {currency} {Math.abs(metrics.netProfit).toLocaleString()}
          </h3>
          <p className="text-slate-400 text-[8px] font-black uppercase mt-2">
            {metrics.netProfit >= 0 ? 'Positive margin' : 'Negative margin'}
          </p>
        </motion.div>

        {/* Payment Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm hover:border-seafoam transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest">Payment Status</p>
            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400">
              <Receipt size={18} />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] font-black uppercase text-emerald-500">Paid</span>
                <span className="text-sm font-black text-pine dark:text-zinc-100">{metrics.paidAppointments}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(metrics.paidAppointments / (metrics.paidAppointments + metrics.unpaidAppointments)) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] font-black uppercase text-amber-500">Unpaid</span>
                <span className="text-sm font-black text-pine dark:text-zinc-100">{metrics.unpaidAppointments}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${(metrics.unpaidAppointments / (metrics.paidAppointments + metrics.unpaidAppointments)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Data Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Line Chart */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">Revenue vs Expenses</h3>
              <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-1">Financial trend analysis</p>
            </div>
            <Calendar size={20} className="text-slate-400" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300} minHeight={300}>
              <LineChart data={revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1C7A5B"
                  strokeWidth={3}
                  dot={{ fill: '#1C7A5B', r: 4 }}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: '#ef4444', r: 4 }}
                  name="Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Breakdown Pie Chart */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">Payment Methods</h3>
              <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-1">Revenue distribution</p>
            </div>
            <CreditCard size={20} className="text-slate-400" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300} minHeight={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                  formatter={(value: number) => `${currency} ${value.toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cumulative Revenue Growth */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">Cumulative Revenue Growth</h3>
            <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-1">Total revenue accumulation over time</p>
          </div>
          <Wallet size={20} className="text-slate-400" />
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <AreaChart data={cumulativeRevenueData}>
              <defs>
                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1C7A5B" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#1C7A5B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                stroke="#cbd5e1"
              />
              <YAxis
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                stroke="#cbd5e1"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
                formatter={(value: number) => `${currency} ${value.toLocaleString()}`}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#1C7A5B"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorCumulative)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="p-4 sm:p-8 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">Recent Transactions</h3>
              <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-1">Latest financial activities</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                <p className="text-lg font-black text-pine dark:text-zinc-100 font-mono">{recentTransactions.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile / tablet: cards ── */}
        <div className="lg:hidden divide-y divide-slate-100 dark:divide-zinc-800">
          {recentTransactions.length > 0 ? recentTransactions.map((tx) => {
            const isIncome = tx.type === 'SERVICE' || tx.type === 'REFERRAL';
            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                onClick={() => onViewTransaction?.(tx.id)}
              >
                <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-xl shrink-0">
                  <Receipt size={14} className="text-seafoam" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-pine dark:text-zinc-100 font-black text-sm truncate">#{tx.id}</p>
                    <p className={`font-mono font-black text-sm whitespace-nowrap shrink-0 ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}{currency} {tx.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase border ${
                      tx.type === 'SERVICE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : tx.type === 'REFERRAL' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>{tx.type}</span>
                    <span className="text-slate-300 dark:text-zinc-600">·</span>
                    <p className="text-slate-400 text-[9px] font-bold">{tx.method.replace('_', ' ')}</p>
                    <span className="text-slate-300 dark:text-zinc-600">·</span>
                    <p className="text-slate-400 text-[9px] font-bold">{formatDate(tx.createdAt)}</p>
                    <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase border shrink-0 ${
                      tx.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>{tx.status}</span>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="px-8 py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-slate-100 dark:bg-zinc-800 rounded-full">
                  <Receipt size={32} className="text-slate-300 dark:text-zinc-600" />
                </div>
                <p className="text-slate-400 dark:text-zinc-500 text-sm font-black uppercase tracking-widest">No transactions found</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction ID</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    onClick={() => onViewTransaction?.(tx.id)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg shrink-0">
                          <Receipt size={14} className="text-seafoam" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-pine dark:text-zinc-100 font-black text-sm truncate">#{tx.id}</p>
                          {tx.receiptNumber && (
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5 truncate">{tx.receiptNumber}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-pine dark:text-zinc-200 font-bold text-sm whitespace-nowrap">{formatDate(tx.createdAt)}</p>
                      <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">{formatTime(tx.createdAt)}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg border ${
                        tx.type === 'SERVICE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : tx.type === 'REFERRAL' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>{tx.type}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-slate-400 shrink-0" />
                        <span className="text-pine dark:text-zinc-200 font-bold text-sm">{tx.method.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg border ${
                        tx.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>{tx.status}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className={`text-lg font-black font-mono whitespace-nowrap ${
                        tx.type === 'SERVICE' || tx.type === 'REFERRAL' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {tx.type === 'SUPPLIER' ? '-' : '+'}{currency} {tx.amount.toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-100 dark:bg-zinc-800 rounded-full">
                        <Receipt size={32} className="text-slate-300 dark:text-zinc-600" />
                      </div>
                      <p className="text-slate-400 dark:text-zinc-500 text-sm font-black uppercase tracking-widest">No transactions found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default FinanceView;


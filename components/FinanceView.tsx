import React, { useMemo, useState } from 'react';
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
  Calendar
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import LoadingSpinner from './LoadingSpinner';
import DateRangePicker from './DateRangePicker';
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
import { formatDate, formatTime, formatDateTime } from '../services/utils/dateFormatter';

interface Props {
  onViewTransaction?: (transactionId: string) => void;
  dateRange?: { start: Date | null; end: Date | null };
  onDateRangeChange?: (range: { start: Date | null; end: Date | null }) => void;
}

const FinanceView: React.FC<Props> = ({ onViewTransaction, dateRange, onDateRangeChange }) => {
  const { transactions, appointments, isLoadingTransactions } = useData();
  const [timeRange, setTimeRange] = useState<'WEEK' | 'MONTH' | 'YEAR'>('MONTH');

  // Filter transactions and appointments by date range
  const filteredData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) {
      return { transactions, appointments };
    }

    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    const filteredTransactions = transactions.filter(tx => {
      if (!tx.createdAt) return false;
      const txDate = new Date(tx.createdAt);
      return txDate >= start && txDate <= end;
    });

    const filteredAppointments = appointments.filter(a => {
      const apptDate = new Date(a.date);
      return apptDate >= start && apptDate <= end;
    });

    return { transactions: filteredTransactions, appointments: filteredAppointments };
  }, [transactions, appointments, dateRange]);

  // Calculate financial metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredData.transactions
      .filter(tx => tx.type === 'SERVICE' && tx.status === 'SETTLED')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalExpenses = filteredData.transactions
      .filter(tx => tx.type === 'SUPPLIER' && tx.status === 'SETTLED')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const netProfit = totalRevenue - totalExpenses;

    const paidAppointments = filteredData.appointments.filter(a => a.isPaid).length;
    const unpaidAppointments = filteredData.appointments.filter(a => !a.isPaid).length;

    // Payment method breakdown
    const paymentMethods = filteredData.transactions.reduce((acc, tx) => {
      if (tx.status === 'SETTLED') {
        acc[tx.method] = (acc[tx.method] || 0) + tx.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      transactionCount: transactions.length,
      paidAppointments,
      unpaidAppointments,
      paymentMethods,
    };
  }, [filteredData]);

  // Revenue over time data
  const revenueOverTime = useMemo(() => {
    const now = new Date();
    const daysToShow = timeRange === 'WEEK' ? 7 : timeRange === 'MONTH' ? 30 : 365;
    const data: { date: string; revenue: number; expenses: number }[] = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayRevenue = filteredData.transactions
        .filter(tx =>
          tx.type === 'SERVICE' &&
          tx.status === 'SETTLED' &&
          tx.createdAt &&
          typeof tx.createdAt === 'string' &&
          tx.createdAt.startsWith(dateStr)
        )
        .reduce((sum, tx) => sum + tx.amount, 0);

      const dayExpenses = filteredData.transactions
        .filter(tx =>
          tx.type === 'SUPPLIER' &&
          tx.status === 'SETTLED' &&
          tx.createdAt &&
          typeof tx.createdAt === 'string' &&
          tx.createdAt.startsWith(dateStr)
        )
        .reduce((sum, tx) => sum + tx.amount, 0);

      data.push({
        date: timeRange === 'YEAR' ? date.toLocaleDateString('en-US', { month: 'short' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
        expenses: dayExpenses,
      });
    }

    return data;
  }, [filteredData.transactions, timeRange]);

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

  const currency = transactions[0]?.currency || 'KES';
  const COLORS = ['#438883', '#20B2AA', '#5F9EA0', '#48D1CC', '#00CED1'];

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* <div>
          <h1 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Finance Overview</h1>
          <p className="text-slate-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
            Comprehensive Financial Analytics & Metrics
          </p>
        </div> */}
        <div className="flex items-center gap-2">
          {onDateRangeChange && (
            <DateRangePicker
              value={dateRange || { start: null, end: null }}
              onChange={onDateRangeChange}
            />
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
          <p className="text-slate-400 text-[8px] font-black uppercase mt-2">
            {metrics.totalExpenses >= 0 ? 'Positive margin' : 'Negative margin'}
          </p>
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
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
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
                  stroke="#438883"
                  strokeWidth={3}
                  dot={{ fill: '#438883', r: 4 }}
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
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
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
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
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
                  <stop offset="5%" stopColor="#438883" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#438883" stopOpacity={0}/>
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
                stroke="#438883"
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
        <div className="p-8 border-b border-slate-200 dark:border-zinc-800">
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

        <div className="overflow-x-auto">
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
                        <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                          <Receipt size={14} className="text-seafoam" />
                        </div>
                        <div>
                          <p className="text-pine dark:text-zinc-100 font-black text-sm">#{tx.id}</p>
                          {tx.receiptNumber && (
                            <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">{tx.receiptNumber}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-pine dark:text-zinc-200 font-bold text-sm">{formatDate(tx.createdAt)}</p>
                      <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">
                        {formatTime(tx.createdAt)}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg border ${
                        tx.type === 'SERVICE'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : tx.type === 'REFERRAL'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-slate-400" />
                        <span className="text-pine dark:text-zinc-200 font-bold text-sm">{tx.method.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-lg border ${
                        tx.status === 'SETTLED'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : tx.status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className={`text-lg font-black font-mono ${
                        tx.type === 'SERVICE' || tx.type === 'REFERRAL'
                          ? 'text-emerald-600'
                          : 'text-red-600'
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


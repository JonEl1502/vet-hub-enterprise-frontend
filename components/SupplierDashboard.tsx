import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DollarSign,
  Clock,
  BarChart3,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';
import { supplierProductsAPI } from '../services/modules/supplierProducts.api';
import { supplierOrdersAPI } from '../services/modules/supplierOrders.api';
import { toast } from '../services/utils/toast';
import type { PurchaseOrder } from '../services/modules/purchaseOrders.api';
import type { SupplierProduct } from '../services/modules/supplierProducts.api';
import { DateRangePicker, DateRange } from './DateRangePicker';
import SupplierWallet from './SupplierWallet';

type Tab = 'overview' | 'analytics' | 'wallet';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  SUBMITTED: '#f59e0b',
  APPROVED: '#3b82f6',
  ORDERED: '#a855f7',
  PARTIALLY_RECEIVED: '#06b6d4',
  RECEIVED: '#10b981',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const SupplierDashboard: React.FC = () => {
  const { user } = useAuth();
  const { branches, activeBranchIds } = useSupplierBranch();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const initialFetchDone = useRef(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        supplierOrdersAPI.getMyOrders({
          limit: 1000,
          supplierBranchIds: activeBranchIds.length > 0 ? activeBranchIds : undefined,
        }),
        supplierProductsAPI.getMyProducts({ limit: 1000 }),
      ]);
      setOrders(ordersRes.data.data || []);
      setProducts(productsRes.data.data || []);
    } catch (err: any) {
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.supplier) {
      const silent = initialFetchDone.current;
      initialFetchDone.current = true;
      fetchData(silent);
    }
  }, [user, activeBranchIds]);

  // Filtered orders by active branches + date range
  const filteredOrders = useMemo(() => {
    return orders.filter((o: any) => {
      if (dateRange?.start) {
        const d = new Date(o.createdAt || 0);
        if (d < dateRange.start) return false;
      }
      if (dateRange?.end) {
        const d = new Date(o.createdAt || 0);
        const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [orders, activeBranchIds, branches, dateRange]);

  // Stats derived from filteredOrders
  const stats = useMemo(() => {
    const active = filteredOrders.filter(o =>
      ['SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(o.status)
    );
    const completed = filteredOrders.filter(o => ['RECEIVED', 'COMPLETED'].includes(o.status));
    const cancelled = filteredOrders.filter(o => o.status === 'CANCELLED');
    const totalRevenue = completed.reduce(
      (sum, o) => sum + parseFloat((o as any).totalAmount?.toString() || '0'),
      0
    );
    const pendingPayments = active.reduce(
      (sum, o) => sum + parseFloat((o as any).totalAmount?.toString() || '0'),
      0
    );
    // Revenue this month
    const now = new Date();
    const revenueThisMonth = completed
      .filter(o => {
        const d = new Date((o as any).createdAt || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, o) => sum + parseFloat((o as any).totalAmount?.toString() || '0'), 0);
    // Revenue last month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const revenueLastMonth = completed
      .filter(o => {
        const d = new Date((o as any).createdAt || 0);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      })
      .reduce((sum, o) => sum + parseFloat((o as any).totalAmount?.toString() || '0'), 0);
    const avgOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0;
    const monthGrowth = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : null;
    return {
      totalRevenue,
      pendingPayments,
      totalProducts: products.length,
      activeOrders: active.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      revenueThisMonth,
      revenueLastMonth,
      avgOrderValue,
      monthGrowth,
    };
  }, [filteredOrders, products]);

  // Revenue by month for last 6 months
  const revenueByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      months[key] = 0;
    }
    filteredOrders.forEach(o => {
      if (!['RECEIVED', 'COMPLETED'].includes(o.status)) return;
      const d = new Date((o as any).createdAt || Date.now());
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (key in months) {
        months[key] += parseFloat((o as any).totalAmount?.toString() || '0');
      }
    });
    return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
  }, [filteredOrders]);

  // Orders by status for PieChart
  const ordersByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#94a3b8',
    }));
  }, [filteredOrders]);

  // Top ordering branches
  const topBranches = useMemo(() => {
    const totals: Record<string, { name: string; total: number }> = {};
    orders.forEach((o: any) => {
      if (!o.clinic) return;
      const id = String(o.clinic.id);
      if (!totals[id]) totals[id] = { name: o.clinic.name, total: 0 };
      totals[id].total += parseFloat(o.totalAmount?.toString() || '0');
    });
    return Object.values(totals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [orders]);

  // Products by category
  const productsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }, [products]);




  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const currency = (user?.supplier as any)?.currency || 'KES';

  const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'overview',  label: 'Overview',  icon: BarChart3  },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'wallet',    label: 'Wallet',    icon: Wallet     },
  ];

  return (
    <div className="space-y-5">
      {/* Tab nav */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-1.5 shadow-sm min-w-max sm:min-w-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-sm'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
      <div className="space-y-6">
          {/* Date filter */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Financial KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-green-500/20 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Total Revenue</p>
                <div className="p-2 bg-green-500/10 rounded-xl">
                  <DollarSign size={16} className="text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">
                {currency}{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mt-1">All time · completed orders</p>
            </div>

            {/* Revenue This Month */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-seafoam/20 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">This Month</p>
                <div className="p-2 bg-seafoam/10 rounded-xl">
                  <TrendingUp size={16} className="text-seafoam" />
                </div>
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">
                {currency}{stats.revenueThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {stats.monthGrowth !== null && (
                <div className={`flex items-center gap-1 mt-1 ${stats.monthGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.monthGrowth >= 0
                    ? <ArrowUpRight size={12} />
                    : <ArrowDownRight size={12} />
                  }
                  <span className="text-[10px] font-black">{Math.abs(stats.monthGrowth).toFixed(1)}% vs last month</span>
                </div>
              )}
            </div>

            {/* Pending / In-Pipeline */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-amber-500/20 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Pending Income</p>
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <Clock size={16} className="text-amber-500" />
                </div>
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">
                {currency}{stats.pendingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mt-1">{stats.activeOrders} active order{stats.activeOrders !== 1 ? 's' : ''}</p>
            </div>

            {/* Avg Order Value */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-purple-500/20 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Avg Order Value</p>
                <div className="p-2 bg-purple-500/10 rounded-xl">
                  <Activity size={16} className="text-purple-500" />
                </div>
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">
                {currency}{stats.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 mt-1">Per completed order</p>
            </div>
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-2xl font-black text-purple-500">{stats.activeOrders}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Active Orders</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-2xl font-black text-emerald-500">{stats.completedOrders}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Completed</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-2xl font-black text-blue-500">{stats.totalProducts}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Products</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-2xl font-black text-red-500">{stats.cancelledOrders}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Cancelled</p>
            </div>
          </div>

          {/* Revenue Trend Chart */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">
              Revenue Trend — Last 6 Months
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toLocaleString()}`} width={55} />
                <Tooltip
                  formatter={(v: any) => [`${currency}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ r: 3, fill: '#0d9488' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Orders by Status + Top Clients */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Orders by Status</h2>
              {ordersByStatus.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No order data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={ordersByStatus}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {ordersByStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Tooltip
                      formatter={(v: any, name) => [v, name]}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Top Ordering Clinics</h2>
              {topBranches.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topBranches} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toLocaleString()}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip
                      formatter={(v: any) => [`${currency}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="total" fill="#0d9488" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Products by Category */}
          {productsByCategory.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Products by Category</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={productsByCategory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="category" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" name="Products" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Date filter */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Revenue by Month */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Revenue by Month</h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toLocaleString()}`} width={65} />
                <Tooltip
                  formatter={(v: any) => [`${currency}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fill="url(#revenueGrad2)" dot={{ r: 4, fill: '#0d9488' }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Orders by Status</h2>
              {ordersByStatus.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No order data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ordersByStatus} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {ordersByStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Tooltip formatter={(v: any, name) => [v, name]} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Top Ordering Branches</h2>
              {topBranches.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topBranches} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toLocaleString()}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={(v: any) => [`${currency}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="total" fill="#0d9488" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {productsByCategory.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Products by Category</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={productsByCategory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="category" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" name="Products" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Wallet */}
      {activeTab === 'wallet' && (
        user?.supplier
          ? <SupplierWallet supplier={user.supplier} />
          : <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
              <Wallet size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">Supplier profile not found</p>
            </div>
      )}
    </div>
  );
};

export default SupplierDashboard;

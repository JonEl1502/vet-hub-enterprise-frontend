import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Wallet,
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
import { supplierSubscriptionAPI } from '../services/modules/supplierSubscription.api';
import type { SupplierSubscription } from '../services/modules/supplierSubscription.api';
import { toast } from '../services/utils/toast';
import type { PurchaseOrder } from '../services/modules/purchaseOrders.api';
import type { SupplierProduct } from '../services/modules/supplierProducts.api';
import SupplierWallet from './SupplierWallet';
import SupplierBillingView from './SupplierBillingView';
import { CreditCard } from 'lucide-react';

type Tab = 'overview' | 'analytics' | 'orders' | 'products' | 'wallet' | 'billing';

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

interface SupplierDashboardProps {
  setView?: (view: string, params?: any) => void;
}

const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ setView }) => {
  const { user } = useAuth();
  const { branches, activeBranchIds } = useSupplierBranch();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [activeSub, setActiveSub] = useState<SupplierSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  // Orders tab filter
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const supplierId = user?.supplier?.id ? String(user.supplier.id) : null;
      const [ordersRes, productsRes, subRes] = await Promise.all([
        supplierOrdersAPI.getMyOrders({
          limit: 1000,
          supplierBranchIds: activeBranchIds.length > 0 ? activeBranchIds : undefined,
        }),
        supplierProductsAPI.getMyProducts({ limit: 1000 }),
        supplierId
          ? supplierSubscriptionAPI.getActive(supplierId).catch(() => null)
          : Promise.resolve(null),
      ]);
      setOrders(ordersRes.data.data || []);
      setProducts(productsRes.data.data || []);
      setActiveSub(subRes?.data?.subscription ?? null);
    } catch (err: any) {
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.supplier) fetchData();
  }, [user, activeBranchIds]);

  // Filtered orders by active branches from context (all supplier branches)
  const filteredOrders = useMemo(() => {
    if (activeBranchIds.length === 0 || activeBranchIds.length === branches.length) return orders;
    // SupplierBranch ids — filter orders by supplier branch if set
    // (Orders are from clinic branches ordering from supplier; when no supplier branches exist, show all)
    return orders;
  }, [orders, activeBranchIds, branches]);

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
    return {
      totalRevenue,
      pendingPayments,
      totalProducts: products.length,
      activeOrders: active.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
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

  const toggleBranch = (id: number) => {
    setSelectedBranchIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const statCards = [
    {
      label: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
    },
    {
      label: 'Pending Payments',
      value: `$${stats.pendingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Active Orders',
      value: stats.activeOrders,
      icon: ShoppingCart,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      label: 'Completed Orders',
      value: stats.completedOrders,
      icon: CheckCircle,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Cancelled Orders',
      value: stats.cancelledOrders,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
  ];

  const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  const filteredTabOrders = useMemo(() => {
    let base = filteredOrders;
    if (orderStatusFilter !== 'ALL') base = base.filter(o => o.status === orderStatusFilter);
    return [...base].sort((a, b) =>
      new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime()
    );
  }, [filteredOrders, orderStatusFilter]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* <div>
            <h1 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
              {user?.supplier?.name || 'Supplier Dashboard'}
            </h1>
            <p className="text-seafoam dark:text-zinc-500 text-sm font-bold mt-1">
              Welcome back, {user?.name}
            </p>
            {user?.supplier && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-zinc-400">
                {user.supplier.category && (
                  <p className="font-semibold">
                    Category: <span className="text-pine dark:text-zinc-300">{user.supplier.category}</span>
                  </p>
                )}
                {user.supplier.contactEmail && (
                  <p>Email: <span className="text-pine dark:text-zinc-300">{user.supplier.contactEmail}</span></p>
                )}
                {user.supplier.contactPhone && (
                  <p>Phone: <span className="text-pine dark:text-zinc-300">{user.supplier.contactPhone}</span></p>
                )}
              </div>
            )}
          </div> */}

          <div className="flex items-center gap-3 flex-wrap">
            {/* Status + Rating */}
            {user?.supplier && (
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${user.supplier.isActive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  {user.supplier.isActive ? 'Active' : 'Inactive'}
                </div>
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10">
                  <span className="text-amber-600 dark:text-amber-400 text-xs font-bold">
                    ⭐ {user.supplier.rating?.toFixed(1) || '0.0'}
                  </span>
                </div>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
              title="Refresh"
            >
              <RefreshCw size={14} className={`text-slate-500 dark:text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-1.5 shadow-sm">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Subscription Banner */}
          {activeSub ? (
            <div className={`rounded-2xl p-5 border-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
              activeSub.isActive
                ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${activeSub.isActive ? 'bg-teal-500/15' : 'bg-amber-500/15'}`}>
                  <CreditCard size={22} className={activeSub.isActive ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Current Plan</p>
                  <p className="text-lg font-black text-pine dark:text-zinc-100 leading-tight">
                    {activeSub.package?.name ?? 'Unknown Package'}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
                    {activeSub.isActive ? (
                      <>Renews <span className="text-pine dark:text-zinc-200">{new Date(activeSub.expiresAt).toLocaleDateString()}</span></>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Expired {new Date(activeSub.expiresAt).toLocaleDateString()}</span>
                    )}
                    {activeSub.package && (
                      <> &middot; <span className="text-seafoam font-bold">${activeSub.package.price.toLocaleString()}/{activeSub.package.billingCycle === 'YEARLY' ? 'yr' : 'mo'}</span></>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('billing')}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                  activeSub.isActive
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                {activeSub.isActive ? 'Manage Plan' : 'Renew Plan'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl p-5 border-2 border-dashed border-slate-300 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-800">
                  <CreditCard size={22} className="text-slate-400 dark:text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-pine dark:text-zinc-100">No Active Subscription</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Subscribe to unlock all supplier features</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('billing')}
                className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-pine dark:bg-zinc-100 text-white dark:text-pine hover:opacity-90 transition-all"
              >
                View Plans
              </button>
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((stat, idx) => (
              <div key={idx} className={`bg-white dark:bg-zinc-900 border-2 ${stat.border} rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-black text-pine dark:text-zinc-100 mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-4 ${stat.bg} rounded-xl`}>
                    <stat.icon className={stat.color} size={28} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Sparkline */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">
              Revenue Trend — Last 6 Months
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} width={60} />
                <Tooltip
                  formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ r: 3, fill: '#0d9488' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setView?.('supplier-products')}
                className="px-6 py-4 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all"
              >
                Manage Products
              </button>
              <button
                onClick={() => setView?.('supplier-orders')}
                className="px-6 py-4 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all"
              >
                View Orders
              </button>
              <button
                onClick={() => setView?.('supplier-analytics')}
                className="px-6 py-4 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
              >
                Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
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
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} width={65} />
                <Tooltip
                  formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fill="url(#revenueGrad2)" dot={{ r: 4, fill: '#0d9488' }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders by Status */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Orders by Status</h2>
              {ordersByStatus.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No order data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={ordersByStatus}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {ordersByStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', fontWeight: 700 }}
                    />
                    <Tooltip
                      formatter={(v: any, name) => [v, name]}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Ordering Branches */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Top Ordering Branches</h2>
              {topBranches.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topBranches} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip
                      formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Total Orders']}
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

      {activeTab === 'orders' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex-1">
              Incoming Orders
              <span className="ml-2 text-xs font-bold text-seafoam">({filteredTabOrders.length})</span>
            </h2>
            <select
              value={orderStatusFilter}
              onChange={e => setOrderStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {filteredTabOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-zinc-600">
              <ShoppingCart size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    <th className="text-left px-4 py-3">Order #</th>
                    <th className="text-left px-4 py-3">Branch</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredTabOrders.slice(0, 50).map((order: any) => (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3 font-black text-pine dark:text-zinc-100 text-xs">
                        #{String(order.id).slice(-6).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-zinc-400 font-semibold">
                        {order.clinic?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                          style={{
                            backgroundColor: (STATUS_COLORS[order.status] || '#94a3b8') + '20',
                            color: STATUS_COLORS[order.status] || '#94a3b8',
                          }}
                        >
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-black text-pine dark:text-zinc-100">
                        ${parseFloat(order.totalAmount?.toString() || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setView?.('supplier-order-detail', { orderId: order.id })}
                          className="px-3 py-1 text-[10px] font-black uppercase text-seafoam hover:text-pine dark:hover:text-zinc-100 transition-colors border border-seafoam/30 rounded-lg hover:border-seafoam/60"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-3xl font-black text-pine dark:text-zinc-100">{products.length}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Total Products</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-3xl font-black text-green-500">{products.filter(p => p.isAvailable).length}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Available</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-3xl font-black text-red-500">{products.filter(p => !p.isAvailable).length}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Unavailable</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-3xl font-black text-blue-500">{productsByCategory.length}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider mt-1">Categories</p>
            </div>
          </div>

          {/* Category breakdown */}
          {productsByCategory.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">By Category</h2>
                <button
                  onClick={() => setView?.('supplier-products')}
                  className="px-4 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all"
                >
                  Manage All Products
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {productsByCategory.map(({ category, count }) => (
                  <div key={category} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full">
                    <span className="text-xs font-black text-pine dark:text-zinc-200">{category}</span>
                    <span className="text-xs font-bold text-seafoam">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {products.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 shadow-sm text-center">
              <Package size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm font-bold text-slate-500 dark:text-zinc-400 mb-4">No products yet</p>
              <button
                onClick={() => setView?.('supplier-products')}
                className="px-6 py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all"
              >
                Add Your First Product
              </button>
            </div>
          )}
        </div>
      )}
      {activeTab === 'wallet' && user?.supplier && (
        <SupplierWallet supplier={user.supplier} />
      )}

      {activeTab === 'wallet' && !user?.supplier && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
          <Wallet size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">Supplier profile not found</p>
        </div>
      )}
      {activeTab === 'billing' && (
        <SupplierBillingView />
      )}
    </div>
  );
};

export default SupplierDashboard;

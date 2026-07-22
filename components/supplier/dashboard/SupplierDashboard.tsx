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
  Truck,
  CheckCircle2,
  XCircle,
  Package as PackageIcon,
  Plus,
  Globe,
  Eye,
  EyeOff,
  LayoutGrid,
  Table as TableIcon,
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
import { useAuth } from '../../../contexts/AuthContext';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import { supplierProductsAPI } from '../../../services/modules/supplierProducts.api';
import { supplierOrdersAPI } from '../../../services/modules/supplierOrders.api';
import { suppliersAPI, CreateSupplierData } from '../../../services/modules/suppliers.api';
import { toast } from '../../../services/utils/toast';
import type { PurchaseOrder } from '../../../services/modules/purchaseOrders.api';
import type { SupplierProduct } from '../../../services/modules/supplierProducts.api';
import type { Supplier } from '../../../services/modules/suppliers.api';
import { DateRangePicker, DateRange } from '../../shared/common/DateRangePicker';
import SupplierWallet from '../billing/SupplierWallet';

type Tab = 'overview' | 'wallet' | 'directory';

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
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  // Admin Suppliers-directory tab: cards vs table.
  const [supplierDirView, setSupplierDirView] = useState<'cards' | 'table'>('cards');
  const [loading, setLoading] = useState(true);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const initialFetchDone = useRef(false);

  const role = user?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'MERCHANT_ADMIN';
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSupplierData>({
    name: '',
    category: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    isActive: true,
    userEmail: '',
    userPassword: '',
    userName: '',
  });

  // The list of supplier IDs the admin has narrowed to. Empty array means
  // "all suppliers" — the X-Supplier-Id(s) header is omitted by the axios
  // interceptor and the backend returns aggregate data.
  const selectedSupplierIds = useMemo<string[]>(() => {
    try {
      const raw = localStorage.getItem('selectedSupplierIds');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // For admins, also fetch the supplier roster so we can render the
      // platform-wide KPI cards regardless of current scope.
      // Bypass the 5-min axios cache on getMyOrders/getMyProducts — the
      // dashboard's KPIs (active orders, pending income, etc.) need to
      // reflect newly-created orders and stock changes immediately, not
      // 5 minutes later when the cache TTL expires.
      const ordersPromise = supplierOrdersAPI.getMyOrders({
        limit: 1000,
        supplierBranchIds: activeBranchIds.length > 0 ? activeBranchIds : undefined,
      }, { cache: false });
      const productsPromise = supplierProductsAPI.getMyProducts({ limit: 1000 }, { cache: false });
      const suppliersPromise = isAdmin
        ? suppliersAPI.getAll({ limit: 500 } as any)
        : Promise.resolve(null as any);

      const [ordersRes, productsRes, suppliersRes] = await Promise.all([
        ordersPromise,
        productsPromise,
        suppliersPromise,
      ]);
      setOrders(ordersRes.data.data || []);
      setProducts(productsRes.data.data || []);
      if (suppliersRes) {
        setAllSuppliers((suppliersRes.data?.data || suppliersRes.data?.suppliers || []) as Supplier[]);
      }
    } catch (err: any) {
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Suppliers fetch for their own data; admins fetch even without a
    // user.supplier link.
    if (user?.supplier || isAdmin) {
      const silent = initialFetchDone.current;
      initialFetchDone.current = true;
      fetchData(silent);
    }
  }, [user, activeBranchIds, isAdmin]);

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

  // Admin-only platform metrics. Computed from the suppliers roster + the
  // currently-scoped orders/products. When the admin has narrowed to one or
  // a few suppliers, "in scope" reflects that; "All Suppliers" cards still
  // count the full roster.
  //
  // IMPORTANT: this useMemo must live above the early `if (loading)` return
  // below — otherwise the hook count differs between the loading and loaded
  // renders and React throws #310 ("Rendered more hooks than during the
  // previous render").
  const adminStats = useMemo(() => {
    if (!isAdmin) return null;
    const total = allSuppliers.length;
    const active = allSuppliers.filter(s => (s as any).isActive !== false).length;
    const inactive = total - active;
    const inScope = selectedSupplierIds.length === 0
      ? allSuppliers
      : allSuppliers.filter(s => selectedSupplierIds.includes(String(s.id)));

    // Orders + products are already scoped (header-driven). Group by
    // supplier so we can rank top suppliers by order count regardless of
    // currency mix.
    const ordersBySupplier: Record<string, { id: string; name: string; count: number; revenue: number; currency: string }> = {};
    orders.forEach((o: any) => {
      const sId = String(o.supplierId || o.supplier?.id || 'unknown');
      const sName = o.supplier?.name || 'Unknown supplier';
      const sCurrency = o.supplier?.currency || o.currency || 'KES';
      if (!ordersBySupplier[sId]) {
        ordersBySupplier[sId] = { id: sId, name: sName, count: 0, revenue: 0, currency: sCurrency };
      }
      ordersBySupplier[sId].count += 1;
      if (['RECEIVED', 'COMPLETED'].includes(o.status)) {
        ordersBySupplier[sId].revenue += parseFloat(o.totalAmount?.toString() || '0');
      }
    });
    const topByCount = Object.values(ordersBySupplier)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { total, active, inactive, inScope, topByCount };
  }, [isAdmin, allSuppliers, orders, selectedSupplierIds]);

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
    { id: 'overview',  label: isAdmin ? 'Charts' : 'Overview', icon: BarChart3 },
    // Admin-only: a directory (cards/table) of every supplier in scope.
    ...(isAdmin ? [{ id: 'directory' as Tab, label: 'Suppliers', icon: LayoutGrid }] : []),
    { id: 'wallet',    label: 'Wallet',    icon: Wallet     },
  ];

  return (
    <div className="space-y-5">
      {/* ── Admin: Platform overview ─────────────────────────────────────
          Visible only to SUPER_ADMIN / MERCHANT_ADMIN. Provides a top-level
          read of the supplier landscape and a Create CTA. The rest of the
          dashboard below adapts automatically to the current X-Supplier
          scope (one, many, or all). */}
      {isAdmin && adminStats && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-seafoam text-[10px] font-black uppercase tracking-[0.3em]">Platform · Suppliers</p>
              <h1 className="text-2xl sm:text-3xl font-black text-pine dark:text-zinc-100 tracking-tight">
                {selectedSupplierIds.length === 0
                  ? 'All Suppliers'
                  : selectedSupplierIds.length === 1
                    ? (adminStats.inScope[0]?.name || 'Selected supplier')
                    : `${selectedSupplierIds.length} suppliers in scope`}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                {selectedSupplierIds.length === 0
                  ? 'Showing aggregated metrics across every supplier on the platform.'
                  : 'Use the context switcher in the header to widen or narrow this view.'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
            >
              <Plus size={13} /> New Supplier
            </button>
          </div>

          {/* KPI cards — count-based, currency-agnostic so they hold up across
              mixed-currency suppliers */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-zinc-900 border-2 border-blue-500/20 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Total</p>
                <Truck size={14} className="text-blue-500" />
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">{adminStats.total}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border-2 border-emerald-500/20 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Active</p>
                <CheckCircle2 size={14} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">{adminStats.active}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border-2 border-red-500/20 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Inactive</p>
                <XCircle size={14} className="text-red-500" />
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">{adminStats.inactive}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border-2 border-purple-500/20 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Products</p>
                <PackageIcon size={14} className="text-purple-500" />
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">{products.length}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border-2 border-amber-500/20 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Orders</p>
                <Activity size={14} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black text-pine dark:text-zinc-100">{orders.length}</p>
            </div>
          </div>

          {/* Top suppliers + In-scope list — moved into the Suppliers tab;
              kept here (disabled) for reference. */}
          {false && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-3">
                Top Suppliers · By Order Count
              </h2>
              {adminStats.topByCount.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-xs text-center py-6">No order activity in scope</p>
              ) : (
                <div className="space-y-1.5">
                  {adminStats.topByCount.map((s, i) => {
                    const max = Math.max(...adminStats.topByCount.map(t => t.count));
                    const pct = max > 0 ? (s.count / max) * 100 : 0;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          try {
                            localStorage.setItem('selectedSupplierIds', JSON.stringify([s.id]));
                          } catch {}
                          if (typeof window !== 'undefined') window.location.reload();
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                      >
                        <span className="w-5 text-[10px] font-black text-slate-400">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{s.name}</p>
                          <div className="h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-seafoam" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 dark:text-zinc-400 tabular-nums">
                          {s.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Suppliers in Scope</h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{adminStats.inScope.length}</span>
              </div>
              {adminStats.inScope.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-xs text-center py-6">No suppliers found</p>
              ) : (
                <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                  {adminStats.inScope.slice(0, 50).map(s => (
                    <button
                      key={String(s.id)}
                      onClick={() => {
                        try {
                          localStorage.setItem('selectedSupplierIds', JSON.stringify([String(s.id)]));
                        } catch {}
                        if (typeof window !== 'undefined') window.location.reload();
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-pine dark:text-zinc-100 font-black text-[10px] flex-shrink-0">
                        {(s.name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{s.name}</p>
                        {(s as any).category && (
                          <p className="text-[9px] font-bold uppercase tracking-widest text-seafoam truncate">
                            {(s as any).category}
                          </p>
                        )}
                      </div>
                      {(s as any).isActive === false ? (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Off</span>
                      ) : (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">On</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Currency caveat for cross-supplier views */}
          {selectedSupplierIds.length !== 1 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[10px] text-amber-700 dark:text-amber-400">
              <Globe size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                Aggregated revenue figures below mix per-supplier currencies — narrow to a single supplier in the context switcher for currency-accurate totals.
              </span>
            </div>
          )}
        </div>
      )}

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

      {/* Wallet */}
      {activeTab === 'wallet' && (() => {
        // Suppliers see their own wallet. Admins see the wallet of whichever
        // supplier they've narrowed to in the switcher; if "All" or multi,
        // we show a prompt instead of mixing wallets across currencies.
        const adminSingle = isAdmin && selectedSupplierIds.length === 1
          ? allSuppliers.find(s => String(s.id) === selectedSupplierIds[0])
          : null;
        const supplierForWallet = user?.supplier || adminSingle;
        if (supplierForWallet) {
          return <SupplierWallet supplier={supplierForWallet as any} />;
        }
        return (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
            <Wallet size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">
              {isAdmin
                ? 'Pick a single supplier in the context switcher to view its wallet'
                : 'Supplier profile not found'}
            </p>
          </div>
        );
      })()}

      {/* Suppliers directory (admin) — cards / table of every supplier */}
      {activeTab === 'directory' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{allSuppliers.length} supplier{allSuppliers.length === 1 ? '' : 's'}</p>
            <div className="flex bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shrink-0">
              {([['cards', LayoutGrid], ['table', TableIcon]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setSupplierDirView(v)} title={v === 'cards' ? 'Card view' : 'Table view'} className={`px-3 py-2 rounded-lg transition-all ${supplierDirView === v ? 'bg-seafoam text-white' : 'text-slate-400 hover:text-pine'}`}><Icon size={15} /></button>
              ))}
            </div>
          </div>
          {allSuppliers.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center text-sm text-slate-400">No suppliers yet.</div>
          ) : supplierDirView === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allSuppliers.map((s: any) => (
                <button key={s.id} onClick={() => setView?.('supplier-detail', { supplierId: String(s.id) })}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm text-left hover:border-seafoam/50 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-pine dark:text-zinc-100 truncate">{s.name}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${s.isActive !== false ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{s.isActive !== false ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 truncate">{s.category || 'Uncategorised'}</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5 truncate">{s.contactEmail || s.email || s.phone || '—'}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSuppliers.map((s: any) => (
                      <tr key={s.id} onClick={() => setView?.('supplier-detail', { supplierId: String(s.id) })} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors">
                        <td className="px-4 py-3 font-bold text-pine dark:text-zinc-100 truncate max-w-[200px]">{s.name}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{s.category || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 truncate max-w-[200px]">{s.contactEmail || s.email || s.phone || '—'}</td>
                        <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black ${s.isActive !== false ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{s.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Supplier modal — admin-only */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-pine dark:text-zinc-100">Create Supplier</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                aria-label="Close"
              >
                <Plus size={18} className="rotate-45" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!createForm.name || !createForm.category || !createForm.contactEmail) {
                  toast.error('Name, category, and contact email are required');
                  return;
                }
                setCreating(true);
                try {
                  const payload: CreateSupplierData = {
                    name: createForm.name.trim(),
                    category: createForm.category.trim(),
                    contactEmail: createForm.contactEmail.trim(),
                    contactPhone: createForm.contactPhone?.trim() || undefined,
                    address: createForm.address?.trim() || undefined,
                    isActive: createForm.isActive,
                    userEmail: createForm.userEmail?.trim() || undefined,
                    userPassword: createForm.userPassword || undefined,
                    userName: createForm.userName?.trim() || undefined,
                  };
                  const res = await suppliersAPI.create(payload);
                  if (res.success) {
                    toast.success(`Supplier "${createForm.name}" created`);
                    setShowCreateModal(false);
                    setCreateForm({
                      name: '', category: '', contactEmail: '', contactPhone: '',
                      address: '', isActive: true,
                      userEmail: '', userPassword: '', userName: '',
                    });
                    // Re-fetch the supplier roster so the new one appears in the
                    // platform-overview cards immediately.
                    fetchData(true);
                  }
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Failed to create supplier');
                } finally {
                  setCreating(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Business Name *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Category *</label>
                  <input
                    type="text"
                    value={createForm.category}
                    onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                    placeholder="Pharmaceuticals, Equipment…"
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Contact Email *</label>
                  <input
                    type="email"
                    value={createForm.contactEmail}
                    onChange={e => setCreateForm({ ...createForm, contactEmail: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Contact Phone</label>
                  <input
                    type="tel"
                    value={createForm.contactPhone || ''}
                    onChange={e => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Address</label>
                  <input
                    type="text"
                    value={createForm.address || ''}
                    onChange={e => setCreateForm({ ...createForm, address: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                <p className="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Owner Account (optional)</p>
                <p className="text-[10px] text-slate-400 mb-3">Provide credentials to also create a SUPPLIER login. Skip to create the supplier without an associated user.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Owner Name</label>
                    <input
                      type="text"
                      value={createForm.userName || ''}
                      onChange={e => setCreateForm({ ...createForm, userName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Login Email</label>
                    <input
                      type="email"
                      value={createForm.userEmail || ''}
                      onChange={e => setCreateForm({ ...createForm, userEmail: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest">Password</label>
                    <div className="relative">
                      <input
                        type={showCreatePassword ? 'text' : 'password'}
                        value={createForm.userPassword || ''}
                        onChange={e => setCreateForm({ ...createForm, userPassword: e.target.value })}
                        autoComplete="new-password"
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg pl-3 pr-10 py-2 text-sm text-pine dark:text-zinc-100 font-medium outline-none focus:ring-2 focus:ring-seafoam/20"
                      />
                      <button type="button" onClick={() => setShowCreatePassword((v) => !v)} aria-label={showCreatePassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                        {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierDashboard;

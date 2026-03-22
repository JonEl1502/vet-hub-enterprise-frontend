import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Eye,
  X,
  Building2,
  MoreVertical,
} from 'lucide-react';
import { DateRangePicker, DateRange } from './DateRangePicker';
import { supplierOrdersAPI } from '../services/modules/supplierOrders.api';
import type { PurchaseOrder } from '../services/modules/purchaseOrders.api';
import { toast } from '../services/utils/toast';
import { cache } from '../services/utils/cache';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT:              { bg: 'bg-slate-100 dark:bg-slate-800/60',     text: 'text-slate-500 dark:text-zinc-400' },
  SUBMITTED:          { bg: 'bg-amber-100 dark:bg-amber-500/10',     text: 'text-amber-700 dark:text-amber-400' },
  APPROVED:           { bg: 'bg-blue-100 dark:bg-blue-500/10',       text: 'text-blue-700 dark:text-blue-400' },
  ORDERED:            { bg: 'bg-purple-100 dark:bg-purple-500/10',   text: 'text-purple-700 dark:text-purple-400' },
  PARTIALLY_RECEIVED: { bg: 'bg-cyan-100 dark:bg-cyan-500/10',       text: 'text-cyan-700 dark:text-cyan-400' },
  RECEIVED:           { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
  COMPLETED:          { bg: 'bg-green-100 dark:bg-green-500/10',     text: 'text-green-700 dark:text-green-400' },
  CANCELLED:          { bg: 'bg-red-100 dark:bg-red-500/10',         text: 'text-red-700 dark:text-red-400' },
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

// Status transitions a supplier can trigger
const SUPPLIER_STATUS_ACTIONS: Record<string, { label: string; next: 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' }[]> = {
  APPROVED:  [{ label: 'Mark as Ordered', next: 'ORDERED' }],
  ORDERED:   [{ label: 'Mark Partially Received', next: 'PARTIALLY_RECEIVED' }, { label: 'Mark Received', next: 'RECEIVED' }],
  PARTIALLY_RECEIVED: [{ label: 'Mark Fully Received', next: 'RECEIVED' }],
};

interface SupplierOrdersViewProps {
  setView?: (view: string, params?: any) => void;
}

const SupplierOrdersView: React.FC<SupplierOrdersViewProps> = ({ setView }) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-order-menu]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenuId]);

  const ORDERS_CACHE_KEY = '/supplier-orders';
  const ORDERS_CACHE_PARAMS = { limit: 500 };

  const fetchOrders = async (silent = false) => {
    const cached = cache.get<PurchaseOrder[]>(ORDERS_CACHE_KEY, ORDERS_CACHE_PARAMS);
    if (cached) {
      setOrders(cached);
      setLoading(false);
      if (!silent) return;
    }
    if (!cached && !silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      const res = await supplierOrdersAPI.getMyOrders({ limit: 500 });
      const data = res.data.data || [];
      cache.set(ORDERS_CACHE_KEY, data, ORDERS_CACHE_PARAMS, 30 * 60 * 1000);
      setOrders(data);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Unique branches from orders
  const branches = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o: any) => {
      if (o.clinic?.id && o.clinic?.name) map.set(String(o.clinic.id), o.clinic.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o: any) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (branchFilter !== 'ALL' && String(o.clinic?.id) !== branchFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const idMatch = String(o.id).includes(q);
        const branchMatch = o.clinic?.name?.toLowerCase().includes(q);
        if (!idMatch && !branchMatch) return false;
      }
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
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, statusFilter, branchFilter, search, dateRange]);

  // Summary chips
  const summary = useMemo(() => {
    const active = orders.filter(o => ['SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(o.status)).length;
    const completed = orders.filter(o => ['RECEIVED', 'COMPLETED'].includes(o.status)).length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
    return { active, completed, cancelled, total: orders.length };
  }, [orders]);

  const handleStatusUpdate = async (orderId: string, next: 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED') => {
    setUpdatingId(orderId);
    try {
      const res = await supplierOrdersAPI.updateStatus(Number(orderId), { status: next });
      const updated = (res.data as any).purchaseOrder;
      const next_orders = orders.map(o => String(o.id) === orderId ? { ...o, status: updated.status } : o);
      cache.invalidatePattern(/supplier-orders/);
      cache.set('/supplier-orders', next_orders, { limit: 500 });
      setOrders(next_orders);
      toast.success(`Order marked as ${STATUS_LABELS[next]}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const hasActiveFilters = search || (dateRange?.start || dateRange?.end) || statusFilter !== 'ALL' || branchFilter !== 'ALL';

  return (
    <div className="space-y-4">
      {/* Filter card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">

        {/* Row 1: search + date range */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search order ID or branch…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/40 placeholder-slate-400 dark:placeholder-zinc-600"
            />
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Row 2: selects + summary chips + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          >
            <option value="ALL">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
            >
              <option value="ALL">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setDateRange(null); setStatusFilter('ALL'); setBranchFilter('ALL'); }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
          {/* Summary chips */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="px-2 py-1 bg-amber-50 dark:bg-amber-500/10 rounded-full text-[10px] font-semibold text-amber-700 dark:text-amber-400">{summary.active} Active</span>
            <span className="px-2 py-1 bg-green-50 dark:bg-green-500/10 rounded-full text-[10px] font-semibold text-green-700 dark:text-green-400">{summary.completed} Done</span>
            <span className="px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded-full text-[10px] font-semibold text-red-700 dark:text-red-400">{summary.cancelled} Cancelled</span>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
            title="Refresh"
          >
            <RefreshCw size={13} className={`text-slate-500 dark:text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <ShoppingCart size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">No orders found</p>
          {summary.total === 0 && (
            <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Orders from clinics will appear here</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((o: any) => {
            const s = STATUS_COLORS[o.status] || STATUS_COLORS.DRAFT;
            const isUpdating = updatingId === String(o.id);
            const statusActions = SUPPLIER_STATUS_ACTIONS[o.status] || [];
            const isMenuOpen = openMenuId === String(o.id);
            return (
              <div key={o.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-visible">
                {/* Card header: info left, action menu top-right */}
                <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-zinc-800 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0">
                      <Building2 size={14} className="text-seafoam" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-pine dark:text-zinc-100 text-sm leading-tight truncate">{o.clinic?.name || '—'}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">#{String(o.id).slice(-8).toUpperCase()}</p>
                    </div>
                  </div>

                  {/* Status badge + ⋮ menu */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${s.bg} ${s.text}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                    <div className="relative" data-order-menu>
                      <button
                        onClick={() => setOpenMenuId(isMenuOpen ? null : String(o.id))}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 transition-all"
                      >
                        {isUpdating
                          ? <RefreshCw size={13} className="animate-spin text-seafoam" />
                          : <MoreVertical size={13} />}
                      </button>
                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-30 min-w-[160px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 overflow-hidden">

                          <button
                            onClick={() => { setView?.('supplier-order-detail', { orderId: o.id }); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
                          >
                            <Eye size={12} className="text-slate-400" /> View Order
                          </button>
                          {statusActions.length > 0 && (
                            <div className="border-t border-slate-100 dark:border-zinc-800 mt-1 pt-1">
                              {statusActions.map(a => (
                                <button
                                  key={a.next}
                                  disabled={isUpdating}
                                  onClick={() => { handleStatusUpdate(String(o.id), a.next); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-pine dark:text-zinc-100 hover:bg-seafoam/10 dark:hover:bg-seafoam/10 transition-all disabled:opacity-50"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-seafoam shrink-0" />
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card body: label left, value right */}
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date</span>
                    <div className="text-xs text-right">
                      <span className="font-semibold text-slate-600 dark:text-zinc-300">{new Date(o.createdAt).toLocaleDateString()}</span>
                      <span className="ml-1.5 text-slate-400 dark:text-zinc-500 opacity-80">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Items</span>
                    <span className="text-sm font-bold text-pine dark:text-zinc-100">{o.items?.length ?? o._count?.items ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</span>
                    <span className="font-black text-pine dark:text-zinc-100 text-sm font-mono">
                      ${parseFloat(o.totalAmount?.toString() || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more note */}
      {filtered.length > 0 && (
        <p className="text-center text-xs text-slate-400 dark:text-zinc-600 pb-2">
          Showing {filtered.length} of {orders.length} orders
        </p>
      )}
    </div>
  );
};

export default SupplierOrdersView;

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  RefreshCw,
  ChevronDown,
  Eye,
  X,
  Building2
} from 'lucide-react';
import { supplierOrdersAPI } from '../services/modules/supplierOrders.api';
import type { PurchaseOrder } from '../services/modules/purchaseOrders.api';
import { toast } from '../services/utils/toast';

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
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');

  // Inline status update
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await supplierOrdersAPI.getMyOrders({ limit: 500 });
      setOrders(res.data.data || []);
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
      return true;
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, statusFilter, branchFilter, search]);

  // Summary chips
  const summary = useMemo(() => {
    const active = orders.filter(o => ['SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(o.status)).length;
    const completed = orders.filter(o => ['RECEIVED', 'COMPLETED'].includes(o.status)).length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;
    return { active, completed, cancelled, total: orders.length };
  }, [orders]);

  const handleStatusUpdate = async (orderId: string, next: 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED') => {
    setUpdatingId(orderId);
    setOpenActionMenu(null);
    try {
      const res = await supplierOrdersAPI.updateStatus(Number(orderId), { status: next });
      const updated = (res.data as any).purchaseOrder;
      setOrders(prev => prev.map(o => String(o.id) === orderId ? { ...o, status: updated.status } : o));
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

  return (
    <div className="space-y-4">
      {/* Header + Summary chips */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Incoming Orders</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-semibold">{summary.total} total orders</p>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="self-start sm:self-auto p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
            title="Refresh"
          >
            <RefreshCw size={15} className={`text-slate-500 dark:text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-[11px] font-black text-amber-700 dark:text-amber-400">{summary.active} Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-500/10 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-[11px] font-black text-green-700 dark:text-green-400">{summary.completed} Completed</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className="text-[11px] font-black text-red-700 dark:text-red-400">{summary.cancelled} Cancelled</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search order ID or branch..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-400 dark:placeholder-zinc-600"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
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
            className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
          >
            <option value="ALL">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {(search || statusFilter !== 'ALL' || branchFilter !== 'ALL') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('ALL'); setBranchFilter('ALL'); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 ml-auto">
          {filtered.length} orders
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">No orders found</p>
            {summary.total === 0 && (
              <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Orders from clinics will appear here</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800">
                  <th className="text-left px-4 py-3">Order</th>
                  <th className="text-left px-4 py-3">
                    <span className="flex items-center gap-1.5"><Building2 size={10} />Branch</span>
                  </th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Items</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/60">
                {filtered.map((order: any) => {
                  const statusStyle = STATUS_COLORS[order.status] || STATUS_COLORS.DRAFT;
                  const actions = SUPPLIER_STATUS_ACTIONS[order.status] || [];
                  const isUpdating = updatingId === String(order.id);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-black text-pine dark:text-zinc-100 text-xs font-mono">
                          #{String(order.id).slice(-8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-seafoam/10 flex items-center justify-center flex-shrink-0">
                            <Building2 size={11} className="text-seafoam" />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 truncate max-w-[120px]">
                            {order.clinic?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-500">
                        <div>
                          <p className="font-semibold">{new Date(order.createdAt).toLocaleDateString()}</p>
                          <p className="text-[10px] opacity-70">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${statusStyle.bg} ${statusStyle.text}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-zinc-400 font-semibold">
                        {order.items?.length ?? order._count?.items ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-pine dark:text-zinc-100 text-sm">
                        ${parseFloat(order.totalAmount?.toString() || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View detail */}
                          <button
                            onClick={() => setView?.('supplier-order-detail', { orderId: order.id })}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100"
                            title="View detail"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Status action dropdown */}
                          {actions.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={() => setOpenActionMenu(prev => prev === String(order.id) ? null : String(order.id))}
                                disabled={isUpdating}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase text-white bg-pine dark:bg-zinc-100 dark:text-pine rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                              >
                                {isUpdating ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <>Update <ChevronDown size={10} /></>
                                )}
                              </button>

                              {openActionMenu === String(order.id) && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenActionMenu(null)} />
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-100">
                                    {actions.map(action => (
                                      <button
                                        key={action.next}
                                        onClick={() => handleStatusUpdate(String(order.id), action.next)}
                                        className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 text-pine dark:text-zinc-200 transition-colors"
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

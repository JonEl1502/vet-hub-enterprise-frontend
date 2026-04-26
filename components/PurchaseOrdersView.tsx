import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Package, FileText, CheckCircle, XCircle, Eye, Edit, Trash2, Send, PackageCheck, CheckCheck, SlidersHorizontal, X, MoreVertical, RefreshCw, Building2 } from 'lucide-react';
import { purchaseOrderAPI, PurchaseOrder, PurchaseOrderStatus, suppliersAPI, Supplier as APISupplier, toast, dialog } from '../services';
import { Clinic } from '../types';
import { DateRangePicker, DateRange } from './DateRangePicker';

interface Props {
  clinic: Clinic;
  onViewPurchaseOrder: (id: string) => void;
  onCreatePurchaseOrder: () => void;
  onEditPurchaseOrder: (id: string) => void;
}

const PurchaseOrdersView: React.FC<Props> = ({ clinic, onViewPurchaseOrder, onCreatePurchaseOrder, onEditPurchaseOrder }) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<APISupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'ALL'>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [minItems, setMinItems] = useState('');
  const [maxItems, setMaxItems] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Action menu state — single global fixed-positioned menu (escapes overflow-hidden & opacity containers)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ x: rect.right, y: rect.bottom + 4 });
    setOpenMenuId(prev => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeTimerRef.current = setTimeout(() => setOpenMenuId(null), 800);
      }
    };
    const closeOnScroll = () => setOpenMenuId(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', closeOnScroll, true);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [openMenuId]);

  // Fetch purchase orders — bypassCache=true forces a live API call, skipping any response cache
  const fetchPurchaseOrders = async (bypassCache = false) => {
    setLoading(true);
    try {
      const filters: any = { limit: 100 };
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (supplierFilter !== 'ALL') filters.supplierId = supplierFilter;
      if (searchQuery) filters.search = searchQuery;
      if (dateRange?.start) filters.dateFrom = dateRange.start.toISOString().split('T')[0];
      if (dateRange?.end) filters.dateTo = dateRange.end.toISOString().split('T')[0];

      const response = await purchaseOrderAPI.getAll(filters, bypassCache ? { cache: false } : undefined);
      setPurchaseOrders(response.data.data || []);
    } catch (error: any) {
      console.error('[PurchaseOrdersView] Failed to load purchase orders:', error);
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      const response = await suppliersAPI.getAll({ limit: 100 });
      setSuppliers(response.data.data || []);
    } catch (error: any) {
      console.error('[PurchaseOrdersView] Failed to load suppliers:', error);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  useEffect(() => {
    const t = setTimeout(fetchPurchaseOrders, searchQuery ? 300 : 0);
    return () => clearTimeout(t);
  }, [statusFilter, supplierFilter, searchQuery, dateRange]);

  // Client-side filter
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const matchesSearch = searchQuery === '' ||
        po.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase());

      const itemCount = po._count?.items ?? po.items?.length ?? 0;
      const matchesMinItems = minItems === '' || itemCount >= parseInt(minItems);
      const matchesMaxItems = maxItems === '' || itemCount <= parseInt(maxItems);

      let amount = Number(po.totalAmount ?? 0);
      if (isNaN(amount) && po.totalAmount && typeof po.totalAmount === 'object' && (po.totalAmount as any).d) {
        const v = po.totalAmount as any;
        const digits = String(v.d[0]);
        amount = v.s * v.d[0] * Math.pow(10, v.e - (digits.length - 1));
      }
      const matchesMinAmount = minAmount === '' || (isNaN(amount) ? false : amount >= parseFloat(minAmount));
      const matchesMaxAmount = maxAmount === '' || (isNaN(amount) ? false : amount <= parseFloat(maxAmount));

      return matchesSearch && matchesMinItems && matchesMaxItems && matchesMinAmount && matchesMaxAmount;
    });
  }, [purchaseOrders, searchQuery, minItems, maxItems, minAmount, maxAmount]);

  const fmtAmount = (val: any) => {
    let n = Number(val ?? 0);
    if (isNaN(n) && val && typeof val === 'object' && val.d) {
      const v = val as any;
      const digits = String(v.d[0]);
      n = v.s * v.d[0] * Math.pow(10, v.e - (digits.length - 1));
    }
    return isNaN(n) ? '0.00' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const hasActiveFilters = statusFilter !== 'ALL' || supplierFilter !== 'ALL' || dateRange || minItems || maxItems || minAmount || maxAmount;

  const clearFilters = () => {
    setStatusFilter('ALL');
    setSupplierFilter('ALL');
    setDateRange(null);
    setMinItems('');
    setMaxItems('');
    setMinAmount('');
    setMaxAmount('');
  };

  // Calculate stats
  const stats = useMemo(() => ({
    draft:     purchaseOrders.filter(po => po.status === 'DRAFT').length,
    submitted: purchaseOrders.filter(po => po.status === 'SUBMITTED').length,
    approved:  purchaseOrders.filter(po => po.status === 'APPROVED').length,
    ordered:   purchaseOrders.filter(po => po.status === 'ORDERED').length,
    received:  purchaseOrders.filter(po => po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED').length,
    paid:      purchaseOrders.filter(po => po.status === 'PAID').length,
    completed: purchaseOrders.filter(po => po.status === 'COMPLETED').length,
    total:     purchaseOrders.length,
  }), [purchaseOrders]);

  // Status badge
  const getStatusBadge = (status: PurchaseOrderStatus) => {
    const badges: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
      DRAFT:              { label: 'Draft',     color: 'text-slate-500',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   icon: <FileText size={12} /> },
      SUBMITTED:          { label: 'Submitted', color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: <Send size={12} /> },
      APPROVED:           { label: 'Approved',  color: 'text-green-500',   bg: 'bg-green-500/10',   border: 'border-green-500/20',   icon: <CheckCircle size={12} /> },
      ORDERED:            { label: 'Ordered',   color: 'text-purple-500',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: <PackageCheck size={12} /> },
      PARTIALLY_RECEIVED: { label: 'Partial',   color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: <PackageCheck size={12} /> },
      RECEIVED:           { label: 'Received',  color: 'text-cyan-500',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    icon: <CheckCircle size={12} /> },
      PAID:               { label: 'Paid',      color: 'text-teal-600',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    icon: <CheckCheck size={12} /> },
      COMPLETED:          { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <CheckCheck size={12} /> },
      CANCELLED:          { label: 'Cancelled', color: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: <XCircle size={12} /> },
    };
    const badge = badges[status] ?? badges['DRAFT'];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black border uppercase tracking-widest ${badge.bg} ${badge.color} ${badge.border}`}>
        {badge.icon}{badge.label}
      </span>
    );
  };

  // Actions
  const handlePlaceOrder = async (id: string) => {
    setOpenMenuId(null);
    try {
      await purchaseOrderAPI.updateStatus(id, 'SUBMITTED');
      toast.success('Order submitted for approval');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit order');
    }
  };

  const handleApprove = async (id: string) => {
    setOpenMenuId(null);
    try {
      await purchaseOrderAPI.updateStatus(id, 'APPROVED');
      toast.success('Order approved');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve order');
    }
  };

  const handleCancel = async (id: string) => {
    setOpenMenuId(null);
    const ok = await dialog.confirm({
      title: 'Cancel purchase order',
      message: 'Are you sure you want to cancel this purchase order?',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await purchaseOrderAPI.updateStatus(id, 'CANCELLED');
      toast.success('Purchase order cancelled successfully');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel purchase order');
    }
  };

  const handleDelete = async (id: string) => {
    setOpenMenuId(null);
    const ok = await dialog.confirmDelete({
      title: 'Delete Purchase Order',
      message: 'This will permanently remove the purchase order. This action cannot be undone.',
      entityName: `PO #${id}`,
    });
    if (!ok) return;
    try {
      await purchaseOrderAPI.delete(id);
      toast.success('Purchase order deleted successfully');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete purchase order');
    }
  };

  // Shared action menu items for a given PO
  const ActionMenu = ({ po }: { po: PurchaseOrder }) => (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: menuPos.y, right: `calc(100vw - ${menuPos.x}px)` }}
      className="w-44 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <button onClick={() => { setOpenMenuId(null); onViewPurchaseOrder(po.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
        <Eye size={12} /> View
      </button>
      {po.status === 'DRAFT' && (<>
        <button onClick={() => { setOpenMenuId(null); onEditPurchaseOrder(po.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
          <Edit size={12} /> Edit
        </button>
        <button onClick={() => handlePlaceOrder(po.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
          <Send size={12} /> Place Order
        </button>
      </>)}
      {po.status === 'SUBMITTED' && (
        <button onClick={() => handleApprove(po.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors">
          <CheckCircle size={12} /> Approve
        </button>
      )}
      {(po.status === 'DRAFT' || po.status === 'SUBMITTED' || po.status === 'APPROVED') && (
        <button onClick={() => handleCancel(po.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-t border-slate-100 dark:border-zinc-800">
          <XCircle size={12} /> Cancel
        </button>
      )}
      {po.status === 'DRAFT' && (
        <button onClick={() => handleDelete(po.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-t border-slate-100 dark:border-zinc-800">
          <Trash2 size={12} /> Delete
        </button>
      )}
    </div>
  );

  const selectCls = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold';
  const inputCls = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold';
  const labelCls = 'text-[9px] font-black uppercase tracking-widest text-slate-400';

  const activePo = openMenuId ? purchaseOrders.find(p => p.id === openMenuId) : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* Filters card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
        {/* Clinic badge + Clear */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-seafoam/10 rounded-lg border border-seafoam/20">
            <Building2 size={11} className="text-seafoam shrink-0" />
            <span className="text-[10px] font-black text-seafoam truncate max-w-[140px]">{clinic.name}</span>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors">
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Row 1 — Search (full width) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam" size={15} />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
          />
        </div>

        {/* Row 2 — Date picker (full width) */}
        <div className="flex items-center gap-2 w-full">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            className="w-full"
            buttonClassName="w-full justify-between"
          />
        </div>

        {/* Row 3 — Status + New Order + Reload */}
        <div className="flex items-center gap-2 flex-nowrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'ALL')}
            className="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
          >
            <option value="ALL">All ({stats.total})</option>
            <option value="DRAFT">Draft ({stats.draft})</option>
            <option value="SUBMITTED">Submitted ({stats.submitted})</option>
            <option value="APPROVED">Approved ({stats.approved})</option>
            <option value="ORDERED">Ordered ({stats.ordered})</option>
            <option value="RECEIVED">Received ({stats.received})</option>
            <option value="PAID">Paid ({stats.paid})</option>
            <option value="COMPLETED">Completed ({stats.completed})</option>
          </select>
          <button onClick={onCreatePurchaseOrder} className="shrink-0 bg-pine dark:bg-zinc-100 text-white dark:text-pine px-4 sm:px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap">
            <Plus size={14} /> <span className="hidden sm:inline">New Order</span><span className="sm:hidden">New</span>
          </button>
          <button
            onClick={() => fetchPurchaseOrders(true)}
            disabled={loading}
            className="shrink-0 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-pine dark:hover:border-zinc-500 transition-all disabled:opacity-50"
            title="Refresh orders"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Advanced filters — Supplier + Items + Amount */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className={labelCls}>Supplier</label>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={selectCls}>
              <option value="ALL">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Min Items</label>
            <input type="number" min={0} placeholder="0" value={minItems} onChange={(e) => setMinItems(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Max Items</label>
            <input type="number" min={0} placeholder="Any" value={maxItems} onChange={(e) => setMaxItems(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Min Amount</label>
            <input type="number" min={0} placeholder="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Max Amount</label>
            <input type="number" min={0} placeholder="Any" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Purchase Orders */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">🐾</div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading purchase orders...</p>
          </div>
        </div>
      ) : filteredPurchaseOrders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Package className="mx-auto mb-4 text-slate-300" size={48} />
            <p className="text-slate-400 font-bold mb-2">No purchase orders found</p>
            <button onClick={onCreatePurchaseOrder} className="text-seafoam hover:text-pine font-bold text-sm">Create your first purchase order</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredPurchaseOrders.map(po => (
            <div key={po.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
                <button onClick={() => onViewPurchaseOrder(po.id)} className="font-black text-pine dark:text-zinc-100 hover:text-seafoam transition-colors text-sm uppercase tracking-widest">
                  {po.orderNumber}
                </button>
                <div className="flex items-center gap-2">
                  {getStatusBadge(po.status)}
                  <button
                    onClick={(e) => openMenu(e, po.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    <MoreVertical size={15} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {[
                  { label: 'Supplier', value: <><div className="font-bold text-pine dark:text-zinc-100 text-sm">{po.supplier?.name || 'Unknown'}</div>{po.supplier?.category && <div className="text-[10px] text-slate-400 uppercase tracking-wide">{po.supplier.category}</div>}</> },
                  { label: 'Items', value: <span className="text-sm font-bold text-pine dark:text-zinc-100">{po._count?.items ?? po.items?.length ?? 0}<span className="text-slate-400 font-normal ml-1">items</span></span> },
                  { label: 'Total', value: <span className="text-sm font-bold text-pine dark:text-zinc-100">{clinic.currency || 'KES'} {fmtAmount(po.totalAmount)}</span> },
                  { label: 'Created', value: <span className="text-sm text-slate-600 dark:text-zinc-400">{new Date(po.createdAt).toLocaleDateString()}</span> },
                  { label: 'Expected', value: <span className="text-sm text-slate-600 dark:text-zinc-400">{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : '—'}</span> },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-24 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</div>
                    <div className="flex-1">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global action menu — rendered at root level to escape opacity/overflow containers */}
      {activePo && (
        <ActionMenu po={activePo} />
      )}
    </div>
  );
};

export default PurchaseOrdersView;

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Filter, Package, FileText, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, Eye, Edit, Trash2, Send, ThumbsUp, PackageCheck, CheckCheck } from 'lucide-react';
import { purchaseOrderAPI, PurchaseOrder, PurchaseOrderStatus, suppliersAPI, Supplier as APISupplier, toast } from '../services';
import { Clinic } from '../types';

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
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Fetch purchase orders
  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const filters: any = { limit: 100 };
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (supplierFilter !== 'ALL') filters.supplierId = supplierFilter;
      if (searchQuery) filters.search = searchQuery;

      const response = await purchaseOrderAPI.getAll(filters);
      console.log('[PurchaseOrdersView] Purchase orders fetched:', response.data.data);
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
      // Check localStorage cache for suppliers
      const cachedSuppliers = localStorage.getItem('vethub-suppliers');
      const cacheTimestamp = localStorage.getItem('vethub-suppliers-timestamp');
      const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

      if (cachedSuppliers && cacheAge < CACHE_DURATION) {
        console.log('[PurchaseOrdersView] Using cached suppliers');
        const suppliersList = JSON.parse(cachedSuppliers);
        setSuppliers(suppliersList);
        return;
      }

      console.log('[PurchaseOrdersView] Fetching suppliers from API...');
      const response = await suppliersAPI.getAll({ limit: 100 });
      const suppliersList = response.data.data || [];
      setSuppliers(suppliersList);

      // Cache suppliers in localStorage
      localStorage.setItem('vethub-suppliers', JSON.stringify(suppliersList));
      localStorage.setItem('vethub-suppliers-timestamp', Date.now().toString());
    } catch (error: any) {
      console.error('[PurchaseOrdersView] Failed to load suppliers:', error);
    }
  };

  // Fetch suppliers only once on mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Fetch purchase orders when filters or search change (with debounce for search)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPurchaseOrders();
    }, searchQuery ? 300 : 0); // Debounce only for search, immediate for filters

    return () => clearTimeout(delayDebounceFn);
  }, [statusFilter, supplierFilter, searchQuery]);

  // Filter purchase orders
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const matchesSearch = searchQuery === '' || 
        po.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [purchaseOrders, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      draft: purchaseOrders.filter(po => po.status === 'DRAFT').length,
      submitted: purchaseOrders.filter(po => po.status === 'SUBMITTED').length,
      approved: purchaseOrders.filter(po => po.status === 'APPROVED').length,
      received: purchaseOrders.filter(po => po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED').length,
      total: purchaseOrders.length,
    };
  }, [purchaseOrders]);

  // Get status badge
  const getStatusBadge = (status: PurchaseOrderStatus) => {
    const badges = {
      DRAFT: { label: 'Draft', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: <FileText size={12} /> },
      SUBMITTED: { label: 'Submitted', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Send size={12} /> },
      APPROVED: { label: 'Approved', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <ThumbsUp size={12} /> },
      ORDERED: { label: 'Ordered', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Clock size={12} /> },
      PARTIALLY_RECEIVED: { label: 'Partial', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <PackageCheck size={12} /> },
      RECEIVED: { label: 'Received', color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: <CheckCircle size={12} /> },
      COMPLETED: { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <CheckCheck size={12} /> },
      CANCELLED: { label: 'Cancelled', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <XCircle size={12} /> },
    };
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black border uppercase tracking-widest ${badge.bg} ${badge.color} ${badge.border}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  // Handle actions
  const handleSubmit = async (id: string) => {
    try {
      await purchaseOrderAPI.submit(id);
      toast.success('Purchase order submitted successfully');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit purchase order');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await purchaseOrderAPI.approve(id);
      toast.success('Purchase order approved successfully');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve purchase order');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this purchase order?')) return;
    try {
      await purchaseOrderAPI.cancel(id);
      toast.success('Purchase order cancelled successfully');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel purchase order');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) return;
    try {
      await purchaseOrderAPI.delete(id);
      toast.success('Purchase order deleted successfully');
      fetchPurchaseOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete purchase order');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Purchase Orders</h1>
          <p className="text-seafoam dark:text-zinc-400 font-medium mt-1 uppercase text-[9px] tracking-widest font-black">Manage supplier orders and inventory restocking</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={18}/>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-6 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-72 transition-all font-bold shadow-sm"
            />
          </div>
          <button onClick={onCreatePurchaseOrder} className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-2">
            <Plus size={16} /> New Order
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <button onClick={() => setStatusFilter('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'ALL' ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg' : 'bg-white dark:bg-zinc-900 text-slate-400 border border-slate-200 dark:border-zinc-800'}`}>
            All ({stats.total})
          </button>
          <button onClick={() => setStatusFilter('DRAFT')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'DRAFT' ? 'bg-slate-500 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 text-slate-400 border border-slate-200 dark:border-zinc-800'}`}>
            Draft ({stats.draft})
          </button>
          <button onClick={() => setStatusFilter('SUBMITTED')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'SUBMITTED' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 text-slate-400 border border-slate-200 dark:border-zinc-800'}`}>
            Submitted ({stats.submitted})
          </button>
          <button onClick={() => setStatusFilter('APPROVED')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'APPROVED' ? 'bg-green-500 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 text-slate-400 border border-slate-200 dark:border-zinc-800'}`}>
            Approved ({stats.approved})
          </button>
          <button onClick={() => setStatusFilter('RECEIVED')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'RECEIVED' ? 'bg-cyan-500 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 text-slate-400 border border-slate-200 dark:border-zinc-800'}`}>
            Received ({stats.received})
          </button>
        </div>

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
        >
          <option value="ALL">All Suppliers</option>
          {suppliers.map(supplier => (
            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
          ))}
        </select>
      </div>

      {/* Purchase Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">
              🐾
            </div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading purchase orders...</p>
          </div>
        </div>
      ) : filteredPurchaseOrders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Package className="mx-auto mb-4 text-slate-300" size={48} />
            <p className="text-slate-400 font-bold mb-2">No purchase orders found</p>
            <button onClick={onCreatePurchaseOrder} className="text-seafoam hover:text-pine font-bold text-sm">
              Create your first purchase order
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Order #</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Supplier</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Items</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Created</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Expected</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {filteredPurchaseOrders.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors overflow-visible">
                    <td className="px-6 py-4">
                      <button onClick={() => onViewPurchaseOrder(po.id)} className="font-black text-pine dark:text-zinc-100 hover:text-seafoam transition-colors">
                        {po.orderNumber}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-pine dark:text-zinc-100">{po.supplier?.name || 'Unknown'}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{po.supplier?.category || ''}</div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(po.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-pine dark:text-zinc-100">{po._count?.items ?? po.items?.length ?? 0}</span>
                      <span className="text-[10px] text-slate-400 ml-1">items</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-pine dark:text-zinc-100">KES {(po.totalAmount || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-zinc-400">{new Date(po.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-zinc-400">{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-right overflow-visible">
                      <div className="relative inline-block overflow-visible">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === po.id ? null : po.id)}
                          className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                          Actions <ChevronDown size={14} />
                        </button>
                        {actionMenuOpen === po.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setActionMenuOpen(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden">
                              <button onClick={() => { onViewPurchaseOrder(po.id); setActionMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                <Eye size={14} /> View Details
                              </button>
                              {po.status === 'DRAFT' && (
                                <>
                                  <button onClick={() => { onEditPurchaseOrder(po.id); setActionMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                    <Edit size={14} /> Edit
                                  </button>
                                  <button onClick={() => { handleSubmit(po.id); setActionMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm font-bold text-blue-500 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                    <Send size={14} /> Submit
                                  </button>
                                  <button onClick={() => { handleDelete(po.id); setActionMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </>
                              )}
                              {po.status === 'SUBMITTED' && (
                                <button onClick={() => { handleApprove(po.id); setActionMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm font-bold text-green-500 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                  <ThumbsUp size={14} /> Approve
                                </button>
                              )}
                              {(po.status === 'DRAFT' || po.status === 'SUBMITTED' || po.status === 'APPROVED') && (
                                <button onClick={() => { handleCancel(po.id); setActionMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                                  <XCircle size={14} /> Cancel
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersView;


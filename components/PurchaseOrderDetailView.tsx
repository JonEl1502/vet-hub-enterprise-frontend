import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Building2, FileText, Package, CheckCircle, Send, ThumbsUp, PackageCheck, XCircle, Trash2, Edit, MoreVertical, Eye } from 'lucide-react';
import { purchaseOrderAPI, PurchaseOrder, PurchaseOrderStatus, toast } from '../services';
import { Clinic } from '../types';

interface Props {
  purchaseOrderId: string;
  clinic: Clinic;
  onBack: () => void;
  onEdit: (id: string) => void;
  onReceive: (po: PurchaseOrder) => void;
}

const PurchaseOrderDetailView: React.FC<Props> = ({ purchaseOrderId, clinic, onBack, onEdit, onReceive }) => {
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetchPurchaseOrder();
  }, [purchaseOrderId]);

  const fetchPurchaseOrder = async () => {
    setLoading(true);
    try {
      const response = await purchaseOrderAPI.getById(purchaseOrderId);
      console.log('[PurchaseOrderDetailView] Purchase order fetched:', response.data.purchaseOrder);
      setPurchaseOrder(response.data.purchaseOrder);
    } catch (error: any) {
      console.error('[PurchaseOrderDetailView] Failed to load purchase order:', error);
      toast.error('Failed to load purchase order');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: PurchaseOrderStatus) => {
    const badges = {
      DRAFT: { label: 'Draft', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: <FileText size={14} /> },
      SUBMITTED: { label: 'Submitted', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Send size={14} /> },
      APPROVED: { label: 'Approved', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <ThumbsUp size={14} /> },
      ORDERED: { label: 'Ordered', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Package size={14} /> },
      PARTIALLY_RECEIVED: { label: 'Partially Received', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <PackageCheck size={14} /> },
      RECEIVED: { label: 'Received', color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: <CheckCircle size={14} /> },
      COMPLETED: { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <CheckCircle size={14} /> },
      CANCELLED: { label: 'Cancelled', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <XCircle size={14} /> },
    };
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-widest ${badge.bg} ${badge.color} ${badge.border}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  // Handle actions
  const handleSubmit = async () => {
    try {
      await purchaseOrderAPI.submit(purchaseOrderId);
      toast.success('Purchase order submitted successfully');
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit purchase order');
    }
  };

  const handleApprove = async () => {
    try {
      await purchaseOrderAPI.approve(purchaseOrderId);
      toast.success('Purchase order approved successfully');
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve purchase order');
    }
  };

  const handleMarkAsReceived = async () => {
    try {
      await purchaseOrderAPI.markAsReceived(purchaseOrderId);
      toast.success('Purchase order marked as received and inventory updated successfully');
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to mark purchase order as received');
    }
  };

  const handleComplete = async () => {
    try {
      await purchaseOrderAPI.complete(purchaseOrderId);
      toast.success('Purchase order completed successfully');
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to complete purchase order');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this purchase order?')) return;
    try {
      await purchaseOrderAPI.cancel(purchaseOrderId);
      toast.success('Purchase order cancelled successfully');
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel purchase order');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) return;
    try {
      await purchaseOrderAPI.delete(purchaseOrderId);
      toast.success('Purchase order deleted successfully');
      onBack();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete purchase order');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-seafoam mx-auto mb-4"></div>
          <p className="text-slate-400 font-bold">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Package className="mx-auto mb-4 text-slate-300" size={48} />
          <p className="text-slate-400 font-bold">Purchase order not found</p>
          <button onClick={onBack} className="mt-4 text-seafoam hover:text-pine font-bold">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="shrink-0 p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
            <ArrowLeft className="text-pine dark:text-zinc-100" size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none truncate">{purchaseOrder.orderNumber}</h1>
            <p className="text-seafoam dark:text-zinc-400 font-medium mt-0.5 uppercase text-[9px] tracking-widest font-black">Purchase Order Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {getStatusBadge(purchaseOrder.status)}
          {/* Actions menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 rounded-xl text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 transition-all"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                  <Eye size={13} /> View (current)
                </button>
                {purchaseOrder.status === 'DRAFT' && (<>
                  <button onClick={() => { onEdit(purchaseOrder.id); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                    <Edit size={13} /> Edit
                  </button>
                  <button onClick={() => { handleSubmit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                    <Send size={13} /> Submit for Approval
                  </button>
                </>)}
                {purchaseOrder.status === 'SUBMITTED' && (
                  <button onClick={() => { handleApprove(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors">
                    <ThumbsUp size={13} /> Approve Order
                  </button>
                )}
                {(purchaseOrder.status === 'APPROVED' || purchaseOrder.status === 'ORDERED' || purchaseOrder.status === 'PARTIALLY_RECEIVED') && (<>
                  <button onClick={() => { handleMarkAsReceived(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                    <PackageCheck size={13} /> Mark as Received
                  </button>
                  <button onClick={() => { onReceive(purchaseOrder); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors">
                    <PackageCheck size={13} /> Receive Items (Custom)
                  </button>
                </>)}
                {(purchaseOrder.status === 'APPROVED' || purchaseOrder.status === 'ORDERED' || purchaseOrder.status === 'RECEIVED' || purchaseOrder.status === 'PARTIALLY_RECEIVED') && (
                  <button onClick={() => { handleComplete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors">
                    <CheckCircle size={13} /> {purchaseOrder.status === 'APPROVED' || purchaseOrder.status === 'ORDERED' ? 'Complete & Receive All' : 'Mark as Completed'}
                  </button>
                )}
                {(purchaseOrder.status === 'DRAFT' || purchaseOrder.status === 'SUBMITTED' || purchaseOrder.status === 'APPROVED') && (
                  <button onClick={() => { handleCancel(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-t border-slate-100 dark:border-zinc-800">
                    <XCircle size={13} /> Cancel Order
                  </button>
                )}
                {purchaseOrder.status === 'DRAFT' && (
                  <button onClick={() => { handleDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-t border-slate-100 dark:border-zinc-800">
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Purchase Order Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Supplier Info */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="text-seafoam" size={20} />
              <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Supplier Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier Name</p>
                <p className="text-pine dark:text-zinc-100 font-bold text-base">{purchaseOrder.supplier?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                <p className="text-pine dark:text-zinc-100 font-bold text-base">{purchaseOrder.supplier?.category || '-'}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3">
              <Package className="text-seafoam" size={18} />
              <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Order Items</h3>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {(purchaseOrder.items || []).map(item => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-pine dark:text-zinc-100 text-sm">{item.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{item.category} · {item.sku}</p>
                    </div>
                    <span className="shrink-0 font-black text-pine dark:text-zinc-100 text-sm">KES {parseFloat(String(item.totalPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {[
                    { label: 'Qty', value: <span className="font-bold text-pine dark:text-zinc-100">{item.quantity}</span> },
                    { label: 'Received', value: <span className={`font-bold ${item.receivedQuantity === item.quantity ? 'text-green-500' : item.receivedQuantity > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{item.receivedQuantity}</span> },
                    { label: 'Unit Price', value: <span className="text-slate-600 dark:text-zinc-400">KES {parseFloat(String(item.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                      <span className="text-xs">{value}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Amount</span>
                <span className="text-base font-black text-pine dark:text-zinc-100">KES {parseFloat(String(purchaseOrder.totalAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Item</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">SKU</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Received</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit Price</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {(purchaseOrder.items || []).map(item => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-pine dark:text-zinc-100">{item.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">{item.category}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-zinc-400">{item.sku}</td>
                      <td className="px-6 py-4 text-right font-bold text-pine dark:text-zinc-100">{item.quantity}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold ${item.receivedQuantity === item.quantity ? 'text-green-500' : item.receivedQuantity > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                          {item.receivedQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-zinc-400">KES {parseFloat(String(item.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-bold text-pine dark:text-zinc-100">KES {parseFloat(String(item.totalPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-zinc-800 border-t-2 border-slate-300 dark:border-zinc-700">
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-right text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Total Amount</td>
                    <td className="px-6 py-4 text-right text-xl font-black text-pine dark:text-zinc-100">KES {parseFloat(String(purchaseOrder.totalAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {purchaseOrder.notes && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="text-seafoam" size={20} />
                <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Notes</h3>
              </div>
              <p className="text-slate-600 dark:text-zinc-400">{purchaseOrder.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Details */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Order Details</h3>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Created By</p>
              <p className="text-pine dark:text-zinc-100 font-bold">{purchaseOrder.creator?.name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Created Date</p>
              <p className="text-pine dark:text-zinc-100 font-bold">{new Date(purchaseOrder.createdAt).toLocaleDateString()}</p>
            </div>
            {purchaseOrder.expectedAt && (
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Delivery</p>
                <p className="text-pine dark:text-zinc-100 font-bold">{new Date(purchaseOrder.expectedAt).toLocaleDateString()}</p>
              </div>
            )}
            {purchaseOrder.approver && (
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Approved By</p>
                <p className="text-pine dark:text-zinc-100 font-bold">{purchaseOrder.approver.name}</p>
              </div>
            )}
            {purchaseOrder.receivedAt && (
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Received Date</p>
                <p className="text-pine dark:text-zinc-100 font-bold">{new Date(purchaseOrder.receivedAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetailView;


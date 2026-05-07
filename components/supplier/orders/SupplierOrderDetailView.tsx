import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  Package,
  Calendar,
  Hash,
  RefreshCw,
  CheckCircle2,
  Truck,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  User,
} from 'lucide-react';
import { supplierOrdersAPI } from '../../../services/modules/supplierOrders.api';
import type { PurchaseOrder } from '../../../services/modules/purchaseOrders.api';
import { toast } from '../../../services/utils/toast';

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

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const props = { size: 16 };
  switch (status) {
    case 'COMPLETED':
    case 'RECEIVED': return <CheckCircle2 {...props} />;
    case 'ORDERED':
    case 'PARTIALLY_RECEIVED': return <Truck {...props} />;
    case 'APPROVED': return <CheckCircle2 {...props} />;
    case 'SUBMITTED': return <Clock {...props} />;
    case 'CANCELLED': return <XCircle {...props} />;
    default: return <AlertCircle {...props} />;
  }
};

interface SupplierOrderDetailViewProps {
  orderId: string | number;
  setView?: (view: string, params?: any) => void;
}

const SupplierOrderDetailView: React.FC<SupplierOrderDetailViewProps> = ({ orderId, setView }) => {
  const [order, setOrder] = useState<PurchaseOrder & { clinic?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await supplierOrdersAPI.getById(Number(orderId), { cache: false });
      setOrder(res.data.purchaseOrder as any);
    } catch {
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED') => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      const res = await supplierOrdersAPI.updateStatus(Number(order.id), { status });
      setOrder(prev => prev ? { ...prev, ...(res.data.purchaseOrder as any) } : null);
      toast.success(`Order marked as ${STATUS_LABELS[status]}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getNextActions = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return [{ label: 'Mark as Ordered / Dispatched', status: 'ORDERED' as const, color: 'bg-purple-500 hover:bg-purple-600 text-white' }];
      case 'ORDERED':
        return [
          { label: 'Mark Partially Received', status: 'PARTIALLY_RECEIVED' as const, color: 'bg-cyan-500 hover:bg-cyan-600 text-white' },
          { label: 'Mark Fully Received', status: 'RECEIVED' as const, color: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
        ];
      case 'PARTIALLY_RECEIVED':
        return [{ label: 'Mark Fully Received', status: 'RECEIVED' as const, color: 'bg-emerald-500 hover:bg-emerald-600 text-white' }];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-16 text-center">
        <FileText size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
        <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">Order not found</p>
        <button
          onClick={() => setView?.('supplier-orders')}
          className="mt-4 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase hover:opacity-90 transition-all"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[order.status] || '#94a3b8';
  const nextActions = getNextActions(order.status);
  const clinic = (order as any).clinic;
  const items = order.items || [];
  const currency = (order as any).currency || '';

  const formatAmount = (amount: number) => {
    const sym = currency || '';
    return `${sym} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
  };

  return (
    <div className="space-y-4">
      {/* Header / Breadcrumb */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView?.('supplier-orders')}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
            >
              <ArrowLeft size={16} className="text-slate-500 dark:text-zinc-400" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                  PO #{order.orderNumber}
                </h1>
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase"
                  style={{ backgroundColor: statusColor + '20', color: statusColor }}
                >
                  <StatusIcon status={order.status} />
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Created {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Status Actions */}
          {nextActions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {nextActions.map(action => (
                <button
                  key={action.status}
                  onClick={() => updateStatus(action.status)}
                  disabled={updatingStatus}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-60 ${action.color}`}
                >
                  {updatingStatus ? <RefreshCw size={12} className="animate-spin" /> : null}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Clinic Info */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-seafoam/10 rounded-xl">
              <Building2 size={16} className="text-seafoam" />
            </div>
            <h2 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Ordering Clinic</h2>
          </div>
          {clinic ? (
            <div className="space-y-2">
              <p className="font-black text-pine dark:text-zinc-100 text-sm">{clinic.name}</p>
              {clinic.email && <p className="text-xs text-slate-500 dark:text-zinc-400">{clinic.email}</p>}
              {clinic.phone && <p className="text-xs text-slate-500 dark:text-zinc-400">{clinic.phone}</p>}
              {clinic.address && <p className="text-xs text-slate-400 dark:text-zinc-500">{clinic.address}</p>}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Clinic ID: {order.clinicId}</p>
          )}
        </div>

        {/* Order Meta */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Hash size={16} className="text-purple-500" />
            </div>
            <h2 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Order Details</h2>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-semibold">Order Number</span>
              <span className="font-black text-pine dark:text-zinc-100">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-semibold">Created</span>
              <span className="font-semibold text-slate-600 dark:text-zinc-300">{new Date(order.createdAt).toLocaleDateString()}</span>
            </div>
            {order.orderedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-semibold">Ordered At</span>
                <span className="font-semibold text-slate-600 dark:text-zinc-300">{new Date(order.orderedAt).toLocaleDateString()}</span>
              </div>
            )}
            {order.expectedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-semibold">Expected By</span>
                <span className="font-semibold text-slate-600 dark:text-zinc-300">{new Date(order.expectedAt).toLocaleDateString()}</span>
              </div>
            )}
            {order.receivedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-semibold">Received At</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{new Date(order.receivedAt).toLocaleDateString()}</span>
              </div>
            )}
            {currency && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-semibold">Currency</span>
                <span className="font-black text-seafoam px-2 py-0.5 bg-seafoam/10 rounded-full">{currency}</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Calendar size={16} className="text-green-500" />
            </div>
            <h2 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Summary</h2>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-semibold">Items</span>
              <span className="font-black text-pine dark:text-zinc-100">{items.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-semibold">Total Quantity</span>
              <span className="font-black text-pine dark:text-zinc-100">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>
            {order.notes && (
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 mb-1">Notes</p>
                <p className="text-xs text-slate-600 dark:text-zinc-300">{order.notes}</p>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Total</span>
              <span className="text-lg font-black text-pine dark:text-zinc-100">
                {formatAmount(parseFloat(order.totalAmount?.toString() || '0'))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Requested By */}
      {(order.creator || order.approver) && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            {order.creator && (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                  <User size={12} className="text-slate-500 dark:text-zinc-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500">Requested By</p>
                  <p className="text-xs font-black text-pine dark:text-zinc-100">
                    {(order.creator as any)?.profile?.name || (order.creator as any)?.name || order.creator.id}
                  </p>
                </div>
              </div>
            )}
            {order.approver && (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                  <CheckCircle2 size={12} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500">Approved By</p>
                  <p className="text-xs font-black text-pine dark:text-zinc-100">
                    {(order.approver as any)?.profile?.name || (order.approver as any)?.name || order.approver.id}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <Package size={16} className="text-seafoam" />
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
            Order Items <span className="text-seafoam ml-1">({items.length})</span>
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-600">
            <Package size={28} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-bold">No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-800/50">
                  <th className="text-left px-5 py-3">#</th>
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-left px-5 py-3">Category</th>
                  <th className="text-left px-5 py-3">SKU</th>
                  <th className="text-right px-5 py-3">Qty Ordered</th>
                  <th className="text-right px-5 py-3">Qty Received</th>
                  <th className="text-right px-5 py-3">Unit Price</th>
                  <th className="text-right px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {items.map((item, idx) => {
                  const isFullyReceived = item.receivedQuantity >= item.quantity;
                  const isPartial = item.receivedQuantity > 0 && item.receivedQuantity < item.quantity;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 dark:text-zinc-500 font-semibold">{idx + 1}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-black text-pine dark:text-zinc-100 text-xs">{item.name}</p>
                        {item.notes && <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{item.notes}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-400 font-mono font-semibold">{item.sku}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-xs font-black text-pine dark:text-zinc-100">{item.quantity}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-xs font-black ${isFullyReceived ? 'text-green-600 dark:text-green-400' : isPartial ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-500'}`}>
                          {item.receivedQuantity}
                          {isFullyReceived && <span className="ml-1 text-[9px]">✓</span>}
                          {isPartial && <span className="ml-1 text-[9px]">~</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-600 dark:text-zinc-300 font-semibold">
                        {formatAmount(item.unitPrice)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-black text-pine dark:text-zinc-100 text-xs">{formatAmount(item.totalPrice)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50">
                  <td colSpan={7} className="px-5 py-4 text-right text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-base font-black text-pine dark:text-zinc-100">
                      {formatAmount(parseFloat(order.totalAmount?.toString() || '0'))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierOrderDetailView;

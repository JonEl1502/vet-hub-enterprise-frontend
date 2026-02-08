import React, { useState, useEffect } from 'react';
import { X, PackageCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { purchaseOrderAPI, PurchaseOrder, toast, CacheInvalidators } from '../services';

interface Props {
  purchaseOrder: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ReceivedItem {
  itemId: string;
  receivedQuantity: number;
  maxQuantity: number;
  name: string;
  sku: string;
}

const ReceivePurchaseOrderModal: React.FC<Props> = ({ purchaseOrder, isOpen, onClose, onSuccess }) => {
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && purchaseOrder && purchaseOrder.items) {
      // Initialize received items with remaining quantities
      const items = purchaseOrder.items.map(item => ({
        itemId: item.id,
        receivedQuantity: item.quantity - item.receivedQuantity, // Default to remaining quantity
        maxQuantity: item.quantity - item.receivedQuantity,
        name: item.name,
        sku: item.sku,
      }));
      setReceivedItems(items);
    }
  }, [isOpen, purchaseOrder]);

  const handleQuantityChange = (itemId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setReceivedItems(prev =>
      prev.map(item =>
        item.itemId === itemId
          ? { ...item, receivedQuantity: Math.min(Math.max(0, quantity), item.maxQuantity) }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one item has quantity > 0
    const hasItems = receivedItems.some(item => item.receivedQuantity > 0);
    if (!hasItems) {
      toast.error('Please enter at least one received quantity');
      return;
    }

    // Confirm action
    const totalItems = receivedItems.filter(item => item.receivedQuantity > 0).length;
    if (!confirm(`Receive ${totalItems} item(s) and add them to inventory?`)) {
      return;
    }

    setSubmitting(true);
    try {
      // Only send items with receivedQuantity > 0
      const itemsToReceive = receivedItems
        .filter(item => item.receivedQuantity > 0)
        .map(item => ({
          itemId: item.itemId,
          receivedQuantity: item.receivedQuantity,
        }));

      console.log('[ReceivePurchaseOrderModal] Receiving items:', itemsToReceive);

      await purchaseOrderAPI.receive(purchaseOrder.id, { items: itemsToReceive });

      // Invalidate purchase order and inventory caches
      CacheInvalidators.invalidatePurchaseOrders(purchaseOrder.id);
      console.log('[ReceivePurchaseOrderModal] Invalidated purchase order and inventory caches');

      toast.success('Purchase order received and inventory updated successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[ReceivePurchaseOrderModal] Failed to receive purchase order:', error);
      toast.error(error.response?.data?.message || 'Failed to receive purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-2xl">
              <PackageCheck className="text-cyan-500" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Receive Purchase Order</h2>
              <p className="text-seafoam dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-1">
                {purchaseOrder.orderNumber}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-6 bg-cyan-50 dark:bg-cyan-900/10 border-b border-cyan-100 dark:border-cyan-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-cyan-500 mt-0.5" size={18} />
            <div className="text-sm text-cyan-700 dark:text-cyan-300">
              <p className="font-bold mb-1">Enter the quantities you received for each item.</p>
              <p className="text-xs">Items will be automatically added to your inventory. You can receive partial quantities.</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-200px)]">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {receivedItems.map((item, index) => {
                const originalItem = purchaseOrder.items.find(i => i.id === item.itemId);
                const alreadyReceived = originalItem?.receivedQuantity || 0;
                const totalOrdered = originalItem?.quantity || 0;

                return (
                  <div key={item.itemId} className="bg-slate-50 dark:bg-zinc-800 rounded-2xl p-4 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-black text-pine dark:text-zinc-100 text-base">{item.name}</h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">SKU: {item.sku}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-slate-500">
                            Ordered: <span className="font-bold text-pine dark:text-zinc-100">{totalOrdered}</span>
                          </span>
                          {alreadyReceived > 0 && (
                            <span className="text-slate-500">
                              Already Received: <span className="font-bold text-amber-500">{alreadyReceived}</span>
                            </span>
                          )}
                          <span className="text-slate-500">
                            Remaining: <span className="font-bold text-cyan-500">{item.maxQuantity}</span>
                          </span>
                        </div>
                      </div>
                      <div className="w-32">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                          Receive Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={item.maxQuantity}
                          value={item.receivedQuantity}
                          onChange={(e) => handleQuantityChange(item.itemId, e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-pine dark:text-zinc-100 font-bold text-center focus:ring-2 focus:ring-cyan-500/20 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-600 dark:text-zinc-400">
                <CheckCircle className="inline mr-2 text-cyan-500" size={16} />
                Items will be added to inventory automatically
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Receiving...
                    </>
                  ) : (
                    <>
                      <PackageCheck size={14} />
                      Receive & Add to Inventory
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceivePurchaseOrderModal;

import React, { useEffect, useMemo, useState } from 'react';
import { Receipt, PackageX, Clock, TrendingDown, Loader2, Bell } from 'lucide-react';
import { supplierOrdersAPI } from '../../../services/modules/supplierOrders.api';
import { supplierStockAPI } from '../../../services';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';

/**
 * NOTIFICATIONS FOR A SUPPLIER.
 *
 * ⚠️ The shared panel in `Navbar` is CLINIC-ONLY and always was: reminders,
 * the client inbox, today's visits, pending-payment visits and purchase
 * orders — five clinic-scoped endpoints. On a supplier account every one of
 * them 400s with "Clinic ID is required", so opening the bell produced a
 * stack of red toasts and a "Permission needed" dialog and no notifications
 * at all (user, 2026-09-12). Same family as the Amber Alert bar, which was
 * fixed by not rendering it for suppliers.
 *
 * A supplier's version answers the three questions a depot actually has open:
 * who is waiting on an order, what has run out, and what is about to expire.
 * All three come from endpoints the supplier already owns.
 */

const ACTIONABLE = ['PENDING', 'APPROVED', 'PROCESSING', 'ORDERED', 'PARTIALLY_RECEIVED'];

interface Props {
  currency?: string;
  onClose: () => void;
  onNavigate?: (view: string, params?: any) => void;
}

const Row: React.FC<{
  icon: React.FC<any>; tone: string; title: string; sub: string; right?: React.ReactNode; onClick?: () => void;
}> = ({ icon: Icon, tone, title, sub, right, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-50 dark:border-zinc-800/60 last:border-0 disabled:cursor-default"
  >
    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
      <Icon size={13} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{title}</span>
      <span className="block text-[9px] font-bold text-slate-400 truncate">{sub}</span>
    </span>
    {right}
  </button>
);

const SupplierNotifications: React.FC<Props> = ({ currency = 'KES', onClose, onNavigate }) => {
  const { branches } = useSupplierBranch();
  const branchId = branches?.[0]?.id ? String(branches[0].id) : '';

  const [orders, setOrders] = useState<any[]>([]);
  const [reorder, setReorder] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Settled independently — a supplier with no stockroom yet must still see
    // their orders, and vice versa.
    Promise.allSettled([
      supplierOrdersAPI.getMyOrders({ limit: 30 } as any, { silent: true } as any),
      branchId
        ? supplierStockAPI.getReorder(branchId, { silent: true } as any)
        : Promise.resolve(null as any),
      branchId
        ? supplierStockAPI.getBatches({ branchId, expiringInDays: 30 }, { silent: true } as any)
        : Promise.resolve(null as any),
    ]).then(([o, r, b]) => {
      if (o.status === 'fulfilled' && o.value?.success) {
        const all: any[] = (o.value.data as any)?.data ?? [];
        setOrders(all.filter(po => ACTIONABLE.includes(String(po.status || '').toUpperCase())));
      }
      if (r.status === 'fulfilled' && r.value?.success) setReorder(r.value.data?.items ?? []);
      if (b.status === 'fulfilled' && b.value?.success) setExpiring(b.value.data?.batches ?? []);
    }).finally(() => setLoading(false));
  }, [branchId]);

  const outOfStock = useMemo(
    () => reorder.filter((i: any) => Number(i.quantity) <= 0),
    [reorder],
  );
  const low = useMemo(
    () => reorder.filter((i: any) => Number(i.quantity) > 0),
    [reorder],
  );

  const total = orders.length + reorder.length + expiring.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-bold text-slate-400">
        <Loader2 size={13} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="py-10 text-center">
        <Bell size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />
        <p className="mt-2 text-[11px] font-bold text-slate-400">Nothing needs you right now.</p>
        <p className="text-[9px] font-bold text-slate-300 dark:text-zinc-600 mt-0.5">
          Orders, stock-outs and expiring batches land here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {orders.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Orders waiting · {orders.length}
          </p>
          {orders.slice(0, 5).map((po: any) => (
            <Row
              key={po.id}
              icon={Receipt}
              tone="bg-seafoam/10 text-seafoam"
              title={`PO #${po.orderNumber ?? po.id}`}
              sub={`${po.clinic?.name ?? 'A clinic'} · ${String(po.status || '').replace(/_/g, ' ').toLowerCase()}`}
              right={po.totalAmount != null ? (
                <span className="shrink-0 text-[10px] font-black font-mono text-slate-500">
                  {currency} {Number(po.totalAmount).toLocaleString()}
                </span>
              ) : undefined}
              onClick={() => { onClose(); onNavigate?.('supplier-order-detail', { orderId: String(po.id) }); }}
            />
          ))}
        </>
      )}

      {outOfStock.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Out of stock · {outOfStock.length}
          </p>
          {outOfStock.slice(0, 4).map((i: any) => (
            <Row
              key={i.id}
              icon={PackageX}
              tone="bg-rose-500/10 text-rose-500"
              title={i.name}
              sub={`0 ${i.unit} on hand · order ${i.suggestedOrder} ${i.unit}`}
              onClick={() => { onClose(); onNavigate?.('supplier-inventory'); }}
            />
          ))}
        </>
      )}

      {low.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Below reorder point · {low.length}
          </p>
          {low.slice(0, 4).map((i: any) => (
            <Row
              key={i.id}
              icon={TrendingDown}
              tone="bg-amber-500/10 text-amber-500"
              title={i.name}
              sub={`${i.quantity} / ${i.reorderPoint} ${i.unit} · order ${i.suggestedOrder}`}
              onClick={() => { onClose(); onNavigate?.('supplier-inventory'); }}
            />
          ))}
        </>
      )}

      {expiring.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Expiring within 30 days · {expiring.length}
          </p>
          {expiring.slice(0, 4).map((b: any) => (
            <Row
              key={b.id}
              icon={Clock}
              tone="bg-amber-500/10 text-amber-500"
              title={b.productName}
              sub={`Batch ${b.batchNumber} · ${b.quantityRemaining} ${b.unit} · ${b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : 'no date'}`}
              onClick={() => { onClose(); onNavigate?.('supplier-inventory'); }}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default SupplierNotifications;

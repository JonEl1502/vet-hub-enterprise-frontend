import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Ban } from 'lucide-react';
import { supplierPosAPI, toast, type PosSaleSummary } from '../../../services';
import type { PosController } from './usePos';

/** Today's takings, newest first. The tab a cashier opens to find a receipt. */

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PosSales: React.FC<{ pos: PosController }> = ({ pos }) => {
  const [sales, setSales] = useState<PosSaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // A cashier only ever has their own; a manager gets the whole branch.
  const canVoid = pos.till?.supplierRole === 'OWNER' || pos.till?.supplierRole === 'MANAGER';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierPosAPI.listSales({ date: 'today', mine: !canVoid });
      setSales(res.data.sales);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load today’s sales');
    } finally {
      setLoading(false);
    }
  }, [canVoid]);

  useEffect(() => { load(); }, [load]);

  const voidSale = async (sale: PosSaleSummary) => {
    const reason = window.prompt(`Void ${sale.saleNumber}? Say why:`);
    if (!reason?.trim()) return;
    try {
      await supplierPosAPI.voidSale(sale.id, reason.trim());
      toast.success(`${sale.saleNumber} voided — stock returned`);
      load();
      pos.reload({ silent: true });
    } catch (e: any) {
      toast.error(e?.message || 'Could not void that sale');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <h2 className="text-[15px] font-black">Today’s sales</h2>
        <button onClick={load} className="sp-btn sp-btn-quiet px-2" aria-label="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
        {sales.length === 0 && !loading && (
          <p className="text-center text-sm sp-muted py-16">Nothing rung up yet today</p>
        )}
        {sales.map((s) => (
          <div key={s.id} className="sp-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-mono sp-muted">{s.saleNumber}</p>
                <p className="text-[12px] sp-muted mt-0.5">
                  {s.itemCount} item{s.itemCount === 1 ? '' : 's'} · {s.methods.join(', ')}
                  {s.customerPhone ? ` · ${s.customerPhone}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-[16px] font-black sp-num ${s.status === 'VOIDED' ? 'sp-muted line-through' : ''}`}
                >
                  {money(s.total, s.currency)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider sp-muted">
                  {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {s.status === 'VOIDED' ? (
              <p className="text-[11px] font-bold sp-bad mt-2">Voided</p>
            ) : (
              canVoid && (
                <button
                  onClick={() => voidSale(s)}
                  className="sp-btn sp-btn-quiet mt-2 px-0 text-[12px] gap-1.5"
                >
                  <Ban size={13} /> Void
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PosSales;

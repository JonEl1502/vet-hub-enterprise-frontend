import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supplierPosAPI, toast, type PosShift as Shift } from '../../../services';
import type { PosController } from './usePos';

/**
 * The X-report — what is in the drawer, broken out by tender.
 *
 * Split by method because that is how a drawer is counted at close: the cash
 * line is the only one anyone physically counts, and the rest are reconciled
 * against statements.
 */

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PosShiftView: React.FC<{ pos: PosController }> = ({ pos }) => {
  const [shift, setShift] = useState<Shift | null>(null);
  const [scope, setScope] = useState<'me' | 'branch'>('me');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!pos.branchId) return;
    setLoading(true);
    try {
      const res = await supplierPosAPI.getShift(pos.branchId);
      setShift(res.data.summary);
      setScope(res.data.scope);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load the shift');
    } finally {
      setLoading(false);
    }
  }, [pos.branchId]);

  useEffect(() => { load(); }, [load]);

  const currency = shift?.currency || pos.currency;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div>
          <h2 className="text-[15px] font-black">This shift</h2>
          <p className="text-[11px] sp-muted font-semibold">
            {scope === 'me' ? 'Your till' : pos.branch?.name ?? 'This branch'} · since midnight
          </p>
        </div>
        <button onClick={load} className="sp-btn sp-btn-quiet px-2" aria-label="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-3">
        <div className="sp-card p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider sp-muted">Taken</p>
          <p className="text-[34px] font-black leading-tight sp-num">
            {money(shift?.gross ?? 0, currency)}
          </p>
          <p className="text-[12px] sp-muted font-semibold">
            {shift?.salesCount ?? 0} sale{shift?.salesCount === 1 ? '' : 's'}
            {shift?.voidedCount ? ` · ${shift.voidedCount} voided` : ''}
          </p>
        </div>

        <div className="sp-card">
          {Object.entries(shift?.byMethod ?? {}).length === 0 ? (
            <p className="text-center text-sm sp-muted py-8">Nothing taken yet</p>
          ) : (
            Object.entries(shift!.byMethod).map(([method, amount]) => (
              <div
                key={method}
                className="flex justify-between px-4 py-3 border-b last:border-b-0"
                style={{ borderColor: 'var(--sp-border)' }}
              >
                <span className="text-[13px] font-bold capitalize">
                  {method.toLowerCase().replace('_', ' ')}
                </span>
                <span className="text-[14px] font-black sp-num">
                  {money(amount as number, currency)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PosShiftView;

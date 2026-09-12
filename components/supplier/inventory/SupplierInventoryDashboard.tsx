import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, Clock, PackageCheck,
  RefreshCw, TrendingDown, Wallet, Layers, ShoppingCart,
} from 'lucide-react';
import { supplierStockAPI, type SupplierStockRow, type SupplierMovement } from '../../../services';

/**
 * THE SUPPLIER'S STOCKROOM OVERVIEW — the clinic's Inventory Dashboard, for a
 * depot (user, 2026-09-12: *"i want also suppliers to have this view"*).
 *
 * ⚠️ IT DOES NOT CALL THE CLINIC ENDPOINT. `inventoryAPI.getDashboard()` is
 * clinic-scoped and 400s with "Clinic ID is required" on a supplier account —
 * the same trap that made the Amber Alert bar toast an error on every supplier
 * page. Every number here is composed on the client from the supplier's OWN
 * stock endpoints, which already return everything the tiles need, so this
 * needed no new backend.
 *
 * The numbers that differ from the clinic's are the ones that mean something
 * different here: a supplier's "value" is stock at COST (what is tied up on the
 * shelf) alongside stock at SELL (what it is worth out of the door), and the
 * margin between them — which is the number a depot actually runs on.
 */

const MOVEMENT_META: Record<string, { label: string; up: boolean }> = {
  RESTOCKED: { label: 'Received', up: true },
  RECEIVED: { label: 'Received', up: true },
  RETURNED: { label: 'Returned', up: true },
  TRANSFER_IN: { label: 'Transferred in', up: true },
  SOLD: { label: 'Sold', up: false },
  TRANSFER_OUT: { label: 'Transferred out', up: false },
  ADJUSTED: { label: 'Adjusted', up: false },
  EXPIRED: { label: 'Expired', up: false },
  DAMAGED: { label: 'Damaged', up: false },
  STOCK_TAKE: { label: 'Counted', up: false },
};

const Stat: React.FC<{
  label: string; value: React.ReactNode; icon: React.ComponentType<any>; tone?: string; hint?: string;
}> = ({ label, value, icon: Icon, tone, hint }) => (
  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 flex items-center gap-3" title={hint}>
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone || 'bg-seafoam/10 text-seafoam'}`}>
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
      <p className="text-base font-black text-pine dark:text-zinc-100 leading-tight truncate">{value}</p>
    </div>
  </div>
);

interface Props {
  branchId: string;
  currency?: string;
  /** Bumped by the parent after a receive / transfer / count so this refetches. */
  refreshKey?: number;
}

const SupplierInventoryDashboard: React.FC<Props> = ({ branchId, currency = 'KES', refreshKey }) => {
  const [stock, setStock] = useState<SupplierStockRow[]>([]);
  const [movements, setMovements] = useState<SupplierMovement[]>([]);
  const [reorder, setReorder] = useState<(SupplierStockRow & { suggestedOrder: number })[]>([]);
  const [expiring, setExpiring] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(() => {
    if (!branchId) return;
    setLoading(true);
    // Four independent reads — one failing must not blank the other three, so
    // each settles on its own rather than sharing a try/catch.
    Promise.allSettled([
      supplierStockAPI.getStock(branchId, {}, { silent: true } as any),
      supplierStockAPI.getMovements({ branchId, limit: 8 }, { silent: true } as any),
      supplierStockAPI.getReorder(branchId, { silent: true } as any),
      supplierStockAPI.getBatches({ branchId, expiringInDays: 30 }, { silent: true } as any),
    ]).then(([s, m, r, b]) => {
      if (s.status === 'fulfilled' && s.value.success) setStock(s.value.data?.stock ?? []);
      if (m.status === 'fulfilled' && m.value.success) setMovements(m.value.data?.movements ?? []);
      if (r.status === 'fulfilled' && r.value.success) setReorder(r.value.data?.items ?? []);
      if (b.status === 'fulfilled' && b.value.success) setExpiring((b.value.data?.batches ?? []).length);
    }).finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const summary = useMemo(() => {
    let atCost = 0, atSell = 0, low = 0, out = 0, expired = 0, units = 0;
    for (const s of stock) {
      const q = Number(s.quantity) || 0;
      units += q;
      atCost += q * (Number(s.costPrice) || 0);
      atSell += q * (Number(s.sellPrice) || 0);
      if (s.status === 'OUT_OF_STOCK') out++;
      else if (s.status === 'LOW_STOCK') low++;
      if (s.expired) expired++;
    }
    // Margin of SALE, not markup on cost — the same convention the product
    // form and the clinic's inventory use, so the two never disagree.
    const marginPct = atSell > 0 ? ((atSell - atCost) / atSell) * 100 : 0;
    return { atCost, atSell, marginPct, low, out, expired, units, lines: stock.length };
  }, [stock]);

  const money = (n: number) => `${currency} ${Math.round(Number(n) || 0).toLocaleString()}`;

  if (loading && !stock.length) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-zinc-800/60 animate-pulse" />
        ))}
      </div>
    );
  }

  const alerts: { tone: string; text: string }[] = [];
  if (summary.out > 0) alerts.push({ tone: 'text-rose-500', text: `${summary.out} product${summary.out === 1 ? ' is' : 's are'} out of stock` });
  if (summary.low > 0) alerts.push({ tone: 'text-amber-500', text: `${summary.low} product${summary.low === 1 ? '' : 's'} below reorder point` });
  if (summary.expired > 0) alerts.push({ tone: 'text-rose-500', text: `${summary.expired} line${summary.expired === 1 ? ' has' : 's have'} expired stock` });
  if (expiring > 0) alerts.push({ tone: 'text-amber-500', text: `${expiring} batch${expiring === 1 ? '' : 'es'} expiring within 30 days` });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2">
          <Boxes size={14} className="text-seafoam" /> Stockroom Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-1 text-slate-400 hover:text-seafoam" title="Refresh">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam"
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <Stat label="Stock lines" value={summary.lines.toLocaleString()} icon={Layers} />
            <Stat
              label="Value at cost" value={money(summary.atCost)} icon={Wallet}
              hint="What is tied up on the shelf — quantity × buy price."
            />
            <Stat
              label="Value at sell" value={money(summary.atSell)} icon={ShoppingCart}
              tone="bg-emerald-500/10 text-emerald-600"
              hint="What the same shelf is worth out of the door — quantity × sell price."
            />
            <Stat
              label="Margin held"
              value={`${summary.marginPct.toFixed(0)}%`}
              icon={TrendingDown}
              tone={summary.marginPct <= 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-seafoam/10 text-seafoam'}
              hint="Margin of sale across everything on the shelf, at today's prices."
            />
            <Stat label="Units on hand" value={summary.units.toLocaleString()} icon={PackageCheck} />

            <Stat
              label="Low stock" value={String(summary.low)} icon={TrendingDown}
              tone={summary.low ? 'bg-amber-500/10 text-amber-500' : undefined}
            />
            <Stat
              label="Out of stock" value={String(summary.out)} icon={AlertTriangle}
              tone={summary.out ? 'bg-rose-500/10 text-rose-500' : undefined}
            />
            <Stat
              label="Expired" value={String(summary.expired)} icon={AlertTriangle}
              tone={summary.expired ? 'bg-rose-500/10 text-rose-500' : undefined}
            />
            <Stat
              label="Expiring ≤30d" value={String(expiring)} icon={Clock}
              tone={expiring ? 'bg-amber-500/10 text-amber-500' : undefined}
            />
            <Stat
              label="To reorder" value={String(reorder.length)} icon={ShoppingCart}
              tone={reorder.length ? 'bg-amber-500/10 text-amber-500' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Alerts */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <AlertTriangle size={11} className="text-amber-500" /> Alerts
              </p>
              {alerts.length === 0 ? (
                <p className="text-[11px] font-bold text-slate-400">All clear — no alerts.</p>
              ) : (
                <ul className="space-y-1">
                  {alerts.map((a, i) => (
                    <li key={i} className={`text-[11px] font-bold ${a.tone}`}>{a.text}</li>
                  ))}
                </ul>
              )}
              {/* The reorder list is the alert you can ACT on, so it is named
                  here rather than left as a count in a tile. */}
              {reorder.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-0.5">
                  {reorder.slice(0, 4).map(r => (
                    <p key={r.id} className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-pine dark:text-zinc-200">{r.name}</span>
                      <span className="shrink-0 font-mono">
                        {r.quantity} / {r.reorderPoint} · order {r.suggestedOrder} {r.unit}
                      </span>
                    </p>
                  ))}
                  {reorder.length > 4 && (
                    <p className="text-[9px] font-bold text-slate-400">+{reorder.length - 4} more below reorder point</p>
                  )}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Boxes size={11} className="text-seafoam" /> Recent activity
              </p>
              {movements.length === 0 ? (
                <p className="text-[11px] font-bold text-slate-400">Nothing has moved yet.</p>
              ) : (
                <ul className="space-y-1">
                  {movements.map(m => {
                    const meta = MOVEMENT_META[m.movementType] ?? { label: m.movementType, up: false };
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {meta.up
                            ? <ArrowUpRight size={11} className="text-emerald-500 shrink-0" />
                            : <ArrowDownRight size={11} className="text-rose-500 shrink-0" />}
                          <span className="truncate font-bold text-pine dark:text-zinc-200">{m.productName}</span>
                        </span>
                        <span className="shrink-0 text-slate-400 font-bold">
                          {meta.label}{' '}
                          <span className={`font-mono ${meta.up ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {meta.up ? '+' : '−'}{Math.abs(Number(m.quantity) || 0)} {m.unit}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierInventoryDashboard;

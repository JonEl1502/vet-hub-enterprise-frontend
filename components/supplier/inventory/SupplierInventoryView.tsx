import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package, Activity, Layers, Factory, Search, RefreshCw, Plus, ArrowRightLeft,
  ClipboardCheck, AlertTriangle, TrendingDown, PackagePlus,
} from 'lucide-react';
import {
  supplierStockAPI, toast,
  type SupplierStockRow, type SupplierMovement, type SupplierBatch, type SupplierSource,
} from '../../../services';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import ReceiveStockModal from './ReceiveStockModal';
import TransferStockModal from './TransferStockModal';
import AdjustStockModal from './AdjustStockModal';
import StockTakePanel from './StockTakePanel';
import SupplierSourcesPanel from './SupplierSourcesPanel';

/**
 * The supplier's stockroom.
 *
 * Same four-tab shape as the clinic's `StockManagerView` — stock, the ledger,
 * batches, and where goods come from — because it is the same problem. The one
 * tab that differs is the last: a clinic's upstream is always a Supplier, while
 * an agrovet buys from a distributor, a merchandiser or the manufacturer, and
 * the terms differ by which.
 *
 * ⚠️ Everything here is scoped to ONE BRANCH. `SupplierProduct.stockQty` is a
 * business-wide rollup that the marketplace reads; it is not what a shopkeeper
 * means by "how many do we have", and it is never displayed on this screen.
 */

type Tab = 'stock' | 'movements' | 'batches' | 'sources';
type StatusFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING';

const TABS = [
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'movements', label: 'Movements', icon: Activity },
  { id: 'batches', label: 'Batches & expiry', icon: Layers },
  { id: 'sources', label: 'Sources', icon: Factory },
] as const;

const money = (n: number, c = 'KES') =>
  `${c} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Reason codes read as words, not enum shouting. */
const MOVEMENT_LABEL: Record<string, string> = {
  RESTOCKED: 'Received', SOLD_AT_POS: 'Sold at till', SOLD: 'Sold',
  ADJUSTED: 'Adjusted', DAMAGED: 'Damaged', EXPIRED: 'Expired',
  RETURNED: 'Returned', TRANSFER_IN: 'Transfer in', TRANSFER_OUT: 'Transfer out',
  USED_IN_APPOINTMENT: 'Used',
};

const movementTone = (t: string) =>
  t === 'RESTOCKED' || t === 'TRANSFER_IN' || t === 'RETURNED'
    ? 'text-emerald-600 dark:text-emerald-400'
    : t === 'DAMAGED' || t === 'EXPIRED'
      ? 'text-red-500'
      : 'text-slate-500 dark:text-zinc-400';

interface Props {
  setView?: (view: string, params?: any) => void;
  /** MANAGER/OWNER. Writes are hidden without it — and refused server-side. */
  canManage?: boolean;
}

const SupplierInventoryView: React.FC<Props> = ({ setView, canManage = true }) => {
  const { branches } = useSupplierBranch();
  const [tab, setTab] = useState<Tab>('stock');

  /**
   * One branch at a time. A merged view would have to add quantities across
   * branches, which is the exact number this screen exists to stop people using.
   *
   * ⚠️ NOT from `activeBranchIds`. That list is seeded with the string
   * `'__main__'` — a UI-only sentinel for "the supplier's own head office" that
   * predates real branch rows. Reading its first entry sent `branchId=__main__`
   * to the API. `branches` holds the actual rows.
   */
  const [branchId, setBranchId] = useState<string>('');
  useEffect(() => {
    if (branchId) return;
    const first = branches?.[0]?.id;
    if (first != null) setBranchId(String(first));
  }, [branches, branchId]);

  const [stock, setStock] = useState<SupplierStockRow[]>([]);
  const [movements, setMovements] = useState<SupplierMovement[]>([]);
  const [batches, setBatches] = useState<SupplierBatch[]>([]);
  const [sources, setSources] = useState<SupplierSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [category, setCategory] = useState('ALL');

  const [receiving, setReceiving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [adjusting, setAdjusting] = useState<SupplierStockRow | null>(null);
  const [counting, setCounting] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const [s, m, b, src] = await Promise.all([
        supplierStockAPI.getStock(branchId),
        supplierStockAPI.getMovements({ branchId, limit: 200 }),
        supplierStockAPI.getBatches({ branchId }),
        supplierStockAPI.listSources({ includeInactive: true }),
      ]);
      setStock(s.data.stock);
      setMovements(m.data.movements);
      setBatches(b.data.batches);
      setSources(src.data.sources);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load the stockroom');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(
    () => [...new Set(stock.map((s) => s.category).filter(Boolean))].sort(),
    [stock]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stock.filter((s) => {
      if (q && !(s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q))) return false;
      if (category !== 'ALL' && s.category !== category) return false;
      if (status === 'EXPIRING') return s.expiringSoon || s.expired;
      if (status !== 'ALL' && s.status !== status) return false;
      return true;
    });
  }, [stock, search, category, status]);

  /** The four numbers a shopkeeper actually opens this screen for. */
  const summary = useMemo(() => ({
    lines: stock.length,
    low: stock.filter((s) => s.status === 'LOW_STOCK').length,
    out: stock.filter((s) => s.status === 'OUT_OF_STOCK').length,
    expiring: stock.filter((s) => s.expiringSoon || s.expired).length,
    value: stock.reduce((sum, s) => sum + s.quantity * s.costPrice, 0),
  }), [stock]);

  if (loading && stock.length === 0) return <LoadingSpinner />;

  // Migration 261 gave every supplier a Main Branch, so this is a data problem
  // rather than a normal state — say so instead of rendering an empty shelf.
  if (!branchId) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl py-16 text-center">
        <p className="text-sm font-bold text-slate-400">No branch to stock</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Add a branch under Management before receiving stock.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + branch */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">Stockroom</h1>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-semibold">
            What is on the shelf, per branch — and where it came from.
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {branches && branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="text-xs font-bold border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
              aria-label="Branch"
            >
              {branches.map((b: any) => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={load}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-seafoam"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <>
              <button onClick={() => setCounting(true)} className="sup-btn-ghost">
                <ClipboardCheck size={14} /> Stock take
              </button>
              <button onClick={() => setTransferring(true)} className="sup-btn-ghost">
                <ArrowRightLeft size={14} /> Transfer
              </button>
              <button onClick={() => setReceiving(true)} className="sup-btn">
                <PackagePlus size={14} /> Receive stock
              </button>
            </>
          )}
        </div>
      </div>

      {/* The four numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Stock lines" value={String(summary.lines)} icon={Package} />
        <Stat label="Low stock" value={String(summary.low)} icon={TrendingDown} tone={summary.low ? 'warn' : undefined} />
        <Stat label="Out of stock" value={String(summary.out)} icon={AlertTriangle} tone={summary.out ? 'bad' : undefined} />
        <Stat label="Stock value at cost" value={money(summary.value)} icon={Layers} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap border-b border-slate-200 dark:border-zinc-800 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              tab === t.id
                ? 'bg-seafoam text-white shadow-md shadow-seafoam/20'
                : 'text-slate-400 dark:text-zinc-500 hover:text-seafoam hover:bg-slate-50 dark:hover:bg-zinc-900'
            }`}
          >
            <t.icon size={13} /> {t.label}
            {t.id === 'batches' && summary.expiring > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px]">
                {summary.expiring}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Stock ─────────────────────────────────────────────────────── */}
      {tab === 'stock' && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900"
              />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="sup-select">
              <option value="ALL">All stock</option>
              <option value="IN_STOCK">In stock</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="EXPIRING">Expiring or expired</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="sup-select">
              <option value="ALL">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            {/* Table on a desk; the same rows become cards on a phone. */}
            <div className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1.2fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <span>Product</span><span>On shelf</span><span>Reorder at</span>
              <span>Default source</span><span>Value at cost</span><span />
            </div>

            {visible.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-14 font-bold">
                {stock.length === 0 ? 'Nothing stocked at this branch yet' : 'Nothing matches'}
              </p>
            ) : visible.map((s) => (
              <div
                key={s.id}
                className="grid md:grid-cols-[2.5fr_1fr_1fr_1.2fr_1fr_auto] gap-1 md:gap-3 px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-zinc-800 items-center"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    {s.sku}{s.binLocation ? ` · bin ${s.binLocation}` : ''}
                    {s.expired ? ' · EXPIRED STOCK' : s.expiringSoon ? ' · expiring soon' : ''}
                  </p>
                </div>
                <div className="flex md:block items-center gap-2">
                  <span className={`text-sm font-black tabular-nums ${
                    s.status === 'OUT_OF_STOCK' ? 'text-red-500'
                    : s.status === 'LOW_STOCK' ? 'text-amber-600'
                    : 'text-pine dark:text-zinc-100'}`}>
                    {s.quantity}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">{s.unit.toLowerCase()}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-semibold tabular-nums">{s.reorderPoint}</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold truncate">
                  {s.defaultSource ? s.defaultSource.name : <span className="text-slate-300">—</span>}
                </p>
                <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums">
                  {money(s.quantity * s.costPrice)}
                </p>
                {canManage && (
                  <button onClick={() => setAdjusting(s)} className="sup-btn-ghost !py-1.5 !px-2.5 justify-self-end">
                    Adjust
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Movements ─────────────────────────────────────────────────── */}
      {tab === 'movements' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <p className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-bold text-slate-400">
            Every change to this branch's stock, newest first. Each row carries what was on
            the shelf before and after, so the ledger proves itself.
          </p>
          {movements.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-14 font-bold">No movements yet</p>
          ) : movements.map((m) => (
            <div key={m.id} className="px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-zinc-800 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{m.productName}</p>
                <p className="text-[10px] text-slate-400 font-semibold">
                  <span className={movementTone(m.movementType)}>
                    {MOVEMENT_LABEL[m.movementType] ?? m.movementType}
                  </span>
                  {m.saleNumber ? ` · ${m.saleNumber}` : ''}
                  {m.batchNumber ? ` · batch ${m.batchNumber}` : ''}
                  {m.by ? ` · ${m.by}` : ''}
                </p>
                {m.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{m.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-black tabular-nums ${m.quantity < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {m.quantity > 0 ? '+' : ''}{m.quantity}
                </p>
                {m.quantityBefore != null && (
                  <p className="text-[10px] text-slate-400 font-semibold tabular-nums">
                    {m.quantityBefore} → {m.quantityAfter}
                  </p>
                )}
                <p className="text-[9px] text-slate-300 font-bold">
                  {new Date(m.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Batches ───────────────────────────────────────────────────── */}
      {tab === 'batches' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <p className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-bold text-slate-400">
            Soonest to expire first. An exhausted batch keeps its row — "which batch did that
            customer get" is the question a recall asks.
          </p>
          {batches.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-14 font-bold">No batches recorded</p>
          ) : batches.map((b) => (
            <div key={b.id} className="px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-zinc-800 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{b.productName}</p>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Batch {b.batchNumber}
                  {b.source ? ` · from ${b.source.name}` : ''}
                </p>
              </div>
              <p className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-zinc-400 shrink-0">
                {b.quantityRemaining}/{b.quantityReceived} {b.unit.toLowerCase()}
              </p>
              <div className="text-right shrink-0 w-28">
                {b.expiryDate ? (
                  <>
                    <p className={`text-[11px] font-black ${
                      b.expired ? 'text-red-500' : (b.daysToExpiry ?? 999) < 90 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {new Date(b.expiryDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400">
                      {b.expired ? 'expired' : `${b.daysToExpiry} days`}
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-slate-300 font-bold">no expiry</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sources ───────────────────────────────────────────────────── */}
      {tab === 'sources' && (
        <SupplierSourcesPanel sources={sources} canManage={canManage} onChanged={load} />
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {receiving && (
        <ReceiveStockModal
          branchId={branchId}
          products={stock}
          sources={sources.filter((s) => s.isActive)}
          onClose={() => setReceiving(false)}
          onDone={() => { setReceiving(false); load(); }}
        />
      )}
      {transferring && (
        <TransferStockModal
          fromBranchId={branchId}
          branches={(branches ?? []).map((b: any) => ({ id: String(b.id), name: b.name }))}
          products={stock}
          onClose={() => setTransferring(false)}
          onDone={() => { setTransferring(false); load(); }}
        />
      )}
      {adjusting && (
        <AdjustStockModal
          branchId={branchId}
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => { setAdjusting(null); load(); }}
        />
      )}
      {counting && (
        <StockTakePanel
          branchId={branchId}
          products={stock}
          onClose={() => setCounting(false)}
          onDone={() => { setCounting(false); load(); }}
        />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; icon: React.FC<any>; tone?: 'warn' | 'bad' }> = ({
  label, value, icon: Icon, tone,
}) => (
  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={13} className={tone === 'bad' ? 'text-red-500' : tone === 'warn' ? 'text-amber-500' : 'text-seafoam'} />
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
    <p className={`text-lg font-black tabular-nums ${
      tone === 'bad' ? 'text-red-500' : tone === 'warn' ? 'text-amber-600' : 'text-pine dark:text-zinc-100'}`}>
      {value}
    </p>
  </div>
);

export default SupplierInventoryView;

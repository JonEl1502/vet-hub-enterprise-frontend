/**
 * THE DEAD END THIS REMOVES (287).
 *
 * Every medicine search in the app reads one source: this clinic's own
 * inventory. Search a drug you have never stocked and the answer is *"No
 * inventory match for 'meloxicam'"* — a full stop, mid-consult. The only way
 * forward was to leave the visit, cross to Inventory, retype a product the
 * VetHubCore catalog already describes down to its pack size and its injection
 * fee, and come back to a wizard that had lost its place. What actually happens
 * instead is that the drug gets written into the notes as free text, the stock
 * never moves, and the client is never charged for it.
 *
 * So: when the shelf has nothing, offer the CATALOG. Pick the product, say what
 * it cost and what you charge, and it is stocked and dispensed without leaving
 * the visit.
 *
 * ── Two modes, because two different clinics arrive here ──────────────────
 *
 * STOCK (`view:inventory` on the plan) — creates the product from the catalog
 * row (`POST /inventory/from-catalog`, which inherits name, unit, pack size,
 * species and the whole metadata structure server-side) and then dispenses it
 * through `consumablesAPI.log`, the SAME call every other dispense uses. Stock
 * moves, the charge lands, and the item is on the shelf for next time.
 *
 * CHARGE (no inventory on the plan) — there is no shelf to move, so it adds the
 * bill line directly and says so. ⚠️ Deliberately NOT a lock screen: a vet
 * mid-consultation with a drug in their hand needs the client charged for it,
 * and refusing that sells nothing — it just means the practice eats the cost
 * and learns the software gets in the way. The upgrade is offered against the
 * thing the plan actually withholds (a shelf count), next to a control that
 * still works.
 *
 * ── Prefill ──────────────────────────────────────────────────────────────
 *
 * The point of the catalog is that you should have to type as little as
 * possible. Unit, pack size and the per-item fees come off the catalog row.
 * Sell price follows the SAME ladder the PO-receive path uses — explicit, then
 * the catalog's `suggestedSellPrice`, then cost × 1.3 — so a product priced by
 * hand here matches one that arrived on a purchase order. The markup keeps
 * tracking cost until the moment someone types a sell price themselves, and
 * then it stops and never fights them.
 */
import React from 'react';
import { Search, Loader2, PackagePlus, ArrowLeft, Lock, ArrowUpRight, Globe } from 'lucide-react';
import { useReferenceData, type Drug } from '../../../contexts/ReferenceDataContext';
import { useFeature } from '../../../contexts/PlanAccessContext';
import { useData } from '../../../contexts/DataContext';
import { inventoryAPI, consumablesAPI, billsAPI, toast } from '../../../services';

/** The blind markup used when neither the clinic nor the catalog names a price.
 *  Same figure as `purchaseOrder.service` — one number, both paths. */
const DEFAULT_MARKUP = 1.3;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Navigate to Billing without coupling this component to the router —
 *  the same event `UpgradeGate` dispatches. */
const goToBilling = () => {
  window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view: 'billing' } }));
};

interface Props {
  /** Seed query — the text that just found nothing on the shelf. */
  initialQuery?: string;
  /** The visit to dispense onto / bill. */
  visitId: number | string;
  currency?: string;
  /** The SERVICE task this product belongs to (200), when the host scopes by one. */
  serviceTaskId?: string | number | null;
  /** Note to carry onto the logged line (the host's service tag, an Rx note…). */
  notes?: string;
  /** Back-fill: record the line on a past day. Stock still moves now. */
  recordedAt?: string | null;
  /** Fired after the product is dispensed/charged so the host can refresh. */
  onAdded?: (info: { name: string; quantity: number; unit: string; lineTotal: number }) => void;
  onClose: () => void;
}

const GlobalCatalogPicker: React.FC<Props> = ({
  initialQuery = '', visitId, currency = 'KES', serviceTaskId, notes, recordedAt, onAdded, onClose,
}) => {
  const { searchDrugs } = useReferenceData();
  const { refreshInventory } = useData() as any;
  /**
   * ⚠️ The gate is on `view:inventory`, the same key that decides whether the
   * Inventory page exists at all. Anything narrower would let this create stock
   * for a clinic that has nowhere to look at it.
   */
  const canStock = useFeature('view:inventory');

  const [q, setQ] = React.useState(initialQuery);
  const [results, setResults] = React.useState<Drug[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [picked, setPicked] = React.useState<Drug | null>(null);
  const [busy, setBusy] = React.useState(false);

  // ── The form ──────────────────────────────────────────────────────────────
  const [dispenseQty, setDispenseQty] = React.useState<number>(1);
  const [stockQty, setStockQty] = React.useState<number>(1);
  const [cost, setCost] = React.useState<string>('');
  const [sell, setSell] = React.useState<string>('');
  /**
   * Has a human typed in the sell box?
   *
   * Until they do, sell tracks cost through the markup so the common case is
   * zero typing. The instant they touch it the derivation stops for good —
   * a field that keeps overwriting what you typed is worse than one that never
   * helped, and this one is a PRICE.
   */
  const [sellTouched, setSellTouched] = React.useState(false);

  // Debounced catalog search. 300ms + 2 chars matches every other typeahead.
  React.useEffect(() => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchDrugs(q.trim());
      setResults(r);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, searchDrugs]);

  const unitOf = (d: Drug | null) => (d?.metadata?.sellUnit || d?.unit || 'Units').toString();

  const pick = (d: Drug) => {
    setPicked(d);
    setSellTouched(false);
    setCost('');
    // Suggested price is the catalog's whole reason for carrying one — start there.
    setSell(d.suggestedSellPrice != null && d.suggestedSellPrice > 0 ? String(d.suggestedSellPrice) : '');
    if (d.suggestedSellPrice != null && d.suggestedSellPrice > 0) setSellTouched(true);
    /**
     * QUANTITY PREFILL.
     *
     * Dispense ONE — that is what "I need this now" almost always means, and it
     * is the only safe default for a drug.
     *
     * Stock the PACK. Someone stocking mid-consult has a box in their hand, and
     * `packSize` is the catalog telling us how many are in it. Falling back to
     * the dispensed amount (rather than to 1) keeps the shelf from going
     * negative the moment the item is created.
     */
    setDispenseQty(1);
    setStockQty(d.packSize && d.packSize > 0 ? d.packSize : 1);
  };

  // Sell tracks cost through the markup until someone takes the wheel.
  const onCostChange = (v: string) => {
    setCost(v);
    if (!sellTouched) {
      const c = Number(v);
      setSell(Number.isFinite(c) && c > 0 ? String(round2(c * DEFAULT_MARKUP)) : '');
    }
  };

  const sellNum = Number(sell) || 0;
  const costNum = Number(cost) || 0;
  const lineTotal = round2(sellNum * (Number(dispenseQty) || 0));
  /** Per-item fees ride in from the catalog and are charged by the normal
   *  dispense path, so quote them here rather than surprising the client. */
  const catalogFees: { label: string; amount: number }[] = React.useMemo(() => {
    const FEE_LABELS: Record<string, string> = {
      injection: 'Injection fee', admin: 'Administration fee',
      service: 'Service charge', prescription: 'Prescription fee',
    };
    const fees = picked?.metadata?.fees || {};
    return Object.entries(fees)
      .filter(([, v]) => v != null && Number(v) > 0)
      .map(([k, v]) => ({ label: FEE_LABELS[k] || k, amount: Number(v) }));
  }, [picked]);

  const submit = async () => {
    if (!picked) return;
    const qty = Number(dispenseQty) || 0;
    if (qty <= 0) { toast.error('Enter how much you are giving'); return; }
    if (sellNum <= 0) { toast.error('Enter a sell price — this is what the client is charged'); return; }
    setBusy(true);
    try {
      if (canStock) {
        /**
         * Stock, THEN dispense — two calls on purpose. The second is the
         * existing, well-worn dispense path (stock movement, per-item fees,
         * bill sync); reimplementing any of that here would be a second code
         * path for the same act, and they drift.
         */
        const stocked = await inventoryAPI.stockFromCatalog({
          drugId: picked.id,
          // Never stock less than you are about to hand over.
          quantity: Math.max(Number(stockQty) || 0, qty),
          costPrice: costNum || undefined,
          price: sellNum,
        });
        if (!stocked.success || !stocked.data?.item) throw new Error('Could not stock that product');
        const item: any = stocked.data.item;

        const logged = await consumablesAPI.log(visitId, {
          inventoryItemId: String(item.id),
          quantity: qty,
          ...(notes ? { notes } : {}),
          ...(serviceTaskId != null ? { serviceTaskId } : {}),
          ...(recordedAt ? { recordedAt } : {}),
        });
        if (!logged.success) throw new Error('Stocked, but could not dispense it');

        // The new product must show up in the ORDINARY search next time —
        // otherwise the same drug sends you back through the catalog forever.
        refreshInventory?.();
        toast.success(stocked.data.reused
          ? `${item.name} — already on your shelf · dispensed ×${qty}`
          : `${item.name} stocked from catalog · dispensed ×${qty}`);
        onAdded?.({ name: item.name, quantity: qty, unit: unitOf(picked), lineTotal: (logged.data as any)?.lineCost ?? lineTotal });
      } else {
        /**
         * No inventory on the plan — charge it and be honest about what that
         * does and does not do. `CONSUMABLE` rather than `SERVICE`: it is a
         * product handed over, and the client's invoice should say so.
         */
        const r = await billsAPI.addLine(visitId, {
          name: `${picked.name} ×${qty} ${unitOf(picked)}`,
          kind: 'CONSUMABLE',
          quantity: qty,
          unitPrice: sellNum,
          category: picked.category || 'Consumables',
        } as any);
        if (!r.success) throw new Error('Could not add the charge');
        toast.success(`${picked.name} charged — ${currency} ${lineTotal.toLocaleString()}`);
        onAdded?.({ name: picked.name, quantity: qty, unit: unitOf(picked), lineTotal });
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not add that product');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-2.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40';
  const label = 'block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-pine/40 backdrop-blur-sm overflow-y-auto"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto">

        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
          <Globe size={14} className="text-seafoam shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-pine dark:text-zinc-100">VetHubCore catalog</p>
            <p className="text-[9px] font-bold text-slate-400">
              {canStock ? 'Stock it and give it without leaving this visit' : 'Charge it to this visit'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-pine text-lg leading-none px-1">×</button>
        </div>

        {!picked ? (
          <div className="p-4 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={q} onChange={e => setQ(e.target.value)} autoFocus
                placeholder="Search the catalog (2+ chars)…"
                className={`${field} pl-8`}
              />
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar -mx-1 px-1">
              {searching && (
                <p className="flex items-center gap-2 py-3 text-[10px] font-bold text-slate-400">
                  <Loader2 size={11} className="animate-spin" /> Searching…
                </p>
              )}
              {!searching && results.map(d => (
                <button key={d.id} type="button" onMouseDown={() => pick(d)}
                  className="w-full flex items-center gap-2 px-2 py-2 text-left rounded-lg hover:bg-seafoam/5 transition-all border-b border-slate-50 dark:border-zinc-800 last:border-0">
                  <PackagePlus size={12} className="text-seafoam shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{d.name}</span>
                    <span className="block text-[9px] font-bold text-slate-400 truncate">
                      {[d.genericName, d.category].filter(Boolean).join(' · ')}
                      {d.packSize ? ` · pack of ${d.packSize}` : ''}
                    </span>
                  </span>
                  {d.suggestedSellPrice != null && d.suggestedSellPrice > 0 && (
                    <span className="shrink-0 text-[9px] font-black font-mono text-slate-400">~{currency} {d.suggestedSellPrice.toLocaleString()}</span>
                  )}
                </button>
              ))}
              {!searching && q.trim().length >= 2 && results.length === 0 && (
                <p className="py-3 text-[10px] font-bold text-slate-400">
                  Nothing in the catalog for “{q.trim()}”. Add it as a product in Inventory instead.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <button type="button" onClick={() => setPicked(null)}
              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-colors">
              <ArrowLeft size={11} /> Back to results
            </button>

            <div>
              <p className="text-[12px] font-black text-pine dark:text-zinc-100">{picked.name}</p>
              <p className="text-[9px] font-bold text-slate-400">
                {[picked.genericName, picked.category].filter(Boolean).join(' · ')}
                {picked.packSize ? ` · pack of ${picked.packSize}` : ''} · sold per {unitOf(picked)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Cost / {unitOf(picked)}</label>
                <input type="number" min={0} step="0.01" value={cost} onChange={e => onCostChange(e.target.value)}
                  placeholder="what you paid" className={field} />
              </div>
              <div>
                <label className={label}>Sell / {unitOf(picked)} *</label>
                <input type="number" min={0} step="0.01" value={sell}
                  onChange={e => { setSellTouched(true); setSell(e.target.value); }}
                  placeholder="what you charge" className={field} />
              </div>
              <div>
                <label className={label}>Give now ({unitOf(picked)})</label>
                <input type="number" min={0} step="0.01" value={dispenseQty}
                  onChange={e => setDispenseQty(Number(e.target.value))} className={field} />
              </div>
              {canStock && (
                <div>
                  <label className={label}>Put on shelf</label>
                  <input type="number" min={0} step="1" value={stockQty}
                    onChange={e => setStockQty(Number(e.target.value))} className={field} />
                </div>
              )}
            </div>

            {/* Say the money out loud BEFORE the button is pressed — the same
                contract the Treatment step's dispense line keeps. */}
            {sellNum > 0 && (
              <p className="text-[10px] font-black text-seafoam px-0.5">
                {currency} {lineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} on this visit
                <span className="font-bold opacity-70"> ({sellNum.toLocaleString()}/{unitOf(picked)} × {dispenseQty})</span>
                {costNum > 0 && sellNum > costNum && (
                  <span className="font-bold text-slate-400"> · margin {Math.round(((sellNum - costNum) / sellNum) * 100)}%</span>
                )}
              </p>
            )}
            {catalogFees.length > 0 && canStock && (
              <p className="text-[9px] font-bold text-slate-400 px-0.5">
                Carries {catalogFees.map(f => `${f.label.toLowerCase()} ${currency} ${f.amount.toLocaleString()}`).join(', ')} — charged with it.
              </p>
            )}

            {!canStock && (
              /* The lock, shown and priced — never a control that just 403s. */
              <div className="flex items-start gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950">
                <Lock size={12} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                    This charges the visit but keeps no shelf count — stock control is on a higher plan.
                  </p>
                  <button type="button" onClick={goToBilling}
                    className="mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-pine transition-colors">
                    See plans <ArrowUpRight size={10} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-pine transition-colors">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={busy}
                className="flex-1 h-9 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                {busy ? <Loader2 size={12} className="animate-spin" /> : canStock ? 'Stock & give' : 'Charge to visit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalCatalogPicker;

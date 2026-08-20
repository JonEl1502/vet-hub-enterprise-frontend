import React, { useMemo, useState, useEffect } from 'react';

/**
 * ONE quantity+unit control for every place a consumable is attached
 * (procedure recipe, catalog service products, visit/encounter consumables,
 * bill add-item). Born from the sell-unit drift money bug (board §0f #8,
 * 2026-08-02): each surface re-implemented "quantity" and only some knew
 * about units, so "Gloves 1 Box" billed at the per-pair price.
 *
 * Conventions (reference_sell_unit_vs_stock_unit):
 * - the CANONICAL quantity — what `value`/`onChange` carry, what the server
 *   stores, what `price` multiplies — is in SELL units (`metadata.sellUnit`);
 * - stock is held in STOCK units (`unit`); `packSize` = sell units per stock
 *   unit bridges the two;
 * - unit choices are DERIVED from packSize, never hand-typed: sell unit ×1,
 *   ¼/½ stock unit, stock unit ×packSize;
 * - bounds: at least a quarter of the smallest unit, at most one purchase
 *   (stock) unit total — kills both the 1/1000-of-a-box and the 40-box typo.
 */

export interface UnitItemLike {
  unit?: string | null;                       // stock unit, e.g. "Box"
  packSize?: number | null;                   // sell units per stock unit
  metadata?: { sellUnit?: string | null } | null;
  sellUnit?: string | null;                   // some rows carry it flattened
  minSellQty?: number | null;                 // smallest dispensable amount, in SELL units
}

/** Where the qty box starts for an item: its smallest dispensable amount. */
export const defaultSellQty = (item: UnitItemLike): number => {
  const min = Number(item?.minSellQty ?? 0);
  return Number.isFinite(min) && min > 0 ? min : 1;
};

/** Free numeric entry, in sell units. */
export const MAX_SELL_QTY = 100000;

/** Stock units consumed by ONE sell unit (mirror of the server helper). */
export const stockPerSellUnit = (item: UnitItemLike): number => {
  const sell = String(item?.sellUnit ?? item?.metadata?.sellUnit ?? '').trim();
  const stock = String(item?.unit ?? '').trim();
  if (!sell || sell.toLowerCase() === stock.toLowerCase()) return 1;
  const pack = Number(item?.packSize ?? 0);
  if (!Number.isFinite(pack) || pack <= 0) return 1;
  return 1 / pack;
};

/** True when the item genuinely sells in a different unit than it stocks. */
export const isSplitUnit = (item: UnitItemLike): boolean => stockPerSellUnit(item) !== 1;

/** The unit `price` (and canonical quantity) is denominated in. */
export const sellUnitOf = (item: UnitItemLike): string =>
  String(item?.sellUnit ?? item?.metadata?.sellUnit ?? '').trim() || String(item?.unit ?? '').trim() || 'unit';

/** costPrice is per STOCK unit → cost of one SELL unit. */
export const costPerSellUnit = (item: UnitItemLike & { costPrice?: number | null }): number =>
  Number(item?.costPrice ?? 0) * stockPerSellUnit(item);

export interface UnitOption { label: string; sellQty: number }

/** Derived choices, all expressed as "how many SELL units is one of these". */
export const unitOptionsFor = (item: UnitItemLike): UnitOption[] => {
  const sell = sellUnitOf(item);
  const stock = String(item?.unit ?? '').trim();
  const pack = Number(item?.packSize ?? 0);
  if (!isSplitUnit(item) || !stock || !Number.isFinite(pack) || pack <= 1) {
    return [{ label: sell, sellQty: 1 }];
  }
  const opts: UnitOption[] = [{ label: sell, sellQty: 1 }];
  if (pack >= 8) opts.push({ label: `¼ ${stock}`, sellQty: pack / 4 });
  if (pack >= 4) opts.push({ label: `½ ${stock}`, sellQty: pack / 2 });
  opts.push({ label: stock, sellQty: pack });
  return opts;
};

interface Props {
  item: UnitItemLike;
  /** Canonical quantity, in SELL units. */
  value: number;
  onChange: (sellUnits: number) => void;
  className?: string;
  compact?: boolean;      // chip-sized (catalog product chips)
  disabled?: boolean;
}

const QtyUnitControl: React.FC<Props> = ({ item, value, onChange, className = '', compact = false, disabled = false }) => {
  const options = useMemo(() => unitOptionsFor(item), [item]);
  const split = options.length > 1;
  // Pick the largest unit that divides the value cleanly, so a stored 100
  // (pack 100) renders as "1 Box", 50 as "1 ½ Box", 2 as "2 Pair".
  const initial = useMemo(() => {
    for (let i = options.length - 1; i >= 0; i--) {
      const q = value / options[i].sellQty;
      if (q >= 1 && Math.abs(q - Math.round(q * 100) / 100) < 1e-9) return i;
    }
    return 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [unitIdx, setUnitIdx] = useState(initial);
  useEffect(() => { if (unitIdx > options.length - 1) setUnitIdx(0); }, [options.length]); // item swapped

  const chosen = options[Math.min(unitIdx, options.length - 1)];
  const displayQty = chosen ? value / chosen.sellQty : value;

  /**
   * FREE NUMERIC ENTRY, 0 → 100,000 sell units (user, 2026-08-20: "user can
   * state in numeric 0.00 to 100000… ml/g/tablet/vials").
   *
   * ⚠️ Two old bounds were doing real damage. The floor forced ¼ of the chosen
   * unit, so nothing finer than a quarter tablet could be typed. The ceiling was
   * **one stock unit** — a 12-tablet pack capped every line at 12 tablets, with
   * 4,800 on the shelf, and no message saying why the number refused to grow.
   * The item's own `minSellQty` is the only real floor and it belongs at the
   * point of ADD, not in the middle of typing.
   */
  const clamp = (sellUnits: number) => Math.min(MAX_SELL_QTY, Math.max(0, sellUnits));

  const emit = (qtyInChosen: number, opt: UnitOption = chosen) => {
    if (!Number.isFinite(qtyInChosen)) return;
    onChange(Math.round(clamp(qtyInChosen * opt.sellQty) * 1000) / 1000);
  };

  const inputCls = compact
    ? 'w-14 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 py-0.5 text-center text-pine dark:text-zinc-100 outline-none text-[10px]'
    : 'field-input w-20';
  const selectCls = compact
    ? 'bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 py-0.5 text-[10px] text-pine dark:text-zinc-100 outline-none'
    : 'field-select w-28';

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        type="number" min={0} max={MAX_SELL_QTY} step="any" disabled={disabled}
        /**
         * ⚠️ Show EXACTLY what will be billed.
         *
         * The box rounded to 2dp while the emitted value keeps 3, so a typed
         * 0.254 sat in the field as "0.25" and charged 15.24 instead of 15 —
         * the number on screen was not the number on the bill (user,
         * 2026-08-20: "confusing as to how much am dispensing").
         */
        value={Number.isFinite(displayQty) ? Number(displayQty.toFixed(3)) : ''}
        onChange={e => emit(Number(e.target.value))}
        className={inputCls}
        title={split ? `Billed per ${sellUnitOf(item)}; 1 ${item.unit} = ${item.packSize} ${sellUnitOf(item)}` : undefined}
      />
      {split ? (
        <select
          className={selectCls} disabled={disabled} value={unitIdx}
          onChange={e => {
            const idx = Number(e.target.value);
            setUnitIdx(idx);
            // Re-emit the same DISPLAY number in the new unit — picking "Box"
            // after typing 1 means one box, not one pair.
            emit(Number.isFinite(displayQty) && displayQty > 0 ? displayQty : 1, options[idx]);
          }}
        >
          {options.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
        </select>
      ) : (
        <span className={compact ? 'text-[10px]' : 'text-xs text-slate-400'}>{chosen?.label}</span>
      )}
    </span>
  );
};

export default QtyUnitControl;

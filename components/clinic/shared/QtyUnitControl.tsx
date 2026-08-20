import React from 'react';

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
 * - you type in the SELL unit, always. The container equivalence is shown
 *   beside the box as text, never as a selector that multiplies your number.
 * - bounds: 0 → 100,000 sell units. The item's own `minSellQty` is the only
 *   real floor and it is enforced where the line is ADDED, not mid-keystroke.
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

interface Props {
  item: UnitItemLike;
  /** Canonical quantity, in SELL units. */
  value: number;
  onChange: (sellUnits: number) => void;
  className?: string;
  compact?: boolean;      // chip-sized (catalog product chips)
  disabled?: boolean;
}

/**
 * Quantity in the item's SELL unit. One number, one unit, no multiplier.
 *
 * ⚠️ This used to offer a unit dropdown — Tablet / ¼ Pack / ½ Pack / Pack —
 * that silently multiplied what you typed. The field was labelled "QTY
 * (TABLET)" while the selector sat on "¼ Pack", so 12 became 36 Tablets with
 * both readings visible at once (user, 2026-08-20: "i dont understand the
 * drpdwn"). On an item with no split it rendered as plain text instead, which
 * read as a control that would not open ("the drpdwn is locked").
 *
 * Both complaints are the same design: a unit picker where the unit was never
 * in question. You are dispensing in the unit the item is billed in — so type
 * the number, and the container equivalence is shown as plain text beside it.
 */
const QtyUnitControl: React.FC<Props> = ({ item, value, onChange, className = '', compact = false, disabled = false }) => {
  const sell = sellUnitOf(item);
  const stock = String(item?.unit ?? '').trim();
  const pack = Number(item?.packSize ?? 0);
  const split = isSplitUnit(item) && !!stock && Number.isFinite(pack) && pack > 1;

  const clamp = (n: number) => Math.min(MAX_SELL_QTY, Math.max(0, n));

  const inputCls = compact
    ? 'w-16 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 py-0.5 text-center text-pine dark:text-zinc-100 outline-none text-[10px]'
    : 'field-input w-24';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <input
        type="number" min={0} max={MAX_SELL_QTY} step="any" disabled={disabled}
        /**
         * ⚠️ Show EXACTLY what will be billed. The box rounded to 2dp while the
         * stored value kept 3, so a typed 0.254 sat in the field as "0.25" and
         * charged 15.24 instead of 15.
         */
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : ''}
        onChange={e => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.round(clamp(n) * 1000) / 1000);
        }}
        className={inputCls}
        title={split ? `Billed per ${sell}; 1 ${stock} = ${pack} ${sell}` : undefined}
      />
      <span className={compact ? 'text-[10px] text-slate-500' : 'text-xs font-bold text-pine dark:text-zinc-100'}>{sell}</span>
      {split && !compact && (
        <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">1 {stock} = {pack} {sell}</span>
      )}
    </span>
  );
};

export default QtyUnitControl;

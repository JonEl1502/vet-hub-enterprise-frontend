import { Wheat, Leaf, Droplets, Milk, Pill, Package, Sparkles, FlaskConical, type LucideIcon } from 'lucide-react';
import type { FarmStockItem, StockCategory, StockBaseUnit } from '../../../services/modules/clientPortal.api';

export interface StockCat { key: StockCategory; label: string; icon: LucideIcon; unit: StockBaseUnit }

/** What a farmer keeps in the store, in the words they use. `unit` is how it is counted. */
export const STOCK_CATEGORIES: StockCat[] = [
  { key: 'FEED', label: 'Feed', icon: Wheat, unit: 'KG' },
  { key: 'FORAGE', label: 'Hay & forage', icon: Leaf, unit: 'KG' },
  { key: 'SALT', label: 'Salt', icon: Sparkles, unit: 'KG' },
  { key: 'MINERAL', label: 'Minerals', icon: FlaskConical, unit: 'KG' },
  { key: 'WATER', label: 'Water', icon: Droplets, unit: 'L' },
  { key: 'CALF_MILK', label: 'Calf milk', icon: Milk, unit: 'L' },
  { key: 'DRUG', label: 'Drugs', icon: Pill, unit: 'PCS' },
  { key: 'SUPPLY', label: 'Supplies', icon: Package, unit: 'PCS' },
];
export const catOf = (k: string) => STOCK_CATEGORIES.find((c) => c.key === k) ?? STOCK_CATEGORIES[0];

export interface UnitChoice { code: string; label: string; /** base units in one */ size?: number }

/** What the item is counted in, in words. */
export const baseWord = (u: string) => (u === 'KG' ? 'kg' : u === 'L' ? 'L' : 'pcs');

/**
 * The units a farmer may enter an amount in for this item.
 *
 *  - BUY: how it comes IN — the base unit, standard bags, a bale, and the
 *    farmer's own buying units ("Bag (70 kg)").
 *  - DISPENSE: how it goes OUT when feeding — the base unit, grams/ml, and
 *    the farmer's own feeding units ("Scoop = 2 kg").
 *  - ANY: everything (stock counts).
 *
 * User, 2026-11-22: "the quantities for purchasing will be different for
 * quantities for dispensing … allow user to set one or multiple dispensing
 * units, which can be converted to the purchasing unit".
 */
export const unitChoices = (
  item: Pick<FarmStockItem, 'baseUnit' | 'baleKg' | 'units'>,
  purpose: 'BUY' | 'DISPENSE' | 'ANY' = 'ANY',
): UnitChoice[] => {
  const buy = purpose !== 'DISPENSE', give = purpose !== 'BUY';
  const u: UnitChoice[] = [{ code: item.baseUnit, label: item.baseUnit === 'KG' ? 'kg' : item.baseUnit === 'L' ? 'Litres' : 'Pieces', size: 1 }];
  if (item.baseUnit === 'KG') {
    if (give) u.push({ code: 'G', label: 'grams', size: 0.001 });
    if (buy) u.push({ code: 'BAG_20', label: '20 kg bag', size: 20 }, { code: 'BAG_50', label: '50 kg bag', size: 50 }, { code: 'BAG_100', label: '100 kg bag', size: 100 });
    // Hay is bought AND fed by the bale, so a bale is offered both ways.
    u.push({ code: 'BALE', label: 'Bale', size: item.baleKg ?? undefined });
  }
  if (item.baseUnit === 'L' && give) u.push({ code: 'ML', label: 'ml', size: 0.001 });
  for (const x of item.units ?? []) {
    if (x.use === 'BOTH' || (x.use === 'BUY' && buy) || (x.use === 'DISPENSE' && give)) {
      u.push({ code: x.code, label: `${x.label} (${trim(x.size)} ${baseWord(item.baseUnit)})`, size: x.size });
    }
  }
  return u;
};

/** How many base units one of `code` is, or null when unknown (a bale with no weight yet). */
export const unitSize = (item: Pick<FarmStockItem, 'baseUnit' | 'baleKg' | 'units'>, code: string): number | null =>
  unitChoices(item, 'ANY').find((c) => c.code === code)?.size ?? null;

export const unitLabel = (code: string) =>
  ({ KG: 'kg', L: 'L', PCS: 'pcs', G: 'g', ML: 'ml', BAG_20: '× 20 kg bag', BAG_50: '× 50 kg bag', BAG_100: '× 100 kg bag', BALE: '× bale' } as Record<string, string>)[code] ?? code;

export const trim = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });

/** "130 kg", "42 L", "6 pcs". */
export const fmtQty = (item: Pick<FarmStockItem, 'baseUnit' | 'quantity'>, q = item.quantity) =>
  `${trim(q)} ${item.baseUnit === 'KG' ? 'kg' : item.baseUnit === 'L' ? 'L' : 'pcs'}`;

/** What that is in the packs the farmer actually buys: "≈ 2½ bags of 50 kg", "≈ 8 bales". */
export const packHint = (item: Pick<FarmStockItem, 'baseUnit' | 'quantity' | 'baleKg'>): string | null => {
  if (item.baseUnit !== 'KG' || item.quantity <= 0) return null;
  if (item.baleKg && item.baleKg > 0) return `≈ ${trim(item.quantity / item.baleKg)} bales`;
  if (item.quantity >= 50) return `≈ ${trim(item.quantity / 50)} bags of 50 kg`;
  return null;
};

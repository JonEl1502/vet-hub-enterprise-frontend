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

export interface UnitChoice { code: string; label: string }

/** The units a farmer may enter an amount in for this item. Bales only once we know what a bale weighs. */
export const unitChoices = (item: Pick<FarmStockItem, 'baseUnit' | 'baleKg'>, withBale = true): UnitChoice[] => {
  if (item.baseUnit === 'L') return [{ code: 'L', label: 'Litres' }];
  if (item.baseUnit === 'PCS') return [{ code: 'PCS', label: 'Pieces' }];
  const u: UnitChoice[] = [
    { code: 'KG', label: 'kg' },
    { code: 'BAG_20', label: '20 kg bag' },
    { code: 'BAG_50', label: '50 kg bag' },
    { code: 'BAG_100', label: '100 kg bag' },
  ];
  if (withBale) u.push({ code: 'BALE', label: 'Bale' });
  return u;
};
export const unitLabel = (code: string) =>
  ({ KG: 'kg', L: 'L', PCS: 'pcs', BAG_20: '× 20 kg bag', BAG_50: '× 50 kg bag', BAG_100: '× 100 kg bag', BALE: '× bale' } as Record<string, string>)[code] ?? code;

const trim = (n: number) => (Math.round(n * 10) / 10).toString();

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

/**
 * UNIT MATHS — shared by the clinic's Inventory form and the supplier's
 * product form.
 *
 * Lifted out of `components/clinic/inventory/InventoryView.tsx` unchanged
 * (user, 2026-09-12: the supplier catalogue should price and show margin the
 * same way the clinic does, *"because it just works"*). Copying it would have
 * given two sides of the same trade two different answers about the same
 * money, which is the exact failure the function was written to stop.
 */
/**
 * ONE place that converts between the three units a product can carry, because
 * two readouts disagreeing about money is worse than either being wrong alone.
 *
 * A product is BOUGHT in a stock unit (Bottle), SOLD in a sell unit (mL), and
 * `packSize` bridges them (50 mL in 1 Bottle). "Quantity to add" is always in
 * STOCK units; `price` is always per SELL unit.
 *
 * ⚠️ THE BUG THIS EXISTS TO KILL (user, 2026-08-22). Both readouts did
 * `price * quantity` — a per-mL price times a bottle count. 300 Bottles of
 * 50 mL at KES 250/mL showed a sale value of KES 75,000 instead of
 * KES 3,750,000, and "Total buy cost" (which IS the wallet debit and the Total
 * Due) read KES 2,400 instead of KES 120,000. The inline band had been fixed
 * for one case on 2026-08-20, but it decided WHETHER to convert by comparing
 * the cost unit against the sell unit — the wrong axis. The conversion is
 * driven by stock-vs-sell; the cost unit only decides which of the two the
 * cost price is quoted in.
 */
export function unitMath(f: {
  unit?: string; sellUnit?: string; costUnit?: string;
  packSize?: number; quantity?: number | string;
  price?: number | string; costPrice?: number | string; sellQty?: number | string;
}) {
  const stockU = String(f.unit || '').trim();
  const sellU = String(f.sellUnit || '').trim() || stockU;
  const costU = String(f.costUnit || '').trim() || stockU;
  const pack = Number(f.packSize) || 0;

  const split = !!sellU && !!stockU && sellU.toLowerCase() !== stockU.toLowerCase();
  // Without a pack size a split is unresolvable — say so rather than guess 1:1.
  const sellPerStock = split ? (pack > 0 ? pack : 0) : 1;

  const qty = Number(f.quantity) || 0;                 // in STOCK units
  const qtyInSell = sellPerStock > 0 ? qty * sellPerStock : 0;

  // The displayed sale price covers `sellQty` units ("250 per 1 mL").
  const salePerSell = (Number(f.price) || 0) / (Number(f.sellQty) || 1);
  const cost = Number(f.costPrice) || 0;

  // Which unit is the cost quoted in? Anything else we cannot convert.
  const costIsStock = costU.toLowerCase() === stockU.toLowerCase();
  const costIsSell = costU.toLowerCase() === sellU.toLowerCase();
  const costPerSell = costIsSell ? cost : (sellPerStock > 0 ? cost / sellPerStock : null);
  const costPerStock = costIsStock ? cost : (costIsSell ? cost * sellPerStock : null);

  const resolvable = sellPerStock > 0 && (costIsStock || costIsSell);
  const buyTotal = costPerStock != null ? costPerStock * qty : null;
  const saleTotal = sellPerStock > 0 ? salePerSell * qtyInSell : null;

  return {
    stockU, sellU, costU, pack, split, sellPerStock,
    qty, qtyInSell, salePerSell, cost, costPerSell, costPerStock,
    costIsStock, costIsSell, resolvable,
    buyTotal, saleTotal,
    profit: buyTotal != null && saleTotal != null ? saleTotal - buyTotal : null,
  };
}

export type UnitMath = ReturnType<typeof unitMath>;

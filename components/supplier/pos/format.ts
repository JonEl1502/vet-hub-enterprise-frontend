/**
 * Shared formatting for the till.
 *
 * Extracted because `unitFor` was written twice — once on the product tile and
 * again on the sale receipt — and the second copy shipped saying "1 bottles".
 */

export const money = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Grid prices, without the trailing `.00`.
 *
 * A tile is scanned, not reconciled: "KES 980" is read in one glance where
 * "KES 980.00" makes the eye stop for two digits that are always zero. Money
 * that has to ADD UP — the cart, the tender, the receipt — uses `money()` and
 * always shows both places.
 */
export const priceShort = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * "1 bottles" is the sort of thing that makes software look unfinished.
 * The stored unit is already plural ("Bottles", "Bags"), so ONE is the case
 * that needs handling, not the other way round.
 */
export const unitFor = (qty: number, unit: string) => {
  const u = String(unit ?? '').toLowerCase();
  return Math.abs(Number(qty)) === 1 && u.endsWith('s') ? u.slice(0, -1) : u;
};

/** Fractional stock is real (0.5 kg of feed), but "2.000" is noise. */
export const qtyText = (n: number) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(3)));
};

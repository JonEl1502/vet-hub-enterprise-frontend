import { productImage } from '../../../utils/productFormIcon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { petshopAPI, walletAPI } from '../../../services';
import type { Wallet as WalletData } from '../../../services';
import type { InventoryItem } from '../../../services/modules/inventory.api';
import type {
  PosProduct, PosProductStat, PosPreview, PosPaymentInput,
} from '../../../services/modules/supplierPos.api';
import type { CartLine, PosController } from '../../supplier/pos/usePos';

/**
 * THE CLINIC PET SHOP TILL — the supplier till's screens, fed by the clinic.
 *
 * The supplier POS (`components/supplier/pos`) is the house till: tile grid,
 * scanner-first search, smart tabs, the cash keypad, the A4 sheet and the
 * till slip. Its screens only read a controller object, so the clinic gets
 * the same till by handing them this one instead of `usePos` (user,
 * 2026-11-21: *"pet shop should open as a POS … look at the other POSs in the
 * supplier side"*). Nothing is forked: a fix to the till lands here too.
 *
 * What differs from the supplier controller:
 *  - The catalogue is the clinic's own billable stock (DataContext inventory).
 *  - Totals are computed here, because the clinic checkout has no preview
 *    endpoint. They are display-only: `petshop.service.sell` re-prices every
 *    line from the database and re-checks stock inside its transaction, so a
 *    stale number here can fail a sale but can never undercharge one.
 *  - The buyer (a client, a new walk-in, or nobody), a discount, and which
 *    wallet the money lands in — the clinic till always had these.
 */

export type ClinicDiscount = { type: 'NONE' | 'PERCENTAGE' | 'FIXED'; value: string };
export type ClinicBuyer =
  | { kind: 'none' }
  | { kind: 'client'; id: string; name: string; phone?: string | null }
  | { kind: 'walkin'; name: string; phone: string };

/** "Match the payment" — pick the wallet from the method the customer used. */
export const AUTO_WALLET = '__auto__';

const methodToClinic = (m: string) => (m === 'MPESA' ? 'M_PESA' : m);

/** Which wallet types a payment method lands in, best first. */
const WALLET_TYPES_FOR: Record<string, string[]> = {
  // A cash drawer is a VIRTUAL wallet (no real account behind it).
  CASH: ['VIRTUAL'],
  M_PESA: ['TILL', 'MPESA_POCHI', 'MPESA_PAYBILL'],
  CARD: ['DIGITAL_WALLET', 'BANK', 'BANK_PAYBILL'],
  BANK_TRANSFER: ['BANK', 'BANK_PAYBILL'],
};

const toProduct = (i: InventoryItem, currency: string): PosProduct => {
  const stock = Number(i.quantity) || 0;
  const min = Number(i.minThreshold) || 0;
  return {
    id: String(i.id),
    name: i.name,
    description: null,
    category: i.category || '',
    sku: i.sku || '',
    barcode: (i as any).barcode ?? null,
    price: Number(i.price) || 0,
    currency,
    unit: i.unit || 'units',
    // The product's photo, or its form drawing (tablets, vial, bottle…).
    imageUrl: productImage({ imageUrl: (i as any).imageUrl, name: i.name, category: i.category, unit: i.unit }),
    manufacturer: (i as any).manufacturer ?? null,
    stock,
    lowStockThreshold: min,
    inStock: stock > 0,
    isLowStock: stock > 0 && stock <= min,
    sellable: stock > 0,
  };
};

export function useClinicPos(clinicId: string | null, currency: string) {
  const { inventory, ensureInventory, refreshInventory } = useData() as any;
  useEffect(() => { ensureInventory?.(); }, [ensureInventory]);

  const products = useMemo<PosProduct[]>(
    () => ((inventory || []) as InventoryItem[])
      .filter((i) => (i as any).billable !== false)
      .map((i) => toProduct(i, currency))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [inventory, currency],
  );
  const catalogLoaded = Array.isArray(inventory);

  // ── Smart tabs: what actually sold in the last 30 days ─────────────────
  const [sold, setSold] = useState<Record<string, number> | null>(null);
  const loadStats = useCallback(() => {
    petshopAPI.stats(30)
      .then((r) => { if (r.success) setSold(Object.fromEntries((r.data?.stats ?? []).map((s) => [s.id, s.sold]))); })
      .catch(() => { /* the tabs fall back to stock-only flags */ });
  }, []);
  useEffect(() => { if (clinicId) loadStats(); }, [clinicId, loadStats]);

  const stats = useMemo<Record<string, PosProductStat>>(() => {
    const ranked = Object.entries(sold ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    // Best sellers: the top tenth of what moved, never fewer than 5.
    const best = new Set(ranked.slice(0, Math.max(5, Math.ceil(ranked.length / 10))).map(([id]) => id));
    const out: Record<string, PosProductStat> = {};
    for (const p of products) {
      const n = sold?.[p.id] ?? 0;
      out[p.id] = {
        id: p.id,
        sold: n,
        bestSeller: best.has(p.id),
        lowStock: p.isLowStock,
        outOfStock: p.stock <= 0,
        neverSold: sold != null && n === 0 && p.stock > 0,
        starved: best.has(p.id) && p.isLowStock,
      };
    }
    return out;
  }, [products, sold]);

  // ── Cart ────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const stockOf = useCallback((id: string) => products.find((p) => p.id === id)?.stock ?? 0, [products]);
  const inCart = useCallback((id: string) => cart.find((l) => l.productId === id)?.quantity ?? 0, [cart]);

  const addProduct = useCallback((product: PosProduct, qty = 1) => {
    setCart((prev) => {
      const at = prev.findIndex((l) => l.productId === product.id);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], quantity: next[at].quantity + qty };
        return next;
      }
      return [...prev, { productId: product.id, name: product.name, unit: product.unit, displayPrice: product.price, quantity: qty }];
    });
  }, []);
  const setQuantity = useCallback((id: string, quantity: number) => {
    setCart((prev) => (quantity <= 0
      ? prev.filter((l) => l.productId !== id)
      : prev.map((l) => (l.productId === id ? { ...l, quantity } : l))));
  }, []);
  const bump = useCallback((id: string, by: number) => {
    const line = cart.find((l) => l.productId === id);
    if (line) setQuantity(id, line.quantity + by);
  }, [cart, setQuantity]);
  const removeLine = useCallback((id: string) => setQuantity(id, 0), [setQuantity]);
  const itemCount = useMemo(() => cart.reduce((n, l) => n + l.quantity, 0), [cart]);

  // ── Buyer, discount, wallet ─────────────────────────────────────────────
  const [buyer, setBuyer] = useState<ClinicBuyer>({ kind: 'none' });
  const [discount, setDiscount] = useState<ClinicDiscount>({ type: 'NONE', value: '' });
  const [walletId, setWalletId] = useState<string>(AUTO_WALLET);
  const [wallets, setWallets] = useState<WalletData[]>([]);

  useEffect(() => {
    if (!clinicId) return;
    let alive = true;
    (async () => {
      try {
        await walletAPI.ensure('CLINIC', clinicId).catch(() => {});
        const res = await walletAPI.getByEntity('CLINIC', clinicId);
        if (alive && res.success) setWallets((res.data.wallets || []).filter((w) => w.isActive !== false));
      } catch { /* no wallets: the sale is still recorded, just not routed */ }
    })();
    return () => { alive = false; };
  }, [clinicId]);

  const walletFor = useCallback((method: string): string | undefined => {
    if (walletId !== AUTO_WALLET) return walletId;
    const types = WALLET_TYPES_FOR[method] ?? [];
    const hit = wallets.find((w) => types.includes(String(w.walletType)));
    const main = wallets.find((w) => (w as any).isMain) ?? wallets[0];
    return hit ? String(hit.id) : main ? String(main.id) : undefined;
  }, [walletId, wallets]);

  const clearCart = useCallback(() => {
    setCart([]);
    setBuyer({ kind: 'none' });
    setDiscount({ type: 'NONE', value: '' });
  }, []);

  // ── Totals (display only — see the header) ──────────────────────────────
  const preview = useMemo<PosPreview | null>(() => {
    if (!cart.length) return null;
    const items = cart.map((l) => {
      const p = products.find((x) => x.id === l.productId);
      const unitPrice = p?.price ?? l.displayPrice;
      const available = p?.stock ?? 0;
      return {
        supplierProductId: l.productId,
        name: p?.name ?? l.name,
        sku: p?.sku ?? '',
        unit: p?.unit ?? l.unit,
        quantity: l.quantity,
        unitPrice,
        discount: 0,
        lineTotal: unitPrice * l.quantity,
        available,
        insufficientStock: l.quantity > available,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const v = Number(discount.value) || 0;
    const off = discount.type === 'PERCENTAGE' ? (subtotal * Math.min(100, Math.max(0, v))) / 100
      : discount.type === 'FIXED' ? Math.max(0, v) : 0;
    const disc = Math.min(subtotal, off);
    return { currency, subtotal, discount: disc, tax: 0, total: subtotal - disc, items };
  }, [cart, products, discount, currency]);

  const walkInIncomplete = buyer.kind === 'walkin' && !buyer.name.trim();
  const canTender = cart.length > 0 && !!preview && !preview.items.some((i) => i.insufficientStock) && !walkInIncomplete;
  const priceError = walkInIncomplete ? 'Type the walk-in customer’s name, or remove them' : null;

  // ── Committing ──────────────────────────────────────────────────────────
  const completeSale = useCallback(async (
    payments: PosPaymentInput[],
    meta: { customerName?: string; customerPhone?: string } = {},
  ) => {
    const pay = payments[0];
    const method = methodToClinic(pay?.method ?? 'CASH');
    const res = await petshopAPI.checkout({
      clientId: buyer.kind === 'client' ? buyer.id : undefined,
      walkInData: buyer.kind === 'walkin'
        ? { firstName: buyer.name.trim(), phone: (meta.customerPhone || buyer.phone || '').trim() || undefined }
        : undefined,
      items: cart.map((l) => ({ inventoryItemId: l.productId, quantity: l.quantity })),
      paymentMethod: method,
      walletId: walletFor(method),
      discountType: discount.type === 'NONE' ? undefined : discount.type,
      discountValue: discount.type === 'NONE' ? undefined : Number(discount.value) || 0,
      tendered: method === 'CASH' ? pay?.tendered : undefined,
      reference: pay?.reference,
    }, { showError: false });
    if (!res.success || !res.data) throw new Error((res as any).message || 'The sale could not be completed');
    const d = res.data;
    const when = d.receipt?.createdAt || new Date().toISOString();
    const customerName = buyer.kind === 'client' ? buyer.name : buyer.kind === 'walkin' ? buyer.name.trim() : meta.customerName || null;
    // The number on the payment screen wins: it is the one the cashier last confirmed.
    const customerPhone = meta.customerPhone?.trim() || (buyer.kind !== 'none' ? buyer.phone : null) || null;

    // The sale, in the shape the till's receipt and invoice read.
    const sale = {
      id: d.receipt?.id ?? d.receiptNumber,
      saleNumber: d.receiptNumber,
      status: 'COMPLETED',
      currency,
      subtotal: d.subtotal,
      discount: d.discount,
      tax: 0,
      total: d.total,
      customerName,
      customerPhone,
      createdAt: when,
      completedAt: when,
      items: d.lines.map((l) => {
        const p = products.find((x) => x.id === String(l.inventoryItemId));
        return {
          id: l.inventoryItemId, name: l.name, sku: p?.sku ?? '', unit: p?.unit ?? '',
          quantity: l.quantity, unitPrice: l.unitPrice, discount: 0, lineTotal: l.lineTotal,
          imageUrl: p?.imageUrl ?? null,
        };
      }),
      payments: [{
        method: method === 'M_PESA' ? 'MPESA' : method,
        amount: d.total,
        tendered: d.tendered ?? (method === 'CASH' ? pay?.tendered ?? null : null),
        reference: d.reference ?? pay?.reference ?? null,
      }],
    };
    setCart([]);
    setBuyer({ kind: 'none' });
    setDiscount({ type: 'NONE', value: '' });
    // Stock moved: refresh the grid behind the receipt, and the tab counts.
    (refreshInventory || ensureInventory)?.();
    loadStats();
    return sale;
  }, [buyer, cart, walletFor, discount, currency, products, refreshInventory, ensureInventory, loadStats]);

  // ── Scanning: barcode or SKU, resolved from the grid in memory ──────────
  const scan = useCallback(async (code: string): Promise<{ ok: boolean; message?: string }> => {
    const t = code.trim();
    if (!t) return { ok: false };
    const hit = products.find((p) => p.barcode === t || (p.sku && p.sku.toLowerCase() === t.toLowerCase()));
    if (!hit) return { ok: false, message: `Nothing in stock matches ${t}` };
    if (!hit.sellable) return { ok: false, message: `${hit.name} is out of stock` };
    addProduct(hit);
    return { ok: true, message: hit.name };
  }, [products, addProduct]);

  const controller = {
    // The supplier controller's surface, as the till screens read it.
    phase: 'ready' as const,
    error: null,
    till: null,
    shop: null,
    branches: [],
    branchId: clinicId ?? '',
    branch: null,
    canSwitchBranch: false,
    lockedBranches: [],
    switchBranch: () => {},
    online: true,
    products,
    catalogLoaded,
    stats,
    categories: [] as { id: string; name: string; count: number }[],
    reload: async () => { (refreshInventory || ensureInventory)?.(); loadStats(); },
    cart,
    itemCount,
    inCart,
    stockOf,
    addProduct,
    setQuantity,
    bump,
    removeLine,
    clearCart,
    preview,
    pricing: false,
    priceError,
    canTender,
    completeSale,
    scan,
    currency,
  } as unknown as PosController;

  return { pos: controller, buyer, setBuyer, discount, setDiscount, walletId, setWalletId, wallets };
}

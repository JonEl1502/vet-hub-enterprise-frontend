import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  supplierPosAPI,
  type PosProduct,
  type PosProductStat,
  type PosTill,
  type PosBranch,
  type PosShopBrand,
  type PosPreview,
  type PosPaymentInput,
} from '../../../services';

/**
 * Everything the till knows.
 *
 * ── Two rules this hook exists to enforce ──────────────────────────────────
 *
 * 1. THE SERVER OWNS THE MONEY. `preview` is the only source of totals, and it
 *    is re-fetched on every cart change. Nothing here multiplies a price by a
 *    quantity; the cart holds ids and counts, and the numbers on screen are
 *    whatever came back last.
 *
 * 2. THE GRID IS NEVER BLANK. The catalogue is written to localStorage per
 *    branch and rendered from there on the next open, before the network is
 *    asked anything. A till that shows a spinner while a customer waits is a
 *    till the shop stops using.
 */

const CACHE_PREFIX = 'vh_pos_catalog_';
const BRANCH_KEY = 'vh_pos_branch';
/** Long enough to survive a shift, short enough that prices are not stale. */
const CACHE_TTL = 12 * 60 * 60 * 1000;

export interface CartLine {
  productId: string;
  /** Snapshotted for INSTANT rendering only. The server re-prices on preview. */
  name: string;
  unit: string;
  displayPrice: number;
  quantity: number;
}

type Phase = 'loading' | 'ready' | 'error';

interface CachedCatalog {
  at: number;
  products: PosProduct[];
}

const readCache = (branchId: string): PosProduct[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + branchId);
    if (!raw) return null;
    const parsed: CachedCatalog = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL) return null;
    return parsed.products ?? null;
  } catch {
    // A corrupt or unavailable store must never stop the till opening.
    return null;
  }
};

const writeCache = (branchId: string, products: PosProduct[]) => {
  try {
    localStorage.setItem(CACHE_PREFIX + branchId, JSON.stringify({ at: Date.now(), products }));
  } catch {
    /* quota or private mode — the till works without it */
  }
};

export function usePos() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  const [till, setTill] = useState<PosTill | null>(null);
  const [shop, setShop] = useState<PosShopBrand | null>(null);
  const [branches, setBranches] = useState<PosBranch[]>([]);
  const [canSwitchBranch, setCanSwitchBranch] = useState(false);
  const [branchId, setBranchId] = useState<string>(() => localStorage.getItem(BRANCH_KEY) || '');

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [stats, setStats] = useState<Record<string, PosProductStat>>({});
  const [categories, setCategories] = useState<{ id: string; name: string; count: number }[]>([]);
  const [online, setOnline] = useState(true);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [preview, setPreview] = useState<PosPreview | null>(null);
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const currency = shop?.currency || preview?.currency || 'KES';

  // ── Opening the till ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await supplierPosAPI.whoAmI();
        if (cancelled) return;
        const { till: me, branches: branchInfo } = res.data;
        setTill(me);
        setShop(branchInfo.supplier);
        setBranches(branchInfo.branches);
        setCanSwitchBranch(branchInfo.canSwitchBranch);

        // A bound employee's branch always wins over a remembered one — they
        // may have been moved since they last opened the till.
        const resolved =
          me.boundBranchId ||
          (branchInfo.branches.some((b) => b.id === localStorage.getItem(BRANCH_KEY))
            ? localStorage.getItem(BRANCH_KEY)!
            : branchInfo.branches[0]?.id) ||
          '';
        setBranchId(resolved);
        if (resolved) localStorage.setItem(BRANCH_KEY, resolved);
        if (!resolved) {
          setError('This supplier has no active branch to sell from.');
          setPhase('error');
          return;
        }
        setPhase('ready');
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Could not open the till');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Paint the supplier's own colour over the accent, the way STS does. */
  useEffect(() => {
    if (!shop?.primaryColor) return;
    const root = document.querySelector('.supplier-pos') as HTMLElement | null;
    root?.style.setProperty('--sp-accent', shop.primaryColor);
  }, [shop?.primaryColor]);

  // ── Catalogue: cache first, then revalidate ─────────────────────────────

  const loadCatalog = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!branchId) return;
      if (!opts.silent) {
        const cached = readCache(branchId);
        if (cached) setProducts(cached);
      }
      try {
        const [cat, st, cats] = await Promise.all([
          supplierPosAPI.getCatalog(branchId),
          supplierPosAPI.getProductStats(branchId, 30).catch(() => null),
          supplierPosAPI.getCategories().catch(() => null),
        ]);
        setProducts(cat.data.products);
        writeCache(branchId, cat.data.products);
        if (st) {
          setStats(Object.fromEntries(st.data.stats.map((s) => [s.id, s])));
        }
        if (cats) setCategories(cats.data.categories);
        setOnline(true);
      } catch {
        // Offline or the server is down. Whatever is on screen stays on screen —
        // a stale grid still sells, a blank one does not.
        setOnline(false);
      }
    },
    [branchId]
  );

  useEffect(() => {
    if (phase !== 'ready' || !branchId) return;
    setProducts(readCache(branchId) ?? []);
    loadCatalog({ silent: true });
  }, [phase, branchId, loadCatalog]);

  // ── Cart ────────────────────────────────────────────────────────────────

  const stockOf = useCallback(
    (productId: string) => products.find((p) => p.id === productId)?.stock ?? 0,
    [products]
  );

  const inCart = useCallback(
    (productId: string) => cart.find((l) => l.productId === productId)?.quantity ?? 0,
    [cart]
  );

  const addProduct = useCallback((product: PosProduct, qty = 1) => {
    setCart((prev) => {
      const at = prev.findIndex((l) => l.productId === product.id);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], quantity: next[at].quantity + qty };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          displayPrice: product.price,
          quantity: qty,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l))
    );
  }, []);

  const bump = useCallback(
    (productId: string, by: number) => {
      const line = cart.find((l) => l.productId === productId);
      if (!line) return;
      setQuantity(productId, line.quantity + by);
    },
    [cart, setQuantity]
  );

  const removeLine = useCallback(
    (productId: string) => setQuantity(productId, 0),
    [setQuantity]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setPreview(null);
    setPriceError(null);
  }, []);

  const itemCount = useMemo(() => cart.reduce((n, l) => n + l.quantity, 0), [cart]);

  // ── Pricing: the server's answer, debounced ─────────────────────────────

  const priceSeq = useRef(0);

  useEffect(() => {
    if (!branchId) return;
    if (cart.length === 0) {
      setPreview(null);
      setPriceError(null);
      setPricing(false);
      return;
    }

    // ⚠️ A sequence number, not just a cleanup flag. Tapping three tiles fast
    // fires three previews, and without this the FIRST response can land last
    // and show a total for a cart that no longer exists.
    const seq = ++priceSeq.current;
    setPricing(true);

    const t = window.setTimeout(async () => {
      try {
        const res = await supplierPosAPI.previewSale(
          branchId,
          cart.map((l) => ({ supplierProductId: l.productId, quantity: l.quantity }))
        );
        if (seq !== priceSeq.current) return;
        setPreview(res.data);
        setPriceError(null);
        setOnline(true);
      } catch (e: any) {
        if (seq !== priceSeq.current) return;
        setPriceError(e?.message || 'Could not price this sale');
      } finally {
        if (seq === priceSeq.current) setPricing(false);
      }
    }, 250);

    return () => window.clearTimeout(t);
  }, [cart, branchId]);

  /**
   * Whether the till may tender. A basket that the server has not priced, or
   * that it priced with a short line, must not reach the payment screen — the
   * commit would fail anyway, and failing at the tender step is worse because
   * the customer already has money out.
   */
  const canTender =
    cart.length > 0 &&
    !!preview &&
    !pricing &&
    !priceError &&
    !preview.items.some((i) => i.insufficientStock);

  // ── Committing ──────────────────────────────────────────────────────────

  const completeSale = useCallback(
    async (payments: PosPaymentInput[], meta: { customerName?: string; customerPhone?: string } = {}) => {
      if (!branchId) throw new Error('No branch selected');
      const res = await supplierPosAPI.createSale({
        branchId,
        items: cart.map((l) => ({ supplierProductId: l.productId, quantity: l.quantity })),
        payments,
        ...meta,
      });
      clearCart();
      // Refresh in the background: the cashier should be looking at the receipt
      // by now, and blocking on a catalogue fetch would delay the next customer.
      loadCatalog({ silent: true });
      return res.data.sale;
    },
    [branchId, cart, clearCart, loadCatalog]
  );

  // ── Scanning ────────────────────────────────────────────────────────────

  /**
   * A scanner types the code and presses Enter, so this runs on submit.
   * Resolves LOCALLY first — the catalogue is already in memory, and a round
   * trip per scan is the difference between a queue moving and a queue waiting.
   */
  const scan = useCallback(
    async (code: string): Promise<{ ok: boolean; message?: string }> => {
      const trimmed = code.trim();
      if (!trimmed) return { ok: false };

      const local = products.find(
        (p) => p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase()
      );
      if (local) {
        if (!local.sellable) return { ok: false, message: `${local.name} is out of stock` };
        addProduct(local);
        return { ok: true, message: local.name };
      }

      try {
        const res = await supplierPosAPI.scan(trimmed, branchId);
        const hit = res.data.product;
        const full = products.find((p) => p.id === hit.id);
        if (full) {
          addProduct(full);
        } else {
          // Known to the server but not in our cached grid — add it anyway
          // rather than telling the cashier a real product does not exist.
          addProduct({
            id: hit.id,
            name: hit.name,
            category: '',
            sku: trimmed,
            price: hit.price,
            currency,
            unit: hit.unit,
            stock: hit.stock,
            lowStockThreshold: 0,
            inStock: hit.stock > 0,
            isLowStock: false,
            sellable: hit.sellable,
          } as PosProduct);
        }
        return { ok: true, message: hit.name };
      } catch (e: any) {
        return { ok: false, message: e?.message || 'Not found' };
      }
    },
    [products, addProduct, branchId, currency]
  );

  const switchBranch = useCallback(
    (id: string) => {
      if (!canSwitchBranch) return;
      // The cart cannot come along: its prices and stock belong to the branch
      // it was rung up at.
      clearCart();
      setBranchId(id);
      localStorage.setItem(BRANCH_KEY, id);
    },
    [canSwitchBranch, clearCart]
  );

  return {
    phase,
    error,
    till,
    shop,
    branches,
    branchId,
    branch: branches.find((b) => b.id === branchId) ?? null,
    canSwitchBranch,
    switchBranch,
    online,
    products,
    stats,
    categories,
    reload: loadCatalog,
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
    pricing,
    priceError,
    canTender,
    completeSale,
    scan,
    currency,
  };
}

export type PosController = ReturnType<typeof usePos>;

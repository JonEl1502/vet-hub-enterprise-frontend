import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Pill, ChevronDown, ChevronUp, RefreshCw, Check, Package,
} from 'lucide-react';
import ProductStructureFields, { type MainCategory } from '../../shared/common/ProductStructureFields';
import PageHeader from '../../shared/common/PageHeader';
import { unitMath } from '../../../utils/pricing';
import { useAuth } from '../../../contexts/AuthContext';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { supplierProductsAPI } from '../../../services/modules/supplierProducts.api';
import type {
  SupplierProduct,
  CreateSupplierProductData,
  UpdateSupplierProductData,
} from '../../../services/modules/supplierProducts.api';
import { toast } from '../../../services/utils/toast';
import { cache } from '../../../services/utils/cache';
import { uploadsAPI } from '../../../services';

/**
 * Routed full-page version of what used to be the Add/Edit Product modal.
 *
 * Mounted by App.tsx for routes:
 *   - supplier-product-new                  (create mode)
 *   - supplier-product-edit (productId)     (edit mode — fetches the product)
 *
 * Same form fields and validation as the modal it replaces; navigates back
 * to supplier-products on save / cancel via setView.
 */

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'RWF', symbol: 'Fr', name: 'Rwandan Franc' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
];

const BASE_CATEGORIES = [
  'Antibiotics', 'Antifungals', 'Antiparasitics', 'NSAIDs & Analgesics',
  'Corticosteroids', 'Vaccines', 'Anesthetics & Sedatives',
  'Cardiac & Cardiovascular', 'Gastrointestinal', 'Endocrine & Metabolic',
  'Dermatological', 'Ophthalmic', 'Otic', 'Respiratory',
  'Fluids & Electrolytes', 'Reproductive', 'Supplements & Vitamins',
  'Emergency & Critical Care', 'Chemotherapy & Immunosuppressants',
  'Behavioral', 'Urinary', 'Surgical Supplies', 'Diagnostics',
  'Food & Nutrition', 'Grooming', 'Equipment', 'Lab Supplies',
  'Consumables', 'Other',
];

const UNITS = ['each', 'box', 'pack', 'bottle', 'vial', 'ampoule', 'tablet', 'capsule', 'sachet', 'tube', 'dose', 'pair', 'set', 'mg', 'g', 'kg', 'ml', 'L'];

/** "0.5" → "0.50", "" → "0.00" — the preview showed a raw ".5". */
const money = (v: string) => (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getCurrencySymbol = (code: string) => CURRENCIES.find(c => c.code === code)?.symbol ?? code;

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  sku: string;
  unitPrice: string;
  buyPrice: string;
  currency: string;
  unit: string;
  minOrderQty: string;
  stockQty: string;
  lowStockThreshold: string;
  isAvailable: boolean;
  manufacturer: string;
  countryOfOrigin: string;
  imageUrl: string;
  // Shared product structure (155) — carried onto clinic stock on PO receive.
  mainCategory: MainCategory;
  subcategories: string[];
  packSize: string;
  /** What the SUPPLIER suggests clinics resell at. Advisory — they may inherit it. */
  suggestedSellPrice: string;
  /** 323 — shop page offer price and promo line. */
  websitePrice: string;
  promo: string;
  /**
   * The three fields that let buy and sell be quoted in DIFFERENT units — the
   * same contract the clinic's inventory form uses, carried in `metadata` so it
   * rides onto clinic stock on PO receive.
   *
   * `unit` is the STOCK unit (what a Box is). `sellUnit` is what the sell price
   * is quoted in (a Tablet), `costUnit` what the buy price is quoted in, and
   * `sellQty` how many sell units one quoted price covers ("980 per 1 Bottle").
   */
  sellUnit: string;
  costUnit: string;
  sellQty: string;
}

const emptyForm = (defaultCurrency = 'KES'): ProductFormData => ({
  name: '',
  description: '',
  category: '',
  sku: '',
  unitPrice: '',
  buyPrice: '',
  currency: defaultCurrency,
  unit: 'each',
  minOrderQty: '1',
  stockQty: '0',
  lowStockThreshold: '10',
  isAvailable: true,
  manufacturer: '',
  mainCategory: 'MEDICINE' as MainCategory,
  subcategories: [] as string[],
  packSize: '',
  suggestedSellPrice: '',
  websitePrice: '',
  promo: '',
  sellUnit: '',
  costUnit: '',
  sellQty: '1',
  countryOfOrigin: '',
  imageUrl: '',
});

interface DrugResult {
  id: number;
  name: string;
  genericName?: string;
  category: string;
  species: string[];
  unit: string;
}

const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm';

/** How a unit reads in a sentence: "each" is "item" ("Price per item", not "per each"). */
const unitWord = (u: string) => (!u || u === 'each' ? 'item' : u);

/**
 * The catalogue's own unit spelling ("Tablets") onto this form's list ("tablet"),
 * so the dropdown shows what was picked and nothing reads "tabletses".
 */
const normUnit = (raw: string | undefined, fallback: string) => {
  const u = (raw || '').trim().toLowerCase();
  if (!u) return fallback;
  if (UNITS.includes(u)) return u;
  if (u.endsWith('es') && UNITS.includes(u.slice(0, -2))) return u.slice(0, -2);
  if (u.endsWith('s') && UNITS.includes(u.slice(0, -1))) return u.slice(0, -1);
  return u;
};

/** "box" → "boxes", "pack" → "packs", "each" → "items"; measures (mg, ml, L…) stay as they are. */
const plural = (raw: string) => {
  const u = unitWord(raw);
  if (['mg', 'g', 'kg', 'ml', 'L'].includes(u) || u.endsWith('s')) return u;
  if (/(s|x|ch|sh)$/.test(u)) return `${u}es`;
  return `${u}s`;
};

/**
 * The "!" note beside a field (user, 2026-11-12: "for a new user so fields to
 * have ! notes"). Hover or focus shows it on desktop; a tap toggles it on a
 * phone, where there is no hover; tapping anywhere else closes it.
 */
const Hint: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="What is this?"
        aria-expanded={open}
        // Open, never toggle: with a mouse, hover has already opened it, and a
        // toggle would shut it on the very click meant to read it.
        onClick={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-amber-400 hover:bg-amber-500 text-white text-[10px] font-black leading-none flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-300"
      >
        !
      </button>
      {open && (
        <span role="tooltip" className="absolute z-30 left-0 top-6 w-64 max-w-[75vw] rounded-xl bg-pine dark:bg-zinc-700 text-white text-xs font-medium leading-snug px-3 py-2 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
};

/** A plain-words field heading with its "!" note. */
const FieldLabel: React.FC<{ children: React.ReactNode; hint: string; required?: boolean; htmlFor?: string }> = ({ children, hint, required, htmlFor }) => (
  <div className="flex items-center gap-1.5 px-1">
    <label htmlFor={htmlFor} className="text-xs font-bold text-pine dark:text-zinc-200">
      {children}{required && <span className="text-red-500"> *</span>}
    </label>
    <Hint text={hint} />
  </div>
);

interface Props {
  productId?: string;
  setView?: (view: string, params?: any) => void;
}

const SupplierProductFormPage: React.FC<Props> = ({ productId, setView }) => {
  const { user } = useAuth();
  const { searchDrugs, drugCategories } = useReferenceData();
  const supplierCurrency = (user?.supplier as any)?.currency || 'KES';

  const isEdit = !!productId;
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductFormData>(emptyForm(supplierCurrency));
  const [imageUploading, setImageUploading] = useState(false);

  const [drugSearch, setDrugSearch] = useState('');
  const [showDrugSearch, setShowDrugSearch] = useState(false);
  const [drugResults, setDrugResults] = useState<DrugResult[]>([]);
  const [isSearchingDrugs, setIsSearchingDrugs] = useState(false);
  // Collapsed for a new listing; open when editing, where the details already exist.
  const [showMore, setShowMore] = useState(isEdit);

  // Hydrate the form when editing — fetch the product so deep-linked edits
  // (someone opening /supplier-product-edit cold) get a populated form.
  useEffect(() => {
    if (!isEdit || !productId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await supplierProductsAPI.getById(Number(productId));
        if (cancelled) return;
        // The GET /:id endpoint returns the product directly in `data`
        // (sendSuccess(res, product)), not under `data.product`. Accept both
        // shapes so a valid product isn't mistaken for "not found".
        const raw = res.data as any;
        const p = (raw?.product ?? raw) as SupplierProduct | undefined;
        if (!p || !(p as any).id) {
          toast.error('Product not found');
          setView?.('supplier-products');
          return;
        }
        setEditingProduct(p);
        setForm({
          name: p.name,
          description: p.description || '',
          category: p.category,
          sku: p.sku,
          unitPrice: String(p.unitPrice),
          buyPrice: String(p.buyPrice ?? 0),
          currency: p.currency || supplierCurrency,
          unit: p.unit,
          minOrderQty: String(p.minOrderQty),
          stockQty: String(p.stockQty ?? 0),
          lowStockThreshold: String(p.lowStockThreshold ?? 10),
          isAvailable: p.isAvailable,
          manufacturer: p.manufacturer ?? '',
          mainCategory: ((p as any).metadata?.mainCategory === 'CONSUMABLE' ? 'CONSUMABLE' : 'MEDICINE') as MainCategory,
          subcategories: (p as any).metadata?.subcategories ?? [],
          packSize: (p as any).packSize != null ? String((p as any).packSize) : '',
          suggestedSellPrice: (p as any).suggestedSellPrice != null ? String((p as any).suggestedSellPrice) : '',
          websitePrice: (p as any).websitePrice != null ? String((p as any).websitePrice) : '',
          promo: ((p as any).websiteHighlights ?? [])[0] ?? '',
          // Blank means "same as the stock unit" — never invent a split that
          // the product does not have.
          sellUnit: (p as any).metadata?.sellUnit ?? '',
          costUnit: (p as any).metadata?.costUnit ?? '',
          sellQty: (p as any).metadata?.sellQty != null ? String((p as any).metadata.sellQty) : '1',
          countryOfOrigin: p.countryOfOrigin ?? '',
          imageUrl: p.imageUrl ?? '',
        });
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to load product');
        setView?.('supplier-products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Debounced medical-product (drug) search
  useEffect(() => {
    if (!drugSearch.trim() || drugSearch.length < 2) {
      setDrugResults([]);
      setIsSearchingDrugs(false);
      return;
    }
    setIsSearchingDrugs(true);
    const timer = setTimeout(async () => {
      const results = await searchDrugs(drugSearch);
      setDrugResults(results);
      setIsSearchingDrugs(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [drugSearch, searchDrugs]);

  const allCategories = useMemo(() => {
    const merged = new Set<string>([...BASE_CATEGORIES, ...(drugCategories || [])]);
    return Array.from(merged).sort();
  }, [drugCategories]);

  const selectDrug = (drug: DrugResult) => {
    setForm(f => ({
      ...f,
      name: drug.name,
      category: drug.category,
      unit: normUnit(drug.unit, f.unit),
    }));
    setShowDrugSearch(false);
    setDrugSearch('');
    setDrugResults([]);
  };

  const speciesLabel = (species: string[]) =>
    !species || species.length === 0 ? 'All' : species.length > 2 ? `${species.length} species` : species.join('·');

  const speciesBadgeClass = (species: string[]) => {
    if (!species || species.length === 0) return 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300';
    return 'bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300';
  };

  // What one sell price covers: "pack", or "10 vial" when a price is for a bundle.
  const sellLabel = `${Number(form.sellQty) > 0 && Number(form.sellQty) !== 1 ? `${form.sellQty} ` : ''}${unitWord(form.sellUnit || form.unit)}`;

  /**
   * A blank SKU is made for the supplier: a new user does not know what one is,
   * and it only has to be unique per supplier (@@unique([supplierId, sku])).
   */
  const autoSku = (name: string) => {
    const stem = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'ITEM';
    return `${stem}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  };

  /* Margin readout — what this listing makes, live, while it is priced. */
  const marginReadout = (() => {
          const mm = unitMath({
            unit: form.unit,
            sellUnit: form.sellUnit || form.unit,
            costUnit: form.costUnit || form.unit,
            packSize: Number(form.packSize) || 0,
            quantity: form.stockQty,
            price: form.unitPrice,
            costPrice: form.buyPrice,
            sellQty: form.sellQty,
          });
          const sale = mm.salePerSell;
          if (sale <= 0) return null;
          const cur = form.currency;
          const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

          if (mm.cost <= 0) {
            return (
              <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 px-1">
                Add a buy price to see what you make on this listing.
              </p>
            );
          }
          // ⚠️ NO NUMBER rather than a confident wrong one. If cost is quoted in
          // a unit that is neither the stock nor the sell unit, or a split has
          // no pack size to bridge it, the subtraction is meaningless.
          if (mm.costPerSell === null || !mm.resolvable) {
            return (
              <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  {mm.split && mm.sellPerStock === 0
                    ? <>Set <strong>Single items in one {mm.stockU}</strong> below — without it there is no way to work out a per-{mm.sellU} margin from a price quoted per {mm.stockU}.</>
                    : <>The buy price is quoted per <strong>{mm.costU}</strong>, which is neither the stock unit ({mm.stockU}) nor the sell unit ({mm.sellU}) — no margin shown.</>}
                </p>
              </div>
            );
          }

          const profit = sale - mm.costPerSell;
          const markup = mm.costPerSell > 0 ? (profit / mm.costPerSell) * 100 : 0;
          const marginPct = (profit / sale) * 100;
          const stockProfit = profit * mm.qtyInSell;
          const loss = profit < 0;

          return (
            <div className={`px-3 py-2.5 rounded-xl border ${loss
              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
              : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                  {loss ? 'Selling at a loss' : 'Profit'}
                </span>
                <span className={`text-sm font-black font-mono ${loss ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {cur} {n(profit)}<span className="text-[10px] font-bold text-slate-400"> / {mm.sellU}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                  Markup <strong className={loss ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}>{n(markup)}%</strong>
                  {' · '}Margin <strong className={loss ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}>{n(marginPct)}%</strong> of sale
                </span>
                {mm.qty > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                    On {n(mm.qty)} {mm.stockU}
                    {mm.qtyInSell !== mm.qty ? ` (${n(mm.qtyInSell)} ${mm.sellU})` : ''}
                    : <strong className={loss ? 'text-red-600' : 'text-pine dark:text-zinc-100'}>{cur} {n(stockProfit)}</strong>
                  </span>
                )}
              </div>
              {mm.split && (
                <p className="text-[9px] font-bold text-slate-400 mt-1">
                  1 {mm.stockU} = {n(mm.sellPerStock)} {mm.sellU}
                  {mm.costIsStock && <> · buy {cur} {n(mm.cost)} per {mm.costU} ÷ {n(mm.pack)} = {cur} {n(mm.costPerSell)} per {mm.sellU}</>}
                  {mm.costIsSell && <> · buy {cur} {n(mm.cost)} per {mm.sellU}</>}
                </p>
              )}
              {/* The supplier's own margin is not the clinic's. Say so, or the
                  suggested resale price reads as part of this sum. */}
              {Number(form.suggestedSellPrice) > 0 && (
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                  Your suggested resale of {cur} {n(Number(form.suggestedSellPrice))} would leave the clinic{' '}
                  <strong className="text-pine dark:text-zinc-100">
                    {cur} {n(Number(form.suggestedSellPrice) - sale)}
                  </strong>{' '} per {mm.sellU} — their margin, not yours.
                </p>
              )}
            </div>
          );
  })();

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Add the product name');
    if (!form.category.trim()) return toast.error('Choose a category');
    const sellPrice = parseFloat(form.unitPrice);
    if (isNaN(sellPrice) || sellPrice < 0) return toast.error(`Add the price per ${sellLabel}`);
    const buyPrice = parseFloat(form.buyPrice || '0');
    if (isNaN(buyPrice) || buyPrice < 0) return toast.error('Enter a valid buy price');
    const minQty = parseInt(form.minOrderQty, 10);
    if (isNaN(minQty) || minQty < 1) return toast.error('Minimum order quantity must be at least 1');
    const stockQty = parseInt(form.stockQty, 10);
    if (isNaN(stockQty) || stockQty < 0) return toast.error('Stock quantity cannot be negative');
    const lowStockThreshold = parseInt(form.lowStockThreshold, 10);
    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) return toast.error('Low stock threshold cannot be negative');

    setSaving(true);
    try {
      const basePayload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim(),
        sku: form.sku.trim() || autoSku(form.name),
        unitPrice: sellPrice,
        buyPrice,
        currency: form.currency,
        unit: form.unit,
        minOrderQty: minQty,
        stockQty,
        lowStockThreshold,
        isAvailable: form.isAvailable,
        manufacturer: form.manufacturer.trim() || undefined,
        countryOfOrigin: form.countryOfOrigin.trim() || undefined,
        imageUrl: form.imageUrl || undefined,
        // The shared structure (155). An empty sell/cost unit falls back to the
        // listing's own unit, so an untouched product keeps the 1:1 shape it
        // always had rather than acquiring a split nobody asked for.
        metadata: {
          mainCategory: form.mainCategory,
          subcategories: form.subcategories,
          sellUnit: form.sellUnit || form.unit,
          costUnit: form.costUnit || form.unit,
          sellQty: Number(form.sellQty) || 1,
        },
        packSize: form.packSize ? Number(form.packSize) : undefined,
        suggestedSellPrice: form.suggestedSellPrice ? Number(form.suggestedSellPrice) : undefined,
        // Empty sends null so a removed offer is really removed.
        websitePrice: form.websitePrice ? Number(form.websitePrice) : null,
        websiteHighlights: form.promo.trim() ? [form.promo.trim()] : [],
      } as any;

      if (editingProduct) {
        await supplierProductsAPI.update(Number(editingProduct.id), basePayload as UpdateSupplierProductData);
        toast.success('Product updated');
      } else {
        await supplierProductsAPI.create(basePayload as CreateSupplierProductData);
        toast.success('Product added');
      }
      cache.invalidatePattern(/supplier-products/);
      setView?.('supplier-products');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-96 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    /**
     * FULL WIDTH, LEFT-ALIGNED — the app shell's rule, not this page's choice.
     *
     * `<main>` already pads the content area (`p-4 md:p-6 w-full`) and is
     * deliberately NOT centred: centring inside the space left of a fixed
     * sidebar leaves dead air exactly where the nav ends. `max-w-6xl mx-auto`
     * here pushed the form ~110px right of the breadcrumb above it, so the page
     * read as though it had two different left margins (user, 2026-09-12).
     * The two-column grid below already stops the form sprawling on a wide
     * monitor; a second cap is what broke the alignment.
     */
    <div className="space-y-4 pb-20">
      {/* Header — the shared PageHeader. "CATALOGUE" above the title was this
          page's own eyebrow, and it duplicated the breadcrumb two lines above
          it; the subtitle says something the user cannot already read. */}
      <PageHeader
        title={editingProduct ? 'Edit product' : 'Add new product'}
        subtitle={editingProduct
          ? 'Changes take effect on your catalogue as soon as you save.'
          : 'Fill in the basics and add it. Everything under More details is optional.'}
        icon={Package}
        onBack={() => setView?.('supplier-products')}
      />

      {/* ── QUICK ADD (user, 2026-11-12: "Add new product is a bit difficult") ──
          Everything a clinic needs to find and order the product sits in ONE
          short card: name, category, the unit it is sold by, the price per that
          unit and how many are in stock. Every other field is still here, under
          "More details", collapsed for a new listing. Each field carries a "!"
          note in plain words for a supplier who has never used the system
          ("for a new user so fields to have ! notes"). */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-5">
        <div>
          <p className="text-sm font-black text-pine dark:text-zinc-100">The basics</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">This is all a clinic needs to find and order it. Tap a <span className="inline-flex w-3.5 h-3.5 rounded-full bg-amber-400 text-white text-[9px] font-black items-center justify-center align-middle">!</span> for help with any field.</p>
        </div>

        {/* Name — typing searches the medicines catalogue in place of the old
            separate "Medical Products" picker. */}
        <div className="space-y-1.5 relative">
          <FieldLabel htmlFor="sp-name" required hint="The name clinics will search for. Start typing to pick from 6,000+ known medicines: picking one fills in the category and unit for you. You can also type any name of your own.">
            Product name
          </FieldLabel>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="sp-name"
              type="text"
              autoComplete="off"
              value={form.name}
              onChange={e => {
                setForm({ ...form, name: e.target.value });
                if (!isEdit) { setDrugSearch(e.target.value); setShowDrugSearch(true); }
              }}
              onFocus={() => { if (!isEdit && form.name.length >= 2) setShowDrugSearch(true); }}
              onBlur={() => setTimeout(() => setShowDrugSearch(false), 150)}
              placeholder="e.g. Amoxicillin 250mg"
              className={`${INPUT} pl-9`}
            />
          </div>
          {showDrugSearch && drugSearch.length >= 2 && (isSearchingDrugs || drugResults.length > 0) && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-64 overflow-y-auto p-1.5 space-y-0.5">
              <p className="px-2 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500">Pick one to fill in the details, or keep typing your own name</p>
              {isSearchingDrugs ? (
                <div className="flex items-center gap-2 px-2 py-3">
                  <RefreshCw size={12} className="animate-spin text-seafoam" />
                  <span className="text-xs text-slate-400 font-semibold">Searching…</span>
                </div>
              ) : drugResults.map((drug) => (
                <button
                  key={drug.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectDrug(drug)}
                  className="w-full flex items-start justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-seafoam/10 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-pine dark:text-zinc-200 truncate">{drug.name}</p>
                    {drug.genericName && drug.genericName !== drug.name && (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{drug.genericName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${speciesBadgeClass(drug.species)}`}>{speciesLabel(drug.species)}</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md max-w-[90px] truncate">{drug.category}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="sp-category" required hint="What kind of product this is. It groups the item in your catalogue and helps clinics find it.">
              Category
            </FieldLabel>
            <select id="sp-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={INPUT}>
              <option value="">Choose a category…</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="sp-unit" hint="How a clinic orders it from you: one box, one bottle, one vial, or one single tablet. The price and the stock count below are both counted in this unit.">
              You sell it by the…
            </FieldLabel>
            <select id="sp-unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={INPUT}>
              {Array.from(new Set([form.unit, ...UNITS])).map(u => <option key={u} value={u}>{u === 'each' ? 'item (each)' : u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="sp-price" required hint={`What a clinic pays you for ${sellLabel === unitWord(form.unit) ? `one ${sellLabel}` : sellLabel}. Use your selling price, not what it cost you. Your cost goes under More details.`}>
              Price per {sellLabel}
            </FieldLabel>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{getCurrencySymbol(form.currency)}</span>
              <input
                id="sp-price"
                type="number" inputMode="decimal" min="0" step="0.01"
                value={form.unitPrice}
                onChange={e => setForm({ ...form, unitPrice: e.target.value })}
                placeholder="0.00"
                className={`${INPUT} pl-12`}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="sp-stock" hint={`Count what you have on hand right now, in ${plural(form.unit)}${['box', 'pack', 'bottle', 'set'].includes(form.unit) ? ` (whole ${plural(form.unit)}, not the items inside them)` : ''}. Enter 0 if you are waiting for new stock.`}>
              How many {plural(form.unit)} do you have?
            </FieldLabel>
            <div className="relative">
              <input
                id="sp-stock"
                type="number" inputMode="numeric" min="0"
                value={form.stockQty}
                onChange={e => setForm({ ...form, stockQty: e.target.value })}
                placeholder="0"
                className={`${INPUT} pr-20`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{plural(form.unit)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <FieldLabel hint="On: clinics can see and order it. Off: it is saved but hidden from clinics, handy while you are still setting it up.">
            Show it to clinics?
          </FieldLabel>
          <button
            type="button"
            onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
              form.isAvailable
                ? 'border-seafoam bg-seafoam/5 text-seafoam'
                : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-400'
            }`}
          >
            <span className="text-sm font-bold">{form.isAvailable ? 'Yes, show it in my catalogue' : 'No, keep it hidden for now'}</span>
            <span className={`relative w-10 h-5 rounded-full transition-colors ${form.isAvailable ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
          </button>
        </div>
      </div>

      {/* ── MORE DETAILS — optional, collapsed for a new listing ── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMore(v => !v)}
          aria-expanded={showMore}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-black text-pine dark:text-zinc-100">More details <span className="font-semibold text-slate-400">(optional)</span></p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Your cost and profit, pack size, minimum order, low-stock alert, product code, maker, photo and description.</p>
          </div>
          {showMore ? <ChevronUp size={18} className="text-seafoam shrink-0" /> : <ChevronDown size={18} className="text-seafoam shrink-0" />}
        </button>

        {showMore && (
        <div className="border-t border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">

        {/* Cost and profit */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-black text-pine dark:text-zinc-100">Your cost and profit</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-buy" hint="What one costs YOU from your own supplier or maker. Clinics never see this. It is only used to show your profit below.">
                What you paid for it
              </FieldLabel>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-[9rem]">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{getCurrencySymbol(form.currency)}</span>
                  <input
                    id="sp-buy"
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={form.buyPrice}
                    onChange={e => setForm({ ...form, buyPrice: e.target.value })}
                    placeholder="0.00"
                    className={`${INPUT} pl-12`}
                  />
                </div>
                <select
                  value={form.costUnit || form.unit}
                  onChange={e => setForm({ ...form, costUnit: e.target.value })}
                  aria-label="The unit your cost is for"
                  // INPUT carries w-full, which beats w-auto and squeezed the cost box
                  // down to its currency label. Drop it so the select sizes to its text.
                  className={`${INPUT.replace('w-full ', '')} w-auto shrink-0 max-w-[50%]`}
                >
                  {Array.from(new Set([form.unit, ...UNITS])).map(u => <option key={u} value={u}>per {u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-currency" hint="The money your prices are in. It starts as your business currency.">
                Currency
              </FieldLabel>
              <select id="sp-currency" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={`${INPUT} sm:w-32`}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>
          {marginReadout}
        </div>

        {/* Packs and single items */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-black text-pine dark:text-zinc-100">Packs and single items</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-pack" hint={`For example 100 if one ${unitWord(form.unit)} holds 100 tablets. Leave it blank if you sell single items. A clinic that resells by the tablet needs this to price each one.`}>
                Single items in one {unitWord(form.unit)}
              </FieldLabel>
              <input
                id="sp-pack"
                type="number" inputMode="numeric" min="1" step="1"
                value={form.packSize}
                onChange={e => setForm({ ...form, packSize: e.target.value })}
                placeholder="e.g. 100"
                className={INPUT}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel hint={`Usually 1 ${unitWord(form.unit)}. Change it only if one price covers more, for example one price for 10 vials, or if you price by the single tablet out of a box.`}>
                Your price covers
              </FieldLabel>
              <div className="flex gap-2">
                <input
                  type="number" min="0.01" step="any"
                  aria-label="How many units one price covers"
                  value={form.sellQty}
                  onChange={e => setForm({ ...form, sellQty: e.target.value })}
                  className={`${INPUT.replace('w-full ', '')} w-24 shrink-0`}
                />
                <select
                  value={form.sellUnit || form.unit}
                  onChange={e => setForm({ ...form, sellUnit: e.target.value })}
                  aria-label="The unit your price covers"
                  className={`${INPUT} flex-1 min-w-0`}
                >
                  {Array.from(new Set([form.unit, ...UNITS])).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="sp-resale" hint="Optional. What you suggest clinics charge their own clients (pet and farm owners). Advisory only: the clinic can keep it or set its own.">
              Suggested price for the clinic's clients
            </FieldLabel>
            <div className="relative sm:max-w-xs">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{getCurrencySymbol(form.currency)}</span>
              <input
                id="sp-resale"
                type="number" inputMode="decimal" min="0" step="0.01"
                value={form.suggestedSellPrice}
                onChange={e => setForm({ ...form, suggestedSellPrice: e.target.value })}
                placeholder="0.00"
                className={`${INPUT} pl-12`}
              />
            </div>
          </div>
        </div>

        {/* 323 — the shop page: an offer price and a promo line. */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-black text-pine dark:text-zinc-100">On your shop page</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Put this product on offer, or add a short line customers see under it.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-offer" hint="Lower than your normal price. The shop page shows it on a highlight with the normal price struck through and the percentage off. Leave blank for no offer.">
                Offer price
              </FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{getCurrencySymbol(form.currency)}</span>
                <input
                  id="sp-offer"
                  type="number" inputMode="decimal" min="0" step="0.01"
                  value={form.websitePrice}
                  onChange={e => setForm({ ...form, websitePrice: e.target.value })}
                  placeholder="No offer"
                  className={`${INPUT} pl-12`}
                />
              </div>
              {Number(form.websitePrice) > 0 && Number(form.unitPrice) > 0 && (
                Number(form.websitePrice) < Number(form.unitPrice) ? (
                  <p className="text-[11px] font-bold text-emerald-600">
                    {Math.round((1 - Number(form.websitePrice) / Number(form.unitPrice)) * 100)}% off on your shop page
                  </p>
                ) : (
                  <p className="text-[11px] font-bold text-amber-600">Not shown: an offer must be lower than your price.</p>
                )
              )}
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-promo" hint="One short line under the product, like 'Free delivery over 5 bags' or 'New stock in'.">
                Promo line
              </FieldLabel>
              <input
                id="sp-promo"
                value={form.promo}
                maxLength={80}
                onChange={e => setForm({ ...form, promo: e.target.value })}
                placeholder="e.g. Free delivery over 5 bags"
                className={INPUT}
              />
            </div>
          </div>
        </div>

        {/* Ordering and stock alerts */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-black text-pine dark:text-zinc-100">Ordering and stock alerts</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-min" hint={`The fewest ${plural(form.unit)} a clinic can order at once. 1 means no minimum.`}>
                Smallest order you accept
              </FieldLabel>
              <div className="relative">
                <input id="sp-min" type="number" inputMode="numeric" min="1" value={form.minOrderQty} onChange={e => setForm({ ...form, minOrderQty: e.target.value })} placeholder="1" className={`${INPUT} pr-20`} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{plural(form.unit)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-low" hint="When your stock drops to this number you get a low-stock alert, so you can restock before you run out.">
                Warn me when stock drops to
              </FieldLabel>
              <div className="relative">
                <input id="sp-low" type="number" inputMode="numeric" min="0" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} placeholder="10" className={`${INPUT} pr-20`} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{plural(form.unit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Type and sub-groups — the shared product structure (155), the SAME
            controls the clinic uses, so a listing carries its category and
            subcategories onto clinic stock on PO receive. */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-black text-pine dark:text-zinc-100">Medicine or consumable, and sub-groups</p>
            <Hint text="Copied onto the clinic's own stock when they receive your order, so they do not have to type it again. Sub-groups are optional, for example Antibiotic → Cephalosporin." />
          </div>
          <ProductStructureFields
            idPrefix="supplier-product"
            value={{ mainCategory: form.mainCategory, subcategories: form.subcategories }}
            onChange={(next) => setForm({ ...form, mainCategory: next.mainCategory, subcategories: next.subcategories })}
          />
        </div>

        {/* Identification and details */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-black text-pine dark:text-zinc-100">Product code, maker and photo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-sku" hint="Your own stock code for this product. Leave it blank and we make one for you. Each product needs a different code.">
                Product code (SKU)
              </FieldLabel>
              <input id="sp-sku" type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Leave blank to make one" className={INPUT} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-maker" hint="The company that made it. Clinics see it, and it is copied onto their stock.">
                Made by
              </FieldLabel>
              <input id="sp-maker" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} placeholder="e.g. Rekodi Pharmaceuticals" className={INPUT} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sp-country" hint="The country it was made in. Some clinics prefer or must record this.">
                Country it was made in
              </FieldLabel>
              <input id="sp-country" value={form.countryOfOrigin} onChange={e => setForm({ ...form, countryOfOrigin: e.target.value })} placeholder="e.g. Kenya" className={INPUT} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel hint="A clear photo helps clinics recognise the product at a glance. Up to 2 MB.">
                Photo
              </FieldLabel>
              <div className="flex items-center gap-2">
                {form.imageUrl && (
                  <div className="relative shrink-0">
                    <img src={form.imageUrl} alt="Product" className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-zinc-700" />
                    <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full px-1 text-[9px] font-black" title="Remove image">×</button>
                  </div>
                )}
                <label className={`flex-1 cursor-pointer bg-slate-50 dark:bg-zinc-800 border border-dashed border-slate-300 dark:border-zinc-600 rounded-xl px-3 py-3 text-center text-xs font-bold ${imageUploading ? 'text-slate-300' : 'text-seafoam hover:text-pine hover:border-seafoam'} transition-colors`}>
                  {imageUploading ? 'Uploading…' : form.imageUrl ? 'Replace photo' : 'Upload a photo'}
                  <input
                    type="file" accept="image/*" className="hidden" disabled={imageUploading}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
                      setImageUploading(true);
                      try {
                        const res = await uploadsAPI.upload(file, 'misc');
                        setForm(f => ({ ...f, imageUrl: res.publicUrl }));
                      } catch (err: any) { toast.error(err?.message || 'Image upload failed'); }
                      finally { setImageUploading(false); }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="sp-desc" hint="Anything a clinic should know before ordering: strength, dosage, ingredients, storage.">
              Description
            </FieldLabel>
            <textarea
              id="sp-desc"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional: strength, dosage, ingredients, storage…"
              rows={3}
              className={`${INPUT} resize-none`}
            />
          </div>
        </div>
        </div>
        )}
      </div>
      </div>
      {/* Listing preview — how this product reads in the clinic-facing catalogue */}
      <aside className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden lg:sticky lg:top-20">
        <div className="bg-pine text-white px-4 py-3"><p className="text-[10px] font-black uppercase tracking-widest">Listing preview</p></div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-300 shrink-0"><Pill size={20} /></div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{form.name || 'Untitled product'}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase truncate">
                {form.category || 'No category'}
                {form.manufacturer ? ` · ${form.manufacturer}` : ''}
                {form.countryOfOrigin ? ` · ${form.countryOfOrigin}` : ''}
              </p>
            </div>
          </div>
          <div className="space-y-1 text-[11px] font-bold">
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>Sold by the</span><span>{unitWord(form.unit)}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>Your cost</span><span>{getCurrencySymbol(form.currency)} {money(form.buyPrice)}</span></div>
            <div className="flex justify-between text-pine dark:text-zinc-100"><span>Price per {sellLabel}</span><span className="font-black">{getCurrencySymbol(form.currency)} {money(form.unitPrice)}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>In stock</span><span>{form.stockQty || 0} {plural(form.unit)}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>Smallest order</span><span>{form.minOrderQty || 1}</span></div>
          </div>
          <span className={`inline-block px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${form.isAvailable ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
            {form.isAvailable ? 'Visible in catalogue' : 'Hidden from clinics'}
          </span>
        </div>
      </aside>
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-end gap-2 sticky bottom-4 shadow-lg">
        <button
          type="button"
          onClick={() => setView?.('supplier-products')}
          disabled={saving}
          className="px-5 py-2.5 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-60"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
          {editingProduct ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </div>
  );
};

export default SupplierProductFormPage;

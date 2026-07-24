import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Pill, ChevronDown, ChevronUp, RefreshCw, X, Check, ArrowLeft,
} from 'lucide-react';
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
  const drugSearchRef = useRef<HTMLInputElement>(null);

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
        const p = (res.data as any)?.product as SupplierProduct | undefined;
        if (!p) {
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
      unit: drug.unit?.toLowerCase() || f.unit,
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

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Product name is required');
    if (!form.category.trim()) return toast.error('Category is required');
    if (!form.sku.trim()) return toast.error('SKU is required');
    const sellPrice = parseFloat(form.unitPrice);
    if (isNaN(sellPrice) || sellPrice < 0) return toast.error('Enter a valid sell price');
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
        sku: form.sku.trim(),
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
      };

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
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-96 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView?.('supplier-products')}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Back to products"
          >
            <ArrowLeft size={16} className="text-slate-500 dark:text-zinc-400" />
          </button>
          <div>
            <p className="text-[10px] font-black text-seafoam uppercase tracking-[0.3em]">Catalogue</p>
            <h1 className="text-lg sm:text-xl font-black text-pine dark:text-zinc-100 tracking-tight">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h1>
          </div>
        </div>
      </div>

      {/* Medical Products picker */}
      <div className="rounded-2xl border border-seafoam/30 dark:border-seafoam/20 overflow-hidden bg-white dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => {
            setShowDrugSearch(!showDrugSearch);
            if (!showDrugSearch) setTimeout(() => drugSearchRef.current?.focus(), 100);
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-seafoam/5 dark:bg-seafoam/10 hover:bg-seafoam/10 dark:hover:bg-seafoam/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Pill size={14} className="text-seafoam" />
            <span className="text-xs font-black uppercase tracking-wider text-seafoam">Medical Products</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">— click to auto-fill name & category</span>
          </div>
          {showDrugSearch ? <ChevronUp size={14} className="text-seafoam" /> : <ChevronDown size={14} className="text-seafoam" />}
        </button>

        {showDrugSearch && (
          <div className="border-t border-seafoam/20 dark:border-seafoam/10">
            <div className="relative px-3 pt-3">
              <Search size={12} className="absolute left-6 top-1/2 translate-y-0.5 text-slate-400 dark:text-zinc-500" />
              <input
                ref={drugSearchRef}
                type="text"
                placeholder="Search 6000+ medical products (type 2+ chars)..."
                value={drugSearch}
                onChange={e => setDrugSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-400"
              />
              {drugSearch && (
                <button type="button" onClick={() => { setDrugSearch(''); setDrugResults([]); }} className="absolute right-6 top-1/2 translate-y-0.5 text-slate-400 hover:text-pine transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="px-3 pb-3 pt-2 max-h-64 overflow-y-auto space-y-1">
              {isSearchingDrugs ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <RefreshCw size={12} className="animate-spin text-seafoam" />
                  <p className="text-xs text-slate-400 dark:text-zinc-500 font-semibold">Searching...</p>
                </div>
              ) : drugSearch.length >= 2 && drugResults.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 py-2 text-center font-semibold">No products found</p>
              ) : drugSearch.length < 2 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 py-2 text-center font-semibold">Type 2+ characters to search</p>
              ) : drugResults.map((drug) => (
                <button
                  key={drug.id}
                  type="button"
                  onClick={() => selectDrug(drug)}
                  className="w-full flex items-start justify-between gap-3 px-3 py-2 rounded-xl hover:bg-seafoam/10 dark:hover:bg-seafoam/15 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-pine dark:text-zinc-200 truncate group-hover:text-seafoam transition-colors">{drug.name}</p>
                    {drug.genericName && drug.genericName !== drug.name && (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{drug.genericName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${speciesBadgeClass(drug.species)}`}>{speciesLabel(drug.species)}</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md max-w-[80px] truncate">{drug.category}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form body — numbered section cards + live listing preview (design-mockup parity) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4 items-start">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl min-w-0 divide-y divide-slate-100 dark:divide-zinc-800">
      <div className="p-5 space-y-4">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
          <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">1</span> Basic Information
        </p>
        {/* Name */}
        <div className="space-y-1">
          <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Product Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Amoxicillin 250mg"
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
          />
        </div>

        {/* SKU + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">SKU *</label>
            <input
              type="text"
              value={form.sku}
              onChange={e => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. AMOX-250"
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Category *</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
            >
              <option value="">Select…</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
          <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">2</span> Pricing
        </p>
        {/* Buy + Sell + Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Buy Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">{getCurrencySymbol(form.currency)}</span>
              <input
                type="number"
                value={form.buyPrice}
                onChange={e => setForm({ ...form, buyPrice: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Sell Price *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">{getCurrencySymbol(form.currency)}</span>
              <input
                type="number"
                value={form.unitPrice}
                onChange={e => setForm({ ...form, unitPrice: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Currency</label>
            <select
              value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
        </div>
        {(() => {
          const b = parseFloat(form.buyPrice); const s = parseFloat(form.unitPrice);
          if (!b || !s || b <= 0) return null;
          const m = Math.round(((s - b) / b) * 100);
          return <p className={`text-[10px] font-black ${m >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Margin: {m > 0 ? '+' : ''}{m}% per {form.unit}</p>;
        })()}
      </div>

      <div className="p-5 space-y-4">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
          <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">3</span> Stock & Ordering
        </p>
        {/* Unit + Min Order + Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Unit</label>
            <select
              value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Min Order</label>
            <input
              type="number"
              value={form.minOrderQty}
              onChange={e => setForm({ ...form, minOrderQty: e.target.value })}
              placeholder="1"
              min="1"
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Stock Qty</label>
            <input
              type="number"
              value={form.stockQty}
              onChange={e => setForm({ ...form, stockQty: e.target.value })}
              placeholder="0"
              min="0"
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
            />
          </div>
        </div>

        {/* Low stock + Available */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Low Stock Threshold</label>
            <input
              type="number"
              value={form.lowStockThreshold}
              onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })}
              placeholder="10"
              min="0"
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Available</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                form.isAvailable
                  ? 'border-seafoam bg-seafoam/5 text-seafoam'
                  : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-400'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-widest">{form.isAvailable ? 'In catalogue' : 'Hidden from clinics'}</span>
              <span className={`relative w-10 h-5 rounded-full transition-colors ${form.isAvailable ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
        </div>

      </div>

      <div className="p-5 space-y-4">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
          <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">4</span> Provenance & Details
        </p>
        {/* Manufacturer + country + product image — flows into
            clinic inventory when a PO from this listing is received. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Manufacturer</label>
            <input
              value={form.manufacturer}
              onChange={e => setForm({ ...form, manufacturer: e.target.value })}
              placeholder="e.g. Rekodi Pharmaceuticals"
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Country of Origin</label>
            <input
              value={form.countryOfOrigin}
              onChange={e => setForm({ ...form, countryOfOrigin: e.target.value })}
              placeholder="e.g. Kenya"
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Product Image</label>
            <div className="flex items-center gap-2">
              {form.imageUrl && (
                <div className="relative shrink-0">
                  <img src={form.imageUrl} alt="Product" className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-zinc-700" />
                  <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full px-1 text-[9px] font-black" title="Remove image">×</button>
                </div>
              )}
              <label className={`flex-1 cursor-pointer bg-slate-50 dark:bg-zinc-800 border border-dashed border-slate-300 dark:border-zinc-600 rounded-xl px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider ${imageUploading ? 'text-slate-300' : 'text-seafoam hover:text-pine hover:border-seafoam'} transition-colors`}>
                {imageUploading ? 'Uploading…' : form.imageUrl ? 'Replace' : 'Upload (≤2MB)'}
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

        {/* Description */}
        <div className="space-y-1">
          <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Optional product details, dosage, ingredients…"
            rows={3}
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 placeholder-slate-300 dark:placeholder-zinc-600 text-sm resize-none"
          />
        </div>
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
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>Unit</span><span>{form.unit}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>Buy price</span><span>{getCurrencySymbol(form.currency)} {form.buyPrice || '0.00'}</span></div>
            <div className="flex justify-between text-pine dark:text-zinc-100"><span>Sell price</span><span className="font-black">{getCurrencySymbol(form.currency)} {form.unitPrice || '0.00'}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>Stock</span><span>{form.stockQty || 0} {form.unit}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-zinc-400"><span>Min order</span><span>{form.minOrderQty || 1}</span></div>
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

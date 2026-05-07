import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Package,
  Check,
  ChevronDown,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Pill,
  ChevronUp,
} from 'lucide-react';
import { DateRangePicker, DateRange } from '../../shared/common/DateRangePicker';
import { supplierProductsAPI } from '../../../services/modules/supplierProducts.api';
import type {
  SupplierProduct,
  CreateSupplierProductData,
  UpdateSupplierProductData,
} from '../../../services/modules/supplierProducts.api';
import { toast } from '../../../services/utils/toast';
import { useAuth } from '../../../contexts/AuthContext';
import { cache } from '../../../services/utils/cache';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';

// ─── Constants ───────────────────────────────────────────────────────────────

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

const getCurrencySymbol = (code: string) => CURRENCIES.find(c => c.code === code)?.symbol ?? code;

const BASE_CATEGORIES = [
  'Antibiotics',
  'Antifungals',
  'Antiparasitics',
  'NSAIDs & Analgesics',
  'Corticosteroids',
  'Vaccines',
  'Anesthetics & Sedatives',
  'Cardiac & Cardiovascular',
  'Gastrointestinal',
  'Endocrine & Metabolic',
  'Dermatological',
  'Ophthalmic',
  'Otic',
  'Respiratory',
  'Fluids & Electrolytes',
  'Reproductive',
  'Supplements & Vitamins',
  'Emergency & Critical Care',
  'Chemotherapy & Immunosuppressants',
  'Behavioral',
  'Urinary',
  'Surgical Supplies',
  'Diagnostics',
  'Food & Nutrition',
  'Grooming',
  'Equipment',
  'Lab Supplies',
  'Consumables',
  'Other',
];

const UNITS = ['each', 'box', 'pack', 'bottle', 'vial', 'kg', 'g', 'ml', 'L', 'pair', 'set'];

// Drug database is now served from the backend API via ReferenceDataContext.searchDrugs()

// ─── Types ────────────────────────────────────────────────────────────────────

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
});

interface SupplierProductsViewProps {
  setView?: (view: string, params?: any) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DrugResult {
  id: number;
  name: string;
  genericName?: string;
  category: string;
  species: string[];
  unit: string;
}

const SupplierProductsView: React.FC<SupplierProductsViewProps> = ({ setView }) => {
  const { user } = useAuth();
  const { searchDrugs, drugCategories } = useReferenceData();

  // Admin scope helpers — show the supplier badge on each product card when
  // the admin is viewing more than one supplier (or all of them).
  const role = user?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'MERCHANT_ADMIN';
  const selectedSupplierIds = useMemo<string[]>(() => {
    try {
      const raw = localStorage.getItem('selectedSupplierIds');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch { return []; }
  }, []);
  const showSupplierColumn = isAdmin && selectedSupplierIds.length !== 1;

  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE' | 'LOW_STOCK'>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);
  const supplierCurrency = user?.supplier?.currency || 'KES';
  const [form, setForm] = useState<ProductFormData>(emptyForm(supplierCurrency));
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SupplierProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Drug lookup
  const [drugSearch, setDrugSearch] = useState('');
  const [showDrugSearch, setShowDrugSearch] = useState(false);
  const drugSearchRef = useRef<HTMLInputElement>(null);

  const PRODUCTS_CACHE_KEY = '/supplier-products';
  const PRODUCTS_CACHE_PARAMS = { limit: 500 };

  const fetchProducts = async (silent = false) => {
    if (silent) {
      // Refresh button: bust the client cache so the next non-silent
      // load reads fresh from network too.
      cache.invalidatePattern(/supplier-products/);
    } else {
      const cached = cache.get<SupplierProduct[]>(PRODUCTS_CACHE_KEY, PRODUCTS_CACHE_PARAMS);
      if (cached) {
        setProducts(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
    }
    if (silent) setRefreshing(true);
    try {
      const res = await supplierProductsAPI.getMyProducts({ limit: 500 });
      const data = res.data.data || [];
      cache.set(PRODUCTS_CACHE_KEY, data, PRODUCTS_CACHE_PARAMS, 30 * 60 * 1000);
      setProducts(data);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (availabilityFilter === 'AVAILABLE' && !p.isAvailable) return false;
      if (availabilityFilter === 'UNAVAILABLE' && p.isAvailable) return false;
      if (availabilityFilter === 'LOW_STOCK' && (p.stockQty ?? 0) > (p.lowStockThreshold ?? 10)) return false;
      if (dateRange?.start) {
        const created = new Date((p as any).createdAt || 0);
        if (created < dateRange.start) return false;
      }
      if (dateRange?.end) {
        const created = new Date((p as any).createdAt || 0);
        const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      return true;
    });
  }, [products, search, categoryFilter, availabilityFilter, dateRange]);

  // Merge base categories with DB drug categories + product categories
  const CATEGORIES = useMemo(() => {
    const cats = new Set([...BASE_CATEGORIES, ...drugCategories, ...products.map(p => p.category)]);
    return Array.from(cats).sort();
  }, [drugCategories, products]);

  const allCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const [drugResults, setDrugResults] = useState<DrugResult[]>([]);
  const [isSearchingDrugs, setIsSearchingDrugs] = useState(false);

  // Debounced API drug search
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

  // Add / edit are full pages now — navigate instead of opening the modal.
  // The modal block lower down in this file is dead code retained until the
  // next cleanup pass; nothing flips showModal to true any more.
  const openAdd = () => {
    setView?.('supplier-product-new');
  };

  const openEdit = (product: SupplierProduct) => {
    setView?.('supplier-product-edit', { productId: String(product.id) });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setForm(emptyForm(supplierCurrency));
    setDrugSearch('');
    setShowDrugSearch(false);
  };

  const selectDrug = (drug: DrugResult) => {
    setForm(f => ({ ...f, name: drug.name, category: drug.category, unit: drug.unit?.toLowerCase() || f.unit }));
    setShowDrugSearch(false);
    setDrugSearch('');
    setDrugResults([]);
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
      if (editingProduct) {
        const payload: UpdateSupplierProductData = {
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
        };
        const res = await supplierProductsAPI.update(Number(editingProduct.id), payload);
        // Optimistic update: apply response data immediately
        const updated = res.data?.product;
        if (updated) {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...updated } : p));
        }
        toast.success('Product updated');
      } else {
        const payload: CreateSupplierProductData = {
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
        };
        const res = await supplierProductsAPI.create(payload);
        const created = res.data?.product;
        if (created) {
          setProducts(prev => [created, ...prev]);
        }
        toast.success('Product added');
      }
      closeModal();
      // Bust cache so next full fetch gets fresh data from server
      cache.invalidatePattern(/supplier-products/);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supplierProductsAPI.delete(Number(deleteTarget.id));
      cache.invalidatePattern(/supplier-products/);
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
      toast.success('Product deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const toggleAvailability = async (product: SupplierProduct) => {
    setTogglingId(product.id);
    try {
      await supplierProductsAPI.update(Number(product.id), { isAvailable: !product.isAvailable });
      cache.invalidatePattern(/supplier-products/);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isAvailable: !product.isAvailable } : p));
    } catch {
      toast.error('Failed to update availability');
    } finally {
      setTogglingId(null);
    }
  };

  const speciesLabel = (species: string[]) => {
    if (!species || species.length === 0) return 'All';
    if (species.length <= 2) return species.join('/');
    return `${species.length} species`;
  };

  const speciesBadgeClass = (species: string[]) => {
    if (!species || species.length === 0) return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
    if (species.length === 1 && species[0] === 'Dog') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (species.length === 1 && species[0] === 'Cat') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const hasActiveFilters = search || (dateRange?.start || dateRange?.end) || categoryFilter !== 'ALL' || availabilityFilter !== 'ALL';

  return (
    <div className="space-y-4">
      {/* Filter card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">

        {/* Row 1: search + date range */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/40 placeholder-slate-400 dark:placeholder-zinc-600"
            />
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Row 2: selects + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          >
            <option value="ALL">All Categories</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={availabilityFilter}
            onChange={e => setAvailabilityFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          >
            <option value="ALL">All Availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="UNAVAILABLE">Unavailable</option>
            <option value="LOW_STOCK">Low Stock</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setDateRange(null); setCategoryFilter('ALL'); setAvailabilityFilter('ALL'); }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
          <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 ml-auto">
            {filtered.length} results
          </span>
          <button
            onClick={() => fetchProducts(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
            title="Refresh"
          >
            <RefreshCw size={13} className={`text-slate-500 dark:text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-semibold text-xs uppercase tracking-wide hover:opacity-90 transition-all shadow-sm"
          >
            <Plus size={13} />
            Add Product
          </button>
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <Package size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">No products found</p>
          {products.length === 0 && (
            <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-xs uppercase hover:opacity-90 transition-all">
              Add First Product
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => {
            const sym = getCurrencySymbol(p.currency || 'USD');
            const qty = p.stockQty ?? 0;
            const threshold = p.lowStockThreshold ?? 10;
            const isLow = qty <= threshold && qty > 0;
            const isOut = qty === 0;
            const margin = p.buyPrice > 0 ? Math.round(((p.unitPrice - p.buyPrice) / p.buyPrice) * 100) : null;
            return (
              <div key={p.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-zinc-800 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-pine dark:text-zinc-100 text-sm leading-tight truncate">{p.name}</p>
                    {p.description && <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{p.description}</p>}
                    {showSupplierColumn && (p as any).supplier?.name && (
                      <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-400">
                        <span className="text-[9px] font-black uppercase tracking-widest truncate max-w-[140px]">
                          {(p as any).supplier.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleAvailability(p)}
                      disabled={togglingId === p.id}
                      className="transition-all"
                      title={p.isAvailable ? 'Mark unavailable' : 'Mark available'}
                    >
                      {togglingId === p.id
                        ? <RefreshCw size={18} className="animate-spin text-slate-400" />
                        : p.isAvailable
                          ? <ToggleRight size={22} className="text-green-500 hover:opacity-80" />
                          : <ToggleLeft size={22} className="text-slate-400 dark:text-zinc-600 hover:opacity-80" />
                      }
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">SKU</span>
                    <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">{p.sku}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">Category</span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full truncate">{p.category}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">Unit / Min</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">{p.unit} · min {p.minOrderQty}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">Stock</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-600 dark:text-green-400'}`}>{qty}</span>
                      {isOut && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Out</span>}
                      {isLow && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">Low</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">Buy</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">
                      {p.buyPrice > 0 ? `${sym}${parseFloat(String(p.buyPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">Sell</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-pine dark:text-zinc-100 text-sm">
                        {sym}{parseFloat(String(p.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {margin !== null && <span className="text-[9px] font-black text-green-500">+{margin}%</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
                <X size={16} className="text-slate-500 dark:text-zinc-400" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
              {/* Drug Database Search */}
              {!editingProduct && (
                <div className="mx-6 mt-5 rounded-2xl border border-seafoam/30 dark:border-seafoam/20 overflow-hidden">
                  <button
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
                          className="w-full pl-8 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-400"
                        />
                        {drugSearch && (
                          <button onClick={() => { setDrugSearch(''); setDrugResults([]); }} className="absolute right-6 top-1/2 translate-y-0.5 text-slate-400 hover:text-pine transition-colors">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="px-3 pb-3 pt-2 max-h-48 overflow-y-auto space-y-1">
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
              )}

              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Product Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Amoxicillin 250mg"
                    className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
                  />
                </div>

                {/* SKU + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">SKU *</label>
                    <input
                      type="text"
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))}
                      placeholder="e.g. AMOX-250"
                      className="w-full px-4 py-2.5 text-sm font-mono font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Category *</label>
                    <div className="relative">
                      <select
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full appearance-none px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-8"
                      >
                        <option value="">Select...</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Buy Price + Sell Price + Currency */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Buy Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black pointer-events-none">{getCurrencySymbol(form.currency)}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.buyPrice}
                        onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Sell Price *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black pointer-events-none">{getCurrencySymbol(form.currency)}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.unitPrice}
                        onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Currency</label>
                    <div className="relative">
                      <select
                        value={form.currency}
                        onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full appearance-none px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-7"
                      >
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Unit + Min Order + Stock */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Unit</label>
                    <div className="relative">
                      <select
                        value={form.unit}
                        onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                        className="w-full appearance-none px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-7"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Min Order</label>
                    <input
                      type="number"
                      min="1"
                      value={form.minOrderQty}
                      onChange={e => setForm(f => ({ ...f, minOrderQty: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Stock Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={form.stockQty}
                      onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
                    />
                  </div>
                </div>

                {/* Low Stock Threshold */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                    Low Stock Alert Threshold
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      value={form.lowStockThreshold}
                      onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))}
                      className="w-32 px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50"
                    />
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Alert shown when stock falls at or below this number</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional product description..."
                    rows={2}
                    className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600 resize-none"
                  />
                </div>

                {/* Availability */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                  <div>
                    <p className="text-xs font-black uppercase text-pine dark:text-zinc-200">Available for Order</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Clinics can include this in purchase orders</p>
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
                    className="transition-all"
                  >
                    {form.isAvailable ? (
                      <ToggleRight size={28} className="text-green-500" />
                    ) : (
                      <ToggleLeft size={28} className="text-slate-400 dark:text-zinc-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-60"
              >
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                {editingProduct ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-sm p-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Delete Product?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                <span className="font-bold text-pine dark:text-zinc-200">{deleteTarget.name}</span> will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600 transition-all disabled:opacity-60"
              >
                {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierProductsView;

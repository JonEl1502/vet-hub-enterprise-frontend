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
import { DateRangePicker, DateRange } from './DateRangePicker';
import { supplierProductsAPI } from '../services/modules/supplierProducts.api';
import type {
  SupplierProduct,
  CreateSupplierProductData,
  UpdateSupplierProductData,
} from '../services/modules/supplierProducts.api';
import { toast } from '../services/utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { cache } from '../services/utils/cache';

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

const CATEGORIES = [
  'Allergies & Itching',
  'Anxiety & Sedation',
  'Diabetes',
  'Diarrhea',
  'Fleas & Ticks',
  'Heartworms',
  'Infections',
  'Nausea & Vomiting',
  'Pain & Arthritis',
  'Seizures',
  'Stomach Ulcers',
  'Vaccines',
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

// ─── Pet Medication Database (WebMD Pet Meds categories) ──────────────────────

interface PetDrug {
  name: string;
  category: string;
  species: 'Dogs' | 'Cats' | 'Both';
  purpose: string;
}

const PET_MEDICATIONS: PetDrug[] = [
  // Allergies & Itching
  { name: 'Apoquel (Oclacitinib)', category: 'Allergies & Itching', species: 'Dogs', purpose: 'JAK inhibitor for itch and allergy control' },
  { name: 'Cytopoint (Lokivetmab)', category: 'Allergies & Itching', species: 'Dogs', purpose: 'Monoclonal antibody for atopic dermatitis' },
  { name: 'Atopica (Cyclosporine)', category: 'Allergies & Itching', species: 'Both', purpose: 'Immunosuppressant for atopy' },
  { name: 'Benadryl (Diphenhydramine)', category: 'Allergies & Itching', species: 'Both', purpose: 'Antihistamine for allergic reactions' },
  { name: 'Hydroxyzine HCl', category: 'Allergies & Itching', species: 'Both', purpose: 'Antihistamine for allergic pruritus' },
  { name: 'Prednisolone', category: 'Allergies & Itching', species: 'Both', purpose: 'Corticosteroid for allergic inflammation' },
  { name: 'Chlorpheniramine', category: 'Allergies & Itching', species: 'Both', purpose: 'Antihistamine for mild allergic reactions' },
  { name: 'Omega-3 Fatty Acids', category: 'Allergies & Itching', species: 'Both', purpose: 'Anti-inflammatory supplement for skin health' },
  { name: 'Dexamethasone', category: 'Allergies & Itching', species: 'Both', purpose: 'Potent corticosteroid for severe allergic reactions' },

  // Anxiety & Sedation
  { name: 'Trazodone', category: 'Anxiety & Sedation', species: 'Dogs', purpose: 'Serotonin antagonist for situational anxiety' },
  { name: 'Gabapentin', category: 'Anxiety & Sedation', species: 'Both', purpose: 'Anticonvulsant also used for anxiety and pain' },
  { name: 'Alprazolam (Xanax)', category: 'Anxiety & Sedation', species: 'Both', purpose: 'Benzodiazepine for acute anxiety episodes' },
  { name: 'Diazepam (Valium)', category: 'Anxiety & Sedation', species: 'Both', purpose: 'Benzodiazepine for anxiety and sedation' },
  { name: 'Clomipramine (Clomicalm)', category: 'Anxiety & Sedation', species: 'Dogs', purpose: 'TCA antidepressant for separation anxiety' },
  { name: 'Fluoxetine (Reconcile)', category: 'Anxiety & Sedation', species: 'Both', purpose: 'SSRI for anxiety and compulsive disorders' },
  { name: 'Sileo (Dexmedetomidine)', category: 'Anxiety & Sedation', species: 'Dogs', purpose: 'Alpha-2 agonist for noise aversion' },
  { name: 'Zylkene (Alpha-casozepine)', category: 'Anxiety & Sedation', species: 'Both', purpose: 'Natural calming supplement' },
  { name: 'Buspirone', category: 'Anxiety & Sedation', species: 'Cats', purpose: 'Anxiolytic for feline anxiety disorders' },
  { name: 'Acepromazine', category: 'Anxiety & Sedation', species: 'Both', purpose: 'Phenothiazine sedative for pre-anesthetic use' },

  // Diabetes
  { name: 'Vetsulin (Porcine Insulin)', category: 'Diabetes', species: 'Both', purpose: 'Intermediate-acting insulin for diabetes management' },
  { name: 'ProZinc (Protamine Zinc Insulin)', category: 'Diabetes', species: 'Cats', purpose: 'Long-acting insulin for feline diabetes' },
  { name: 'Caninsulin', category: 'Diabetes', species: 'Dogs', purpose: 'Intermediate-acting insulin for canine diabetes' },
  { name: 'Glipizide', category: 'Diabetes', species: 'Cats', purpose: 'Oral sulfonylurea for mild feline diabetes' },
  { name: 'Acarbose', category: 'Diabetes', species: 'Both', purpose: 'Alpha-glucosidase inhibitor for glucose control' },

  // Diarrhea
  { name: 'Metronidazole (Flagyl)', category: 'Diarrhea', species: 'Both', purpose: 'Antibiotic/antiprotozoal for GI infections and diarrhea' },
  { name: 'Tylosin (Tylan)', category: 'Diarrhea', species: 'Both', purpose: 'Antibiotic for chronic diarrhea and colitis' },
  { name: 'Kaolin-Pectin', category: 'Diarrhea', species: 'Both', purpose: 'Adsorbent antidiarrheal for mild diarrhea' },
  { name: 'FortiFlora (Probiotic)', category: 'Diarrhea', species: 'Both', purpose: 'Probiotic for GI microbiome support' },
  { name: 'Loperamide (Imodium)', category: 'Diarrhea', species: 'Dogs', purpose: 'Antidiarrheal for uncomplicated diarrhea' },
  { name: 'Sulfasalazine', category: 'Diarrhea', species: 'Dogs', purpose: 'Anti-inflammatory for ulcerative colitis' },
  { name: 'Psyllium Husk', category: 'Diarrhea', species: 'Both', purpose: 'Soluble fiber for stool normalization' },

  // Fleas & Ticks
  { name: 'NexGard (Afoxolaner)', category: 'Fleas & Ticks', species: 'Dogs', purpose: 'Oral flea and tick treatment (monthly)' },
  { name: 'Bravecto (Fluralaner)', category: 'Fleas & Ticks', species: 'Both', purpose: 'Oral/topical long-acting flea and tick control' },
  { name: 'Frontline Plus (Fipronil)', category: 'Fleas & Ticks', species: 'Both', purpose: 'Topical flea and tick spot-on treatment' },
  { name: 'Revolution (Selamectin)', category: 'Fleas & Ticks', species: 'Both', purpose: 'Topical broad-spectrum parasite control' },
  { name: 'Seresto Collar', category: 'Fleas & Ticks', species: 'Both', purpose: '8-month flea and tick collar' },
  { name: 'Simparica (Sarolaner)', category: 'Fleas & Ticks', species: 'Dogs', purpose: 'Oral flea and tick tablet (monthly)' },
  { name: 'Comfortis (Spinosad)', category: 'Fleas & Ticks', species: 'Dogs', purpose: 'Oral flea-only treatment (monthly)' },
  { name: 'Credelio (Lotilaner)', category: 'Fleas & Ticks', species: 'Both', purpose: 'Oral flea and tick tablet' },
  { name: 'Capstar (Nitenpyram)', category: 'Fleas & Ticks', species: 'Both', purpose: 'Fast-acting oral flea treatment (24hr)' },
  { name: 'Advantage Multi', category: 'Fleas & Ticks', species: 'Both', purpose: 'Topical broad-spectrum parasite prevention' },

  // Heartworms
  { name: 'Heartgard Plus (Ivermectin)', category: 'Heartworms', species: 'Dogs', purpose: 'Monthly heartworm prevention chewable' },
  { name: 'Interceptor Plus (Milbemycin)', category: 'Heartworms', species: 'Dogs', purpose: 'Monthly heartworm and intestinal worm prevention' },
  { name: 'Trifexis (Spinosad + Milbemycin)', category: 'Heartworms', species: 'Dogs', purpose: 'Oral heartworm + flea prevention (monthly)' },
  { name: 'Sentinel Spectrum', category: 'Heartworms', species: 'Dogs', purpose: 'Monthly broad-spectrum parasite prevention' },
  { name: 'ProHeart 6 (Moxidectin)', category: 'Heartworms', species: 'Dogs', purpose: '6-month injectable heartworm prevention' },
  { name: 'ProHeart 12 (Moxidectin)', category: 'Heartworms', species: 'Dogs', purpose: '12-month injectable heartworm prevention' },
  { name: 'Iverhart Plus (Ivermectin)', category: 'Heartworms', species: 'Dogs', purpose: 'Monthly heartworm and hookworm/roundworm prevention' },

  // Infections
  { name: 'Amoxicillin', category: 'Infections', species: 'Both', purpose: 'Broad-spectrum penicillin antibiotic' },
  { name: 'Amoxicillin-Clavulanate (Clavamox)', category: 'Infections', species: 'Both', purpose: 'Beta-lactamase-resistant antibiotic for skin/dental' },
  { name: 'Doxycycline', category: 'Infections', species: 'Both', purpose: 'Tetracycline for bacterial and tick-borne infections' },
  { name: 'Enrofloxacin (Baytril)', category: 'Infections', species: 'Both', purpose: 'Fluoroquinolone for urinary/respiratory infections' },
  { name: 'Clindamycin', category: 'Infections', species: 'Both', purpose: 'Lincosamide for dental, skin, and bone infections' },
  { name: 'Trimethoprim-Sulfa (Bactrim)', category: 'Infections', species: 'Both', purpose: 'Antibiotic for UTI, skin, and respiratory infections' },
  { name: 'Marbofloxacin (Zeniquin)', category: 'Infections', species: 'Both', purpose: 'Fluoroquinolone antibiotic' },
  { name: 'Cephalexin', category: 'Infections', species: 'Both', purpose: 'Cephalosporin for skin and soft tissue infections' },
  { name: 'Ketoconazole', category: 'Infections', species: 'Both', purpose: 'Antifungal for skin and systemic fungal infections' },
  { name: 'Fluconazole', category: 'Infections', species: 'Both', purpose: 'Antifungal for systemic and cutaneous fungal infections' },
  { name: 'Itraconazole', category: 'Infections', species: 'Both', purpose: 'Broad-spectrum antifungal' },
  { name: 'Pradofloxacin (Veraflox)', category: 'Infections', species: 'Both', purpose: 'Fluoroquinolone for skin and respiratory infections' },
  { name: 'Azithromycin', category: 'Infections', species: 'Both', purpose: 'Macrolide antibiotic for respiratory infections' },

  // Nausea & Vomiting
  { name: 'Cerenia (Maropitant)', category: 'Nausea & Vomiting', species: 'Both', purpose: 'NK1 receptor antagonist antiemetic' },
  { name: 'Metoclopramide (Reglan)', category: 'Nausea & Vomiting', species: 'Both', purpose: 'Prokinetic and antiemetic for GI motility' },
  { name: 'Ondansetron (Zofran)', category: 'Nausea & Vomiting', species: 'Both', purpose: '5-HT3 antagonist antiemetic' },
  { name: 'Famotidine (Pepcid)', category: 'Nausea & Vomiting', species: 'Both', purpose: 'H2 blocker for nausea and acid reduction' },
  { name: 'Mirtazapine', category: 'Nausea & Vomiting', species: 'Cats', purpose: 'Appetite stimulant and antiemetic for cats' },
  { name: 'Chlorpromazine', category: 'Nausea & Vomiting', species: 'Both', purpose: 'Phenothiazine antiemetic for severe vomiting' },

  // Pain & Arthritis
  { name: 'Meloxicam (Metacam)', category: 'Pain & Arthritis', species: 'Both', purpose: 'NSAID for pain and inflammation' },
  { name: 'Carprofen (Rimadyl)', category: 'Pain & Arthritis', species: 'Dogs', purpose: 'NSAID for osteoarthritis and postoperative pain' },
  { name: 'Galliprant (Grapiprant)', category: 'Pain & Arthritis', species: 'Dogs', purpose: 'EP4 receptor antagonist NSAID for OA pain' },
  { name: 'Previcox (Firocoxib)', category: 'Pain & Arthritis', species: 'Dogs', purpose: 'COX-2 inhibitor for osteoarthritis' },
  { name: 'Deramaxx (Deracoxib)', category: 'Pain & Arthritis', species: 'Dogs', purpose: 'COX-2 inhibitor for postoperative and OA pain' },
  { name: 'Adequan (PSGAG)', category: 'Pain & Arthritis', species: 'Both', purpose: 'Injectable polysulfated glycosaminoglycan for joints' },
  { name: 'Tramadol', category: 'Pain & Arthritis', species: 'Both', purpose: 'Opioid-like analgesic for moderate to severe pain' },
  { name: 'Buprenorphine', category: 'Pain & Arthritis', species: 'Both', purpose: 'Partial opioid agonist for moderate pain' },
  { name: 'Onsior (Robenacoxib)', category: 'Pain & Arthritis', species: 'Both', purpose: 'COX-2 inhibitor for acute pain and inflammation' },
  { name: 'Librela (Bedinvetmab)', category: 'Pain & Arthritis', species: 'Dogs', purpose: 'Monoclonal antibody for canine OA pain (monthly)' },
  { name: 'Solensia (Frunevetmab)', category: 'Pain & Arthritis', species: 'Cats', purpose: 'Monoclonal antibody for feline OA pain (monthly)' },

  // Seizures
  { name: 'Phenobarbital', category: 'Seizures', species: 'Both', purpose: 'Barbiturate anticonvulsant for epilepsy control' },
  { name: 'Potassium Bromide', category: 'Seizures', species: 'Dogs', purpose: 'Adjunct anticonvulsant for refractory seizures' },
  { name: 'Levetiracetam (Keppra)', category: 'Seizures', species: 'Both', purpose: 'Anticonvulsant for refractory epilepsy' },
  { name: 'Zonisamide', category: 'Seizures', species: 'Both', purpose: 'Anticonvulsant as adjunct or monotherapy' },
  { name: 'Pregabalin', category: 'Seizures', species: 'Both', purpose: 'Anticonvulsant and neuropathic pain agent' },
  { name: 'Imepitoin (Pexion)', category: 'Seizures', species: 'Dogs', purpose: 'Low-affinity benzodiazepine anticonvulsant for canine epilepsy' },

  // Stomach Ulcers
  { name: 'Omeprazole (Prilosec)', category: 'Stomach Ulcers', species: 'Both', purpose: 'PPI for GI ulcers and hyperacidity' },
  { name: 'Pantoprazole', category: 'Stomach Ulcers', species: 'Both', purpose: 'PPI for severe GI ulcers and erosive esophagitis' },
  { name: 'Lansoprazole', category: 'Stomach Ulcers', species: 'Both', purpose: 'PPI for gastric and duodenal ulcers' },
  { name: 'Sucralfate (Carafate)', category: 'Stomach Ulcers', species: 'Both', purpose: 'Mucosal protectant for gastric ulcers' },
  { name: 'Misoprostol', category: 'Stomach Ulcers', species: 'Both', purpose: 'Prostaglandin analog to prevent NSAID-induced ulcers' },
];

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

const SupplierProductsView: React.FC<SupplierProductsViewProps> = () => {
  const { user } = useAuth();
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
    if (!silent) {
      const cached = cache.get<SupplierProduct[]>(PRODUCTS_CACHE_KEY, PRODUCTS_CACHE_PARAMS);
      if (cached) {
        setProducts(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const res = await supplierProductsAPI.getMyProducts({ limit: 500 });
      const data = res.data.data || [];
      cache.set(PRODUCTS_CACHE_KEY, data, PRODUCTS_CACHE_PARAMS);
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

  const allCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const filteredDrugs = useMemo(() => {
    if (!drugSearch.trim()) return PET_MEDICATIONS.slice(0, 20);
    const q = drugSearch.toLowerCase();
    return PET_MEDICATIONS.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.purpose.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [drugSearch]);

  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyForm(supplierCurrency));
    setDrugSearch('');
    setShowDrugSearch(false);
    setShowModal(true);
  };

  const openEdit = (product: SupplierProduct) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      category: product.category,
      sku: product.sku,
      unitPrice: String(product.unitPrice),
      buyPrice: String(product.buyPrice ?? 0),
      currency: product.currency || supplierCurrency,
      unit: product.unit,
      minOrderQty: String(product.minOrderQty),
      stockQty: String(product.stockQty ?? 0),
      lowStockThreshold: String(product.lowStockThreshold ?? 10),
      isAvailable: product.isAvailable,
    });
    setDrugSearch('');
    setShowDrugSearch(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setForm(emptyForm(supplierCurrency));
    setDrugSearch('');
    setShowDrugSearch(false);
  };

  const selectDrug = (drug: PetDrug) => {
    setForm(f => ({ ...f, name: drug.name, category: drug.category }));
    setShowDrugSearch(false);
    setDrugSearch('');
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

  const speciesBadge = (species: PetDrug['species']) => {
    const map: Record<string, string> = {
      Dogs: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      Cats: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      Both: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    };
    return map[species] ?? '';
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
                      <span className="text-xs font-black uppercase tracking-wider text-seafoam">Drug Database</span>
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
                          placeholder="Search drug name, category, or purpose..."
                          value={drugSearch}
                          onChange={e => setDrugSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-400"
                        />
                      </div>
                      <div className="px-3 pb-3 pt-2 max-h-48 overflow-y-auto space-y-1">
                        {filteredDrugs.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-zinc-500 py-2 text-center font-semibold">No drugs found</p>
                        ) : filteredDrugs.map((drug, i) => (
                          <button
                            key={i}
                            onClick={() => selectDrug(drug)}
                            className="w-full flex items-start justify-between gap-3 px-3 py-2 rounded-xl hover:bg-seafoam/10 dark:hover:bg-seafoam/15 transition-colors text-left group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-pine dark:text-zinc-200 truncate group-hover:text-seafoam transition-colors">{drug.name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{drug.purpose}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${speciesBadge(drug.species)}`}>{drug.species}</span>
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

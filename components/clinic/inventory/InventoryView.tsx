
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventoryStatus, Clinic, Supplier } from '../../../types';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { Search, Plus, Package, Edit, X, History, RefreshCw, Filter, Tag, Percent, Building2, Pill, ChevronDown, ChevronUp, ChevronLeft, Wallet, GripVertical, Check } from 'lucide-react';
import { suppliersAPI, Supplier as APISupplier, toast, INVENTORY_FORMS, stockMovementsAPI, uploadsAPI, procedureTemplatesAPI } from '../../../services';
import { walletAPI } from '../../../services/modules/wallet.api';
import { usePagination } from '../../../hooks/usePagination';
import Pagination from '../../shared/common/Pagination';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { useData } from '../../../contexts/DataContext';


interface InventoryViewProps {
  inventory: InventoryItem[];
  clinic: Clinic;
  onUpdateStock: (id: number, newQty: number) => void;
  onUpdateItem: (id: number, data: Partial<InventoryItem>) => void;
  onAddItem: (item: Omit<InventoryItem, 'id' | 'status'>) => void;
  suppliers: Supplier[];
  onTogglePreferredSupplier: (clinicId: number, supplierId: number) => void;
  onViewSupplier: (supplierId: number) => void;
  refreshInventory?: () => Promise<void>;
}

interface DrugResult {
  id: number;
  name: string;
  genericName?: string;
  category: string;
  species: string[];
  unit: string;
}

// Top-level product buckets. Everything is either a Medicine or a Consumable.
type MainCategory = 'MEDICINE' | 'CONSUMABLE';

// Suggested subcategories per main bucket. Users can also type their own and
// keep nesting (subcat1 › subcat2 › subcat3 …) — this list is just a shortcut.
const SUBCATEGORY_PRESETS: Record<MainCategory, string[]> = {
  MEDICINE: [
    'Antibiotic', 'Antifungal', 'Antiparasitic', 'Anti-inflammatory (NSAID)', 'Analgesic',
    'Corticosteroid', 'Anaesthetic', 'Sedative', 'Vaccine', 'Antiseptic', 'Cardiac',
    'Gastrointestinal', 'Dermatological', 'Ophthalmic', 'Respiratory', 'Hormonal',
    'Fluids & Electrolytes', 'Vitamin / Supplement', 'Dewormer', 'Euthanasia',
  ],
  CONSUMABLE: [
    'Surgical Supplies', 'Syringes & Needles', 'Gloves', 'Cotton & Gauze', 'Bandages & Dressings',
    'Sutures', 'Catheters', 'IV Lines & Giving Sets', 'Diagnostic / Lab', 'Cleaning & Disinfectant',
    'PPE', 'Feeding & Nutrition', 'Grooming', 'Identification (microchips/tags)', 'Office / Stationery',
  ],
};

// Reordered dispensing units — the ones staff actually price against sit first,
// with mL deliberately in the second slot (per requirement).
const ORDERED_UNITS: string[] = [
  'Tablet', 'mL', 'Capsule', 'Vial', 'Ampoule', 'Sachet', 'Bottle', 'Syringe', 'Drop', 'Suppository',
  'Unit', 'Piece', 'Pair', 'Set', 'Pack', 'Box', 'Roll', 'Tube', 'Bag', 'Can', 'Pouch', 'Sheet',
  'Block', 'Tub', 'Gram', 'Kg', 'Litre',
];

// Map a chosen unit to the backend InventoryForm (drives consumable subtraction).
const UNIT_TO_FORM: Record<string, string> = {
  Tablet: 'TABLET', Capsule: 'CAPSULE', Vial: 'VIAL', Bottle: 'BOTTLE', Ampoule: 'AMPOULE',
  Tube: 'TUBE', Sachet: 'SACHET', Pack: 'PACK', mL: 'UNIT', Syringe: 'UNIT', Drop: 'UNIT',
};
const unitToForm = (unit: string): string => UNIT_TO_FORM[unit] || 'UNIT';

// The four optional service charges a product can carry, shown as checkboxes.
const FEE_DEFS: { key: 'feeService' | 'feeAdmin' | 'feeInjection' | 'feePrescription'; label: string; hint: string; default: number }[] = [
  { key: 'feeService', label: 'Service Charge', hint: 'Flat handling fee added when dispensed', default: 0 },
  { key: 'feeAdmin', label: 'Administration Fee', hint: 'Fee to administer the product', default: 0 },
  { key: 'feeInjection', label: 'Injection Fee', hint: 'Per injection (e.g. 300 / 10 mL)', default: 300 },
  { key: 'feePrescription', label: 'Prescription Fee', hint: 'Fee to write the prescription', default: 0 },
];

const InventoryView: React.FC<InventoryViewProps> = ({ inventory, clinic, onUpdateStock, onUpdateItem, onAddItem, refreshInventory }) => {
  const { searchDrugs, drugCategories } = useReferenceData();
  const { isLoadingInventory, updateInventoryOptimistically } = useData();
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);
  const [pricingItem, setPricingItem] = useState<InventoryItem | null>(null);
  const [priceMode, setPriceMode] = useState<'profit' | 'sale'>('profit');
  const [profitPct, setProfitPct] = useState('');
  const [directSalePrice, setDirectSalePrice] = useState('');

  // Receive stock (a purchase / restock of an existing item): adds quantity and
  // records this purchase's buy price, sale price, batch ref, and expiry.
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  // qtyMode 'pack' converts whole bottles/boxes/vials into stock units via
  // units-per-pack before submitting.
  const [restockForm, setRestockForm] = useState({ quantity: '', costPrice: '', sellingPrice: '', batchNumber: '', expiryDate: '', qtyMode: 'unit' as string, packSize: '' });
  const [restockBusy, setRestockBusy] = useState(false);
  const restockPackLabel = (item: any) => {
    const form = String(item?.form ?? 'UNIT');
    return form === 'UNIT' ? 'Pack' : form.charAt(0) + form.slice(1).toLowerCase();
  };
  // Container types stock can be received in (converted to base unit via units-per-container).
  const RESTOCK_CONTAINERS: { value: string; label: string; per?: number }[] = [
    { value: 'pack', label: 'Pack' }, { value: 'box', label: 'Box' },
    { value: 'carton', label: 'Carton' }, { value: 'case', label: 'Case' },
    { value: 'crate', label: 'Crate' }, { value: 'dozen', label: 'Dozen', per: 12 },
    { value: 'bag', label: 'Bag' }, { value: 'sack', label: 'Sack' },
    { value: 'tray', label: 'Tray' }, { value: 'bottle', label: 'Bottle' },
    { value: 'vial', label: 'Vial' }, { value: 'strip', label: 'Strip' },
    { value: 'blister', label: 'Blister' }, { value: 'roll', label: 'Roll' },
    { value: 'tin', label: 'Tin' }, { value: 'jar', label: 'Jar' },
    { value: 'tube', label: 'Tube' }, { value: 'sachet', label: 'Sachet' },
    { value: 'bucket', label: 'Bucket' }, { value: 'drum', label: 'Drum' },
  ];
  const restockContainerLabel = (mode: string) => RESTOCK_CONTAINERS.find(c => c.value === mode)?.label || 'Pack';
  const restockEffectiveQty = () => {
    const qty = Number(restockForm.quantity);
    if (!qty || qty <= 0) return 0;
    if (restockForm.qtyMode !== 'unit') {
      const per = Number(restockForm.packSize);
      return per > 0 ? qty * per : 0;
    }
    return qty;
  };
  const openRestock = (item: InventoryItem) => {
    setRestockItem(item);
    setRestockForm({ quantity: '', costPrice: String(item.costPrice ?? ''), sellingPrice: String(item.price ?? ''), batchNumber: '', expiryDate: '', qtyMode: 'unit', packSize: (item as any).packSize ? String((item as any).packSize) : '' });
  };
  const submitRestock = async () => {
    if (!restockItem) return;
    const qty = restockEffectiveQty();
    if (!qty || qty <= 0) {
      toast.error(restockForm.qtyMode !== 'unit' && Number(restockForm.quantity) > 0
        ? `Enter the units per ${restockContainerLabel(restockForm.qtyMode).toLowerCase()}`
        : 'Enter a quantity to receive');
      return;
    }
    setRestockBusy(true);
    try {
      const res = await stockMovementsAPI.restock({
        inventoryItemId: String(restockItem.id),
        quantity: qty,
        costPrice: restockForm.costPrice !== '' ? Number(restockForm.costPrice) : undefined,
        sellingPrice: restockForm.sellingPrice !== '' ? Number(restockForm.sellingPrice) : undefined,
        batchNumber: restockForm.batchNumber || undefined,
        expiryDate: restockForm.expiryDate || undefined,
      });
      if (res.success) {
        // Reflect the received stock + latest purchase data on the card.
        updateInventoryOptimistically(String(restockItem.id), (it: any) => ({
          ...it,
          quantity: Number(it.quantity) + qty,
          ...(restockForm.costPrice !== '' && { costPrice: Number(restockForm.costPrice) }),
          ...(restockForm.sellingPrice !== '' && { price: Number(restockForm.sellingPrice) }),
          ...(restockForm.batchNumber && { batchNumber: restockForm.batchNumber }),
          ...(restockForm.expiryDate && { expiryDate: restockForm.expiryDate }),
        }));
        toast.success(`Received ${qty} ${restockItem.unit} of ${restockItem.name}`);
        setRestockItem(null);
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to receive stock'); }
    finally { setRestockBusy(false); }
  };

  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Fetch suppliers from API
  const [suppliers, setSuppliers] = useState<APISupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [itemForm, setItemForm] = useState<{
    name: string;
    category: string;
    sku: string;
    batchNumber: string;
    quantity: number;
    minThreshold: number;
    unit: string;
    form: string;
    packSize: number | undefined;
    billable: boolean;
    manufacturer: string;
    imageUrl: string;
    countryOfOrigin: string;
    storageConditions: string;
    prescriptionOnly: boolean;
    price: number;
    costPrice: number;
    expiryDate: string;
    supplierId: number | undefined;
    // Structured category + pricing/fee metadata (persisted to metadata JSONB)
    mainCategory: 'MEDICINE' | 'CONSUMABLE';
    subcategories: string[];
    sellUnit: string;
    costUnit: string;
    injectionUnitMl: number;
    // Service charges — undefined = not applied; a number (incl 0) = applied.
    feeService?: number;
    feeAdmin?: number;
    feeInjection?: number;
    feePrescription?: number;
  }>({
    name: '', category: 'Antibiotics', sku: '', batchNumber: '', quantity: 0, minThreshold: 5, unit: 'Tablet', form: 'TABLET', packSize: undefined, billable: true, manufacturer: '', imageUrl: '', countryOfOrigin: '', storageConditions: '', prescriptionOnly: false, price: 0, costPrice: 0,
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    supplierId: suppliers[0]?.id ? Number(suppliers[0].id) : undefined,
    mainCategory: 'MEDICINE', subcategories: [], sellUnit: '', costUnit: '', injectionUnitMl: 10,
    feeService: undefined, feeAdmin: undefined, feeInjection: undefined, feePrescription: undefined,
  });
  // Free-text entry for the "add subcategory" input.
  const [subcatDraft, setSubcatDraft] = useState('');
  // Index currently being dragged in the subcategory reorder list.
  const [dragSubcatIdx, setDragSubcatIdx] = useState<number | null>(null);
  // Product image upload (R2 presigned PUT via uploadsAPI)
  const [imageUploading, setImageUploading] = useState(false);
  // "Used in procedures" — templates referencing the item being edited (M4).
  const [usedInProcedures, setUsedInProcedures] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!editingItem) { setUsedInProcedures([]); return; }
    procedureTemplatesAPI.list(true)
      .then(r => {
        if (r.success && r.data?.templates) {
          setUsedInProcedures(r.data.templates
            .filter(t => t.items.some(i => String(i.inventoryItemId) === String(editingItem.id)))
            .map(t => ({ id: t.id, name: t.name })));
        }
      })
      .catch(() => {});
  }, [editingItem]);
  const handleImageUpload = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please pick an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setImageUploading(true);
    try {
      const res = await uploadsAPI.upload(file, 'misc');
      setItemForm(prev => ({ ...prev, imageUrl: res.publicUrl }));
    } catch (e: any) {
      toast.error(e.message || 'Image upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  // Drug database search state
  const [drugSearch, setDrugSearch] = useState('');
  const [showDrugSearch, setShowDrugSearch] = useState(false);
  // "Deduct from wallet" toggle on the add-item modal. When ON, after the
  // inventory item is created we record a STOCK_PURCHASE debit on the
  // clinic's main wallet for quantity * costPrice. Defaults OFF — the user
  // opts in per save so accidental clicks don't move money.
  const [deductFromWallet, setDeductFromWallet] = useState(false);
  const [walletDebiting, setWalletDebiting] = useState(false);
  // Wallets available for the stock-purchase debit. Loaded lazily when
  // the Add Medicine modal opens so we don't re-fetch on every render.
  // Defaults the picker to the main wallet, but the user can flip to
  // any other wallet on this clinic (e.g. pay this batch from the bank
  // account rather than the till float).
  const [stockWallets, setStockWallets] = useState<any[]>([]);
  const [stockWalletsLoading, setStockWalletsLoading] = useState(false);
  const [selectedStockWalletId, setSelectedStockWalletId] = useState<string | null>(null);
  const [drugResults, setDrugResults] = useState<DrugResult[]>([]);
  const [isSearchingDrugs, setIsSearchingDrugs] = useState(false);
  const drugSearchRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAddModalOpen || editingItem) return;
    let cancelled = false;
    setStockWalletsLoading(true);
    (async () => {
      try {
        // Make sure a wallet exists for brand-new clinics, then list all
        // of them so the user can pick which one funds this stock.
        await walletAPI.ensure('CLINIC', String(clinic.id)).catch(() => {});
        const res = await walletAPI.getByEntity('CLINIC', String(clinic.id));
        if (cancelled) return;
        if (res.success) {
          const wallets = (res.data.wallets || []).filter((w: any) => w.isActive !== false);
          setStockWallets(wallets);
          const main = wallets.find((w: any) => w.isMain) || wallets[0];
          if (main) setSelectedStockWalletId(String(main.id));
        }
      } catch { /* silent — user can still skip the toggle */ }
      finally { if (!cancelled) setStockWalletsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [isAddModalOpen, editingItem, clinic.id]);

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

  const selectDrug = (drug: DrugResult) => {
    setItemForm(f => ({
      ...f,
      name: drug.name,
      unit: drug.unit || f.unit,
      // Seed the drug's catalog category as a subcategory (deduped) under Medicine.
      mainCategory: 'MEDICINE',
      subcategories: drug.category && !f.subcategories.some(s => s.toLowerCase() === drug.category.toLowerCase())
        ? [...f.subcategories, drug.category]
        : f.subcategories,
    }));
    setShowDrugSearch(false);
    setDrugSearch('');
    setDrugResults([]);
  };

  // force=true bypasses the localStorage cache (used by the refresh button)
  const fetchSuppliers = async (force = false) => {
    setLoadingSuppliers(true);
    try {
      if (!force) {
        const cachedSuppliers = localStorage.getItem('vethub-suppliers');
        const cacheTimestamp = localStorage.getItem('vethub-suppliers-timestamp');
        const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        if (cachedSuppliers && cacheAge < CACHE_DURATION) {
          setSuppliers(JSON.parse(cachedSuppliers));
          setLoadingSuppliers(false);
          return;
        }
      }

      const response = await suppliersAPI.getAll({ limit: 100 }, { cache: false });
      const suppliersList = response.data.data || [];
      setSuppliers(suppliersList);
      localStorage.setItem('vethub-suppliers', JSON.stringify(suppliersList));
      localStorage.setItem('vethub-suppliers-timestamp', Date.now().toString());
    } catch (error: any) {
      console.error('[InventoryView] Failed to load suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // NOTE: Inventory is already loaded by DataContext and passed as a prop.
  // We don't need to fetch it again on mount to avoid duplicate API calls.
  // The refreshInventory function is only used when the user explicitly clicks the refresh button.

  // Load suppliers on mount (needed for Add/Edit item form dropdowns)
  useEffect(() => {
    if (suppliers.length === 0) {
      fetchSuppliers();
    }
  }, []);

  const filteredInventory = useMemo(() => {
    // Only apply search filter if query has 3 or more characters
    const effectiveSearch = searchQuery.length >= 3 ? searchQuery.toLowerCase() : '';

    return inventory
      .filter(item => item.clinicId === clinic.id)
      .filter(item => activeCategory === 'ALL' || item.category === activeCategory)
      .filter(item => statusFilter === 'ALL' || item.status === statusFilter)
      .filter(item => {
        if (!effectiveSearch) return true;
        return item.name.toLowerCase().includes(effectiveSearch) || item.sku.toLowerCase().includes(effectiveSearch);
      })
      .filter(item => {
        if (!dateRange) return true;

        // Check if item's expiry date falls within the date range
        const expiryDate = new Date(item.expiryDate);
        if (expiryDate >= dateRange.start && expiryDate <= dateRange.end) {
          return true;
        }

        // Check if any batch history received date falls within the date range
        if (item.batchHistory && item.batchHistory.length > 0) {
          return item.batchHistory.some(batch => {
            const receivedDate = new Date(batch.receivedDate);
            return receivedDate >= dateRange.start && receivedDate <= dateRange.end;
          });
        }

        return false;
      });
  }, [inventory, activeCategory, statusFilter, searchQuery, clinic.id, dateRange]);

  // Pagination for inventory items
  const {
    paginatedItems: paginatedInventory,
    paginationMeta: inventoryPaginationMeta,
    handlePageChange: handleInventoryPageChange,
    handleLimitChange: handleInventoryLimitChange,
    resetPage: resetInventoryPage,
  } = usePagination(filteredInventory, 16);

  // Reset pagination when filters change
  useEffect(() => {
    resetInventoryPage();
  }, [searchQuery, activeCategory, statusFilter, resetInventoryPage]);

  const stats = useMemo(() => {
    const clinicInv = inventory.filter(i => i.clinicId === clinic.id);
    return {
      lowStock: clinicInv.filter(i => i.status === 'LOW_STOCK').length,
      outOfStock: clinicInv.filter(i => i.status === 'OUT_OF_STOCK').length,
      expired: clinicInv.filter(i => i.status === 'EXPIRED').length,
    };
  }, [inventory, clinic.id]);

  // Generate a default SKU based on category and timestamp
  const generateDefaultSKU = (category: string) => {
    const categoryPrefix = category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${categoryPrefix}-${timestamp}`;
  };

  // Open add modal with default SKU
  const openAddModal = () => {
    setSubcatDraft('');
    setItemForm({
      name: '',
      category: 'Medicine',
      sku: generateDefaultSKU('Medicine'),
      batchNumber: '',
      quantity: 0,
      minThreshold: 5,
      unit: 'Tablet',
      form: 'TABLET',
      packSize: undefined,
      billable: true,
      manufacturer: '',
      imageUrl: '',
      countryOfOrigin: '',
      storageConditions: '',
      prescriptionOnly: false,
      price: 0,
      costPrice: 0,
      expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      supplierId: suppliers[0]?.id ? Number(suppliers[0].id) : undefined,
      mainCategory: 'MEDICINE', subcategories: [], sellUnit: '', costUnit: '', injectionUnitMl: 10,
      feeService: undefined, feeAdmin: undefined, feeInjection: undefined, feePrescription: undefined,
    });
    setIsAddModalOpen(true);
  };

  // ── Structured-category + fee helpers ─────────────────────────────────────
  // The DB `category` column stores the most specific subcategory (or the main
  // bucket label) so existing list filters keep working; the full structure
  // lives in metadata.
  const deriveCategory = (f = itemForm): string =>
    f.subcategories.length ? f.subcategories[f.subcategories.length - 1]
      : (f.mainCategory === 'MEDICINE' ? 'Medicine' : 'Consumables');

  const buildMetadata = (f = itemForm) => {
    const fees: Record<string, number> = {};
    if (f.feeService !== undefined) fees.service = Number(f.feeService) || 0;
    if (f.feeAdmin !== undefined) fees.admin = Number(f.feeAdmin) || 0;
    if (f.feeInjection !== undefined) fees.injection = Number(f.feeInjection) || 0;
    if (f.feePrescription !== undefined) fees.prescription = Number(f.feePrescription) || 0;
    return {
      mainCategory: f.mainCategory,
      subcategories: f.subcategories,
      fees,
      injectionUnitMl: Number(f.injectionUnitMl) || 10,
      sellUnit: f.sellUnit || f.unit,
      costUnit: f.costUnit || f.unit,
    };
  };

  const addSubcat = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setItemForm(prev => prev.subcategories.some(s => s.toLowerCase() === v.toLowerCase())
      ? prev
      : { ...prev, subcategories: [...prev.subcategories, v] });
    setSubcatDraft('');
  };
  const removeSubcat = (idx: number) =>
    setItemForm(prev => ({ ...prev, subcategories: prev.subcategories.filter((_, i) => i !== idx) }));
  const reorderSubcat = (from: number, to: number) =>
    setItemForm(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.subcategories.length || to >= prev.subcategories.length) return prev;
      const next = [...prev.subcategories];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, subcategories: next };
    });

  const toggleFee = (key: 'feeService' | 'feeAdmin' | 'feeInjection' | 'feePrescription', def: number) =>
    setItemForm(prev => ({ ...prev, [key]: prev[key] === undefined ? def : undefined }));

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!itemForm.name || !itemForm.sku || !itemForm.unit || itemForm.price === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (itemForm.quantity < 0 || itemForm.minThreshold < 0 || itemForm.price < 0) {
      toast.error('Quantity, threshold, and price must be positive numbers');
      return;
    }

    // Derive the DB category + dispensing form from the structured selection,
    // and attach the extended metadata for persistence.
    const payload = {
      ...itemForm,
      category: deriveCategory(),
      form: unitToForm(itemForm.unit),
      metadata: buildMetadata(),
    };

    if (editingItem) {
      onUpdateItem(editingItem.id, payload as any);
    } else {
      onAddItem({ ...payload, clinicId: clinic.id } as any);

      // Optional: debit the wallet for the cost of this stock right away.
      // Wallet debit is fire-and-forget after the inventory item is queued
      // — onAddItem isn't async-returnable in this prop, so we treat the
      // ledger entry as best-effort. A failure surfaces a toast but the
      // inventory item is already submitted.
      const cost = (Number(itemForm.costPrice) || 0) * (Number(itemForm.quantity) || 0);
      if (deductFromWallet && cost > 0) {
        setWalletDebiting(true);
        try {
          // Prefer the user-picked wallet. Fall back to ensuring/main
          // only if nothing was selected (legacy callers / empty list).
          let walletId: string | null = selectedStockWalletId;
          if (!walletId) {
            const w = await walletAPI.ensure('CLINIC', String(clinic.id));
            walletId = (w?.data as any)?.wallet?.id ?? null;
          }
          if (!walletId) throw new Error('No wallet for clinic');
          const picked = stockWallets.find((w: any) => String(w.id) === String(walletId));
          await walletAPI.recordStockPurchase(String(walletId), {
            amount: Number(cost.toFixed(2)),
            note: `Stock: ${itemForm.name} ×${itemForm.quantity}`,
            reference: itemForm.sku,
          });
          toast.success(`${clinic.currency || ''} ${cost.toFixed(2)} debited from ${picked?.name || 'wallet'}`);
        } catch (err: any) {
          toast.error(err?.response?.data?.message || 'Wallet debit failed — inventory still added');
        } finally {
          setWalletDebiting(false);
        }
      }
    }

    setIsAddModalOpen(false);
    setEditingItem(null);
    setDeductFromWallet(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {!isAddModalOpen && (
      <>
      {/* Filters Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        {/* Row 1 — Clinic badge + Search (2-line filter layout) */}
        <div className="flex items-center gap-2">
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-seafoam/10 rounded-lg border border-seafoam/20">
            <Building2 size={11} className="text-seafoam shrink-0" />
            <span className="text-[10px] font-black text-seafoam truncate max-w-[140px]">{clinic.name}</span>
          </div>
          <div className="relative group flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder="Search stock (min 3 chars)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all font-bold"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2 — Date range + Status + Add + Reload.
            Mobile: controls stack so nothing is squeezed; sm+: one row. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            className="w-full sm:flex-1 sm:min-w-0"
            buttonClassName="w-full justify-between"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InventoryStatus | 'ALL')}
            className="w-full sm:w-52 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
          >
            <option value="ALL">All Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock ({stats.lowStock})</option>
            <option value="OUT_OF_STOCK">Out of Stock ({stats.outOfStock})</option>
            <option value="EXPIRED">Expired ({stats.expired})</option>
          </select>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={openAddModal}
              className="shrink-0 compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-lg shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-4 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
            >
              <Plus size={14} className="inline mr-1" /> Add Item
            </button>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await Promise.all([refreshInventory?.(), fetchSuppliers(true)]);
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isRefreshing}
              className="shrink-0 ml-auto sm:ml-0 compact-button bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5"
              title="Refresh inventory"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <>
          {(isLoadingInventory || isRefreshing) ? (
            <div className="py-32">
              <LoadingSpinner size="lg" message="Loading inventory..." />
            </div>
          ) : (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm">
            {inventoryPaginationMeta.totalItems > 12 && inventoryPaginationMeta.totalPages > 1 && (
              <div className="px-4 pt-4">
                <Pagination meta={inventoryPaginationMeta} onPageChange={handleInventoryPageChange} compact />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              {paginatedInventory.map(item => (
                <div key={item.id} className="compact-card flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className={`px-1.5 py-0.5 rounded-lg text-[7px] font-black border uppercase tracking-widest ${item.status === 'IN_STOCK' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{item.status}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => {
                          setEditingItem(item);
                          setSubcatDraft('');
                          const meta = (item as any).metadata || {};
                          const fees = meta.fees || {};
                          setItemForm({
                            name: item.name,
                            category: item.category,
                            sku: item.sku,
                            batchNumber: item.batchNumber,
                            quantity: item.quantity,
                            minThreshold: item.minThreshold,
                            unit: item.unit,
                            form: (item as any).form ?? 'UNIT',
                            packSize: (item as any).packSize ?? undefined,
                            billable: (item as any).billable !== false,
                            manufacturer: item.manufacturer ?? '',
                            imageUrl: item.imageUrl ?? '',
                            countryOfOrigin: item.countryOfOrigin ?? '',
                            storageConditions: item.storageConditions ?? '',
                            prescriptionOnly: item.prescriptionOnly === true,
                            price: item.price,
                            costPrice: item.costPrice,
                            expiryDate: item.expiryDate,
                            supplierId: item.supplierId ?? undefined,
                            mainCategory: (meta.mainCategory === 'CONSUMABLE' ? 'CONSUMABLE' : 'MEDICINE'),
                            subcategories: Array.isArray(meta.subcategories) ? meta.subcategories : [],
                            sellUnit: meta.sellUnit ?? '',
                            costUnit: meta.costUnit ?? '',
                            injectionUnitMl: Number(meta.injectionUnitMl) || 10,
                            feeService: fees.service !== undefined ? Number(fees.service) : undefined,
                            feeAdmin: fees.admin !== undefined ? Number(fees.admin) : undefined,
                            feeInjection: fees.injection !== undefined ? Number(fees.injection) : undefined,
                            feePrescription: fees.prescription !== undefined ? Number(fees.prescription) : undefined,
                          });
                          setIsAddModalOpen(true);
                        }} className="text-slate-300 hover:text-pine"><Edit size={12} /></button>
                        <button onClick={() => {
                          setPricingItem(item);
                          setPriceMode('profit');
                          setProfitPct('');
                          setDirectSalePrice(String(item.price || ''));
                        }} className="text-slate-300 hover:text-seafoam" title="Set Price"><Tag size={12} /></button>
                        <button onClick={() => openRestock(item)} className="text-slate-300 hover:text-emerald-500" title="Receive stock"><Plus size={12} /></button>
                        <button onClick={() => setSelectedItemForDetails(item)} className="text-slate-300 hover:text-cyan"><History size={12} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-100 dark:border-zinc-700 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h3 className="card-title text-sm leading-tight truncate">{item.name}</h3>
                        <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5">Batch: {item.batchNumber}</p>
                        {item.manufacturer && <p className="text-slate-400 dark:text-zinc-500 text-[7px] font-bold uppercase truncate">{item.manufacturer}</p>}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-lg border border-slate-100 dark:border-zinc-700">
                      <div className="flex justify-between text-[7px] font-black text-slate-400 uppercase mb-1"><span>Expires</span><span>Quantity</span></div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[9px] font-bold text-red-500">{item.expiryDate}</span>
                        <span className="text-lg font-black text-pine dark:text-zinc-100">{item.quantity} <span className="text-[8px] text-slate-400 uppercase">{item.unit}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination for inventory items */}
            <Pagination
              meta={inventoryPaginationMeta}
              onPageChange={handleInventoryPageChange}
              onLimitChange={handleInventoryLimitChange}
              showLimitSelector={true}
            />
          </div>
          )}
        </>

      </>
      )}

      {/* Add / Update Stock — full page (checkout-style). Replaces the
          list view while open so the form gets the full width and we
          can pin an Order Summary aside that shows running totals + the
          source wallet picker. */}
      {isAddModalOpen && (
        <div className="animate-in fade-in duration-300 space-y-4">
          {/* Page header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setIsAddModalOpen(false); setDeductFromWallet(false); }}
                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine hover:border-seafoam transition-all"
                title="Back to inventory"
              >
                <ChevronLeft size={16} />
              </button>
              <div>
                <h2 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">{editingItem ? 'Update Stock' : 'Add Product'}</h2>
                <p className="text-seafoam text-[9px] font-black uppercase tracking-widest mt-0.5">Stock registry · {clinic.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setIsAddModalOpen(false); setDeductFromWallet(false); }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-slate-400 hover:text-red-500 transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <X size={13} /> Cancel
            </button>
          </div>

          {/* Two-column page layout — form on the left (lg:col-span-2),
              checkout summary sticky on the right. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
            {/* Inner panel wraps the existing form section. */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm">

            {/* Drug Database Search (add mode only) */}
            {!editingItem && (
              <div className="mb-4 rounded-2xl border border-seafoam/30 dark:border-seafoam/20 overflow-hidden">
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
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">— auto-fill name & category</span>
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
                          <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md max-w-[100px] truncate shrink-0">{drug.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form id="add-stock-form" onSubmit={handleFormSubmit} className="space-y-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
                <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">1</span> Basic Information
              </p>
              {/* Row 1: Name + Main category bucket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Product Name *</label>
                  <input
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. Amoxicillin 500mg"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Main Category *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['MEDICINE', 'CONSUMABLE'] as MainCategory[]).map(mc => {
                      const active = itemForm.mainCategory === mc;
                      return (
                        <button
                          key={mc}
                          type="button"
                          onClick={() => setItemForm(prev => ({
                            ...prev,
                            mainCategory: mc,
                            sku: (!editingItem && (!prev.sku || /^[A-Z]{3}-\d{6}$/.test(prev.sku)))
                              ? generateDefaultSKU(mc === 'MEDICINE' ? 'Medicine' : 'Consumables')
                              : prev.sku,
                          }))}
                          className={`px-3 py-2.5 rounded-xl border text-sm font-black uppercase tracking-wide transition-all ${
                            active
                              ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine dark:border-zinc-100 shadow-sm'
                              : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam/50'
                          }`}
                        >
                          {mc === 'MEDICINE' ? 'Medicine' : 'Consumables'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Subcategories — dropdown-or-type, unlimited, drag to reorder */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">
                  Subcategories <span className="text-slate-400 normal-case font-bold">— add as many as you like, drag to reorder</span>
                </label>
                {itemForm.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {itemForm.subcategories.map((sc, idx) => (
                      <div
                        key={`${sc}-${idx}`}
                        draggable
                        onDragStart={() => setDragSubcatIdx(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (dragSubcatIdx !== null) reorderSubcat(dragSubcatIdx, idx); setDragSubcatIdx(null); }}
                        onDragEnd={() => setDragSubcatIdx(null)}
                        className={`flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border cursor-grab active:cursor-grabbing text-[10px] font-black uppercase tracking-wide transition-all ${
                          dragSubcatIdx === idx
                            ? 'bg-seafoam/20 border-seafoam text-seafoam opacity-60'
                            : 'bg-seafoam/10 border-seafoam/30 text-seafoam'
                        }`}
                        title="Drag to reorder"
                      >
                        <GripVertical size={11} className="opacity-50 shrink-0" />
                        <span className="text-[8px] font-mono opacity-60">{idx + 1}</span>
                        {sc}
                        <button type="button" onClick={() => removeSubcat(idx)} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    list="subcat-presets"
                    value={subcatDraft}
                    onChange={e => setSubcatDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubcat(subcatDraft); } }}
                    placeholder={itemForm.mainCategory === 'MEDICINE' ? 'Choose or type e.g. Antibiotic → Cephalosporin…' : 'Choose or type e.g. Surgical Supplies → Sutures…'}
                    className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                  />
                  <datalist id="subcat-presets">
                    {SUBCATEGORY_PRESETS[itemForm.mainCategory]
                      .filter(p => !itemForm.subcategories.some(s => s.toLowerCase() === p.toLowerCase()))
                      .map(p => <option key={p} value={p} />)}
                  </datalist>
                  <button type="button" onClick={() => addSubcat(subcatDraft)} className="shrink-0 px-3 py-2.5 bg-seafoam text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center gap-1.5">
                    <Plus size={13} /> Add subcategory
                  </button>
                </div>
              </div>

              {/* Row 2: SKU and Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 flex items-center justify-between">
                    <span>SKU *</span>
                    <button
                      type="button"
                      onClick={() => setItemForm({ ...itemForm, sku: generateDefaultSKU(itemForm.category) })}
                      className="text-[8px] text-seafoam hover:text-pine font-bold uppercase tracking-wider underline"
                    >
                      Auto-Generate
                    </button>
                  </label>
                  <input
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. VAC-123456"
                    value={itemForm.sku}
                    onChange={e => setItemForm({ ...itemForm, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Supplier</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.supplierId || ''}
                    onChange={e => setItemForm({ ...itemForm, supplierId: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">Select Supplier (Optional)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2b: Manufacturer + product image — manufacturer completes the
                  batch → supplier → manufacturer backtrace chain on record pages. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Manufacturer</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. Rekodi Pharmaceuticals"
                    value={itemForm.manufacturer}
                    onChange={e => setItemForm({ ...itemForm, manufacturer: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Product Image</label>
                  <div className="flex items-center gap-2">
                    {itemForm.imageUrl ? (
                      <div className="relative shrink-0">
                        <img src={itemForm.imageUrl} alt="Product" className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-zinc-700" />
                        <button
                          type="button"
                          onClick={() => setItemForm({ ...itemForm, imageUrl: '' })}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                          title="Remove image"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ) : null}
                    <label className={`flex-1 cursor-pointer bg-slate-50 dark:bg-zinc-800 border border-dashed border-slate-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-wider ${imageUploading ? 'text-slate-300' : 'text-seafoam hover:text-pine hover:border-seafoam'} transition-colors`}>
                      {imageUploading ? 'Uploading…' : itemForm.imageUrl ? 'Replace image' : 'Upload image (≤2MB)'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={imageUploading}
                        onChange={e => { handleImageUpload(e.target.files?.[0]); e.target.value = ''; }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">2</span> Clinical & Regulatory
              </p>
              {/* Row 2c: Country of origin, storage conditions, prescription-only — mockup parity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Country of Origin</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. Kenya"
                    value={itemForm.countryOfOrigin}
                    onChange={e => setItemForm({ ...itemForm, countryOfOrigin: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Storage Conditions</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.storageConditions}
                    onChange={e => setItemForm({ ...itemForm, storageConditions: e.target.value })}
                  >
                    <option value="">Not specified</option>
                    {['Room Temperature', 'Cool & Dry', 'Refrigerated (2–8°C)', 'Frozen', 'Protect from Light'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Prescription Only</label>
                  <button
                    type="button"
                    onClick={() => setItemForm({ ...itemForm, prescriptionOnly: !itemForm.prescriptionOnly })}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-black uppercase tracking-wider text-left ${itemForm.prescriptionOnly ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}
                  >
                    {itemForm.prescriptionOnly ? 'Yes — Rx required' : 'No'}
                  </button>
                </div>
              </div>

              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">3</span> Stock & Batch
              </p>
              {/* Row 3: Batch, Expiry, Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Batch Number</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="BATCH-001"
                    value={itemForm.batchNumber}
                    onChange={e => setItemForm({ ...itemForm, batchNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.expiryDate}
                    onChange={e => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Unit Type *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.unit}
                    onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                  >
                    {/* Reordered list — dispensing units first (mL in slot 2).
                        Always include the current value so a unit picked from the
                        reference catalog still renders even if unlisted. */}
                    {Array.from(new Set([...ORDERED_UNITS, ...(itemForm.unit ? [itemForm.unit] : [])]))
                      .map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3b: Units per pack (optional) + Billable. The dispensing
                  form is derived automatically from the unit type. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Units per pack <span className="text-slate-400 normal-case font-bold">(optional)</span></label>
                  <input
                    type="number" min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. 30 tablets per box"
                    value={itemForm.packSize ?? ''}
                    onChange={e => setItemForm({ ...itemForm, packSize: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Billable</label>
                  <button type="button" onClick={() => setItemForm({ ...itemForm, billable: !itemForm.billable })}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider border ${itemForm.billable ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                    {itemForm.billable ? 'Billable' : 'Non-billable'}
                  </button>
                </div>
              </div>

              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">4</span> Levels & Pricing
              </p>
              {/* Row 4a: Quantity + Min threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Quantity to add *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="0"
                    value={itemForm.quantity}
                    onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Min stock alert *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="5"
                    value={itemForm.minThreshold}
                    onChange={e => setItemForm({ ...itemForm, minThreshold: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Row 4b: Cost + Sale, each with its own unit (defaults to the unit
                  type; pick a different one — e.g. buy per Bottle, sell per mL). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Cost price (KES)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0"
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                      placeholder="0.00"
                      value={itemForm.costPrice}
                      onChange={e => setItemForm({ ...itemForm, costPrice: Number(e.target.value) })}
                    />
                    <select
                      className="w-28 shrink-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-xs"
                      value={itemForm.costUnit || itemForm.unit}
                      onChange={e => setItemForm({ ...itemForm, costUnit: e.target.value })}
                      title="Cost is per this unit"
                    >
                      {Array.from(new Set([itemForm.unit, ...ORDERED_UNITS])).map(u => <option key={u} value={u}>per {u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Sale price (KES) *</label>
                  <div className="flex gap-2">
                    <input
                      type="number" required step="0.01" min="0"
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                      placeholder="0.00"
                      value={itemForm.price}
                      onChange={e => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                    />
                    <select
                      className="w-28 shrink-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-xs"
                      value={itemForm.sellUnit || itemForm.unit}
                      onChange={e => setItemForm({ ...itemForm, sellUnit: e.target.value })}
                      title="Sale is per this unit"
                    >
                      {Array.from(new Set([itemForm.unit, ...ORDERED_UNITS])).map(u => <option key={u} value={u}>per {u}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Service charges — each checkbox reveals its amount field */}
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="w-5 h-5 rounded-lg bg-seafoam/15 text-seafoam flex items-center justify-center">5</span> Service Charges <span className="text-slate-400 normal-case font-bold tracking-normal">— added at billing time</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FEE_DEFS.map(fee => {
                  const enabled = itemForm[fee.key] !== undefined;
                  return (
                    <div key={fee.key} className={`rounded-xl border p-2.5 transition-all ${enabled ? 'border-seafoam/40 bg-seafoam/5' : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800'}`}>
                      <button
                        type="button"
                        onClick={() => toggleFee(fee.key, fee.default)}
                        className="w-full flex items-center gap-2 text-left"
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${enabled ? 'bg-seafoam border-seafoam' : 'border-slate-300 dark:border-zinc-600'}`}>
                          {enabled && <Check size={10} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-wide text-pine dark:text-zinc-100">{fee.label}</span>
                          <span className="block text-[8px] font-bold text-slate-400 dark:text-zinc-500 leading-tight">{fee.hint}</span>
                        </span>
                      </button>
                      {enabled && (
                        <div className="mt-2 flex items-center gap-2 pl-6">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">KES</span>
                            <input
                              type="number" step="0.01" min="0"
                              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-9 pr-2 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                              placeholder="0.00"
                              value={itemForm[fee.key] ?? ''}
                              onChange={e => setItemForm(prev => ({ ...prev, [fee.key]: e.target.value === '' ? 0 : Number(e.target.value) }))}
                            />
                          </div>
                          {fee.key === 'feeInjection' && (
                            <div className="relative w-24 shrink-0">
                              <input
                                type="number" step="0.1" min="0"
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-2 pr-8 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                                placeholder="10"
                                value={itemForm.injectionUnitMl}
                                onChange={e => setItemForm({ ...itemForm, injectionUnitMl: Number(e.target.value) })}
                                title="Millilitres per injection"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">mL</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Used in procedures — recipes referencing this product (read-only) */}
              {editingItem && usedInProcedures.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1.5">
                  <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest px-1">Used in {usedInProcedures.length} procedure recipe{usedInProcedures.length === 1 ? '' : 's'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {usedInProcedures.map(t => (
                      <span key={t.id} className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[10px] font-bold text-teal-700 dark:text-teal-400">{t.name}</span>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 px-1">Quantity/price changes here affect what those recipes reserve and bill.</p>
                </div>
              )}

            </form>
            </div>
            </div>

            {/* ── Checkout summary aside ─────────────────────────────────
                Sticky on lg+ so the totals + wallet picker stay visible
                while the user fills out the form. Mirrors a checkout
                cart: line item preview, qty × cost = total, deduct
                toggle, source wallet picker, save action. */}
            {(() => {
              const qty = Number(itemForm.quantity) || 0;
              const cost = Number(itemForm.costPrice) || 0;
              const sale = Number(itemForm.price) || 0;
              const projected = cost * qty;             // total buy cost (wallet debit)
              const totalSale = sale * qty;             // potential revenue on this batch
              const grossProfit = totalSale - projected;
              const marginPct = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
              const enabled = !editingItem && deductFromWallet && projected > 0;
              const picked = stockWallets.find((w: any) => String(w.id) === String(selectedStockWalletId));
              const ccy = clinic.currency || 'KES';
              const sellUnit = itemForm.sellUnit || itemForm.unit;
              const costUnit = itemForm.costUnit || itemForm.unit;
              return (
                <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 self-start">
                  {/* Order summary card */}
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 bg-pine text-white">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">Order Summary</p>
                      <p className="text-lg font-black uppercase tracking-tight truncate">{itemForm.name || 'New stock item'}</p>
                      <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-0.5 truncate">
                        {itemForm.mainCategory === 'MEDICINE' ? 'Medicine' : 'Consumables'}
                        {itemForm.subcategories.length > 0 && ` › ${itemForm.subcategories.join(' › ')}`}
                      </p>
                    </div>

                    <div className="p-5 space-y-3">
                      {/* Line item — qty × cost = buy subtotal */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-tight text-pine dark:text-zinc-100 truncate">{itemForm.name || '—'}</p>
                          <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                            {qty} {itemForm.unit || ''} × {ccy} {cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{costUnit}
                          </p>
                        </div>
                        <p className="text-[11px] font-black font-mono tabular-nums text-pine dark:text-zinc-100 shrink-0">
                          {ccy} {projected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      {/* ── Live P&L on this batch ─────────────────────────── */}
                      <div className={`rounded-xl border p-3 space-y-1.5 ${grossProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">Profit / Loss on {qty || 0} {itemForm.unit}</p>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${grossProfit >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'}`}>
                            {sale > 0 ? `${marginPct.toFixed(0)}% margin` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                          <span>Total buy cost</span>
                          <span className="font-mono tabular-nums">{ccy} {projected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                          <span>Sale value ({ccy} {sale.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{sellUnit})</span>
                          <span className="font-mono tabular-nums">{ccy} {totalSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1 border-t border-dashed border-slate-300/50 dark:border-zinc-700">
                          <span className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{grossProfit >= 0 ? 'Projected Profit' : 'Projected Loss'}</span>
                          <span className={`text-sm font-black font-mono tabular-nums ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                            {grossProfit >= 0 ? '+' : ''}{ccy} {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {(costUnit !== sellUnit) && (
                          <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 leading-tight pt-0.5">⚠ Buy unit ({costUnit}) differs from sell unit ({sellUnit}) — P&L assumes 1:1; adjust if they aren't.</p>
                        )}
                      </div>

                      {/* Applied service charges summary */}
                      {(itemForm.feeService !== undefined || itemForm.feeAdmin !== undefined || itemForm.feeInjection !== undefined || itemForm.feePrescription !== undefined) && (
                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-2 space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Service charges</p>
                          {itemForm.feeService !== undefined && <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400"><span>Service</span><span className="font-mono">{ccy} {(itemForm.feeService||0).toLocaleString()}</span></div>}
                          {itemForm.feeAdmin !== undefined && <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400"><span>Administration</span><span className="font-mono">{ccy} {(itemForm.feeAdmin||0).toLocaleString()}</span></div>}
                          {itemForm.feeInjection !== undefined && <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400"><span>Injection / {itemForm.injectionUnitMl}mL</span><span className="font-mono">{ccy} {(itemForm.feeInjection||0).toLocaleString()}</span></div>}
                          {itemForm.feePrescription !== undefined && <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400"><span>Prescription</span><span className="font-mono">{ccy} {(itemForm.feePrescription||0).toLocaleString()}</span></div>}
                        </div>
                      )}

                      {/* Totals */}
                      <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-1.5">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                          <span>Buy subtotal</span>
                          <span>{ccy} {projected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1.5 border-t border-dashed border-slate-200 dark:border-zinc-700">
                          <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">Total Due</span>
                          <span className="text-xl font-black font-mono tabular-nums text-seafoam">
                            {ccy} {projected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Source wallet picker — admin/owner stocks paid for
                      with real cash flick this on, then pick which
                      wallet funds the buy. */}
                  {!editingItem && (
                    <div className={`bg-white dark:bg-zinc-900 rounded-2xl border-2 shadow-sm transition-colors ${
                      enabled ? 'border-seafoam/40' : 'border-slate-200 dark:border-zinc-800'
                    }`}>
                      <div className="flex items-start justify-between gap-3 px-5 py-4">
                        <div className="flex items-start gap-2 min-w-0">
                          <Wallet size={14} className={enabled ? 'text-seafoam mt-0.5' : 'text-slate-400 mt-0.5'} />
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">Charge a wallet</p>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              {projected > 0
                                ? `Will debit ${ccy} ${projected.toFixed(2)} on save`
                                : 'Set a buy price and quantity to enable.'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={deductFromWallet}
                          onClick={() => setDeductFromWallet(v => !v)}
                          disabled={projected <= 0}
                          className={`relative shrink-0 w-10 h-5 rounded-full transition-colors disabled:opacity-40 ${
                            deductFromWallet && projected > 0 ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                            deductFromWallet && projected > 0 ? 'left-5' : 'left-0.5'
                          }`} />
                        </button>
                      </div>

                      {enabled && (
                        <div className="px-5 pb-4 space-y-1.5 max-h-72 overflow-y-auto">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Source wallet</p>
                          {stockWalletsLoading ? (
                            <p className="text-[10px] text-slate-400 py-3 text-center font-black uppercase tracking-widest">Loading wallets…</p>
                          ) : stockWallets.length === 0 ? (
                            <p className="text-[10px] text-slate-400 py-3 text-center font-black uppercase tracking-widest">No wallets — one will be created on save</p>
                          ) : (
                            stockWallets.map((w: any) => {
                              const sel = String(w.id) === String(selectedStockWalletId);
                              const [primary, secondary] = (w.accountNumber || '').split('|');
                              return (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => setSelectedStockWalletId(String(w.id))}
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border-2 text-left transition-all ${
                                    sel
                                      ? 'border-seafoam bg-seafoam/5'
                                      : 'border-slate-200 dark:border-zinc-700 hover:border-seafoam/40 bg-white/60 dark:bg-zinc-900/60'
                                  }`}
                                >
                                  <div className="min-w-0 flex items-center gap-2">
                                    <Wallet size={12} className={sel ? 'text-seafoam' : 'text-slate-400'} />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-black uppercase tracking-tight text-pine dark:text-zinc-100 truncate">{w.name}</p>
                                        {w.isMain && <span className="text-[6px] font-black px-1 py-px rounded-sm bg-amber-300 text-pine uppercase tracking-widest">Main</span>}
                                      </div>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                        {(w.walletType || 'Wallet').toString().replace(/_/g, ' ')}
                                        {primary ? ` · ${primary}` : ''}
                                        {secondary ? ` / ${secondary}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Float</p>
                                    <p className={`text-[10px] font-black font-mono tabular-nums ${sel ? 'text-seafoam' : 'text-pine dark:text-zinc-200'}`}>
                                      {w.currency} {Number(w.balance || 0).toLocaleString()}
                                    </p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                          {picked && Number(picked.balance) < projected && (
                            <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest pt-1">
                              ⚠ Balance below cost — wallet will go negative
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Save / Cancel actions — submits the form rendered
                      in the left column via the shared button form id. */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsAddModalOpen(false); setDeductFromWallet(false); }}
                      className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="add-stock-form"
                      disabled={walletDebiting}
                      className="flex-[2] bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-60"
                    >
                      {walletDebiting ? 'Debiting wallet…' : enabled ? `Pay ${ccy} ${projected.toFixed(2)} & Save` : (editingItem ? 'Update Stock' : 'Save Stock')}
                    </button>
                  </div>
                </aside>
              );
            })()}
          </div>
        </div>
      )}

      {/* Set Price Modal */}
      {/* Receive stock (purchase / restock) modal */}
      {restockItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => !restockBusy && setRestockItem(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 bg-pine text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center"><Package size={20} /></div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">Receive stock</h3>
                  <p className="text-[11px] text-white/80 font-medium">{restockItem.name} · {Number(restockItem.quantity)} {restockItem.unit} on hand</p>
                </div>
              </div>
              <button onClick={() => setRestockItem(null)} disabled={restockBusy} className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Quantity received *</label>
                  <input type="number" step="0.001" min="0" autoFocus placeholder={restockForm.qtyMode !== 'unit' ? `No. of ${restockContainerLabel(restockForm.qtyMode).toLowerCase()}s` : `Qty in ${restockItem.unit}`}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.quantity} onChange={e => setRestockForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Received as</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.qtyMode}
                    onChange={e => {
                      const m = e.target.value;
                      const def = RESTOCK_CONTAINERS.find(c => c.value === m)?.per;
                      setRestockForm(f => ({ ...f, qtyMode: m, packSize: def != null ? String(def) : f.packSize }));
                    }}>
                    <option value="unit">{restockItem.unit} (single)</option>
                    <optgroup label="Received in containers">
                      {RESTOCK_CONTAINERS.map(c => <option key={c.value} value={c.value}>{c.label}s</option>)}
                    </optgroup>
                  </select>
                </div>
                {restockForm.qtyMode !== 'unit' && (
                  <div className="col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Units per {restockContainerLabel(restockForm.qtyMode).toLowerCase()} ({restockItem.unit})</label>
                    <input type="number" step="0.001" min="0" placeholder="e.g. 500"
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                      value={restockForm.packSize} onChange={e => setRestockForm(f => ({ ...f, packSize: e.target.value }))} />
                    {restockEffectiveQty() > 0 && <p className="text-[10px] font-black text-seafoam px-1">= {restockEffectiveQty()} {restockItem.unit} added to stock</p>}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Batch ref</label>
                  <input placeholder="BATCH-002"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.batchNumber} onChange={e => setRestockForm(f => ({ ...f, batchNumber: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Buy price / {restockItem.unit}</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.costPrice} onChange={e => setRestockForm(f => ({ ...f, costPrice: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Sale price / {restockItem.unit}</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.sellingPrice} onChange={e => setRestockForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Expiry date</label>
                  <input type="date"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.expiryDate} onChange={e => setRestockForm(f => ({ ...f, expiryDate: e.target.value }))} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">New stock is added to the current {Number(restockItem.quantity)} {restockItem.unit}. Buy/sale price, batch and expiry update the item to this latest purchase.</p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setRestockItem(null)} disabled={restockBusy} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
                <button onClick={submitRestock} disabled={restockBusy} className="flex items-center gap-2 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pine/90 active:scale-95 disabled:opacity-60">
                  {restockBusy ? 'Receiving…' : 'Receive stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pricingItem && (() => {
        const cost = Number(pricingItem.costPrice) || 0;
        const hasCost = cost > 0;

        // computed opposite values
        const pctNum = parseFloat(profitPct);
        const saleNum = parseFloat(directSalePrice);
        const computedSale = hasCost && !isNaN(pctNum) ? cost * (1 + pctNum / 100) : null;
        const computedPct = hasCost && !isNaN(saleNum) && saleNum > 0 ? ((saleNum - cost) / cost) * 100 : null;

        const handlePriceSave = () => {
          let finalPrice: number;
          if (priceMode === 'profit') {
            if (isNaN(pctNum) || !hasCost) { toast.error('Enter a valid profit % and ensure cost price is set'); return; }
            finalPrice = parseFloat((cost * (1 + pctNum / 100)).toFixed(2));
          } else {
            if (isNaN(saleNum) || saleNum <= 0) { toast.error('Enter a valid sale price'); return; }
            finalPrice = parseFloat(saleNum.toFixed(2));
          }
          onUpdateItem(pricingItem.id, { price: finalPrice });
          toast.success(`Sale price updated to ${clinic.currency || 'KES'} ${finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
          setPricingItem(null);
        };

        return (
          <div className="fixed inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-md z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full p-5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Set Price</h2>
                  <p className="text-seafoam text-[9px] font-black uppercase tracking-widest mt-0.5 truncate max-w-[200px]">{pricingItem.name}</p>
                </div>
                <button onClick={() => setPricingItem(null)} className="text-slate-400 hover:text-pine"><X size={20} /></button>
              </div>

              {/* Cost price chip */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 mb-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cost Price</span>
                <span className={`text-sm font-black ${hasCost ? 'text-pine dark:text-zinc-100' : 'text-slate-300 dark:text-zinc-600'}`}>
                  {hasCost ? `${clinic.currency || 'KES'} ${cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Not set'}
                </span>
              </div>

              {/* Mode toggle */}
              <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 mb-4">
                <button
                  onClick={() => setPriceMode('profit')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${priceMode === 'profit' ? 'bg-white dark:bg-zinc-700 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Percent size={11} /> % Profit
                </button>
                <button
                  onClick={() => setPriceMode('sale')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${priceMode === 'sale' ? 'bg-white dark:bg-zinc-700 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Tag size={11} /> Sale Price
                </button>
              </div>

              {/* Input + opposite preview */}
              {priceMode === 'profit' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Profit Margin</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="e.g. 30"
                        value={profitPct}
                        onChange={e => setProfitPct(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-4 pr-10 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                    </div>
                  </div>
                  {/* Opposite preview */}
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${computedSale !== null ? 'bg-seafoam/5 border-seafoam/20' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700'}`}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">→ Sale Price</span>
                    <span className={`text-sm font-black ${computedSale !== null ? 'text-seafoam' : 'text-slate-300 dark:text-zinc-600'}`}>
                      {computedSale !== null ? `${clinic.currency || 'KES'} ${computedSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Sale Price ({clinic.currency || 'KES'})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={directSalePrice}
                      onChange={e => setDirectSalePrice(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    />
                  </div>
                  {/* Opposite preview */}
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${computedPct !== null ? 'bg-seafoam/5 border-seafoam/20' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700'}`}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">→ Profit Margin</span>
                    <span className={`text-sm font-black ${computedPct !== null ? (computedPct >= 0 ? 'text-seafoam' : 'text-red-500') : 'text-slate-300 dark:text-zinc-600'}`}>
                      {computedPct !== null ? `${computedPct.toFixed(1)}%` : hasCost ? '—' : 'No cost set'}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setPricingItem(null)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                <button type="button" onClick={handlePriceSave} className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Apply</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Batch History / Details Modal */}
      {selectedItemForDetails && (
        <div className="fixed inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-md z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-2xl w-full p-4 sm:p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start mb-5 border-b border-slate-50 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-seafoam text-white rounded-xl shadow-lg"><Package size={20} /></div>
                <div>
                  <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">{selectedItemForDetails.name}</h2>
                  <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">SKU: #{selectedItemForDetails.sku} • {selectedItemForDetails.category}</p>
                </div>
              </div>
              <button onClick={() => setSelectedItemForDetails(null)} className="text-slate-400 hover:text-pine"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Available</p>
                  <p className="text-xl font-black text-pine dark:text-zinc-100 font-mono">{selectedItemForDetails.quantity} <span className="text-xs">{selectedItemForDetails.unit}</span></p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch</p>
                  <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{selectedItemForDetails.batchNumber}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier</p>
                  <p className="text-xs font-bold text-pine dark:text-zinc-300 truncate">{suppliers.find(s => String(s.id) === String(selectedItemForDetails.supplierId))?.name || 'Direct'}</p>
                </div>
                <div className="p-3 bg-seafoam/5 dark:bg-seafoam/10 rounded-xl border border-seafoam/20">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch</p>
                  <p className="text-xs font-bold text-pine dark:text-zinc-300 truncate">{clinic.name}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="text-cyan" size={16} />
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Batch Ledger</h3>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-x-auto shadow-inner">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
                        <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase">Batch ID</th>
                        <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase">Supplier</th>
                        <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase">Received</th>
                        <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase">Expiry</th>
                        <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-zinc-900">
                      {selectedItemForDetails.batchHistory?.length ? selectedItemForDetails.batchHistory.map(bh => (
                        <tr key={bh.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-all">
                          <td className="px-6 py-4 font-mono font-black text-xs text-pine dark:text-zinc-100">{bh.batchNumber}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400">{suppliers.find(s => String(s.id) === String(bh.supplierId))?.name}</td>
                          <td className="px-6 py-4 text-xs font-bold text-pine dark:text-zinc-300">{bh.receivedDate}</td>
                          <td className="px-6 py-4 text-xs font-bold text-red-500">{bh.expiryDate}</td>
                          <td className="px-6 py-4 text-xs font-black text-right text-pine dark:text-zinc-100">+{bh.quantityReceived}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="py-12 text-center text-[10px] font-black uppercase text-slate-300">No archived batches</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;

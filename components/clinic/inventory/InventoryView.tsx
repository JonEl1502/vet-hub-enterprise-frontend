
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventoryStatus, Clinic, Supplier } from '../../../types';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { Search, Plus, Package, Edit, X, History, RefreshCw, Filter, Tag, Percent, Building2, Pill, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Wallet, GripVertical, Check, MoreVertical, Eye, SlidersHorizontal, Upload, Copy } from 'lucide-react';
import { suppliersAPI, Supplier as APISupplier, toast, dialog, INVENTORY_FORMS, inventoryAPI, stockMovementsAPI, uploadsAPI, procedureTemplatesAPI, supplierProductsAPI } from '../../../services';
import { walletAPI } from '../../../services/modules/wallet.api';
import { usePagination } from '../../../hooks/usePagination';
import Pagination from '../../shared/common/Pagination';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import InventoryDashboard from './InventoryDashboard';
import InventoryReports from './InventoryReports';
import InventoryExpiry from './InventoryExpiry';
import StockTransfersPanel from './StockTransfersPanel';
import StockTakePanel from './StockTakePanel';
import { useData } from '../../../contexts/DataContext';
import { defaultItemFees } from '../shared/serviceCharges';
import { modulePerms } from '../../../constants/modulePermissions';
import { useAuth } from '../../../contexts/AuthContext';


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
  /**
   * Which half of the old combined page to render.
   *
   *   'overview' — the ERP control centre: dashboard, reports, expiry,
   *                transfers, stock takes. Routed as `inventory`.
   *   'products' — the stock LIST: filters, the product grid, and every
   *                add/edit/view modal. Routed as `products`.
   *   'all'      — both, the pre-2026-08-05 behaviour. Kept as the default so
   *                nothing that still renders this component bare changes.
   *
   * ONE component, two routes, on purpose: the list and the dashboard read the
   * same `inventory` array and the same permission/supplier hooks. Splitting
   * them into two components would fork ~2,300 lines and guarantee drift.
   */
  mode?: 'overview' | 'products' | 'all';
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
function unitMath(f: {
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

const ORDERED_UNITS: string[] = [
  'Tablet', 'mL', 'Capsule', 'Vial', 'Ampoule', 'Sachet', 'Bottle', 'Syringe', 'Drop', 'Suppository',
  'Item', 'Unit', 'Piece', 'Pair', 'Set', 'Pack', 'Box', 'Roll', 'Tube', 'Bag', 'Can', 'Pouch', 'Sheet',
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
  { key: 'feeInjection', label: 'Injection Fee', hint: 'Flat fee per injection', default: 300 },
  { key: 'feePrescription', label: 'Prescription Fee', hint: 'Fee to write the prescription', default: 0 },
];

const InventoryView: React.FC<InventoryViewProps> = ({ inventory, clinic, onUpdateStock, onUpdateItem, onAddItem, refreshInventory, mode = 'all' }) => {
  const showOverview = mode === 'overview' || mode === 'all';
  const showProducts = mode === 'products' || mode === 'all';
  // Grouped page permissions (user, 2026-08-04). `stock` is deliberately its
  // own action: receiving a delivery is the front-line job, editing the item
  // record is not the same thing. The API enforces the same grants.
  const { user: currentUser } = useAuth();
  const prodPerms = modulePerms(currentUser, 'products');
  const { searchDrugs, drugCategories } = useReferenceData();
  const { isLoadingInventory, updateInventoryOptimistically } = useData();
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);
  const [pricingItem, setPricingItem] = useState<InventoryItem | null>(null);
  // Card kebab menu (per-item) + the full product detail page.
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  // Stock adjustment (ERP P4): writes an ADJUSTED movement with a reason.
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  const submitAdjustment = async () => {
    if (!adjustItem) return;
    const delta = Number(adjustDelta);
    if (!delta || Number.isNaN(delta)) { toast.warning('Enter a non-zero adjustment (e.g. -2 or 5)'); return; }
    if (!adjustReason.trim()) { toast.warning('A reason is required for an adjustment'); return; }
    setAdjustBusy(true);
    try {
      await stockMovementsAPI.create({ inventoryItemId: String(adjustItem.id), movementType: 'ADJUSTED', quantity: delta, notes: adjustReason.trim() } as any);
      toast.success(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta} ${adjustItem.unit}`);
      setAdjustItem(null); setAdjustDelta(''); setAdjustReason('');
      refreshInventory?.();
    } catch (e: any) { toast.error(e?.message || 'Failed to adjust stock'); }
    finally { setAdjustBusy(false); }
  };

  // Product analytics (ledger + consumption + reorder) for the detail page.
  const [itemAnalytics, setItemAnalytics] = useState<import('../../../services/modules/inventory.api').InventoryItemAnalytics | null>(null);
  useEffect(() => {
    if (!viewItem) { setItemAnalytics(null); return; }
    let alive = true;
    setItemAnalytics(null);
    inventoryAPI.getItemAnalytics(viewItem.id).then(r => { if (alive && r.success && r.data) setItemAnalytics(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [viewItem]);
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
  const [showCopyFromSupplier, setShowCopyFromSupplier] = useState(false);
  const [copyingFrom, setCopyingFrom] = useState<string | null>(null);
  const [copySupplier, setCopySupplier] = useState<{ id: string; name: string } | null>(null);
  const [copyProducts, setCopyProducts] = useState<any[]>([]);
  const [copySelected, setCopySelected] = useState<Set<string>>(new Set());
  const [copyLoading, setCopyLoading] = useState(false);
  const [copySearch, setCopySearch] = useState('');
  const [copyTotal, setCopyTotal] = useState(0);
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
    // Target species carried from the catalog drug (empty = all). Not enforced.
    species: string[];
    // ERP reorder controls (P2b).
    maxLevel: number | undefined;
    reorderQty: number | undefined;
    barcode: string;
    sellUnit: string;
    costUnit: string;
    /** Billable quantity: the sale price is per THIS MANY sell units
     * ("KES 100 per 10 mL"). Stored in metadata; the DB `price` stays
     * per single sell unit (= entered price ÷ sellQty) so every existing
     * charge/deduction path keeps working untouched. */
    sellQty: number;
    /** Outer pack (purchasing note only): how many stock units per pack. */
    packOf?: number;
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
    mainCategory: 'MEDICINE', subcategories: [], species: [], maxLevel: undefined, reorderQty: undefined, barcode: '', sellUnit: '', costUnit: '', sellQty: 1, packOf: undefined, injectionUnitMl: 10,
    feeService: undefined, feeAdmin: undefined, feeInjection: undefined, feePrescription: undefined,
  });
  /**
   * PRICE-BASIS GUARD — armed when the sell unit is switched away from the
   * stock unit.
   *
   * Changing "Billed / sold in" does NOT rescale the price, so flipping a
   * 2,200-per-Vial ketamine to mL and saving bills **2,200 per mL** — a 10×
   * overcharge on every dose, silently, on an item that looked correctly
   * configured. Nothing on the form said so, which is why not one of prod's 69
   * vial/bottle/bag items had ever been given a sell unit (user, 2026-08-19).
   *
   * Holds the price as it stood the moment the split was created, so the
   * warning can quote the real numbers and offer the divide.
   */
  const [priceBasisWarn, setPriceBasisWarn] = useState<{ stockUnit: string; priceAtSwitch: number } | null>(null);
  // Free-text entry for the "add subcategory" input.
  const [subcatDraft, setSubcatDraft] = useState('');
  // Index currently being dragged in the subcategory reorder list.
  const [dragSubcatIdx, setDragSubcatIdx] = useState<number | null>(null);
  // Product image upload (R2 presigned PUT via uploadsAPI)
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  // Add a product image from a link — try to DOWNLOAD it to R2 (persistent);
  // if the host blocks cross-origin fetch, fall back to using the raw link.
  const handleImageUrl = async (raw: string) => {
    const url = raw.trim();
    if (!url) return;
    setImageUploading(true);
    try {
      try {
        const resp = await fetch(url);
        const blob = resp.ok ? await resp.blob() : null;
        if (blob && blob.type.startsWith('image/') && blob.size <= 2 * 1024 * 1024) {
          const file = new File([blob], 'product-image', { type: blob.type });
          const res = await uploadsAPI.upload(file, 'misc');
          setItemForm(prev => ({ ...prev, imageUrl: res.publicUrl }));
          setImageUrlInput('');
          toast.success('Image saved from link');
          return;
        }
      } catch { /* CORS / hotlink block — use the link directly below */ }
      setItemForm(prev => ({ ...prev, imageUrl: url }));
      setImageUrlInput('');
      toast.success('Image link added');
    } finally {
      setImageUploading(false);
    }
  };
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
      // Carry the catalog drug's target species onto the stocked item (for the
      // later species-mismatch warning; empty = suitable for all).
      species: drug.species || [],
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

  // Open the Add/Update stock page prefilled from an existing item (used by the
  // card kebab menu and the product detail page).
  const startEdit = (item: any) => {
    setEditingItem(item);
    setSubcatDraft('');
    const meta = item.metadata || {};
    const fees = meta.fees || {};
    setItemForm({
      name: item.name,
      category: item.category,
      sku: item.sku,
      batchNumber: item.batchNumber,
      quantity: item.quantity,
      minThreshold: item.minThreshold,
      unit: item.unit,
      form: item.form ?? 'UNIT',
      packSize: item.packSize ?? undefined,
      billable: item.billable !== false,
      manufacturer: item.manufacturer ?? '',
      imageUrl: item.imageUrl ?? '',
      countryOfOrigin: item.countryOfOrigin ?? '',
      storageConditions: item.storageConditions ?? '',
      prescriptionOnly: item.prescriptionOnly === true,
      // DB price is per single sell unit; the form shows it per sellQty units.
      price: Math.round((Number(item.price) || 0) * (Number(meta.sellQty) || 1) * 100) / 100,
      costPrice: item.costPrice,
      expiryDate: item.expiryDate,
      supplierId: item.supplierId ?? undefined,
      mainCategory: (meta.mainCategory === 'CONSUMABLE' ? 'CONSUMABLE' : 'MEDICINE'),
      subcategories: Array.isArray(meta.subcategories) ? meta.subcategories : [],
      species: Array.isArray(item.species) ? item.species : [],
      maxLevel: item.maxLevel ?? undefined,
      reorderQty: item.reorderQty ?? undefined,
      barcode: item.barcode ?? '',
      sellUnit: meta.sellUnit ?? '',
      costUnit: meta.costUnit ?? '',
      sellQty: Number(meta.sellQty) || 1,
      packOf: meta.packOf != null ? Number(meta.packOf) : undefined,
      injectionUnitMl: Number(meta.injectionUnitMl) || 10,
      feeService: fees.service !== undefined ? Number(fees.service) : undefined,
      feeAdmin: fees.admin !== undefined ? Number(fees.admin) : undefined,
      feeInjection: fees.injection !== undefined ? Number(fees.injection) : undefined,
      feePrescription: fees.prescription !== undefined ? Number(fees.prescription) : undefined,
    });
    // A saved item's price already means what its saved units say; only a
    // change made in THIS session can put the two out of step.
    setPriceBasisWarn(null);
    setIsAddModalOpen(true);
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
  /**
   * Copy a supplier's product list into THIS clinic's catalogue.
   *
   * Definitions only — quantity 0, their cost carried, selling price left for
   * the clinic to set. No purchase order, no stock movement: copying is a
   * catalogue action, not a trading one.
   *
   * ⚠️ The count is confirmed BEFORE anything is written. A supplier list can
   * run to thousands of products, and a copy that lands unannounced in a live
   * clinic's catalogue is a mess to unpick item by item — so the user sees the
   * number first and agrees to it.
   */
  /**
   * One page of a supplier's catalogue. Large enough that most suppliers fit in
   * one load, small enough not to hang the modal; anything beyond it is reached
   * by searching, which the server handles.
   */
  const COPY_PAGE_SIZE = 300;

  /**
   * Does this clinic already stock the product? Matched the same way the server
   * matches — SKU first, then name — so the picker's "Already stocked" label and
   * what the copy actually skips cannot disagree.
   */
  const stockedSkus = useMemo(
    () => new Set(inventory.map(i => String((i as any).sku || '').trim().toLowerCase()).filter(Boolean)),
    [inventory],
  );
  const stockedNames = useMemo(
    () => new Set(inventory.map(i => i.name.trim().toLowerCase())),
    [inventory],
  );
  const alreadyStocked = (p: any) => {
    const sku = String(p.sku || '').trim().toLowerCase();
    if (sku && stockedSkus.has(sku)) return true;
    return stockedNames.has(String(p.name || '').trim().toLowerCase());
  };

  // Search runs on the server, so a supplier with thousands of products is
  // still reachable. Debounced — a keystroke per request would hammer it.
  useEffect(() => {
    if (!copySupplier) return;
    const t = setTimeout(() => { loadCopyProducts(copySupplier.id, copySearch.trim()); }, 350);
    return () => clearTimeout(t);
  }, [copySearch]);

  const openSupplierProducts = async (supplierId: string, supplierName: string) => {
    setCopySupplier({ id: supplierId, name: supplierName });
    setCopySearch('');
    await loadCopyProducts(supplierId, '');
  };

  const loadCopyProducts = async (supplierId: string, search: string) => {
    setCopyLoading(true);
    try {
      const res = await supplierProductsAPI.getBySupplierId(
        Number(supplierId),
        { limit: COPY_PAGE_SIZE, ...(search ? { search } : {}) },
        { cache: false } as any,
      );
      const rows = (res as any)?.data?.data || [];
      setCopyProducts(rows);
      setCopyTotal((res as any)?.data?.meta?.total ?? rows.length);
      // Pre-select what the clinic does NOT already stock. Selecting everything
      // would make the count meaningless; selecting nothing makes the common
      // case ("take the lot") a chore.
      setCopySelected(new Set(rows.filter((p: any) => !alreadyStocked(p)).map((p: any) => String(p.id))));
    } catch {
      setCopyProducts([]);
      setCopyTotal(0);
      toast.error('Could not load that supplier’s products');
    } finally {
      setCopyLoading(false);
    }
  };

  /**
   * Copy the SELECTED products into this clinic's catalogue.
   *
   * Definitions only — quantity 0, their cost carried, selling price left for
   * the clinic to set. No purchase order, no stock movement: copying is a
   * catalogue action, not a trading one.
   *
   * ⚠️ The count is confirmed BEFORE anything is written. A supplier list can
   * run to thousands of products, and a copy that lands unannounced in a live
   * clinic's catalogue is a mess to unpick item by item.
   */
  const copySelectedProducts = async () => {
    if (!copySupplier || copySelected.size === 0) return;
    const n = copySelected.size;
    const ok = await dialog.confirm({
      title: `Copy ${n} product${n === 1 ? '' : 's'} from ${copySupplier.name}?`,
      message: `They will be added to your catalogue with no stock and no selling price. This does not order anything.`,
      confirmLabel: `Copy ${n} to my catalogue`,
    });
    if (!ok) return;
    setCopyingFrom(copySupplier.id);
    try {
      const res = await supplierProductsAPI.copyToCatalogue(copySupplier.id, Array.from(copySelected));
      const copied = (res as any)?.data?.data?.copied ?? 0;
      const skipped = (res as any)?.data?.data?.skipped?.length ?? 0;
      toast.success(
        copied === 0
          ? 'Nothing new to copy — you already stock all of these.'
          : `${copied} product${copied === 1 ? '' : 's'} added${skipped ? `, ${skipped} skipped as already stocked` : ''}. Set your selling prices before billing them.`,
      );
      closeCopyModal();
      await refreshInventory?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not copy those products');
    } finally {
      setCopyingFrom(null);
    }
  };

  const closeCopyModal = () => {
    setShowCopyFromSupplier(false);
    setCopySupplier(null);
    setCopyProducts([]);
    setCopySelected(new Set());
    setCopySearch('');
  };

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
      mainCategory: 'MEDICINE', subcategories: [], species: [], maxLevel: undefined, reorderQty: undefined, barcode: '', sellUnit: '', costUnit: '', sellQty: 1, packOf: undefined, injectionUnitMl: 10,
      // Inherit the clinic's DEFAULT service charges (Clinic Management →
      // Billables) so the same four numbers aren't retyped per product. Only
      // applied to a NEW item — `startEdit` reads the item's own saved fees, so
      // editing a product never silently re-inherits a changed default.
      ...defaultItemFees(clinic),
    });
    setPriceBasisWarn(null);
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
      sellQty: Number(f.sellQty) || 1,
      ...(f.packOf ? { packOf: Number(f.packOf) } : {}),
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
    // sellQty/packOf live in metadata only; DB `price` is per SINGLE sell unit
    // (entered price ÷ billable quantity) so every charge path stays correct.
    const { sellQty: _sq, packOf: _po, ...restForm } = itemForm;
    const payload = {
      ...restForm,
      price: Math.round(((Number(itemForm.price) || 0) / (Number(itemForm.sellQty) || 1)) * 100) / 100,
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
      {!isAddModalOpen && !viewItem && showOverview && (
      <>
      {/* Inventory control-center overview (ERP P1) */}
      <InventoryDashboard currency={clinic.currency} />
      {/* Inventory reports (ERP P5) — collapsed by default, lazy-loaded */}
      <InventoryReports currency={clinic.currency} />
      {/* Expiry centre (ERP P4) — collapsed by default, lazy-loaded */}
      <InventoryExpiry currency={clinic.currency} />
      {/* Inter-clinic transfers (129). Lives here rather than in
          StockManagerView — that component is not routed anywhere. */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <StockTransfersPanel clinicId={clinic.id} />
      </div>
      {/* Physical counts (130) — next to transfers; both reconcile the shelf
          against the system. */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <StockTakePanel />
      </div>
      </>
      )}

      {!isAddModalOpen && !viewItem && showProducts && (
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
            {prodPerms.create && (
              <button
                onClick={openAddModal}
                className="shrink-0 compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-lg shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-4 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
              >
                <Plus size={14} className="inline mr-1" /> Add Item
              </button>
            )}
            {/* Three ways to get products in, side by side, because a clinic
                building its catalogue does not think of them as different
                features — one at a time, a spreadsheet, or a supplier's list. */}
            {prodPerms.create && (
              <>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view: 'import-data', params: { initialEntity: 'inventory' } } }))}
                  title="Upload a spreadsheet of products"
                  className="shrink-0 compact-button border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:border-seafoam hover:text-seafoam transition-all active:scale-95 px-3 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
                >
                  <Upload size={14} className="inline mr-1" /> Upload
                </button>
                <button
                  onClick={() => setShowCopyFromSupplier(true)}
                  title="Copy a supplier's product list into your own catalogue"
                  className="shrink-0 compact-button border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:border-seafoam hover:text-seafoam transition-all active:scale-95 px-3 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
                >
                  <Copy size={14} className="inline mr-1" /> Copy
                </button>
              </>
            )}
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
                      {/* One clean kebab menu instead of a row of tiny icons. */}
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuItemId(menuItemId === item.id ? null : item.id); }}
                          className="p-1 -m-1 text-slate-400 hover:text-pine dark:hover:text-zinc-100 rounded-lg" title="Actions"><MoreVertical size={15} /></button>
                        {menuItemId === item.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuItemId(null)} />
                            <div className="absolute right-0 top-6 z-20 w-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl py-1">
                              {[
                                { label: 'View details', icon: Eye, on: () => setViewItem(item), show: true },
                                { label: 'Update', icon: Edit, on: () => startEdit(item), show: prodPerms.edit },
                                { label: 'Set price', icon: Tag, on: () => { setPricingItem(item); setPriceMode('profit'); setProfitPct(''); setDirectSalePrice(String(item.price || '')); }, show: prodPerms.edit },
                                { label: 'Receive stock', icon: Plus, on: () => openRestock(item), show: prodPerms.stock },
                                { label: 'Adjust stock', icon: SlidersHorizontal, on: () => { setAdjustItem(item); setAdjustDelta(''); setAdjustReason(''); }, show: prodPerms.stock },
                                { label: 'Batch history', icon: History, on: () => setSelectedItemForDetails(item), show: true },
                              ].filter(a => a.show).map(a => (
                                <button key={a.label} onClick={() => { setMenuItemId(null); a.on(); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-pine dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800">
                                  <a.icon size={12} className="text-slate-400 shrink-0" /> {a.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setViewItem(item)} className="flex items-center gap-2 w-full text-left group/name" title="View details">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-100 dark:border-zinc-700 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h3 className="card-title text-sm leading-tight truncate group-hover/name:text-seafoam transition-colors">{item.name}</h3>
                        <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5">Batch: {item.batchNumber}</p>
                        {item.manufacturer && <p className="text-slate-400 dark:text-zinc-500 text-[7px] font-bold uppercase truncate">{item.manufacturer}</p>}
                      </div>
                    </button>
                    <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-lg border border-slate-100 dark:border-zinc-700">
                      <div className="flex justify-between text-[7px] font-black text-slate-400 uppercase mb-1"><span>Expires</span><span>Quantity</span></div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[9px] font-bold text-red-500">{(() => { const d = item.expiryDate ? new Date(item.expiryDate) : null; return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; })()}</span>
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
      {/* Product detail — full page (replaces the list) opened from a card. */}
      {viewItem && !isAddModalOpen && (() => {
        const it: any = viewItem;
        const meta = it.metadata || {};
        const fees = meta.fees || {};
        const ccy = clinic?.currency || 'KES';
        const expiry = (() => { const d = it.expiryDate ? new Date(it.expiryDate) : null; return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; })();
        const Stat = ({ label, value }: { label: string; value: any }) => (
          <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-slate-100 dark:border-zinc-800">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-sm font-black text-pine dark:text-zinc-100 break-words">{value ?? '—'}</p>
          </div>
        );
        return (
          <div className="animate-in fade-in duration-300 space-y-4 pb-20">
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setViewItem(null)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
                <ChevronLeft size={14} /> Back to inventory
              </button>
              <div className="flex items-center gap-2">
                {prodPerms.stock && (
                  <button onClick={() => { const i = it; setViewItem(null); openRestock(i); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-emerald-600 transition-all"><Plus size={12} /> Receive stock</button>
                )}
                {prodPerms.edit && (
                  <button onClick={() => { const i = it; setViewItem(null); startEdit(i); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white bg-pine hover:bg-pine/90 transition-all"><Edit size={12} /> Update</button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex items-start gap-4">
                {it.imageUrl
                  ? <img src={it.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-100 dark:border-zinc-700 shrink-0" />
                  : <div className="w-16 h-16 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0"><Package size={26} className="text-seafoam" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight leading-none">{it.name}</h1>
                    <span className={`px-1.5 py-0.5 rounded-lg text-[8px] font-black border uppercase tracking-widest ${it.status === 'IN_STOCK' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{it.status}</span>
                  </div>
                  <p className="text-seafoam text-[10px] font-black uppercase tracking-widest mt-1">SKU #{it.sku} · {it.category}</p>
                  {(meta.mainCategory || (meta.subcategories?.length)) && (
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{meta.mainCategory || ''}{meta.subcategories?.length ? ` › ${meta.subcategories.join(' › ')}` : ''}</p>
                  )}
                  {Array.isArray(it.species) && it.species.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">For</span>
                      {it.species.map((sp: string) => <span key={sp} className="px-1.5 py-0.5 rounded-md bg-seafoam/10 text-seafoam text-[9px] font-black uppercase">{sp}</span>)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <Stat label="Quantity" value={<>{it.quantity} <span className="text-[9px] text-slate-400 uppercase">{it.unit}</span></>} />
                <Stat label="Min / Max" value={`${it.minThreshold ?? '—'} / ${it.maxLevel ?? '—'}`} />
                <Stat label="Expires" value={<span className="text-red-500">{expiry}</span>} />
                <Stat label="Batch" value={it.batchNumber || '—'} />
                <Stat label="Sale price" value={it.price != null ? `${ccy} ${Number(it.price).toLocaleString()}` : '—'} />
                <Stat label="Cost price" value={it.costPrice != null ? `${ccy} ${Number(it.costPrice).toLocaleString()}` : '—'} />
                <Stat label="Form / pack" value={`${it.form ?? 'UNIT'}${it.packSize ? ` · ${it.packSize}` : ''}`} />
                <Stat label="Prescription only" value={it.prescriptionOnly ? 'Yes' : 'No'} />
                <Stat label="Barcode" value={it.barcode || '—'} />
                <Stat label="Manufacturer" value={it.manufacturer || '—'} />
                <Stat label="Country" value={it.countryOfOrigin || '—'} />
                <Stat label="Storage" value={it.storageConditions || '—'} />
                <Stat label="Billable" value={it.billable === false ? 'No' : 'Yes'} />
              </div>

              {(fees.service != null || fees.admin != null || fees.injection != null || fees.prescription != null) && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Service charges (per dispense)</p>
                  <div className="flex flex-wrap gap-2">
                    {[['Service', fees.service], ['Admin', fees.admin], ['Injection', fees.injection], ['Prescription', fees.prescription]].filter(([, v]) => v != null).map(([k, v]) => (
                      <span key={k as string} className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-[10px] font-bold text-pine dark:text-zinc-200">{k}: {ccy} {Number(v).toLocaleString()}</span>
                    ))}
                  </div>
                </div>
              )}

              {it.batchHistory?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><History size={12} /> Batch history</p>
                  <div className="space-y-1.5">
                    {it.batchHistory.map((bh: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 text-[11px]">
                        <span className="font-bold text-pine dark:text-zinc-100 truncate">Batch {bh.batchNumber || '—'}</span>
                        <span className="text-slate-400 shrink-0">{bh.quantity != null ? `${bh.quantity} ${it.unit}` : ''}{bh.expiryDate ? ` · exp ${String(bh.expiryDate).slice(0, 10)}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consumption velocity + reorder recommendation (ERP P2). */}
              {!!itemAnalytics?.consumption && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat label="Used · 30 days" value={`${itemAnalytics.consumption.last30} ${it.unit}`} />
                  <Stat label="Avg / month" value={`${itemAnalytics.consumption.avgMonthlyUse} ${it.unit}`} />
                  <Stat label="Est. remaining" value={itemAnalytics.consumption.monthsRemaining != null ? `${itemAnalytics.consumption.monthsRemaining} mo` : '—'} />
                  <div className={`rounded-xl p-3 border ${itemAnalytics.reorder?.belowReorder ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40' : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-100 dark:border-zinc-800'}`}>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Reorder</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{(itemAnalytics.reorder?.recommendedQty ?? 0) > 0 ? `${itemAnalytics.reorder.recommendedQty} ${it.unit}` : 'OK'}</p>
                  </div>
                </div>
              )}

              {/* Live batches in FEFO order — earliest expiry depletes first (ERP). */}
              {!!itemAnalytics?.batches?.length && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Package size={12} /> Live batches · FEFO order</p>
                  <div className="space-y-1.5">
                    {itemAnalytics.batches.map((b, i) => (
                      <div key={b.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[11px] ${i === 0 ? 'bg-seafoam/5 border-seafoam/30' : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-100 dark:border-zinc-800'}`}>
                        <span className="flex items-center gap-2 min-w-0">
                          {i === 0 && <span className="px-1.5 py-0.5 rounded bg-seafoam text-white text-[8px] font-black uppercase shrink-0">Next out</span>}
                          <span className="font-black text-pine dark:text-zinc-100 truncate">Batch {b.batchNumber || '—'}</span>
                        </span>
                        <span className="text-slate-400 shrink-0">{b.remaining} / {b.received} {it.unit} · exp {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Movement ledger — the product's "bank statement" (ERP P2). */}
              {!!itemAnalytics?.ledger?.length && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><History size={12} /> Stock movements</p>
                  <div className="border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/60 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      <span className="col-span-3">Date</span><span className="col-span-3">Transaction</span><span className="col-span-3">Reference</span><span className="col-span-1 text-right">Qty</span><span className="col-span-2 text-right">Balance</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-zinc-800/60">
                      {itemAnalytics.ledger.map(m => {
                        const label: Record<string, string> = { RESTOCKED: 'Received', RETURNED: 'Returned', USED_IN_APPOINTMENT: 'Dispensed', SOLD: 'Sold', ADJUSTED: 'Adjusted', EXPIRED: 'Expired', DAMAGED: 'Damaged' };
                        const up = m.quantity >= 0;
                        return (
                          <div key={m.id} className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] items-center">
                            <span className="col-span-3 text-slate-400">{new Date(m.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                            <span className="col-span-3 font-bold text-pine dark:text-zinc-100">{label[m.type] || m.type}</span>
                            <span className="col-span-3 text-slate-400 truncate">{m.reference || '—'}</span>
                            <span className={`col-span-1 text-right font-black ${up ? 'text-emerald-600' : 'text-rose-600'}`}>{up ? '+' : ''}{m.quantity}</span>
                            {/* Recorded before → after when the row carries it
                                (backend 210); pre-210 rows fall back to the
                                replayed balance, which a direct edit to
                                inventory_items.quantity can shift. */}
                            <span className="col-span-2 text-right font-black text-pine dark:text-zinc-100">
                              {(m as any).balanceBefore != null
                                ? <span className="font-mono">{(m as any).balanceBefore} → {m.balanceAfter}</span>
                                : m.balanceAfter}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
                <span className="w-4 h-4 rounded-md bg-seafoam/15 text-seafoam flex items-center justify-center text-[9px]">1</span> Basic Information
              </p>
              {/* Row 1: Name + Main category bucket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Product Name *</label>
                  <input
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. Amoxicillin 500mg"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                  {/* Target species carried from the catalog (empty = all).
                      Captured for the upcoming species-mismatch warning. */}
                  {itemForm.species.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">For</span>
                      {itemForm.species.map(sp => (
                        <span key={sp} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-seafoam/10 text-seafoam text-[9px] font-black uppercase">
                          {sp}
                          <button type="button" onClick={() => setItemForm(f => ({ ...f, species: f.species.filter(s => s !== sp) }))} className="hover:text-red-500">×</button>
                        </span>
                      ))}
                    </div>
                  )}
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
                    className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
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
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. VAC-123456"
                    value={itemForm.sku}
                    onChange={e => setItemForm({ ...itemForm, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Supplier</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
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
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
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
                  {/* Or paste an image link — downloads it to storage when the
                      host allows, else uses the link directly. */}
                  {!itemForm.imageUrl && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="url" placeholder="…or paste an image URL"
                        className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-pine dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-seafoam/20"
                        value={imageUrlInput}
                        onChange={e => setImageUrlInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleImageUrl(imageUrlInput); } }}
                        disabled={imageUploading}
                      />
                      <button type="button" onClick={() => handleImageUrl(imageUrlInput)} disabled={imageUploading || !imageUrlInput.trim()}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-seafoam hover:bg-pine disabled:opacity-40 transition-colors shrink-0">
                        {imageUploading ? '…' : 'Use link'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="w-4 h-4 rounded-md bg-seafoam/15 text-seafoam flex items-center justify-center text-[9px]">2</span> Clinical & Regulatory
              </p>
              {/* Row 2c: Country of origin, storage conditions, prescription-only — mockup parity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Country of Origin</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. Kenya"
                    value={itemForm.countryOfOrigin}
                    onChange={e => setItemForm({ ...itemForm, countryOfOrigin: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Storage Conditions</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
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
                <span className="w-4 h-4 rounded-md bg-seafoam/15 text-seafoam flex items-center justify-center text-[9px]">3</span> Stock & Batch
              </p>
              {/* Row 3: Batch, Expiry. "Units bought" moved down into the
                  BUY panel — sitting up here it was a whole row away from the
                  sell unit, which is exactly what made the two easy to confuse
                  (user, 2026-08-22: "rearrange so as not to confuse, esp buying
                  vs selling unit"). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Batch Number</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="BATCH-001"
                    value={itemForm.batchNumber}
                    onChange={e => setItemForm({ ...itemForm, batchNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.expiryDate}
                    onChange={e => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 3b: how the item is BOUGHT vs BILLED (user, 2026-08-03:
                  "state the billable quantity" — Vials per pack, mL in 1 Vial,
                  price per N mL, Billable BELOW the statement). `packSize`
                  stays the load-bearing stock→sell bridge; `packOf` is an
                  outer-pack purchasing note (metadata, display only). */}
              {(() => {
                const u = (itemForm.unit || '').trim();
                const MEASURES = ['ml', 'l', 'mg', 'g', 'kg', 'iu', 'cc'];
                const plural = !u ? 'Units'
                  : MEASURES.includes(u.toLowerCase()) || /s$/i.test(u) ? u
                  : `${u}s`;
                const sellU = (itemForm.sellUnit || '').trim();
                const split = !!sellU && sellU.toLowerCase() !== u.toLowerCase();
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* ── HOW YOU BUY IT ─────────────────────────────── */}
                      <div className="space-y-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-800/40 p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">You buy &amp; stock it in</p>
                        <div className="space-y-1">
                          <label className="''' + LBL + '''">Units bought *</label>
                          <select
                            required
                            className="''' + FIELD + ''' appearance-none"
                            value={itemForm.unit}
                            onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                            title="The unit stock is counted in — what you order and what sits on the shelf"
                          >
                            {Array.from(new Set([...ORDERED_UNITS, ...(itemForm.unit ? [itemForm.unit] : [])]))
                              .map(un => <option key={un} value={un}>{un}</option>)}
                          </select>
                          <p className="text-[9px] font-bold text-slate-400 px-1">Stock is counted in this unit.</p>
                        </div>
                        <div className="space-y-1">
                          <label className="''' + LBL + '''">
                            {plural} per pack <span className="text-slate-400 normal-case font-bold">(optional)</span>
                          </label>
                          <input
                            type="number" min="0"
                            className="''' + FIELD + '''"
                            placeholder={`e.g. 30 ${plural} per box`}
                            title="Outer pack, for purchasing reference only"
                            value={split ? (itemForm.packOf ?? '') : (itemForm.packSize ?? '')}
                            onChange={e => {
                              const v = e.target.value === '' ? undefined : Number(e.target.value);
                              setItemForm(split ? { ...itemForm, packOf: v } : { ...itemForm, packSize: v });
                            }}
                          />
                          {split && (
                            <p className="text-[9px] font-bold text-slate-400 px-1">
                              Purchasing note only — does not affect stock, price or billing.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ── HOW YOU SELL IT ────────────────────────────── */}
                      <div className="space-y-2 rounded-xl border border-seafoam/30 bg-seafoam/[0.04] p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-seafoam">You bill &amp; sell it in</p>
                      <div className="space-y-1">
                        <label className="''' + LBL + '''">Billed / sold in *</label>
                        <select
                          className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                          value={itemForm.sellUnit || itemForm.unit}
                          onChange={e => {
                            const next = e.target.value;
                            const stock = (itemForm.unit || '').trim();
                            const wasSplit = !!(itemForm.sellUnit || '').trim()
                              && (itemForm.sellUnit || '').trim().toLowerCase() !== stock.toLowerCase();
                            const nowSplit = !!next.trim() && next.trim().toLowerCase() !== stock.toLowerCase();
                            // Arm only on the transition INTO a split — that is
                            // the moment the entered price stops meaning what it
                            // did. Re-picking another sell unit while already
                            // split must not re-arm with an already-rescaled price.
                            if (nowSplit && !wasSplit) {
                              setPriceBasisWarn({ stockUnit: stock, priceAtSwitch: Number(itemForm.price) || 0 });
                            } else if (!nowSplit) {
                              setPriceBasisWarn(null);
                            }
                            setItemForm({ ...itemForm, sellUnit: next });
                          }}
                          title="The unit this item is billed in — can differ from the unit bought"
                        >
                          {Array.from(new Set([itemForm.unit, ...ORDERED_UNITS])).map(un => <option key={un} value={un}>{un}</option>)}
                        </select>
                      </div>
                      {split && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">
                            {sellU} <span className="normal-case">in 1</span> {u} *
                          </label>
                          <input
                            type="number" min="0" step="any"
                            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                            placeholder={`e.g. 100 ${sellU} per ${u}`}
                            title={`How many ${sellU} one ${u} contains — drives stock deduction and pricing`}
                            value={itemForm.packSize ?? ''}
                            onChange={e => setItemForm({ ...itemForm, packSize: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                          <p className="text-[9px] font-bold text-slate-400 px-1">
                            The bridge between the two units — drives stock deduction and pricing.
                          </p>
                        </div>
                      )}
                      </div>
                    </div>

                    {/* The whole relationship in one plain sentence, so nobody
                        has to infer it from four separate labels. */}
                    {(() => {
                      const b = unitMath(itemForm as any);
                      if (!b.split) {
                        return (
                          <p className="text-[10px] font-bold text-slate-400 px-1">
                            Bought and sold in the same unit ({b.stockU || '—'}) — one {b.stockU || 'unit'} on the shelf is one {b.stockU || 'unit'} on the bill.
                          </p>
                        );
                      }
                      if (b.sellPerStock === 0) {
                        return (
                          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                            You buy in <strong>{b.stockU}</strong> but bill in <strong>{b.sellU}</strong> — say how many {b.sellU} are in 1 {b.stockU} above, or stock and money will both be wrong.
                          </p>
                        );
                      }
                      return (
                        <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                          Buy in <strong className="text-pine dark:text-zinc-100">{b.stockU}</strong>, bill in <strong className="text-seafoam">{b.sellU}</strong> ·
                          {' '}1 {b.stockU} = <strong className="text-pine dark:text-zinc-100">{b.sellPerStock.toLocaleString()} {b.sellU}</strong>
                        </p>
                      );
                    })()}

                    {/* Billable — BELOW the buy/bill statement (user request). */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Billable</label>
                      <button type="button" onClick={() => setItemForm({ ...itemForm, billable: !itemForm.billable })}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider border ${itemForm.billable ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                        {itemForm.billable ? 'Billable' : 'Non-billable'}
                      </button>
                    </div>
                  </>
                );
              })()}

              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="w-4 h-4 rounded-md bg-seafoam/15 text-seafoam flex items-center justify-center text-[9px]">4</span> Levels & Pricing
              </p>
              {/* Row 4a: Quantity + Min threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">
                    Quantity to add{itemForm.unit ? <span className="text-slate-400 normal-case font-bold"> ({itemForm.unit})</span> : null} *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="0"
                    value={itemForm.quantity}
                    onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                  />
                  {/* What that quantity is in the SMALL unit — the number the
                      clinic actually dispenses and bills (user, 2026-08-22:
                      "show total of small unit when user edit Quantity to
                      add"). Typing 300 Bottles and reading "300" everywhere
                      hid that the shelf really holds 15,000 mL. */}
                  {(() => {
                    const q = unitMath(itemForm as any);
                    if (!q.split || !q.qty) return null;
                    if (q.sellPerStock === 0) return (
                      <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 px-1">
                        Set {q.sellU} in 1 {q.stockU} above to see the {q.sellU} total.
                      </p>
                    );
                    return (
                      <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 px-1">
                        = <strong className="text-pine dark:text-zinc-100">{q.qtyInSell.toLocaleString()} {q.sellU}</strong>
                        <span className="text-slate-400"> · {q.qty.toLocaleString()} × {q.sellPerStock.toLocaleString()}</span>
                      </p>
                    );
                  })()}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Min stock alert *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="5"
                    value={itemForm.minThreshold}
                    onChange={e => setItemForm({ ...itemForm, minThreshold: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Row 4a2: ERP reorder controls — max level, reorder qty, barcode. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Max level</label>
                  <input type="number" min="0" placeholder="—"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.maxLevel ?? ''} onChange={e => setItemForm({ ...itemForm, maxLevel: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Reorder qty</label>
                  <input type="number" min="0" placeholder="Auto"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.reorderQty ?? ''} onChange={e => setItemForm({ ...itemForm, reorderQty: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Barcode</label>
                  <input type="text" placeholder="Scan / type"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.barcode} onChange={e => setItemForm({ ...itemForm, barcode: e.target.value })} />
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
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
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
                  {/* Price per BILLABLE QUANTITY (user, 2026-08-03): "from a
                      100 mL vial costing 100, I charge 100 for every 10 mL" —
                      KES [100] per [10] [mL]. Stored per single sell unit. */}
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" required step="0.01" min="0"
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                      placeholder="0.00"
                      value={itemForm.price}
                      onChange={e => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                    />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">per</span>
                    <input
                      type="number" min="0.01" step="any"
                      className="w-16 shrink-0 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2.5 text-pine dark:text-zinc-100 font-black text-center outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                      title="Billable quantity — the price covers this many sell units"
                      value={itemForm.sellQty}
                      onChange={e => setItemForm({ ...itemForm, sellQty: Number(e.target.value) || 1 })}
                    />
                    <span className="text-xs font-bold text-pine dark:text-zinc-100 shrink-0 min-w-[2.5rem]">{itemForm.sellUnit || itemForm.unit}</span>
                  </div>
                  {/* The price did not follow the unit — say so in money. */}
                  {(() => {
                    if (!priceBasisWarn) return null;
                    const sellU = (itemForm.sellUnit || '').trim();
                    const stockU = priceBasisWarn.stockUnit;
                    const pack = Number(itemForm.packSize) || 0;
                    // Nothing to warn about until we know how many sell units a
                    // stock unit holds — that ratio IS the size of the mistake.
                    if (!sellU || !stockU || sellU.toLowerCase() === stockU.toLowerCase() || pack <= 1) return null;
                    const shown = Number(itemForm.price) || 0;
                    const perQty = Number(itemForm.sellQty) || 1;
                    // Already rescaled (by the button or by hand) — stay quiet.
                    if (Math.abs(shown / perQty - priceBasisWarn.priceAtSwitch / pack) < 0.005) return null;
                    const rescaled = Math.round((priceBasisWarn.priceAtSwitch / pack) * 100) / 100;
                    const wouldCharge = Math.round((shown / perQty) * pack * 100) / 100;
                    const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    return (
                      <div className="mt-2 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 space-y-2">
                        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-snug">
                          Price is still <b>{fmt(priceBasisWarn.priceAtSwitch)}</b> — per <b>{stockU}</b>, not per <b>{sellU}</b>.
                          {' '}Billing {fmt(pack)} {sellU} would charge <b>{fmt(wouldCharge)}</b> instead of {fmt(priceBasisWarn.priceAtSwitch)}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setItemForm({ ...itemForm, price: rescaled, sellQty: 1 });
                              setPriceBasisWarn(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-amber-600"
                          >
                            Rescale to {fmt(rescaled)} / {sellU}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPriceBasisWarn(null)}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest"
                          >
                            Keep {fmt(shown)} / {sellU}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Margin readout — what the clinic actually makes on this item.
                  Live off cost/sale so the owner sees it while pricing, not
                  after saving. Cost and sale can be priced per DIFFERENT units
                  (buy per bottle, sell per mL), in which case a per-unit
                  subtraction is meaningless — so we convert via units-per-pack
                  when that's available and otherwise say why there's no
                  number, rather than showing a confident wrong one. */}
              {(() => {
                // Same unitMath() the checkout aside uses — two readouts that
                // disagree about money is worse than either being wrong alone.
                const mm = unitMath(itemForm as any);
                const cost = mm.cost;
                const sale = mm.salePerSell;
                if (sale <= 0) return null;
                const costU = mm.costU;
                const sellU = mm.sellU;
                const pack = mm.pack;
                const perSaleUnitCost = mm.resolvable ? mm.costPerSell : null;

                if (cost <= 0) {
                  return (
                    <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 px-1">
                      Add a cost price to see the margin on this item.
                    </p>
                  );
                }
                if (perSaleUnitCost === null) {
                  return (
                    <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                      <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                        {mm.split && mm.sellPerStock === 0
                          ? <>Set <strong>{sellU} in 1 {mm.stockU}</strong> above — without it a per-{sellU} margin cannot be worked out.</>
                          : <>Cost is quoted per <strong>{costU}</strong>, which is neither the stock unit ({mm.stockU}) nor the sell unit ({sellU}) — no margin shown.</>}
                      </p>
                    </div>
                  );
                }

                const profit = sale - perSaleUnitCost;
                const markup = perSaleUnitCost > 0 ? (profit / perSaleUnitCost) * 100 : 0;
                const marginPct = (profit / sale) * 100;
                /**
                 * ⚠️ "Quantity to add" is in STOCK units; `profit` is per SELL
                 * unit. Multiplying them directly under-read the whole shelf by
                 * the pack factor: 20 Vials of 50 mL at 14/mL showed "On 20 mL:
                 * KES 280" instead of 1,000 mL worth KES 14,000 (user,
                 * 2026-08-20). Convert first, and say both units.
                 */
                const qty = mm.qty;
                const qtyInSell = mm.qtyInSell;
                const stockProfit = profit * qtyInSell;
                const cur = clinic?.currency || 'KES';
                const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
                        {cur} {n(profit)}<span className="text-[10px] font-bold text-slate-400"> / {sellU}</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                        Markup <strong className={loss ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}>{n(markup)}%</strong>
                        {' · '}Margin <strong className={loss ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}>{n(marginPct)}%</strong> of sale
                      </span>
                      {qty > 0 && (
                        <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                          On {n(qty)} {itemForm.unit || sellU}
                          {qtyInSell !== qty ? ` (${n(qtyInSell)} ${sellU})` : ''}
                          : <strong className={loss ? 'text-red-600' : 'text-pine dark:text-zinc-100'}>{cur} {n(stockProfit)}</strong>
                        </span>
                      )}
                    </div>
                    {mm.split && (
                      <p className="text-[9px] font-bold text-slate-400 mt-1">
                        1 {mm.stockU} = {n(mm.sellPerStock)} {sellU}
                        {mm.costIsStock && <> · cost {cur} {n(cost)} per {costU} ÷ {n(pack)} = {cur} {n(perSaleUnitCost || 0)} per {sellU}</>}
                        {mm.costIsSell && <> · cost {cur} {n(cost)} per {sellU}</>}
                      </p>
                    )}
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                      Excludes the service charges below — those add to the bill on top of this.
                    </p>
                  </div>
                );
              })()}

              {/* Service charges — each checkbox reveals its amount field */}
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="w-4 h-4 rounded-md bg-seafoam/15 text-seafoam flex items-center justify-center text-[9px]">5</span> Service Charges <span className="text-slate-400 normal-case font-bold tracking-normal">— added at billing time</span>
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
                          {/* Per-mL divisor HIDDEN (user, 2026-08-03: "remove
                              per ml ui, just comment") — the injection fee is a
                              flat per-injection amount for now. The
                              `injectionUnitMl` field still persists (default 10)
                              so re-enabling this is uncommenting, not a rebuild.
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
                          */}
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
              // ⚠️ `projected` is the WALLET DEBIT and the Total Due, so it has
              // to be the real money, converted through packSize — not
              // cost × bottle-count. See unitMath().
              const m = unitMath(itemForm as any);
              const qty = m.qty;
              const cost = m.cost;
              const sale = m.salePerSell;
              const projected = m.buyTotal ?? 0;        // total buy cost (wallet debit)
              const totalSale = m.saleTotal ?? 0;       // potential revenue on this batch
              const grossProfit = totalSale - projected;
              const marginPct = totalSale > 0 ? (grossProfit / totalSale) * 100 : 0;
              const enabled = !editingItem && deductFromWallet && projected > 0;
              const picked = stockWallets.find((w: any) => String(w.id) === String(selectedStockWalletId));
              const ccy = clinic?.currency || 'KES';
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
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">Profit / Loss on {qty || 0} {m.stockU}{m.split && m.qtyInSell ? ` (${m.qtyInSell.toLocaleString()} ${m.sellU})` : ''}</p>
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
                        {m.split && m.sellPerStock > 0 && (
                          <p className="text-[8px] font-bold text-slate-400 leading-tight pt-0.5">
                            1 {m.stockU} = {m.sellPerStock.toLocaleString()} {m.sellU} · cost quoted per {m.costU}
                          </p>
                        )}
                        {!m.resolvable && (
                          <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 leading-tight pt-0.5">
                            {m.split && m.sellPerStock === 0
                              ? <>⚠ Set <strong>{m.sellU} in 1 {m.stockU}</strong> above — without it these totals cannot be worked out.</>
                              : <>⚠ Cost is quoted per <strong>{m.costU}</strong>, which is neither the stock unit ({m.stockU}) nor the sell unit ({m.sellU}) — totals are not shown.</>}
                          </p>
                        )}
                      </div>

                      {/* Applied service charges summary */}
                      {(itemForm.feeService !== undefined || itemForm.feeAdmin !== undefined || itemForm.feeInjection !== undefined || itemForm.feePrescription !== undefined) && (
                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-2 space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Service charges</p>
                          {itemForm.feeService !== undefined && <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400"><span>Service</span><span className="font-mono">{ccy} {(itemForm.feeService||0).toLocaleString()}</span></div>}
                          {itemForm.feeAdmin !== undefined && <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400"><span>Administration</span><span className="font-mono">{ccy} {(itemForm.feeAdmin||0).toLocaleString()}</span></div>}
                          {itemForm.feeInjection !== undefined && <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-zinc-400"><span>Injection</span><span className="font-mono">{ccy} {(itemForm.feeInjection||0).toLocaleString()}</span></div>}
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
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.quantity} onChange={e => setRestockForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Received as</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
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
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                      value={restockForm.packSize} onChange={e => setRestockForm(f => ({ ...f, packSize: e.target.value }))} />
                    {restockEffectiveQty() > 0 && <p className="text-[10px] font-black text-seafoam px-1">= {restockEffectiveQty()} {restockItem.unit} added to stock</p>}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Batch ref</label>
                  <input placeholder="BATCH-002"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.batchNumber} onChange={e => setRestockForm(f => ({ ...f, batchNumber: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Buy price / {restockItem.unit}</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.costPrice} onChange={e => setRestockForm(f => ({ ...f, costPrice: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Sale price / {restockItem.unit}</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={restockForm.sellingPrice} onChange={e => setRestockForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Expiry date</label>
                  <input type="date"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
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

      {/* Stock adjustment modal (ERP P4) — writes an ADJUSTED movement. */}
      {adjustItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !adjustBusy && setAdjustItem(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2"><SlidersHorizontal size={15} className="text-seafoam" /> Adjust stock</h3>
              <button onClick={() => !adjustBusy && setAdjustItem(null)} className="text-slate-400 hover:text-pine"><X size={18} /></button>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl px-3 py-2 border border-slate-100 dark:border-zinc-800">
              <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{adjustItem.name}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase">On hand: {adjustItem.quantity} {adjustItem.unit}</p>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Adjustment ({adjustItem.unit})</label>
              <input type="number" step="any" autoFocus placeholder="e.g. -2 (loss) or 5 (found)"
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} />
              {adjustDelta && !Number.isNaN(Number(adjustDelta)) && (
                <p className="text-[10px] font-bold text-slate-400 px-1">New on hand: <span className="text-pine dark:text-zinc-100">{Number(adjustItem.quantity) + Number(adjustDelta)} {adjustItem.unit}</span></p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Reason *</label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {['Damaged', 'Expired', 'Count correction', 'Internal use', 'Theft/loss', 'Found'].map(r => (
                  <button key={r} type="button" onClick={() => setAdjustReason(r)} className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all ${adjustReason === r ? 'border-seafoam bg-seafoam/10 text-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'}`}>{r}</button>
                ))}
              </div>
              <input type="text" placeholder="Reason for adjustment…"
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdjustItem(null)} disabled={adjustBusy} className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
              <button onClick={submitAdjustment} disabled={adjustBusy} className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-pine hover:bg-pine/90 disabled:opacity-50">{adjustBusy ? 'Saving…' : 'Apply adjustment'}</button>
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

      {/* Copy from a supplier: pick the supplier, then pick the products. This
          reads their catalogue and writes only into ours — the supplier's own
          list is never touched.

          ⚠️ z-90, NOT higher. The shared confirm dialog is z-200 and every modal
          in this view sits below it (70/80). At 800 this modal covered the
          confirmation it raises, so the confirm button could not be clicked at
          all — caught in a browser, invisible to tsc and to the build. */}
      {showCopyFromSupplier && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeCopyModal}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {copySupplier && (
                  <button type="button" onClick={() => { setCopySupplier(null); setCopyProducts([]); setCopySelected(new Set()); setCopySearch(''); }}
                    className="p-1 -m-1 text-slate-400 hover:text-pine dark:hover:text-zinc-100" title="Back to suppliers">
                    <ChevronLeft size={16} />
                  </button>
                )}
                <p className="text-sm font-black uppercase tracking-tight text-pine dark:text-zinc-100">
                  {copySupplier ? copySupplier.name : 'Copy from a supplier'}
                </p>
              </div>
              <p className="mt-1 text-[10px] font-bold text-slate-400 leading-relaxed">
                {copySupplier
                  ? 'Tick what you want. Copies become your own catalogue entries — no stock, their cost, and your selling prices left for you to set. Nothing is ordered.'
                  : 'Their products become your own catalogue entries — no stock, their cost, and your selling prices left for you to set. Nothing is ordered.'}
              </p>
            </div>

            {/* Stage 1 — which supplier */}
            {!copySupplier && (
              <div className="p-3 overflow-y-auto space-y-1.5">
                {suppliers.length === 0 && (
                  <p className="p-6 text-center text-[11px] font-bold text-slate-400">No suppliers yet.</p>
                )}
                {suppliers.map(sp => (
                  <button key={String(sp.id)} type="button"
                    onClick={() => openSupplierProducts(String(sp.id), sp.name)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-seafoam text-left transition-all">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-black uppercase tracking-wide text-pine dark:text-zinc-100 truncate">{sp.name}</span>
                      {sp.category && <span className="block text-[9px] font-bold text-slate-400">{sp.category}</span>}
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            )}

            {/* Stage 2 — which products */}
            {copySupplier && (
              <>
                <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      value={copySearch}
                      onChange={e => setCopySearch(e.target.value)}
                      placeholder="Search their products..."
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold outline-none text-pine dark:text-zinc-100"
                    />
                  </div>
                  <button type="button"
                    onClick={() => {
                      const selectable = copyProducts.filter(p => !alreadyStocked(p));
                      setCopySelected(copySelected.size === selectable.length
                        ? new Set()
                        : new Set(selectable.map(p => String(p.id))));
                    }}
                    className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam">
                    {copySelected.size === copyProducts.filter(p => !alreadyStocked(p)).length && copySelected.size > 0 ? 'None' : 'All'}
                  </button>
                </div>

                <div className="p-3 overflow-y-auto space-y-1">
                  {copyLoading && <p className="p-6 text-center text-[11px] font-bold text-slate-400">Loading…</p>}
                  {!copyLoading && copyProducts.length === 0 && (
                    <p className="p-6 text-center text-[11px] font-bold text-slate-400">
                      {copySearch ? 'Nothing matches that search.' : 'This supplier has no products yet.'}
                    </p>
                  )}
                  {!copyLoading && copyProducts.map(p => {
                    const stocked = alreadyStocked(p);
                    const id = String(p.id);
                    const checked = copySelected.has(id);
                    return (
                      <label key={id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${stocked
                          ? 'border-slate-100 dark:border-zinc-800/60 opacity-60 cursor-not-allowed'
                          : `cursor-pointer ${checked ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'}`}`}>
                        <input type="checkbox" disabled={stocked} checked={checked}
                          onChange={() => {
                            const next = new Set(copySelected);
                            if (next.has(id)) next.delete(id); else next.add(id);
                            setCopySelected(next);
                          }}
                          className="shrink-0 w-4 h-4 accent-seafoam" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{p.name}</span>
                          <span className="block text-[9px] font-bold text-slate-400 truncate">
                            {[p.sku, p.category, p.unit].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[10px] font-black text-pine dark:text-zinc-100">
                            {Number(p.unitPrice || 0).toLocaleString()}
                          </span>
                          {stocked && <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Already stocked</span>}
                        </span>
                      </label>
                    );
                  })}
                  {/* Say what is NOT on screen rather than letting the list look complete. */}
                  {!copyLoading && copyTotal > copyProducts.length && (
                    <p className="pt-2 text-center text-[9px] font-bold text-amber-600">
                      Showing {copyProducts.length} of {copyTotal} — search to reach the rest.
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {copySupplier ? `${copySelected.size} selected` : ''}
              </span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={closeCopyModal}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-pine">Cancel</button>
                {copySupplier && (
                  <button type="button" onClick={copySelectedProducts}
                    disabled={copySelected.size === 0 || copyingFrom !== null}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
                    {copyingFrom ? 'Copying…' : `Copy ${copySelected.size || ''}`}
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;

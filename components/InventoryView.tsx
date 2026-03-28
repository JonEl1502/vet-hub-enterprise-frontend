
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventoryStatus, Clinic, Supplier } from '../types';
import { Search, Plus, Package, Edit, X, History, RefreshCw, Filter, Tag, Percent, Building2 } from 'lucide-react';
import { suppliersAPI, Supplier as APISupplier, toast } from '../services';
import { usePagination } from '../hooks/usePagination';
import Pagination from './Pagination';
import DateRangePicker, { DateRange } from './DateRangePicker';


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

const InventoryView: React.FC<InventoryViewProps> = ({ inventory, clinic, onUpdateStock, onUpdateItem, onAddItem, refreshInventory }) => {
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
    price: number;
    costPrice: number;
    expiryDate: string;
    supplierId: number | undefined;
  }>({
    name: '', category: 'Vaccines', sku: '', batchNumber: '', quantity: 0, minThreshold: 5, unit: 'Units', price: 0, costPrice: 0,
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    supplierId: suppliers[0]?.id ? Number(suppliers[0].id) : undefined
  });

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
    const defaultSKU = generateDefaultSKU(itemForm.category);
    setItemForm({
      name: '',
      category: 'Vaccines',
      sku: defaultSKU,
      batchNumber: '',
      quantity: 0,
      minThreshold: 5,
      unit: 'Units',
      price: 0,
      costPrice: 0,
      expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      supplierId: suppliers[0]?.id ? Number(suppliers[0].id) : undefined
    });
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!itemForm.name || !itemForm.category || !itemForm.sku || !itemForm.unit || itemForm.price === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (itemForm.quantity < 0 || itemForm.minThreshold < 0 || itemForm.price < 0) {
      toast.error('Quantity, threshold, and price must be positive numbers');
      return;
    }

    if (editingItem) {
      onUpdateItem(editingItem.id, itemForm);
    } else {
      onAddItem({ ...itemForm, clinicId: clinic.id });
    }

    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* Filters Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-seafoam" />
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Filters</h3>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-seafoam/10 rounded-lg border border-seafoam/20">
              <Building2 size={11} className="text-seafoam shrink-0" />
              <span className="text-[10px] font-black text-seafoam truncate max-w-[140px]">{clinic.name}</span>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={openAddModal}
              className="compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-lg shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-4 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
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
              className="compact-button bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100 transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5"
              title="Refresh inventory"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative group flex-1 min-w-[200px]">
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

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InventoryStatus | 'ALL')}
            className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
          >
            <option value="ALL">All Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock ({stats.lowStock})</option>
            <option value="OUT_OF_STOCK">Out of Stock ({stats.outOfStock})</option>
            <option value="EXPIRED">Expired ({stats.expired})</option>
          </select>

          {/* DatePicker */}
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            className="min-w-[160px]"
          />
        </div>
      </div>

      <>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              {paginatedInventory.map(item => (
                <div key={item.id} className="compact-card flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className={`px-1.5 py-0.5 rounded-lg text-[7px] font-black border uppercase tracking-widest ${item.status === 'IN_STOCK' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{item.status}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => {
                          setEditingItem(item);
                          setItemForm({
                            name: item.name,
                            category: item.category,
                            sku: item.sku,
                            batchNumber: item.batchNumber,
                            quantity: item.quantity,
                            minThreshold: item.minThreshold,
                            unit: item.unit,
                            price: item.price,
                            costPrice: item.costPrice,
                            expiryDate: item.expiryDate,
                            supplierId: item.supplierId ?? undefined
                          });
                          setIsAddModalOpen(true);
                        }} className="text-slate-300 hover:text-pine"><Edit size={12} /></button>
                        <button onClick={() => {
                          setPricingItem(item);
                          setPriceMode('profit');
                          setProfitPct('');
                          setDirectSalePrice(String(item.price || ''));
                        }} className="text-slate-300 hover:text-seafoam" title="Set Price"><Tag size={12} /></button>
                        <button onClick={() => setSelectedItemForDetails(item)} className="text-slate-300 hover:text-cyan"><History size={12} /></button>
                      </div>
                    </div>
                    <div>
                      <h3 className="card-title text-sm leading-tight truncate">{item.name}</h3>
                      <p className="text-seafoam dark:text-zinc-500 text-[7px] font-black uppercase mt-0.5">Batch: {item.batchNumber}</p>
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
              limitOptions={[8, 16, 32, 64]}
            />
          </div>
        </>

      {/* Item Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-md z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-4 sm:p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">{editingItem ? 'Update Stock' : 'Add Medicine'}</h2>
                <p className="text-seafoam text-[9px] font-black uppercase mt-1">Stock registry configuration</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-pine"><X size={20} /></button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Row 1: Name and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Medicine Name *</label>
                  <input
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="e.g. Amoxicillin 500mg"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Category *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    value={itemForm.category}
                    onChange={e => {
                      const newCategory = e.target.value;
                      const shouldUpdateSKU = !editingItem && (!itemForm.sku || itemForm.sku.match(/^[A-Z]{3}-\d{6}$/));
                      setItemForm({
                        ...itemForm,
                        category: newCategory,
                        sku: shouldUpdateSKU ? generateDefaultSKU(newCategory) : itemForm.sku
                      });
                    }}
                  >
                    <option value="Vaccines">Vaccines</option>
                    <option value="Antibiotics">Antibiotics</option>
                    <option value="Supplements">Supplements</option>
                    <option value="Anesthetics">Anesthetics</option>
                    <option value="Surgical">Surgical Supplies</option>
                    <option value="Diagnostics">Diagnostics</option>
                    <option value="Other">Other</option>
                  </select>
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
                    <option value="Units">Units</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Vials">Vials</option>
                    <option value="Pills">Pills</option>
                    <option value="Tablets">Tablets</option>
                    <option value="Capsules">Capsules</option>
                    <option value="Syringes">Syringes</option>
                    <option value="Ampoules">Ampoules</option>
                    <option value="Sachets">Sachets</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Quantity, Min Threshold, Cost Price, Sale Price */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Qty *</label>
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
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Min *</label>
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
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Cost (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="0.00"
                    value={itemForm.costPrice}
                    onChange={e => setItemForm({ ...itemForm, costPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Sale (KES) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20 text-sm"
                    placeholder="0.00"
                    value={itemForm.price}
                    onChange={e => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Price Modal */}
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

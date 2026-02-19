
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventoryStatus, Clinic, Supplier, BatchHistory } from '../types';
import { Search, Plus, Filter, Package, AlertTriangle, Archive, Trash2, Edit, X, Star, Building2, Mail, Phone, Users, Calendar, BarChart3, ChevronRight, History, RefreshCw } from 'lucide-react';
import { suppliersAPI, Supplier as APISupplier, toast } from '../services';
import { usePagination } from '../hooks/usePagination';
import Pagination from './Pagination';
import DateRangePicker, { DateRange } from './DateRangePicker';

// Helper function to safely convert rating to number
const getRatingAsNumber = (rating: any): number => {
  if (rating === null || rating === undefined) {
    return 0;
  }
  if (typeof rating === 'number') {
    return rating;
  }
  // Handle Prisma Decimal object
  if (typeof rating === 'object' && rating.toNumber) {
    return rating.toNumber();
  }
  const numRating = Number(rating);
  return isNaN(numRating) ? 0 : numRating;
};

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

const InventoryView: React.FC<InventoryViewProps> = ({ inventory, clinic, onUpdateStock, onUpdateItem, onAddItem, suppliers: propSuppliers, onTogglePreferredSupplier, onViewSupplier, refreshInventory }) => {
  const [activeViewTab, setActiveViewTab] = useState<'items' | 'suppliers'>('items');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryItem | null>(null);

  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Fetch suppliers from API
  const [suppliers, setSuppliers] = useState<APISupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

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

  // Extracted fetchSuppliers so it can be called from the refresh button
  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      // Check localStorage cache for suppliers
      const cachedSuppliers = localStorage.getItem('vethub-suppliers');
      const cacheTimestamp = localStorage.getItem('vethub-suppliers-timestamp');
      const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

      if (cachedSuppliers && cacheAge < CACHE_DURATION) {
        console.log('[InventoryView] Using cached suppliers');
        const suppliersList = JSON.parse(cachedSuppliers);
        setSuppliers(suppliersList);
        setLoadingSuppliers(false);
        return;
      }

      console.log('[InventoryView] Fetching suppliers from API...');
      const response = await suppliersAPI.getAll({ limit: 100 });
      const suppliersList = response.data.data || [];
      setSuppliers(suppliersList);

      // Cache suppliers in localStorage
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

  // Load suppliers only when the Suppliers tab is clicked
  useEffect(() => {
    if (activeViewTab === 'suppliers' && suppliers.length === 0) {
      console.log('[InventoryView] Suppliers tab clicked - loading suppliers...');
      fetchSuppliers();
    }
  }, [activeViewTab]);

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

  const filteredSuppliers = useMemo(() => {
    // Only apply search filter if query has 3 or more characters
    const effectiveSearch = searchQuery.length >= 3 ? searchQuery.toLowerCase() : '';

    console.log('[InventoryView] Filtering suppliers, total count:', suppliers.length);
    console.log('[InventoryView] Search query:', searchQuery);
    const filtered = suppliers.filter(s => {
      if (!effectiveSearch) return true;
      return s.name.toLowerCase().includes(effectiveSearch) ||
        (s.category && s.category.toLowerCase().includes(effectiveSearch));
    });
    console.log('[InventoryView] Filtered suppliers count:', filtered.length);
    return filtered;
  }, [suppliers, searchQuery]);

  // Pagination for inventory items
  const {
    paginatedItems: paginatedInventory,
    paginationMeta: inventoryPaginationMeta,
    handlePageChange: handleInventoryPageChange,
    handleLimitChange: handleInventoryLimitChange,
    resetPage: resetInventoryPage,
  } = usePagination(filteredInventory, 16);

  // Pagination for suppliers
  const {
    paginatedItems: paginatedSuppliers,
    paginationMeta: suppliersPaginationMeta,
    handlePageChange: handleSuppliersPageChange,
    handleLimitChange: handleSuppliersLimitChange,
    resetPage: resetSuppliersPage,
  } = usePagination(filteredSuppliers, 12);

  // Reset pagination when filters change
  useEffect(() => {
    resetInventoryPage();
  }, [searchQuery, activeCategory, statusFilter, resetInventoryPage]);

  useEffect(() => {
    resetSuppliersPage();
  }, [searchQuery, resetSuppliersPage]);

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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="space-y-4">
        {/* Header Title */}
        {/* <div>
            <h1 className="page-header">Stock Manager</h1>
            <p className="page-subheader mt-1">Manage medicines, batches, and suppliers</p>
        </div> */}
      </div>


      <div className="gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-sm">
         <button onClick={() => setActiveViewTab('items')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeViewTab === 'items' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}>Medicine Stock</button>
        <button onClick={() => setActiveViewTab('suppliers')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeViewTab === 'suppliers' ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md border border-slate-200 dark:border-zinc-700' : 'text-slate-400 hover:text-pine'}`}>Suppliers Hub</button>
      <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0 mt-5">
        {/* Left: Search + DatePicker */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
          {/* Search */}
          <div className="relative group flex-1 min-w-[250px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam transition-colors" />
            <input
              type="text"
              placeholder={activeViewTab === 'items' ? "Search stock (min 3 chars)..." : "Search suppliers (min 3 chars)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all font-bold shadow-sm"
            />
          </div>

          {/* DatePicker (conditional) */}
          {activeViewTab === 'items' && (
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="min-w-[220px]"
            />
          )}
        </div>

        {/* Right: Buttons */}
        <div className="flex gap-2 ml-auto">
          {/* Refresh Button */}
          <button
            onClick={() => activeViewTab === 'items' ? refreshInventory?.() : fetchSuppliers()}
            disabled={loadingSuppliers || (activeViewTab === 'items' && !refreshInventory)}
            className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 shadow-sm transition-all flex items-center gap-1.5 active:scale-95 hover:border-seafoam disabled:opacity-50 disabled:cursor-not-allowed p-2.5"
            title={activeViewTab === 'items' ? "Refresh inventory" : "Refresh suppliers"}
          >
            <RefreshCw size={14} className={loadingSuppliers ? 'animate-spin' : ''} />
          </button>

          {/* Add Medicine Button (conditional) */}
          {activeViewTab === 'items' && (
            <button
              onClick={openAddModal}
              className="compact-button bg-gradient-to-r from-pine to-seafoam text-white shadow-lg shadow-pine/30 hover:shadow-xl hover:shadow-pine/40 transition-all active:scale-95 px-5 py-2.5 font-black uppercase tracking-wider text-xs whitespace-nowrap"
            >
              <Plus size={14} className="inline mr-1" /> Add Item
            </button>
          )}
        </div>
        </div>

      </div>

      {activeViewTab === 'items' ? (
        <>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Low Stock', count: stats.lowStock, color: 'text-amber-500', bg: 'bg-amber-500/5', status: 'LOW_STOCK' as const, icon: <AlertTriangle size={12} /> },
              { label: 'Out of Stock', count: stats.outOfStock, color: 'text-red-500', bg: 'bg-red-500/5', status: 'OUT_OF_STOCK' as const, icon: <Trash2 size={12} /> },
            ].map(s => (
              <button key={s.label} onClick={() => setStatusFilter(statusFilter === s.status ? 'ALL' : s.status)} className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${statusFilter === s.status ? 'border-seafoam ' + s.bg : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm'}`}>
                <div className={`p-1.5 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</div>
                <div><p className={`text-lg font-black tracking-tight ${s.color}`}>{s.count}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p></div>
              </button>
            ))}
          </div>

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
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 animate-in slide-in-from-right-4">
            {loadingSuppliers ? (
              <div className="col-span-full flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">
                    🐾
                  </div>
                  <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading suppliers...</p>
                </div>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-20">
                <div className="text-center">
                  <Package className="mx-auto mb-4 text-slate-300" size={48} />
                  <p className="text-slate-400 font-bold">No suppliers found</p>
                </div>
              </div>
            ) : (
              paginatedSuppliers.map(supplier => {
                // Note: API suppliers don't have preferredByClinics field, so we'll hide the star button for now
                return (
                  <div key={supplier.id} className="compact-card">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-2xl shadow-inner aspect-square shrink-0">🏢</div>
                      {supplier.isActive && (
                        <div className="px-3 py-1 rounded-lg bg-green-500/10 text-green-500 text-[8px] font-black uppercase border border-green-500/20">
                          Active
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 mb-8">
                      <h3 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tight leading-tight uppercase">{supplier.name}</h3>
                      <p className="text-seafoam dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest">{supplier.category || 'General'}</p>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-slate-50 dark:border-zinc-800">
                      <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                        <Mail size={14} />
                        <span className="text-[11px] font-bold">{supplier.contactEmail || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                        <Phone size={14} />
                        <span className="text-[11px] font-bold">{supplier.contactPhone || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-between items-center">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-zinc-800 rounded-lg text-[9px] font-black uppercase text-pine dark:text-zinc-300">
                        ⭐ {getRatingAsNumber(supplier.rating).toFixed(1)} Rating
                      </div>
                      <button
                        onClick={() => onViewSupplier(Number(supplier.id))}
                        className="bg-seafoam text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                      >
                        View Supplier
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination for suppliers */}
          {!loadingSuppliers && filteredSuppliers.length > 0 && (
            <Pagination
              meta={suppliersPaginationMeta}
              onPageChange={handleSuppliersPageChange}
              onLimitChange={handleSuppliersLimitChange}
              showLimitSelector={true}
              limitOptions={[6, 12, 24, 48]}
            />
          )}
        </div>
      )}

      {/* Item Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-md z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-3xl w-full p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">{editingItem ? 'Update Stock' : 'Add Medicine'}</h2>
                <p className="text-seafoam text-[9px] font-black uppercase mt-1">Stock registry configuration</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-pine"><X size={24} /></button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Row 1: Name and Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Medicine Name *</label>
                  <input
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="e.g. Amoxicillin 500mg"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Category *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20"
                    value={itemForm.category}
                    onChange={e => {
                      const newCategory = e.target.value;
                      // Auto-generate SKU when category changes (only if SKU is empty or was auto-generated)
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1 flex items-center justify-between">
                    <span>SKU (Stock Keeping Unit) *</span>
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
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="e.g. VAC-123456"
                    value={itemForm.sku}
                    onChange={e => setItemForm({ ...itemForm, sku: e.target.value })}
                  />
                  <p className="text-[8px] text-slate-400 px-1">Unique identifier for this item (auto-generated or custom)</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Supplier</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20"
                    value={itemForm.supplierId || ''}
                    onChange={e => setItemForm({ ...itemForm, supplierId: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">Select Supplier (Optional)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3: Batch Number, Expiry Date, Unit Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Batch Number</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="e.g. BATCH-2024-001"
                    value={itemForm.batchNumber}
                    onChange={e => setItemForm({ ...itemForm, batchNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Expiry Date</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20"
                    value={itemForm.expiryDate}
                    onChange={e => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Unit Type *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold outline-none appearance-none focus:ring-2 focus:ring-seafoam/20"
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="0"
                    value={itemForm.quantity}
                    onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Min Threshold *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="5"
                    value={itemForm.minThreshold}
                    onChange={e => setItemForm({ ...itemForm, minThreshold: Number(e.target.value) })}
                  />
                  <p className="text-[8px] text-slate-400 px-1">Reorder level</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Cost Price (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="0.00"
                    value={itemForm.costPrice}
                    onChange={e => setItemForm({ ...itemForm, costPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Sale Price (KES) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="0.00"
                    value={itemForm.price}
                    onChange={e => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch History / Details Modal */}
      {selectedItemForDetails && (
        <div className="fixed inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-md z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-4xl w-full p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start mb-8 border-b border-slate-50 dark:border-zinc-800 pb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-seafoam text-white rounded-2xl shadow-lg"><Package size={28} /></div>
                <div>
                  <h2 className="text-3xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">{selectedItemForDetails.name}</h2>
                  <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">Stock SKU: #{selectedItemForDetails.sku} • {selectedItemForDetails.category}</p>
                </div>
              </div>
              <button onClick={() => setSelectedItemForDetails(null)} className="text-slate-400 hover:text-pine"><X size={32} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-10 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Availability</p>
                  <p className="text-3xl font-black text-pine dark:text-zinc-100 font-mono">{selectedItemForDetails.quantity} {selectedItemForDetails.unit}</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Batch</p>
                  <p className="text-2xl font-black text-pine dark:text-zinc-100">{selectedItemForDetails.batchNumber}</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Preferred Supplier</p>
                  <p className="text-base font-bold text-pine dark:text-zinc-300">{suppliers.find(s => s.id === selectedItemForDetails.supplierId)?.name || 'Direct'}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <History className="text-cyan" size={20} />
                  <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Batch Ledger</h3>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-inner">
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
                          <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400">{suppliers.find(s => s.id === bh.supplierId)?.name}</td>
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

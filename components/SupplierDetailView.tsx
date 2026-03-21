
import React, { useState, useMemo, useEffect } from 'react';
import { Clinic, Transaction, UserRole } from '../types';
import { Building2, MapPin, Mail, Phone, ShoppingCart, History, Info, ExternalLink, ChevronRight, Package, ArrowLeft, Star, Globe, Plus, Search, Tag, CheckCircle2, Clock, AlertCircle, RefreshCw, MoreVertical, Check, X, RotateCcw, GitBranch, ChevronDown, ToggleLeft, ToggleRight, Trash2, Filter, Edit2 } from 'lucide-react';
import { supplierProductsAPI, SupplierProduct, Supplier, purchaseOrderAPI, PurchaseOrder } from '../services';
import { toast } from '../services';
import { supplierBranchesAPI, SupplierBranch, CreateBranchData, UpdateBranchData } from '../services/modules/supplierBranches.api';
import { useAuth } from '../contexts/AuthContext';

const BRANCH_CURRENCIES = [
  { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British Pound' },
  { code: 'KES', name: 'Kenyan Shilling' }, { code: 'AED', name: 'UAE Dirham' }, { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' }, { code: 'JPY', name: 'Japanese Yen' }, { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' }, { code: 'INR', name: 'Indian Rupee' }, { code: 'ZAR', name: 'South African Rand' },
  { code: 'BRL', name: 'Brazilian Real' }, { code: 'MXN', name: 'Mexican Peso' }, { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'TZS', name: 'Tanzanian Shilling' }, { code: 'UGX', name: 'Ugandan Shilling' }, { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'ETB', name: 'Ethiopian Birr' }, { code: 'GHS', name: 'Ghanaian Cedi' },
];

interface BranchForm { name: string; city: string; country: string; address: string; phone: string; email: string; currency: string; }
const emptyBranchForm = (): BranchForm => ({ name: '', city: '', country: '', address: '', phone: '', email: '', currency: 'USD' });

interface Props {
  supplier: Supplier;
  clinic: Clinic;
  transactions: Transaction[];
  onBack: () => void;
  onAddToOrder?: (supplierId: string, product: SupplierProduct) => void;
}

// Parse Prisma Decimal object { s, e, d: [value] } or plain number
const parseDecimal = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object') {
    if (typeof val.toNumber === 'function') return val.toNumber();
    if (Array.isArray(val.d) && val.d.length > 0) return Number(val.d[0]) || 0;
  }
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

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

const SupplierDetailView: React.FC<Props> = ({ supplier, clinic, transactions, onBack, onAddToOrder }) => {
  const { user } = useAuth();
  const isSupplierAdmin = user?.role === UserRole.SUPPLIER || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.MERCHANT_ADMIN;

  const [activeTab, setActiveTab] = useState<'info' | 'catalog' | 'history' | 'orders' | 'branches'>('info');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);

  // Branch state
  const [branches, setBranches] = useState<SupplierBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<SupplierBranch | null>(null);
  const [branchForm, setBranchForm] = useState<BranchForm>(emptyBranchForm());
  const [savingBranch, setSavingBranch] = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [togglingBranchId, setTogglingBranchId] = useState<string | null>(null);

  const adminBranchHeaders = { headers: { 'X-Supplier-Id': String(supplier.id) } };

  const fulfilledTransactions = useMemo(() =>
    transactions.filter(tx => tx.toId === supplier.id && tx.status === 'SETTLED'),
    [transactions, supplier.id]
  );

  const activeOrders = useMemo(() =>
    transactions.filter(tx => tx.toId === supplier.id && tx.status === 'PENDING'),
    [transactions, supplier.id]
  );

  // Separate purchase orders by status — scoped to current clinic
  const completedPurchaseOrders = useMemo(() =>
    purchaseOrders.filter(po =>
      String(po.clinicId) === String(clinic.id) &&
      String(po.supplierId) === String(supplier.id) &&
      ['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(po.status)
    ),
    [purchaseOrders, clinic.id, supplier.id]
  );

  const activePurchaseOrders = useMemo(() =>
    purchaseOrders.filter(po =>
      String(po.clinicId) === String(clinic.id) &&
      String(po.supplierId) === String(supplier.id) &&
      ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status)
    ),
    [purchaseOrders, clinic.id, supplier.id]
  );

  // Clear stale POs and reload branches when supplier changes
  useEffect(() => {
    setPurchaseOrders([]);
    loadBranches();
  }, [supplier.id]);

  // Load tab-specific data on tab change or supplier/clinic change
  useEffect(() => {
    if (activeTab === 'catalog') {
      loadSupplierProducts(selectedBranchId);
    } else if (activeTab === 'history' || activeTab === 'orders') {
      loadPurchaseOrders(selectedBranchId);
    }
  }, [activeTab, supplier.id, clinic.id]);

  // Re-fetch orders or products when branch selection changes
  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'orders') {
      loadPurchaseOrders(selectedBranchId);
    } else if (activeTab === 'catalog') {
      loadSupplierProducts(selectedBranchId);
    }
  }, [selectedBranchId]);

  const loadSupplierProducts = async (branchId?: string) => {
    setLoadingProducts(true);
    try {
      const activeBranch = branchId ?? selectedBranchId;
      // Build filters — pass branchId as a search param if backend supports it
      const filters = activeBranch && activeBranch !== 'all'
        ? { limit: 200 } // branch filtering is done client-side below
        : { limit: 200 };
      const response = await supplierProductsAPI.getBySupplierId(Number(supplier.id), filters);
      const allProducts = response.data.data || [];
      // If a specific branch is selected and products have supplierId, show all
      // (products are supplier-wide; branch selection affects ordering, not catalog)
      setSupplierProducts(allProducts);
    } catch (error) {
      console.error('Failed to load supplier products:', error);
      setSupplierProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadPurchaseOrders = async (branchId?: string) => {
    setLoadingOrders(true);
    try {
      // Build branch filter: 'all' = no filter, '__main__' = null branch, else real branch ID
      const activeBranch = branchId ?? selectedBranchId;
      const branchFilter = activeBranch === 'all'
        ? undefined
        : activeBranch === '__main__' || (activeBranch && branches.find(b => b.id === activeBranch && (b as any).isMain))
          ? '__main__'
          : activeBranch;

      const response = await purchaseOrderAPI.getAll({
        supplierId: supplier.id.toString(),
        supplierBranchIds: branchFilter,
        limit: 100,
      }, {
        headers: { 'X-Clinic-Id': clinic.id },
        cache: false,
      } as any);
      setPurchaseOrders(response.data.data || []);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
      toast.error('Failed to load purchase orders');
      setPurchaseOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      // Clinic users use the public read-only endpoint; supplier admins use their scoped endpoint
      const res = isSupplierAdmin
        ? await supplierBranchesAPI.getMyBranches(adminBranchHeaders)
        : await supplierBranchesAPI.getBySupplierId(supplier.id);
      setBranches((res.data as any)?.branches || []);
    } catch { /* silently ignore — branches are optional context */ }
    finally { setLoadingBranches(false); }
  };

  const openAddBranch = () => { setEditingBranch(null); setBranchForm(emptyBranchForm()); setShowBranchModal(true); };
  const openEditBranch = (b: SupplierBranch) => {
    setEditingBranch(b);
    setBranchForm({ name: b.name, city: b.city || '', country: b.country || '', address: b.address || '', phone: b.phone || '', email: b.email || '', currency: b.currency || 'USD' });
    setShowBranchModal(true);
  };
  const closeBranchModal = () => { setShowBranchModal(false); setEditingBranch(null); setBranchForm(emptyBranchForm()); };

  const saveBranch = async () => {
    if (!branchForm.name.trim()) return toast.error('Branch name is required');
    setSavingBranch(true);
    try {
      if (editingBranch) {
        const payload: UpdateBranchData = { name: branchForm.name.trim(), city: branchForm.city || undefined, country: branchForm.country || undefined, address: branchForm.address || undefined, phone: branchForm.phone || undefined, email: branchForm.email || undefined, currency: branchForm.currency };
        await supplierBranchesAPI.update(Number(editingBranch.id), payload, adminBranchHeaders);
        toast.success('Branch updated');
      } else {
        const payload: CreateBranchData = { name: branchForm.name.trim(), city: branchForm.city || undefined, country: branchForm.country || undefined, address: branchForm.address || undefined, phone: branchForm.phone || undefined, email: branchForm.email || undefined, currency: branchForm.currency };
        await supplierBranchesAPI.create(payload, adminBranchHeaders);
        toast.success('Branch created');
      }
      closeBranchModal();
      await loadBranches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save branch');
    } finally { setSavingBranch(false); }
  };

  const deleteBranch = async (branch: SupplierBranch) => {
    setDeletingBranchId(branch.id);
    try {
      await supplierBranchesAPI.delete(Number(branch.id), adminBranchHeaders);
      setBranches(prev => prev.filter(b => b.id !== branch.id));
      toast.success('Branch deleted');
    } catch { toast.error('Failed to delete branch'); }
    finally { setDeletingBranchId(null); }
  };

  const toggleBranchActive = async (branch: SupplierBranch) => {
    setTogglingBranchId(branch.id);
    try {
      await supplierBranchesAPI.update(Number(branch.id), { isActive: !branch.isActive }, adminBranchHeaders);
      setBranches(prev => prev.map(b => b.id === branch.id ? { ...b, isActive: !b.isActive } : b));
    } catch { toast.error('Failed to toggle branch'); }
    finally { setTogglingBranchId(null); }
  };

  const handleApprove = async (orderId: string) => {
    try {
      await purchaseOrderAPI.approve(orderId);
      toast.success('Purchase order approved');
      loadPurchaseOrders(); // Refresh the list
      setOpenActionMenu(null);
    } catch (error: any) {
      console.error('Failed to approve order:', error);
      toast.error(error.message || 'Failed to approve purchase order');
    }
  };

  const handleMarkAsFulfilled = async (orderId: string) => {
    try {
      await purchaseOrderAPI.markAsReceived(orderId);
      toast.success('Purchase order marked as received');
      loadPurchaseOrders(); // Refresh the list
      setOpenActionMenu(null);
    } catch (error: any) {
      console.error('Failed to mark as received:', error);
      toast.error(error.message || 'Failed to update purchase order');
    }
  };

  const handleMarkAsCancelled = async (orderId: string) => {
    try {
      await purchaseOrderAPI.cancel(orderId);
      toast.success('Purchase order cancelled');
      loadPurchaseOrders(); // Refresh the list
      setOpenActionMenu(null);
    } catch (error: any) {
      console.error('Failed to cancel order:', error);
      toast.error(error.message || 'Failed to cancel purchase order');
    }
  };

  const handleRefreshOrders = () => {
    loadPurchaseOrders();
    toast.success('Purchase orders refreshed');
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set(supplierProducts.map(p => p.category).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [supplierProducts]);

  const filteredProducts = useMemo(() => {
    return supplierProducts.filter(p => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (availabilityFilter === 'available' && !p.isAvailable) return false;
      if (availabilityFilter === 'unavailable' && p.isAvailable) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q);
      }
      return true;
    });
  }, [supplierProducts, searchQuery, categoryFilter, availabilityFilter]);

  const renderInfo = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-4">
             <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <Info className="text-seafoam" size={16}/>
                <h3 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Company Info</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-4">
                   {[
                     { label: 'Name', val: supplier.name, icon: Building2 },
                     { label: 'Address', val: supplier.address || 'N/A', icon: MapPin },
                     { label: 'Category', val: supplier.category, icon: Package },
                   ].map(i => (
                     <div key={i.label} className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-xl text-slate-400 shrink-0"><i.icon size={14}/></div>
                        <div className="min-w-0">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                           <p className="text-pine dark:text-zinc-100 font-bold text-sm leading-tight truncate">{i.val}</p>
                        </div>
                     </div>
                   ))}
                </div>
                <div className="space-y-4">
                   {[
                     { label: 'Email', val: supplier.contactEmail || 'N/A', icon: Mail },
                     { label: 'Phone', val: supplier.contactPhone || 'N/A', icon: Phone },
                     { label: 'Website', val: 'www.vetmedglobal.com', icon: Globe },
                   ].map(i => (
                     <div key={i.label} className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-xl text-slate-400 shrink-0"><i.icon size={14}/></div>
                        <div className="min-w-0">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                           <p className="text-pine dark:text-zinc-100 font-bold text-sm leading-tight truncate">{i.val}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
       </div>

       <div className="space-y-4">
          <div className="bg-pine rounded-2xl p-4 text-white shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-1000"><Star size={64} /></div>
             <p className="text-mist/40 text-[9px] font-black uppercase tracking-[0.4em] mb-2">Supplier Rating</p>
             <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl font-black tracking-tighter">{getRatingAsNumber(supplier.rating).toFixed(1)}</span>
                <div className="flex gap-0.5 text-amber-400">
                   {[1,2,3,4,5].map(s => <Star key={s} size={14} fill={s <= Math.floor(getRatingAsNumber(supplier.rating)) ? "currentColor" : "none"}/>)}
                </div>
             </div>
             <p className="text-mist/60 text-[9px] font-bold uppercase tracking-widest">VetHub Trust Index</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
             <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Status</h4>
             <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                <span className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Active Partner</span>
             </div>
          </div>
       </div>
    </div>
  );

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const renderCatalog = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      {/* Branch selector */}
      {branches.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <GitBranch size={12} /> Order From Branch
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedBranchId('all')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                selectedBranchId === 'all'
                  ? 'bg-seafoam text-white border-seafoam shadow-md'
                  : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'
              }`}
            >
              All Branches
            </button>
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                  selectedBranchId === b.id
                    ? 'bg-seafoam text-white border-seafoam shadow-md'
                    : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'
                }`}
              >
                {b.name}
                {(b as any).isMain && <span className="text-[7px] opacity-70">(HQ)</span>}
                {!b.isActive && <span className="text-[7px] text-red-400">(inactive)</span>}
              </button>
            ))}
          </div>
          {selectedBranch && (
            <div className="mt-3 flex flex-wrap gap-4 text-[9px] text-slate-500 dark:text-zinc-400 font-semibold">
              {selectedBranch.phone && <span className="flex items-center gap-1"><Phone size={10}/>{selectedBranch.phone}</span>}
              {selectedBranch.email && <span className="flex items-center gap-1"><Mail size={10}/>{selectedBranch.email}</span>}
              {(selectedBranch.city || selectedBranch.country) && (
                <span className="flex items-center gap-1"><MapPin size={10}/>{[selectedBranch.city, selectedBranch.country].filter(Boolean).join(', ')}</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        {/* Header + search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Product Catalog</h3>
            <p className="text-seafoam text-[9px] font-black uppercase tracking-widest mt-0.5">
              {filteredProducts.length} of {supplierProducts.length} products
              {selectedBranchId !== 'all' && selectedBranch && ` · from ${selectedBranch.name}`}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam" size={14}/>
            <input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none text-pine dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Category + availability filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  categoryFilter === cat
                    ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-auto bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5">
            {(['all', 'available', 'unavailable'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setAvailabilityFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                  availabilityFilter === opt
                    ? 'bg-white dark:bg-zinc-700 text-pine dark:text-zinc-100 shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-seafoam"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="mx-auto mb-4 text-slate-400" size={64} />
            <p className="font-bold text-slate-400 text-lg">No products found</p>
            <p className="text-sm text-slate-400 mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map(p => (
              <div key={p.id} className={`bg-slate-50 dark:bg-zinc-950 border rounded-2xl p-4 hover:border-seafoam transition-all group shadow-inner ${
                p.isAvailable ? 'border-slate-100 dark:border-zinc-800' : 'border-red-100 dark:border-red-900/30 opacity-70'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm text-seafoam"><Package size={24}/></div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-white dark:bg-zinc-800 text-pine dark:text-zinc-400 px-3 py-1 rounded-lg text-[8px] font-black uppercase border border-slate-100 dark:border-zinc-700">{p.category}</span>
                    {!p.isAvailable && <span className="text-[8px] font-black text-red-400 uppercase">Out of stock</span>}
                  </div>
                </div>
                <h4 className="text-lg font-black text-pine dark:text-zinc-100 uppercase leading-tight mb-2 truncate">{p.name}</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono mb-4">SKU: {p.sku}</p>
                <div className="flex justify-between items-baseline mb-6">
                  <p className="text-2xl font-black font-mono text-emerald-600 tracking-tighter">KES {Number(p.unitPrice).toLocaleString()}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase">per {p.unit}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <span>Min Order:</span>
                    <span className="text-pine dark:text-zinc-100">{p.minOrderQty} {p.unit}</span>
                  </div>
                  {p.stockQty !== undefined && (
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <span>In Stock:</span>
                      <span className={p.stockQty > 0 ? 'text-emerald-600' : 'text-red-400'}>{p.stockQty} {p.unit}</span>
                    </div>
                  )}
                  {p.isAvailable && (
                    <button
                      onClick={() => onAddToOrder?.(supplier.id, p)}
                      className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-3 hover:opacity-90"
                    >
                      <ShoppingCart size={14}/> Add to Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Compact header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 transition-all shrink-0">
          <ArrowLeft size={18}/>
        </button>
        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-base shrink-0">🏢</div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest truncate">{supplier.name}</h1>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">SP-{supplier.id}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
        {[
          { id: 'info', label: 'Info', icon: Building2 },
          { id: 'catalog', label: 'Catalog', icon: ShoppingCart },
          { id: 'branches', label: 'Branches', icon: GitBranch },
          { id: 'history', label: 'History', icon: History },
          { id: 'orders', label: 'Orders', icon: Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow'
                : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
            }`}
          >
            <tab.icon size={11} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[50vh]">
         {activeTab === 'info' && renderInfo()}
         {activeTab === 'catalog' && renderCatalog()}
         {activeTab === 'branches' && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
             {/* Header */}
             <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
               <div>
                 <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Branches</h3>
                 <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-semibold">{branches.length} branch{branches.length !== 1 ? 'es' : ''} · {branches.filter(b => b.isActive).length} active</p>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={loadBranches} disabled={loadingBranches} className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
                   <RefreshCw size={14} className={`text-slate-500 dark:text-zinc-400 ${loadingBranches ? 'animate-spin' : ''}`} />
                 </button>
                 {isSupplierAdmin && (
                   <button onClick={openAddBranch} className="flex items-center gap-2 px-4 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-sm">
                     <Plus size={14} /> Add Branch
                   </button>
                 )}
               </div>
             </div>
             {/* Branch Cards */}
             {loadingBranches ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {[1,2,3].map(i => <div key={i} className="h-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />)}
               </div>
             ) : branches.length === 0 ? (
               <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-16 text-center shadow-sm">
                 <GitBranch size={36} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
                 <p className="text-sm font-bold text-slate-500 dark:text-zinc-400 mb-4">No branches yet</p>
                 {isSupplierAdmin && (
                   <button onClick={openAddBranch} className="px-5 py-2.5 bg-pine text-white rounded-xl font-black text-xs uppercase hover:opacity-90 transition-all">Add First Branch</button>
                 )}
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {branches.map(branch => (
                   <div key={branch.id} className={`bg-white dark:bg-zinc-900 border-2 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${branch.isActive ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-100 dark:border-zinc-800/50 opacity-70'}`}>
                     <div className="flex items-start justify-between mb-3">
                       <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center">
                         <Building2 size={18} className="text-seafoam" />
                       </div>
                       {isSupplierAdmin && (
                       <div className="flex items-center gap-1">
                         <button onClick={() => openEditBranch(branch)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-all"><Edit2 size={13} /></button>
                         <button onClick={() => deleteBranch(branch)} disabled={deletingBranchId === branch.id} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                           {deletingBranchId === branch.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                         </button>
                       </div>
                     )}
                     </div>
                     <h4 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-tight truncate">{branch.name}</h4>
                     <div className="mt-2 space-y-1">
                       {(branch.city || branch.country) && (
                         <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                           <MapPin size={10} /><span className="font-semibold truncate">{[branch.city, branch.country].filter(Boolean).join(', ')}</span>
                         </div>
                       )}
                       {branch.phone && <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400"><Phone size={10} /><span className="font-semibold">{branch.phone}</span></div>}
                       {branch.email && <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400"><Mail size={10} /><span className="font-semibold truncate">{branch.email}</span></div>}
                     </div>
                     <div className="mt-4 flex items-center justify-between">
                       <div className="flex items-center gap-1.5">
                         <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${branch.isActive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>{branch.isActive ? 'Active' : 'Inactive'}</span>
                         <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-seafoam/10 text-seafoam">{branch.currency || 'USD'}</span>
                       </div>
                       {isSupplierAdmin && (
                         <button onClick={() => toggleBranchActive(branch)} disabled={togglingBranchId === branch.id} className="transition-all">
                           {togglingBranchId === branch.id ? <RefreshCw size={16} className="animate-spin text-slate-400" /> : branch.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-slate-400 dark:text-zinc-600" />}
                         </button>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             )}
             {/* Branch Add/Edit Modal */}
             {showBranchModal && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                 <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeBranchModal} />
                 <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                   <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-zinc-800">
                     <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">{editingBranch ? 'Edit Branch' : 'Add Branch'}</h2>
                     <button onClick={closeBranchModal} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={16} className="text-slate-500" /></button>
                   </div>
                   <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
                     {[
                       { field: 'name', label: 'Branch Name *', placeholder: 'e.g. Nairobi CBD Branch' },
                       { field: 'city', label: 'City', placeholder: 'e.g. Nairobi' },
                       { field: 'country', label: 'Country', placeholder: 'e.g. Kenya' },
                       { field: 'address', label: 'Address', placeholder: 'Street address...' },
                       { field: 'phone', label: 'Phone', placeholder: '+254 700 000 000' },
                       { field: 'email', label: 'Email', placeholder: 'branch@supplier.com' },
                     ].map(({ field, label, placeholder }) => (
                       <div key={field}>
                         <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">{label}</label>
                         <input
                           type={field === 'email' ? 'email' : 'text'}
                           value={(branchForm as any)[field]}
                           onChange={e => setBranchForm(f => ({ ...f, [field]: e.target.value }))}
                           placeholder={placeholder}
                           className="w-full px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
                         />
                       </div>
                     ))}
                     <div>
                       <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Currency</label>
                       <div className="relative">
                         <select value={branchForm.currency} onChange={e => setBranchForm(f => ({ ...f, currency: e.target.value }))}
                           className="w-full appearance-none px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-8"
                         >
                           {BRANCH_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                         </select>
                         <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                       </div>
                     </div>
                   </div>
                   <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
                     <button onClick={closeBranchModal} disabled={savingBranch} className="px-5 py-2.5 text-xs font-black uppercase text-slate-500 hover:text-pine rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                     <button onClick={saveBranch} disabled={savingBranch} className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase hover:opacity-90 transition-all disabled:opacity-60">
                       {savingBranch ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                       {editingBranch ? 'Update' : 'Create'}
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}
         
         {activeTab === 'history' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
            {/* Branch filter for history */}
            {branches.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-2"><GitBranch size={11}/>Branch</span>
                <button onClick={() => setSelectedBranchId('all')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${selectedBranchId === 'all' ? 'bg-seafoam text-white border-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'}`}>All</button>
                {branches.map(b => (
                  <button key={b.id} onClick={() => setSelectedBranchId(b.id)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${selectedBranchId === b.id ? 'bg-seafoam text-white border-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'}`}>
                    {b.name}{(b as any).isMain ? ' (HQ)' : ''}
                  </button>
                ))}
              </div>
            )}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-visible shadow-xl">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                   <div>
                     <h3 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Procurement History</h3>
                     {selectedBranchId !== 'all' && <p className="text-[9px] text-seafoam font-black uppercase tracking-widest mt-0.5">{branches.find(b => b.id === selectedBranchId)?.name || 'Selected Branch'}</p>}
                   </div>
                   <button
                     onClick={handleRefreshOrders}
                     disabled={loadingOrders}
                     className="flex items-center gap-2 px-4 py-2 bg-seafoam hover:bg-seafoam/90 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                   >
                     <RefreshCw size={12} className={loadingOrders ? 'animate-spin' : ''} />
                     Refresh
                   </button>
                </div>
                {loadingOrders ? (
                  <div className="py-20 text-center">
                    <RefreshCw size={32} className="animate-spin mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
                  </div>
                ) : completedPurchaseOrders.length === 0 ? (
                  <div className="py-20 text-center opacity-20">
                    <History size={32} className="mx-auto mb-3" />
                    <p className="font-black uppercase tracking-[0.4em] text-sm">No Completed Orders</p>
                  </div>
                ) : (
                  <div className="p-4 grid gap-3">
                    {completedPurchaseOrders.map(po => (
                      <div key={po.id} className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700 rounded-2xl p-4 flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-sm">
                          <Package size={16} className="text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{po.orderNumber}</span>
                            <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                              po.status === 'COMPLETED' || po.status === 'RECEIVED' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                              po.status === 'CANCELLED' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                              'bg-slate-100 dark:bg-zinc-700 text-slate-500'
                            }`}>{po.status}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{po._count?.items || 0} items</span>
                            <span className="text-[9px] text-slate-300 dark:text-zinc-600">·</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(po.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-black text-emerald-600 text-sm">KES {parseDecimal(po.totalAmount).toLocaleString()}</p>
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setOpenActionMenu(openActionMenu === po.id ? null : po.id)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-all"
                          >
                            <MoreVertical size={15} className="text-slate-400" />
                          </button>
                          {openActionMenu === po.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenActionMenu(null)} />
                              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 min-w-[180px] overflow-hidden">
                                {po.status === 'SUBMITTED' && (
                                  <button onClick={() => handleApprove(po.id)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 flex items-center gap-2 transition-all">
                                    <CheckCircle2 size={14} /> Approve Order
                                  </button>
                                )}
                                {(po.status === 'APPROVED' || po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                                  <button onClick={() => handleMarkAsFulfilled(po.id)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 flex items-center gap-2 transition-all">
                                    <Check size={14} /> Mark as Received
                                  </button>
                                )}
                                {po.status !== 'CANCELLED' && po.status !== 'COMPLETED' && po.status !== 'RECEIVED' && (
                                  <button onClick={() => handleMarkAsCancelled(po.id)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2 transition-all">
                                    <X size={14} /> Mark as Cancelled
                                  </button>
                                )}
                                <button onClick={() => setOpenActionMenu(null)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-400 flex items-center gap-2 transition-all border-t border-slate-100 dark:border-zinc-700">
                                  Close
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            </div>
         )}

         {activeTab === 'orders' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
            {/* Branch filter for orders */}
            {branches.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-2"><GitBranch size={11}/>Branch</span>
                <button onClick={() => setSelectedBranchId('all')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${selectedBranchId === 'all' ? 'bg-seafoam text-white border-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'}`}>All</button>
                {branches.map(b => (
                  <button key={b.id} onClick={() => setSelectedBranchId(b.id)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${selectedBranchId === b.id ? 'bg-seafoam text-white border-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'}`}>
                    {b.name}{(b as any).isMain ? ' (HQ)' : ''}
                  </button>
                ))}
              </div>
            )}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-visible shadow-xl">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                   <div>
                     <h3 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Current Orders</h3>
                     {selectedBranchId !== 'all' && <p className="text-[9px] text-seafoam font-black uppercase tracking-widest mt-0.5">{branches.find(b => b.id === selectedBranchId)?.name || 'Selected Branch'}</p>}
                   </div>
                   <button
                     onClick={handleRefreshOrders}
                     disabled={loadingOrders}
                     className="flex items-center gap-2 px-4 py-2 bg-seafoam hover:bg-seafoam/90 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                   >
                     <RefreshCw size={12} className={loadingOrders ? 'animate-spin' : ''} />
                     Refresh
                   </button>
                </div>
                {loadingOrders ? (
                  <div className="py-20 text-center">
                    <RefreshCw size={32} className="animate-spin mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading...</p>
                  </div>
                ) : activePurchaseOrders.length === 0 ? (
                  <div className="py-20 text-center opacity-20">
                    <ShoppingCart size={32} className="mx-auto mb-3" />
                    <p className="font-black uppercase tracking-[0.4em] text-sm">No Active Orders</p>
                  </div>
                ) : (
                  <div className="p-4 grid gap-3">
                    {activePurchaseOrders.map(po => (
                      <div key={po.id} className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700 rounded-2xl p-4 flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-sm">
                          <ShoppingCart size={16} className="text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{po.orderNumber}</span>
                            <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                              po.status === 'APPROVED' || po.status === 'ORDERED' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                              po.status === 'PARTIALLY_RECEIVED' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                              po.status === 'SUBMITTED' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                              'bg-slate-100 dark:bg-zinc-700 text-slate-500'
                            }`}>
                              {po.status === 'PARTIALLY_RECEIVED' && <Clock size={10}/>}
                              {po.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{po._count?.items || 0} items</span>
                            <span className="text-[9px] text-slate-300 dark:text-zinc-600">·</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Expected: {po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : 'TBD'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-black text-pine dark:text-zinc-100 text-sm">KES {parseDecimal(po.totalAmount).toLocaleString()}</p>
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setOpenActionMenu(openActionMenu === po.id ? null : po.id)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-all"
                          >
                            <MoreVertical size={15} className="text-slate-400" />
                          </button>
                          {openActionMenu === po.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenActionMenu(null)} />
                              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 min-w-[180px] overflow-hidden">
                                {po.status === 'SUBMITTED' && (
                                  <button onClick={() => handleApprove(po.id)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 flex items-center gap-2 transition-all">
                                    <CheckCircle2 size={14} /> Approve Order
                                  </button>
                                )}
                                {(po.status === 'APPROVED' || po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                                  <button onClick={() => handleMarkAsFulfilled(po.id)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 flex items-center gap-2 transition-all">
                                    <Check size={14} /> Mark as Received
                                  </button>
                                )}
                                {po.status !== 'CANCELLED' && po.status !== 'COMPLETED' && po.status !== 'RECEIVED' && (
                                  <button onClick={() => handleMarkAsCancelled(po.id)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2 transition-all">
                                    <X size={14} /> Mark as Cancelled
                                  </button>
                                )}
                                <button onClick={() => setOpenActionMenu(null)} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-400 flex items-center gap-2 transition-all border-t border-slate-100 dark:border-zinc-700">
                                  Close
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default SupplierDetailView;

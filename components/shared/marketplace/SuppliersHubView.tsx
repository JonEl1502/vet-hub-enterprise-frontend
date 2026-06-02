import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Building2, Mail, Phone, MapPin, Star,
  Package, TrendingUp, ChevronRight, Filter, Grid, List,
  BarChart3, ShoppingCart, Clock, Globe, Edit, Trash2, X, Eye, EyeOff, RefreshCw, TrendingDown
} from 'lucide-react';
import { suppliersAPI, supplierProductsAPI, Supplier, SupplierProduct, CreateSupplierData, dialog } from '../../../services';
import EntityScopeDropdown, { ScopeItem } from '../common/EntityScopeDropdown';
import { Truck } from 'lucide-react';
import { CacheInvalidators } from '../../../services/utils/cache';
import { toast } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { UserRole } from '../../../types';
import StatusToggle from '../common/StatusToggle';

interface Props {
  onViewSupplier: (supplierId: number) => void;
}

const SuppliersHubView: React.FC<Props> = ({ onViewSupplier }) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<Record<string, SupplierProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    password: '',
  });

  const isAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.MERCHANT_ADMIN;

  // Helper function to safely format rating value
  const formatRating = (rating: any): string => {
    if (rating === null || rating === undefined) {
      return 'N/A';
    }
    // Handle if rating is a number
    if (typeof rating === 'number') {
      return rating.toFixed(1);
    }
    // Handle if rating is a Prisma Decimal object (fallback)
    if (typeof rating === 'object' && rating.toNumber) {
      return rating.toNumber().toFixed(1);
    }
    // Try to convert to number
    const numRating = Number(rating);
    if (!isNaN(numRating)) {
      return numRating.toFixed(1);
    }
    return 'N/A';
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async (force = false) => {
    try {
      setLoading(true);

      if (!force) {
        // Check localStorage cache for suppliers
        const cachedSuppliers = localStorage.getItem('vethub-suppliers');
        const cacheTimestamp = localStorage.getItem('vethub-suppliers-timestamp');
        const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        if (cachedSuppliers && cacheAge < CACHE_DURATION) {
          console.log('[SuppliersHubView] Using cached suppliers');
          const suppliersList = JSON.parse(cachedSuppliers);
          setSuppliers(suppliersList);
          setLoading(false);
          return;
        }
      }

      const response = await suppliersAPI.getAll();
      // Backend returns paginated response: { data: { data: [...], meta: {...} } }
      const suppliersList = response.data.data || [];
      setSuppliers(suppliersList);

      // Cache suppliers in localStorage
      localStorage.setItem('vethub-suppliers', JSON.stringify(suppliersList));
      localStorage.setItem('vethub-suppliers-timestamp', Date.now().toString());

      // DO NOT fetch products here - only fetch when user views supplier details
      // Products will be fetched on-demand when needed
    } catch (error: any) {
      console.error('Failed to load suppliers:', error);
      toast.error(error.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch products for a specific supplier with caching
  const fetchSupplierProducts = async (supplierId: string) => {
    // Check if already loaded
    if (supplierProducts[supplierId]) {
      return;
    }

    // Check localStorage cache
    const cacheKey = `vethub-supplier-products-${supplierId}`;
    const cachedProducts = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`);
    const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (cachedProducts && cacheAge < CACHE_DURATION) {
      console.log(`[SuppliersHubView] Using cached products for supplier ${supplierId}`);
      setSupplierProducts(prev => ({
        ...prev,
        [supplierId]: JSON.parse(cachedProducts)
      }));
      return;
    }

    try {
      const productsRes = await supplierProductsAPI.getBySupplierId(Number(supplierId), { limit: 20 });
      const products = productsRes.data.data || [];

      // Update state
      setSupplierProducts(prev => ({
        ...prev,
        [supplierId]: products
      }));

      // Cache in localStorage
      localStorage.setItem(cacheKey, JSON.stringify(products));
      localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
    } catch (error) {
      console.error(`Failed to load products for supplier ${supplierId}:`, error);
      setSupplierProducts(prev => ({
        ...prev,
        [supplierId]: []
      }));
    }
  };

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    // Only apply search filter if query has 3 or more characters
    const effectiveSearch = searchQuery.length >= 3 ? searchQuery.toLowerCase() : '';

    return suppliers
      .filter(s => categoryFilter === 'ALL' || s.category === categoryFilter)
      .filter(s => {
        if (!effectiveSearch) return true;
        return s.name.toLowerCase().includes(effectiveSearch) ||
          (s.contactEmail && s.contactEmail.toLowerCase().includes(effectiveSearch)) ||
          (s.category && s.category.toLowerCase().includes(effectiveSearch));
      });
  }, [suppliers, categoryFilter, searchQuery]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(suppliers.map(s => s.category).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [suppliers]);

  // Calculate supplier stats
  const getSupplierStats = (supplierId: string) => {
    const products = supplierProducts[supplierId] || [];
    return {
      totalProducts: products.length,
      avgPrice: products.length > 0
        ? products.reduce((sum, p) => sum + p.unitPrice, 0) / products.length
        : 0,
      categories: new Set(products.map(p => p.category)).size,
    };
  };

  // Find common products across suppliers for comparison
  const getCommonProducts = () => {
    if (selectedSuppliers.length < 2) return [];

    const allProducts = selectedSuppliers.map(id => supplierProducts[id] || []);
    const productNames = new Set(allProducts[0].map(p => p.name));

    const common: Array<{
      name: string;
      prices: Array<{ supplierId: string; supplierName: string; price: number; sku: string }>;
    }> = [];

    productNames.forEach(name => {
      const prices = selectedSuppliers
        .map(supplierId => {
          const product = (supplierProducts[supplierId] || []).find(p => p.name === name);
          const supplier = suppliers.find(s => s.id === supplierId);
          return product && supplier
            ? { supplierId, supplierName: supplier.name, price: product.unitPrice, sku: product.sku }
            : null;
        })
        .filter(Boolean) as Array<{ supplierId: string; supplierName: string; price: number; sku: string }>;

      if (prices.length >= 2) {
        common.push({ name, prices });
      }
    });

    return common;
  };

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSuppliers(prev => {
      const newSelection = prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId];

      // Fetch products for newly selected supplier
      if (!prev.includes(supplierId)) {
        fetchSupplierProducts(supplierId);
      }

      return newSelection;
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      email: '',
      phone: '',
      address: '',
      country: '',
      password: '',
    });
    setEditingSupplier(null);
    setShowPassword(false);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      category: supplier.category || '',
      email: supplier.contactEmail || '',
      phone: supplier.contactPhone || '',
      address: supplier.address || '',
      country: '', // Not stored in backend
      password: '', // Don't populate password for editing
    });
    setEditingSupplier(supplier);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingSupplier) {
        // Update existing supplier
        const updateData: any = {
          name: formData.name,
          category: formData.category || undefined,
          contactEmail: formData.email || undefined,
          contactPhone: formData.phone || undefined,
          address: formData.address || undefined,
        };

        await suppliersAPI.update(Number(editingSupplier.id), updateData);
        CacheInvalidators.invalidateSuppliers(editingSupplier.id);
        toast.success('Supplier updated successfully');
      } else {
        // Create new supplier with user account
        const createData: CreateSupplierData = {
          name: formData.name,
          category: formData.category,
          contactEmail: formData.email,
          contactPhone: formData.phone || undefined,
          address: formData.address || undefined,
          isActive: true,
        };

        // Add user credentials if password is provided (for creating user account)
        if (formData.password) {
          createData.userEmail = formData.email;
          createData.userPassword = formData.password;
          createData.userName = formData.name;
        }

        await suppliersAPI.create(createData);
        CacheInvalidators.invalidateSuppliers();
        toast.success('Supplier created successfully');
      }

      handleCloseModal();
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${editingSupplier ? 'update' : 'create'} supplier`);
    }
  };

  const handleDelete = async (supplierId: string, supplierName: string) => {
    const ok = await dialog.confirmDelete({
      title: 'Delete Supplier',
      message: 'This will permanently remove the supplier and disassociate them from all related records. This action cannot be undone.',
      entityName: supplierName,
    });
    if (!ok) return;

    try {
      await suppliersAPI.delete(Number(supplierId));
      CacheInvalidators.invalidateSuppliers(supplierId);
      toast.success('Supplier deleted successfully');
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete supplier');
    }
  };

  const toggleStatus = async (supplier: Supplier, next: boolean) => {
    try {
      await suppliersAPI.update(Number(supplier.id), { isActive: next } as any);
      CacheInvalidators.invalidateSuppliers(supplier.id);
      toast.success(next ? 'Supplier activated' : 'Supplier deactivated');
      fetchSuppliers(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update supplier status');
    }
  };

  // Debug logging
  console.log('SuppliersHubView render:', {
    suppliersCount: suppliers.length,
    filteredCount: filteredSuppliers.length,
    productsLoaded: Object.keys(supplierProducts).length
  });

  // Scope dropdown items — derived from the loaded suppliers list. Pick
  // one and the whole app re-scopes (X-Supplier-Ids header) to that
  // supplier; pick "All" to clear the scope.
  const scopeItems: ScopeItem[] = useMemo(
    () => suppliers.map(s => ({
      id: String(s.id),
      name: s.name,
      subtitle: [s.category, s.contactEmail].filter(Boolean).join(' · ') || undefined,
    })),
    [suppliers],
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* Scope dropdown — hides when only one supplier exists */}
      {suppliers.length > 1 && (
        <EntityScopeDropdown
          label="Supplier"
          items={scopeItems}
          loading={loading}
          storageKey="selectedSupplierIds"
          icon={<Truck size={12} className="text-seafoam shrink-0" />}
          className="max-w-md"
        />
      )}

      {/* Filters Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
        {/* Row 1 — Search (full width) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam" size={15}/>
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
          />
        </div>

        {/* Row 2 — Actions */}
        <div className="flex items-center gap-2 flex-nowrap">
          {isAdmin && (
            <button onClick={handleOpenCreateModal} className="shrink-0 bg-pine dark:bg-zinc-100 text-white dark:text-pine px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap">
              <Plus size={14} /><span className="hidden sm:inline">New Supplier</span><span className="sm:hidden">New</span>
            </button>
          )}
          {selectedSuppliers.length >= 2 && (
            <button onClick={() => setShowComparison(!showComparison)} className="shrink-0 bg-seafoam text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap">
              <BarChart3 size={14} /><span className="hidden sm:inline">{showComparison ? 'Hide' : 'Compare'}</span> ({selectedSuppliers.length})
            </button>
          )}
          {/* View switch — commented out
          <div className="flex gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shrink-0">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine' : 'text-slate-400 hover:text-pine'}`}><Grid size={14} /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine' : 'text-slate-400 hover:text-pine'}`}><List size={14} /></button>
          </div>
          */}
        </div>

        {/* Row 3 — Categories (scrollable) + Reload on the right */}
        <div className="flex items-center gap-2 flex-nowrap">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1 min-w-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  categoryFilter === cat
                    ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                    : 'bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button onClick={() => fetchSuppliers(true)} disabled={loading} className="shrink-0 p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-pine dark:text-zinc-100 hover:border-seafoam transition-all disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Loading State - appears below search */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20 animate-pulse">
              🐾
            </div>
            <p className="text-[#438883] dark:text-zinc-400 font-bold text-sm">Loading suppliers...</p>
          </div>
        </div>
      ) : (
        <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Suppliers', value: suppliers.length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/5' },
          { label: 'Active', value: suppliers.filter(s => s.isActive).length, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/5' },
          { label: 'Products', value: Object.values(supplierProducts).flat().length, icon: Package, color: 'text-purple-500', bg: 'bg-purple-500/5' },
          { label: 'Categories', value: categories.length - 1, icon: Filter, color: 'text-amber-500', bg: 'bg-amber-500/5' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${stat.bg}`}>
                <stat.icon className={stat.color} size={16} />
              </div>
              <div>
                <p className="text-xl font-black text-pine dark:text-zinc-100">{stat.value}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Price Comparison View */}
      {showComparison && selectedSuppliers.length >= 2 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Price Comparison</h2>
            <button
              onClick={() => {
                setSelectedSuppliers([]);
                setShowComparison(false);
              }}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear Selection
            </button>
          </div>
          <div className="space-y-4">
            {getCommonProducts().map((product, idx) => {
              const minPrice = Math.min(...product.prices.map(p => p.price));
              const maxPrice = Math.max(...product.prices.map(p => p.price));
              const savings = maxPrice - minPrice;
              const savingsPercent = ((savings / maxPrice) * 100).toFixed(1);

              return (
                <div key={idx} className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-pine dark:text-zinc-100">{product.name}</h3>
                      {savings > 0 && (
                        <p className="text-sm text-green-500 font-bold mt-1">
                          Save up to KES {savings.toLocaleString()} ({savingsPercent}%)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {product.prices.map((price, pidx) => (
                      <div
                        key={pidx}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          price.price === minPrice
                            ? 'border-green-500 bg-green-500/5'
                            : 'border-slate-200 dark:border-zinc-800'
                        }`}
                      >
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                          {price.supplierName}
                        </p>
                        <p className="text-2xl font-black text-pine dark:text-zinc-100 mb-1">
                          KES {price.price.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">{price.sku}</p>
                        {price.price === minPrice && (
                          <div className="mt-2 flex items-center gap-1 text-green-500">
                            <TrendingDown size={14} />
                            <span className="text-xs font-bold">Best Price</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {getCommonProducts().length === 0 && (
              <p className="text-center text-slate-400 py-8">
                No common products found between selected suppliers
              </p>
            )}
          </div>
        </div>
      )}

      {/* Suppliers Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => {
            const stats = getSupplierStats(supplier.id);
            const isSelected = selectedSuppliers.includes(supplier.id);

            return (
              <div
                key={supplier.id}
                className={`bg-white dark:bg-zinc-900 border-2 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer group relative ${
                  isSelected
                    ? 'border-seafoam'
                    : 'border-slate-200 dark:border-zinc-800'
                }`}
                onMouseEnter={() => fetchSupplierProducts(supplier.id)}
              >
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <span onClick={(e) => e.stopPropagation()}>
                        <StatusToggle
                          isActive={supplier.isActive !== false}
                          entityName={supplier.name}
                          entityKind="supplier"
                          onToggle={(next) => toggleStatus(supplier, next)}
                        />
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(supplier);
                        }}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-all"
                        title="Edit Supplier"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(supplier.id, supplier.name);
                        }}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                        title="Delete Supplier"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSupplierSelection(supplier.id)}
                    className="w-5 h-5 rounded border-2 border-slate-300 dark:border-zinc-700 checked:bg-seafoam checked:border-seafoam cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div onClick={() => onViewSupplier(Number(supplier.id))}>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-2xl">
                      <Building2 className="text-seafoam" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-lg text-pine dark:text-zinc-100 mb-1 group-hover:text-seafoam transition-colors">
                        {supplier.name}
                      </h3>
                      <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-slate-600 dark:text-zinc-300">
                        {supplier.category}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    {supplier.contactEmail && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                        <Mail size={14} />
                        <span className="truncate">{supplier.contactEmail}</span>
                      </div>
                    )}
                    {supplier.contactPhone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                        <Phone size={14} />
                        <span>{supplier.contactPhone}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                        <MapPin size={14} />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                    <div>
                      <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Products</p>
                      <p className="text-lg font-black text-pine dark:text-zinc-100">{stats.totalProducts}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Avg Price</p>
                      <p className="text-lg font-black text-pine dark:text-zinc-100">
                        {stats.avgPrice > 0 ? `${stats.avgPrice.toFixed(0)}` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Rating</p>
                      <div className="flex items-center gap-1">
                        <Star className="text-amber-400" size={16} fill="currentColor" />
                        <p className="text-lg font-black text-pine dark:text-zinc-100">
                          {formatRating(supplier.rating)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSuppliers(filteredSuppliers.map(s => s.id));
                      } else {
                        setSelectedSuppliers([]);
                      }
                    }}
                    className="w-5 h-5 rounded border-2 border-slate-300 dark:border-zinc-700 checked:bg-seafoam checked:border-seafoam cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Products</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Rating</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredSuppliers.map((supplier) => {
                const stats = getSupplierStats(supplier.id);
                const isSelected = selectedSuppliers.includes(supplier.id);

                return (
                  <tr
                    key={supplier.id}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                    onMouseEnter={() => fetchSupplierProducts(supplier.id)}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSupplierSelection(supplier.id)}
                        className="w-5 h-5 rounded border-2 border-slate-300 dark:border-zinc-700 checked:bg-seafoam checked:border-seafoam cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-pine dark:text-zinc-100">{supplier.name}</p>
                      {supplier.address && (
                        <p className="text-xs text-slate-400 truncate max-w-xs">{supplier.address}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-slate-600 dark:text-zinc-300">
                        {supplier.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {supplier.contactEmail && (
                        <p className="text-sm text-slate-600 dark:text-zinc-400">{supplier.contactEmail}</p>
                      )}
                      {supplier.contactPhone && (
                        <p className="text-xs text-slate-400">{supplier.contactPhone}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-pine dark:text-zinc-100">
                      {stats.totalProducts}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Star className="text-amber-400" size={14} fill="currentColor" />
                        <span className="font-bold text-pine dark:text-zinc-100">
                          {formatRating(supplier.rating)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewSupplier(Number(supplier.id))}
                          className="flex items-center gap-2 px-4 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-xs font-bold hover:shadow-lg transition-all"
                        >
                          View Details
                          <ChevronRight size={14} />
                        </button>
                        {isAdmin && (
                          <>
                            <StatusToggle
                              isActive={supplier.isActive !== false}
                              entityName={supplier.name}
                              entityKind="supplier"
                              onToggle={(next) => toggleStatus(supplier, next)}
                            />
                            <button
                              onClick={() => handleOpenEditModal(supplier)}
                              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-all"
                              title="Edit Supplier"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(supplier.id, supplier.name)}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                              title="Delete Supplier"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredSuppliers.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-12 text-center">
          <Building2 className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="font-bold text-slate-400">No suppliers found</p>
        </div>
      )}

      {/* Create/Edit Supplier Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-4 flex items-center justify-between">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
                {editingSupplier ? 'Edit Supplier' : 'New Supplier'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
                    placeholder="e.g., VetMeds Supplies"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
                    placeholder="e.g., Pharmaceuticals"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
                    placeholder="supplier@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
                    placeholder="+254 700 000 000"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
                    placeholder="e.g., Kenya"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
                    placeholder="Full address"
                  />
                </div>

                {/* Password (only for new suppliers) */}
                {!editingSupplier && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      Password (for supplier login) *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={!editingSupplier}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-12 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
                        placeholder="Enter password for supplier account"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      This will create a user account for the supplier to log in and manage their products
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
                >
                  {editingSupplier ? 'Update Supplier' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default SuppliersHubView;


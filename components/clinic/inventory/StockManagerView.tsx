import React, { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import {
  Search, Plus, Filter, Package, AlertTriangle, Archive,
  Trash2, Edit, X, TrendingDown, TrendingUp, Activity,
  Calendar, Clock, ChevronRight, History, RefreshCw
} from 'lucide-react';
import {
  inventoryAPI, stockMovementsAPI, suppliersAPI,
  InventoryItem, StockMovement, Supplier, StockMovementType
} from '../../../services';
import { toast } from '../../../services';

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

interface Props {
  clinicId: number;
}

const StockManagerView: React.FC<Props> = ({ clinicId }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements' | 'suppliers'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState<StockMovementType | 'ALL'>('ALL');
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Fetch data on mount and when clinicId changes
  // Note: All API calls use cache-first strategy (inventoryAPI, stockMovementsAPI, suppliersAPI)
  // to prevent duplicate requests. Cache is automatically managed by the API client.
  useEffect(() => {
    fetchData();
  }, [clinicId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // All these API calls use cache-first strategy with 30-60 second cache duration
      const [inventoryRes, movementsRes, suppliersRes] = await Promise.all([
        inventoryAPI.getAll({ limit: 1000 }), // Increased limit to match DataContext
        stockMovementsAPI.getAll({ limit: 100 }),
        suppliersAPI.getAll({ limit: 100 }),
      ]);

      // Backend returns paginated response: { data: { data: [...], meta: {...} } }
      setInventory(inventoryRes.data.data || []);
      setMovements(movementsRes.data.data || []);
      setSuppliers(suppliersRes.data.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  // Filter inventory
  const filteredInventory = useMemo(() => {
    return inventory
      .filter(item => statusFilter === 'ALL' || item.status === statusFilter)
      .filter(item => categoryFilter === 'ALL' || item.category === categoryFilter)
      .filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [inventory, statusFilter, categoryFilter, searchQuery]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    return movements
      .filter(m => movementTypeFilter === 'ALL' || m.movementType === movementTypeFilter)
      .filter(m => 
        m.inventoryItem?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [movements, movementTypeFilter, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: inventory.length,
      lowStock: inventory.filter(i => i.status === 'LOW_STOCK').length,
      outOfStock: inventory.filter(i => i.status === 'OUT_OF_STOCK').length,
      expired: inventory.filter(i => i.status === 'EXPIRED').length,
      totalValue: inventory.reduce((sum, i) => sum + (i.quantity * i.price), 0),
    };
  }, [inventory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(i => i.category));
    return ['ALL', ...Array.from(cats)];
  }, [inventory]);

  // Movement type badge color
  const getMovementTypeBadge = (type: StockMovementType) => {
    const badges: Record<StockMovementType, { bg: string; text: string; label: string }> = {
      USED_IN_APPOINTMENT: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Used' },
      RESTOCKED: { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Restocked' },
      ADJUSTED: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', label: 'Adjusted' },
      EXPIRED: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Expired' },
      DAMAGED: { bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'Damaged' },
      RETURNED: { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'Returned' },
    };
    return badges[type];
  };

  // Status badge color
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      IN_STOCK: { bg: 'bg-green-500/10', text: 'text-green-500' },
      LOW_STOCK: { bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
      OUT_OF_STOCK: { bg: 'bg-red-500/10', text: 'text-red-500' },
      EXPIRED: { bg: 'bg-gray-500/10', text: 'text-gray-500' },
    };
    return badges[status] || badges.IN_STOCK;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner message="Loading stock..." />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">
            Stock Manager
          </h1>
          <p className="text-seafoam dark:text-zinc-400 font-medium mt-1 uppercase text-[9px] tracking-widest font-black">
            Inventory, Movements & Suppliers
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={18}/>
            <input 
              type="text" 
              placeholder="Search stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-6 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-72 transition-all font-bold shadow-sm"
            />
          </div>
          {activeTab === 'inventory' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus size={16} /> Add Item
            </button>
          )}
          <button
            onClick={() => fetchData()}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Items', value: stats.total, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/5' },
          { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/5' },
          { label: 'Out of Stock', value: stats.outOfStock, icon: Trash2, color: 'text-red-500', bg: 'bg-red-500/5' },
          { label: 'Expired', value: stats.expired, icon: Archive, color: 'text-gray-500', bg: 'bg-gray-500/5' },
          { label: 'Total Value', value: `KES ${stats.totalValue.toLocaleString()}`, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/5' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={stat.color} size={20} />
              </div>
              <div>
                <p className="text-2xl font-black text-pine dark:text-zinc-100">{stat.value}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
        {[
          { id: 'inventory', label: 'Inventory Items', icon: Package },
          { id: 'movements', label: 'Stock Movements', icon: Activity },
          { id: 'suppliers', label: 'Suppliers', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-lg border border-slate-200 dark:border-zinc-700'
                : 'text-slate-400 hover:text-pine'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    categoryFilter === cat
                      ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                      : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    statusFilter === status
                      ? 'bg-seafoam text-white'
                      : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <Package className="mx-auto mb-4" size={48} />
                        <p className="font-bold">No inventory items found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => {
                      const statusBadge = getStatusBadge(item.status);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-pine dark:text-zinc-100">{item.name}</p>
                              {item.batchNumber && (
                                <p className="text-xs text-slate-400">Batch: {item.batchNumber}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-slate-600 dark:text-zinc-300">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-slate-600 dark:text-zinc-400">{item.sku}</td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-pine dark:text-zinc-100">{item.quantity} {item.unit}</p>
                              <p className="text-xs text-slate-400">Min: {item.minThreshold}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${statusBadge.bg} ${statusBadge.text}`}>
                              {item.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-pine dark:text-zinc-100">
                            KES {item.price.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedItem(item)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                              >
                                <Edit size={16} className="text-slate-400" />
                              </button>
                              <button
                                onClick={() => {/* Handle view history */}}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                              >
                                <History size={16} className="text-slate-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movements Tab */}
      {activeTab === 'movements' && (
        <div className="space-y-6">
          {/* Movement Type Filters */}
          <div className="flex flex-wrap gap-2">
            {['ALL', 'USED_IN_APPOINTMENT', 'RESTOCKED', 'ADJUSTED', 'EXPIRED', 'DAMAGED', 'RETURNED'].map((type) => (
              <button
                key={type}
                onClick={() => setMovementTypeFilter(type as any)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  movementTypeFilter === type
                    ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                    : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Movements List */}
          <div className="space-y-4">
            {filteredMovements.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-12 text-center">
                <Activity className="mx-auto mb-4 text-slate-400" size={48} />
                <p className="font-bold text-slate-400">No stock movements found</p>
              </div>
            ) : (
              filteredMovements.map((movement) => {
                const badge = getMovementTypeBadge(movement.movementType);
                return (
                  <div
                    key={movement.id}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-lg text-xs font-black ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                          <h3 className="font-bold text-pine dark:text-zinc-100">
                            {movement.inventoryItem?.name || 'Unknown Item'}
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantity</p>
                            <p className="font-bold text-pine dark:text-zinc-100">
                              {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.inventoryItem?.unit}
                            </p>
                          </div>
                          {movement.batchNumber && (
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch</p>
                              <p className="font-mono text-sm text-pine dark:text-zinc-100">{movement.batchNumber}</p>
                            </div>
                          )}
                          {movement.costPrice && (
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost</p>
                              <p className="font-bold text-pine dark:text-zinc-100">KES {movement.costPrice.toLocaleString()}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                            <p className="text-sm text-slate-600 dark:text-zinc-400">
                              {new Date(movement.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {movement.notes && (
                          <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400 italic">{movement.notes}</p>
                        )}
                      </div>
                      {movement.appointment && (
                        <div className="ml-4 text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointment</p>
                          <p className="font-mono text-sm text-pine dark:text-zinc-100">{movement.appointment.appointmentNumber}</p>
                          <p className="text-xs text-slate-400">{movement.appointment.petName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suppliers.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-12 text-center">
                <TrendingUp className="mx-auto mb-4 text-slate-400" size={48} />
                <p className="font-bold text-slate-400">No suppliers found</p>
              </div>
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => {/* Navigate to supplier detail */}}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-black text-lg text-pine dark:text-zinc-100 mb-1 group-hover:text-seafoam transition-colors">
                        {supplier.name}
                      </h3>
                      <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-slate-600 dark:text-zinc-300">
                        {supplier.category}
                      </span>
                    </div>
                    <ChevronRight className="text-slate-400 group-hover:text-seafoam transition-colors" size={20} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                      <Package size={14} />
                      <span>{supplier.email}</span>
                    </div>
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                        <Clock size={14} />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.rating && (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div
                              key={star}
                              className={`w-4 h-4 rounded-full ${
                                star <= getRatingAsNumber(supplier.rating) ? 'bg-amber-400' : 'bg-slate-200 dark:bg-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                          {getRatingAsNumber(supplier.rating).toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagerView;


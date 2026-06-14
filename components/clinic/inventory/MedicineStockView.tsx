
import React, { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { Pill, Search, AlertCircle, Calendar, Package, TrendingDown, Filter, Download, RefreshCw, X } from 'lucide-react';
import { inventoryAPI, stockMovementsAPI, InventoryItem } from '../../../services';

interface Props {
  clinicId: number;
}

const MedicineStockView: React.FC<Props> = ({ clinicId }) => {
  const [medications, setMedications] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED'>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');

  useEffect(() => {
    loadMedications();
  }, [clinicId]);

  const loadMedications = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Force cache bypass if requested
      const response = await inventoryAPI.getAll(
        { limit: 500 },
        forceRefresh ? { cache: false } : undefined
      );
      // Backend returns paginated response: { data: { data: [...], meta: {...} } }
      const items = response.data.data || [];

      if (!Array.isArray(items)) {
        console.error('[MedicineStockView] Invalid API response - items is not an array:', items);
        setMedications([]);
        return;
      }

      // Filter to only medication-related items
      const meds = items.filter((item: InventoryItem) =>
        ['Medications', 'Vaccines', 'Pharmacy', 'Drugs', 'Antibiotics', 'Pain Management',
         'Antiparasitics', 'Steroids', 'Anesthetics', 'Emergency Drugs', 'Supplements'].some(cat =>
          item.category.toLowerCase().includes(cat.toLowerCase())
        )
      );

      console.log(`[MedicineStockView] Loaded ${meds.length} medications from ${items.length} total items (forceRefresh: ${forceRefresh})`);
      setMedications(meds);
    } catch (error) {
      console.error('Failed to load medications:', error);
      setMedications([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMedications = useMemo(() => {
    return medications.filter(med => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.category.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'ALL' || med.status === statusFilter;

      // Expiry filter
      let matchesExpiry = true;
      if (expiryFilter === 'EXPIRED') {
        matchesExpiry = med.expiryDate ? new Date(med.expiryDate) < new Date() : false;
      } else if (expiryFilter === 'EXPIRING_SOON') {
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        matchesExpiry = med.expiryDate ? 
          new Date(med.expiryDate) < thirtyDaysFromNow && new Date(med.expiryDate) >= new Date() : false;
      }

      return matchesSearch && matchesStatus && matchesExpiry;
    });
  }, [medications, searchQuery, statusFilter, expiryFilter]);

  const stats = useMemo(() => {
    const total = medications.length;
    const inStock = medications.filter(m => m.status === 'IN_STOCK').length;
    const lowStock = medications.filter(m => m.status === 'LOW_STOCK').length;
    const outOfStock = medications.filter(m => m.status === 'OUT_OF_STOCK').length;
    const expired = medications.filter(m => m.expiryDate && new Date(m.expiryDate) < new Date()).length;
    const expiringSoon = medications.filter(m => {
      if (!m.expiryDate) return false;
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return new Date(m.expiryDate) < thirtyDaysFromNow && new Date(m.expiryDate) >= new Date();
    }).length;

    return { total, inStock, lowStock, outOfStock, expired, expiringSoon };
  }, [medications]);

  const getStatusBadge = (status: string) => {
    const base = "px-3 py-1 rounded-xl text-[9px] font-bold uppercase tracking-widest";
    switch (status) {
      case 'IN_STOCK': return `${base} bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400`;
      case 'LOW_STOCK': return `${base} bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400`;
      case 'OUT_OF_STOCK': return `${base} bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400`;
      case 'EXPIRED': return `${base} bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400`;
      default: return `${base} bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400`;
    }
  };

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (expiry < now) {
      return { label: 'Expired', color: 'text-red-600 dark:text-red-400' };
    } else if (expiry < thirtyDaysFromNow) {
      return { label: 'Expiring Soon', color: 'text-orange-600 dark:text-orange-400' };
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-950/30 rounded-2xl">
            <Pill className="text-purple-600 dark:text-purple-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Medicine Stock</h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400 font-medium">Medication inventory & expiry tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadMedications(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:border-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:bg-purple-700 transition-all">
            <Download size={14} />
            Export
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package size={16} className="text-slate-400" />
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
          </div>
          <p className="text-2xl font-black text-pine dark:text-zinc-100">{stats.total}</p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
            <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">In Stock</p>
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{stats.inStock}</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-amber-600 dark:text-amber-400" />
            <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Low Stock</p>
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{stats.lowStock}</p>
        </div>

        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            <p className="text-[8px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">Out of Stock</p>
          </div>
          <p className="text-2xl font-black text-red-700 dark:text-red-400">{stats.outOfStock}</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-orange-600 dark:text-orange-400" />
            <p className="text-[8px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Expiring Soon</p>
          </div>
          <p className="text-2xl font-black text-orange-700 dark:text-orange-400">{stats.expiringSoon}</p>
        </div>

        <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-slate-600 dark:text-zinc-400" />
            <p className="text-[8px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Expired</p>
          </div>
          <p className="text-2xl font-black text-slate-700 dark:text-zinc-400">{stats.expired}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-seafoam" />
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={16} />
            <input
              type="text"
              placeholder="Search medications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-12 pr-10 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-purple-500/10 outline-none font-bold text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-purple-500/10 outline-none font-bold text-sm cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Expiry Filter */}
          <div>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-purple-500/10 outline-none font-bold text-sm cursor-pointer"
            >
              <option value="ALL">All Expiry</option>
              <option value="EXPIRING_SOON">Expiring Soon (30 days)</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Medications List */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="text-left px-6 py-4 text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Medication</th>
                <th className="text-left px-6 py-4 text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Category</th>
                <th className="text-left px-6 py-4 text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">SKU</th>
                <th className="text-right px-6 py-4 text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Stock</th>
                <th className="text-left px-6 py-4 text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Status</th>
                <th className="text-left px-6 py-4 text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Expiry Date</th>
                <th className="text-right px-6 py-4 text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <LoadingSpinner message="Loading medications..." />
                    </div>
                  </td>
                </tr>
              ) : filteredMedications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <AlertCircle className="mx-auto mb-4 text-slate-400" size={48} />
                    <p className="font-bold text-slate-400">No medications found</p>
                  </td>
                </tr>
              ) : (
                filteredMedications.map((med) => {
                  const expiryStatus = getExpiryStatus(med.expiryDate);
                  return (
                    <tr key={med.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-950/30 rounded-lg">
                            <Pill size={16} className="text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="font-bold text-pine dark:text-zinc-100">{med.name}</p>
                            {med.currentBatchNumber && (
                              <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">Batch: {med.currentBatchNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-pine dark:text-zinc-100">
                          {med.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-slate-600 dark:text-zinc-400">{med.sku}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className={`font-bold ${med.status === 'LOW_STOCK' ? 'text-amber-600 dark:text-amber-400' : med.status === 'OUT_OF_STOCK' ? 'text-red-600 dark:text-red-400' : 'text-pine dark:text-zinc-100'}`}>
                          {med.quantity} {med.unit}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">Min: {med.minThreshold}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={getStatusBadge(med.status)}>{med.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4">
                        {med.expiryDate ? (
                          <div>
                            <p className={`text-sm font-bold ${expiryStatus?.color || 'text-pine dark:text-zinc-100'}`}>
                              {new Date(med.expiryDate).toLocaleDateString()}
                            </p>
                            {expiryStatus && (
                              <p className={`text-xs font-bold ${expiryStatus.color}`}>{expiryStatus.label}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-pine dark:text-zinc-100">KES {Number(med.price).toLocaleString()}</p>
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
  );
};

export default MedicineStockView;


import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck, Package, ShoppingCart, TrendingUp, RefreshCw,
  Receipt, Tag, ChevronRight, Search,
} from 'lucide-react';
import { supplierMetricsAPI, SupplierMetrics } from '../../../services';
import { useClinic } from '../../../contexts/ClinicContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

/**
 * SUPER_ADMIN supplier super-view — the marketplace counterpart to
 * PlatformDashboard. Aggregate KPIs across every supplier: active count,
 * GMV (purchase-order value), order throughput and top sellers. The
 * "Suppliers" KPI is clickable to drill into a single supplier's stats
 * (onPickSupplier sets the X-Supplier-Id scope and flips the view).
 */
const SupplierMetricsDashboard: React.FC<{ onPickSupplier?: () => void }> = ({ onPickSupplier }) => {
  const [metrics, setMetrics] = useState<SupplierMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedClinics } = useClinic();
  const displayCurrency = selectedClinics[0]?.currency || 'KES';

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await supplierMetricsAPI.get();
      if (res.success) setMetrics(res.data);
      else setError('Failed to load metrics');
    } catch (e: any) {
      setError(e?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading && !metrics) {
    return <LoadingSpinner contentArea message="Loading supplier metrics…" />;
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400 font-bold mb-3">{error || 'No metrics available'}</p>
        <button
          onClick={() => load()}
          className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString();
  const fmtMoney = (n: number) => `${displayCurrency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">
            Supplier Super View
          </h2>
          <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest mt-1">
            Marketplace GMV & supplier throughput
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-seafoam rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-seafoam transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Suppliers"
          value={fmt(metrics.suppliers.total)}
          sub={`${metrics.suppliers.active} active · ${metrics.suppliers.inactive} inactive`}
          icon={<Truck size={18} />}
          accent="amber"
          onClick={onPickSupplier}
          cta="View one supplier"
        />
        <KpiCard
          label="GMV (orders)"
          value={fmtMoney(metrics.orders.gmv)}
          sub={`${metrics.orders.total} counted orders`}
          icon={<TrendingUp size={18} />}
          accent="emerald"
        />
        <KpiCard
          label="Orders"
          value={fmt(metrics.orders.total)}
          sub={`${metrics.orders.fulfilled} fulfilled · ${metrics.orders.open} open`}
          icon={<Receipt size={18} />}
          accent="seafoam"
        />
        <KpiCard
          label="Products"
          value={fmt(metrics.products.total)}
          sub="catalogue items"
          icon={<Package size={18} />}
          accent="indigo"
        />
      </div>

      {/* Top suppliers by GMV */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-seafoam" />
          <h3 className="text-sm font-black uppercase tracking-widest text-pine dark:text-zinc-100">
            Top Suppliers · by GMV
          </h3>
        </div>
        {metrics.suppliers.top.length === 0 ? (
          <p className="text-slate-400 text-[10px] font-bold uppercase">No order activity yet</p>
        ) : (
          <div className="space-y-2.5">
            {(() => {
              const max = Math.max(...metrics.suppliers.top.map(t => t.gmv), 1);
              return metrics.suppliers.top.map((t, i) => (
                <div key={t.supplierId} className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{t.supplierName}</span>
                      <span className="text-xs font-black text-seafoam shrink-0 font-mono">{fmtMoney(t.gmv)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-seafoam" style={{ width: `${Math.round((t.gmv / max) * 100)}%` }} />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t.orderCount} orders</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supplier category distribution */}
        <DistributionCard
          title="Suppliers · by category"
          icon={<Tag size={14} />}
          items={metrics.suppliers.byCategory.map(r => ({ label: r.category || 'Uncategorised', count: r.count }))}
          total={metrics.suppliers.total}
        />

        {/* Recent orders */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-seafoam">
            <ShoppingCart size={14} />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">Recent orders</h4>
          </div>
          {metrics.orders.recent.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No recent orders</p>
          ) : (
            <div className="space-y-2">
              {metrics.orders.recent.map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{o.supplierName}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                      {o.clinicName} · {o.status.toLowerCase().replace(/_/g, ' ')} · {new Date(o.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm font-mono font-black text-emerald-600 ml-3 shrink-0">{fmtMoney(o.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: 'emerald' | 'seafoam' | 'amber' | 'indigo';
  onClick?: () => void;
  cta?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, accent, onClick, cta }) => {
  const iconAccent: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    seafoam: 'bg-seafoam/10 text-seafoam',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
  };
  const clickable = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      className={`h-full flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm transition-all ${
        clickable ? 'cursor-pointer hover:border-seafoam hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest truncate pr-2">{label}</p>
        <div className={`p-2 rounded-lg shrink-0 ${iconAccent[accent]}`}>{icon}</div>
      </div>
      <h3 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter font-mono truncate">{value}</h3>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{sub}</p>
      {clickable && cta && (
        <p className="text-[9px] font-black text-seafoam uppercase tracking-widest mt-2 flex items-center gap-0.5">
          <Search size={10} /> {cta} <ChevronRight size={10} />
        </p>
      )}
    </div>
  );
};

interface DistributionCardProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; count: number }>;
  total: number;
}

const DistributionCard: React.FC<DistributionCardProps> = ({ title, icon, items, total }) => {
  const isEmpty = items.length === 0 || (items.length === 1 && items[0].label === 'Uncategorised');
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 text-seafoam">
        {icon}
        <h4 className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{title}</h4>
      </div>
      {isEmpty ? (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No data</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 6).map(item => {
            const pct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.label}>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                  <span className="text-pine dark:text-zinc-100 truncate">{item.label}</span>
                  <span className="text-slate-400 font-mono shrink-0 ml-2">{item.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-seafoam rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SupplierMetricsDashboard;

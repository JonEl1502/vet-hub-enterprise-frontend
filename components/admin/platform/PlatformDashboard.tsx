import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Truck, UserCog, CreditCard, TrendingUp, RefreshCw,
  Loader2, MapPin, Globe, Activity, Layers,
} from 'lucide-react';
import { platformMetricsAPI, PlatformMetrics } from '../../../services';
import { useClinic } from '../../../contexts/ClinicContext';

const PlatformDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedClinics } = useClinic();
  // Display currency for revenue cards: prefer the active clinic's currency
  // (so the admin sees figures in a familiar denomination); falls back to KES.
  const displayCurrency = selectedClinics[0]?.currency || 'KES';

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await platformMetricsAPI.get();
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
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading platform metrics…
      </div>
    );
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
  const fmtMoney = (n: number) => `${displayCurrency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

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
            Platform Super View
          </h2>
          <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest mt-1">
            VetHubCore-level revenue & entity counts
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
          label="VetHubCore Revenue"
          value={fmtMoney(metrics.subscriptions.totalEverPaid)}
          sub={`${metrics.subscriptions.activeCount} active subs`}
          icon={<TrendingUp size={18} />}
          accent="emerald"
        />
        <KpiCard
          label="Total Clinics"
          value={fmt(metrics.clinics.total)}
          sub={`${metrics.clinics.active} active · ${metrics.clinics.inactive} inactive`}
          icon={<Building2 size={18} />}
          accent="seafoam"
        />
        <KpiCard
          label="Suppliers"
          value={fmt(metrics.suppliers.total)}
          sub={`${metrics.suppliers.active} active`}
          icon={<Truck size={18} />}
          accent="amber"
        />
        <KpiCard
          label="Freelancers"
          value={fmt(metrics.freelancers.total)}
          sub={`${metrics.freelancers.active} active`}
          icon={<UserCog size={18} />}
          accent="indigo"
        />
      </div>

      {/* Plan breakdown */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={16} className="text-seafoam" />
          <h3 className="text-sm font-black uppercase tracking-widest text-pine dark:text-zinc-100">
            Subscription Plans
          </h3>
        </div>
        {metrics.subscriptions.byPlan.length === 0 ? (
          <p className="text-slate-400 text-[10px] font-bold uppercase">No plan data</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                  <th className="text-left pb-2">Plan</th>
                  <th className="text-right pb-2">Tier</th>
                  <th className="text-right pb-2">Active</th>
                  <th className="text-right pb-2">Lifetime</th>
                  <th className="text-right pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.subscriptions.byPlan.map(p => (
                  <tr key={p.packageId} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 font-black text-pine dark:text-zinc-100">{p.packageName}</td>
                    <td className="py-3 text-right text-slate-400 font-mono">T{p.tier}</td>
                    <td className="py-3 text-right font-bold text-emerald-600">{p.activeCount}</td>
                    <td className="py-3 text-right text-slate-500 font-mono">{p.lifetimeCount}</td>
                    <td className="py-3 text-right font-mono font-black text-pine dark:text-zinc-100">{fmtMoney(p.lifetimeRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clinic geo distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DistributionCard
          title="By Country"
          icon={<Globe size={14} />}
          items={metrics.clinics.byCountry.map(r => ({ label: r.countryCode || 'Unknown', count: r.count }))}
          total={metrics.clinics.total}
        />
        <DistributionCard
          title="By City"
          icon={<MapPin size={14} />}
          items={metrics.clinics.byCity.map(r => ({ label: r.city || 'Unknown', count: r.count }))}
          total={metrics.clinics.total}
          emptyHint="Edit a clinic's settings to add a city"
        />
        <DistributionCard
          title="By Region"
          icon={<Activity size={14} />}
          items={metrics.clinics.byRegion.map(r => ({ label: r.region || 'Unknown', count: r.count }))}
          total={metrics.clinics.total}
        />
      </div>

      {/* Recent subscriptions */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={16} className="text-seafoam" />
          <h3 className="text-sm font-black uppercase tracking-widest text-pine dark:text-zinc-100">
            Recent Subscriptions
          </h3>
        </div>
        {metrics.subscriptions.recent.length === 0 ? (
          <p className="text-slate-400 text-[10px] font-bold uppercase">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {metrics.subscriptions.recent.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{s.clinicName}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {s.packageName} · {new Date(s.startedAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm font-mono font-black text-emerald-600 ml-3 shrink-0">
                  {fmtMoney(s.amountPaid)}
                </p>
              </div>
            ))}
          </div>
        )}
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
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, accent }) => {
  const accentClasses: Record<string, string> = {
    emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10 text-emerald-600',
    seafoam: 'border-seafoam/30 bg-seafoam/5 text-seafoam',
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 text-amber-600',
    indigo: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10 text-indigo-600',
  };
  return (
    <div className={`bg-white dark:bg-zinc-900 border-2 ${accentClasses[accent]} rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 dark:text-zinc-500 text-[9px] font-black uppercase tracking-widest">{label}</p>
        <div className={`p-2 rounded-lg ${accentClasses[accent]}`}>{icon}</div>
      </div>
      <h3 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter font-mono break-all">
        {value}
      </h3>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{sub}</p>
    </div>
  );
};

interface DistributionCardProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; count: number }>;
  total: number;
  emptyHint?: string;
}

const DistributionCard: React.FC<DistributionCardProps> = ({ title, icon, items, total, emptyHint }) => {
  // Treat the breakdown as "empty" when it's only a single "Unknown"
  // bucket — that means no clinic has the field populated.
  const isEmpty = items.length === 0 || (items.length === 1 && items[0].label === 'Unknown');
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 text-seafoam">
        {icon}
        <h4 className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{title}</h4>
      </div>
      {isEmpty ? (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {emptyHint || 'No data'}
        </p>
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
                  <div
                    className="h-full bg-seafoam rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlatformDashboard;

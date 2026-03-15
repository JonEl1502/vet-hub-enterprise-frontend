import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Download,
  PieChart,
  Users,
  Building2,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { walletAPI } from '../services/modules/wallet.api';
import type { Wallet as WalletType } from '../services/modules/wallet.api';
import { useAuth } from '../contexts/AuthContext';
import { supplierStripeAPI, SupplierBillingInfo } from '../services/modules/stripe.api';

interface SupplierInfo {
  id: string;
  name: string;
  currency?: string;
}

interface Props {
  supplier: SupplierInfo;
}

// Auto-regen interval: every 5 minutes (300_000 ms)
const REGEN_INTERVAL_MS = 5 * 60 * 1000;

const SupplierWallet: React.FC<Props> = ({ supplier }) => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegening, setIsRegening] = useState(false);
  const [lastRegenAt, setLastRegenAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'inflow' | 'outflow'>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [billingInfo, setBillingInfo] = useState<SupplierBillingInfo | null>(null);

  const currency = supplier.currency || 'KES';

  const chartData = [
    { name: 'Mon', income: 0, expense: 0 },
    { name: 'Tue', income: 0, expense: 0 },
    { name: 'Wed', income: 0, expense: 0 },
    { name: 'Thu', income: 0, expense: 0 },
    { name: 'Fri', income: 0, expense: 0 },
    { name: 'Sat', income: 0, expense: 0 },
    { name: 'Sun', income: 0, expense: 0 },
  ];

  // Silent regen: update balance without loading spinner
  const silentRegen = useCallback(async (walletId: string) => {
    try {
      const res = await walletAPI.regen(walletId);
      if (res.success) {
        setWallet(prev => prev ? { ...prev, balance: (res.data as any).balance } : prev);
        setLastRegenAt(new Date());
      }
    } catch {
      /* silent */
    }
  }, []);

  const fetchWallet = async () => {
    if (!supplier?.id) return;
    setIsLoading(true);
    try {
      const res = await walletAPI.getByEntity('SUPPLIER', supplier.id);
      if (res.success && res.data.wallets.length > 0) {
        const main = res.data.wallets.find(w => !w.branchId) || res.data.wallets[0];
        setWallet(main);
        // Immediately regen on load to get fresh balance
        silentRegen(main.id);
      } else {
        // Auto-create main wallet, then regen to compute initial balance
        const created = await walletAPI.create({
          entityType: 'SUPPLIER',
          profileId: supplier.id,
          name: supplier.name,
          branchId: null,
          currency,
        });
        if (created.success) {
          setWallet(created.data.wallet);
          silentRegen(created.data.wallet.id);
        }
      }
    } catch {
      /* wallet unavailable */
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [supplier?.id]);

  useEffect(() => {
    if (!supplier?.id) return;
    supplierStripeAPI.getInfo(supplier.id).then(res => {
      if (res.success) setBillingInfo(res.data);
    }).catch(() => {});
  }, [supplier?.id]);

  // Periodic regen every 5 minutes (cron-like background refresh)
  useEffect(() => {
    if (!wallet?.id) return;
    const timer = setInterval(() => {
      silentRegen(wallet.id);
    }, REGEN_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [wallet?.id, silentRegen]);

  const handleRegen = async () => {
    if (!wallet) return;
    setIsRegening(true);
    try {
      const res = await walletAPI.regen(wallet.id);
      if (res.success) {
        setWallet({ ...wallet, balance: (res.data as any).balance });
        setLastRegenAt(new Date());
      }
    } catch {
      /* silent */
    } finally {
      setIsRegening(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter">Supplier Treasury</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold mt-1 uppercase tracking-widest text-[9px]">
            Financial Management — {supplier.name}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-seafoam transition-all shadow-sm flex items-center gap-2">
            <Download size={14} /> Ledger
          </button>
          <button
            onClick={handleRegen}
            disabled={isRegening || !wallet}
            className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-pine/20 dark:shadow-none transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60"
          >
            {isRegening ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Regen Wallet
          </button>
        </div>
      </header>

      {/* Subscription Status Banner */}
      {billingInfo && (
        <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${
          billingInfo.subscription?.isActive
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            billingInfo.subscription?.isActive ? 'bg-emerald-500/10' : 'bg-amber-500/10'
          }`}>
            {billingInfo.subscription?.isActive
              ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
              : <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest ${
              billingInfo.subscription?.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {billingInfo.subscription?.isActive ? 'Subscription Active' : 'No Active Subscription'}
            </p>
            {billingInfo.subscription ? (
              <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mt-0.5">
                {billingInfo.subscription.package?.name ?? 'Current Plan'}{' '}
                {billingInfo.subscription.package
                  ? `— $${billingInfo.subscription.package.price.toFixed(2)}/${billingInfo.subscription.package.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}`
                  : ''
                }
                {billingInfo.subscription.expiresAt && (
                  <span className="ml-2 text-slate-400 dark:text-zinc-500">
                    · {billingInfo.subscription.autoRenew ? 'Renews' : 'Expires'}{' '}
                    {new Date(billingInfo.subscription.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Go to Management → Subscription to choose a plan</p>
            )}
          </div>
          {billingInfo.subscription?.package && (
            <div className="flex items-center gap-3 flex-shrink-0 text-right">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Staff</p>
                <p className="text-sm font-black text-pine dark:text-zinc-100">{billingInfo.subscription.package.maxStaff >= 9999 ? '∞' : billingInfo.subscription.package.maxStaff.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Storage</p>
                <p className="text-sm font-black text-pine dark:text-zinc-100">{billingInfo.subscription.package.storageGb} GB</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Balance card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 bg-pine dark:bg-zinc-900 rounded-xl p-6 text-white relative overflow-hidden shadow-xl shadow-pine/30 group flex flex-col justify-between min-h-[200px]">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-seafoam/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-mist/60 text-[8px] font-black uppercase tracking-[0.2em] mb-2">Supplier Balance</p>
                {isLoading ? (
                  <div className="h-8 w-40 bg-white/20 rounded-lg animate-pulse" />
                ) : (
                  <h2 className="text-3xl font-black tracking-tighter">
                    {formatCurrency(wallet?.balance ?? 0)}
                  </h2>
                )}
                {lastRegenAt && (
                  <p className="text-mist/40 text-[7px] font-bold mt-1 uppercase tracking-widest">
                    Updated {lastRegenAt.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 group-hover:rotate-12 transition-transform">
                <Wallet className="text-seafoam" size={20} />
              </div>
            </div>
          </div>
          <div className="relative z-10 flex gap-2 mt-4">
            <button
              onClick={handleRegen}
              disabled={isRegening || !wallet}
              className="compact-button bg-white text-pine hover:bg-mist transition-all active:scale-95 shadow-lg flex items-center gap-1.5"
            >
              {isRegening ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Recalculate
            </button>
            <button className="compact-button bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-all">
              Settings
            </button>
          </div>
        </div>

        <div className="compact-card flex flex-col justify-between hover:border-seafoam transition-all">
          <div>
            <p className="card-subtitle mb-1">Growth Rate</p>
            <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">—</h3>
          </div>
          <div className="h-16 w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <Bar dataKey="income" fill="#438883" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="compact-card flex flex-col justify-between hover:border-seafoam transition-all">
          <div>
            <p className="card-subtitle mb-1">Wallet Status</p>
            <div className="flex items-center gap-2 mt-1">
              {wallet ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Active</h3>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-amber-500" />
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">
                    {isLoading ? 'Loading…' : 'Not set up'}
                  </h3>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2 mt-3">
            <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
              <span>Currency</span>
              <span className="text-pine dark:text-zinc-100">{wallet?.currency ?? currency}</span>
            </div>
            <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
              <span>Branch</span>
              <span className="text-pine dark:text-zinc-100">{wallet?.branchId ? `Branch #${wallet.branchId}` : 'Main'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
        {[
          { id: 'summary', label: 'Treasury', icon: PieChart },
          { id: 'inflow', label: 'Inflows', icon: ArrowDownLeft },
          { id: 'outflow', label: 'Outflows', icon: ArrowUpRight },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-xl dark:shadow-none border border-slate-200 dark:border-zinc-700'
                : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'summary' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">Financial Vector</h3>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="supplierIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#438883" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#438883" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 800, fontSize: '10px' }} />
                  <Area type="monotone" dataKey="income" stroke="#438883" strokeWidth={4} fillOpacity={1} fill="url(#supplierIncome)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
              <h4 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-6">Wallet Details</h4>
              <div className="space-y-4">
                {[
                  { label: 'Wallet ID', val: wallet ? `#${wallet.id}` : '—' },
                  { label: 'Entity Type', val: 'SUPPLIER' },
                  { label: 'Balance', val: formatCurrency(wallet?.balance ?? 0) },
                  { label: 'Currency', val: wallet?.currency ?? currency },
                  { label: 'Branch', val: wallet?.branchId ? `Branch #${wallet.branchId}` : 'Main' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center text-[9px] font-black uppercase">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-pine dark:text-zinc-100">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-8">
              <div className="flex items-center gap-3 mb-3 text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Balance Info</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                Use <span className="font-black">Recalculate</span> to recompute your balance from all recorded transactions in the system.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in zoom-in-95">
          <div className="p-8 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                placeholder="Filter ledger..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-12 pr-6 py-2.5 text-[11px] text-pine dark:text-zinc-100 outline-none w-64 focus:ring-2 focus:ring-seafoam/20 transition-all font-bold"
              />
            </div>
            <button className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-all shadow-sm">
              <Filter size={16} />
            </button>
          </div>
          <div className="py-24 text-center">
            <p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">
              No {activeTab} entries found
            </p>
            <p className="text-slate-400 dark:text-zinc-500 text-xs mt-2">
              Transaction history will appear here once orders are processed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierWallet;

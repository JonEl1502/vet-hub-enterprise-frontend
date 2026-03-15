
import React, { useState, useMemo, useEffect } from 'react';
import { Clinic, Transaction, PaymentMethod } from '../types';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  PieChart,
  Download,
  Filter,
  Building2,
  Users,
  Search,
  CreditCard,
  Crown,
  Zap,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  RefreshCw,
  ArrowRight,
  Gift,
  Package,
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
  Bar
} from 'recharts';
import { stripeAPI, BillingInfo } from '../services/modules/stripe.api';
import { clinicSubscriptionAPI, ClinicSubscription } from '../services/modules/clinicSubscription.api';

interface Props {
  clinic: Clinic;
  transactions: Transaction[];
  onAddTransaction: (from: number, to: number, amount: number, type: Transaction['type'], method: PaymentMethod) => void;
}

const ClinicWallet: React.FC<Props> = ({ clinic, transactions, onAddTransaction }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'client' | 'b2b' | 'outflow'>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [activeSub, setActiveSub] = useState<ClinicSubscription | null>(null);

  useEffect(() => {
    if (!clinic?.id) return;
    const id = String(clinic.id);
    stripeAPI.getInfo(id).then(res => {
      if (res.success) setBillingInfo(res.data);
    }).catch(() => {});
    clinicSubscriptionAPI.getActive(id).then(res => {
      if (res.success) setActiveSub(res.data.subscription);
    }).catch(() => {});
  }, [clinic?.id]);

  const clinicTransactions = useMemo(() => {
    return transactions.filter(tx => tx.fromId === clinic.id || tx.toId === clinic.id);
  }, [transactions, clinic.id]);

  const stats = useMemo(() => {
    const clientRev = clinicTransactions.filter(tx => tx.toId === clinic.id && tx.type === 'SERVICE');
    const b2bRev = clinicTransactions.filter(tx => tx.toId === clinic.id && tx.type === 'REFERRAL');
    const outflows = clinicTransactions.filter(tx => tx.fromId === clinic.id);

    return {
      totalClientRev: clientRev.reduce((acc, tx) => acc + tx.amount, 0),
      totalB2BRev: b2bRev.reduce((acc, tx) => acc + tx.amount, 0),
      totalOutflow: outflows.reduce((acc, tx) => acc + tx.amount, 0),
      count: clinicTransactions.length
    };
  }, [clinicTransactions, clinic.id]);

  const chartData = [
    { name: 'Mon', income: 45000, expense: 12000 },
    { name: 'Tue', income: 32000, expense: 15000 },
    { name: 'Wed', income: 61000, expense: 22000 },
    { name: 'Thu', income: 48000, expense: 8000 },
    { name: 'Fri', income: 55000, expense: 31000 },
    { name: 'Sat', income: 72000, expense: 14000 },
    { name: 'Sun', income: 28000, expense: 5000 },
  ];

  const filteredTransactions = useMemo(() => {
    let list = clinicTransactions;
    if (activeTab === 'client') list = clinicTransactions.filter(tx => tx.toId === clinic.id && tx.type === 'SERVICE');
    if (activeTab === 'b2b') list = clinicTransactions.filter(tx => tx.type === 'REFERRAL');
    if (activeTab === 'outflow') list = clinicTransactions.filter(tx => tx.fromId === clinic.id);
    
    return list.filter(tx => tx.id.toString().includes(searchQuery) || tx.method.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [clinicTransactions, activeTab, clinic.id, searchQuery]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: clinic.currency, maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter">Financial Core</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold mt-1 uppercase tracking-widest text-[9px]">Financial Management</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-seafoam transition-all shadow-sm flex items-center gap-2">
            <Download size={14} /> Ledger
          </button>
          <button 
            onClick={() => onAddTransaction(999, clinic.id, 5000, 'SERVICE', 'M-PESA')}
            className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-pine/20 dark:shadow-none transition-all active:scale-95"
          >
            + New Entry
          </button>
        </div>
      </header>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 bg-pine dark:bg-zinc-900 rounded-xl p-6 text-white relative overflow-hidden shadow-xl shadow-pine/30 group flex flex-col justify-between min-h-[200px]">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-seafoam/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="relative z-10">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-mist/60 text-[8px] font-black uppercase tracking-[0.2em] mb-2">Clinical Liquidity</p>
                    <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(clinic.balance)}</h2>
                  </div>
                  <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 group-hover:rotate-12 transition-transform">
                    <Wallet className="text-seafoam" size={20} />
                  </div>
               </div>
          </div>
          <div className="relative z-10 flex gap-2 mt-4">
             <button className="compact-button bg-white text-pine hover:bg-mist transition-all active:scale-95 shadow-lg">Sweep Funds</button>
             <button className="compact-button bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-all">Settings</button>
          </div>
        </div>

        <div className="compact-card flex flex-col justify-between hover:border-seafoam transition-all">
           <div>
             <p className="card-subtitle mb-1">Growth Rate</p>
             <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">+24.5%</h3>
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
             <p className="card-subtitle mb-1">Transactions</p>
             <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">{stats.count} Operations</h3>
           </div>
           <div className="space-y-2 mt-3">
              <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
                 <span>Settled</span>
                 <span className="text-pine dark:text-zinc-100">92%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 w-[92%] transition-all duration-1000"></div>
              </div>
           </div>
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
         {[
           { id: 'summary', label: 'Treasury', icon: PieChart },
           { id: 'client', label: 'Clinical', icon: Users },
           { id: 'b2b', label: 'Referrals', icon: Building2 },
           { id: 'outflow', label: 'Outflows', icon: ArrowUpRight },
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
               activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-xl dark:shadow-none border border-slate-200 dark:border-zinc-700' : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
             }`}
           >
             <tab.icon size={12} />
             {tab.label}
           </button>
         ))}
      </div>

      {activeTab === 'summary' ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">

        {/* ── Subscription Card ─────────────────────────────────────── */}
        {(() => {
          const sub = activeSub;
          const pkg = sub?.package ?? null;
          const now = Date.now();
          const daysTotal = 30;
          const daysElapsed = sub ? Math.min((now - new Date(sub.startedAt).getTime()) / (1000 * 60 * 60 * 24), daysTotal) : 0;
          const daysLeft = sub ? Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24))) : 0;
          const progressPct = Math.min(100, (daysElapsed / daysTotal) * 100);
          const tierIcons = [null, Zap, Crown, Rocket];
          const TierIcon = pkg?.tier && pkg.tier <= 3 ? tierIcons[pkg.tier] : Package;

          if (!sub) return (
            <div className="flex items-center gap-4 px-6 py-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">No Active Subscription</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Go to Billing to choose a plan</p>
              </div>
            </div>
          );

          return (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start gap-6">

                {/* Left: plan identity */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-seafoam/10 flex items-center justify-center flex-shrink-0">
                    {TierIcon && <TierIcon size={22} className="text-seafoam" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight">{pkg?.name ?? 'Current Plan'}</h3>
                      <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20">
                        Tier {pkg?.tier ?? '—'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${
                        sub.isActive
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700'
                      }`}>
                        {sub.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {sub.autoRenew && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          <RefreshCw size={8} /> Auto-renew
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-zinc-400 mt-1">
                      {pkg ? `${clinic.currency} ${pkg.price.toFixed(2)} / ${pkg.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: limits */}
                {pkg && (
                  <div className="flex gap-6 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Staff</p>
                      <p className="text-base font-black text-pine dark:text-zinc-100">{pkg.maxStaff.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Patients</p>
                      <p className="text-base font-black text-pine dark:text-zinc-100">{pkg.maxPatients >= 99999 ? '∞' : pkg.maxPatients.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Storage</p>
                      <p className="text-base font-black text-pine dark:text-zinc-100">{pkg.storageGb} GB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bar — days elapsed */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                  <span className="flex items-center gap-1.5"><Calendar size={10} /> Started {new Date(sub.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>{daysLeft} days remaining · {sub.autoRenew ? 'Renews' : 'Expires'} {new Date(sub.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-seafoam rounded-full transition-all duration-1000"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Billing breakdown */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Charged</p>
                  <p className="text-sm font-black text-pine dark:text-zinc-100">{clinic.currency} {sub.amountPaid.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1 flex items-center gap-1"><Gift size={8} /> Credit Applied</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {sub.creditApplied > 0 ? `− ${clinic.currency} ${sub.creditApplied.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Days Used</p>
                  <p className="text-sm font-black text-pine dark:text-zinc-100">{Math.floor(daysElapsed)} / {daysTotal}</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">
                    {sub.upgradedFromId ? 'Upgraded From' : 'Billing Cycle'}
                  </p>
                  <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">
                    {sub.upgradedFromId
                      ? <span className="flex items-center gap-1 text-seafoam"><ArrowRight size={10} /> Previous plan</span>
                      : (pkg?.billingCycle === 'MONTHLY' ? 'Monthly' : 'Yearly')}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Charts + Revenue ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">Financial Vector</h3>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-seafoam"></div>
                      <span className="text-[8px] font-black uppercase text-slate-400">Income</span>
                   </div>
                </div>
             </div>
             <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#438883" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#438883" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 800, fontSize: '10px' }} />
                      <Area type="monotone" dataKey="income" stroke="#438883" strokeWidth={4} fillOpacity={1} fill="url(#colorIncome)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="space-y-6">
             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
                <h4 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-6">Revenue Streams</h4>
                <div className="space-y-6">
                   {[
                     { label: 'Clinical Services', val: stats.totalClientRev, color: 'bg-seafoam', p: 72 },
                     { label: 'B2B Referrals', val: stats.totalB2BRev, color: 'bg-cyan', p: 21 }
                   ].map(r => (
                     <div key={r.label} className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                           <span>{r.label}</span>
                           <span className="text-pine dark:text-zinc-100">{formatCurrency(r.val)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                           <div className={`h-full ${r.color} transition-all duration-1000`} style={{ width: `${r.p}%` }}></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
             
             <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-8">
                <div className="flex items-center gap-3 mb-3 text-emerald-600 dark:text-emerald-400">
                   <TrendingUp size={18}/>
                   <span className="text-[10px] font-black uppercase tracking-widest">Revenue Update</span>
                </div>
                <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                   Clinical revenue is trending <span className="font-black">18% above target</span>. Performance is optimal.
                </p>
             </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in zoom-in-95">
           <div className="p-8 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <div className="relative group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                 <input 
                   placeholder="Filter ledger..." 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-12 pr-6 py-2.5 text-[11px] text-pine dark:text-zinc-100 outline-none w-64 focus:ring-2 focus:ring-seafoam/20 transition-all font-bold"
                 />
              </div>
              <button className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-all shadow-sm"><Filter size={16}/></button>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-slate-100 dark:border-zinc-800">
                   <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry ID</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type / Method</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                 {filteredTransactions.length > 0 ? filteredTransactions.map(tx => {
                   const isIncome = tx.toId === clinic.id;
                   return (
                     <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-all group">
                       <td className="px-8 py-6">
                         <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {isIncome ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}
                           </div>
                           <div>
                             <p className="text-pine dark:text-zinc-100 font-black text-sm">#{tx.id}</p>
                             <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{tx.type}</p>
                           </div>
                         </div>
                       </td>
                       <td className="px-8 py-6">
                          <p className="text-pine dark:text-zinc-100 font-bold text-xs">{tx.method}</p>
                       </td>
                       <td className="px-8 py-6">
                          <p className="text-pine dark:text-zinc-200 font-bold text-xs">{tx.date}</p>
                       </td>
                       <td className="px-8 py-6">
                          <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border ${tx.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                            {tx.status}
                          </span>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <p className={`font-mono font-black text-base ${isIncome ? 'text-emerald-600' : 'text-slate-400'}`}>
                             {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                          </p>
                       </td>
                     </tr>
                   );
                 }) : (
                   <tr>
                      <td colSpan={5} className="py-24 text-center">
                         <p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">No ledger entries found</p>
                      </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClinicWallet;

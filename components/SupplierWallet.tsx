import React, { useState, useEffect, useCallback } from 'react';
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
  Search,
  Filter,
  Settings2,
  X,
  Landmark,
  Smartphone,
  Hash,
  CreditCard,
  ChevronDown,
  Edit2,
  Gift,
  Calendar,
  ArrowRight,
  Package,
  Crown,
  Zap,
  Rocket,
  Plus,
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
import { cache } from '../services/utils/cache';
import type { Wallet as WalletType, WalletType as WalletKind, WalletLedgerEntry } from '../services/modules/wallet.api';
import { toast } from '../services/utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';
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

const KENYA_BANK_PAYBILLS = [
  { name: 'KCB Bank',               paybill: '522522' },
  { name: 'Equity Bank',            paybill: '247247' },
  { name: 'NCBA Bank',              paybill: '880100' },
  { name: 'Co-operative Bank',      paybill: '400200' },
  { name: 'Standard Chartered',     paybill: '329329' },
  { name: 'Absa Bank Kenya',        paybill: '303030' },
  { name: 'I&M Bank',               paybill: '542542' },
  { name: 'DTB (Diamond Trust)',    paybill: '516600' },
  { name: 'Family Bank',            paybill: '222111' },
  { name: 'Stanbic Bank Kenya',     paybill: '600100' },
  { name: 'Ecobank Kenya',          paybill: '700200' },
  { name: 'National Bank of Kenya', paybill: '625625' },
  { name: 'SBM Bank Kenya',         paybill: '5033005' },
  { name: 'HF Group',               paybill: '572572' },
] as const;

const WALLET_TYPE_META: Record<WalletKind, { label: string; icon: React.ReactNode; accountLabel: string; useDropdown: boolean }> = {
  BANK:          { label: 'Bank Account',  icon: <Landmark size={14} />,  accountLabel: 'Account Number', useDropdown: false },
  MPESA_POCHI:   { label: 'MPesa Pochi',   icon: <Smartphone size={14} />, accountLabel: 'Phone Number',   useDropdown: false },
  BANK_PAYBILL:  { label: 'Bank Paybill',  icon: <CreditCard size={14} />, accountLabel: 'Bank Paybill',   useDropdown: true  },
  TILL:          { label: 'Till Number',   icon: <Hash size={14} />,       accountLabel: 'Till Number',     useDropdown: false },
  MPESA_PAYBILL: { label: 'MPesa Paybill', icon: <Smartphone size={14} />, accountLabel: 'Paybill Number', useDropdown: false },
};

const emptySettingsForm = () => ({
  name: '',
  walletType: '' as WalletKind | '',
  accountNumber: '',
  paybillBank: '',
  paybillAccountNo: '',    // BANK_PAYBILL: account number at bank; MPESA_PAYBILL: account/store number
  balance: '',             // opening/current balance (only used on creation)
  debt: '',
});

const chartData = [
  { name: 'Mon', income: 0, expense: 0 },
  { name: 'Tue', income: 0, expense: 0 },
  { name: 'Wed', income: 0, expense: 0 },
  { name: 'Thu', income: 0, expense: 0 },
  { name: 'Fri', income: 0, expense: 0 },
  { name: 'Sat', income: 0, expense: 0 },
  { name: 'Sun', income: 0, expense: 0 },
];

const SupplierWallet: React.FC<Props> = ({ supplier }) => {
  const { user } = useAuth();
  const { activeBranchIds, branches } = useSupplierBranch();

  // Resolve the active branchId for the wallet:
  // If exactly one real (non-main) branch is selected, show that branch's wallet.
  // Otherwise, show the main wallet.
  const activeSingleBranchId = (() => {
    const realIds = activeBranchIds.filter(id => id !== '__main__');
    if (realIds.length === 1 && !activeBranchIds.includes('__main__')) return realIds[0];
    return null; // main wallet
  })();
  const activeBranchName = activeSingleBranchId
    ? branches.find(b => b.id === activeSingleBranchId)?.name || `Branch`
    : supplier.name;

  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegening, setIsRegening] = useState(false);
  const [lastRegenAt, setLastRegenAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'wallet' | 'inflow' | 'outflow'>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [billingInfo, setBillingInfo] = useState<SupplierBillingInfo | null>(null);

  // Wallet settings
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(emptySettingsForm());
  const [savingSettings, setSavingSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Transfer modal
  const [transferModal, setTransferModal] = useState<{ direction: 'in' | 'out' } | null>(null);
  const [transferForm, setTransferForm] = useState({ amount: '', note: '', reference: '' });
  const [transferring, setTransferring] = useState(false);

  // Ledger
  const [ledgerEntries, setLedgerEntries] = useState<WalletLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const currency = supplier.currency || 'KES';

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(val);

  // ── Fetch wallet ─────────────────────────────────────────────────────────
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

  const WALLET_CACHE_KEY = `/supplier-wallet/${supplier.id}/${activeSingleBranchId ?? 'main'}`;
  const LEDGER_CACHE_KEY = (walletId: string) => `/supplier-ledger/${walletId}`;

  const fetchWallet = async () => {
    if (!supplier?.id) return;
    const cached = cache.get<WalletType>(WALLET_CACHE_KEY);
    if (cached) {
      setWallet(cached);
      const cachedRaw = cached.accountNumber ?? '';
      const [cachedPrimary, cachedSecondary] = cachedRaw.split('|');
      setSettingsForm({
        name: cached.name,
        walletType: cached.walletType ?? '',
        accountNumber: cached.walletType === 'BANK_PAYBILL' ? '' : (cached.walletType === 'MPESA_PAYBILL' ? (cachedPrimary ?? '') : cachedRaw),
        paybillBank: cached.walletType === 'BANK_PAYBILL' ? (cachedPrimary ?? '') : '',
        paybillAccountNo: (cached.walletType === 'BANK_PAYBILL' || cached.walletType === 'MPESA_PAYBILL') ? (cachedSecondary ?? '') : '',
        balance: '',
        debt: String(cached.debt ?? ''),
      });
      setIsLoading(false);
      silentRegen(cached.id);
      return;
    }
    setIsLoading(true);
    try {
      const res = await walletAPI.getByEntity('SUPPLIER', supplier.id);
      const allWallets = res.success ? res.data.wallets : [];

      let target: WalletType | undefined;
      if (activeSingleBranchId) {
        target = allWallets.find(w => w.branchId === activeSingleBranchId);
        if (!target) {
          const branchName = branches.find(b => b.id === activeSingleBranchId)?.name || 'Branch';
          const created = await walletAPI.createForSupplier(supplier.id, {
            name: branchName,
            branchId: activeSingleBranchId,
            currency,
          });
          if (created.success) target = created.data.wallet;
        }
      } else {
        target = allWallets.find(w => !w.branchId) || allWallets[0];
        if (!target) {
          const ensured = await walletAPI.ensure('SUPPLIER', supplier.id);
          if (ensured.success) target = ensured.data.wallet;
        }
      }

      if (target) {
        cache.set(WALLET_CACHE_KEY, target);
        setWallet(target);
        silentRegen(target.id);
        const tRaw = target.accountNumber ?? '';
        const [tPrimary, tSecondary] = tRaw.split('|');
        setSettingsForm({
          name: target.name,
          walletType: target.walletType ?? '',
          accountNumber: target.walletType === 'BANK_PAYBILL' ? '' : (target.walletType === 'MPESA_PAYBILL' ? (tPrimary ?? '') : tRaw),
          paybillBank: target.walletType === 'BANK_PAYBILL' ? (tPrimary ?? '') : '',
          paybillAccountNo: (target.walletType === 'BANK_PAYBILL' || target.walletType === 'MPESA_PAYBILL') ? (tSecondary ?? '') : '',
          balance: '',
          debt: String(target.debt ?? ''),
        });
      } else {
        setSettingsForm(f => ({ ...f, name: f.name || supplier.name }));
      }
    } catch {
      /* wallet unavailable */
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLedger = async (walletId: string) => {
    const cachedEntries = cache.get<WalletLedgerEntry[]>(LEDGER_CACHE_KEY(walletId));
    if (cachedEntries) { setLedgerEntries(cachedEntries); return; }
    setLedgerLoading(true);
    try {
      const res = await walletAPI.getLedger(walletId, { limit: 10 });
      if (res.success) {
        cache.set(LEDGER_CACHE_KEY(walletId), res.data.entries);
        setLedgerEntries(res.data.entries);
      }
    } catch {
      /* silent */
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [supplier?.id, activeSingleBranchId]);

  useEffect(() => {
    if (wallet?.id) fetchLedger(wallet.id);
  }, [wallet?.id]);

  useEffect(() => {
    if (!supplier?.id) return;
    supplierStripeAPI.getInfo(supplier.id).then(res => {
      if (res.success) setBillingInfo(res.data);
    }).catch(() => {});
  }, [supplier?.id]);

  // Periodic regen every 5 minutes
  useEffect(() => {
    if (!wallet?.id) return;
    const timer = setInterval(() => silentRegen(wallet.id), REGEN_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [wallet?.id, silentRegen]);

  // ── Regen ────────────────────────────────────────────────────────────────
  const handleRegen = async () => {
    if (!wallet) return;
    setIsRegening(true);
    try {
      const res = await walletAPI.regen(wallet.id);
      if (res.success) {
        setWallet({ ...wallet, balance: (res.data as any).balance });
        setLastRegenAt(new Date());
        if (wallet.id) fetchLedger(wallet.id);
      }
    } catch {
      /* silent */
    } finally {
      setIsRegening(false);
    }
  };

  // ── Transfer ─────────────────────────────────────────────────────────────
  const handleTransferSubmit = async () => {
    if (!wallet || !transferModal) return;
    const amount = parseFloat(transferForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setTransferring(true);
    try {
      const fn = transferModal.direction === 'in' ? walletAPI.transferIn : walletAPI.transferOut;
      const res = await fn(wallet.id, {
        amount,
        note: transferForm.note || undefined,
        reference: transferForm.reference || undefined,
      });
      if (res.success) {
        toast.success(transferModal.direction === 'in' ? 'Transfer in recorded' : 'Transfer out recorded');
        const updatedWallet = { ...wallet, balance: (res.data as any).wallet?.balance ?? wallet.balance };
        setWallet(updatedWallet);
        cache.set(WALLET_CACHE_KEY, updatedWallet);
        cache.invalidate(LEDGER_CACHE_KEY(wallet.id));
        fetchLedger(wallet.id);
        setTransferModal(null);
        setTransferForm({ amount: '', note: '', reference: '' });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  // ── Settings ─────────────────────────────────────────────────────────────
  const openSettings = () => {
    const raw = wallet?.accountNumber ?? '';
    const [primary, secondary] = raw.split('|');
    setSettingsForm({
      name: wallet?.name ?? supplier.name,
      walletType: wallet?.walletType ?? '',
      accountNumber: wallet?.walletType === 'BANK_PAYBILL' ? '' : (wallet?.walletType === 'MPESA_PAYBILL' ? (primary ?? '') : raw),
      paybillBank: wallet?.walletType === 'BANK_PAYBILL' ? (primary ?? '') : '',
      paybillAccountNo: (wallet?.walletType === 'BANK_PAYBILL' || wallet?.walletType === 'MPESA_PAYBILL') ? (secondary ?? '') : '',
      balance: '',
      debt: String(wallet?.debt ?? ''),
    });
    setShowSettings(true);
    setIsEditing(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsForm.name) { toast.error('Wallet name is required'); return; }
    let accountNum: string | null = null;
    if (settingsForm.walletType === 'BANK_PAYBILL') {
      accountNum = settingsForm.paybillBank + (settingsForm.paybillAccountNo ? `|${settingsForm.paybillAccountNo}` : '');
    } else if (settingsForm.walletType === 'MPESA_PAYBILL') {
      accountNum = settingsForm.accountNumber + (settingsForm.paybillAccountNo ? `|${settingsForm.paybillAccountNo}` : '');
    } else {
      accountNum = settingsForm.accountNumber || null;
    }
    const debt = settingsForm.debt ? parseFloat(settingsForm.debt) : 0;
    const openingBalance = settingsForm.balance ? parseFloat(settingsForm.balance) : undefined;
    setSavingSettings(true);
    try {
      if (!wallet) {
        const created = await walletAPI.createForSupplier(supplier.id, {
          name: settingsForm.name,
          walletType: settingsForm.walletType as WalletKind || null,
          accountNumber: accountNum || null,
          debt,
          openingBalance,
        });
        if (created.success) {
          setWallet(created.data.wallet);
          cache.set(WALLET_CACHE_KEY, created.data.wallet);
        }
      } else {
        const updated = await walletAPI.updateSupplier(supplier.id, {
          name: settingsForm.name,
          walletType: settingsForm.walletType as WalletKind || null,
          accountNumber: accountNum || null,
          debt,
        });
        if (updated.success) {
          setWallet(updated.data.wallet);
          cache.set(WALLET_CACHE_KEY, updated.data.wallet);
        }
      }
      toast.success('Wallet settings saved');
      setShowSettings(false);
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Subscription card ────────────────────────────────────────────────────
  const SubscriptionCard = () => {
    const sub = billingInfo?.subscription ?? null;
    const pkg = sub?.package ?? null;
    const now = Date.now();
    const daysTotal = 30;
    const daysElapsed = sub ? Math.min((now - new Date(sub.startedAt).getTime()) / 86400000, daysTotal) : 0;
    const daysLeft = sub ? Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - now) / 86400000)) : 0;
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
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Go to Management → Subscription to choose a plan</p>
        </div>
      </div>
    );

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-4 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start gap-4 sm:gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-seafoam/10 flex items-center justify-center flex-shrink-0">
              {TierIcon && <TierIcon size={22} className="text-seafoam" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight">{pkg?.name ?? 'Current Plan'}</h3>
                <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20">Tier {pkg?.tier ?? '—'}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${sub.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700'}`}>
                  {sub.isActive ? 'Active' : 'Inactive'}
                </span>
                {sub.autoRenew && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <RefreshCw size={8} /> Auto-renew
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-zinc-400 mt-1">
                {pkg ? `${currency} ${parseFloat(String(pkg.price)).toFixed(2)} / ${pkg.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}` : ''}
              </p>
            </div>
          </div>
          {pkg && (
            <div className="flex gap-6 flex-shrink-0">
              <div className="text-center">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Staff</p>
                <p className="text-base font-black text-pine dark:text-zinc-100">{pkg.maxStaff >= 9999 ? '∞' : pkg.maxStaff.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Storage</p>
                <p className="text-base font-black text-pine dark:text-zinc-100">{pkg.storageGb} GB</p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            <span className="flex items-center gap-1.5"><Calendar size={10} /> Started {new Date(sub.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>{daysLeft} days remaining · {sub.autoRenew ? 'Renews' : 'Expires'} {new Date(sub.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-seafoam rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Charged</p>
            <p className="text-sm font-black text-pine dark:text-zinc-100">{currency} {parseFloat(String(sub.amountPaid ?? 0)).toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1 flex items-center gap-1"><Gift size={8} /> Credit Applied</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {(sub.creditApplied ?? 0) > 0 ? `− ${currency} ${parseFloat(String(sub.creditApplied)).toFixed(2)}` : '—'}
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
  };

  // ── Wallet settings form (shared between Wallet tab and initial setup) ───
  const SettingsForm = ({ needsSetup }: { needsSetup: boolean }) => {
    const meta = settingsForm.walletType ? WALLET_TYPE_META[settingsForm.walletType as WalletKind] : null;
    return (
      <div className="bg-white dark:bg-zinc-900 border-2 border-seafoam/40 rounded-2xl p-6 space-y-5 animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center">
              <Wallet size={18} className="text-seafoam" />
            </div>
            <div>
              <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                {needsSetup ? 'Set Up Your Wallet' : 'Wallet Settings'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Configure how you receive payments
              </p>
            </div>
          </div>
          {!needsSetup && (
            <button onClick={() => { setShowSettings(false); setIsEditing(false); }} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Wallet Name</label>
          <input
            value={settingsForm.name}
            onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
            placeholder={`e.g. ${supplier.name} Main Account`}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          />
        </div>

        {/* Payment type selector */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Payment Method</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {(Object.entries(WALLET_TYPE_META) as [WalletKind, typeof WALLET_TYPE_META[WalletKind]][]).map(([key, m]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSettingsForm(f => ({ ...f, walletType: key, accountNumber: '', paybillBank: '' }))}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wide transition-all ${
                  settingsForm.walletType === key
                    ? 'border-seafoam bg-seafoam/10 text-seafoam'
                    : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam/50 hover:text-seafoam'
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Account / paybill */}
        {meta && (
          <>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{meta.accountLabel}</label>
              {meta.useDropdown ? (
                <div className="relative">
                  <select
                    value={settingsForm.paybillBank}
                    onChange={e => setSettingsForm(f => ({ ...f, paybillBank: e.target.value }))}
                    className="w-full appearance-none px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40 pr-8"
                  >
                    <option value="">Select bank paybill…</option>
                    {KENYA_BANK_PAYBILLS.map(b => (
                      <option key={b.paybill} value={b.paybill}>{b.name} — {b.paybill}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <input
                  value={settingsForm.accountNumber}
                  onChange={e => setSettingsForm(f => ({ ...f, accountNumber: e.target.value }))}
                  placeholder={settingsForm.walletType === 'MPESA_PAYBILL' ? 'Paybill Number' : meta.accountLabel}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                />
              )}
            </div>
            {/* Secondary account number for BANK_PAYBILL and MPESA_PAYBILL */}
            {(settingsForm.walletType === 'BANK_PAYBILL' || settingsForm.walletType === 'MPESA_PAYBILL') && (
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Account Number</label>
                <input
                  value={settingsForm.paybillAccountNo}
                  onChange={e => setSettingsForm(f => ({ ...f, paybillAccountNo: e.target.value }))}
                  placeholder={settingsForm.walletType === 'BANK_PAYBILL' ? 'Your account number at this bank' : 'Account / Store number'}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                />
              </div>
            )}
          </>
        )}

        {/* Current Balance — shown when creating (no wallet yet) */}
        {!wallet && (
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Current Balance ({currency})</label>
            <input
              type="number"
              min="0"
              value={settingsForm.balance}
              onChange={e => setSettingsForm(f => ({ ...f, balance: e.target.value }))}
              placeholder="0.00 — enter existing balance to migrate"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
            />
          </div>
        )}

        {/* Current Debt */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Current Debt ({currency})</label>
          <input
            type="number"
            min="0"
            value={settingsForm.debt}
            onChange={e => setSettingsForm(f => ({ ...f, debt: e.target.value }))}
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          />
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="w-full py-3 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {savingSettings ? <RefreshCw size={13} className="animate-spin" /> : <Wallet size={13} />}
          {savingSettings ? 'Saving…' : (needsSetup ? 'Create Wallet' : 'Save Settings')}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* ── Transfer Modal ─────────────────────────────────────────────────── */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {transferModal.direction === 'in'
                  ? <ArrowDownLeft size={16} className="text-emerald-500" />
                  : <ArrowUpRight size={16} className="text-red-500" />}
                <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                  {transferModal.direction === 'in' ? 'Transfer In' : 'Transfer Out'}
                </p>
              </div>
              <button onClick={() => setTransferModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"><X size={14} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Amount ({currency})</label>
                <input
                  type="number"
                  min="0"
                  value={transferForm.amount}
                  onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-black text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Note <span className="font-normal normal-case">(optional)</span></label>
                <input
                  value={transferForm.note}
                  onChange={e => setTransferForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Payment received for order"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Reference <span className="font-normal normal-case">(optional)</span></label>
                <input
                  value={transferForm.reference}
                  onChange={e => setTransferForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. MPesa code QA3X8F..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setTransferModal(null)} className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                Cancel
              </button>
              <button
                onClick={handleTransferSubmit}
                disabled={transferring}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  transferModal.direction === 'in'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                } disabled:opacity-50`}
              >
                {transferring ? 'Recording…' : `Record ${transferModal.direction === 'in' ? 'In' : 'Out'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header strip ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-seafoam dark:text-zinc-400 font-bold uppercase tracking-widest text-[9px]">Treasury & Subscription Management</p>
        <button className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-seafoam transition-all shadow-sm flex items-center gap-2">
          <Download size={12} /> Ledger
        </button>
      </div>

      {/* ── Overview strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Balance card */}
        <div className="lg:col-span-2 bg-pine dark:bg-zinc-900 rounded-xl p-5 sm:p-6 text-white relative overflow-hidden shadow-xl shadow-pine/30 group flex flex-col justify-between min-h-[160px]">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-seafoam/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.2em] mb-2">Supplier Balance</p>
              {isLoading ? (
                <div className="h-8 w-40 bg-white/20 rounded-lg animate-pulse" />
              ) : (
                <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(wallet?.balance ?? 0)}</h2>
              )}
              {lastRegenAt && (
                <p className="text-white/40 text-[7px] font-bold mt-1 uppercase tracking-widest">
                  Updated {lastRegenAt.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 group-hover:rotate-12 transition-transform">
              <Wallet className="text-seafoam" size={20} />
            </div>
          </div>
          <div className="relative z-10 flex gap-2 mt-4">
            <button
              onClick={handleRegen}
              disabled={isRegening || !wallet}
              className="compact-button bg-white text-pine hover:bg-mist transition-all active:scale-95 shadow-lg flex items-center gap-1.5"
            >
              {isRegening ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Recalculate
            </button>
            <button
              onClick={openSettings}
              className="compact-button bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-all flex items-center gap-1.5"
            >
              <Settings2 size={12} /> Settings
            </button>
          </div>
        </div>

        {/* Growth rate */}
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

        {/* Wallet status */}
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
              <span className="text-pine dark:text-zinc-100">{activeBranchName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex w-full bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-x-auto gap-1">
        {[
          { id: 'summary', label: 'Subscriptions', icon: PieChart },
          { id: 'wallet',  label: 'Wallet',    icon: Wallet },
          { id: 'inflow',  label: 'Inflows',   icon: ArrowDownLeft },
          { id: 'outflow', label: 'Outflows',  icon: ArrowUpRight },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-xl dark:shadow-none border border-slate-200 dark:border-zinc-700'
                : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-100'
            }`}
          >
            <tab.icon size={12} /><span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Summary tab ──────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <SubscriptionCard />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-4 sm:p-8 shadow-sm">
              <div className="flex justify-between items-center mb-5 sm:mb-8">
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
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-4 sm:p-8 shadow-sm">
                <h4 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-4 sm:mb-6">Wallet Details</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Wallet Name', val: wallet?.name || '—' },
                    { label: 'Payment Method', val: wallet?.walletType ? WALLET_TYPE_META[wallet.walletType]?.label : '—' },
                    { label: 'Account / Paybill', val: wallet?.accountNumber || '—' },
                    { label: 'Balance', val: formatCurrency(wallet?.balance ?? 0) },
                    { label: 'Currency', val: wallet?.currency ?? currency },
                    { label: 'Branch', val: activeBranchName },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center text-[9px] font-black uppercase">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="text-pine dark:text-zinc-100">{item.val}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setActiveTab('wallet'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="mt-4 w-full py-2 rounded-xl border border-seafoam/30 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/5 transition-all flex items-center justify-center gap-2"
                >
                  <Settings2 size={11} /> Configure Payment
                </button>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-4 sm:p-8">
                <div className="flex items-center gap-3 mb-3 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Revenue Update</span>
                </div>
                <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                  Use <span className="font-black">Recalculate</span> to recompute your balance from all recorded transactions in the system.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Wallet tab ───────────────────────────────────────────────────── */}
      {activeTab === 'wallet' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          {isLoading ? (
            <div className="h-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
          ) : !wallet || !wallet.walletType ? (
            <SettingsForm needsSetup={true} />
          ) : (
            <>
              {/* Wallet card */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-seafoam/10 flex items-center justify-center text-seafoam shrink-0">
                      <Wallet size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{wallet.name}</p>
                      <span className="text-[9px] font-bold uppercase text-seafoam">{activeBranchName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => isEditing ? (setIsEditing(false), setShowSettings(false)) : openSettings()}
                    className="shrink-0 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-all"
                  >
                    {isEditing ? <X size={13} /> : <Edit2 size={13} />}
                  </button>
                </div>

                {/* Wallet name + type */}
                {(() => {
                  const meta = wallet.walletType ? WALLET_TYPE_META[wallet.walletType] : null;
                  return (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                        {meta?.icon ?? <Wallet size={13} />}
                      </div>
                      <div>
                        <p className="text-sm font-black text-pine dark:text-zinc-100">{wallet.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                          {meta?.label ?? 'Wallet'}
                          {wallet.accountNumber ? (() => {
                            const [primary, secondary] = wallet.accountNumber.split('|');
                            return secondary ? ` · ${primary} / ${secondary}` : ` · ${primary}`;
                          })() : ''}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Balance */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">Current Balance</p>
                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(wallet.balance ?? 0)}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-0.5">Currency</p>
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{wallet.currency ?? currency}</p>
                  </div>
                </div>

                {/* Transfer actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setTransferModal({ direction: 'in' }); setTransferForm({ amount: '', note: '', reference: '' }); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all"
                  >
                    <ArrowDownLeft size={12} /> Transfer In
                  </button>
                  <button
                    onClick={() => { setTransferModal({ direction: 'out' }); setTransferForm({ amount: '', note: '', reference: '' }); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] font-black uppercase hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                  >
                    <ArrowUpRight size={12} /> Transfer Out
                  </button>
                </div>

                {/* Recent ledger entries */}
                {(() => {
                  if (ledgerLoading) return <p className="text-[9px] text-slate-400 mt-3">Loading history…</p>;
                  if (ledgerEntries.length === 0) return null;
                  const typeLabels: Record<string, string> = {
                    TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
                    STOCK_PURCHASE: 'Stock Purchase', PAYMENT_RECEIVED: 'Payment', ADJUSTMENT: 'Adjustment',
                  };
                  return (
                    <div className="mt-3 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Recent Activity</p>
                      {ledgerEntries.map(entry => {
                        const isCredit = entry.type === 'TRANSFER_IN' || entry.type === 'PAYMENT_RECEIVED';
                        return (
                          <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800 last:border-0">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{typeLabels[entry.type] ?? entry.type}</p>
                              {entry.note && <p className="text-[9px] text-slate-400 truncate">{entry.note}</p>}
                            </div>
                            <p className={`text-[10px] font-black shrink-0 ml-2 ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                              {isCredit ? '+' : '-'}{formatCurrency(entry.amount)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {(showSettings || isEditing) && <div className="mt-4"><SettingsForm needsSetup={false} /></div>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Inflows / Outflows tabs ───────────────────────────────────────── */}
      {['inflow', 'outflow'].includes(activeTab) && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in zoom-in-95">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                placeholder="Filter ledger..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-[11px] text-pine dark:text-zinc-100 outline-none w-full sm:w-56 focus:ring-2 focus:ring-seafoam/20 transition-all font-bold"
              />
            </div>
            <button className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-all shadow-sm shrink-0">
              <Filter size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800">
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry ID</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Type</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Note</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                {(() => {
                  const filtered = ledgerEntries.filter(e => {
                    const isInflow = e.type === 'TRANSFER_IN' || e.type === 'PAYMENT_RECEIVED';
                    if (activeTab === 'inflow' && !isInflow) return false;
                    if (activeTab === 'outflow' && isInflow) return false;
                    if (searchQuery) return e.note?.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toString().includes(searchQuery);
                    return true;
                  });
                  if (filtered.length === 0) return (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">No {activeTab} entries found</p>
                        <p className="text-slate-400 dark:text-zinc-500 text-xs mt-2">Transaction history will appear here once orders are processed.</p>
                      </td>
                    </tr>
                  );
                  return filtered.map(entry => {
                    const isCredit = entry.type === 'TRANSFER_IN' || entry.type === 'PAYMENT_RECEIVED';
                    const typeLabels: Record<string, string> = {
                      TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
                      STOCK_PURCHASE: 'Stock Purchase', PAYMENT_RECEIVED: 'Payment', ADJUSTMENT: 'Adjustment',
                    };
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-all">
                        <td className="px-4 sm:px-8 py-4 sm:py-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isCredit ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {isCredit ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                            </div>
                            <p className="text-pine dark:text-zinc-100 font-black text-sm truncate">#{entry.id}</p>
                          </div>
                        </td>
                        <td className="px-4 sm:px-8 py-4 sm:py-5 hidden sm:table-cell">
                          <p className="text-pine dark:text-zinc-100 font-bold text-xs">{typeLabels[entry.type] ?? entry.type}</p>
                        </td>
                        <td className="px-4 sm:px-8 py-4 sm:py-5">
                          <p className="text-pine dark:text-zinc-200 font-bold text-xs whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="px-4 sm:px-8 py-4 sm:py-5">
                          <p className="text-slate-400 text-xs truncate max-w-[150px]">{entry.note || '—'}</p>
                        </td>
                        <td className="px-4 sm:px-8 py-4 sm:py-5 text-right">
                          <p className={`font-mono font-black text-sm whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {isCredit ? '+' : '-'} {formatCurrency(entry.amount)}
                          </p>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierWallet;

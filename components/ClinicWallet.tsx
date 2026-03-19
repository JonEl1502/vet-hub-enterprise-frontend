
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
  Plus,
  X,
  Landmark,
  Smartphone,
  Hash,
  CreditCard,
  ChevronDown,
  Edit2,
  Link,
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
import { stripeAPI } from '../services/modules/stripe.api';
import { walletAPI, Wallet as WalletType, WalletType as WalletKind } from '../services/modules/wallet.api';
import { toast } from '../services/utils/toast';

// ── Kenya bank paybills ────────────────────────────────────────────────────
const KENYA_BANK_PAYBILLS = [
  { name: 'KCB Bank',              paybill: '522522' },
  { name: 'Equity Bank',           paybill: '247247' },
  { name: 'NCBA Bank',             paybill: '880100' },
  { name: 'Co-operative Bank',     paybill: '400200' },
  { name: 'Standard Chartered',    paybill: '329329' },
  { name: 'Absa Bank Kenya',       paybill: '303030' },
  { name: 'I&M Bank',              paybill: '542542' },
  { name: 'DTB (Diamond Trust)',   paybill: '516600' },
  { name: 'Family Bank',           paybill: '222111' },
  { name: 'SBM Bank Kenya',        paybill: '5033005' },
  { name: 'Stanbic Bank Kenya',    paybill: '600100' },
  { name: 'Ecobank Kenya',         paybill: '700200' },
  { name: 'HF Group',              paybill: '572572' },
  { name: 'National Bank of Kenya',paybill: '625625' },
  { name: 'Consolidated Bank',     paybill: '262262' },
  { name: 'Sidian Bank',           paybill: '510055' },
  { name: 'Bank of Africa',        paybill: '980055' },
  { name: 'Prime Bank',            paybill: '000200' },
  { name: 'Paramount Bank',        paybill: '200999' },
  { name: 'Credit Bank',           paybill: '302500' },
] as const;

const WALLET_TYPE_META: Record<WalletKind, { label: string; icon: React.ReactNode; accountLabel: string; useDropdown: boolean }> = {
  BANK:          { label: 'Bank Account',    icon: <Landmark size={14} />,  accountLabel: 'Account Number', useDropdown: false },
  MPESA_POCHI:   { label: 'MPesa Pochi',     icon: <Smartphone size={14} />, accountLabel: 'Phone Number',   useDropdown: false },
  BANK_PAYBILL:  { label: 'Bank Paybill',    icon: <CreditCard size={14} />, accountLabel: 'Bank Paybill',   useDropdown: true  },
  TILL:          { label: 'Till Number',     icon: <Hash size={14} />,       accountLabel: 'Till Number',     useDropdown: false },
  MPESA_PAYBILL: { label: 'MPesa Paybill',   icon: <Smartphone size={14} />, accountLabel: 'Paybill Number', useDropdown: false },
};

interface BranchWithClinic {
  id: string;
  name: string;
  logo: string;
  subdomain: string;
  isMain?: boolean;
}

interface Props {
  clinic: Clinic;
  allClinics?: BranchWithClinic[];
  transactions: Transaction[];
  onAddTransaction: (from: number, to: number, amount: number, type: Transaction['type'], method: PaymentMethod) => void;
}

const emptyForm = () => ({
  name: '',
  walletType: '' as WalletKind | '',
  accountNumber: '',
  paybillBank: '',
  debt: '',
  usesMainWallet: false,
});

const ClinicWallet: React.FC<Props> = ({ clinic, allClinics = [], transactions, onAddTransaction }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'wallets' | 'client' | 'b2b' | 'outflow'>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [billingInfo, setBillingInfo] = useState<any>(null);

  // Wallet state
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null); // branchId | 'main' | null
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);

  // Fetch subscription + billing (same source as BillingView)
  useEffect(() => {
    if (!clinic?.id) return;
    stripeAPI.getInfo(String(clinic.id))
      .then(res => { if (res.success) setBillingInfo(res.data); })
      .catch(() => {});
  }, [clinic?.id]);

  // Fetch wallets
  const fetchWallets = async () => {
    if (!clinic?.id) return;
    setWalletsLoading(true);
    try {
      const res = await walletAPI.getByEntity('CLINIC', String(clinic.id));
      if (res.success) setWallets(res.data.wallets);
    } catch {
      // silent
    } finally {
      setWalletsLoading(false);
    }
  };

  useEffect(() => { fetchWallets(); }, [clinic?.id]);

  const handleEnsureWallet = async () => {
    if (!clinic?.id) return;
    setEnsuring(true);
    try {
      const res = await walletAPI.ensure('CLINIC', String(clinic.id));
      if (res.success) {
        toast.success('Wallet created');
        fetchWallets();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create wallet');
    } finally {
      setEnsuring(false);
    }
  };

  // Branches list: main clinic + all other clinics
  const branches = useMemo<BranchWithClinic[]>(() => {
    const main: BranchWithClinic = { id: String(clinic.id), name: clinic.name, logo: clinic.logo || '🏥', subdomain: clinic.subdomain || '', isMain: true };
    const others = allClinics.filter(c => String(c.id) !== String(clinic.id)).map(c => ({ ...c, id: String(c.id), isMain: false }));
    return [main, ...others];
  }, [clinic, allClinics]);

  // Map wallets by branchId (null = main)
  const walletByBranch = useMemo(() => {
    const map: Record<string, WalletType> = {};
    wallets.forEach(w => {
      const key = w.branchId ?? 'main';
      map[key] = w;
    });
    return map;
  }, [wallets]);

  const mainWallet = wallets.find(w => !w.branchId) ?? null;

  // Transactions
  const clinicTransactions = useMemo(() =>
    transactions.filter(tx => tx.fromId === clinic.id || tx.toId === clinic.id),
    [transactions, clinic.id]);

  const stats = useMemo(() => {
    const clientRev = clinicTransactions.filter(tx => tx.toId === clinic.id && tx.type === 'SERVICE');
    const b2bRev    = clinicTransactions.filter(tx => tx.toId === clinic.id && tx.type === 'REFERRAL');
    const outflows  = clinicTransactions.filter(tx => tx.fromId === clinic.id);
    return {
      totalClientRev: clientRev.reduce((a, tx) => a + tx.amount, 0),
      totalB2BRev:    b2bRev.reduce((a, tx) => a + tx.amount, 0),
      totalOutflow:   outflows.reduce((a, tx) => a + tx.amount, 0),
      count: clinicTransactions.length,
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
    if (activeTab === 'b2b')    list = clinicTransactions.filter(tx => tx.type === 'REFERRAL');
    if (activeTab === 'outflow')list = clinicTransactions.filter(tx => tx.fromId === clinic.id);
    return list.filter(tx => tx.id.toString().includes(searchQuery) || tx.method.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [clinicTransactions, activeTab, clinic.id, searchQuery]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: clinic.currency, maximumFractionDigits: 0 }).format(val);

  // ── Wallet form submit ───────────────────────────────────────────────────
  const handleSaveWallet = async () => {
    if (!form.name || !form.walletType) { toast.error('Name and wallet type are required'); return; }
    const accountNum = form.walletType === 'BANK_PAYBILL' ? form.paybillBank : form.accountNumber;
    setSaving(true);
    try {
      if (editingWalletId) {
        await walletAPI.update(editingWalletId, {
          name: form.name,
          walletType: form.walletType as WalletKind,
          accountNumber: accountNum || null,
          debt: form.debt ? parseFloat(form.debt) : 0,
          usesMainWallet: form.usesMainWallet,
        });
        toast.success('Wallet updated');
      } else {
        const branchId = creatingFor === 'main' ? null : creatingFor;
        if (form.usesMainWallet && branchId) {
          // Mark branch as using main wallet — create a placeholder record with the flag
          await walletAPI.create({
            entityType: 'CLINIC',
            profileId: String(clinic.id),
            name: form.name,
            branchId,
            walletType: form.walletType as WalletKind,
            accountNumber: accountNum || null,
            debt: form.debt ? parseFloat(form.debt) : 0,
            usesMainWallet: true,
          });
        } else {
          await walletAPI.create({
            entityType: 'CLINIC',
            profileId: String(clinic.id),
            name: form.name,
            branchId,
            walletType: form.walletType as WalletKind,
            accountNumber: accountNum || null,
            debt: form.debt ? parseFloat(form.debt) : 0,
            usesMainWallet: false,
          });
        }
        toast.success('Wallet created');
      }
      setCreatingFor(null);
      setEditingWalletId(null);
      setForm(emptyForm());
      fetchWallets();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save wallet');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = (branchId: string | null) => {
    setEditingWalletId(null);
    setForm(emptyForm());
    setCreatingFor(branchId === null ? 'main' : branchId);
  };

  const openEdit = (wallet: WalletType) => {
    setCreatingFor(null);
    setEditingWalletId(wallet.id);
    setForm({
      name: wallet.name,
      walletType: wallet.walletType ?? '',
      accountNumber: wallet.walletType === 'BANK_PAYBILL' ? '' : (wallet.accountNumber ?? ''),
      paybillBank: wallet.walletType === 'BANK_PAYBILL' ? (wallet.accountNumber ?? '') : '',
      debt: String(wallet.debt ?? ''),
      usesMainWallet: wallet.usesMainWallet,
    });
  };

  const cancelForm = () => { setCreatingFor(null); setEditingWalletId(null); setForm(emptyForm()); };

  // ── Wallet form panel ────────────────────────────────────────────────────
  const WalletForm = ({ forBranchId, isEdit }: { forBranchId?: string | null; isEdit?: boolean }) => {
    const meta = form.walletType ? WALLET_TYPE_META[form.walletType as WalletKind] : null;
    const isBranch = forBranchId !== null && forBranchId !== undefined && forBranchId !== 'main';
    return (
      <div className="border border-seafoam/30 bg-seafoam/5 rounded-2xl p-5 space-y-4 mt-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">{isEdit ? 'Edit Wallet' : 'New Wallet'}</p>
          <button onClick={cancelForm} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"><X size={14} /></button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Wallet Name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. KCB Operating Account"
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Type</label>
          <div className="relative">
            <select
              value={form.walletType}
              onChange={e => setForm(f => ({ ...f, walletType: e.target.value as WalletKind, accountNumber: '', paybillBank: '' }))}
              className="w-full appearance-none px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40 pr-8"
            >
              <option value="">Select type…</option>
              {(Object.keys(WALLET_TYPE_META) as WalletKind[]).map(k => (
                <option key={k} value={k}>{WALLET_TYPE_META[k].label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Account number / paybill */}
        {meta && (
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">{meta.accountLabel}</label>
            {meta.useDropdown ? (
              <div className="relative">
                <select
                  value={form.paybillBank}
                  onChange={e => setForm(f => ({ ...f, paybillBank: e.target.value }))}
                  className="w-full appearance-none px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40 pr-8"
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
                value={form.accountNumber}
                onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder={meta.accountLabel}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
              />
            )}
          </div>
        )}

        {/* Current Debt */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Current Debt (KES)</label>
          <input
            type="number"
            min="0"
            value={form.debt}
            onChange={e => setForm(f => ({ ...f, debt: e.target.value }))}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          />
        </div>

        {/* Use same as main branch — only for non-main branches */}
        {isBranch && !isEdit && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.usesMainWallet}
              onChange={e => setForm(f => ({ ...f, usesMainWallet: e.target.checked }))}
              className="w-4 h-4 rounded accent-seafoam"
            />
            <span className="text-xs font-semibold text-pine dark:text-zinc-100">Use same wallet as main branch</span>
          </label>
        )}

        <button
          onClick={handleSaveWallet}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : (isEdit ? 'Update Wallet' : 'Create Wallet')}
        </button>
      </div>
    );
  };

  // ── Wallet card for a branch ─────────────────────────────────────────────
  const WalletCard = ({ branch }: { branch: BranchWithClinic }) => {
    const key = branch.isMain ? 'main' : branch.id;
    const wallet = walletByBranch[key];
    const isCreating = creatingFor === key;
    const isEditing = editingWalletId === wallet?.id;
    const meta = wallet?.walletType ? WALLET_TYPE_META[wallet.walletType] : null;

    if (wallet?.usesMainWallet && mainWallet) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-seafoam/10 flex items-center justify-center text-base shrink-0">{branch.logo}</div>
              <div>
                <p className="text-xs font-black text-pine dark:text-zinc-100">{branch.name}</p>
                {branch.isMain && <span className="text-[9px] font-bold uppercase text-seafoam">Main Branch</span>}
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase">
              <Link size={9} /> Uses Main Wallet
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">
            Linked to: <span className="font-bold text-pine dark:text-zinc-100">{mainWallet.name}</span>
          </p>
        </div>
      );
    }

    if (!wallet) {
      return (
        <div className="bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0">{branch.logo}</div>
              <div>
                <p className="text-xs font-black text-pine dark:text-zinc-100">{branch.name}</p>
                {branch.isMain && <span className="text-[9px] font-bold uppercase text-seafoam">Main Branch</span>}
              </div>
            </div>
            <button
              onClick={() => openCreate(branch.isMain ? null : branch.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-seafoam/10 text-seafoam text-[10px] font-black uppercase hover:bg-seafoam/20 transition-all"
            >
              <Plus size={12} /> Set Up Wallet
            </button>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">No wallet configured for this branch.</p>
          {isCreating && <WalletForm forBranchId={branch.isMain ? null : branch.id} />}
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-seafoam/10 flex items-center justify-center text-base shrink-0">{branch.logo}</div>
            <div className="min-w-0">
              <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{branch.name}</p>
              {branch.isMain && <span className="text-[9px] font-bold uppercase text-seafoam">Main Branch</span>}
            </div>
          </div>
          <button
            onClick={() => isEditing ? cancelForm() : openEdit(wallet)}
            className="shrink-0 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-all"
          >
            {isEditing ? <X size={13} /> : <Edit2 size={13} />}
          </button>
        </div>

        {/* Wallet name + type */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400">
            {meta?.icon ?? <Wallet size={13} />}
          </div>
          <div>
            <p className="text-sm font-black text-pine dark:text-zinc-100">{wallet.name}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{meta?.label ?? 'Wallet'}{wallet.accountNumber ? ` · ${wallet.accountNumber}` : ''}</p>
          </div>
        </div>

        {/* Float + Debt */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">Current Float</p>
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">KES {parseFloat(String(wallet.balance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className={`rounded-xl p-3 ${wallet.debt > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-slate-50 dark:bg-zinc-800/60'}`}>
            <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${wallet.debt > 0 ? 'text-red-500' : 'text-slate-400 dark:text-zinc-500'}`}>Current Debt</p>
            <p className={`text-sm font-black ${wallet.debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-zinc-500'}`}>KES {parseFloat(String(wallet.debt || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {isEditing && <WalletForm forBranchId={branch.isMain ? null : branch.id} isEdit />}
      </div>
    );
  };

  // ── Subscription card (uses stripeAPI data — same as BillingView) ────────
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
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Go to Billing to choose a plan</p>
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
                {pkg ? `${clinic.currency} ${parseFloat(String(pkg.price)).toFixed(2)} / ${pkg.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}` : ''}
              </p>
            </div>
          </div>
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
            <p className="text-sm font-black text-pine dark:text-zinc-100">{clinic.currency} {parseFloat(String(sub.amountPaid ?? 0)).toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1 flex items-center gap-1"><Gift size={8} /> Credit Applied</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {(sub.creditApplied ?? 0) > 0 ? `− ${clinic.currency} ${parseFloat(String(sub.creditApplied)).toFixed(2)}` : '—'}
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <p className="text-seafoam dark:text-zinc-400 font-bold uppercase tracking-widest text-[9px]">Treasury & Subscription Management</p>
        <button className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-seafoam transition-all shadow-sm flex items-center gap-2">
          <Download size={12} /> Ledger
        </button>
      </div>

      {/* Overview strip */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 bg-pine dark:bg-zinc-900 rounded-xl p-5 sm:p-6 text-white relative overflow-hidden shadow-xl shadow-pine/30 group flex flex-col justify-between min-h-[160px]">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-seafoam/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.2em] mb-2">Clinical Liquidity</p>
              <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(clinic.balance)}</h2>
            </div>
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
              <Wallet className="text-seafoam" size={20} />
            </div>
          </div>
        </div>
        <div className="compact-card flex flex-col justify-between hover:border-seafoam transition-all">
          <div>
            <p className="card-subtitle mb-1">Growth Rate</p>
            <h3 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">+24.5%</h3>
          </div>
          <div className="h-16 w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}><Bar dataKey="income" fill="#438883" radius={[4, 4, 0, 0]} /></BarChart>
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
              <span>Settled</span><span className="text-pine dark:text-zinc-100">92%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-50 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[92%] transition-all duration-1000" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-x-auto gap-1">
        {[
          { id: 'summary', label: 'Treasury',  icon: PieChart },
          { id: 'wallets', label: 'Wallets',   icon: Wallet },
          { id: 'client',  label: 'Clinical',  icon: Users },
          { id: 'b2b',     label: 'Referrals', icon: Building2 },
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

      {/* ── Summary tab ─────────────────────────────────────────────────── */}
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
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-4 sm:p-8 shadow-sm">
                <h4 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-4 sm:mb-6">Revenue Streams</h4>
                <div className="space-y-6">
                  {[
                    { label: 'Clinical Services', val: stats.totalClientRev, color: 'bg-seafoam', p: 72 },
                    { label: 'B2B Referrals', val: stats.totalB2BRev, color: 'bg-cyan', p: 21 },
                  ].map(r => (
                    <div key={r.label} className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                        <span>{r.label}</span><span className="text-pine dark:text-zinc-100">{formatCurrency(r.val)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full ${r.color} transition-all duration-1000`} style={{ width: `${r.p}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-4 sm:p-8">
                <div className="flex items-center gap-3 mb-3 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={18}/><span className="text-[10px] font-black uppercase tracking-widest">Revenue Update</span>
                </div>
                <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                  Clinical revenue is trending <span className="font-black">18% above target</span>. Performance is optimal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Wallets tab ──────────────────────────────────────────────────── */}
      {activeTab === 'wallets' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} configured
            </p>
            <button
              onClick={fetchWallets}
              disabled={walletsLoading}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-seafoam transition-all"
            >
              <RefreshCw size={13} className={walletsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {walletsLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : wallets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 bg-white dark:bg-zinc-900 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-seafoam/10 flex items-center justify-center">
                <Wallet size={24} className="text-seafoam" />
              </div>
              <div>
                <p className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">No Wallet Configured</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Set up a wallet to start tracking your clinic's finances</p>
              </div>
              <button
                onClick={handleEnsureWallet}
                disabled={ensuring}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {ensuring ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                {ensuring ? 'Creating…' : 'Create Wallet'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branches.map(branch => (
                <WalletCard key={branch.id} branch={branch} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Ledger tabs (client, b2b, outflow) ──────────────────────────── */}
      {['client', 'b2b', 'outflow'].includes(activeTab) && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in zoom-in-95">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
              <input
                placeholder="Filter ledger..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-[11px] text-pine dark:text-zinc-100 outline-none w-full sm:w-56 focus:ring-2 focus:ring-seafoam/20 transition-all font-bold"
              />
            </div>
            <button className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-all shadow-sm shrink-0"><Filter size={14}/></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800">
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry ID</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Method</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 sm:px-8 py-4 sm:py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                {filteredTransactions.length > 0 ? filteredTransactions.map(tx => {
                  const isIncome = tx.toId === clinic.id;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-all">
                      <td className="px-4 sm:px-8 py-4 sm:py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {isIncome ? <ArrowDownLeft size={15}/> : <ArrowUpRight size={15}/>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-black text-sm truncate">#{tx.id}</p>
                            <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{tx.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 hidden sm:table-cell"><p className="text-pine dark:text-zinc-100 font-bold text-xs">{tx.method}</p></td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5"><p className="text-pine dark:text-zinc-200 font-bold text-xs whitespace-nowrap">{tx.date}</p></td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5">
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${tx.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 text-right">
                        <p className={`font-mono font-black text-sm whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                        </p>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={5} className="py-16 text-center"><p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">No ledger entries found</p></td></tr>
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

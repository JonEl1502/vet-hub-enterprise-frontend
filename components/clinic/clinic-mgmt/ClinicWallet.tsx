
import ClinicStatsTab from '../dashboard/ClinicStatsTab';
import React, { useState, useMemo, useEffect } from 'react';
import { Clinic, Transaction, PaymentMethod } from '../../../types';
import { useData } from '../../../contexts/DataContext';
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
  Trash2,
  Eye,
  EyeOff,
  BarChart3 as ClinicStatsIcon,
} from 'lucide-react';
import ClinicStatistics from '../billing/ClinicStatistics';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  PieChart as RePieChart,
  Pie,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { walletAPI, Wallet as WalletType, WalletType as WalletKind, WalletLedgerEntry } from '../../../services/modules/wallet.api';
import { paymentGatewaysAPI } from '../../../services/modules/paymentGateways.api';
import { purchaseOrderAPI } from '../../../services/modules/purchaseOrders.api';
import { transactionsAPI, Transaction as ApiTransaction } from '../../../services/modules/transactions.api';
import { toast } from '../../../services/utils/toast';
import { dialog } from '../../../services/utils/dialog';
import { cache } from '../../../services/utils/cache';
import CurrencyAmountInput from '../../shared/common/CurrencyAmountInput';

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

const WALLET_TYPE_META: Record<WalletKind, { label: string; icon: React.ReactNode; accountLabel: string; useDropdown: boolean; isVirtual?: boolean; realSupported?: boolean }> = {
  // realSupported = available as a Real (gateway-backed) kind today.
  // Right now only the Mpesa rails are wired; Bank / Digital Wallet
  // are virtual-only until those integrations land.
  BANK:           { label: 'Bank Account',    icon: <Landmark size={14} />,   accountLabel: 'Account Number', useDropdown: false, realSupported: false },
  DIGITAL_WALLET: { label: 'Digital Wallet',  icon: <Wallet size={14} />,     accountLabel: 'Account / Email', useDropdown: false, realSupported: false },
  MPESA_POCHI:    { label: 'MPesa Pochi',     icon: <Smartphone size={14} />, accountLabel: 'Phone Number',    useDropdown: false, realSupported: true  },
  TILL:           { label: 'Till Number',     icon: <Hash size={14} />,       accountLabel: 'Till Number',     useDropdown: false, realSupported: true  },
  MPESA_PAYBILL:  { label: 'MPesa Paybill',   icon: <Smartphone size={14} />, accountLabel: 'Paybill Number',  useDropdown: false, realSupported: true  },
  BANK_PAYBILL:   { label: 'Bank Paybill',    icon: <CreditCard size={14} />, accountLabel: 'Bank Paybill',    useDropdown: true,  realSupported: false },
  // Legacy enum value — only kept so old rows still render. New
  // virtual wallets carry a real subtype + isVirtual=true instead.
  VIRTUAL:        { label: 'Virtual Wallet',  icon: <Wallet size={14} />,     accountLabel: '',                useDropdown: false, isVirtual: true },
};

interface BranchWithClinic {
  id: string;
  name: string;
  logo: string;
  subdomain: string;
  isMain?: boolean;
  parentClinicId?: string | null;
  // Wallet-management routing (set when building the in-scope branch list):
  entityClinicId?: string;   // clinic (profileId) to create/manage wallets under
  branchId?: string | null;  // null = entity-level wallet, else child branch id
  clinicName?: string;       // owning top-level clinic name — shown in multi-scope
}

interface Props {
  clinic: Clinic;
  allClinics?: BranchWithClinic[];
  transactions: Transaction[];
  onAddTransaction: (from: number, to: number, amount: number, type: Transaction['type'], method: PaymentMethod) => void;
  // All clinics currently in scope (multi-select). When more than one is
  // selected the wallet totals, list and statistics aggregate across all of
  // them; defaults to just `clinic` when omitted (single-clinic behaviour).
  scopeClinics?: Clinic[];
}

const emptyForm = () => ({
  name: '',
  walletType: '' as WalletKind | '',
  accountNumber: '',       // primary: phone / till / mpesa paybill no / bank acc no
  paybillBank: '',         // BANK_PAYBILL: selected paybill from dropdown
  paybillAccountNo: '',    // BANK_PAYBILL: account number at that bank; MPESA_PAYBILL: account number
  balance: '',             // opening/current balance
  debt: '',
  usesMainWallet: false,
  // Mpesa BYOK credentials — only collected when walletGroup === 'real'.
  // Common fields above (name, balance, debt) are preserved when the
  // user toggles between Virtual and Real, the credential fields are
  // not (no value carry-over for an empty Virtual wallet).
  mpesaShortcode: '',
  mpesaConsumerKey: '',
  mpesaConsumerSecret: '',
  mpesaPasskey: '',
  mpesaTestMode: true,
  intent: '',              // free-text "what is this account for?"
});

// eslint-disable-next-line
const ClinicWallet: React.FC<Props> = ({ clinic, allClinics = [], transactions: propTransactions, onAddTransaction, scopeClinics }) => {
  // Clinics in scope — the active clinic when nothing else is selected, or the
  // full multi-select when the user has scoped into several at once.
  const scopeClinicList = useMemo<Clinic[]>(
    () => (scopeClinics && scopeClinics.length ? scopeClinics : (clinic ? [clinic] : [])),
    [scopeClinics, clinic],
  );
  const scopeKey = scopeClinicList.map(c => String(c.id)).join(',');
  const multiScope = scopeClinicList.length > 1;
  // Set of every in-scope clinic id — drives "is this transaction ours?" tests
  // so the headline stats span the whole selection, not just the active clinic.
  const scopeIdSet = useMemo(() => new Set(scopeClinicList.map(c => String(c.id))), [scopeKey]);
  const { transactions: dataTransactions, ensureTransactions } = useData();
  // Use real API transactions; fall back to prop (store mock) only if DataContext is empty
  const transactions = dataTransactions.length > 0 ? (dataTransactions as any[]) : propTransactions;

  useEffect(() => { ensureTransactions(); }, [ensureTransactions]);

  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'wallets' | 'summary' | 'client' | 'b2b' | 'outflow'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Wallet state
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null); // branch card id (clinic id) being set up, or null
  // When set, the nice Virtual/Real chooser flow is shown for the
  // referenced branch. `undefined` = chooser closed; `null` = creating
  // an entity-level (main) wallet; string = creating for that branch.
  const [richCreateBranchId, setRichCreateBranchId] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState(emptyForm());
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggleReveal = (key: string) => setRevealed((m) => ({ ...m, [key]: !m[key] }));
  const [saving, setSaving] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  // Tracks the top-level Virtual / Real choice independently of the
  // specific gateway-backed walletType, so picking "Real" can reveal
  // the sub-grid before any specific gateway is chosen.
  const [walletGroup, setWalletGroup] = useState<'virtual' | 'real' | null>(null);

  // Transfer modal state
  const [transferModal, setTransferModal] = useState<{ walletId: string; direction: 'in' | 'out' } | null>(null);
  const [transferForm, setTransferForm] = useState({ amount: '', note: '', reference: '' });
  const [transferring, setTransferring] = useState(false);

  // Ledger state: map of walletId → entries
  const [ledgerMap, setLedgerMap] = useState<Record<string, WalletLedgerEntry[]>>({});
  const [ledgerLoading, setLedgerLoading] = useState<Record<string, boolean>>({});

  // Reconsolidate page state
  const [reconModal, setReconModal] = useState<{ walletId: string } | null>(null);
  const [reconFrom, setReconFrom] = useState('');
  const [reconTo, setReconTo] = useState('');
  const [reconDirection, setReconDirection] = useState<'credit' | 'debit' | 'stock'>('credit');
  const [reconAmount, setReconAmount] = useState('');
  const [reconLoading, setReconLoading] = useState(false);
  const [reconStockOrders, setReconStockOrders] = useState<any[]>([]);
  const [reconStockLoading, setReconStockLoading] = useState(false);
  // DB-queried transactions for reconsolidate
  const [reconTxns, setReconTxns] = useState<ApiTransaction[]>([]);
  const [reconSearchLoading, setReconSearchLoading] = useState(false);
  const [reconSearched, setReconSearched] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<7 | 30 | 90>(30);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('line');
  // Per-wallet activity tab selection. Default 'all'. Tabs map to the
  // WalletLedgerType filter applied to the recent-activity panel.
  type WalletActivityTab = 'all' | 'payments' | 'transfers' | 'stock' | 'adjust';
  const [walletActivityTab, setWalletActivityTab] = useState<Record<string, WalletActivityTab>>({});
  // Carousel selection — which branch's wallet to expand below the
  // horizontal scroll strip. Defaults to the main branch.
  const [selectedBranchKey, setSelectedBranchKey] = useState<string>('main');


  const WALLETS_CACHE_KEY = '/wallets';
  const LEDGER_CACHE_KEY  = '/wallet-ledger';
  const WALLET_TTL = 10 * 60 * 1000; // 10 min
  const LEDGER_TTL =  5 * 60 * 1000; //  5 min

  // Fetch wallets for every in-scope clinic and merge them. Serves from cache
  // first (per clinic) so the spinner only shows on a genuine miss, then
  // refetches in the background to refresh stale entries.
  const fetchWallets = async (silent = false) => {
    const ids = scopeClinicList.map(c => String(c.id)).filter(Boolean);
    if (!ids.length) return;
    if (!silent) {
      const cached = ids.map(id => cache.get<WalletType[]>(WALLETS_CACHE_KEY, { entity: 'CLINIC', id }));
      if (cached.every(Boolean)) { setWallets((cached as WalletType[][]).flat()); return; }
      setWalletsLoading(true);
    }
    try {
      const results = await Promise.all(ids.map(async id => {
        try {
          const res = await walletAPI.getByEntity('CLINIC', id);
          if (res.success) {
            cache.set(WALLETS_CACHE_KEY, res.data.wallets, { entity: 'CLINIC', id }, WALLET_TTL);
            return res.data.wallets;
          }
        } catch {
          // silent
        }
        return [] as WalletType[];
      }));
      setWallets(results.flat());
    } finally {
      setWalletsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchWallets(); }, [scopeKey]);

  const fetchLedger = async (walletId: string, bust = false) => {
    const cacheParams = { walletId };
    if (!bust) {
      const cached = cache.get<WalletLedgerEntry[]>(LEDGER_CACHE_KEY, cacheParams);
      if (cached) { setLedgerMap(prev => ({ ...prev, [walletId]: cached })); return; }
    }
    setLedgerLoading(prev => ({ ...prev, [walletId]: true }));
    try {
      const res = await walletAPI.getLedger(walletId, { limit: 5 });
      if (res.success) {
        cache.set(LEDGER_CACHE_KEY, res.data.entries, cacheParams, LEDGER_TTL);
        setLedgerMap(prev => ({ ...prev, [walletId]: res.data.entries }));
      }
    } catch {
      // silent
    } finally {
      setLedgerLoading(prev => ({ ...prev, [walletId]: false }));
    }
  };

  // Fetch ledger for all wallets once loaded
  useEffect(() => {
    wallets.forEach(w => { if (!ledgerMap[w.id]) fetchLedger(w.id); });
  }, [wallets]);

  const handleTransferSubmit = async () => {
    if (!transferModal) return;
    const amount = parseFloat(transferForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setTransferring(true);
    try {
      const fn = transferModal.direction === 'in' ? walletAPI.transferIn : walletAPI.transferOut;
      const res = await fn(transferModal.walletId, {
        amount,
        note: transferForm.note || undefined,
        reference: transferForm.reference || undefined,
      });
      if (res.success) {
        toast.success(transferModal.direction === 'in' ? 'Transfer in recorded' : 'Transfer out recorded');
        // Bust caches then refresh — invalidate the cache of the clinic that
        // owns this wallet (may differ from the active clinic when multi-scoped).
        const ownerId = String(res.data.wallet.profileId ?? clinic.id);
        cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: ownerId });
        cache.invalidate(LEDGER_CACHE_KEY, { walletId: transferModal.walletId });
        setWallets(prev => prev.map(w => w.id === res.data.wallet.id ? res.data.wallet : w));
        fetchLedger(transferModal.walletId, true);
        setTransferModal(null);
        setTransferForm({ amount: '', note: '', reference: '' });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  // Transactions
  const clinicIdStr = String(clinic.id);
  // Income / outflow helpers scoped to the whole selection (not just the
  // active clinic), so combined headline stats are accurate.
  const isScopeIncome  = (tx: any) => scopeIdSet.has(String(tx.toId));
  const isScopeOutflow = (tx: any) => scopeIdSet.has(String(tx.fromId));
  const clinicTransactions = useMemo(() =>
    transactions.filter(tx => isScopeIncome(tx) || isScopeOutflow(tx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, scopeIdSet]);

  // ── Reconsolidate ────────────────────────────────────────────────────────
  // Reconciliation always targets a single wallet, so scope it to the clinic
  // that actually owns the open recon wallet (which may be any in-scope clinic),
  // not the active clinic.
  const reconClinicIdStr = useMemo(() => {
    const w = wallets.find(x => x.id === reconModal?.walletId);
    return w ? String(w.profileId) : clinicIdStr;
  }, [wallets, reconModal, clinicIdStr]);
  const reconPreview = useMemo(() => {
    if (!reconFrom || !reconTo || reconDirection === 'stock') return { count: 0, total: 0 };
    const from = new Date(reconFrom + 'T00:00:00');
    const to   = new Date(reconTo   + 'T23:59:59');
    const isCredit = reconDirection === 'credit';
    const filtered = clinicTransactions.filter(tx => {
      const d = new Date(tx.date ?? tx.createdAt);
      if (isNaN(d.getTime()) || d < from || d > to) return false;
      // Don't filter by status — include all transactions in range for the chosen direction
      return isCredit
        ? String(tx.toId) === reconClinicIdStr
        : String(tx.fromId) === reconClinicIdStr;
    });
    return { count: filtered.length, total: filtered.reduce((a, tx) => a + (Number(tx.amount) || 0), 0) };
  }, [reconFrom, reconTo, reconDirection, clinicTransactions, reconClinicIdStr]);

  // Fetch purchase orders when stock mode + date range is set
  useEffect(() => {
    if (reconDirection !== 'stock' || !reconFrom || !reconTo) {
      setReconStockOrders([]);
      return;
    }
    setReconStockLoading(true);
    purchaseOrderAPI.getAll({ startDate: reconFrom, endDate: reconTo, limit: 200 })
      .then(res => {
        if (res.success) {
          const orders = (res.data.data || []).filter((po: any) =>
            ['RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED'].includes(po.status)
          );
          setReconStockOrders(orders);
          const total = orders.reduce((s: number, po: any) => s + (Number(po.totalAmount) || 0), 0);
          if (total > 0) setReconAmount(total.toFixed(2));
        }
      })
      .catch(() => {})
      .finally(() => setReconStockLoading(false));
  }, [reconDirection, reconFrom, reconTo]);

  // Auto-fill amount from preview when it has a value (user can still override)
  useEffect(() => {
    if (reconDirection !== 'stock' && reconPreview.total > 0) setReconAmount(reconPreview.total.toFixed(2));
  }, [reconPreview.total, reconDirection]);

  // Search transactions from DB for reconsolidate page
  const handleReconSearch = async () => {
    if (!reconFrom || !reconTo) { toast.error('Select a date range'); return; }
    setReconSearchLoading(true);
    setReconTxns([]);
    setReconSearched(false);
    try {
      const res = await transactionsAPI.getAll({ startDate: reconFrom, endDate: reconTo });
      if (res.success) {
        setReconTxns(res.data.transactions);
        setReconSearched(true);
        // Auto-fill amount based on direction (owning clinic of the recon wallet)
        const clinicId = reconClinicIdStr;
        if (reconDirection === 'credit') {
          const income = res.data.transactions.filter(t => String(t.toId) === clinicId || (t as any).toEntityId === clinicId);
          const total = income.reduce((s, t) => s + t.amount, 0);
          if (total > 0) setReconAmount(total.toFixed(2));
        } else if (reconDirection === 'debit') {
          const outflow = res.data.transactions.filter(t => String(t.fromId) === clinicId || (t as any).fromEntityId === clinicId);
          const total = outflow.reduce((s, t) => s + t.amount, 0);
          if (total > 0) setReconAmount(total.toFixed(2));
        }
      }
    } catch {
      toast.error('Failed to fetch transactions');
    } finally {
      setReconSearchLoading(false);
    }
  };

  const handleReconsolidate = async () => {
    if (!reconModal) return;
    if (!reconFrom || !reconTo) { toast.error('Select a date range'); return; }
    const amount = parseFloat(reconAmount);
    if (!amount || amount <= 0) { toast.error('Enter an amount greater than 0'); return; }
    setReconLoading(true);
    try {
      let res: any;
      if (reconDirection === 'stock') {
        res = await walletAPI.recordStockPurchase(reconModal.walletId, {
          amount,
          note: reconStockOrders.length > 0
            ? `Stock purchase reconciliation: ${reconStockOrders.length} order${reconStockOrders.length !== 1 ? 's' : ''} (${reconFrom} – ${reconTo})`
            : `Manual stock purchase reconciliation ${reconFrom} – ${reconTo}`,
          reference: `stock-recon:${reconFrom}:${reconTo}`,
        });
      } else {
        const fn = reconDirection === 'credit' ? walletAPI.transferIn : walletAPI.transferOut;
        res = await fn(reconModal.walletId, {
          amount,
          note: reconPreview.count > 0
            ? `Reconsolidated ${reconPreview.count} ${reconDirection === 'credit' ? 'income' : 'outflow'} transaction${reconPreview.count !== 1 ? 's' : ''}`
            : `Manual reconsolidation ${reconDirection === 'credit' ? 'credit' : 'debit'} ${reconFrom} – ${reconTo}`,
          reference: `recon:${reconFrom}:${reconTo}`,
        });
      }
      if (res.success) {
        toast.success(reconDirection === 'stock' ? 'Stock purchase reconciled' : 'Transactions reconsolidated');
        cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: reconClinicIdStr });
        cache.invalidate(LEDGER_CACHE_KEY, { walletId: reconModal.walletId });
        setWallets(prev => prev.map(w => w.id === res.data.wallet.id ? res.data.wallet : w));
        fetchLedger(reconModal.walletId, true);
        setReconModal(null);
        setReconFrom('');
        setReconTo('');
        setReconAmount('');
        setReconStockOrders([]);
        setReconDirection('credit');
        setReconTxns([]);
        setReconSearched(false);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Reconciliation failed');
    } finally {
      setReconLoading(false);
    }
  };

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

  // Branch list across the whole scope: every in-scope clinic contributes a
  // top-level (entity) card plus a card per actual sub-branch (clinics whose
  // parentClinicId points at it). Deduped by id so a clinic that's both
  // independently selected and a child of another selected clinic shows once.
  const branches = useMemo<BranchWithClinic[]>(() => {
    const out: BranchWithClinic[] = [];
    const seen = new Set<string>();
    for (const c of scopeClinicList) {
      const cid = String(c.id);
      if (!seen.has(cid)) {
        seen.add(cid);
        out.push({ id: cid, name: c.name, logo: (c as any).logo || '🏥', subdomain: (c as any).subdomain || '', isMain: true, entityClinicId: cid, branchId: null, clinicName: c.name });
      }
      allClinics
        .filter(ch => String((ch as any).parentClinicId) === cid)
        .forEach(ch => {
          const bid = String(ch.id);
          if (seen.has(bid)) return;
          seen.add(bid);
          out.push({ ...ch, id: bid, isMain: false, entityClinicId: cid, branchId: bid, clinicName: c.name });
        });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, allClinics]);

  // All wallets per branch ('main' = entity-level, no branch). A branch
  // can now hold multiple wallets after migration 011 — one is flagged
  // as `isMain` and drives transaction routing; the rest are secondaries
  // the user can promote at any time.
  // Key entity-level wallets by their owning clinic (profileId) rather than a
  // shared 'main' sentinel — otherwise the entity wallets of two in-scope
  // clinics would collide into one bucket. Branch wallets key by branchId.
  const walletsByBranch = useMemo(() => {
    const map: Record<string, WalletType[]> = {};
    wallets.forEach(w => {
      const key = w.branchId ?? String(w.profileId);
      if (!map[key]) map[key] = [];
      map[key].push(w);
    });
    return map;
  }, [wallets]);

  // Pick the main (transaction-driving) wallet per branch. Falls back to
  // the first one if isMain hasn't been set yet on any wallet in the group
  // (defensive — backfill in migration 011 should've handled this).
  const walletByBranch = useMemo(() => {
    const map: Record<string, WalletType> = {};
    Object.entries(walletsByBranch).forEach(([key, list]) => {
      const main = list.find(w => (w as any).isMain) || list[0];
      if (main) map[key] = main;
    });
    return map;
  }, [walletsByBranch]);

  // Delete a single ledger entry. Backend reverses the balance impact
  // atomically — the wallet float updates without a separate refresh.
  const handleDeleteLedgerEntry = async (walletId: string, entryId: string) => {
    const ok = await dialog.confirm({
      title: 'Delete ledger entry?',
      message: 'The wallet balance will be reversed automatically.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await walletAPI.deleteLedgerEntry(walletId, entryId);
      if (res.success) {
        toast.success('Entry deleted');
        // Drop the entry from local state and update the wallet's
        // balance from the response so the UI reflects the reversal
        // without a round-trip.
        setLedgerMap(prev => ({
          ...prev,
          [walletId]: (prev[walletId] || []).filter(e => e.id !== entryId),
        }));
        setWallets(prev => prev.map(w => w.id === walletId ? res.data.wallet : w));
        cache.invalidate(LEDGER_CACHE_KEY, { walletId });
        cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: String(res.data.wallet?.profileId ?? clinic.id) });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete entry');
    }
  };

  const handleSetMain = async (walletId: string) => {
    try {
      const res = await walletAPI.setMain(walletId);
      if (res.success) {
        toast.success('Main wallet updated');
        // Promotion is within one clinic's branch group; flip isMain only for
        // wallets sharing the promoted wallet's owner + branch.
        const promoted = wallets.find(w => w.id === walletId);
        cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: String(promoted?.profileId ?? clinic.id) });
        // Refresh the list so isMain flags reflect the new state
        setWallets(prev => prev.map(w => {
          const sameGroup = promoted && String(w.profileId) === String(promoted.profileId) && (w.branchId ?? null) === (promoted.branchId ?? null);
          return sameGroup ? ({ ...w, isMain: w.id === walletId } as any) : w;
        }));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set main wallet');
    }
  };

  const stats = useMemo(() => {
    const clientRev = clinicTransactions.filter(tx => isScopeIncome(tx) && tx.type === 'SERVICE');
    const b2bRev    = clinicTransactions.filter(tx => isScopeIncome(tx) && tx.type === 'REFERRAL');
    const outflows  = clinicTransactions.filter(tx => isScopeOutflow(tx));
    const settled = clinicTransactions.filter(tx => tx.status === 'SETTLED').length;
    const count   = clinicTransactions.length;
    return {
      totalClientRev: clientRev.reduce((a, tx) => a + tx.amount, 0),
      totalB2BRev:    b2bRev.reduce((a, tx) => a + tx.amount, 0),
      totalOutflow:   outflows.reduce((a, tx) => a + tx.amount, 0),
      count,
      settledPct: count > 0 ? Math.round((settled / count) * 100) : 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicTransactions, scopeIdSet]);

  const totalFloat = useMemo(
    () => wallets.reduce((sum, w) => sum + parseFloat(String(w.balance ?? 0)), 0),
    [wallets],
  );

  const analyticsData = useMemo(() => {
    const incomeTxns = clinicTransactions.filter(tx => isScopeIncome(tx) && (tx.type === 'SERVICE' || tx.type === 'REFERRAL'));
    const outflowTxns = clinicTransactions.filter(tx => isScopeOutflow(tx));

    // Build day buckets for the period
    const now = new Date();
    const dayMap: Record<string, { income: number; outflow: number; date: Date }> = {};
    for (let i = chartPeriod - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { income: 0, outflow: 0, date: d };
    }
    incomeTxns.forEach(tx => {
      const key = new Date(tx.date || (tx as any).createdAt).toISOString().slice(0, 10);
      if (dayMap[key]) dayMap[key].income += Number(tx.amount);
    });
    outflowTxns.forEach(tx => {
      const key = new Date(tx.date || (tx as any).createdAt).toISOString().slice(0, 10);
      if (dayMap[key]) dayMap[key].outflow += Number(tx.amount);
    });

    // Determine label granularity: ≤7 → show every day, ≤30 → every 3rd, >30 → every 7th
    const entries = Object.entries(dayMap);
    const labelEvery = chartPeriod <= 7 ? 1 : chartPeriod <= 30 ? 3 : 7;
    const daily = entries.map(([key, val], idx) => ({
      key,
      name: (idx % labelEvery === 0 || idx === entries.length - 1)
        ? new Date(val.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : '',
      income: val.income,
      outflow: val.outflow,
      net: val.income - val.outflow,
    }));

    // Method breakdown on income
    const methodMap: Record<string, number> = {};
    incomeTxns.forEach(tx => {
      const m = (tx.method as string) || 'OTHER';
      methodMap[m] = (methodMap[m] || 0) + Number(tx.amount);
    });
    const METHOD_COLORS: Record<string, string> = {
      CASH: '#10b981',
      M_PESA: '#1C7A5B',
      MPESA: '#1C7A5B',
      CARD: '#6366f1',
      BANK_TRANSFER: '#f59e0b',
      OTHER: '#94a3b8',
    };
    const methodData = Object.entries(methodMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: name.replace('_', ' '), value, color: METHOD_COLORS[name] || '#94a3b8' }));

    const totalIncome = stats.totalClientRev + stats.totalB2BRev;
    const netIncome = totalIncome - stats.totalOutflow;
    const avgTxn = incomeTxns.length > 0 ? totalIncome / incomeTxns.length : 0;
    const peakDay = daily.reduce((max, d) => d.income > max.income ? d : max, daily[0] ?? { income: 0, name: '—', key: '', outflow: 0, net: 0 });
    const totalRev = stats.totalClientRev + stats.totalB2BRev;
    const clinicalPct = totalRev > 0 ? Math.round((stats.totalClientRev / totalRev) * 100) : 0;
    const b2bPct = totalRev > 0 ? 100 - clinicalPct : 0;
    const hasData = incomeTxns.length > 0 || outflowTxns.length > 0;

    // 7-day trend: compare last 7 days income vs previous 7
    const last7 = daily.slice(-7).reduce((s, d) => s + d.income, 0);
    const prev7 = daily.slice(-14, -7).reduce((s, d) => s + d.income, 0);
    const trendPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

    return { daily, methodData, netIncome, avgTxn, peakDay, clinicalPct, b2bPct, totalIncome, hasData, trendPct };
  }, [clinicTransactions, clinicIdStr, stats, chartPeriod]);

  const filteredTransactions = useMemo(() => {
    let list = clinicTransactions;
    if (activeTab === 'client') list = clinicTransactions.filter(tx => isScopeIncome(tx) && tx.type === 'SERVICE');
    if (activeTab === 'b2b')    list = clinicTransactions.filter(tx => tx.type === 'REFERRAL');
    if (activeTab === 'outflow')list = clinicTransactions.filter(tx => isScopeOutflow(tx));
    return list.filter(tx => tx.id.toString().includes(searchQuery) || tx.method.toLowerCase().includes(searchQuery.toLowerCase()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicTransactions, activeTab, scopeIdSet, searchQuery]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: clinic.currency, maximumFractionDigits: 0 }).format(val);

  // ── Wallet form submit ───────────────────────────────────────────────────
  const handleSaveWallet = async () => {
    if (!form.name || !form.walletType) { toast.error('Name and wallet type are required'); return; }
    let accountNum: string | null = null;
    if (form.walletType === 'VIRTUAL') {
      // Virtual wallets have no external account number.
      accountNum = null;
    } else if (form.walletType === 'BANK_PAYBILL') {
      accountNum = form.paybillBank + (form.paybillAccountNo ? `|${form.paybillAccountNo}` : '');
    } else if (form.walletType === 'MPESA_PAYBILL') {
      accountNum = form.accountNumber + (form.paybillAccountNo ? `|${form.paybillAccountNo}` : '');
    } else {
      accountNum = form.accountNumber || null;
    }
    setSaving(true);
    try {
      if (editingWalletId) {
        // Edit targets the clinic that actually owns the wallet (it may belong
        // to any in-scope clinic, not just the active one).
        const editing = wallets.find(w => w.id === editingWalletId);
        const ownerClinicId = editing ? String(editing.profileId) : String(clinic.id);
        const res = await walletAPI.updateClinic(ownerClinicId, {
          name: form.name,
          walletType: form.walletType as WalletKind,
          accountNumber: accountNum || null,
          debt: form.debt ? parseFloat(form.debt) : 0,
        });
        if (res.success) {
          setWallets(prev => prev.map(w => w.id === editingWalletId ? { ...w, ...res.data.wallet } : w));
          cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: ownerClinicId });
        }
        toast.success('Wallet updated');
      } else {
        // Create under the owning clinic of the card being set up: top-level
        // cards create an entity wallet (branchId null); branch cards attach to
        // their parent clinic with the child clinic id as branchId.
        const target = branches.find(b => b.id === creatingFor);
        const ownerClinicId = target?.entityClinicId ?? String(clinic.id);
        const branchId = target?.branchId ?? null;
        const res = await walletAPI.createForClinic(ownerClinicId, {
          name: form.name,
          branchId,
          walletType: form.walletType as WalletKind,
          accountNumber: accountNum || null,
          debt: form.debt ? parseFloat(form.debt) : 0,
          usesMainWallet: form.usesMainWallet,
          openingBalance: form.balance ? parseFloat(form.balance) : undefined,
        });
        if (res.success) {
          setWallets(prev => [...prev, res.data.wallet]);
          cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: ownerClinicId });
        }
        toast.success('Wallet created');
      }
      setCreatingFor(null);
      setEditingWalletId(null);
      setForm(emptyForm());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save wallet');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = (branch: BranchWithClinic) => {
    setEditingWalletId(null);
    setForm(emptyForm());
    setCreatingFor(branch.id);
  };

  const openEdit = (wallet: WalletType) => {
    setCreatingFor(null);
    setEditingWalletId(wallet.id);
    const raw = wallet.accountNumber ?? '';
    const [primary, secondary] = raw.split('|');
    setForm({
      ...emptyForm(),
      name: wallet.name,
      walletType: wallet.walletType ?? '',
      accountNumber: wallet.walletType === 'BANK_PAYBILL' ? '' : (wallet.walletType === 'MPESA_PAYBILL' ? (primary ?? '') : (raw)),
      paybillBank: wallet.walletType === 'BANK_PAYBILL' ? (primary ?? '') : '',
      paybillAccountNo: (wallet.walletType === 'BANK_PAYBILL' || wallet.walletType === 'MPESA_PAYBILL') ? (secondary ?? '') : '',
      balance: '',
      debt: String(wallet.debt ?? ''),
      usesMainWallet: wallet.usesMainWallet,
    });
  };

  const cancelForm = () => { setCreatingFor(null); setEditingWalletId(null); setForm(emptyForm()); };

  // ── Wallet form panel ────────────────────────────────────────────────────
  const WalletForm = ({ forBranch, isEdit }: { forBranch?: BranchWithClinic; isEdit?: boolean }) => {
    const meta = form.walletType ? WALLET_TYPE_META[form.walletType as WalletKind] : null;
    const isBranch = !!forBranch && forBranch.isMain !== true;
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

        {/* Virtual wallet: no external account, no paybill, just balance + name. */}
        {meta?.isVirtual && (
          <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            Virtual wallets are an internal-only ledger — no external payment gateway is attached.
            You can credit / debit it from anywhere in the app, but no real money flows in or out.
          </div>
        )}

        {/* Account number / paybill — only for gateway-backed (real) wallets. */}
        {meta && !meta.isVirtual && (
          <>
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
                  placeholder={form.walletType === 'MPESA_PAYBILL' ? 'Paybill Number' : meta.accountLabel}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                />
              )}
            </div>
            {/* Secondary account number for BANK_PAYBILL and MPESA_PAYBILL */}
            {(form.walletType === 'BANK_PAYBILL' || form.walletType === 'MPESA_PAYBILL') && (
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Account Number</label>
                <input
                  value={form.paybillAccountNo}
                  onChange={e => setForm(f => ({ ...f, paybillAccountNo: e.target.value }))}
                  placeholder={form.walletType === 'BANK_PAYBILL' ? 'Your account number at this bank' : 'Account / Store number'}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                />
              </div>
            )}
          </>
        )}

        {/* Current Debt — currency follows clinic but read-only here, debt
            stays in the clinic's reporting currency by convention. */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Current Debt</label>
          <CurrencyAmountInput
            value={form.debt}
            onChange={(v) => setForm(f => ({ ...f, debt: v }))}
            currency={clinic.currency || 'KES'}
            lockCurrency
          />
        </div>

        {/* Opening Balance — only shown when creating */}
        {!isEdit && (
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Current Balance</label>
            <CurrencyAmountInput
              value={form.balance}
              onChange={(v) => setForm(f => ({ ...f, balance: v }))}
              currency={clinic.currency || 'KES'}
              lockCurrency
              placeholder="0.00 — enter existing balance to migrate"
            />
          </div>
        )}

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

  // ── Compact mini-card for the horizontal carousel ────────────────────────
  // Sized so exactly two cards sit on screen at a time (50% width minus the
  // gap). Each wallet (including secondary wallets across all branches)
  // gets its own card; clicking sets the active wallet — the detail panel
  // below renders the picked wallet's full info + transactions.
  const WalletMiniCard = ({
    branch,
    wallet,
    selected,
    onSelect,
  }: {
    branch: BranchWithClinic;
    wallet: WalletType | null;
    selected: boolean;
    onSelect: () => void;
  }) => {
    const meta = wallet?.walletType ? WALLET_TYPE_META[wallet.walletType] : null;
    const hasNoWallet = !wallet;
    const usesMain = !!wallet?.usesMainWallet;
    const isMain = !!wallet?.isMain;
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full text-left rounded-2xl overflow-hidden border-2 transition-all active:scale-[0.98] ${
          selected
            ? 'border-seafoam shadow-lg shadow-seafoam/15'
            : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam/40'
        }`}
      >
        <div className={`relative px-4 py-3 ${
          hasNoWallet
            ? 'bg-slate-50 dark:bg-zinc-900'
            : 'bg-gradient-to-br from-pine via-pine to-seafoam text-white'
        } overflow-hidden`}>
          {!hasNoWallet && (
            <div className="absolute -right-3 -bottom-5 opacity-10">
              {meta?.icon ? React.cloneElement(meta.icon as any, { size: 70 }) : <Wallet size={70} />}
            </div>
          )}
          <div className="relative z-10 flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${
              hasNoWallet
                ? 'bg-slate-200 dark:bg-zinc-800'
                : 'bg-white/15 border border-white/20'
            }`}>{branch.logo}</div>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-black uppercase tracking-tight truncate ${hasNoWallet ? 'text-pine dark:text-zinc-100' : ''}`}>{branch.name}</p>
              <p className={`text-[7px] font-black uppercase tracking-[0.18em] ${hasNoWallet ? 'text-slate-400' : 'text-white/60'}`}>
                {branch.isMain ? 'Main Branch' : (multiScope && branch.clinicName ? branch.clinicName : 'Branch')}
              </p>
            </div>
            {isMain && !hasNoWallet && (
              <span className="shrink-0 px-1 py-px rounded-sm bg-amber-300 text-pine text-[6px] font-black uppercase tracking-widest" title="Main wallet for this branch">Main</span>
            )}
            {selected && (
              <span className={`shrink-0 w-2 h-2 rounded-full ${hasNoWallet ? 'bg-seafoam' : 'bg-emerald-300'}`} />
            )}
          </div>
          {hasNoWallet ? (
            <p className="relative z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest">No wallet · Set up</p>
          ) : usesMain ? (
            <p className="relative z-10 text-[10px] font-black truncate">Linked → Main Wallet</p>
          ) : (
            <>
              <p className="relative z-10 text-[7px] font-black uppercase tracking-widest text-white/60">Current Float</p>
              <p className="relative z-10 text-lg font-black font-mono tabular-nums tracking-tight">
                <span className="text-[10px] mr-1 text-white/70">{wallet.currency}</span>
                {Number(wallet.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="relative z-10 text-[8px] font-black uppercase tracking-widest text-white/70 mt-0.5 truncate">
                {meta?.label ?? 'Wallet'} {wallet.name ? ` · ${wallet.name}` : ''}
              </p>
              {(() => {
                // Surface the till/paybill/mobile/account number on the
                // mini card — that's what staff actually need to verify
                // before sending money. `accountNumber` is stored as
                // "primary|secondary" (e.g. paybill|account) for the
                // paybill rail; we render both with the secondary in a
                // smaller line beneath.
                if (!wallet.accountNumber) return null;
                const [primary, secondary] = wallet.accountNumber.split('|');
                const acctLabel = meta?.accountLabel ?? 'Account';
                return (
                  <div className="relative z-10 mt-1.5 px-2 py-1 rounded-md bg-white/15 border border-white/15">
                    <p className="text-[7px] font-black uppercase tracking-[0.18em] text-white/55">{acctLabel}</p>
                    <p className="text-[10px] font-black font-mono tabular-nums text-white truncate leading-tight">{primary}</p>
                    {secondary && (
                      <p className="text-[8px] font-bold font-mono text-white/70 truncate leading-tight">{secondary}</p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </button>
    );
  };

  // ── Wallet card for a branch ─────────────────────────────────────────────
  // `walletOverride` lets the carousel show any wallet (main or secondary)
  // in the detail panel. When omitted it falls back to the branch's main
  // wallet, preserving the original behavior.
  const WalletCard = ({ branch, walletOverride }: { branch: BranchWithClinic; walletOverride?: WalletType | null }) => {
    const cardKey = branch.id;
    const wallet = walletOverride !== undefined ? walletOverride : walletByBranch[cardKey];
    const isCreating = creatingFor === cardKey;
    const isEditing = editingWalletId === wallet?.id;
    const meta = wallet?.walletType ? WALLET_TYPE_META[wallet.walletType] : null;
    // Main wallet of the clinic that owns this card — used when a branch is
    // linked to "use main wallet" (must resolve within the same clinic, not
    // globally across the scope).
    const ownerMain = wallets.find(w => !w.branchId && String(w.profileId) === String(branch.entityClinicId ?? branch.id)) ?? null;

    if (wallet?.usesMainWallet && ownerMain) {
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
            Linked to: <span className="font-bold text-pine dark:text-zinc-100">{ownerMain.name}</span>
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
                {branch.isMain
                  ? <span className="text-[9px] font-bold uppercase text-seafoam">Main Branch</span>
                  : (multiScope && branch.clinicName && <span className="text-[9px] font-bold uppercase text-slate-400">{branch.clinicName}</span>)}
              </div>
            </div>
            <button
              onClick={() => openCreate(branch)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-seafoam/10 text-seafoam text-[10px] font-black uppercase hover:bg-seafoam/20 transition-all"
            >
              <Plus size={12} /> Set Up Wallet
            </button>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">No wallet configured for this branch.</p>
          {isCreating && <WalletForm forBranch={branch} />}
        </div>
      );
    }

    const activeTab: WalletActivityTab = walletActivityTab[wallet.id] || 'all';
    const typeLabels: Record<string, string> = {
      TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
      STOCK_PURCHASE: 'Stock Purchase', PAYMENT_RECEIVED: 'Payment', ADJUSTMENT: 'Adjustment',
    };
    const tabMatch = (t: string): WalletActivityTab[] => {
      if (t === 'PAYMENT_RECEIVED') return ['all', 'payments'];
      if (t === 'TRANSFER_IN' || t === 'TRANSFER_OUT') return ['all', 'transfers'];
      if (t === 'STOCK_PURCHASE') return ['all', 'stock'];
      if (t === 'ADJUSTMENT') return ['all', 'adjust'];
      return ['all'];
    };
    const allEntries = ledgerMap[wallet.id] || [];
    const filteredEntries = allEntries.filter(e => tabMatch(e.type).includes(activeTab));
    const tabs: Array<{ id: WalletActivityTab; label: string; count?: number }> = [
      { id: 'all',       label: 'All',         count: allEntries.length },
      { id: 'payments',  label: 'Payments',    count: allEntries.filter(e => e.type === 'PAYMENT_RECEIVED').length },
      { id: 'transfers', label: 'Transfers',   count: allEntries.filter(e => e.type === 'TRANSFER_IN' || e.type === 'TRANSFER_OUT').length },
      { id: 'stock',     label: 'Stock',       count: allEntries.filter(e => e.type === 'STOCK_PURCHASE').length },
      { id: 'adjust',    label: 'Adjustments', count: allEntries.filter(e => e.type === 'ADJUSTMENT').length },
    ];
    const acctParts = wallet.accountNumber ? wallet.accountNumber.split('|') : [];
    const acctPrimary = acctParts[0];
    const acctSecondary = acctParts[1];

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Hero header — gradient strip with branch, wallet name + type, balance */}
        <div className="relative bg-gradient-to-br from-pine via-pine to-seafoam text-white p-5 overflow-hidden">
          <div className="absolute -right-6 -bottom-8 opacity-10">
            {meta?.icon ? React.cloneElement(meta.icon as any, { size: 110 }) : <Wallet size={110} />}
          </div>
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-lg shrink-0">{branch.logo}</div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-tight truncate">{branch.name}</p>
                <p className="text-[7px] font-black uppercase tracking-[0.2em] text-white/60">
                  {branch.isMain ? 'Main Branch' : (multiScope && branch.clinicName ? branch.clinicName : 'Branch')}
                </p>
              </div>
            </div>
            <button
              onClick={() => isEditing ? cancelForm() : openEdit(wallet)}
              className="shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all border border-white/15"
              title={isEditing ? 'Cancel editing' : 'Edit wallet'}
            >
              {isEditing ? <X size={13} /> : <Edit2 size={13} />}
            </button>
          </div>

          <div className="relative z-10 mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[7px] font-black uppercase tracking-[0.2em] text-white/60 mb-0.5">Current Float</p>
              <p className="text-2xl font-black font-mono tabular-nums tracking-tight break-all">
                <span className="text-[11px] mr-1 text-white/70">{wallet.currency}</span>
                {parseFloat(String(wallet.balance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-left sm:text-right sm:shrink-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 border border-white/20 max-w-full">
                <Wallet size={10} className="shrink-0" />
                <span className="text-[8px] font-black uppercase tracking-widest truncate max-w-[120px] sm:max-w-[140px]">{wallet.name}</span>
                {wallet.isMain && (
                  <span className="px-1 py-px rounded-sm bg-amber-300 text-pine text-[6px] font-black uppercase tracking-widest shrink-0" title="Drives transaction routing for the branch">Main</span>
                )}
              </div>
              <p className="text-[7px] font-black uppercase tracking-widest text-white/60 mt-1">{meta?.label ?? 'Wallet'}</p>
            </div>
          </div>
        </div>

        {/* Meta strip — account / debt / status */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-zinc-800 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60">
          <div className="px-4 py-2.5">
            <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">{meta?.accountLabel ?? 'Account'}</p>
            <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate font-mono">{acctPrimary || '—'}</p>
            {acctSecondary && <p className="text-[8px] text-slate-400 font-bold truncate">{acctSecondary}</p>}
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Outstanding Debt</p>
            <p className={`text-[11px] font-black font-mono ${wallet.debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-zinc-500'}`}>
              {wallet.currency} {parseFloat(String(wallet.debt || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Status</p>
            <p className={`text-[11px] font-black ${wallet.isActive === false ? 'text-red-500' : 'text-emerald-600'}`}>
              {wallet.isActive === false ? 'Inactive' : (wallet.isVirtual ? 'Virtual · Active' : 'Active')}
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-slate-100 dark:border-zinc-800">
          <button
            onClick={() => { setTransferModal({ walletId: wallet.id, direction: 'in' }); setTransferForm({ amount: '', note: '', reference: '' }); }}
            className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all"
          >
            <ArrowDownLeft size={12} /> Transfer In
          </button>
          <button
            onClick={() => { setTransferModal({ walletId: wallet.id, direction: 'out' }); setTransferForm({ amount: '', note: '', reference: '' }); }}
            className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] font-black uppercase hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
          >
            <ArrowUpRight size={12} /> Transfer Out
          </button>
          <button
            onClick={() => { setReconFrom(''); setReconTo(''); setReconDirection('credit'); setReconModal({ walletId: wallet.id }); }}
            className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-seafoam/10 dark:bg-seafoam/15 text-seafoam text-[10px] font-black uppercase hover:bg-seafoam/20 dark:hover:bg-seafoam/25 transition-all"
            title="Query DB transactions and post to this wallet"
          >
            <RefreshCw size={12} /> Reconsolidate
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto scrollbar-none border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0">
          {tabs.map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setWalletActivityTab(prev => ({ ...prev, [wallet.id]: t.id }))}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  active
                    ? 'bg-pine text-white shadow-sm'
                    : 'text-slate-400 hover:text-pine hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`text-[8px] px-1 rounded ${active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500'}`}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content — transaction list */}
        <div className="px-3 py-2 max-h-72 overflow-y-auto">
          {ledgerLoading[wallet.id] ? (
            <p className="text-[10px] text-slate-400 py-3 text-center font-black uppercase tracking-widest">Loading history…</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-[10px] text-slate-400 py-6 text-center font-black uppercase tracking-widest">No entries in this view yet</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredEntries.map(entry => {
                const isCredit = entry.type === 'TRANSFER_IN' || entry.type === 'PAYMENT_RECEIVED';
                const dotColor =
                  entry.type === 'PAYMENT_RECEIVED' ? 'bg-emerald-500' :
                  entry.type === 'TRANSFER_IN'      ? 'bg-emerald-400' :
                  entry.type === 'TRANSFER_OUT'    ? 'bg-red-400' :
                  entry.type === 'STOCK_PURCHASE'  ? 'bg-orange-500' :
                  'bg-slate-400';
                return (
                  <div key={entry.id} className="group flex items-center justify-between gap-2 py-2 px-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-pine dark:text-zinc-100 truncate uppercase tracking-tight">{typeLabels[entry.type] ?? entry.type}</p>
                        {entry.note && <p className="text-[9px] text-slate-400 truncate">{entry.note}</p>}
                        <p className="text-[8px] text-slate-300 dark:text-zinc-600 font-bold">
                          {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {entry.createdByName ? ` · ${entry.createdByName}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <p className={`text-[11px] font-black font-mono tabular-nums ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {isCredit ? '+' : '−'} {wallet.currency} {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <button
                        onClick={() => handleDeleteLedgerEntry(wallet.id, entry.id)}
                        title="Delete this entry — wallet balance will be reversed"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — promote secondary to main + add-another. Sibling
            wallets now live in the carousel above, so this strip is
            just the actions, not a wallet list. */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40 flex flex-wrap items-center gap-2">
          {!wallet.isMain && (
            <button
              onClick={() => handleSetMain(wallet.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all"
              title="Promote this wallet to be the main one for this branch"
            >
              <Crown size={11} /> Set as Main
            </button>
          )}
          <button
            onClick={() => setRichCreateBranchId(branch.id)}
            className="ml-auto flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Plus size={11} /> Add another wallet
          </button>
          {isCreating && <div className="basis-full"><WalletForm forBranch={branch} /></div>}
        </div>

        {isEditing && <WalletForm forBranch={branch} isEdit />}
      </div>
    );
  };

  // ── Subscription banner — details live in Billing ────────────────────────
  const SubscriptionCard = () => (
    <div className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-seafoam/10 flex items-center justify-center shrink-0">
          <CreditCard size={16} className="text-seafoam" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Subscription</p>
          <p className="text-xs font-bold text-pine dark:text-zinc-300 mt-0.5">Manage your plan and billing details in the Billing section</p>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1 shrink-0">
        <ArrowRight size={12} /> Billing
      </span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* ── Transfer Modal ─────────────────────────────────────────────── */}
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
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Amount</label>
                <CurrencyAmountInput
                  value={transferForm.amount}
                  onChange={(v) => setTransferForm(f => ({ ...f, amount: v }))}
                  currency={clinic.currency || 'KES'}
                  lockCurrency
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Note <span className="font-normal normal-case">(optional)</span></label>
                <input
                  value={transferForm.note}
                  onChange={e => setTransferForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Supplier payment for vaccines"
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

      {/* ── Reconsolidate Full-Page Overlay ──────────────────────────────── */}
      {reconModal && (() => {
        const closeRecon = () => {
          setReconModal(null); setReconFrom(''); setReconTo(''); setReconAmount('');
          setReconStockOrders([]); setReconDirection('credit'); setReconTxns([]); setReconSearched(false);
        };
        const reconWallet = wallets.find(w => w.id === reconModal.walletId);
        const clinicIdStr2 = reconWallet ? String(reconWallet.profileId) : String(clinic.id);
        const incomeTxns  = reconTxns.filter(t => String((t as any).toEntityId ?? t.toId) === clinicIdStr2);
        const outflowTxns = reconTxns.filter(t => String((t as any).fromEntityId ?? t.fromId) === clinicIdStr2 && (t as any).type === 'SUPPLIER');
        const incomeTotal  = incomeTxns.reduce((s, t) => s + t.amount, 0);
        const outflowTotal = outflowTxns.reduce((s, t) => s + t.amount, 0);
        const stockTotal   = reconStockOrders.reduce((s: number, po: any) => s + (Number(po.totalAmount) || 0), 0);
        const displayTxns  = reconDirection === 'stock' ? [] : reconDirection === 'credit' ? incomeTxns : outflowTxns;
        const displayTotal = reconDirection === 'stock' ? stockTotal : reconDirection === 'credit' ? incomeTotal : outflowTotal;
        const fmtKes = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
        const methodColor: Record<string, string> = {
          M_PESA: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          CASH:   'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
          CARD:   'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
          BANK_TRANSFER: 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400',
        };
        return (
          <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-seafoam/10 flex items-center justify-center flex-shrink-0">
                  <RefreshCw size={16} className="text-seafoam" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight truncate">Reconsolidate</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                    {reconWallet ? <>Post to <span className="font-bold text-pine dark:text-zinc-200">{reconWallet.name}</span></> : 'Query transactions from the DB and post to wallet'}
                  </p>
                </div>
              </div>
              <button onClick={closeRecon} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

              {/* Step 1 — Direction + Date Range */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-seafoam">Step 1 — Select Type & Date Range</p>

                {/* Direction */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'credit', label: '↓ Credit', sub: 'Income received', active: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                    { id: 'debit',  label: '↑ Debit',  sub: 'Outflows paid',   active: 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400' },
                    { id: 'stock',  label: '📦 Stock',  sub: 'Purchase orders', active: 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                  ] as const).map(opt => (
                    <button key={opt.id}
                      onClick={() => { setReconDirection(opt.id); setReconAmount(''); setReconStockOrders([]); setReconTxns([]); setReconSearched(false); }}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border-2 ${reconDirection === opt.id ? opt.active : 'border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-slate-300'}`}
                    >
                      {opt.label}
                      <span className="block text-[8px] font-bold normal-case mt-0.5 opacity-70">{opt.sub}</span>
                    </button>
                  ))}
                </div>

                {/* Date pickers + Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">From</label>
                    <input type="date" value={reconFrom} onChange={e => { setReconFrom(e.target.value); setReconSearched(false); }}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">To</label>
                    <input type="date" value={reconTo} onChange={e => { setReconTo(e.target.value); setReconSearched(false); }}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleReconSearch} disabled={!reconFrom || !reconTo || reconSearchLoading}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                      {reconSearchLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                      {reconSearchLoading ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 — Results */}
              {(reconSearched || reconStockLoading) && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-seafoam">
                      Step 2 — {reconDirection === 'stock' ? 'Purchase Orders' : reconDirection === 'credit' ? 'Income Transactions' : 'Outflow Transactions'} ({reconFrom} → {reconTo})
                    </p>
                    {reconSearched && reconDirection !== 'stock' && (
                      <div className="flex items-center gap-4">
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Income: KES {fmtKes(incomeTotal)}</span>
                        <span className="text-[9px] font-bold text-red-500 dark:text-red-400">Outflow: KES {fmtKes(outflowTotal)}</span>
                      </div>
                    )}
                  </div>

                  {/* Transaction list */}
                  {reconDirection === 'stock' ? (
                    reconStockLoading ? (
                      <div className="px-5 py-8 text-center">
                        <RefreshCw size={20} className="animate-spin text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Fetching purchase orders…</p>
                      </div>
                    ) : reconStockOrders.length === 0 ? (
                      <div className="px-5 py-8 text-center">
                        <Package size={28} className="text-slate-200 dark:text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400">No received orders in this range</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {reconStockOrders.map((po: any) => (
                          <div key={po.id} className="px-5 py-3 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-pine dark:text-zinc-100">{po.supplierName || po.supplier?.name || 'Supplier'}</p>
                              <p className="text-[10px] text-slate-400">{po.orderNumber || `PO #${po.id}`} · {po.status}</p>
                            </div>
                            <p className="text-sm font-black text-amber-600 dark:text-amber-400">KES {fmtKes(Number(po.totalAmount))}</p>
                          </div>
                        ))}
                        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-500/10 flex items-center justify-between">
                          <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">{reconStockOrders.length} order{reconStockOrders.length !== 1 ? 's' : ''} total</p>
                          <p className="text-base font-black text-amber-700 dark:text-amber-400">KES {fmtKes(stockTotal)}</p>
                        </div>
                      </div>
                    )
                  ) : displayTxns.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <TrendingUp size={28} className="text-slate-200 dark:text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-400">No {reconDirection === 'credit' ? 'income' : 'outflow'} transactions in this range</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
                      {displayTxns.map(tx => (
                        <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{tx.client?.name ?? '—'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-slate-400">{fmtDate(tx.createdAt)}</p>
                              {tx.receiptNumber && <p className="text-[10px] text-slate-400">{tx.receiptNumber}</p>}
                              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${methodColor[tx.method] ?? 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>{tx.method?.replace('_', ' ')}</span>
                            </div>
                          </div>
                          <p className={`text-sm font-black flex-shrink-0 ${reconDirection === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                            {reconDirection === 'credit' ? '+' : '-'} KES {fmtKes(tx.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Totals footer */}
                  {reconSearched && reconDirection !== 'stock' && displayTxns.length > 0 && (
                    <div className={`px-5 py-3 flex items-center justify-between border-t ${reconDirection === 'credit' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'}`}>
                      <p className={`text-xs font-black uppercase tracking-wide ${reconDirection === 'credit' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {displayTxns.length} transaction{displayTxns.length !== 1 ? 's' : ''}
                      </p>
                      <p className={`text-lg font-black ${reconDirection === 'credit' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {reconDirection === 'credit' ? '+' : '-'} KES {fmtKes(displayTotal)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 — Apply to Wallet */}
              {(reconSearched || (reconDirection === 'stock' && reconStockOrders.length > 0)) && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-seafoam">Step 3 — Apply to Wallet</p>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Amount to Post (KES)</label>
                    <input type="number" min="0" step="0.01" value={reconAmount} onChange={e => setReconAmount(e.target.value)}
                      placeholder={`Auto-filled from ${reconDirection === 'stock' ? 'purchase orders' : 'transactions above'}`}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-black text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40" />
                    <p className="text-[9px] text-slate-400 mt-1">You can adjust the amount before posting. The selected total has been auto-filled.</p>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={closeRecon}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">
                      Cancel
                    </button>
                    <button onClick={handleReconsolidate}
                      disabled={reconLoading || !(parseFloat(reconAmount) > 0)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${
                        reconDirection === 'credit' ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : reconDirection === 'stock' ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}>
                      {reconLoading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      {reconLoading ? 'Posting…'
                        : reconDirection === 'credit' ? `Post KES ${parseFloat(reconAmount) > 0 ? fmtKes(parseFloat(reconAmount)) : '—'} to Wallet`
                        : reconDirection === 'stock'  ? 'Reconcile Stock Purchase'
                        : `Debit KES ${parseFloat(reconAmount) > 0 ? fmtKes(parseFloat(reconAmount)) : '—'} from Wallet`}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex w-full bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-x-auto gap-1">
        {[
          { id: 'overview', label: 'Stats',    icon: ClinicStatsIcon },
          { id: 'stats',   label: 'Statistics', icon: ClinicStatsIcon },
          { id: 'wallets', label: 'Wallets',   icon: Wallet },
          { id: 'summary', label: 'Analytics', icon: PieChart },
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

      {/* ── Clinic Statistics tab (operational stats + comparison) ───────── */}
      {activeTab === 'overview' && <ClinicStatsTab />}

      {activeTab === 'stats' && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <ClinicStatistics clinicId={clinic?.id} currency={(clinic as any)?.currency || 'KES'} scopes={scopeClinicList.map(c => ({ id: c.id, name: c.name }))} />
        </div>
      )}

      {/* ── Analytics tab ───────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-500">

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Income',
                value: formatCurrency(analyticsData.totalIncome),
                sub: `${stats.count} transactions`,
                icon: ArrowDownLeft,
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/8 dark:bg-emerald-500/10',
                border: 'border-emerald-500/15',
              },
              {
                label: 'Net Income',
                value: formatCurrency(analyticsData.netIncome),
                sub: analyticsData.netIncome >= 0 ? 'positive cash flow' : 'negative cash flow',
                icon: analyticsData.netIncome >= 0 ? TrendingUp : ArrowUpRight,
                color: analyticsData.netIncome >= 0 ? 'text-seafoam' : 'text-red-400',
                bg: analyticsData.netIncome >= 0 ? 'bg-seafoam/8 dark:bg-seafoam/10' : 'bg-red-500/8',
                border: analyticsData.netIncome >= 0 ? 'border-seafoam/15' : 'border-red-500/15',
              },
              {
                label: 'Avg Transaction',
                value: formatCurrency(analyticsData.avgTxn),
                sub: 'per service visit',
                icon: Zap,
                color: 'text-amber-500',
                bg: 'bg-amber-500/8 dark:bg-amber-500/10',
                border: 'border-amber-500/15',
              },
              {
                label: 'Settlement Rate',
                value: `${stats.settledPct}%`,
                sub: `${stats.count} total`,
                icon: CheckCircle2,
                color: 'text-violet-500',
                bg: 'bg-violet-500/8 dark:bg-violet-500/10',
                border: 'border-violet-500/15',
              },
            ].map(k => (
              <div key={k.label} className={`${k.bg} border ${k.border} rounded-2xl p-4 flex flex-col justify-between gap-2`}>
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{k.label}</p>
                  <div className={`p-1.5 rounded-lg ${k.bg} border ${k.border}`}>
                    <k.icon size={11} className={k.color} />
                  </div>
                </div>
                <p className={`text-xl font-black tracking-tighter ${k.color}`}>{k.value}</p>
                <p className="text-[8px] text-slate-400 dark:text-zinc-500 font-semibold">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Main chart + breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Income vs Outflow chart */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Income vs Outflow</h3>
                  {analyticsData.trendPct !== null && (
                    <p className={`text-[9px] font-black mt-0.5 ${analyticsData.trendPct >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {analyticsData.trendPct >= 0 ? '▲' : '▼'} {Math.abs(analyticsData.trendPct)}% vs prior 7 days
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Chart type toggle — Line / Bar / Pie */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-xl p-1">
                    {(['line', 'bar', 'pie'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setChartType(t)}
                        className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                          chartType === t
                            ? 'bg-white dark:bg-zinc-700 text-pine dark:text-zinc-100 shadow-sm'
                            : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* Period toggle — applies to line & bar */}
                  {chartType !== 'pie' && (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-xl p-1">
                      {([7, 30, 90] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setChartPeriod(p)}
                          className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                            chartPeriod === p
                              ? 'bg-white dark:bg-zinc-700 text-pine dark:text-zinc-100 shadow-sm'
                              : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
                          }`}
                        >
                          {p}d
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {analyticsData.hasData ? (
                <div className="h-[240px] w-full">
                  {(() => {
                    // Shared cartesian axis styling for line & bar.
                    const grid = <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-zinc-800" />;
                    const xAxis = <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94A3B8' }} dy={8} interval={0} />;
                    const yAxis = <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 700, fill: '#94A3B8' }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={40} />;
                    const tooltip = (
                      <Tooltip
                        contentStyle={{ borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '10px', fontWeight: 800, padding: '10px 14px', background: 'var(--tooltip-bg, #fff)' }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name === 'income' ? 'Income' : name === 'outflow' ? 'Outflow' : 'Net']}
                        labelStyle={{ color: '#64748b', marginBottom: 4 }}
                      />
                    );

                    if (chartType === 'pie') {
                      const pieData = [
                        { name: 'Income', value: Math.max(0, analyticsData.totalIncome) },
                        { name: 'Outflow', value: Math.max(0, stats.totalOutflow) },
                      ];
                      const PIE_COLORS = ['#1C7A5B', '#f87171'];
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="none">
                              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '10px', fontWeight: 800, padding: '10px 14px', background: 'var(--tooltip-bg, #fff)' }}
                              formatter={(value: number, name: string) => [formatCurrency(value), name]}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                          </RePieChart>
                        </ResponsiveContainer>
                      );
                    }

                    if (chartType === 'bar') {
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsData.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            {grid}{xAxis}{yAxis}{tooltip}
                            <Bar dataKey="income" fill="#1C7A5B" radius={[3, 3, 0, 0]} maxBarSize={16} />
                            <Bar dataKey="outflow" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    }

                    // Default — line chart of income vs outflow.
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          {grid}{xAxis}{yAxis}{tooltip}
                          <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="income" stroke="#1C7A5B" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="outflow" stroke="#f87171" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              ) : (
                <div className="h-[240px] flex flex-col items-center justify-center gap-3 text-slate-300 dark:text-zinc-600">
                  <PieChart size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest">No transaction data yet</p>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-5 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-seafoam" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-red-300" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Outflow</span>
                </div>
                {analyticsData.peakDay.income > 0 && (
                  <div className="ml-auto text-right">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Peak Day</p>
                    <p className="text-[9px] font-black text-pine dark:text-zinc-100">
                      {analyticsData.peakDay.name} · {formatCurrency(analyticsData.peakDay.income)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">

              {/* Revenue streams */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm">
                <h4 className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-4">Revenue Streams</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Clinical Services', val: stats.totalClientRev, pct: analyticsData.clinicalPct, color: '#1C7A5B' },
                    { label: 'B2B Referrals',     val: stats.totalB2BRev,    pct: analyticsData.b2bPct,      color: '#06b6d4' },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{r.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black text-pine dark:text-zinc-100">{formatCurrency(r.val)}</span>
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400">{r.pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${r.pct}%`, background: `linear-gradient(90deg, ${r.color}cc, ${r.color})` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment methods */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm">
                <h4 className="text-[9px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-4">By Payment Method</h4>
                {analyticsData.methodData.length > 0 ? (
                  <div className="space-y-2.5">
                    {analyticsData.methodData.map(m => {
                      const pct = analyticsData.totalIncome > 0 ? Math.round((m.value / analyticsData.totalIncome) * 100) : 0;
                      return (
                        <div key={m.name} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 w-20 truncate">{m.name}</span>
                          <div className="flex-1 h-1.5 bg-slate-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: m.color }} />
                          </div>
                          <span className="text-[8px] font-black text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[9px] text-slate-300 dark:text-zinc-600 font-semibold">No data</p>
                )}
              </div>

              {/* Outflow pill */}
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-red-400 mb-1">Total Outflow</p>
                  <p className="text-base font-black text-red-500 tracking-tight">{formatCurrency(stats.totalOutflow)}</p>
                </div>
                <ArrowUpRight size={20} className="text-red-300 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Wallets tab ──────────────────────────────────────────────────── */}
      {activeTab === 'wallets' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">

          {/* Overview strip — combined hero card with Float + Transactions */}
          <div className="bg-pine dark:bg-zinc-900 rounded-xl p-5 sm:p-6 text-white relative overflow-hidden shadow-xl shadow-pine/30 group">
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-seafoam/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-stretch sm:justify-between gap-5">
              {/* Total float */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.2em] mb-2">Total Wallet Float</p>
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tighter">
                      {wallets.length > 0 ? formatCurrency(totalFloat) : <span className="text-xl text-white/40">No wallets</span>}
                    </h2>
                    {wallets.length > 1 && (
                      <p className="text-white/40 text-[9px] mt-1">
                        {wallets.length} wallets combined{multiScope ? ` · across ${scopeClinicList.length} clinics` : ''}
                      </p>
                    )}
                  </div>
                  <div className="sm:hidden p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 shrink-0">
                    <Wallet className="text-seafoam" size={18} />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px self-stretch bg-white/10" />
              <div className="sm:hidden h-px w-full bg-white/10" />

              {/* Transactions */}
              <div className="min-w-0 sm:flex-1 sm:max-w-[260px]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.2em]">Transactions</p>
                  <div className="hidden sm:flex p-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10">
                    <Wallet className="text-seafoam" size={16} />
                  </div>
                </div>
                <h3 className="text-2xl font-black tracking-tight">
                  {stats.count} <span className="text-white/50 text-sm font-bold">Total</span>
                </h3>
                {stats.count > 0 ? (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[8px] font-black uppercase text-white/50">
                      <span>Settled</span><span className="text-white/90">{stats.settledPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${stats.settledPct}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-[9px] text-white/40 mt-2">No transactions yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} configured
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { scopeClinicList.forEach(c => cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: String(c.id) })); fetchWallets(true); }}
                disabled={walletsLoading}
                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-seafoam transition-all"
              >
                <RefreshCw size={13} className={walletsLoading ? 'animate-spin' : ''} />
              </button>
              <button className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 px-3 sm:px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-seafoam transition-all shadow-sm flex items-center gap-2">
                <Download size={12} /> Ledger
              </button>
            </div>
          </div>

          {walletsLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : (wallets.length === 0 || richCreateBranchId !== undefined) ? (
            /* ── First-time setup form ── */
            (() => {
              const meta = form.walletType ? WALLET_TYPE_META[form.walletType as WalletKind] : null;
              return (
                <div className="bg-white dark:bg-zinc-900 border-2 border-seafoam/30 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center">
                      <Wallet size={20} className="text-seafoam" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                        {wallets.length === 0 ? 'Set Up Your Wallet' : 'Add Another Wallet'}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Configure how you receive & track payments</p>
                    </div>
                    {/* Allow backing out of the rich flow when it's
                        opened for an add-another (not first-time). */}
                    {wallets.length > 0 && (
                      <button
                        onClick={() => {
                          setRichCreateBranchId(undefined);
                          setForm(emptyForm());
                          setWalletGroup(null);
                        }}
                        className="shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Wallet Name</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={`e.g. ${clinic.name} Main Account`}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                    />
                  </div>

                  {/* Step 1 — pick Virtual or Real (only when no kind is chosen yet). */}
                  {walletGroup === null && (
                    /* Step 1 view */
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Wallet Kind</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setWalletGroup('virtual');
                            // Don't lock to a subtype yet — user picks
                            // it on the next step.
                            setForm(f => ({ ...f, walletType: '', accountNumber: '', paybillBank: '' }));
                          }}
                          className="flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-zinc-700 hover:border-seafoam/50 text-left transition-all"
                        >
                          <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-slate-500">
                            <Wallet size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black uppercase tracking-tight text-pine dark:text-zinc-100">Virtual</p>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-relaxed">Internal-only ledger. No external rail. Track a running balance + intent for that account.</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWalletGroup('real');
                            setForm(f => ({ ...f, walletType: '', accountNumber: '', paybillBank: '' }));
                          }}
                          className="flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-zinc-700 hover:border-seafoam/50 text-left transition-all"
                        >
                          <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-slate-500">
                            <Smartphone size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black uppercase tracking-tight text-pine dark:text-zinc-100">Real — Mpesa</p>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-relaxed">Connect a Daraja paybill / till. Real Mpesa money can flow through. Bank, card, and other rails are coming soon.</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Once a kind is picked, show a header + back button. */}
                  {walletGroup !== null && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-seafoam/10 text-seafoam flex items-center justify-center">
                          {walletGroup === 'virtual' ? <Wallet size={13} /> : <Smartphone size={13} />}
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
                          {walletGroup === 'virtual' ? 'Virtual Wallet' : 'Real — Mpesa'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setWalletGroup(null);
                          // Clear gateway-specific fields, keep common ones (name/balance/debt/intent).
                          setForm(f => ({
                            ...f,
                            walletType: '',
                            accountNumber: '',
                            paybillBank: '',
                            paybillAccountNo: '',
                            mpesaShortcode: '',
                            mpesaConsumerKey: '',
                            mpesaConsumerSecret: '',
                            mpesaPasskey: '',
                          }));
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-seafoam hover:text-pine flex items-center gap-1"
                      >
                        ← Change kind
                      </button>
                    </div>
                  )}

                  {/* Subtype sub-grid — shown for both Virtual and Real once kind is picked. */}
                  {walletGroup !== null && (
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                        {walletGroup === 'virtual' ? 'What kind of wallet is this tracking?' : 'Mpesa rail'}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {(['BANK','DIGITAL_WALLET','MPESA_POCHI','TILL','MPESA_PAYBILL'] as WalletKind[])
                          .filter((k) => walletGroup === 'virtual' ? true : WALLET_TYPE_META[k].realSupported)
                          .map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, walletType: k, accountNumber: '', paybillBank: '' }))}
                              className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wide transition-all ${
                                form.walletType === k
                                  ? 'border-seafoam bg-seafoam/10 text-seafoam'
                                  : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam/50 hover:text-seafoam'
                              }`}
                            >
                              {WALLET_TYPE_META[k].icon}
                              {WALLET_TYPE_META[k].label}
                            </button>
                        ))}
                      </div>
                      {walletGroup === 'real' && (
                        <p className="text-[10px] text-slate-400 mt-2">
                          Bank Account & Digital Wallet aren't connectable yet — pick Virtual if you only want to track them.
                        </p>
                      )}
                      {form.walletType === '' && (
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2">Pick a wallet kind above to continue.</p>
                      )}
                    </div>
                  )}

                  {/* Virtual + subtype picked → optional account/identifier field. */}
                  {walletGroup === 'virtual' && form.walletType !== '' && (
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                        {WALLET_TYPE_META[form.walletType as WalletKind]?.accountLabel || 'Account / Reference'} (optional)
                      </label>
                      <input
                        value={form.accountNumber}
                        onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                        placeholder="Recorded for reference only — no money flows through"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                      />
                    </div>
                  )}

                  {/* Real Mpesa — credentials + shortcode. */}
                  {walletGroup === 'real' && form.walletType !== '' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Paybill / Till Shortcode *</label>
                          <input
                            value={form.accountNumber}
                            onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                            placeholder="e.g. 174379"
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Mode</label>
                          <select
                            value={form.mpesaTestMode ? 'sandbox' : 'production'}
                            onChange={e => setForm(f => ({ ...f, mpesaTestMode: e.target.value === 'sandbox' }))}
                            className="w-full appearance-none px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                          >
                            <option value="sandbox">Sandbox (test)</option>
                            <option value="production">Production</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Consumer Key</label>
                        <div className="relative">
                          <input
                            type={revealed.mpesaConsumerKey ? 'text' : 'password'}
                            value={form.mpesaConsumerKey}
                            onChange={e => setForm(f => ({ ...f, mpesaConsumerKey: e.target.value }))}
                            placeholder="From your Daraja app"
                            className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                          />
                          <button type="button" onClick={() => toggleReveal('mpesaConsumerKey')} aria-label={revealed.mpesaConsumerKey ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                            {revealed.mpesaConsumerKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Consumer Secret</label>
                        <div className="relative">
                          <input
                            type={revealed.mpesaConsumerSecret ? 'text' : 'password'}
                            value={form.mpesaConsumerSecret}
                            onChange={e => setForm(f => ({ ...f, mpesaConsumerSecret: e.target.value }))}
                            placeholder="From your Daraja app"
                            className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                          />
                          <button type="button" onClick={() => toggleReveal('mpesaConsumerSecret')} aria-label={revealed.mpesaConsumerSecret ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                            {revealed.mpesaConsumerSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Lipa Na Mpesa Passkey</label>
                        <div className="relative">
                          <input
                            type={revealed.mpesaPasskey ? 'text' : 'password'}
                            value={form.mpesaPasskey}
                            onChange={e => setForm(f => ({ ...f, mpesaPasskey: e.target.value }))}
                            placeholder="STK push passkey"
                            className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                          />
                          <button type="button" onClick={() => toggleReveal('mpesaPasskey')} aria-label={revealed.mpesaPasskey ? 'Hide value' : 'Show value'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
                            {revealed.mpesaPasskey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                        Credentials are encrypted at rest. Leave them blank if you only want to record the shortcode now and add the keys later.
                      </p>
                    </>
                  )}

                  {/* Common: Intent — what is this account for? */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">What's this wallet for? (optional)</label>
                    <input
                      value={form.intent}
                      onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}
                      placeholder="e.g. Day-to-day operations, Suppliers float, Emergency fund"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                    />
                  </div>

                  {/* Current Balance */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Current Balance (KES)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.balance}
                      onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                      placeholder="0.00 — enter existing balance to migrate"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                    />
                  </div>

                  {/* Current Debt */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Current Debt (KES)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.debt}
                      onChange={e => setForm(f => ({ ...f, debt: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
                    />
                  </div>

                  <button
                    onClick={async () => {
                      if (!form.name) { toast.error('Wallet name is required'); return; }
                      if (walletGroup === null) { toast.error('Pick Virtual or Real first'); return; }
                      if (form.walletType === '') { toast.error('Pick a wallet kind'); return; }
                      if (walletGroup === 'real' && !form.accountNumber) { toast.error('Shortcode / number is required'); return; }
                      const isVirtual = walletGroup === 'virtual';
                      const accountNum = form.accountNumber || null;
                      setSaving(true);
                      try {
                        // Resolve which in-scope clinic this wallet belongs to.
                        // `richCreateBranchId` holds the branch card id (a clinic
                        // id) or null/undefined → the active clinic's entity wallet.
                        const richTarget = richCreateBranchId ? branches.find(b => b.id === richCreateBranchId) : null;
                        const ownerClinicId = richTarget?.entityClinicId ?? String(clinic.id);
                        const targetBranchId = richTarget?.branchId ?? null;
                        // Real Mpesa → upsert per-clinic BYOK config first.
                        // Credentials are encrypted server-side; blanks are
                        // skipped so the user can come back to fill them.
                        if (walletGroup === 'real') {
                          const credentials: Record<string, string> = {};
                          if (form.mpesaConsumerKey)    credentials.consumerKey    = form.mpesaConsumerKey;
                          if (form.mpesaConsumerSecret) credentials.consumerSecret = form.mpesaConsumerSecret;
                          if (form.mpesaPasskey)        credentials.passkey        = form.mpesaPasskey;
                          await paymentGatewaysAPI.upsert(ownerClinicId, 'MPESA', {
                            mode: 'BYOK',
                            isTestMode: form.mpesaTestMode,
                            isActive: true,
                            displayName: form.name,
                            publicConfig: form.accountNumber ? { shortcode: form.accountNumber } : {},
                            credentials,
                          });
                        }
                        const res = await walletAPI.createForClinic(ownerClinicId, {
                          name: form.intent ? `${form.name} — ${form.intent}` : form.name,
                          branchId: targetBranchId,
                          walletType: form.walletType as WalletKind,
                          accountNumber: accountNum,
                          debt: form.debt ? parseFloat(form.debt) : 0,
                          openingBalance: form.balance ? parseFloat(form.balance) : undefined,
                          isVirtual,
                        });
                        if (res.success) {
                          // First-ever wallet: replace the empty list.
                          // Adding-another: append so existing wallets stay.
                          setWallets(prev => prev.length === 0 ? [res.data.wallet] : [...prev, res.data.wallet]);
                          cache.invalidate(WALLETS_CACHE_KEY, { entity: 'CLINIC', id: ownerClinicId });
                        }
                        toast.success(isVirtual ? 'Virtual wallet created' : 'Mpesa wallet created');
                        setForm(emptyForm());
                        setWalletGroup(null);
                        setRichCreateBranchId(undefined);
                      } catch (err: any) {
                        toast.error(err?.response?.data?.message || 'Failed to create wallet');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || walletGroup === null || form.walletType === ''}
                    className="w-full py-3 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                    {saving ? 'Creating…' : walletGroup === null ? 'Pick a kind first' : form.walletType === '' ? 'Pick a wallet kind' : 'Create Wallet'}
                  </button>
                </div>
              );
            })()
          ) : (
            (() => {
              // Build a flat list of items to render in the carousel.
              // One card per wallet (main + secondary, across all
              // branches), plus a "set up" placeholder card for any
              // branch that has no wallet yet. Main wallet is always
              // the first card of its branch group so the user sees
              // the primary destination first.
              type CarouselItem = {
                key: string;             // 'wallet:<id>' or 'setup:<branchKey>'
                branch: BranchWithClinic;
                wallet: WalletType | null;
              };
              const items: CarouselItem[] = [];
              for (const b of branches) {
                const branchKey = b.id;
                const group = walletsByBranch[branchKey] || [];
                if (group.length === 0) {
                  items.push({ key: `setup:${branchKey}`, branch: b, wallet: null });
                  continue;
                }
                // Main wallet first, then the rest in their natural order.
                const sorted = [...group].sort((a, b2) => Number(!!b2.isMain) - Number(!!a.isMain));
                for (const w of sorted) {
                  items.push({ key: `wallet:${w.id}`, branch: b, wallet: w });
                }
              }
              // Initial / fallback selection — first item in the list
              // (typically the Main branch's main wallet).
              const selected =
                items.find(i => i.key === selectedBranchKey) ||
                items[0];
              return (
                <div className="space-y-4">
                  {/* Compact wallet grid — every wallet (main + secondary,
                      across branches) rendered as a small card; click to
                      open its detail panel below. */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Wallets ({items.length})
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {items.map(it => (
                      <WalletMiniCard
                        key={it.key}
                        branch={it.branch}
                        wallet={it.wallet}
                        selected={it.key === selected?.key}
                        onSelect={() => setSelectedBranchKey(it.key)}
                      />
                    ))}
                    {/* Trailing "+ Add wallet" card — opens the rich create
                        flow for the main branch. Use the per-wallet
                        "Add another" button for non-main branches. */}
                    <button
                      type="button"
                      onClick={() => setRichCreateBranchId(null)}
                      className="w-full rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/40 hover:border-seafoam hover:bg-seafoam/5 dark:hover:bg-seafoam/10 transition-all active:scale-[0.98] flex items-center justify-center min-h-[110px] group"
                    >
                      <div className="flex flex-col items-center gap-1.5 text-slate-400 dark:text-zinc-500 group-hover:text-seafoam transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 group-hover:bg-seafoam/10 flex items-center justify-center transition-colors">
                          <Plus size={16} />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest">Add Wallet</p>
                      </div>
                    </button>
                  </div>

                  {/* Detail panel — full card for the picked wallet
                      (hero, meta strip, transfer actions, activity
                      tabs, transactions). */}
                  {selected && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <WalletCard branch={selected.branch} walletOverride={selected.wallet} />
                    </div>
                  )}
                </div>
              );
            })()
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
          {/* ── Mobile / tablet: cards ── */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredTransactions.length > 0 ? filteredTransactions.map(tx => {
              const isIncome = scopeIdSet.has(String(tx.toId));
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-all">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {isIncome ? <ArrowDownLeft size={15}/> : <ArrowUpRight size={15}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-pine dark:text-zinc-100 font-black text-sm truncate">#{tx.id}</p>
                      <p className={`font-mono font-black text-sm whitespace-nowrap shrink-0 ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{tx.type}</p>
                      <span className="text-slate-300 dark:text-zinc-600">·</span>
                      <p className="text-slate-400 text-[9px] font-bold">{tx.method}</p>
                      <span className="text-slate-300 dark:text-zinc-600">·</span>
                      <p className="text-slate-400 text-[9px] font-bold">{tx.date}</p>
                      <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase border shrink-0 ${tx.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="py-16 text-center"><p className="text-pine dark:text-zinc-100 font-black text-lg uppercase tracking-tighter">No ledger entries found</p></div>
            )}
          </div>

          {/* ── Desktop: table ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800">
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry ID</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                {filteredTransactions.length > 0 ? filteredTransactions.map(tx => {
                  const isIncome = scopeIdSet.has(String(tx.toId));
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-all">
                      <td className="px-8 py-5">
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
                      <td className="px-8 py-5"><p className="text-pine dark:text-zinc-100 font-bold text-xs">{tx.method}</p></td>
                      <td className="px-8 py-5"><p className="text-pine dark:text-zinc-200 font-bold text-xs whitespace-nowrap">{tx.date}</p></td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${tx.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
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

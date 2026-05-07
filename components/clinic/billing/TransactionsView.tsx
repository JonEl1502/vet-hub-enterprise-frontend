import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  Search,
  Download,
  CreditCard,
  User,
  PawPrint,
  Calendar,
  X,
  TrendingUp,
  RefreshCw,
  Package,
  Stethoscope,
  TrendingDown,
} from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { useFx } from '../../../contexts/FxContext';
import Money from '../../shared/common/Money';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  method: string;
  createdAt: string;
  settledAt?: string;
  appointmentId?: string;
  receiptNumber?: string | null;
  referenceNumber?: string | null;
  metadata?: Record<string, any>;
  client?: {
    id: string;
    name: string;
  };
  appointment?: {
    id: string;
    date: string;
    pet?: {
      id: string;
      name: string;
      species: string;
    };
  };
}

interface Props {
  onViewClient?: (clientId: number) => void;
  onViewAppointment?: (appointmentId: number) => void;
}

const TransactionsView: React.FC<Props> = ({ onViewClient, onViewAppointment }) => {
  const { transactions, isLoadingTransactions, ensureTransactions, refreshTransactions } = useData();
  useEffect(() => { ensureTransactions(); }, [ensureTransactions]);

  // Filter state
  const [txIdSearch, setTxIdSearch] = useState('');
  const [clientPetSearch, setClientPetSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const hasActiveFilters = txIdSearch || clientPetSearch || statusFilter !== 'ALL' || methodFilter !== 'ALL' || typeFilter !== 'ALL' || !!(dateRange?.start || dateRange?.end);

  const clearFilters = () => {
    setTxIdSearch('');
    setClientPetSearch('');
    setStatusFilter('ALL');
    setMethodFilter('ALL');
    setTypeFilter('ALL');
    setDateRange(null);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Transaction ID / receipt search
      if (txIdSearch) {
        const q = txIdSearch.toLowerCase();
        const matchesTxId =
          tx.id.toLowerCase().includes(q) ||
          tx.receiptNumber?.toLowerCase().includes(q);
        if (!matchesTxId) return false;
      }

      // Client / Pet / Supplier search
      if (clientPetSearch) {
        const q = clientPetSearch.toLowerCase();
        const matchesClientPet =
          tx.client?.name.toLowerCase().includes(q) ||
          tx.appointment?.pet?.name.toLowerCase().includes(q) ||
          (tx as any).metadata?.supplierName?.toLowerCase().includes(q) ||
          (tx as any).metadata?.orderNumber?.toLowerCase().includes(q);
        if (!matchesClientPet) return false;
      }

      // Type filter
      if (typeFilter === 'INCOME' && tx.type === 'SUPPLIER') return false;
      if (typeFilter === 'EXPENSES' && tx.type !== 'SUPPLIER') return false;

      // Status filter
      if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;

      // Method filter
      if (methodFilter !== 'ALL' && tx.method !== methodFilter) return false;

      // Date range
      if (dateRange?.start || dateRange?.end) {
        const txDate = new Date(tx.createdAt);
        if (dateRange.start) {
          const from = new Date(dateRange.start);
          from.setHours(0, 0, 0, 0);
          if (txDate < from) return false;
        }
        if (dateRange.end) {
          const to = new Date(dateRange.end);
          to.setHours(23, 59, 59, 999);
          if (txDate > to) return false;
        }
      }

      return true;
    });
  }, [transactions, txIdSearch, clientPetSearch, statusFilter, methodFilter, typeFilter, dateRange]);

  // Display currency = active clinic's currency. Sums must be FX-converted
  // to this currency before adding, otherwise summing mixed-currency amounts
  // produces a meaningless number. When conversion isn't available we fall
  // back to the raw amount for that row (best-effort, never crashes).
  const { selectedClinics } = useClinic();
  const { convert } = useFx();
  const displayCurrency = selectedClinics?.[0]?.currency
    || filteredTransactions[0]?.currency
    || transactions[0]?.currency
    || 'KES';

  const sumIn = (txs: Transaction[]) => txs.reduce((sum, tx) => {
    const inDisplay = tx.currency?.toUpperCase() === displayCurrency.toUpperCase()
      ? tx.amount
      : (convert(tx.amount, tx.currency, displayCurrency) ?? tx.amount);
    return sum + inDisplay;
  }, 0);

  const incomeAmount = sumIn(filteredTransactions.filter(tx => tx.type !== 'SUPPLIER'));
  const expensesAmount = sumIn(filteredTransactions.filter(tx => tx.type === 'SUPPLIER'));

  const getStatusStyles = (status: string) => {
    const map: Record<string, string> = {
      SETTLED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      DISPUTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    };
    return `text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border ${map[status] || map.SETTLED}`;
  };

  const getTypeLabel = (tx: Transaction) => {
    if (tx.type === 'SUPPLIER') {
      return tx.metadata?.orderNumber ? 'PO Expense' : 'Expense';
    }
    const labels: Record<string, string> = {
      SERVICE: 'Service',
      REFERRAL: 'Referral',
      FREELANCER: 'Freelancer',
      SUBSCRIPTION: 'Subscription',
      LOGISTICS: 'Logistics',
    };
    return labels[tx.type] || tx.type;
  };

  const getTypeStyles = (type: string) => {
    const map: Record<string, string> = {
      SERVICE: 'bg-seafoam/10 text-seafoam border-seafoam/20',
      REFERRAL: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      SUPPLIER: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return `text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border ${map[type] || 'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-transparent'}`;
  };

  const handleExport = () => {
    const rows = [
      ['Transaction ID', 'Receipt', 'Client', 'Pet', 'Date', 'Type', 'Method', 'Status', 'Amount', 'Currency'],
      ...filteredTransactions.map(tx => [
        tx.id,
        tx.receiptNumber || '',
        tx.client?.name || '',
        tx.appointment?.pet?.name || '',
        formatDate(tx.createdAt),
        tx.type,
        tx.method,
        tx.status,
        tx.amount,
        tx.currency,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">

      {/* ── Filters Card ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] px-3 sm:px-4 py-6 shadow-sm space-y-5">

        {/* Row 1: search inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Receipt className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Search Transaction ID…"
              value={txIdSearch}
              onChange={e => setTxIdSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-pine dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Client, Pet or Supplier…"
              value={clientPetSearch}
              onChange={e => setClientPetSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-pine dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
            />
          </div>
        </div>

        {/* Row 2: three dropdowns */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          >
            <option value="ALL">All Types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSES">Expenses</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          >
            <option value="ALL">All Status</option>
            <option value="SETTLED">Settled</option>
            <option value="PENDING">Pending</option>
            <option value="DISPUTED">Disputed</option>
          </select>
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="w-full min-w-0 px-3 sm:px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam/40"
          >
            <option value="ALL">All Methods</option>
            <option value="M_PESA">M-PESA</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>

        {/* Row 3: date range + clear + result count */}
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            className="flex-1 min-w-0"
            buttonClassName="w-full justify-between"
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all shrink-0"
            >
              <X size={12} /> Clear
            </button>
          )}
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 shrink-0">
            {filteredTransactions.length} result{filteredTransactions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-zinc-800" />

        {/* Totals + Export */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Income */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Income</p>
                <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                  <span>+</span>
                  <Money
                    amount={incomeAmount}
                    currency={displayCurrency}
                    primaryClassName="font-black font-mono"
                    hideOriginal
                    showCode
                  />
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl">
              <div className="p-2 bg-red-500/10 rounded-xl">
                <Receipt size={14} className="text-red-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Expenses</p>
                <div className="text-lg font-black font-mono text-red-600 dark:text-red-400">
                  <span>-</span>
                  <Money
                    amount={expensesAmount}
                    currency={displayCurrency}
                    primaryClassName="font-black font-mono"
                    hideOriginal
                    showCode
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-3 bg-seafoam text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-seafoam/90 transition-all active:scale-95"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={() => refreshTransactions()}
              disabled={isLoadingTransactions}
              className="p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:border-pine dark:hover:border-zinc-500 transition-all disabled:opacity-50"
              title="Refresh transactions"
            >
              <RefreshCw size={14} className={isLoadingTransactions ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Cards List ───────────────────────────────────────────────── */}
      {isLoadingTransactions ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-seafoam border-t-transparent" />
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-4">Loading transactions…</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-[2rem]">
          <Receipt size={36} className="mx-auto mb-3 text-slate-300 dark:text-zinc-600" />
          <p className="text-slate-400 dark:text-zinc-500 text-sm font-black uppercase tracking-widest">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map(tx => (
            <div
              key={tx.id}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md hover:border-seafoam/30 dark:hover:border-seafoam/20 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                {/* Left: icon + ID */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2.5 rounded-xl shrink-0 ${tx.type === 'SUPPLIER' ? 'bg-red-500/10' : 'bg-seafoam/10'}`}>
                    {tx.type === 'SUPPLIER'
                      ? <Package size={16} className="text-red-500" />
                      : tx.type === 'SERVICE'
                        ? <Stethoscope size={16} className="text-seafoam" />
                        : <Receipt size={16} className="text-seafoam" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-pine dark:text-zinc-100 text-sm truncate">#{tx.id}</p>
                    {(tx.receiptNumber || tx.referenceNumber) && (
                      <p className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                        {tx.receiptNumber
                          ? `Receipt ${tx.receiptNumber}`
                          : `Ref ${tx.referenceNumber}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Client / Pet / Supplier */}
                <div className="flex items-center gap-2 min-w-[130px]">
                  {tx.type === 'SUPPLIER' ? (
                    <div>
                      {tx.metadata?.supplierName && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={11} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                          <p className="text-sm font-bold text-pine dark:text-zinc-200 truncate">{tx.metadata.supplierName}</p>
                        </div>
                      )}
                      {tx.metadata?.orderNumber && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase truncate font-mono">
                            PO #{tx.metadata.orderNumber}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : tx.client || tx.appointment?.pet ? (
                    <div>
                      {tx.client && (
                        <div className="flex items-center gap-1.5">
                          <User size={11} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                          <p className="text-sm font-bold text-pine dark:text-zinc-200 truncate">{tx.client.name}</p>
                        </div>
                      )}
                      {tx.appointment?.pet && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <PawPrint size={11} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                          <p className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase truncate">
                            {tx.appointment.pet.name}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-zinc-600 font-semibold">—</span>
                  )}
                </div>

                {/* Date */}
                <div className="min-w-[100px]">
                  <p className="text-sm font-bold text-pine dark:text-zinc-200 whitespace-nowrap">{formatDate(tx.createdAt)}</p>
                  <p className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 mt-0.5">{formatTime(tx.createdAt)}</p>
                </div>

                {/* Method */}
                <div className="shrink-0">
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={13} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                      {tx.method.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Type + Status badges */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={getTypeStyles(tx.type)}>{getTypeLabel(tx)}</span>
                  <span className={getStatusStyles(tx.status)}>{tx.status}</span>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0 min-w-[100px]">
                  <div className="flex items-center justify-end gap-1">
                    {tx.type === 'SUPPLIER'
                      ? <TrendingDown size={12} className="text-red-400 shrink-0" />
                      : <TrendingUp size={12} className="text-emerald-400 shrink-0" />
                    }
                    <div className={`text-base font-black font-mono ${
                      tx.type === 'SUPPLIER' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      <span>{tx.type === 'SUPPLIER' ? '-' : '+'}</span>
                      <Money
                        amount={tx.amount}
                        currency={tx.currency}
                        target={displayCurrency}
                        primaryClassName="font-black font-mono"
                        showCode
                        inline
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionsView;

import React, { useState, useMemo } from 'react';
import { Receipt, Search, Filter, Download, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { formatDate, formatTime } from '../services/utils/dateFormatter';

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
  receiptNumber?: string;
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
  const { transactions, isLoadingTransactions } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        tx.id.toLowerCase().includes(searchLower) ||
        tx.receiptNumber?.toLowerCase().includes(searchLower) ||
        tx.appointment?.pet?.name.toLowerCase().includes(searchLower) ||
        tx.client?.name.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;

      // Method filter
      const matchesMethod = methodFilter === 'ALL' || tx.method === methodFilter;

      // Date range filter
      let matchesDate = true;
      if (dateRange !== 'ALL') {
        const txDate = new Date(tx.createdAt);
        const now = new Date();
        if (dateRange === 'TODAY') {
          matchesDate = txDate.toDateString() === now.toDateString();
        } else if (dateRange === 'WEEK') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = txDate >= weekAgo;
        } else if (dateRange === 'MONTH') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = txDate >= monthAgo;
        }
      }

      return matchesSearch && matchesStatus && matchesMethod && matchesDate;
    });
  }, [transactions, searchQuery, statusFilter, methodFilter, dateRange]);

  const totalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const currency = filteredTransactions[0]?.currency || 'KES';

  const getStatusBadge = (status: string) => {
    const styles = {
      SETTLED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      DISPUTED: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return `text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${styles[status as keyof typeof styles] || styles.SETTLED}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Transactions</h1>
          <p className="text-slate-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
            Financial Transaction History
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-6 py-4">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Amount</p>
            <p className="text-2xl font-black font-mono text-emerald-600 mt-1">{currency} {totalAmount.toLocaleString()}</p>
          </div>
          <button className="flex items-center gap-2 bg-seafoam text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-seafoam/90 transition-all active:scale-95">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-pine dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-seafoam"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam"
          >
            <option value="ALL">All Status</option>
            <option value="SETTLED">Settled</option>
            <option value="PENDING">Pending</option>
            <option value="DISPUTED">Disputed</option>
          </select>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam"
          >
            <option value="ALL">All Methods</option>
            <option value="M_PESA">M-PESA</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>

          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-pine dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-seafoam"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">Last 7 Days</option>
            <option value="MONTH">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {isLoadingTransactions ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-seafoam border-t-transparent"></div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-4">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                <th className="px-8 py-5 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Transaction</th>
                <th className="px-8 py-5 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Client/Pet</th>
                <th className="px-8 py-5 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Date</th>
                <th className="px-8 py-5 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Method</th>
                <th className="px-8 py-5 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Amount</th>
                <th className="px-8 py-5 font-black text-pine dark:text-zinc-400 uppercase text-[10px] tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-8 py-6">
                    <div>
                      <p className="text-pine dark:text-zinc-100 font-black text-sm">#{tx.id}</p>
                      {tx.receiptNumber && (
                        <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">Receipt: {tx.receiptNumber}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div>
                      {tx.client && (
                        <p className="text-pine dark:text-zinc-200 font-bold text-sm">{tx.client.name}</p>
                      )}
                      {tx.appointment?.pet && (
                        <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">
                          {tx.appointment.pet.species === 'Dog' ? '🐶' : '🐱'} {tx.appointment.pet.name}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-pine dark:text-zinc-200 font-bold text-sm">{formatDate(tx.createdAt)}</p>
                    <p className="text-slate-400 text-[9px] font-black uppercase mt-0.5">{formatTime(tx.createdAt)}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[9px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-1 rounded-lg">
                      {tx.method.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-lg font-black font-mono text-emerald-600">{tx.currency} {tx.amount.toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className={getStatusBadge(tx.status)}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-24 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-20 uppercase font-black text-[10px] tracking-[0.2em] m-8">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsView;


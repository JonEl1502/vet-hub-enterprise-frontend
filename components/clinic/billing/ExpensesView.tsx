import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import PageHeader from '../../shared/common/PageHeader';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { expensesAPI, Expense } from '../../../services/modules/expenses.api';
import { toast } from '../../../services/utils/toast';

/**
 * Finance → Expenses (backend 112) — clinic operating spend: rent, salaries,
 * utilities… Recording here is what makes the BI dashboard's expense figures
 * (and a future P&L) real instead of stock-purchases-only. Each write also
 * recomputes that day's summary snapshot server-side.
 */

const CATEGORIES = ['Rent', 'Salaries', 'Utilities', 'Transport', 'Equipment', 'Marketing', 'Insurance', 'Licenses & taxes', 'Cleaning', 'Other'];
const PAID_VIA = ['CASH', 'MPESA', 'BANK_TRANSFER', 'CARD', 'CHEQUE'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

interface Props { currency?: string }

const ExpensesView: React.FC<Props> = ({ currency = 'KES' }) => {
  // Default window: this month.
  const [range, setRange] = useState<DateRange | null>(null);
  const { from, to } = useMemo(() => {
    if (range?.start && range?.end) return { from: range.start, to: range.end };
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }, [range]);

  const [data, setData] = useState<{ expenses: Expense[]; total: number; byCategory: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Add form
  const [category, setCategory] = useState('Rent');
  const [customCat, setCustomCat] = useState('');
  const [amount, setAmount] = useState('');
  const [incurredAt, setIncurredAt] = useState(() => iso(new Date()));
  const [paidVia, setPaidVia] = useState('CASH');
  const [description, setDescription] = useState('');

  const money = useCallback((n: number) =>
    `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, [currency]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expensesAPI.list({ from: iso(from), to: iso(to) });
      if (res.success && res.data) setData(res.data);
    } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const cat = category === 'Other' ? (customCat.trim() || 'Other') : category;
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error('Enter an amount'); return; }
    setBusy(true);
    try {
      const res = await expensesAPI.create({
        category: cat, amount: amt, incurredAt,
        description: description.trim() || undefined, paidVia,
      });
      if (res.success) {
        toast.success(`${money(amt)} — ${cat} recorded`);
        setAmount(''); setDescription(''); setCustomCat('');
        await load();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to record the expense'); }
    finally { setBusy(false); }
  };

  const remove = async (row: Expense) => {
    if (!window.confirm(`Delete ${row.category} — ${money(row.amount)} (${fmt(row.incurredAt)})?`)) return;
    setBusy(true);
    try {
      const res = await expensesAPI.remove(row.id);
      if (res.success) { toast.success('Expense deleted'); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
    finally { setBusy(false); }
  };

  const cats = Object.entries(data?.byCategory ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Expenses"
        subtitle="Operating spend — rent, salaries, utilities. Feeds the BI dashboard's expense figures."
        icon={Wallet}
        onBack
        actions={<DateRangePicker value={range} onChange={r => setRange(r && r.start && r.end ? r : null)} />}
      />

      {/* ── Record an expense ── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5"><Plus size={13} /> Record an expense</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                category === c ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-seafoam'
              }`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {category === 'Other' && (
            <div>
              <label className="field-label">Category name</label>
              <input className="field-input" value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="e.g. Security" />
            </div>
          )}
          <div>
            <label className="field-label">Amount ({currency}) *</label>
            <input type="number" min="0" step="0.01" className="field-input text-right font-mono" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="field-label">Date *</label>
            <input type="date" className="field-input" value={incurredAt} onChange={e => setIncurredAt(e.target.value)} max={iso(new Date())} />
          </div>
          <div>
            <label className="field-label">Paid via</label>
            <select className="field-select" value={paidVia} onChange={e => setPaidVia(e.target.value)}>
              {PAID_VIA.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className={category === 'Other' ? 'col-span-2 md:col-span-4' : 'col-span-2'}>
            <label className="field-label">Description (optional)</label>
            <input className="field-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. August rent — Kikuyu branch" />
          </div>
        </div>
        <button onClick={add} disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-seafoam text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} Record expense
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-seafoam" /></div>
      ) : (
        <>
          {/* ── Totals ── */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total in period</p>
              <p className="text-base font-black font-mono text-rose-500">{money(data?.total ?? 0)}</p>
            </div>
            {cats.slice(0, 6).map(([c, v]) => (
              <div key={c} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{c}</p>
                <p className="text-base font-black font-mono text-pine dark:text-zinc-100">{money(v)}</p>
              </div>
            ))}
          </div>

          {/* ── List ── */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            {(data?.expenses.length ?? 0) === 0 ? (
              <p className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600">No expenses recorded in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-zinc-800">
                      {['Date', 'Category', 'Description', 'Paid via', 'Amount', ''].map((h, i) => (
                        <th key={i} className={`px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/60">
                    {data!.expenses.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap">{fmt(r.incurredAt)}</td>
                        <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20">{r.category}</span></td>
                        <td className="px-4 py-2.5 text-[11px] font-bold text-pine dark:text-zinc-100">{r.description || '—'}</td>
                        <td className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase">{(r.paidVia || '—').replace('_', ' ')}</td>
                        <td className="px-4 py-2.5 text-[11px] font-black font-mono text-right text-pine dark:text-zinc-100">{money(r.amount)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <button onClick={() => remove(r)} disabled={busy} title="Delete this expense"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-40">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ExpensesView;

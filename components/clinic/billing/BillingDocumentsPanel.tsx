import React from 'react';
import { FileText, ReceiptText } from 'lucide-react';
import type { PaymentHistoryRow } from '../../../services/modules/subscriptionPaymentHistory.api';

/**
 * Invoices & Receipts — the billing "statements" tab.
 *
 * Extracted from BillingView so the SUPPLIER billing page renders the exact
 * same table (user, 2026-08-23: *"match billing page ui from clinic including
 * statements and view pages, they must match exactly, only thing different src
 * of data"*). A copy would have looked identical on the day it was written and
 * drifted within a week; this cannot.
 *
 * Everything audience-specific arrives as a prop: the rows, and the one line of
 * copy that says whose charges these are.
 */

interface Props {
  invoices: PaymentHistoryRow[];
  receipts: PaymentHistoryRow[];
  docTab: 'invoices' | 'receipts';
  setDocTab: (t: 'invoices' | 'receipts') => void;
  /** Document number, e.g. INV-PAY-000009. Owned by the caller so both pages number alike. */
  docNo: (prefix: 'INV' | 'RCP', row: PaymentHistoryRow) => string;
  formatDate: (iso: string) => string;
  onView: (row: PaymentHistoryRow) => void;
  /** Money formatter — the caller owns display currency, so both pages agree. */
  formatPrice: (amount: number, currency?: string) => string;
  /** "this clinic" / "this supplier account" — the only wording that differs. */
  ownerNoun?: string;
}

const BillingDocumentsPanel: React.FC<Props> = ({
  invoices, receipts, docTab, setDocTab, docNo, formatDate, onView, formatPrice, ownerNoun = 'this clinic',
}) => (
  <section className="space-y-4">

        {/* Sub-tabs */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 inline-flex min-w-max">
            {([
              { id: 'invoices' as const, label: 'Invoices', icon: FileText, count: invoices.length },
              { id: 'receipts' as const, label: 'Receipts', icon: ReceiptText, count: receipts.length },
            ]).map((t) => {
              const Icon = t.icon;
              const active = docTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setDocTab(t.id)}
                  className={`px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm'
                      : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
                  }`}
                >
                  <Icon size={11} /> {t.label}
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] ${
                    active ? 'bg-slate-100 dark:bg-zinc-700' : 'bg-slate-200 dark:bg-zinc-800'
                  }`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-zinc-500">
          {docTab === 'invoices'
            ? `Every subscription charge raised on ${ownerNoun}, paid or not.`
            : 'Proof of payment for each settled subscription charge.'}
        </p>

        {(() => {
          const rows = docTab === 'invoices' ? invoices : receipts;
          if (rows.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12 text-center">
                {docTab === 'invoices'
                  ? <FileText size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />
                  : <ReceiptText size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />}
                <p className="mt-3 text-sm font-bold text-slate-600 dark:text-zinc-300">
                  No {docTab} yet
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                  {docTab === 'invoices'
                    ? 'Subscription charges will appear here once you pick a plan.'
                    : 'Receipts appear here once a payment settles.'}
                </p>
              </div>
            );
          }
          return (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">
                        {docTab === 'invoices' ? 'Invoice #' : 'Receipt #'}
                      </th>
                      <th className="text-left px-4 py-2 font-semibold">Date</th>
                      <th className="text-left px-4 py-2 font-semibold">Plan</th>
                      <th className="text-left px-4 py-2 font-semibold">Channel</th>
                      <th className="text-right px-4 py-2 font-semibold">Amount</th>
                      <th className="text-left px-4 py-2 font-semibold">Status</th>
                      <th className="text-right px-4 py-2 font-semibold">Document</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {rows.map((row) => (
                      <tr key={`${row.channel}-${row.id}`} className="text-slate-700 dark:text-zinc-300">
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                          {docNo(docTab === 'invoices' ? 'INV' : 'RCP', row)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.settledAt || row.createdAt)}</td>
                        <td className="px-4 py-3 font-medium">{row.packageName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                            {row.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatPrice(row.amount, row.currency)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            row.status === 'SUCCESS'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : row.status === 'PENDING'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {docTab === 'invoices' && row.status === 'SUCCESS' ? 'PAID' : row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onView(row)}
                            className="text-pine dark:text-seafoam hover:underline text-xs font-semibold"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
        </section>
);

export default BillingDocumentsPanel;

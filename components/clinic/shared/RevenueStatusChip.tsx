import React from 'react';
import { FileText, ReceiptText, CheckCircle2, AlertTriangle, CircleDollarSign, PiggyBank } from 'lucide-react';

/**
 * Where one receivable sits on Bill → Invoice → Payment → Settlement, as a chip.
 *
 * The same seven states were being re-derived and re-styled in every list that
 * showed money (bills, invoices, the account timeline, the visit footer), so
 * "Paid" was emerald in one place and slate in another and OVERDUE existed
 * nowhere. One component, one derivation (user, 2026-08-04).
 */
export type RevenueStatus =
  | 'BILL_DRAFT' | 'BILL_APPROVED' | 'INVOICED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CREDIT';

const META: Record<RevenueStatus, { label: string; icon: any; cls: string }> = {
  BILL_DRAFT:    { label: 'Bill draft',    icon: FileText,          cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 ring-slate-200 dark:ring-zinc-700' },
  BILL_APPROVED: { label: 'Bill approved', icon: FileText,          cls: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 ring-cyan-200 dark:ring-cyan-900' },
  INVOICED:      { label: 'Invoiced',      icon: ReceiptText,       cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-900' },
  PARTIAL:       { label: 'Part paid',     icon: CircleDollarSign,  cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-amber-200 dark:ring-amber-900' },
  PAID:          { label: 'Paid',          icon: CheckCircle2,      cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900' },
  OVERDUE:       { label: 'Overdue',       icon: AlertTriangle,     cls: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 ring-rose-200 dark:ring-rose-900' },
  CREDIT:        { label: 'Credit',        icon: PiggyBank,         cls: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 ring-purple-200 dark:ring-purple-900' },
};

/**
 * Derive the state from a receivable row (the `/clients/:id/billing` shape).
 *
 * Order matters: OVERDUE outranks everything unpaid, and settlement is judged
 * on the MONEY (`outstanding`), never on the visit's `isPaid` flag — that flag
 * has been observed stale on prod while the invoice was fully settled.
 */
export const revenueStatusOf = (row: {
  isPaid?: boolean;
  total?: number;
  paid?: number;
  outstanding?: number;
  collectable?: boolean;
  invoices?: { id: string }[] | null;
  dueDate?: string | null;
}): RevenueStatus => {
  const total = Number(row.total ?? 0);
  const paid = Number(row.paid ?? 0);
  const outstanding = Number(row.outstanding ?? Math.max(0, total - paid));
  const settled = !!row.isPaid || (total > 0 && outstanding <= 0.005);
  if (settled) return 'PAID';
  if (row.dueDate && new Date(row.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)) return 'OVERDUE';
  if (paid > 0.005) return 'PARTIAL';
  if ((row.invoices?.length ?? 0) > 0) return 'INVOICED';
  return row.collectable ? 'BILL_APPROVED' : 'BILL_DRAFT';
};

const RevenueStatusChip: React.FC<{
  status: RevenueStatus;
  /** Appended after the label — e.g. "· 12d" on an overdue row. */
  suffix?: string;
  title?: string;
  className?: string;
}> = ({ status, suffix, title, className = '' }) => {
  const m = META[status];
  return (
    <span title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 text-[8px] font-black uppercase tracking-wider whitespace-nowrap ${m.cls} ${className}`}>
      <m.icon size={9} className="shrink-0" /> {m.label}{suffix ? ` ${suffix}` : ''}
    </span>
  );
};

export default RevenueStatusChip;

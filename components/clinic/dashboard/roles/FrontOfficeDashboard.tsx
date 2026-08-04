import React from 'react';
import { FileText, Receipt, CircleDollarSign, ChevronRight, Phone } from 'lucide-react';
import { Visit, ApptStatus, Client } from '../../../../types';
import { billsAPI } from '../../../../services';
import { BillQueueRow } from '../../../../services/modules/bills.api';
import { receivablesAPI, ArAgeing } from '../../../../services/modules/receivables.api';
import { formatTime } from '../../../../services/utils/dateFormatter';
import {
  StatRow, RoleCard, EmptyNote, Spinner, visitsInRange, inDayRange,
  useDayTasks, TaskChecklist, DayRange,
} from './roleShared';

/**
 * FRONT OFFICE — the desk's day: who is here, who owes, what needs raising.
 *
 * Money is front-and-centre here (unlike the vet/groomer views) because
 * collecting it IS the front desk's job. Everything derives from visits already
 * in DataContext plus two light reads (bill queue, AR ageing).
 */

interface Props {
  visits: Visit[];
  clients: Client[];
  currency: string;
  onNavigate?: (view: string, params?: any) => void;
  /** Day the dashboard is pointed at — the shell owns the picker. */
  range?: DayRange;
}

const TASKS = [
  'Confirm tomorrow\'s appointments',
  'Call clients with overdue balances',
  'Prepare discharge paperwork',
  'Send vaccination reminders',
  'Reconcile the cash drawer',
];

const FrontOfficeDashboard: React.FC<Props> = ({ visits, clients, currency, onNavigate, range }) => {
  const [bills, setBills] = React.useState<BillQueueRow[] | null>(null);
  const [ar, setAr] = React.useState<ArAgeing | null>(null);
  const { tasks, done, toggle } = useDayTasks('frontoffice', TASKS);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      billsAPI.list(undefined, { silent: true } as any).catch(() => null),
      receivablesAPI.arAgeing().catch(() => null),
    ]).then(([b, a]) => {
      if (!alive) return;
      if (b?.success && b.data?.bills) setBills(b.data.bills); else setBills([]);
      if (a?.success && a.data) setAr(a.data);
    });
    return () => { alive = false; };
  }, []);

  const today = visitsInRange(visits, range);
  const walkIns = today.filter(v => (v as any).isWalkIn);
  const waiting = today.filter(v => v.status === ApptStatus.SCHEDULED);
  const newClients = (clients || []).filter(c => inDayRange(range, (c as any).joinedAt || (c as any).createdAt));
  const awaitingPayment = today.filter(v => v.status === ApptStatus.PENDING_PAYMENT && !v.isPaid);
  const paidToday = today.filter(v => v.isPaid);
  const revenueToday = paidToday.reduce((s, v) => s + Number(v.totalCost || 0), 0);
  const dueToday = awaitingPayment.reduce((s, v) => s + Number(v.totalCost || 0), 0);

  // "Awaiting approval / invoicing" = the bill queue that still needs a human.
  const needsAction = (bills || []).filter(b =>
    ['DRAFT', 'PENDING_REVIEW', 'APPROVED'].includes(String(b.status)));
  const overdueTotal = ar ? Number(ar.total || 0) : 0;

  const open = (v: Visit) => onNavigate?.('appointment-detail', { appointmentId: Number(v.id) });

  return (
    <div className="space-y-4">
      <StatRow stats={[
        { label: 'Walk-ins', value: walkIns.length, sub: `${waiting.length} waiting` },
        { label: 'Appointments', value: today.length, sub: `${today.filter(v => v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT).length} completed` },
        { label: 'New clients', value: newClients.length, sub: range && !range.isToday ? `Registered ${range.label.toLowerCase()}` : 'Registered today' },
        {
          label: 'Pending payments', value: awaitingPayment.length, tone: awaitingPayment.length ? 'warn' : 'default',
          sub: `${currency} ${Math.round(dueToday).toLocaleString()}`,
          onClick: () => onNavigate?.('appointments'),
        },
        {
          label: 'Outstanding', value: `${currency} ${Math.round(overdueTotal).toLocaleString()}`,
          tone: overdueTotal > 0 ? 'bad' : 'good', sub: ar ? 'All clients' : 'Loading…',
          onClick: () => onNavigate?.('clients'),
        },
        { label: 'Revenue today', value: `${currency} ${Math.round(revenueToday).toLocaleString()}`, tone: 'good', sub: `${paidToday.length} paid` },
      ]} />

      {/* REVENUE WORKFLOW — the front desk's money to-do list, in the order the
          chain runs. Counts come from the bill queue already loaded above, so
          this costs no extra request (user, 2026-08-04). Each row opens the
          place the work is actually done. */}
      {bills !== null && (() => {
        const awaitingReview = bills.filter(b => b.status === 'PENDING_REVIEW' || b.status === 'DRAFT');
        const awaitingInvoice = bills.filter(b => b.status === 'APPROVED');
        const rows = [
          { dot: 'bg-amber-500', label: 'Bills awaiting review', n: awaitingReview.length, cta: 'Open', go: () => onNavigate?.('bills') },
          { dot: 'bg-emerald-500', label: 'Bills ready for invoice', n: awaitingInvoice.length, cta: 'Generate', go: () => onNavigate?.('bills') },
          { dot: 'bg-sky-500', label: 'Visits awaiting payment', n: awaitingPayment.length, cta: 'Collect', go: () => onNavigate?.('appointments') },
        ].filter(r => r.n > 0);
        if (rows.length === 0) return null;
        return (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Revenue workflow</p>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {rows.map(r => (
                <button key={r.label} onClick={r.go}
                  className="w-full flex items-center gap-3 py-2.5 text-left group">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} />
                  <span className="text-lg font-black text-pine dark:text-zinc-100 w-8 shrink-0">{r.n}</span>
                  <span className="min-w-0 flex-1 text-[11px] font-bold text-slate-600 dark:text-zinc-300 truncate">{r.label}</span>
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-seafoam transition-colors">
                    {r.cta} →
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <RoleCard
          title="Bills needing action"
          subtitle="Raise, approve or invoice"
          action={<button onClick={() => onNavigate?.('billing')} className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:underline">View all</button>}
        >
          {bills === null ? <Spinner /> : needsAction.length === 0 ? (
            <EmptyNote>Nothing waiting 🎉</EmptyNote>
          ) : (
            <div className="space-y-1.5">
              {needsAction.slice(0, 6).map(b => (
                <button
                  key={b.id} type="button"
                  onClick={() => onNavigate?.('appointment-detail', { appointmentId: Number(b.visitId) })}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-seafoam transition-all text-left"
                >
                  <FileText size={13} className="text-slate-400 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                      {b.patient?.name || `Visit #${b.visitId}`}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 truncate">{b.client?.name || '—'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] font-black tabular-nums text-pine dark:text-zinc-100">
                      {currency} {Math.round(Number(b.total || 0)).toLocaleString()}
                    </span>
                    <span className="block text-[8px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {String(b.status).replace('_', ' ').toLowerCase()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </RoleCard>

        <RoleCard title="Awaiting payment" subtitle={`Finalized ${range && !range.isToday ? range.label.toLowerCase() : 'today'}, not yet settled`}>
          {awaitingPayment.length === 0 ? <EmptyNote>Everything settled</EmptyNote> : (
            <div className="space-y-1.5">
              {awaitingPayment.slice(0, 6).map(v => (
                <button key={v.id} type="button" onClick={() => open(v)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400 transition-all text-left">
                  <Receipt size={13} className="text-amber-500 shrink-0" />
                  <span className="min-w-0 flex-1 text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                    #{v.id} · {(v as any).petName || 'Patient'}
                  </span>
                  <span className="shrink-0 text-[11px] font-black tabular-nums text-amber-700 dark:text-amber-400">
                    {currency} {Math.round(Number(v.totalCost || 0)).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </RoleCard>

        <RoleCard title={range && !range.isToday ? 'Paid' : 'Paid today'} subtitle={`${paidToday.length} settled`}>
          {paidToday.length === 0 ? <EmptyNote>No payments yet</EmptyNote> : (
            <div className="space-y-1.5">
              {paidToday.slice(0, 6).map(v => (
                <button key={v.id} type="button" onClick={() => open(v)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-400 transition-all text-left">
                  <CircleDollarSign size={13} className="text-emerald-500 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                      #{v.id} · {(v as any).petName || 'Patient'}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400">{formatTime(v.date)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    {currency} {Math.round(Number(v.totalCost || 0)).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </RoleCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <RoleCard title="Front office tasks" subtitle="Resets each day">
          <TaskChecklist tasks={tasks} done={done} onToggle={toggle} />
        </RoleCard>

        <RoleCard
          title="Waiting to be seen"
          subtitle={`${waiting.length} in the waiting room`}
          action={<button onClick={() => onNavigate?.('appointments')} className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:underline">All visits</button>}
        >
          {waiting.length === 0 ? <EmptyNote>Waiting room is clear</EmptyNote> : (
            <div className="space-y-1.5">
              {waiting.slice(0, 8).map(v => (
                <button key={v.id} type="button" onClick={() => open(v)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-seafoam transition-all text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                      {(v as any).petName || `Visit #${v.id}`}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 truncate">
                      {formatTime(v.date)}{(v as any).clientName ? ` · ${(v as any).clientName}` : ''}
                    </span>
                  </span>
                  {(v as any).clientPhone && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-slate-400">
                      <Phone size={10} /> {(v as any).clientPhone}
                    </span>
                  )}
                  <ChevronRight size={13} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </RoleCard>
      </div>
    </div>
  );
};

export default FrontOfficeDashboard;

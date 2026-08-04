import React from 'react';
import { FileText, Receipt, CircleDollarSign, ChevronRight, Phone } from 'lucide-react';
import { Visit, ApptStatus } from '../../../../types';
import { billsAPI, remindersAPI, Reminder } from '../../../../services';
import { BillQueueRow } from '../../../../services/modules/bills.api';
import { receivablesAPI, ArAgeing } from '../../../../services/modules/receivables.api';
import { formatTime } from '../../../../services/utils/dateFormatter';
import { useData } from '../../../../contexts/DataContext';
import { useClinic } from '../../../../contexts/ClinicContext';
import {
  ConversionPulse, CheckoutsCard, PartnerRequestsCard, StaffTalliesCard,
} from '../ClinicTodayView';
import WorkInProgressStrip from './WorkInProgressStrip';
import {
  StatRow, RoleCard, EmptyNote, Spinner, todaysVisits, isToday, localDay,
  useDayTasks, TaskChecklist,
} from './roleShared';

/**
 * OWNER / ADMIN — the same arrangement every other role gets (work-in-progress
 * strip → stat tiles → cards), with a WIDER stat set, because the owner is the
 * one person who wants the day AND the money AND what needs chasing in one
 * glance (user, 2026-08-04).
 *
 * This is the first dashboard tab for full-access roles. It replaces the old
 * `ClinicTodayView` agenda there — that component is still in the tree and
 * commented out in `App.tsx`, not deleted.
 *
 * Everything here derives from what DataContext already holds plus three light
 * reads (bill queue, AR ageing, today's reminders). The clinic-wide cards that
 * used to sit above the agenda — conversion pulse, patient checkouts, partner
 * requests, staff activity — are kept and still come from `ClinicTodayView`,
 * which exports them.
 */

interface Props {
  onNavigate?: (view: string, params?: any) => void;
  /** Operational lists (reminders · today's appointments · inventory alerts). */
  cards?: React.ReactNode;
}

const TASKS = [
  'Review yesterday\'s takings',
  'Approve bills waiting on you',
  'Chase the oldest outstanding balances',
  'Check stock about to run out or expire',
  'Confirm tomorrow\'s appointments',
  'Walk the floor — inpatients & boarders',
];

const OwnerDashboard: React.FC<Props> = ({ onNavigate, cards }) => {
  const { appointments, clients, inventory } = useData() as any;
  const clinicCtx = useClinic() as any;
  const visits: Visit[] = appointments || [];
  const scopeId = clinicCtx?.selectedClinicIds?.[0];
  const currency = clinicCtx?.activeClinic?.currency
    || clinicCtx?.clinics?.[0]?.currency
    || 'KES';

  const [bills, setBills] = React.useState<BillQueueRow[] | null>(null);
  const [ar, setAr] = React.useState<ArAgeing | null>(null);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const { tasks, done, toggle } = useDayTasks('owner', TASKS);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      billsAPI.list(undefined, { silent: true } as any).catch(() => null),
      receivablesAPI.arAgeing().catch(() => null),
      remindersAPI.today().catch(() => null),
    ]).then(([b, a, r]) => {
      if (!alive) return;
      if (b?.success && b.data?.bills) setBills(b.data.bills); else setBills([]);
      if (a?.success && a.data) setAr(a.data);
      if (r?.success && r.data?.reminders) setReminders(r.data.reminders);
    });
    return () => { alive = false; };
  }, []);

  const today = todaysVisits(visits);
  const walkIns = today.filter(v => (v as any).isWalkIn);
  const waiting = today.filter(v => v.status === ApptStatus.SCHEDULED);
  const inProgress = today.filter(v => v.status === ApptStatus.IN_PROGRESS);
  const closed = today.filter(v =>
    v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT);
  const newClients = (clients || []).filter(c => isToday((c as any).joinedAt || (c as any).createdAt));
  const awaitingPayment = today.filter(v => v.status === ApptStatus.PENDING_PAYMENT && !v.isPaid);
  const paidToday = today.filter(v => v.isPaid);
  const revenueToday = paidToday.reduce((s, v) => s + Number(v.totalCost || 0), 0);
  const dueToday = awaitingPayment.reduce((s, v) => s + Number(v.totalCost || 0), 0);
  const avgBill = paidToday.length ? revenueToday / paidToday.length : 0;

  // Month to date, from the visits already loaded — a trend line, not the
  // ledger. Finance & BI is the authority on revenue; this is the pulse.
  const monthKey = localDay().slice(0, 7);
  const mtd = (visits || []).filter(v => v.isPaid && String(v.date || '').slice(0, 7) === monthKey);
  const mtdRevenue = mtd.reduce((s, v) => s + Number(v.totalCost || 0), 0);

  // "Awaiting approval / invoicing" = the bill queue that still needs a human.
  const needsAction = (bills || []).filter(b =>
    ['DRAFT', 'PENDING_REVIEW', 'APPROVED'].includes(String(b.status)));
  const overdueTotal = ar ? Number(ar.total || 0) : 0;
  const overdueReminders = reminders.filter(r => new Date(r.dueAt).getTime() < Date.now()).length;

  const soon = Date.now() + 30 * 86400000;
  const stock = (inventory || []).filter((i: any) =>
    i.status === 'OUT_OF_STOCK' || i.status === 'LOW_STOCK'
    || (i.expiryDate && new Date(i.expiryDate).getTime() < soon));
  const outOfStock = stock.filter((i: any) => i.status === 'OUT_OF_STOCK').length;
  const lowStock = stock.filter((i: any) => i.status === 'LOW_STOCK').length;

  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;
  const open = (v: Visit) => onNavigate?.('appointment-detail', { appointmentId: Number(v.id) });

  return (
    <div className="space-y-4">
      {/* Conversion pulse — the day's numbers and conversion rates. */}
      {scopeId != null && <ConversionPulse scopeId={scopeId} />}

      {/* Same strip every role sees: what the clinic is doing right now. */}
      <WorkInProgressStrip visits={visits} onOpen={() => onNavigate?.('appointments')} />

      {/* Row 1 — the day. Row 2 — the money and what needs chasing. */}
      <StatRow stats={[
        {
          label: 'Visits today', value: today.length,
          sub: `${inProgress.length} in progress · ${closed.length} done`,
          onClick: () => onNavigate?.('appointments'),
        },
        { label: 'Walk-ins', value: walkIns.length, sub: `${waiting.length} waiting` },
        {
          label: 'Waiting to be seen', value: waiting.length,
          tone: waiting.length ? 'warn' : 'default', sub: 'In the waiting room',
          onClick: () => onNavigate?.('appointments'),
        },
        {
          label: 'New clients', value: newClients.length, sub: 'Registered today',
          onClick: () => onNavigate?.('clients'),
        },
        { label: 'Revenue today', value: money(revenueToday), tone: 'good', sub: `${paidToday.length} paid` },
        { label: 'Month to date', value: money(mtdRevenue), tone: 'good', sub: `${mtd.length} paid visits` },
      ]} />

      <StatRow stats={[
        {
          label: 'Pending payments', value: awaitingPayment.length,
          tone: awaitingPayment.length ? 'warn' : 'default', sub: money(dueToday),
          onClick: () => onNavigate?.('appointments'),
        },
        {
          label: 'Outstanding', value: money(overdueTotal),
          tone: overdueTotal > 0 ? 'bad' : 'good', sub: ar ? 'All clients' : 'Loading…',
          onClick: () => onNavigate?.('clients'),
        },
        {
          label: 'Bills to action', value: bills === null ? '—' : needsAction.length,
          tone: needsAction.length ? 'warn' : 'default', sub: 'Raise · approve · invoice',
          onClick: () => onNavigate?.('billing'),
        },
        { label: 'Average bill', value: money(avgBill), sub: 'Per settled visit today' },
        {
          label: 'Reminders due', value: reminders.length,
          tone: overdueReminders ? 'bad' : 'default', sub: `${overdueReminders} overdue`,
          onClick: () => onNavigate?.('reminders'),
        },
        {
          label: 'Stock alerts', value: stock.length,
          tone: outOfStock ? 'bad' : stock.length ? 'warn' : 'good',
          sub: `${outOfStock} out · ${lowStock} low`,
          onClick: () => onNavigate?.('inventory'),
        },
      ]} />

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
                      {money(Number(b.total || 0))}
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

        <RoleCard title="Awaiting payment" subtitle="Finalized today, not yet settled">
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
                    {money(Number(v.totalCost || 0))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </RoleCard>

        <RoleCard title="Paid today" subtitle={`${paidToday.length} settled`}>
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
                    {money(Number(v.totalCost || 0))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </RoleCard>
      </div>

      {/* Clinic-wide cards carried over from the old Clinic Today tab. */}
      {scopeId != null && <CheckoutsCard scopeId={scopeId} />}
      {scopeId != null && <PartnerRequestsCard clinicId={scopeId} />}
      {scopeId != null && <StaffTalliesCard scopeId={scopeId} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <RoleCard title="Owner's day" subtitle="Resets each day">
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

      {/* Operational lists — reminders due · today's appointments · stock alerts. */}
      {cards}
    </div>
  );
};

export default OwnerDashboard;

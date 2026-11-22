import StaffWorkBand from './StaffWorkBand';
import { summariesAPI } from '../../../../services/modules/summaries.api';
import React from 'react';
import { FileText, Receipt, CircleDollarSign, ChevronRight, Phone } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Visit, ApptStatus } from '../../../../types';
import { billsAPI, remindersAPI, Reminder, petshopAPI, visitsAPI } from '../../../../services';
import type { PetshopSummary } from '../../../../services/modules/petshop.api';
import { usePlanAccess } from '../../../../contexts/PlanAccessContext';
import { BillQueueRow } from '../../../../services/modules/bills.api';
import { receivablesAPI, ArAgeing } from '../../../../services/modules/receivables.api';
import { formatTime } from '../../../../services/utils/dateFormatter';
import { useData } from '../../../../contexts/DataContext';
import { useClinic } from '../../../../contexts/ClinicContext';
import {
  ConversionPulse, CheckoutsCard, PartnerRequestsCard, StaffTalliesCard,
} from '../ClinicTodayView';
import WorkInProgressStrip from './WorkInProgressStrip';
import StaffDashboard from '../StaffDashboard';
import {
  StatRow, RoleCard, EmptyNote, Spinner, visitsInRange, inDayRange, localDay,
  useDayTasks, TaskChecklist, useDayRange, DayRangeControl,
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
}

const TASKS = [
  'Review yesterday\'s takings',
  'Approve bills waiting on you',
  'Chase the oldest outstanding balances',
  'Check stock about to run out or expire',
  'Confirm tomorrow\'s appointments',
  'Walk the floor — inpatients & boarders',
];

const OwnerDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { appointments, clients, inventory } = useData() as any;
  const clinicCtx = useClinic() as any;
  const visits: Visit[] = appointments || [];
  const scopeId = clinicCtx?.selectedClinicIds?.[0];
  const currency = clinicCtx?.activeClinic?.currency
    || clinicCtx?.clinics?.[0]?.currency
    || 'KES';

  // The day the dashboard is pointed at — defaults to today, clearing snaps
  // back (user, 2026-08-04). Everything day-derived below reads it.
  const { range, onChange: onRangeChange } = useDayRange();

  const [bills, setBills] = React.useState<BillQueueRow[] | null>(null);
  const [ar, setAr] = React.useState<ArAgeing | null>(null);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const { tasks, done, toggle } = useDayTasks('owner', TASKS);

  // Money actually collected — the period, and month to date up to its end.
  const [collected, setCollected] = React.useState<{ range: number; rangeCount: number; month: number; monthCount: number } | null>(null);
  React.useEffect(() => {
    if (scopeId == null) return;
    let alive = true;
    const monthStart = `${range.end.slice(0, 7)}-01`;
    Promise.all([
      summariesAPI.staffWork({ scopeId, start: range.start, end: range.end, userId: 'all' }, { silent: true } as any),
      summariesAPI.staffWork({ scopeId, start: monthStart, end: range.end, userId: 'all' }, { silent: true } as any),
    ]).then(([a, m]) => {
      if (!alive || !a?.success || !m?.success) return;
      setCollected({ range: a.data.collected, rangeCount: a.data.paymentsCount, month: m.data.collected, monthCount: m.data.paymentsCount });
    }).catch(() => {});
    return () => { alive = false; };
  }, [scopeId, range.start, range.end]);

  // Pet shop takings for the same day range (user, 2026-11-21: "add shop
  // sells stats"). Its own read — counter sales are not visits, so nothing
  // already loaded here knows about them.
  const { allows } = usePlanAccess();
  const hasShop = allows('petshop');
  const [shop, setShop] = React.useState<PetshopSummary | null>(null);
  React.useEffect(() => {
    if (!hasShop) return;
    let alive = true;
    setShop(null);
    petshopAPI.summary(range.start, range.end, { silent: true } as any)
      .then(r => { if (alive && r.success && r.data) setShop(r.data); })
      .catch(() => { /* the row shows dashes */ });
    return () => { alive = false; };
  }, [hasShop, range.start, range.end]);

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

  // Closed visits that ended without their follow-up (owner, 2026-11-22:
  // money first, then flag). Last 90 days, so it ignores the day picker.
  const [followUpCount, setFollowUpCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    let alive = true;
    visitsAPI.needsFollowUp({ silent: true } as any)
      .then(r => { if (alive && r.success && r.data) setFollowUpCount(r.data.total); })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId]);

  const today = visitsInRange(visits, range);
  const walkIns = today.filter(v => (v as any).isWalkIn);
  const waiting = today.filter(v => v.status === ApptStatus.SCHEDULED);
  const inProgress = today.filter(v => v.status === ApptStatus.IN_PROGRESS);
  const closed = today.filter(v =>
    v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT);
  const newClients = (clients || []).filter(c => inDayRange(range, (c as any).joinedAt || (c as any).createdAt));
  const awaitingPayment = today.filter(v => v.status === ApptStatus.PENDING_PAYMENT && !v.isPaid);
  const paidToday = today.filter(v => v.isPaid);
  // MONEY COLLECTED in the period, from the ledger (2026-11-22). This summed
  // the bills of visits SCHEDULED today that were fully paid — so the KES
  // 4,193 taken today on earlier visits read as KES 0. Falls back to that old
  // figure only until the server answers.
  const visitRevenue = paidToday.reduce((s, v) => s + Number(v.totalCost || 0), 0);
  const revenueToday = collected?.range ?? visitRevenue;
  const dueToday = awaitingPayment.reduce((s, v) => s + Number(v.totalCost || 0), 0);
  const avgBill = collected?.rangeCount ? revenueToday / collected.rangeCount : (paidToday.length ? visitRevenue / paidToday.length : 0);

  // Month to date, from the visits already loaded — a trend line, not the
  // ledger. Finance & BI is the authority on revenue; this is the pulse.
  const monthKey = range.start.slice(0, 7);
  const mtd = (visits || []).filter(v => v.isPaid && String(v.date || '').slice(0, 7) === monthKey);
  const mtdRevenue = collected?.month ?? mtd.reduce((s, v) => s + Number(v.totalCost || 0), 0);

  // "Awaiting approval / invoicing" = the bill queue that still needs a human.
  // On TODAY that is the whole queue, backlog included — a bill left unapproved
  // since Monday is exactly what an owner opens this card to find. Point the
  // picker elsewhere and it narrows to bills for visits on that day.
  const needsAction = (bills || [])
    .filter(b => ['DRAFT', 'PENDING_REVIEW', 'APPROVED'].includes(String(b.status)))
    .filter(b => range.isToday || inDayRange(range, (b as any).visitDate || (b as any).createdAt));
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

  // Last 7 days revenue + visits — the concrete "zero charts" gap on this
  // dashboard (2026-09-27, dashboard polish). MTD above is the only multi-day
  // figure today, with nothing visual. Built from visits already in context —
  // no new API call, same `localDay` bucketing the rest of this file uses.
  const trend = React.useMemo(() => {
    const byDay = new Map<string, { revenue: number; visits: number }>();
    for (const v of (visits || [])) {
      const k = localDay(v.date);
      const row = byDay.get(k) ?? { revenue: 0, visits: 0 };
      row.visits += 1;
      if (v.isPaid) row.revenue += Number(v.totalCost || 0);
      byDay.set(k, row);
    }
    const days: { label: string; revenue: number; visits: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = localDay(d);
      const row = byDay.get(k) ?? { revenue: 0, visits: 0 };
      days.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), ...row });
    }
    return days;
  }, [visits]);

  return (
    <div className="space-y-4">
      {/* Day control — every dashboard has one (user, 2026-08-04). The pulse
          band, checkouts and staff activity re-query the server with this range
          (`/summaries/conversions?start&end`); the tiles filter the visits
          already loaded. Outstanding AR is the one exception — see its tile. */}
      <DayRangeControl
        range={range}
        onChange={onRangeChange}
        note={range.isToday ? 'live' : 'everything below follows this'}
      />

      {/* Conversion pulse — the day's numbers and conversion rates. */}
      {/* Work for the period — the whole clinic, or one person (2026-11-22). */}
      {scopeId != null && <StaffWorkBand scopeId={scopeId} range={range} canPick currency={currency} />}

      {/* Same strip every role sees: what the clinic is doing right now. */}
      <WorkInProgressStrip visits={visits} range={range} onOpen={(view, params) => onNavigate?.(view, params)} />

      {/* Row 1 — the day. Row 2 — the money and what needs chasing. */}
      <StatRow stats={[
        {
          label: range.isToday ? 'Visits today' : 'Visits', value: today.length,
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
          label: 'New clients', value: newClients.length,
          sub: range.isToday ? 'Registered today' : `Registered ${range.label.toLowerCase()}`,
          onClick: () => onNavigate?.('clients'),
        },
        {
          label: range.isToday ? 'Revenue today' : 'Revenue', value: money(revenueToday),
          tone: 'good', sub: collected ? `${collected.rangeCount} payment${collected.rangeCount === 1 ? '' : 's'} · ${range.label.toLowerCase()}` : `${paidToday.length} paid · ${range.label.toLowerCase()}`,
        },
        {
          label: range.isToday ? 'Month to date' : 'That month', value: money(mtdRevenue),
          tone: 'good', sub: collected ? `${collected.monthCount} payments collected` : `${mtd.length} paid visits`,
        },
      ]} />

      <StatRow stats={[
        {
          label: 'Pending payments', value: awaitingPayment.length,
          tone: awaitingPayment.length ? 'warn' : 'default', sub: money(dueToday),
          onClick: () => onNavigate?.('appointments'),
        },
        {
          label: 'Outstanding', value: money(overdueTotal),
          tone: overdueTotal > 0 ? 'bad' : 'good',
          // A balance owed is "as of now" — it has no version for last Tuesday
          // without replaying settlement history, so it deliberately ignores
          // the picker and says so.
          sub: ar ? 'All clients · as of now' : 'Loading…',
          onClick: () => onNavigate?.('clients'),
        },
        {
          label: 'Bills to action', value: bills === null ? '—' : needsAction.length,
          tone: needsAction.length ? 'warn' : 'default', sub: 'Raise · approve · invoice',
          onClick: () => onNavigate?.('revenue-desk'),
        },
        { label: 'Average payment', value: money(avgBill), sub: `Per payment · ${range.label.toLowerCase()}` },
        {
          label: 'Reminders due', value: reminders.length,
          tone: overdueReminders ? 'bad' : 'default', sub: `${overdueReminders} overdue`,
          onClick: () => onNavigate?.('reminders'),
        },
        {
          label: 'Needs follow-up', value: followUpCount ?? '—',
          tone: followUpCount ? 'warn' : 'default', sub: 'No reminder set · last 90 days',
          onClick: () => onNavigate?.('appointments', { needsFollowUp: true }),
        },
        {
          label: 'Stock alerts', value: stock.length,
          tone: outOfStock ? 'bad' : stock.length ? 'warn' : 'good',
          sub: `${outOfStock} out · ${lowStock} low`,
          onClick: () => onNavigate?.('inventory'),
        },
      ]} />

      {/* Row 3 — the pet shop counter. Shown locked (not hidden) on a plan
          without Pet shop, so the owner can see what it would tell them. */}
      {hasShop ? (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-0.5">
            Pet shop · {range.isToday ? 'today' : range.label}
          </p>
          <StatRow stats={[
            {
              label: range.isToday ? 'Shop sales today' : 'Shop sales', value: shop ? money(shop.revenue) : '—',
              tone: 'good', sub: shop ? `${shop.sales} sale${shop.sales === 1 ? '' : 's'}` : 'Loading…',
              onClick: () => onNavigate?.('petshop'),
            },
            { label: 'Items sold', value: shop ? shop.itemsSold.toLocaleString() : '—', sub: shop?.discounts ? `${money(shop.discounts)} in discounts` : 'Across all sales' },
            { label: 'Average sale', value: shop ? money(shop.averageSale) : '—', sub: 'Per receipt' },
            {
              label: range.isToday ? 'Shop month to date' : 'Shop, that month', value: shop ? money(shop.monthToDate) : '—',
              tone: 'good', sub: shop ? `${shop.monthSales} sale${shop.monthSales === 1 ? '' : 's'}` : '',
            },
            {
              label: 'Top seller', value: shop?.topItems[0] ? <span className="text-base leading-tight line-clamp-2">{shop.topItems[0].name}</span> : '—',
              sub: shop?.topItems[0] ? `${shop.topItems[0].units} ${shop.topItems[0].unit} · ${money(shop.topItems[0].revenue)}` : 'Nothing sold yet',
            },
            {
              label: 'Paid by', value: shop && shop.revenue > 0
                ? <span className="text-base leading-tight">{Object.entries(shop.byMethod).sort((a, b) => b[1] - a[1])[0][0].replace('M_PESA', 'M-Pesa').replace('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</span>
                : '—',
              sub: shop && shop.revenue > 0
                ? Object.entries(shop.byMethod).sort((a, b) => b[1] - a[1]).map(([m, v]) => `${m === 'M_PESA' ? 'M-Pesa' : m.charAt(0) + m.slice(1).toLowerCase().replace('_', ' ')} ${Math.round((v / shop.revenue) * 100)}%`).join(' · ')
                : 'Cash, M-Pesa, card',
            },
          ]} />
        </div>
      ) : (
        <RoleCard title="Pet shop sales" subtitle="Daily takings, items sold and best sellers from the pet shop till">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-slate-500 dark:text-zinc-400">Pet shop isn't on your plan yet.</p>
            <button onClick={() => onNavigate?.('billing')} className="text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline">See plans</button>
          </div>
        </RoleCard>
      )}

      <RoleCard title="Last 7 days" subtitle="Revenue and visits, from the visits already loaded">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => money(v)} width={70} />
              <Tooltip formatter={(v: number, name: string) => (name === 'revenue' ? money(v) : v)} />
              <Area type="monotone" dataKey="revenue" stroke="#1C7A5B" fill="#1C7A5B" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </RoleCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <RoleCard
          title="Bills needing action"
          subtitle={range.isToday ? 'Raise, approve or invoice · whole queue' : `Raise, approve or invoice · ${range.label.toLowerCase()}`}
          action={<button onClick={() => onNavigate?.('revenue-desk')} className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:underline">View all</button>}
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

        <RoleCard title="Awaiting payment" subtitle={`Finalized ${range.label.toLowerCase()}, not yet settled`}>
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

        <RoleCard title={range.isToday ? 'Paid today' : 'Paid'} subtitle={`${paidToday.length} settled · ${range.label.toLowerCase()}`}>
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
      {scopeId != null && <CheckoutsCard scopeId={scopeId} range={range} />}
      {scopeId != null && <PartnerRequestsCard clinicId={scopeId} range={range} />}
      {scopeId != null && <StaffTalliesCard scopeId={scopeId} range={range} />}

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

      {/* Operational lists — reminders due · appointments · stock alerts.
          Rendered here rather than passed in from App so the day picker above
          reaches them (they were a `cards` prop until 2026-08-04). */}
      <StaffDashboard onNavigate={onNavigate} range={range} />
    </div>
  );
};

export default OwnerDashboard;

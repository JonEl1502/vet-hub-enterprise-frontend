import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, BellRing, CalendarClock, Stethoscope, Loader2, ArrowRight, Repeat, LogOut, PhoneCall, Check } from 'lucide-react';
import { remindersAPI, appointmentsAPI, Reminder } from '../../../services';
import { summariesAPI } from '../../../services/modules/summaries.api';
import { useData } from '../../../contexts/DataContext';
import { useClinic } from '../../../contexts/ClinicContext';
import { formatDate } from '../../../services/utils/dateFormatter';
import DateRangePicker, { DateRange } from '../../shared/common/DateRangePicker';
import { usePartnerJobs } from '../partnerships/B2BJobsStats';
import { Send, Users } from 'lucide-react';

/**
 * The day the dashboard is pointed at. Structurally the role dashboards'
 * `DayRange` — declared locally so this file keeps no import from the roles
 * folder it already feeds.
 */
export interface PulseRange { start: string; end: string; isToday: boolean; label: string }

/** Local YYYY-MM-DD. Never `toISOString()` — that shifts a Nairobi evening. */
const localDayKey = (d: string | Date) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/**
 * One query shape for all three cards: a picked day goes to the server as
 * start/end, no range keeps the rolling week. They share an endpoint, so they
 * must also share the window — otherwise the band says one thing and the
 * checkouts under it say another.
 */
const pulseQuery = (scopeId: string | number, range?: PulseRange) =>
  range
    ? { scopeId, start: range.start, end: range.end }
    : { scopeId, days: 7 };

/**
 * Conversion pulse (user, 2026-08-01) — the rich stats band on Clinic Today:
 * visits done, appointments→visits, reminders→visits, and encounter cross-sell
 * (e.g. a vet visit that also sold grooming), with a 7-day mini trend. Styled
 * like the visit header card: dark pine gradient, blocks side by side.
 */
export const ConversionPulse: React.FC<{ scopeId: string | number; range?: PulseRange }> = ({ scopeId, range }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof summariesAPI.conversions>>['data'] | null>(null);
  useEffect(() => {
    let alive = true;
    // The band follows the dashboard's day picker (user, 2026-08-04): a picked
    // day is sent as start/end and REPLACES the rolling 7-day window server
    // side, so the numbers are that day's, not the week's.
    summariesAPI.conversions(pulseQuery(scopeId, range), { silent: true } as any)
      .then(r => { if (alive && r.success && r.data) setData(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId, range?.start, range?.end, range?.isToday]);

  if (!data) return null;
  const t = data.totals;
  const today = data.days[data.days.length - 1];
  const pct = (n: number, d: number) => d > 0 ? `${Math.round((n / d) * 100)}%` : '—';
  const topPair = Object.entries(data.crossSellPairs || {}).sort((a, b) => b[1] - a[1])[0];
  // Only label the span when it ISN'T the default rolling week — otherwise the
  // band reads exactly as it always has.
  const spanLabel = (data as any).window?.explicit ? (range?.label ?? null) : null;
  const spanned = !!spanLabel && data.days.length > 1;
  const maxDone = Math.max(1, ...data.days.map(d => d.visitsDone));

  const Block: React.FC<{ label: string; big: React.ReactNode; sub: string }> = ({ label, big, sub }) => (
    <div className="min-w-0">
      <p className="text-white/50 text-[8px] font-black uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-white font-black text-lg leading-tight font-mono">{big}</p>
      <p className="text-seafoam text-[9px] font-bold truncate">{sub}</p>
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine via-pine to-emerald-950 p-4 md:p-5 shadow-xl">
      <Repeat size={84} className="absolute -right-3 -top-4 text-white/5" />
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-6 gap-x-5 gap-y-3 items-end">
        {/* The headline is the LAST day of the window, which is right for
            "today" and for a single picked day — but a multi-day pick has to
            show the span's total, or the band reports one day and labels it
            with a week. */}
        <Block
          label={spanLabel ? `Visits · ${spanLabel}` : 'Visits today'}
          big={spanned
            ? <>{t.visitsDone}<span className="text-white/40 text-sm"> / {t.visitsTotal}</span></>
            : <>{today?.visitsDone ?? 0}<span className="text-white/40 text-sm"> / {today?.visitsTotal ?? 0}</span></>}
          sub={spanned ? `${data.days.length} days` : `${t.visitsDone} done · ${spanLabel || '7 days'}`}
        />
        <Block label="Appointments → visits" big={<>{t.bookingsConverted}<span className="text-white/40 text-sm"> / {t.bookings}</span></>} sub={`${pct(t.bookingsConverted, t.bookings)} converted`} />
        {/* Two different questions (user, 2026-08-04). CONVERTED = did the
            reminder bring them in. CLOSED = did anyone work it at all — booked,
            marked done, or dismissed. A queue reading 0% converted but 100%
            closed is being worked; the old single number called that a failure. */}
        <Block label="Reminders → visits"
          big={<>{t.remindersConverted}<span className="text-white/40 text-sm"> / {t.remindersDue}</span></>}
          sub={`${pct(t.remindersConverted, t.remindersDue)} converted · ${t.remindersClosed ?? 0} closed`} />
        <Block label="Cross-sell" big={t.crossSell} sub={topPair ? `${topPair[0]} · ${topPair[1]}×` : 'encounters combined'} />
        {/* Patient checkouts (173) — boarding pickups + inpatient discharges with
            an expected release date: today / next 3 days / overdue. */}
        <Block
          label="Checkouts"
          big={spanLabel
            ? <>{((data as any).checkouts?.today ?? 0) + ((data as any).checkouts?.soon ?? 0) + ((data as any).checkouts?.overdue ?? 0)}<span className="text-white/40 text-sm"> expected</span></>
            : <>{(data as any).checkouts?.today ?? 0}<span className="text-white/40 text-sm"> today</span></>}
          sub={spanLabel
            ? spanLabel
            : `${(data as any).checkouts?.soon ?? 0} soon · ${(data as any).checkouts?.overdue ?? 0} overdue`}
        />
        {/* 7-day visits-done trend */}
        <div className="col-span-2 md:col-span-1">
          <p className="text-white/50 text-[8px] font-black uppercase tracking-widest leading-none mb-1.5">
            {data.days.length === 1 ? 'That day' : `${data.days.length}-day visits`}
          </p>
          <div className="flex items-end gap-1 h-9">
            {data.days.map(d => (
              <div key={d.date} title={`${d.date}: ${d.visitsDone} done / ${d.visitsTotal}`}
                className="flex-1 rounded-sm bg-seafoam/80 min-h-[3px]"
                style={{ height: `${Math.max(8, (d.visitsDone / maxDone) * 100)}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Patient checkouts (user, 2026-08-02) — boarding pickups + inpatient
 * discharges with an expected release date. Rows within the next 3 days
 * (or overdue), each with a one-tap "call the client" reminder.
 */
export const CheckoutsCard: React.FC<{ scopeId: string | number; range?: PulseRange }> = ({ scopeId, range }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [reminded, setReminded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    summariesAPI.conversions(pulseQuery(scopeId, range), { silent: true } as any)
      .then(r => { if (alive && r.success && (r.data as any)?.checkouts?.list) setRows((r.data as any).checkouts.list); else if (alive) setRows([]); })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId, range?.start, range?.end, range?.isToday]);

  if (!rows.length) return null;
  const toneOf = (b: string) => b === 'overdue' ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40'
    : b === 'today' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' : 'text-seafoam bg-seafoam/10';
  const whenLabel = (r: any) => `${formatDate(r.at)} · ${new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const remind = async (r: any) => {
    const key = `${r.kind}-${r.id}`;
    setBusy(key);
    try {
      const res = await remindersAPI.create({
        petId: r.petId, clientId: r.clientId, serviceType: 'FOLLOW_UP',
        title: `Call ${r.client || 'client'} — ${r.kind === 'BOARDING' ? 'boarding pickup' : 'inpatient discharge'} for ${r.pet}`,
        notes: r.phone ? `Phone: ${r.phone}` : undefined,
        dueAt: new Date(r.at).toISOString(),
        meta: { kind: 'CHECKOUT_CALL', source: r.kind, sourceId: r.id },
      });
      if (res.success) setReminded(prev => ({ ...prev, [key]: true }));
    } finally { setBusy(null); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-seafoam/10 flex items-center justify-center"><LogOut size={15} className="text-seafoam" /></div>
        <div>
          <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest leading-none">Patient checkouts</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Boarding pickups &amp; inpatient discharges{range && !range.isToday ? ` expected ${range.label.toLowerCase()}` : ' due'} — call the client ahead
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const key = `${r.kind}-${r.id}`;
          return (
            <div key={key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0 ${toneOf(r.bucket)}`}>
                {r.bucket === 'overdue' ? 'Overdue' : r.bucket === 'today' ? 'Today' : 'Soon'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">
                  {r.pet} <span className="text-slate-400 font-medium">· {r.kind === 'BOARDING' ? 'Boarding pickup' : 'Discharge'}</span>
                </p>
                <p className="text-[10px] text-slate-400 truncate">{whenLabel(r)}{r.client ? ` · ${r.client}` : ''}{r.phone ? ` · ${r.phone}` : ''}</p>
              </div>
              {reminded[key] ? (
                <span className="flex items-center gap-1 text-[9px] font-black text-seafoam uppercase tracking-widest shrink-0"><Check size={12} /> Reminder set</span>
              ) : (
                <button onClick={() => remind(r)} disabled={busy === key}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/20 disabled:opacity-50 shrink-0">
                  {busy === key ? <Loader2 size={11} className="animate-spin" /> : <PhoneCall size={11} />} Call reminder
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Partner requests on the dashboard (user, 2026-08-02) — incoming cross-clinic
 * jobs waiting on this clinic (price/accept), so new requests are seen without
 * opening the Partners page.
 */
export const PartnerRequestsCard: React.FC<{ clinicId: string | number; range?: PulseRange }> = ({ clinicId, range }) => {
  const { jobs, loading } = usePartnerJobs();
  if (loading) return null;
  const ids = [String(clinicId)];
  // A REQUESTED job is a work queue — on today it stays complete, backlog and
  // all, because a request raised on Monday still needs pricing on Thursday.
  // Point the picker at another day and it becomes "what came in that day".
  const raisedInRange = (j: any) => {
    if (!range || range.isToday) return true;
    const k = localDayKey(j.createdAt);
    return k >= range.start && k <= range.end;
  };
  const awaiting = jobs.filter(j => ids.includes(String(j.providerClinicId)) && j.status === 'REQUESTED' && raisedInRange(j));
  const active = jobs.filter(j => ids.includes(String(j.providerClinicId)) && j.status === 'ACCEPTED' && raisedInRange(j));
  if (awaiting.length === 0 && active.length === 0) return null;
  const go = () => window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view: 'referrals' } }));
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm p-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center"><Send size={15} className="text-violet-500" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest leading-none">Partner requests</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {awaiting.length > 0 ? `${awaiting.length} new request${awaiting.length === 1 ? '' : 's'} awaiting your price/accept` : 'No new requests'}
            {range && !range.isToday ? ` · raised ${range.label.toLowerCase()}` : ''}
            {active.length > 0 ? ` · ${active.length} in progress` : ''}
          </p>
        </div>
        <button onClick={go} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-violet-700 shrink-0">Open</button>
      </div>
      {awaiting.slice(0, 3).map(j => (
        <div key={j.id} className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
          <span className="text-[8px] font-black uppercase tracking-widest text-violet-500 shrink-0">{j.category}</span>
          <span className="min-w-0 flex-1 text-[11px] font-bold text-slate-700 dark:text-zinc-200 truncate">{j.serviceName || 'Service'}{(j as any).patientName ? ` · ${(j as any).patientName}` : ''}</span>
          <span className="text-[9px] font-black text-emerald-600 shrink-0">{j.currency} {Number(j.agreedPrice || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Staff tallies (§0f #4) — attendance across BOTH attribution tables
 * (encounters 172 + service lines 106). `fee` is INTERNAL clinic cost, never
 * billed — labelled as such.
 */
export const StaffTalliesCard: React.FC<{ scopeId: string | number; range?: PulseRange }> = ({ scopeId, range }) => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    summariesAPI.conversions(pulseQuery(scopeId, range), { silent: true } as any)
      .then(r => { if (alive && r.success && (r.data as any)?.staffTallies) setRows((r.data as any).staffTallies); else if (alive) setRows([]); })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId, range?.start, range?.end, range?.isToday]);
  if (!rows.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-seafoam/10 flex items-center justify-center"><Users size={15} className="text-seafoam" /></div>
        <div>
          <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest leading-none">
            Staff activity · {range && !range.isToday ? range.label : '7 days'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Encounters + service lines attended · fees are internal cost, never billed</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {rows.map((r) => (
          <div key={r.userId} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
            {r.avatarUrl
              ? <img src={r.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
              : <div className="w-7 h-7 rounded-full bg-seafoam/15 flex items-center justify-center text-[10px] font-black text-seafoam shrink-0">{(r.name || 'S').slice(0, 1)}</div>}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{r.name}{r.role ? <span className="text-slate-400 font-medium"> · {r.role}</span> : null}</p>
              <p className="text-[10px] text-slate-400 truncate">{r.encounters} encounter{r.encounters === 1 ? '' : 's'} · {r.services} service line{r.services === 1 ? '' : 's'}{r.internalFees > 0 ? ` · KES ${Number(r.internalFees).toLocaleString()} internal` : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface Props {
  onOpenVisit?: (visitId: string) => void;
  onOpenBookings?: () => void;
  onOpenReminders?: () => void;
  // Operational cards (reminders due · today's appointments · inventory
  // alerts) — rendered between the date-picker row and the agenda so the tab
  // reads: pulse band → date picker (defaults to today) → cards → agenda.
  cards?: React.ReactNode;
}

type Row = {
  kind: 'reminder' | 'appointment' | 'visit';
  id: string;
  at: number;            // sort key (ms); reminders use due date (00:00) if no time
  timeLabel: string;
  pet: string;
  client?: string;
  title: string;
  status?: string;
};

const KIND_META: Record<Row['kind'], { icon: React.ElementType; tone: string; label: string }> = {
  reminder: { icon: BellRing, tone: 'text-violet-500 bg-violet-50 dark:bg-violet-950/40', label: 'Reminder' },
  appointment: { icon: CalendarClock, tone: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40', label: 'Appointment' },
  visit: { icon: Stethoscope, tone: 'text-seafoam bg-seafoam/10', label: 'Visit' },
};

/**
 * Clinic Today — reminders, appointments (bookings) and visits for a chosen date
 * (defaults to today), arranged chronologically by time. One operational glance.
 */
const ClinicTodayView: React.FC<Props> = ({ onOpenVisit, onOpenBookings, onOpenReminders, cards }) => {
  const { appointments: visits, pets, clients } = useData() as any;
  const { selectedClinicIds } = useClinic() as any;
  const scopeId = selectedClinicIds?.[0];
  // Range picker (user, 2026-08-01) — same control as the Visits list.
  // Defaults to today → today; clearing snaps back to today.
  const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const [range, setRange] = useState<DateRange>({ start: todayStart(), end: todayStart() });
  const dayStr = (d: Date | null) => d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '';
  const startStr = dayStr(range.start ?? todayStart());
  const endStr = dayStr(range.end ?? range.start ?? todayStart());
  const inRange = (iso: string) => { const k = (iso || '').slice(0, 10); return k >= startStr && k <= endStr; };
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      remindersAPI.list({ scope: 'all' }).catch(() => null),
      appointmentsAPI.list().catch(() => null),
    ]).then(([rem, appt]) => {
      if (!alive) return;
      if (rem?.success && rem.data?.reminders) setReminders(rem.data.reminders);
      if (appt?.success && appt.data?.appointments) setBookings(appt.data.appointments);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const petName = (id: any) => pets.find((p: any) => String(p.id) === String(id))?.name || 'Patient';
  const clientName = (id: any) => clients.find((c: any) => String(c.id) === String(id))?.name || '';
  const hhmm = (d: Date) => isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    // Visits scheduled for the date.
    (visits || []).filter((v: any) => inRange(v.date) && v.status !== 'CANCELLED').forEach((v: any) => {
      const d = new Date(v.date);
      out.push({ kind: 'visit', id: String(v.id), at: d.getTime(), timeLabel: hhmm(d), pet: petName(v.petId), client: clientName(v.clientId), title: (v.encounterType || 'VET_VISIT').replace('_', ' '), status: v.status });
    });
    // Appointment bookings for the date (not yet converted/cancelled).
    bookings.filter((b: any) => inRange(b.scheduledAt) && b.status !== 'CANCELLED' && b.status !== 'CONVERTED').forEach((b: any) => {
      const d = new Date(b.scheduledAt);
      out.push({ kind: 'appointment', id: String(b.id), at: d.getTime(), timeLabel: hhmm(d), pet: petName(b.petId), client: clientName(b.clientId), title: b.note || (b.encounterType || '').replace('_', ' '), status: b.status });
    });
    // Reminders due on the date (pending).
    reminders.filter((r: any) => inRange(r.dueAt) && r.status === 'PENDING').forEach((r: any) => {
      const d = new Date(r.dueAt);
      out.push({ kind: 'reminder', id: String(r.id), at: d.getTime(), timeLabel: hhmm(d), pet: r.pet?.name || petName(r.petId), client: r.client?.name, title: r.title || r.serviceType, status: r.status });
    });
    return out.sort((a, b) => a.at - b.at);
  }, [visits, bookings, reminders, startStr, endStr, pets, clients]);

  const isToday = startStr === endStr && startStr === dayStr(todayStart());

  return (
    <div className="space-y-4">
      {/* 1 · Conversion pulse — the day's numbers and conversion rates. */}
      {scopeId != null && <ConversionPulse scopeId={scopeId} />}

      {/* 1b · Patient checkouts — expected releases + call-client reminders. */}
      {scopeId != null && <CheckoutsCard scopeId={scopeId} />}

      {/* 1c · Partner requests — incoming cross-clinic jobs awaiting action. */}
      {scopeId != null && <PartnerRequestsCard clinicId={scopeId} />}

      {/* 1d · Staff tallies (§0f #4) — both attribution tables, internal fees. */}
      {scopeId != null && <StaffTalliesCard scopeId={scopeId} />}

      {/* 2 · Date picker directly below the card, defaulting to today (user,
          2026-08-01). House-themed react-datepicker (same as AdvancedFilters)
          — the native input popped the browser's own white calendar. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-seafoam/10 flex items-center justify-center"><CalendarDays size={22} className="text-seafoam" /></div>
          <div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Clinic {isToday ? 'Today' : 'Day'}</h2>
            <p className="text-[11px] text-slate-400">{rows.length} item{rows.length === 1 ? '' : 's'} · reminders · appointments · visits</p>
          </div>
        </div>
        <DateRangePicker
          value={range}
          onChange={(r) => setRange(r?.start ? { start: r.start, end: r.end ?? r.start } : { start: todayStart(), end: todayStart() })}
        />
      </div>

      {/* 3 · Operational cards (reminders · appointments · inventory). */}
      {cards}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <CalendarDays size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">Nothing scheduled for {startStr === endStr ? formatDate(startStr) : `${formatDate(startStr)} – ${formatDate(endStr)}`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const M = KIND_META[row.kind];
            const Icon = M.icon;
            const onClick = row.kind === 'visit' ? () => onOpenVisit?.(row.id) : row.kind === 'appointment' ? onOpenBookings : onOpenReminders;
            return (
              <button key={`${row.kind}:${row.id}`} onClick={onClick} className="w-full flex items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 shadow-sm hover:border-seafoam transition-all text-left">
                <span className="w-14 shrink-0 text-[11px] font-black text-pine dark:text-zinc-100 tabular-nums">{row.timeLabel}</span>
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${M.tone}`}><Icon size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{row.pet} <span className="text-slate-400 font-medium">· {row.title}</span></span>
                  <span className="block text-[10px] text-slate-400 truncate">{M.label}{row.client ? ` · ${row.client}` : ''}{row.status ? ` · ${String(row.status).toLowerCase().replace('_', ' ')}` : ''}</span>
                </span>
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClinicTodayView;

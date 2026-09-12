import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Receipt, BellRing, MessageSquare, Loader2, Bell } from 'lucide-react';
import { clientPortalAPI } from '../../../services/modules/clientPortal.api';
import type { PortalAppointment, PortalInvoice, PortalReminder, PortalMessage } from '../../../services/modules/clientPortal.api';

/**
 * NOTIFICATIONS FOR A PET OWNER.
 *
 * ⚠️ Like the supplier panel beside it, this exists because the shared one is
 * CLINIC-ONLY — it asks for today's visits, the staff inbox and purchase
 * orders, none of which a client account can reach (user, 2026-09-12).
 *
 * A client's four questions: when am I next in, what do I owe, what is due for
 * my animal, and has the clinic written to me. Every one comes from
 * `clientPortalAPI`, which is already scoped to the signed-in owner — there is
 * no clinic header to get wrong.
 */

interface Props {
  onClose: () => void;
  onNavigate?: (view: string, params?: any) => void;
}

const Row: React.FC<{
  icon: React.FC<any>; tone: string; title: string; sub: string; right?: React.ReactNode; onClick?: () => void;
}> = ({ icon: Icon, tone, title, sub, right, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-50 dark:border-zinc-800/60 last:border-0 disabled:cursor-default"
  >
    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
      <Icon size={13} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{title}</span>
      <span className="block text-[9px] font-bold text-slate-400 truncate">{sub}</span>
    </span>
    {right}
  </button>
);

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `Today · ${time}` : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${time}`;
};

const ClientNotifications: React.FC<Props> = ({ onClose, onNavigate }) => {
  const [appts, setAppts] = useState<PortalAppointment[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [reminders, setReminders] = useState<PortalReminder[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      clientPortalAPI.appointments({ silent: true } as any),
      clientPortalAPI.invoices({ silent: true } as any),
      clientPortalAPI.reminders({ silent: true } as any),
      clientPortalAPI.messages({ silent: true } as any),
    ]).then(([a, i, r, m]) => {
      if (a.status === 'fulfilled' && a.value?.success) setAppts(a.value.data?.appointments ?? []);
      if (i.status === 'fulfilled' && i.value?.success) setInvoices(i.value.data?.invoices ?? []);
      if (r.status === 'fulfilled' && r.value?.success) setReminders(r.value.data?.reminders ?? []);
      if (m.status === 'fulfilled' && m.value?.success) setMessages(m.value.data?.messages ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // Only what is still AHEAD — a finished visit is history, not a notification.
  const upcoming = useMemo(() => {
    const now = Date.now();
    return appts
      .filter(a => new Date(a.scheduledAt).getTime() >= now)
      .filter(a => !['CANCELLED', 'COMPLETED'].includes(String(a.status).toUpperCase()))
      .sort((x, y) => new Date(x.scheduledAt).getTime() - new Date(y.scheduledAt).getTime());
  }, [appts]);

  const unpaid = useMemo(() => invoices.filter(v => !v.isPaid && Number(v.amount) > 0), [invoices]);

  // Due or overdue only — a reminder three months out is not news today.
  const due = useMemo(() => {
    const now = Date.now();
    return reminders
      .filter(r => r.status === 'PENDING' && new Date(r.dueAt).getTime() <= now + 7 * 24 * 3600 * 1000)
      .sort((x, y) => new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime());
  }, [reminders]);

  // From the CLINIC and unread — the owner's own sent messages are not alerts.
  const unread = useMemo(
    () => messages.filter(m => !m.fromOwner && !m.isRead),
    [messages],
  );

  const total = upcoming.length + unpaid.length + due.length + unread.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-bold text-slate-400">
        <Loader2 size={13} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="py-10 text-center">
        <Bell size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />
        <p className="mt-2 text-[11px] font-bold text-slate-400">Nothing needs you right now.</p>
        <p className="text-[9px] font-bold text-slate-300 dark:text-zinc-600 mt-0.5">
          Visits, bills and your pet's reminders land here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {upcoming.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Upcoming visits · {upcoming.length}
          </p>
          {upcoming.slice(0, 4).map(a => (
            <Row
              key={a.id}
              icon={CalendarClock}
              tone="bg-seafoam/10 text-seafoam"
              title={`${a.pet?.name ?? 'Your pet'}${a.isBookingRequest ? ' · awaiting confirmation' : ''}`}
              sub={`${when(a.scheduledAt)} · ${a.clinic?.name ?? 'your clinic'}`}
              onClick={() => { onClose(); onNavigate?.('portal-appointments'); }}
            />
          ))}
        </>
      )}

      {unpaid.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            To pay · {unpaid.length}
          </p>
          {unpaid.slice(0, 4).map(v => (
            <Row
              key={v.appointmentId}
              icon={Receipt}
              tone="bg-amber-500/10 text-amber-500"
              title={v.petName ?? 'Visit'}
              sub={`${new Date(v.scheduledAt).toLocaleDateString()} · ${v.clinic?.name ?? ''}`}
              right={
                <span className="shrink-0 text-[10px] font-black font-mono text-amber-600">
                  {v.currency} {Number(v.amount).toLocaleString()}
                </span>
              }
              onClick={() => { onClose(); onNavigate?.('portal-invoices'); }}
            />
          ))}
        </>
      )}

      {due.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Due for your pet · {due.length}
          </p>
          {due.slice(0, 4).map(r => {
            const overdue = new Date(r.dueAt).getTime() < Date.now();
            return (
              <Row
                key={r.id}
                icon={BellRing}
                tone={overdue ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}
                title={r.title || r.serviceType.replace(/_/g, ' ').toLowerCase()}
                sub={`${r.pet?.name ? `${r.pet.name} · ` : ''}${overdue ? 'Overdue' : 'Due'} ${new Date(r.dueAt).toLocaleDateString()}`}
                onClick={() => { onClose(); onNavigate?.('portal-reminders'); }}
              />
            );
          })}
        </>
      )}

      {unread.length > 0 && (
        <>
          <p className="px-3 pt-2 pb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Messages · {unread.length}
          </p>
          {unread.slice(0, 4).map(m => (
            <Row
              key={m.id}
              icon={MessageSquare}
              tone="bg-indigo-500/10 text-indigo-500"
              title={m.subject || m.clinicName || 'Your clinic'}
              sub={m.body.slice(0, 60)}
              onClick={() => { onClose(); onNavigate?.('portal-messages'); }}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default ClientNotifications;

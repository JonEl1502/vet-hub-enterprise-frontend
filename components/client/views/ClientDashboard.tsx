import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PawPrint, CalendarDays, Receipt, MessageCircle, Plus, ArrowRight, Bell, CalendarPlus, Syringe,
} from 'lucide-react';
import { format, isFuture, differenceInCalendarDays } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import { speciesEmoji, petAge, reminderMeta } from '../cpUtils';

const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { pets, appointments, invoices, messages, reminders, clinics, loading } = useClientPortal();
  const navigate = useNavigate();

  const firstName = (user?.name || '').replace(/^(mr|ms|mrs|dr|prof)\.?\s+/i, '').split(' ')[0] || 'there';
  const upcoming = appointments
    .filter((a) => isFuture(new Date(a.scheduledAt)) && a.status !== 'CANCELLED')
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const next = upcoming[0];
  const unpaid = invoices.filter((i) => !i.isPaid);
  const unpaidTotal = unpaid.reduce((s, i) => s + i.amount, 0);
  const unread = messages.filter((m) => !m.fromOwner && !m.isRead).length;

  const dueReminders = reminders
    .filter((r) => r.status === 'PENDING')
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
    .slice(0, 3);

  const stats = [
    { label: 'Pets', value: pets.length, to: '/client/pets', icon: PawPrint },
    { label: 'Upcoming visits', value: upcoming.length, to: '/client/appointments', icon: CalendarDays },
    { label: 'Unpaid invoices', value: unpaid.length, to: '/client/invoices', icon: Receipt },
    { label: 'New messages', value: unread, to: '/client/messages', icon: MessageCircle },
  ];

  const dueTone = (dueAt: string) => {
    const days = differenceInCalendarDays(new Date(dueAt), new Date());
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, style: { background: '#fdecea', color: '#c0392b' } };
    if (days === 0) return { text: 'today', style: { background: '#fdeee6', color: '#df6f44' } };
    return { text: `in ${days}d`, style: { background: '#eaf5ef', color: '#1C7A5B' } };
  };

  return (
    <div className="space-y-5 fade-in">
      {/* Hero */}
      <div className="cp-hero p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-white">Hi {firstName} 👋</h1>
            <p className="text-sm text-white/70">{format(new Date(), 'EEEE d MMMM')} · here's what's happening with your pets.</p>
          </div>
          {/* Quick actions — visibility lives on the WRAPPERS (plain divs), not
              the buttons: cp-btn/cp-hero-btn set display themselves and would
              beat Tailwind's `hidden` on specificity. */}
          <div className="hidden sm:flex gap-2 shrink-0">
            <button className="cp-btn" onClick={() => navigate('/client/appointments')}>
              <CalendarPlus className="w-4 h-4" /> Book a visit
            </button>
            <button className="cp-hero-btn" onClick={() => navigate('/client/messages')}>
              <MessageCircle className="w-4 h-4" /> Message clinic
            </button>
          </div>
          <div className="flex sm:hidden gap-2 shrink-0">
            <button className="cp-icon-btn" title="Book a visit" onClick={() => navigate('/client/appointments')}>
              <CalendarPlus className="w-5 h-5" />
            </button>
            <button className="cp-icon-btn cp-icon-btn-ghost" title="Message clinic" onClick={() => navigate('/client/messages')}>
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pet strip */}
        {pets.length > 0 && (
          <div className="flex gap-3 mt-5 overflow-x-auto pb-1">
            {pets.map((p) => (
              <button key={p.id} onClick={() => navigate(`/client/pets/${p.id}`)}
                      className="flex flex-col items-center gap-1.5 shrink-0 group" title={p.name}>
                <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl overflow-hidden bg-white/15 ring-2 ring-white/25 group-hover:ring-white/60 transition">
                  {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" /> : speciesEmoji(p.species)}
                </span>
                <span className="text-[11px] font-bold text-white/85">{p.name}</span>
              </button>
            ))}
            <Link to="/client/pets" className="flex flex-col items-center gap-1.5 shrink-0 group">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/10 ring-2 ring-dashed ring-white/30 group-hover:ring-white/60 transition">
                <ArrowRight className="w-5 h-5 text-white/70" />
              </span>
              <span className="text-[11px] font-bold text-white/60">All pets</span>
            </Link>
          </div>
        )}
      </div>

      {!loading && clinics.length === 0 && (
        <div className="cp-card p-5 flex items-center gap-4">
          <div className="flex-1">
            <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>Connect to your clinic</h3>
            <p className="text-sm cp-muted">Link your vet to see your pets, book visits and pay invoices.</p>
          </div>
          <Link to="/client/pets" className="cp-btn"><Plus className="w-4 h-4" /> Add clinic</Link>
        </div>
      )}

      {!loading && clinics.length > 0 && pets.length === 0 && (
        <div className="cp-card p-5 flex items-center gap-4">
          <div className="text-3xl">🐾</div>
          <div className="flex-1">
            <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>Add your first pet</h3>
            <p className="text-sm cp-muted">You're connected — add your pet and it registers as a patient at your clinic right away.</p>
          </div>
          <Link to="/client/pets" className="cp-btn"><Plus className="w-4 h-4" /> Add pet</Link>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, to, icon: Icon }) => (
          <Link key={label} to={to} className="cp-card p-4 hover:scale-[1.02] transition-transform">
            <Icon className="w-5 h-5 cp-accent-text mb-2" />
            <div className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>{value}</div>
            <div className="text-xs cp-muted font-bold">{label}</div>
          </Link>
        ))}
      </div>

      {/* Unpaid callout */}
      {unpaid.length > 0 && (
        <div className="cp-card p-4 flex items-center gap-3" style={{ borderColor: '#f5c8b6' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--cp-accent-soft)' }}>
            <Receipt className="w-5 h-5 cp-accent-text" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>
              {unpaid.length} unpaid {unpaid.length === 1 ? 'invoice' : 'invoices'} · {unpaid[0]?.currency} {unpaidTotal.toLocaleString()}
            </div>
            <div className="text-xs cp-muted">Settle from the portal by card or M-Pesa.</div>
          </div>
          <button className="cp-btn" onClick={() => navigate('/client/invoices')}>Pay now</button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Next visit */}
        <div className="cp-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>Next visit</h3>
            <Link to="/client/appointments" className="text-xs font-bold cp-accent-text flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {next ? (
            <button className="flex items-center gap-3 w-full text-left" onClick={() => navigate(next.isBookingRequest ? '/client/appointments' : `/client/appointments/${next.id}`)}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'var(--cp-accent-soft)' }}>
                {speciesEmoji(next.pet?.species || '')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{next.pet?.name} · {next.clinic?.name}</div>
                <div className="text-sm cp-muted">{format(new Date(next.scheduledAt), 'EEE d MMM, h:mm a')}</div>
              </div>
              <span className="cp-chip">{next.status.replace('_', ' ').toLowerCase()}</span>
            </button>
          ) : (
            <p className="text-sm cp-muted">No upcoming visits. <Link to="/client/appointments" className="cp-accent-text font-bold">Book one →</Link></p>
          )}
        </div>

        {/* Care reminders */}
        <div className="cp-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black flex items-center gap-2" style={{ color: 'var(--cp-ink)' }}>
              <Bell className="w-4 h-4 cp-accent-text" /> Care reminders
            </h3>
            <Link to="/client/appointments?tab=reminders" className="text-xs font-bold cp-accent-text flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {dueReminders.length === 0 ? (
            <p className="text-sm cp-muted flex items-center gap-2"><Syringe className="w-4 h-4" /> Nothing due — you're all caught up. 🎉</p>
          ) : (
            <div className="space-y-2">
              {dueReminders.map((r) => {
                const meta = reminderMeta(r.serviceType);
                const tone = dueTone(r.dueAt);
                return (
                  <div key={r.id} className="cp-card-soft p-3 flex items-center gap-3">
                    <span className="text-lg">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate" style={{ color: 'var(--cp-ink)' }}>
                        {r.title || meta.label}{r.pet ? ` · ${r.pet.name}` : ''}
                      </div>
                      <div className="text-xs cp-muted">{format(new Date(r.dueAt), 'd MMM yyyy')}{r.clinicName ? ` · ${r.clinicName}` : ''}</div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={tone.style}>{tone.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pets overview */}
      {pets.length > 0 && (
        <div className="cp-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>My pets</h3>
            <Link to="/client/pets" className="text-xs font-bold cp-accent-text flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pets.slice(0, 6).map((p) => (
              <button key={p.id} onClick={() => navigate(`/client/pets/${p.id}`)} className="cp-card-soft p-3 flex items-center gap-3 text-left hover:scale-[1.01] transition-transform">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl overflow-hidden shrink-0" style={{ background: 'var(--cp-accent-soft)' }}>
                  {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" /> : speciesEmoji(p.species)}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: 'var(--cp-ink)' }}>{p.name}</div>
                  <div className="text-xs cp-muted truncate">
                    {[p.breed || p.species, petAge(p.dob)].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;

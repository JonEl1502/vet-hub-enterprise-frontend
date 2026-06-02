import React from 'react';
import { Link } from 'react-router-dom';
import { PawPrint, CalendarDays, Receipt, MessageCircle, Plus, ArrowRight } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useClientPortal } from '../../../contexts/ClientPortalContext';

const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { pets, appointments, invoices, messages, clinics, loading } = useClientPortal();

  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const upcoming = appointments
    .filter((a) => isFuture(new Date(a.scheduledAt)) && a.status !== 'CANCELLED')
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const next = upcoming[0];
  const unpaid = invoices.filter((i) => !i.isPaid);
  const unread = messages.filter((m) => !m.fromOwner && !m.isRead).length;

  const stats = [
    { label: 'Pets', value: pets.length, to: '/client/pets', icon: PawPrint },
    { label: 'Upcoming visits', value: upcoming.length, to: '/client/appointments', icon: CalendarDays },
    { label: 'Unpaid invoices', value: unpaid.length, to: '/client/invoices', icon: Receipt },
    { label: 'New messages', value: unread, to: '/client/messages', icon: MessageCircle },
  ];

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Hi {firstName} 👋</h1>
        <p className="cp-muted text-sm">Here's what's happening with your pets.</p>
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

      {/* Next appointment */}
      <div className="cp-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>Next visit</h3>
          <Link to="/client/appointments" className="text-xs font-bold cp-accent-text flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {next ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'var(--cp-accent-soft)' }}>🐾</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ color: 'var(--cp-ink)' }}>{next.pet?.name} · {next.clinic?.name}</div>
              <div className="text-sm cp-muted">{format(new Date(next.scheduledAt), 'EEE d MMM, h:mm a')}</div>
            </div>
            <span className="cp-chip">{next.status.replace('_', ' ').toLowerCase()}</span>
          </div>
        ) : (
          <p className="text-sm cp-muted">No upcoming visits. <Link to="/client/appointments" className="cp-accent-text font-bold">Book one →</Link></p>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;

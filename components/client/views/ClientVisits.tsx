import React, { useState } from 'react';
import { Plus, Loader2, CalendarDays } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import { PortalAppointment } from '../../../services';
import CpModal from '../CpModal';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

const statusTone: Record<string, string> = {
  SCHEDULED: 'var(--cp-seafoam)',
  IN_PROGRESS: '#d98c2b',
  PENDING_PAYMENT: '#c0392b',
  COMPLETED: '#3a7d5d',
  CANCELLED: '#8a8077',
};

const Row: React.FC<{ a: PortalAppointment }> = ({ a }) => (
  <div className="cp-card p-4 flex items-center gap-3">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--cp-accent-soft)' }}>🐾</div>
    <div className="flex-1 min-w-0">
      <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{a.pet?.name} · {a.clinic?.name}</div>
      <div className="text-sm cp-muted">{format(new Date(a.scheduledAt), 'EEE d MMM yyyy, h:mm a')}</div>
      {a.tasks?.[0] && <div className="text-xs cp-muted truncate">{a.tasks.map((t) => t.name).join(', ')}</div>}
    </div>
    <span className="text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg"
          style={{ color: '#fff', background: statusTone[a.status] || 'var(--cp-muted)' }}>
      {a.status.replace('_', ' ')}
    </span>
  </div>
);

const ClientVisits: React.FC = () => {
  const { appointments, loading } = useClientPortal();
  const [booking, setBooking] = useState(false);

  const upcoming = appointments.filter((a) => isFuture(new Date(a.scheduledAt)) && a.status !== 'CANCELLED');
  const past = appointments.filter((a) => !isFuture(new Date(a.scheduledAt)) || a.status === 'CANCELLED');

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Visits</h1>
        <button className="cp-btn" onClick={() => setBooking(true)}><Plus className="w-4 h-4" /> Book a visit</button>
      </div>

      {loading ? (
        <div className="py-12"><LoadingSpinner message="Loading..." /></div>
      ) : appointments.length === 0 ? (
        <div className="cp-card p-8 text-center">
          <CalendarDays className="w-8 h-8 cp-accent-text mx-auto mb-2" />
          <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>No appointments yet</h3>
          <p className="text-sm cp-muted mb-4">Request a visit and your clinic will confirm the time.</p>
          <button className="cp-btn mx-auto" onClick={() => setBooking(true)}><Plus className="w-4 h-4" /> Book a visit</button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="cp-label">Upcoming</h2>
              <div className="space-y-2">{upcoming.map((a) => <Row key={a.id} a={a} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="cp-label">Past</h2>
              <div className="space-y-2 opacity-80">{past.map((a) => <Row key={a.id} a={a} />)}</div>
            </section>
          )}
        </>
      )}

      {booking && <BookModal onClose={() => setBooking(false)} />}
    </div>
  );
};

const BookModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { pets, book } = useClientPortal();
  const [petId, setPetId] = useState(pets[0]?.id || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [isHouseCall, setIsHouseCall] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petId || !date || !time) return;
    setBusy(true);
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const ok = await book({ petId, scheduledAt, reason: reason.trim() || undefined, isHouseCall });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <CpModal title="Request an appointment" onClose={onClose}>
      {pets.length === 0 ? (
        <p className="text-sm cp-muted">Connect a clinic and add a pet first, then you can book a visit.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="cp-label">Pet</label>
            <select className="cp-input" value={petId} onChange={(e) => setPetId(e.target.value)} required>
              {pets.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.clinic?.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">Date</label>
              <input className="cp-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="cp-label">Time</label>
              <input className="cp-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="cp-label">Reason for visit</label>
            <textarea className="cp-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. annual check-up, limping on left leg…" />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>
            <input type="checkbox" checked={isHouseCall} onChange={(e) => setIsHouseCall(e.target.checked)} />
            Request a home visit
          </label>
          <p className="text-xs cp-muted">This sends a request to your clinic — they'll confirm the final time.</p>
          <button type="submit" className="cp-btn w-full" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send request'}
          </button>
        </form>
      )}
    </CpModal>
  );
};

export default ClientVisits;

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, XCircle, CalendarClock, Receipt, Phone, Star } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { clientPortalAPI, toast, PortalVisitDetail, VisitRating } from '../../../services';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import CpModal from '../CpModal';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { speciesEmoji } from '../cpUtils';

const statusTone: Record<string, string> = {
  SCHEDULED: 'var(--cp-seafoam)',
  IN_PROGRESS: '#d98c2b',
  PENDING_PAYMENT: '#c0392b',
  COMPLETED: '#3a7d5d',
  CANCELLED: '#8a8077',
};

const EVENT_DOT: Record<string, string> = {
  milestone: '#1C7A5B',
  action: '#d98c2b',
  alert: '#c0392b',
  billing: '#7c6bd6',
  info: '#8a8077',
};

const ClientVisitDetail: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { refreshAppointments } = useClientPortal();

  const [visit, setVisit] = useState<PortalVisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState<VisitRating | null>(null);
  const [busy, setBusy] = useState(false);

  const load = React.useCallback(() => {
    if (!appointmentId) return;
    clientPortalAPI.appointmentDetail(appointmentId)
      .then((res) => setVisit(res.data?.appointment ?? null))
      .finally(() => setLoading(false));
    clientPortalAPI.visitRating(appointmentId)
      .then((res) => setRating(res.data?.rating ?? null))
      .catch(() => {});
  }, [appointmentId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading) return <div className="py-16"><LoadingSpinner message="Loading visit..." /></div>;
  if (!visit) {
    return (
      <div className="cp-card p-8 text-center fade-in">
        <p className="text-sm cp-muted">Visit not found.</p>
        <button className="cp-btn mx-auto mt-4" onClick={() => navigate('/client/appointments')}>Back to visits</button>
      </div>
    );
  }

  const upcoming = visit.status === 'SCHEDULED' && isFuture(new Date(visit.scheduledAt));
  const services = visit.tasks.filter((t) => t.price >= 0);

  const doCancel = async () => {
    setBusy(true);
    try {
      const res = await clientPortalAPI.cancelAppointment(visit.id);
      if (res.data?.cancelled) {
        toast.success('Visit cancelled');
        setCancelOpen(false);
        await refreshAppointments();
        load();
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 fade-in">
      <button className="text-xs font-bold cp-accent-text flex items-center gap-1" onClick={() => navigate('/client/appointments')}>
        <ArrowLeft className="w-3.5 h-3.5" /> Visits
      </button>

      {/* Header */}
      <div className="cp-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'var(--cp-accent-soft)' }}>
            {speciesEmoji(visit.pet?.species || '')}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black truncate" style={{ color: 'var(--cp-ink)' }}>
              {visit.pet?.name} · {visit.clinic?.name}
            </h1>
            <p className="text-sm cp-muted">
              {format(new Date(visit.scheduledAt), 'EEEE d MMM yyyy, h:mm a')}
              {visit.isHouseCall && ' · 🚗 house call'}
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-lg"
                style={{ color: '#fff', background: statusTone[visit.status] || 'var(--cp-muted)' }}>
            {visit.status.replace('_', ' ')}
          </span>
        </div>

        {upcoming && (
          <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--cp-border)' }}>
            <button className="cp-btn-ghost" onClick={() => setReschedOpen(true)}>
              <CalendarClock className="w-4 h-4" /> Reschedule
            </button>
            <button className="cp-btn-ghost" style={{ color: '#c0392b' }} onClick={() => setCancelOpen(true)}>
              <XCircle className="w-4 h-4" /> Cancel visit
            </button>
          </div>
        )}

        {visit.status === 'COMPLETED' && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--cp-border)' }}>
            <button className="cp-btn" onClick={() => setRateOpen(true)}>
              <Star className="w-4 h-4" /> {rating?.rated ? 'Edit your rating' : 'Rate your visit'}
            </button>
            {rating?.rated && (() => {
              const vals = Object.values(rating.facets).filter((v): v is number => typeof v === 'number');
              const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
              return (
                <span className="flex items-center gap-1 text-sm font-black" style={{ color: 'var(--cp-ink)' }}>
                  <Star className="w-4 h-4" style={{ fill: '#f5b301', color: '#f5b301' }} /> {avg.toFixed(1)}
                  <span className="cp-muted font-bold text-xs">· thanks for rating</span>
                </span>
              );
            })()}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Services + bill */}
        <div className="cp-card p-5">
          <h3 className="font-black mb-3 flex items-center gap-2" style={{ color: 'var(--cp-ink)' }}>
            <Receipt className="w-4 h-4 cp-accent-text" /> Services & bill
          </h3>
          {services.length === 0 ? (
            <p className="text-sm cp-muted">The clinic will add services during the visit.</p>
          ) : (
            <div className="space-y-2">
              {services.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{t.name}</div>
                    <div className="text-xs cp-muted">{t.category}</div>
                  </div>
                  <div className="font-bold shrink-0" style={{ color: 'var(--cp-ink)' }}>
                    {t.price > 0 ? `${visit.currency} ${t.price.toLocaleString()}` : '—'}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-1 border-t" style={{ borderColor: 'var(--cp-border)' }}>
                <span className="font-black text-sm" style={{ color: 'var(--cp-ink)' }}>Total</span>
                <span className="font-black" style={{ color: 'var(--cp-ink)' }}>{visit.currency} {visit.totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${visit.isPaid ? '' : ''}`}
                      style={visit.isPaid ? { background: '#eaf5ef', color: '#3a7d5d' } : { background: '#fdecea', color: '#c0392b' }}>
                  {visit.isPaid ? 'Paid' : 'Unpaid'}
                </span>
                {!visit.isPaid && visit.totalCost > 0 && (
                  <button className="cp-btn" onClick={() => navigate('/client/invoices')}>Pay now</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Journey timeline */}
        <div className="cp-card p-5">
          <h3 className="font-black mb-3" style={{ color: 'var(--cp-ink)' }}>Visit journey</h3>
          {visit.events.length === 0 ? (
            <p className="text-sm cp-muted">Updates from the clinic will appear here during the visit.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {visit.events.map((e) => (
                <div key={e.id} className="cp-timeline relative">
                  <span className="cp-timeline-dot" style={{ background: EVENT_DOT[e.kind] || EVENT_DOT.info }} />
                  <div className="text-xs cp-muted font-bold">{format(new Date(e.at), 'd MMM, h:mm a')}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>{e.label}</div>
                </div>
              ))}
            </div>
          )}
          {visit.clinicPhone && (
            <a href={`tel:${visit.clinicPhone}`} className="mt-4 text-xs font-bold cp-accent-text flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Call {visit.clinic?.name}
            </a>
          )}
        </div>
      </div>

      {/* Cancel confirm */}
      {cancelOpen && (
        <CpModal title="Cancel this visit?" onClose={() => setCancelOpen(false)}>
          <p className="text-sm cp-muted mb-4">
            This lets {visit.clinic?.name} know you won't make it on {format(new Date(visit.scheduledAt), 'd MMM, h:mm a')}. You can always book again.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="cp-btn-ghost" onClick={() => setCancelOpen(false)}>Keep visit</button>
            <button className="cp-btn" style={{ background: '#c0392b' }} disabled={busy} onClick={doCancel}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel visit'}
            </button>
          </div>
        </CpModal>
      )}

      {reschedOpen && (
        <RescheduleModal
          visit={visit}
          onClose={() => setReschedOpen(false)}
          onDone={() => { setReschedOpen(false); load(); }}
        />
      )}

      {rateOpen && (
        <RatingModal
          visit={visit}
          existing={rating}
          onClose={() => setRateOpen(false)}
          onDone={() => { setRateOpen(false); load(); }}
        />
      )}
    </div>
  );
};

// Five-star input row.
const StarRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>{label}</span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5 transition-transform active:scale-90" aria-label={`${n} star`}>
          <Star className="w-6 h-6" style={n <= value ? { fill: '#f5b301', color: '#f5b301' } : { color: 'var(--cp-border)' }} />
        </button>
      ))}
    </div>
  </div>
);

// Rate a completed visit across all facets — one submit saves them all.
const RatingModal: React.FC<{ visit: PortalVisitDetail; existing: VisitRating | null; onClose: () => void; onDone: () => void }> = ({ visit, existing, onClose, onDone }) => {
  const f = existing?.facets || {};
  const [vet, setVet] = useState(f.vet || 0);
  const [staff, setStaff] = useState(f.staff || 0);
  const [service, setService] = useState(f.service || 0);
  const [clinic, setClinic] = useState(f.clinic || 0);
  const [overall, setOverall] = useState(f.overall || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (![vet, staff, service, clinic, overall].some((v) => v > 0)) {
      toast.error('Tap at least one set of stars');
      return;
    }
    setBusy(true);
    try {
      const res = await clientPortalAPI.rateVisit(visit.id, {
        vet: vet || undefined, staff: staff || undefined, service: service || undefined,
        clinic: clinic || undefined, overall: overall || undefined, comment: comment.trim() || undefined,
      });
      if (res.data?.rating) { toast.success('Thanks for your feedback 🐾'); onDone(); }
    } finally { setBusy(false); }
  };

  return (
    <CpModal title="Rate your visit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-1">
        <p className="text-sm cp-muted mb-2">How was your visit at {visit.clinic?.name}? Your feedback helps them improve.</p>
        <div className="divide-y" style={{ borderColor: 'var(--cp-border)' }}>
          <StarRow label={visit.attendingName ? `Vet — ${visit.attendingName}` : 'Attending vet'} value={vet} onChange={setVet} />
          <StarRow label="Staff & support" value={staff} onChange={setStaff} />
          <StarRow label="Service quality" value={service} onChange={setService} />
          <StarRow label="The clinic" value={clinic} onChange={setClinic} />
          <StarRow label="Overall experience" value={overall} onChange={setOverall} />
        </div>
        <div className="pt-3">
          <label className="cp-label">Anything to add? (optional)</label>
          <textarea className="cp-input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell them what went well or could be better" />
        </div>
        <button type="submit" className="cp-btn w-full mt-3" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (existing?.rated ? 'Update rating' : 'Submit rating')}
        </button>
      </form>
    </CpModal>
  );
};

const RescheduleModal: React.FC<{ visit: PortalVisitDetail; onClose: () => void; onDone: () => void }> = ({ visit, onClose, onDone }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const proposedAt = date && time ? new Date(`${date}T${time}`).toISOString() : undefined;
      const res = await clientPortalAPI.requestReschedule(visit.id, { proposedAt, note: note.trim() || undefined });
      if (res.data?.requested) {
        toast.success('Reschedule requested — your clinic will confirm');
        onDone();
      }
    } finally { setBusy(false); }
  };

  return (
    <CpModal title="Request a new time" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm cp-muted">
          Currently {format(new Date(visit.scheduledAt), 'EEE d MMM, h:mm a')}. Suggest a new time and {visit.clinic?.name} will confirm.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cp-label">Preferred date</label>
            <input className="cp-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="cp-label">Preferred time</label>
            <input className="cp-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="cp-label">Note (optional)</label>
          <textarea className="cp-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. mornings work best for me" />
        </div>
        <button type="submit" className="cp-btn w-full" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send request'}
        </button>
      </form>
    </CpModal>
  );
};

export default ClientVisitDetail;

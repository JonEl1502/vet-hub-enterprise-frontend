import React, { useEffect, useState } from 'react';
import { Search, Loader2, Stethoscope, MapPin, Star } from 'lucide-react';
import CpModal from './CpModal';
import { toast } from '../../services';
import { clientPortalAPI, PortalClinic } from '../../services/modules/clientPortal.api';
import { marketplaceAPI } from '../../services/modules/marketplace.api';

/** Matches the two new `specialties` values added 2026-09-29 for this exact flow. */
const EXPERTISE_FILTERS = [
  { key: '', label: 'Any clinic' },
  { key: 'Livestock', label: 'Livestock' },
  { key: 'Poultry', label: 'Poultry' },
];

/**
 * "Ask a vet to inspect" (redesign brief §4). Buyer picks who comes — their
 * own vet if they have one, or searches by name/expertise. The seller sees
 * this land against their listing and can cancel it if they don't want the
 * visit; there's no separate seller-approval step here, see the schema
 * comment on `MarketplaceInspectionRequest` for why.
 */
const RequestInspectionModal: React.FC<{ listingId: string; onClose: () => void; onSent: () => void }> = ({
  listingId, onClose, onSent,
}) => {
  const [q, setQ] = useState('');
  const [expertise, setExpertise] = useState('');
  const [clinics, setClinics] = useState<PortalClinic[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PortalClinic | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!q.trim() && !expertise) { setClinics([]); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      const res = await clientPortalAPI.searchClinics(q.trim(), expertise || undefined);
      if (res.success && res.data) setClinics(res.data.clinics);
      setSearching(false);
    }, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [q, expertise]);

  const send = async () => {
    if (!picked) { toast.error('Pick a clinic first'); return; }
    setSending(true);
    try {
      const r = await marketplaceAPI.requestInspection(listingId, {
        clinicId: picked.id,
        preferredDate: preferredDate || undefined,
        message: message.trim() || undefined,
      });
      if (r.success) {
        toast.success(`Sent to ${picked.name}`);
        onSent();
      }
    } finally { setSending(false); }
  };

  if (picked) {
    return (
      <CpModal title="Ask a vet to inspect" onClose={onClose} maxWidth="26rem">
        <div className="space-y-3">
          <button type="button" onClick={() => setPicked(null)} className="cp-chip">
            {picked.name} · change
          </button>
          <div>
            <label className="cp-label">Preferred date — optional</label>
            <input className="cp-input w-full" type="date" value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)} />
          </div>
          <div>
            <label className="cp-label">What should they check?</label>
            <textarea className="cp-input w-full" rows={3}
              placeholder="General health check before I buy — any signs of illness, pregnancy status if unclear."
              value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="text-[11px] cp-muted">
            The seller will see this against their listing and can decline the visit if they'd rather not.
          </p>
          <button className="cp-btn w-full" onClick={send} disabled={sending}>
            {sending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </CpModal>
    );
  }

  return (
    <CpModal title="Ask a vet to inspect" onClose={onClose} maxWidth="26rem">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {EXPERTISE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setExpertise(key)}
              className={`cp-chip ${expertise === key ? '' : 'opacity-50'}`}
              style={expertise === key ? undefined : { background: 'var(--cp-surface-2)', color: 'var(--cp-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 cp-muted" />
          <input className="cp-input w-full pl-8" placeholder="Clinic name or town"
            value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>

        {searching ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin cp-accent-text" /></div>
        ) : clinics.length === 0 ? (
          <p className="text-sm cp-muted text-center py-8">
            {q.trim() || expertise ? 'No clinics match yet — try a different name or town.' : 'Search by name, town, or pick an expertise above.'}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
            {clinics.map((c) => (
              <button key={c.id} onClick={() => setPicked(c)} className="w-full text-left cp-card p-3 flex items-center gap-3 hover:opacity-90 transition-opacity">
                <span className="cp-icon-chip" style={{ background: 'var(--cp-surface-2)', color: 'var(--cp-seafoam)' }}>
                  <Stethoscope className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{c.name}</div>
                  <div className="text-[11px] cp-muted truncate flex items-center gap-2">
                    {c.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {c.city}</span>}
                    {c.rating > 0 && <span className="flex items-center gap-0.5"><Star className="w-3 h-3" /> {c.rating.toFixed(1)}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </CpModal>
  );
};

export default RequestInspectionModal;

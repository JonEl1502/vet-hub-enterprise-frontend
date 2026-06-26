import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Handshake as HandshakeIcon, Send, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { handshakesAPI, clinicsAPI } from '../../../services';
import { useClinic } from '../../../contexts/ClinicContext';

interface PartnerValue { clinicId: string | null; name: string }
interface Props {
  /** Service this external record is for — sent as the requested service in a handshake. */
  serviceLabel: string;
  value: PartnerValue;
  onChange: (v: PartnerValue) => void;
}

/**
 * For an EXTERNAL lab/imaging record: pick a CONNECTED partner clinic (from
 * accepted handshakes). If the target isn't connected, request a partnership +
 * the service inline (creates a Handshake with allowedServices=[serviceLabel]);
 * the other clinic accepts it in their Partners inbox. Free-text name still
 * works for a one-off non-partner.
 */
const PartnerPicker: React.FC<Props> = ({ serviceLabel, value, onChange }) => {
  const { selectedClinics } = useClinic();
  const myClinicId = String((selectedClinics?.[0] as any)?.id ?? '');
  const [partners, setPartners] = useState<{ clinicId: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [dirSearch, setDirSearch] = useState('');
  const [directory, setDirectory] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const res = await handshakesAPI.getAll();
      if (res.success && res.data) {
        const all = [...(res.data.sent || []), ...(res.data.received || [])].filter(h => h.status === 'ACCEPTED');
        const ps = all.map(h => {
          const other = String(h.requesterClinicId) === myClinicId ? h.receiverClinic : h.requesterClinic;
          return other ? { clinicId: String(other.id), name: other.name } : null;
        }).filter(Boolean) as { clinicId: string; name: string }[];
        // De-dupe by clinicId
        setPartners(Array.from(new Map(ps.map(p => [p.clinicId, p])).values()));
      }
    } catch { /* non-fatal */ } finally { setLoading(false); }
  };
  useEffect(() => { loadPartners(); }, []);

  useEffect(() => {
    if (!showRequest) return;
    clinicsAPI.getPartnerClinics({ limit: 200 }).then(r => { if (r.success && (r.data as any)?.clinics) setDirectory((r.data as any).clinics); }).catch(() => {});
  }, [showRequest]);

  const dirFiltered = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    const partnerIds = new Set(partners.map(p => p.clinicId));
    return directory.filter(c => String(c.id) !== myClinicId && !partnerIds.has(String(c.id)) && (!q || (c.name || '').toLowerCase().includes(q)));
  }, [directory, dirSearch, partners, myClinicId]);

  const requestPartnership = async (clinic: any) => {
    setSending(true);
    try {
      const res = await handshakesAPI.create({ receiverClinicId: clinic.id, allowedServices: [serviceLabel], note: `Requesting ${serviceLabel} service partnership` });
      if (res.success) {
        toast.success(`Partnership + ${serviceLabel} request sent to ${clinic.name}`);
        setShowRequest(false); setRequesting(false);
        onChange({ clinicId: String(clinic.id), name: clinic.name });
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to send request'); }
    finally { setSending(false); }
  };

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 py-2"><Loader2 size={13} className="animate-spin" /> Loading partners…</div>
      ) : (
        <>
          {/* Connected partners dropdown */}
          <div className="relative">
            <select className={fieldCls} value={value.clinicId ?? ''} onChange={e => {
              const id = e.target.value;
              if (id === '__other__') { onChange({ clinicId: null, name: value.name }); return; }
              const p = partners.find(x => x.clinicId === id);
              onChange(p ? { clinicId: p.clinicId, name: p.name } : { clinicId: null, name: '' });
            }}>
              <option value="">Select partner clinic…</option>
              {partners.map(p => <option key={p.clinicId} value={p.clinicId}>{p.name}</option>)}
              <option value="__other__">Other (free text)…</option>
            </select>
          </div>

          {/* Free-text fallback for a one-off non-partner */}
          {value.clinicId == null && (
            <input className={fieldCls} value={value.name} onChange={e => onChange({ clinicId: null, name: e.target.value })} placeholder="External lab / clinic name" />
          )}

          {value.clinicId && (
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600"><Check size={12} /> Connected partner — the record will be shared with them.</p>
          )}

          {/* Request a new partner + service */}
          {!showRequest ? (
            <button type="button" onClick={() => setShowRequest(true)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-seafoam">
              <HandshakeIcon size={12} /> Request a new partner
            </button>
          ) : (
            <div className="rounded-xl border border-seafoam/30 bg-seafoam/5 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Request partnership + {serviceLabel}</p>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${fieldCls} pl-8`} value={dirSearch} onChange={e => setDirSearch(e.target.value)} placeholder="Search clinics to connect" />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {dirFiltered.slice(0, 30).map(c => (
                  <button key={c.id} type="button" disabled={sending} onClick={() => requestPartnership(c)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-seafoam disabled:opacity-50">
                    <span className="flex items-center gap-2 min-w-0"><span className="text-base">{c.logo || '🏥'}</span><span className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.name}</span></span>
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-seafoam shrink-0"><Send size={11} /> Send</span>
                  </button>
                ))}
                {dirFiltered.length === 0 && <p className="text-[11px] text-slate-400 text-center py-2">No clinics to connect.</p>}
              </div>
              <button type="button" onClick={() => setShowRequest(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400">Close</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PartnerPicker;

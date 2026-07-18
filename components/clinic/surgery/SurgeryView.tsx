import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Slice, Loader2, Search, Clock } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { surgeryAPI, SurgeryRecord } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

// Render free text as bullet points (one per line) or a paragraph, per the
// record's displayFormat. Shared shape with the client portal so both match.
export const renderFormatted = (text?: string | null, format?: string) => {
  const val = (text || '').trim();
  if (!val) return null;
  if (format === 'BULLET') {
    const lines = val.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return <ul className="list-disc list-inside space-y-0.5">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
  }
  return <p className="whitespace-pre-wrap leading-relaxed">{val}</p>;
};

interface Props { onOpenAppointment?: (appointmentId: string, settle?: boolean) => void; onOpenRecord?: (recordId: string, opts?: { replace?: boolean }) => void; openForAppointmentId?: string }

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
];
const STATUS_OPTS = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  IN_PROGRESS: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};
const fieldCls = 'w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5';

const fileToDataUrl = (file: File, max = 1000, quality = 0.7): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) { const s = Math.min(max / width, max / height); width = Math.round(width * s); height = Math.round(height * s); }
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        c.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('decode failed'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const SurgeryView: React.FC<Props> = ({ onOpenAppointment, onOpenRecord, openForAppointmentId }) => {
  const { pets } = useData();
  const [records, setRecords] = useState<SurgeryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await surgeryAPI.list(); if (res.success && res.data) setRecords(res.data.records); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deep-link: when arrived from a visit's SERVICES category, forward to this
  // visit's surgery record page once records have loaded (consumed once).
  const deepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openForAppointmentId || deepLinkRef.current === openForAppointmentId) return;
    const rec = records.find(r => String(r.appointmentId) === String(openForAppointmentId));
    // REPLACE the transient list hop so Back returns to where the user came
    // from (the visit), not to this list which would instantly re-forward.
    if (rec) { deepLinkRef.current = openForAppointmentId; onOpenRecord?.(String(rec.id), { replace: true }); }
  }, [openForAppointmentId, records, onOpenRecord]);

  const petName = (r: SurgeryRecord) => r.pet?.name || pets.find((p: any) => String(p.id) === String(r.petId))?.name || 'Patient';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter(r => status === 'all' || r.status === status)
      .filter(r => !q || `${petName(r)} ${r.serviceName}`.toLowerCase().includes(q));
  }, [records, status, search, pets]);

  // Group services by their visit so all surgery services for one appointment
  // sit together in a single card (each service keeps its own settings).
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; appointmentId: string | null; pet: string; species?: string; date: string; records: SurgeryRecord[] }>();
    for (const r of filtered) {
      const key = r.appointmentId ? `appt:${r.appointmentId}` : `rec:${r.id}`;
      if (!map.has(key)) map.set(key, { key, appointmentId: r.appointmentId, pet: petName(r), species: r.pet?.species ?? undefined, date: r.createdAt, records: [] });
      map.get(key)!.records.push(r);
    }
    return Array.from(map.values());
  }, [filtered, pets]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center"><Slice size={22} className="text-rose-600 dark:text-rose-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Surgery</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Procedures performed across visits</p>
          </div>
        </div>
        {/* Stack to one column on phones so neither control is squeezed. */}
        <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient / procedure" className={`${fieldCls} pl-9 w-full sm:w-56`} />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className={`${fieldCls} w-full sm:w-36`}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20"><LoadingSpinner size="lg" message="Loading surgeries..." /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <Slice size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-bold">No surgery records.</p>
          <p className="text-xs mt-1">Add a surgery service to a visit and it appears here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {grouped.map(g => (
            <div key={g.key} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{g.pet}{g.species ? ` · ${g.species}` : ''}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={10} /> {formatDate(g.date)}{g.records.length > 1 ? ` · ${g.records.length} services` : ''}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {g.records.map(r => (
                  <button key={r.id} onClick={() => onOpenRecord?.(String(r.id))} className="w-full text-left bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800 rounded-xl px-3 py-2 hover:border-seafoam transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-pine dark:text-zinc-100 uppercase tracking-tight truncate">{r.serviceName}</span>
                        <span className="block text-[9px] text-slate-400">{r.complexity ? `Complexity ${r.complexity}` : 'No complexity set'}{r.images?.length > 0 ? ` · ${r.images.length} img` : ''}</span>
                      </span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${statusTone[r.status] || 'bg-slate-100 text-slate-500'}`}>{r.status.replace('_', ' ')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default SurgeryView;

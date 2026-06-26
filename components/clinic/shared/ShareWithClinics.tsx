import React, { useState, useEffect, useMemo } from 'react';
import { X, Share2, Loader2, Check, Search, ShieldCheck, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { clinicsAPI, recordSharingAPI, ShareableRecordType, RecordAccessLogEntry } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  recordType: ShareableRecordType;
  recordId: string | number;
  /** Current partner allow-list (clinic ids as strings). */
  allowedClinicIds?: string[];
  onClose: () => void;
  onSaved?: (allowedClinicIds: string[]) => void;
}

/**
 * Owner-only control to share ONE record with partner clinics — they then see
 * just that record (imaging/lab/boarding/etc.), never the full patient chart.
 * Also surfaces the cross-clinic access log for this record.
 */
const ShareWithClinics: React.FC<Props> = ({ recordType, recordId, allowedClinicIds = [], onClose, onSaved }) => {
  const [clinics, setClinics] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(allowedClinicIds.map(String)));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessLog, setAccessLog] = useState<RecordAccessLogEntry[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      clinicsAPI.getPartnerClinics({ limit: 200 }).catch(() => null),
      recordSharingAPI.accessLog().catch(() => null),
    ]).then(([cl, log]) => {
      if (!alive) return;
      if (cl?.success && (cl.data as any)?.clinics) setClinics((cl.data as any).clinics);
      if (log?.success && log.data?.logs) setAccessLog(log.data.logs.filter(l => l.recordType === recordType && String(l.recordId) === String(recordId)));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [recordType, recordId]);

  const clinicName = (id: string) => clinics.find(c => String(c.id) === String(id))?.name || `Clinic #${id}`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clinics.filter(c => !q || (c.name || '').toLowerCase().includes(q));
  }, [clinics, search]);

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    setSaving(true);
    try {
      const ids = Array.from(selected);
      const res = await recordSharingAPI.setShares(recordType, recordId, ids);
      if (res.success) { toast.success('Sharing updated'); onSaved?.(res.data?.allowedClinicIds ?? ids); onClose(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to update sharing'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-seafoam/10 text-seafoam flex items-center justify-center"><Share2 size={16} /></span>
            <div>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Share with partner clinics</h3>
              <p className="text-[10px] text-slate-400">They see only this record — not the full patient chart.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clinics" className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100" />
          </div>

          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-seafoam" /></div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {filtered.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">No partner clinics found.</p>}
              {filtered.map(c => {
                const on = selected.has(String(c.id));
                return (
                  <button key={c.id} onClick={() => toggle(String(c.id))} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${on ? 'bg-seafoam/10 border-seafoam/40' : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-seafoam'}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{c.logo || '🏥'}</span>
                      <span className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.name}</span>
                    </span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${on ? 'bg-seafoam text-white' : 'border border-slate-300 dark:border-zinc-700'}`}>{on && <Check size={12} />}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Access audit for this record */}
          <div className="border-t border-slate-100 dark:border-zinc-800 pt-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2"><Eye size={12} /> Access log</p>
            {accessLog.length === 0 ? (
              <p className="text-[11px] text-slate-400">No partner access yet.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {accessLog.slice(0, 20).map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                    <span className="truncate">{clinicName(l.accessedByClinicId)} · {l.action.toLowerCase()}</span>
                    <span className="shrink-0">{formatDate(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={save} disabled={saving} className="w-full py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Save sharing
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareWithClinics;

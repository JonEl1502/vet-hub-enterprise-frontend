import React, { useState, useEffect, useCallback } from 'react';
import { X, Home, Loader2, LogOut, Plus, Dog, ShieldCheck, ShieldAlert, Utensils, Footprints, Pill, ClipboardList } from 'lucide-react';
import { boardingAPI, BoardingStay } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  stayId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

const STOOL = ['normal', 'abnormal', 'none'];
const APPETITE = ['excellent', 'good', 'fair', 'poor', 'none'];

const daysBetween = (a: string, b?: string | null) => {
  const start = new Date(a).getTime();
  const end = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 86400000));
};

const BoardingStayDrawer: React.FC<Props> = ({ stayId, onClose, onChanged }) => {
  const [stay, setStay] = useState<BoardingStay | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // New daily-log draft
  const [log, setLog] = useState({ fedAm: false, fedPm: false, walked: false, medicationGiven: false, stool: '', appetite: '', notes: '' });

  const load = useCallback(async () => {
    if (!stayId) return;
    setLoading(true);
    try {
      const res = await boardingAPI.getById(stayId);
      if (res.success && res.data?.stay) setStay(res.data.stay);
    } catch (e) { console.error('Failed to load stay', e); }
    finally { setLoading(false); }
  }, [stayId]);

  useEffect(() => { setStay(null); if (stayId) load(); }, [stayId, load]);

  if (!stayId) return null;

  const saveLog = async () => {
    if (!stayId) return;
    setBusy(true);
    try {
      const res = await boardingAPI.addLog(stayId, {
        fedAm: log.fedAm, fedPm: log.fedPm, walked: log.walked, medicationGiven: log.medicationGiven,
        stool: log.stool || null, appetite: log.appetite || null, notes: log.notes || null,
      });
      if (res.success) {
        setLog({ fedAm: false, fedPm: false, walked: false, medicationGiven: false, stool: '', appetite: '', notes: '' });
        await load();
      }
    } finally { setBusy(false); }
  };

  const checkOut = async () => {
    if (!stayId) return;
    setBusy(true);
    try {
      const res = await boardingAPI.checkOut(stayId);
      if (res.success) { onChanged(); onClose(); }
    } finally { setBusy(false); }
  };

  const Toggle: React.FC<{ on: boolean; onClick: () => void; icon: React.ElementType; label: string }> = ({ on, onClick, icon: Icon, label }) => (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
      <Icon size={12} /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-pine to-pine/90 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Home size={20} className="text-seafoam shrink-0" />
            <div className="min-w-0">
              <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Boarding stay</p>
              <h2 className="text-lg font-black truncate flex items-center gap-2"><Dog size={16} /> {stay?.pet?.name ?? '…'}</h2>
              {stay && <p className="text-[10px] text-white/70">{stay.pet?.breed} · {stay.pet?.species} · Owner: {stay.client?.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
        </div>

        {loading && !stay ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
        ) : stay ? (
          <div className="p-5 space-y-5">
            {/* Stay facts */}
            <div className="grid grid-cols-2 gap-3">
              <Fact label="Status" value={stay.status === 'ADMITTED' ? `Day ${daysBetween(stay.dropOffAt) + 1}` : stay.status} />
              <Fact label="Kennel" value={stay.kennel || '—'} />
              <Fact label="Drop-off" value={formatDate(stay.dropOffAt)} />
              <Fact label="Expected pickup" value={stay.expectedPickupAt ? formatDate(stay.expectedPickupAt) : '—'} />
            </div>

            {/* Vaccine gate */}
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(stay.vaccineChecklist || {}).length === 0 ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400"><ShieldAlert size={12} /> No vaccine check recorded</span>
              ) : Object.entries(stay.vaccineChecklist).map(([k, v]) => (
                <span key={k} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${v ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'}`}>
                  {v ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />} {k}
                </span>
              ))}
            </div>

            {(stay.feedingInstructions || stay.medicationInstructions || stay.specialInstructions) && (
              <div className="space-y-2 text-xs">
                {stay.feedingInstructions && <Instr label="Feeding" value={stay.feedingInstructions} />}
                {stay.medicationInstructions && <Instr label="Medication" value={stay.medicationInstructions} />}
                {stay.specialInstructions && <Instr label="Special" value={stay.specialInstructions} />}
              </div>
            )}

            {/* Add daily log */}
            {stay.status === 'ADMITTED' && (
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5"><ClipboardList size={13} /> Log today's care</p>
                <div className="flex flex-wrap gap-2">
                  <Toggle on={log.fedAm} onClick={() => setLog(s => ({ ...s, fedAm: !s.fedAm }))} icon={Utensils} label="Fed AM" />
                  <Toggle on={log.fedPm} onClick={() => setLog(s => ({ ...s, fedPm: !s.fedPm }))} icon={Utensils} label="Fed PM" />
                  <Toggle on={log.walked} onClick={() => setLog(s => ({ ...s, walked: !s.walked }))} icon={Footprints} label="Walked" />
                  <Toggle on={log.medicationGiven} onClick={() => setLog(s => ({ ...s, medicationGiven: !s.medicationGiven }))} icon={Pill} label="Meds" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className="px-2 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" value={log.stool} onChange={e => setLog(s => ({ ...s, stool: e.target.value }))}>
                    <option value="">Stool…</option>{STOOL.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select className="px-2 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" value={log.appetite} onChange={e => setLog(s => ({ ...s, appetite: e.target.value }))}>
                    <option value="">Appetite…</option>{APPETITE.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <textarea className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100" rows={2} placeholder="Notes (e.g. bright and alert, vomited once)" value={log.notes} onChange={e => setLog(s => ({ ...s, notes: e.target.value }))} />
                <button onClick={saveLog} disabled={busy} className="w-full py-2 bg-seafoam text-white rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add log
                </button>
              </div>
            )}

            {/* Daily log history */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Care log</p>
              {stay.dailyLogs && stay.dailyLogs.length > 0 ? (
                <div className="space-y-2">
                  {stay.dailyLogs.map(l => (
                    <div key={l.id} className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-pine dark:text-zinc-200">{formatDate(l.logDate)}</span>
                        <div className="flex gap-1.5 text-[9px] font-bold">
                          {l.fedAm && <span className="text-emerald-600">AM</span>}
                          {l.fedPm && <span className="text-emerald-600">PM</span>}
                          {l.walked && <span className="text-seafoam">Walk</span>}
                          {l.medicationGiven && <span className="text-indigo-500">Med</span>}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {l.appetite && `Appetite: ${l.appetite}. `}{l.stool && `Stool: ${l.stool}. `}{l.notes}
                      </p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400 text-center py-4">No care logged yet.</p>}
            </div>

            {/* Check out */}
            {stay.status === 'ADMITTED' && (
              <button onClick={checkOut} disabled={busy} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                <LogOut size={15} /> Check out
              </button>
            )}
            {stay.status === 'CHECKED_OUT' && stay.actualPickupAt && (
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Checked out {formatDate(stay.actualPickupAt)}</p>
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-400">Stay not found.</div>
        )}
      </div>
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-xs font-bold text-pine dark:text-zinc-100 mt-0.5">{value}</p>
  </div>
);

const Instr: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <p><span className="font-black text-slate-400 uppercase text-[9px] tracking-widest mr-1.5">{label}:</span><span className="text-slate-600 dark:text-zinc-300">{value}</span></p>
);

export default BoardingStayDrawer;

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Truck, PackageCheck, Activity, Send, CornerDownLeft, Dot } from 'lucide-react';
import { visitJobsAPI } from '../../../services/modules/visitJobs.api';
import type { VisitJobEvent, MovementStage, MovementKind, MovementItemType } from '../../../services/modules/visitJobs.api';
import { toast } from '../../../services/utils/toast';

const STAGES: { key: MovementStage; label: string }[] = [
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'RESULT_SENT', label: 'Result sent' },
  { key: 'RETURNED', label: 'Returned' },
];
const ITEM_TYPES: MovementItemType[] = ['PATIENT', 'SAMPLE', 'DOCUMENT', 'IMAGE', 'OTHER'];
const KIND_LABEL: Record<string, string> = {
  DISPATCHED: 'Dispatched to provider', RECEIVED: 'Received by provider', IN_PROGRESS: 'Work started',
  RESULT_SENT: 'Result sent back', RETURNED: 'Returned / received back', NOTE: 'Note',
};

/**
 * Logistics timeline + next-step actions for one outsourced job. Shows where the
 * patient/sample/doc/image is (A→B→back) and lets the right clinic log the next
 * movement. `role` is 'provider' (incoming job) or 'requester' (outgoing job).
 */
const VisitJobTracker: React.FC<{ jobId: string; role: 'requester' | 'provider'; stage: MovementStage | null; onChanged?: () => void }> = ({ jobId, role, stage, onChanged }) => {
  const [events, setEvents] = useState<VisitJobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [itemType, setItemType] = useState<MovementItemType>('SAMPLE');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await visitJobsAPI.listMovements(jobId); if (r.success && r.data?.events) setEvents(r.data.events); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, [jobId]);
  useEffect(() => { load(); }, [load]);

  const log = async (kind: MovementKind, withItem = false) => {
    setBusy(true);
    try {
      const r = await visitJobsAPI.logMovement(jobId, { kind, itemType: withItem ? itemType : undefined, note: kind === 'NOTE' ? note.trim() : undefined });
      if (r.success) { toast.success(`${KIND_LABEL[kind] || 'Logged'}`); if (kind === 'NOTE') setNote(''); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to log'); } finally { setBusy(false); }
  };

  // The next movement this clinic can log, given the current stage.
  const next = (() => {
    if (role === 'requester') {
      if (!stage) return { kind: 'DISPATCHED' as MovementKind, label: 'Dispatch', icon: Truck, item: true };
      if (stage === 'RESULT_SENT') return { kind: 'RETURNED' as MovementKind, label: 'Mark returned', icon: CornerDownLeft, item: false };
    } else {
      if (stage === 'DISPATCHED') return { kind: 'RECEIVED' as MovementKind, label: 'Mark received', icon: PackageCheck, item: false };
      if (stage === 'RECEIVED') return { kind: 'IN_PROGRESS' as MovementKind, label: 'Start work', icon: Activity, item: false };
      if (stage === 'IN_PROGRESS') return { kind: 'RESULT_SENT' as MovementKind, label: 'Send result back', icon: Send, item: true };
    }
    return null;
  })();

  const stageIdx = stage ? STAGES.findIndex(s => s.key === stage) : -1;

  return (
    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
      {/* Stage stepper */}
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => (
          <React.Fragment key={s.key}>
            <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${i <= stageIdx ? 'bg-seafoam/15 text-seafoam' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>{s.label}</span>
            {i < STAGES.length - 1 && <span className={`h-px flex-1 ${i < stageIdx ? 'bg-seafoam/40' : 'bg-slate-200 dark:bg-zinc-700'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Next action */}
      {next && (
        <div className="flex flex-wrap items-center gap-2">
          {next.item && (
            <select value={itemType} onChange={e => setItemType(e.target.value as MovementItemType)}
              className="px-2 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam">
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
          )}
          <button onClick={() => log(next.kind, next.item)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <next.icon size={12} />} {next.label}
          </button>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-2"><Loader2 size={14} className="animate-spin text-seafoam" /></div>
      ) : events.length === 0 ? (
        <p className="text-[10px] text-slate-400">No movements logged yet.</p>
      ) : (
        <div className="space-y-1">
          {events.map(ev => (
            <div key={ev.id} className="flex items-start gap-1.5 text-[10px]">
              <Dot size={14} className="text-seafoam shrink-0 -mt-0.5" />
              <span className="text-pine dark:text-zinc-200">
                <span className="font-bold">{KIND_LABEL[ev.kind] || ev.kind}</span>
                {ev.itemType ? <span className="text-slate-400"> · {ev.itemType.toLowerCase()}</span> : ''}
                <span className="text-slate-400"> · {ev.actorClinic?.name || 'clinic'} · {new Date(ev.createdAt).toLocaleString()}</span>
                {ev.note ? <span className="block text-slate-500 italic">"{ev.note}"</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Free note */}
      <div className="flex items-center gap-2">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a tracking note…"
          className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
        <button onClick={() => log('NOTE')} disabled={busy || !note.trim()}
          className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-700 disabled:opacity-50">Log</button>
      </div>
    </div>
  );
};

export default VisitJobTracker;

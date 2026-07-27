/**
 * Farm call-out queue — requests raised by farm owners from their portal.
 *
 * Ordered by what a clinic actually triages on: open before closed, urgent
 * before routine. A request is never deleted, only moved through its lifecycle,
 * so the history of who asked for what stays intact.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Siren, CalendarClock, Check, X, Loader2, MapPin, Milk } from 'lucide-react';
import { livestockAPI, type FarmVisitRequest, type VisitRequestStatus } from '../../services/modules/livestock.api';
import { toast } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, EmptyState, Modal, Field, Card, fmtDate, fmtDateTime, dateInput } from './shared';

const URGENCY_TONE: Record<string, string> = {
  URGENT: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  SOON: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  ROUTINE: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300',
};

const STATUS_TONE: Record<string, string> = {
  REQUESTED: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  SCHEDULED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  CANCELLED: 'bg-slate-100 dark:bg-zinc-800 text-slate-500',
};

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: '', label: 'All' },
];

const FarmVisitsView: React.FC = () => {
  const [requests, setRequests] = useState<FarmVisitRequest[]>([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<FarmVisitRequest | null>(null);
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // "open" isn't a stored status — it's REQUESTED + SCHEDULED, which is what
      // a clinic means by their queue.
      const res = await livestockAPI.listVisitRequests(filter === 'open' ? undefined : filter || undefined);
      if (res.success && res.data?.requests) {
        const rows = filter === 'open'
          ? res.data.requests.filter((r) => r.status === 'REQUESTED' || r.status === 'SCHEDULED')
          : res.data.requests;
        const rank = { URGENT: 0, SOON: 1, ROUTINE: 2 } as Record<string, number>;
        setRequests([...rows].sort((a, b) => (rank[a.urgency] ?? 3) - (rank[b.urgency] ?? 3)));
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const patch = async (r: FarmVisitRequest, data: Partial<{ status: VisitRequestStatus; scheduledFor: string | null; clinicNotes: string | null }>) => {
    setBusyId(r.id);
    try {
      const res = await livestockAPI.updateVisitRequest(r.id, data);
      if (res.success && res.data?.request) {
        setRequests((prev) => prev.map((x) => (x.id === r.id ? res.data!.request : x)));
        toast.success('Updated');
      }
    } finally { setBusyId(null); }
  };

  const confirmSchedule = async () => {
    if (!scheduling) return;
    setSaving(true);
    try {
      const res = await livestockAPI.updateVisitRequest(scheduling.id, {
        status: 'SCHEDULED',
        scheduledFor: when || null,
        clinicNotes: notes || null,
      });
      if (res.success && res.data?.request) {
        setRequests((prev) => prev.map((x) => (x.id === scheduling.id ? res.data!.request : x)));
        toast.success('Visit scheduled');
        setScheduling(null); setWhen(''); setNotes('');
      }
    } finally { setSaving(false); }
  };

  return (
    <LivestockPage title="Farm Visits" subtitle="Call-out requests from farm owners" icon={Siren}>
      <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 self-start inline-flex">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              filter === f.id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm'
                              : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" message="Loading requests..." /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Siren} title="No call-out requests"
          hint="Farm owners raise these from their portal; they land here for you to schedule." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-800 dark:text-white truncate">{r.farmName}</p>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${URGENCY_TONE[r.urgency]}`}>
                      {r.urgency}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${STATUS_TONE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  {r.farmLocation && (
                    <p className="mt-0.5 text-[11px] text-slate-400 flex items-center gap-1"><MapPin size={11} /> {r.farmLocation}</p>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{fmtDateTime(r.createdAt)}</span>
              </div>

              <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{r.reason}</p>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                {r.animalGroupName && (
                  <span className="flex items-center gap-1">
                    <Milk size={11} /> {r.animalGroupName}
                    {r.headCount != null ? ` · ${r.headCount} head` : ''}
                  </span>
                )}
                {r.preferredDate && <span>Preferred {fmtDate(r.preferredDate)}</span>}
                {r.scheduledFor && <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Scheduled {fmtDateTime(r.scheduledFor)}</span>}
              </div>

              {r.clinicNotes && (
                <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2">
                  {r.clinicNotes}
                </p>
              )}

              {(r.status === 'REQUESTED' || r.status === 'SCHEDULED') && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-2">
                  {r.status === 'REQUESTED' && (
                    <button
                      onClick={() => { setScheduling(r); setWhen(dateInput(r.preferredDate)); setNotes(r.clinicNotes ?? ''); }}
                      className="px-3.5 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <CalendarClock size={12} /> Schedule
                    </button>
                  )}
                  <button
                    onClick={() => patch(r, { status: 'COMPLETED' })}
                    disabled={busyId === r.id}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {busyId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Done
                  </button>
                  <button
                    onClick={() => patch(r, { status: 'CANCELLED' })}
                    disabled={busyId === r.id}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-500 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {scheduling && (
        <Modal title={`Schedule visit — ${scheduling.farmName}`} onClose={() => setScheduling(null)}
          onSave={confirmSchedule} saving={saving} saveLabel="Schedule">
          <Field label="When">
            <input className="field-input" type="datetime-local" value={when}
              onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Note to the owner">
            <textarea className="field-textarea" rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dr Mwangi will come Tuesday morning — have the herd penned." />
          </Field>
        </Modal>
      )}
    </LivestockPage>
  );
};

export default FarmVisitsView;

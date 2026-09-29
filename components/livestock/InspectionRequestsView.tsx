/**
 * "Ask a vet to inspect" (313) — the marketplace buyer-request queue.
 *
 * ⚠️ Deliberately the SAME shape as `FarmVisitsView.tsx`'s call-out queue,
 * same shared primitives, same filter/card/action idiom (user, 2026-09-29:
 * practitioner and farmer workflows should go hand in hand, not carry
 * unrelated chrome). The one real difference: this queue has TWO other
 * parties, not one — the buyer who asked, and the seller whose animal it is —
 * both shown on every card, because a vet accepting the job needs to know who
 * they are actually calling.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Stethoscope, Check, X, Loader2, FileCheck } from 'lucide-react';
import { inspectionRequestAPI, type StaffInspectionRequest } from '../../services/modules/inspectionRequest.api';
import { toast } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, EmptyState, Modal, Field, Card, SegmentedFilter, FilterBar, fmtDate, fmtDateTime } from './shared';

const STATUS_TONE: Record<string, string> = {
  REQUESTED: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  ACKNOWLEDGED: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  ACCEPTED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  DECLINED: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  CANCELLED: 'bg-slate-100 dark:bg-zinc-800 text-slate-500',
};

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: '', label: 'All' },
];

const InspectionRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<StaffInspectionRequest[]>([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<StaffInspectionRequest | null>(null);
  const [report, setReport] = useState('');
  const [attach, setAttach] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionRequestAPI.list(filter === 'open' ? undefined : filter || undefined);
      if (res.success && res.data?.requests) {
        const rows = filter === 'open'
          ? res.data.requests.filter((r) => ['REQUESTED', 'ACKNOWLEDGED', 'ACCEPTED'].includes(r.status))
          : res.data.requests;
        setRequests(rows);
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (r: StaffInspectionRequest, fn: () => Promise<any>) => {
    setBusyId(r.id);
    try {
      const res = await fn();
      if (res.success && res.data?.request) {
        setRequests((prev) => prev.map((x) => (x.id === r.id ? res.data!.request : x)));
        toast.success('Updated');
      }
    } finally { setBusyId(null); }
  };

  const confirmComplete = async () => {
    if (!completing) return;
    if (!report.trim()) { toast.error('Write what you found'); return; }
    setSaving(true);
    try {
      const res = await inspectionRequestAPI.complete(completing.id, { report: report.trim(), attachToListing: attach });
      if (res.success && res.data?.request) {
        setRequests((prev) => prev.map((x) => (x.id === completing.id ? res.data!.request : x)));
        toast.success('Report submitted');
        setCompleting(null); setReport(''); setAttach(true);
      }
    } finally { setSaving(false); }
  };

  return (
    <LivestockPage title="Inspection requests" subtitle="Buyers on the marketplace asking for a pre-purchase check" icon={Stethoscope}>
      <FilterBar>
        <SegmentedFilter options={FILTERS} value={filter} onChange={setFilter} />
      </FilterBar>

      {loading ? (
        <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" message="Loading requests..." /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No inspection requests"
          hint="A marketplace buyer picks your clinic from the listing they're looking at — it lands here." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-800 dark:text-white truncate">{r.listingTitle}</p>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${STATUS_TONE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Asked by {r.buyerName} · seller {r.sellerName}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{fmtDateTime(r.createdAt)}</span>
              </div>

              {r.message && (
                <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{r.message}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                {r.preferredDate && <span>Preferred {fmtDate(r.preferredDate)}</span>}
                {r.scheduledAt && <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Scheduled {fmtDateTime(r.scheduledAt)}</span>}
              </div>

              {r.report && (
                <div className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <FileCheck size={12} className="shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap">{r.report}</span>
                </div>
              )}

              {['REQUESTED', 'ACKNOWLEDGED', 'ACCEPTED'].includes(r.status) && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-2">
                  {r.status !== 'ACCEPTED' && (
                    <button
                      onClick={() => act(r, () => inspectionRequestAPI.accept(r.id))}
                      disabled={busyId === r.id}
                      className="px-4 py-2.5 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {busyId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Accept
                    </button>
                  )}
                  {r.status === 'ACCEPTED' && (
                    <button
                      onClick={() => { setCompleting(r); setReport(''); setAttach(true); }}
                      className="px-4 py-2.5 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95 flex items-center gap-1.5 transition-all"
                    >
                      <FileCheck size={12} /> Submit report
                    </button>
                  )}
                  <button
                    onClick={() => act(r, () => inspectionRequestAPI.decline(r.id))}
                    disabled={busyId === r.id}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-500 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X size={12} /> Decline
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {completing && (
        <Modal title={`Submit report — ${completing.listingTitle}`} onClose={() => setCompleting(null)}
          onSave={confirmComplete} saving={saving} saveLabel="Submit">
          <Field label="What did you find?">
            <textarea className="field-textarea" rows={5} value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="Healthy, no signs of illness. Body condition good. No visible pregnancy." />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300 mt-2">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
            Show this report on the listing for other buyers
          </label>
        </Modal>
      )}
    </LivestockPage>
  );
};

export default InspectionRequestsView;

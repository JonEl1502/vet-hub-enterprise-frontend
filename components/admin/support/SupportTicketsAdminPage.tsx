import React, { useEffect, useState } from 'react';
import { LifeBuoy, RefreshCw, ExternalLink, CheckCircle2, Clock, Inbox, Wand2 } from 'lucide-react';
import {
  supportTicketsAPI,
  type SubscriptionTicket,
  type TicketStatus,
} from '../../../services/modules/supportTickets.api';
import {
  adminSubscriptionReportAPI,
  type AdminChannel,
} from '../../../services/modules/adminSubscriptionReport.api';
import { toast } from '../../../services';

const STATUSES: (TicketStatus | '')[] = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

const SupportTicketsAdminPage: React.FC = () => {
  const [tickets, setTickets] = useState<SubscriptionTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketStatus | ''>('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportTicketsAPI.adminList(filter || undefined);
      if (res.success && res.data) setTickets(res.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const update = async (t: SubscriptionTicket, status: TicketStatus) => {
    let adminNotes: string | undefined;
    if (status === 'RESOLVED') {
      const note = window.prompt('Resolution note for the clinic (optional):', t.adminNotes ?? '');
      if (note === null) return; // cancelled
      adminNotes = note || undefined;
    }
    setActingId(t.id);
    try {
      const res = await supportTicketsAPI.adminUpdate(t.id, { status, adminNotes });
      if (res.success) {
        toast.success(`Ticket marked ${status.replace('_', ' ').toLowerCase()}`);
        await load();
      }
    } finally {
      setActingId(null);
    }
  };

  // One-click: re-verify the linked attempt against its provider, and if it
  // settles SUCCESS, resolve the ticket too — support + reconciliation through
  // the same trusted path. Best-effort: the clinic-typed reference must match
  // the provider's attempt key, else fall back to the Payments page.
  const reconcileAndResolve = async (t: SubscriptionTicket) => {
    if (!t.provider || !t.attemptReference) return;
    setActingId(t.id);
    try {
      const res = await adminSubscriptionReportAPI.reconcile(t.provider as AdminChannel, t.attemptReference);
      if (!res.success || !res.data) return;
      if (!res.data.found) {
        toast.error("Couldn't match that reference to an attempt — resolve manually or use the Payments page.");
        return;
      }
      if (res.data.status === 'SUCCESS') {
        await supportTicketsAPI.adminUpdate(t.id, { status: 'RESOLVED', adminNotes: 'Auto-reconciled — payment confirmed.' });
        toast.success('Payment confirmed — ticket resolved.');
      } else {
        toast.error(`Provider says ${res.data.status}${res.data.reason ? ` (${res.data.reason})` : ''} — not resolving. Use Manual-activate if paid out-of-band.`);
      }
      await load();
    } finally {
      setActingId(null);
    }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase flex items-center gap-3">
            <LifeBuoy className="text-seafoam" size={32}/> Support Tickets
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Subscription &amp; payment issues raised by clinics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as TicketStatus | '')}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px] font-bold text-pine dark:text-zinc-100 outline-none"
          >
            {STATUSES.map((s) => <option key={s || 'all'} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>)}
          </select>
          <button onClick={load} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''}/> Refresh
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {tickets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 p-12 text-center text-slate-400 dark:text-zinc-500">
            <Inbox className="mx-auto mb-3" size={28}/>
            <p className="text-sm font-bold">{loading ? 'Loading…' : 'No tickets match this filter.'}</p>
          </div>
        )}

        {tickets.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-pine dark:text-zinc-100">{t.clinicName ?? `Clinic ${t.clinicId}`}</span>
                  <StatusPill status={t.status}/>
                  {t.provider && <Tag>{t.provider}</Tag>}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{fmtDate(t.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {t.status !== 'RESOLVED' && t.provider && t.attemptReference && (
                  <button
                    onClick={() => reconcileAndResolve(t)}
                    disabled={actingId === t.id}
                    title="Re-verify the linked payment and resolve if confirmed"
                    className="px-3 py-1.5 rounded-lg bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                  >
                    <Wand2 size={12}/> Reconcile &amp; resolve
                  </button>
                )}
                {t.status !== 'IN_PROGRESS' && t.status !== 'RESOLVED' && (
                  <button
                    onClick={() => update(t, 'IN_PROGRESS')}
                    disabled={actingId === t.id}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Clock size={12}/> In progress
                  </button>
                )}
                {t.status !== 'RESOLVED' && (
                  <button
                    onClick={() => update(t, 'RESOLVED')}
                    disabled={actingId === t.id}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={12}/> Resolve
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">{t.message}</p>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-500">
              {t.attemptReference && <span>Ref: <span className="font-mono">{t.attemptReference}</span></span>}
              {t.amount != null && <span>Amount: {t.currency ?? ''} {t.amount}</span>}
              {t.screenshotUrl && (
                <a href={t.screenshotUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-seafoam hover:text-pine font-bold">
                  <ExternalLink size={12}/> Payment screenshot
                </a>
              )}
            </div>

            {t.adminNotes && (
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500"><span className="font-bold">Note:</span> {t.adminNotes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">{children}</span>
);

const StatusPill: React.FC<{ status: TicketStatus }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
    status === 'RESOLVED'
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
      : status === 'IN_PROGRESS'
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
  }`}>{status.replace('_', ' ')}</span>
);

export default SupportTicketsAdminPage;

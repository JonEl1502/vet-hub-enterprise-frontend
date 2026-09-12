import React, { useEffect, useState } from 'react';
import { LifeBuoy, RefreshCw, ExternalLink, CheckCircle2, Clock, Inbox, Wand2, X, Loader2, BadgeCheck, ReceiptText } from 'lucide-react';
import {
  supportTicketsAPI,
  type SubscriptionTicket,
  type TicketStatus,
  type TicketKind,
} from '../../../services/modules/supportTickets.api';
import {
  adminSubscriptionReportAPI,
  type AdminChannel,
} from '../../../services/modules/adminSubscriptionReport.api';
import { toast, dialog } from '../../../services';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';
import RecordPaidSubscriptionDialog from '../subscriptions/RecordPaidSubscriptionDialog';

const STATUSES: (TicketStatus | '')[] = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

/**
 * The kinds this console can filter (226). Colours match the reporter's own
 * chips, so a bug looks like a bug on both sides of the wall.
 */
const KINDS: (TicketKind | '')[] = ['', 'BUG', 'PAYMENT', 'DATA', 'ACCESS', 'FEATURE', 'OTHER'];

const KIND_PILL: Record<string, string> = {
  BUG: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  PAYMENT: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  DATA: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  ACCESS: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  FEATURE: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  OTHER: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300',
};

/** Human labels for the context keys the reporter attaches. */
const CONTEXT_LABEL: Record<string, string> = {
  route: 'Page', viewport: 'Screen', userAgent: 'Browser', reportedAt: 'Reported',
};

const SupportTicketsAdminPage: React.FC = () => {
  const [tickets, setTickets] = useState<SubscriptionTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketStatus | ''>('');
  const [kindFilter, setKindFilter] = useState<TicketKind | ''>('');
  const [actingId, setActingId] = useState<string | null>(null);
  /** 303 — the ticket whose payment is being recorded by hand, if any. */
  const [grantTicket, setGrantTicket] = useState<SubscriptionTicket | null>(null);
  // Resolve flow uses a custom modal (not window.prompt) to capture the note.
  const [resolving, setResolving] = useState<SubscriptionTicket | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await supportTicketsAPI.adminList(filter || undefined, kindFilter || undefined);
      if (res.success && res.data) setTickets(res.data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, kindFilter]);

  const update = async (t: SubscriptionTicket, status: TicketStatus, adminNotes?: string) => {
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

  const confirmResolve = async () => {
    if (!resolving) return;
    const t = resolving;
    setResolving(null);
    await update(t, 'RESOLVED', resolveNote.trim() || undefined);
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
        toast.error(`Provider says ${res.data.status}${res.data.reason ? ` (${res.data.reason})` : ''} — not resolving. If the money really landed, use "Mark paid" on this ticket.`);
      }
      await load();
    } finally {
      setActingId(null);
    }
  };

  /**
   * The out-of-band override, for money that landed but the provider can't
   * confirm — which is exactly what "Reconcile & resolve" tells you to do next
   * when it comes back PENDING. It used to live ONLY on the Payments page, so
   * that instruction had no button behind it and admins fell back to plain
   * Resolve — which closes the ticket and leaves the payment PENDING, so the
   * clinic still sees the stuck-payment banner and raises another ticket.
   *
   * Offered even on a RESOLVED ticket: `manualActivate` is idempotent, and a
   * ticket closed without settling is precisely the state that needs it.
   */
  const markPaidAndResolve = async (t: SubscriptionTicket) => {
    if (!t.provider || !t.attemptReference) return;
    const ok = await dialog.confirm({
      title: 'Mark payment as received?',
      message:
        `Mark this payment as received and activate the subscription?\n\n`
        + `${t.provider} · ${t.attemptReference}\n\n`
        + `Use this ONLY when the money really landed but the provider can't confirm it. `
        + `It is recorded as a MANUAL activation against your admin account.`,
      confirmLabel: 'Mark paid',
      cancelLabel: 'Cancel',
      variant: 'warning',
    });
    if (!ok) return;
    setActingId(t.id);
    try {
      const res = await adminSubscriptionReportAPI.manualActivate(
        t.provider as AdminChannel,
        t.attemptReference,
        `Resolved via support ticket #${t.id}`,
      );
      if (res.success) {
        // The clinic's invoice list and the stuck-payment banner both read the
        // attempt's status, so settling it is what actually clears them.
        await supportTicketsAPI.adminUpdate(t.id, {
          status: 'RESOLVED',
          adminNotes: (t.adminNotes ? `${t.adminNotes}\n` : '') + 'Manually activated — payment confirmed out-of-band.',
        });
        toast.success('Payment marked received — subscription activated and invoice now shows paid.');
        await load();
      }
    } finally {
      setActingId(null);
    }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <AdminPage className="pb-20">
      <AdminPageHeader
        title="Support Tickets"
        subtitle="Bugs, payments, data and access issues raised by clinics and suppliers"
        icon={LifeBuoy}
        actions={
          <>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as TicketKind | '')}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px] font-bold text-pine dark:text-zinc-100 outline-none"
            >
              {KINDS.map((k) => <option key={k || 'all'} value={k}>{k || 'All kinds'}</option>)}
            </select>
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
          </>
        }
      />

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
                  {/* KIND FIRST — an admin scanning the queue needs to know
                      whether this is money or a broken screen before reading a
                      word of it. */}
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${KIND_PILL[t.kind ?? 'PAYMENT'] ?? KIND_PILL.OTHER}`}>
                    {t.kind ?? 'PAYMENT'}
                  </span>
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
                {/* Shown regardless of ticket status — a ticket resolved without
                    settling is the exact case this fixes. */}
                {t.provider && t.attemptReference && (
                  <button
                    onClick={() => markPaidAndResolve(t)}
                    disabled={actingId === t.id}
                    title="The money landed but the provider can't confirm it — activate manually and settle the invoice"
                    className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <BadgeCheck size={12}/> Mark paid
                  </button>
                )}
                {/* 303 — THE TICKET WITH NO ATTEMPT BEHIND IT.
                    "Mark paid" above needs `provider && attemptReference`, so a
                    clinic who paid M-Pesa straight to the till, or whose
                    checkout died before `initiate` ran, raised a ticket that had
                    NO settling action at all — an admin could only Resolve it,
                    which closes the ticket and leaves them with no subscription.
                    This records the payment properly and resolves in one go. */}
                {/* ⚠️ PAYMENT TICKETS ONLY (226). "Record payment" only needed
                    `!attemptReference`, which is true of every bug report ever
                    filed — it would have offered to grant a subscription on a
                    ticket about a broken button. */}
                {!t.attemptReference && (t.kind ?? 'PAYMENT') === 'PAYMENT' && (
                  <button
                    onClick={() => setGrantTicket(t)}
                    disabled={actingId === t.id}
                    title="No gateway attempt behind this ticket — record the payment from their evidence and activate"
                    className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <ReceiptText size={12}/> Record payment
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
                    onClick={() => { setResolving(t); setResolveNote(t.adminNotes ?? ''); }}
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
                  <ExternalLink size={12}/> {(t.kind ?? 'PAYMENT') === 'PAYMENT' ? 'Payment screenshot' : 'Screenshot'}
                </a>
              )}
            </div>

            {/* ── What they tagged, and where they were standing ─────────────
                Captured by the reporter rather than typed, so it is accurate:
                the exact route, the viewport and the browser. This is the half
                of a bug report that usually costs an email round-trip. */}
            {t.context && Object.keys(t.context).length > 0 && (
              <div className="mt-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 px-3 py-2 space-y-1">
                {Array.isArray((t.context as any).invoices) && (t.context as any).invoices.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tagged</span>
                    {(t.context as any).invoices.map((inv: any, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-seafoam/10 text-seafoam text-[10px] font-black">
                        {inv.number || `#${inv.id}`}
                        {inv.total != null && <span className="font-mono font-bold"> · {Number(inv.total).toLocaleString()}</span>}
                        {inv.status && <span className="opacity-70"> · {inv.status}</span>}
                      </span>
                    ))}
                  </div>
                )}
                {Object.entries(t.context as Record<string, any>)
                  .filter(([k, v]) => k !== 'invoices' && v != null && v !== '')
                  .map(([k, v]) => (
                    <p key={k} className="text-[10px] text-slate-500 dark:text-zinc-500 break-all">
                      <span className="font-black uppercase tracking-widest text-slate-400">{CONTEXT_LABEL[k] ?? k}:</span>{' '}
                      <span className="font-mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </p>
                  ))}
              </div>
            )}

            {t.adminNotes && (
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500"><span className="font-bold">Note:</span> {t.adminNotes}</p>
            )}
          </div>
        ))}
      </div>

      {resolving && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setResolving(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-pine dark:text-zinc-100 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600"/> Resolve ticket
              </h2>
              <button onClick={() => setResolving(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-3">
              {resolving.clinicName ?? `Clinic ${resolving.clinicId}`} will be emailed when this is resolved.
            </p>
            <label className="field-label">Resolution note (optional)</label>
            <textarea
              className="field-textarea"
              rows={4}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="e.g. Payment confirmed and subscription activated."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setResolving(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-bold">Cancel</button>
              <button
                onClick={confirmResolve}
                disabled={actingId === resolving.id}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {actingId === resolving.id ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} Resolve
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 303 — prefilled from the ticket, because the ticket IS the evidence:
          the amount, the reference they quoted and usually a screenshot of
          their own receipt. Retyping that is how a digit gets dropped into a
          revenue figure. Resolving is chained to a SUCCESSFUL record, so a
          refused grant (a duplicate reference, say) leaves the ticket open
          rather than closing it over a payment that was never recorded. */}
      {grantTicket && (
        <RecordPaidSubscriptionDialog
          ownerKind="CLINIC"
          ownerId={grantTicket.clinicId}
          ownerName={grantTicket.clinicName || `Clinic ${grantTicket.clinicId}`}
          prefill={{
            amount: grantTicket.amount,
            currency: grantTicket.currency,
            channel: grantTicket.provider,
            reference: grantTicket.attemptReference,
            reason: `Support ticket #${grantTicket.id}: ${grantTicket.message}`.slice(0, 400),
          }}
          onClose={() => setGrantTicket(null)}
          onGranted={async () => {
            const t = grantTicket;
            if (!t) return;
            await supportTicketsAPI.adminUpdate(t.id, {
              status: 'RESOLVED',
              adminNotes: (t.adminNotes ? `${t.adminNotes}\n` : '')
                + 'Payment recorded by hand from the evidence on this ticket — subscription activated.',
            });
            toast.success('Payment recorded and ticket resolved.');
            await load();
          }}
        />
      )}
    </AdminPage>
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

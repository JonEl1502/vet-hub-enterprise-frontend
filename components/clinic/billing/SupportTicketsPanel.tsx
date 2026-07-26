/**
 * Clinic-facing list of subscription/payment support tickets the clinic has
 * raised, with their triage status and the admin's resolution notes.
 *
 * Reads `supportTicketsAPI.listMine()` (GET /subscriptions/tickets) — the
 * endpoint already existed for the admin inbox counterpart; this is the
 * clinic side of it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  LifeBuoy, RefreshCw, CheckCircle2, Clock, Loader2, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { supportTicketsAPI, type SubscriptionTicket, type TicketStatus } from '../../../services/modules/supportTickets.api';
import { useDisplayCurrency } from '../../../contexts/DisplayCurrencyContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface SupportTicketsPanelProps {
  /** Bumping this refetches — the parent bumps it after a ticket is submitted. */
  refreshKey?: number;
  /** Opens the parent's ReportPaymentIssueModal. */
  onRaiseTicket: () => void;
}

const STATUS_STYLES: Record<TicketStatus, { badge: string; icon: React.ReactNode; label: string }> = {
  OPEN: {
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    icon: <Clock size={11} />,
    label: 'Open',
  },
  IN_PROGRESS: {
    badge: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    icon: <Loader2 size={11} />,
    label: 'In progress',
  },
  RESOLVED: {
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircle2 size={11} />,
    label: 'Resolved',
  },
};

const SupportTicketsPanel: React.FC<SupportTicketsPanelProps> = ({ refreshKey = 0, onRaiseTicket }) => {
  const { formatPrice } = useDisplayCurrency();
  const [tickets, setTickets] = useState<SubscriptionTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportTicketsAPI.listMine();
      if (res.success && res.data?.tickets) setTickets(res.data.tickets);
      else setError('Could not load your tickets.');
    } catch {
      setError('Could not load your tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets, refreshKey]);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <LoadingSpinner size="md" message="Loading tickets..." />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
          <LifeBuoy size={15} /> Raised tickets
          {tickets.length > 0 && (
            <span className="text-xs font-normal text-slate-400">· {tickets.length}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 transition-all"
            title="Refresh tickets"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onRaiseTicket}
            className="px-3 py-2 rounded-xl bg-pine text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-all"
          >
            <LifeBuoy size={14} /> Raise a ticket
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {!error && tickets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12 text-center">
          <LifeBuoy size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-zinc-300">No tickets raised</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">
            If a payment went through but isn't reflected on your plan, raise a ticket and our
            team will reconcile it for you.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map((t) => {
          const s = STATUS_STYLES[t.status] ?? STATUS_STYLES.OPEN;
          return (
            <article
              key={t.id}
              className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${s.badge}`}>
                    {s.icon} {s.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">#{t.id}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">{fmtDate(t.createdAt)}</span>
              </div>

              <p className="mt-3 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                {t.message}
              </p>

              {(t.provider || t.attemptReference || t.amount != null) && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px]">
                  {t.provider && (
                    <span className="text-slate-500 dark:text-zinc-400">
                      <span className="font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Channel </span>
                      {t.provider}
                    </span>
                  )}
                  {t.amount != null && (
                    <span className="text-slate-500 dark:text-zinc-400 font-mono">
                      <span className="font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 font-sans">Amount </span>
                      {formatPrice(t.amount, t.currency || 'KES')}
                    </span>
                  )}
                  {t.attemptReference && (
                    <span className="text-slate-500 dark:text-zinc-400 font-mono break-all">
                      <span className="font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 font-sans">Ref </span>
                      {t.attemptReference}
                    </span>
                  )}
                </div>
              )}

              {t.screenshotUrl && (
                <a
                  href={t.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-pine dark:text-seafoam hover:underline"
                >
                  <ExternalLink size={12} /> View payment proof
                </a>
              )}

              {t.adminNotes && (
                <div className="mt-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    Response from support
                  </p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                    {t.adminNotes}
                  </p>
                </div>
              )}

              {t.status === 'RESOLVED' && t.resolvedAt && (
                <p className="mt-3 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Resolved on {fmtDate(t.resolvedAt)}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default SupportTicketsPanel;

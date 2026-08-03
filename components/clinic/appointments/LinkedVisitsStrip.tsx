import React from 'react';
import { Link2, ArrowUpRight, ArrowDownRight, CalendarDays, Loader2, CheckCircle2 } from 'lucide-react';
import { visitsAPI } from '../../../services';
import { LinkedVisits, LinkedVisitRow } from '../../../services/modules/appointments.api';
import { formatTime } from '../../../services/utils/dateFormatter';

/**
 * Linked visits (backend 120) — the other visits this patient had today, and
 * how this one relates to them.
 *
 * Under the linked-visits model each encounter is its OWN visit with its OWN
 * bill, so a day can hold three. Without this strip that reads as three
 * unrelated bills and the front desk fields "why three invoices?" calls. Each
 * row therefore shows its own bill state — that separation IS the feature.
 */

interface Props {
  visitId: string | number;
  currency: string;
  onOpenVisit?: (id: number) => void;
  /** Bumped by the parent after creating a linked visit, to force a refresh. */
  refreshKey?: number;
}

const LINK_META: Record<string, { label: string; cls: string }> = {
  ESCALATION: { label: 'Escalated', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  TRANSFER: { label: 'Transferred', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  SAME_DAY: { label: 'Same day', cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400' },
};

const billChip = (row: LinkedVisitRow, currency: string) => {
  if (row.isPaid) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 size={9} /> Paid
      </span>
    );
  }
  if (!row.bill) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
        No bill yet
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      {String(row.bill.status).replace('_', ' ').toLowerCase()} · {currency} {Math.round(row.bill.total).toLocaleString()}
    </span>
  );
};

const LinkedVisitsStrip: React.FC<Props> = ({ visitId, currency, onOpenVisit, refreshKey = 0 }) => {
  const [data, setData] = React.useState<LinkedVisits | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    visitsAPI.getLinked(visitId, { silent: true } as any)
      .then(r => { if (alive && r.success && r.data) setData(r.data); })
      .catch(() => { /* strip just stays hidden */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visitId, refreshKey]);

  // Nothing linked → render nothing at all. A single-encounter visit should
  // look exactly as it always has.
  if (loading || !data || data.linked.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={14} className="text-seafoam" />
        <div className="min-w-0">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight">Linked visits</h3>
          <p className="text-[10px] font-bold text-slate-400">
            {data.linked.length} other visit{data.linked.length === 1 ? '' : 's'} for this patient — each bills separately
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.linked.map(row => {
          const meta = LINK_META[row.linkType] || LINK_META.SAME_DAY;
          const Dir = row.direction === 'ORIGIN' ? ArrowUpRight
            : row.direction === 'DESCENDANT' ? ArrowDownRight : CalendarDays;
          const dirTitle = row.direction === 'ORIGIN' ? 'This visit came out of that one'
            : row.direction === 'DESCENDANT' ? 'That visit came out of this one'
            : 'Same day, independent';
          return (
            <button
              key={row.id} type="button"
              onClick={() => onOpenVisit?.(Number(row.id))}
              className="w-full flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-seafoam transition-all text-left"
            >
              <span title={dirTitle} className="shrink-0 inline-flex"><Dir size={13} className="text-slate-400" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                  #{row.id} · {String(row.encounterType || 'Visit').replace('_', ' ').toLowerCase()}
                  {row.patient ? ` · ${row.patient.name}` : ''}
                </span>
                <span className="block text-[9px] font-bold text-slate-400 truncate">
                  {formatTime(row.date)}
                  {row.reason ? ` · ${row.reason}` : ''}
                </span>
              </span>
              <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${meta.cls}`}>
                {meta.label}
              </span>
              {billChip(row, currency)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LinkedVisitsStrip;

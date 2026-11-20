import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, ChevronDown, Info, Search, ArrowRight, Check } from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import Pagination from '../../shared/common/Pagination';
import type { OrgWarning, RecordPage } from '../../../services/modules/adminOrg.api';

/**
 * 326 — the pieces shared by the admin clinic and supplier pages, after the
 * SaloPlus organisation page: a switcher, figure tiles, a list of what is
 * wrong with a fix for each, and a searchable, paged table per record kind.
 */

export const money = (cur: string, v: number) => `${cur} ${Math.round(v || 0).toLocaleString()}`;
export const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const ago = (d?: string | null) => {
  if (!d) return 'Never';
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const dd = Math.round(h / 24);
  if (dd < 45) return `${dd} day${dd === 1 ? '' : 's'} ago`;
  return day(d);
};

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_2px_8px_rgb(15_23_42/0.04)] ${className}`}>{children}</div>
);

export const Pill: React.FC<{ tone: 'green' | 'red' | 'amber' | 'slate' | 'blue' | 'violet'; children: React.ReactNode }> = ({ tone, children }) => {
  const t = {
    green: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    slate: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    violet: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-[0.05em] whitespace-nowrap ${t}`}>{children}</span>;
};

export const statusTone = (s: string): 'green' | 'red' | 'amber' | 'slate' | 'blue' => {
  const v = String(s).toUpperCase();
  if (['PAID', 'COMPLETED', 'RECEIVED', 'DELIVERED', 'ACTIVE', 'DONE', 'CHECKED_OUT', 'CLOSED'].includes(v)) return 'green';
  if (['VOID', 'VOIDED', 'CANCELLED', 'CANCELED', 'REJECTED', 'NO_SHOW', 'FAILED', 'INACTIVE'].includes(v)) return 'red';
  if (['OPEN', 'PARTIAL', 'PENDING', 'PENDING_PAYMENT', 'DRAFT', 'SUBMITTED', 'ORDERED'].includes(v)) return 'amber';
  if (['IN_PROGRESS', 'CHECKED_IN', 'APPROVED', 'SHIPPED', 'SCHEDULED'].includes(v)) return 'blue';
  return 'slate';
};
export const statusLabel = (s: string) => String(s).replace(/_/g, ' ').toLowerCase();

// ─────────────────────────────── switcher ───────────────────────────────

export const OrgSwitcher: React.FC<{
  current: string;
  label: string;
  options: Array<{ id: string; name: string; hint?: string; isActive?: boolean }>;
  onPick: (id: string) => void;
}> = ({ current, label, options, onPick }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? options.filter((o) => o.name.toLowerCase().includes(s) || (o.hint ?? '').toLowerCase().includes(s)) : options).slice(0, 80);
  }, [q, options]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] font-semibold text-slate-600 dark:text-zinc-300 hover:border-seafoam/50 active:scale-[0.98] transition">
        Switch {label} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-80 max-w-[90vw] rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800">
              <Search size={14} className="text-slate-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${label}…`}
                className="flex-1 bg-transparent outline-none text-[14px] text-slate-700 dark:text-zinc-100" inputMode="search" autoComplete="off" />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto overscroll-contain py-1">
            {list.length === 0 && <p className="px-3 py-4 text-[13px] text-slate-400 text-center">No match</p>}
            {list.map((o) => (
              <button key={o.id} onClick={() => { setOpen(false); setQ(''); if (o.id !== current) onPick(o.id); }}
                className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 ${o.id === current ? 'bg-seafoam/[0.06]' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.isActive === false ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-700 dark:text-zinc-100 truncate">{o.name}</span>
                  {o.hint && <span className="block text-[11px] text-slate-400 truncate">{o.hint}</span>}
                </span>
                {o.id === current && <Check size={14} className="text-seafoam shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────── figures ───────────────────────────────

export interface Figure { label: string; value: React.ReactNode; hint?: string; onClick?: () => void }

export const FigureTiles: React.FC<{ figures: Figure[] }> = ({ figures }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
    {figures.map((f) => {
      const Tag: any = f.onClick ? 'button' : 'div';
      return (
        <Tag key={f.label} onClick={f.onClick}
          className={`text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-[0_2px_8px_rgb(15_23_42/0.04)] ${f.onClick ? 'hover:border-seafoam/50 active:scale-95 transition' : ''}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">{f.label}</p>
          <p className="mt-1 text-[20px] leading-tight font-semibold text-pine dark:text-zinc-100 tabular-nums truncate">{f.value}</p>
          {f.hint && <p className="text-[11px] text-slate-400 truncate mt-0.5">{f.hint}</p>}
        </Tag>
      );
    })}
  </div>
);

// ─────────────────────────────── warnings ───────────────────────────────

export const WarningsPanel: React.FC<{ warnings: OrgWarning[]; onAction: (a: NonNullable<OrgWarning['action']>) => void }> = ({ warnings, onAction }) => {
  if (warnings.length === 0) return null;
  const style = {
    error: { Icon: AlertOctagon, bar: 'bg-red-500', icon: 'text-red-500', wash: 'bg-red-500/[0.04]' },
    warning: { Icon: AlertTriangle, bar: 'bg-amber-500', icon: 'text-amber-500', wash: 'bg-amber-500/[0.04]' },
    info: { Icon: Info, bar: 'bg-blue-500', icon: 'text-blue-500', wash: '' },
  } as const;
  return (
    <Card className="overflow-hidden">
      <p className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">Needs attention · {warnings.length}</p>
      <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
        {warnings.map((w) => {
          const s = style[w.level];
          return (
            <li key={w.code} className={`relative flex flex-wrap items-center gap-3 pl-5 pr-4 py-3 ${s.wash}`}>
              <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${s.bar}`} />
              <s.Icon size={18} className={`${s.icon} shrink-0`} />
              <div className="flex-1 min-w-[200px]">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-zinc-100">{w.title}</p>
                <p className="text-[12px] text-slate-500 dark:text-zinc-400">{w.detail}</p>
              </div>
              {w.action && (
                <button onClick={() => onAction(w.action!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] font-semibold text-pine dark:text-zinc-100 hover:border-seafoam/50 active:scale-[0.98] transition">
                  {w.action.label} <ArrowRight size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

// ─────────────────────────────── tabs ───────────────────────────────

export const TabBar: React.FC<{ tabs: Array<{ id: string; label: string; count?: number | null }>; value: string; onChange: (id: string) => void }> = ({ tabs, value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-zinc-800 px-3">
    {tabs.map((t) => (
      <button key={t.id} onClick={() => onChange(t.id)}
        className={`relative shrink-0 px-3 py-3 text-[13px] font-semibold transition-colors ${value === t.id ? 'text-pine dark:text-zinc-100' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}>
        {t.label}
        {t.count != null && <span className="ml-1.5 text-[11px] font-medium text-slate-400 tabular-nums">{t.count.toLocaleString()}</span>}
        {value === t.id && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-seafoam" />}
      </button>
    ))}
  </div>
);

// ─────────────────────────────── records table ───────────────────────────────

export interface Column<T = any> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: 'right';
  /** Shown as the card title on phones. */
  primary?: boolean;
}

export const RecordsTable: React.FC<{
  load: (q: { page: number; search: string; status?: string }) => Promise<RecordPage>;
  columns: Column[];
  searchPlaceholder: string;
  empty: string;
  statusOptions?: Array<{ value: string; label: string }>;
  /** Changing it reloads from page 1 (e.g. switching org). */
  scopeKey: string;
  onRowClick?: (row: any) => void;
}> = ({ load, columns, searchPlaceholder, empty, statusOptions, scopeKey, onRowClick }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<RecordPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPage(1); setSearch(''); setTyped(''); setStatus(''); }, [scopeKey]);
  useEffect(() => {
    const t = setTimeout(() => { setSearch(typed.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [typed]);
  useEffect(() => {
    let alive = true;
    setBusy(true); setError(null);
    load({ page, search, status: status || undefined })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e?.message || 'Could not load.'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, scopeKey]);

  const meta = data && {
    currentPage: data.page,
    totalPages: Math.max(1, Math.ceil(data.total / data.pageSize)),
    totalItems: data.total,
    itemsPerPage: data.pageSize,
    hasNextPage: data.page * data.pageSize < data.total,
    hasPreviousPage: data.page > 1,
  };
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <Search size={14} className="text-slate-400" />
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={searchPlaceholder}
            className="flex-1 bg-transparent outline-none text-[16px] md:text-[13px] text-slate-700 dark:text-zinc-100" inputMode="search" autoComplete="off" />
        </div>
        {statusOptions && (
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[16px] md:text-[13px] font-semibold text-slate-600 dark:text-zinc-300">
            <option value="">All statuses</option>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {data && (
          <span className="text-[12px] text-slate-400 tabular-nums ml-auto">
            {data.total === 0 ? '0' : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.total, data.page * data.pageSize)}`} / {data.total.toLocaleString()}
          </span>
        )}
      </div>

      {busy && !data ? (
        <div className="py-12 flex justify-center"><LoadingSpinner size="md" /></div>
      ) : error ? (
        <p className="py-10 text-center text-[13px] text-red-500">{error}</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-slate-400">{search ? `Nothing matches “${search}”.` : empty}</p>
      ) : (
        <div className={busy ? 'opacity-60 transition-opacity' : ''}>
          {/* Desktop: a table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left border-y border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
                  {columns.map((c) => (
                    <th key={c.key} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={`border-b border-slate-50 dark:border-zinc-800/60 ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50' : ''}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-2.5 text-slate-600 dark:text-zinc-300 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c === primary ? 'font-semibold text-slate-800 dark:text-zinc-100' : ''}`}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phone: cards */}
          <div className="md:hidden space-y-2 px-3 pb-2">
            {data.rows.map((r) => (
              <div key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
                <p className="text-[14px] font-semibold text-slate-800 dark:text-zinc-100">{primary.render(r)}</p>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                  {rest.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">{c.label}</dt>
                      <dd className="text-[12px] text-slate-600 dark:text-zinc-300 truncate">{c.render(r)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          {meta && meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

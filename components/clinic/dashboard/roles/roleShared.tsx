import React from 'react';
import { Loader2 } from 'lucide-react';
import { Visit, ApptStatus } from '../../../../types';

/**
 * Shared furniture for the role dashboards (Front Office / Groomer / Vet).
 *
 * Every role view is built from these four pieces so the three pages read as
 * one product rather than three takes on a dashboard. Nothing here fetches —
 * the role views own their data and pass it down.
 */

/** Local YYYY-MM-DD. NEVER use toISOString() — it shifts a Nairobi evening into tomorrow. */
export const localDay = (d: Date | string = new Date()) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const isToday = (d?: string | Date | null) => !!d && localDay(d) === localDay();

/** Visits for today, cancelled excluded unless asked for. */
export const todaysVisits = (visits: Visit[] | undefined, includeCancelled = false) =>
  (visits || []).filter(v =>
    isToday(v.date) && (includeCancelled || v.status !== ApptStatus.CANCELLED));

/** Does any service line on the visit match these category keywords? */
export const hasCategory = (v: Visit, ...keys: string[]) =>
  (v.tasks || []).some((t: any) =>
    keys.some(k => String(t.category || '').toLowerCase().includes(k)));

// ── Stat tile ──────────────────────────────────────────────────────────────

export interface StatDef {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  onClick?: () => void;
}

const TONE: Record<string, string> = {
  default: 'text-pine dark:text-zinc-100',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
};

export const StatRow: React.FC<{ stats: StatDef[] }> = ({ stats }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
    {stats.map(s => {
      const Tag: any = s.onClick ? 'button' : 'div';
      return (
        <Tag
          key={s.label}
          {...(s.onClick ? { type: 'button', onClick: s.onClick } : {})}
          className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-left transition-all ${
            s.onClick ? 'hover:border-seafoam hover:shadow-sm cursor-pointer' : ''
          }`}
        >
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
          <p className={`text-2xl font-black leading-none tabular-nums ${TONE[s.tone || 'default']}`}>{s.value}</p>
          {s.sub != null && <p className="text-[9px] font-bold text-slate-400 mt-1.5">{s.sub}</p>}
        </Tag>
      );
    })}
  </div>
);

// ── Card shell ─────────────────────────────────────────────────────────────

export const RoleCard: React.FC<{
  title: string; subtitle?: string; action?: React.ReactNode;
  className?: string; children: React.ReactNode;
}> = ({ title, subtitle, action, className = '', children }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 ${className}`}>
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="min-w-0">
        <h3 className="text-sm font-black text-pine dark:text-zinc-100 tracking-tight truncate">{title}</h3>
        {subtitle && <p className="text-[10px] font-bold text-slate-400 truncate">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

export const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-700">
    {children}
  </p>
);

export const Spinner: React.FC = () => (
  <div className="py-10 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-seafoam" /></div>
);

// ── Queue column (waiting / in progress / completed) ───────────────────────

export const QueueColumn: React.FC<{
  title: string; count: number; tone: 'slate' | 'amber' | 'emerald';
  children: React.ReactNode;
}> = ({ title, count, tone, children }) => {
  const dot = tone === 'amber' ? 'bg-amber-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-slate-400';
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
          {title} ({count})
        </p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
};

/** One patient row inside a queue column. */
export const QueueRow: React.FC<{
  name: string; meta?: string; right?: React.ReactNode; onClick?: () => void;
}> = ({ name, meta, right, onClick }) => (
  <button
    type="button" onClick={onClick} disabled={!onClick}
    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40 text-left transition-all enabled:hover:border-seafoam enabled:hover:bg-white dark:enabled:hover:bg-zinc-900 disabled:cursor-default"
  >
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{name}</span>
      {meta && <span className="block text-[9px] font-bold text-slate-400 truncate">{meta}</span>}
    </span>
    {right}
  </button>
);

// ── Revenue-vs-goal bar ────────────────────────────────────────────────────

export const GoalBar: React.FC<{ value: number; goal: number; currency: string }> = ({ value, goal, currency }) => {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className="space-y-1">
      <p className="text-2xl font-black leading-none tabular-nums text-pine dark:text-zinc-100">
        {currency} {Math.round(value).toLocaleString()}
      </p>
      {goal > 0 && (
        <>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-seafoam transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[9px] font-bold text-slate-400">Goal {currency} {goal.toLocaleString()} · {pct}%</p>
        </>
      )}
    </div>
  );
};

// ── Simple local task checklist ────────────────────────────────────────────

/**
 * Per-role shift checklist. Deliberately localStorage-only and reset daily —
 * there is no tasks table, and inventing one to hold "sanitise the clippers"
 * would be the wrong call. Anything that must survive belongs in Reminders.
 */
export const useDayTasks = (roleKey: string, defaults: string[]) => {
  const storeKey = `vethub:daytasks:${roleKey}:${localDay()}`;
  const [done, setDone] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(storeKey) || '{}')); } catch { setDone({}); }
  }, [storeKey]);
  const toggle = (t: string) => {
    setDone(prev => {
      const next = { ...prev, [t]: !prev[t] };
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* quota — non-fatal */ }
      return next;
    });
  };
  return { tasks: defaults, done, toggle };
};

export const TaskChecklist: React.FC<{
  tasks: string[]; done: Record<string, boolean>; onToggle: (t: string) => void;
}> = ({ tasks, done, onToggle }) => (
  <div className="space-y-1">
    {tasks.map(t => (
      <label key={t} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-950/60 cursor-pointer select-none">
        <input
          type="checkbox" checked={!!done[t]} onChange={() => onToggle(t)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-seafoam focus:ring-seafoam shrink-0"
        />
        <span className={`text-[11px] font-bold ${done[t] ? 'text-slate-300 dark:text-zinc-600 line-through' : 'text-slate-600 dark:text-zinc-300'}`}>{t}</span>
      </label>
    ))}
  </div>
);

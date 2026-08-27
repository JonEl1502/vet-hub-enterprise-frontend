import React from 'react';
import type {
  HrContractType, HrEmploymentStatus, HrLeaveStatus, HrAttendanceStatus,
} from '../../../services/modules/hr.api';

/**
 * Shared HR primitives. Everything the four tabs would otherwise each
 * re-declare — status tone, date helpers, the empty state, the person chip.
 */

// ── Dates ───────────────────────────────────────────────────────────────────
/**
 * `YYYY-MM-DD` in the BROWSER's day, not UTC.
 *
 * ⚠️ `toISOString().slice(0,10)` is wrong here and was the first bug: at
 * UTC+3 (Nairobi) anything before 03:00 local is still yesterday in UTC, so
 * "today" on the attendance page would silently be the previous date. The
 * server stores DATE and normalises to UTC midnight; the browser must send
 * the day the user is actually looking at.
 */
export const isoDay = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const today = () => isoDay(new Date());

export const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return isoDay(dt);
};

/** Monday of the week containing `iso`. Rotas are read Monday-first. */
export const weekStart = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Sun=0 → 6
  dt.setDate(dt.getDate() - dow);
  return isoDay(dt);
};

export const prettyDate = (v: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
};

export const prettyTime = (v: string | null | undefined) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

/** Minutes → "7h 45m". Zero is "—" so a blank row does not read as a worked zero. */
export const hoursMins = (mins: number) => {
  if (!mins) return '—';
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
};

// ── Tone ────────────────────────────────────────────────────────────────────
const TONE = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rose:    'bg-rose-500/10 text-rose-500 border-rose-500/20',
  sky:     'bg-sky-500/10 text-sky-500 border-sky-500/20',
  violet:  'bg-violet-500/10 text-violet-500 border-violet-500/20',
  slate:   'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700',
};

export const EMPLOYMENT_TONE: Record<HrEmploymentStatus, keyof typeof TONE> = {
  ACTIVE: 'emerald', PROBATION: 'amber', SUSPENDED: 'rose',
  ON_NOTICE: 'amber', TERMINATED: 'slate', RESIGNED: 'slate',
};

export const LEAVE_TONE: Record<HrLeaveStatus, keyof typeof TONE> = {
  PENDING: 'amber', APPROVED: 'emerald', DECLINED: 'rose', CANCELLED: 'slate',
};

export const ATTENDANCE_TONE: Record<HrAttendanceStatus, keyof typeof TONE> = {
  PRESENT: 'emerald', LATE: 'amber', ABSENT: 'rose',
  HALF_DAY: 'sky', ON_LEAVE: 'violet', OFF_DUTY: 'slate',
};

export const CONTRACT_LABEL: Record<HrContractType, string> = {
  PERMANENT: 'Permanent', FIXED_TERM: 'Fixed term', LOCUM: 'Locum',
  CASUAL: 'Casual', INTERN: 'Intern', ATTACHMENT: 'Attachment',
};

export const titleCase = (s?: string | null) =>
  !s ? '—' : s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export const Pill: React.FC<{ tone?: keyof typeof TONE; children: React.ReactNode; className?: string }> =
  ({ tone = 'slate', children, className = '' }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-widest ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );

// ── Person ──────────────────────────────────────────────────────────────────
export const Avatar: React.FC<{ name: string; url?: string | null; size?: number }> = ({ name, url, size = 32 }) => {
  const initials = name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  return url
    ? <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : (
      <span
        className="rounded-full bg-seafoam/10 text-seafoam font-black flex items-center justify-center shrink-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
        {initials}
      </span>
    );
};

export const PersonChip: React.FC<{ name: string; url?: string | null; sub?: string | null }> = ({ name, url, sub }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <Avatar name={name} url={url} />
    <div className="min-w-0">
      <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{name}</p>
      {sub && <p className="text-[9px] font-bold text-slate-400 truncate">{sub}</p>}
    </div>
  </div>
);

// ── States ──────────────────────────────────────────────────────────────────
export const Empty: React.FC<{ icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode }> =
  ({ icon: Icon, title, hint, action }) => (
    <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
      <Icon size={26} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</p>
      {hint && <p className="mt-1 text-[10px] font-bold text-slate-400 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl ${className}`}>
    {children}
  </div>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: string; hint?: string }> =
  ({ label, value, tone = 'text-pine dark:text-zinc-100', hint }) => (
    <Card className="p-4">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[9px] font-bold text-slate-400">{hint}</p>}
    </Card>
  );

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> =
  ({ label, children, className = '' }) => (
    <div className={className}>
      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</label>
      {children}
    </div>
  );

export const INPUT = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
export const BTN = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40';
export const BTN_PRIMARY = `${BTN} bg-seafoam text-white hover:bg-seafoam/90`;
export const BTN_GHOST = `${BTN} bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700`;

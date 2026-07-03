// One source of truth for a visit's display status, so a visit shows the SAME
// status on its list card, its module record page, and the workflow header.
// Derives from the visit's task completion (+ finalized/paid state) rather than
// any single module-record field, which is what used to drift between pages.
import { Visit } from '../../../types';

export type DisplayStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

const done = (s: any) => String(s) === 'COMPLETED';
const inProg = (s: any) => String(s) === 'IN_PROGRESS';

/**
 * Derive the display status for a visit, optionally scoped to a module's tasks
 * (pass category keywords e.g. ['groom'] for the grooming page/list).
 * - finalized / paid visit  → COMPLETED
 * - all relevant tasks done  → COMPLETED
 * - some done / any WIP      → IN_PROGRESS
 * - otherwise                → SCHEDULED
 */
export function deriveVisitStatus(visit: Visit, categoryKeywords?: string[]): DisplayStatus {
  const s = String((visit as any).status);
  if ((visit as any).isPaid || s === 'COMPLETED' || s === 'PENDING_PAYMENT') return 'COMPLETED';
  const tasks: any[] = (visit as any).tasks || [];
  const relevant = categoryKeywords && categoryKeywords.length
    ? tasks.filter(t => categoryKeywords.some(k => String(t.category || '').toLowerCase().includes(k)))
    : tasks;
  if (relevant.length === 0) return s === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'SCHEDULED';
  const completed = relevant.filter(t => done(t.status)).length;
  if (completed === relevant.length) return 'COMPLETED';
  if (completed > 0 || relevant.some(t => inProg(t.status))) return 'IN_PROGRESS';
  return 'SCHEDULED';
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  SCHEDULED: 'Scheduled', IN_PROGRESS: 'In progress', COMPLETED: 'Completed',
};

export const STATUS_STYLE: Record<DisplayStatus, string> = {
  SCHEDULED: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
};

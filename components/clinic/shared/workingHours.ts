// Clinic per-weekday opening hours — set in Clinic Management (Billables tab)
// and read at visit registration to auto-flag after-hours arrivals.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  open: string;   // "HH:MM" 24h
  close: string;  // "HH:MM" 24h
  closed: boolean;
}

export type WorkingHours = Partial<Record<DayKey, DayHours>>;

// Monday-first display order.
export const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export const DAY_SHORT: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

// JS Date.getDay(): 0=Sun … 6=Sat.
const JS_DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Sensible starting point when a clinic first sets its hours.
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { open: '08:00', close: '18:00', closed: false },
  tue: { open: '08:00', close: '18:00', closed: false },
  wed: { open: '08:00', close: '18:00', closed: false },
  thu: { open: '08:00', close: '18:00', closed: false },
  fri: { open: '08:00', close: '18:00', closed: false },
  sat: { open: '09:00', close: '13:00', closed: false },
  sun: { open: '09:00', close: '13:00', closed: true },
};

function parseHM(hm: string | undefined): number | null {
  if (!hm || typeof hm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// True if the clinic has any usable hours configured.
export function hasWorkingHours(wh: WorkingHours | null | undefined): boolean {
  return !!wh && typeof wh === 'object' && DAY_ORDER.some(d => wh[d]);
}

/**
 * Decide whether a moment falls outside the clinic's opening hours.
 * Returns:
 *   true  → after-hours (day closed, or time outside the open/close window)
 *   false → within working hours
 *   null  → can't tell (no hours configured, or that day has no/invalid entry)
 * Callers treat `null` as "leave the manual switch alone".
 */
export function computeAfterHours(wh: WorkingHours | null | undefined, when: Date): boolean | null {
  if (!wh || typeof wh !== 'object') return null;
  const day = wh[JS_DAY_KEYS[when.getDay()]];
  if (!day) return null;
  if (day.closed) return true;
  const open = parseHM(day.open);
  const close = parseHM(day.close);
  if (open == null || close == null || close <= open) return null;
  const mins = when.getHours() * 60 + when.getMinutes();
  return mins < open || mins >= close;
}

// One-line summary of a day's hours for compact display.
export function describeDay(d: DayHours | undefined): string {
  if (!d) return '—';
  if (d.closed) return 'Closed';
  return `${d.open} – ${d.close}`;
}

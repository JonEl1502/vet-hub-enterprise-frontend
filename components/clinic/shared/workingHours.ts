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

// System default: 8am – 6pm, every day. Used both as the editor's starting
// point AND as the fallback when a clinic hasn't configured hours — so
// after-hours auto-detection works out of the box (clinics fine-tune per
// weekday in Clinic Management → Billables).
const DEFAULT_DAY: DayHours = { open: '08:00', close: '18:00', closed: false };
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { ...DEFAULT_DAY },
  tue: { ...DEFAULT_DAY },
  wed: { ...DEFAULT_DAY },
  thu: { ...DEFAULT_DAY },
  fri: { ...DEFAULT_DAY },
  sat: { ...DEFAULT_DAY },
  sun: { ...DEFAULT_DAY },
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
 * When the clinic has no hours configured (or that day has no entry), the
 * system default 8am–6pm applies — so auto-detection works out of the box.
 * Returns:
 *   true  → after-hours (day closed, or time outside the open/close window)
 *   false → within working hours
 *   null  → can't tell (invalid open/close entry only)
 * Callers treat `null` as "leave the manual switch alone".
 */
export function computeAfterHours(wh: WorkingHours | null | undefined, when: Date): boolean | null {
  const key = JS_DAY_KEYS[when.getDay()];
  const day = (wh && typeof wh === 'object' ? wh[key] : undefined) ?? DEFAULT_WORKING_HOURS[key];
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

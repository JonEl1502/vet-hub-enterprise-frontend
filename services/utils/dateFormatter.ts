/**
 * Centralized date formatting utility
 * Ensures consistent date display across the application in EAT (Africa/Nairobi, GMT+3)
 */

const TZ = 'Africa/Nairobi';

export const formatDate = (
  dateInput?: string | Date | number | null,
  locale: string = 'en-GB'
): string => {
  if (dateInput === null || dateInput === undefined)
    return 'N/A';

  const date =
    dateInput instanceof Date
      ? dateInput
      : new Date(dateInput);

  if (isNaN(date.getTime()))
    return 'N/A';

  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ,
  });
};


export const formatTime = (dateInput: string | Date | number, locale: string = 'en-GB'): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid time';
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: TZ,
    });
  } catch {
    return 'Invalid time';
  }
};

export const formatDateTime = (dateInput: string | Date | number, locale: string = 'en-GB'): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid datetime';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: TZ,
    });
  } catch {
    return 'Invalid datetime';
  }
};

export const formatDateCompact = (dateInput: string | Date | number, locale: string = 'en-GB'): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: TZ,
    });
  } catch {
    return 'Invalid date';
  }
};

// Calendar-day difference in EAT — boarding/inpatient bill per DATE crossed
// (check-in date → check-out date), not per elapsed-24h block, so in on the
// 7th / out on the 9th is always 2 days whatever the drop-off/pickup times.
// Nairobi has no DST, so a fixed +3h offset is exact. Mirrors the backend's
// computeNights (stayBilling.ts) — keep the two in step.
export const calendarDaysBetween = (
  start: string | Date,
  end: string | Date = new Date()
): number => {
  const dayIdx = (d: string | Date) =>
    Math.floor((new Date(d).getTime() + 3 * 3_600_000) / 86_400_000);
  return dayIdx(end) - dayIdx(start);
};

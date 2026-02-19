/**
 * Centralized date formatting utility
 * Ensures consistent date display across the application
 */

export const formatDate = (
  dateInput?: string | Date | number | null,
  locale: string = 'en-US'
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
  });
};


export const formatTime = (dateInput: string | Date | number, locale: string = 'en-US'): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid time';
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Invalid time';
  }
};

export const formatDateTime = (dateInput: string | Date | number, locale: string = 'en-US'): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid datetime';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Invalid datetime';
  }
};

export const formatDateCompact = (dateInput: string | Date | number, locale: string = 'en-US'): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};

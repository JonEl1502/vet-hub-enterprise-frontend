// Small shared helpers for the pet-owner portal views.

export const speciesEmoji = (s: string) => {
  const k = (s || '').toLowerCase();
  if (k.includes('dog')) return '🐕';
  if (k.includes('cat')) return '🐈';
  if (k.includes('bird')) return '🦜';
  if (k.includes('rabbit')) return '🐇';
  return '🐾';
};

// "2y 3m" style age from a date-of-birth string.
export const petAge = (dob?: string | null) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return m === 0 ? 'newborn' : `${m}m`;
  return m === 0 ? `${y}y` : `${y}y ${m}m`;
};

export const REMINDER_TYPE_META: Record<string, { label: string; emoji: string }> = {
  VACCINATION: { label: 'Vaccination', emoji: '💉' },
  DEWORMING: { label: 'Deworming', emoji: '💊' },
  GROOMING: { label: 'Grooming', emoji: '✂️' },
  FOLLOW_UP: { label: 'Follow-up', emoji: '🔁' },
  MEDICATION: { label: 'Medication', emoji: '💊' },
  FEEDING: { label: 'Feeding', emoji: '🍖' },
  CHECKUP: { label: 'Check-up', emoji: '🩺' },
  OTHER: { label: 'Reminder', emoji: '🔔' },
};

export const reminderMeta = (serviceType: string) => REMINDER_TYPE_META[serviceType] || REMINDER_TYPE_META.OTHER;

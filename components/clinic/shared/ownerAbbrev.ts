// "(J.K. Lusisa)" — initials of the first (up to two) names + surname, shown
// next to a selected patient so staff confirm they have the right client/pet.
export const ownerAbbrev = (name?: string | null): string => {
  if (!name) return '';
  const parts = name.replace(/^(mr|mrs|ms|miss|dr|prof|rev|hon)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return `(${parts[0]})`;
  const surname = parts[parts.length - 1];
  const initials = parts.slice(0, -1).slice(0, 2).map(p => `${p[0].toUpperCase()}.`).join('');
  return `(${initials} ${surname})`;
};

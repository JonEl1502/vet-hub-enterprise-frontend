/**
 * How a patient's SEX reads on screen.
 *
 * Sex is clinical, not decorative — dose, pregnancy risk and half the
 * differentials turn on it, so it belongs on the visit header rather than one
 * click away in the profile (user, 2026-09-12).
 *
 * Neuter status rides with it when it is known, because "Female" and "Female,
 * spayed" are different patients: a spayed female cannot be pregnant, and
 * pyometra leaves the differential list the moment the uterus does. `null` /
 * `undefined` means NOBODY HAS RECORDED IT, which is not the same as "entire" —
 * so nothing is shown rather than implying an answer we do not have.
 */
export const petSexLabel = (
  pet?: { gender?: string | null; isNeutered?: boolean | null } | null,
): string => {
  const g = String(pet?.gender ?? '').trim();
  if (!g) return '';
  const sex = g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
  if (pet?.isNeutered !== true) return sex;
  // The correct word differs by sex, and using the wrong one reads as a
  // mistake to anyone clinical.
  return sex === 'Female' ? 'Female, spayed' : 'Male, neutered';
};

/**
 * The one-line "breed • species • sex • age" caption used wherever a pet is
 * named in a list or card. Was hand-duplicated three times with only the
 * separator differing (`PetsView.tsx`, `VisitReadOnlyView.tsx`,
 * `VisitDetailView.tsx`'s visit header) before this existed — now the single
 * place that join lives, so every list gets the full picture (breed, species,
 * sex, age) with one import instead of each surface picking its own subset
 * (user, 2026-09-19: "anywhere a pet is shown... show the gender and the
 * species. And the species and the breed too").
 */
export const petMetaLine = (
  pet?: { breed?: string | null; species?: string | null; gender?: string | null; isNeutered?: boolean | null; age?: string | number | null } | null,
  separator = ' • ',
): string => {
  return [pet?.breed, pet?.species, petSexLabel(pet), pet?.age]
    .filter((v) => v != null && String(v).trim() !== '')
    .join(separator);
};

export default petSexLabel;

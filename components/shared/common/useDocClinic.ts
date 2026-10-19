import { useClinic } from '../../../contexts/ClinicContext';
import { DocClinic, toDocClinic } from './DocumentChrome';

/**
 * The clinic a document should wear, for the callers that were only ever handed
 * a clinic NAME and logo (the receipt is mounted from the visit page, the
 * client's profile and the client's payments tab; none of them holds the
 * clinic's address, colour or public slug).
 *
 * Resolution order: explicit id → exact name → the clinic currently selected →
 * the first one. Name matching is a fallback for those callers; prefer an id.
 * Whatever the caller DID pass (`name`, `logo`) wins over the context's copy, so
 * a document never changes the name it was already printing.
 */
export const useDocClinic = (hint: { id?: string | number | null; name?: string | null; logo?: string | null } = {}): DocClinic => {
  const { clinics, selectedClinics } = useClinic();
  const byId = hint.id != null ? clinics.find((c) => String(c.id) === String(hint.id)) : undefined;
  const byName = !byId && hint.name ? clinics.find((c) => c.name === hint.name) : undefined;
  const found = byId ?? byName ?? selectedClinics?.[0] ?? clinics[0];
  const doc = toDocClinic(found);
  return {
    ...doc,
    name: hint.name || doc.name,
    logo: hint.logo ?? doc.logo,
  };
};

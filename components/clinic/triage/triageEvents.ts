/**
 * Triage change broadcast.
 *
 * The clinic-wide Amber Alert bar lives outside the visit tree, so it can't be
 * told through props that a patient just left triage. Polling alone meant the
 * bar could keep claiming "1 patient in emergency triage" for up to its whole
 * interval after the vet had already stabilised them — the alert outliving the
 * emergency, which is exactly what makes people stop trusting it.
 *
 * A window event is enough: no shared state, no provider to thread through, and
 * anything that cares can subscribe. The poll stays as the backstop for changes
 * made in another tab or by someone else.
 */
export const TRIAGE_CHANGED_EVENT = 'vethub:triage-changed';

/** Call after any write that can move a patient in or out of triage. */
export function notifyTriageChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TRIAGE_CHANGED_EVENT));
}

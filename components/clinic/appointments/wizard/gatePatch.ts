/**
 * Merge a patch from `GateCheckForm` into the host's gate data.
 *
 * ⚠️ `GateCheckForm` hands its host a patch that is EITHER an object OR an
 * updater function (`prev => patch`). The boarding / grooming intake sends the
 * function form on purpose: `AdmissionGate` fires two prefills (weight, then
 * vaccines) in one commit, and an object built from the render-time value made
 * the second overwrite the first (user, 2026-08-06). The wizard's own `setData`
 * resolves updater functions; the two Create Visit screens that host the form
 * outside the wizard used `{ ...d, ...patch }`, and spreading a function adds
 * nothing — so every click on the grooming and boarding gate check did nothing.
 *
 * Any host that keeps gate data in its own state must merge through this.
 */
export const mergeGatePatch = (prev: any, patch: any) => ({
  ...prev,
  ...(typeof patch === 'function' ? patch(prev) : patch),
});

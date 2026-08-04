/**
 * Which sidebar entry a DETAIL view belongs to.
 *
 * The sidebar highlights by `activeView === item.id`. Detail pages have their
 * own view ids — `boarding-stay`, `client-profile`, `surgery-record` — that
 * match no menu entry, so opening one un-highlighted the whole sidebar: you
 * were deep inside Boarding with nothing in the nav saying so, and a collapsed
 * group (Medical, Patients & Clients, Finance…) stayed shut over the very page
 * you were on (user, 2026-08-04: "keep related menu in sidebar even in detail
 * pages or other in pgs").
 *
 * Mapping a detail view to its parent fixes both at once: the entry lights up,
 * and `hasActiveChild` opens the group that owns it.
 *
 * ⚠️ Values must be menu **item ids** from `menus.ts` — a sub-item id is fine
 * (the group opens via `hasActiveChild`), an invented id silently does nothing.
 * When you add a detail page, add it here too; there is no runtime check that
 * would tell you it is missing.
 */
export const NAV_PARENT: Record<string, string> = {
  // Patients & Clients
  'pet-profile': 'patients',
  'register-pet': 'patients',
  'client-profile': 'clients',
  'edit-client': 'clients',
  'register-client': 'clients',

  // Visits & scheduling
  'appointment-detail': 'appointments',
  'view-appointment': 'appointments',
  'new-appointment': 'appointments',

  // Module records — each opens from, and belongs to, its module list
  'boarding-stay': 'boarding',
  'inpatient-chart': 'inpatient',
  'surgery-record': 'surgery',
  'vaccinations': 'vaccine-packages',

  // Inventory, catalogue & procurement
  'procedure-editor': 'procedures',
  'workflow-builder': 'workflows',
  'purchase-order-detail': 'purchase-orders',
  'purchase-order-form': 'purchase-orders',
  'supplier-detail': 'suppliers',

  // Partners
  'handshake-detail': 'referrals',
  'create-partnership': 'referrals',

  // Finance
  'financial-core': 'reports-analytics',
  'financial-overview': 'reports-analytics',
  'payment-processing': 'transactions',

  // Staff
  'staff-profile': 'staff',
  'staff-edit': 'staff',
  'staff-new': 'staff',
};

/** The menu id that should look active for `view`. Identity when it IS one. */
export const navViewFor = (view: string): string => NAV_PARENT[view] ?? view;

// ─────────────────────────────────────────────────────────────────────────────
// GROUPED MODULE PERMISSIONS  —  "access the page" + [create · edit · delete]
// ─────────────────────────────────────────────────────────────────────────────
//
// The permission model an owner can actually reason about (user, 2026-08-04):
// a permission is a PAGE plus what you may DO on it, named the way the sidebar
// names it.
//
//     products:view      ← access the page   (gates sidebar + route)
//     products:create    ← action
//     products:edit      ← action
//     products:delete    ← action
//     products:stock     ← module-specific action (receive / adjust / transfer)
//
// Three rules make this hold together:
//   1. `:view` IS the page grant. There is no second list of page tokens.
//   2. Any action grant IMPLIES `:view` — nobody gets "create" on a page they
//      cannot open. Enforced in `can()`, not just ticked in the editor.
//   3. Role presets are written in this same vocabulary, so a preset is a list
//      of these ids rather than a parallel concept.
//
// WHY A MODULE ID AND NOT THE MENU ENTRY: the sidebar is a navigation surface
// and its labels/grouping change (this group has been relabelled twice). Grants
// are stored on the user, so they key off a STABLE module id. One page can also
// span several API resources — `packages` covers vaccine packages AND service
// bundles — which a menu-derived catalog could not express.
//
// This pass covers the **Inventory & Billables** group only. Other groups keep
// the legacy catalog (`constants/permissions.ts`) until they are migrated; the
// two coexist, and `LEGACY_GRANT_MAP` below makes sure a user holding an old
// grant keeps exactly what they had.

import { UserRole, FULL_ACCESS_ROLES } from '../types';

export type ModuleActionId = 'view' | 'create' | 'edit' | 'delete' | 'stock';

export interface ModuleActionDef {
  id: ModuleActionId;
  label: string;
  /** Shown under the checkbox in the editor when the action needs explaining. */
  hint?: string;
}

export interface ModuleDef {
  /** Stable id — stored in `customPermissions`. Never rename. */
  id: string;
  /** Matches the sidebar entry this module gates. */
  label: string;
  /** Sidebar group, used to lay the editor out the way the nav reads. */
  group: string;
  /** App.tsx view ids this module's `:view` grant gates. */
  views: string[];
  actions: ModuleActionDef[];
  /** One line in the editor saying what the page is. */
  hint?: string;
}

const CRUD: ModuleActionDef[] = [
  { id: 'view',   label: 'Access page' },
  { id: 'create', label: 'Create' },
  { id: 'edit',   label: 'Edit' },
  { id: 'delete', label: 'Delete' },
];

export const INVENTORY_BILLABLES_GROUP = 'Inventory & Billables';

export const PERMISSION_MODULES: ModuleDef[] = [
  {
    id: 'products',
    label: 'Products',
    group: INVENTORY_BILLABLES_GROUP,
    hint: 'Stock Manager — the items the clinic holds and sells',
    views: ['inventory'],
    actions: [
      ...CRUD,
      {
        id: 'stock',
        label: 'Receive & move stock',
        hint: 'Receive deliveries, adjust counts, stock takes and transfers — without being able to edit the item itself',
      },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    group: INVENTORY_BILLABLES_GROUP,
    hint: 'The service catalog and this clinic\'s price overrides',
    views: ['services-catalog'],
    actions: CRUD,
  },
  {
    id: 'procedures',
    label: 'Procedures',
    group: INVENTORY_BILLABLES_GROUP,
    hint: 'Procedure recipes — what a named procedure bills and consumes',
    views: ['procedures', 'procedure-editor'],
    actions: CRUD,
  },
  {
    id: 'billables',
    label: 'Billables',
    group: INVENTORY_BILLABLES_GROUP,
    hint: 'Daily rates and emergency billables (Clinic Settings → Billables)',
    views: ['clinic-billables', 'bills'],
    actions: CRUD,
  },
  {
    id: 'workflows',
    label: 'Visit Workflows',
    group: INVENTORY_BILLABLES_GROUP,
    hint: 'The visit form templates staff fill in — building one changes every visit that uses it',
    views: ['workflows', 'workflow-builder'],
    actions: CRUD,
  },
  {
    id: 'packages',
    label: 'Packages',
    group: INVENTORY_BILLABLES_GROUP,
    hint: 'Vaccine packages and service bundles',
    views: ['packages', 'vaccine-packages', 'service-bundles'],
    actions: CRUD,
  },
];

export const MODULE_BY_ID: Record<string, ModuleDef> =
  Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, m]));

/** Every grant id this catalog defines, e.g. `procedures:create`. */
export const ALL_MODULE_GRANTS: string[] = PERMISSION_MODULES.flatMap(m =>
  m.actions.map(a => `${m.id}:${a.id}`));

/** view id → module id, for `canAccess` in App.tsx and the sidebar. */
export const VIEW_TO_MODULE: Record<string, string> =
  Object.fromEntries(PERMISSION_MODULES.flatMap(m => m.views.map(v => [v, m.id])));

// ── Legacy grants ────────────────────────────────────────────────────────────
//
// A user granted "Edit Inventory" before this catalog existed must not wake up
// with less access. Old grant id → the new ids it stands for. Read-only bridge:
// nothing writes these any more, and the editor saves the new ids.

export const LEGACY_GRANT_MAP: Record<string, string[]> = {
  view_inventory:         ['products:view'],
  create_inventory:       ['products:create'],
  edit_inventory:         ['products:edit', 'products:stock'],
  delete_inventory:       ['products:delete'],
  manage_purchase_orders: ['products:stock'],
  // "Manage Categories & Services" was the one grant that covered everything a
  // clinic sells, so it maps across the catalog side of this group.
  manage_categories: [
    'services:create', 'services:edit', 'services:delete',
    'procedures:create', 'procedures:edit', 'procedures:delete',
    'packages:create', 'packages:edit', 'packages:delete',
    'billables:edit',
  ],
  // Coarse page token from `constants/roles.ts`.
  VIEW_INVENTORY: ['products:view'],
};

// ── Role presets ─────────────────────────────────────────────────────────────
//
// DELIBERATELY GENEROUS ON `view`, STRICT ON WRITES. Every one of these pages
// is open to every clinic user today (App.tsx `canAccess` returns true for the
// lot, and procedures / packages / stock takes have no server gate at all), so
// a preset that removed page access would take away something people use. What
// changes is WRITING: creating a procedure or deleting a product is now a
// grantable action rather than something anyone signed in can do.
//
// Full-access roles (owner / manager / platform admin) short-circuit in `can()`
// and are not listed here.

const VIEW_ALL: string[] = PERMISSION_MODULES.map(m => `${m.id}:view`);
const writes = (moduleId: string, ...actions: ModuleActionId[]) =>
  actions.map(a => `${moduleId}:${a}`);

export const MODULE_ROLE_PRESETS: Partial<Record<UserRole, string[]>> = {
  // Clinical leads shape what the clinic sells and how a visit is recorded.
  [UserRole.VET]: [
    ...VIEW_ALL,
    ...writes('products', 'create', 'edit', 'stock'),
    ...writes('services', 'create', 'edit'),
    ...writes('procedures', 'create', 'edit', 'delete'),
    ...writes('workflows', 'create', 'edit'),
    ...writes('packages', 'create', 'edit'),
  ],
  [UserRole.VET_NURSE]: [...VIEW_ALL, ...writes('products', 'stock')],
  [UserRole.LAB_TECH]:  [...VIEW_ALL, ...writes('products', 'stock')],
  // Dispensary owns the shelf: items and their movements, and what a package
  // contains — but not the service catalog or the visit workflow.
  [UserRole.PHARMACIST]: [
    ...VIEW_ALL,
    ...writes('products', 'create', 'edit', 'delete', 'stock'),
    ...writes('packages', 'create', 'edit'),
  ],
  // Front desk and money roles read prices; they do not shape the catalog.
  [UserRole.FRONT_OFFICE]: VIEW_ALL,
  [UserRole.RECEPTIONIST]: VIEW_ALL,
  [UserRole.CASHIER]:      VIEW_ALL,
  [UserRole.ACCOUNTANT]:   VIEW_ALL,
  [UserRole.GROOMER]:      VIEW_ALL,
  [UserRole.KENNEL_ATTENDANT]: [...VIEW_ALL, ...writes('products', 'stock')],
  [UserRole.DRIVER]:       VIEW_ALL,
  [UserRole.CLINIC_VIEWER]: VIEW_ALL,
  [UserRole.FREELANCER]:   VIEW_ALL,
  // General staff keep the stock work they do today; catalog writes become a
  // grant. `requireRole` treats every designation above as STAFF server-side,
  // which is exactly why the presets have to be explicit here.
  [UserRole.STAFF]: [...VIEW_ALL, ...writes('products', 'create', 'edit', 'stock')],
};

// ── Runtime gate ─────────────────────────────────────────────────────────────

interface GateUser {
  role?: string;
  customPermissions?: string[] | null;
}

/**
 * A `-` prefix DENIES: `-products:create` takes the action away from someone
 * whose role preset grants it.
 *
 * The old catalog could only add — `togglePermission` in the staff editor
 * literally gives up ("we need to track removed permissions differently") and
 * silently refuses to untick a role default. An owner who wants the front desk
 * to stop deleting products has to be able to say so, so denials are stored
 * alongside grants and applied last.
 */
export const DENY_PREFIX = '-';
export const denyOf = (grant: string) => `${DENY_PREFIX}${grant}`;

/** Expand a user's stored grants, following the legacy bridge. Denials win. */
export const grantsFor = (user: GateUser | null | undefined): Set<string> => {
  const out = new Set<string>();
  const role = user?.role as UserRole | undefined;
  if (role && MODULE_ROLE_PRESETS[role]) MODULE_ROLE_PRESETS[role]!.forEach(g => out.add(g));
  const denied: string[] = [];
  (user?.customPermissions || []).forEach(g => {
    if (g.startsWith(DENY_PREFIX)) { denied.push(g.slice(1)); return; }
    if (LEGACY_GRANT_MAP[g]) LEGACY_GRANT_MAP[g].forEach(x => out.add(x));
    else out.add(g);
  });
  // Applied last so a denial beats both the preset and a legacy grant. Denying
  // `:view` denies the whole module — there is no "may create, may not open".
  denied.forEach(d => {
    out.delete(d);
    if (d.endsWith(':view')) {
      const moduleId = d.split(':')[0];
      Array.from(out).forEach(g => { if (g.startsWith(`${moduleId}:`)) out.delete(g); });
    }
  });
  return out;
};

/**
 * Does this user hold `module:action`?
 *
 * Rule 2 lives here: holding ANY action on a module implies `:view`, so a
 * hand-edited grant list can never produce "may create, may not open".
 */
export const can = (user: GateUser | null | undefined, grant: string): boolean => {
  if (!user?.role) return false;
  if (FULL_ACCESS_ROLES.includes(user.role as UserRole)) return true;
  const grants = grantsFor(user);
  if (grants.has(grant)) return true;
  const [moduleId, action] = grant.split(':');
  if (action === 'view') {
    return Array.from(grants).some(g => g.startsWith(`${moduleId}:`));
  }
  return false;
};

/** Page gate: may this user open the view? Unknown views are not ours to gate. */
export const canOpenView = (user: GateUser | null | undefined, view: string): boolean => {
  const moduleId = VIEW_TO_MODULE[view];
  if (!moduleId) return true;
  return can(user, `${moduleId}:view`);
};

/** Convenience for pages: `const perms = modulePerms(user, 'procedures')`. */
export const modulePerms = (user: GateUser | null | undefined, moduleId: string) => ({
  view:   can(user, `${moduleId}:view`),
  create: can(user, `${moduleId}:create`),
  edit:   can(user, `${moduleId}:edit`),
  delete: can(user, `${moduleId}:delete`),
  stock:  can(user, `${moduleId}:stock`),
});

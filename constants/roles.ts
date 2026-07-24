// Shared role/position catalog — labels, badge styles, grouping for pickers,
// and the default coarse page-access preset per role. Consumed by the staff
// registration form, staff directory, staff profile and clinic management so
// role naming/colours never drift between screens.
import { UserRole, Permission, PermissionId } from '../types';

export interface RoleMeta {
  label: string;      // full human label
  short: string;      // compact badge label
  badge: string;      // tailwind classes for the badge chip
  group: string;      // picker grouping
}

// Order here is also the picker order within each group.
export const ROLE_META: Partial<Record<UserRole, RoleMeta>> = {
  [UserRole.CLINIC_OWNER]:  { label: 'Clinic Owner',      short: 'Owner',      group: 'Management', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30' },
  [UserRole.CLINIC_MANAGER]:{ label: 'Manager',           short: 'Manager',    group: 'Management', badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30' },
  [UserRole.CLINIC_VIEWER]: { label: 'Read-only Viewer',  short: 'Viewer',     group: 'Management', badge: 'bg-slate-500/15 text-slate-500 dark:text-slate-300 border-slate-500/30' },

  [UserRole.VET]:           { label: 'Veterinary Surgeon',short: 'Vet',        group: 'Clinical',   badge: 'bg-seafoam/15 text-seafoam border-seafoam/30' },
  [UserRole.VET_NURSE]:     { label: 'Veterinary Nurse',  short: 'Vet Nurse',  group: 'Clinical',   badge: 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border-teal-500/30' },
  [UserRole.LAB_TECH]:      { label: 'Lab Technician',    short: 'Lab Tech',   group: 'Clinical',   badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30' },
  [UserRole.PHARMACIST]:    { label: 'Pharmacy / Dispensary', short: 'Pharmacy', group: 'Clinical', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' },

  [UserRole.FRONT_OFFICE]:  { label: 'Front Office',      short: 'Front Office', group: 'Front Desk', badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30' },
  [UserRole.RECEPTIONIST]:  { label: 'Receptionist',      short: 'Reception',  group: 'Front Desk', badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30' },
  [UserRole.CASHIER]:       { label: 'Cashier',           short: 'Cashier',    group: 'Front Desk', badge: 'bg-lime-500/15 text-lime-600 dark:text-lime-300 border-lime-500/30' },
  [UserRole.ACCOUNTANT]:    { label: 'Accountant',        short: 'Accountant', group: 'Front Desk', badge: 'bg-green-500/15 text-green-600 dark:text-green-300 border-green-500/30' },

  [UserRole.GROOMER]:       { label: 'Groomer',           short: 'Groomer',    group: 'Support',    badge: 'bg-pink-500/15 text-pink-600 dark:text-pink-300 border-pink-500/30' },
  [UserRole.KENNEL_ATTENDANT]:{ label: 'Kennel Attendant',short: 'Kennel',     group: 'Support',    badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30' },
  [UserRole.DRIVER]:        { label: 'Driver',            short: 'Driver',     group: 'Support',    badge: 'bg-stone-500/15 text-stone-600 dark:text-stone-300 border-stone-500/30' },
  [UserRole.STAFF]:         { label: 'General Staff',     short: 'Staff',      group: 'Support',    badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30' },

  [UserRole.FREELANCER]:    { label: 'Freelancer',        short: 'Freelancer', group: 'External',   badge: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border-fuchsia-500/30' },
};

const DEFAULT_BADGE = 'bg-slate-500/15 text-slate-500 dark:text-slate-300 border-slate-500/30';

export const roleLabel = (role?: UserRole | string): string =>
  (role && ROLE_META[role as UserRole]?.label) || String(role || '').replace(/_/g, ' ');

export const roleShort = (role?: UserRole | string): string =>
  (role && ROLE_META[role as UserRole]?.short) || String(role || '').replace(/_/g, ' ');

export const roleBadgeClasses = (role?: UserRole | string): string =>
  (role && ROLE_META[role as UserRole]?.badge) || DEFAULT_BADGE;

// The page-access toggles shown in the staff form. ONLY sections the frontend
// actually gates (see App.tsx canAccess) belong here — otherwise a toggle does
// nothing. VIEW_INVENTORY / VIEW_PURCHASE_ORDERS are intentionally omitted:
// inventory + purchase orders are open to every clinic user (canAccess returns
// true), so gating them here would be a dead switch. Labels match the sidebar.
export const PAGE_ACCESS_ITEMS: { token: PermissionId; label: string }[] = [
  { token: Permission.VIEW_DASHBOARD, label: 'Dashboard' },
  { token: Permission.VIEW_FINANCE, label: 'Finance' },
  { token: Permission.VIEW_REFERRALS, label: 'Partners' },
  { token: Permission.VIEW_CLINIC_MGMT, label: 'Clinic Management' },
  { token: Permission.VIEW_SUPPLIERS, label: 'Suppliers' },
];

// Coarse page-access preset per role (the VIEW_* tokens gate sidebar/routes for
// restricted roles). Owners can override per-person in the form. Full-access
// roles ignore this — they see everything. Only real (gating) tokens listed.
export const ROLE_DEFAULT_PAGES: Partial<Record<UserRole, PermissionId[]>> = {
  [UserRole.VET]:            [Permission.VIEW_DASHBOARD],
  [UserRole.VET_NURSE]:      [Permission.VIEW_DASHBOARD],
  [UserRole.LAB_TECH]:       [Permission.VIEW_DASHBOARD],
  [UserRole.PHARMACIST]:     [Permission.VIEW_DASHBOARD, Permission.VIEW_SUPPLIERS],
  [UserRole.FRONT_OFFICE]:   [Permission.VIEW_DASHBOARD],
  [UserRole.RECEPTIONIST]:   [Permission.VIEW_DASHBOARD],
  [UserRole.CASHIER]:        [Permission.VIEW_DASHBOARD, Permission.VIEW_FINANCE],
  [UserRole.ACCOUNTANT]:     [Permission.VIEW_DASHBOARD, Permission.VIEW_FINANCE],
  [UserRole.GROOMER]:        [Permission.VIEW_DASHBOARD],
  [UserRole.KENNEL_ATTENDANT]:[Permission.VIEW_DASHBOARD],
  [UserRole.DRIVER]:         [Permission.VIEW_DASHBOARD],
  [UserRole.STAFF]:          [Permission.VIEW_DASHBOARD],
  [UserRole.CLINIC_VIEWER]:  [Permission.VIEW_DASHBOARD, Permission.VIEW_FINANCE],
  [UserRole.FREELANCER]:     [Permission.VIEW_DASHBOARD],
};

// The positions an owner/manager can assign, grouped for the picker.
// (OWNER is added conditionally for platform admins by the caller.)
export const ASSIGNABLE_ROLE_GROUPS: { group: string; roles: UserRole[] }[] = [
  { group: 'Management', roles: [UserRole.CLINIC_MANAGER, UserRole.CLINIC_VIEWER] },
  { group: 'Clinical',   roles: [UserRole.VET, UserRole.VET_NURSE, UserRole.LAB_TECH, UserRole.PHARMACIST] },
  { group: 'Front Desk', roles: [UserRole.FRONT_OFFICE, UserRole.RECEPTIONIST, UserRole.CASHIER, UserRole.ACCOUNTANT] },
  { group: 'Support',    roles: [UserRole.GROOMER, UserRole.KENNEL_ATTENDANT, UserRole.DRIVER, UserRole.STAFF] },
];

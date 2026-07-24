/**
 * Per-audience sidebar menu definitions.
 *
 * Each "audience" is a slice of the app menu — Super Admin sees VetHub-level
 * platform tools, Clinic sees the clinical day-to-day, etc. A real user logs
 * in and is locked to their own audience; SUPER_ADMIN can flip the audience
 * switcher to peek at any of them, or pick "All" to see every section as a
 * collapsible group.
 */
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  Dog,
  Repeat,
  CircleDollarSign,
  Package,
  ShoppingCart,
  Layers,
  ClipboardList,
  ShieldCheck,
  Award,
  BadgeCheck,
  CreditCard,
  Building2,
  Settings2,
  Receipt,
  Truck,
  TrendingUp,
  Upload,
  BarChart3,
  Mail,
  LifeBuoy,
  Home,
  Stethoscope,
  Scissors,
  BellRing,
  Syringe,
  FlaskConical,
  ScanLine,
  Slice,
  Siren,
  Pill,
  ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react';

export type AudienceId = 'admin' | 'clinic' | 'supplier' | 'freelancer';

export interface MenuSubItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional permission gate; falsy = always visible to the audience. */
  requiredPerm?: string;
  subItems?: MenuSubItem[];
}

export interface Audience {
  id: AudienceId;
  label: string;
  /** Short hint shown under the section header in "All" mode. */
  hint: string;
  icon: LucideIcon;
  items: MenuItem[];
}

// ─── Admin (Super Admin + Merchant Admin merged) ────────────────────────────
// Single audience covering both VetHub platform tools and tenant
// management. Super Admin and Merchant Admin both land here; what each
// can actually open is gated by canAccess() / requiredPerm at render time.
// Grouped into collapsible sections so the platform surface reads as a few
// clear areas instead of one long scattered list. Internal view ids are
// unchanged — only grouping/labels differ, so deep links keep working.
const ADMIN_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Platform Dashboard', icon: LayoutDashboard },
  {
    id: 'admin_tenants_menu', label: 'Tenants', icon: Building2,
    subItems: [
      { id: 'clinics',           label: 'Clinics',     icon: Building2 },
      { id: 'admin-suppliers',   label: 'Suppliers',   icon: Truck },
      { id: 'admin-freelancers', label: 'Freelancers', icon: Users },
    ],
  },
  {
    id: 'admin_people_menu', label: 'People', icon: Users,
    subItems: [
      { id: 'admin-users', label: 'Users',      icon: Users },
      { id: 'sales-reps',  label: 'Sales Reps', icon: Users },
    ],
  },
  {
    id: 'admin_trust_menu', label: 'Trust & Safety', icon: BadgeCheck,
    subItems: [
      { id: 'admin-verifications', label: 'Verification',   icon: BadgeCheck },
      { id: 'admin-clinic-transfers', label: 'Clinic Transfers', icon: ArrowRightLeft },
      { id: 'partner-types',       label: 'Partner Tiers',  icon: Award },
      { id: 'all-protection',      label: 'All Protection', icon: ShieldCheck },
    ],
  },
  {
    id: 'admin_billing_menu', label: 'Billing & Plans', icon: CreditCard,
    subItems: [
      { id: 'sub-packages',       label: 'Plans',                 icon: Layers },
      { id: 'sub-payments',       label: 'Subscription Payments', icon: CircleDollarSign },
      { id: 'payment-processing', label: 'Platform Billing',      icon: CreditCard },
    ],
  },
  {
    id: 'admin_platform_menu', label: 'Platform', icon: ShieldCheck,
    subItems: [
      { id: 'freelancer-categories', label: 'Freelancer Categories', icon: Layers },
      { id: 'support-tickets',       label: 'Support Tickets',       icon: LifeBuoy },
      { id: 'platform-settings',     label: 'Platform Settings',     icon: ShieldCheck },
    ],
  },
];

// ─── Clinic: vet/staff/owner clinical day-to-day ───────────────────────────
const CLINIC_ITEMS: MenuItem[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, requiredPerm: 'VIEW_DASHBOARD' },
  { id: 'reminders',    label: 'Reminders',    icon: BellRing },
  { id: 'appointment-bookings', label: 'Appointments', icon: CalendarClock },
  { id: 'appointments', label: 'Visits', icon: CalendarClock },
  { id: 'emergency',    label: 'Emergency',    icon: Siren },
  {
    id: 'patients_menu',
    label: 'Patients & Clients',
    icon: Dog,
    subItems: [
      { id: 'patients', label: 'Patients', icon: Dog },
      { id: 'clients',  label: 'Clients',  icon: Users },
    ],
  },
  { id: 'inpatient',    label: 'Inpatient',    icon: Stethoscope },
  { id: 'boarding',     label: 'Boarding',     icon: Home },
  { id: 'grooming',     label: 'Grooming',     icon: Scissors },
  {
    id: 'medical_menu',
    label: 'Medical',
    icon: Stethoscope,
    subItems: [
      { id: 'surgery',    label: 'Surgery',    icon: Slice },
      { id: 'laboratory', label: 'Laboratory', icon: FlaskConical },
      { id: 'imaging',    label: 'Imaging',    icon: ScanLine },
    ],
  },
  { id: 'petshop',      label: 'Petshop',      icon: ShoppingCart },
  { id: 'pharmacy',     label: 'Pharmacy',     icon: Pill },
  {
    id: 'inventory_menu',
    label: 'Inventory & Suppliers',
    icon: Package,
    subItems: [
      { id: 'inventory',        label: 'Stock Manager',    icon: Package },
      { id: 'procedures',       label: 'Procedures',       icon: ClipboardList },
      { id: 'vaccine-packages', label: 'Vaccine Packages', icon: Syringe },
      { id: 'service-bundles',  label: 'Service Bundles',  icon: Layers },
      { id: 'purchase-orders',  label: 'Purchase Orders',  icon: ShoppingCart },
      { id: 'suppliers',        label: 'Supplier Hub',     icon: Truck },
    ],
  },
  // ── Billable Items taxonomy (Billable Items wave M4) ──────────────────────
  // For prod_test clinics the inventory group above is REPLACED at render time
  // (applyBillableItemsLayout) by these two groups: the vet collaborator's
  // Products / Services / Procedures / Packages taxonomy plus a procurement
  // rump. Internal view ids stay stable — only labels/grouping change.
  { id: 'referrals', label: 'Partners', icon: Repeat, requiredPerm: 'VIEW_REFERRALS' },
  {
    id: 'finance_menu',
    label: 'Finance',
    icon: CircleDollarSign,
    requiredPerm: 'VIEW_FINANCE',
    subItems: [
      { id: 'financial-overview', label: 'Financial Overview', icon: TrendingUp },
      { id: 'b2b-stats',          label: 'B2B Stats',          icon: Repeat },
      { id: 'transactions',       label: 'Transactions',       icon: Receipt },
      { id: 'financial-core',     label: 'Clinic Finance',     icon: CircleDollarSign },
    ],
  },
  {
    id: 'clinic_mgmt',
    label: 'Clinic Management',
    icon: Building2,
    requiredPerm: 'VIEW_CLINIC_MGMT',
    subItems: [
      { id: 'settings',    label: 'Clinic Settings', icon: Settings2 },
      { id: 'staff',       label: 'Staff Directory', icon: ShieldCheck },
      { id: 'broadcasts',  label: 'Broadcasts',      icon: Mail },
      { id: 'import-data', label: 'Import Data',     icon: Upload },
      { id: 'billing',     label: 'Billing',         icon: CreditCard },
    ],
  },
];

// ─── Supplier: marketplace seller view ─────────────────────────────────────
// Analytics intentionally absent — the Dashboard already covers it (KPIs,
// charts, top buyers, revenue trends). Keeping a separate Analytics page
// would just be a second route to the same data.
const SUPPLIER_ITEMS: MenuItem[] = [
  { id: 'supplier-dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'supplier-products',   label: 'Products',   icon: Package },
  { id: 'supplier-inventory',  label: 'Inventory',  icon: ShoppingCart },
  { id: 'supplier-orders',     label: 'Orders',     icon: Receipt },
  {
    id: 'supplier_mgmt',
    label: 'Account',
    icon: Building2,
    subItems: [
      { id: 'supplier-management', label: 'Account', icon: Building2 },
      { id: 'supplier-billing',    label: 'Billing', icon: CreditCard },
    ],
  },
];

// ─── Freelancer: independent vet operating across clinics ───────────────────
// Freelancers reuse the clinic day-to-day surface for now (assignments,
// patients, finance) — pages live under the clinic IDs. Their dedicated
// admin page is `admin-freelancers`, which they don't manage themselves.
const FREELANCER_ITEMS: MenuItem[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'appointments', label: 'My Schedule',  icon: CalendarClock },
  { id: 'patients',     label: 'Patients',     icon: Dog },
  { id: 'transactions', label: 'My Earnings',  icon: Receipt },
  { id: 'settings',     label: 'Profile',      icon: Settings2 },
];

// Billable Items taxonomy groups (M4) — swapped in for `inventory_menu` on
// prod_test clinics by applyBillableItemsLayout below.
export const BILLABLE_ITEMS_MENU: MenuItem = {
  id: 'billable_menu',
  label: 'Billable Items',
  icon: CircleDollarSign,
  subItems: [
    { id: 'inventory',        label: 'Products',   icon: Package },
    { id: 'services-catalog', label: 'Services',   icon: Stethoscope },
    { id: 'procedures',       label: 'Procedures', icon: ClipboardList },
    { id: 'packages',         label: 'Packages',   icon: Layers },
  ],
};

// Procurement rump — keeps the `inventory_menu` id so group open-state and
// category gating keyed on it keep working.
export const INVENTORY_PROCUREMENT_MENU: MenuItem = {
  id: 'inventory_menu',
  label: 'Suppliers & Orders',
  icon: Truck,
  subItems: [
    { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { id: 'suppliers',       label: 'Supplier Hub',    icon: Truck },
  ],
};

/** prod_test clinics get the Billable Items taxonomy; everyone else keeps the classic group. */
export const applyBillableItemsLayout = (items: MenuItem[], prodTest: boolean): MenuItem[] =>
  prodTest
    ? items.flatMap(i => (i.id === 'inventory_menu' ? [BILLABLE_ITEMS_MENU, INVENTORY_PROCUREMENT_MENU] : [i]))
    : items;

export const AUDIENCES: Audience[] = [
  { id: 'admin',       label: 'Admin',       hint: 'Platform & tenants',  icon: ShieldCheck, items: ADMIN_ITEMS },
  { id: 'clinic',      label: 'Clinic',      hint: 'Day-to-day clinical', icon: LayoutDashboard, items: CLINIC_ITEMS },
  { id: 'supplier',    label: 'Supplier',    hint: 'Marketplace seller',  icon: Truck,       items: SUPPLIER_ITEMS },
  { id: 'freelancer',  label: 'Freelancer',  hint: 'Independent vet',     icon: Users,       items: FREELANCER_ITEMS },
];

export const getAudience = (id: AudienceId): Audience =>
  AUDIENCES.find(a => a.id === id) ?? AUDIENCES[2]; // default to clinic

/**
 * Returns the audiences a given user role is allowed to view.
 * SUPER_ADMIN gets all of them (and gains the audience switcher).
 * Everyone else is locked to their natural audience.
 */
export function audiencesForRole(role: string): AudienceId[] {
  switch (role) {
    case 'SUPER_ADMIN':    return ['admin', 'clinic', 'supplier', 'freelancer'];
    case 'MERCHANT_ADMIN': return ['admin', 'clinic', 'supplier', 'freelancer'];
    case 'CLINIC_OWNER':
    case 'VET':
    case 'STAFF':          return ['clinic'];
    case 'SUPPLIER':       return ['supplier'];
    case 'FREELANCER':     return ['freelancer'];
    default:               return ['clinic'];
  }
}

/**
 * Default audience to land on when a user logs in.
 * SUPER_ADMIN lands on Super Admin (their primary lens).
 */
export function defaultAudienceForRole(role: string): AudienceId {
  switch (role) {
    case 'SUPER_ADMIN':    return 'admin';
    case 'MERCHANT_ADMIN': return 'admin';
    case 'SUPPLIER':       return 'supplier';
    case 'FREELANCER':     return 'freelancer';
    default:               return 'clinic';
  }
}

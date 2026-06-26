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
const ADMIN_ITEMS: MenuItem[] = [
  { id: 'dashboard',            label: 'Platform Dashboard',  icon: LayoutDashboard },
  { id: 'admin-users',          label: 'Users',               icon: Users },
  { id: 'clinics',              label: 'Clinics',             icon: Building2 },
  { id: 'admin-suppliers',      label: 'Suppliers',           icon: Truck },
  { id: 'admin-verifications',  label: 'Verification',        icon: BadgeCheck },
  { id: 'admin-freelancers',    label: 'Freelancers',         icon: Users },
  { id: 'freelancer-categories', label: 'Freelancer Cats',    icon: Layers },
  { id: 'sub-packages',       label: 'Plans',              icon: Layers },
  { id: 'sub-payments',       label: 'Sub. Payments',      icon: CircleDollarSign },
  { id: 'support-tickets',    label: 'Support Tickets',    icon: LifeBuoy },
  { id: 'sales-reps',         label: 'Sales Reps',         icon: Users },
  { id: 'partner-types',      label: 'Partner Tiers',      icon: Award },
  { id: 'platform-settings',  label: 'Platform Settings',  icon: ShieldCheck },
  { id: 'payment-processing', label: 'Billing',            icon: CreditCard },
];

// ─── Clinic: vet/staff/owner clinical day-to-day ───────────────────────────
const CLINIC_ITEMS: MenuItem[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, requiredPerm: 'VIEW_DASHBOARD' },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
  { id: 'clients',      label: 'Clients',      icon: Users },
  { id: 'patients',     label: 'Patients',     icon: Dog },
  { id: 'inpatient',    label: 'Inpatient',    icon: Stethoscope },
  { id: 'boarding',     label: 'Boarding',     icon: Home },
  { id: 'grooming',     label: 'Grooming',     icon: Scissors },
  { id: 'laboratory',   label: 'Laboratory',   icon: FlaskConical },
  { id: 'imaging',      label: 'Imaging',      icon: ScanLine },
  { id: 'reminders',    label: 'Reminders',    icon: BellRing },
  {
    id: 'inventory_menu',
    label: 'Inventory & Suppliers',
    icon: Package,
    subItems: [
      { id: 'inventory',        label: 'Stock Manager',    icon: Package },
      { id: 'vaccine-packages', label: 'Vaccine Packages', icon: Syringe },
      { id: 'service-bundles',  label: 'Service Bundles',  icon: Layers },
      { id: 'purchase-orders',  label: 'Purchase Orders',  icon: ShoppingCart },
      { id: 'suppliers',        label: 'Supplier Hub',     icon: Truck },
    ],
  },
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
      { id: 'financial-core',     label: 'Financial Core',     icon: CircleDollarSign },
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

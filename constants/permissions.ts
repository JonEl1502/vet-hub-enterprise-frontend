// Canonical granular-permission catalog + per-role defaults, shared by the staff
// permissions editor (StaffProfileView) and runtime action gating (userCan).
import { UserRole, FULL_ACCESS_ROLES } from '../types';

export interface PermissionDef { id: string; label: string; category: string }

export const ALL_PERMISSIONS: PermissionDef[] = [
  // Visits
  { id: 'view_appointments', label: 'View Visits', category: 'Visits' },
  { id: 'create_appointments', label: 'Create Visits', category: 'Visits' },
  { id: 'edit_appointments', label: 'Edit Visits', category: 'Visits' },
  { id: 'delete_appointments', label: 'Delete Visits', category: 'Visits' },
  { id: 'finalize_appointments', label: 'Finalize Visits', category: 'Visits' },

  // Clients & Pets
  { id: 'view_clients', label: 'View Clients', category: 'Clients & Pets' },
  { id: 'create_clients', label: 'Create Clients', category: 'Clients & Pets' },
  { id: 'edit_clients', label: 'Edit Clients', category: 'Clients & Pets' },
  { id: 'delete_clients', label: 'Delete Clients', category: 'Clients & Pets' },
  { id: 'view_pets', label: 'View Pets', category: 'Clients & Pets' },
  { id: 'create_pets', label: 'Create Pets', category: 'Clients & Pets' },
  { id: 'edit_pets', label: 'Edit Pets', category: 'Clients & Pets' },

  // Medical Records
  { id: 'view_medical_records', label: 'View Medical Records', category: 'Medical' },
  { id: 'create_medical_records', label: 'Create Medical Records', category: 'Medical' },
  { id: 'edit_medical_records', label: 'Edit Medical Records', category: 'Medical' },
  { id: 'view_vaccinations', label: 'View Vaccinations', category: 'Medical' },
  { id: 'manage_vaccinations', label: 'Manage Vaccinations', category: 'Medical' },

  // Inventory
  { id: 'view_inventory', label: 'View Inventory', category: 'Inventory' },
  { id: 'create_inventory', label: 'Create Inventory Items', category: 'Inventory' },
  { id: 'edit_inventory', label: 'Edit Inventory', category: 'Inventory' },
  { id: 'delete_inventory', label: 'Delete Inventory', category: 'Inventory' },
  { id: 'manage_purchase_orders', label: 'Manage Purchase Orders', category: 'Inventory' },

  // Payments & Billing
  { id: 'view_payments', label: 'View Payments', category: 'Payments' },
  { id: 'process_payments', label: 'Process Payments', category: 'Payments' },
  { id: 'view_receipts', label: 'View Receipts', category: 'Payments' },
  { id: 'apply_discounts', label: 'Apply Discounts', category: 'Payments' },

  // Staff & Settings
  { id: 'view_staff', label: 'View Staff', category: 'Staff & Settings' },
  { id: 'manage_staff', label: 'Manage Staff', category: 'Staff & Settings' },
  { id: 'manage_roles', label: 'Manage Roles & Permissions', category: 'Staff & Settings' },
  { id: 'manage_clinic_settings', label: 'Manage Clinic Settings', category: 'Staff & Settings' },
  { id: 'manage_categories', label: 'Manage Categories & Services', category: 'Staff & Settings' },

  // Reports & Analytics
  { id: 'view_reports', label: 'View Reports', category: 'Reports' },
  { id: 'export_data', label: 'Export Data', category: 'Reports' },
];

const ALL_IDS = ALL_PERMISSIONS.map(p => p.id);

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: ALL_IDS,
  [UserRole.MERCHANT_ADMIN]: ALL_IDS,
  [UserRole.CLINIC_OWNER]: ALL_IDS,
  [UserRole.CLINIC_MANAGER]: ALL_IDS,
  [UserRole.VET]: [
    'view_appointments', 'create_appointments', 'edit_appointments', 'finalize_appointments',
    'view_clients', 'create_clients', 'edit_clients',
    'view_pets', 'create_pets', 'edit_pets',
    'view_medical_records', 'create_medical_records', 'edit_medical_records',
    'view_vaccinations', 'manage_vaccinations',
    'view_inventory',
    'view_payments', 'process_payments', 'view_receipts',
    'view_staff',
  ],
  [UserRole.STAFF]: [
    'view_appointments', 'create_appointments', 'edit_appointments',
    'view_clients', 'create_clients', 'edit_clients',
    'view_pets', 'create_pets', 'edit_pets',
    'view_medical_records',
    'view_inventory',
    'view_payments', 'process_payments', 'view_receipts',
  ],
  [UserRole.FREELANCER]: [
    'view_appointments', 'edit_appointments', 'finalize_appointments',
    'view_clients', 'view_pets',
    'view_medical_records', 'create_medical_records', 'edit_medical_records',
    'view_vaccinations', 'manage_vaccinations',
    'view_inventory',
  ],
  [UserRole.CLINIC_VIEWER]: ALL_IDS.filter(id => id.startsWith('view_')),
  [UserRole.CLIENT]: [],
  [UserRole.SUPPLIER]: [],

  // ── Operational staff designations ─────────────────────────────────────
  // A veterinary nurse works up patients but doesn't finalize/bill on their own.
  [UserRole.VET_NURSE]: [
    'view_appointments', 'create_appointments', 'edit_appointments',
    'view_clients', 'create_clients', 'edit_clients',
    'view_pets', 'create_pets', 'edit_pets',
    'view_medical_records', 'create_medical_records', 'edit_medical_records',
    'view_vaccinations', 'manage_vaccinations',
    'view_inventory',
  ],
  // Front office / reception: books visits, manages clients, takes payment.
  [UserRole.FRONT_OFFICE]: [
    'view_appointments', 'create_appointments', 'edit_appointments',
    'view_clients', 'create_clients', 'edit_clients',
    'view_pets', 'create_pets', 'edit_pets',
    'view_payments', 'process_payments', 'view_receipts',
  ],
  [UserRole.RECEPTIONIST]: [
    'view_appointments', 'create_appointments', 'edit_appointments',
    'view_clients', 'create_clients', 'edit_clients',
    'view_pets', 'create_pets', 'edit_pets',
    'view_payments', 'view_receipts',
  ],
  // Cashier: money in/out, discounts, receipts.
  [UserRole.CASHIER]: [
    'view_appointments',
    'view_clients', 'view_pets',
    'view_payments', 'process_payments', 'view_receipts', 'apply_discounts',
  ],
  // Pharmacy / dispensary: stock + dispensing + purchase orders.
  [UserRole.PHARMACIST]: [
    'view_appointments',
    'view_clients', 'view_pets',
    'view_medical_records',
    'view_inventory', 'create_inventory', 'edit_inventory', 'manage_purchase_orders',
    'view_payments', 'process_payments', 'view_receipts',
  ],
  // Lab technician: diagnostics + medical records, read-only inventory.
  [UserRole.LAB_TECH]: [
    'view_appointments',
    'view_clients', 'view_pets',
    'view_medical_records', 'create_medical_records', 'edit_medical_records',
    'view_inventory',
  ],
  [UserRole.GROOMER]: [
    'view_appointments', 'create_appointments', 'edit_appointments',
    'view_clients', 'view_pets',
  ],
  [UserRole.KENNEL_ATTENDANT]: [
    'view_appointments',
    'view_clients', 'view_pets',
    'view_medical_records',
  ],
  // Driver: minimal — sees who/where for pickups & drop-offs.
  [UserRole.DRIVER]: [
    'view_appointments',
    'view_clients', 'view_pets',
  ],
  // Accountant: finance + reporting, no clinical write access.
  [UserRole.ACCOUNTANT]: [
    'view_appointments',
    'view_clients',
    'view_payments', 'view_receipts', 'apply_discounts',
    'view_reports', 'export_data',
  ],
};

/** Effective granted permission ids for a role + its custom overrides. */
export function effectivePermissions(role: UserRole, customPermissions: string[] = []): string[] {
  return Array.from(new Set([...(ROLE_DEFAULT_PERMISSIONS[role] || []), ...customPermissions]));
}

/** Runtime gate: does this user hold the given granular permission? */
export function userCan(
  user: { role?: string; customPermissions?: string[] } | null | undefined,
  permId: string,
): boolean {
  if (!user?.role) return false;
  const role = user.role as UserRole;
  if (FULL_ACCESS_ROLES.includes(role)) return true;
  return effectivePermissions(role, user.customPermissions || []).includes(permId);
}

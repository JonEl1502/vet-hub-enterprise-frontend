/**
 * Main API Service Export
 * Provides backward compatibility with existing imports
 */

// Export all API modules
export { authAPI } from './modules/auth.api';
export { usersAPI } from './modules/users.api';
export { clinicsAPI } from './modules/clinics.api';
export { clientsAPI } from './modules/clients.api';
export { clientDiscountsAPI } from './modules/clientDiscounts.api';
export { petsAPI } from './modules/pets.api';
export { appointmentsAPI } from './modules/appointments.api';
export { transactionsAPI } from './modules/transactions.api';
export { medicalRecordsAPI } from './modules/medicalRecords.api';
export { default as categoriesAPI } from './modules/categories.api';
export { default as servicesAPI } from './modules/services.api';
export { vaccinationsAPI } from './modules/vaccinations.api';
export { appointmentMedicationsAPI } from './modules/appointmentMedications.api';
export { inventoryAPI } from './modules/inventory.api';
export { stockMovementsAPI } from './modules/stockMovements.api';
export { suppliersAPI } from './modules/suppliers.api';
export { supplierProductsAPI } from './modules/supplierProducts.api';
export { purchaseOrderAPI } from './modules/purchaseOrders.api';
export { walletAPI } from './modules/wallet.api';
export type { Wallet, WalletEntityType, WalletType, WalletLedgerEntry } from './modules/wallet.api';
export { clinicSubscriptionAPI } from './modules/clinicSubscription.api';
export type { ClinicSubscription, SubscriptionPackageSummary, UpgradePreview } from './modules/clinicSubscription.api';
export { supplierSubscriptionAPI } from './modules/supplierSubscription.api';
export type { SupplierSubscription, SubscriptionPackage as SupplierPackage, UpgradePreview as SupplierUpgradePreview } from './modules/supplierSubscription.api';

// Export types
export type { LoginRequest, LoginResponse, SignupRequest } from './modules/auth.api';
export type { User } from './modules/users.api';
export type { Clinic } from './modules/clinics.api';
export type { Client } from './modules/clients.api';
export type { Pet } from './modules/pets.api';
export type { Appointment, Task, PaymentData } from './modules/appointments.api';
export type { Transaction } from './modules/transactions.api';
export type { MedicalRecord } from './modules/medicalRecords.api';
export type { Category, CreateCategoryData, UpdateCategoryData } from './modules/categories.api';
export type { Service, CreateServiceData, UpdateServiceData } from './modules/services.api';
export type { VaccinationRecord, CreateVaccinationData, UpdateVaccinationData } from './modules/vaccinations.api';
export type { AppointmentMedication, AddMedicationRequest } from './modules/appointmentMedications.api';
export type { InventoryItem, CreateInventoryItemData, UpdateInventoryItemData } from './modules/inventory.api';
export type { StockMovement, StockMovementType, CreateStockMovementData, RestockInventoryData, StockMovementFilters } from './modules/stockMovements.api';
export type { Supplier, CreateSupplierData, UpdateSupplierData } from './modules/suppliers.api';
export type { SupplierProduct, CreateSupplierProductData, UpdateSupplierProductData, SupplierProductFilters } from './modules/supplierProducts.api';
export type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, CreatePurchaseOrderData, UpdatePurchaseOrderData, ReceivePurchaseOrderData, PurchaseOrderFilters } from './modules/purchaseOrders.api';

// Export API types and utilities
export type { 
  ApiResponse, 
  ApiError, 
  RequestOptions, 
  LoadingTarget,
  ToastNotification,
  ToastType,
} from './api/types';

// Export API configuration
export { API_BASE_URL, ENDPOINTS, HTTP_STATUS } from './api/config';

// Export utilities
export { toast } from './utils/toast';
export { cache, CacheInvalidators } from './utils/cache';
export {
  convertBigIntToString, 
  transformDates, 
  transformApiResponse,
  sanitizeRequestData,
} from './utils/transformers';
export {
  isNetworkError,
  isTimeoutError,
  isAuthError,
  isPermissionError,
  getErrorMessage,
  handleApiError,
} from './utils/errorHandler';

// Export API client for advanced usage
export { default as apiClient, axiosInstance } from './api/client';


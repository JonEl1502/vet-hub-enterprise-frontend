/**
 * Main API Service Export
 * Provides backward compatibility with existing imports
 */

// Export all API modules
export { authAPI } from './modules/auth.api';
export { usersAPI } from './modules/users.api';
export { clinicsAPI } from './modules/clinics.api';
export { handshakesAPI } from './modules/handshakes.api';
export { subscriptionPackagesAPI, FEATURE_CATALOG } from './modules/subscriptionPackages.api';
export type { SubscriptionPackagePlan, CreatePackagePayload } from './modules/subscriptionPackages.api';
export { freelancerCategoriesAPI } from './modules/freelancerCategories.api';
export type { FreelancerCategory } from './modules/freelancerCategories.api';
export type { Handshake as ApiHandshake, HandshakeList, HandshakeClinicSummary, HandshakeStatusValue, CreateHandshakeData, UpdateHandshakeData } from './modules/handshakes.api';
export { clientsAPI } from './modules/clients.api';
export { clientDiscountsAPI } from './modules/clientDiscounts.api';
export { petsAPI } from './modules/pets.api';
export { appointmentsAPI } from './modules/appointments.api';
export { boardingAPI } from './modules/boarding.api';
export type { BoardingStay, BoardingDailyLog, BoardingOccupancy, BoardingStatus, CreateBoardingPayload } from './modules/boarding.api';
export { inpatientAPI } from './modules/inpatient.api';
export type { Hospitalization, VitalReading, HospLog, HospitalizationStatus, DischargeOutcome, LogKind } from './modules/inpatient.api';
export { remindersAPI, REMINDER_SERVICE_META } from './modules/reminders.api';
export type { Reminder, ReminderServiceType, ReminderStatus, ReminderScope, CreateReminderPayload } from './modules/reminders.api';
export { transactionsAPI } from './modules/transactions.api';
export { summariesAPI } from './modules/summaries.api';
export type { SummaryScope, SummaryTotals, SummarySeriesPoint, SummaryResponse, SummaryBreakdownRow, SummaryBreakdownResponse, GetSummariesOptions } from './modules/summaries.api';
export type { DuplicateGroup, DuplicateGroupClient } from './modules/clients.api';
export type { OrphanedPet } from './modules/pets.api';
export { platformSettingsAPI } from './modules/platformSettings.api';
export type { PlatformSettings, PlatformSettingsUpdate } from './modules/platformSettings.api';
export { platformMetricsAPI } from './modules/platformMetrics.api';
export type { PlatformMetrics } from './modules/platformMetrics.api';
export { medicalRecordsAPI } from './modules/medicalRecords.api';
export { default as categoriesAPI } from './modules/categories.api';
export { default as servicesAPI } from './modules/services.api';
export { vaccinationsAPI } from './modules/vaccinations.api';
export { appointmentMedicationsAPI } from './modules/appointmentMedications.api';
export { inventoryAPI, INVENTORY_FORMS } from './modules/inventory.api';
export type { InventoryForm } from './modules/inventory.api';
export { consumablesAPI } from './modules/consumables.api';
export type { AppointmentConsumable, LogConsumablePayload } from './modules/consumables.api';
export { vaccinePackagesAPI } from './modules/vaccinePackages.api';
export type { VaccinePackage, VaccinePackageItem, PackagePricingMode, PackagePayload } from './modules/vaccinePackages.api';
export { serviceBundlesAPI } from './modules/serviceBundles.api';
export type { ServiceBundle, ServiceBundleItem, BundlePricingMode, BundlePayload } from './modules/serviceBundles.api';
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
export { fxAPI } from './modules/fx.api';
export type { FxRatesPayload, ConversionResult } from './modules/fx.api';
export { broadcastsAPI } from './modules/broadcasts.api';
export type { Broadcast, BroadcastAudience, BroadcastAudienceType } from './modules/broadcasts.api';
export { clientPortalAPI } from './modules/clientPortal.api';
export type { PortalClinic, PortalPet, PortalAppointment, PortalMessage, PortalInvoice, PortalMyClinic } from './modules/clientPortal.api';
export { uploadsAPI } from './modules/uploads.api';
export type { UploadScope, SignedUrlResult } from './modules/uploads.api';
export { verificationAPI } from './modules/verification.api';
export type { BusinessDocument, VerificationInfo, VerificationQueueItem, VerificationStatus, BusinessDocType, DocumentSide } from './modules/verification.api';

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
export { dialog } from './utils/dialog';
export { vethubMpesaAPI } from './modules/vethubMpesa.api';
export type { MpesaAttemptStatus, MpesaInitiateResult, MpesaStatus } from './modules/vethubMpesa.api';
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


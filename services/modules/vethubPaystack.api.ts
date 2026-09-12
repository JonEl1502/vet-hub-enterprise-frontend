/**
 * VetHub-level (centralized) Paystack subscription payment API client.
 *
 * Paystack hosts the checkout page (card + mobile money / M-Pesa + bank), so
 * the flow is a redirect rather than an in-app STK modal:
 *   1. initiate() → returns { authorizationUrl, reference }
 *   2. We send the user to authorizationUrl.
 *   3. Paystack redirects back to the app; we poll getStatus(reference) until
 *      the webhook flips the attempt to SUCCESS/FAILED.
 *
 * Amounts come from the package / billing-options table (priced server-side),
 * so the caller only passes which package + cycle, plus the payer's email
 * (Paystack requires one).
 */
import { get, post } from '../api/client';
import { ApiResponse } from '../api/types';

export type PaystackAttemptStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface PaystackInitiateResult {
  attemptId: string;
  reference: string;
  /** Null on the mobile-money path — there is no hosted page to send them to. */
  authorizationUrl: string | null;
  /** Null on mobile money; on `hosted` it is what Paystack Inline resumes. */
  accessCode: string | null;
  /** `pk_…` — publishable by design, needed to open the inline overlay. */
  publicKey?: string | null;
  /** Paystack's own sentence on the mobile-money path ("check your phone…"). */
  mobilePrompt?: string | null;
  amount: number;
  currency: string;
  quote?: {
    basePriceUsd: number;
    priceAfterDiscountUsd: number;
    creditAppliedUsd: number;
    effectivePriceUsd: number;
    changeKind: string;
  };
}

export interface PaystackStatus {
  reference: string;
  paystackTransactionId?: string | null;
  authorizationUrl?: string | null;
  status: PaystackAttemptStatus;
  resultCode?: string | null;
  resultDesc?: string | null;
  amount: number;
  currency: string;
  channel?: string | null;
  package: { id: string; name: string; amount: number; currency: string } | null;
  settledAt?: string | null;
}

export const vethubPaystackAPI = {
  initiate: (
    clinicId: string,
    args: {
      packageId: string | number;
      billingOptionId?: string | number;
      cycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY' | 'BIENNIAL' | 'TRIENNIAL';
      email: string;
      phone?: string;
      /**
       * WHICH CANVAS.
       * `mobile_money` — our own form; the server fires the STK push and there
       *   is no redirect and no hosted page.
       * `hosted` (default) — a transaction is initialised and we open
       *   Paystack's INLINE overlay on this page with the returned access
       *   code. Cards never touch our DOM, so we stay in PCI SAQ A.
       */
      method?: 'hosted' | 'mobile_money';
      mobileProvider?: 'mpesa' | 'airtel';
      /**
       * 288 — add-ons ticked on the plan card, bought in the same charge.
       *
       * ⚠️ IDS ONLY, never an amount. The server prices every line from the
       * catalogue and sums them; there is deliberately no way for this client
       * to influence what gets charged.
       */
      addOnPackageIds?: Array<string | number>;
    }
  ): Promise<ApiResponse<PaystackInitiateResult>> =>
    /**
     * 292 — ⚠️ `ownerKind` IS LOAD-BEARING, not decoration.
     *
     * The request interceptor attaches `X-Supplier-Id` AMBIENTLY from
     * localStorage to every non-auth request, so a clinic owner who also has a
     * supplier in scope sends BOTH headers. The server used to let the supplier
     * header win, and they got `404 Subscription package not found for
     * suppliers` — unable to buy a clinic plan at all.
     *
     * The header cannot express intent because the caller does not control it.
     * The body can. Do not remove this.
     */
    post('/subscriptions/paystack/initiate', { ...args, ownerKind: 'CLINIC' }, { headers: { 'x-clinic-id': clinicId } }),

  /**
   * 220 — the SUPPLIER rail. Same endpoint, addressed with `x-supplier-id`
   * instead of `x-clinic-id`; the server picks the owner from the header.
   */
  initiateSupplier: (
    supplierId: string,
    args: {
      packageId: string | number;
      billingOptionId?: string | number;
      cycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY' | 'BIENNIAL' | 'TRIENNIAL';
      email: string;
      phone?: string;
      /** 288 — add-ons ticked on the plan card. IDs only; priced server-side. */
      addOnPackageIds?: Array<string | number>;
    }
  ): Promise<ApiResponse<PaystackInitiateResult>> =>
    /** 292 — declare the rail; see the clinic initiate above. */
    post('/subscriptions/paystack/initiate', { ...args, ownerKind: 'SUPPLIER' }, { headers: { 'x-supplier-id': supplierId } }),

  getSupplierStatus: (
    supplierId: string,
    reference: string
  ): Promise<ApiResponse<PaystackStatus>> =>
    /** 292 — a GET has no body, so the rail rides on the query string. */
    get(`/subscriptions/paystack/status/${encodeURIComponent(reference)}?ownerKind=SUPPLIER`, {
      headers: { 'x-supplier-id': supplierId },
      cache: false,
    }),

  getStatus: (
    clinicId: string,
    reference: string
  ): Promise<ApiResponse<PaystackStatus>> =>
    /**
     * 292 — same declaration on the poll. Without it a clinic whose purchase
     * routes correctly would still poll as a supplier, never match the
     * attempt's owner, and see "Attempt not found" for 90s while the payment
     * quietly succeeded.
     */
    get(`/subscriptions/paystack/status/${encodeURIComponent(reference)}?ownerKind=CLINIC`, {
      headers: { 'x-clinic-id': clinicId },
      cache: false,
    }),
};

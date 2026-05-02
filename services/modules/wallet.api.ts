/**
 * Wallet API Module
 */

import { get, post, put } from '../api/client';
import { ApiResponse } from '../api/types';

export type WalletEntityType = 'CLINIC' | 'SUPPLIER' | 'CLIENT';
/**
 * Real wallet kinds are linked to a payment gateway / external rail.
 * VIRTUAL is an internal-only ledger — no gateway, just a balance
 * tracker. Treat null walletType (legacy rows) as VIRTUAL too.
 */
export type WalletType = 'BANK' | 'MPESA_POCHI' | 'BANK_PAYBILL' | 'TILL' | 'MPESA_PAYBILL' | 'DIGITAL_WALLET' | 'VIRTUAL';
export type WalletLedgerType = 'TRANSFER_IN' | 'TRANSFER_OUT' | 'STOCK_PURCHASE' | 'PAYMENT_RECEIVED' | 'ADJUSTMENT';

export interface WalletLedgerEntry {
  id: string;
  walletId: string;
  type: WalletLedgerType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  reference: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface Wallet {
  id: string;
  entityType: WalletEntityType;
  profileId: string;
  name: string;
  walletType: WalletType | null;
  accountNumber: string | null;
  branchId: string | null;
  balance: number;
  debt: number;
  currency: string;
  isActive: boolean;
  usesMainWallet: boolean;
  isVirtual?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegenResult extends Wallet {
  regenDetails: { credits: number; debits: number };
}

export const walletAPI = {
  /** Get all wallets for an entity */
  getByEntity: (entityType: WalletEntityType, profileId: string): Promise<ApiResponse<{ wallets: Wallet[] }>> =>
    get(`/wallets/${entityType.toLowerCase()}/${profileId}`),

  /** Get a wallet by ID */
  getById: (id: string): Promise<ApiResponse<{ wallet: Wallet }>> =>
    get(`/wallets/id/${id}`),

  /** Create a wallet */
  create: (data: {
    entityType: WalletEntityType;
    profileId: string;
    name: string;
    branchId?: string | null;
    currency?: string;
    walletType?: WalletType | null;
    accountNumber?: string | null;
    debt?: number;
    usesMainWallet?: boolean;
  }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post('/wallets', data),

  /** Credit a wallet */
  credit: (id: string, amount: number): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/id/${id}/credit`, { amount }),

  /** Debit a wallet */
  debit: (id: string, amount: number): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/id/${id}/debit`, { amount }),

  /** Regenerate wallet balance from transaction history */
  regen: (id: string): Promise<ApiResponse<RegenResult>> =>
    post(`/wallets/id/${id}/regen`, {}),

  /** Update wallet metadata */
  update: (id: string, data: { name?: string; currency?: string; isActive?: boolean; walletType?: WalletType | null; accountNumber?: string | null; debt?: number; usesMainWallet?: boolean }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    put(`/wallets/id/${id}`, data),

  /** Ensure main wallet exists for entity — creates it if missing */
  ensure: (entityType: WalletEntityType, profileId: string): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/${entityType.toLowerCase()}/${profileId}/ensure`, {}),

  /** Update main wallet settings for a clinic (entity-role accessible) */
  updateClinic: (profileId: string, data: { name?: string; walletType?: WalletType | null; accountNumber?: string | null; currency?: string; debt?: number; isActive?: boolean }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    put(`/wallets/clinic/${profileId}`, data),

  /** Update main wallet settings for a supplier (entity-role accessible) */
  updateSupplier: (profileId: string, data: { name?: string; walletType?: WalletType | null; accountNumber?: string | null; currency?: string; debt?: number; isActive?: boolean }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    put(`/wallets/supplier/${profileId}`, data),

  /** Create a wallet for a clinic (entity-role accessible, e.g. branch wallets) */
  createForClinic: (profileId: string, data: { name: string; walletType?: WalletType | null; accountNumber?: string | null; currency?: string; branchId?: string | null; debt?: number; usesMainWallet?: boolean; openingBalance?: number; isVirtual?: boolean }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/clinic/${profileId}/create`, data),

  /** Create a wallet for a supplier (entity-role accessible) */
  createForSupplier: (profileId: string, data: { name: string; walletType?: WalletType | null; accountNumber?: string | null; currency?: string; branchId?: string | null; debt?: number; usesMainWallet?: boolean; openingBalance?: number; isVirtual?: boolean }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/supplier/${profileId}/create`, data),

  /** Record money coming in to a wallet (Transfer In) */
  transferIn: (id: string, data: { amount: number; note?: string; reference?: string }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/id/${id}/transfer-in`, data),

  /** Record money going out from a wallet (Transfer Out) */
  transferOut: (id: string, data: { amount: number; note?: string; reference?: string }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/id/${id}/transfer-out`, data),

  /** Record a stock purchase debit against a wallet (STOCK_PURCHASE ledger type) */
  recordStockPurchase: (id: string, data: { amount: number; note?: string; reference?: string }): Promise<ApiResponse<{ wallet: Wallet }>> =>
    post(`/wallets/id/${id}/stock-purchase`, data),

  /** Get ledger history for a wallet */
  getLedger: (id: string, params?: { page?: number; limit?: number; type?: WalletLedgerType }): Promise<ApiResponse<{ entries: WalletLedgerEntry[]; total: number; page: number; totalPages: number }>> => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.type) q.set('type', params.type);
    const qs = q.toString();
    return get(`/wallets/id/${id}/ledger${qs ? `?${qs}` : ''}`);
  },
};

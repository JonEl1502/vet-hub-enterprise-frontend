/**
 * Wallet API Module
 */

import { get, post, put } from '../api/client';
import { ApiResponse } from '../api/types';

export type WalletEntityType = 'CLINIC' | 'SUPPLIER' | 'CLIENT';
export type WalletType = 'BANK' | 'MPESA_POCHI' | 'BANK_PAYBILL' | 'TILL' | 'MPESA_PAYBILL';

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
};

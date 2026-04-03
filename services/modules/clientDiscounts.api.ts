import { get, post, put, del } from '../api/client';
import { ENDPOINTS } from '../api/config';
import { RequestOptions, ApiResponse } from '../api/types';
import { ClientDiscount } from '../../types';

export const clientDiscountsAPI = {
  getAll: async (
    clientId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ discounts: ClientDiscount[] }>> => {
    return get(ENDPOINTS.CLIENTS.DISCOUNTS(clientId), {
      cache: true,
      cacheDuration: 30000,
      ...options,
    });
  },

  getActive: async (
    clientId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ discounts: ClientDiscount[] }>> => {
    return get(ENDPOINTS.CLIENTS.ACTIVE_DISCOUNTS(clientId), {
      cache: true,
      cacheDuration: 30000,
      ...options,
    });
  },

  create: async (
    clientId: number,
    data: {
      name: string;
      discountType: 'PERCENTAGE' | 'FIXED';
      value: number;
      expiresAt: string;
      note?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<{ discount: ClientDiscount }>> => {
    return post(ENDPOINTS.CLIENTS.DISCOUNTS(clientId), data, {
      showError: true,
      ...options,
    });
  },

  update: async (
    clientId: number,
    discountId: number,
    data: Partial<{
      name: string;
      discountType: 'PERCENTAGE' | 'FIXED';
      value: number;
      expiresAt: string;
      note?: string;
    }>,
    options?: RequestOptions
  ): Promise<ApiResponse<{ discount: ClientDiscount }>> => {
    return put(ENDPOINTS.CLIENTS.DISCOUNT_BY_ID(clientId, discountId), data, {
      showError: true,
      ...options,
    });
  },

  delete: async (
    clientId: number,
    discountId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ message: string }>> => {
    return del(ENDPOINTS.CLIENTS.DISCOUNT_BY_ID(clientId, discountId), {
      showError: true,
      ...options,
    });
  },

  redeem: async (
    clientId: number,
    discountId: number,
    appointmentId: number,
    options?: RequestOptions
  ): Promise<ApiResponse<{ discount: ClientDiscount }>> => {
    return post(ENDPOINTS.CLIENTS.REDEEM_DISCOUNT(clientId, discountId), { appointmentId }, {
      showError: true,
      ...options,
    });
  },
};

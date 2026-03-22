/**
 * Enhanced In-Memory Cache with localStorage Persistence
 * Phase 1 Improvements:
 * - Cache versioning to prevent stale data
 * - localStorage persistence for read-heavy data
 * - Better invalidation patterns
 * - Standardized cache keys
 */

import { CacheEntry } from '../api/types';
import { DEFAULT_CACHE_DURATION } from '../api/config';

// Cache version - increment this when cache structure changes
const CACHE_VERSION = '1.0.0';
const CACHE_VERSION_KEY = 'vethub_cache_version';

// localStorage keys for persistent cache
const PERSISTENT_CACHE_PREFIX = 'vethub_cache_';

// Data types that should be persisted to localStorage
const PERSISTENT_DATA_TYPES = ['clients', 'pets', 'services', 'categories', 'inventory', 'suppliers', 'purchase-orders', 'supplier-products', 'supplier-orders', 'wallets', 'wallet-ledger'];

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();

  constructor() {
    this.initializeCache();
  }

  /**
   * Initialize cache and check version
   */
  private initializeCache(): void {
    if (typeof window === 'undefined') return;

    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);

    // Clear all cache if version mismatch
    if (storedVersion !== CACHE_VERSION) {
      console.log(`[Cache] Version mismatch (${storedVersion} -> ${CACHE_VERSION}). Clearing all cache.`);
      this.clearAllCache();
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  }

  /**
   * Check if a URL should be persisted to localStorage
   */
  private shouldPersist(url: string): boolean {
    return PERSISTENT_DATA_TYPES.some(type => url.includes(`/${type}`));
  }

  /**
   * Get localStorage key for a cache entry
   */
  private getLocalStorageKey(key: string): string {
    return `${PERSISTENT_CACHE_PREFIX}${key}`;
  }

  /**
   * Generate cache key from URL and params
   */
  private generateKey(url: string, params?: any): string {
    if (!params) {
      return url;
    }
    
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as any);

    return `${url}?${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get cached data if it exists and is not expired
   * Checks in-memory cache first, then localStorage for persistent data
   */
  get<T = any>(url: string, params?: any): T | null {
    const key = this.generateKey(url, params);

    // Check in-memory cache first
    let entry = this.cache.get(key);

    // If not in memory but should be persistent, check localStorage
    if (!entry && this.shouldPersist(url) && typeof window !== 'undefined') {
      const localStorageKey = this.getLocalStorageKey(key);
      const stored = localStorage.getItem(localStorageKey);

      if (stored) {
        try {
          entry = JSON.parse(stored) as CacheEntry<T>;
          // Restore to in-memory cache
          this.cache.set(key, entry);

          if (import.meta.env.DEV) {
            console.log(`[Cache] RESTORED from localStorage: ${key}`);
          }
        } catch (error) {
          console.error('[Cache] Error parsing localStorage entry:', error);
          localStorage.removeItem(localStorageKey);
        }
      }
    }

    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.shouldPersist(url) && typeof window !== 'undefined') {
        localStorage.removeItem(this.getLocalStorageKey(key));
      }
      return null;
    }

    if (import.meta.env.DEV) {
      console.log(`[Cache] HIT: ${key}`);
    }

    return entry.data as T;
  }

  /**
   * Set cache data with expiration
   * Persists to localStorage for read-heavy data types
   */
  set<T = any>(url: string, data: T, params?: any, duration: number = DEFAULT_CACHE_DURATION): void {
    const key = this.generateKey(url, params);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + duration,
    };

    // Set in-memory cache
    this.cache.set(key, entry);

    // Persist to localStorage for read-heavy data
    if (this.shouldPersist(url) && typeof window !== 'undefined') {
      try {
        const localStorageKey = this.getLocalStorageKey(key);
        localStorage.setItem(localStorageKey, JSON.stringify(entry));

        if (import.meta.env.DEV) {
          console.log(`[Cache] PERSISTED to localStorage: ${key}`);
        }
      } catch (error) {
        console.error('[Cache] Error persisting to localStorage:', error);
        // Continue even if localStorage fails
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[Cache] SET: ${key} (expires in ${duration}ms)`);
    }
  }

  /**
   * Invalidate cache entry (both in-memory and localStorage)
   */
  invalidate(url: string, params?: any): void {
    const key = this.generateKey(url, params);
    this.cache.delete(key);

    // Also remove from localStorage if persistent
    if (this.shouldPersist(url) && typeof window !== 'undefined') {
      const localStorageKey = this.getLocalStorageKey(key);
      localStorage.removeItem(localStorageKey);
    }

    if (import.meta.env.DEV) {
      console.log(`[Cache] INVALIDATE: ${key}`);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern (both in-memory and localStorage)
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    // Clear from in-memory cache
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);

        if (import.meta.env.DEV) {
          console.log(`[Cache] INVALIDATE (pattern): ${key}`);
        }
      }
    }

    // Clear from localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const localKey = localStorage.key(i);
        if (localKey && localKey.startsWith(PERSISTENT_CACHE_PREFIX)) {
          const cacheKey = localKey.replace(PERSISTENT_CACHE_PREFIX, '');
          if (regex.test(cacheKey)) {
            keysToRemove.push(localKey);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      if (import.meta.env.DEV && keysToRemove.length > 0) {
        console.log(`[Cache] INVALIDATE (pattern) from localStorage: ${keysToRemove.length} entries`);
      }
    }
  }

  /**
   * Clear all in-memory cache (does not clear localStorage)
   */
  clear(): void {
    this.cache.clear();

    if (import.meta.env.DEV) {
      console.log('[Cache] CLEAR: All in-memory cache cleared');
    }
  }

  /**
   * Clear all cache including localStorage
   */
  clearAllCache(): void {
    // Clear in-memory cache
    this.cache.clear();

    // Clear localStorage cache
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(PERSISTENT_CACHE_PREFIX) || key === CACHE_VERSION_KEY)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      if (import.meta.env.DEV) {
        console.log(`[Cache] CLEAR ALL: Removed ${keysToRemove.length} entries from localStorage`);
      }
    }

    if (import.meta.env.DEV) {
      console.log('[Cache] CLEAR ALL: All cache cleared (in-memory + localStorage)');
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired cache entries (both in-memory and localStorage)
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean in-memory cache
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // Clean localStorage cache
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const localKey = localStorage.key(i);
        if (localKey && localKey.startsWith(PERSISTENT_CACHE_PREFIX)) {
          try {
            const stored = localStorage.getItem(localKey);
            if (stored) {
              const entry = JSON.parse(stored) as CacheEntry;
              if (now > entry.expiresAt) {
                keysToRemove.push(localKey);
              }
            }
          } catch (error) {
            // Remove invalid entries
            keysToRemove.push(localKey);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      cleanedCount += keysToRemove.length;
    }

    if (import.meta.env.DEV && cleanedCount > 0) {
      console.log(`[Cache] CLEANUP: Removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Invalidate related caches when a resource is updated
   * Example: When a client is updated, invalidate client list and client details
   */
  invalidateRelated(resourceType: string, resourceId?: string): void {
    const patterns = [
      new RegExp(`/${resourceType}\\?`),  // List endpoints
      new RegExp(`/${resourceType}$`),     // Base endpoint
    ];

    if (resourceId) {
      patterns.push(new RegExp(`/${resourceType}/${resourceId}`)); // Specific resource
    }

    patterns.forEach(pattern => this.invalidatePattern(pattern));

    if (import.meta.env.DEV) {
      console.log(`[Cache] INVALIDATE RELATED: ${resourceType}${resourceId ? `/${resourceId}` : ''}`);
    }
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Run cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Cache invalidation helpers for common operations
 */
export const CacheInvalidators = {
  /**
   * Invalidate all client-related caches
   */
  invalidateClients: (clientId?: string) => {
    cache.invalidateRelated('clients', clientId);
    // Also invalidate pets if client is updated (they might have new pets)
    if (clientId) {
      cache.invalidatePattern(new RegExp(`/pets.*client.*${clientId}`));
    }
  },

  /**
   * Invalidate all pet-related caches
   */
  invalidatePets: (petId?: string) => {
    cache.invalidateRelated('pets', petId);
  },

  /**
   * Invalidate all appointment-related caches
   */
  invalidateAppointments: (appointmentId?: string) => {
    cache.invalidateRelated('appointments', appointmentId);
  },

  /**
   * Invalidate all inventory-related caches
   */
  invalidateInventory: (itemId?: string) => {
    cache.invalidateRelated('inventory', itemId);
    // Also clear the old localStorage key used by components
    if (typeof window !== 'undefined') {
      localStorage.removeItem('inventory_medications');
    }
  },

  /**
   * Invalidate all purchase order-related caches
   */
  invalidatePurchaseOrders: (orderId?: string) => {
    cache.invalidateRelated('purchase-orders', orderId);
    // When PO is received, also invalidate inventory
    CacheInvalidators.invalidateInventory();
  },

  /**
   * Invalidate all transaction-related caches
   */
  invalidateTransactions: (transactionId?: string) => {
    cache.invalidateRelated('transactions', transactionId);
  },

  /**
   * Invalidate all supplier caches
   */
  invalidateSuppliers: (supplierId?: string) => {
    cache.invalidateRelated('suppliers', supplierId);
  },

  /**
   * Invalidate all supplier product caches
   */
  invalidateSupplierProducts: (productId?: string) => {
    cache.invalidateRelated('supplier-products', productId);
  },
};


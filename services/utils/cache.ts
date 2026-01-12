/**
 * Simple In-Memory Cache for API Responses
 */

import { CacheEntry } from '../api/types';
import { DEFAULT_CACHE_DURATION } from '../api/config';

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();

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
   */
  get<T = any>(url: string, params?: any): T | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    if (import.meta.env.DEV) {
      console.log(`[Cache] HIT: ${key}`);
    }

    return entry.data as T;
  }

  /**
   * Set cache data with expiration
   */
  set<T = any>(url: string, data: T, params?: any, duration: number = DEFAULT_CACHE_DURATION): void {
    const key = this.generateKey(url, params);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + duration,
    };

    this.cache.set(key, entry);

    if (import.meta.env.DEV) {
      console.log(`[Cache] SET: ${key} (expires in ${duration}ms)`);
    }
  }

  /**
   * Invalidate cache entry
   */
  invalidate(url: string, params?: any): void {
    const key = this.generateKey(url, params);
    this.cache.delete(key);

    if (import.meta.env.DEV) {
      console.log(`[Cache] INVALIDATE: ${key}`);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        
        if (import.meta.env.DEV) {
          console.log(`[Cache] INVALIDATE (pattern): ${key}`);
        }
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    
    if (import.meta.env.DEV) {
      console.log('[Cache] CLEAR: All cache cleared');
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
   * Clean up expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (import.meta.env.DEV && cleanedCount > 0) {
      console.log(`[Cache] CLEANUP: Removed ${cleanedCount} expired entries`);
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


/**
 * FxContext — global currency conversion layer.
 *
 * Loads the rates table once from /api/v1/fx/rates at session start and
 * keeps it in memory. Exposes a synchronous `convert()` that every view
 * can call without triggering a network request, plus a `format()` helper
 * that produces the canonical "primary · original" display string.
 *
 * Rates are refreshed every hour in the background and on login. If the
 * fetch fails the previous payload is kept so display never goes blank.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { fxAPI, FxRatesPayload } from '../services';
import { useAuth } from './AuthContext';

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface FxContextValue {
  /** USD-based rates (1 USD = N units of code). Empty until first load completes. */
  rates: Record<string, number>;
  /** ISO timestamp of when the rates were fetched from the provider. */
  fetchedAt: string | null;
  source: FxRatesPayload['source'] | null;
  isLoading: boolean;
  /** Force a refresh from the server (e.g. after a long session pause). */
  refresh: () => Promise<void>;
  /**
   * Convert an amount synchronously using the in-memory rates table.
   * Returns null when either currency is missing — caller should fall back
   * to displaying the original amount unchanged.
   */
  convert: (amount: number, from: string, to: string) => number | null;
}

const FxContext = createContext<FxContextValue | null>(null);

interface ProviderProps { children: ReactNode }

export const FxProvider: React.FC<ProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  // Rates are stored USD-based regardless of what we asked the API for —
  // re-basing on the client is trivial and avoids one fetch per "viewing
  // currency" the user switches between.
  const [rates, setRates] = useState<Record<string, number>>({});
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [source, setSource] = useState<FxRatesPayload['source'] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inflight = useRef<Promise<void> | null>(null);

  const loadRates = useCallback(async () => {
    // Dedupe concurrent calls
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      setIsLoading(true);
      try {
        const res = await fxAPI.getRates('USD');
        if (res.success && res.data?.rates) {
          setRates(res.data.rates);
          setFetchedAt(res.data.fetchedAt);
          setSource(res.data.source);
        }
      } catch (err) {
        // Keep prior rates on failure — never blank the display
        console.warn('[FxContext] rate refresh failed (keeping prior rates):', err);
      } finally {
        setIsLoading(false);
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, []);

  // Initial load + hourly refresh, gated on auth (the endpoint requires login).
  useEffect(() => {
    if (!isAuthenticated) {
      setRates({});
      setFetchedAt(null);
      setSource(null);
      return;
    }
    void loadRates();
    const interval = window.setInterval(() => { void loadRates(); }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, loadRates]);

  const convert = useCallback((amount: number, from: string, to: string): number | null => {
    if (!Number.isFinite(amount)) return null;
    const f = (from || '').toUpperCase();
    const t = (to || '').toUpperCase();
    if (!f || !t) return null;
    if (f === t) return amount;
    const fromUsd = rates[f];
    const toUsd = rates[t];
    if (!fromUsd || !toUsd) return null; // Unknown currency — caller falls back
    const rate = toUsd / fromUsd;
    return Math.round(amount * rate * 100) / 100;
  }, [rates]);

  const value: FxContextValue = {
    rates,
    fetchedAt,
    source,
    isLoading,
    refresh: loadRates,
    convert,
  };

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
};

export const useFx = (): FxContextValue => {
  const ctx = useContext(FxContext);
  if (!ctx) {
    // Soft fallback rather than throw — components used outside the provider
    // (e.g. unit tests, isolated stories) get a no-op convert.
    return {
      rates: {},
      fetchedAt: null,
      source: null,
      isLoading: false,
      refresh: async () => {},
      convert: () => null,
    };
  }
  return ctx;
};

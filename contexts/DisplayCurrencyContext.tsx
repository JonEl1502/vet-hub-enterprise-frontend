/**
 * Platform-wide display currency context.
 *
 * One source of truth for every monetary value the FE renders. The admin
 * picks the platform currency in /admin/platform-settings (default KES),
 * the backend exposes it on /admin/platform-settings/display-config, and
 * this hook caches the result + provides a `formatPrice(amount, source)`
 * helper that converts as needed.
 *
 * Conversion rules:
 *  - source === display → render the raw amount with the right symbol.
 *  - source === 'USD' and display === 'KES' → multiply by FX rate.
 *  - source === 'KES' and display === 'USD' → divide by FX rate.
 *  - Any other source → render the raw amount with the source code
 *    (we don't multi-hop convert through arbitrary currencies).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { platformSettingsAPI } from '../services/modules/platformSettings.api';

interface DisplayCurrencyValue {
  displayCurrency: string;
  usdToKesRate: number;
  ready: boolean;
  refresh: () => Promise<void>;
  /** Format an amount stored in `sourceCurrency` into a display string in the platform currency. */
  formatPrice: (amount: number, sourceCurrency?: string | null) => string;
}

const DisplayCurrencyContext = createContext<DisplayCurrencyValue | null>(null);

const DEFAULT_CURRENCY = 'KES';
const DEFAULT_FX = 130;

export const DisplayCurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [displayCurrency, setDisplayCurrency] = useState(DEFAULT_CURRENCY);
  const [usdToKesRate, setUsdToKesRate] = useState(DEFAULT_FX);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await platformSettingsAPI.getDisplayConfig();
      if (res.success && res.data) {
        setDisplayCurrency((res.data.displayCurrency || DEFAULT_CURRENCY).toUpperCase());
        setUsdToKesRate(Number(res.data.usdToKesRate) || DEFAULT_FX);
      }
    } catch {
      // Endpoint may be unreachable when unauthenticated — keep defaults.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const formatPrice = useCallback((amount: number, sourceCurrency?: string | null): string => {
    const source = (sourceCurrency || displayCurrency).toUpperCase();
    let displayed = amount;
    if (source !== displayCurrency) {
      if (source === 'USD' && displayCurrency === 'KES') {
        displayed = amount * usdToKesRate;
      } else if (source === 'KES' && displayCurrency === 'USD') {
        displayed = amount / (usdToKesRate || 1);
      } else {
        // Unsupported pair — render in the source's own currency to avoid
        // surprising the user with a wrong conversion.
        return formatCurrency(amount, source);
      }
    }
    return formatCurrency(displayed, displayCurrency);
  }, [displayCurrency, usdToKesRate]);

  const value = useMemo<DisplayCurrencyValue>(() => ({
    displayCurrency, usdToKesRate, ready, refresh, formatPrice,
  }), [displayCurrency, usdToKesRate, ready, refresh, formatPrice]);

  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
};

export const useDisplayCurrency = (): DisplayCurrencyValue => {
  const ctx = useContext(DisplayCurrencyContext);
  if (ctx) return ctx;
  // Outside-provider fallback — keep components renderable on auth screens.
  return {
    displayCurrency: DEFAULT_CURRENCY,
    usdToKesRate: DEFAULT_FX,
    ready: false,
    refresh: async () => undefined,
    formatPrice: (amount: number, sourceCurrency?: string | null) =>
      formatCurrency(amount, (sourceCurrency || DEFAULT_CURRENCY).toUpperCase()),
  };
};

function formatCurrency(amount: number, currency: string): string {
  const c = (currency || 'USD').toUpperCase();
  if (c === 'USD') return `$${Number(amount).toFixed(2)}`;
  return `${c} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

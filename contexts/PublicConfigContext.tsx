/**
 * Public bootstrap config, fetched once on app load from the unauthenticated
 * GET /public/config. Currently just the self-serve signup switch: when
 * `signupsEnabled` is false the marketing site hides the signup wizard and
 * routes "Create account" / "Start demo" CTAs to the "Contact us for a demo"
 * lead form instead. Admin flips it in Platform Settings; the site picks it up
 * on the next reload.
 *
 * Unlike DisplayCurrencyContext (which needs auth), this endpoint is public, so
 * it resolves on the landing/login screens too. Defaults to signups ENABLED so
 * a failed/slow fetch never accidentally blocks signups.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { publicAPI, PAST_DUE_FALLBACK } from '../services/modules/public.api';

interface PastDuePolicy {
  graceDays: number;
  snoozeMinutes: number;
  allowEmergency: boolean;
}

interface PublicConfigValue {
  signupsEnabled: boolean;
  /**
   * Collections policy. Defaults are the SAFE ones — a full week of grace,
   * a workable snooze, and Emergency left open — so a failed or slow fetch
   * can never lock a clinic out harder than the admin asked for.
   */
  pastDue: PastDuePolicy;
  ready: boolean;
  refresh: () => Promise<void>;
}

const PublicConfigContext = createContext<PublicConfigValue | null>(null);

export const PublicConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [pastDue, setPastDue] = useState<PastDuePolicy>(PAST_DUE_FALLBACK);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await publicAPI.getConfig({ showError: false });
      if (res.success && res.data) {
        setSignupsEnabled(res.data.signupsEnabled !== false);
        if (res.data.pastDue) setPastDue({ ...PAST_DUE_FALLBACK, ...res.data.pastDue });
      }
    } catch {
      // Keep the safe default (signups enabled) if the endpoint is unreachable.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<PublicConfigValue>(
    () => ({ signupsEnabled, pastDue, ready, refresh }),
    [signupsEnabled, pastDue, ready, refresh],
  );

  return <PublicConfigContext.Provider value={value}>{children}</PublicConfigContext.Provider>;
};

export const usePublicConfig = (): PublicConfigValue => {
  const ctx = useContext(PublicConfigContext);
  if (ctx) return ctx;
  // Outside-provider fallback — signups enabled by default.
  return { signupsEnabled: true, pastDue: PAST_DUE_FALLBACK, ready: false, refresh: async () => undefined };
};

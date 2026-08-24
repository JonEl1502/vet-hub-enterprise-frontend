/**
 * Portal mode — Pets vs Farm.
 *
 * One portal identity covers both: a `User` spans many `Client` rows, and a
 * farm hangs off a Client exactly like a pet does. So a smallholder with a dog
 * and three dairy cows is ONE account, and the portal just shows the right nav.
 *
 * Mode is derived from what the account actually HOLDS, never from a stored
 * boolean alone — `clients.is_livestock` can't express "has both", which is
 * the common case. The server's `suggestedMode` seeds the first visit; after
 * that we remember whichever mode they last used.
 */
import { useCallback, useEffect, useState } from 'react';
import { clientPortalAPI } from '../../services/modules/clientPortal.api';

export type PortalMode = 'PETS' | 'FARM';

export interface Holdings {
  petCount: number;
  farmCount: number;
  hasPets: boolean;
  hasFarms: boolean;
  /** 231 — farm mode is a paid rung (Farmer, tier 2+), not just a holding. */
  canUseFarmMode: boolean;
  /** Farms the plan covers. 0 = unlimited. */
  farmLimit: number;
  planName: string | null;
  planTier: number | null;
  suggestedMode: PortalMode;
}

const STORAGE_KEY = 'vethub:portalMode';

export const readStoredMode = (): PortalMode | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'FARM' || v === 'PETS' ? v : null;
  } catch { return null; }
};

export const storeMode = (m: PortalMode) => {
  try { localStorage.setItem(STORAGE_KEY, m); } catch { /* private mode — fine */ }
};

export const usePortalMode = () => {
  const [holdings, setHoldings] = useState<Holdings | null>(null);
  const [mode, setModeState] = useState<PortalMode>(() => readStoredMode() ?? 'PETS');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    clientPortalAPI.getHoldings()
      .then((r) => {
        if (!alive || !r.success || !r.data) return;
        const h = r.data;
        setHoldings(h);
        const stored = readStoredMode();
        // A stored mode the account can no longer satisfy (farm sold, last pet
        // removed, plan lapsed back to Free) must not strand them on empty nav.
        // 231 adds the plan to that test: FARM now needs the entitlement as
        // well as the farm, and a lapsed farmer lands back in PETS rather than
        // on a wall of 403s.
        const storedIsValid = stored === 'FARM' ? (h.hasFarms && h.canUseFarmMode)
          : stored === 'PETS' ? h.hasPets
          : false;
        setModeState(storedIsValid ? (stored as PortalMode) : h.suggestedMode);
      })
      .catch(() => { /* fail soft — stays in PETS, the historical behaviour */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const setMode = useCallback((m: PortalMode) => {
    setModeState(m);
    storeMode(m);
  }, []);

  return {
    mode,
    setMode,
    holdings,
    loading,
    /**
     * Only offer the switcher to someone who genuinely has both — and, since
     * 231, who is actually on a plan that includes farm mode. A farmer whose
     * plan lapsed keeps their farm data; they just cannot reach it until they
     * upgrade, and the switcher going quiet is kinder than a switch that 403s.
     */
    canSwitch: !!holdings?.hasPets && !!holdings?.hasFarms && !!holdings?.canUseFarmMode,
    /** Has farms but not the plan — the portal shows an upgrade prompt. */
    farmModeLocked: !!holdings?.hasFarms && !holdings?.canUseFarmMode,
  };
};

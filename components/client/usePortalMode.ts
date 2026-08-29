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
  /**
   * 231 — farm mode was a paid rung (Farmer, tier 2+).
   * 262 — it is not any more. `livestock:basic` is on the FREE rung, so this is
   * true for anyone who opts in; what the paid rungs buy is the SIZE of it.
   */
  canUseFarmMode: boolean;
  /** 262 — 'BASIC' is the free record book, 'FULL' the paid farm product. */
  farmTier: 'NONE' | 'BASIC' | 'FULL';
  /** They threw the "I keep livestock" switch, even with no farm yet. */
  optedIn: boolean;
  /** Farms the plan covers. 0 = unlimited. */
  farmLimit: number;
  /** Herds the plan covers. 0 = unlimited. 3 on the free tier. */
  groupLimit: number;
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
        // 262 — `hasFarms` is no longer required to stay in FARM. Someone who
        // has just opted in has no farm yet, and bouncing them back to PETS
        // would send them out of the very screen that lets them add one.
        const storedIsValid = stored === 'FARM' ? ((h.hasFarms || h.optedIn) && h.canUseFarmMode)
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
     * 262 — the switcher is now driven by the OPT-IN, not by owning a farm.
     *
     * The user's framing: *"an opt-in for client to farm which will allow them
     * to switch views — I don't want to have them as separate accounts."* So the
     * moment someone says they keep livestock, the switch appears, even though
     * their farm side is still empty. Requiring `hasFarms` first was the closed
     * loop that 231 had at the plan level: you needed a farm to reach the screen
     * that adds a farm.
     *
     * Still requires `canUseFarmMode`. A farmer whose PAID rung lapsed keeps
     * their data and drops to the free record book rather than hitting a wall.
     */
    canSwitch: !!holdings?.canUseFarmMode && (!!holdings?.hasFarms || !!holdings?.optedIn),
    /** Has farms but no farm entitlement at all — the portal prompts to opt in. */
    farmModeLocked: !!holdings?.hasFarms && !holdings?.canUseFarmMode,
    /** 262 — the free record book, not the paid farm product. */
    isBasicFarm: holdings?.farmTier === 'BASIC',
  };
};

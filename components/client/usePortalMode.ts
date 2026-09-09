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
  /** 290 — the two sides as facts. See `PortalHoldings` in clientPortal.api. */
  sides?: {
    pets: { active: boolean; optedIn: boolean; count: number; available: boolean };
    farm: { active: boolean; optedIn: boolean; count: number; available: boolean };
  };
  /** 290 — which side this account opens on, stored on the ACCOUNT. */
  defaultSide?: PortalMode;
  /** 290 — the account has never been asked and the answer isn't obvious. */
  needsSideChoice?: boolean;
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
        /**
         * A stored mode is valid if the account can BE in it — not if it
         * currently holds something.
         *
         * ⚠️ PETS used to require `hasPets`, so a farmer who deliberately
         * switched to the pet side (to add their first pet) was thrown back to
         * FARM on the next load, and the switch looked broken a second time.
         * PETS is the portal's base product and is always reachable; FARM needs
         * the entitlement, so a lapsed farmer still lands in PETS rather than
         * on a wall. `suggestedMode` only ever seeds the FIRST visit.
         */
        const storedIsValid =
          stored === 'FARM' ? !!h.canUseFarmMode
          : stored === 'PETS' ? true
          : false;
        /**
         * ⚠️ 290 — THE ACCOUNT'S OWN CHOICE OUTRANKS THIS DEVICE'S MEMORY.
         *
         * `localStorage` was the only record of which side someone used, so
         * *"every time they log in it will be going to farm without asking
         * again"* held on one browser and nowhere else — a new phone, a private
         * window or a cleared cache asked all over again. `defaultSide` is
         * stored on the account, so it is checked FIRST and the device memory
         * is only the fallback for accounts that predate the column.
         *
         * A stored FARM is still validated against the entitlement: a farmer
         * whose paid rung lapsed lands in PETS rather than on a wall of 403s.
         */
        const accountSide =
          h.defaultSide === 'FARM' && h.canUseFarmMode ? 'FARM'
          : h.defaultSide === 'PETS' ? 'PETS'
          : null;
        setModeState(
          accountSide
          ?? (storedIsValid ? (stored as PortalMode) : h.suggestedMode),
        );
      })
      .catch(() => { /* fail soft — stays in PETS, the historical behaviour */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  /**
   * 290 — switching sides is now REMEMBERED ON THE ACCOUNT, not just here.
   *
   * The local write stays and happens first: the nav must flip instantly, and
   * a failed network call must not undo a switch the user can plainly see. The
   * server write is fire-and-forget for the same reason — worst case the
   * account keeps its previous landing side and this device keeps the new one,
   * which is exactly the pre-290 behaviour.
   */
  const setMode = useCallback((m: PortalMode) => {
    setModeState(m);
    storeMode(m);
    setHoldings((h) => (h ? { ...h, defaultSide: m } : h));
    clientPortalAPI.setPortalSide(m, 'DEFAULT', { silent: true }).catch(() => { /* device memory still holds */ });
  }, []);

  /** 290 — answer the first-run question, or activate the other side. */
  const chooseSide = useCallback(async (m: PortalMode, action: 'ACTIVATE' | 'MOVE' | 'DEFAULT' = 'DEFAULT') => {
    const res = await clientPortalAPI.setPortalSide(m, action);
    if (res.success && res.data) setHoldings(res.data as Holdings);
    if (action !== 'ACTIVATE') { setModeState(m); storeMode(m); }
    return res;
  }, []);

  return {
    mode,
    setMode,
    chooseSide,
    holdings,
    loading,
    /**
     * 290 — ask ONCE, and only when there is a real question. Resolved
     * server-side: nothing chosen yet AND either both sides are live or
     * neither is. A single live side is answered silently.
     */
    needsSideChoice: !loading && !!holdings?.needsSideChoice,
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
    /**
     * 290 — the switcher appears once BOTH sides are live, which is now a
     * property the account records rather than a guess from what it holds.
     * Falls back to the 262 rule for accounts that predate the columns.
     */
    canSwitch: holdings?.sides
      ? (holdings.sides.pets.active && holdings.sides.farm.active && holdings.sides.farm.available)
      : (!!holdings?.canUseFarmMode && (!!holdings?.hasFarms || !!holdings?.optedIn)),
    /** Has farms but no farm entitlement at all — the portal prompts to opt in. */
    farmModeLocked: !!holdings?.hasFarms && !holdings?.canUseFarmMode,
    /** 262 — the free record book, not the paid farm product. */
    isBasicFarm: holdings?.farmTier === 'BASIC',
  };
};

/**
 * Plan access — one fetch of the clinic's entitlements, shared with the whole
 * tree so any component (however deep) can ask "is this in the plan?" without
 * prop-drilling `planAllows` down from App.
 *
 * Fails OPEN while loading and on error: `access === null` means every check
 * returns true. A network hiccup must never lock a paying clinic out of its
 * own features — the backend gate is the one that actually protects the data.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useClinic } from './ClinicContext';
import { clinicSubscriptionAPI } from '../services/modules/clinicSubscription.api';
import { allowsView, hasFeature, type PlanAccess } from '../services/entitlements';

/** Roles that bypass plan gating entirely (platform staff). */
const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];

interface PlanAccessContextType {
  /** Raw access state, or null when bypassed / not yet loaded. */
  access: PlanAccess | null;
  loading: boolean;
  /** Is `featureKey` included in the plan? */
  can: (featureKey: string) => boolean;
  /** Is `view` reachable on this plan? */
  allows: (view: string) => boolean;
  refresh: () => void;
}

const PlanAccessContext = createContext<PlanAccessContextType | undefined>(undefined);

export const usePlanAccess = (): PlanAccessContextType => {
  const ctx = useContext(PlanAccessContext);
  // Deliberately permissive: a component rendered outside the provider (tests,
  // the public/portal trees) behaves as fully entitled rather than throwing.
  if (!ctx) {
    return { access: null, loading: false, can: () => true, allows: () => true, refresh: () => {} };
  }
  return ctx;
};

/** Convenience hook for a single key. */
export const useFeature = (featureKey: string): boolean => usePlanAccess().can(featureKey);

export const PlanAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { clinics, selectedClinicIds } = useClinic();
  const [access, setAccess] = useState<PlanAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  const isAdminRole = FULL_ACCESS_ROLES.includes(String(user?.role));
  // Match App's notion of the "current" clinic: first active, else first selected.
  const activeClinicId = useMemo(() => {
    const active = clinics.filter((c) => (c as any).isActive !== false);
    return String(active[0]?.id ?? selectedClinicIds[0] ?? '') || null;
  }, [clinics, selectedClinicIds]);

  useEffect(() => {
    if (!activeClinicId || isAdminRole) { setAccess(null); return; }
    let alive = true;
    setLoading(true);
    clinicSubscriptionAPI.getAccess(activeClinicId)
      .then((r) => {
        if (!alive) return;
        if (r.success && r.data) {
          setAccess({
            state: r.data.state,
            featureKeys: r.data.featureKeys ?? [],
            packageName: r.data.packageName ?? null,
            tier: r.data.tier ?? null,
            graceFullAccessUntil: (r.data as any).graceFullAccessUntil ?? null,
          });
        } else {
          setAccess(null);
        }
      })
      .catch(() => { if (alive) setAccess(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeClinicId, isAdminRole, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const can = useCallback((key: string) => (isAdminRole ? true : hasFeature(access, key)), [access, isAdminRole]);
  const allows = useCallback((view: string) => (isAdminRole ? true : allowsView(access, view)), [access, isAdminRole]);

  const value = useMemo(
    () => ({ access: isAdminRole ? null : access, loading, can, allows, refresh }),
    [access, isAdminRole, loading, can, allows, refresh],
  );

  return <PlanAccessContext.Provider value={value}>{children}</PlanAccessContext.Provider>;
};

export default PlanAccessContext;

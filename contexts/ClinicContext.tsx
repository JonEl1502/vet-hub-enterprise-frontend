import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { clinicsAPI } from '../services';

interface Clinic {
  id: string;
  name: string;
  logo: string;
  subdomain: string;
  address?: string;
  phone?: string;
  email?: string;
  balance?: number;
  rating?: number;
  currency?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
  isDemo?: boolean;
  status?: string;
  createdAt?: string;
  colors?: {
    primary: string;
    secondary: string;
  };
  slogan?: string;
  merchantId?: string | number;
  ownerId?: string | number | null;
  parentClinicId?: string | null;
  isMain?: boolean;
  currentPlanId?: string | number | null;
  specialties?: string[];
  aiConfig?: { provider: 'gemini' | 'openai' | 'fallback'; apiKey?: string; model?: string } | null;
  latitude?: number | null;
  longitude?: number | null;
  countryCode?: string | null;
  dialCode?: string | null;
  region?: 'AFRICA' | 'ASIA' | 'LATAM' | 'MIDDLE_EAST' | 'EUROPE' | 'OCEANIA' | 'NORTH_AMERICA' | null;
  city?: string | null;
  boardingDayRate?: number | null;
  inpatientDayRate?: number | null;
  prodTest?: boolean;
  catalogScope?: 'ALL' | 'GENERAL' | 'CUSTOM';
}

/**
 * Single source of truth for converting an API clinic payload to the local
 * Clinic shape. All three fetch paths (SUPER_ADMIN list, user.userClinics
 * inline, refreshClinics) MUST use this — adding fields to the API in one
 * place but not the others has bitten us repeatedly (specialties, aiConfig,
 * lat/lng, country/region all dropped because of duplicated mapping code).
 */
const transformApiClinic = (clinic: any): Clinic => ({
  id: clinic.id,
  name: clinic.name,
  logo: clinic.logo || '',
  subdomain: clinic.subdomain || '',
  slogan: clinic.slogan || '',
  address: clinic.address || '',
  phone: clinic.phone || '',
  email: clinic.email || '',
  balance: clinic.balance || 0,
  rating: clinic.rating ?? 4.5,
  currency: clinic.currency || 'KES',
  colors: {
    primary: clinic.primaryColor || '#1C7A5B',
    secondary: clinic.secondaryColor || '#144E35',
  },
  isActive: clinic.isActive !== undefined ? clinic.isActive : true,
  merchantId: clinic.merchantId,
  ownerId: clinic.ownerId ?? null,
  parentClinicId: clinic.parentClinicId ?? null,
  isMain: clinic.isMain ?? !clinic.parentClinicId,
  currentPlanId: clinic.currentPlanId ?? null,
  specialties: clinic.specialties || [],
  aiConfig: clinic.aiConfig ?? null,
  latitude: clinic.latitude ?? null,
  longitude: clinic.longitude ?? null,
  countryCode: clinic.countryCode ?? null,
  dialCode: clinic.dialCode ?? null,
  region: clinic.region ?? null,
  city: clinic.city ?? null,
  boardingDayRate: clinic.boardingDayRate != null ? Number(clinic.boardingDayRate) : null,
  inpatientDayRate: clinic.inpatientDayRate != null ? Number(clinic.inpatientDayRate) : null,
  prodTest: clinic.prodTest === true,
  catalogScope: clinic.catalogScope ?? 'ALL',
});

interface ClinicContextType {
  clinics: Clinic[];
  selectedClinicIds: string[];
  selectedClinics: Clinic[];
  isLoading: boolean;
  canMultiSelect: boolean;
  needsInitialSelection: boolean;
  selectClinic: (clinicId: string) => void;
  toggleClinic: (clinicId: string) => void;
  selectMultipleClinics: (clinicIds: string[]) => void;
  selectAllClinics: () => void;
  completeInitialSelection: () => void;
  getClinicHeader: () => string | null;
  updateClinic: (clinicId: string, data: Partial<Clinic>) => Promise<void>;
  refreshClinics: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
};

interface ClinicProviderProps {
  children: ReactNode;
}

export const ClinicProvider: React.FC<ClinicProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicIds, setSelectedClinicIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [needsInitialSelection, setNeedsInitialSelection] = useState(false);
  const lastFetchedUserId = useRef<string | null>(null);

  // On logout (auth cleared) wipe in-memory clinic state AND the fetch guard,
  // so the next login — even as the SAME user — refetches instead of skipping.
  // Previously a hard page reload on logout reset this for free; now that
  // logout is a clean SPA transition we must clear it explicitly.
  useEffect(() => {
    if (!isAuthenticated) {
      lastFetchedUserId.current = null;
      setClinics([]);
      setSelectedClinicIds([]);
      setNeedsInitialSelection(false);
    }
  }, [isAuthenticated]);

  // Determine if user can multi-select clinics
  const canMultiSelect = user?.role === 'SUPER_ADMIN' || user?.role === 'CLINIC_OWNER';

  // /user-clinics returns each main clinic with a nested `branches: [...]`
  // array. Flatten parent + branches into one top-level Clinic[] so the
  // Switch Context picker, the X-Clinic-Ids interceptor, and downstream
  // data hooks all see every accessible clinic (including child branches).
  // Called from both the primary user.userClinics path and the localStorage
  // cache-fallback path so behavior is consistent across cold and warm
  // page loads.
  const flattenParentsAndBranches = (apiClinics: any[]): Clinic[] => {
    const flat: Clinic[] = [];
    const seen = new Set<string>();
    for (const parent of apiClinics) {
      if (!parent) continue;
      const t = transformApiClinic(parent);
      if (!seen.has(String(t.id))) { seen.add(String(t.id)); flat.push(t); }
      for (const b of (parent.branches || [])) {
        const tb = transformApiClinic(b);
        if (!seen.has(String(tb.id))) { seen.add(String(tb.id)); flat.push(tb); }
      }
    }
    return flat;
  };

  // Fetch user's clinics when authenticated. Re-runs when the user's
  // userClinics field arrives — AuthContext mounts with a slim cached
  // user (no userClinics), then upgrades from /auth/me with the full
  // shape; we want the second pass to refresh clinic state.
  useEffect(() => {
    // Skip duplicate fetch only when we've already loaded the FULL user
    // (with userClinics). If the cached user lacks userClinics, let it
    // run again once the live response arrives.
    const userClinicsCount = Array.isArray(user?.userClinics) ? user!.userClinics.length : -1;
    if (user?.id && lastFetchedUserId.current === `${user.id}:${userClinicsCount}`) {
      return;
    }

    const fetchClinics = async () => {
      if (!isAuthenticated || !user) {
        setClinics([]);
        setSelectedClinicIds([]);
        return;
      }

      setIsLoading(true);
      try {
        // Extract clinic data from user.userClinics[].clinic or use cached data
        let fetchedClinics: Clinic[] = [];

        // SUPER_ADMIN users can access all clinics
        if (user.role === 'SUPER_ADMIN') {
          try {
            const response = await clinicsAPI.getAll();
            if (response.success && response.data.clinics) {
              fetchedClinics = response.data.clinics.map(transformApiClinic);
              console.log(`✅ SUPER_ADMIN: Loaded ${fetchedClinics.length} clinics from API`);
              setClinics(fetchedClinics);
            }
          } catch (error) {
            console.error('Failed to fetch all clinics for SUPER_ADMIN:', error);
            setClinics([]);
          }
        }
        // Regular users: prime from auth-cached associations for an
        // instant first paint, THEN upgrade to /user-clinics so any
        // post-login changes (slogan, specialties, branding, currency,
        // region…) are reflected on refresh. The backend's /user-clinics
        // already nests `branches: [...]` under each main clinic for
        // CLINIC_OWNER / CLINIC_ADMIN, so a single endpoint covers both
        // "what clinics do I belong to" and "what branches sit under
        // them". We flatten parent + branches into one list — that's the
        // shape the Switch Context picker and the X-Clinic-Ids interceptor
        // expect.
        else if (user.userClinics && user.userClinics.length > 0) {
          fetchedClinics = user.userClinics
            .filter((uc) => uc && uc.clinic)
            .map((uc) => transformApiClinic(uc.clinic));

          // Fire-and-forget upgrade. The auth-cached prime above is good
          // enough to render UI; failures here just leave the cached view
          // in place. On success, replace the clinics list with the
          // flattened parent + branches set.
          void clinicsAPI.getUserClinics({ cache: false }).then((res: any) => {
            if (!res?.success || !Array.isArray(res?.data?.clinics)) return;
            const flat = flattenParentsAndBranches(res.data.clinics);
            if (flat.length > 0) {
              setClinics(flat);
              // Cache the full parents-with-nested-branches shape so the
              // next cold load can prime with branches included.
              try { localStorage.setItem('userClinics', JSON.stringify(res.data.clinics)); } catch {}
            }
          }).catch(() => {});
          console.log(`✅ Loaded ${fetchedClinics.length} clinics from user object with full details`);
          setClinics(fetchedClinics);
        } else if (!Array.isArray(user.userClinics)) {
          // userClinics field was not returned by the API — fall back to
          // localStorage cache. The cache stores the parents-with-nested-
          // branches shape (written by the upgrade callbacks above), so
          // flatten on read too — otherwise the picker's "All Clinics"
          // tile would only see the parent and Apply would commit just
          // the parent id (the "All shows main only" bug).
          const cachedClinics = localStorage.getItem('userClinics');
          if (cachedClinics) {
            const raw = JSON.parse(cachedClinics);
            fetchedClinics = Array.isArray(raw) ? flattenParentsAndBranches(raw) : [];
            console.log('📦 Using cached clinic data from localStorage');
            setClinics(fetchedClinics);
            // Upgrade to live data in the background so any post-cache
            // edits flow through. Flatten the same way the primary path
            // does so branches are exposed as top-level clinic entries.
            void clinicsAPI.getUserClinics({ cache: false }).then((res: any) => {
              if (res?.success && Array.isArray(res?.data?.clinics) && res.data.clinics.length) {
                const flat = flattenParentsAndBranches(res.data.clinics);
                if (flat.length > 0) setClinics(flat);
                try { localStorage.setItem('userClinics', JSON.stringify(res.data.clinics)); } catch {}
              }
            }).catch(() => {});
          } else {
            console.warn('No clinic data found in user object or localStorage');
            setClinics([]);
          }
        } else {
          // user.userClinics is explicitly empty — user has no clinic associations
          console.warn('User has no clinic associations');
          setClinics([]);
          // Clear stale clinic selection so no wrong X-Clinic-Id is sent
          setSelectedClinicIds([]);
          localStorage.removeItem('selectedClinicIds');
        }

        // If user has no clinics, set empty state
        if (fetchedClinics.length === 0) {
          console.warn('User has no associated clinics');
          setClinics([]);
          setSelectedClinicIds([]);
          setIsLoading(false);
          return;
        }

        // Check if initial selection has been completed
        const hasCompletedInitialSelection = localStorage.getItem('hasCompletedInitialSelection') === 'true';

        // Auto-select first clinic or restore from localStorage
        const storedSelection = localStorage.getItem('selectedClinicIds');

        // SUPER_ADMIN: Auto-select all clinics by default
        if (user.role === 'SUPER_ADMIN') {
          const allClinicIds = fetchedClinics.map(c => c.id);
          if (hasCompletedInitialSelection && storedSelection) {
            // Restore previous selection if exists
            const parsedSelection = JSON.parse(storedSelection);
            const validSelection = parsedSelection.filter((id: string) => allClinicIds.includes(id));
            setSelectedClinicIds(validSelection.length > 0 ? validSelection : allClinicIds);
            console.log('✅ SUPER_ADMIN: Restored clinic selection:', validSelection);
          } else {
            // Auto-select all clinics for first-time login
            setSelectedClinicIds(allClinicIds);
            localStorage.setItem('selectedClinicIds', JSON.stringify(allClinicIds));
            localStorage.setItem('hasCompletedInitialSelection', 'true');
            console.log('✅ SUPER_ADMIN: Auto-selected all clinics:', allClinicIds.length);
          }
          setNeedsInitialSelection(false);
        }
        // Regular users
        else if (fetchedClinics.length === 1) {
          // Single clinic: always land on that clinic. If the user previously
          // picked a child branch via the modal, storedSelection has that
          // branch id even though the prime list only contains the parent —
          // honor it so picking SHIVETS - KIKUYU sticks across reloads.
          const onlyId = fetchedClinics[0].id;
          let toSelect: string[] = [onlyId];
          if (hasCompletedInitialSelection && storedSelection) {
            const parsed = (JSON.parse(storedSelection) as unknown[])
              .map((id) => String(id))
              .filter((id) => id && id !== 'undefined');
            if (parsed.length > 0) toSelect = parsed;
          }
          setSelectedClinicIds(toSelect);
          setNeedsInitialSelection(false);
          localStorage.setItem('selectedClinicIds', JSON.stringify(toSelect));
          if (!hasCompletedInitialSelection) {
            localStorage.setItem('hasCompletedInitialSelection', 'true');
          }
          console.log('✅ Single clinic auto-selected:', toSelect);
        } else if (hasCompletedInitialSelection) {
          // Multi-clinic and user has gone through the picker at least once.
          if (storedSelection) {
            // Trust localStorage — picker is authoritative. Don't filter
            // against fetchedClinics here: branch ids may not be in the
            // auth-cached prime yet (they arrive on the /user-clinics
            // upgrade). Stale ids → backend 403 → user re-applies.
            const parsedSelection = (JSON.parse(storedSelection) as unknown[])
              .map((id) => String(id))
              .filter((id) => id && id !== 'undefined');
            setSelectedClinicIds(parsedSelection);
            setNeedsInitialSelection(false);
            console.log('✅ Restored clinic selection from localStorage:', parsedSelection);
          } else {
            // No storedSelection but user has been through the picker =
            // explicit "All Clinics". Populate the selection with every
            // accessible clinic so the UI badge and the data hooks have
            // something concrete to render against; empty-set leaves the
            // app in a "no clinic selected" dead-end state.
            const allIds = fetchedClinics.map((c) => c.id);
            setSelectedClinicIds(allIds);
            setNeedsInitialSelection(false);
            localStorage.setItem('selectedClinicIds', JSON.stringify(allIds));
            console.log('✅ "All clinics" scope materialised:', allIds.length, 'clinics');
          }
        } else {
          // Multiple clinics and no initial selection yet
          setSelectedClinicIds([]);
          setNeedsInitialSelection(true);
          console.log('⚠️ Multiple clinics detected - showing initial selection screen');
        }

        // Mark this user as fetched
        if (user?.id) {
          lastFetchedUserId.current = `${user.id}:${userClinicsCount}`;
        }
      } catch (error) {
        console.error('Failed to fetch clinics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClinics();
    // userClinics is part of the dep so the effect re-runs once
    // /auth/me's full payload lands.
  }, [isAuthenticated, user?.id, Array.isArray(user?.userClinics) ? user.userClinics.length : 0]);

  // Save selection to localStorage whenever it changes (backup mirror — the
  // setters below ALSO write synchronously so the axios interceptor's next
  // request sees the new clinic immediately. Without the sync write, child
  // contexts (DataContext) re-render and fire fetches before this useEffect
  // runs, causing requests to go out with the OLD X-Clinic-Id header.)
  //
  // Critical: only WRITE here, never auto-clear. On mount selectedClinicIds
  // starts as [] (the useState default), and this effect fires once with
  // that empty value. If we removed the key from localStorage in that path
  // we'd wipe the user's previous selection before fetchClinics finishes
  // restoring it — any data requests firing during the empty window go out
  // with no X-Clinic-Id header, the backend falls back to user.clinicIds[0]
  // (the parent), and the user sees the parent's records regardless of
  // what they actually picked. Explicit clearing is done via writeSelection
  // when something legitimately wants the selection emptied.
  useEffect(() => {
    if (selectedClinicIds.length > 0) {
      localStorage.setItem('selectedClinicIds', JSON.stringify(selectedClinicIds));
    }
  }, [selectedClinicIds]);

  // Single helper used by every setter so the localStorage mirror stays in
  // lockstep with React state — no useEffect lag.
  const writeSelection = (ids: string[]) => {
    try {
      if (ids.length === 0) {
        localStorage.removeItem('selectedClinicIds');
      } else {
        localStorage.setItem('selectedClinicIds', JSON.stringify(ids));
      }
    } catch {}
    setSelectedClinicIds(ids);
  };

  // Mirror the active selection into the URL as ?clinic=<id> so the active
  // clinic survives a refresh and shows up in shared links. Only set when
  // exactly one clinic is selected — multi-select stays implicit.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const current = url.searchParams.get('clinic');
      if (selectedClinicIds.length === 1) {
        if (current !== selectedClinicIds[0]) {
          url.searchParams.set('clinic', selectedClinicIds[0]);
          window.history.replaceState(window.history.state, '', url.toString());
        }
      } else if (current) {
        url.searchParams.delete('clinic');
        window.history.replaceState(window.history.state, '', url.toString());
      }
    } catch {}
  }, [selectedClinicIds]);

  // On first mount, prefer ?clinic=<id> from the URL over localStorage so deep
  // links land on the right clinic context.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated || clinics.length === 0) return;
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get('clinic');
      if (fromUrl && clinics.some((c) => c.id === fromUrl) && (selectedClinicIds.length !== 1 || selectedClinicIds[0] !== fromUrl)) {
        setSelectedClinicIds([fromUrl]);
      }
    } catch {}
    // run once after clinics load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, clinics.length]);

  const selectClinic = (clinicId: string) => {
    writeSelection([clinicId]);
  };

  const toggleClinic = (clinicId: string) => {
    if (!canMultiSelect) {
      // Non-multi-select users can only have one clinic selected
      writeSelection([clinicId]);
      return;
    }

    const prev = selectedClinicIds;
    let next: string[];
    if (prev.includes(clinicId)) {
      // Don't allow deselecting the last clinic
      if (prev.length === 1) return;
      next = prev.filter(id => id !== clinicId);
    } else {
      next = [...prev, clinicId];
    }
    writeSelection(next);
  };

  const selectMultipleClinics = (clinicIds: string[]) => {
    if (!canMultiSelect) {
      // Non-multi-select users can only select one clinic
      writeSelection(clinicIds.slice(0, 1));
      return;
    }
    writeSelection(clinicIds);
  };

  const selectAllClinics = () => {
    if (!canMultiSelect) return;
    writeSelection(clinics.map(c => c.id));
  };

  const completeInitialSelection = () => {
    setNeedsInitialSelection(false);
    localStorage.setItem('hasCompletedInitialSelection', 'true');
  };

  // Get the header value for API requests
  const getClinicHeader = (): string | null => {
    if (selectedClinicIds.length === 0) return null;
    if (selectedClinicIds.length === 1) return selectedClinicIds[0];
    return selectedClinicIds.join(',');
  };

  // Update clinic settings
  const updateClinic = async (clinicId: string, data: Partial<Clinic>) => {
    try {
      // Prepare data for API - convert colors object to separate fields
      const apiData: any = { ...data };

      // If colors object is provided, extract primary and secondary colors
      if (data.colors) {
        apiData.primaryColor = data.colors.primary;
        apiData.secondaryColor = data.colors.secondary;
        delete apiData.colors;
      }

      // Call API to update clinic
      const response: any = await clinicsAPI.update(parseInt(clinicId), apiData);

      if (response.success) {
        console.log('✅ Clinic updated successfully:', response.data.clinic);

        // Update local state — pipe the response through the same
        // transformer as fetch so every consumer sees the same shape.
        const apiClinic = response.data.clinic || {};
        const next = transformApiClinic({ ...apiClinic, balance: 0, isMain: !apiClinic.parentClinicId });
        setClinics(prev => prev.map(c => (c.id === clinicId ? { ...c, ...next } : c)));

        // Bust the apiClient cache for /clinics/me so a hard refresh
        // doesn't re-render the pre-update payload from the 5-min cache.
        try {
          await clinicsAPI.getUserClinics({ cache: false });
        } catch { /* ignore — local state already updated */ }
        // Keep the localStorage userClinics mirror in sync so the next
        // refresh's "prime from auth cache" path sees the new values.
        try {
          const cached = localStorage.getItem('userClinics');
          if (cached) {
            const parsed = JSON.parse(cached);
            const updated = Array.isArray(parsed)
              ? parsed.map((c: any) => (String(c.id) === String(clinicId) ? { ...c, ...apiClinic } : c))
              : parsed;
            localStorage.setItem('userClinics', JSON.stringify(updated));
          }
        } catch {}
      }
    } catch (error) {
      console.error('Failed to update clinic:', error);
      throw error;
    }
  };

  // Refresh clinics from API
  const refreshClinics = async () => {
    if (!isAuthenticated || !user) return;

    setIsLoading(true);
    try {
      const response: any = await clinicsAPI.getUserClinics();
      if (response.success && response.data.clinics) {
        const transformedClinics = response.data.clinics.map(transformApiClinic);
        setClinics(transformedClinics);
        console.log(`✅ Refreshed ${transformedClinics.length} clinics with full details`);
      }
    } catch (error) {
      console.error('Failed to refresh clinics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedClinics = clinics.filter(c => selectedClinicIds.includes(c.id));

  // Apply clinic brand colors to CSS variables whenever selected clinic changes.
  //
  // When SupplierContext has claimed the theme (data-supplier-theme="active"
  // — set whenever a supplier user is logged in, or an admin has narrowed to
  // a single supplier under the supplier audience), we stand down so the
  // supplier's brand wins. Listening to the audience-change event lets us
  // re-apply when the user flips back to clinic mode without reloading.
  useEffect(() => {
    const hexToRgb = (hex: string) => {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? `${parseInt(r[1], 16)} ${parseInt(r[2], 16)} ${parseInt(r[3], 16)}` : '67 136 131';
    };

    const applyClinicTheme = () => {
      if (document.documentElement.getAttribute('data-supplier-theme') === 'active') {
        return; // supplier owns the theme right now
      }
      const clinic = selectedClinics[0];
      const primary = clinic?.colors?.primary || '#1C7A5B';
      const secondary = clinic?.colors?.secondary || '#144E35';
      document.documentElement.style.setProperty('--primary-color', primary);
      document.documentElement.style.setProperty('--secondary-color', secondary);
      document.documentElement.style.setProperty('--primary-rgb', hexToRgb(primary));
      document.documentElement.style.setProperty('--secondary-rgb', hexToRgb(secondary));
    };

    applyClinicTheme();
    const onAudienceChange = () => applyClinicTheme();
    window.addEventListener('audience-change', onAudienceChange);
    return () => window.removeEventListener('audience-change', onAudienceChange);
  }, [selectedClinicIds, clinics]);

  const value: ClinicContextType = {
    clinics,
    selectedClinicIds,
    selectedClinics,
    isLoading,
    canMultiSelect,
    needsInitialSelection,
    selectClinic,
    toggleClinic,
    selectMultipleClinics,
    selectAllClinics,
    completeInitialSelection,
    getClinicHeader,
    updateClinic,
    refreshClinics,
  };

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
};


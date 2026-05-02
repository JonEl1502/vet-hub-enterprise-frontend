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
    primary: clinic.primaryColor || '#438883',
    secondary: clinic.secondaryColor || '#163C39',
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

  // Determine if user can multi-select clinics
  const canMultiSelect = user?.role === 'SUPER_ADMIN' || user?.role === 'CLINIC_OWNER';

  // Fetch user's clinics when authenticated
  useEffect(() => {
    // Prevent duplicate fetches for the same user
    if (user?.id && lastFetchedUserId.current === user.id) {
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
        // instant first paint, THEN upgrade to a live /clinics/me fetch
        // so any post-login changes (slogan, specialties, branding,
        // currency, region…) are reflected on refresh.
        else if (user.userClinics && user.userClinics.length > 0) {
          fetchedClinics = user.userClinics
            .filter((uc) => uc && uc.clinic)
            .map((uc) => transformApiClinic(uc.clinic));
          // Fire-and-forget upgrade to live data; ignore failures —
          // the prime data above is good enough as a fallback.
          void clinicsAPI.getUserClinics({ cache: false }).then((res: any) => {
            if (res?.success && Array.isArray(res?.data?.clinics) && res.data.clinics.length) {
              setClinics(res.data.clinics.map(transformApiClinic));
              try { localStorage.setItem('userClinics', JSON.stringify(res.data.clinics)); } catch {}
            }
          }).catch(() => {});
          console.log(`✅ Loaded ${fetchedClinics.length} clinics from user object with full details`);
          setClinics(fetchedClinics);
        } else if (!Array.isArray(user.userClinics)) {
          // userClinics field was not returned by the API — fall back to localStorage cache
          const cachedClinics = localStorage.getItem('userClinics');
          if (cachedClinics) {
            fetchedClinics = JSON.parse(cachedClinics);
            console.log('📦 Using cached clinic data from localStorage');
            setClinics(fetchedClinics);
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
          // Single clinic: auto-select and skip initial selection screen
          setSelectedClinicIds([fetchedClinics[0].id]);
          setNeedsInitialSelection(false);
          localStorage.setItem('selectedClinicIds', JSON.stringify([fetchedClinics[0].id]));
          localStorage.setItem('hasCompletedInitialSelection', 'true');
          console.log('✅ Single clinic auto-selected:', fetchedClinics[0].name);
        } else if (hasCompletedInitialSelection && storedSelection) {
          // Multiple clinics but user has already made initial selection
          const parsedSelection = JSON.parse(storedSelection);
          // Validate that stored clinics are still accessible
          const validClinicIds = fetchedClinics.map(c => c.id);
          const validSelection = parsedSelection.filter((id: string) =>
            validClinicIds.includes(id)
          );
          setSelectedClinicIds(validSelection.length > 0 ? validSelection : []);
          setNeedsInitialSelection(validSelection.length === 0);
          console.log('✅ Restored clinic selection from localStorage:', validSelection);
        } else {
          // Multiple clinics and no initial selection yet
          setSelectedClinicIds([]);
          setNeedsInitialSelection(true);
          console.log('⚠️ Multiple clinics detected - showing initial selection screen');
        }

        // Mark this user as fetched
        if (user?.id) {
          lastFetchedUserId.current = user.id;
        }
      } catch (error) {
        console.error('Failed to fetch clinics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClinics();
  }, [isAuthenticated, user?.id]);

  // Save selection to localStorage whenever it changes
  useEffect(() => {
    if (selectedClinicIds.length > 0) {
      localStorage.setItem('selectedClinicIds', JSON.stringify(selectedClinicIds));
    }
  }, [selectedClinicIds]);

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
    setSelectedClinicIds([clinicId]);
  };

  const toggleClinic = (clinicId: string) => {
    if (!canMultiSelect) {
      // Non-multi-select users can only have one clinic selected
      setSelectedClinicIds([clinicId]);
      return;
    }

    setSelectedClinicIds(prev => {
      if (prev.includes(clinicId)) {
        // Don't allow deselecting the last clinic
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== clinicId);
      } else {
        return [...prev, clinicId];
      }
    });
  };

  const selectMultipleClinics = (clinicIds: string[]) => {
    if (!canMultiSelect) {
      // Non-multi-select users can only select one clinic
      setSelectedClinicIds(clinicIds.slice(0, 1));
      return;
    }
    setSelectedClinicIds(clinicIds);
  };

  const selectAllClinics = () => {
    if (!canMultiSelect) return;
    setSelectedClinicIds(clinics.map(c => c.id));
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

  // Apply clinic brand colors to CSS variables whenever selected clinic changes
  useEffect(() => {
    const clinic = selectedClinics[0];
    const primary = clinic?.colors?.primary || '#438883';
    const secondary = clinic?.colors?.secondary || '#163C39';
    const hexToRgb = (hex: string) => {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? `${parseInt(r[1], 16)} ${parseInt(r[2], 16)} ${parseInt(r[3], 16)}` : '67 136 131';
    };
    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    document.documentElement.style.setProperty('--primary-rgb', hexToRgb(primary));
    document.documentElement.style.setProperty('--secondary-rgb', hexToRgb(secondary));
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


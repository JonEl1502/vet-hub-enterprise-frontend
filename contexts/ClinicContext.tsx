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
  colors?: {
    primary: string;
    secondary: string;
  };
  slogan?: string;
}

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
              fetchedClinics = response.data.clinics.map((clinic: any) => ({
                id: clinic.id,
                name: clinic.name,
                logo: clinic.logo || '',
                subdomain: clinic.subdomain || '',
                slogan: clinic.slogan || '',
                address: clinic.address || '',
                phone: clinic.phone || '',
                email: clinic.email || '',
                balance: clinic.balance || 0,
                rating: 4.5,
                currency: clinic.currency || 'KES',
                colors: {
                  primary: clinic.primaryColor || '#438883',
                  secondary: clinic.secondaryColor || '#163C39',
                },
                isActive: clinic.isActive !== undefined ? clinic.isActive : true,
                merchantId: clinic.merchantId,
                ownerId: clinic.ownerId || null,
                currentPlanId: null,
              }));
              console.log(`✅ SUPER_ADMIN: Loaded ${fetchedClinics.length} clinics from API`);
              setClinics(fetchedClinics);
            }
          } catch (error) {
            console.error('Failed to fetch all clinics for SUPER_ADMIN:', error);
            setClinics([]);
          }
        }
        // Regular users: get clinics from user associations
        else if (user.userClinics && user.userClinics.length > 0) {
          fetchedClinics = user.userClinics.map(uc => ({
            id: uc.clinic.id,
            name: uc.clinic.name,
            logo: uc.clinic.logo,
            subdomain: uc.clinic.subdomain,
            slogan: uc.clinic.slogan || '',
            address: uc.clinic.address || '',
            phone: uc.clinic.phone || '',
            email: uc.clinic.email || '',
            balance: uc.clinic.balance || 0,
            rating: 4.5, // Default rating
            currency: uc.clinic.currency || 'KES',
            colors: {
              primary: uc.clinic.primaryColor || '#438883',
              secondary: uc.clinic.secondaryColor || '#163C39',
            },
            isActive: uc.clinic.isActive !== undefined ? uc.clinic.isActive : true,
            merchantId: uc.clinic.merchantId,
            ownerId: uc.clinic.ownerId || null,
            currentPlanId: null, // TODO: Add this to backend if needed
          }));
          console.log(`✅ Loaded ${fetchedClinics.length} clinics from user object with full details`);
          setClinics(fetchedClinics);
        } else {
          // Fallback to cached data in localStorage
          const cachedClinics = localStorage.getItem('userClinics');
          if (cachedClinics) {
            fetchedClinics = JSON.parse(cachedClinics);
            console.log('📦 Using cached clinic data from localStorage');
            setClinics(fetchedClinics);
          } else {
            console.warn('No clinic data found in user object or localStorage');
            setClinics([]);
          }
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

        // Update local state
        setClinics(prev => prev.map(c =>
          c.id === clinicId
            ? {
                ...c,
                ...data,
                // Merge the updated data from API response
                ...(response.data.clinic || {})
              }
            : c
        ));
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
        // Transform clinic data to match frontend Clinic type
        const transformedClinics = response.data.clinics.map((clinic: any) => ({
          id: clinic.id,
          name: clinic.name,
          logo: clinic.logo,
          subdomain: clinic.subdomain,
          slogan: clinic.slogan || '',
          address: clinic.address || '',
          phone: clinic.phone || '',
          email: clinic.email || '',
          balance: clinic.balance || 0,
          rating: 4.5, // Default rating
          currency: clinic.currency || 'KES',
          colors: {
            primary: clinic.primaryColor || '#438883',
            secondary: clinic.secondaryColor || '#163C39',
          },
          isActive: clinic.isActive !== undefined ? clinic.isActive : true,
          merchantId: clinic.merchantId,
          ownerId: clinic.ownerId || null,
          currentPlanId: null, // TODO: Add this to backend if needed
        }));
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


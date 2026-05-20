import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authAPI } from '../services';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  customPermissions: string[];
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  userClinics: Array<{
    userId: string;
    clinicId: string;
    joinedAt: string;
    clinic: {
      id: string;
      name: string;
      logo: string;
      subdomain: string;
      primaryColor?: string;
      secondaryColor?: string;
      slogan?: string;
      address?: string;
      phone?: string;
      email?: string;
      currency?: string;
      balance?: number;
      isActive?: boolean;
      merchantId?: string;
      ownerId?: string;
    };
  }>;
  supplier?: {
    id: string;
    name: string;
    category?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    currency?: string;
    rating: number;
    isActive: boolean;
  };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { user: User; tokens: AuthTokens }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);
  // Tracks the role of the last active session so we can detect role switches on login
  const lastRoleRef = useRef<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    // Prevent duplicate initialization in React StrictMode
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const initializeAuth = async () => {
      try {
        const storedTokens = localStorage.getItem('authTokens');
        const storedUser = localStorage.getItem('authUser');

        if (storedTokens && storedUser) {
          const parsedTokens = JSON.parse(storedTokens);
          const parsedUser = JSON.parse(storedUser);

          setTokens(parsedTokens);
          setUser(parsedUser);

          // Verify token is still valid by fetching current user
          try {
            const response = await authAPI.getCurrentUser();
            if (response.data?.user) {
              const freshUser = response.data.user;
              setUser(freshUser);
              extractAndCacheClinicData(freshUser);
              const { userClinics: _uc, ...slimUser } = freshUser;
              safeSetItem('authUser', JSON.stringify(slimUser));
            }
          } catch (error) {
            // Token is invalid, clear auth state
            console.error('Token validation failed:', error);
            clearAuthState();
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const clearAuthState = () => {
    // Capture role before wiping — used by login() to detect role switches
    lastRoleRef.current = user?.role ?? null;
    setUser(null);
    setTokens(null);
    localStorage.removeItem('authTokens');
    localStorage.removeItem('authUser');
    localStorage.removeItem('authToken'); // Legacy token storage
    localStorage.removeItem('selectedClinicIds'); // Clear clinic selection
    localStorage.removeItem('hasCompletedInitialSelection'); // Clear initial selection flag
    localStorage.removeItem('userClinics'); // Clear cached clinic data
    console.log('🧹 Cleared all auth and clinic data from localStorage');
  };

  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`localStorage quota exceeded for key "${key}" — skipping cache`);
    }
  };

  const extractAndCacheClinicData = (userData: User) => {
    // Strip the heavy logo (often base64) to keep the cache small, but
    // include everything the Clinic Management form expects to read back.
    // Earlier shape was missing specialties/aiConfig/lat-lng/country-code
    // etc., so on a refresh the form rendered blank chips and empty
    // coordinates until the live fetch upgraded the in-memory state.
    const clinics = (userData.userClinics ?? [])
      .filter((uc) => uc && uc.clinic)
      .map((uc) => {
        const c: any = uc.clinic;
        return {
          id: c.id,
          name: c.name,
          subdomain: c.subdomain,
          primaryColor: c.primaryColor,
          secondaryColor: c.secondaryColor,
          slogan: c.slogan,
          address: c.address,
          phone: c.phone,
          email: c.email,
          currency: c.currency,
          balance: c.balance,
          isActive: c.isActive,
          merchantId: c.merchantId,
          ownerId: c.ownerId,
          parentClinicId: c.parentClinicId ?? null,
          isMain: c.isMain ?? !c.parentClinicId,
          currentPlanId: c.currentPlanId ?? null,
          specialties: c.specialties ?? [],
          aiConfig: c.aiConfig ?? null,
          latitude: c.latitude ?? null,
          longitude: c.longitude ?? null,
          countryCode: c.countryCode ?? null,
          dialCode: c.dialCode ?? null,
          region: c.region ?? null,
          timezone: c.timezone ?? null,
          rating: c.rating ?? 0,
        };
      });

    safeSetItem('userClinics', JSON.stringify(clinics));
    console.log(`✅ Cached ${clinics.length} clinics to localStorage from auth response`);
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const { user: userData, tokens: tokenData } = response.data;

      // Strip userClinics from the stored user — they're already cached separately
      const { userClinics: _uc, ...slimUser } = userData;

      // Persist to localStorage first so the page reload picks them up
      safeSetItem('authTokens', JSON.stringify(tokenData));
      safeSetItem('authUser', JSON.stringify(slimUser));
      safeSetItem('authToken', tokenData.accessToken); // For backward compatibility
      extractAndCacheClinicData(userData);

      // One-shot signal: explicit logins (vs. session restore on reload) always
      // land on the dashboard regardless of the previously-saved view or URL.
      try { sessionStorage.setItem('vethub_just_logged_in', '1'); } catch {}

      // If the user is switching roles (e.g. SUPPLIER → clinic user or vice-versa),
      // a hard reload is the cleanest way to flush all stale in-memory state
      // (contexts, data hooks, RTK caches, etc.) before the new session starts.
      if (lastRoleRef.current && lastRoleRef.current !== userData.role) {
        window.location.reload();
        return;
      }

      setUser(userData);
      setTokens(tokenData);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signup = async (data: { user: User; tokens: AuthTokens }) => {
    setUser(data.user);
    setTokens(data.tokens);

    const { userClinics: _uc, ...slimUser } = data.user;

    safeSetItem('authTokens', JSON.stringify(data.tokens));
    safeSetItem('authUser', JSON.stringify(slimUser));
    safeSetItem('authToken', data.tokens.accessToken); // For backward compatibility
    extractAndCacheClinicData(data.user);

    try { sessionStorage.setItem('vethub_just_logged_in', '1'); } catch {}
  };

  const logout = () => {
    clearAuthState();
  };

  const refreshSession = async () => {
    try {
      const response = await authAPI.refreshToken();
      const { tokens: newTokens } = response.data;

      setTokens(newTokens);
      localStorage.setItem('authTokens', JSON.stringify(newTokens));
      localStorage.setItem('authToken', newTokens.accessToken);
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearAuthState();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
    isLoading,
    login,
    signup,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


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
              setUser(response.data.user);
              localStorage.setItem('authUser', JSON.stringify(response.data.user));
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

  const extractAndCacheClinicData = (userData: User) => {
    // Extract clinic data from user.userClinics[].clinic
    const clinics = userData.userClinics.map(uc => ({
      id: uc.clinic.id,
      name: uc.clinic.name,
      logo: uc.clinic.logo,
      subdomain: uc.clinic.subdomain,
    }));

    // Cache clinic data in localStorage
    localStorage.setItem('userClinics', JSON.stringify(clinics));
    console.log(`✅ Cached ${clinics.length} clinics to localStorage from auth response`);
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const { user: userData, tokens: tokenData } = response.data;

      setUser(userData);
      setTokens(tokenData);

      // Store in localStorage
      localStorage.setItem('authTokens', JSON.stringify(tokenData));
      localStorage.setItem('authUser', JSON.stringify(userData));
      localStorage.setItem('authToken', tokenData.accessToken); // For backward compatibility

      // Extract and cache clinic data from user response
      extractAndCacheClinicData(userData);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signup = async (data: { user: User; tokens: AuthTokens }) => {
    setUser(data.user);
    setTokens(data.tokens);

    // Store in localStorage
    localStorage.setItem('authTokens', JSON.stringify(data.tokens));
    localStorage.setItem('authUser', JSON.stringify(data.user));
    localStorage.setItem('authToken', data.tokens.accessToken); // For backward compatibility

    // Extract and cache clinic data from user response
    extractAndCacheClinicData(data.user);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      clearAuthState();
    }
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


import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User } from '../types';
import { usersAPI } from '../services';
import { useClinic } from './ClinicContext';

interface StaffContextType {
  staff: User[];
  isLoading: boolean;
  error: string | null;
  refreshStaff: () => Promise<void>;
  addStaff: (staffMember: User) => void;
  updateStaff: (id: number, data: Partial<User>) => void;
  deleteStaff: (id: number) => void;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

export const useStaff = () => {
  const context = useContext(StaffContext);
  if (!context) {
    throw new Error('useStaff must be used within a StaffProvider');
  }
  return context;
};

interface StaffProviderProps {
  children: ReactNode;
}

export const StaffProvider: React.FC<StaffProviderProps> = ({ children }) => {
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedClinicIds } = useClinic();
  const lastFetchedClinicIds = useRef<string>('');

  const fetchStaff = async () => {
    if (selectedClinicIds.length === 0) {
      console.log('⏸️ No clinics selected, skipping staff fetch');
      setStaff([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching staff from API...');
      
      const response: any = await usersAPI.getAll({ showError: false });
      
      if (response.success && response.data.users) {
        const transformedStaff = response.data.users.map((user: any) => ({
          id: parseInt(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          idNumber: user.idNumber || '',
          dob: user.dob || '',
          age: user.age,
          certifications: user.certifications || [],
          customPermissions: user.customPermissions || [],
          clinicIds: user.clinicIds.map((id: string) => parseInt(id)),
          isActive: user.isActive,
          phone: user.phone || '',
        }));
        
        console.log(`✅ Loaded ${transformedStaff.length} staff members from API`);
        setStaff(transformedStaff);
      } else {
        console.error('❌ Failed to fetch staff:', response);
        setError('Failed to fetch staff');
      }
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      if (status === 403) {
        // User doesn't have permission to list staff — fail silently
        console.warn('⚠️ No permission to fetch staff (403), skipping');
        setStaff([]);
      } else {
        console.error('❌ Error fetching staff:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStaff = async () => {
    await fetchStaff();
  };

  const addStaff = (staffMember: User) => {
    setStaff(prev => [...prev, staffMember]);
  };

  const updateStaff = (id: number, data: Partial<User>) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  const deleteStaff = (id: number) => {
    setStaff(prev => prev.filter(s => s.id !== id));
  };

  // Fetch staff when selected clinics change
  useEffect(() => {
    if (selectedClinicIds.length === 0) return;

    const clinicIdsKey = selectedClinicIds.join(',');

    // Prevent duplicate fetches for the same clinic selection
    if (lastFetchedClinicIds.current === clinicIdsKey) return;

    lastFetchedClinicIds.current = clinicIdsKey;
    fetchStaff();
  }, [selectedClinicIds.join(',')]);

  const value: StaffContextType = {
    staff,
    isLoading,
    error,
    refreshStaff,
    addStaff,
    updateStaff,
    deleteStaff,
  };

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
};


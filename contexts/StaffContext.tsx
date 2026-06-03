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
      
      // cache: false — the api-client cache is keyed only by URL, so it
      // would happily serve clinic A's response while you're scoped to
      // clinic B. We rely on sessionStorage (clinic-keyed) for warm reads.
      const response: any = await usersAPI.getAll({ showError: false, cache: false });
      
      if (response.success && response.data.users) {
        const transformedStaff = response.data.users.map((user: any) => ({
          id: parseInt(user.id),
          name: user.name,
          // Identity fields preserved so the edit form can pre-fill — the
          // backend splits the name into title/first/second/surname and
          // returns each piece; dropping them here was making the edit
          // dialog open with empty name inputs.
          title: user.title || '',
          firstName: user.firstName || '',
          secondName: user.secondName || '',
          surname: user.surname || '',
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

        // Persist to sessionStorage (15-min TTL)
        try {
          const clinicKey = selectedClinicIds.join(',');
          sessionStorage.setItem(`vethub_staff_v3_${clinicKey}`, JSON.stringify({ data: transformedStaff, ts: Date.now() }));
        } catch {}
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

  // Wipe every cached clinic's staff list. We call this on any write so a
  // staff member moved from clinic A → B doesn't keep showing up under A's
  // tab — the sessionStorage entry for A is now stale and switching back
  // would otherwise serve it for up to 15 minutes.
  const clearAllStaffCaches = () => {
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('vethub_staff_')) sessionStorage.removeItem(k);
      });
    } catch {}
  };

  const refreshStaff = async () => {
    clearAllStaffCaches();
    await fetchStaff();
  };

  const addStaff = (staffMember: User) => {
    clearAllStaffCaches();
    setStaff(prev => [...prev, staffMember]);
  };

  const updateStaff = (id: number, data: Partial<User>) => {
    clearAllStaffCaches();
    // If the staff was moved off the currently-viewed clinic(s), drop them
    // from the in-memory list immediately. Otherwise merge the patch.
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...data } : s).filter(s => {
      if (s.id !== id) return true;
      if (!data.clinicIds || selectedClinicIds.length === 0) return true;
      const viewing = new Set(selectedClinicIds.map(x => Number(x)));
      return data.clinicIds.some(cid => viewing.has(Number(cid)));
    }));
  };

  const deleteStaff = (id: number) => {
    clearAllStaffCaches();
    setStaff(prev => prev.filter(s => s.id !== id));
  };

  // Fetch staff when selected clinics change — sessionStorage serves browser refreshes within 15 min
  useEffect(() => {
    if (selectedClinicIds.length === 0) return;
    const clinicKey = selectedClinicIds.join(',');
    if (lastFetchedClinicIds.current === clinicKey) return;

    // Restore from sessionStorage (15-min TTL)
    try {
      const raw = sessionStorage.getItem(`vethub_staff_v3_${clinicKey}`);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < 15 * 60 * 1000) {
          setStaff(data);
          setIsLoading(false);
          lastFetchedClinicIds.current = clinicKey;
          return;
        }
      }
    } catch {}

    lastFetchedClinicIds.current = clinicKey;
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


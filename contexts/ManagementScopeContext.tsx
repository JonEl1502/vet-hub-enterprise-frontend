import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Holds the SINGLE entity an admin is actively managing (clinic or supplier),
// independent of the sidebar multi-select (selectedClinicIds/selectedSupplierIds).
// The ManagingSwitcher mirrors the active id into localStorage override keys
// (vethub_manage_clinic_id / vethub_manage_supplier_id) which the axios
// interceptor reads to scope management-page requests to that one entity —
// WITHOUT changing the sidebar selection. Overrides are set while a switcher is
// mounted (i.e. on a management page) and cleared on unmount.

export const MANAGE_CLINIC_KEY = 'vethub_manage_clinic_id';
export const MANAGE_SUPPLIER_KEY = 'vethub_manage_supplier_id';

interface ManagementScopeContextType {
  managedClinicId: string | null;
  managedSupplierId: string | null;
  setManagedClinic: (id: string | null) => void;
  setManagedSupplier: (id: string | null) => void;
}

const ManagementScopeContext = createContext<ManagementScopeContextType | undefined>(undefined);

export const useManagementScope = () => {
  const ctx = useContext(ManagementScopeContext);
  if (!ctx) throw new Error('useManagementScope must be used within a ManagementScopeProvider');
  return ctx;
};

export const ManagementScopeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [managedClinicId, setManagedClinicIdState] = useState<string | null>(null);
  const [managedSupplierId, setManagedSupplierIdState] = useState<string | null>(null);

  const setManagedClinic = useCallback((id: string | null) => {
    setManagedClinicIdState(id);
    try {
      if (id) localStorage.setItem(MANAGE_CLINIC_KEY, id);
      else localStorage.removeItem(MANAGE_CLINIC_KEY);
    } catch { /* ignore */ }
  }, []);

  const setManagedSupplier = useCallback((id: string | null) => {
    setManagedSupplierIdState(id);
    try {
      if (id) localStorage.setItem(MANAGE_SUPPLIER_KEY, id);
      else localStorage.removeItem(MANAGE_SUPPLIER_KEY);
    } catch { /* ignore */ }
  }, []);

  return (
    <ManagementScopeContext.Provider value={{ managedClinicId, managedSupplierId, setManagedClinic, setManagedSupplier }}>
      {children}
    </ManagementScopeContext.Provider>
  );
};

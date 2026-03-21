import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supplierBranchesAPI, SupplierBranch } from '../services/modules/supplierBranches.api';

interface SupplierBranchContextValue {
  branches: SupplierBranch[];
  activeBranchIds: string[];
  setActiveBranchIds: (ids: string[]) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SupplierBranchContext = createContext<SupplierBranchContextValue>({
  branches: [],
  activeBranchIds: [],
  setActiveBranchIds: () => {},
  loading: false,
  refresh: async () => {},
});

export const useSupplierBranch = () => useContext(SupplierBranchContext);

export const SupplierBranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<SupplierBranch[]>([]);
  const [activeBranchIds, setActiveBranchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (user?.role !== 'SUPPLIER') return;
    setLoading(true);
    try {
      const res = await supplierBranchesAPI.getMyBranches();
      const all = res.data.branches || [];
      // Filter out the main supplier entry (prepended by backend with isMain: true)
      // The main branch is rendered separately from user.supplier in the UI
      const fetched = all.filter((b) => !b.isMain);
      setBranches(fetched);
      // Default: main branch + all additional branches active
      setActiveBranchIds(['__main__', ...fetched.map((b) => b.id)]);
    } catch {
      // non-throwing
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SupplierBranchContext.Provider value={{ branches, activeBranchIds, setActiveBranchIds, loading, refresh }}>
      {children}
    </SupplierBranchContext.Provider>
  );
};

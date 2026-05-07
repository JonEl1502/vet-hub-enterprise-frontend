import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { suppliersAPI } from '../services/modules/suppliers.api';
import type { Supplier } from '../services/modules/suppliers.api';

/**
 * SupplierContext mirrors ClinicContext's role for admin users browsing
 * suppliers. SUPPLIER-role users are auto-scoped server-side and don't
 * need a list to switch between, so the provider is a no-op for them.
 *
 * Selection persists in localStorage under `selectedSupplierIds` — the
 * axios interceptor picks it up and emits the X-Supplier-Id(s) header on
 * every request. Empty array = "All Suppliers" (admin platform-wide view).
 */

interface SupplierContextType {
  suppliers: Supplier[];
  selectedSupplierIds: string[];
  selectedSuppliers: Supplier[];
  isLoading: boolean;
  canMultiSelect: boolean;
  selectSupplier: (id: string) => void;
  toggleSupplier: (id: string) => void;
  selectMultipleSuppliers: (ids: string[]) => void;
  selectAllSuppliers: () => void;
  clearSelection: () => void;
  refreshSuppliers: () => Promise<void>;
}

const SupplierContext = createContext<SupplierContextType | undefined>(undefined);

export const useSupplier = () => {
  const ctx = useContext(SupplierContext);
  if (!ctx) throw new Error('useSupplier must be used within a SupplierProvider');
  return ctx;
};

const readSelection = (): string[] => {
  try {
    const raw = localStorage.getItem('selectedSupplierIds');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
};

const writeSelection = (ids: string[]) => {
  try { localStorage.setItem('selectedSupplierIds', JSON.stringify(ids)); } catch {}
};

interface SupplierProviderProps {
  children: ReactNode;
}

export const SupplierProvider: React.FC<SupplierProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(() => readSelection());
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchedUserId = useRef<string | null>(null);

  const role = user?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'MERCHANT_ADMIN';
  // Multi-select is meaningful for admins; SUPPLIER users are pinned to
  // their own supplier server-side, so the toggle is irrelevant.
  const canMultiSelect = isAdmin;

  // Fetch supplier roster for admins on auth. SUPPLIER role doesn't need
  // a list — the backend auto-resolves their supplier via extractSupplierContext.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSuppliers([]);
      return;
    }
    if (!isAdmin) {
      // No list needed for non-admins — but keep the persisted selection
      // intact so axios interceptor behaviour is unchanged.
      return;
    }
    const cacheKey = `${user.id}:${role}`;
    if (lastFetchedUserId.current === cacheKey) return;

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const res: any = await suppliersAPI.getAll({ limit: 500 } as any);
        if (cancelled) return;
        const data = (res?.data?.data || res?.data?.suppliers || []) as Supplier[];
        setSuppliers(data);
        lastFetchedUserId.current = cacheKey;

        // Drop stale IDs that no longer exist (e.g. supplier deleted in the
        // meantime). Don't auto-pick — empty stays empty (= "All").
        const validIds = new Set(data.map(s => String(s.id)));
        const cleaned = selectedSupplierIds.filter(id => validIds.has(id));
        if (cleaned.length !== selectedSupplierIds.length) {
          setSelectedSupplierIds(cleaned);
          writeSelection(cleaned);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[SupplierContext] Failed to load supplier roster:', err);
          setSuppliers([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // selectedSupplierIds intentionally omitted — we reconcile inside the
    // fetch, and including it would re-fetch on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, isAdmin]);

  const apply = (ids: string[]) => {
    writeSelection(ids);
    setSelectedSupplierIds(ids);
  };

  const selectSupplier = (id: string) => apply([id]);

  const toggleSupplier = (id: string) => {
    if (!canMultiSelect) { apply([id]); return; }
    const next = selectedSupplierIds.includes(id)
      ? selectedSupplierIds.filter(x => x !== id)
      : [...selectedSupplierIds, id];
    apply(next);
  };

  const selectMultipleSuppliers = (ids: string[]) => {
    apply(canMultiSelect ? ids : ids.slice(0, 1));
  };

  const selectAllSuppliers = () => {
    // For admins, "All" is canonically represented by an empty list — the
    // backend treats a missing X-Supplier-Id(s) header as "every supplier".
    apply([]);
  };

  const clearSelection = () => apply([]);

  const refreshSuppliers = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const res: any = await suppliersAPI.getAll({ limit: 500 } as any);
      const data = (res?.data?.data || res?.data?.suppliers || []) as Supplier[];
      setSuppliers(data);
    } catch (err) {
      console.error('[SupplierContext] refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSuppliers = suppliers.filter(s => selectedSupplierIds.includes(String(s.id)));

  // ── Theme propagation ──────────────────────────────────────────────────
  // When the supplier "owns" the theme (SUPPLIER role, or admin in supplier
  // audience with a single supplier in scope), push the supplier's
  // primaryColor / secondaryColor onto the document root CSS vars. Every
  // seafoam/pine Tailwind class reads from those vars (see tailwind.config.js)
  // so this single write re-themes the entire UI — ambience, highlights,
  // gradients, focus rings, badges.
  //
  // ClinicContext writes the same vars; we set a marker attribute when our
  // theme is active so clinic stands down. Audience switches in the sidebar
  // dispatch an `audience-change` event we listen for, so theme can
  // re-apply / relinquish without reloading.
  useEffect(() => {
    const hexToRgb = (hex: string): string => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : '67 136 131';
    };

    const applyTheme = () => {
      const audience = (() => {
        try { return localStorage.getItem('vethub_sidebar_audience'); } catch { return null; }
      })();

      // Resolve the supplier whose brand should be applied right now.
      let activeSupplier: { primaryColor?: string | null; secondaryColor?: string | null } | undefined;
      if (role === 'SUPPLIER' && (user as any)?.supplier) {
        activeSupplier = (user as any).supplier;
      } else if (isAdmin && audience === 'supplier') {
        if (selectedSupplierIds.length === 1) {
          activeSupplier = suppliers.find(s => String(s.id) === selectedSupplierIds[0]);
        } else if ((user as any)?.supplier) {
          activeSupplier = (user as any).supplier;
        }
      }

      const root = document.documentElement;

      if (!activeSupplier) {
        // Relinquish theme so ClinicContext can re-stamp on its next render.
        // Removing inline styles falls back to index.css's :root defaults
        // until clinic effect runs.
        if (root.getAttribute('data-supplier-theme') === 'active') {
          root.style.removeProperty('--primary-color');
          root.style.removeProperty('--secondary-color');
          root.style.removeProperty('--primary-rgb');
          root.style.removeProperty('--secondary-rgb');
          root.removeAttribute('data-supplier-theme');
        }
        return;
      }

      const primary = activeSupplier.primaryColor || '#438883';
      const secondary = activeSupplier.secondaryColor || '#163C39';
      root.style.setProperty('--primary-color', primary);
      root.style.setProperty('--secondary-color', secondary);
      root.style.setProperty('--primary-rgb', hexToRgb(primary));
      root.style.setProperty('--secondary-rgb', hexToRgb(secondary));
      root.setAttribute('data-supplier-theme', 'active');
    };

    applyTheme();
    const onAudienceChange = () => applyTheme();
    window.addEventListener('audience-change', onAudienceChange);
    return () => window.removeEventListener('audience-change', onAudienceChange);
  }, [role, isAdmin, user, selectedSupplierIds, suppliers]);

  const value: SupplierContextType = {
    suppliers,
    selectedSupplierIds,
    selectedSuppliers,
    isLoading,
    canMultiSelect,
    selectSupplier,
    toggleSupplier,
    selectMultipleSuppliers,
    selectAllSuppliers,
    clearSelection,
    refreshSuppliers,
  };

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>;
};

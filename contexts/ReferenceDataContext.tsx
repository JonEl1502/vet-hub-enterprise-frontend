import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useClinic } from './ClinicContext';

interface Species {
  id: number;
  name: string;
  isApproved: boolean;
}

interface Breed {
  id: number;
  name: string;
  speciesId: number;
  isApproved: boolean;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  isApproved: boolean;
  /** Per-clinic catalog flags (from /categories/catalog/list). */
  enabled?: boolean;
  isGlobal?: boolean;
}

interface Service {
  id: number;
  name: string;
  description?: string;
  categoryId: number;
  /** Effective (clinic-resolved) price — override falls back to default. */
  defaultPrice?: number;
  isApproved: boolean;
  /** Per-clinic catalog flags (from /services/catalog). */
  enabled?: boolean;
  isGlobal?: boolean;
}

interface Drug {
  id: number;
  name: string;
  genericName?: string;
  category: string;
  species: string[];
  unit: string;
}

interface PaymentMethod {
  value: string;
  label: string;
}

interface ReferenceDataContextType {
  species: Species[];
  breeds: Breed[];
  categories: Category[];
  services: Service[];
  drugCategories: string[];
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  /** Active clinic's catalog scope — drives which categories/services staff pick from. */
  catalogScope: 'ALL' | 'GENERAL' | 'CUSTOM';
  refreshReferenceData: () => Promise<void>;
  getBreedsBySpecies: (speciesId: number) => Breed[];
  getServicesByCategory: (categoryId: number) => Service[];
  searchDrugs: (query: string, category?: string) => Promise<Drug[]>;
}

const ReferenceDataContext = createContext<ReferenceDataContextType | undefined>(undefined);

export const useReferenceData = () => {
  const context = useContext(ReferenceDataContext);
  if (!context) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider');
  }
  return context;
};

interface ReferenceDataProviderProps {
  children: ReactNode;
}

export const ReferenceDataProvider: React.FC<ReferenceDataProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { selectedClinicIds, selectedClinics } = useClinic();
  // Scope is read live (not cached with the data) so flipping it on the Services
  // tab reflects immediately in the appointment builder without a re-fetch.
  const catalogScope = (((selectedClinics?.[0] as any)?.catalogScope) ?? 'ALL') as 'ALL' | 'GENERAL' | 'CUSTOM';
  const [species, setSpecies] = useState<Species[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [paymentMethods] = useState<PaymentMethod[]>([
    { value: 'M_PESA', label: 'M-PESA' },
    { value: 'CARD', label: 'Card' },
    { value: 'CASH', label: 'Cash' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  ]);
  const [drugCategories, setDrugCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchedKey = useRef('');
  const REF_STALE_MS = 60 * 60 * 1000; // 1 hour — reference data rarely changes

  const fetchReferenceData = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) return;

    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const [speciesRes, breedsRes, categoriesRes, servicesRes, drugCatsRes] = await Promise.all([
        fetch(`${baseUrl}/species`, { headers }),
        fetch(`${baseUrl}/breeds`, { headers }),
        fetch(`${baseUrl}/categories/catalog/list`, { headers }),
        fetch(`${baseUrl}/services/catalog`, { headers }),
        fetch(`${baseUrl}/drugs/categories`),  // Public — no auth needed
      ]);

      let newSpecies: Species[] = [];
      let newBreeds: Breed[] = [];
      let newCategories: Category[] = [];
      let newServices: Service[] = [];
      let newDrugCats: string[] = [];

      if (speciesRes.ok) {
        const d = await speciesRes.json();
        if (d.success && d.data.species) newSpecies = d.data.species.map((s: any) => ({ id: parseInt(s.id), name: s.name, isApproved: s.isApproved }));
      }
      if (breedsRes.ok) {
        const d = await breedsRes.json();
        if (d.success && d.data.breeds) newBreeds = d.data.breeds.map((b: any) => ({ id: parseInt(b.id), name: b.name, speciesId: parseInt(b.speciesId), isApproved: b.isApproved }));
      }
      if (categoriesRes.ok) {
        const d = await categoriesRes.json();
        // /categories/catalog/list → { categories: [{ id, name, description, isGlobal, enabled }] }
        if (d.success && d.data.categories) newCategories = d.data.categories.map((c: any) => ({ id: parseInt(c.id), name: c.name, description: c.description, isApproved: !!c.isGlobal, isGlobal: !!c.isGlobal, enabled: c.enabled !== false }));
      }
      if (servicesRes.ok) {
        const d = await servicesRes.json();
        // /services/catalog → enabled-only services with clinic-resolved priceEffective.
        if (d.success && d.data.services) newServices = d.data.services.map((s: any) => {
          const eff = s.priceEffective ?? s.defaultPrice;
          return { id: parseInt(s.id), name: s.name, description: s.description, categoryId: parseInt(s.categoryId), defaultPrice: eff != null ? parseFloat(eff) : undefined, isApproved: !!s.isGlobal, isGlobal: !!s.isGlobal, enabled: s.enabled !== false };
        });
      }
      if (drugCatsRes.ok) {
        const d = await drugCatsRes.json();
        if (d.success && d.data.categories) newDrugCats = d.data.categories;
      }

      setSpecies(newSpecies);
      setBreeds(newBreeds);
      setCategories(newCategories);
      setServices(newServices);
      setDrugCategories(newDrugCats);

      // Persist to sessionStorage so browser refresh doesn't re-fetch within TTL
      try {
        const clinicKey = selectedClinicIds.join(',');
        sessionStorage.setItem(`vethub_refdata_${clinicKey}`, JSON.stringify({
          data: { species: newSpecies, breeds: newBreeds, categories: newCategories, services: newServices, drugCategories: newDrugCats },
          ts: Date.now(),
        }));
      } catch {}

      console.log('✅ Reference data loaded successfully');
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fire once per clinic context — sessionStorage serves subsequent refreshes within TTL
  useEffect(() => {
    if (!isAuthenticated || selectedClinicIds.length === 0) return;
    const clinicKey = selectedClinicIds.join(',');

    // Already loaded for this clinic selection in this session
    if (lastFetchedKey.current === clinicKey) return;

    // Try sessionStorage cache (1-hour TTL) before hitting the network
    try {
      const raw = sessionStorage.getItem(`vethub_refdata_${clinicKey}`);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < REF_STALE_MS) {
          setSpecies(data.species);
          setBreeds(data.breeds);
          setCategories(data.categories);
          setServices(data.services);
          if (data.drugCategories) setDrugCategories(data.drugCategories);
          lastFetchedKey.current = clinicKey;
          return;
        }
      }
    } catch {}

    lastFetchedKey.current = clinicKey;
    fetchReferenceData();
  }, [isAuthenticated, selectedClinicIds.join(',')]);

  const getBreedsBySpecies = (speciesId: number): Breed[] => {
    return breeds.filter(b => b.speciesId === speciesId);
  };

  // Scope gate: GENERAL = approved global catalog only; CUSTOM = clinic's
  // selected (enabled) global + its own custom; ALL = both.
  const inScopeCategory = (c: Category): boolean =>
    catalogScope === 'GENERAL' ? c.isGlobal !== false
    : catalogScope === 'CUSTOM' ? (c.enabled === true || c.isGlobal === false)
    : true;

  const scopedCategories = categories.filter(inScopeCategory);

  const getServicesByCategory = (categoryId: number): Service[] => {
    return services.filter(s =>
      s.categoryId === categoryId &&
      (catalogScope !== 'GENERAL' || s.isGlobal !== false)
    );
  };

  /** Search drugs via API (debounced on caller side). Returns up to 50 matches. */
  const searchDrugs = async (query: string, category?: string): Promise<Drug[]> => {
    if (!query || query.length < 2) return [];
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
      const params = new URLSearchParams({ search: query });
      if (category) params.append('category', category);
      const res = await fetch(`${baseUrl}/drugs?${params}`);
      if (!res.ok) return [];
      const d = await res.json();
      if (d.success && d.data.drugs) {
        return d.data.drugs.map((drug: any) => ({
          id: parseInt(drug.id),
          name: drug.name,
          genericName: drug.genericName,
          category: drug.category,
          species: drug.species || [],
          unit: drug.unit,
        }));
      }
    } catch {
      // Non-fatal — drug search is supplementary
    }
    return [];
  };

  const value: ReferenceDataContextType = {
    species,
    breeds,
    categories: scopedCategories,
    services,
    drugCategories,
    paymentMethods,
    isLoading,
    catalogScope,
    refreshReferenceData: fetchReferenceData,
    getBreedsBySpecies,
    getServicesByCategory,
    searchDrugs,
  };

  return <ReferenceDataContext.Provider value={value}>{children}</ReferenceDataContext.Provider>;
};


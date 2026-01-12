import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

interface Service {
  id: number;
  name: string;
  description?: string;
  categoryId: number;
  defaultPrice?: number;
  isApproved: boolean;
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
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  refreshReferenceData: () => Promise<void>;
  getBreedsBySpecies: (speciesId: number) => Breed[];
  getServicesByCategory: (categoryId: number) => Service[];
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
  const { selectedClinicIds } = useClinic();
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
  const [isLoading, setIsLoading] = useState(false);

  const fetchReferenceData = async () => {
    if (!isAuthenticated || selectedClinicIds.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // Fetch species
      const speciesResponse = await fetch(`${baseUrl}/species`, { headers });
      if (speciesResponse.ok) {
        const speciesData = await speciesResponse.json();
        if (speciesData.success && speciesData.data.species) {
          setSpecies(speciesData.data.species.map((s: any) => ({
            id: parseInt(s.id),
            name: s.name,
            isApproved: s.isApproved,
          })));
        }
      }

      // Fetch breeds
      const breedsResponse = await fetch(`${baseUrl}/breeds`, { headers });
      if (breedsResponse.ok) {
        const breedsData = await breedsResponse.json();
        if (breedsData.success && breedsData.data.breeds) {
          setBreeds(breedsData.data.breeds.map((b: any) => ({
            id: parseInt(b.id),
            name: b.name,
            speciesId: parseInt(b.speciesId),
            isApproved: b.isApproved,
          })));
        }
      }

      // Fetch categories
      const categoriesResponse = await fetch(`${baseUrl}/categories`, { headers });
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        if (categoriesData.success && categoriesData.data.categories) {
          setCategories(categoriesData.data.categories.map((c: any) => ({
            id: parseInt(c.id),
            name: c.name,
            description: c.description,
            isApproved: c.isApproved,
          })));
        }
      }

      // Fetch services
      const servicesResponse = await fetch(`${baseUrl}/services`, { headers });
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        if (servicesData.success && servicesData.data.services) {
          setServices(servicesData.data.services.map((s: any) => ({
            id: parseInt(s.id),
            name: s.name,
            description: s.description,
            categoryId: parseInt(s.categoryId),
            defaultPrice: s.defaultPrice ? parseFloat(s.defaultPrice) : undefined,
            isApproved: s.isApproved,
          })));
        }
      }

      console.log('✅ Reference data loaded successfully');
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReferenceData();
  }, [isAuthenticated, selectedClinicIds]);

  const getBreedsBySpecies = (speciesId: number): Breed[] => {
    return breeds.filter(b => b.speciesId === speciesId);
  };

  const getServicesByCategory = (categoryId: number): Service[] => {
    return services.filter(s => s.categoryId === categoryId);
  };

  const value: ReferenceDataContextType = {
    species,
    breeds,
    categories,
    services,
    paymentMethods,
    isLoading,
    refreshReferenceData: fetchReferenceData,
    getBreedsBySpecies,
    getServicesByCategory,
  };

  return <ReferenceDataContext.Provider value={value}>{children}</ReferenceDataContext.Provider>;
};



import React, { useState, useMemo, useEffect } from 'react';
import { Search, PawPrint, ArrowRight, X, Heart, Scale, Info, Plus, User as UserIcon, Calendar, Tag, Cpu, ChevronDown, Loader2 } from 'lucide-react';
import { Client, Pet } from '../types';
import SearchableDropdown from './SearchableDropdown';
import { petsAPI, clientsAPI } from '../services';
import { useClinic } from '../contexts/ClinicContext';
import { useData } from '../contexts/DataContext';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  clients?: Client[];
  onSave?: (data: Omit<Pet, 'id' | 'medicalHistory' | 'vaccinations'>) => void;
  onCancel: () => void;
  clinicId?: number;
  onGoToNewClient: () => void;
  initialClientId?: number | null;
}

const UNIT_OPTIONS = ['kg', 'lb', 'g', 'tons'];

const RegisterPetView: React.FC<Props> = ({ clients: propClients, onSave, onCancel, clinicId, onGoToNewClient, initialClientId }) => {
  const { selectedClinicIds } = useClinic();
  const { clients, addPetOptimistically } = useData();
  const { species: apiSpecies, breeds: apiBreeds, getBreedsBySpecies, isLoading: isLoadingRefData } = useReferenceData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId || null);
  const [isUnitOpen, setIsUnitOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', species: 'Dog', breed: 'Mixed Breed', gender: 'Male' as const,
    dob: new Date().toISOString().split('T')[0],
    weight: '0.00',
    weightUnit: 'kg',
    rfidChipNumber: '', tagNumber: ''
  });

  // Convert API species to dropdown format
  const speciesOptions = useMemo(() => {
    return apiSpecies.map(s => s.name);
  }, [apiSpecies]);

  // Get breeds for selected species
  const breedOptions = useMemo(() => {
    const selectedSpecies = apiSpecies.find(s => s.name === formData.species);
    if (!selectedSpecies) return ['Mixed Breed'];

    const breedsForSpecies = getBreedsBySpecies(selectedSpecies.id);
    const breedNames = breedsForSpecies.map(b => b.name);

    return breedNames.length > 0 ? breedNames : ['Mixed Breed'];
  }, [apiSpecies, formData.species, getBreedsBySpecies]);

  const [apiClientResults, setApiClientResults] = useState<Client[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  const localFilteredClients = useMemo(() => {
    if (searchQuery.length < 3) return [];
    return clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery));
  }, [clients, searchQuery]);

  // API fallback when local search returns nothing
  useEffect(() => {
    if (searchQuery.length < 3 || localFilteredClients.length > 0) {
      setApiClientResults([]);
      setIsSearchingApi(false);
      return;
    }
    setIsSearchingApi(true);
    const timer = setTimeout(async () => {
      try {
        const res = await clientsAPI.getAll({ page: 1, limit: 10, search: searchQuery }, { cache: false });
        if (res.success && res.data?.clients) {
          setApiClientResults(res.data.clients.map((c: any) => ({
            ...c,
            id: typeof c.id === 'string' ? parseInt(c.id) : c.id,
            avatar: String(c.avatarUrl || c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`),
          } as unknown as Client)));
        } else {
          setApiClientResults([]);
        }
      } catch {
        setApiClientResults([]);
      } finally {
        setIsSearchingApi(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, localFilteredClients.length]);

  const filteredClients = useMemo(() => {
    return localFilteredClients.length > 0 ? localFilteredClients : apiClientResults;
  }, [localFilteredClients, apiClientResults]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError('Please select a client/owner');
      return;
    }

    // Validate weight
    const weightValue = parseFloat(formData.weight);
    if (isNaN(weightValue) || weightValue <= 0) {
      setError('Please enter a valid weight greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const activeClinicId = clinicId || selectedClinicIds[0];

      if (!activeClinicId) {
        throw new Error('No clinic selected');
      }

      const petData = {
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        gender: formData.gender,
        dob: new Date(formData.dob).toISOString(),
        weightValue: weightValue,
        weightUnit: formData.weightUnit,
        rfidChipNumber: formData.rfidChipNumber || undefined,
        tagNumber: formData.tagNumber || undefined,
        ownerId: selectedClientId,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${formData.name}`,
      };

      const response: any = await petsAPI.create(petData);

      if (response.success) {
        const p = response.data.pet;
        const birthDate = new Date(formData.dob);
        const age = new Date().getFullYear() - birthDate.getFullYear();

        // Append returned record directly — no GET needed
        addPetOptimistically({
          id: parseInt(p.id),
          clinicId: parseInt(p.clinicId),
          ownerId: parseInt(p.ownerId),
          name: p.name,
          species: p.species,
          breed: p.breed,
          gender: p.gender,
          dob: p.dob || formData.dob,
          age: p.age ?? age,
          weight: p.weightValue != null ? `${p.weightValue}${p.weightUnit || 'kg'}` : `${formData.weight}${formData.weightUnit}`,
          rfidChipNumber: p.rfidChipNumber || formData.rfidChipNumber || undefined,
          tagNumber: p.tagNumber || formData.tagNumber || undefined,
          avatar: p.avatarUrl || petData.avatarUrl,
          medicalHistory: [],
          vaccinations: [],
        });

        if (onSave) {
          onSave({
            ...formData,
            age,
            weight: `${formData.weight}${formData.weightUnit}`,
            clinicId: parseInt(String(activeClinicId)),
            ownerId: selectedClientId,
            avatar: petData.avatarUrl,
          });
        } else {
          onCancel();
        }
      } else {
        throw new Error(response.message || 'Failed to create pet');
      }
    } catch (err: any) {
      console.error('Failed to create pet:', err);
      setError(err.message || 'Failed to create pet. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const WeightInput = () => (
    <div className="space-y-1 relative">
       <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Weight</label>
       <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-inner">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="flex-1 bg-transparent font-mono font-black text-pine dark:text-zinc-100 outline-none text-base"
            value={formData.weight}
            onChange={e => setFormData({...formData, weight: e.target.value})}
            required
          />
          <div className="relative" onMouseEnter={() => setIsUnitOpen(true)} onMouseLeave={() => setIsUnitOpen(false)}>
             <button type="button" className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-700 rounded-xl text-[10px] font-black uppercase text-seafoam">
               {formData.weightUnit} <ChevronDown size={12}/>
             </button>
             {isUnitOpen && (
               <div className="absolute top-full right-0 mt-1 w-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-1 animate-in zoom-in-95">
                  {UNIT_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => { setFormData({...formData, weightUnit: opt}); setIsUnitOpen(false); }} className={`w-full text-left py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.weightUnit === opt ? 'bg-seafoam text-white' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>
                      {opt}
                    </button>
                  ))}
               </div>
             )}
          </div>
       </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-300 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
      {isSubmitting && <LoadingSpinner fullScreen message="Registering patient..." />}
      <header className="flex items-center justify-between py-4 mb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Register Patient</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold mt-1 uppercase tracking-widest text-[9px]">Add New Entry</p>
        </div>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-pine"><X size={20}/></button>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
           {!selectedClientId ? (
             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <UserIcon size={18} className="text-indigo-500"/>
                    <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Select Owner</h2>
                  </div>
                  <button type="button" onClick={onGoToNewClient} className="text-[9px] font-black text-seafoam uppercase tracking-widest hover:underline">+ Create New</button>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                  <input className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-12 pr-10 py-3 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="Search (3+ chars)..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {isSearchingApi && <Loader2 size={14} className="absolute right-10 top-1/2 -translate-y-1/2 text-seafoam animate-spin" />}
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                  {isSearchingApi ? (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <Loader2 size={16} className="animate-spin text-seafoam" />
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Searching...</p>
                    </div>
                  ) : filteredClients.length > 0 ? (
                    filteredClients.map(c => (
                      <button key={c.id} type="button" onClick={() => setSelectedClientId(c.id)} className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-seafoam transition-all group">
                        <div className="flex items-center gap-3">
                          <img src={c.avatar} className="w-8 h-8 rounded-lg" alt="" />
                          <div className="text-left">
                            <p className="text-pine dark:text-zinc-100 font-bold text-xs uppercase">{c.name}</p>
                            <p className="text-slate-400 text-[8px] font-bold uppercase">{c.phone}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-slate-200 group-hover:text-seafoam" />
                      </button>
                    ))
                  ) : searchQuery.length >= 3 ? (
                    <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest py-6">No clients found</p>
                  ) : null}
                </div>
             </div>
           ) : (
             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Heart size={20} className="text-seafoam"/>
                    <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Patient Data</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedClientId(null)} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Name</label>
                    <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="Simba" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Gender</label>
                    <select className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold text-sm outline-none appearance-none" value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value as any})}>
                      <option value="Male">Male</option><option value="Female">Female</option>
                    </select>
                  </div>
                  <SearchableDropdown
                    label="Species"
                    options={speciesOptions.length > 0 ? speciesOptions : ['Dog', 'Cat']}
                    value={formData.species}
                    onChange={val => {
                      const firstBreed = breedOptions[0] || 'Mixed Breed';
                      setFormData({...formData, species: val, breed: firstBreed});
                    }}
                  />
                  <SearchableDropdown
                    label="Breed"
                    options={breedOptions}
                    value={formData.breed}
                    onChange={val => setFormData({...formData, breed: val})}
                  />
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Birth</label>
                    <input type="date" required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-5 py-3 text-pine dark:text-zinc-100 font-bold text-sm" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})}/>
                  </div>
                  <WeightInput />
                </div>
             </div>
           )}
        </div>
        <div className="lg:col-span-5">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm space-y-6 sticky top-4">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Context</h2>
              {selectedClient ? (
                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700 space-y-3">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Linked Owner</p>
                  <div className="flex items-center gap-3">
                    <img src={selectedClient.avatar} className="w-10 h-10 rounded-lg" alt="" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-pine dark:text-zinc-100 truncate uppercase">{selectedClient.name}</p>
                      <p className="text-slate-400 text-[9px] font-bold">{selectedClient.phone}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-2xl opacity-20">
                  <p className="text-[9px] font-bold uppercase tracking-widest">Assign owner context</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedClientId || !formData.name || isSubmitting}
                className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    PROCESSING...
                  </>
                ) : (
                  'COMMIT REGISTRATION'
                )}
              </button>
           </div>
        </div>
      </form>
    </div>
  );
};

export default RegisterPetView;

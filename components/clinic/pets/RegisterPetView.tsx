
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, PawPrint, ArrowRight, X, Heart, Scale, Info, Plus, User as UserIcon, Calendar, Tag, Cpu, ChevronDown, Loader2, ImagePlus, Camera } from 'lucide-react';
import { Client, Pet } from '../../../types';
import SearchableDropdown from '../../shared/common/SearchableDropdown';
import { petsAPI, clientsAPI } from '../../../services';
import { uploadsAPI } from '../../../services/modules/uploads.api';
import { useClinic } from '../../../contexts/ClinicContext';
import { useData } from '../../../contexts/DataContext';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { useTour } from '../../../contexts/TourContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

// While the "Register a patient" tour runs, nobody actually picks a real owner,
// so the patient-details form (gated on a selected client) never mounts and the
// tour dead-ends on the owner step. We inject this synthetic owner during the
// tour only, so every field is highlighted. It is never persisted — Submit stays
// disabled because the real `selectedClientId` is still null. See [[TourContext]].
const TOUR_DEMO_CLIENT: Client = {
  id: -1,
  name: 'Sample Owner',
  phone: '+254 700 000 000',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sample%20Owner',
} as unknown as Client;

interface Props {
  clients?: Client[];
  onSave?: (data: Omit<Pet, 'id' | 'medicalHistory' | 'vaccinations'>) => void;
  onCancel: () => void;
  clinicId?: number;
  onGoToNewClient: () => void;
  initialClientId?: number | null;
}

const UNIT_OPTIONS = ['kg', 'lb', 'g', 'tons'];

// Local file → R2 (or whichever S3-compatible bucket the backend is wired to).
// Returns the public URL on success; renders a thumbnail preview when set.
const PassportPhotoPicker: React.FC<{ value: string; onChange: (url: string) => void }> = ({ value, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await uploadsAPI.upload(file, 'pet');
      onChange(result.publicUrl);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <img src={value} alt="Passport" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center shrink-0">
          <Camera size={14} className="text-slate-400" />
        </div>
      )}
      <label className="flex-1 cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <span className="inline-flex items-center justify-center gap-1.5 w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[10px] font-black text-pine dark:text-zinc-200 uppercase tracking-widest hover:border-seafoam">
          {busy ? <><Loader2 size={12} className="animate-spin" /> Uploading…</> : <><ImagePlus size={12} /> {value ? 'Replace photo' : 'Upload photo'}</>}
        </span>
      </label>
      {value && !busy && (
        <button type="button" onClick={() => onChange('')} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest px-1">Clear</button>
      )}
      {err && <p className="text-[10px] font-bold text-red-500 ml-2">{err}</p>}
    </div>
  );
};

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
    rfidChipNumber: '', tagNumber: '',
    color: '', markings: '',
    // tri-state: null = unknown, true = neutered, false = entire
    isNeutered: null as boolean | null,
    passportPhotoUrl: '',
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

  // Tour demo mode: active only on the patient-detail steps of the pets tour and
  // only while no real owner is picked. Drives the form to render with a fake
  // owner so the tour can highlight every field.
  const { isActive: tourActive, activeTour, currentStep } = useTour();
  const isTourDemo =
    tourActive &&
    activeTour?.id === 'pets' &&
    !!currentStep &&
    currentStep.target.startsWith('pet-form-') &&
    currentStep.target !== 'pet-form-owner' &&
    !selectedClientId;

  // What the render gate / owner pill should use — real selection wins, demo fills in.
  const effectiveClientId = selectedClientId ?? (isTourDemo ? TOUR_DEMO_CLIENT.id : null);
  const effectiveClient = selectedClient ?? (isTourDemo ? TOUR_DEMO_CLIENT : undefined);

  // Prefill sample values while in tour demo so highlighted fields aren't empty,
  // then wipe them back to a clean slate once the demo ends.
  const demoAppliedRef = useRef(false);
  useEffect(() => {
    if (isTourDemo && !demoAppliedRef.current) {
      demoAppliedRef.current = true;
      setFormData(f => ({
        ...f,
        name: f.name || 'Simba',
        color: f.color || 'Tabby',
        rfidChipNumber: f.rfidChipNumber || '985112004572189',
      }));
    } else if (!isTourDemo && demoAppliedRef.current) {
      demoAppliedRef.current = false;
      setFormData(f => ({ ...f, name: '', color: '', rfidChipNumber: '' }));
    }
  }, [isTourDemo]);

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
        color: formData.color || undefined,
        markings: formData.markings || undefined,
        isNeutered: formData.isNeutered ?? undefined,
        passportPhotoUrl: formData.passportPhotoUrl || undefined,
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
       <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-inner">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="flex-1 min-w-0 bg-transparent font-mono font-black text-pine dark:text-zinc-100 outline-none text-sm"
            value={formData.weight}
            onChange={e => setFormData({...formData, weight: e.target.value})}
            required
          />
          <div className="relative shrink-0" onMouseEnter={() => setIsUnitOpen(true)} onMouseLeave={() => setIsUnitOpen(false)}>
             <button type="button" className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-700 rounded-lg text-[10px] font-black uppercase text-seafoam">
               {formData.weightUnit} <ChevronDown size={10}/>
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
    <div className="animate-in fade-in duration-300">
      {isSubmitting && <LoadingSpinner fullScreen message="Registering patient..." />}
      <header className="flex items-center justify-between py-3 mb-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none truncate">Register Patient</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold mt-0.5 uppercase tracking-widest text-[9px]">Add New Entry</p>
        </div>
        <button onClick={onCancel} className="p-1.5 text-slate-400 hover:text-pine shrink-0"><X size={16}/></button>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
           {tourActive && (
             <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 99999, background: '#b91c1c', color: '#fff', fontSize: 10, padding: '2px 6px', fontFamily: 'monospace' }}>
               TOURDBG demo={String(isTourDemo)} id={String(activeTour?.id)} step={String(currentStep?.target)} sel={String(selectedClientId)} eff={String(effectiveClientId)}
             </div>
           )}
           {!effectiveClientId ? (
             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <UserIcon size={18} className="text-indigo-500"/>
                    <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Select Owner</h2>
                  </div>
                  <button type="button" onClick={onGoToNewClient} className="text-[9px] font-black text-seafoam uppercase tracking-widest hover:underline">+ Create New</button>
                </div>
                <div data-tour="pet-form-owner" className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14}/>
                  <input className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-9 py-2.5 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="Search (3+ chars)..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {isSearchingApi && <Loader2 size={12} className="absolute right-9 top-1/2 -translate-y-1/2 text-seafoam animate-spin" />}
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                      <X size={12} />
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
                      <button key={c.id} type="button" onClick={() => setSelectedClientId(c.id)} className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg hover:border-seafoam transition-all group">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={c.avatar} className="w-7 h-7 rounded-lg shrink-0" alt="" />
                          <div className="text-left min-w-0">
                            <p className="text-pine dark:text-zinc-100 font-bold text-xs uppercase truncate">{c.name}</p>
                            <p className="text-slate-400 text-[8px] font-bold uppercase truncate">{c.phone}</p>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-slate-200 group-hover:text-seafoam shrink-0" />
                      </button>
                    ))
                  ) : searchQuery.length >= 3 ? (
                    <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest py-6">No clients found</p>
                  ) : null}
                </div>
             </div>
           ) : (
             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
                {/* Linked owner pill (replaces side context panel) */}
                {effectiveClient && (
                  <div className="flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-zinc-700">
                    <img src={effectiveClient.avatar} className="w-7 h-7 rounded-lg shrink-0" alt="" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{isTourDemo ? 'Linked Owner · Tour demo' : 'Linked Owner'}</p>
                      <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate uppercase mt-0.5">{effectiveClient.name}</p>
                    </div>
                    {!isTourDemo && (
                      <button type="button" onClick={() => setSelectedClientId(null)} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest px-2 shrink-0">Change</button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Heart size={14} className="text-seafoam shrink-0"/>
                  <h2 className="text-xs font-black text-pine dark:text-zinc-100 uppercase truncate">Patient Data</h2>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div data-tour="pet-form-name" className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Name</label>
                    <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="Simba" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Gender</label>
                    <select className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm outline-none appearance-none" value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value as any})}>
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
                    <input type="date" required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})}/>
                  </div>
                  <WeightInput />
                  <div data-tour="pet-form-microchip" className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Microchip No.</label>
                    <input className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="985112004572189" value={formData.rfidChipNumber} onChange={e=>setFormData({...formData, rfidChipNumber: e.target.value})}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Tattoo / Tag</label>
                    <input className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="A1-235" value={formData.tagNumber} onChange={e=>setFormData({...formData, tagNumber: e.target.value})}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Colour</label>
                    <input className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="Tabby" value={formData.color} onChange={e=>setFormData({...formData, color: e.target.value})}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Neutered / Entire</label>
                    <select className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm outline-none appearance-none" value={formData.isNeutered === null ? '' : formData.isNeutered ? 'neutered' : 'entire'} onChange={e => setFormData({ ...formData, isNeutered: e.target.value === 'neutered' ? true : e.target.value === 'entire' ? false : null })}>
                      <option value="">Unknown</option>
                      <option value="neutered">Neutered / Spayed</option>
                      <option value="entire">Entire</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Colour markings (optional)</label>
                    <input className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-pine dark:text-zinc-100 font-bold text-sm outline-none" placeholder="white sock front left paw, scar over right eye" value={formData.markings} onChange={e=>setFormData({...formData, markings: e.target.value})}/>
                  </div>
                  <div data-tour="pet-form-photo" className="space-y-1 col-span-2">
                    <label className="text-[9px] font-black text-seafoam uppercase tracking-widest px-1">Passport Photo</label>
                    <PassportPhotoPicker
                      value={formData.passportPhotoUrl}
                      onChange={(url) => setFormData(f => ({ ...f, passportPhotoUrl: url }))}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>
                  </div>
                )}

                <button
                  data-tour="pet-form-submit"
                  type="submit"
                  disabled={!selectedClientId || !formData.name || isSubmitting}
                  className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      PROCESSING...
                    </>
                  ) : (
                    'COMMIT REGISTRATION'
                  )}
                </button>
             </div>
           )}
      </form>
    </div>
  );
};

export default RegisterPetView;

import React, { useState, useEffect, useMemo } from 'react';
import { X, PawPrint, Calendar, Scale, Tag, Cpu, Loader2, Save, ImagePlus, Camera, Skull } from 'lucide-react';
import { Pet } from '../../../types';
import { petsAPI } from '../../../services';
import { CacheInvalidators } from '../../../services/utils/cache';
import { useData } from '../../../contexts/DataContext';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { uploadsAPI } from '../../../services/modules/uploads.api';

interface EditPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  pet: Pet;
}

const EditPetModal: React.FC<EditPetModalProps> = ({ isOpen, onClose, pet }) => {
  const { refreshPets } = useData();
  const { species: apiSpecies, getBreedsBySpecies } = useReferenceData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatDob = (dob: string | undefined): string => {
    if (!dob) return new Date().toISOString().split('T')[0];
    // Handle ISO strings like "2020-05-10T00:00:00.000Z" — extract just the date
    return dob.includes('T') ? dob.split('T')[0] : dob;
  };

  const [formData, setFormData] = useState({
    name: pet.name,
    species: pet.species,
    breed: pet.breed || 'Mixed Breed',
    gender: pet.gender || 'Male',
    dob: formatDob(pet.dob),
    weight: pet.weight || '0.00',
    rfidChipNumber: pet.rfidChipNumber || '',
    tagNumber: pet.tagNumber || '',
    color: pet.color || '',
    markings: pet.markings || '',
    isNeutered: (pet.isNeutered ?? null) as boolean | null,
    passportPhotoUrl: pet.passportPhotoUrl || '',
    isAlive: pet.isAlive !== false,
    dateOfDeath: pet.dateOfDeath ? formatDob(pet.dateOfDeath) : '',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const result = await uploadsAPI.upload(file, 'pet');
      setFormData(f => ({ ...f, passportPhotoUrl: result.publicUrl }));
    } catch (e: any) {
      setError(e?.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Get breeds for selected species
  const breedOptions = useMemo(() => {
    const selectedSpecies = apiSpecies.find(s => s.name === formData.species);
    if (!selectedSpecies) return ['Mixed Breed'];

    const breedsForSpecies = getBreedsBySpecies(selectedSpecies.id);
    const breedNames = breedsForSpecies.map(b => b.name);

    return breedNames.length > 0 ? breedNames : ['Mixed Breed'];
  }, [apiSpecies, formData.species, getBreedsBySpecies]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: pet.name,
        species: pet.species,
        breed: pet.breed || 'Mixed Breed',
        gender: pet.gender || 'Male',
        dob: formatDob(pet.dob),
        weight: pet.weight || '0.00',
        rfidChipNumber: pet.rfidChipNumber || '',
        tagNumber: pet.tagNumber || '',
        color: pet.color || '',
        markings: pet.markings || '',
        isNeutered: (pet.isNeutered ?? null) as boolean | null,
        passportPhotoUrl: pet.passportPhotoUrl || '',
        isAlive: pet.isAlive !== false,
        dateOfDeath: pet.dateOfDeath ? formatDob(pet.dateOfDeath) : '',
      });
      setError(null);
    }
  }, [isOpen, pet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Parse weight
      const weightMatch = formData.weight.match(/^([\d.]+)\s*(\w+)?$/);
      const weightValue = weightMatch ? parseFloat(weightMatch[1]) : 0;
      const weightUnit = weightMatch?.[2] || 'kg';

      const updateData: any = {
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        gender: formData.gender,
        dob: new Date(formData.dob).toISOString(),
        weightValue,
        weightUnit,
        rfidChipNumber: formData.rfidChipNumber || undefined,
        tagNumber: formData.tagNumber || undefined,
        color: formData.color || undefined,
        markings: formData.markings || undefined,
        isNeutered: formData.isNeutered ?? undefined,
        passportPhotoUrl: formData.passportPhotoUrl || undefined,
        isAlive: formData.isAlive,
      };
      // Only send dateOfDeath when marking deceased; reviving (isAlive=true)
      // tells the backend to clear it. Skipping the key entirely on the
      // alive path leaves any historical date untouched on the server.
      if (!formData.isAlive) {
        updateData.dateOfDeath = formData.dateOfDeath
          ? new Date(formData.dateOfDeath).toISOString()
          : new Date().toISOString();
      }

      const response: any = await petsAPI.update(pet.id, updateData);

      if (response.success) {
        console.log('✅ Pet updated successfully:', response.data.pet);
        CacheInvalidators.invalidatePets(String(pet.id));
        await refreshPets();
        onClose();
      } else {
        throw new Error(response.message || 'Failed to update pet');
      }
    } catch (err: any) {
      console.error('Failed to update pet:', err);
      setError(err.message || 'Failed to update pet. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
              <PawPrint size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
              Edit Pet
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            disabled={isSubmitting}
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-2xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Pet Name *
              </label>
              <div className="relative">
                <PawPrint size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="Enter pet name"
                />
              </div>
            </div>

            {/* Species */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Species *
              </label>
              <select
                value={formData.species}
                onChange={(e) => setFormData({ ...formData, species: e.target.value, breed: 'Mixed Breed' })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none"
              >
                {apiSpecies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            {/* Breed */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Breed
              </label>
              <select
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none"
              >
                {breedOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Gender *
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Date of Birth *
              </label>
              <div className="relative">
                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                />
              </div>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Weight
              </label>
              <div className="relative">
                <Scale size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="e.g., 5.5 kg"
                />
              </div>
            </div>

            {/* RFID Chip Number */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                RFID Chip Number
              </label>
              <div className="relative">
                <Cpu size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.rfidChipNumber}
                  onChange={(e) => setFormData({ ...formData, rfidChipNumber: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="Enter RFID chip number"
                />
              </div>
            </div>

            {/* Tag Number */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Tattoo / Tag Number
              </label>
              <div className="relative">
                <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.tagNumber}
                  onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="Enter tag number"
                />
              </div>
            </div>

            {/* Colour */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Colour</label>
              <input type="text" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" placeholder="Tabby, Black, …" />
            </div>

            {/* Neutered / Entire */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Neutered / Entire</label>
              <select value={formData.isNeutered === null ? '' : formData.isNeutered ? 'neutered' : 'entire'} onChange={(e) => setFormData({ ...formData, isNeutered: e.target.value === 'neutered' ? true : e.target.value === 'entire' ? false : null })} className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none">
                <option value="">Unknown</option>
                <option value="neutered">Neutered / Spayed</option>
                <option value="entire">Entire</option>
              </select>
            </div>

            {/* Colour markings */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Colour markings (optional)</label>
              <input type="text" value={formData.markings} onChange={(e) => setFormData({ ...formData, markings: e.target.value })} className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" placeholder="white sock front left paw, scar over right eye" />
            </div>

            {/* Passport photo */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Passport Photo</label>
              <div className="flex items-center gap-3">
                {formData.passportPhotoUrl ? (
                  <img src={formData.passportPhotoUrl} alt="Passport" className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center shrink-0">
                    <Camera size={16} className="text-slate-400" />
                  </div>
                )}
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e.target.files?.[0] ?? null)} disabled={uploadingPhoto} />
                  <span className="inline-flex items-center justify-center gap-2 w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-black text-pine dark:text-zinc-200 uppercase tracking-wide hover:border-seafoam">
                    {uploadingPhoto ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><ImagePlus size={14} /> {formData.passportPhotoUrl ? 'Replace photo' : 'Upload photo'}</>}
                  </span>
                </label>
                {formData.passportPhotoUrl && !uploadingPhoto && (
                  <button type="button" onClick={() => setFormData(f => ({ ...f, passportPhotoUrl: '' }))} className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest px-2">Clear</button>
                )}
              </div>
            </div>

            {/* Lifecycle: alive / deceased */}
            <div className="md:col-span-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <Skull size={13} className={formData.isAlive ? 'text-slate-400' : 'text-red-500'} />
                    Lifecycle status
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">
                    {formData.isAlive ? 'Patient is alive — new records allowed.' : 'Patient is deceased — no new appointments. Existing records remain visible.'}
                  </p>
                </div>
                <button type="button" onClick={() => setFormData(f => ({ ...f, isAlive: !f.isAlive }))} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.isAlive ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800'}`}>
                  {formData.isAlive ? 'Mark deceased' : 'Mark alive'}
                </button>
              </div>
              {!formData.isAlive && (
                <div className="mt-3">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">Date of death</label>
                  <input type="date" value={formData.dateOfDeath} onChange={(e) => setFormData({ ...formData, dateOfDeath: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-1">Leave blank to record today's date.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-seafoam/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-seafoam/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPetModal;


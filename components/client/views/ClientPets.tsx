import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Building2, Loader2 } from 'lucide-react';
import { clientPortalAPI, PortalClinic } from '../../../services';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import CpModal from '../CpModal';
import ClinicFinder from '../ClinicFinder';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { speciesEmoji, petAge } from '../cpUtils';

const ClientPets: React.FC = () => {
  const { pets, clinics, loading, joinClinic } = useClientPortal();
  const navigate = useNavigate();
  const [addClinicOpen, setAddClinicOpen] = useState(false);
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const onPickClinic = async (clinic: PortalClinic) => {
    setJoiningId(clinic.id);
    const ok = await joinClinic(clinic.id);
    setJoiningId(null);
    if (ok) setAddClinicOpen(false);
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>My pets</h1>
          <p className="cp-muted text-sm">{clinics.length} {clinics.length === 1 ? 'clinic' : 'clinics'} connected</p>
        </div>
        {/* One primary action: connect first, then it's all about pets
            (extra clinics live in Settings → Advanced). */}
        {clinics.length === 0 ? (
          <button className="cp-btn" onClick={() => setAddClinicOpen(true)}>
            <Building2 className="w-4 h-4" /> Add clinic
          </button>
        ) : (
          <button className="cp-btn" onClick={() => setAddPetOpen(true)}>
            <Plus className="w-4 h-4" /> Add pet
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12"><LoadingSpinner message="Loading..." /></div>
      ) : pets.length === 0 ? (
        <div className="cp-card p-8 text-center">
          <div className="text-4xl mb-2">🐾</div>
          <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>No pets yet</h3>
          <p className="text-sm cp-muted mb-4">
            {clinics.length > 0
              ? 'Add your pet — it registers as a patient at your clinic, and its records build up here.'
              : 'Connect to your clinic — your pets and their records will appear here.'}
          </p>
          {clinics.length === 0 ? (
            <button className="cp-btn mx-auto" onClick={() => setAddClinicOpen(true)}><Plus className="w-4 h-4" /> Add your clinic</button>
          ) : (
            <button className="cp-btn mx-auto" onClick={() => setAddPetOpen(true)}><Plus className="w-4 h-4" /> Add your pet</button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pets.map((p) => (
            <button key={p.id} onClick={() => navigate(`/client/pets/${p.id}`)} className="cp-card p-4 text-left hover:scale-[1.01] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl overflow-hidden shrink-0"
                     style={{ background: 'var(--cp-accent-soft)' }}>
                  {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" /> : speciesEmoji(p.species)}
                </div>
                <div className="min-w-0">
                  <div className="font-black truncate" style={{ color: 'var(--cp-ink)' }}>{p.name}</div>
                  <div className="text-xs cp-muted truncate">{[p.breed || p.species, p.gender, petAge(p.dob)].filter(Boolean).join(' · ')}</div>
                  <div className="text-xs cp-muted truncate">{p.clinic?.name}</div>
                </div>
              </div>
              <div className="mt-3 text-xs font-bold cp-accent-text flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> View profile & records
              </div>
            </button>
          ))}
        </div>
      )}

      {addClinicOpen && (
        <CpModal title="Add a clinic" onClose={() => setAddClinicOpen(false)}>
          <p className="text-sm cp-muted mb-4">Find the clinic that cares for your pets to connect your records.</p>
          <ClinicFinder onPick={onPickClinic} ctaLabel="Connect" busyClinicId={joiningId} />
        </CpModal>
      )}

      {addPetOpen && <AddPetModal onClose={() => setAddPetOpen(false)} />}
    </div>
  );
};

const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Guinea Pig', 'Reptile', 'Other'];

const OTHER_BREED = '__other__';

const AddPetModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clinics, addPet } = useClientPortal();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [customSpecies, setCustomSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [customBreed, setCustomBreed] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [clinicId, setClinicId] = useState(clinics[0]?.clinic.id || '');
  const [busy, setBusy] = useState(false);
  const [allBreeds, setAllBreeds] = useState<Array<{ name: string; speciesName: string }>>([]);

  React.useEffect(() => {
    let alive = true;
    clientPortalAPI.breeds().then((res) => { if (alive) setAllBreeds(res.data?.breeds ?? []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const speciesBreeds = React.useMemo(
    () => allBreeds.filter((b) => b.speciesName.toLowerCase() === species.toLowerCase()).map((b) => b.name).sort(),
    [allBreeds, species],
  );
  const hasBreedList = species !== 'Other' && speciesBreeds.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sp = species === 'Other' ? customSpecies.trim() : species;
    const br = hasBreedList ? (breed === OTHER_BREED ? customBreed.trim() : breed) : customBreed.trim();
    if (!name.trim() || !sp || !dob) return;
    setBusy(true);
    const ok = await addPet({
      clinicId: clinics.length > 1 ? clinicId : undefined,
      name: name.trim(),
      species: sp,
      breed: br || undefined,
      gender: gender || undefined,
      dob,
      weightValue: weight ? Number(weight) : undefined,
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <CpModal title="Add a pet" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {clinics.length > 1 && (
          <div>
            <label className="cp-label">Clinic</label>
            <select className="cp-input" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
              {clinics.map((c) => <option key={c.clinic.id} value={c.clinic.id}>{c.clinic.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="cp-label">Name</label>
          <input className="cp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Simba" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cp-label">Species</label>
            <select className="cp-input" value={species} onChange={(e) => { setSpecies(e.target.value); setBreed(''); setCustomBreed(''); }}>
              {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="cp-label">Breed (optional)</label>
            {hasBreedList ? (
              <select className="cp-input" value={breed} onChange={(e) => setBreed(e.target.value)}>
                <option value="">—</option>
                {speciesBreeds.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value={OTHER_BREED}>Other…</option>
              </select>
            ) : (
              <input className="cp-input" value={customBreed} onChange={(e) => setCustomBreed(e.target.value)} placeholder="e.g. Beagle" />
            )}
          </div>
        </div>
        {hasBreedList && breed === OTHER_BREED && (
          <div>
            <label className="cp-label">Breed name</label>
            <input className="cp-input" value={customBreed} onChange={(e) => setCustomBreed(e.target.value)} required />
          </div>
        )}
        {species === 'Other' && (
          <div>
            <label className="cp-label">What kind of animal?</label>
            <input className="cp-input" value={customSpecies} onChange={(e) => setCustomSpecies(e.target.value)} required />
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="cp-label">Sex</label>
            <select className="cp-input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="cp-label">Date of birth</label>
            <input className="cp-input" type="date" value={dob} max={new Date().toISOString().slice(0, 10)}
                   onChange={(e) => setDob(e.target.value)} required />
          </div>
          <div>
            <label className="cp-label">Weight (kg)</label>
            <input className="cp-input" type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>
        <p className="text-xs cp-muted">Your pet is registered as a patient at your clinic — they'll see it right away and can fill in the rest at the first visit.</p>
        <button type="submit" className="cp-btn w-full" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add pet'}
        </button>
      </form>
    </CpModal>
  );
};

export default ClientPets;

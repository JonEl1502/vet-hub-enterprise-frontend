import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Building2 } from 'lucide-react';
import { PortalClinic } from '../../../services';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import CpModal from '../CpModal';
import ClinicFinder from '../ClinicFinder';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { speciesEmoji, petAge } from '../cpUtils';

const ClientPets: React.FC = () => {
  const { pets, clinics, loading, joinClinic } = useClientPortal();
  const navigate = useNavigate();
  const [addClinicOpen, setAddClinicOpen] = useState(false);
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
        <button className="cp-btn-ghost" onClick={() => setAddClinicOpen(true)}>
          <Building2 className="w-4 h-4" /> Add clinic
        </button>
      </div>

      {loading ? (
        <div className="py-12"><LoadingSpinner message="Loading..." /></div>
      ) : pets.length === 0 ? (
        <div className="cp-card p-8 text-center">
          <div className="text-4xl mb-2">🐾</div>
          <h3 className="font-black" style={{ color: 'var(--cp-ink)' }}>No pets yet</h3>
          <p className="text-sm cp-muted mb-4">
            {clinics.length > 0
              ? 'You’re connected — ask your clinic to register your pets under your profile and they’ll appear here.'
              : 'Connect to your clinic — your pets and their records will appear here.'}
          </p>
          {clinics.length === 0 && (
            <button className="cp-btn mx-auto" onClick={() => setAddClinicOpen(true)}><Plus className="w-4 h-4" /> Add your clinic</button>
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
    </div>
  );
};

export default ClientPets;

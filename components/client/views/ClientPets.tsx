import React, { useState } from 'react';
import { Plus, Syringe, FileText, Building2, Slice } from 'lucide-react';

// Render free text as bullets (one per line) or a paragraph, matching the
// clinic's chosen surgery note format so the owner sees it the same way.
const renderFormatted = (text?: string | null, format?: string) => {
  const val = (text || '').trim();
  if (!val) return null;
  if (format === 'BULLET') {
    const lines = val.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return <ul className="list-disc list-inside space-y-0.5 text-sm cp-muted mt-1">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
  }
  return <p className="text-sm cp-muted mt-1 whitespace-pre-wrap">{val}</p>;
};
import { format } from 'date-fns';
import { clientPortalAPI, PortalPet, PortalClinic } from '../../../services';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import CpModal from '../CpModal';
import ClinicFinder from '../ClinicFinder';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

const speciesEmoji = (s: string) => {
  const k = (s || '').toLowerCase();
  if (k.includes('dog')) return '🐕';
  if (k.includes('cat')) return '🐈';
  if (k.includes('bird')) return '🦜';
  if (k.includes('rabbit')) return '🐇';
  return '🐾';
};

const ClientPets: React.FC = () => {
  const { pets, clinics, loading, joinClinic } = useClientPortal();
  const [addClinicOpen, setAddClinicOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [recordsPet, setRecordsPet] = useState<PortalPet | null>(null);

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
          <p className="text-sm cp-muted mb-4">Connect to your clinic — your pets and their records will appear here.</p>
          <button className="cp-btn mx-auto" onClick={() => setAddClinicOpen(true)}><Plus className="w-4 h-4" /> Add your clinic</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pets.map((p) => (
            <button key={p.id} onClick={() => setRecordsPet(p)} className="cp-card p-4 text-left hover:scale-[1.01] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl overflow-hidden shrink-0"
                     style={{ background: 'var(--cp-accent-soft)' }}>
                  {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" /> : speciesEmoji(p.species)}
                </div>
                <div className="min-w-0">
                  <div className="font-black truncate" style={{ color: 'var(--cp-ink)' }}>{p.name}</div>
                  <div className="text-xs cp-muted truncate">{[p.breed || p.species, p.gender].filter(Boolean).join(' · ')}</div>
                  <div className="text-xs cp-muted truncate">{p.clinic?.name}</div>
                </div>
              </div>
              <div className="mt-3 text-xs font-bold cp-accent-text flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> View health records
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

      {recordsPet && <PetRecordsModal pet={recordsPet} onClose={() => setRecordsPet(null)} />}
    </div>
  );
};

const PetRecordsModal: React.FC<{ pet: PortalPet; onClose: () => void }> = ({ pet, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [medical, setMedical] = useState<any[]>([]);
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [surgeries, setSurgeries] = useState<any[]>([]);

  React.useEffect(() => {
    let alive = true;
    clientPortalAPI.petRecords(pet.id)
      .then((res) => { if (alive) { setMedical(res.data?.medical ?? []); setVaccinations(res.data?.vaccinations ?? []); setSurgeries(res.data?.surgeries ?? []); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [pet.id]);

  return (
    <CpModal title={`${pet.name}'s records`} onClose={onClose} maxWidth="36rem">
      {loading ? (
        <div className="py-10"><LoadingSpinner message="Loading..." /></div>
      ) : (
        <div className="space-y-6">
          <section>
            <h4 className="font-black text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--cp-ink)' }}>
              <Syringe className="w-4 h-4 cp-accent-text" /> Vaccinations
            </h4>
            {vaccinations.length === 0 ? <p className="text-sm cp-muted">No vaccination records yet.</p> : (
              <div className="space-y-2">
                {vaccinations.map((v) => (
                  <div key={v.id} className="cp-card-soft p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{v.vaccineName}</div>
                      <div className="text-xs cp-muted">
                        {v.administeredAt ? format(new Date(v.administeredAt), 'd MMM yyyy') : 'Scheduled'}
                        {v.expiryDate && ` · due ${format(new Date(v.expiryDate), 'd MMM yyyy')}`}
                      </div>
                    </div>
                    <span className="cp-chip">{String(v.status).toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="font-black text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--cp-ink)' }}>
              <FileText className="w-4 h-4 cp-accent-text" /> Medical history
            </h4>
            {medical.length === 0 ? <p className="text-sm cp-muted">No medical records yet.</p> : (
              <div className="space-y-2">
                {medical.map((m) => (
                  <div key={m.id} className="cp-card-soft p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{m.diagnosis}</div>
                      <div className="text-xs cp-muted">{format(new Date(m.recordedAt), 'd MMM yyyy')}</div>
                    </div>
                    {m.treatment && <p className="text-sm cp-muted mt-1">{m.treatment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="font-black text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--cp-ink)' }}>
              <Slice className="w-4 h-4 cp-accent-text" /> Surgeries
            </h4>
            {surgeries.length === 0 ? <p className="text-sm cp-muted">No surgery records yet.</p> : (
              <div className="space-y-2">
                {surgeries.map((s) => (
                  <div key={s.id} className="cp-card-soft p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{s.serviceName}{s.complexity ? ` · complexity ${s.complexity}` : ''}</div>
                      <div className="text-xs cp-muted">{format(new Date(s.recordedAt), 'd MMM yyyy')}</div>
                    </div>
                    {s.findings && (<div className="mt-2"><span className="text-[11px] font-black uppercase tracking-wider cp-muted">Findings</span>{renderFormatted(s.findings, s.displayFormat)}</div>)}
                    {s.complications && (<div className="mt-2"><span className="text-[11px] font-black uppercase tracking-wider cp-muted">Complications</span>{renderFormatted(s.complications, s.displayFormat)}</div>)}
                    {s.postOpInstructions && (<div className="mt-2"><span className="text-[11px] font-black uppercase tracking-wider cp-muted">Post-op instructions</span>{renderFormatted(s.postOpInstructions, s.displayFormat)}</div>)}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </CpModal>
  );
};

export default ClientPets;

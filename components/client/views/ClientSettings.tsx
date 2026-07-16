import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronDown, ChevronRight, LogOut, Plus, ShieldQuestion } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useClientPortal } from '../../../contexts/ClientPortalContext';
import { PortalClinic } from '../../../services';
import ClinicFinder from '../ClinicFinder';

// Clinic logo tile with a graceful fallback: some logos are emoji strings and
// some are storage URLs that may 404 — either way we fall back to the icon
// instead of a broken image (alt text kept empty so nothing bleeds out).
const ClinicLogo: React.FC<{ logo: string | null }> = ({ logo }) => {
  const [failed, setFailed] = useState(false);
  const isEmoji = !!logo && logo.length <= 4;
  const isUrl = !!logo && !isEmoji && (logo.startsWith('http') || logo.startsWith('data:'));
  return (
    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 text-lg" style={{ background: 'var(--cp-accent-soft)' }}>
      {isEmoji ? logo
        : isUrl && !failed ? <img src={logo!} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : <Building2 className="w-4 h-4 cp-accent-text" />}
    </div>
  );
};

// Account & settings. Deliberately quiet: the clinic-change tools and sign-out
// live behind an "Advanced" disclosure so day-to-day owners never trip on them.
const ClientSettings: React.FC = () => {
  const { user, logout } = useAuth();
  const { clinics, pets, joinClinic } = useClientPortal();
  const navigate = useNavigate();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  const onPickClinic = async (clinic: PortalClinic) => {
    setJoiningId(clinic.id);
    const ok = await joinClinic(clinic.id);
    setJoiningId(null);
    if (ok) setFinderOpen(false);
  };

  const doLogout = async () => {
    await logout();
    navigate('/client/login', { replace: true });
  };

  return (
    <div className="space-y-5 fade-in max-w-2xl">
      <button className="text-xs font-bold cp-accent-text flex items-center gap-1" onClick={() => navigate('/client')}>
        <ArrowLeft className="w-3.5 h-3.5" /> Home
      </button>

      <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Account & settings</h1>

      {/* Profile */}
      <div className="cp-card p-5 flex items-center gap-4">
        <span className="cp-avatar" style={{ width: '3.25rem', height: '3.25rem', fontSize: '1.15rem' }}>{initial}</span>
        <div className="min-w-0">
          <div className="font-black truncate" style={{ color: 'var(--cp-ink)' }}>{user?.name || '—'}</div>
          <div className="text-sm cp-muted truncate">{user?.email}</div>
          <div className="text-xs cp-muted mt-0.5">{pets.length} {pets.length === 1 ? 'pet' : 'pets'} · {clinics.length} {clinics.length === 1 ? 'clinic' : 'clinics'}</div>
        </div>
      </div>

      {/* Connected clinics */}
      <div className="cp-card p-5">
        <h3 className="font-black mb-3 flex items-center gap-2" style={{ color: 'var(--cp-ink)' }}>
          <Building2 className="w-4 h-4 cp-accent-text" /> My clinics
        </h3>
        {clinics.length === 0 ? (
          <p className="text-sm cp-muted">No clinic connected yet.</p>
        ) : (
          <div className="space-y-2">
            {clinics.map(({ clientId, clinic }) => (
              <div key={clientId} className="cp-card-soft p-3 flex items-center gap-3">
                <ClinicLogo logo={clinic.logo} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: 'var(--cp-ink)' }}>{clinic.name}</div>
                  <div className="text-xs cp-muted truncate">{[clinic.city, clinic.phone].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="cp-chip">connected</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs cp-muted mt-3 flex items-center gap-1.5">
          <ShieldQuestion className="w-3.5 h-3.5" /> Your pets and records are managed by your clinic — contact them for changes.
        </p>
      </div>

      {/* Advanced (deliberately hidden) */}
      <div className="cp-card p-5">
        <button className="w-full flex items-center justify-between" onClick={() => setAdvancedOpen((v) => !v)}>
          <span className="text-sm font-bold cp-muted">Advanced</span>
          {advancedOpen ? <ChevronDown className="w-4 h-4 cp-muted" /> : <ChevronRight className="w-4 h-4 cp-muted" />}
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="font-bold text-sm mb-1" style={{ color: 'var(--cp-ink)' }}>Change or add a clinic</div>
              <p className="text-xs cp-muted mb-2">
                Moving, or seeing a second vet? Connect another clinic — your existing records stay with each clinic.
              </p>
              {finderOpen ? (
                <div className="cp-card-soft p-3">
                  <ClinicFinder onPick={onPickClinic} ctaLabel="Connect" busyClinicId={joiningId} />
                  <button className="text-xs font-bold cp-muted mt-2" onClick={() => setFinderOpen(false)}>Close</button>
                </div>
              ) : (
                <button className="cp-btn-ghost" onClick={() => setFinderOpen(true)}>
                  <Plus className="w-4 h-4" /> Find a clinic
                </button>
              )}
            </div>

            <div className="pt-3 border-t" style={{ borderColor: 'var(--cp-border)' }}>
              <button className="cp-btn-ghost" style={{ color: '#c0392b' }} onClick={doLogout}>
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientSettings;

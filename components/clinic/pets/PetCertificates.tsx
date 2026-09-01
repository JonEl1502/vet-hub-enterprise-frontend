import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { Pet, Client, Clinic } from '../../../types';
import DocumentActions from '../shared/DocumentActions';
import { buildDocumentMessage } from '../shared/documentShare';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Clinic-issued pet certificates (user, 2026-08-01) — CERTIFICATE OF DEATH and
 * CERTIFICATE OF BIRTH, modeled on the Kenyan civil-registration documents the
 * user supplied (docs: CamScanner sample): boxed field grid, informant line,
 * registering officer, "given under the seal of", and a legal-note footer.
 * The registry fields the clinic can't derive (cause of death, where born,
 * dam/sire) are editable inline before printing; nothing here writes to the
 * pet record — it is a DOCUMENT compiled from the clinical record.
 */

const field = 'w-full bg-transparent border-b border-dotted border-slate-400 focus:outline-none focus:border-pine text-sm font-bold text-slate-900 print:border-none';

const Cell: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`border border-slate-800 px-2.5 py-1.5 ${className}`}>
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 leading-tight">{label}</p>
    <div className="text-sm font-bold text-slate-900 leading-snug min-h-[1.25rem]">{children}</div>
  </div>
);

const fmt = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const PetCertificateModal: React.FC<{
  kind: 'BIRTH' | 'DEATH';
  pet: Pet;
  owner?: Client;
  clinic?: Clinic;
  onClose: () => void;
}> = ({ kind, pet, owner, clinic, onClose }) => {
  const { user } = useAuth();
  const isDeath = kind === 'DEATH';
  const year = new Date().getFullYear();
  // Deterministic serial — same pet always prints the same certificate number.
  const serial = `VH-${isDeath ? 'D' : 'B'}-${clinic?.id ?? 0}-${pet.id}-${year}`;
  const [cause, setCause] = useState('');
  const [place, setPlace] = useState(clinic?.name || '');
  const [dam, setDam] = useState('');
  const [sire, setSire] = useState('');
  const [officer, setOfficer] = useState(user?.name || '');
  const domId = `pet-cert-${kind.toLowerCase()}-${pet.id}`;
  const accent = isDeath ? 'text-slate-900' : 'text-red-700';
  const borderAccent = isDeath ? 'border-slate-800' : 'border-red-700';

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Toolbar (not printed) */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 print:hidden">
          <span className="text-[11px] font-black uppercase tracking-widest text-pine flex items-center gap-2">
            <FileText size={14} className="text-seafoam" /> Certificate of {isDeath ? 'Death' : 'Birth'}
          </span>
          <div className="flex items-center gap-2">
            <DocumentActions
              size="sm"
              elementId={domId}
              title={`Certificate of ${isDeath ? 'Death' : 'Birth'} ${serial}`}
              message={buildDocumentMessage({ docLabel: `certificate of ${isDeath ? 'death' : 'birth'} ${serial}` })}
            />
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
          </div>
        </div>

        {/* The document */}
        <div id={domId} className={`m-5 border-4 double ${borderAccent} p-6 bg-white text-slate-900`}>
          <div className="text-center mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{clinic?.name || 'Veterinary Clinic'}</p>
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">VetHubCore Veterinary Registry</p>
            <h1 className={`text-2xl font-black uppercase tracking-tight mt-2 ${accent}`}>Certificate of {isDeath ? 'Death' : 'Birth'}</h1>
            <p className="text-[10px] font-black tracking-widest mt-1">Serial № {serial}</p>
          </div>

          <div className="grid grid-cols-4 gap-0 [&>div]:-mt-px [&>div]:-ml-px">
            <Cell label="Entry no." className="col-span-1">{String(pet.id)}</Cell>
            <Cell label={isDeath ? 'Name of deceased animal' : 'Name of animal'} className="col-span-3">{pet.name}</Cell>
            <Cell label="Species">{pet.species || '—'}</Cell>
            <Cell label="Breed">{pet.breed || '—'}</Cell>
            <Cell label="Sex">{pet.gender || '—'}</Cell>
            <Cell label={isDeath ? 'Age' : 'Colour / markings'}>{isDeath ? (pet.age ? `${pet.age} yrs` : '—') : ((pet as any).color || '—')}</Cell>

            {isDeath ? (
              <>
                <Cell label="Date of death" className="col-span-2">{fmt(pet.dateOfDeath)}</Cell>
                <Cell label="Place of death" className="col-span-2">
                  <input className={field} value={place} onChange={e => setPlace(e.target.value)} placeholder="Clinic / home…" />
                </Cell>
                <Cell label="Cause of death" className="col-span-4">
                  <input className={field} value={cause} onChange={e => setCause(e.target.value)} placeholder="As per clinical record…" />
                </Cell>
              </>
            ) : (
              <>
                <Cell label="Date of birth" className="col-span-2">{fmt(pet.dob)}</Cell>
                <Cell label="Where born" className="col-span-2">
                  <input className={field} value={place} onChange={e => setPlace(e.target.value)} placeholder="Kennel / clinic / farm…" />
                </Cell>
                <Cell label="Dam (mother)" className="col-span-2">
                  <input className={field} value={dam} onChange={e => setDam(e.target.value)} placeholder="—" />
                </Cell>
                <Cell label="Sire (father)" className="col-span-2">
                  <input className={field} value={sire} onChange={e => setSire(e.target.value)} placeholder="—" />
                </Cell>
              </>
            )}

            <Cell label="Owner — name and description of informant" className="col-span-2">
              {owner ? `${owner.name}${owner.phone ? ` · ${owner.phone}` : ''}` : '—'}
            </Cell>
            <Cell label="Name of registering officer" className="col-span-1">
              <input className={field} value={officer} onChange={e => setOfficer(e.target.value)} />
            </Cell>
            <Cell label="Date of registration" className="col-span-1">{fmt(new Date().toISOString())}</Cell>
          </div>

          <p className="text-[10px] leading-relaxed mt-4">
            I, <b>{officer || '____________'}</b>, for <b>{clinic?.name || 'the clinic'}</b>, hereby certify that this
            certificate is compiled from an entry in the clinical register of {isDeath ? 'deaths' : 'births'} kept by
            this clinic, without any alteration of the dates and facts therein contained.
          </p>

          <div className="flex items-end justify-between mt-6 gap-6">
            <p className="text-[10px]">
              Given under the seal of <b>{clinic?.name || 'the clinic'}</b> on{' '}
              <b>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
            </p>
            <div className="text-center shrink-0">
              <div className="w-44 border-b border-slate-800 h-8" />
              <p className="text-[9px] font-bold uppercase tracking-widest mt-1">Authorised signature · stamp</p>
            </div>
          </div>

          <p className={`text-[9px] font-bold mt-4 ${isDeath ? 'text-slate-500' : 'text-red-700'}`}>
            Note: {isDeath
              ? 'This certificate records the death of the animal as entered in the clinical register. It is not a civil-registration document.'
              : 'A Certificate of Birth is not proof of pedigree. It records the birth of the animal as entered in the clinical register.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PetCertificateModal;

import React, { useState } from 'react';
import { X, Printer, FileText, Plus } from 'lucide-react';
import { Pet, Client, Clinic } from '../../../types';
import { printElementAsPdf } from '../shared/printPdf';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * A certificate the clinic WRITES (user, 2026-08-25: "allow user to create cert
 * too … for vaccine they get generated").
 *
 * Birth, death and the vaccine passport are *derived* — the clinic picks
 * nothing, the record fills them in. Everything else a vet is asked to sign
 * (fitness to travel, health for export, sterilisation, microchip, soundness)
 * is a sentence a human writes over the same patient facts. That had nowhere to
 * live, so those were being written outside the system entirely.
 *
 * ⚠️ NOT STORED — like every other certificate here, this is a DOCUMENT
 * compiled from the record and printed. Nothing is written back to the patient.
 * The footer says so, because a clinic that believes a certificate was filed
 * will not keep its own copy.
 */

const PRESETS = [
  'Certificate of Health',
  'Fitness to Travel',
  'Veterinary Examination',
  'Sterilisation / Neuter Certificate',
  'Microchip Certificate',
  'Certificate of Ownership',
];

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

const CustomCertificateModal: React.FC<{
  pet: Pet;
  owner?: Client;
  clinic?: Clinic;
  onClose: () => void;
}> = ({ pet, owner, clinic, onClose }) => {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const serial = `VH-C-${clinic?.id ?? 0}-${pet.id}-${year}`;
  const domId = `pet-cert-custom-${pet.id}`;

  const [title, setTitle] = useState(PRESETS[0]);
  const [body, setBody] = useState('');
  const [officer, setOfficer] = useState(user?.name || '');
  const field = 'w-full bg-transparent border-b border-dotted border-slate-400 focus:outline-none focus:border-pine text-sm font-bold text-slate-900 print:border-none';

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Toolbar (not printed) */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 print:hidden">
          <span className="text-[11px] font-black uppercase tracking-widest text-pine flex items-center gap-2">
            <FileText size={14} className="text-seafoam" /> New certificate
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printElementAsPdf(domId, `${title || 'Certificate'} ${serial}`, false)}
              disabled={!title.trim() || !body.trim()}
              title={!title.trim() || !body.trim() ? 'Give it a title and a statement first' : undefined}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-seafoam"
            >
              <Printer size={12} /> Print / PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
          </div>
        </div>

        {/* Composer (not printed) — the two things the clinic supplies. */}
        <div className="px-5 py-3 border-b border-slate-200 space-y-2.5 print:hidden bg-slate-50">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Certificate title</label>
            <input
              list="vh-cert-presets"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Choose or type your own…"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-seafoam/30"
            />
            <datalist id="vh-cert-presets">
              {PRESETS.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
              What you are certifying
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder="e.g. I have examined the animal described below and found it to be in good health and free from clinical signs of infectious disease…"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-seafoam/30"
            />
            <p className="mt-1 text-[9px] font-bold text-slate-400">
              The patient and owner details below are filled from the record — you write the statement.
            </p>
          </div>
        </div>

        {/* The document */}
        <div id={domId} className="m-5 border-4 double border-slate-800 p-6 bg-white text-slate-900">
          <div className="text-center mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{clinic?.name || 'Veterinary Clinic'}</p>
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">VetHubCore Veterinary Registry</p>
            <h1 className="text-2xl font-black uppercase tracking-tight mt-2 text-slate-900">{title || 'Certificate'}</h1>
            <p className="text-[10px] font-black tracking-widest mt-1">Serial № {serial}</p>
          </div>

          {/* The derived half — the same patient facts every certificate here
              carries, so a hand-written one cannot contradict a generated one. */}
          <div className="grid grid-cols-4 gap-0 [&>div]:-mt-px [&>div]:-ml-px">
            <Cell label="Entry no." className="col-span-1">{String(pet.id)}</Cell>
            <Cell label="Name of animal" className="col-span-3">{pet.name}</Cell>
            <Cell label="Species">{pet.species || '—'}</Cell>
            <Cell label="Breed">{pet.breed || '—'}</Cell>
            <Cell label="Sex">{pet.gender || '—'}</Cell>
            <Cell label="Date of birth">{fmt(pet.dob)}</Cell>
            <Cell label="Owner" className="col-span-2">
              {owner ? `${owner.name}${owner.phone ? ` · ${owner.phone}` : ''}` : '—'}
            </Cell>
            <Cell label="Microchip / RFID" className="col-span-2">{(pet as any).rfidChipNumber || '—'}</Cell>
          </div>

          <p className="text-[11px] leading-relaxed mt-4 whitespace-pre-wrap min-h-[3rem]">
            {body || <span className="text-slate-400 print:hidden">Your statement appears here.</span>}
          </p>

          <div className="grid grid-cols-2 gap-4 mt-5">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Certifying veterinarian</p>
              <input className={field} value={officer} onChange={e => setOfficer(e.target.value)} />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Date of issue</p>
              <p className="text-sm font-bold">{fmt(new Date().toISOString())}</p>
            </div>
          </div>

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

          <p className="text-[9px] font-bold mt-4 text-slate-500">
            Note: the patient details above are taken from this clinic's register; the statement is the
            certifying veterinarian's own. This document is issued by the clinic and is not a
            government certification.
          </p>
        </div>

        {/* ⚠️ Said out loud: a clinic that believes this was filed will not keep
            its own copy. */}
        <p className="px-5 pb-4 -mt-2 text-[9px] font-bold uppercase tracking-widest text-amber-600 print:hidden flex items-center gap-1.5">
          <Plus size={11} className="rotate-45" /> Not saved to the record — print or export the PDF before closing.
        </p>
      </div>
    </div>
  );
};

export default CustomCertificateModal;

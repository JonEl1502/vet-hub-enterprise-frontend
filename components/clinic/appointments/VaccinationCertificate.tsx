import React, { useEffect, useState } from 'react';
import { ShieldCheck, Syringe, Loader2, Mail, RefreshCw, Lock } from 'lucide-react';
import { useFeature } from '../../../contexts/PlanAccessContext';
import DocumentActions from '../shared/DocumentActions';
import { vaccinationsAPI } from '../../../services';
import type { VaccinationRecord } from '../../../services/modules/vaccinations.api';

/**
 * THE VISIT'S VACCINATION CERTIFICATE — one document for every dose given.
 *
 * The clinic's spec (approved 2026-11-21) ends a vaccination visit with "a
 * digital vaccination certificate with batch/serial number and next due
 * date". It used to exist only behind the visit detail page, one record at a
 * time, with a serial computed in the browser that was never stored. Now:
 *  - the serial is ISSUED by the server and stored on the doses
 *    (`VC-<clinic>-<year>-<visit>`), so the same certificate can be looked up
 *    again (`GET /vaccinations/certificate/:serial`);
 *  - it lists every dose given on the visit with its type, batch, lot expiry,
 *    date given and NEXT DUE date (the reminder date, not the immunity expiry);
 *  - Download PDF, Print and WhatsApp come from the shared DocumentActions,
 *    plus an email draft.
 *
 * Used as the last step of the vaccination wizard. Paper colours are fixed
 * light — the PDF helper strips dark mode while it captures.
 */

interface Props {
  visitId: string | number;
  pet: any;
  client?: any;
  clinic: { name?: string; slogan?: string | null; logo?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  staff?: { id: number | string; name: string }[];
  /** Bump to re-issue after doses change. */
  refreshKey?: number;
}

const day = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const VaccinationCertificate: React.FC<Props> = (props) => {
  // Certificates are a Pro capability (`capability:vaccination-certificates`).
  // Sell the lock, never hide it: the step stays, and says what unlocks it.
  const canCertify = useFeature('capability:vaccination-certificates');
  if (!canCertify) {
    return (
      <div className="py-10 text-center space-y-2">
        <Lock size={26} className="mx-auto text-slate-300" />
        <p className="text-sm font-bold text-pine dark:text-zinc-100">Vaccination certificates are on Pro and Enterprise</p>
        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
          The doses, batches and next-due reminders on this visit are saved either way. Upgrade to issue the client a
          certificate with a stored serial number.
        </p>
      </div>
    );
  }
  return <CertificateBody {...props} />;
};

const CertificateBody: React.FC<Props> = ({ visitId, pet, client, clinic, staff = [], refreshKey = 0 }) => {
  const [serial, setSerial] = useState<string | null>(null);
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setState('loading');
    vaccinationsAPI.issueCertificate(String(visitId))
      .then(r => { if (!alive) return; setSerial(r.serial); setRecords(r.vaccinationRecords || []); setState('ready'); })
      .catch((e: any) => {
        if (!alive) return;
        const msg = String(e?.message || e?.response?.data?.message || '');
        setState(/no dose/i.test(msg) || e?.status === 400 || e?.response?.status === 400 ? 'none' : 'error');
      });
    return () => { alive = false; };
  }, [visitId, refreshKey, reload]);

  if (state === 'loading') {
    return <div className="py-10 flex items-center justify-center gap-2 text-[11px] text-slate-400"><Loader2 size={14} className="animate-spin" /> Preparing the certificate…</div>;
  }
  if (state === 'none' || state === 'error') {
    return (
      <div className="py-10 text-center space-y-3">
        <ShieldCheck size={28} className="mx-auto text-slate-300" />
        <p className="text-sm font-bold text-pine dark:text-zinc-100">
          {state === 'none' ? 'No vaccine on this visit is marked given yet' : 'The certificate could not be prepared'}
        </p>
        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
          {state === 'none'
            ? 'Mark each dose Given in the Treatment step (Vaccinations tab). The certificate lists every dose given on this visit.'
            : 'Check the connection and try again.'}
        </p>
        <button onClick={() => setReload(n => n + 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[11px] font-bold text-slate-500 hover:text-seafoam">
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    );
  }

  const ownerName = client?.name || [client?.firstName, client?.surname].filter(Boolean).join(' ') || '—';
  const phone = client?.phone || null;
  const email = client?.email || null;
  const staffName = (id?: string) => staff.find(s => String(s.id) === String(id))?.name || '—';
  const nextDue = records.map(r => r.nextDueAt).filter(Boolean).sort()[0] as string | undefined;
  const docId = 'visit-vaccine-certificate';
  const title = `Vaccination certificate ${serial} — ${pet?.name ?? ''}`;
  const summary = records.map(r => `${r.vaccineName}${r.batchNumber ? ` (batch ${r.batchNumber})` : ''}${r.nextDueAt ? `, next due ${day(r.nextDueAt)}` : ''}`).join('; ');
  const message = `${pet?.name ?? 'Your pet'}'s vaccination certificate ${serial} from ${clinic.name ?? 'the clinic'}: ${summary}.`;
  const mailto = email
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Vaccination certificate ${serial} — ${pet?.name ?? ''}`)}&body=${encodeURIComponent(`${message}\n\nThe certificate PDF is attached.\n\n${clinic.name ?? ''}`)}`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Serial <span className="font-mono text-pine dark:text-zinc-100">{serial}</span> · stored, can be looked up again
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <DocumentActions size="sm" elementId={docId} title={title} message={message} phone={phone} allowBlackAndWhite />
          {mailto && (
            <a href={mailto} className="flex items-center gap-2 rounded-xl font-black uppercase tracking-widest px-3 py-1.5 text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-seafoam"
               title="Opens an email to the client — download the PDF first and attach it">
              <Mail size={12} /> Email
            </a>
          )}
        </div>
      </div>

      <div id={docId} className="bg-white text-slate-900 border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-emerald-600 text-white px-6 py-5 flex items-start justify-between relative overflow-hidden">
          <div className="absolute -right-6 -bottom-8 opacity-10"><ShieldCheck size={120} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2"><ShieldCheck size={18} /><p className="text-lg font-black uppercase tracking-tighter">Vaccination Certificate</p></div>
            <p className="text-[10px] text-white/80 font-bold mt-1 tracking-wider uppercase">Serial · <span className="font-mono">{serial}</span></p>
          </div>
          <div className="relative z-10 text-right flex items-start gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-tight">{clinic.name}</p>
              {clinic.slogan && <p className="text-[9px] text-white/75 mt-0.5">{clinic.slogan}</p>}
              {clinic.phone && <p className="text-[9px] text-white/75 mt-0.5">Tel {clinic.phone}</p>}
              <p className="text-[9px] text-white/75 mt-0.5 uppercase tracking-wider">Official immunisation record</p>
            </div>
            {clinic.logo && /^(https?:|data:|\/)/.test(clinic.logo) && (
              <img src={clinic.logo} alt="" className="w-12 h-12 rounded-lg object-cover bg-white" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-emerald-100 border-b border-emerald-100 bg-emerald-50/50">
          <div className="px-5 py-3">
            <p className="text-[8px] font-black text-emerald-700 uppercase tracking-widest mb-1">Patient</p>
            <p className="text-sm font-black uppercase leading-tight">{pet?.name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{[pet?.species, pet?.breed, pet?.gender].filter(Boolean).join(' · ')}</p>
            {(pet?.rfidChipNumber || pet?.tagNumber) && (
              <p className="text-[10px] text-slate-500 mt-1 font-mono">{pet?.rfidChipNumber ? `Chip ${pet.rfidChipNumber}` : ''}{pet?.rfidChipNumber && pet?.tagNumber ? ' · ' : ''}{pet?.tagNumber ? `Tag ${pet.tagNumber}` : ''}</p>
            )}
          </div>
          <div className="px-5 py-3">
            <p className="text-[8px] font-black text-emerald-700 uppercase tracking-widest mb-1">Owner</p>
            <p className="text-sm font-black uppercase leading-tight">{ownerName}</p>
            {phone && <p className="text-[10px] text-slate-500 mt-0.5">{phone}</p>}
            {email && <p className="text-[10px] text-slate-500">{email}</p>}
          </div>
        </div>

        <div className="px-6 py-4">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#ecfdf5' }}>
                {['Vaccine', 'Batch / serial', 'Given', 'Next due', 'By'].map(h => (
                  <th key={h} className="py-2 px-2 text-left text-[9px] font-black uppercase tracking-widest text-emerald-800">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td className="py-2.5 px-2 align-top">
                    <div className="flex items-start gap-2">
                      <Syringe size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[12px] font-black leading-tight">{r.vaccineName}</p>
                        {r.vaccineType && <p className="text-[10px] text-slate-500">{r.vaccineType}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 align-top">
                    <p className="text-[11px] font-mono font-bold">{r.batchNumber || '—'}</p>
                    {r.batchExpiry && <p className="text-[9px] text-slate-500">Lot exp {day(r.batchExpiry)}</p>}
                  </td>
                  <td className="py-2.5 px-2 align-top text-[11px] font-bold">{day(r.administeredAt)}</td>
                  <td className="py-2.5 px-2 align-top text-[11px] font-black text-emerald-700">{day(r.nextDueAt)}</td>
                  <td className="py-2.5 px-2 align-top text-[11px]">{staffName(r.administeredById)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextDue && (
            <div className="mt-4 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: '#059669', color: '#fff' }}>
              <span className="text-[10px] font-black uppercase tracking-widest">Next vaccination due</span>
              <span className="text-lg font-black">{day(nextDue)}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-end justify-between gap-4">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Issued on</p>
            <p className="text-[11px] font-bold">{day(new Date().toISOString())}</p>
            <p className="text-[9px] text-slate-400 mt-2 max-w-xs">Generated from the clinic's records. Quote serial {serial} to confirm it with {clinic.name ?? 'the clinic'}.</p>
          </div>
          <div className="shrink-0 text-center">
            <div className="w-16 h-16 rounded-full border-2 border-emerald-600 text-emerald-700 flex flex-col items-center justify-center bg-white">
              <ShieldCheck size={22} />
              <span className="text-[6px] font-black uppercase tracking-widest mt-0.5">Verified</span>
            </div>
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Clinic stamp</p>
          </div>
        </div>
        <div className="px-6 py-2 bg-emerald-600 text-white flex items-center justify-between">
          <span className="text-[8px] font-black uppercase tracking-widest">VetHubCore · Clinic-verified</span>
          <span className="text-[8px] font-mono tracking-widest">#{serial}</span>
        </div>
      </div>
    </div>
  );
};

export default VaccinationCertificate;

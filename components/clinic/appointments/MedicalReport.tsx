import React from 'react';
import { Visit, Pet, Client, Clinic } from '../../../types';
import { DewormingRecord } from '../../../services';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';

interface Props {
  visit: Visit;
  pet: Pet;
  client?: Client;
  clinic: Clinic;
  // The wizard's clinical data (per-step slices) — the report compiles it
  // into one printable medical document.
  data: Record<string, any>;
  staff: { id: any; name: string }[];
  // Deworming lives in a sibling table (not the wizard data), so it's passed in.
  dewormingRecords?: DewormingRecord[];
}

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value ? (
    <div className="flex items-baseline gap-2">
      <span className="w-44 shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-[12px] text-slate-800 dark:text-zinc-200 font-medium">{value}</span>
    </div>
  ) : null;

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-pine dark:text-zinc-100 border-b-2 border-pine/20 dark:border-zinc-700 pb-1 mb-2 mt-5">{children}</h3>
);

// Renders the section body, or a quiet placeholder — the report always
// mirrors the full workflow (1 History … 8 Follow-up).
const Body: React.FC<{ has: boolean; children: React.ReactNode }> = ({ has, children }) =>
  has ? <>{children}</> : <p className="text-[11px] italic text-slate-400 dark:text-zinc-500">Not recorded.</p>;

const Narrative: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[12px] leading-relaxed text-slate-700 dark:text-zinc-300">{children}</p>
);

const lc = (s?: string | null) => (s || '').toLowerCase();
// Ensure a fragment ends as a sentence.
const dot = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
// Join fragments into a paragraph, skipping empties.
const prose = (parts: (string | false | undefined | null)[]) =>
  parts.filter(Boolean).map(p => dot(String(p))).join(' ');

/**
 * The Medical Report — a compiled, printable clinical document written as
 * light narrative: history → examination → assessment → diagnostics →
 * diagnosis → treatment → client communication → follow-up.
 */
const MedicalReport: React.FC<Props> = ({ visit, pet, client, clinic, data, staff, dewormingRecords = [] }) => {
  const h = data.history || {};
  const ex = data.examination || {};
  const as = data.assessment || {};
  const dg = data.diagnostics || {};
  const dx = data.diagnosis || {};
  const tx = data.treatment || {};
  const cm = data.communication || {};
  const fu = data.followUp || {};
  const systems: Record<string, { normal?: boolean; findings?: string }> = ex.systems || {};
  const abnormalSystems = Object.entries(systems).filter(([, s]) => s.findings && s.findings.trim());
  const nadSystems = Object.entries(systems).filter(([, s]) => s.normal).map(([n]) => n);
  const staffName = (id: any) => staff.find(s => String(s.id) === String(id))?.name;
  const consentLabels: Record<string, string> = {
    generalTreatment: 'general treatment', hospitalisation: 'hospitalisation', anaesthesia: 'anaesthesia',
    surgery: 'surgery', bloodTransfusion: 'blood transfusion', euthanasia: 'euthanasia',
  };
  const consents = Object.entries(cm.consents || {}).filter(([, on]) => on).map(([k]) => consentLabels[k] || k);

  // ── Narratives per section ─────────────────────────────────────
  const historyText = prose([
    h.chiefComplaint && `${pet.name} presented with ${lc(h.chiefComplaint)}${h.duration ? ` of ${lc(h.duration)} duration` : ''}${h.onset ? ` (${lc(h.onset)} onset)` : ''}`,
    h.presentIllness,
    h.currentMedication && `Currently on ${h.currentMedication}`,
    (h.diet || h.appetite) && `Diet: ${h.diet || 'unspecified'}${h.appetite ? `, with ${lc(h.appetite)} appetite` : ''}${h.waterIntake ? ` and ${lc(h.waterIntake)} water intake` : ''}`,
    (h.urination || h.defecation) && `Urination ${lc(h.urination) || 'normal'}, defecation ${lc(h.defecation) || 'normal'}`,
    (h.vaccinationStatus || h.parasiteControl) && `Vaccination ${lc(h.vaccinationStatus) || 'unknown'}; parasite control ${lc(h.parasiteControl) || 'unknown'}`,
    h.previousIllness && `Previous history: ${h.previousIllness}`,
  ]);

  const vitalsBits = [
    ex.temperature && `temperature ${ex.temperature}°C`, ex.weight && `weight ${ex.weight} kg`,
    ex.hr && `heart rate ${ex.hr} bpm`, ex.rr && `respiratory rate ${ex.rr} rpm`,
    ex.bcs && `body condition ${ex.bcs}`, ex.hydration && `hydration ${lc(ex.hydration)}`,
    ex.painScore && `pain score ${ex.painScore}/10`,
  ].filter(Boolean);
  const examText = prose([
    (ex.mentation || vitalsBits.length) && `On physical examination ${pet.name} was ${lc(ex.mentation) || 'assessed'}${vitalsBits.length ? ` — ${vitalsBits.join(', ')}` : ''}`,
    abnormalSystems.length > 0 && `Abnormalities noted — ${abnormalSystems.map(([n, s]) => `${n}: ${s.findings}`).join('; ')}`,
    nadSystems.length > 0 && `${nadSystems.join(', ')} were unremarkable`,
    ex.notes,
  ]);

  const assessText = prose([
    (as.problems || []).length > 0 && `Problems identified: ${(as.problems as string[]).join(', ')}`,
    (as.differentials || []).length > 0 && `Differentials considered: ${(as.differentials as any[]).map(d => `${d.name} (${lc(d.likelihood)})`).join(', ')}`,
    as.tentativePrimary && `Working diagnosis: ${as.tentativePrimary}${as.tentativeSecondary ? `, with ${as.tentativeSecondary}` : ''}`,
    as.tentativeNotes,
    as.clinicalImpression,
  ]);

  const dgText = prose([
    dg.keyFindings && `Key findings: ${String(dg.keyFindings).replace(/\n+/g, '; ')}`,
    dg.interpretation && `Interpretation: ${dg.interpretation}`,
    dg.recommendations && `Recommended: ${dg.recommendations}`,
    dg.pending && `Pending: ${dg.pending}`,
  ]);

  const dxText = prose([
    dx.presumptive && `A presumptive diagnosis of ${dx.presumptive} was made${dx.confidence ? ` with ${lc(dx.confidence)} confidence` : ''}`,
    dx.confirmed && `This was confirmed as ${dx.confirmed}${dx.dateConfirmed ? ` on ${dx.dateConfirmed}` : ''}${dx.confirmedBy && staffName(dx.confirmedBy) ? ` by ${staffName(dx.confirmedBy)}` : ''}`,
    (dx.onset || dx.etiology) && `Onset is ${lc(dx.onset) || 'unspecified'}${dx.etiology ? `; likely cause: ${lc(dx.etiology)}` : ''}`,
    (dx.severity || dx.status) && `The condition is ${[lc(dx.severity), lc(dx.status)].filter(Boolean).join(' and ')}`,
    dx.prognosis && `Prognosis is ${lc(dx.prognosis)}`,
    dx.notes,
  ]);

  const txText = prose([
    (tx.medications || []).length > 0 && `Treatment comprised ${(tx.medications as any[]).length} medication${(tx.medications as any[]).length === 1 ? '' : 's'} as detailed below`,
    (tx.procedures || []).length > 0 && `Procedures performed: ${(tx.procedures as string[]).join(', ')}`,
    tx.plan,
  ]);

  const cmText = prose([
    (cm.summary && Object.values(cm.summary).some(Boolean)) && 'The findings, treatment options, risks and expected costs were discussed with the client',
    consents.length > 0 && `Consent was signed for ${consents.join(', ')}`,
    cm.decision && `The client ${lc(cm.decision)} the plan${cm.estimateApproved ? ` (estimate ${lc(cm.estimateApproved)})` : ''}`,
    cm.homeCare && `Home care: ${String(cm.homeCare).replace(/\n+/g, '; ')}`,
    cm.notes,
  ]);

  const fuText = prose([
    fu.currentOutcome && `${pet.name} was ${lc(fu.currentOutcome)} at the end of the consultation${fu.closeOutcome ? ` and ${lc(fu.closeOutcome)} when the visit was closed` : ''}`,
    (fu.reminders || []).length > 0 && `Follow-up points: ${(fu.reminders as any[]).map(r => `${r.title} (due ${r.dueDate})`).join('; ')}`,
    (fu.carePlan || []).length > 0 && `Care plan: ${(fu.carePlan as string[]).join('; ')}`,
    fu.monitoring && Object.values(fu.monitoring).some(Boolean) && `The owner will monitor ${Object.entries(fu.monitoring).filter(([, on]) => on).map(([k]) => k.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')} at home`,
    fu.outcomeNotes,
  ]);

  return (
    <div className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 p-6 space-y-1">
      {/* Letterhead */}
      <div className="flex items-start justify-between border-b-4 border-pine pb-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-pine dark:text-zinc-100">{clinic.name}</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medical Report</p>
        </div>
        <div className="text-right text-[11px] font-bold text-slate-500 dark:text-zinc-400">
          <p>Visit #{visit.id}</p>
          <p>{formatDate(visit.date)} · {formatTime(visit.date)}</p>
          {visit.leadStaff?.name && <p>Attending: {visit.leadStaff.name}</p>}
        </div>
      </div>

      {/* Patient & owner */}
      <div className="grid grid-cols-2 gap-x-8 pt-3">
        <div className="space-y-1">
          <Row label="Patient" value={`${pet.name} — ${pet.breed || ''} ${pet.species || ''}${pet.age ? `, ${pet.age}y` : ''}`} />
          <Row label="Visit type" value={`${(visit.encounterType || 'VET_VISIT').replace('_', ' ')}${visit.visitType ? ` · ${visit.visitType.replace('_', ' ')}` : ''}${visit.isHouseCall ? ' · House call' : ''}`} />
        </div>
        <div className="space-y-1">
          <Row label="Owner" value={client?.name} />
          <Row label="Contact" value={client ? `${client.phone || ''}${client.email ? ` · ${client.email}` : ''}` : undefined} />
        </div>
      </div>

      {/* Services */}
      {(visit.tasks || []).length > 0 && (
        <>
          <SectionTitle>Services Rendered</SectionTitle>
          <p className="text-[12px] font-medium">{(visit.tasks || []).map(t => t.name).join(' · ')}</p>
        </>
      )}

      <SectionTitle>1 · History</SectionTitle>
      <Body has={!!historyText}><Narrative>{historyText}</Narrative></Body>

      <SectionTitle>2 · Examination</SectionTitle>
      <Body has={!!examText}><Narrative>{examText}</Narrative></Body>

      <SectionTitle>3 · Assessment</SectionTitle>
      <Body has={!!assessText}><Narrative>{assessText}</Narrative></Body>

      <SectionTitle>4 · Diagnostics</SectionTitle>
      <Body has={!!dgText}><Narrative>{dgText}</Narrative></Body>

      <SectionTitle>5 · Diagnosis</SectionTitle>
      <Body has={!!dxText}><Narrative>{dxText}</Narrative></Body>

      <SectionTitle>6 · Treatment</SectionTitle>
      <Body has={!!(txText || (tx.medications || []).length > 0)}>
        {txText && <Narrative>{txText}</Narrative>}
        {(tx.medications || []).length > 0 && (
          <table className="w-full text-[11px] mt-2">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wider text-[8px] font-black border-b border-slate-200 dark:border-zinc-700">
                <th className="py-1 pr-2">Medication</th><th className="py-1 px-2">Dose</th><th className="py-1 px-2">Route</th><th className="py-1 px-2">Frequency</th><th className="py-1 pl-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {(tx.medications || []).map((m: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 dark:border-zinc-800">
                  <td className="py-1 pr-2 font-bold">{m.drug}</td><td className="py-1 px-2">{m.dose}</td><td className="py-1 px-2">{m.route}</td><td className="py-1 px-2">{m.frequency}</td><td className="py-1 pl-2">{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Body>

      {/* Deworming — status line + protocol, embedded from the deworming record. */}
      {(() => {
        const dewormed = (dewormingRecords || []).filter(d => d.status === 'ADMINISTERED' || d.dewormedAt);
        const isDewormVisit = (visit as any)?.visitType === 'DEWORMING' || (dewormingRecords || []).length > 0;
        return (
          <>
            <SectionTitle>Deworming</SectionTitle>
            <Body has={true}>
              {dewormed.length > 0 ? (
                <>
                  <Narrative>Status: Up to date</Narrative>
                  {dewormed.map((d) => (
                    <p key={d.id} className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400 mt-0.5">
                      {d.productName || 'Dewormer'}{d.wormType ? ` (${d.wormType})` : ''} — given {formatDate(d.dewormedAt as any)}
                      {d.nextDueAt ? `, next due ${formatDate(d.nextDueAt as any)}` : ''}
                      {d.route ? ` · ${d.route}` : ''}
                    </p>
                  ))}
                </>
              ) : (
                <Narrative>Status: {isDewormVisit ? 'Pending — not yet recorded' : 'Unknown'}</Narrative>
              )}
            </Body>
          </>
        );
      })()}

      <SectionTitle>7 · Client Communication</SectionTitle>
      <Body has={!!cmText}>
        <Narrative>{cmText}</Narrative>
        {cm.signature && <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400">Signed: {cm.signature}{cm.signedAt ? ` — ${formatDate(cm.signedAt)}` : ''}</p>}
      </Body>

      <SectionTitle>8 · Outcome &amp; Follow-up</SectionTitle>
      <Body has={!!fuText}><Narrative>{fuText}</Narrative></Body>

      {/* Signature block */}
      <div className="grid grid-cols-2 gap-8 pt-8">
        <div className="border-t border-slate-300 dark:border-zinc-700 pt-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attending Veterinarian</p>
          <p className="text-[12px] font-bold">{visit.leadStaff?.name || ''}</p>
        </div>
        <div className="border-t border-slate-300 dark:border-zinc-700 pt-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</p>
          <p className="text-[12px] font-bold">{formatDate(visit.date)}</p>
        </div>
      </div>
      <p className="pt-3 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Generated by VetHub Core · {clinic.name}</p>
    </div>
  );
};

export default MedicalReport;

import React from 'react';
import { Visit, Pet, Client, Clinic } from '../../../types';
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

/**
 * The Medical Report — a compiled, printable clinical document for the visit:
 * history → examination → assessment → diagnostics → diagnosis → treatment →
 * client communication → follow-up, from the clinical workflow's data.
 */
const MedicalReport: React.FC<Props> = ({ visit, pet, client, clinic, data, staff }) => {
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
  const staffName = (id: any) => staff.find(s => String(s.id) === String(id))?.name;
  const vitals = [
    ex.temperature && `Temp ${ex.temperature}°C`, ex.weight && `Weight ${ex.weight} kg`,
    ex.hr && `HR ${ex.hr} bpm`, ex.rr && `RR ${ex.rr} rpm`,
    ex.mentation && `Mentation: ${ex.mentation}`, ex.bcs && `BCS ${ex.bcs}`,
    ex.hydration && `Hydration: ${ex.hydration}`, ex.painScore && `Pain ${ex.painScore}/10`,
  ].filter(Boolean).join(' · ');
  const checkedLabels = (obj: Record<string, boolean> | undefined, labels: Record<string, string>) =>
    Object.entries(obj || {}).filter(([, on]) => on).map(([k]) => labels[k] || k).join(', ');
  const consentLabels: Record<string, string> = {
    generalTreatment: 'General treatment', hospitalisation: 'Hospitalisation', anaesthesia: 'Anaesthesia',
    surgery: 'Surgery', bloodTransfusion: 'Blood transfusion', euthanasia: 'Euthanasia',
  };

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

      {/* History */}
      <SectionTitle>1 · History</SectionTitle>
      <Body has={!!(h.chiefComplaint || h.presentIllness || h.currentMedication || h.diet)}>
          <div className="space-y-1">
            <Row label="Chief complaint" value={h.chiefComplaint} />
            <Row label="Duration / onset" value={[h.duration, h.onset].filter(Boolean).join(' · ')} />
            <Row label="Present illness" value={h.presentIllness} />
            <Row label="Current medication" value={h.currentMedication} />
            <Row label="Diet / appetite" value={[h.diet, h.appetite && `appetite ${h.appetite.toLowerCase()}`].filter(Boolean).join(' · ')} />
            <Row label="Elimination" value={[h.urination && `urination ${h.urination.toLowerCase()}`, h.defecation && `defecation ${h.defecation.toLowerCase()}`].filter(Boolean).join(' · ')} />
            <Row label="Vaccination / parasites" value={[h.vaccinationStatus, h.parasiteControl].filter(Boolean).join(' · ')} />
            <Row label="Previous illness" value={h.previousIllness} />
          </div>
      </Body>

      {/* Examination */}
      <SectionTitle>2 · Examination</SectionTitle>
      <Body has={!!(vitals || abnormalSystems.length > 0 || ex.notes)}>
          <div className="space-y-1">
            <Row label="Vitals" value={vitals} />
            {abnormalSystems.length > 0 && abnormalSystems.map(([name, s]) => (
              <Row key={name} label={name} value={s.findings} />
            ))}
            {Object.values(systems).some(s => s.normal) && (
              <Row label="Systems NAD" value={Object.entries(systems).filter(([, s]) => s.normal).map(([n]) => n).join(', ')} />
            )}
            <Row label="Notes" value={ex.notes} />
          </div>
      </Body>

      {/* Assessment */}
      <SectionTitle>3 · Assessment</SectionTitle>
      <Body has={!!((as.problems || []).length > 0 || as.clinicalImpression || as.tentativePrimary)}>
          <div className="space-y-1">
            <Row label="Problem list" value={(as.problems || []).join(', ')} />
            <Row label="Differentials" value={(as.differentials || []).map((d: any) => `${d.name} (${d.likelihood?.toLowerCase()})`).join(', ')} />
            <Row label="Tentative diagnosis" value={[as.tentativePrimary, as.tentativeSecondary].filter(Boolean).join(' · ')} />
            <Row label="Clinical impression" value={as.clinicalImpression} />
          </div>
      </Body>

      {/* Diagnostics */}
      <SectionTitle>4 · Diagnostics</SectionTitle>
      <Body has={!!(dg.keyFindings || dg.interpretation || dg.recommendations || dg.pending)}>
          <div className="space-y-1">
            {dg.keyFindings && <Row label="Key findings" value={<span className="whitespace-pre-wrap">{dg.keyFindings}</span>} />}
            <Row label="Interpretation" value={dg.interpretation} />
            <Row label="Recommendations" value={dg.recommendations} />
            <Row label="Pending / external" value={dg.pending} />
          </div>
      </Body>

      {/* Diagnosis */}
      <SectionTitle>5 · Diagnosis</SectionTitle>
      <Body has={!!(dx.presumptive || dx.confirmed)}>
          <div className="space-y-1">
            <Row label="Presumptive" value={dx.presumptive && `${dx.presumptive}${dx.confidence ? ` (confidence: ${dx.confidence.toLowerCase()})` : ''}`} />
            <Row label="Confirmed" value={dx.confirmed && `${dx.confirmed}${dx.dateConfirmed ? ` — ${dx.dateConfirmed}` : ''}${dx.confirmedBy && staffName(dx.confirmedBy) ? ` by ${staffName(dx.confirmedBy)}` : ''}`} />
            <Row label="Onset / etiology" value={[dx.onset, dx.etiology].filter(Boolean).join(' · ')} />
            <Row label="Severity / status" value={[dx.severity, dx.status].filter(Boolean).join(' · ')} />
            <Row label="Prognosis" value={dx.prognosis} />
            <Row label="Notes" value={dx.notes} />
          </div>
      </Body>

      {/* Treatment */}
      <SectionTitle>6 · Treatment</SectionTitle>
      <Body has={!!((tx.medications || []).length > 0 || (tx.procedures || []).length > 0 || tx.plan)}>
          {(tx.medications || []).length > 0 && (
            <table className="w-full text-[11px] mb-2">
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
          <div className="space-y-1">
            <Row label="Procedures" value={(tx.procedures || []).join(', ')} />
            <Row label="Plan & instructions" value={tx.plan && <span className="whitespace-pre-wrap">{tx.plan}</span>} />
          </div>
      </Body>

      {/* Communication */}
      <SectionTitle>7 · Client Communication</SectionTitle>
      <Body has={!!(cm.decision || cm.homeCare || checkedLabels(cm.consents, consentLabels))}>
          <div className="space-y-1">
            <Row label="Consents signed" value={checkedLabels(cm.consents, consentLabels)} />
            <Row label="Client decision" value={[cm.decision, cm.estimateApproved && `estimate: ${cm.estimateApproved.toLowerCase()}`].filter(Boolean).join(' · ')} />
            <Row label="Home care" value={cm.homeCare && <span className="whitespace-pre-wrap">{cm.homeCare}</span>} />
            {cm.signature && <Row label="Signed" value={`${cm.signature}${cm.signedAt ? ` — ${formatDate(cm.signedAt)}` : ''}`} />}
          </div>
      </Body>

      {/* Follow-up */}
      <SectionTitle>8 · Outcome &amp; Follow-up</SectionTitle>
      <Body has={!!(fu.currentOutcome || fu.nextDate || (fu.reminders || []).length > 0 || (fu.carePlan || []).length > 0)}>
          <div className="space-y-1">
            <Row label="Outcome" value={[fu.currentOutcome, fu.closeOutcome && `on close: ${fu.closeOutcome.toLowerCase()}`].filter(Boolean).join(' · ')} />
            <Row label="Next visit" value={fu.nextDate && `${fu.nextDate}${fu.nextTime ? ` ${fu.nextTime}` : ''}${fu.nextVet && staffName(fu.nextVet) ? ` — ${staffName(fu.nextVet)}` : ''}`} />
            <Row label="Care plan" value={(fu.carePlan || []).join('; ')} />
            <Row label="Reminder points" value={(fu.reminders || []).map((r: any) => `${r.title} (due ${r.dueDate})`).join('; ')} />
            <Row label="Notes" value={fu.outcomeNotes} />
          </div>
      </Body>

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

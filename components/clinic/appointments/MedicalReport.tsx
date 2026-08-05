import React, { useEffect, useState } from 'react';
import { Visit, Pet, Client, Clinic } from '../../../types';
import { DewormingRecord, FormField, LayoutStage, labAPI, imagingAPI } from '../../../services';
import { formatDate, formatTime } from '../../../services/utils/dateFormatter';
import { toEntries, SystemValue } from './wizard/SystemFindings';

interface Props {
  /** Suppress the trailing sign-off — the page renders it once, below every section. */
  hideSignature?: boolean;
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
  // The clinic-built workflow this consultation ran under, when there was one
  // (backend 136). Supplies the labels and ORDER for anything the clinic added
  // itself — without it, a custom answer is an unlabelled key in a JSON blob.
  templateStages?: LayoutStage[];
  templateFields?: Record<string, FormField>;
}

// ── Custom fields (form builder P4) ──────────────────────────────────────
// Core fields keep the hand-written narratives below — nothing about the
// existing report changes. A field the CLINIC added has no prose written for
// it, so it is reported as a labelled fact instead. Two tiers, by design:
// see backend/docs/DYNAMIC_FORM_BUILDER.md §7.

const leafOf = (key: string) => key.split('.').pop() || key;

/** Render any stored answer as report-safe text. Empty → null (row is dropped). */
const factValue = (v: any): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(x => (typeof x === 'string' ? x : x?.name ?? x?.label)).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof v === 'object') {
    // Catalog picks are stored as { id, name } so a later phase can turn the
    // answer into a real order or bill line — the report wants the name.
    if (typeof v.name === 'string' && v.name.trim()) return v.name.trim();
    // normalAbnormal: { normal, findings, entries }. A clinic-added system card
    // gets the same titled treatment as the built-in ones.
    if ('normal' in v || 'findings' in v || 'entries' in v) {
      const es = toEntries(v as SystemValue).filter(e => e.text.trim());
      if (es.length) {
        return es
          .map(e => (e.key === 'general' && es.length === 1 ? e.text.trim() : `${e.label} — ${e.text.trim()}`))
          .join('; ');
      }
      return v.normal ? 'Normal' : null;
    }
    // checks: { key: boolean }
    const ticked = Object.entries(v).filter(([, on]) => on).map(([k]) => k);
    return ticked.length ? ticked.join(', ') : null;
  }
  return null;
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <span className="w-44 shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <span className="text-[12px] text-slate-800 dark:text-zinc-200 font-medium">{value}</span>
  </div>
);

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
/** "eyes, ears and abdomen" — reads as a sentence, not a CSV. */
const lcList = (names: string[]): string => {
  const l = names.map(n => lc(n));
  if (l.length <= 1) return l[0] || '';
  return `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
};
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
const MedicalReport: React.FC<Props> = ({ visit, pet, client, clinic, data, staff, dewormingRecords = [], templateStages = [], templateFields = {}, hideSignature }) => {
  // Diagnostic RESULTS live in the lab/imaging module tables, not the wizard's
  // consultation data — without this fetch a completed X-ray printed as
  // "Not recorded" (transfer visit 134). Silent: the report still renders if
  // the fetch fails; results simply stay absent.
  const [diagRecs, setDiagRecs] = useState<{ lab: any[]; imaging: any[] }>({ lab: [], imaging: [] });
  useEffect(() => {
    let alive = true;
    Promise.all([
      labAPI.list({ appointmentId: visit.id } as any, { silent: true } as any).catch(() => null),
      imagingAPI.list({ appointmentId: visit.id } as any, { silent: true } as any).catch(() => null),
    ]).then(([lab, img]) => {
      if (!alive) return;
      const vid = String(visit.id);
      setDiagRecs({
        lab: (lab?.data?.records || []).filter((r: any) => String(r.appointmentId ?? '') === vid),
        imaging: (img?.data?.records || []).filter((r: any) => String(r.appointmentId ?? '') === vid),
      });
    });
    return () => { alive = false; };
  }, [visit.id]);
  const h = data.history || {};
  const ex = data.examination || {};
  const as = data.assessment || {};
  const dg = data.diagnostics || {};
  const dx = data.diagnosis || {};
  const tx = data.treatment || {};
  const cm = data.communication || {};
  // §0f #3: professional follow-up judgments are per encounter kind; the
  // clinical report reads the vet-visit slot with a MANDATORY fallback to the
  // legacy shared slot so pre-split records don't look wiped.
  const fu = { ...(data.followUp || {}), ...(data['followUp:VET_VISIT'] || {}) };
  const systems: Record<string, SystemValue> = ex.systems || {};
  const abnormalSystems = Object.entries(systems).filter(([, s]) => s.findings && s.findings.trim());
  // Grouped by title: each abnormal system with its individual findings, so the
  // report prints "Retina — mild degeneration" as its own line instead of
  // burying it in a run-on "Eyes: Retina: …; Cornea: …" string.
  //
  // A record written before titled findings existed yields a single entry keyed
  // `general` holding the whole old string — printed bare, with no invented
  // title, because we do not know what the vet meant it to be called.
  const groupedSystems = abnormalSystems
    .map(([name, s]) => ({ name, entries: toEntries(s).filter(e => e.text.trim()) }))
    .filter(g => g.entries.length > 0);
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
    // Names only — the grouped block below carries the detail, so the same
    // findings are not printed twice in two different shapes.
    groupedSystems.length > 0 && `Abnormalities noted on ${lcList(groupedSystems.map(g => g.name))}`,
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

  // Facts a clinic added to a given stage, in the order they laid them out.
  // Core fields are skipped — their narrative is written above.
  const customFacts = (stageKey: string): { label: string; value: string }[] => {
    const stage = templateStages.find(st => st.key === stageKey);
    if (!stage) return [];
    const slice = data[stageKey] || {};
    const out: { label: string; value: string }[] = [];
    for (const sec of stage.sections || []) {
      for (const pf of sec.fields || []) {
        const def = templateFields[pf.fieldKey];
        if (!def || def.isCore) continue;
        const value = factValue(slice[leafOf(def.key)]);
        if (value) out.push({ label: def.label, value });
      }
    }
    return out;
  };

  const Extras: React.FC<{ stageKey: string }> = ({ stageKey }) => {
    const facts = customFacts(stageKey);
    if (!facts.length) return null;
    return (
      <div className="mt-1.5 space-y-1">
        {facts.map(f => <Fact key={f.label} label={f.label} value={f.value} />)}
      </div>
    );
  };

  // Stages the clinic invented outright have no numbered section to sit under,
  // so they are reported after the standard eight, in template order.
  const KNOWN = new Set(['history', 'examination', 'assessment', 'diagnostics', 'diagnosis', 'treatment', 'communication', 'followUp']);
  const extraStages = templateStages.filter(st => !KNOWN.has(st.key) && customFacts(st.key).length > 0);

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

      {/* Services — CLINICAL only (user, 2026-08-03: reports are per
          encounter, so grooming/boarding lines live on their own reports;
          this document carries the medical work). */}
      {(() => {
        const clinical = (visit.tasks || []).filter(t => !/groom|board/i.test(t.category || ''));
        return clinical.length > 0 ? (
          <>
            <SectionTitle>Services Rendered</SectionTitle>
            <p className="text-[12px] font-medium">{clinical.map(t => t.name).join(' · ')}</p>
          </>
        ) : null;
      })()}

      <SectionTitle>1 · History</SectionTitle>
      <Body has={!!historyText || customFacts('history').length > 0}>
        {historyText && <Narrative>{historyText}</Narrative>}
        <Extras stageKey="history" />
      </Body>

      <SectionTitle>2 · Examination</SectionTitle>
      <Body has={!!examText || groupedSystems.length > 0 || customFacts('examination').length > 0}>
        {examText && <Narrative>{examText}</Narrative>}
        {groupedSystems.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {groupedSystems.map(g => (
              <div key={g.name} className="break-inside-avoid">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{g.name}</p>
                <div className="pl-3 space-y-0.5">
                  {g.entries.map(e => (
                    <p key={e.key} className="text-[12px] text-slate-800 dark:text-zinc-200">
                      {/* A legacy untitled finding prints bare — see groupedSystems. */}
                      {e.key === 'general' && g.entries.length === 1
                        ? e.text.trim()
                        : <><span className="font-bold">{e.label}</span> — {e.text.trim()}</>}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <Extras stageKey="examination" />
      </Body>

      <SectionTitle>3 · Assessment</SectionTitle>
      <Body has={!!assessText || customFacts('assessment').length > 0}>
        {assessText && <Narrative>{assessText}</Narrative>}
        <Extras stageKey="assessment" />
      </Body>

      <SectionTitle>4 · Diagnostics</SectionTitle>
      <Body has={!!dgText || customFacts('diagnostics').length > 0 || diagRecs.lab.length > 0 || diagRecs.imaging.length > 0}>
        {dgText && <Narrative>{dgText}</Narrative>}
        {/* Actual results from the module records — including work a PARTNER
            clinic performed and mirrored back on a transfer. */}
        {diagRecs.imaging.map((r: any) => (
          <p key={`img-${r.id}`} className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400 mt-0.5">
            <span className="font-bold text-slate-700 dark:text-zinc-300">{r.modality || 'Imaging'}{r.bodyPart ? ` — ${r.bodyPart}` : ''}</span>
            {r.status ? ` · ${String(r.status).toLowerCase().replace(/_/g, ' ')}` : ''}
            {r.externalSource ? ` · via ${r.externalSource}` : ''}
            {r.findings ? ` — ${r.findings}` : ' — no findings recorded'}
          </p>
        ))}
        {diagRecs.lab.map((r: any) => (
          <p key={`lab-${r.id}`} className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400 mt-0.5">
            <span className="font-bold text-slate-700 dark:text-zinc-300">{r.panelName || 'Lab panel'}</span>
            {r.status ? ` · ${String(r.status).toLowerCase().replace(/_/g, ' ')}` : ''}
            {r.externalSource ? ` · via ${r.externalSource}` : ''}
            {(r.interpretation || r.notes) ? ` — ${r.interpretation || r.notes}` : ''}
          </p>
        ))}
        <Extras stageKey="diagnostics" />
      </Body>

      <SectionTitle>5 · Diagnosis</SectionTitle>
      <Body has={!!dxText || customFacts('diagnosis').length > 0}>
        {dxText && <Narrative>{dxText}</Narrative>}
        <Extras stageKey="diagnosis" />
      </Body>

      <SectionTitle>6 · Treatment</SectionTitle>
      <Body has={!!(txText || (tx.medications || []).length > 0 || customFacts('treatment').length > 0)}>
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
        <Extras stageKey="treatment" />
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
      <Body has={!!cmText || customFacts('communication').length > 0}>
        {cmText && <Narrative>{cmText}</Narrative>}
        {cm.signature && <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400">Signed: {cm.signature}{cm.signedAt ? ` — ${formatDate(cm.signedAt)}` : ''}</p>}
        <Extras stageKey="communication" />
      </Body>

      <SectionTitle>8 · Outcome &amp; Follow-up</SectionTitle>
      <Body has={!!fuText || customFacts('followUp').length > 0}>
        {fuText && <Narrative>{fuText}</Narrative>}
        <Extras stageKey="followUp" />
      </Body>

      {/* Stages this clinic added itself — reported in the order it laid them out. */}
      {extraStages.map(st => (
        <React.Fragment key={st.key}>
          <SectionTitle>{st.label}</SectionTitle>
          <Body has><Extras stageKey={st.key} /></Body>
        </React.Fragment>
      ))}

      {/* The signature moved OUT (user, 2026-08-04): it sat here, mid-document,
          with the Diagnostic Record and every other module record printing
          BELOW it — so the vet appeared to have signed off on half the report.
          The page renders <ReportSignOff> once, after everything. */}
      {!hideSignature && <ReportSignOff staffName={visit.leadStaff?.name} date={formatDate(visit.date)} clinicName={clinic.name} />}
    </div>
  );
};

/**
 * The sign-off that closes a printed report — attending vet, date, provenance.
 * Rendered ONCE, below every section, because a signature above later content
 * claims more than it should.
 */
export const ReportSignOff: React.FC<{ staffName?: string | null; date: string; clinicName: string }> = ({ staffName, date, clinicName }) => (
  <div className="px-4 sm:px-6 pb-5">
    <div className="grid grid-cols-2 gap-8 pt-8">
      <div className="border-t border-slate-300 dark:border-zinc-700 pt-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attending Veterinarian</p>
        <p className="text-[12px] font-bold">{staffName || ''}</p>
      </div>
      <div className="border-t border-slate-300 dark:border-zinc-700 pt-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</p>
        <p className="text-[12px] font-bold">{date}</p>
      </div>
    </div>
    <p className="pt-3 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Generated by VetHubCore · {clinicName}</p>
  </div>
);

export default MedicalReport;

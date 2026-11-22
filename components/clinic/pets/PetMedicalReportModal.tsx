import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Visit, Pet, Client, Clinic } from '../../../types';
import { visitsAPI, workflowTemplatesAPI, dewormingAPI, DewormingRecord, WorkflowTemplate } from '../../../services';
import MedicalReport, { ReportSignOff } from '../appointments/MedicalReport';
import DocumentActions from '../shared/DocumentActions';
import { buildDocumentMessage } from '../shared/documentShare';
import { formatDate } from '../../../services/utils/dateFormatter';

/**
 * One visit's compiled Medical Report, opened from the patient profile
 * (user, 2026-11-22: "I want to see their medical reports in a tab in patient").
 *
 * READ-ONLY on purpose: it loads the saved consultation record and its
 * workflow template itself instead of mounting useVisitWizard, because the
 * wizard hook autosaves its state back to the server — a viewer must never
 * write to a visit's record.
 */
interface Props {
  visit: Visit;
  pet: Pet;
  client?: Client;
  clinic: Clinic;
  onClose: () => void;
}

const PetMedicalReportModal: React.FC<Props> = ({ visit, pet, client, clinic, onClose }) => {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [deworming, setDeworming] = useState<DewormingRecord[]>([]);

  useEffect(() => {
    let live = true;
    setData(null); setTemplate(null);
    visitsAPI.getWorkflow(visit.id).then(res => {
      if (!live) return;
      const w: any = res.success ? res.data?.workflow : null;
      const { __events: _e, __entryKeyOverride: _o, ...stepData } = (w?.data || {}) as any;
      setData(stepData);
      const pick = w?.templateId
        ? workflowTemplatesAPI.getById(String(w.templateId))
        : workflowTemplatesAPI.resolve({
            encounterType: visit.encounterType as any,
            visitType: (visit as any).visitType ?? null,
            species: pet.species ?? null,
            entryKey: w?.entryKey,
          } as any);
      pick.then(r => { if (live) setTemplate(r.success ? (r.data?.template ?? null) : null); }).catch(() => {});
    }).catch(() => { if (live) setData({}); });
    dewormingAPI.list({ appointmentId: visit.id.toString() })
      .then(res => { if (live) setDeworming(res.data?.records || []); })
      .catch(() => {});
    return () => { live = false; };
  }, [visit.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const templateFields: Record<string, any> = {};
  for (const f of template?.fields || []) templateFields[f.key] = f;
  const lead: any = (visit as any).leadStaff ?? (visit as any).assignedStaff;
  const staff = lead?.id ? [{ id: lead.id, name: lead.name }] : [];
  const elId = `pet-medical-report-${visit.id}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[800] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-3xl w-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">🩺 Medical Report</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{pet.name} · {formatDate(visit.date)} · Visit #{visit.id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DocumentActions
              size="sm"
              elementId={elId}
              title={`Medical Report — ${pet.name} — Visit #${visit.id}`}
              phone={client?.phone}
              message={buildDocumentMessage({ docLabel: `medical report for ${pet.name}`, clientName: client?.name, clinicName: clinic.name })}
            />
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine" aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <div className="p-5">
          {data === null ? (
            <p className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading the report…</p>
          ) : (
            <div id={elId} className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <MedicalReport
                visit={visit} pet={pet} client={client} clinic={clinic}
                data={data}
                staff={staff}
                dewormingRecords={deworming}
                templateStages={template?.stages || []}
                templateFields={templateFields}
                hideSignature
              />
              <div className="px-5 pb-5">
                <ReportSignOff staffName={lead?.name} date={formatDate(visit.date)} clinicName={clinic.name} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PetMedicalReportModal;

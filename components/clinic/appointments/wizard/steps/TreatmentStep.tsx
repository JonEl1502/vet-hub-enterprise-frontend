import React from 'react';
import { Pill, Scissors, ClipboardList } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, ListEditor } from '../fields';

const ROUTES = ['PO', 'IV', 'IM', 'SC', 'Topical', 'Other'];

interface MedRow { drug: string; dose: string; route: string; frequency: string; duration: string }

// UI-ONLY phase: medications typed here live in wizard state. The real MAR
// (VisitMedication + inventory deduction) takes over when APIs are wired —
// the count of already-recorded MAR medications is surfaced below.

const TreatmentStep: React.FC<StepProps> = ({ visit, data, setData, emit }) => {
  const d = data || {};
  const meds: MedRow[] = d.medications || [];
  const [draft, setDraft] = React.useState<MedRow>({ drug: '', dose: '', route: 'PO', frequency: '', duration: '' });
  const marCount = visit.medications?.length ?? 0;

  const addMed = () => {
    if (!draft.drug.trim()) return;
    setData({ medications: [...meds, draft] });
    emit(`Medication planned — ${draft.drug}${draft.dose ? ` ${draft.dose}` : ''}${draft.route ? ` ${draft.route}` : ''}`, 'action', true);
    setDraft({ drug: '', dose: '', route: 'PO', frequency: '', duration: '' });
  };

  return (
    <div className="space-y-4">
      <Section icon={Pill} title="Medications">
        {marCount > 0 && (
          <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
            {marCount} medication{marCount === 1 ? '' : 's'} already recorded on this visit's MAR (Records &amp; Billing → Medications).
          </p>
        )}
        {meds.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-400 uppercase tracking-wider text-[8px] font-black">
                  <th className="py-1 pr-2">Drug</th><th className="py-1 px-2">Dose</th><th className="py-1 px-2">Route</th>
                  <th className="py-1 px-2">Frequency</th><th className="py-1 px-2">Duration</th><th className="py-1 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {meds.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-2 font-bold text-pine dark:text-zinc-100">{m.drug}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.dose}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.route}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.frequency}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-zinc-300">{m.duration}</td>
                    <td className="py-1.5 pl-2 text-right">
                      <button type="button" onClick={() => setData({ medications: meds.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5">
          <L label="Drug" className="md:col-span-2"><input className="field-input" placeholder="e.g. Amoxicillin" value={draft.drug} onChange={e => setDraft({ ...draft, drug: e.target.value })} /></L>
          <L label="Dose"><input className="field-input" placeholder="10 mg/kg" value={draft.dose} onChange={e => setDraft({ ...draft, dose: e.target.value })} /></L>
          <L label="Route">
            <select className="field-select" value={draft.route} onChange={e => setDraft({ ...draft, route: e.target.value })}>{ROUTES.map(r => <option key={r}>{r}</option>)}</select>
          </L>
          <L label="Frequency"><input className="field-input" placeholder="BID" value={draft.frequency} onChange={e => setDraft({ ...draft, frequency: e.target.value })} /></L>
          <div className="flex gap-2">
            <L label="Duration" className="flex-1"><input className="field-input" placeholder="5 days" value={draft.duration} onChange={e => setDraft({ ...draft, duration: e.target.value })} /></L>
            <button type="button" onClick={addMed} className="h-9 px-3 self-end bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all shrink-0">Add</button>
          </div>
        </div>
      </Section>

      <Section icon={Scissors} title="Procedures Performed">
        <ListEditor
          items={d.procedures || []}
          onChange={items => setData({ procedures: items })}
          onAdd={p => emit(`Procedure performed — ${p}`, 'action', true)}
          placeholder="Add a procedure (e.g. Subcutaneous fluids)"
        />
      </Section>

      <Section icon={ClipboardList} title="Treatment Plan & Instructions">
        <textarea className="field-textarea" rows={3} placeholder="In-clinic treatment given, plan for the next 24–72h, feeding/rest instructions…" value={d.plan ?? ''} onChange={e => setData({ plan: e.target.value })} />
        <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
          Hospitalisation or boarding? Use the admit actions on the visit header — the admission is tracked on the journey.
        </p>
      </Section>
    </div>
  );
};

export default TreatmentStep;

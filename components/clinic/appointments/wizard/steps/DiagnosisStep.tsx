import React from 'react';
import { Target, BadgeCheck, ClipboardList } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid } from '../fields';

const CONFIDENCE = ['High', 'Moderate', 'Low'];
const ONSET = ['Acute (< 7 days)', 'Subacute (1–4 weeks)', 'Chronic (> 4 weeks)'];
const SEVERITY = ['Mild', 'Moderate', 'Severe'];
const STATUS = ['Active', 'Resolved', 'Ongoing management'];
const PROGNOSIS = ['Excellent', 'Good', 'Guarded', 'Poor', 'Grave'];

const BASIS = [
  { k: 'history', label: 'History' },
  { k: 'physicalExam', label: 'Physical examination' },
  { k: 'labResults', label: 'Laboratory results' },
  { k: 'imaging', label: 'Imaging' },
  { k: 'other', label: 'Other confirmatory tests' },
];

const DiagnosisStep: React.FC<StepProps> = ({ data, setData, staff, emit }) => {
  const d = data || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={Target} title="Presumptive Diagnosis">
          <L label="Primary presumptive diagnosis">
            <input className="field-input" placeholder="e.g. Acute gastroenteritis" value={d.presumptive ?? ''}
              onChange={e => setData({ presumptive: e.target.value })}
              onBlur={e => e.target.value && emit(`Presumptive diagnosis recorded — ${e.target.value}`, 'milestone', true)} />
          </L>
          <L label="Confidence"><Seg options={CONFIDENCE} value={d.confidence} onChange={v => setData({ confidence: v })} /></L>
        </Section>

        <Section icon={BadgeCheck} title="Confirmed Diagnosis">
          <L label="Confirmed diagnosis">
            <input className="field-input" placeholder="Final diagnosis once confirmed" value={d.confirmed ?? ''}
              onChange={e => setData({ confirmed: e.target.value })}
              onBlur={e => e.target.value && emit(`Diagnosis confirmed — ${e.target.value}`, 'milestone', true)} />
          </L>
          <L label="Basis / evidence">
            <CheckGrid items={BASIS} value={d.basis} onToggle={(k, _l, on) => setData({ basis: { ...(d.basis || {}), [k]: on } })} />
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Date confirmed">
              <input className="field-input" type="date" value={d.dateConfirmed ?? ''} onChange={e => setData({ dateConfirmed: e.target.value })} />
            </L>
            <L label="Confirmed by">
              <select className="field-select" value={d.confirmedBy ?? ''} onChange={e => setData({ confirmedBy: e.target.value })}>
                <option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </L>
          </div>
        </Section>
      </div>

      <Section icon={ClipboardList} title="Diagnosis Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <L label="Onset">
            <select className="field-select" value={d.onset ?? ''} onChange={e => setData({ onset: e.target.value })}>
              <option value="">—</option>{ONSET.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
          <L label="Etiology / cause">
            <input className="field-input" placeholder="e.g. Likely dietary indiscretion" value={d.etiology ?? ''} onChange={e => setData({ etiology: e.target.value })} />
          </L>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <L label="Severity"><Seg options={SEVERITY} value={d.severity} onChange={v => setData({ severity: v })} /></L>
          <L label="Status"><Seg options={STATUS} value={d.status} onChange={v => setData({ status: v })} /></L>
          <L label="Prognosis">
            <select className="field-select" value={d.prognosis ?? ''} onChange={e => { setData({ prognosis: e.target.value }); if (e.target.value) emit(`Prognosis updated — ${e.target.value}`, 'action', true); }}>
              <option value="">—</option>{PROGNOSIS.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
        </div>
        <L label="Notes">
          <textarea className="field-textarea" rows={2} placeholder="Context for the diagnosis…" value={d.notes ?? ''} onChange={e => setData({ notes: e.target.value })} />
        </L>
      </Section>
    </div>
  );
};

export default DiagnosisStep;

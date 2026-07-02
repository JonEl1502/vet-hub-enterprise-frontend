import React from 'react';
import { MessageSquare, FileSignature, GraduationCap, StickyNote } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid } from '../fields';
import { formatDate } from '../../../../../services/utils/dateFormatter';

const SUMMARY = [
  { k: 'diagnosisExplained', label: 'Diagnosis explained' },
  { k: 'optionsDiscussed', label: 'Treatment options discussed' },
  { k: 'risksDiscussed', label: 'Risks & complications discussed' },
  { k: 'costDiscussed', label: 'Estimated cost discussed' },
];

const CONSENTS = [
  { k: 'generalTreatment', label: 'General treatment consent' },
  { k: 'hospitalisation', label: 'Hospitalisation consent' },
  { k: 'anaesthesia', label: 'Anaesthesia consent' },
  { k: 'surgery', label: 'Surgery consent' },
  { k: 'bloodTransfusion', label: 'Blood transfusion consent' },
  { k: 'euthanasia', label: 'Euthanasia consent' },
];

const EDUCATION = [
  { k: 'medicationUse', label: 'Medication use explained' },
  { k: 'feeding', label: 'Feeding instructions explained' },
  { k: 'exercise', label: 'Exercise restriction explained' },
  { k: 'woundCare', label: 'Wound care demonstrated' },
  { k: 'eCollar', label: 'Elizabethan collar explained' },
  { k: 'warningSigns', label: 'Warning signs discussed' },
];

const DECISION = ['Approved', 'Declined', 'Deferred', 'Requested referral'];
const METHODS = ['Face to face', 'Telephone', 'WhatsApp', 'Email', 'Video'];

const CommunicationStep: React.FC<StepProps> = ({ data, setData, client, emit }) => {
  const d = data || {};
  const toggleInto = (field: string) => (k: string, label: string, on: boolean) => {
    setData({ [field]: { ...(d[field] || {}), [k]: on } });
    if (on && field === 'consents') emit(`Consent signed — ${label}`, 'milestone', true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={MessageSquare} title="Communication Summary">
          <CheckGrid items={SUMMARY} value={d.summary} onToggle={toggleInto('summary')} cols="grid-cols-1" />
          <L label="Client decision">
            <Seg options={DECISION} value={d.decision} onChange={v => { setData({ decision: v }); emit(`Client decision — ${v.toLowerCase()}`, v === 'Approved' ? 'milestone' : 'action', true); }} />
          </L>
          <L label="Estimate approved"><Seg options={['Yes', 'No', 'Pending']} value={d.estimateApproved} onChange={v => { setData({ estimateApproved: v }); if (v === 'Yes') emit('Estimate approved by client', 'billing', true); }} /></L>
          <L label="Communication method"><Seg options={METHODS} value={d.method} onChange={v => setData({ method: v })} /></L>
        </Section>

        <Section icon={FileSignature} title="Consents & Approvals">
          <CheckGrid items={CONSENTS} value={d.consents} onToggle={toggleInto('consents')} cols="grid-cols-1" />
          <L label="Client signature (type full name)">
            <input className="field-input" placeholder={client?.name || 'Client full name'} value={d.signature ?? ''}
              onChange={e => setData({ signature: e.target.value })}
              onBlur={e => { if (e.target.value && !d.signedAt) { setData({ signedAt: new Date().toISOString() }); emit('Client signature captured', 'milestone', true); } }} />
          </L>
          {d.signature && (
            <div className="border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 bg-slate-50 dark:bg-zinc-950">
              <p className="text-2xl text-pine dark:text-zinc-100" style={{ fontFamily: 'cursive' }}>{d.signature}</p>
              {d.signedAt && <p className="text-[9px] font-bold text-slate-400 mt-1">Signed {formatDate(d.signedAt)}</p>}
            </div>
          )}
        </Section>
      </div>

      <Section icon={GraduationCap} title="Client Education">
        <CheckGrid items={EDUCATION} value={d.education} onToggle={toggleInto('education')} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={StickyNote} title="Discussion Notes">
          <textarea className="field-textarea" rows={4} placeholder="What was explained, questions asked, agreement reached…" value={d.notes ?? ''} onChange={e => setData({ notes: e.target.value })} />
        </Section>
        <Section icon={StickyNote} title="Home Care Instructions">
          <textarea className="field-textarea" rows={4} placeholder={'One instruction per line, e.g.\nGive all medications as prescribed.\nFeed soft, easily digestible diet.'} value={d.homeCare ?? ''} onChange={e => setData({ homeCare: e.target.value })} />
        </Section>
      </div>
    </div>
  );
};

export default CommunicationStep;

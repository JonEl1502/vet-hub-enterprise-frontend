import React from 'react';
import { Stethoscope, Eye } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, showsField, showsAny } from '../fields';
import SystemFindingsCard, { SystemValue } from '../SystemFindings';

const MENTATION = ['Bright', 'Quiet', 'Dull', 'Depressed', 'Unresponsive'];
const HYDRATION = ['Normal', '< 5%', '5–8%', '8–12%'];

// One row per body system: Normal tick or abnormal findings text.
//
// `slug` matches the field registry (`examination.sys.oralCavity`) and drives
// VISIBILITY only. Stored data stays keyed by `label` — that is how every
// existing record was written, and re-keying it here would orphan them.
const SYSTEMS: { slug: string; label: string }[] = [
  { slug: 'eyes', label: 'Eyes' },
  { slug: 'ears', label: 'Ears' },
  { slug: 'nose', label: 'Nose' },
  { slug: 'oralCavity', label: 'Oral cavity' },
  { slug: 'cardiovascular', label: 'Cardiovascular' },
  { slug: 'respiratory', label: 'Respiratory' },
  { slug: 'abdomen', label: 'Abdomen' },
  { slug: 'musculoskeletal', label: 'Musculoskeletal' },
  { slug: 'skinCoat', label: 'Skin & coat' },
  { slug: 'neurological', label: 'Neurological' },
  { slug: 'reproductive', label: 'Reproductive' },
  { slug: 'lymphNodes', label: 'Lymph nodes' },
];

const ExaminationStep: React.FC<StepProps> = ({ data, setData, pet, emit, visibleFields }) => {
  // undefined → no template governs this stage, so everything renders.
  const show = showsField(visibleFields);
  const sysKeys = SYSTEMS.map(x => `sys.${x.slug}`);
  const d = data || {};
  const systems: Record<string, SystemValue> = d.systems || {};
  const setSystem = (name: string, patch: any) =>
    setData({ systems: { ...systems, [name]: { ...(systems[name] || {}), ...patch } } });

  return (
    <div className="space-y-4">
      {showsAny(visibleFields, ['mentation','bcs','hydration','painScore','temperature','weight','hr','rr','murmur','respEffort']) && (
      <Section icon={Stethoscope} title="General Observation">
        {/* 3–4 columns — 6 was cramped with the rail expanded. */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {show('mentation') && <L label="Mentation">
            <select className="field-select" value={d.mentation ?? ''} onChange={e => setData({ mentation: e.target.value })}>
              <option value="">—</option>{MENTATION.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>}
          {show('bcs') && <L label="Body condition (1–9)">
            <select className="field-select" value={d.bcs ?? ''} onChange={e => setData({ bcs: e.target.value })}>
              <option value="">—</option>{Array.from({ length: 9 }, (_, i) => <option key={i + 1}>{`${i + 1} / 9`}</option>)}
            </select>
          </L>}
          {show('hydration') && <L label="Hydration">
            <select className="field-select" value={d.hydration ?? ''} onChange={e => setData({ hydration: e.target.value })}>
              <option value="">—</option>{HYDRATION.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>}
          {show('painScore') && <L label="Pain score (0–10)">
            <input className="field-input" type="number" min={0} max={10} value={d.painScore ?? ''} onChange={e => setData({ painScore: e.target.value })} />
          </L>}
          {show('temperature') && <L label="Temperature (°C)">
            <input className="field-input" type="number" step="0.1" value={d.temperature ?? ''} onChange={e => setData({ temperature: e.target.value })} />
          </L>}
          {show('weight') && <L label="Weight (kg)">
            <input className="field-input" type="number" step="0.1" value={d.weight ?? ''}
              onChange={e => setData({ weight: e.target.value })}
              onBlur={e => e.target.value && emit(`Weight recorded — ${e.target.value} kg`, 'action', true)} />
          </L>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {show('hr') && <L label="Heart rate (bpm)"><input className="field-input" type="number" value={d.hr ?? ''} onChange={e => setData({ hr: e.target.value })} /></L>}
          {show('rr') && <L label="Resp. rate (rpm)"><input className="field-input" type="number" value={d.rr ?? ''} onChange={e => setData({ rr: e.target.value })} /></L>}
          {show('murmur') && <L label="Murmur"><Seg options={['None', 'Present']} value={d.murmur} onChange={v => setData({ murmur: v })} /></L>}
          {show('respEffort') && <L label="Effort"><Seg options={['Normal', 'Increased']} value={d.respEffort} onChange={v => setData({ respEffort: v })} /></L>}
        </div>
      </Section>
      )}

      {/* The whole card goes when the clinic removed every system from it —
          that is the deletion this used to ignore. */}
      {showsAny(visibleFields, sysKeys) && (
        <Section icon={Eye} title="Systemic Examination">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {SYSTEMS.filter(sys => show(`sys.${sys.slug}`)).map(sys => (
              // Data stays keyed by LABEL — that is how every existing record
              // was written. The slug drives visibility, and now also picks the
              // seeded title list for this system.
              <SystemFindingsCard
                key={sys.slug}
                label={sys.label}
                slug={sys.slug}
                value={systems[sys.label] || {}}
                onChange={next => setSystem(sys.label, next)}
              />
            ))}
          </div>
        </Section>
      )}

      {show('notes') && (
        <Section icon={Stethoscope} title="Examination Notes">
          <textarea className="field-textarea" rows={2} placeholder={`Overall impression of ${pet.name}'s physical exam…`} value={d.notes ?? ''} onChange={e => setData({ notes: e.target.value })} />
        </Section>
      )}
    </div>
  );
};

export default ExaminationStep;

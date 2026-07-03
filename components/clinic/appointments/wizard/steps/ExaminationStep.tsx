import React from 'react';
import { Stethoscope, Eye } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg } from '../fields';

const MENTATION = ['Bright', 'Quiet', 'Dull', 'Depressed', 'Unresponsive'];
const HYDRATION = ['Normal', '< 5%', '5–8%', '8–12%'];

// One row per body system: Normal tick or abnormal findings text.
const SYSTEMS = [
  'Eyes', 'Ears', 'Nose', 'Oral cavity', 'Cardiovascular', 'Respiratory',
  'Abdomen', 'Musculoskeletal', 'Skin & coat', 'Neurological', 'Reproductive', 'Lymph nodes',
];

const ExaminationStep: React.FC<StepProps> = ({ data, setData, pet, emit }) => {
  const d = data || {};
  const systems: Record<string, { normal?: boolean; findings?: string }> = d.systems || {};
  const setSystem = (name: string, patch: any) =>
    setData({ systems: { ...systems, [name]: { ...(systems[name] || {}), ...patch } } });

  return (
    <div className="space-y-4">
      <Section icon={Stethoscope} title="General Observation">
        {/* 3–4 columns — 6 was cramped with the rail expanded. */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <L label="Mentation">
            <select className="field-select" value={d.mentation ?? ''} onChange={e => setData({ mentation: e.target.value })}>
              <option value="">—</option>{MENTATION.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
          <L label="Body condition (1–9)">
            <select className="field-select" value={d.bcs ?? ''} onChange={e => setData({ bcs: e.target.value })}>
              <option value="">—</option>{Array.from({ length: 9 }, (_, i) => <option key={i + 1}>{`${i + 1} / 9`}</option>)}
            </select>
          </L>
          <L label="Hydration">
            <select className="field-select" value={d.hydration ?? ''} onChange={e => setData({ hydration: e.target.value })}>
              <option value="">—</option>{HYDRATION.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>
          <L label="Pain score (0–10)">
            <input className="field-input" type="number" min={0} max={10} value={d.painScore ?? ''} onChange={e => setData({ painScore: e.target.value })} />
          </L>
          <L label="Temperature (°C)">
            <input className="field-input" type="number" step="0.1" value={d.temperature ?? ''} onChange={e => setData({ temperature: e.target.value })} />
          </L>
          <L label="Weight (kg)">
            <input className="field-input" type="number" step="0.1" value={d.weight ?? ''}
              onChange={e => setData({ weight: e.target.value })}
              onBlur={e => e.target.value && emit(`Weight recorded — ${e.target.value} kg`, 'action', true)} />
          </L>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <L label="Heart rate (bpm)"><input className="field-input" type="number" value={d.hr ?? ''} onChange={e => setData({ hr: e.target.value })} /></L>
          <L label="Resp. rate (rpm)"><input className="field-input" type="number" value={d.rr ?? ''} onChange={e => setData({ rr: e.target.value })} /></L>
          <L label="Murmur"><Seg options={['None', 'Present']} value={d.murmur} onChange={v => setData({ murmur: v })} /></L>
          <L label="Effort"><Seg options={['Normal', 'Increased']} value={d.respEffort} onChange={v => setData({ respEffort: v })} /></L>
        </div>
      </Section>

      <Section icon={Eye} title="Systemic Examination">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {SYSTEMS.map(name => {
            const s = systems[name] || {};
            const abnormal = !!(s.findings && s.findings.trim());
            return (
              <div key={name} className={`border rounded-xl p-2.5 space-y-1.5 transition-all ${abnormal ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20' : 'border-slate-200 dark:border-zinc-800'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{name}</p>
                  <button type="button" onClick={() => setSystem(name, { normal: !s.normal, findings: s.normal ? s.findings : '' })}
                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all ${s.normal ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-800'}`}>
                    {s.normal ? '✓ Normal' : 'Normal'}
                  </button>
                </div>
                <input className="field-input !h-8 text-xs" placeholder="Enter findings if abnormal" value={s.findings ?? ''}
                  onChange={e => setSystem(name, { findings: e.target.value, normal: e.target.value ? false : s.normal })} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={Stethoscope} title="Examination Notes">
        <textarea className="field-textarea" rows={2} placeholder={`Overall impression of ${pet.name}'s physical exam…`} value={d.notes ?? ''} onChange={e => setData({ notes: e.target.value })} />
      </Section>
    </div>
  );
};

export default ExaminationStep;

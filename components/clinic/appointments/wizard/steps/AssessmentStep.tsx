import React from 'react';
import { ListChecks, GitBranch, Target } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, ListEditor } from '../fields';

const LIKELIHOODS = ['High', 'Moderate', 'Low'];

interface Differential { name: string; likelihood: string }

const AssessmentStep: React.FC<StepProps> = ({ data, setData, emit }) => {
  const d = data || {};
  const problems: string[] = d.problems || [];
  const differentials: Differential[] = d.differentials || [];
  const [diffDraft, setDiffDraft] = React.useState('');

  const addDifferential = () => {
    const v = diffDraft.trim();
    if (!v) return;
    setData({ differentials: [...differentials, { name: v, likelihood: 'Moderate' }] });
    setDiffDraft('');
  };
  const patchDifferential = (i: number, patch: Partial<Differential>) =>
    setData({ differentials: differentials.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={ListChecks} title="Problem List">
          <ListEditor
            items={problems}
            onChange={items => setData({ problems: items })}
            onAdd={p => emit(`Problem recorded — ${p}`, 'action', true)}
            placeholder="Add a problem (e.g. Vomiting)"
            badge={(_, i) => i === 0 ? <span className="px-1.5 py-0.5 rounded bg-seafoam/10 text-seafoam text-[8px] font-black uppercase tracking-widest">Primary</span> : null}
          />
        </Section>

        <Section icon={GitBranch} title="Differential Diagnoses">
          <div className="space-y-1">
            {differentials.map((df, i) => (
              <div key={`${df.name}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] font-black text-slate-400 w-4">{i + 1}.</span>
                <span className="flex-1 text-[12px] font-bold text-pine dark:text-zinc-100">{df.name}</span>
                <select className="field-select !h-7 !w-28 text-xs" value={df.likelihood} onChange={e => patchDifferential(i, { likelihood: e.target.value })}>
                  {LIKELIHOODS.map(o => <option key={o}>{o}</option>)}
                </select>
                <button type="button" onClick={() => setData({ differentials: differentials.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500 text-sm leading-none">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="field-input flex-1" placeholder="Add a differential (e.g. Gastroenteritis)" value={diffDraft} onChange={e => setDiffDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDifferential()} />
            <button type="button" onClick={addDifferential} className="px-3 h-9 bg-seafoam/10 text-seafoam rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shrink-0">Add</button>
          </div>
        </Section>
      </div>

      <Section icon={Target} title="Tentative Diagnosis">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <L label="Primary problem">
            <input className="field-input" placeholder="e.g. Gastroenteritis" value={d.tentativePrimary ?? ''}
              onChange={e => setData({ tentativePrimary: e.target.value })}
              onBlur={e => e.target.value && emit(`Tentative diagnosis — ${e.target.value}`, 'milestone', true)} />
          </L>
          <L label="Secondary problem(s)">
            <input className="field-input" placeholder="e.g. Dehydration (mild)" value={d.tentativeSecondary ?? ''} onChange={e => setData({ tentativeSecondary: e.target.value })} />
          </L>
        </div>
        <L label="Notes">
          <textarea className="field-textarea" rows={2} placeholder="Reasoning, plan for confirmation…" value={d.tentativeNotes ?? ''} onChange={e => setData({ tentativeNotes: e.target.value })} />
        </L>
      </Section>

      <Section icon={Target} title="Clinical Impression">
        <textarea className="field-textarea" rows={2} placeholder="Overall clinical impression…" value={d.clinicalImpression ?? ''} onChange={e => setData({ clinicalImpression: e.target.value })} />
      </Section>
    </div>
  );
};

export default AssessmentStep;

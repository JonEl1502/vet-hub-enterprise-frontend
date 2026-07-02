import React from 'react';
import { FlaskConical, FileSearch, Lightbulb, Plus } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L } from '../fields';

// Diagnostics rides on the visit's REAL service line-items: any lab/imaging
// service added to the visit shows here as a request whose sample→result
// pipeline is tracked. UI-ONLY phase: pipeline stage lives in wizard state;
// the module records (LabRecord/ImagingRecord) take over once wired.

const STAGES = ['Requested', 'Sample collected', 'In progress', 'Results uploaded'] as const;
type Stage = typeof STAGES[number];

const STAGE_TONE: Record<Stage, string> = {
  'Requested': 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
  'Sample collected': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'In progress': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Results uploaded': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const isDiagnostic = (category?: string) => {
  const c = (category || '').toLowerCase();
  return ['lab', 'imaging', 'diagnostic', 'x-ray', 'xray', 'ultrasound', 'radiolog'].some(k => c.includes(k));
};

const DiagnosticsStep: React.FC<StepProps> = ({ visit, data, setData, emit, goServices, currency }) => {
  const d = data || {};
  const stages: Record<string, Stage> = d.stages || {};
  const requests = (visit.tasks || []).filter(t => isDiagnostic(t.category));

  const advance = (taskId: number | string, name: string) => {
    const cur = stages[String(taskId)] || 'Requested';
    const i = STAGES.indexOf(cur);
    if (i >= STAGES.length - 1) return;
    const nextStage = STAGES[i + 1];
    setData({ stages: { ...stages, [String(taskId)]: nextStage } });
    emit(`${name} — ${nextStage.toLowerCase()}`, nextStage === 'Results uploaded' ? 'milestone' : 'action', true);
  };

  return (
    <div className="space-y-4">
      <Section icon={FlaskConical} title="Diagnostic Requests">
        {requests.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500">No diagnostic services on this visit yet.</p>
            {goServices && (
              <button type="button" onClick={goServices} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
                <Plus size={11} /> Add from Categories &amp; Services
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {requests.map(t => {
              const stage = stages[String(t.id)] || 'Requested';
              const done = stage === 'Results uploaded';
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{t.name}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t.category} · {currency} {t.price?.toLocaleString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${STAGE_TONE[stage]}`}>{stage}</span>
                  {!done && (
                    <button type="button" onClick={() => advance(t.id, t.name)}
                      className="px-2.5 py-1 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine transition-all">
                      → {STAGES[STAGES.indexOf(stage) + 1]}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section icon={FileSearch} title="Key Findings">
        <textarea className="field-textarea" rows={3} placeholder={'One finding per line, e.g.\nMild leukocytosis with neutrophilia.\nFecal exam: coccidia oocysts ++'} value={d.keyFindings ?? ''} onChange={e => setData({ keyFindings: e.target.value })} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={Lightbulb} title="Clinical Interpretation">
          <textarea className="field-textarea" rows={3} placeholder="What the results mean for this patient…" value={d.interpretation ?? ''} onChange={e => setData({ interpretation: e.target.value })} />
        </Section>
        <Section icon={Lightbulb} title="Recommendations">
          <textarea className="field-textarea" rows={3} placeholder="Next steps based on results…" value={d.recommendations ?? ''} onChange={e => setData({ recommendations: e.target.value })} />
        </Section>
      </div>

      <L label="Pending / external results">
        <input className="field-input" placeholder="e.g. Giardia antigen test — sent to external lab, ETA tomorrow" value={d.pending ?? ''} onChange={e => setData({ pending: e.target.value })} />
      </L>
    </div>
  );
};

export default DiagnosticsStep;

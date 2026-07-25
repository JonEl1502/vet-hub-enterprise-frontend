import React from 'react';
import { History, HeartPulse, ClipboardCheck, Bell, Stethoscope, Loader2, Link2Off } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg } from '../fields';
import { visitsAPI } from '../../../../../services';

// FIRST page of a follow-up visit. A follow-up exists because the previous
// visit ended with a plan — so the wizard opens on THAT plan (the originating
// visit's last step) instead of a blank history. The parent's clinical record
// lives server-side in consultation_records, so nothing new is persisted here:
// we read the parent visit's workflow blob and carry its follow-up slice over.
//
// Read-only above (what was said), editable below (why they're back, and
// which plan items get closed out today).

const REASONS = ['Scheduled recheck', 'Not improving', 'Worse', 'New problem', 'Owner concern', 'Re-test / results'];

interface PriorPlan {
  currentOutcome?: string;
  closeOutcome?: string;
  outcomeNotes?: string;
  carePlan?: string[];
  monitoring?: Record<string, boolean>;
  reminders?: { title: string; description?: string; dueDate: string }[];
  // Context pulled from the parent's other steps.
  diagnosis?: string;
  plan?: string;
  visitDate?: string;
}

const MONITORING_LABELS: Record<string, string> = {
  appetite: 'Appetite', waterIntake: 'Water intake', urination: 'Urination',
  defecation: 'Defecation', vomiting: 'Vomiting', activity: 'Activity level',
  weight: 'Weight', temperature: 'Temperature',
};

const Chip: React.FC<{ children: React.ReactNode; tone?: 'seafoam' | 'slate' }> = ({ children, tone = 'slate' }) => (
  <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
    tone === 'seafoam' ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
  }`}>{children}</span>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] text-slate-400 dark:text-zinc-500">{children}</p>
);

const PriorPlanStep: React.FC<StepProps> = ({ visit, data, setData, emit }) => {
  const d = data || {};
  const parentId = visit.parentAppointmentId;
  const [prior, setPrior] = React.useState<PriorPlan | null>(null);
  const [loading, setLoading] = React.useState(!!parentId);

  React.useEffect(() => {
    if (!parentId) { setLoading(false); return; }
    let alive = true;
    visitsAPI.getWorkflow(parentId).then(res => {
      if (!alive) return;
      const w = res.success ? res.data?.workflow : null;
      if (w) {
        const wd: any = w.data || {};
        const f: any = wd.followUp || {};
        setPrior({
          currentOutcome: f.currentOutcome, closeOutcome: f.closeOutcome, outcomeNotes: f.outcomeNotes,
          carePlan: Array.isArray(f.carePlan) ? f.carePlan : [],
          monitoring: f.monitoring || {},
          reminders: Array.isArray(f.reminders) ? f.reminders : [],
          diagnosis: wd.diagnosis?.confirmed || wd.diagnosis?.presumptive || '',
          plan: wd.treatment?.plan || '',
          visitDate: w.startedAt,
        });
      } else {
        setPrior(null);
      }
    }).catch(() => { /* offline — the empty state explains it */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [parentId]);

  const carePlan = prior?.carePlan ?? [];
  const addressed: Record<string, boolean> = d.addressed || {};
  const toggleItem = (item: string) => {
    const on = !addressed[item];
    setData({ addressed: { ...addressed, [item]: on } });
    if (on) emit(`Carried-over plan item addressed — ${item}`, 'action', true);
  };

  const monitoringAsked = Object.entries(prior?.monitoring || {}).filter(([, on]) => on).map(([k]) => MONITORING_LABELS[k] ?? k);
  const nothingCarried = !prior || (!prior.currentOutcome && !prior.closeOutcome && !prior.outcomeNotes
    && carePlan.length === 0 && (prior.reminders?.length ?? 0) === 0 && monitoringAsked.length === 0);

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 py-2">
          <Loader2 size={13} className="animate-spin" /> Loading the previous visit's plan…
        </div>
      )}

      {!loading && !parentId && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20">
          <Link2Off size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
            This follow-up isn't linked to an earlier visit, so there's no plan to carry over.
            Book follow-ups from a visit's Follow-up Plan card to chain them.
          </p>
        </div>
      )}

      {!loading && parentId && nothingCarried && (
        <div className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
          <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
            The previous visit was linked but its follow-up plan was left empty — nothing to carry over.
          </p>
        </div>
      )}

      {!loading && prior && !nothingCarried && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Section icon={HeartPulse} title="How the previous visit ended">
              {prior.visitDate && (
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Visit of {new Date(prior.visitDate).toLocaleDateString()}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {prior.currentOutcome && <Chip tone="seafoam">At consultation · {prior.currentOutcome}</Chip>}
                {prior.closeOutcome && <Chip tone="seafoam">At close · {prior.closeOutcome}</Chip>}
                {!prior.currentOutcome && !prior.closeOutcome && <Empty>No outcome was recorded.</Empty>}
              </div>
              {prior.outcomeNotes && (
                <p className="text-[12px] font-medium text-pine dark:text-zinc-100 whitespace-pre-wrap">{prior.outcomeNotes}</p>
              )}
              {(prior.diagnosis || prior.plan) && (
                <div className="pt-2 border-t border-dashed border-slate-200 dark:border-zinc-800 space-y-1.5">
                  {prior.diagnosis && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      <span className="font-black uppercase tracking-widest text-[9px] text-slate-400">Diagnosis</span><br />
                      <span className="font-bold text-pine dark:text-zinc-100">{prior.diagnosis}</span>
                    </p>
                  )}
                  {prior.plan && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      <span className="font-black uppercase tracking-widest text-[9px] text-slate-400">Treatment plan given</span><br />
                      <span className="font-medium text-pine dark:text-zinc-100 whitespace-pre-wrap">{prior.plan}</span>
                    </p>
                  )}
                </div>
              )}
            </Section>

            <Section icon={ClipboardCheck} title="Carried-over care plan — tick what today closes out">
              {carePlan.length === 0 && <Empty>No care-plan items were set.</Empty>}
              <div className="space-y-1.5">
                {carePlan.map((item, i) => {
                  const on = !!addressed[item];
                  return (
                    <button key={`${item}-${i}`} type="button" onClick={() => toggleItem(item)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                        on ? 'border-seafoam bg-seafoam/10' : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 hover:border-seafoam/40'
                      }`}>
                      <span className={`w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center text-[9px] font-black ${on ? 'bg-seafoam text-white' : 'border border-slate-300 dark:border-zinc-700'}`}>{on ? '✓' : ''}</span>
                      <span className={`text-[11px] font-bold ${on ? 'text-pine dark:text-zinc-100' : 'text-slate-500 dark:text-zinc-400'}`}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Section icon={Bell} title="What the client was told to expect">
              {(prior.reminders?.length ?? 0) === 0 && <Empty>No reminders or next-visit points were staged.</Empty>}
              <div className="space-y-1">
                {(prior.reminders || []).map((r, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Bell size={11} className="text-seafoam shrink-0" />
                      <span className="flex-1 text-[12px] font-bold text-pine dark:text-zinc-100">{r.title}</span>
                      {r.dueDate && <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">due {r.dueDate}</span>}
                    </div>
                    {r.description && <p className="pl-[19px] text-[10px] font-medium text-slate-400 dark:text-zinc-500">{r.description}</p>}
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={Stethoscope} title="Home monitoring the owner was asked for">
              {monitoringAsked.length === 0 && <Empty>No home monitoring was requested.</Empty>}
              <div className="flex flex-wrap gap-1.5">
                {monitoringAsked.map(m => <Chip key={m}>{m}</Chip>)}
              </div>
            </Section>
          </div>
        </>
      )}

      {/* Always editable — this is what the follow-up is FOR. */}
      <Section icon={History} title="Why they're back today">
        <L label="Reason for this follow-up">
          <Seg options={REASONS} value={d.reason} onChange={v => { setData({ reason: v }); emit(`Follow-up reason — ${v.toLowerCase()}`, 'milestone', true); }} />
        </L>
        <L label="Focus for today">
          <textarea className="field-textarea" rows={2}
            placeholder="What this visit must settle — e.g. recheck wound, repeat bloods, review response to antibiotics…"
            value={d.focus ?? ''} onChange={e => setData({ focus: e.target.value })} />
        </L>
      </Section>
    </div>
  );
};

export default PriorPlanStep;

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock, Receipt,
  PanelLeftClose, PanelLeftOpen, RefreshCw, Milestone,
} from 'lucide-react';
import { Visit, Pet, Client, Clinic } from '../../../../types';
import { STEP_DEFS } from './entryPoints';
import { StepProps, WizardStepId, StaffOpt } from './types';
import { VisitWizardApi } from './useVisitWizard';
import { JourneyTimeline } from './JourneyTimeline';
import HistoryStep from './steps/HistoryStep';
import ExaminationStep from './steps/ExaminationStep';
import AssessmentStep from './steps/AssessmentStep';
import DiagnosticsStep from './steps/DiagnosticsStep';
import DiagnosisStep from './steps/DiagnosisStep';
import TreatmentStep from './steps/TreatmentStep';
import CommunicationStep from './steps/CommunicationStep';
import FollowUpStep from './steps/FollowUpStep';
import { GenericEntryStep, EmergencyEntryStep } from './steps/EntrySteps';

// The Dynamic Visit Workflow shell: entry-point-driven stepper + live
// Patient Journey sidebar + running-bill rail. UI-ONLY phase — every step
// writes to the localStorage draft via useVisitWizard.

interface Props {
  visit: Visit;
  pet: Pet;
  client?: Client;
  staff: StaffOpt[];
  activeClinic: Clinic;
  wiz: VisitWizardApi;
  goServices?: () => void;
  goBilling?: () => void;
}

const CORE_STEPS: Partial<Record<WizardStepId, React.FC<StepProps>>> = {
  history: HistoryStep,
  examination: ExaminationStep,
  assessment: AssessmentStep,
  diagnostics: DiagnosticsStep,
  diagnosis: DiagnosisStep,
  treatment: TreatmentStep,
  communication: CommunicationStep,
  followUp: FollowUpStep,
};

const useElapsed = (fromIso: string) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60_000));
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

const VisitWizard: React.FC<Props> = ({ visit, pet, client, staff, activeClinic, wiz, goServices, goBilling }) => {
  const { entry, steps, currentStep, goTo, prev, next, completeStep, isComplete, setStepData, emit, events, progress, state, resetWizard } = wiz;
  const [journeyOpen, setJourneyOpen] = useState(true);
  const elapsed = useElapsed(state.startedAt);
  const idx = steps.indexOf(currentStep);
  const isLast = idx === steps.length - 1;
  const def = STEP_DEFS[currentStep];

  const stepProps: StepProps = useMemo(() => ({
    visit, pet, client, staff,
    currency: activeClinic.currency,
    data: state.data[currentStep],
    setData: (patch: any) => setStepData(currentStep, patch),
    emit,
    goServices,
  }), [visit, pet, client, staff, activeClinic.currency, state.data, currentStep, setStepData, emit, goServices]);

  const renderStep = () => {
    if (currentStep === 'emergencyTriage') return <EmergencyEntryStep {...stepProps} />;
    const Core = CORE_STEPS[currentStep];
    if (Core) return <Core {...stepProps} />;
    return <GenericEntryStep {...stepProps} formKey={currentStep} />;
  };

  const completeAndNext = () => {
    completeStep(currentStep);
    if (!isLast) next();
    else emit('Clinical workflow completed', 'milestone', true);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* ── Wizard header: entry point, current position, elapsed, bill ── */}
      <div className={`px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b ${entry.key === 'emergency' ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800'}`}>
        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${entry.key === 'emergency' ? 'text-red-600 dark:text-red-400' : 'text-pine dark:text-zinc-100'}`}>
          {entry.icon} {entry.label}
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          Current step · <span className="text-seafoam">{def.short}</span>
        </span>
        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
          <Clock size={10} /> Elapsed {elapsed}
        </span>
        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
          <Receipt size={10} /> {activeClinic.currency} {visit.totalCost.toLocaleString()}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-seafoam to-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[9px] font-black text-slate-500 dark:text-zinc-400">{progress}%</span>
        </div>
      </div>

      {/* ── Stepper strip ── */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {steps.map((s, i) => {
            const sd = STEP_DEFS[s];
            const done = isComplete(s);
            const active = s === currentStep;
            const red = sd.tone === 'red';
            return (
              <React.Fragment key={s}>
                {i > 0 && <div className={`w-6 h-px ${done ? 'bg-seafoam' : 'bg-slate-200 dark:bg-zinc-800'}`} />}
                <button type="button" onClick={() => goTo(s)} title={sd.label}
                  className="flex flex-col items-center gap-1 group px-1">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all
                    ${done ? 'bg-emerald-500 border-emerald-500 text-white'
                      : active ? (red ? 'bg-red-500 border-red-500 text-white' : 'bg-seafoam border-seafoam text-white')
                      : (red ? 'border-red-300 dark:border-red-800 text-red-500 group-hover:border-red-500' : 'border-slate-300 dark:border-zinc-700 text-slate-400 group-hover:border-seafoam')}`}>
                    {done ? <CheckCircle2 size={13} /> : i + 1}
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-wider whitespace-nowrap ${active ? (red ? 'text-red-600 dark:text-red-400' : 'text-seafoam') : 'text-slate-400 dark:text-zinc-500'}`}>
                    {sd.short}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Body: journey sidebar · step content · bill rail ── */}
      <div className="flex items-stretch">
        {/* Patient Journey — the live, permanently-available roadmap */}
        <aside className={`shrink-0 border-r border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 transition-all ${journeyOpen ? 'w-60' : 'w-9'}`}>
          <button type="button" onClick={() => setJourneyOpen(o => !o)}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all"
            title={journeyOpen ? 'Collapse journey' : 'Expand journey'}>
            {journeyOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
            {journeyOpen && <><Milestone size={12} className="text-seafoam" /> Patient Journey</>}
          </button>
          {journeyOpen && (
            <div className="px-3 pb-3 overflow-y-auto custom-scrollbar max-h-[60vh]">
              <JourneyTimeline events={events} compact />
            </div>
          )}
        </aside>

        {/* Step content */}
        <div className="flex-1 min-w-0 p-4">
          <h3 className={`text-sm font-black uppercase tracking-tight mb-3 ${def.tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-pine dark:text-zinc-100'}`}>
            {def.label}
          </h3>
          {renderStep()}
        </div>

        {/* Running bill rail — real line-items from the visit */}
        <aside className="hidden xl:block w-64 shrink-0 border-l border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 p-3 space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Receipt size={11} /> Running Bill</p>
          <div className="space-y-1 max-h-[40vh] overflow-y-auto custom-scrollbar">
            {(visit.tasks || []).length === 0 && <p className="text-[10px] text-slate-400 py-2">No services yet.</p>}
            {(visit.tasks || []).map(t => (
              <div key={t.id} className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 truncate">{t.name}</span>
                <span className="text-[10px] font-black text-pine dark:text-zinc-100 font-mono shrink-0">{t.price?.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 dark:border-zinc-800 pt-2 flex items-baseline justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{activeClinic.currency} {visit.totalCost.toLocaleString()}</span>
          </div>
          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${visit.isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
            {visit.isPaid ? `Paid · ${visit.paymentMethod}` : 'Unbilled'}
          </span>
          <div className="flex flex-col gap-1.5 pt-1">
            {goServices && (
              <button type="button" onClick={goServices} className="w-full px-2 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
                Add services
              </button>
            )}
            {goBilling && (
              <button type="button" onClick={goBilling} className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:text-pine dark:hover:text-zinc-100 transition-all">
                Invoice &amp; payment
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* ── Footer nav ── */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2">
        <button type="button" onClick={prev} disabled={idx === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft size={12} /> {idx > 0 ? STEP_DEFS[steps[idx - 1]].short : 'Back'}
        </button>
        <button type="button" onClick={resetWizard} title="Clear this visit's wizard draft (design phase only)"
          className="flex items-center gap-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-700 hover:text-red-400 transition-all">
          <RefreshCw size={11} /> Reset draft
        </button>
        <div className="flex-1" />
        <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest hidden sm:block">Draft auto-saves locally</span>
        <button type="button" onClick={completeAndNext}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white transition-all ${isLast ? 'bg-pine hover:bg-pine/90' : 'bg-seafoam hover:bg-pine'}`}>
          {isLast
            ? <>Complete workflow <CheckCircle2 size={12} /></>
            : <>Complete &amp; next · {STEP_DEFS[steps[idx + 1]].short} <ChevronRight size={12} /></>}
        </button>
      </div>
    </div>
  );
};

export default VisitWizard;

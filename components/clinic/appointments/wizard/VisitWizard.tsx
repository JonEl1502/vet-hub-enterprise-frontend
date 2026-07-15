import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock, Receipt,
  PanelRightClose, PanelRightOpen, RefreshCw,
  ExternalLink, AlertTriangle, Loader2,
} from 'lucide-react';
import { Visit, Pet, Client, Clinic } from '../../../../types';
import { STEP_DEFS } from './entryPoints';
import { StepProps, WizardStepId, StaffOpt } from './types';
import { VisitWizardApi } from './useVisitWizard';
import HistoryStep from './steps/HistoryStep';
import ExaminationStep from './steps/ExaminationStep';
import AssessmentStep from './steps/AssessmentStep';
import DiagnosticsStep from './steps/DiagnosticsStep';
import DiagnosisStep from './steps/DiagnosisStep';
import TreatmentStep from './steps/TreatmentStep';
import CommunicationStep from './steps/CommunicationStep';
import FollowUpStep from './steps/FollowUpStep';
import { GenericEntryStep, EmergencyEntryStep, GroomingCareStep } from './steps/EntrySteps';

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
  // Visit is closed & billed → the whole workflow is view-only: no step
  // edits, no add-service / complete / reset actions. Navigation stays live
  // so past steps can still be read.
  locked?: boolean;
  goServices?: () => void;
  goBilling?: () => void;
  onAddService?: () => void;
  onOpenModule?: (category: string) => void;
  // Module pages involved in this visit (distinct categories with a page) —
  // quick-nav chips at the top of the workflow (e.g. Boarding, Grooming, Lab).
  moduleLinks?: { category: string; label: string }[];
  onEscalate?: () => void; // escalate to emergency (moved from the page header)
  escalating?: boolean;
  // Escalate to inpatient/hospitalization — opens the full admit checklist.
  // Lives here (next to Escalate to Emergency), NOT at registration: a
  // consultation escalates to inpatient during the workflow.
  onHospitalize?: () => void;
  // Fires when a step is marked complete, with that step's data slice —
  // lets the parent sync wizard captures onto real records (e.g. boarding
  // assessment → the stay's vaccine checklist / feeding / belongings).
  onStepComplete?: (stepId: WizardStepId, data: any) => void;
  // Clinical work has begun: a step was completed, or the user navigated
  // the stepper with data already entered. The parent flips a SCHEDULED
  // visit to IN_PROGRESS.
  onWorkStarted?: () => void;
  // Delete a service line (diagnostic request etc.) — pre-payment only.
  onDeleteTask?: (taskId: number) => void;
  // Transfer/extend the visit to another encounter type mid-workflow — its
  // entry service lands on THIS visit's bill so billing has it all.
  onAddEncounter?: (type: 'VET_VISIT' | 'VACCINATION' | 'GROOMING' | 'BOARDING' | 'HOSPITALIZATION') => void;
  // Remove a NON-PRIMARY encounter from the visit (deletes its services off
  // the bill after a confirmation) — the chip's little ✕.
  onDeleteEncounter?: (entryKey: string) => void;
  // Surgery procedure statuses — shown with the clinical steps so staff see
  // progress without leaving the workflow.
  surgeryProgress?: { id: string; name: string; status: string }[];
  onRefreshVisit?: () => void;
  onTriageStatusChange?: (rec: any) => void;
  onTriageDischarged?: () => void;
  // Fired when the last step's "Complete workflow" is pressed — the parent
  // moves on to the medical report summary, then invoice & receipt.
  onWorkflowComplete?: () => void;
  // Patient context cards rendered under the running bill in the right rail
  // (shared PatientRail from the parent).
  sideRail?: React.ReactNode;
}

// Entry-point key → category string fed to onOpenModule (which resolves the
// module page via CATEGORY_TO_MENU_ID). Workflows without a module page
// (standard consultation, follow-up review, house call) get no link.
const ENTRY_PAGE_CATEGORY: Record<string, string> = {
  grooming: 'grooming',
  vaccination: 'vaccination',
  boarding: 'boarding',
  admission: 'hospitalization',
  surgery: 'surgery',
};

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

const VisitWizard: React.FC<Props> = ({ visit, pet, client, staff, activeClinic, wiz, locked, goServices, goBilling, onAddService, onOpenModule, moduleLinks, onEscalate, escalating, onHospitalize, onStepComplete, onWorkStarted, onDeleteTask, onRefreshVisit, onTriageStatusChange, onTriageDischarged, onWorkflowComplete, sideRail, onAddEncounter, onDeleteEncounter, surgeryProgress }) => {
  const { entry, steps, currentStep, goTo, prev, next, completeStep, isComplete, setStepData, emit, progress, state, resetWizard, availableEntries, switchEntry } = wiz;
  const [billOpen, setBillOpen] = useState(true);
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
    addService: onAddService,
    openModule: onOpenModule,
    deleteTask: onDeleteTask,
    refreshVisit: onRefreshVisit,
    onTriageStatusChange,
    onTriageDischarged,
  }), [visit, pet, client, staff, activeClinic.currency, state.data, currentStep, setStepData, emit, goServices, onAddService, onOpenModule, onDeleteTask, onRefreshVisit, onTriageStatusChange, onTriageDischarged]);

  const renderStep = () => {
    if (currentStep === 'emergencyTriage') return <EmergencyEntryStep {...stepProps} />;
    if (currentStep === 'groomingCare') return <GroomingCareStep {...stepProps} />;
    const Core = CORE_STEPS[currentStep];
    if (Core) return <Core {...stepProps} />;
    return <GenericEntryStep {...stepProps} formKey={currentStep} />;
  };

  // Navigating with data already entered counts as "work has started" —
  // used by the stepper/prev/next so a SCHEDULED visit flips IN_PROGRESS.
  const maybeWorkStarted = () => {
    if (!onWorkStarted) return;
    const hasData = Object.values(state.data || {}).some((sl: any) => sl && Object.keys(sl).length > 0);
    const hasDone = Object.keys(state.completed || {}).length > 0;
    if (hasData || hasDone) onWorkStarted();
  };

  const completeAndNext = () => {
    const wasComplete = isComplete(currentStep);
    completeStep(currentStep);
    // Completing a step IS clinical work — start the visit.
    onWorkStarted?.();
    // Let the parent sync this step's captures onto real records (boarding
    // stay intake etc.) — fires on re-completes too so edits propagate.
    onStepComplete?.(currentStep, state.data[currentStep]);
    if (!isLast) { next(); return; }
    // Log workflow completion exactly once — re-clicks on the last step
    // must not spam the journey.
    if (!wasComplete) emit('Clinical workflow completed', 'milestone', true);
    // Hand over: medical report summary → invoice & receipt.
    onWorkflowComplete?.();
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
          {/* Who's working this visit — the lead/assigned staffer's name
              sits right next to the progress bar. */}
          {visit.leadStaff?.name && (
            <span className="text-[9px] font-black uppercase tracking-widest text-seafoam whitespace-nowrap">🩺 {visit.leadStaff.name}</span>
          )}
          <div className="w-24 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-seafoam to-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[9px] font-black text-slate-500 dark:text-zinc-400">{progress}%</span>
        </div>
      </div>

      {/* ── Closed banner — visit is billed & done, workflow is view-only ── */}
      {locked && (
        <div className="px-4 py-2 border-b border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-2">
          <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Visit closed &amp; billed — view only
          </span>
          <span className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-500/70 hidden sm:block">
            Navigate the steps to review; editing is locked.
          </span>
        </div>
      )}

      {/* ── Encounter toolbar: workflow chips · transfer · escalations.
             Reserved for ENCOUNTER-level controls only — diagnostic requests
             (dental X-ray, lab, imaging…) live in the Diagnostics wizard tab
             (each request links to its module page there) and services sit
             under their category headers on Categories & Services. ── */}
      {(onEscalate || onHospitalize || onAddEncounter || availableEntries.length > 1) && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
          {/* Workflow switcher — a multi-encounter visit can run several
              flows; the Vet Visit clinical flow is always offered. Emergency
              locks the flow until stabilized/discharged. */}
          {availableEntries.length > 1 && entry.key !== 'emergency' && !locked && (
            <div className="inline-flex items-center gap-1.5 flex-wrap">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Workflow</span>
              {availableEntries.map((e, ei) => {
                const active = e.key === entry.key;
                // The FIRST entry is the visit's primary encounter — it can't
                // be removed; added encounters get a ✕ (confirmed upstream).
                const removable = ei > 0 && !!onDeleteEncounter;
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => { if (!active) switchEntry(e.key); }}
                    title={active ? 'Active workflow' : 'Switch the active workflow — steps you completed in the other flow are kept'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                      active
                        ? 'bg-seafoam !text-white border-seafoam shadow-sm cursor-default'
                        : 'border-seafoam/30 bg-seafoam/5 text-seafoam hover:bg-seafoam hover:text-white'
                    }`}
                  >
                    {/* Every vet-visit variant (house call, follow-up…) IS the
                        vet-visit encounter — one consistent chip label. */}
                    {['standard', 'houseCall', 'followUp', 'routineCheck', 'surgery', 'admission'].includes(e.key) ? '🩺 Vet Visit — clinical' : `${e.icon} ${e.label}`}
                    {removable && (
                      <span
                        role="button"
                        title={`Remove ${e.label} from this visit`}
                        onClick={(ev) => { ev.stopPropagation(); onDeleteEncounter!(e.key); }}
                        className={`ml-0.5 -mr-1 px-1 rounded transition-all ${active ? 'text-white/60 hover:text-white hover:bg-white/20' : 'text-seafoam/50 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'}`}
                      >×</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {/* Transfer to another encounter mid-visit — one bill for it all.
              Encounters already on the visit drop off the list. */}
          {onAddEncounter && (() => {
            const has = (kws: string[]) => (visit.tasks || []).some(t => kws.some(k => (t.category || '').toLowerCase().includes(k)));
            // Hospitalization is NOT here (dedicated 🏥 escalation button) and
            // neither is Vaccination — it's part of the vet visit: add the
            // vaccine as a service / run the Vaccination workflow chip.
            const options = [
              { value: 'VET_VISIT', label: '🩺 Vet Visit — consultation', taken: visit.encounterType === 'VET_VISIT' || has(['consult']) },
              { value: 'GROOMING', label: '✂️ Grooming', taken: visit.encounterType === 'GROOMING' || has(['groom']) },
              { value: 'BOARDING', label: '🏠 Boarding', taken: visit.encounterType === 'BOARDING' || has(['board']) },
            ].filter(o => !o.taken);
            if (options.length === 0) return null;
            return (
              <select
                value=""
                onChange={e => { const v = e.target.value as any; if (v) { onAddEncounter(v); e.target.value = ''; } }}
                title="Extend this visit with another encounter type — its service & fee land on this bill"
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer hover:border-seafoam/50"
              >
                <option value="">＋ Transfer / add encounter…</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            );
          })()}
          <div className="flex-1" />
          {onHospitalize && (
            <button type="button" onClick={onHospitalize}
              title="Escalate this vet visit to inpatient — runs the full admit checklist and links a hospitalization chart"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
              🏥 Hospitalize / In-Patient
            </button>
          )}
          {onEscalate && (
            <button type="button" onClick={onEscalate} disabled={escalating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50">
              {escalating ? <Loader2 size={10} className="animate-spin" /> : <AlertTriangle size={10} />} Escalate to Emergency
            </button>
          )}
        </div>
      )}

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
                <button type="button" onClick={() => { maybeWorkStarted(); goTo(s); }} title={sd.label}
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

      {/* Surgery procedure progress — rides with the clinical steps. */}
      {surgeryProgress && surgeryProgress.length > 0 && (
        <div className="px-4 py-1.5 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-1.5 bg-slate-50/50 dark:bg-zinc-950/40">
          <span className="text-[8px] font-black uppercase tracking-widest text-rose-500 dark:text-rose-400">🔪 Surgery</span>
          {surgeryProgress.map(r => (
            <button key={r.id} type="button" onClick={() => onOpenModule?.('surgery')} title="Open the Surgery page for this visit"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-pine dark:text-zinc-100 hover:border-rose-400 transition-all">
              {r.name}
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : r.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>{r.status.replace('_', ' ').toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Body: step content · patient/bill rail (journey lives in the 🧭
             drawer on the tab bar). ── */}
      <div className="flex items-stretch">
        {/* Step content */}
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className={`text-sm font-black uppercase tracking-tight ${def.tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-pine dark:text-zinc-100'}`}>
              {def.label}
            </h3>
            {/* Each workflow links to its module's full page (grooming report
                card, vaccination certificate, boarding chart, …). */}
            {onOpenModule && ENTRY_PAGE_CATEGORY[entry.key] && (
              <button type="button" onClick={() => onOpenModule(ENTRY_PAGE_CATEGORY[entry.key])}
                title={`Open the ${entry.label} page for this visit`}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-seafoam/30 bg-seafoam/5 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
                <ExternalLink size={10} /> Open {entry.label} page
              </button>
            )}
          </div>
          {/* Locked → step forms render but can't be interacted with. */}
          <div className={locked ? 'pointer-events-none' : ''} aria-disabled={locked || undefined}>
            {renderStep()}
          </div>
        </div>

        {/* Right rail — 30%: running bill + the shared patient context cards
            (collapsible; the whole rail also collapses to a strip). */}
        <aside className={`hidden lg:block shrink-0 border-l border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 transition-all ${billOpen ? 'w-[30%] min-w-[240px]' : 'w-8'}`}>
          <button type="button" onClick={() => setBillOpen(o => !o)}
            className={`w-full flex items-center gap-1.5 px-2.5 py-2 text-[8px] font-black uppercase tracking-widest transition-all ${billOpen ? 'justify-start text-slate-400 hover:text-seafoam' : 'justify-center bg-seafoam text-white hover:bg-pine rounded-b-lg'}`}
            title={billOpen ? 'Collapse panel' : 'Expand panel'}>
            {billOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={13} />}
            {billOpen && <><Receipt size={11} className="text-seafoam" /> Bill &amp; Patient</>}
          </button>
          {billOpen && (
            <div className="px-2.5 pb-3 space-y-3 overflow-y-auto custom-scrollbar max-h-[72vh]">
              {/* Running bill — real line-items from the visit. */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Receipt size={11} className="text-seafoam" /> Running Bill</p>
                <div className="space-y-1 max-h-[26vh] overflow-y-auto custom-scrollbar">
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
                <div className="flex gap-1.5 pt-1">
                  {!locked && (onAddService || goServices) && (
                    <button type="button" onClick={onAddService ?? goServices}
                      title="Opens the Add Services panel"
                      className="flex-1 px-2 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
                      Add services
                    </button>
                  )}
                  {goBilling && (
                    <button type="button" onClick={goBilling} className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:text-pine dark:hover:text-zinc-100 transition-all">
                      Invoice
                    </button>
                  )}
                </div>
              </div>
              {/* Shared patient context cards (Bill & Balance · Patient &
                  Owner · Behaviour · Clinical Snapshot). */}
              {sideRail}
            </div>
          )}
        </aside>
      </div>

      {/* ── Footer nav ── */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2">
        <button type="button" onClick={() => { maybeWorkStarted(); prev(); }} disabled={idx === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft size={12} /> {idx > 0 ? STEP_DEFS[steps[idx - 1]].short : 'Back'}
        </button>
        {!locked && (
          <button type="button" onClick={resetWizard} title="Clear this visit's wizard draft (design phase only)"
            className="flex items-center gap-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-700 hover:text-red-400 transition-all">
            <RefreshCw size={11} /> Reset draft
          </button>
        )}
        <div className="flex-1" />
        {locked ? (
          <>
            {isLast ? (
              <button type="button" onClick={() => onWorkflowComplete?.()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white bg-pine hover:bg-pine/90 transition-all">
                View medical report <CheckCircle2 size={12} />
              </button>
            ) : (
              <button type="button" onClick={next}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100 transition-all">
                {STEP_DEFS[steps[idx + 1]].short} <ChevronRight size={12} />
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest hidden sm:block">Draft auto-saves locally</span>
            <button type="button" onClick={completeAndNext}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white transition-all ${isLast ? 'bg-pine hover:bg-pine/90' : 'bg-seafoam hover:bg-pine'}`}>
              {isLast
                ? <>Complete workflow · Medical report <CheckCircle2 size={12} /></>
                : <>Complete &amp; next · {STEP_DEFS[steps[idx + 1]].short} <ChevronRight size={12} /></>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VisitWizard;

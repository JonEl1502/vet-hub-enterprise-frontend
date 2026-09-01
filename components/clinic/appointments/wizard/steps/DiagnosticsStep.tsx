import React, { useState, useEffect } from 'react';
import { FlaskConical, FileSearch, Lightbulb, Plus, ExternalLink, FileText, Eye, EyeOff, Loader2, Building2, Trash2, MoreVertical, Upload } from 'lucide-react';
import { StepProps } from '../types';
import InlineServiceSearch from '../../../shared/InlineServiceSearch';
import { useServiceInject } from '../../../shared/ServiceInjectContext';
import { Section, L, showsField } from '../fields';
import { surgeryAPI } from '../../../../../services';
import { labAPI, imagingAPI, LabRecord, ImagingRecord, dialog, visitsAPI, toast, procedureTemplatesAPI, ProcedureTemplate } from '../../../../../services';
import { formatDate } from '../../../../../services/utils/dateFormatter';
import { useAuth } from '../../../../../contexts/AuthContext';
// Direct module import (not the services barrel) — same reason as VisitOutsource itself.
import { OutsourceServiceButton, OutsourcedJobChip } from '../../VisitOutsource';
import { visitJobsAPI } from '../../../../../services/modules/visitJobs.api';
import type { VisitJob } from '../../../../../services/modules/visitJobs.api';
import InlineResultEditor from './InlineResultEditor';
import { uploadAndAttach, type ResultKind } from './attachResults';

// Diagnostics rides on the visit's REAL service line-items: any lab/imaging/
// dental service added to the visit shows here as a request. This step is
// READ-ONLY on progress — the assigned staff marks in-progress/complete from
// the services tab or the module's full page; the chip mirrors the task's
// real status. Results can be VIEWED inline (matched module records) and
// each request links to its module's full page for the complete detail.

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  BLOCKED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Requested', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', BLOCKED: 'Blocked',
};

const flagTone: Record<string, string> = { HIGH: 'text-rose-500', LOW: 'text-amber-500', NORMAL: 'text-emerald-500' };

const isDiagnostic = (category?: string) => {
  const c = (category || '').toLowerCase();
  // 2026-08-22: surgery joins the panel so it gets the same inline result
  // editor — the user asked for parity ("if lab collapsible is for lab,
  // surgery same"), and a surgery report is a result like any other.
  return ['lab', 'imaging', 'diagnostic', 'x-ray', 'xray', 'ultrasound', 'radiolog', 'dental', 'surg', 'theatre', 'operation'].some(k => c.includes(k));
};

type ModuleRecs = { lab: LabRecord[]; imaging: ImagingRecord[]; surgery: any[] };

// Compact inline render of a lab result (markers + notes + attachments).
const LabResultInline: React.FC<{ r: LabRecord }> = ({ r }) => (
  <div className="space-y-1.5">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${r.status === 'RESULTED' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>{r.status?.toLowerCase()}</span>
      <span className="text-[9px] font-bold text-slate-400">{r.panelName}{r.resultDate ? ` · ${formatDate(r.resultDate)}` : ''}</span>
      {r.source === 'EXTERNAL' && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-500"><Building2 size={9} /> {r.externalSource || 'External'}</span>}
    </div>
    {r.markers?.length > 0 && (
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
        {r.markers.map((m, i) => (
          <span key={i} className="text-slate-500 dark:text-zinc-400">
            <b className="text-pine dark:text-zinc-200">{m.name}</b> {m.value}{m.unit ? ` ${m.unit}` : ''}
            {m.flag ? <b className={`ml-0.5 ${flagTone[m.flag] ?? ''}`}>{m.flag === 'HIGH' ? '↑' : m.flag === 'LOW' ? '↓' : ''}</b> : ''}
            {m.refRange ? <span className="text-slate-300"> ({m.refRange})</span> : ''}
          </span>
        ))}
      </div>
    )}
    {r.notes && <p className="text-[10px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{r.notes}</p>}
    {(r.attachments || []).length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {(r.attachments || []).map((a: any, i: number) => (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[9px] font-bold text-slate-500 hover:border-seafoam transition-all">
            <FileText size={10} className="text-seafoam" /> {a.name || 'file'}
          </a>
        ))}
      </div>
    )}
  </div>
);

// Compact inline render of an imaging study (findings + thumbnails).
const ImagingResultInline: React.FC<{ r: ImagingRecord }> = ({ r }) => {
  const images = (r.images || []).map((im: any) => typeof im === 'string' ? { url: im } : im);
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-bold text-slate-400">{r.modality}{r.bodyPart ? ` · ${r.bodyPart}` : ''}{r.studyDate ? ` · ${formatDate(r.studyDate)}` : ''}
        {r.source === 'EXTERNAL' && <span className="inline-flex items-center gap-0.5 ml-1 text-indigo-500"><Building2 size={9} /> {r.externalSource || 'External'}</span>}
      </p>
      {r.findings && <p className="text-[10px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{r.findings}</p>}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.slice(0, 6).map((im: any, i: number) => (
            <a key={i} href={im.url} target="_blank" rel="noreferrer" title={im.description || ''}>
              <img src={im.url} className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-zinc-800 hover:border-seafoam transition-all" />
            </a>
          ))}
          {images.length > 6 && <span className="self-center text-[9px] font-bold text-slate-400">+{images.length - 6} more</span>}
        </div>
      )}
    </div>
  );
};

const DiagnosticsStep: React.FC<StepProps> = ({ visit, data, setData, goServices, addService, openModule, deleteTask, emit, currency, staff, visibleFields, refreshVisit }) => {
  const show = showsField(visibleFields);
  // Inline add, provided by VisitDetailView (see ServiceInjectContext).
  const { injectService, addedNames } = useServiceInject();
  const d = data || {};
  const requests = (visit.tasks || []).filter(t => isDiagnostic(t.category));
  const { user: currentUser } = useAuth();

  // Outsourced jobs on this visit (169) — a request row that already went to a
  // partner shows a status chip + tracking dialog instead of the send button.
  const [jobs, setJobs] = useState<VisitJob[]>([]);
  const loadJobs = React.useCallback(() => {
    visitJobsAPI.listForVisit(visit.id, { silent: true } as any)
      .then(r => { if (r.success && r.data?.jobs) setJobs(r.data.jobs); })
      .catch(() => {});
  }, [visit.id]);
  useEffect(() => { loadJobs(); }, [loadJobs]);
  // Latest job per task, ignoring dead ends so a declined/cancelled request
  // lets the row offer "To partner" again.
  const jobForTask = (taskId: number | string): VisitJob | undefined =>
    jobs.find(j => String(j.taskId ?? '') === String(taskId) && j.status !== 'DECLINED' && j.status !== 'CANCELLED');

  // Inline result viewing — lazily load this pet's lab + imaging records and
  // match them to requests (taskId first, visit-level as fallback).
  const [viewing, setViewing] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState<string | null>(null);
  /** Which row's overflow menu is open (2026-08-22). */
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [recs, setRecs] = useState<ModuleRecs | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);

  const loadRecords = async (force = false) => {
    // `force` matters after saving a result inline: without it the early return
    // below keeps showing the pre-save record, so the user's own edit looks
    // like it did not take.
    if (!force && (recs || recsLoading)) return;
    if (recsLoading) return;
    setRecsLoading(true);
    try {
      const [labRes, imgRes, surgRes] = await Promise.all([
        labAPI.list({ petId: visit.petId }),
        imagingAPI.list({ petId: visit.petId }),
        surgeryAPI.list({ petId: visit.petId }).catch(() => ({ success: false } as any)),
      ]);
      setRecs({
        lab: labRes.success ? (labRes.data?.records || []) : [],
        imaging: imgRes.success ? (imgRes.data?.records || []) : [],
        surgery: (surgRes as any)?.success ? ((surgRes as any).data?.records || []) : [],
      });
    } catch { setRecs({ lab: [], imaging: [], surgery: [] }); }
    finally { setRecsLoading(false); }
  };

  const matchFor = (taskId: number | string, taskName: string) => {
    if (!recs) return null;
    const tid = String(taskId);
    const vid = String(visit.id);
    const lab = recs.lab.find(r => String(r.taskId ?? '') === tid)
      || recs.lab.find(r => String(r.appointmentId ?? '') === vid && r.panelName === taskName);
    if (lab) return { type: 'lab' as const, lab };
    const img = recs.imaging.find(r => String(r.taskId ?? '') === tid)
      || recs.imaging.find(r => String(r.appointmentId ?? '') === vid);
    if (img) return { type: 'imaging' as const, img };
    // Surgery matches on taskId only — a visit can carry several procedures and
    // falling back to "any surgery on this visit" would attach the wrong report.
    const surg = (recs.surgery || []).find((r: any) => String(r.taskId ?? '') === tid);
    if (surg) return { type: 'surgery' as const, surg };
    return null;
  };

  /** Which row is mid-upload — keyed by task id, so two rows can't share a spinner. */
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  /**
   * Attach a result file straight from the row.
   *
   * Resolves the record the same way the inline editor does. If the request has
   * no record behind it yet there is nothing to hang a file on, so we say that
   * rather than failing silently.
   */
  const uploadResultFor = async (task: any, files: FileList | null) => {
    if (!files?.length) return;
    const m = matchFor(task.id, task.name);
    const kind: ResultKind | null = m?.lab ? 'lab' : m?.img ? 'imaging' : m?.surg ? 'surgery' : null;
    const record = m?.lab ?? m?.img ?? m?.surg ?? null;
    if (!kind || !record) {
      toast.error('No result record for this request yet — open it with View result first.');
      return;
    }
    setUploadingFor(String(task.id));
    try {
      const n = await uploadAndAttach(kind, record, Array.from(files));
      if (n > 0) {
        toast.success(n === 1 ? 'Result attached' : `${n} files attached`);
        emit(`Result attached to ${task.name}`, 'action', true);
        loadRecords(true);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Upload failed');
    } finally {
      setUploadingFor(null);
    }
  };

  const toggleView = (taskId: number | string) => {
    const k = String(taskId);
    const opening = !viewing[k];
    setViewing(v => ({ ...v, [k]: opening }));
    if (opening) loadRecords();
  };

  // Procedure recipes offered in the same search, badged with their TYPE
  // (174). Picking one APPLIES the recipe — its fees and products land on the
  // bill and its services appear as requests below.
  const [procTemplates, setProcTemplates] = useState<ProcedureTemplate[]>([]);
  const [applyingProc, setApplyingProc] = useState(false);
  useEffect(() => {
    procedureTemplatesAPI.list().then(r => { if (r.success && r.data?.templates) setProcTemplates(r.data.templates.filter(t => t.isActive !== false)); }).catch(() => {});
  }, []);
  const applyProcedure = async (p: { id: string; name: string }) => {
    setApplyingProc(true);
    try {
      const res = await procedureTemplatesAPI.apply(p.id, { appointmentId: visit.id });
      if (res.success) {
        emit(`Procedure performed — ${p.name} (recipe applied · ${res.data?.created?.tasks ?? 0} services, ${res.data?.created?.products ?? 0} products)`, 'billing', true);
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to apply procedure'); }
    finally { setApplyingProc(false); }
  };

  // A small inline search, not the right-side drawer (user, 2026-07-29):
  // adding one lab test shouldn't be a full-screen trip through a category
  // catalogue. Whatever is picked lands in ITS OWN category — imaging adds
  // imaging, laboratory adds laboratory — and the requests list below (which
  // the report is built from) picks it up from the same place.
  const addButton = injectService ? (
    <div className="max-w-sm mx-auto text-left space-y-1">
      <InlineServiceSearch
        onAdd={injectService}
        addedNames={addedNames}
        currency={currency}
        placeholder="Search a diagnostic service or procedure to add…"
        procedures={procTemplates.map(t => ({ id: t.id, name: t.name, type: t.type, estimatedTotal: t.estimatedTotal }))}
        onAddProcedure={applyProcedure}
      />
      {applyingProc && <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><Loader2 size={11} className="animate-spin" /> Applying recipe — fees & products landing on the bill…</p>}
    </div>
  ) : (addService || goServices) && (
    <button type="button" onClick={addService ?? goServices}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
      <Plus size={11} /> Add diagnostic service
    </button>
  );

  return (
    <div className="space-y-4">
      {show('requests') && (
      <Section icon={FlaskConical} title="Diagnostic Requests">
        {requests.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500">No diagnostic services on this visit yet.</p>
            {addButton}
          </div>
        ) : (
          <div className="space-y-1.5">
            {requests.map(t => {
              const isViewing = !!viewing[String(t.id)];
              const match = isViewing ? matchFor(t.id, t.name) : null;
              const assignee = t.assignedStaffId ? staff.find(s => String(s.id) === String(t.assignedStaffId)) : null;
              const status = String(t.status || 'PENDING');
              return (
                <div key={t.id} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{t.name}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t.category} · {currency} {t.price?.toLocaleString()}</p>
                    </div>
                    {assignee && (
                      <span title={`Assigned to ${assignee.name} — they mark progress from the services tab or the module page`}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${String(t.assignedStaffId) === String(currentUser?.id) ? 'bg-seafoam/15 text-seafoam' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'}`}>
                        <span className="w-3.5 h-3.5 rounded-full bg-seafoam text-white flex items-center justify-center text-[7px] font-black">{assignee.name.charAt(0)}</span>
                        {assignee.name.split(' ')[0]}
                      </span>
                    )}
                    {/* Read-only: mirrors the task's real status — the assignee
                        updates it from the services tab / module page. */}
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${STATUS_TONE[status] || STATUS_TONE.PENDING}`}>{STATUS_LABEL[status] || status.toLowerCase()}</span>
                    {/* Complete right here (user, 2026-08-02): the clinic's plan may
                        not include the full imaging/lab/surgery workflow pages, and a
                        returned partner job leaves the local task stuck — every
                        request must be completable from this row either way. */}
                    {status !== 'COMPLETED' && !visit.isPaid && (
                      <button type="button" disabled={completing === String(t.id)}
                        title="Mark this request completed (no module page needed)"
                        onClick={async () => {
                          setCompleting(String(t.id));
                          try {
                            const r = await visitsAPI.updateTask(Number(visit.id), Number(t.id), { status: 'COMPLETED' } as any);
                            if (r.success) { emit(`${t.name} marked completed`, 'milestone', true); refreshVisit?.(); }
                          } catch (e: any) { toast.error(e?.message || 'Failed to complete'); }
                          finally { setCompleting(null); }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all">
                        {completing === String(t.id) ? <Loader2 size={10} className="animate-spin" /> : null} Complete
                      </button>
                    )}
                    <button type="button" onClick={() => toggleView(t.id)}
                      title="View the result record inline"
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${isViewing ? 'bg-cyan-600 text-white border-cyan-600' : 'border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-600 hover:text-white'}`}>
                      {isViewing ? <EyeOff size={10} /> : <Eye size={10} />} {isViewing ? 'Hide' : 'View result'}
                    </button>
                    {/* An existing partner job stays VISIBLE — it is status,
                        not an action, and hiding a job's progress in a menu
                        would be hiding the answer to "where is this test?". */}
                    {(() => {
                      const job = jobForTask(t.id);
                      return job ? <OutsourcedJobChip job={job} onChanged={loadJobs} /> : null;
                    })()}

                    {/* ── EVERYTHING ELSE IN A MENU ─────────────────────────
                        Five buttons per row across three rows is a wall of
                        chips, and the two that matter — Complete and View
                        result — were the hardest to pick out (user, 2026-08-22:
                        "some button there can be in drop down"). Full page,
                        To partner and Remove move in here; the two primary
                        actions stay out. */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setRowMenu(m => (m === String(t.id) ? null : String(t.id)))}
                        title="More actions"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                      >
                        <MoreVertical size={13} />
                      </button>
                      {rowMenu === String(t.id) && (
                        <>
                          {/* Click-away catcher — a menu you cannot dismiss by
                              clicking elsewhere is a trap on touch. */}
                          <div className="fixed inset-0 z-10" onClick={() => setRowMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden py-1">
                            {openModule && (
                              <button type="button"
                                onClick={() => { setRowMenu(null); openModule(t.category); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800">
                                <ExternalLink size={12} className="text-seafoam" /> Full page
                              </button>
                            )}
                            <label
                              title="Attach a scan, photo or PDF result to this request"
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 ${uploadingFor === String(t.id) ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
                            >
                              {uploadingFor === String(t.id)
                                ? <Loader2 size={12} className="text-cyan-500 animate-spin" />
                                : <Upload size={12} className="text-cyan-500" />}
                              {uploadingFor === String(t.id) ? 'Uploading…' : 'Upload result'}
                              <input
                                type="file"
                                multiple
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={async e => {
                                  const files = e.target.files;
                                  // Clear the input first: picking the same file
                                  // twice in a row fires no change event otherwise.
                                  e.target.value = '';
                                  setRowMenu(null);
                                  await uploadResultFor(t, files);
                                }}
                              />
                            </label>
                            {!jobForTask(t.id) && !visit.isPaid && (
                              <div className="px-2 py-1" onClick={() => setRowMenu(null)}>
                                <OutsourceServiceButton variant="chip" visitId={visit.id} taskId={t.id} category={t.category} serviceName={t.name} currency={currency}
                                  onCreated={() => { emit(`${t.name} sent to a partner clinic`, 'action', true); loadJobs(); }} />
                              </div>
                            )}
                            {deleteTask && !visit.isPaid && (
                              <button type="button"
                                onClick={async () => {
                                  setRowMenu(null);
                                  const ok = await dialog.confirmDelete({ title: 'Remove diagnostic request', message: 'Removes the service from this visit and its bill (the linked record is cleaned up too).', entityName: t.name });
                                  if (!ok) return;
                                  deleteTask(Number(t.id));
                                  emit(`Removed ${t.name} from the visit`, 'billing', true);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                <Trash2 size={12} /> Remove from visit
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Results / notes recorded on the service line show inline. */}
                  {t.notes && (
                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                      <FileText size={11} className="text-seafoam shrink-0 mt-0.5" />
                      <p className="text-[10px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{t.notes}</p>
                    </div>
                  )}
                  {/* Inline result viewer — the matched lab/imaging record. */}
                  {isViewing && (
                    <div className="px-2.5 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-cyan-100 dark:border-cyan-900/40">
                      {recsLoading && !recs ? (
                        <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><Loader2 size={11} className="animate-spin" /> Loading result…</p>
                      ) : match?.type === 'lab' ? (
                        <>
                          <LabResultInline r={match.lab} />
                          {/* Record it HERE. Sending someone to another page to
                              type a result they are looking at is the reason
                              results arrive late. */}
                          <InlineResultEditor kind="lab" lab={match.lab} onSaved={() => loadRecords(true)} />
                        </>
                      ) : match?.type === 'imaging' ? (
                        <>
                          <ImagingResultInline r={match.img} />
                          <InlineResultEditor kind="imaging" imaging={match.img} onSaved={() => loadRecords(true)} />
                        </>
                      ) : match?.type === 'surgery' ? (
                        <>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1.5">
                            {match.surg.serviceName} · {String(match.surg.status || '').replace(/_/g, ' ').toLowerCase()}
                          </p>
                          <InlineResultEditor kind="surgery" surgery={match.surg} onSaved={() => loadRecords(true)} />
                        </>
                      ) : (
                        <p className="text-[10px] font-bold text-slate-400">
                          No result record yet — it is created when the {t.category} request is started.
                          Open <strong>Full page</strong> to begin one.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="pt-1">{addButton}</div>
          </div>
        )}
      </Section>
      )}

      {show('keyFindings') && (
      <Section icon={FileSearch} title="Key Findings">
        <textarea className="field-textarea" rows={3} placeholder={'One finding per line, e.g.\nMild leukocytosis with neutrophilia.\nFecal exam: coccidia oocysts ++'} value={d.keyFindings ?? ''} onChange={e => setData({ keyFindings: e.target.value })} />
      </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {show('interpretation') && (
      <Section icon={Lightbulb} title="Clinical Interpretation">
          <textarea className="field-textarea" rows={3} placeholder="What the results mean for this patient…" value={d.interpretation ?? ''} onChange={e => setData({ interpretation: e.target.value })} />
        </Section>
      )}
        {show('recommendations') && (
      <Section icon={Lightbulb} title="Recommendations">
          <textarea className="field-textarea" rows={3} placeholder="Next steps based on results…" value={d.recommendations ?? ''} onChange={e => setData({ recommendations: e.target.value })} />
        </Section>
      )}
      </div>

      {show('pending') && <L label="Pending / external results">
        <input className="field-input" placeholder="e.g. Giardia antigen test — sent to external lab, ETA tomorrow" value={d.pending ?? ''} onChange={e => setData({ pending: e.target.value })} />
      </L>}
    </div>
  );
};

export default DiagnosticsStep;

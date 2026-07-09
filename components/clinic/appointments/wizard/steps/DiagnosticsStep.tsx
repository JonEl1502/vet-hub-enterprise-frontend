import React, { useState } from 'react';
import { FlaskConical, FileSearch, Lightbulb, Plus, ExternalLink, FileText, Eye, EyeOff, Loader2, Building2, Trash2 } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L } from '../fields';
import { labAPI, imagingAPI, LabRecord, ImagingRecord, dialog } from '../../../../../services';
import { formatDate } from '../../../../../services/utils/dateFormatter';
import { useAuth } from '../../../../../contexts/AuthContext';

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
  return ['lab', 'imaging', 'diagnostic', 'x-ray', 'xray', 'ultrasound', 'radiolog', 'dental'].some(k => c.includes(k));
};

type ModuleRecs = { lab: LabRecord[]; imaging: ImagingRecord[] };

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

const DiagnosticsStep: React.FC<StepProps> = ({ visit, data, setData, goServices, addService, openModule, deleteTask, emit, currency, staff }) => {
  const d = data || {};
  const requests = (visit.tasks || []).filter(t => isDiagnostic(t.category));
  const { user: currentUser } = useAuth();

  // Inline result viewing — lazily load this pet's lab + imaging records and
  // match them to requests (taskId first, visit-level as fallback).
  const [viewing, setViewing] = useState<Record<string, boolean>>({});
  const [recs, setRecs] = useState<ModuleRecs | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);

  const loadRecords = async () => {
    if (recs || recsLoading) return;
    setRecsLoading(true);
    try {
      const [labRes, imgRes] = await Promise.all([
        labAPI.list({ petId: visit.petId }),
        imagingAPI.list({ petId: visit.petId }),
      ]);
      setRecs({
        lab: labRes.success ? (labRes.data?.records || []) : [],
        imaging: imgRes.success ? (imgRes.data?.records || []) : [],
      });
    } catch { setRecs({ lab: [], imaging: [] }); }
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
    return null;
  };

  const toggleView = (taskId: number | string) => {
    const k = String(taskId);
    const opening = !viewing[k];
    setViewing(v => ({ ...v, [k]: opening }));
    if (opening) loadRecords();
  };

  const addButton = (addService || goServices) && (
    <button type="button" onClick={addService ?? goServices}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
      <Plus size={11} /> Add diagnostic service
    </button>
  );

  return (
    <div className="space-y-4">
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
                    <button type="button" onClick={() => toggleView(t.id)}
                      title="View the result record inline"
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${isViewing ? 'bg-cyan-600 text-white border-cyan-600' : 'border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-600 hover:text-white'}`}>
                      {isViewing ? <EyeOff size={10} /> : <Eye size={10} />} {isViewing ? 'Hide' : 'View result'}
                    </button>
                    {openModule && (
                      <button type="button" onClick={() => openModule(t.category)}
                        title={`Open the ${t.category} page for this visit — results & full details`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-seafoam/30 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
                        <ExternalLink size={10} /> Full page
                      </button>
                    )}
                    {/* Anything added is deletable before payment — the bill
                        line + its auto-created module record go together. */}
                    {deleteTask && !visit.isPaid && (
                      <button type="button"
                        onClick={async () => {
                          const ok = await dialog.confirmDelete({ title: 'Remove diagnostic request', message: 'Removes the service from this visit and its bill (the linked record is cleaned up too).', entityName: t.name });
                          if (!ok) return;
                          deleteTask(Number(t.id));
                          emit(`Removed ${t.name} from the visit`, 'billing', true);
                        }}
                        title="Remove this request from the visit & bill"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all">
                        <Trash2 size={12} />
                      </button>
                    )}
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
                        <LabResultInline r={match.lab} />
                      ) : match?.type === 'imaging' ? (
                        <ImagingResultInline r={match.img} />
                      ) : (
                        <p className="text-[10px] font-bold text-slate-400">No result record yet — results are attached from the {t.category} page once uploaded.</p>
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

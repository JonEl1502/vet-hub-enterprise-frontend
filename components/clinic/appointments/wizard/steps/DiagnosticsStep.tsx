import React, { useState } from 'react';
import { FlaskConical, FileSearch, Lightbulb, Plus, ExternalLink, FileText, Eye, EyeOff, Loader2, Building2 } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L } from '../fields';
import { labAPI, imagingAPI, LabRecord, ImagingRecord } from '../../../../../services';
import { formatDate } from '../../../../../services/utils/dateFormatter';

// Diagnostics rides on the visit's REAL service line-items: any lab/imaging/
// dental service added to the visit shows here as a request whose sample→
// result pipeline is tracked. Services are added IN PLACE via the Add
// Services modal; results can be VIEWED inline (matched module records) and
// each request links to its module's full page for the complete detail.

const STAGES = ['Requested', 'Sample collected', 'In progress', 'Results uploaded'] as const;
type Stage = typeof STAGES[number];

const STAGE_TONE: Record<Stage, string> = {
  'Requested': 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
  'Sample collected': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'In progress': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Results uploaded': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
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

const DiagnosticsStep: React.FC<StepProps> = ({ visit, data, setData, emit, goServices, addService, openModule, currency }) => {
  const d = data || {};
  const stages: Record<string, Stage> = d.stages || {};
  const requests = (visit.tasks || []).filter(t => isDiagnostic(t.category));

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

  const advance = (taskId: number | string, name: string) => {
    const cur = stages[String(taskId)] || 'Requested';
    const i = STAGES.indexOf(cur);
    if (i >= STAGES.length - 1) return;
    const nextStage = STAGES[i + 1];
    setData({ stages: { ...stages, [String(taskId)]: nextStage } });
    emit(`${name} — ${nextStage.toLowerCase()}`, nextStage === 'Results uploaded' ? 'milestone' : 'action', true);
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
              const stage = stages[String(t.id)] || 'Requested';
              const done = stage === 'Results uploaded';
              const isViewing = !!viewing[String(t.id)];
              const match = isViewing ? matchFor(t.id, t.name) : null;
              return (
                <div key={t.id} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
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

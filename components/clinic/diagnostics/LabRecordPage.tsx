import React, { useEffect, useState } from 'react';
import { ArrowLeft, FlaskConical, Dog, Building2, FileText, Loader2, Save, Plus, X, ExternalLink, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { labAPI, visitsAPI, LabRecord, LabMarker } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import StandardRecordControls from '../shared/StandardRecordControls';
import NotesFormatToggle, { FormattedNotes } from '../shared/NotesFormatToggle';
import ShareWithClinics from '../shared/ShareWithClinics';

interface Props {
  record: LabRecord;
  onBack: () => void;
  onChanged: () => void;
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

const FLAGS = ['', 'LOW', 'NORMAL', 'HIGH'];
const flagTone: Record<string, string> = { HIGH: 'text-rose-500', LOW: 'text-amber-500', NORMAL: 'text-emerald-500' };
const statusTone: Record<string, string> = {
  RESULTED: 'bg-emerald-400/20 text-emerald-100',
  IN_PROGRESS: 'bg-cyan-400/20 text-cyan-100',
  ORDERED: 'bg-amber-400/20 text-amber-100',
};
const tabStatusTone: Record<string, string> = {
  RESULTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  IN_PROGRESS: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  ORDERED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

/**
 * Full-page lab record — replaces the old slide-over drawer so results have
 * proper space: a real markers table (editable — results usually land after
 * the ORDERED record is created), attachment previews, and formatted notes.
 * A visit with SEVERAL lab requests shows one TAB per record below the
 * header — each with its own status (Ordered / In progress / Resulted) —
 * so the tech attends to all of them without leaving the page.
 */
const LabRecordPage: React.FC<Props> = ({ record, onBack, onChanged, onOpenAppointment }) => {
  // Sibling records: every lab request on the SAME visit, tabbed. The prop
  // record stays the fallback; switching tabs only changes `currentId`.
  const [siblings, setSiblings] = useState<LabRecord[]>([record]);
  const [currentId, setCurrentId] = useState<string | number>(record.id);
  const current = siblings.find(r => String(r.id) === String(currentId)) || record;
  // Billed visit ⇒ record locked (server enforces too): no edit/save/status
  // changes, everything stays readable.
  const currentAppt: any = (current as any).appointment || {};
  const billLocked = !!(currentAppt.isPaid || currentAppt.status === 'PENDING_PAYMENT' || currentAppt.status === 'COMPLETED');

  const loadSiblings = React.useCallback(async () => {
    if (!record.appointmentId) { setSiblings([record]); return; }
    try {
      const res = await labAPI.list({ appointmentId: record.appointmentId });
      // Belt & braces: THIS visit's records only (the tabs must never show
      // another patient/visit's tests).
      const scoped = (res.success ? (res.data?.records || []) : []).filter(r => String(r.appointmentId ?? '') === String(record.appointmentId));
      if (scoped.length) setSiblings(scoped);
    } catch { /* keep what we have */ }
  }, [record.appointmentId, record.id, record.updatedAt]);
  useEffect(() => { setCurrentId(record.id); }, [record.id]);
  useEffect(() => { loadSiblings(); }, [loadSiblings]);

  const [sharing, setSharing] = useState(false);
  const [markers, setMarkers] = useState<LabMarker[]>(current.markers || []);
  const [attachments, setAttachments] = useState<any[]>(current.attachments || []);
  const [notes, setNotes] = useState(current.notes || '');
  const [resultDate, setResultDate] = useState(current.resultDate ? current.resultDate.slice(0, 10) : '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-sync the editable fields when the ACTIVE record changes (tab switch
  // or refresh).
  useEffect(() => {
    setMarkers(current.markers || []);
    setAttachments(current.attachments || []);
    setNotes(current.notes || '');
    setResultDate(current.resultDate ? current.resultDate.slice(0, 10) : '');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(current.id), current.updatedAt]);

  // The result date auto-fills with TODAY the moment results start landing
  // (marker entry, upload, notes) — staff only touch it to backdate.
  const touchResultDate = () => setResultDate(d => d || new Date().toISOString().slice(0, 10));

  // Upload result docs/images for this requested test (data URL, like the
  // create form) — saved with the results.
  const addAttachment = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments(a => [...a, { url: reader.result as string, name: file.name, kind: file.type.startsWith('image/') ? 'IMAGE' : 'DOC' }]);
      setDirty(true);
      touchResultDate();
    };
    reader.readAsDataURL(file);
  };

  const refresh = async () => { await loadSiblings(); onChanged(); };

  const patch = async (data: Partial<LabRecord>) => {
    // Fold any unsaved local edits (uploaded attachments, markers, notes)
    // into the patch — a format/status toggle triggers a refetch that would
    // otherwise wipe them (images vanished on Paragraph/Bullets switch).
    const payload = dirty
      ? { markers: markers.filter(m => m.name.trim()), attachments, notes: notes || null, resultDate: resultDate || null, ...data }
      : data;
    try {
      const res = await labAPI.update(current.id, payload as any);
      if (res.success) { if (dirty) setDirty(false); await refresh(); }
    }
    catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const setMarker = (i: number, p: Partial<LabMarker>) => { setMarkers(ms => ms.map((m, j) => j === i ? { ...m, ...p } : m)); setDirty(true); touchResultDate(); };

  // A RESULTED record reopens for editing: back to In progress + a journey
  // event on the visit so the change is on the record's timeline.
  const reopenForEdit = async () => {
    await patch({ status: 'IN_PROGRESS' as any });
    if (current.appointmentId) {
      visitsAPI.addEvent(current.appointmentId, {
        label: `${current.panelName || 'Lab result'} reopened for editing (Resulted → In progress)`,
        kind: 'action',
      }).catch(() => { /* non-fatal */ });
    }
    toast('Result reopened — status set to In progress', { icon: '✏️' });
  };

  const saveResults = async () => {
    setSaving(true);
    try {
      const res = await labAPI.update(current.id, {
        markers: markers.filter(m => m.name.trim()),
        attachments,
        notes: notes || null,
        // Saving results without a date stamps TODAY automatically.
        resultDate: resultDate || new Date().toISOString().slice(0, 10),
      } as any);
      if (res.success) { toast.success('Results saved'); setDirty(false); await refresh(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const fieldCls = 'w-full px-2.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Laboratory
      </button>
      <div className="bg-gradient-to-br from-emerald-700 to-teal-600 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><FlaskConical size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Lab result</p>
          <h1 className="text-xl font-black tracking-tight truncate flex items-center gap-2"><Dog size={18} /> {current.pet?.name ?? 'Patient'}{(current.pet as any)?.species ? <span className="text-white/60 text-sm font-bold">· {(current.pet as any).species}</span> : null}</h1>
          <p className="text-[11px] text-white/70 truncate">
            {current.panelName} · {current.resultDate ? formatDate(current.resultDate) : formatDate(current.createdAt)}
            {current.source === 'EXTERNAL' && <span className="inline-flex items-center gap-1 ml-2"><Building2 size={10} /> {current.externalSource || 'External'}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusTone[current.status || 'ORDERED'] || statusTone.ORDERED}`}>{(current.status || 'ORDERED').replace('_', ' ').toLowerCase()}</span>
          {billLocked && (
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-white/85 text-[9px] font-black uppercase tracking-widest">
              {currentAppt.isPaid ? '🔒 Bill settled — locked' : '💰 Billed — awaiting payment'}
            </span>
          )}
        </div>
      </div>

      {/* One tab per lab request on this visit — attend to all of them here. */}
      {siblings.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {siblings.map(r => {
            const active = String(r.id) === String(current.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setCurrentId(r.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                  active ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-emerald-500'
                }`}
              >
                {r.panelName || 'Lab test'}
                <span className={`px-1.5 py-0.5 rounded text-[8px] ${active ? 'bg-white/20 text-white' : tabStatusTone[r.status || 'ORDERED'] || tabStatusTone.ORDERED}`}>
                  {(r.status || 'ORDERED').replace('_', ' ').toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main column — the space the drawer never had */}
        <div className="lg:col-span-8 space-y-4">
          {/* Markers table (editable — results land after ordering) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Markers &amp; Results</p>
              <div className="flex items-center gap-2">
                {current.status === 'RESULTED' && !billLocked && (
                  <button onClick={reopenForEdit}
                    title="Reopen this result for editing — status goes back to In progress and the change is logged on the visit's journey"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
                    ✏️ Edit result
                  </button>
                )}
                {!billLocked && <input type="date" className={`${fieldCls} !w-36`} value={resultDate} onChange={e => { setResultDate(e.target.value); setDirty(true); }} title="Result date" />}
                {dirty && !billLocked && (
                  <button onClick={saveResults} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-seafoam text-white rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50">
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save results
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 uppercase tracking-wider text-[8px] font-black">
                    <th className="py-1 pr-2 w-1/3">Marker</th><th className="py-1 px-2">Value</th><th className="py-1 px-2">Unit</th>
                    <th className="py-1 px-2">Ref range</th><th className="py-1 px-2">Flag</th><th className="py-1 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {markers.map((m, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-zinc-800">
                      <td className="py-1 pr-2"><input className={fieldCls} value={m.name} placeholder="Marker" disabled={billLocked} onChange={e => setMarker(i, { name: e.target.value })} /></td>
                      <td className="py-1 px-2"><input className={fieldCls} value={m.value} placeholder="—" disabled={billLocked} onChange={e => setMarker(i, { value: e.target.value })} /></td>
                      <td className="py-1 px-2"><input className={fieldCls} value={m.unit} placeholder="—" disabled={billLocked} onChange={e => setMarker(i, { unit: e.target.value })} /></td>
                      <td className="py-1 px-2"><input className={fieldCls} value={m.refRange} placeholder="—" disabled={billLocked} onChange={e => setMarker(i, { refRange: e.target.value })} /></td>
                      <td className="py-1 px-2">
                        <select className={`${fieldCls} ${flagTone[m.flag || ''] ?? ''}`} value={m.flag || ''} disabled={billLocked} onChange={e => setMarker(i, { flag: e.target.value as any })}>
                          {FLAGS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                        </select>
                      </td>
                      <td className="py-1 pl-2 text-right">
                        {!billLocked && <button onClick={() => { setMarkers(ms => ms.filter((_, j) => j !== i)); setDirty(true); }} className="p-1 text-slate-300 hover:text-rose-500"><X size={12} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!billLocked && <button onClick={() => { setMarkers(ms => [...ms, { name: '', value: '', unit: '', refRange: '', flag: '' } as any]); setDirty(true); touchResultDate(); }}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-seafoam"><Plus size={11} /> Add marker</button>}
          </div>

          {/* Attachments — result docs/images uploaded per requested test */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attachments · {attachments.length}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {attachments.map((a: any, i: number) => (
                <div key={i} className="group relative border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-seafoam transition-all">
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.kind === 'IMAGE'
                      ? <img src={a.url} alt={a.name || 'attachment'} className="w-full h-36 object-cover" />
                      : <div className="w-full h-36 flex items-center justify-center bg-slate-50 dark:bg-zinc-950"><FileText size={28} className="text-slate-300 group-hover:text-seafoam transition-colors" /></div>}
                    <p className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1">{a.name || 'file'} <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p>
                  </a>
                  {!billLocked && <button onClick={() => { setAttachments(x => x.filter((_, j) => j !== i)); setDirty(true); }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"><X size={12} /></button>}
                </div>
              ))}
              {!billLocked && <label className="flex flex-col items-center justify-center gap-2 min-h-36 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 cursor-pointer hover:border-seafoam text-slate-400 hover:text-seafoam transition-all">
                <Upload size={20} />
                <span className="text-[9px] font-black uppercase tracking-widest">Upload result</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { addAttachment(e.target.files?.[0]); e.target.value = ''; }} />
              </label>}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observations / Notes</p>
              <NotesFormatToggle value={current.displayFormat || 'PARAGRAPH'} onChange={(v) => patch({ displayFormat: v })} />
            </div>
            <textarea rows={4} className="field-textarea" placeholder="Result observations, interpretation…" value={notes} disabled={billLocked} onChange={e => { setNotes(e.target.value); setDirty(true); touchResultDate(); }} />
            {!dirty && current.notes && <FormattedNotes text={current.notes} format={current.displayFormat} />}
          </div>
        </div>

        {/* Side rail — controls & metadata (per active tab/record) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-sm sticky top-4">
            <StandardRecordControls
              appointmentId={current.appointmentId}
              onOpenAppointment={onOpenAppointment}
              onShare={() => setSharing(true)}
              shareCount={current.allowedClinicIds?.length}
              status={{ value: current.status || 'RESULTED', options: ['ORDERED', 'IN_PROGRESS', 'RESULTED'], onChange: (v) => patch({ status: v as any }), disabled: billLocked }}
            />
            {!current.appointmentId && <p className="text-[11px] text-slate-400 dark:text-zinc-500">No linked visit — create a walk-in visit on the result to bill it.</p>}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-2">
              {[
                ['Panel / test', current.panelName],
                ['Test type', current.testType],
                ['Specimen', current.specimen],
                ['Source', current.source === 'EXTERNAL' ? (current.externalSource || 'External') : 'Internal'],
                ['Ordered', formatDate(current.createdAt)],
                ['Updated', formatDate(current.updatedAt)],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex items-baseline justify-between gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{k}</span>
                  <span className="text-[11px] font-bold text-pine dark:text-zinc-100 text-right truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {sharing && (
        <ShareWithClinics recordType="lab" recordId={current.id} allowedClinicIds={current.allowedClinicIds}
          onClose={() => setSharing(false)} onSaved={() => { setSharing(false); refresh(); }} />
      )}
    </div>
  );
};

export default LabRecordPage;

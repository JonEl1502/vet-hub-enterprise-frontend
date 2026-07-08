import React, { useEffect, useState } from 'react';
import { ArrowLeft, FlaskConical, Dog, Building2, FileText, Loader2, Save, Plus, X, ExternalLink, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { labAPI, LabRecord, LabMarker } from '../../../services';
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

/**
 * Full-page lab record — replaces the old slide-over drawer so results have
 * proper space: a real markers table (editable — results usually land after
 * the ORDERED record is created), attachment previews, and formatted notes.
 * First of the "special pages" to move from drawer → full page.
 */
const LabRecordPage: React.FC<Props> = ({ record, onBack, onChanged, onOpenAppointment }) => {
  const [sharing, setSharing] = useState(false);
  const [markers, setMarkers] = useState<LabMarker[]>(record.markers || []);
  const [attachments, setAttachments] = useState<any[]>(record.attachments || []);
  const [notes, setNotes] = useState(record.notes || '');
  const [resultDate, setResultDate] = useState(record.resultDate ? record.resultDate.slice(0, 10) : '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-sync the editable fields when the parent refreshes the record.
  useEffect(() => {
    setMarkers(record.markers || []);
    setAttachments(record.attachments || []);
    setNotes(record.notes || '');
    setResultDate(record.resultDate ? record.resultDate.slice(0, 10) : '');
    setDirty(false);
  }, [record.id, record.updatedAt]);

  // Upload result docs/images for this requested test (data URL, like the
  // create form) — saved with the results.
  const addAttachment = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments(a => [...a, { url: reader.result as string, name: file.name, kind: file.type.startsWith('image/') ? 'IMAGE' : 'DOC' }]);
      setDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const patch = async (data: Partial<LabRecord>) => {
    // Fold any unsaved local edits (uploaded attachments, markers, notes)
    // into the patch — a format/status toggle triggers a refetch that would
    // otherwise wipe them (images vanished on Paragraph/Bullets switch).
    const payload = dirty
      ? { markers: markers.filter(m => m.name.trim()), attachments, notes: notes || null, resultDate: resultDate || null, ...data }
      : data;
    try {
      const res = await labAPI.update(record.id, payload as any);
      if (res.success) { if (dirty) setDirty(false); onChanged(); }
    }
    catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const setMarker = (i: number, p: Partial<LabMarker>) => { setMarkers(ms => ms.map((m, j) => j === i ? { ...m, ...p } : m)); setDirty(true); };

  const saveResults = async () => {
    setSaving(true);
    try {
      const res = await labAPI.update(record.id, {
        markers: markers.filter(m => m.name.trim()),
        attachments,
        notes: notes || null,
        resultDate: resultDate || null,
      } as any);
      if (res.success) { toast.success('Results saved'); setDirty(false); onChanged(); }
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
          <h1 className="text-xl font-black tracking-tight truncate flex items-center gap-2"><Dog size={18} /> {record.pet?.name ?? 'Patient'}{(record.pet as any)?.species ? <span className="text-white/60 text-sm font-bold">· {(record.pet as any).species}</span> : null}</h1>
          <p className="text-[11px] text-white/70 truncate">
            {record.panelName} · {record.resultDate ? formatDate(record.resultDate) : formatDate(record.createdAt)}
            {record.source === 'EXTERNAL' && <span className="inline-flex items-center gap-1 ml-2"><Building2 size={10} /> {record.externalSource || 'External'}</span>}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${record.status === 'RESULTED' ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-400/20 text-amber-100'}`}>{record.status?.toLowerCase()}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main column — the space the drawer never had */}
        <div className="lg:col-span-8 space-y-4">
          {/* Markers table (editable — results land after ordering) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Markers &amp; Results</p>
              <div className="flex items-center gap-2">
                <input type="date" className={`${fieldCls} !w-36`} value={resultDate} onChange={e => { setResultDate(e.target.value); setDirty(true); }} title="Result date" />
                {dirty && (
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
                      <td className="py-1 pr-2"><input className={fieldCls} value={m.name} placeholder="Marker" onChange={e => setMarker(i, { name: e.target.value })} /></td>
                      <td className="py-1 px-2"><input className={fieldCls} value={m.value} placeholder="—" onChange={e => setMarker(i, { value: e.target.value })} /></td>
                      <td className="py-1 px-2"><input className={fieldCls} value={m.unit} placeholder="—" onChange={e => setMarker(i, { unit: e.target.value })} /></td>
                      <td className="py-1 px-2"><input className={fieldCls} value={m.refRange} placeholder="—" onChange={e => setMarker(i, { refRange: e.target.value })} /></td>
                      <td className="py-1 px-2">
                        <select className={`${fieldCls} ${flagTone[m.flag || ''] ?? ''}`} value={m.flag || ''} onChange={e => setMarker(i, { flag: e.target.value as any })}>
                          {FLAGS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                        </select>
                      </td>
                      <td className="py-1 pl-2 text-right">
                        <button onClick={() => { setMarkers(ms => ms.filter((_, j) => j !== i)); setDirty(true); }} className="p-1 text-slate-300 hover:text-rose-500"><X size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => { setMarkers(ms => [...ms, { name: '', value: '', unit: '', refRange: '', flag: '' } as any]); setDirty(true); }}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-seafoam"><Plus size={11} /> Add marker</button>
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
                  <button onClick={() => { setAttachments(x => x.filter((_, j) => j !== i)); setDirty(true); }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"><X size={12} /></button>
                </div>
              ))}
              <label className="flex flex-col items-center justify-center gap-2 min-h-36 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 cursor-pointer hover:border-seafoam text-slate-400 hover:text-seafoam transition-all">
                <Upload size={20} />
                <span className="text-[9px] font-black uppercase tracking-widest">Upload result</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { addAttachment(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observations / Notes</p>
              <NotesFormatToggle value={record.displayFormat || 'PARAGRAPH'} onChange={(v) => patch({ displayFormat: v })} />
            </div>
            <textarea rows={4} className="field-textarea" placeholder="Result observations, interpretation…" value={notes} onChange={e => { setNotes(e.target.value); setDirty(true); }} />
            {!dirty && record.notes && <FormattedNotes text={record.notes} format={record.displayFormat} />}
          </div>
        </div>

        {/* Side rail — controls & metadata */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-sm sticky top-4">
            <StandardRecordControls
              appointmentId={record.appointmentId}
              onOpenAppointment={onOpenAppointment}
              onShare={() => setSharing(true)}
              shareCount={record.allowedClinicIds?.length}
              status={{ value: record.status || 'RESULTED', options: ['ORDERED', 'RESULTED'], onChange: (v) => patch({ status: v as any }) }}
            />
            {!record.appointmentId && <p className="text-[11px] text-slate-400 dark:text-zinc-500">No linked visit — create a walk-in visit on the result to bill it.</p>}
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-2">
              {[
                ['Panel / test', record.panelName],
                ['Test type', record.testType],
                ['Specimen', record.specimen],
                ['Source', record.source === 'EXTERNAL' ? (record.externalSource || 'External') : 'Internal'],
                ['Ordered', formatDate(record.createdAt)],
                ['Updated', formatDate(record.updatedAt)],
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
        <ShareWithClinics recordType="lab" recordId={record.id} allowedClinicIds={record.allowedClinicIds}
          onClose={() => setSharing(false)} onSaved={() => { setSharing(false); onChanged(); }} />
      )}
    </div>
  );
};

export default LabRecordPage;

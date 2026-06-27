import React, { useState } from 'react';
import { X, ScanLine, Dog, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { imagingAPI, ImagingRecord, ImagingImage } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import StandardRecordControls from '../shared/StandardRecordControls';
import ShareWithClinics from '../shared/ShareWithClinics';

interface Props {
  record: ImagingRecord | null;
  onClose: () => void;
  onChanged: () => void;
  // Jump to the linked appointment to take payment (wallet) once finalized.
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

const imgUrl = (im: ImagingImage | string): string => (typeof im === 'string' ? im : im?.url);
const imgMeta = (im: ImagingImage | string): ImagingImage => (typeof im === 'string' ? { url: im } : im);

/**
 * Boarding-style slide-over for an imaging study: patient header, the linked
 * bill, the images + findings, and a Status trigger. Finalize + settle-bill live
 * ONLY on the visit/workflow page (use "Linked appointment" to jump there) —
 * this drawer only updates the record.
 */
const ImagingDrawer: React.FC<Props> = ({ record, onClose, onChanged, onOpenAppointment }) => {
  const [viewer, setViewer] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  if (!record) return null;
  const hasVisit = !!record.appointmentId;

  // Patch a standard field (status / notes-format) on the record, then refresh.
  const patch = async (data: Partial<ImagingRecord>) => {
    try { const res = await imagingAPI.update(record.id, data); if (res.success) onChanged(); }
    catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-sky-700 to-cyan-600 text-white p-5 flex items-start justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <ScanLine size={20} className="text-white/90 shrink-0" />
            <div className="min-w-0">
              <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Imaging study</p>
              <h2 className="text-lg font-black truncate flex items-center gap-2"><Dog size={16} /> {record.pet?.name ?? 'Patient'}</h2>
              <p className="text-[10px] text-white/70 truncate">
                {record.modality}{record.bodyPart ? ` · ${record.bodyPart}` : ''} · {record.studyDate ? formatDate(record.studyDate) : formatDate(record.createdAt)}
                {record.source === 'EXTERNAL' && <span className="inline-flex items-center gap-0.5 ml-1"><Building2 size={9} /> {record.externalSource || 'External'}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Standard controls: Linked appointment · Share · Status · Notes format */}
          <StandardRecordControls
            appointmentId={record.appointmentId}
            onOpenAppointment={onOpenAppointment}
            onShare={() => setSharing(true)}
            shareCount={record.allowedClinicIds?.length}
            status={{ value: record.status || 'COMPLETED', options: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], onChange: (v) => patch({ status: v }) }}
            notesFormat={{ value: record.displayFormat || 'PARAGRAPH', onChange: (v) => patch({ displayFormat: v }) }}
          />
          {!hasVisit && <p className="text-[11px] text-slate-400 dark:text-zinc-500 px-1">No linked visit — create a walk-in visit on the study to bill it.</p>}

          {/* Images */}
          {record.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {record.images.map((im, i) => (
                <img key={i} src={imgUrl(im)} onClick={() => setViewer(imgUrl(im))}
                  className="w-full aspect-square rounded-lg object-cover border border-slate-200 dark:border-zinc-800 cursor-pointer hover:ring-2 hover:ring-seafoam" />
              ))}
            </div>
          )}
          {record.images.length > 0 && record.images.some(im => imgMeta(im).description || imgMeta(im).diagnosis) && (
            <div className="space-y-1.5">
              {record.images.map((im, i) => {
                const m = imgMeta(im);
                if (!m.description && !m.diagnosis && !m.notes) return null;
                return (
                  <div key={i} className="text-[11px] text-slate-500 dark:text-zinc-400">
                    <span className="font-bold text-pine dark:text-zinc-200">{m.description || `Image ${i + 1}`}</span>
                    {m.diagnosis ? ` — ${m.diagnosis}` : ''}{m.notes ? ` (${m.notes})` : ''}
                  </div>
                );
              })}
            </div>
          )}

          {/* Findings */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Overall findings</p>
            <p className="text-sm text-pine dark:text-zinc-200 whitespace-pre-wrap">{record.findings || '—'}</p>
          </div>
        </div>

      </div>

      {viewer && <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6" onClick={() => setViewer(null)}><img src={viewer} className="max-w-full max-h-full rounded-xl" /></div>}
      {sharing && (
        <ShareWithClinics recordType="imaging" recordId={record.id} allowedClinicIds={record.allowedClinicIds}
          onClose={() => setSharing(false)} onSaved={() => { setSharing(false); onChanged(); }} />
      )}
    </div>
  );
};

export default ImagingDrawer;

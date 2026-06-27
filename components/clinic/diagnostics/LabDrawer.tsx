import React, { useState } from 'react';
import { X, FlaskConical, Dog, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { labAPI, LabRecord } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import StandardRecordControls from '../shared/StandardRecordControls';
import ShareWithClinics from '../shared/ShareWithClinics';

interface Props {
  record: LabRecord | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

const flagTone: Record<string, string> = { HIGH: 'text-rose-500', LOW: 'text-amber-500', NORMAL: 'text-emerald-500' };

/** Standardized slide-over for a lab result — mirrors the Imaging drawer. */
const LabDrawer: React.FC<Props> = ({ record, onClose, onChanged, onOpenAppointment }) => {
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!record) return null;
  const hasVisit = !!record.appointmentId;

  const patch = async (data: Partial<LabRecord>) => {
    try { const res = await labAPI.update(record.id, data); if (res.success) onChanged(); }
    catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const closeAndSettle = async () => {
    setBusy(true);
    try {
      const res = await labAPI.bill(record.id);
      if (res?.success) {
        const apptId = res.data?.appointmentId || record.appointmentId;
        toast.success(apptId ? 'Lab closed — ready to settle.' : 'Lab closed.');
        onChanged();
        if (apptId) onOpenAppointment?.(String(apptId), true);
        onClose();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to close lab'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 bg-gradient-to-br from-emerald-700 to-teal-600 text-white p-5 flex items-start justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <FlaskConical size={20} className="text-white/90 shrink-0" />
            <div className="min-w-0">
              <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Lab result</p>
              <h2 className="text-lg font-black truncate flex items-center gap-2"><Dog size={16} /> {record.pet?.name ?? 'Patient'}</h2>
              <p className="text-[10px] text-white/70 truncate">
                {record.panelName} · {record.resultDate ? formatDate(record.resultDate) : formatDate(record.createdAt)}
                {record.source === 'EXTERNAL' && <span className="inline-flex items-center gap-0.5 ml-1"><Building2 size={9} /> {record.externalSource || 'External'}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <StandardRecordControls
            appointmentId={record.appointmentId}
            onOpenAppointment={onOpenAppointment}
            onShare={() => setSharing(true)}
            shareCount={record.allowedClinicIds?.length}
            onCloseSettle={closeAndSettle}
            closeSettleBusy={busy}
            closeSettleDisabled={!hasVisit}
            status={{ value: record.status || 'RESULTED', options: ['ORDERED', 'RESULTED'], onChange: (v) => patch({ status: v as any }) }}
            notesFormat={{ value: record.displayFormat || 'PARAGRAPH', onChange: (v) => patch({ displayFormat: v }) }}
          />
          {!hasVisit && <p className="text-[11px] text-slate-400 dark:text-zinc-500 px-1">No linked visit — create a walk-in visit on the result to bill it.</p>}

          {/* Markers */}
          {record.markers.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Markers</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {record.markers.map((m, i) => <span key={i} className="text-slate-500 dark:text-zinc-400"><b className="text-pine dark:text-zinc-200">{m.name}</b> {m.value}{m.unit ? ` ${m.unit}` : ''}{m.flag ? <b className={`ml-0.5 ${flagTone[m.flag] ?? ''}`}>{m.flag === 'HIGH' ? '↑' : m.flag === 'LOW' ? '↓' : ''}</b> : ''}{m.refRange ? <span className="text-slate-300"> ({m.refRange})</span> : ''}</span>)}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</p>
            <p className="text-sm text-pine dark:text-zinc-200 whitespace-pre-wrap">{record.notes || '—'}</p>
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

export default LabDrawer;

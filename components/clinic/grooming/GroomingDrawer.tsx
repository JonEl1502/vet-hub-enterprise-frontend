import React, { useState, useEffect } from 'react';
import { X, Scissors, Dog, CreditCard, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Visit } from '../../../types';
import { visitsAPI, groomingAPI } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import GroomingPanel from '../appointments/GroomingPanel';
import FinalizeReminderGate, { ReminderDraft } from '../appointments/FinalizeReminderGate';
import StandardRecordControls from '../shared/StandardRecordControls';

interface Props {
  appointment: Visit | null;
  onClose: () => void;
  onChanged: () => void;
  // Jump to the appointment to take payment (wallet) once finalized.
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

/**
 * Boarding-style slide-over for a grooming visit: header with patient/owner +
 * bill, the grooming report card (intake, services, before/after, consumables),
 * and a finalize gate that pops the payment wallet on the appointment.
 */
const GroomingDrawer: React.FC<Props> = ({ appointment, onClose, onChanged, onOpenAppointment }) => {
  const { pets, clients } = useData();
  const [showGate, setShowGate] = useState(false);
  const [busy, setBusy] = useState(false);
  // The grooming record for this visit (carries Status + Notes-format).
  const [gRec, setGRec] = useState<any | null>(null);
  useEffect(() => {
    if (!appointment) return;
    let alive = true;
    groomingAPI.list({ appointmentId: appointment.id }).then(res => { if (alive && res.success) setGRec(res.data?.records?.[0] ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [appointment?.id]);
  const patchRec = (data: any) => { if (gRec) groomingAPI.update(gRec.id, data).then(() => { setGRec({ ...gRec, ...data }); onChanged(); }).catch(() => {}); };

  if (!appointment) return null;

  const pet = pets.find(p => p.id === appointment.petId);
  const owner = clients.find(c => c.id === appointment.clientId);
  const petDeceased = pet?.isAlive === false;
  const locked = !!appointment.isPaid || (appointment.status as string) === 'COMPLETED';

  const finalize = async (reminder: ReminderDraft | null) => {
    setBusy(true);
    try {
      const res = await visitsAPI.finalize(appointment.id, reminder);
      if (res?.success) {
        setShowGate(false);
        toast.success('Visit finalized — ready to settle.');
        onChanged();
        onOpenAppointment?.(String(appointment.id), true); // pops the wallet
        onClose();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to finalize'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-fuchsia-700 to-pink-600 text-white p-5 flex items-start justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Scissors size={20} className="text-white/90 shrink-0" />
            <div className="min-w-0">
              <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">Grooming visit</p>
              <h2 className="text-lg font-black truncate flex items-center gap-2"><Dog size={16} /> {pet?.name ?? appointment.pet?.name ?? 'Patient'}</h2>
              <p className="text-[10px] text-white/70 truncate">{pet?.breed ? `${pet.breed} · ` : ''}{pet?.species ?? ''}{owner?.name ? ` · Owner: ${owner.name}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Bill summary */}
          <button onClick={() => onOpenAppointment?.(String(appointment.id), !appointment.isPaid)} className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-seafoam transition-all">
            <span className="flex items-center gap-2">
              <CreditCard size={15} className={appointment.isPaid ? 'text-emerald-500' : 'text-amber-500'} />
              <span className="text-left">
                <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Bill {appointment.isPaid ? '· paid' : '· unpaid'}</span>
                <span className="block text-sm font-black text-pine dark:text-zinc-100">KES {Number(appointment.totalCost).toLocaleString()}</span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-seafoam">{appointment.isPaid ? 'Receipt' : 'Open bill'} <ArrowRight size={12} /></span>
          </button>

          {/* Standard record controls — Status + Notes-format (grooming record). */}
          {gRec && (
            <StandardRecordControls
              status={{ value: gRec.status || 'PENDING', options: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], onChange: (v) => patchRec({ status: v }) }}
              notesFormat={{ value: gRec.displayFormat || 'PARAGRAPH', onChange: (v) => patchRec({ displayFormat: v }) }}
            />
          )}

          {/* Grooming report card — finalize opens the gate, then pops the wallet. */}
          <GroomingPanel appointment={appointment} onSaved={onChanged} onFinalize={locked ? undefined : () => { onClose(); onOpenAppointment?.(String(appointment.id), true); }} />
        </div>
      </div>

      <FinalizeReminderGate
        open={showGate}
        petName={pet?.name ?? 'Patient'}
        clientName={owner?.name ?? 'Client'}
        encounterType="GROOMING"
        petDeceased={petDeceased}
        submitting={busy}
        onCancel={() => setShowGate(false)}
        onConfirm={(reminder) => finalize(reminder)}
      />
    </div>
  );
};

export default GroomingDrawer;

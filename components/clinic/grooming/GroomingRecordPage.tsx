import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scissors, Dog } from 'lucide-react';
import { Visit } from '../../../types';
import { groomingAPI } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import GroomingPanel from '../appointments/GroomingPanel';
import StandardRecordControls from '../shared/StandardRecordControls';

interface Props {
  appointment: Visit;
  onBack: () => void;
  onChanged: () => void;
  // Jump to the visit workflow (finalize + settle live there).
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

/**
 * Full-page grooming record — replaces the slide-over drawer so the report
 * card (intake, before/after photos, groomer notes, consumables) has proper
 * space. Same drawer→page migration as Lab and Imaging.
 */
const GroomingRecordPage: React.FC<Props> = ({ appointment, onBack, onChanged, onOpenAppointment }) => {
  const { pets, clients } = useData();
  // The grooming record for this visit (carries Status + Notes-format).
  const [gRec, setGRec] = useState<any | null>(null);
  useEffect(() => {
    let alive = true;
    groomingAPI.list({ appointmentId: appointment.id }).then(res => { if (alive && res.success) setGRec(res.data?.records?.[0] ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [appointment.id]);
  const patchRec = (data: any) => { if (gRec) groomingAPI.update(gRec.id, data).then(() => { setGRec({ ...gRec, ...data }); onChanged(); }).catch(() => {}); };

  const pet = pets.find(p => p.id === appointment.petId);
  const owner = clients.find(c => c.id === appointment.clientId);
  const locked = !!appointment.isPaid || (appointment.status as string) === 'COMPLETED';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Grooming
      </button>

      {/* Header banner */}
      <div className="bg-gradient-to-br from-fuchsia-700 to-pink-600 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="p-3 bg-white/15 rounded-2xl"><Scissors size={24} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Grooming visit</p>
          <h1 className="text-xl font-black tracking-tight truncate flex items-center gap-2"><Dog size={18} /> {pet?.name ?? appointment.pet?.name ?? 'Patient'}</h1>
          <p className="text-[11px] text-white/70 truncate">{pet?.breed ? `${pet.breed} · ` : ''}{pet?.species ?? ''}{owner?.name ? ` · Owner: ${owner.name}` : ''}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${(gRec?.status || 'PENDING') === 'COMPLETED' ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-400/20 text-amber-100'}`}>
          {(gRec?.status || 'PENDING').replace('_', ' ').toLowerCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Report card — intake, before/after, groomer notes, consumables. */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <GroomingPanel appointment={appointment} onSaved={onChanged}
            notesFormat={gRec ? { value: gRec.displayFormat || 'PARAGRAPH', onChange: (v) => patchRec({ displayFormat: v }) } : undefined}
            onFinalize={locked ? undefined : () => onOpenAppointment?.(String(appointment.id))} />
        </div>

        {/* Side rail — status/share/linked visit controls. */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm sticky top-4 space-y-3">
          {gRec ? (
            <StandardRecordControls
              appointmentId={appointment.id != null ? String(appointment.id) : null}
              onOpenAppointment={onOpenAppointment}
              status={{ value: gRec.status || 'PENDING', options: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], onChange: (v) => patchRec({ status: v }), disabled: locked }}
            />
          ) : (
            <p className="text-[10px] text-slate-400">Loading record…</p>
          )}
          <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">Finalize &amp; settle live on the visit workflow — use Linked appointment.</p>
        </div>
      </div>
    </div>
  );
};

export default GroomingRecordPage;

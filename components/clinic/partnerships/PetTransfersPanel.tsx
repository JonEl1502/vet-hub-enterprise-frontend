import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Check, X, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { petTransfersAPI, StaffPetTransfer } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

// Pet transfers panel (Partners page): owner-initiated transfers where THIS
// clinic is either the destination (accept/decline, then request records) or
// the origin (approve/decline the record share). Hidden when there's nothing.
const PetTransfersPanel: React.FC<{ onOpenPet?: (petId: number) => void }> = ({ onOpenPet }) => {
  const [incoming, setIncoming] = useState<StaffPetTransfer[]>([]);
  const [outgoing, setOutgoing] = useState<StaffPetTransfer[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = () => petTransfersAPI.list({ silent: true })
    .then(res => {
      if (res.success && res.data) { setIncoming(res.data.incoming); setOutgoing(res.data.outgoing); }
    })
    .finally(() => setLoaded(true));

  useEffect(() => { load(); }, []);

  const act = async (id: string, fn: () => Promise<any>, okMsg: string) => {
    setBusyId(id);
    try { const res = await fn(); if (res.success) { toast.success(okMsg); load(); } }
    finally { setBusyId(null); }
  };

  const pendingIncoming = incoming.filter(t => t.status === 'PENDING');
  const acceptedIncoming = incoming.filter(t => t.status === 'ACCEPTED');
  const recordRequests = outgoing.filter(t => t.status === 'ACCEPTED' && t.recordShareStatus === 'REQUESTED');

  if (!loaded || (pendingIncoming.length === 0 && recordRequests.length === 0 && acceptedIncoming.length === 0)) return null;

  const Row: React.FC<{ t: StaffPetTransfer; children: React.ReactNode; sub: string }> = ({ t, children, sub }) => (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl">
      <span className="text-xl shrink-0">{t.pet?.species === 'Cat' ? '🐱' : '🐶'}</span>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => onOpenPet?.(Number(t.petId))}
          className="font-black text-sm text-pine dark:text-zinc-100 truncate hover:text-seafoam"
        >
          {t.pet?.name} <span className="text-slate-400 font-medium">· {t.pet?.breed || t.pet?.species}</span>
        </button>
        <p className="text-[10px] text-slate-400 truncate">{sub}{t.note ? ` — “${t.note}”` : ''}</p>
      </div>
      {children}
    </div>
  );

  return (
    <section className="bg-violet-50/50 dark:bg-violet-950/10 border border-violet-200 dark:border-violet-900/40 rounded-2xl p-4 space-y-3">
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-400">
        <ArrowRightLeft size={14} /> Patient transfers
      </p>

      {pendingIncoming.map(t => (
        <Row key={t.id} t={t} sub={`Owner wants to move this patient to you from ${t.fromClinic?.name} · ${formatDate(t.createdAt)}`}>
          <button disabled={busyId === t.id} onClick={() => act(t.id, () => petTransfersAPI.accept(t.id), 'Transfer accepted — patient added')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50">
            {busyId === t.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Accept
          </button>
          <button disabled={busyId === t.id} onClick={() => act(t.id, () => petTransfersAPI.decline(t.id), 'Transfer declined')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50">
            <X size={12} /> Decline
          </button>
        </Row>
      ))}

      {recordRequests.map(t => (
        <Row key={t.id} t={t} sub={`${t.toClinic?.name} requests this patient's history from you`}>
          <button disabled={busyId === t.id} onClick={() => act(t.id, () => petTransfersAPI.approveRecords(t.id), 'Records shared')}
            className="flex items-center gap-1.5 px-3 py-2 bg-seafoam text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/90 disabled:opacity-50">
            {busyId === t.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Share records
          </button>
          <button disabled={busyId === t.id} onClick={() => act(t.id, () => petTransfersAPI.declineRecords(t.id), 'Record request declined')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50">
            <X size={12} /> Decline
          </button>
        </Row>
      ))}

      {acceptedIncoming.filter(t => t.recordShareStatus === 'NONE' || t.recordShareStatus === 'DECLINED').map(t => (
        <Row key={t.id} t={t} sub={`Transferred in from ${t.fromClinic?.name} · history not shared yet${t.recordShareStatus === 'DECLINED' ? ' (last request declined)' : ''}`}>
          <button disabled={busyId === t.id} onClick={() => act(t.id, () => petTransfersAPI.requestRecords(t.id), 'Records requested')}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50">
            {busyId === t.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Request records
          </button>
        </Row>
      ))}
      {acceptedIncoming.filter(t => t.recordShareStatus === 'REQUESTED').map(t => (
        <Row key={t.id} t={t} sub={`Waiting for ${t.fromClinic?.name} to approve the record share`}>
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Awaiting records</span>
        </Row>
      ))}
    </section>
  );
};

export default PetTransfersPanel;

import React, { useEffect, useState } from 'react';
import { ChevronRight, Receipt, User as UserIcon, Stethoscope, Smile, Calendar, Printer } from 'lucide-react';
import { Visit, Pet, Client, Clinic, ApptStatus } from '../../../types';
import { petsAPI } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

// ── Collapsible info card — one-line summary collapsed, full scrollable
//    record expanded. Shared by the wizard rail and Records & Billing. ──
export const InfoCard: React.FC<{
  icon: React.ElementType;
  title: string;
  summary: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, title, summary, defaultOpen, children }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all">
        <span className="p-1.5 bg-seafoam/10 text-seafoam rounded-lg shrink-0"><Icon size={13} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{title}</span>
          {!open && <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 truncate">{summary}</span>}
        </span>
        <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-zinc-800 max-h-80 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      )}
    </div>
  );
};

export const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value ? (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{label}</span>
      <span className="text-[11px] font-bold text-pine dark:text-zinc-100 text-right">{value}</span>
    </div>
  ) : null;

const BEHAVIOUR_TRAITS = ['Calm', 'Very happy', 'Likes petting', 'Well trained', 'Good with kids', 'Food motivated', 'Playful', 'Nervous', 'Anxious at vet', 'Aggressive', 'May bite', 'Hates nail trims', 'Vocal'];

interface Props {
  visit: Visit;
  pet: Pet;
  client?: Client;
  activeClinic: Clinic;
  allAppointments: Visit[];
  visitReminder?: any | null;
  onNavigateToVisit?: (visitId: number) => void;
  onNavigateToPet?: (petId: number) => void;
  onNavigateToClient?: (clientId: number) => void;
  onBookFollowUp?: () => void;
  onOpenInvoice?: () => void;
}

/**
 * The patient context rail — Bill & Balance on top, then Patient & Owner,
 * Behaviour and Clinical Snapshot as collapsible cards. Fed by the pet's
 * Clinical Snapshot API + patient timeline.
 */
const PatientRail: React.FC<Props> = ({ visit, pet, client, activeClinic, allAppointments, visitReminder, onNavigateToVisit, onNavigateToPet, onNavigateToClient, onBookFollowUp, onOpenInvoice }) => {
  const [petSnapshot, setPetSnapshot] = useState<any | null>(null);
  const [vaccineHistory, setVaccineHistory] = useState<{ name: string; date: string }[]>([]);
  useEffect(() => {
    let alive = true;
    petsAPI.getSnapshot(pet.id).then((r: any) => { if (alive && r.success && r.data?.snapshot) setPetSnapshot(r.data.snapshot); }).catch(() => {});
    petsAPI.getTimeline(pet.id).then((r: any) => {
      if (!alive || !r.success) return;
      const tl: any = r.data?.timeline;
      const entries: any[] = Array.isArray(tl) ? tl : (tl?.entries || []);
      setVaccineHistory(entries.filter((e: any) => e.type === 'vaccination').map((e: any) => ({ name: e.vaccineName || 'Vaccine', date: e.date })));
    }).catch(() => {});
    return () => { alive = false; };
  }, [pet.id]);

  // Behavioural traits — per-pet, localStorage until the API column ships.
  const behaviourKey = `vethub.petBehaviour.v1.${pet.id}`;
  const [behaviour, setBehaviour] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(behaviourKey) || '[]'); } catch { return []; } });
  const [behaviourDraft, setBehaviourDraft] = useState('');
  const setBehaviourPersist = (next: string[]) => { setBehaviour(next); try { localStorage.setItem(behaviourKey, JSON.stringify(next)); } catch { /* quota */ } };
  const toggleTrait = (t: string) => setBehaviourPersist(behaviour.includes(t) ? behaviour.filter(x => x !== t) : [...behaviour, t]);

  const unpaid = allAppointments
    .filter(a => a.clientId === visit.clientId && !a.isPaid && (a.status === ApptStatus.COMPLETED || a.status === ApptStatus.PENDING_PAYMENT))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const outstanding = petSnapshot?.finance?.outstandingBalance ?? unpaid.reduce((s, a) => s + (a.totalCost || 0), 0);
  const past = allAppointments
    .filter(a => a.petId === visit.petId && a.id !== visit.id && new Date(a.date) < new Date(visit.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastVisit = past[0];
  const dueVaccines = [...(petSnapshot?.vaccines?.dueSoon || []), ...(petSnapshot?.vaccines?.overdue || [])];
  const vaccinesGiven = vaccineHistory.length || petSnapshot?.counts?.vaccinations || 0;

  return (
    <div className="space-y-3">
      <InfoCard icon={Receipt} title="Bill & Balance" defaultOpen
        summary={outstanding > 0 ? `${activeClinic.currency} ${Number(outstanding).toLocaleString()} outstanding` : 'No outstanding balance'}>
        <div className="space-y-1.5">
          <InfoRow label="This visit" value={`${activeClinic.currency} ${visit.totalCost.toLocaleString()} · ${visit.isPaid ? 'paid' : 'unpaid'}`} />
          <InfoRow label="Client outstanding" value={outstanding > 0
            ? <span className="text-amber-600 dark:text-amber-400 font-black">{activeClinic.currency} {Number(outstanding).toLocaleString()}</span>
            : 'None'} />
          {unpaid.length > 0 && (
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 mt-1.5 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Unpaid visits</p>
              {unpaid.slice(0, 5).map(a => (
                <button key={a.id} onClick={() => onNavigateToVisit?.(a.id)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 hover:border-amber-400 transition-all text-left">
                  <span className="text-[10px] font-bold text-pine dark:text-zinc-100">#{a.id} · {formatDate(a.date)}</span>
                  <span className="text-[10px] font-black font-mono text-amber-700 dark:text-amber-400">{(a.totalCost || 0).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
          {onOpenInvoice && (
            <button onClick={onOpenInvoice} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine transition-all flex items-center justify-center gap-1.5">
              <Printer size={11} /> Invoice &amp; receipts
            </button>
          )}
        </div>
      </InfoCard>

      <InfoCard icon={UserIcon} title={`${pet.name} — Patient & Owner`}
        summary={`${pet.breed} ${pet.species}${client ? ` · ${client.name}` : ''}`}>
        <div className="space-y-1.5">
          <InfoRow label="Species / breed" value={`${pet.species} · ${pet.breed}`} />
          <InfoRow label="Gender" value={`${pet.gender}${pet.isNeutered ? ' · Neutered' : ''}`} />
          <InfoRow label="Age" value={pet.age ? `${pet.age} yrs` : undefined} />
          <InfoRow label="Weight" value={pet.weight} />
          <InfoRow label="Microchip" value={pet.rfidChipNumber} />
          <InfoRow label="Colour" value={pet.color || undefined} />
          {((petSnapshot?.pet?.allergies || []).length > 0 || (petSnapshot?.pet?.chronicConditions || []).length > 0) && (
            <div className="flex flex-wrap gap-1 pt-1">
              {(petSnapshot?.pet?.allergies || []).map((a: string) => (
                <span key={`al-${a}`} className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[8px] font-black uppercase tracking-wider">⚠ {a}</span>
              ))}
              {(petSnapshot?.pet?.chronicConditions || []).map((c: string) => (
                <span key={`cc-${c}`} className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase tracking-wider">{c}</span>
              ))}
            </div>
          )}
          {client && (
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 mt-1.5 space-y-1.5">
              <InfoRow label="Owner" value={client.name} />
              <InfoRow label="Phone" value={client.phone} />
              <InfoRow label="Email" value={client.email} />
            </div>
          )}
          <div className="flex gap-1.5 pt-1.5">
            {onNavigateToPet && (
              <button onClick={() => onNavigateToPet(pet.id)} className="flex-1 px-2 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">Pet profile</button>
            )}
            {onNavigateToClient && client && (
              <button onClick={() => onNavigateToClient(client.id)} className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:text-pine dark:hover:text-zinc-100 transition-all">Owner profile</button>
            )}
          </div>
        </div>
      </InfoCard>

      <InfoCard icon={Smile} title="Behaviour"
        summary={behaviour.length ? behaviour.slice(0, 3).join(', ') + (behaviour.length > 3 ? '…' : '') : 'No traits recorded'}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {[...BEHAVIOUR_TRAITS, ...behaviour.filter(b => !BEHAVIOUR_TRAITS.includes(b))].map(t => {
              const on = behaviour.includes(t);
              const risky = ['Aggressive', 'May bite'].includes(t);
              return (
                <button key={t} type="button" onClick={() => toggleTrait(t)}
                  className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${on
                    ? (risky ? 'bg-rose-600 text-white border-rose-600' : 'bg-seafoam text-white border-seafoam')
                    : 'bg-slate-50 dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'}`}>
                  {t}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <input className="field-input !h-7 text-[11px] flex-1" placeholder="Add a trait…" value={behaviourDraft}
              onChange={e => setBehaviourDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && behaviourDraft.trim()) { setBehaviourPersist([...behaviour, behaviourDraft.trim()]); setBehaviourDraft(''); } }} />
            <button type="button" onClick={() => { if (behaviourDraft.trim()) { setBehaviourPersist([...behaviour, behaviourDraft.trim()]); setBehaviourDraft(''); } }}
              className="px-2.5 h-7 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shrink-0">Add</button>
          </div>
          <p className="text-[8px] font-bold text-slate-400">Saved on this device — moves to the pet record in the API phase.</p>
        </div>
      </InfoCard>

      <InfoCard icon={Stethoscope} title="Clinical Snapshot"
        summary={`${past.length} past visit${past.length === 1 ? '' : 's'} · ${vaccinesGiven} vaccine${vaccinesGiven === 1 ? '' : 's'} given`}>
        <div className="space-y-1.5">
          <InfoRow label="Past visits" value={String(past.length)} />
          {lastVisit && <InfoRow label="Last visit" value={`${formatDate(lastVisit.date)} — ${(lastVisit.tasks || []).slice(0, 2).map(t => t.name).join(', ') || lastVisit.visitType || ''}`} />}
          {(petSnapshot?.currentMedications || []).length > 0 && <InfoRow label="Current meds" value={(petSnapshot.currentMedications as string[]).join(', ')} />}
          {visitReminder && <InfoRow label="Reminder due" value={formatDate(visitReminder.dueAt)} />}
          {vaccineHistory.length > 0 && (
            <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 mt-1.5 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Vaccines given</p>
              {vaccineHistory.slice(0, 6).map((v, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-bold text-pine dark:text-zinc-100">💉 {v.name}</span>
                  <span className="text-[9px] font-bold text-slate-400">{formatDate(v.date)}</span>
                </div>
              ))}
              {vaccineHistory.length > 6 && <p className="text-[8px] font-bold text-slate-400 text-center">+{vaccineHistory.length - 6} more</p>}
            </div>
          )}
          {dueVaccines.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {dueVaccines.map((v: any) => (
                <span key={v.id} className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase tracking-wider">Due: {v.name}</span>
              ))}
            </div>
          )}
          {lastVisit && onNavigateToVisit && (
            <button onClick={() => onNavigateToVisit(lastVisit.id)} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest hover:text-pine dark:hover:text-zinc-100 transition-all">Open last visit</button>
          )}
          {onBookFollowUp && (
            <button onClick={onBookFollowUp} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-1.5">
              <Calendar size={11} /> Book follow-up appointment
            </button>
          )}
        </div>
      </InfoCard>
    </div>
  );
};

export default PatientRail;

import React from 'react';
import {
  Activity, Stethoscope, CalendarClock, CreditCard, ShieldCheck,
  AlertTriangle, Pill, HeartPulse, UserCog,
} from 'lucide-react';
import { PetSnapshot } from '../../../services/modules/pets.api';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  snapshot: PetSnapshot | null;
  loading?: boolean;
}

// Current-status pill styling.
const STATUS_STYLES: Record<PetSnapshot['currentStatus'], { label: string; cls: string; icon: React.ElementType }> = {
  healthy:        { label: 'Healthy',        cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', icon: HeartPulse },
  under_treatment:{ label: 'Under treatment', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',     icon: Pill },
  hospitalized:   { label: 'Hospitalized',   cls: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',             icon: Activity },
};

const VACCINE_STYLES: Record<PetSnapshot['vaccines']['status'], { label: string; cls: string }> = {
  current: { label: 'Vaccines current', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  due:     { label: 'Vaccines due soon', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  overdue: { label: 'Vaccines overdue',  cls: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  none:    { label: 'No vaccines on record', cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400' },
};

const Fact: React.FC<{ icon: React.ElementType; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-2">
    <Icon size={14} className="text-seafoam shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{label}</p>
      <p className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{children}</p>
    </div>
  </div>
);

const Chips: React.FC<{ items: string[]; cls: string }> = ({ items, cls }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((it, i) => (
      <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{it}</span>
    ))}
  </div>
);

const ClinicalSnapshotPanel: React.FC<Props> = ({ snapshot, loading }) => {
  if (loading && !snapshot) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-lg animate-pulse">
        <div className="h-4 w-40 bg-slate-100 dark:bg-zinc-800 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-slate-100 dark:bg-zinc-800 rounded" />)}
        </div>
      </div>
    );
  }
  if (!snapshot) return null;

  const { pet, owner, currentStatus, attendingVet, lastVisitAt, activeProblem, currentMedications, vaccines, finance } = snapshot;
  const status = STATUS_STYLES[currentStatus];
  const StatusIcon = status.icon;
  const vacc = VACCINE_STYLES[vaccines.status];
  const weightLabel = pet.weight.value != null ? `${pet.weight.value} ${pet.weight.unit ?? ''}`.trim() : '—';
  const descriptor = [pet.gender, pet.breed, pet.age].filter(Boolean).join(' · ');
  const balanceLabel = `${finance.currency} ${finance.outstandingBalance.toLocaleString()}`;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-lg overflow-hidden">
      {/* Header band */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-pine/5 to-seafoam/10 dark:from-zinc-800/40 dark:to-zinc-800/10 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <Stethoscope size={15} className="text-seafoam shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{pet.name}</p>
            {descriptor && <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 truncate">{descriptor}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pet.profileStatus === 'NEEDS_UPDATE' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" title={pet.pendingFields?.length ? `Missing: ${pet.pendingFields.join(', ')}` : 'Profile incomplete'}>
              <AlertTriangle size={11} /> Needs update
            </span>
          )}
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${status.cls}`}>
            <StatusIcon size={11} /> {status.label}
          </span>
        </div>
      </div>

      {/* Key facts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4">
        <Fact icon={CalendarClock} label="Last visit">{lastVisitAt ? formatDate(lastVisitAt) : 'No visits yet'}</Fact>
        <Fact icon={UserCog} label="Attending vet">{attendingVet?.name || '—'}</Fact>
        <Fact icon={Activity} label="Last diagnosis">{activeProblem || '—'}</Fact>
        <Fact icon={HeartPulse} label="Weight">{weightLabel}{pet.weight.trend != null ? ` (${pet.weight.trend > 0 ? '↑' : '↓'}${Math.abs(pet.weight.trend)})` : ''}</Fact>
      </div>

      {/* Status rows */}
      <div className="px-5 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${vacc.cls}`}>
            <ShieldCheck size={12} /> {vacc.label}
          </span>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
            finance.overCreditLimit
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              : finance.outstandingBalance > 0
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          }`}>
            <CreditCard size={12} /> Balance: {balanceLabel}{finance.overCreditLimit ? ' · over limit' : ''}
          </span>
        </div>

        {currentMedications.length > 0 && (
          <div className="flex items-start gap-2">
            <Pill size={13} className="text-seafoam shrink-0 mt-1" />
            <Chips items={currentMedications} cls="bg-seafoam/10 text-seafoam" />
          </div>
        )}
        {pet.allergies.length > 0 && (
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="text-red-500 shrink-0 mt-1" />
            <Chips items={pet.allergies} cls="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" />
          </div>
        )}
        {pet.chronicConditions.length > 0 && (
          <div className="flex items-start gap-2">
            <Activity size={13} className="text-amber-500 shrink-0 mt-1" />
            <Chips items={pet.chronicConditions} cls="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicalSnapshotPanel;

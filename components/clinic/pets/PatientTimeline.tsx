import React from 'react';
import { Stethoscope, Syringe, FileText, Scissors, Home, ShoppingBag, Clock } from 'lucide-react';
import { PetTimelineEntry } from '../../../services/modules/pets.api';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  entries: PetTimelineEntry[];
  loading?: boolean;
}

const prettify = (s?: string | null) =>
  (s || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

const ENCOUNTER_ICON: Record<string, React.ElementType> = {
  VET_VISIT: Stethoscope,
  GROOMING: Scissors,
  BOARDING: Home,
  RETAIL: ShoppingBag,
  VACCINATION: Syringe,
};

// Visual identity for each timeline entry.
const describe = (e: PetTimelineEntry): { icon: React.ElementType; title: string; subtitle: string | null } => {
  if (e.type === 'vaccination') {
    return { icon: Syringe, title: e.vaccineName || 'Vaccination', subtitle: 'Vaccination' };
  }
  if (e.type === 'record') {
    return { icon: FileText, title: e.diagnosis || 'Medical record', subtitle: 'Record' };
  }
  // visit
  const icon = ENCOUNTER_ICON[e.encounterType || 'VET_VISIT'] || Stethoscope;
  const title = e.diagnosis || prettify(e.visitType) || prettify(e.encounterType) || 'Visit';
  const subtitleBits = [prettify(e.encounterType), e.visitType ? prettify(e.visitType) : null, prettify(e.status)].filter(Boolean);
  return { icon, title, subtitle: subtitleBits.join(' · ') || null };
};

const PatientTimeline: React.FC<Props> = ({ entries, loading }) => {
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 dark:bg-zinc-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <Clock size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
        <p className="text-sm font-bold text-slate-400 dark:text-zinc-500">No history yet</p>
        <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Visits, vaccinations and records will appear here chronologically.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ol className="relative border-l border-slate-200 dark:border-zinc-800 ml-3 space-y-4">
        {entries.map((e) => {
          const { icon: Icon, title, subtitle } = describe(e);
          return (
            <li key={`${e.type}-${e.id}`} className="ml-6">
              <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-seafoam/10 ring-4 ring-white dark:ring-zinc-950">
                <Icon size={12} className="text-seafoam" />
              </span>
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm hover:border-seafoam transition-all">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{title}</p>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 shrink-0">{e.date ? formatDate(e.date) : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1">
                  {subtitle && <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 truncate">{subtitle}</p>}
                  {e.type === 'visit' && e.cost != null && e.cost > 0 && (
                    <span className={`text-[10px] font-black shrink-0 ${e.isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {e.cost.toLocaleString()}{e.isPaid ? ' · paid' : ' · due'}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PatientTimeline;

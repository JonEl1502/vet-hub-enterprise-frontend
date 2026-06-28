import React, { useMemo, useState } from 'react';
import { Stethoscope, Syringe, FileText, Scissors, Home, ShoppingBag, Clock, Bell, CalendarClock, ChevronDown } from 'lucide-react';
import { PetTimelineEntry } from '../../../services/modules/pets.api';
import { REMINDER_SERVICE_META } from '../../../services';
import type { Reminder, Appointment } from '../../../services';
import { Visit } from '../../../types';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  entries: PetTimelineEntry[];
  reminders?: Reminder[];
  bookings?: Appointment[];
  // Visit lookup keyed by visit id (string) — used to surface the category
  // chips and the service list inside a visit timeline card.
  visitsById?: Record<string, Visit>;
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

// A normalised timeline card — every source (visit/vaccination/record/reminder/
// appointment) is mapped onto this shape so they can be merged and sorted.
interface TimelineCard {
  key: string;
  kind: 'visit' | 'vaccination' | 'record' | 'reminder' | 'appointment';
  date: string;
  icon: React.ElementType;
  title: string;
  subtitle: string | null;
  // right-hand status/cost badge
  badge?: { text: string; tone: 'ok' | 'warn' | 'muted' | 'info' } | null;
  // visit-only expandable detail
  categories?: string[];
  services?: string[];
}

const time = (d?: string | null) => (d ? new Date(d).getTime() : 0);

const PatientTimeline: React.FC<Props> = ({ entries, reminders = [], bookings = [], visitsById = {}, loading }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const cards = useMemo<TimelineCard[]>(() => {
    const list: TimelineCard[] = [];

    // Visits / vaccinations / records from the patient-timeline endpoint.
    for (const e of entries) {
      if (e.type === 'vaccination') {
        list.push({ key: `vaccination-${e.id}`, kind: 'vaccination', date: e.date, icon: Syringe, title: e.vaccineName || 'Vaccination', subtitle: 'Vaccination' });
        continue;
      }
      if (e.type === 'record') {
        list.push({ key: `record-${e.id}`, kind: 'record', date: e.date, icon: FileText, title: e.diagnosis || 'Medical record', subtitle: 'Record' });
        continue;
      }
      // visit — enrich with category chips + service list from the matching Visit.
      const icon = ENCOUNTER_ICON[e.encounterType || 'VET_VISIT'] || Stethoscope;
      const title = e.diagnosis || prettify(e.visitType) || prettify(e.encounterType) || 'Visit';
      const subtitle = [prettify(e.encounterType), e.visitType ? prettify(e.visitType) : null, prettify(e.status)].filter(Boolean).join(' · ') || null;
      const visit = visitsById[String(e.id)];
      const categories = visit ? [...new Set(visit.tasks.map(t => t.category).filter(Boolean))] as string[] : [];
      const services = visit ? visit.tasks.map(t => t.name) : [];
      list.push({
        key: `visit-${e.id}`,
        kind: 'visit',
        date: e.date,
        icon,
        title,
        subtitle,
        badge: e.cost != null && e.cost > 0 ? { text: `${e.cost.toLocaleString()}${e.isPaid ? ' · paid' : ' · due'}`, tone: e.isPaid ? 'ok' : 'warn' } : null,
        categories,
        services,
      });
    }

    // Reminders — attached to the timeline by their due date.
    for (const r of reminders) {
      const label = r.title || REMINDER_SERVICE_META[r.serviceType]?.label || 'Reminder';
      list.push({
        key: `reminder-${r.id}`,
        kind: 'reminder',
        date: r.dueAt,
        icon: Bell,
        title: label,
        subtitle: ['Reminder', prettify(r.serviceType), prettify(r.status)].filter(Boolean).join(' · '),
        badge: r.status === 'DONE' ? { text: 'Done', tone: 'ok' } : r.status === 'DISMISSED' ? { text: 'Dismissed', tone: 'muted' } : { text: 'Due', tone: 'warn' },
      });
    }

    // Appointment bookings — attached to the timeline by their scheduled date.
    for (const a of bookings) {
      list.push({
        key: `appointment-${a.id}`,
        kind: 'appointment',
        date: a.scheduledAt,
        icon: CalendarClock,
        title: prettify(a.encounterType) || 'Appointment',
        subtitle: ['Appointment', prettify(a.status)].filter(Boolean).join(' · '),
        badge: a.status === 'CONVERTED' ? { text: 'Converted', tone: 'ok' } : a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? { text: prettify(a.status), tone: 'muted' } : { text: 'Booked', tone: 'info' },
      });
    }

    return list.sort((x, y) => time(y.date) - time(x.date));
  }, [entries, reminders, bookings, visitsById]);

  if (loading && cards.length === 0) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 dark:bg-zinc-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <Clock size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
        <p className="text-sm font-bold text-slate-400 dark:text-zinc-500">No history yet</p>
        <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Visits, vaccinations, records, reminders and appointments will appear here chronologically.</p>
      </div>
    );
  }

  const badgeTone: Record<string, string> = {
    ok: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    info: 'text-cyan',
    muted: 'text-slate-400 dark:text-zinc-500',
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ol className="relative border-l border-slate-200 dark:border-zinc-800 ml-3 space-y-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const hasDetail = c.kind === 'visit' && (c.services?.length || c.categories?.length);
          const isOpen = expanded.has(c.key);
          return (
            <li key={c.key} className="ml-6">
              <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-seafoam/10 ring-4 ring-white dark:ring-zinc-950">
                <Icon size={12} className="text-seafoam" />
              </span>
              <div
                onClick={() => hasDetail && toggle(c.key)}
                className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm hover:border-seafoam transition-all ${hasDetail ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-pine dark:text-zinc-100 truncate flex items-center gap-1.5">
                    {c.title}
                    {hasDetail ? <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} /> : null}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 shrink-0">{c.date ? formatDate(c.date) : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1">
                  {c.subtitle && <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 truncate">{c.subtitle}</p>}
                  {c.badge && <span className={`text-[10px] font-black shrink-0 ${badgeTone[c.badge.tone]}`}>{c.badge.text}</span>}
                </div>

                {/* Category chips — always visible on visit cards. */}
                {c.kind === 'visit' && c.categories && c.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.categories.map(cat => (
                      <span key={cat} className="text-[7px] font-black uppercase bg-seafoam/10 text-seafoam border border-seafoam/20 px-1.5 py-0.5 rounded">{cat}</span>
                    ))}
                  </div>
                )}

                {/* Service list — revealed when the visit card is expanded. */}
                {hasDetail && isOpen && c.services && c.services.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                    {c.services.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-seafoam shrink-0" />
                        <p className="text-[11px] text-slate-700 dark:text-zinc-300">{s}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PatientTimeline;

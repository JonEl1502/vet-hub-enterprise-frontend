import React from 'react';
import { Stethoscope, Scissors, BedDouble, AlertTriangle, Plus, FlaskConical, ChevronRight } from 'lucide-react';
import { Visit, ApptStatus } from '../../../../types';
import { remindersAPI, Reminder } from '../../../../services';
import { formatTime } from '../../../../services/utils/dateFormatter';
import {
  StatRow, RoleCard, EmptyNote, QueueColumn, QueueRow,
  todaysVisits, hasCategory, isToday, useDayTasks, TaskChecklist,
} from './roleShared';

/**
 * VETERINARIAN — the clinical day. Patient queue, schedule, inpatients and the
 * things that need a decision now.
 *
 * Money is deliberately limited to what the vet personally produced; the
 * clinic's finances belong to the owner/manager views.
 */

interface Props {
  visits: Visit[];
  currency: string;
  /** When set, the queue leads with this vet's own patients. */
  vetUserId?: string | number | null;
  onNavigate?: (view: string, params?: any) => void;
}

const TASKS = [
  'Review lab results',
  'Write up surgery notes',
  'Call follow-up clients',
  'Sign off discharge summaries',
  'Update medical records',
];

const VetDashboard: React.FC<Props> = ({ visits, currency, vetUserId, onNavigate }) => {
  const { tasks, done, toggle } = useDayTasks('vet', TASKS);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);

  React.useEffect(() => {
    let alive = true;
    remindersAPI.list({ status: 'PENDING' } as any, { silent: true } as any)
      .then((r: any) => { if (alive && r?.success) setReminders(r.data?.reminders || []); })
      .catch(() => { /* alerts panel just stays light */ });
    return () => { alive = false; };
  }, []);

  const today = todaysVisits(visits);
  // "Mine" when the visit names this vet as lead; otherwise the whole day.
  const mine = vetUserId
    ? today.filter(v => String((v as any).leadStaffId ?? '') === String(vetUserId))
    : today;
  const scope = mine.length > 0 ? mine : today;

  const consultations = scope.filter(v => v.encounterType === 'VET_VISIT' || hasCategory(v, 'consult'));
  const surgeries = scope.filter(v => hasCategory(v, 'surg'));
  const inpatients = scope.filter(v => !!(v as any).hospitalizationId || hasCategory(v, 'inpatient', 'hospital'));
  const followUps = scope.filter(v => !!(v as any).parentAppointmentId || String((v as any).visitType || '').includes('FOLLOW'));
  const waiting = scope.filter(v => v.status === ApptStatus.SCHEDULED);
  const inConsult = scope.filter(v => v.status === ApptStatus.IN_PROGRESS);
  const finished = scope.filter(v => v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT);
  const revenue = finished.reduce((s, v) => s + Number(v.totalCost || 0), 0);

  const dueReminders = reminders.filter(r => isToday((r as any).dueAt) ||
    (!!(r as any).dueAt && new Date((r as any).dueAt).getTime() < Date.now()));

  const open = (v: Visit) => onNavigate?.('appointment-detail', { appointmentId: Number(v.id) });
  const nameOf = (v: Visit) => (v as any).petName || `Visit #${v.id}`;

  return (
    <div className="space-y-4">
      <StatRow stats={[
        { label: "Today's visits", value: scope.length, sub: vetUserId && mine.length ? 'Assigned to you' : 'Clinic-wide' },
        { label: 'Consultations', value: consultations.length, sub: `${inConsult.length} in progress` },
        { label: 'Surgeries', value: surgeries.length, tone: surgeries.length ? 'warn' : 'default', sub: 'Today' },
        { label: 'Follow-ups', value: followUps.length, sub: 'Scheduled' },
        { label: 'Inpatients', value: inpatients.length, tone: inpatients.length ? 'warn' : 'default', sub: 'Under care' },
        { label: 'Produced today', value: `${currency} ${Math.round(revenue).toLocaleString()}`, tone: 'good', sub: `${finished.length} completed` },
      ]} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <RoleCard
          title="Patient queue" subtitle="Who is waiting, and who you are with" className="xl:col-span-2"
          action={<button onClick={() => onNavigate?.('appointments')} className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:underline">All visits</button>}
        >
          {scope.length === 0 ? <EmptyNote>Nothing booked today</EmptyNote> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QueueColumn title="Waiting" count={waiting.length} tone="slate">
                {waiting.length === 0
                  ? <p className="text-[10px] font-bold text-slate-300 dark:text-zinc-700 px-1">—</p>
                  : waiting.map(v => (
                    <QueueRow key={v.id} name={nameOf(v)} onClick={() => open(v)}
                      meta={[formatTime(v.date), (v as any).petSpecies].filter(Boolean).join(' · ')} />
                  ))}
              </QueueColumn>
              <QueueColumn title="In consultation" count={inConsult.length} tone="amber">
                {inConsult.length === 0
                  ? <p className="text-[10px] font-bold text-slate-300 dark:text-zinc-700 px-1">—</p>
                  : inConsult.map(v => (
                    <QueueRow key={v.id} name={nameOf(v)} onClick={() => open(v)}
                      meta={`Started ${formatTime(v.date)}`} />
                  ))}
              </QueueColumn>
              <QueueColumn title="Completed" count={finished.length} tone="emerald">
                {finished.length === 0
                  ? <p className="text-[10px] font-bold text-slate-300 dark:text-zinc-700 px-1">—</p>
                  : finished.map(v => (
                    <QueueRow key={v.id} name={nameOf(v)} onClick={() => open(v)}
                      meta={formatTime(v.date)}
                      right={<span className="shrink-0 text-[10px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                        {Math.round(Number(v.totalCost || 0)).toLocaleString()}
                      </span>} />
                  ))}
              </QueueColumn>
            </div>
          )}
        </RoleCard>

        <RoleCard title="Clinical alerts" subtitle="Needs a decision">
          {inpatients.length === 0 && surgeries.length === 0 && dueReminders.length === 0 ? (
            <EmptyNote>Nothing to flag</EmptyNote>
          ) : (
            <div className="space-y-1.5">
              {inpatients.slice(0, 3).map(v => (
                <button key={`ip-${v.id}`} type="button" onClick={() => open(v)}
                  className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-400 transition-all text-left">
                  <BedDouble size={13} className="text-rose-500 shrink-0 mt-0.5" />
                  <span className="min-w-0 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                    <b className="text-pine dark:text-zinc-100">{nameOf(v)}</b> is admitted — review chart and medications.
                  </span>
                </button>
              ))}
              {surgeries.slice(0, 2).map(v => (
                <button key={`sx-${v.id}`} type="button" onClick={() => open(v)}
                  className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400 transition-all text-left">
                  <Scissors size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="min-w-0 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                    Surgery today — <b className="text-pine dark:text-zinc-100">{nameOf(v)}</b>.
                  </span>
                </button>
              ))}
              {dueReminders.length > 0 && (
                <button type="button" onClick={() => onNavigate?.('reminders')}
                  className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-seafoam transition-all text-left">
                  <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="min-w-0 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                    <b className="text-pine dark:text-zinc-100">{dueReminders.length}</b> reminder{dueReminders.length === 1 ? '' : 's'} due or overdue.
                  </span>
                </button>
              )}
            </div>
          )}
        </RoleCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <RoleCard title="Today's schedule" subtitle="In time order" className="xl:col-span-2">
          {scope.length === 0 ? <EmptyNote>Nothing booked</EmptyNote> : (
            <div className="space-y-1.5">
              {[...scope].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 8).map(v => (
                <button key={v.id} type="button" onClick={() => open(v)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-seafoam transition-all text-left">
                  <span className="shrink-0 w-16 text-[10px] font-black tabular-nums text-slate-400">{formatTime(v.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{nameOf(v)}</span>
                    <span className="block text-[9px] font-bold text-slate-400 truncate">
                      {String(v.encounterType || 'VET_VISIT').replace('_', ' ').toLowerCase()}
                    </span>
                  </span>
                  <ChevronRight size={13} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </RoleCard>

        <div className="space-y-4">
          <RoleCard title="Quick actions">
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'New consultation', icon: Stethoscope, to: 'new-appointment' },
                { label: 'Diagnostics', icon: FlaskConical, to: 'diagnostics' },
                { label: 'Add medical record', icon: Plus, to: 'appointments' },
              ].map(a => (
                <button key={a.label} type="button" onClick={() => onNavigate?.(a.to)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:bg-seafoam/5 transition-all text-left">
                  <a.icon size={13} className="text-seafoam shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{a.label}</span>
                </button>
              ))}
            </div>
          </RoleCard>
          <RoleCard title="Today's tasks" subtitle="Resets each day">
            <TaskChecklist tasks={tasks} done={done} onToggle={toggle} />
          </RoleCard>
        </div>
      </div>
    </div>
  );
};

export default VetDashboard;

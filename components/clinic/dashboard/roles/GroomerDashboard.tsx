import React from 'react';
import { Scissors, ChevronRight } from 'lucide-react';
import { Visit, ApptStatus } from '../../../../types';
import { formatTime } from '../../../../services/utils/dateFormatter';
import {
  StatRow, RoleCard, EmptyNote, QueueColumn, QueueRow, GoalBar,
  todaysVisits, hasCategory, useDayTasks, TaskChecklist,
} from './roleShared';

/**
 * GROOMER — one job, one queue. Deliberately the narrowest of the three:
 * a groomer needs the day's bookings and their order, not clinic finances.
 * The only money shown is the grooming revenue they themselves produced.
 */

interface Props {
  visits: Visit[];
  currency: string;
  /** Daily grooming target; falsy hides the goal bar rather than inventing one. */
  goal?: number;
  onNavigate?: (view: string, params?: any) => void;
}

const TASKS = [
  'Prepare the grooming area',
  'Check and oil clippers',
  'Sanitise after each pet',
  'Update client photos',
  'End-of-day clean down',
];

const isGrooming = (v: Visit) => v.encounterType === 'GROOMING' || hasCategory(v, 'groom');

const GroomerDashboard: React.FC<Props> = ({ visits, currency, goal = 0, onNavigate }) => {
  const { tasks, done, toggle } = useDayTasks('groomer', TASKS);

  const all = todaysVisits(visits, true).filter(isGrooming);
  const cancelled = all.filter(v => v.status === ApptStatus.CANCELLED);
  const live = all.filter(v => v.status !== ApptStatus.CANCELLED);
  const waiting = live.filter(v => v.status === ApptStatus.SCHEDULED);
  const inProgress = live.filter(v => v.status === ApptStatus.IN_PROGRESS);
  const completed = live.filter(v =>
    v.status === ApptStatus.COMPLETED || v.status === ApptStatus.PENDING_PAYMENT);
  const revenue = completed.reduce((s, v) => s + Number(v.totalCost || 0), 0);

  const open = (v: Visit) => onNavigate?.('appointment-detail', { appointmentId: Number(v.id) });
  const nameOf = (v: Visit) => (v as any).petName || `Visit #${v.id}`;
  const metaOf = (v: Visit) => [formatTime(v.date), (v as any).petBreed].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <StatRow stats={[
        { label: "Today's bookings", value: live.length, sub: `${waiting.length} still to start` },
        { label: 'In progress', value: inProgress.length, tone: inProgress.length ? 'warn' : 'default', sub: 'Currently grooming' },
        { label: 'Completed', value: completed.length, tone: 'good', sub: 'Finished today' },
        { label: 'Cancelled', value: cancelled.length, tone: cancelled.length ? 'bad' : 'default', sub: 'Today' },
        { label: 'Grooming revenue', value: `${currency} ${Math.round(revenue).toLocaleString()}`, tone: 'good', sub: 'From completed grooms' },
        { label: 'Waiting', value: waiting.length, sub: 'Not started yet' },
      ]} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <RoleCard
          title="Grooming queue" subtitle="Today, in booking order" className="xl:col-span-2"
          action={<button onClick={() => onNavigate?.('grooming')} className="text-[9px] font-black uppercase tracking-widest text-seafoam hover:underline">Grooming page</button>}
        >
          {live.length === 0 ? <EmptyNote>No grooms booked today</EmptyNote> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QueueColumn title="Waiting" count={waiting.length} tone="slate">
                {waiting.length === 0
                  ? <p className="text-[10px] font-bold text-slate-300 dark:text-zinc-700 px-1">—</p>
                  : waiting.map(v => <QueueRow key={v.id} name={nameOf(v)} meta={metaOf(v)} onClick={() => open(v)} />)}
              </QueueColumn>
              <QueueColumn title="In progress" count={inProgress.length} tone="amber">
                {inProgress.length === 0
                  ? <p className="text-[10px] font-bold text-slate-300 dark:text-zinc-700 px-1">—</p>
                  : inProgress.map(v => <QueueRow key={v.id} name={nameOf(v)} meta={metaOf(v)} onClick={() => open(v)} />)}
              </QueueColumn>
              <QueueColumn title="Completed" count={completed.length} tone="emerald">
                {completed.length === 0
                  ? <p className="text-[10px] font-bold text-slate-300 dark:text-zinc-700 px-1">—</p>
                  : completed.map(v => (
                    <QueueRow
                      key={v.id} name={nameOf(v)} meta={metaOf(v)} onClick={() => open(v)}
                      right={<span className="shrink-0 text-[10px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                        {Math.round(Number(v.totalCost || 0)).toLocaleString()}
                      </span>}
                    />
                  ))}
              </QueueColumn>
            </div>
          )}
        </RoleCard>

        <div className="space-y-4">
          <RoleCard title="Today's revenue" subtitle="Grooming only">
            <GoalBar value={revenue} goal={goal} currency={currency} />
          </RoleCard>
          <RoleCard title="Today's tasks" subtitle="Resets each day">
            <TaskChecklist tasks={tasks} done={done} onToggle={toggle} />
          </RoleCard>
        </div>
      </div>

      {inProgress.length > 0 && (
        <RoleCard title="On the table now" subtitle="Finish these before starting another">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {inProgress.map(v => (
              <button key={v.id} type="button" onClick={() => open(v)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-400 transition-all text-left">
                <Scissors size={14} className="text-amber-500 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{nameOf(v)}</span>
                  <span className="block text-[9px] font-bold text-slate-400 truncate">Started {formatTime(v.date)}</span>
                </span>
                <ChevronRight size={13} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </RoleCard>
      )}
    </div>
  );
};

export default GroomerDashboard;

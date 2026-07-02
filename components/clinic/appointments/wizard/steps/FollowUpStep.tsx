import React from 'react';
import { CalendarClock, Bell, HeartPulse, ClipboardCheck } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid, ListEditor } from '../fields';

const OUTCOME = ['Recovered', 'Improved', 'Stable', 'Guarded', 'Deteriorated'];
const CLOSE_OUTCOME = ['Recovered', 'Improved', 'Stable', 'Hospitalised', 'Referred', 'Lost to follow up', 'Euthanised'];

const MONITORING = [
  { k: 'appetite', label: 'Appetite' }, { k: 'waterIntake', label: 'Water intake' },
  { k: 'urination', label: 'Urination' }, { k: 'defecation', label: 'Defecation' },
  { k: 'vomiting', label: 'Vomiting' }, { k: 'activity', label: 'Activity level' },
  { k: 'weight', label: 'Weight' }, { k: 'temperature', label: 'Temperature' },
];

interface ReminderRow { title: string; dueDate: string; assignTo: string }

// UI-ONLY phase: reminders staged here are local; the real Reminder flow
// (FinalizeReminderGate → reminders API) still runs at visit finalize.

const FollowUpStep: React.FC<StepProps> = ({ data, setData, staff, emit }) => {
  const d = data || {};
  const reminders: ReminderRow[] = d.reminders || [];
  const [draft, setDraft] = React.useState<ReminderRow>({ title: '', dueDate: '', assignTo: '' });

  const addReminder = () => {
    if (!draft.title.trim() || !draft.dueDate) return;
    setData({ reminders: [...reminders, draft] });
    emit(`Reminder staged — ${draft.title} (due ${draft.dueDate})`, 'action', true);
    setDraft({ title: '', dueDate: '', assignTo: '' });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={HeartPulse} title="Current Outcome">
          <L label="Outcome at end of consultation">
            <Seg options={OUTCOME} value={d.currentOutcome} onChange={v => setData({ currentOutcome: v })} />
          </L>
          <L label="Outcome when visit is closed">
            <Seg options={CLOSE_OUTCOME} value={d.closeOutcome} onChange={v => { setData({ closeOutcome: v }); emit(`Visit outcome — ${v.toLowerCase()}`, 'milestone', true); }} />
          </L>
          <L label="Outcome notes">
            <textarea className="field-textarea" rows={2} placeholder="Notes on outcome…" value={d.outcomeNotes ?? ''} onChange={e => setData({ outcomeNotes: e.target.value })} />
          </L>
        </Section>

        <Section icon={CalendarClock} title="Next Visit">
          <div className="grid grid-cols-2 gap-3">
            <L label="Date"><input className="field-input" type="date" value={d.nextDate ?? ''}
              onChange={e => setData({ nextDate: e.target.value })}
              onBlur={e => e.target.value && emit(`Review visit scheduled — ${e.target.value}`, 'milestone', true)} /></L>
            <L label="Time"><input className="field-input" type="time" value={d.nextTime ?? ''} onChange={e => setData({ nextTime: e.target.value })} /></L>
          </div>
          <L label="Veterinarian">
            <select className="field-select" value={d.nextVet ?? ''} onChange={e => setData({ nextVet: e.target.value })}>
              <option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </L>
          <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500">
            The follow-up reminder itself is created at finalize (Set reminder on the visit header) — this stages the plan.
          </p>
        </Section>
      </div>

      <Section icon={Bell} title="Reminders & Tasks">
        {reminders.length > 0 && (
          <div className="space-y-1">
            {reminders.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <Bell size={11} className="text-seafoam shrink-0" />
                <span className="flex-1 text-[12px] font-bold text-pine dark:text-zinc-100">{r.title}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">due {r.dueDate}</span>
                {r.assignTo && <span className="text-[9px] font-bold text-slate-400">→ {staff.find(s => String(s.id) === r.assignTo)?.name ?? r.assignTo}</span>}
                <button type="button" onClick={() => setData({ reminders: reminders.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500 text-sm leading-none">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <L label="Reminder" className="md:col-span-2"><input className="field-input" placeholder="e.g. Recheck appointment" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></L>
          <L label="Due date"><input className="field-input" type="date" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></L>
          <div className="flex gap-2">
            <L label="Assign to" className="flex-1">
              <select className="field-select" value={draft.assignTo} onChange={e => setDraft({ ...draft, assignTo: e.target.value })}>
                <option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </L>
            <button type="button" onClick={addReminder} className="h-9 px-3 self-end bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all shrink-0">Add</button>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={ClipboardCheck} title="Care Plan">
          <ListEditor
            items={d.carePlan || []}
            onChange={items => setData({ carePlan: items })}
            placeholder="e.g. Return for recheck in 1 week"
          />
        </Section>
        <Section icon={HeartPulse} title="Home Monitoring Parameters">
          <CheckGrid items={MONITORING} value={d.monitoring} onToggle={(k, _l, on) => setData({ monitoring: { ...(d.monitoring || {}), [k]: on } })} />
        </Section>
      </div>
    </div>
  );
};

export default FollowUpStep;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Loader2, Plus, X, ChevronLeft, ChevronRight, Save, Trash2, Clock } from 'lucide-react';
import { hrAPI, HrRota, HrShiftTemplate, HrPerson } from '../../../services/modules/hr.api';
import {
  Card, Empty, Field, INPUT, BTN_PRIMARY, BTN_GHOST, Pill, Avatar,
  weekStart, addDays, isoDay, today, prettyDate, titleCase,
} from './hrShared';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * HR ▸ Rota — a week of shifts, with approved leave overlaid.
 *
 * The leave overlay is not decoration: the rota alone cannot tell "off" from
 * "not yet rostered", and rostering someone who is on approved leave is the
 * mistake this page exists to prevent. A day cell shows the leave badge in
 * place of an empty slot, and the add form warns before saving over it.
 */
const HrRotaTab: React.FC = () => {
  const [start, setStart] = useState(() => weekStart(today()));
  const [data, setData] = useState<HrRota | null>(null);
  const [templates, setTemplates] = useState<HrShiftTemplate[]>([]);
  const [people, setPeople] = useState<HrPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<{ userId?: string; workDate: string } | null>(null);
  const [managing, setManaging] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const end = days[6];

  const load = useCallback(() => {
    setLoading(true);
    hrAPI.rota(start, end)
      .then(r => setData(r.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [start, end]);
  useEffect(load, [load]);

  const loadRefs = useCallback(() => {
    hrAPI.shiftTemplates(true).then(r => setTemplates(r.data?.templates ?? [])).catch(() => {});
    hrAPI.people().then(r => setPeople(r.data?.people ?? [])).catch(() => {});
  }, []);
  useEffect(loadRefs, [loadRefs]);

  /** userId → workDate → shifts. Built once per load, not per cell. */
  const grid = useMemo(() => {
    const m = new Map<string, Map<string, HrRota['shifts']>>();
    for (const s of data?.shifts ?? []) {
      const d = isoDay(new Date(s.workDate));
      if (!m.has(s.userId)) m.set(s.userId, new Map());
      const row = m.get(s.userId)!;
      row.set(d, [...(row.get(d) ?? []), s]);
    }
    return m;
  }, [data]);

  /** userId → set of dates on approved leave, expanded from the ranges. */
  const leaveDays = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    for (const l of data?.onLeave ?? []) {
      let d = isoDay(new Date(l.startsOn));
      const last = isoDay(new Date(l.endsOn));
      // Guard the walk: a corrupt range must not spin forever.
      for (let i = 0; i < 400 && d <= last; i++) {
        if (!m.has(l.userId)) m.set(l.userId, new Map());
        m.get(l.userId)!.set(d, l.leaveType ?? 'Leave');
        d = addDays(d, 1);
      }
    }
    return m;
  }, [data]);

  // Everyone with a shift or leave this week, plus everyone else after them —
  // a rota that hid the unrostered would hide exactly who still needs a shift.
  const rows = useMemo(() => {
    const active = new Set([...grid.keys(), ...leaveDays.keys()]);
    return [...people].sort((a, b) => {
      const av = active.has(a.userId) ? 0 : 1;
      const bv = active.has(b.userId) ? 0 : 1;
      return av - bv || a.name.localeCompare(b.name);
    });
  }, [people, grid, leaveDays]);

  const removeShift = async (id: string) => {
    await hrAPI.deleteShift(id);
    toast.success('Shift removed');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1">
          <button className={BTN_GHOST} onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={12} /></button>
          <span className="px-2 text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">
            {prettyDate(start, { day: '2-digit', month: 'short' })} — {prettyDate(end, { day: '2-digit', month: 'short' })}
          </span>
          <button className={BTN_GHOST} onClick={() => setStart(addDays(start, 7))}><ChevronRight size={12} /></button>
          <button className={BTN_GHOST} onClick={() => setStart(weekStart(today()))}>This week</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className={BTN_GHOST} onClick={() => setManaging(true)}><Clock size={11} /> Shift types</button>
          <button className={BTN_PRIMARY} onClick={() => setAdding({ workDate: start })}><Plus size={11} /> Add shift</button>
        </div>
      </div>

      {loading ? <div className="py-20 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      : rows.length === 0 ? <Empty icon={CalendarDays} title="No staff to roster" hint="Add staff to this clinic first." />
      : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white dark:bg-zinc-900 text-left px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-zinc-800">
                  Staff
                </th>
                {days.map((d, i) => (
                  <th key={d} className={`px-2 py-2 text-[8px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800 ${
                    d === today() ? 'text-seafoam' : 'text-slate-400'
                  }`}>
                    {DOW[i]} <span className="font-mono">{d.slice(8)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.userId}>
                  <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-2 border-b border-slate-100 dark:border-zinc-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={p.name} url={p.avatarUrl} size={26} />
                      <span className="text-[10px] font-black text-pine dark:text-zinc-100 truncate max-w-[130px]">{p.name}</span>
                    </div>
                  </td>
                  {days.map(d => {
                    const shifts = grid.get(p.userId)?.get(d) ?? [];
                    const leave = leaveDays.get(p.userId)?.get(d);
                    return (
                      <td key={d} className="px-1.5 py-1.5 align-top border-b border-slate-100 dark:border-zinc-800/60">
                        {leave && (
                          <div className="mb-1 px-1.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-center">
                            <p className="text-[8px] font-black uppercase tracking-wider text-violet-500 truncate">{leave}</p>
                          </div>
                        )}
                        {shifts.map(s => (
                          <div key={s.id}
                            className={`group mb-1 px-1.5 py-1 rounded-lg border text-center relative ${
                              s.color ? '' : 'border-seafoam/30 bg-seafoam/10'
                            }`}
                            // A shift type with its own colour paints itself; one
                            // without falls back to the seafoam classes above.
                            style={s.color ? { borderColor: `${s.color}55`, background: `${s.color}18` } : undefined}>
                            <p className="text-[9px] font-black text-pine dark:text-zinc-100 truncate">{s.label || 'Shift'}</p>
                            <p className="text-[8px] font-mono text-slate-500 dark:text-zinc-400">{s.startsAt}–{s.endsAt}</p>
                            <button onClick={() => removeShift(s.id)}
                              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove shift">
                              <X size={9} />
                            </button>
                          </div>
                        ))}
                        {!leave && shifts.length === 0 && (
                          <button onClick={() => setAdding({ userId: p.userId, workDate: d })}
                            className="w-full py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 text-slate-300 dark:text-zinc-700 hover:border-seafoam hover:text-seafoam transition-all"
                            title="Add a shift">
                            <Plus size={11} className="mx-auto" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddShift people={people} templates={templates.filter(t => t.isActive)} preset={adding}
          onLeaveOn={(uid, d) => leaveDays.get(uid)?.get(d) ?? null}
          onClose={() => setAdding(null)}
          onDone={() => { setAdding(null); load(); }} />
      )}
      {managing && (
        <ShiftTypes templates={templates} onClose={() => setManaging(false)}
          onChanged={() => { loadRefs(); load(); }} />
      )}
    </div>
  );
};

const AddShift: React.FC<{
  people: HrPerson[]; templates: HrShiftTemplate[];
  preset: { userId?: string; workDate: string };
  onLeaveOn: (userId: string, day: string) => string | null;
  onClose: () => void; onDone: () => void;
}> = ({ people, templates, preset, onLeaveOn, onClose, onDone }) => {
  const [userId, setUserId] = useState(preset.userId ?? people[0]?.userId ?? '');
  const [workDate, setWorkDate] = useState(preset.workDate);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [custom, setCustom] = useState(templates.length === 0);
  const [startsAt, setStartsAt] = useState('08:00');
  const [endsAt, setEndsAt] = useState('17:00');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const clash = userId ? onLeaveOn(userId, workDate) : null;

  const save = async () => {
    if (!userId) { toast.error('Pick a person'); return; }
    setBusy(true);
    try {
      await hrAPI.createShift({
        userId, workDate,
        ...(custom ? { startsAt, endsAt, label: label || undefined } : { templateId }),
      });
      toast.success('Shift added');
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">Add shift</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Who">
            <select className={INPUT} value={userId} onChange={e => setUserId(e.target.value)}>
              {people.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className={INPUT} value={workDate} onChange={e => setWorkDate(e.target.value)} /></Field>

          {/* Rostering over approved leave is the mistake this page exists to
              catch. Warned, not blocked — a clinic short-handed enough to ask
              may genuinely mean it. */}
          {clash && (
            <p className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              That person is on approved {clash.toLowerCase()} that day. You can still roster them, but check first.
            </p>
          )}

          {templates.length > 0 && (
            <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800">
              {[['Shift type', false], ['Custom times', true]].map(([l, v]) => (
                <button key={String(l)} type="button" onClick={() => setCustom(v as boolean)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${
                    custom === v ? 'bg-seafoam text-white' : 'bg-white dark:bg-zinc-900 text-slate-500'
                  }`}>{l}</button>
              ))}
            </div>
          )}

          {!custom && templates.length > 0 ? (
            <Field label="Shift type">
              <select className={INPUT} value={templateId} onChange={e => setTemplateId(e.target.value)}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.startsAt}–{t.endsAt}</option>)}
              </select>
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts"><input type="time" className={INPUT} value={startsAt} onChange={e => setStartsAt(e.target.value)} /></Field>
                <Field label="Ends"><input type="time" className={INPUT} value={endsAt} onChange={e => setEndsAt(e.target.value)} /></Field>
              </div>
              <Field label="Label (optional)"><input className={INPUT} value={label} onChange={e => setLabel(e.target.value)} placeholder="Cover, on-call…" /></Field>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add
          </button>
        </div>
      </div>
    </div>
  );
};

const ShiftTypes: React.FC<{ templates: HrShiftTemplate[]; onClose: () => void; onChanged: () => void }> = ({ templates, onClose, onChanged }) => {
  const [editing, setEditing] = useState<HrShiftTemplate | 'new' | null>(null);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const begin = (t: HrShiftTemplate | 'new') => {
    setEditing(t);
    setF(t === 'new' ? { name: '', startsAt: '08:00', endsAt: '17:00', breakMinutes: 0, spansMidnight: false, isActive: true } : { ...t });
  };

  const save = async () => {
    if (!String(f?.name || '').trim()) { toast.error('Give the shift a name'); return; }
    setBusy(true);
    try {
      const res = editing && editing !== 'new'
        ? await hrAPI.updateShiftTemplate(editing.id, f)
        : await hrAPI.createShiftTemplate(f);
      if (res.data?.template) { toast.success('Saved'); setEditing(null); onChanged(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">Shift types</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {templates.length === 0 && !editing && (
            <p className="text-[10px] font-bold text-slate-400">
              Named patterns you roster with — Early, Late, Night. Shifts copy their times, so editing one later
              will not rewrite rotas already published.
            </p>
          )}
          {templates.map(t => (
            <div key={t.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 ${t.isActive ? '' : 'opacity-60'}`}>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{t.name}</p>
                <p className="text-[9px] font-mono text-slate-400">
                  {t.startsAt}–{t.endsAt}{t.spansMidnight ? ' (+1d)' : ''}{t.breakMinutes ? ` · ${t.breakMinutes}m break` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {!t.isActive && <Pill>Hidden</Pill>}
                <button className={BTN_GHOST} onClick={() => begin(t)}>Edit</button>
                {t.isActive && (
                  <button className={`${BTN_GHOST} !text-rose-500`}
                    onClick={async () => { await hrAPI.deactivateShiftTemplate(t.id); toast.success('Hidden'); onChanged(); }}>
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {editing && f && (
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-3">
              <Field label="Name"><input className={INPUT} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Early" /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Starts"><input type="time" className={INPUT} value={f.startsAt} onChange={e => setF({ ...f, startsAt: e.target.value })} /></Field>
                <Field label="Ends"><input type="time" className={INPUT} value={f.endsAt} onChange={e => setF({ ...f, endsAt: e.target.value })} /></Field>
                <Field label="Break (min)"><input type="number" min={0} className={INPUT} value={f.breakMinutes} onChange={e => setF({ ...f, breakMinutes: Number(e.target.value) })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                <input type="checkbox" checked={!!f.spansMidnight} onChange={e => setF({ ...f, spansMidnight: e.target.checked })} />
                Runs past midnight
              </label>
              <div className="flex justify-end gap-2">
                <button className={BTN_GHOST} onClick={() => setEditing(null)}>Cancel</button>
                <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                </button>
              </div>
            </div>
          )}
        </div>
        {!editing && (
          <div className="flex justify-end px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
            <button className={BTN_PRIMARY} onClick={() => begin('new')}><Plus size={11} /> New shift type</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HrRotaTab;

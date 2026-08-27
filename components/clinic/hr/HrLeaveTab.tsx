import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarOff, Loader2, Plus, Check, X, Settings2, Trash2, Save } from 'lucide-react';
import {
  hrAPI, HrLeaveRequest, HrLeaveType, HrBalanceRow, HrPerson,
} from '../../../services/modules/hr.api';
import {
  Card, Empty, Field, INPUT, BTN_PRIMARY, BTN_GHOST, Pill, PersonChip,
  LEAVE_TONE, titleCase, prettyDate, today,
} from './hrShared';

type Pane = 'requests' | 'balances' | 'policy';

/**
 * HR ▸ Leave — requests to decide, balances, and the clinic's own policy.
 *
 * Requests default to PENDING because that is the only pane with work in it;
 * the rest is reference. Balances show `remaining` with pending already
 * subtracted, so a manager approving two overlapping requests cannot spend the
 * same days twice.
 */
const HrLeaveTab: React.FC = () => {
  const [pane, setPane] = useState<Pane>('requests');
  const [types, setTypes] = useState<HrLeaveType[]>([]);
  const [people, setPeople] = useState<HrPerson[]>([]);
  const [asking, setAsking] = useState(false);
  const [reload, setReload] = useState(0);

  const loadRefs = useCallback(() => {
    hrAPI.leaveTypes(true).then(r => setTypes(r.data?.types ?? [])).catch(() => {});
    hrAPI.people().then(r => setPeople(r.data?.people ?? [])).catch(() => {});
  }, []);
  useEffect(loadRefs, [loadRefs, reload]);

  const activeTypes = types.filter(t => t.isActive);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800">
          {(['requests', 'balances', 'policy'] as Pane[]).map(p => (
            <button key={p} type="button" onClick={() => setPane(p)}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                pane === p ? 'bg-seafoam text-white' : 'bg-white dark:bg-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}>
              {titleCase(p)}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button className={BTN_PRIMARY} onClick={() => setAsking(true)} disabled={activeTypes.length === 0}
            title={activeTypes.length === 0 ? 'Add a leave type under Policy first' : undefined}>
            <Plus size={11} /> Book leave
          </button>
        </div>
      </div>

      {pane === 'requests' && <Requests key={reload} onChanged={() => setReload(n => n + 1)} />}
      {pane === 'balances' && <Balances key={reload} />}
      {pane === 'policy' && <Policy types={types} onChanged={() => setReload(n => n + 1)} />}

      {asking && (
        <BookLeave types={activeTypes} people={people}
          onClose={() => setAsking(false)}
          onDone={() => { setAsking(false); setReload(n => n + 1); }} />
      )}
    </div>
  );
};

// ── Requests ────────────────────────────────────────────────────────────────
const Requests: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState<HrLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    hrAPI.leave(status === 'ALL' ? {} : { status })
      .then(r => setRows(r.data?.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);

  const decide = async (id: string, decision: 'APPROVED' | 'DECLINED' | 'CANCELLED') => {
    setBusyId(id);
    try {
      await hrAPI.decideLeave(id, decision);
      toast.success(`Leave ${decision.toLowerCase()}`);
      load(); onChanged();
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <select value={status} onChange={e => setStatus(e.target.value)} className={`${INPUT} max-w-[180px]`}>
        {['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED', 'ALL'].map(s => <option key={s} value={s}>{titleCase(s)}</option>)}
      </select>

      {loading ? <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      : rows.length === 0 ? (
        <Empty icon={CalendarOff} title={status === 'PENDING' ? 'Nothing waiting' : 'No requests'}
          hint={status === 'PENDING' ? 'Every request has been decided.' : undefined} />
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <Card key={r.id} className="p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <PersonChip name={r.name} url={r.avatarUrl}
                  sub={`${r.leaveType ?? 'Leave'}${r.isPaid ? '' : ' · unpaid'}`} />
                <div className="flex items-center gap-2">
                  <Pill tone={LEAVE_TONE[r.status]}>{titleCase(r.status)}</Pill>
                  {r.status === 'PENDING' && (
                    <>
                      <button className={`${BTN_GHOST} !text-emerald-600`} disabled={busyId === r.id}
                        onClick={() => decide(r.id, 'APPROVED')}>
                        {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                      </button>
                      <button className={`${BTN_GHOST} !text-rose-500`} disabled={busyId === r.id}
                        onClick={() => decide(r.id, 'DECLINED')}>
                        <X size={11} /> Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="text-[10px] font-black text-pine dark:text-zinc-100">
                  {prettyDate(r.startsOn)} → {prettyDate(r.endsOn)}
                  <span className="ml-2 text-slate-400">{r.days} day{r.days === 1 ? '' : 's'}{r.halfDay ? ' (half)' : ''}</span>
                </p>
                {r.decidedByName && (
                  <p className="text-[9px] font-bold text-slate-400">
                    {titleCase(r.status)} by {r.decidedByName} · {prettyDate(r.decidedAt)}
                  </p>
                )}
              </div>
              {r.reason && <p className="mt-1 text-[10px] italic text-slate-500 dark:text-zinc-400">“{r.reason}”</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Balances ────────────────────────────────────────────────────────────────
const Balances: React.FC = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<HrBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    hrAPI.balances(year)
      .then(r => setRows(r.data?.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  const years = [year - 1, year, year + 1];

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <select value={year} onChange={e => setYear(Number(e.target.value))} className={`${INPUT} max-w-[120px]`}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {rows.length === 0 ? <Empty icon={CalendarOff} title="No staff" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800">
                <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Staff</th>
                <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Type</th>
                {['Entitled', 'Carried', 'Taken', 'Pending', 'Left'].map(h => (
                  <th key={h} className="text-right px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.flatMap(p => p.balances.map((b, i) => (
                <tr key={`${p.userId}-${b.leaveTypeId}`} className="border-b border-slate-100 dark:border-zinc-800/60">
                  <td className="px-3 py-2">{i === 0 && <PersonChip name={p.name} url={p.avatarUrl} />}</td>
                  <td className="px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                    {b.leaveType}{b.isPaid ? '' : ' · unpaid'}
                  </td>
                  <td className="px-3 py-2 text-right text-[10px] font-black font-mono text-pine dark:text-zinc-100">{b.entitled}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-mono text-slate-400">{b.carried || '—'}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-mono text-slate-500">{b.taken || '—'}</td>
                  <td className="px-3 py-2 text-right text-[10px] font-mono text-amber-600">{b.pending || '—'}</td>
                  <td className={`px-3 py-2 text-right text-[10px] font-black font-mono ${b.remaining <= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {b.remaining}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
          <p className="mt-2 text-[9px] font-bold text-slate-400">
            “Left” already has pending requests subtracted — so the same days cannot be booked twice while the first sits undecided.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Policy ──────────────────────────────────────────────────────────────────
const Policy: React.FC<{ types: HrLeaveType[]; onChanged: () => void }> = ({ types, onChanged }) => {
  const [editing, setEditing] = useState<HrLeaveType | 'new' | null>(null);

  const deactivate = async (t: HrLeaveType) => {
    await hrAPI.deactivateLeaveType(t.id);
    toast.success(`${t.name} hidden — existing leave keeps its history`);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className={BTN_PRIMARY} onClick={() => setEditing('new')}><Plus size={11} /> Leave type</button>
      </div>

      {types.length === 0 ? (
        <Empty icon={Settings2} title="No leave types yet"
          hint="Add the kinds of leave this clinic gives — annual, sick, compassionate — and how many days each carries."
          action={<button className={BTN_PRIMARY} onClick={() => setEditing('new')}><Plus size={11} /> Add the first</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {types.map(t => (
            <Card key={t.id} className={`p-3.5 ${t.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{t.name}</p>
                  <p className="text-[9px] font-bold text-slate-400">
                    {t.daysPerYear} days/yr{t.carryOverMax > 0 ? ` · carry ${t.carryOverMax}` : ''}
                  </p>
                </div>
                <Pill tone={t.isActive ? (t.isPaid ? 'emerald' : 'slate') : 'slate'}>
                  {t.isActive ? (t.isPaid ? 'Paid' : 'Unpaid') : 'Hidden'}
                </Pill>
              </div>
              <div className="mt-3 flex justify-end gap-1.5">
                <button className={BTN_GHOST} onClick={() => setEditing(t)}>Edit</button>
                {t.isActive && (
                  <button className={`${BTN_GHOST} !text-rose-500`} onClick={() => deactivate(t)} title="Hide from pickers — history is kept">
                    <Trash2 size={10} /> Hide
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <LeaveTypeModal type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); onChanged(); }} />
      )}
    </div>
  );
};

const LeaveTypeModal: React.FC<{ type: HrLeaveType | null; onClose: () => void; onDone: () => void }> = ({ type, onClose, onDone }) => {
  const [f, setF] = useState<any>(type ?? { name: '', daysPerYear: 21, isPaid: true, carryOverMax: 0, isActive: true });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!String(f.name || '').trim()) { toast.error('Give the leave type a name'); return; }
    setBusy(true);
    try {
      const res = type ? await hrAPI.updateLeaveType(type.id, f) : await hrAPI.createLeaveType(f);
      if (res.data?.type) { toast.success('Saved'); onDone(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">{type ? 'Edit leave type' : 'New leave type'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Name"><input className={INPUT} value={f.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Annual leave" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Days per year">
              <input type="number" min={0} step="0.5" className={INPUT} value={f.daysPerYear ?? 0} onChange={e => set('daysPerYear', Number(e.target.value))} />
            </Field>
            <Field label="Max carried over">
              <input type="number" min={0} step="0.5" className={INPUT} value={f.carryOverMax ?? 0} onChange={e => set('carryOverMax', Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
            <input type="checkbox" checked={f.isPaid !== false} onChange={e => set('isPaid', e.target.checked)} />
            Paid leave
          </label>
          {/* Unpaid leave has no entitlement to run out of, so the balance
              check is skipped for it server-side. Say so where it is chosen. */}
          {f.isPaid === false && (
            <p className="text-[9px] font-bold text-slate-400">
              Unpaid leave is not checked against a balance — it can always be booked.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Book ────────────────────────────────────────────────────────────────────
const BookLeave: React.FC<{ types: HrLeaveType[]; people: HrPerson[]; onClose: () => void; onDone: () => void }> =
  ({ types, people, onClose, onDone }) => {
    const [userId, setUserId] = useState(people[0]?.userId ?? '');
    const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? '');
    const [startsOn, setStartsOn] = useState(today());
    const [endsOn, setEndsOn] = useState(today());
    const [halfDay, setHalfDay] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    // A half day is a single date by definition — keep the two ends together
    // rather than letting the server reject it after the fact.
    const setStart = (v: string) => { setStartsOn(v); if (halfDay || v > endsOn) setEndsOn(v); };

    const save = async () => {
      if (!userId || !leaveTypeId) { toast.error('Pick a person and a leave type'); return; }
      setBusy(true);
      try {
        await hrAPI.requestLeave({ userId, leaveTypeId, startsOn, endsOn: halfDay ? startsOn : endsOn, halfDay, reason });
        toast.success('Leave booked');
        onDone();
      } finally { setBusy(false); }
    };

    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-sm font-black text-pine dark:text-zinc-100">Book leave</h3>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-3">
            <Field label="Who">
              <select className={INPUT} value={userId} onChange={e => setUserId(e.target.value)}>
                {people.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={INPUT} value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)}>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}{t.isPaid ? '' : ' (unpaid)'}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><input type="date" className={INPUT} value={startsOn} onChange={e => setStart(e.target.value)} /></Field>
              <Field label="To">
                <input type="date" className={INPUT} value={halfDay ? startsOn : endsOn} min={startsOn}
                  disabled={halfDay} onChange={e => setEndsOn(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={halfDay} onChange={e => { setHalfDay(e.target.checked); if (e.target.checked) setEndsOn(startsOn); }} />
              Half day
            </label>
            <Field label="Reason (optional)">
              <textarea rows={2} className={INPUT} value={reason} onChange={e => setReason(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
            <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
            <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Book
            </button>
          </div>
        </div>
      </div>
    );
  };

export default HrLeaveTab;

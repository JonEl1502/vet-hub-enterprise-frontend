/**
 * Feeding — plans per herd, and the log of what was actually fed.
 *
 * The common case is "fed the usual ration just now", so **Log feed** is a
 * single tap that defaults to the plan's own quantity; the modal is only for
 * when the amount or time differs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Sprout, Pencil, Trash2, Check, History, Loader2 } from 'lucide-react';
import { livestockAPI, type FeedingPlan, type FeedingLog, type Farm, type AnimalGroup } from '../../services/modules/livestock.api';
import { toast, dialog } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, PrimaryButton, EmptyState, Modal, Field, Card, FarmFilter, FREQUENCIES, fmtDateTime, dateInput } from './shared';

const blank = {
  farmId: '', animalGroupId: '', name: '', feedType: '', quantityKg: '' as string | number,
  frequency: 'DAILY', timesPerDay: 2, startsOn: '', endsOn: '', notes: '',
  // Named slots (161). Empty = count-only, exactly as before.
  windows: [] as { key?: string; label: string; at: string }[],
};

/** A sensible pair to start from — most farms feed morning and evening. */
const DEFAULT_WINDOWS = [{ label: 'Morning', at: '06:00' }, { label: 'Evening', at: '17:00' }];

const FeedingView: React.FC = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [groups, setGroups] = useState<AnimalGroup[]>([]);
  const [plans, setPlans] = useState<FeedingPlan[]>([]);
  const [farmId, setFarmId] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(typeof blank & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [historyPlan, setHistoryPlan] = useState<FeedingPlan | null>(null);
  const [logs, setLogs] = useState<FeedingLog[]>([]);

  useEffect(() => {
    livestockAPI.listFarms().then((r) => { if (r.success && r.data?.farms) setFarms(r.data.farms); }).catch(() => {});
    livestockAPI.listAnimalGroups().then((r) => { if (r.success && r.data?.groups) setGroups(r.data.groups); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await livestockAPI.listFeedingPlans(farmId || undefined);
      if (res.success && res.data?.plans) setPlans(res.data.plans);
    } finally { setLoading(false); }
  }, [farmId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setEditing({ ...blank, farmId: farmId || farms[0]?.id || '' });
  const openEdit = (p: FeedingPlan) => setEditing({
    id: p.id, farmId: p.farmId, animalGroupId: p.animalGroupId ?? '', name: p.name,
    feedType: p.feedType ?? '', quantityKg: p.quantityKg ?? '', frequency: p.frequency,
    timesPerDay: p.timesPerDay, startsOn: dateInput(p.startsOn), endsOn: dateInput(p.endsOn), notes: p.notes ?? '',
    windows: (p.windows ?? []).map((w) => ({ key: w.key, label: w.label, at: w.at })),
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Name is required'); return; }
    if (!editing.farmId) { toast.error('Choose a farm'); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: editing.name.trim(),
        animalGroupId: editing.animalGroupId || null,
        feedType: editing.feedType || null,
        quantityKg: editing.quantityKg === '' ? null : Number(editing.quantityKg),
        frequency: editing.frequency,
        timesPerDay: Number(editing.timesPerDay ?? 2),
        // Only slots with both a name and a time are real; the server drops the
        // rest anyway, and sending them would make the count disagree.
        windows: editing.windows.filter((w) => w.label.trim() && w.at),
        startsOn: editing.startsOn || null,
        endsOn: editing.endsOn || null,
        notes: editing.notes || null,
      };
      const res = editing.id
        ? await livestockAPI.updateFeedingPlan(editing.id, payload)
        : await livestockAPI.createFeedingPlan({ ...payload, farmId: editing.farmId });
      if (res.success && res.data?.plan) {
        setPlans((prev) => editing.id
          ? prev.map((p) => (p.id === editing.id ? res.data!.plan : p))
          : [res.data!.plan, ...prev]);
        toast.success(editing.id ? 'Updated' : 'Plan created');
        setEditing(null);
      }
    } finally { setSaving(false); }
  };

  /**
   * One-tap: log the plan's own ration, now. `windowKey` is optional — without
   * it the server picks the slot (the last one that's past due and unfilled),
   * which is what the plain "Log feed" button relies on.
   */
  const quickLog = async (p: FeedingPlan, windowKey?: string) => {
    setLoggingId(windowKey ? `${p.id}:${windowKey}` : p.id);
    try {
      const res = await livestockAPI.logFeeding(p.id, windowKey ? { windowKey } : {});
      if (res.success && res.data?.log) {
        const log = res.data.log;
        setPlans((prev) => prev.map((x) => {
          if (x.id !== p.id) return x;
          // Mark the slot the SERVER chose, not the one we guessed — an unkeyed
          // tap still resolves to a real slot and the card must agree with it.
          const today = x.today
            ? (() => {
                const windows = x.today.windows.map((w) => (
                  w.key === log.windowKey ? { ...w, fed: true, due: false, fedAt: log.fedAt } : w
                ));
                return { windows, fedCount: windows.filter((w) => w.fed).length, dueWindows: windows.filter((w) => w.due) };
              })()
            : x.today;
          return { ...x, lastFedAt: log.fedAt, fedToday: (x.fedToday ?? 0) + 1, today };
        }));
        toast.success(`${p.name} — fed`);
      }
    } finally { setLoggingId(null); }
  };

  const openHistory = async (p: FeedingPlan) => {
    setHistoryPlan(p);
    setLogs([]);
    const res = await livestockAPI.listFeedingLogs(p.id);
    if (res.success && res.data?.logs) setLogs(res.data.logs);
  };

  const remove = async (p: FeedingPlan) => {
    const ok = await dialog.confirmDelete({ title: 'Archive feeding plan', message: 'Its log history is kept.', entityName: p.name });
    if (!ok) return;
    const res = await livestockAPI.deleteFeedingPlan(p.id);
    if (res.success) { setPlans((prev) => prev.filter((x) => x.id !== p.id)); toast.success('Archived'); }
  };

  // Rations still owed today. DAILY plans owe `timesPerDay`; the slower
  // cadences are satisfied by any log, so they owe at most one.
  const rationsLeft = (p: FeedingPlan) => {
    const done = p.fedToday ?? 0;
    if (String(p.frequency).toUpperCase() !== 'DAILY') return done > 0 ? 0 : 1;
    return Math.max(0, (Number(p.timesPerDay) || 1) - done);
  };

  return (
    <LivestockPage
      title="Feeding"
      subtitle="Plans per herd, and what was actually fed"
      icon={Sprout}
      actions={<PrimaryButton onClick={openNew} disabled={farms.length === 0}>New plan</PrimaryButton>}
    >
      <FarmFilter farms={farms} value={farmId} onChange={setFarmId} />

      {loading ? (
        <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" message="Loading..." /></div>
      ) : plans.length === 0 ? (
        <EmptyState icon={Sprout} title="No feeding plans yet"
          hint={farms.length === 0 ? 'Register a farm first.' : 'Create a plan to track rations and daily feeding.'} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                    {p.animalGroupName || p.farmName}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  {p.frequency} ×{p.timesPerDay}
                </span>
              </div>

              <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                {p.feedType || 'Feed'}{p.quantityKg != null ? ` · ${p.quantityKg} kg` : ''}
              </p>

              {/* Named slots (161): say WHICH ration is outstanding, and never
                  flag one whose time hasn't come — an evening slot showing red
                  all morning is how an alert gets ignored. */}
              {p.today && p.today.windows.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.today.windows.map((w) => {
                    const tone = w.fed
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40'
                      : w.due
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40'
                        : 'bg-slate-50 dark:bg-zinc-950 text-slate-400 dark:text-zinc-500 border-slate-200/60 dark:border-zinc-800';
                    const busy = loggingId === `${p.id}:${w.key}`;
                    return (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => !w.fed && quickLog(p, w.key)}
                        disabled={w.fed || busy}
                        title={w.fed ? `${w.label} — fed` : w.due ? `${w.label} (${w.at}) — overdue, tap to log` : `${w.label} — due at ${w.at}`}
                        className={`px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider transition-all disabled:cursor-default ${tone}`}
                      >
                        {busy ? '…' : w.fed ? '✓' : w.due ? '!' : '·'} {w.label}
                        <span className="ml-1 opacity-60">{w.at}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {(() => {
                const done = p.fedToday ?? 0;
                const left = rationsLeft(p);
                const daily = String(p.frequency).toUpperCase() === 'DAILY';
                const times = Number(p.timesPerDay) || 1;
                // With slots on the card, the "N of M fed" line is noise.
                if (p.today && p.today.windows.length > 0) {
                  return (
                    <p className="mt-2 text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                      {p.lastFedAt ? `Last fed ${fmtDateTime(p.lastFedAt)}` : 'Never logged'}
                    </p>
                  );
                }
                // Amber for "started but still owed" — the case that used to
                // read as fully done after a single tap.
                const tone = left === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : done > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
                return (
                  <>
                    {daily && times > 1 && (
                      <p className={`mt-2 text-[11px] font-black ${tone}`}>
                        {done} of {times} fed today{left > 0 ? ` · ${left} to go` : ''}
                      </p>
                    )}
                    <p className={`mt-2 text-[11px] font-semibold ${daily && times > 1 ? 'text-slate-400 dark:text-zinc-500' : tone}`}>
                      {p.lastFedAt ? `Last fed ${fmtDateTime(p.lastFedAt)}` : 'Never logged'}
                    </p>
                  </>
                );
              })()}

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-1">
                <button
                  onClick={() => quickLog(p)}
                  disabled={loggingId === p.id}
                  className="flex-1 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                >
                  {loggingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Log feed
                </button>
                <button onClick={() => openHistory(p)} title="History" className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-seafoam"><History size={13} /></button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-seafoam"><Pencil size={13} /></button>
                <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit feeding plan' : 'New feeding plan'} onClose={() => setEditing(null)} onSave={save} saving={saving}>
          {!editing.id && (
            <Field label="Farm">
              <select className="field-select" value={editing.farmId}
                onChange={(e) => setEditing({ ...editing, farmId: e.target.value, animalGroupId: '' })}>
                <option value="">Select a farm…</option>
                {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Herd / flock (optional)">
            <select className="field-select" value={editing.animalGroupId}
              onChange={(e) => setEditing({ ...editing, animalGroupId: e.target.value })}>
              <option value="">Whole farm</option>
              {groups.filter((g) => !editing.farmId || g.farmId === editing.farmId)
                .map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Plan name">
            <input className="field-input" value={editing.name} placeholder="e.g. Morning dairy meal"
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Feed type">
              <input className="field-input" value={editing.feedType} placeholder="e.g. Dairy meal"
                onChange={(e) => setEditing({ ...editing, feedType: e.target.value })} />
            </Field>
            <Field label="Quantity (kg)">
              <input className="field-input" type="number" min="0" step="0.1" value={editing.quantityKg}
                onChange={(e) => setEditing({ ...editing, quantityKg: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frequency">
              <select className="field-select" value={editing.frequency}
                onChange={(e) => setEditing({ ...editing, frequency: e.target.value })}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Times per day">
              <input className="field-input" type="number" min="1"
                value={editing.windows.length || editing.timesPerDay}
                disabled={editing.windows.length > 0}
                title={editing.windows.length > 0 ? 'Set by the feeding times below' : undefined}
                onChange={(e) => setEditing({ ...editing, timesPerDay: Number(e.target.value) })} />
            </Field>
          </div>

          {/* Named feeding times. Optional — a plan with none behaves exactly as
              it did before. With them, the card and the alerts can say WHICH
              ration is outstanding instead of just how many. */}
          {String(editing.frequency).toUpperCase() === 'DAILY' && (
            <Field label="Feeding times (optional)">
              <div className="space-y-2">
                {editing.windows.length === 0 ? (
                  <button type="button"
                    onClick={() => setEditing({ ...editing, windows: DEFAULT_WINDOWS.map((w) => ({ ...w })) })}
                    className="w-full px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-pine hover:border-pine dark:hover:text-seafoam transition-all">
                    + Name the feeding times (morning, evening…)
                  </button>
                ) : (
                  <>
                    {editing.windows.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input className="field-input flex-1" placeholder="e.g. Morning" value={w.label}
                          onChange={(e) => setEditing({
                            ...editing,
                            windows: editing.windows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                          })} />
                        <input className="field-input w-28 shrink-0" type="time" value={w.at}
                          onChange={(e) => setEditing({
                            ...editing,
                            windows: editing.windows.map((x, j) => (j === i ? { ...x, at: e.target.value } : x)),
                          })} />
                        <button type="button" title="Remove"
                          onClick={() => setEditing({ ...editing, windows: editing.windows.filter((_, j) => j !== i) })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    ))}
                    {editing.windows.length < 6 && (
                      <button type="button"
                        onClick={() => setEditing({ ...editing, windows: [...editing.windows, { label: '', at: '12:00' }] })}
                        className="text-[10px] font-black uppercase tracking-widest text-seafoam hover:text-pine transition-all">
                        + Add a time
                      </button>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 leading-snug">
                      A time is only flagged overdue once it has passed. Logging without picking a
                      slot fills the last one that's due.
                    </p>
                  </>
                )}
              </div>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts"><input className="field-input" type="date" value={editing.startsOn}
              onChange={(e) => setEditing({ ...editing, startsOn: e.target.value })} /></Field>
            <Field label="Ends"><input className="field-input" type="date" value={editing.endsOn}
              onChange={(e) => setEditing({ ...editing, endsOn: e.target.value })} /></Field>
          </div>
          <Field label="Notes">
            <textarea className="field-textarea" rows={2} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
        </Modal>
      )}

      {historyPlan && (
        <Modal title={`${historyPlan.name} — feeding log`} onClose={() => setHistoryPlan(null)}
          onSave={() => setHistoryPlan(null)} saveLabel="Done">
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No feedings logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="py-2 flex items-baseline justify-between gap-3">
                  <span className="text-xs text-slate-600 dark:text-zinc-300">{fmtDateTime(l.fedAt)}</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-zinc-200">
                    {l.quantityKg != null ? `${l.quantityKg} kg` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </LivestockPage>
  );
};

export default FeedingView;

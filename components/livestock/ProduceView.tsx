/**
 * Produce — expected output (schedules) and actual yield (records).
 *
 * Recording against a schedule rolls its `nextDueOn` forward by the frequency
 * server-side, so this list stays a live "what's due" view rather than a pile
 * of overdue rows.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Pencil, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { livestockAPI, type ProduceSchedule, type ProduceRecord, type Farm, type AnimalGroup, type CropPlot } from '../../services/modules/livestock.api';
import { toast, dialog } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, PrimaryButton, EmptyState, Modal, Field, Card, FarmFilter, FREQUENCIES, UNITS, fmtDate, dateInput } from './shared';

const blankSched = {
  farmId: '', animalGroupId: '', cropPlotId: '', produce: '', unit: 'KG',
  expectedQty: '' as string | number, frequency: 'DAILY', nextDueOn: '', notes: '',
};
const blankRec = { quantity: '' as string | number, unit: 'KG', recordedOn: '', notes: '' };

const ProduceView: React.FC = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [groups, setGroups] = useState<AnimalGroup[]>([]);
  const [plots, setPlots] = useState<CropPlot[]>([]);
  const [schedules, setSchedules] = useState<ProduceSchedule[]>([]);
  const [records, setRecords] = useState<ProduceRecord[]>([]);
  const [farmId, setFarmId] = useState('');
  const [tab, setTab] = useState<'schedules' | 'records'>('schedules');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(typeof blankSched & { id?: string }) | null>(null);
  const [recording, setRecording] = useState<(typeof blankRec & { schedule: ProduceSchedule }) | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    livestockAPI.listFarms().then((r) => { if (r.success && r.data?.farms) setFarms(r.data.farms); }).catch(() => {});
    livestockAPI.listAnimalGroups().then((r) => { if (r.success && r.data?.groups) setGroups(r.data.groups); }).catch(() => {});
    livestockAPI.listCropPlots().then((r) => { if (r.success && r.data?.plots) setPlots(r.data.plots); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        livestockAPI.listProduceSchedules(farmId || undefined),
        livestockAPI.listProduceRecords({ farmId: farmId || undefined, limit: 100 }),
      ]);
      if (s.success && s.data?.schedules) setSchedules(s.data.schedules);
      if (r.success && r.data?.records) setRecords(r.data.records);
    } finally { setLoading(false); }
  }, [farmId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setEditing({ ...blankSched, farmId: farmId || farms[0]?.id || '' });
  const openEdit = (s: ProduceSchedule) => setEditing({
    id: s.id, farmId: s.farmId, animalGroupId: s.animalGroupId ?? '', cropPlotId: s.cropPlotId ?? '',
    produce: s.produce, unit: s.unit, expectedQty: s.expectedQty ?? '', frequency: s.frequency,
    nextDueOn: dateInput(s.nextDueOn), notes: s.notes ?? '',
  });

  const saveSchedule = async () => {
    if (!editing) return;
    if (!editing.produce.trim()) { toast.error('Produce is required'); return; }
    if (!editing.farmId) { toast.error('Choose a farm'); return; }
    setSaving(true);
    try {
      const payload: any = {
        produce: editing.produce.trim(), unit: editing.unit,
        expectedQty: editing.expectedQty === '' ? null : Number(editing.expectedQty),
        frequency: editing.frequency, nextDueOn: editing.nextDueOn || null,
        animalGroupId: editing.animalGroupId || null, cropPlotId: editing.cropPlotId || null,
        notes: editing.notes || null,
      };
      const res = editing.id
        ? await livestockAPI.updateProduceSchedule(editing.id, payload)
        : await livestockAPI.createProduceSchedule({ ...payload, farmId: editing.farmId });
      if (res.success && res.data?.schedule) {
        setSchedules((prev) => editing.id
          ? prev.map((s) => (s.id === editing.id ? res.data!.schedule : s))
          : [res.data!.schedule, ...prev]);
        toast.success(editing.id ? 'Updated' : 'Schedule created');
        setEditing(null);
      }
    } finally { setSaving(false); }
  };

  const saveRecord = async () => {
    if (!recording) return;
    if (recording.quantity === '') { toast.error('Quantity is required'); return; }
    setSaving(true);
    try {
      const res = await livestockAPI.recordProduce({
        farmId: recording.schedule.farmId,
        produceScheduleId: recording.schedule.id,
        quantity: Number(recording.quantity),
        unit: recording.unit,
        recordedOn: recording.recordedOn || undefined,
        notes: recording.notes || undefined,
      });
      if (res.success && res.data?.record) {
        setRecords((prev) => [res.data!.record, ...prev]);
        toast.success('Produce recorded');
        setRecording(null);
        // nextDueOn rolled forward server-side — refresh so the due list is honest.
        load();
      }
    } finally { setSaving(false); }
  };

  const remove = async (s: ProduceSchedule) => {
    const ok = await dialog.confirmDelete({ title: 'Archive schedule', message: 'Recorded yield is kept.', entityName: s.produce });
    if (!ok) return;
    const res = await livestockAPI.deleteProduceSchedule(s.id);
    if (res.success) { setSchedules((prev) => prev.filter((x) => x.id !== s.id)); toast.success('Archived'); }
  };

  const isDue = (d: string | null) => !!d && new Date(d).getTime() <= Date.now();

  return (
    <LivestockPage
      title="Produce"
      subtitle="Expected output and recorded yield"
      icon={CalendarClock}
      actions={<PrimaryButton onClick={openNew} disabled={farms.length === 0}>New schedule</PrimaryButton>}
    >
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <FarmFilter farms={farms} value={farmId} onChange={setFarmId} />
        <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 inline-flex">
          {([['schedules', 'Schedules'], ['records', 'Recorded yield']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                tab === id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm'
                           : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center"><LoadingSpinner size="md" message="Loading..." /></div>
      ) : tab === 'schedules' ? (
        schedules.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No produce schedules yet"
            hint={farms.length === 0 ? 'Register a farm first.' : 'Schedule milk, eggs or a harvest to track expected output.'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 dark:text-white truncate">{s.produce}</p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                      {s.animalGroupName || s.cropPlotName || s.farmName}
                    </p>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                    {s.frequency}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                  Expected {s.expectedQty ?? '—'} {s.unit}
                </p>
                <p className={`mt-1 text-[11px] font-semibold flex items-center gap-1 ${
                  isDue(s.nextDueOn) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-zinc-400'
                }`}>
                  {isDue(s.nextDueOn) && <AlertTriangle size={11} />} Due {fmtDate(s.nextDueOn)}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-1">
                  <button
                    onClick={() => setRecording({ ...blankRec, unit: s.unit, schedule: s })}
                    className="flex-1 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:opacity-90"
                  >
                    <Plus size={12} /> Record yield
                  </button>
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-seafoam"><Pencil size={13} /></button>
                  <button onClick={() => remove(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : records.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No yield recorded yet" hint="Record against a schedule to build the history." />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Date</th>
                  <th className="text-right px-4 py-2 font-semibold">Quantity</th>
                  <th className="text-left px-4 py-2 font-semibold">Unit</th>
                  <th className="text-left px-4 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {records.map((r) => (
                  <tr key={r.id} className="text-slate-700 dark:text-zinc-300">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.recordedOn)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{r.quantity}</td>
                    <td className="px-4 py-3">{r.unit}</td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit schedule' : 'New produce schedule'} onClose={() => setEditing(null)} onSave={saveSchedule} saving={saving}>
          {!editing.id && (
            <Field label="Farm">
              <select className="field-select" value={editing.farmId}
                onChange={(e) => setEditing({ ...editing, farmId: e.target.value, animalGroupId: '', cropPlotId: '' })}>
                <option value="">Select a farm…</option>
                {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="From herd/flock">
              <select className="field-select" value={editing.animalGroupId}
                onChange={(e) => setEditing({ ...editing, animalGroupId: e.target.value, cropPlotId: '' })}>
                <option value="">—</option>
                {groups.filter((g) => !editing.farmId || g.farmId === editing.farmId)
                  .map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="…or crop plot">
              <select className="field-select" value={editing.cropPlotId}
                onChange={(e) => setEditing({ ...editing, cropPlotId: e.target.value, animalGroupId: '' })}>
                <option value="">—</option>
                {plots.filter((p) => !editing.farmId || p.farmId === editing.farmId)
                  .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Produce">
            <input className="field-input" value={editing.produce} placeholder="e.g. Milk, Eggs, Maize"
              onChange={(e) => setEditing({ ...editing, produce: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Expected">
              <input className="field-input" type="number" min="0" step="0.1" value={editing.expectedQty}
                onChange={(e) => setEditing({ ...editing, expectedQty: e.target.value })} />
            </Field>
            <Field label="Unit">
              <select className="field-select" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Frequency">
              <select className="field-select" value={editing.frequency} onChange={(e) => setEditing({ ...editing, frequency: e.target.value })}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Next due">
            <input className="field-input" type="date" value={editing.nextDueOn}
              onChange={(e) => setEditing({ ...editing, nextDueOn: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className="field-textarea" rows={2} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
        </Modal>
      )}

      {recording && (
        <Modal title={`Record ${recording.schedule.produce}`} onClose={() => setRecording(null)} onSave={saveRecord} saving={saving} saveLabel="Record">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input className="field-input" type="number" min="0" step="0.1" autoFocus value={recording.quantity}
                onChange={(e) => setRecording({ ...recording, quantity: e.target.value })} />
            </Field>
            <Field label="Unit">
              <select className="field-select" value={recording.unit}
                onChange={(e) => setRecording({ ...recording, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Date">
            <input className="field-input" type="date" value={recording.recordedOn}
              onChange={(e) => setRecording({ ...recording, recordedOn: e.target.value })} />
            <p className="mt-1 text-[10px] text-slate-400">Leave blank for today. The schedule's next due date rolls forward automatically.</p>
          </Field>
          <Field label="Notes">
            <textarea className="field-textarea" rows={2} value={recording.notes}
              onChange={(e) => setRecording({ ...recording, notes: e.target.value })} />
          </Field>
        </Modal>
      )}
    </LivestockPage>
  );
};

export default ProduceView;

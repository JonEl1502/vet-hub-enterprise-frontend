import React, { useEffect, useState } from 'react';
import { Syringe, Loader2, Plus, Trash2, Check, Sparkles } from 'lucide-react';
import { Visit } from '../../../types';
import { visitsAPI, vaccinationsAPI } from '../../../services';
import { VaccinationRecord } from '../../../services/modules/vaccinations.api';
import { VACCINES } from '../../../constants/vaccines';

interface Props {
  appointment: Visit;
  petId: string | number;
  onSaved?: () => void;
}

const fieldCls = 'w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

/**
 * Vaccination panel embedded in a visit. Lists the visit's vaccination records
 * (one per vaccination task, auto-created server-side + keyed by taskId), lets
 * staff mark each Given/Scheduled, and add extra vaccines given this visit —
 * flagged "Added this visit" in a distinct colour. Status syncs both ways with
 * the visit task and the standalone Vaccination page (same records, by ID).
 */
const VaccinationPanel: React.FC<Props> = ({ appointment, petId, onSaved }) => {
  const locked = !!appointment.isPaid
    || (appointment.status as string) === 'COMPLETED'
    || (appointment.status as string) === 'PENDING_PAYMENT';

  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Mirror a record's status onto its visit task (belt & braces over the backend
  // sync) so the services checklist + visit progress move immediately.
  const syncVisitTask = async (taskId: string | null | undefined, given: boolean) => {
    if (!taskId) return;
    const t = (appointment.tasks || []).find((x: any) => String(x.id) === String(taskId));
    const want = given ? 'COMPLETED' : 'PENDING';
    if (!t || String(t.status) === want) return;
    try { await visitsAPI.updateTask(Number(appointment.id), Number(t.id), { status: want } as any); onSaved?.(); } catch { /* non-fatal */ }
  };

  const load = async (backfill = true) => {
    try {
      let recs = await vaccinationsAPI.getByAppointment(String(appointment.id));
      // Safety net: if the visit has vaccination tasks but no records yet
      // (sync hasn't run), generate them so the list isn't empty.
      if (backfill && recs.length === 0) {
        const hasVaccTask = (appointment.tasks || []).some((t: any) => /vaccin|immuni/i.test(t.category || ''));
        if (hasVaccTask) { try { await vaccinationsAPI.createFromAppointment(String(appointment.id)); recs = await vaccinationsAPI.getByAppointment(String(appointment.id)); } catch { /* non-fatal */ } }
      }
      setRecords(recs);
    } catch { /* leave list empty */ }
    finally { setLoaded(true); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [appointment.id]);

  const setGiven = async (rec: VaccinationRecord, given: boolean) => {
    if (locked) return;
    const status = given ? 'ADMINISTERED' : 'SCHEDULED';
    setBusyId(rec.id);
    setRecords(rs => rs.map(r => r.id === rec.id ? { ...r, status } : r));
    try {
      await vaccinationsAPI.update(rec.id, { status } as any);
      await syncVisitTask(rec.taskId, given);
      onSaved?.();
    } catch { setRecords(rs => rs.map(r => r.id === rec.id ? { ...r, status: rec.status } : r)); }
    finally { setBusyId(null); }
  };

  const setBatch = (id: string, batchNumber: string) => setRecords(rs => rs.map(r => r.id === id ? { ...r, batchNumber } : r));
  const saveBatch = async (rec: VaccinationRecord) => {
    if (locked) return;
    try { await vaccinationsAPI.update(rec.id, { batchNumber: rec.batchNumber || '' } as any); } catch { /* non-fatal */ }
  };

  const addVaccine = async () => {
    const name = newName.trim();
    if (!name || locked) return;
    setAdding(true);
    try {
      // Added in the visit → recorded as given now, flagged custom (distinct colour).
      await vaccinationsAPI.create({
        petId: String(petId), appointmentId: String(appointment.id),
        vaccineName: name, isCustom: true, status: 'ADMINISTERED',
        administeredAt: new Date().toISOString(),
      } as any);
      setNewName('');
      await load(false);
      onSaved?.();
    } catch { /* surfaced by client */ }
    finally { setAdding(false); }
  };

  const remove = async (rec: VaccinationRecord) => {
    if (locked) return;
    setBusyId(rec.id);
    const prev = records;
    setRecords(rs => rs.filter(r => r.id !== rec.id));
    try { await vaccinationsAPI.remove(rec.id); await syncVisitTask(rec.taskId, false); onSaved?.(); }
    catch { setRecords(prev); }
    finally { setBusyId(null); }
  };

  const given = records.filter(r => r.status === 'ADMINISTERED').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Syringe size={18} className="text-seafoam" />
          <div>
            <h4 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Vaccinations</h4>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Mark each vaccine given, or add one done this visit</p>
          </div>
        </div>
        {loaded && records.length > 0 && (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{given}/{records.length} given</span>
        )}
      </div>

      {locked && (
        <div className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">🔒 Visit checked out — vaccinations locked</div>
      )}

      {!loaded && <div className="py-3 flex items-center gap-2 text-[11px] text-slate-400"><Loader2 size={13} className="animate-spin" /> Loading vaccinations…</div>}

      {loaded && records.length === 0 && (
        <p className="text-[11px] text-slate-400 py-2">No vaccines on this visit yet — add one below, or add a Vaccination service to the visit.</p>
      )}

      <div className="space-y-2">
        {records.map(rec => {
          const isGiven = rec.status === 'ADMINISTERED';
          const busy = busyId === rec.id;
          return (
            <div key={rec.id}
              className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                rec.isCustom
                  ? 'border-teal-300 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/20'
                  : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
              }`}>
              {/* Given / Scheduled toggle */}
              <button type="button" disabled={locked || busy} onClick={() => setGiven(rec, !isGiven)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shrink-0 transition-all ${
                  isGiven
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 hover:border-seafoam'
                }`}>
                {busy ? <Loader2 size={11} className="animate-spin" /> : isGiven ? <span className="flex items-center gap-1"><Check size={11} /> Given</span> : 'Scheduled'}
              </button>

              <span className="text-xs font-black text-pine dark:text-zinc-100 truncate min-w-0 flex-1">{rec.vaccineName}</span>

              {rec.isCustom && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-teal-500 text-white">
                  <Sparkles size={9} /> Added this visit
                </span>
              )}

              <input
                value={rec.batchNumber ?? ''}
                disabled={locked}
                onChange={e => setBatch(rec.id, e.target.value)}
                onBlur={() => saveBatch(rec)}
                placeholder="Batch #"
                className="w-24 px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam shrink-0"
              />

              {!locked && (
                <button type="button" disabled={busy} onClick={() => remove(rec)} title="Remove"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!locked && (
        <div className="flex items-center gap-2 pt-1">
          <input
            list="vaccine-options"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVaccine(); } }}
            placeholder="Add a vaccine given this visit — pick or type…"
            className={fieldCls}
          />
          <datalist id="vaccine-options">
            {VACCINES.map(v => <option key={v.key} value={v.label} />)}
          </datalist>
          <button type="button" onClick={addVaccine} disabled={adding || !newName.trim()}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide bg-seafoam text-white shadow-sm hover:bg-seafoam/90 disabled:opacity-40 transition-all">
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
          </button>
        </div>
      )}
    </div>
  );
};

export default VaccinationPanel;

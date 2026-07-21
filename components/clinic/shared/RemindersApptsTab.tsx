import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Calendar, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { remindersAPI, appointmentsAPI } from '../../../services';
import type { Reminder, Appointment } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import { dialog } from '../../../services/utils/dialog';

// Shared "Reminders & Appts" tab for the pet + client profiles. One
// chronological list of the reminders and appointment bookings in scope,
// filtered to today & future by default.
interface Props {
  petId?: number | string;
  clientId?: number | string;
  /** petId -> display name, for labelling rows in client scope. */
  petNames?: Record<string, string>;
  readOnly?: boolean;
}

type Filter = 'upcoming' | 'past' | 'all';

type Row = {
  kind: 'reminder' | 'booking';
  id: string;
  when: string; // ISO
  title: string;
  status: string;
  petId: string;
  raw: any;
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

const RemindersApptsTab: React.FC<Props> = ({ petId, clientId, petNames, readOnly }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [bookings, setBookings] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<Filter>('upcoming');
  // Type tabs — the mixed list wasn't obvious enough at a glance.
  const [kindFilter, setKindFilter] = useState<'all' | 'reminder' | 'booking'>('all');
  const [loading, setLoading] = useState(true);
  const [viewRow, setViewRow] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, bRes] = await Promise.all([
        remindersAPI.list({ scope: 'all', ...(petId != null ? { petId } : {}), ...(clientId != null ? { clientId } : {}) }),
        appointmentsAPI.list(petId != null ? { petId } : {}),
      ]);
      if (rRes.success && rRes.data?.reminders) setReminders(rRes.data.reminders);
      const appts: Appointment[] = (bRes.success ? (bRes.data as any)?.appointments : null) || [];
      // The bookings endpoint filters by pet only — narrow to the client here.
      setBookings(clientId != null && petId == null
        ? appts.filter(a => String(a.clientId) === String(clientId))
        : appts);
    } catch { /* the tab just stays empty */ }
    finally { setLoading(false); }
  }, [petId, clientId]);
  useEffect(() => { load(); }, [load]);

  const rows: Row[] = useMemo(() => {
    const t0 = startOfToday();
    const all: Row[] = [
      ...reminders.filter(r => r.status !== 'DISMISSED').map(r => ({
        kind: 'reminder' as const, id: String(r.id), when: r.dueAt,
        title: r.title || String(r.serviceType || 'Reminder').replace('_', ' '),
        status: String(r.status || ''), petId: String(r.petId), raw: r,
      })),
      ...bookings.filter(b => !['CANCELLED', 'NO_SHOW'].includes(b.status)).map(b => ({
        kind: 'booking' as const, id: String(b.id), when: b.scheduledAt,
        title: `Appointment · ${(b.encounterType || 'VET_VISIT').replace('_', ' ')}`,
        status: String(b.status || ''), petId: String(b.petId), raw: b,
      })),
    ];
    const inFilter = (iso: string) => {
      const t = new Date(iso).getTime();
      if (filter === 'upcoming') return t >= t0;
      if (filter === 'past') return t < t0;
      return true;
    };
    return all
      .filter(r => kindFilter === 'all' || r.kind === kindFilter)
      .filter(r => inFilter(r.when))
      .sort((a, b) => filter === 'past'
        ? new Date(b.when).getTime() - new Date(a.when).getTime()
        : new Date(a.when).getTime() - new Date(b.when).getTime());
  }, [reminders, bookings, filter, kindFilter]);

  const overdue = (r: Row) => r.kind === 'reminder' && r.status === 'PENDING' && new Date(r.when).getTime() < Date.now();

  const remove = async (row: Row) => {
    if (!await dialog.confirmDelete({ title: `Delete ${row.kind === 'reminder' ? 'reminder' : 'appointment'}?`, entityName: row.title })) return;
    try {
      const res = row.kind === 'reminder' ? await remindersAPI.remove(row.id) : await appointmentsAPI.remove(row.id);
      if (res?.success !== false) {
        toast.success('Deleted');
        if (row.kind === 'reminder') setReminders(l => l.filter(x => String(x.id) !== row.id));
        else setBookings(l => l.filter(x => String(x.id) !== row.id));
        setViewRow(null);
      } else toast.error('Delete failed');
    } catch { toast.error('Delete failed'); }
  };

  // A reminder can only be marked done once its due DATE has arrived — before
  // that the modal offers Edit + Delete (reschedule instead of pre-completing).
  const dueReached = (row: Row) => {
    const due = new Date(row.kind === 'reminder' ? row.raw.dueAt : row.raw.scheduledAt);
    due.setHours(0, 0, 0, 0);
    return due.getTime() <= Date.now();
  };
  const REMINDER_TYPES = ['VACCINATION', 'DEWORMING', 'GROOMING', 'FOLLOW_UP', 'MEDICATION', 'FEEDING', 'CHECKUP', 'OTHER'];
  const [editRow, setEditRow] = useState<{ id: string; title: string; dueDate: string; serviceType: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // Opening a different row (or closing) resets any in-progress edit.
  useEffect(() => { setEditRow(null); }, [viewRow?.id]);
  const startEdit = (row: Row) => setEditRow({
    id: row.id,
    title: row.raw.title || '',
    dueDate: row.raw.dueAt ? new Date(row.raw.dueAt).toISOString().slice(0, 10) : '',
    serviceType: row.raw.serviceType || 'OTHER',
  });
  const saveEdit = async () => {
    if (!editRow) return;
    if (!editRow.title.trim() || !editRow.dueDate) { toast.error('Title and due date are required'); return; }
    setSavingEdit(true);
    try {
      const res = await remindersAPI.update(editRow.id, {
        title: editRow.title.trim(),
        serviceType: editRow.serviceType as any,
        dueAt: new Date(`${editRow.dueDate}T09:00:00`).toISOString(),
      });
      if (res.success) { toast.success('Reminder updated'); setEditRow(null); setViewRow(null); load(); }
    } catch { toast.error('Update failed'); }
    finally { setSavingEdit(false); }
  };

  const markDone = async (row: Row) => {
    try {
      const res = await remindersAPI.markDone(row.id);
      if (res?.success) {
        toast.success('Marked done');
        setReminders(l => l.map(x => String(x.id) === row.id ? { ...x, status: 'DONE' as const } : x));
        setViewRow(null);
      }
    } catch { toast.error('Update failed'); }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      {/* Filter chips — time window + type (reminder vs appointment) */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-fit">
          {([
            { id: 'upcoming', label: 'Today & Future' },
            { id: 'past', label: 'Past' },
            { id: 'all', label: 'All' },
          ] as const).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                filter === f.id ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow' : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-200'
              }`}>{f.label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-fit">
          {([
            { id: 'all', label: 'Both' },
            { id: 'reminder', label: '🔔 Reminders' },
            { id: 'booking', label: '📅 Appointments' },
          ] as const).map(f => (
            <button key={f.id} onClick={() => setKindFilter(f.id)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                kindFilter === f.id ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow' : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-200'
              }`}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-600 py-10 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="py-20 text-center border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] opacity-30 uppercase font-black text-[10px] tracking-[0.2em]">
          No {filter === 'past' ? 'past' : filter === 'all' ? '' : 'upcoming '}reminders or appointments
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {rows.map(row => (
            <button key={`${row.kind}-${row.id}`} type="button" onClick={() => setViewRow(row)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all group ${
                row.kind === 'reminder'
                  ? overdue(row)
                    ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 hover:border-red-400'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 hover:border-amber-400'
                  : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/40 hover:border-indigo-400'
              }`}>
              {row.kind === 'reminder'
                ? <Bell size={13} className={overdue(row) ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'} />
                : <Calendar size={13} className="text-indigo-500 shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                  <span className={`inline-block align-middle mr-1.5 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                    row.kind === 'reminder' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400'
                  }`}>{row.kind === 'reminder' ? 'Reminder' : 'Appt'}</span>
                  {row.title}
                </span>
                <span className="block text-[9px] font-bold text-slate-400">
                  {petNames?.[row.petId] ? `${petNames[row.petId]} · ` : ''}{formatDate(row.when)}
                  {row.kind === 'booking' ? ` · ${new Date(row.when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
              </span>
              <span className={`text-[8px] font-black uppercase shrink-0 ${
                overdue(row) ? 'text-red-600' : row.kind === 'reminder' ? 'text-amber-600' : 'text-indigo-600'
              }`}>{overdue(row) ? 'OVERDUE' : row.status.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      )}

      {/* In-place detail modal */}
      {viewRow && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={() => setViewRow(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 flex items-center gap-1.5">
                {viewRow.kind === 'reminder' ? <><Bell size={14} className="text-amber-500" /> Reminder</> : <><Calendar size={14} className="text-indigo-500" /> Appointment</>}
              </p>
              <button onClick={() => setViewRow(null)} className="text-slate-400 hover:text-pine dark:hover:text-zinc-200"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              {(viewRow.kind === 'reminder' ? [
                ['Title', viewRow.raw.title],
                ['Due', formatDate(viewRow.raw.dueAt)],
                ['Type', String(viewRow.raw.serviceType || '').replace('_', ' ')],
                ['Status', overdue(viewRow) ? 'OVERDUE' : String(viewRow.raw.status || '').replace('_', ' ')],
                ['Assignee', viewRow.raw.meta?.assignedToName],
                ['Notes', viewRow.raw.notes],
              ] : [
                ['When', `${formatDate(viewRow.raw.scheduledAt)} · ${new Date(viewRow.raw.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`],
                ['Encounter', String(viewRow.raw.encounterType || 'VET_VISIT').replace('_', ' ')],
                ['Status', String(viewRow.raw.status || '').replace('_', ' ')],
                ['Came from', viewRow.raw.sourceDetail],
                ['Staged services', (viewRow.raw.stagedItems || []).map((s: any) => s.name).join(', ')],
                ['Note', viewRow.raw.note],
              ]).filter(([, v]) => v).map(([label, v]) => (
                <div key={String(label)}>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                  <p className="text-xs font-bold text-pine dark:text-zinc-200">{String(v)}</p>
                </div>
              ))}
            </div>
            {/* Inline reminder editor — reschedule/update instead of early completion */}
            {!readOnly && editRow && viewRow.kind === 'reminder' && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <input className="field-input" value={editRow.title} onChange={e => setEditRow({ ...editRow, title: e.target.value })} placeholder="Reminder title" />
                <div className="flex gap-2">
                  <input type="date" className="field-input flex-1" value={editRow.dueDate} onChange={e => setEditRow({ ...editRow, dueDate: e.target.value })} />
                  <select className="field-select flex-1" value={editRow.serviceType} onChange={e => setEditRow({ ...editRow, serviceType: e.target.value })}>
                    {REMINDER_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={savingEdit}
                    className="flex-1 px-3 py-2 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/90 disabled:opacity-50">
                    {savingEdit ? 'Saving…' : 'Save changes'}
                  </button>
                  <button onClick={() => setEditRow(null)} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[9px] font-black uppercase tracking-widest">Cancel</button>
                </div>
              </div>
            )}
            {!readOnly && !editRow && (
              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                {/* Mark done only appears once the due date has arrived; until
                    then the actions are Edit (reschedule) + Delete. */}
                {viewRow.kind === 'reminder' && viewRow.raw.status === 'PENDING' && dueReached(viewRow) && (
                  <button onClick={() => markDone(viewRow)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
                    <CheckCircle2 size={12} /> Mark done
                  </button>
                )}
                {viewRow.kind === 'reminder' && viewRow.raw.status === 'PENDING' && (
                  <button onClick={() => startEdit(viewRow)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all">
                    ✏️ Edit / reschedule
                  </button>
                )}
                <button onClick={() => remove(viewRow)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                  <X size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RemindersApptsTab;

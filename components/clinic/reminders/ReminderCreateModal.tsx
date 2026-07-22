import React, { useState } from 'react';
import { Plus, Loader2, X, BellPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { remindersAPI, REMINDER_SERVICE_META } from '../../../services';
import type { Reminder, ReminderServiceType } from '../../../services';
import UpcomingForPet from '../shared/UpcomingForPet';

const SERVICE_TYPES = Object.keys(REMINDER_SERVICE_META) as ReminderServiceType[];

// Add N days to today and return a yyyy-mm-dd string for the <input type="date">.
const offsetDate = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

interface Props {
  petId: string | number;
  clientId: string | number;
  petLabel?: string;
  // When provided the modal edits this reminder instead of creating a new one.
  existing?: Reminder;
  onClose: () => void;
  onSaved: (reminder?: Reminder) => void;
}

/**
 * Reusable reminder modal — creates a new reminder or, when `existing` is
 * passed, edits it. The patient/owner are fixed by the caller (e.g. the pet
 * profile); the user picks a service type, due date and note. On create,
 * picking a service type seeds the due date from REMINDER_SERVICE_META.
 */
const ReminderCreateModal: React.FC<Props> = ({ petId, clientId, petLabel, existing, onClose, onSaved }) => {
  const isEdit = !!existing;
  const [serviceType, setServiceType] = useState<ReminderServiceType>(existing?.serviceType ?? 'FOLLOW_UP');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [dueAt, setDueAt] = useState(
    existing?.dueAt ? new Date(existing.dueAt).toISOString().slice(0, 10) : offsetDate(REMINDER_SERVICE_META.FOLLOW_UP.days),
  );
  const [saving, setSaving] = useState(false);

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  const onServiceChange = (next: ReminderServiceType) => {
    setServiceType(next);
    // Re-seed the due date to the suggested offset — only when creating, so an
    // edit doesn't clobber the user's existing due date on a type change.
    if (!isEdit) setDueAt(offsetDate(REMINDER_SERVICE_META[next].days));
  };

  const submit = async () => {
    if (!dueAt) { toast.error('Pick a due date'); return; }
    setSaving(true);
    try {
      const payload = {
        serviceType,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        dueAt: new Date(`${dueAt}T09:00`).toISOString(),
      };
      const res = isEdit
        ? await remindersAPI.update(existing!.id, payload)
        : await remindersAPI.create({ petId, clientId, ...payload });
      if (res.success) { toast.success(isEdit ? 'Reminder updated' : 'Reminder created'); onSaved(res.data?.reminder); }
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${isEdit ? 'update' : 'create'} reminder`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2"><BellPlus size={16} className="text-seafoam" /> {isEdit ? 'Edit reminder' : 'New reminder'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-pine"><X size={18} /></button>
        </div>
        {petLabel && (
          <div className="px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl">
            <span className="text-sm font-bold text-pine dark:text-zinc-100">{petLabel}</span>
          </div>
        )}
        {/* Double-entry guard: what's already booked/pending for this patient */}
        {!isEdit && petId && <UpcomingForPet petId={petId} />}
        <div>
          <label className={labelCls}>Service type</label>
          <select className={fieldCls} value={serviceType} onChange={e => onServiceChange(e.target.value as ReminderServiceType)}>
            {SERVICE_TYPES.map(t => <option key={t} value={t}>{REMINDER_SERVICE_META[t].label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Due date</label>
          <input type="date" className={fieldCls} value={dueAt} onChange={e => setDueAt(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Title (optional)</label>
          <input className={fieldCls} value={title} onChange={e => setTitle(e.target.value)} placeholder={REMINDER_SERVICE_META[serviceType].label} />
        </div>
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea rows={2} className={fieldCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything to remember for this reminder?" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
};

export default ReminderCreateModal;

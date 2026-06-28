import React, { useState } from 'react';
import { X, CalendarClock, Loader2 } from 'lucide-react';

/**
 * Capture a new date + time when rescheduling an appointment/reminder.
 */
const RescheduleModal: React.FC<{
  initialIso?: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (iso: string) => void;
}> = ({ initialIso, submitting, onCancel, onConfirm }) => {
  const init = initialIso ? new Date(initialIso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const [date, setDate] = useState(isNaN(init.getTime()) ? '' : `${init.getFullYear()}-${pad(init.getMonth() + 1)}-${pad(init.getDate())}`);
  const [time, setTime] = useState(isNaN(init.getTime()) ? '09:00' : `${pad(init.getHours())}:${pad(init.getMinutes())}`);
  const field = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam';
  const label = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight"><CalendarClock size={16} /> Reschedule</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-pine"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>New date</label><input type="date" className={field} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className={label}>New time</label><input type="time" className={field} value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={() => date && onConfirm(new Date(`${date}T${time}`).toISOString())} disabled={submitting || !date}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />} Reschedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;

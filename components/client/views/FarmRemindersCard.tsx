/**
 * "Coming up" on the farm home: due dates, dry-off dates, low stock — and any
 * advice the connected clinic has left. Derived on the server from the animals'
 * dates and the store, so it is never stale; marking one done keeps it done.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Baby, Milk, PackageOpen, Stethoscope, Check, X } from 'lucide-react';
import { clientPortalAPI, type FarmReminder } from '../../../services/modules/clientPortal.api';
import { fmtDay, rel } from './AnimalBreeding';

const DAY = 86_400_000;
const daysUntil = (iso: string) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - t.getTime()) / DAY);
};
const ICON: Record<string, React.ElementType> = { DUE_SOON: Baby, DRY_OFF: Milk, LOW_STOCK: PackageOpen, ADVICE: Stethoscope };

const FarmRemindersCard: React.FC<{ farmId: string; clinicLinked: boolean }> = ({ farmId, clinicLinked }) => {
  const [items, setItems] = useState<FarmReminder[] | null>(null);

  const load = useCallback(() => {
    clientPortalAPI.listFarmReminders(farmId).then((r) => setItems(r.success && r.data ? r.data.reminders : [])).catch(() => setItems([]));
  }, [farmId]);
  useEffect(() => {
    load();
    window.addEventListener('vethub:farm-reminder', load);
    return () => window.removeEventListener('vethub:farm-reminder', load);
  }, [load]);

  if (!items || items.length === 0) return null;

  const act = async (id: string, status: 'DONE' | 'DISMISSED') => {
    setItems((cur) => (cur ?? []).filter((x) => x.id !== id));
    await clientPortalAPI.setFarmReminderStatus(id, status);
  };

  return (
    <section data-testid="farm-reminders">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><CalendarClock size={12} /> Coming up</h3>
        {clinicLinked && <span className="text-[10px] text-slate-400">Your clinic can see these</span>}
      </div>
      <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
        {items.map((r) => {
          const Icon = ICON[r.kind] ?? CalendarClock;
          const n = daysUntil(r.dueOn);
          const late = n < 0 && r.kind !== 'LOW_STOCK';
          return (
            <div key={r.id} className="px-3.5 py-2.5 flex items-center gap-3">
              <span className={`cp-icon-chip ${late ? '!text-rose-500' : ''}`}><Icon size={16} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{r.title}</p>
                <p className={`text-[10px] ${late ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                  {r.kind === 'LOW_STOCK' ? 'Top it up' : `${fmtDay(r.dueOn)} · ${rel(n)}`}
                  {r.fromClinic ? ` · from ${r.fromClinic}` : ''}
                </p>
                {r.notes && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{r.notes}</p>}
              </div>
              <button className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center" aria-label="Done" onClick={() => act(r.id, 'DONE')}><Check size={15} /></button>
              <button className="w-8 h-8 rounded-full text-slate-300 hover:text-slate-500 flex items-center justify-center" aria-label="Dismiss" onClick={() => act(r.id, 'DISMISSED')}><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FarmRemindersCard;

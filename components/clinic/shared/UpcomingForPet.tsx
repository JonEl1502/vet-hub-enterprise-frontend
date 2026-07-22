import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Calendar } from 'lucide-react';
import { appointmentsAPI, remindersAPI } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

/**
 * Double-entry guard: when a pet is picked in the New Appointment / New
 * Reminder flows, list what's ALREADY scheduled for it (today & future —
 * open bookings + pending reminders) so staff don't create duplicates.
 * Renders nothing when the pet has nothing upcoming.
 */
const UpcomingForPet: React.FC<{ petId: string | number }> = ({ petId }) => {
  const [rows, setRows] = useState<Array<{ kind: 'booking' | 'reminder'; label: string; when: string; status: string }>>([]);

  useEffect(() => {
    if (!petId) { setRows([]); return; }
    let cancelled = false;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    (async () => {
      try {
        const [b, r] = await Promise.all([
          appointmentsAPI.list({ petId: String(petId) } as any).catch(() => null),
          remindersAPI.list({ scope: 'all', petId: String(petId) } as any).catch(() => null),
        ]);
        if (cancelled) return;
        const bookings = ((b as any)?.data?.appointments || [])
          .filter((a: any) => !['CONVERTED', 'CANCELLED', 'NO_SHOW'].includes(a.status) && new Date(a.scheduledAt) >= startOfToday)
          .map((a: any) => ({
            kind: 'booking' as const,
            label: `Appointment · ${(a.encounterType || 'VET_VISIT').replace('_', ' ')}`,
            when: `${formatDate(a.scheduledAt)} ${new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            status: String(a.status || '').toLowerCase(),
          }));
        const reminders = ((r as any)?.data?.reminders || [])
          .filter((rm: any) => rm.status === 'PENDING' && new Date(rm.dueAt) >= startOfToday)
          .map((rm: any) => ({
            kind: 'reminder' as const,
            label: `Reminder · ${rm.title || String(rm.serviceType || '').replace('_', ' ')}`,
            when: formatDate(rm.dueAt),
            status: 'pending',
          }));
        setRows([...bookings, ...reminders].slice(0, 6));
      } catch { /* guard is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [petId]);

  if (rows.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-600">
        <AlertTriangle size={11} /> Already scheduled for this patient — avoid double entries
      </p>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-amber-800 dark:text-amber-300">
          {row.kind === 'booking' ? <Calendar size={10} className="shrink-0" /> : <Bell size={10} className="shrink-0" />}
          <span className="min-w-0 flex-1 truncate">{row.label}</span>
          <span className="shrink-0">{row.when}</span>
          <span className="shrink-0 uppercase text-[8px] tracking-widest opacity-70">{row.status}</span>
        </div>
      ))}
    </div>
  );
};

export default UpcomingForPet;

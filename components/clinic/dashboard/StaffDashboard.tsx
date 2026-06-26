import React, { useState, useEffect, useMemo } from 'react';
import { BellRing, CalendarClock, PackageX, AlertCircle, ChevronRight, Clock } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { remindersAPI, Reminder, REMINDER_SERVICE_META } from '../../../services';
import { formatTime, formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  onNavigate?: (view: string, params?: any) => void;
}

/**
 * Operational dashboard for non-owner staff (no financials): today's reminders,
 * today's appointments, and inventory alerts. The financial overview stays
 * reserved for owner / admin / manager (Epic G).
 */
const StaffDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { appointments, inventory } = useData();
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    remindersAPI.today().then(r => { if (r.success && r.data?.reminders) setReminders(r.data.reminders); }).catch(() => {});
  }, []);

  const todayAppts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (appointments || [])
      .filter((a: any) => (a.date || '').slice(0, 10) === today && a.status !== 'CANCELLED')
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appointments]);

  const stockAlerts = useMemo(() => {
    const soon = Date.now() + 30 * 86400000;
    return (inventory || []).filter((i: any) =>
      i.status === 'OUT_OF_STOCK' || i.status === 'LOW_STOCK' || (i.expiryDate && new Date(i.expiryDate).getTime() < soon)
    ).slice(0, 12);
  }, [inventory]);

  const Card: React.FC<{ title: string; icon: React.ElementType; tone: string; count: number; onAll?: () => void; children: React.ReactNode }> = ({ title, icon: Icon, tone, count, onAll, children }) => (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
        <span className="flex items-center gap-2"><span className={`w-8 h-8 rounded-xl flex items-center justify-center ${tone}`}><Icon size={16} /></span><span className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{title}</span></span>
        <span className="flex items-center gap-1.5"><span className="text-sm font-black text-pine dark:text-zinc-100">{count}</span>{onAll && <button onClick={onAll} className="text-slate-400 hover:text-seafoam"><ChevronRight size={16} /></button>}</span>
      </div>
      <div className="p-3 space-y-1.5 max-h-[360px] overflow-y-auto flex-1">{children}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Reminders due" icon={BellRing} tone="bg-seafoam/10 text-seafoam" count={reminders.length} onAll={() => onNavigate?.('reminders')}>
        {reminders.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-4">Nothing due.</p> : reminders.map(r => {
          const overdue = new Date(r.dueAt).getTime() < Date.now();
          return (
            <button key={r.id} onClick={() => onNavigate?.(r.bookedAppointmentId ? 'appointment-detail' : 'reminders', r.bookedAppointmentId ? { appointmentId: Number(r.bookedAppointmentId) } : undefined)} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-left">
              <span className="min-w-0"><span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{r.pet?.name} · {REMINDER_SERVICE_META[r.serviceType]?.label ?? r.serviceType}</span><span className="block text-[10px] text-slate-400 truncate">{r.client?.name}{r.contactedAt ? ' · contacted' : ''}</span></span>
              <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>{overdue ? 'Overdue' : 'Due'}</span>
            </button>
          );
        })}
      </Card>

      <Card title="Today's appointments" icon={CalendarClock} tone="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" count={todayAppts.length} onAll={() => onNavigate?.('appointments')}>
        {todayAppts.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-4">No appointments today.</p> : todayAppts.map((a: any) => (
          <button key={a.id} onClick={() => onNavigate?.('appointment-detail', { appointmentId: a.id })} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-left">
            <span className="min-w-0"><span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{a.pet?.name ?? 'Patient'}</span><span className="block text-[10px] text-slate-400 truncate">{(a.encounterType || 'VISIT').replace('_', ' ')} · {a.tasks?.length ?? 0} svc</span></span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 shrink-0"><Clock size={11} /> {formatTime(a.date)}</span>
          </button>
        ))}
      </Card>

      <Card title="Inventory alerts" icon={PackageX} tone="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" count={stockAlerts.length} onAll={() => onNavigate?.('inventory')}>
        {stockAlerts.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-4">Stock looks healthy.</p> : stockAlerts.map((i: any) => {
          const expiring = i.expiryDate && new Date(i.expiryDate).getTime() < Date.now() + 30 * 86400000;
          const tag = i.status === 'OUT_OF_STOCK' ? 'Out' : i.status === 'LOW_STOCK' ? 'Low' : expiring ? 'Expiring' : '';
          return (
            <div key={i.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950/40">
              <span className="min-w-0"><span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span><span className="block text-[10px] text-slate-400">{i.quantity} {i.unit}{expiring && i.expiryDate ? ` · exp ${formatDate(i.expiryDate)}` : ''}</span></span>
              <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest shrink-0 ${i.status === 'OUT_OF_STOCK' ? 'text-rose-500' : 'text-amber-600'}`}><AlertCircle size={11} /> {tag}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
};

export default StaffDashboard;

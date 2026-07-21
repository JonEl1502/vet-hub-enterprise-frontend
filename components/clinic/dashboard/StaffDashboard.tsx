import React, { useState, useEffect, useMemo } from 'react';
import { BellRing, CalendarClock, PackageX, AlertCircle, ChevronRight, Clock, MoreVertical, PackagePlus, ExternalLink, Loader2, X } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { remindersAPI, Reminder, REMINDER_SERVICE_META, stockMovementsAPI, toast } from '../../../services';
import { formatTime, formatDate } from '../../../services/utils/dateFormatter';
import { FULL_ACCESS_ROLES, UserRole } from '../../../types';

interface Props {
  onNavigate?: (view: string, params?: any) => void;
}

/**
 * Operational dashboard for non-owner staff (no financials): today's reminders,
 * today's appointments, and inventory alerts. The financial overview stays
 * reserved for owner / admin / manager (Epic G).
 */
const StaffDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { appointments, inventory, refreshInventory } = useData() as any;
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Quick receive-stock straight from an alert row (⋮ menu). Allowed for
  // full-access roles or staff granted the inventory permission.
  const canRestock = !!user && (
    FULL_ACCESS_ROLES.includes(user.role as UserRole)
    || ((user as any).customPermissions ?? []).includes('VIEW_INVENTORY')
  );
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [restockFor, setRestockFor] = useState<any | null>(null);
  const [restockForm, setRestockForm] = useState({ quantity: '', costPrice: '', sellingPrice: '', batchNumber: '' });
  const [restockBusy, setRestockBusy] = useState(false);

  const openRestock = (item: any) => {
    setMenuFor(null);
    setRestockFor(item);
    setRestockForm({ quantity: '', costPrice: String(item.costPrice ?? ''), sellingPrice: String(item.price ?? ''), batchNumber: '' });
  };
  const submitRestock = async () => {
    if (!restockFor) return;
    const qty = Number(restockForm.quantity);
    if (!qty || qty <= 0) { toast.error('Enter a quantity to receive'); return; }
    setRestockBusy(true);
    try {
      const res = await stockMovementsAPI.restock({
        inventoryItemId: String(restockFor.id),
        quantity: qty,
        costPrice: restockForm.costPrice !== '' ? Number(restockForm.costPrice) : undefined,
        sellingPrice: restockForm.sellingPrice !== '' ? Number(restockForm.sellingPrice) : undefined,
        batchNumber: restockForm.batchNumber || undefined,
      });
      if (res.success) {
        toast.success(`Received ${qty} ${restockFor.unit} of ${restockFor.name}`);
        setRestockFor(null);
        refreshInventory?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to receive stock'); }
    finally { setRestockBusy(false); }
  };

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
            <button key={r.id} onClick={() => onNavigate?.(r.bookedAppointmentId ? 'appointment-detail' : 'reminders', r.bookedAppointmentId ? { appointmentId: Number(r.bookedAppointmentId) } : { focusId: String(r.id) })} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-left">
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
            <div key={i.id} className="relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950/40">
              <span className="min-w-0"><span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span><span className="block text-[10px] text-slate-400">{i.quantity} {i.unit}{expiring && i.expiryDate ? ` · exp ${formatDate(i.expiryDate)}` : ''}</span></span>
              <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest shrink-0 ${i.status === 'OUT_OF_STOCK' ? 'text-rose-500' : 'text-amber-600'}`}><AlertCircle size={11} /> {tag}</span>
              <button
                onClick={() => setMenuFor(menuFor === String(i.id) ? null : String(i.id))}
                className="shrink-0 p-1 rounded-md text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-800"
                title="Actions"
              >
                <MoreVertical size={13} />
              </button>
              {menuFor === String(i.id) && (
                <>
                  {/* click-away backdrop */}
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuFor(null)} aria-hidden />
                  <div className="absolute right-1 top-9 z-20 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                    {canRestock && (
                      <button onClick={() => openRestock(i)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[11px] font-bold text-pine dark:text-zinc-100 hover:bg-seafoam/10">
                        <PackagePlus size={13} className="text-seafoam" /> Receive stock
                      </button>
                    )}
                    <button onClick={() => { setMenuFor(null); onNavigate?.('inventory'); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[11px] font-bold text-pine dark:text-zinc-100 hover:bg-seafoam/10">
                      <ExternalLink size={13} className="text-slate-400" /> Open in Stock Manager
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </Card>

      {/* Quick receive-stock modal (from an alert row's ⋮ menu) */}
      {restockFor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !restockBusy && setRestockFor(null)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Receive stock</p>
                <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{restockFor.name}</p>
                <p className="text-[10px] text-slate-400">{restockFor.quantity} {restockFor.unit} on hand</p>
              </div>
              <button onClick={() => !restockBusy && setRestockFor(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Quantity received *</label>
                <input type="number" min={0} step={0.01} autoFocus className="field-input" value={restockForm.quantity} onChange={e => setRestockForm({ ...restockForm, quantity: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="field-label">Batch no.</label>
                <input className="field-input" value={restockForm.batchNumber} onChange={e => setRestockForm({ ...restockForm, batchNumber: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="field-label">Cost price</label>
                <input type="number" min={0} step={0.01} className="field-input" value={restockForm.costPrice} onChange={e => setRestockForm({ ...restockForm, costPrice: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Sale price</label>
                <input type="number" min={0} step={0.01} className="field-input" value={restockForm.sellingPrice} onChange={e => setRestockForm({ ...restockForm, sellingPrice: e.target.value })} />
              </div>
            </div>
            <button onClick={submitRestock} disabled={restockBusy} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-seafoam/90 active:scale-95 disabled:opacity-50">
              {restockBusy ? <Loader2 size={13} className="animate-spin" /> : <PackagePlus size={13} />} Receive stock
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;

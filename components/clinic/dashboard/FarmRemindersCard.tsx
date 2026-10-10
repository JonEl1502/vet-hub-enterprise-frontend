import React, { useCallback, useEffect, useState } from 'react';
import { Baby, Milk, Stethoscope, CalendarClock, Check, MessageSquarePlus, X } from 'lucide-react';
import { livestockAPI, type ClinicFarmReminder } from '../../../services/modules/livestock.api';
import { toast } from '../../../services';

const DAY = 86_400_000;
const daysUntil = (iso: string) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(`${iso}T00:00:00`).getTime() - t.getTime()) / DAY); };
const rel = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days overdue`);
const ICON: Record<string, React.ElementType> = { DUE_SOON: Baby, DRY_OFF: Milk, ADVICE: Stethoscope };

/**
 * Farm clients' animals that need attention — due to calve, to be dried off — and
 * a way to answer with advice. Shown only to a clinic that holds Farms and has
 * farms connected; anything else (403, empty) renders nothing, because this is a
 * notice, not a page. Reloads on the live `farm.reminder` ping.
 */
const FarmRemindersCard: React.FC = () => {
  const [items, setItems] = useState<ClinicFarmReminder[]>([]);
  const [advise, setAdvise] = useState<ClinicFarmReminder | null>(null);
  const load = useCallback(() => {
    livestockAPI.listFarmReminders()
      .then((r) => setItems(r.success && r.data ? r.data.reminders : []))
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
    const onStream = (e: Event) => { if ((e as CustomEvent).detail?.type === 'farm.reminder') load(); };
    window.addEventListener('vethub:stream', onStream);
    return () => window.removeEventListener('vethub:stream', onStream);
  }, [load]);

  if (items.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4" data-testid="clinic-farm-reminders">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2"><CalendarClock size={12} /> Farm clients — coming up</p>
      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
        {items.slice(0, 8).map((r) => {
          const Icon = ICON[r.kind] ?? CalendarClock;
          const n = daysUntil(r.dueOn);
          return (
            <div key={r.id} className="py-2.5 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-seafoam/10 text-seafoam flex items-center justify-center shrink-0"><Icon size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{r.title}</p>
                <p className={`text-[10px] truncate ${n < 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                  {[r.farmName, r.ownerName].filter(Boolean).join(' · ')} · {rel(n)}
                </p>
              </div>
              {r.source === 'SYSTEM' && (
                <button className="shrink-0 text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1" onClick={() => setAdvise(r)}>
                  <MessageSquarePlus size={12} /> Advise
                </button>
              )}
              <button className="shrink-0 w-7 h-7 rounded-full text-slate-300 hover:text-emerald-600 flex items-center justify-center" aria-label="Done"
                onClick={async () => { await livestockAPI.setFarmReminderStatus(r.id, 'DONE'); load(); }}><Check size={15} /></button>
            </div>
          );
        })}
      </div>

      {advise && (
        <AdviseModal
          farmId={advise.farmId} farmAnimalId={advise.farmAnimalId} context={`${advise.title} · ${advise.farmName ?? ''}`}
          onClose={() => setAdvise(null)} onSent={() => { setAdvise(null); load(); }}
        />
      )}
    </div>
  );
};

/** Leave advice or a follow-up for the farmer — shared by the home card and the farm view. */
export const AdviseModal: React.FC<{
  farmId: string; farmAnimalId?: string | null; context: string; onClose: () => void; onSent: () => void;
}> = ({ farmId, farmAnimalId, context, onClose, onSent }) => {
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const r = await livestockAPI.addFarmReminder({ farmId, farmAnimalId: farmAnimalId ?? undefined, title: text.trim(), dueOn: date || undefined });
      if (r.success) { toast.success('Sent to the farmer'); onSent(); }
    } finally { setSaving(false); }
  };
  return (
    <div className="farm-skin !bg-transparent !p-0 fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="cp-card relative w-full sm:max-w-md !rounded-b-none sm:!rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black" style={{ color: 'var(--cp-ink)' }}>Advise the farmer</p>
            <p className="text-[11px] cp-muted">{context}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="cp-icon-btn cp-icon-btn-ghost"><X size={16} /></button>
        </div>
        <textarea className="field-input w-full" rows={3} placeholder="e.g. Dry her off on the 10th and book a pre-calving check" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <div>
          <label className="field-label">Remind on (optional)</label>
          <input className="field-input w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="cp-btn w-full" disabled={saving || !text.trim()} onClick={send}>{saving ? 'Sending…' : 'Send to farmer'}</button>
      </div>
    </div>
  );
};

export default FarmRemindersCard;

import React, { useState, useEffect, useCallback } from 'react';
import { Home, Loader2, Utensils, Footprints, Pill, ExternalLink, ClipboardList } from 'lucide-react';
import { boardingAPI, BoardingStay } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

interface Props {
  stayId: string;
  // Jump to the boarding stay drawer/page to log new care entries.
  onOpenStay?: (stayId: string) => void;
}

/**
 * Read-only view of a boarding stay's daily care log (feeding, walking, meds,
 * appetite, stool, notes), surfaced in the appointment's "Care Log" tab so the
 * clinical record area shows the boarding activity instead of an empty chart.
 * Logging new entries still happens on the Boarding page / stay drawer.
 */
const BoardingCareLogPanel: React.FC<Props> = ({ stayId, onOpenStay }) => {
  const [stay, setStay] = useState<BoardingStay | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await boardingAPI.getById(stayId);
      if (res.success && res.data?.stay) setStay(res.data.stay);
    } catch (e) { console.error('Failed to load boarding stay', e); }
    finally { setLoading(false); }
  }, [stayId]);

  useEffect(() => { load(); }, [load]);

  const logs = stay?.dailyLogs ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 gap-3">
        <div>
          <h4 className="text-base sm:text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase flex items-center gap-2"><Home size={18} className="text-amber-500" /> Care Log</h4>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium mt-0.5">Boarding daily care — feeding, walks, meds & notes</p>
        </div>
        <button onClick={() => onOpenStay?.(stayId)} className="flex items-center gap-1.5 px-3 py-2 bg-seafoam/10 text-seafoam hover:bg-seafoam/20 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 transition-all">
          <ExternalLink size={13} /> Open stay
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-seafoam" /></div>
      ) : !stay ? (
        <p className="text-sm text-slate-400 text-center py-10">Boarding stay not found.</p>
      ) : (
        <>
          {/* Stay summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Kennel" value={stay.kennel || '—'} />
            <Stat label="Dropped off" value={formatDate(stay.dropOffAt)} />
            <Stat label={stay.status === 'CHECKED_OUT' ? 'Checked out' : 'Pickup'} value={stay.status === 'CHECKED_OUT' && stay.actualPickupAt ? formatDate(stay.actualPickupAt) : stay.expectedPickupAt ? formatDate(stay.expectedPickupAt) : '—'} />
            <Stat label="Daily rate" value={stay.dailyRate != null ? `KES ${stay.dailyRate.toLocaleString()}` : '—'} />
          </div>

          {/* Care feeds & instructions */}
          {(stay.feedingInstructions || stay.medicationInstructions || stay.specialInstructions) && (
            <div className="space-y-2">
              {stay.feedingInstructions && <Instruction icon={Utensils} label="Feeding" text={stay.feedingInstructions} />}
              {stay.medicationInstructions && <Instruction icon={Pill} label="Medication" text={stay.medicationInstructions} />}
              {stay.specialInstructions && <Instruction icon={ClipboardList} label="Special" text={stay.specialInstructions} />}
            </div>
          )}

          {/* Daily log history */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Daily entries</p>
            {logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map(l => (
                  <div key={l.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-black text-pine dark:text-zinc-200">{formatDate(l.logDate)}</span>
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
                        {l.fedAm && <span className="flex items-center gap-0.5 text-emerald-600"><Utensils size={10} /> AM</span>}
                        {l.fedPm && <span className="flex items-center gap-0.5 text-emerald-600"><Utensils size={10} /> PM</span>}
                        {l.walked && <span className="flex items-center gap-0.5 text-seafoam"><Footprints size={10} /> Walk</span>}
                        {l.medicationGiven && <span className="flex items-center gap-0.5 text-indigo-500"><Pill size={10} /> Med</span>}
                      </span>
                    </div>
                    {(l.appetite || l.stool || l.notes || l.foodNotes) && (
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                        {l.appetite && `Appetite: ${l.appetite}. `}{l.stool && `Stool: ${l.stool}. `}{l.foodNotes && `Ate: ${l.foodNotes}. `}{l.notes}
                      </p>
                    )}
                    {l.mealPhoto && <img src={l.mealPhoto} alt="meal" className="mt-2 w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-zinc-800" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-10 bg-slate-50 dark:bg-zinc-950/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                <ClipboardList size={24} className="text-slate-300 dark:text-zinc-700 mb-2" />
                <p className="text-xs font-bold text-slate-400">No care log entries yet</p>
                <button onClick={() => onOpenStay?.(stayId)} className="mt-2 text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline">Log care on the stay →</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-xs font-bold text-pine dark:text-zinc-100 mt-0.5 truncate">{value}</p>
  </div>
);

const Instruction: React.FC<{ icon: React.ElementType; label: string; text: string }> = ({ icon: Icon, label, text }) => (
  <div className="flex items-start gap-2 px-3 py-2 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-900/30 rounded-xl">
    <Icon size={13} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
    <span className="text-[11px] text-slate-600 dark:text-zinc-300"><span className="font-black uppercase tracking-wider text-[9px] text-amber-700 dark:text-amber-400 mr-1.5">{label}</span>{text}</span>
  </div>
);

export default BoardingCareLogPanel;

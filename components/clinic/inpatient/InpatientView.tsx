import React, { useState, useEffect, useCallback } from 'react';
import { Stethoscope, Plus, BedDouble, Loader2, Pill, ClipboardCheck } from 'lucide-react';
import { inpatientAPI, Hospitalization } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import { formatDate } from '../../../services/utils/dateFormatter';
import AdmitInpatientModal from './AdmitInpatientModal';
import InpatientChartDrawer from './InpatientChartDrawer';

const daysIn = (admittedAt: string) => Math.max(0, Math.floor((Date.now() - new Date(admittedAt).getTime()) / 86400000)) + 1;

const InpatientView: React.FC = () => {
  const { pets } = useData();
  const [board, setBoard] = useState<Hospitalization[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inpatientAPI.board();
      if (res.success && res.data) { setBoard(res.data.board); setTotal(res.data.totalInpatients); }
    } catch (e) { console.error('Failed to load hospital board', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center"><Stethoscope size={22} className="text-red-600 dark:text-red-400" /></div>
          <div>
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Hospital Board</h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">{total} inpatient{total === 1 ? '' : 's'} in care</p>
          </div>
        </div>
        <button onClick={() => setAdmitOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95"><Plus size={14} /> Admit</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-seafoam" /></div>
      ) : board.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <BedDouble size={28} className="text-slate-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-slate-400">No inpatients right now</p>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Use “Admit” to hospitalize a patient.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {board.map(h => (
            <button key={h.id} onClick={() => setSelectedId(h.id)} className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-seafoam transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">{h.pet?.species === 'Cat' ? '🐱' : '🐶'}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-pine dark:text-zinc-100 truncate">{h.pet?.name}</span>
                    <span className="block text-[10px] text-slate-400 truncate">{h.diagnosis || 'No diagnosis'}</span>
                  </span>
                </span>
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest">Day {daysIn(h.admittedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                <span>{h.cage ? `Cage ${h.cage}` : 'No cage'}{h.clinician ? ` · ${h.clinician.name}` : ''}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {!!h.tasksDue && <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><ClipboardCheck size={11} /> {h.tasksDue}</span>}
                  {!!h.medsDue && <span className="flex items-center gap-0.5 text-indigo-500"><Pill size={11} /> {h.medsDue}</span>}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <AdmitInpatientModal isOpen={admitOpen} onClose={() => setAdmitOpen(false)} pets={pets} onAdmitted={load} />
      <InpatientChartDrawer hospId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
    </div>
  );
};

export default InpatientView;

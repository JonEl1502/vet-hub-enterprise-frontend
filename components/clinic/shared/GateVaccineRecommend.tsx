import React from 'react';
import { Syringe } from 'lucide-react';
import { VACCINES } from '../../../constants/vaccines';

interface Props {
  recommended: Record<string, boolean>;
  onToggle: (key: string) => void;
  clientAgreed: boolean;
  onAgreed: (v: boolean) => void;
}

/**
 * Shown at an admission gate when the vaccination check is unknown/none:
 * instead of blocking, staff RECOMMEND vaccines. If the client agrees, the
 * selected vaccines are added to the visit (transfer to vet visit for
 * vaccination); either way a journey event logs WHO recommended and at WHICH
 * gate, for later stats.
 */
const GateVaccineRecommend: React.FC<Props> = ({ recommended, onToggle, clientAgreed, onAgreed }) => (
  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2.5">
    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
      <Syringe size={12} /> No vaccination on record — recommend
    </p>
    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
      Pick the vaccines you recommend. Your recommendation is logged on the visit journey under your name.
    </p>
    <div className="flex flex-wrap gap-1.5">
      {VACCINES.map(v => (
        <button
          key={v.key}
          type="button"
          onClick={() => onToggle(v.key)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
            recommended[v.key]
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-amber-400'
          }`}
        >
          {recommended[v.key] ? '✓ ' : ''}{v.label}
        </button>
      ))}
    </div>
    <label className="flex items-center gap-2 text-xs font-bold text-pine dark:text-zinc-100 cursor-pointer">
      <input type="checkbox" checked={clientAgreed} onChange={e => onAgreed(e.target.checked)} />
      Client agreed — transfer to vet visit for vaccination
    </label>
  </div>
);

export default GateVaccineRecommend;

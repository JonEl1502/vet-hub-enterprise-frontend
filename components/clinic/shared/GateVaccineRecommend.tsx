import React from 'react';
import { Syringe, Plus, Search } from 'lucide-react';
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
const GateVaccineRecommend: React.FC<Props> = ({ recommended, onToggle, clientAgreed, onAgreed }) => {
  // Same shape as the vaccination check above it: three chips plus anything
  // picked, the rest behind a searchable "+ Add" (user, 2026-11-26).
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [extra, setExtra] = React.useState<string[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const visible = (v: { key: string }, i: number) => i < 3 || !!recommended[v.key] || extra.includes(v.key);
  const hidden = VACCINES.filter((v, i) => !visible(v, i));
  const matches = hidden.filter(v => v.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2.5">
    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
      <Syringe size={12} /> No vaccination on record — recommend
    </p>
    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
      Pick the vaccines you recommend. Your recommendation is logged on the visit journey under your name.
    </p>
    <div className="flex flex-wrap gap-1.5 items-center">
      {VACCINES.filter(visible).map(v => (
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
      {hidden.length > 0 && (
        <div className="relative" ref={ref}>
          <button type="button" onClick={() => { setOpen(o => !o); setQ(''); }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-dashed border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-all">
            <Plus size={11} /> Add
          </button>
          {open && (
            <div className="absolute z-30 mt-1 left-0 w-64 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-2">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800">
                <Search size={12} className="text-slate-400 shrink-0" />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search vaccines…"
                  className="w-full bg-transparent text-[12px] font-bold outline-none text-slate-700 dark:text-zinc-200" />
              </div>
              <div className="max-h-56 overflow-y-auto mt-1">
                {matches.map(v => (
                  <button key={v.key} type="button"
                    onClick={() => { setExtra(x => [...x, v.key]); if (!recommended[v.key]) onToggle(v.key); setOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] font-bold text-slate-600 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                    {v.label}
                  </button>
                ))}
                {matches.length === 0 && <p className="px-2 py-2 text-[11px] font-bold text-slate-400">No vaccine matches.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    <label className="flex items-center gap-2 text-xs font-bold text-pine dark:text-zinc-100 cursor-pointer">
      <input type="checkbox" checked={clientAgreed} onChange={e => onAgreed(e.target.checked)} />
      Client agreed — transfer to vet visit for vaccination
    </label>
  </div>
  );
};

export default GateVaccineRecommend;

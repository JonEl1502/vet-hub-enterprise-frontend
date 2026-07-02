import React from 'react';

// Small shared primitives for wizard step forms. Everything leans on the
// global .field-* control standard from index.css.

export const Section: React.FC<{ icon?: React.ElementType; title: string; children: React.ReactNode; tone?: 'red' }> = ({ icon: Icon, title, children, tone }) => (
  <section className={`border rounded-xl p-4 space-y-3 ${tone === 'red' ? 'border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
    <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-zinc-500'}`}>
      {Icon && <Icon size={11} />} {title}
    </p>
    {children}
  </section>
);

export const L: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
  <div className={className}>
    <label className="field-label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);

// Single-select pill row (Seg) — same visual language as triage CheckChip.
export const Seg: React.FC<{ options: string[]; value?: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(o => (
      <button key={o} type="button" onClick={() => onChange(o)}
        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${value === o ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'}`}>
        {o}
      </button>
    ))}
  </div>
);

// Multi-select checklist rendered as a grid of tick rows.
export const CheckGrid: React.FC<{
  items: { k: string; label: string }[];
  value: Record<string, boolean> | undefined;
  onToggle: (k: string, label: string, on: boolean) => void;
  cols?: string;
}> = ({ items, value, onToggle, cols = 'grid-cols-1 sm:grid-cols-2' }) => (
  <div className={`grid ${cols} gap-1.5`}>
    {items.map(it => {
      const on = !!value?.[it.k];
      return (
        <button key={it.k} type="button" onClick={() => onToggle(it.k, it.label, !on)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${on ? 'border-seafoam bg-seafoam/10' : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 hover:border-seafoam/40'}`}>
          <span className={`w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center text-[9px] font-black ${on ? 'bg-seafoam text-white' : 'border border-slate-300 dark:border-zinc-700'}`}>{on ? '✓' : ''}</span>
          <span className={`text-[11px] font-bold ${on ? 'text-pine dark:text-zinc-100' : 'text-slate-500 dark:text-zinc-400'}`}>{it.label}</span>
        </button>
      );
    })}
  </div>
);

// Free-list editor: type + add, remove with ×. Used for problem lists,
// procedures, care-plan items…
export const ListEditor: React.FC<{
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  onAdd?: (item: string) => void;
  badge?: (item: string, i: number) => React.ReactNode;
}> = ({ items, onChange, placeholder, onAdd, badge }) => {
  const [draft, setDraft] = React.useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    onAdd?.(v);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((it, i) => (
            <div key={`${it}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
              <span className="text-[10px] font-black text-slate-400 w-4">{i + 1}.</span>
              <span className="flex-1 text-[12px] font-bold text-pine dark:text-zinc-100">{it}</span>
              {badge?.(it, i)}
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 text-sm leading-none">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className="field-input flex-1" placeholder={placeholder} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button type="button" onClick={add} className="px-3 h-9 bg-seafoam/10 text-seafoam rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-all shrink-0">Add</button>
      </div>
    </div>
  );
};

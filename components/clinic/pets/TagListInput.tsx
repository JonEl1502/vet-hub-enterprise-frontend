import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface Props {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  icon?: React.ElementType;
  // Tailwind classes for the chips — lets callers tint allergies (red) vs
  // chronic conditions (amber) etc.
  chipClass?: string;
}

/**
 * Lightweight chip/tag editor for string-array fields (allergies, chronic
 * conditions). Type + Enter or comma to add; click × to remove. Trims and
 * de-dupes (case-insensitive).
 */
const TagListInput: React.FC<Props> = ({
  label, items, onChange, placeholder, icon: Icon,
  chipClass = 'bg-seafoam/10 text-seafoam',
}) => {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([...items, v]);
    setDraft('');
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && items.length) {
      remove(items.length - 1);
    }
  };

  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
        {Icon && <Icon size={13} className="inline -mt-0.5 mr-1.5 text-slate-400" />}
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-seafoam">
        {items.map((it, i) => (
          <span key={i} className={`flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[11px] font-bold ${chipClass}`}>
            {it}
            <button type="button" onClick={() => remove(i)} className="hover:opacity-70" aria-label={`Remove ${it}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={items.length ? '' : (placeholder || 'Type and press Enter')}
          className="flex-1 min-w-[120px] bg-transparent py-1 text-sm text-pine dark:text-zinc-100 outline-none placeholder:text-slate-400"
        />
        {draft.trim() && (
          <button type="button" onClick={() => add(draft)} className="text-slate-400 hover:text-seafoam" aria-label="Add">
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TagListInput;

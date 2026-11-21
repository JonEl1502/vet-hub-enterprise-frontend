import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * The clinic's OWN conditions on a procedure — typed, not picked.
 *
 * In heat · Pregnant · Emergency · Out of hours were the only conditions a
 * pricing rule could test, and a vet said that boxed him in (2026-11-21):
 * "obese", "aggressive", "brachycephalic" change the price of a spay just as
 * much. Staff type a condition once; after that it shows as a chip that can be
 * toggled like the built-in four. Matching on the server ignores case and
 * spacing, so "Obese" and "obese " are the same condition.
 *
 * - `options`  chips to offer (conditions already used on this procedure)
 * - `selected` the ones that are ON
 * - `allowAdd` show the "Add your own" box
 */
interface Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allowAdd?: boolean;
  /** Small chips for the visit panel; default matches the editor. */
  size?: 'sm' | 'md';
  placeholder?: string;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export const uniqConditions = (list: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (!t || seen.has(norm(t))) continue;
    seen.add(norm(t));
    out.push(t);
  }
  return out;
};

const ConditionChips: React.FC<Props> = ({ options, selected, onChange, allowAdd = true, size = 'md', placeholder = 'Add your own…' }) => {
  const [text, setText] = useState('');
  const on = new Set(selected.map(norm));
  const all = uniqConditions([...options, ...selected]);
  const pad = size === 'sm' ? 'px-2.5 py-1.5 rounded-lg' : 'px-3 py-1.5 rounded-xl';

  const toggle = (c: string) =>
    onChange(on.has(norm(c)) ? selected.filter((x) => norm(x) !== norm(c)) : uniqConditions([...selected, c]));

  const add = () => {
    const t = text.trim();
    if (!t) return;
    if (!on.has(norm(t))) onChange(uniqConditions([...selected, t]));
    setText('');
  };

  return (
    <>
      {all.map((c) => {
        const active = on.has(norm(c));
        return (
          <button
            key={norm(c)}
            type="button"
            onClick={() => toggle(c)}
            className={`${pad} inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider border ${
              active ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'
            }`}
            title={active ? 'On — tap to turn off' : 'Off — tap to turn on'}
          >
            {c}
            {active && allowAdd && <X size={10} className="opacity-60" />}
          </button>
        );
      })}
      {allowAdd && (
        <span className={`inline-flex items-center gap-1 ${pad} border border-dashed border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900`}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={placeholder}
            maxLength={40}
            className="w-28 bg-transparent text-[11px] font-bold text-pine dark:text-zinc-100 outline-none placeholder:text-slate-400 placeholder:font-semibold"
            aria-label="Add a condition"
          />
          <button type="button" onClick={add} disabled={!text.trim()} className="text-seafoam disabled:opacity-30" aria-label="Add condition">
            <Plus size={12} />
          </button>
        </span>
      )}
    </>
  );
};

export default ConditionChips;

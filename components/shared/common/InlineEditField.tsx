import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Lock, Pencil, Plus, X } from 'lucide-react';

export interface InlineSelectGroup {
  label: string;
  options: { value: string; label: string }[];
}

interface Props {
  label: string;
  icon?: React.ElementType;
  /** The stored value; '' when there is none yet. */
  value: string;
  /** How the value reads when not being edited. Defaults to the value. */
  display?: React.ReactNode;
  type?: 'text' | 'email' | 'tel' | 'date' | 'select';
  /** For `select`: grouped options. */
  groups?: InlineSelectGroup[];
  placeholder?: string;
  /** Shown under the input while editing. */
  hint?: string;
  /** False = read-only (a system value, or the viewer may not change it). */
  editable?: boolean;
  /** Why it is read-only; shown as a tooltip next to the lock. */
  lockedReason?: string;
  /** Whether the value may be emptied. Required fields cannot be. */
  allowClear?: boolean;
  /** Return a message to refuse the value, or null to accept it. */
  validate?: (next: string) => string | null;
  /** Resolve true once saved; false keeps the editor open for another try. */
  onSave: (next: string) => Promise<boolean>;
}

/**
 * One field of a profile that edits where it stands.
 *
 * Click the value, change it, Enter (or the tick) saves, Escape (or the cross)
 * cancels. A failed save leaves the editor open with what was typed — the
 * caller has already said why. An EMPTY value is not a dash: it reads as
 * "Add <field>" so missing data is something you can see and fix in one click.
 */
const InlineEditField: React.FC<Props> = ({
  label,
  icon: Icon,
  value,
  display,
  type = 'text',
  groups,
  placeholder,
  hint,
  editable = true,
  lockedReason,
  allowClear = false,
  validate,
  onSave,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // Seed the draft when the editor opens — never while typing.
  useEffect(() => {
    if (!editing) return;
    setDraft(value);
    setError(null);
    inputRef.current?.focus();
    if (inputRef.current instanceof HTMLInputElement && type !== 'date') inputRef.current.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const next = draft.trim();
  const changed = next !== value;
  const emptyRefused = next === '' && !allowClear;
  const canSave = changed && !emptyRefused && !saving;

  const commit = async () => {
    if (!canSave) return;
    const problem = next === '' ? null : validate?.(next) ?? null;
    if (problem) { setError(problem); return; }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const cancel = () => { if (!saving) setEditing(false); };

  const labelRow = (
    <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500 mb-0.5">
      {Icon && <Icon size={12} className="shrink-0" />} {label}
      {!editable && (
        <span title={lockedReason || 'Cannot be edited'} className="inline-flex"><Lock size={10} className="shrink-0 opacity-60" /></span>
      )}
    </p>
  );

  if (!editing) {
    const empty = value === '';
    const shown = display ?? value;
    if (!editable) {
      return (
        <div className="min-w-0">
          {labelRow}
          <p className="text-[13px] font-bold text-pine dark:text-zinc-100 truncate" title={String(value)}>
            {empty ? '—' : shown}
          </p>
        </div>
      );
    }
    return (
      <div className="min-w-0">
        {labelRow}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={empty ? `Add ${label}` : `Edit ${label}`}
          className="group -mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-lg px-1.5 py-0.5 text-left hover:bg-slate-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seafoam"
        >
          {empty ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-seafoam">
              <Plus size={12} className="shrink-0" /> Add {label.toLowerCase()}
            </span>
          ) : (
            <span className="min-w-0 truncate text-[13px] font-bold text-pine dark:text-zinc-100" title={String(value)}>{shown}</span>
          )}
          {!empty && (
            <Pencil size={12} className="shrink-0 text-slate-400 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100" />
          )}
        </button>
      </div>
    );
  }

  const fieldClass =
    'min-w-0 flex-1 h-8 rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 text-[13px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam disabled:opacity-60';

  return (
    <div className="min-w-0">
      {labelRow}
      <div className="flex items-center gap-1.5">
        {type === 'select' ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } }}
            className={fieldClass}
            aria-label={label}
          >
            {(groups || []).map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={draft}
            disabled={saving}
            placeholder={placeholder}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
            className={fieldClass}
            aria-label={label}
          />
        )}
        <button
          type="button"
          onClick={commit}
          disabled={!canSave}
          aria-label={`Save ${label}`}
          className="h-8 w-8 shrink-0 rounded-lg bg-pine dark:bg-zinc-100 text-white dark:text-pine flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label={`Cancel editing ${label}`}
          className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 active:scale-95 transition"
        >
          <X size={14} />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-[10px] font-bold text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[10px] text-slate-400 dark:text-zinc-500 leading-snug">{hint}</p>
      ) : null}
    </div>
  );
};

export default InlineEditField;

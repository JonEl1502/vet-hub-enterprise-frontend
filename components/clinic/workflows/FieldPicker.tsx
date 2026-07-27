import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Loader2, X, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowTemplatesAPI, FormField, FieldType } from '../../../services';

/**
 * "Search a field, or create it if it does not exist" — the builder's field
 * picker.
 *
 * Creating always produces a `custom.<slug>` key, namespaced by the backend so
 * a clinic's field can never collide with a core key we ship later. The key is
 * permanent; the label is what gets renamed afterwards.
 */

interface Props {
  /** Keys already placed in this stage — shown as taken, not offered again. */
  placedKeys: Set<string>;
  /** Leaves already claimed in this stage; a clash would overwrite data. */
  claimedLeaves: Set<string>;
  onPick: (field: FormField) => void;
  onClose: () => void;
}

// Types a clinic can create. `native` is deliberately absent: those blocks are
// code-rendered (medication table, reminders, diagnostic requests) and can be
// positioned but never brought into being from here.
const CREATABLE: { value: FieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Short text', hint: 'One line' },
  { value: 'textarea', label: 'Paragraph', hint: 'Multi-line notes' },
  { value: 'number', label: 'Number', hint: 'Numeric, with optional unit' },
  { value: 'select', label: 'Dropdown', hint: 'Pick one from a list' },
  { value: 'seg', label: 'Pill row', hint: 'Pick one, always visible' },
  { value: 'checks', label: 'Checklist', hint: 'Tick any number' },
  { value: 'date', label: 'Date', hint: 'Calendar picker' },
  { value: 'staff', label: 'Staff', hint: 'Pick a team member' },
  { value: 'list', label: 'Free list', hint: 'Type and add rows' },
  { value: 'normalAbnormal', label: 'Normal / findings', hint: 'Tick normal, or describe' },
];

const leafOf = (key: string) => key.split('.').pop() || key;

const FieldPicker: React.FC<Props> = ({ placedKeys, claimedLeaves, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState<FieldType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newUnit, setNewUnit] = useState('');

  const search = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const res = await workflowTemplatesAPI.searchFields(term, 60);
      if (res.success && res.data?.fields) setResults(res.data.fields);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => search(q), 220);
    return () => clearTimeout(t);
  }, [q, search]);

  const needsOptions = newType === 'select' || newType === 'seg' || newType === 'checks';

  const create = async () => {
    const label = q.trim();
    if (!label) return;
    setCreating(true);
    try {
      const res = await workflowTemplatesAPI.createField({
        label,
        fieldType: newType,
        options: needsOptions
          ? newOptions.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        unit: newUnit.trim() || null,
      });
      if (res.success && res.data?.field) {
        toast.success(`"${label}" added to your fields`);
        onPick(res.data.field);
      } else {
        toast.error(res.message || 'Could not create the field');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the field');
    } finally { setCreating(false); }
  };

  // An exact-label match means "create" would just duplicate what exists.
  const exactExists = useMemo(
    () => results.some(f => f.label.toLowerCase() === q.trim().toLowerCase()),
    [results, q],
  );

  return (
    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
        <Search size={13} className="text-slate-400 shrink-0" />
        <input
          autoFocus
          className="flex-1 bg-transparent text-[12px] font-bold text-pine dark:text-zinc-100 outline-none placeholder:text-slate-400 placeholder:font-medium"
          placeholder="Search a field, or type a new name…"
          value={q}
          onChange={e => { setQ(e.target.value); setShowCreate(false); }}
        />
        {loading && <Loader2 size={13} className="animate-spin text-slate-400" />}
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {results.map(f => {
          const placed = placedKeys.has(f.key);
          // Two different fields whose keys end in the same segment would both
          // write to data[stage][leaf] — the second would clobber the first.
          const leafTaken = !placed && claimedLeaves.has(leafOf(f.key));
          const blocked = placed || leafTaken;
          return (
            <button
              key={f.id}
              type="button"
              disabled={blocked}
              onClick={() => onPick(f)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-slate-100 dark:border-zinc-800/60 last:border-0 transition-colors ${
                blocked ? 'opacity-45 cursor-not-allowed' : 'hover:bg-seafoam/5'
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{f.label}</span>
                <span className="block text-[9px] font-mono text-slate-400 truncate">{f.key}</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 shrink-0">
                {f.fieldType}
              </span>
              {f.isCore && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-seafoam/10 text-seafoam shrink-0">Core</span>
              )}
              {placed && <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 shrink-0">Added</span>}
              {leafTaken && (
                <span title={`Another field already stores to "${leafOf(f.key)}" in this stage`} className="shrink-0">
                  <Lock size={11} className="text-amber-500" />
                </span>
              )}
            </button>
          );
        })}

        {!loading && !results.length && (
          <p className="px-3 py-4 text-[11px] text-slate-400 text-center">
            {q.trim() ? 'No field matches — create it below.' : 'Type to search your clinic’s fields and the core set.'}
          </p>
        )}
      </div>

      {/* Create-if-missing */}
      {q.trim() && !exactExists && (
        <div className="border-t border-slate-200 dark:border-zinc-800 p-3 space-y-2 bg-slate-50/60 dark:bg-zinc-950/40">
          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline"
            >
              <Plus size={12} /> Create “{q.trim()}”
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {CREATABLE.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    title={t.hint}
                    onClick={() => setNewType(t.value)}
                    className={`px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all ${
                      newType === t.value
                        ? 'bg-seafoam text-white border-seafoam'
                        : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {needsOptions && (
                <div>
                  <label className="field-label">Options — one per line</label>
                  <textarea
                    className="field-textarea"
                    rows={3}
                    placeholder={'Normal\nIncreased\nDecreased'}
                    value={newOptions}
                    onChange={e => setNewOptions(e.target.value)}
                  />
                </div>
              )}

              {newType === 'number' && (
                <div>
                  <label className="field-label">Unit (optional)</label>
                  <input className="field-input" placeholder="kg, °C, bpm…" value={newUnit} onChange={e => setNewUnit(e.target.value)} />
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={create}
                  disabled={creating || (needsOptions && !newOptions.trim())}
                  className="flex items-center gap-1.5 px-3 py-2 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create & add
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-pine">
                  Cancel
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-relaxed">
                Saved to your clinic as <span className="font-mono">custom.…</span>. The name can be changed later; the
                underlying key never changes, so recorded answers stay attached.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldPicker;

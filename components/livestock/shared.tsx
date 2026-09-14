/**
 * Shared primitives for the Livestock module — every view is the same shape
 * (header + farm filter + list + create/edit modal), so the chrome lives here
 * and each view only describes its own fields.
 *
 * ⚠️ THESE ARE THE CLINIC APP'S CARDS, NOT A SECOND SET.
 *
 * User, 2026-09-14: *"i dont like the farm ui in clinic/practitioner"* — the
 * farm pages sit inside the clinic shell, under the clinic's own sidebar, and
 * read as a different product once you are in them. Measured against
 * `components/clinic`, the divergence was narrow and specific: the clinic's
 * primary action is `bg-seafoam` (366 uses to pine's 163), its cards carry
 * `shadow-sm` (133 uses) and lift to `hover:border-seafoam/60`, and its empty
 * states are a dashed `border-slate-300` panel. This module had a pine primary,
 * one shadow in the entire file, and its own empty-state weight.
 *
 * So the fix is to ADOPT those classes rather than invent a third style. When
 * the clinic's idiom moves, this file follows it — it is not a parallel
 * design system and must never become one.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Loader2, Warehouse } from 'lucide-react';
import type { Farm } from '../../services/modules/livestock.api';
import PageHeader from '../shared/common/PageHeader';

export const SPECIES = ['CATTLE', 'GOAT', 'SHEEP', 'POULTRY', 'PIG', 'RABBIT', 'FISH', 'CAMEL', 'DONKEY', 'OTHER'];
export const PURPOSES = ['DAIRY', 'MEAT', 'LAYERS', 'BROILERS', 'BREEDING', 'WOOL', 'DRAUGHT', 'OTHER'];
export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];
export const UNITS = ['KG', 'LITRES', 'TRAYS', 'PIECES', 'BALES', 'BAGS'];

export const LivestockPage: React.FC<{
  title: string;
  subtitle: string;
  icon: any;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, actions, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="space-y-5 pb-20"
  >
    <PageHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />
    {children}
  </motion.div>
);

export const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({
  onClick, children, disabled,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="px-4 py-2.5 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-95 disabled:opacity-40 transition-all"
  >
    <Plus size={14} /> {children}
  </button>
);

export const EmptyState: React.FC<{ icon: React.ElementType; title: string; hint: string }> = ({
  icon: Icon, title, hint,
}) => (
  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center space-y-3">
    <Icon size={24} className="mx-auto text-slate-300 dark:text-zinc-700" />
    <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">{title}</p>
    <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">{hint}</p>
  </div>
);

/** Farm filter used by every child view. Null value = "All farms". */
export const FarmFilter: React.FC<{
  farms: Farm[];
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}> = ({ farms, value, onChange, allowAll = true }) => (
  <div className="flex items-center gap-2">
    <Warehouse size={14} className="text-slate-400 shrink-0" />
    <select className="field-select max-w-xs" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAll && <option value="">All farms</option>}
      {!allowAll && <option value="">Select a farm…</option>}
      {farms.map((f) => (
        <option key={f.id} value={f.id}>{f.name}</option>
      ))}
    </select>
  </div>
);

/**
 * A dropdown of the sensible answers, with "Other" that lets you type.
 *
 * User, 2026-09-14: *"breed for farm animals please to be dropdown, other to
 * allow typing."* The field was free text with a placeholder of *"e.g.
 * Friesian"* — shown, in the screenshot that prompted this, on a flock of
 * POULTRY. A free-text breed on a Kenyan farm collects "fresian", "Fresian",
 * "friesian x" and "F1" as four different breeds, and the suggestion was
 * actively wrong for most species.
 *
 * ⚠️ THE LIST IS NEVER A CAGE. Kenya keeps crosses and landraces that are on
 * nobody's list, so "Other" is always present and always types free text — and
 * a value already stored that is not in the list opens in that mode rather than
 * being silently dropped, which is the classic way a dropdown eats existing
 * data.
 */
export const PickOrType: React.FC<{
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Shown as the empty choice — "—" for optional fields. */
  emptyLabel?: string;
}> = ({ options, value, onChange, placeholder, emptyLabel = '—' }) => {
  const inList = (v: string) => options.some((o) => o.toLowerCase() === v.trim().toLowerCase());
  const [other, setOther] = React.useState(() => !!value && !inList(value));

  // Species changed under us: a Friesian on a flock of layers is no longer a
  // listed breed, so the field flips to free text holding what was there
  // rather than blanking a value the user typed.
  React.useEffect(() => {
    if (value && !inList(value)) setOther(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join('|')]);

  // No curated list for this species — free text is the honest control.
  if (options.length === 0) {
    return (
      <input
        className="field-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <select
        className="field-select"
        value={other ? '__other' : (inList(value) ? value : '')}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__other') { setOther(true); onChange(''); return; }
          setOther(false);
          onChange(v);
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other">Other…</option>
      </select>
      {other && (
        <input
          className="field-input"
          autoFocus
          value={value}
          placeholder={placeholder ?? 'Type it'}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};

/**
 * The clinic's tab strip, not a second one — same weights and the same filled
 * active pill as the Billing page's tabs.
 *
 * ⚠️ NO BORDER OF ITS OWN. It always sits inside a `FilterBar`, which is
 * already a bordered card; giving this one too draws a box inside a box, which
 * is exactly the fussiness that made the farm pages look unlike the rest of the
 * app. The Billing strip carries a border because it sits on the bare page.
 */
export const SegmentedFilter: React.FC<{
  options: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="overflow-x-auto -mx-1 px-1">
    <div className="inline-flex min-w-max bg-slate-100 dark:bg-zinc-800/60 p-1 rounded-xl">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 ${
              active
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg'
                : 'text-slate-400 dark:text-zinc-500 hover:text-pine dark:hover:text-zinc-300'
            }`}
          >
            {o.label}
            {o.count != null && (
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${
                active ? 'bg-white/20 dark:bg-pine/10' : 'bg-slate-200 dark:bg-zinc-800'
              }`}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * A bordered list container with hairline-separated rows — the clinic's table
 * treatment for anything that is a register rather than a grid of cards.
 */
export const ListPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
    {children}
  </div>
);

/**
 * The filter row every list view puts above its content. A bordered bar rather
 * than loose controls floating on the page background — which is what made the
 * farm pages read as unfinished next to Clients or Inventory.
 */
export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3">
    {children}
  </div>
);

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  children: React.ReactNode;
}> = ({ title, onClose, onSave, saving, saveLabel = 'Save', children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-150">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-pine"><X size={16} /></button>
      </div>
      <div className="space-y-3">{children}</div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-seafoam/20 hover:bg-seafoam/90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
        >
          {saving && <Loader2 size={13} className="animate-spin" />} {saveLabel}
        </button>
      </div>
    </div>
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label, children, className = '',
}) => (
  <div className={className}>
    <label className="field-label">{label}</label>
    {children}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm ${
      onClick ? 'cursor-pointer hover:border-seafoam/60 transition-colors' : ''
    }`}
  >
    {children}
  </div>
);

export const Stat: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-slate-800 dark:text-white">{value}</p>
    {hint && <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{hint}</p>}
  </div>
);

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** yyyy-mm-dd for <input type="date">, tolerant of nulls and ISO strings. */
export const dateInput = (d?: string | null) => (d ? String(d).slice(0, 10) : '');

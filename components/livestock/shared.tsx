/**
 * Shared primitives for the Livestock module — every view is the same shape
 * (header + farm filter + list + create/edit modal), so the chrome lives here
 * and each view only describes its own fields.
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
    className="px-4 py-2.5 rounded-xl bg-pine text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40 transition-all"
  >
    <Plus size={13} /> {children}
  </button>
);

export const EmptyState: React.FC<{ icon: React.ElementType; title: string; hint: string }> = ({
  icon: Icon, title, hint,
}) => (
  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-14 text-center">
    <Icon size={24} className="mx-auto text-slate-300 dark:text-zinc-700" />
    <p className="mt-3 text-sm font-bold text-slate-600 dark:text-zinc-300">{title}</p>
    <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">{hint}</p>
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
          className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-pine text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
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
    className={`rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 ${
      onClick ? 'cursor-pointer hover:border-seafoam transition-colors' : ''
    }`}
  >
    {children}
  </div>
);

export const Stat: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
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

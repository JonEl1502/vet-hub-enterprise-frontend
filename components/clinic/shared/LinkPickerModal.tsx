import React, { useMemo, useState } from 'react';
import { X, Search, Link2, Loader2 } from 'lucide-react';

export interface LinkItem { id: string; label: string; sublabel?: string; }

/**
 * Generic "attach" picker: lists candidate records (e.g. appointments with no
 * reminder, visits with no appointment) and links the one you pick. Used to
 * manually connect a reminder ↔ appointment ↔ visit created separately.
 */
const LinkPickerModal: React.FC<{
  title: string;
  subtitle?: string;
  items: LinkItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  busyId?: string | null;
  emptyText?: string;
}> = ({ title, subtitle, items, onSelect, onClose, busyId, emptyText = 'Nothing available to link.' }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i => `${i.label} ${i.sublabel ?? ''}`.toLowerCase().includes(s));
  }, [items, q]);

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between gap-2 p-5 pb-3">
          <div>
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-pine shrink-0"><X size={18} /></button>
        </div>
        <div className="px-5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-8">{emptyText}</p>
          ) : filtered.map(i => (
            <button key={i.id} onClick={() => onSelect(i.id)} disabled={!!busyId}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-seafoam hover:bg-seafoam/5 text-left transition-all disabled:opacity-50">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-pine dark:text-zinc-100 truncate">{i.label}</span>
                {i.sublabel && <span className="block text-[10px] text-slate-400 truncate">{i.sublabel}</span>}
              </span>
              {busyId === i.id ? <Loader2 size={14} className="animate-spin text-seafoam shrink-0" /> : <Link2 size={14} className="text-seafoam shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LinkPickerModal;

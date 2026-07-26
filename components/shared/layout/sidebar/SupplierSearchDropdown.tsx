import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, Check, ChevronDown, Search, X, Globe } from 'lucide-react';
import { useSupplier } from '../../../../contexts/SupplierContext';
import { useAuth } from '../../../../contexts/AuthContext';

interface Props {
  /** When true, render the icon-only / collapsed-sidebar variant. */
  isCollapsed: boolean;
}

/**
 * Inline searchable supplier dropdown for the sidebar header. Mirrors
 * ClinicSearchDropdown — admins (SUPER_ADMIN / MERCHANT_ADMIN) use it to
 * narrow the platform view to one or many suppliers (or "All").
 *
 * Convention: empty selection = "All Suppliers" — the axios interceptor
 * omits the X-Supplier-Id(s) header and the backend returns aggregated
 * data across every supplier.
 */
const SupplierSearchDropdown: React.FC<Props> = ({ isCollapsed }) => {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'MERCHANT_ADMIN';

  const {
    suppliers,
    selectedSupplierIds,
    selectSupplier,
    // toggleSupplier is deliberately NOT used: toggling now happens in the
    // panel's local draft, so nothing changes the live scope before Apply.
    selectMultipleSuppliers,
    selectAllSuppliers,
    canMultiSelect,
    isLoading,
  } = useSupplier();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => { if (!isOpen) setQuery(''); }, [isOpen]);

  // Reload after a pick so every open page refetches with the freshly
  // applied X-Supplier-Id(s) header — same convention as ClinicSearchDropdown.
  const reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q) ||
      (s.contactEmail || '').toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  // Only admins get this dropdown. Suppliers themselves are auto-scoped.
  // Hide entirely if there's nothing to switch between (single supplier).
  if (!isAdmin) return null;
  if (suppliers.length <= 1 && !isLoading) return null;

  const isAllSelected = selectedSupplierIds.length === 0;
  const triggerLabel = isAllSelected
    ? `All suppliers (${suppliers.length})`
    : selectedSupplierIds.length === 1
      ? suppliers.find((s: any) => String(s.id) === selectedSupplierIds[0])?.name || 'Select supplier'
      : `${selectedSupplierIds.length} suppliers`;

  if (isCollapsed) {
    return (
      <div ref={ref} className="relative px-3 py-2 border-b border-purple-500/10 dark:border-zinc-800 shrink-0">
        <button
          onClick={() => setIsOpen(!isOpen)}
          title={triggerLabel}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-purple-500/10 dark:bg-zinc-800 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
        >
          <Truck size={14} />
        </button>
        {isOpen && (
          <DropdownPanel
            anchor="collapsed"
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            allSuppliers={suppliers}
            selectedIds={selectedSupplierIds}
            canMultiSelect={canMultiSelect}
            onClose={() => setIsOpen(false)}
            onApplySingle={(id) => { selectSupplier(id); setIsOpen(false); reload(); }}
            onApplyMany={(ids) => { selectMultipleSuppliers(ids); setIsOpen(false); reload(); }}
            onApplyAll={() => { selectAllSuppliers(); setIsOpen(false); reload(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-3 py-2 border-b border-purple-500/10 dark:border-zinc-800 shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-purple-500 rounded-xl text-left transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Truck size={12} className="text-purple-500 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">
            {triggerLabel}
          </span>
        </div>
        <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <DropdownPanel
          anchor="expanded"
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          allSuppliers={suppliers}
          selectedIds={selectedSupplierIds}
          canMultiSelect={canMultiSelect}
          onClose={() => setIsOpen(false)}
          onApplySingle={(id) => { selectSupplier(id); setIsOpen(false); reload(); }}
          onApplyMany={(ids) => { selectMultipleSuppliers(ids); setIsOpen(false); reload(); }}
          onApplyAll={() => { selectAllSuppliers(); setIsOpen(false); reload(); }}
        />
      )}
    </div>
  );
};

interface PanelProps {
  anchor: 'expanded' | 'collapsed';
  query: string;
  setQuery: (q: string) => void;
  filtered: any[];
  allSuppliers: any[];
  selectedIds: string[];
  canMultiSelect: boolean;
  onClose: () => void;
  onApplySingle: (id: string) => void;
  onApplyMany: (ids: string[]) => void;
  onApplyAll: () => void;
}

const DropdownPanel: React.FC<PanelProps> = ({
  anchor, query, setQuery, filtered, allSuppliers, selectedIds,
  canMultiSelect, onClose, onApplySingle, onApplyMany, onApplyAll,
}) => {
  const positionClass = anchor === 'collapsed'
    ? 'fixed left-20 top-32 w-[280px]'
    : 'absolute left-3 right-3 top-full mt-1';

  // DRAFT selection, local to the dropdown — same pattern as
  // ClinicSearchDropdown. Ticking a box used to mutate the live scope
  // immediately while nothing refetched, and Apply only appeared once TWO
  // suppliers were selected, so picking one left no way to commit it. Now
  // nothing leaves this panel until Apply.
  const [draft, setDraft] = useState<string[]>(selectedIds);
  useEffect(() => {
    setDraft(selectedIds);
    // Re-sync only when the committed selection changes; a mid-edit context
    // update must not discard what the user has ticked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(',')]);

  const toggle = (id: string) =>
    setDraft(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Empty draft = "All suppliers" (the backend's own convention).
  const draftIsAll = draft.length === 0;
  const dirty = draft.length !== selectedIds.length || draft.some(id => !selectedIds.includes(id));

  const apply = () => {
    if (draft.length === 0) onApplyAll();
    else if (draft.length === 1) onApplySingle(draft[0]);
    else onApplyMany(draft);
  };

  return (
    <div className={`${positionClass} z-[200] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden`}>
      <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suppliers…"
            autoFocus
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-7 py-1.5 text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* "All suppliers" shortcut — empty selection = all (matches backend) */}
      <button
        onClick={() => (canMultiSelect ? setDraft([]) : onApplyAll())}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
          draftIsAll
            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
            : 'text-pine dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <Globe size={11} />
          <span className="text-[10px] font-black uppercase tracking-widest">All suppliers ({allSuppliers.length})</span>
        </div>
        {draftIsAll && <Check size={12} />}
      </button>

      <div className="max-h-72 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            No matches
          </p>
        ) : (
          filtered.map((s: any) => {
            const id = String(s.id);
            const isSelected = draft.includes(id);
            return (
              <div
                key={id}
                className={`w-full flex items-center gap-2.5 px-3 py-2 border-t border-slate-50 dark:border-zinc-800/50 transition-colors ${
                  isSelected ? 'bg-purple-500/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {/* Click main row = pick single supplier; the checkbox is
                    a separate hit target for multi-select. */}
                <button
                  onClick={() => (canMultiSelect ? toggle(id) : onApplySingle(id))}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black text-pine dark:text-zinc-100 shrink-0">
                    {(s.name || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-black truncate ${isSelected ? 'text-purple-700 dark:text-purple-400' : 'text-pine dark:text-zinc-100'}`}>
                      {s.name}
                    </p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">
                      {[s.category, s.currency].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </button>
                {canMultiSelect && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(id); }}
                    className="shrink-0"
                    title={isSelected ? 'Remove from selection' : 'Add to selection'}
                  >
                    <span className={`flex items-center justify-center w-4 h-4 rounded border ${
                      isSelected
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600'
                    }`}>
                      {isSelected && <Check size={10} />}
                    </span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Always present for multi-select, so there is a visible commit step
          however many suppliers are ticked. */}
      {canMultiSelect && (
        <div className="border-t border-slate-100 dark:border-zinc-800 p-2 flex items-center gap-2 bg-purple-500/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 flex-1">
            {draftIsAll ? 'All suppliers' : `${draft.length} selected`}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!dirty}
            title="Reloads to rescope every page"
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
};

export default SupplierSearchDropdown;

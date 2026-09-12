import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * THE BRANCH SCOPE PICKER — the supplier's `ClinicSearchDropdown` (user,
 * 2026-09-12: *"supply branches to be a drop down in the sidebar, just like
 * the other ones, like admin and clinic"*).
 *
 * A supplier could only change scope through the full-screen "Switch Branch"
 * takeover reached from the top nav — a whole-screen context switch to tick a
 * box, where the clinic side does it from a dropdown without leaving the page.
 * Same shape, same search, same draft-then-Apply, same collapsed-sidebar
 * variant.
 *
 * ⚠️ NO PAGE RELOAD, unlike the clinic version. A clinic switch changes the
 * `X-Clinic-Ids` REQUEST HEADER, so every open page has to refetch and the
 * blunt fix is `location.reload()`. Branch scope is plain React state that its
 * consumers already read (`SupplierDashboard`, the wallet, the stockroom), so
 * reloading would throw away work for no reason.
 *
 * ⚠️ `'__main__'` is a UI-ONLY SENTINEL for the supplier's head office. The
 * context strips the `isMain` row out of `branches`, so the head office has no
 * entry to tick and this list has to synthesise one — the same convention
 * `SupplierBranchModal` uses. It must never be sent to an API as a branch id.
 */

const MAIN_BRANCH_ID = '__main__';

interface Props {
  /** When true, render the icon-only / collapsed-sidebar variant. */
  isCollapsed: boolean;
}

interface Row {
  id: string;
  name: string;
  sub: string;
  isMain: boolean;
}

const SupplierBranchDropdown: React.FC<Props> = ({ isCollapsed }) => {
  const { user } = useAuth();
  const { branches, activeBranchIds, setActiveBranchIds, refresh } = useSupplierBranch();
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

  // Re-read on open, so a branch added on the Branches page appears here
  // without a reload — the same reason the takeover modal refreshes.
  useEffect(() => { if (isOpen) refresh(); }, [isOpen, refresh]);

  const rows = useMemo<Row[]>(() => {
    const main: Row = {
      id: MAIN_BRANCH_ID,
      name: user?.supplier?.name || 'Head office',
      sub: 'Main branch',
      isMain: true,
    };
    return [
      main,
      ...branches.map(b => ({
        id: b.id,
        name: b.name,
        sub: [b.city, b.country].filter(Boolean).join(' · ') || b.address || '—',
        isMain: false,
      })),
    ];
  }, [branches, user?.supplier?.name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q));
  }, [rows, query]);

  // One place to be is not a choice — the clinic dropdown hides itself on the
  // same rule rather than offering a picker with a single row.
  if (rows.length <= 1) return null;

  const scopeSummary = `${rows.length} ${rows.length === 1 ? 'branch' : 'branches'}`;
  const isAllSelected = activeBranchIds.length === rows.length;
  const triggerLabel = isAllSelected
    ? `All · ${scopeSummary}`
    : activeBranchIds.length === 1
      ? rows.find(r => r.id === activeBranchIds[0])?.name || 'Select branch'
      : activeBranchIds.length === 0
        ? 'No branches'
        : `${activeBranchIds.length} selected`;

  const panel = (
    <DropdownPanel
      anchor={isCollapsed ? 'collapsed' : 'expanded'}
      query={query}
      setQuery={setQuery}
      filtered={filtered}
      allIds={rows.map(r => r.id)}
      scopeSummary={scopeSummary}
      selectedIds={activeBranchIds}
      onClose={() => setIsOpen(false)}
      onApply={(ids) => { setActiveBranchIds(ids); setIsOpen(false); }}
    />
  );

  if (isCollapsed) {
    return (
      <div ref={ref} className="relative px-3 py-2 border-b border-seafoam/10 dark:border-zinc-800 shrink-0">
        <button
          onClick={() => setIsOpen(!isOpen)}
          title={triggerLabel}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-seafoam/10 dark:bg-zinc-800 text-seafoam dark:text-zinc-300 hover:bg-seafoam/20 transition-colors"
        >
          <Building2 size={14} />
        </button>
        {isOpen && panel}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-3 py-2 border-b border-seafoam/10 dark:border-zinc-800 shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={triggerLabel}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-seafoam rounded-xl text-left transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Building2 size={12} className="text-seafoam shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">
            {triggerLabel}
          </span>
        </div>
        <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && panel}
    </div>
  );
};

interface PanelProps {
  anchor: 'expanded' | 'collapsed';
  query: string;
  setQuery: (q: string) => void;
  filtered: Row[];
  allIds: string[];
  scopeSummary: string;
  selectedIds: string[];
  onClose: () => void;
  onApply: (ids: string[]) => void;
}

const DropdownPanel: React.FC<PanelProps> = ({
  anchor, query, setQuery, filtered, allIds, scopeSummary, selectedIds, onClose, onApply,
}) => {
  const positionClass = anchor === 'collapsed'
    ? 'fixed left-20 top-32 w-[280px]'
    : 'absolute left-3 right-3 top-full mt-1';

  // Draft selection — tick several rows, commit once. Nothing downstream
  // refetches until Apply.
  const [draft, setDraft] = useState<string[]>(selectedIds);
  useEffect(() => {
    setDraft(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(',')]);

  const draftSet = useMemo(() => new Set(draft), [draft]);
  const isAllDrafted = draft.length === allIds.length && allIds.length > 0;
  const dirty = draft.length !== selectedIds.length || draft.some(id => !selectedIds.includes(id));

  const toggle = (id: string) =>
    setDraft(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = () => setDraft(isAllDrafted ? [] : [...allIds]);

  return (
    <div className={`${positionClass} z-[200] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden flex flex-col`}>
      <div className="p-2 border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search branches…"
            autoFocus
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-7 py-1.5 text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30 placeholder:text-slate-400"
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

      {allIds.length > 1 && (
        <button
          onClick={toggleAll}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-b border-slate-100 dark:border-zinc-800 shrink-0 ${
            isAllDrafted ? 'bg-seafoam/10 text-seafoam' : 'text-pine dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
          }`}
        >
          <CheckBox checked={isAllDrafted} />
          <span className="text-[10px] font-black uppercase tracking-widest flex-1">Everywhere · {scopeSummary}</span>
        </button>
      )}

      <div className="max-h-72 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            No matches
          </p>
        ) : (
          filtered.map((r) => {
            const isDrafted = draftSet.has(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggle(r.id)}
                // The head office leads and sits flush; real branches are
                // indented under it, so the list reads as a hierarchy rather
                // than a flat roster of equals — same as the clinic picker.
                className={`w-full flex items-center gap-2.5 py-2 pr-3 text-left transition-colors border-t border-slate-50 dark:border-zinc-800/50 ${
                  r.isMain ? 'pl-3' : 'pl-7'
                } ${isDrafted ? 'bg-seafoam/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
              >
                <CheckBox checked={isDrafted} />
                <div className={`rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 ${r.isMain ? 'w-6 h-6' : 'w-5 h-5'}`}>
                  <Building2 size={r.isMain ? 12 : 10} className="text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] font-black truncate ${isDrafted ? 'text-seafoam' : 'text-pine dark:text-zinc-100'}`}>{r.name}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">{r.sub}</p>
                </div>
                {r.isMain && (
                  <span
                    title="The supplier's head office"
                    className="shrink-0 px-1.5 py-0.5 rounded bg-seafoam/15 text-seafoam text-[7px] font-black uppercase tracking-widest"
                  >
                    Main
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 dark:border-zinc-800 p-2 flex items-center gap-2 shrink-0 bg-slate-50/60 dark:bg-zinc-950/40">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 flex-1">
          {draft.length} selected
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onApply(draft)}
          // Zero branches is not a scope — every page would read empty and look
          // broken. The clinic picker refuses the same way.
          disabled={draft.length === 0 || !dirty}
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-pine transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
};

const CheckBox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
    checked
      ? 'bg-seafoam border-seafoam text-white'
      : 'bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-600'
  }`}>
    {checked && <Check size={10} strokeWidth={3} />}
  </span>
);

export default SupplierBranchDropdown;

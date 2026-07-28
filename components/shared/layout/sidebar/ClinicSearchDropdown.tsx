import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react';
import { useClinic } from '../../../../contexts/ClinicContext';
import ClinicLogo from '../../../clinic/clinic-mgmt/ClinicLogo';

interface Props {
  /** When true, render the icon-only / collapsed-sidebar variant. */
  isCollapsed: boolean;
}

const ClinicSearchDropdown: React.FC<Props> = ({ isCollapsed }) => {
  const { clinics, selectedClinicIds, selectClinic, selectMultipleClinics, canMultiSelect } = useClinic();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Reset search when closing
  useEffect(() => { if (!isOpen) setQuery(''); }, [isOpen]);

  // Reload page after a switcher pick so every open page refetches
  // with the new X-Clinic-Ids header — same convention as the modal.
  const reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  /**
   * `clinics` from ClinicContext is a FLAT list — every main clinic and every
   * branch under it, side by side. Counting that length called a branch a
   * clinic: one practice with two branches read as "All clinics (3)". A branch
   * is a location of a clinic, not another clinic, so mains are what get
   * counted and branches are listed underneath the parent they belong to.
   */
  const rows = useMemo(() => {
    const mains = clinics.filter(c => !c.parentClinicId);
    const byParent = new Map<string, any[]>();
    const orphans: any[] = [];
    clinics
      .filter(c => c.parentClinicId)
      .forEach(b => {
        const pid = String(b.parentClinicId);
        // A branch whose parent isn't in this user's list still has to be
        // reachable — it just can't be nested under anything.
        if (mains.some(m => String(m.id) === pid)) {
          byParent.set(pid, [...(byParent.get(pid) || []), b]);
        } else {
          orphans.push(b);
        }
      });
    const ordered: { clinic: any; isBranch: boolean; parentName?: string }[] = [];
    mains.forEach(m => {
      ordered.push({ clinic: m, isBranch: false });
      (byParent.get(String(m.id)) || []).forEach(b =>
        ordered.push({ clinic: b, isBranch: true, parentName: m.name }));
    });
    orphans.forEach(b => ordered.push({ clinic: b, isBranch: true }));
    return { ordered, mainCount: mains.length, branchCount: clinics.length - mains.length };
  }, [clinics]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows.ordered;
    const hit = (c: any) =>
      c.name?.toLowerCase().includes(q) ||
      (c.subdomain || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.countryCode || '').toLowerCase().includes(q);
    // A parent that matches keeps its branches; a branch that matches is shown
    // even when its parent doesn't, so searching a branch name always finds it.
    const matchedMainIds = new Set(
      rows.ordered.filter(r => !r.isBranch && hit(r.clinic)).map(r => String(r.clinic.id)),
    );
    return rows.ordered.filter(r =>
      hit(r.clinic) || (r.isBranch && matchedMainIds.has(String(r.clinic.parentClinicId))));
  }, [rows, query]);

  // Don't render if there's only one place to be — nothing to switch between.
  if (clinics.length <= 1) return null;

  const scopeSummary = rows.branchCount > 0
    ? `${rows.mainCount} ${rows.mainCount === 1 ? 'clinic' : 'clinics'} · ${rows.branchCount} ${rows.branchCount === 1 ? 'branch' : 'branches'}`
    : `${rows.mainCount} ${rows.mainCount === 1 ? 'clinic' : 'clinics'}`;
  const isAllSelected = selectedClinicIds.length === clinics.length;
  const triggerLabel = isAllSelected
    ? `All · ${scopeSummary}`
    : selectedClinicIds.length === 1
      ? clinics.find(c => c.id === selectedClinicIds[0])?.name || 'Select clinic'
      : `${selectedClinicIds.length} selected`;

  // Collapsed sidebar: tiny icon-only trigger
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
        {isOpen && (
          <DropdownPanel
            anchor="collapsed"
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            allClinics={clinics}
            scopeSummary={scopeSummary}
            selectedIds={selectedClinicIds}
            canMultiSelect={canMultiSelect}
            onClose={() => setIsOpen(false)}
            onApplySingle={(id) => { selectClinic(id); setIsOpen(false); reload(); }}
            onApplyMany={(ids) => { selectMultipleClinics(ids); setIsOpen(false); reload(); }}
          />
        )}
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
      {isOpen && (
        <DropdownPanel
          anchor="expanded"
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          allClinics={clinics}
          scopeSummary={scopeSummary}
          selectedIds={selectedClinicIds}
          canMultiSelect={canMultiSelect}
          onClose={() => setIsOpen(false)}
          onApplySingle={(id) => { selectClinic(id); setIsOpen(false); reload(); }}
          onApplyMany={(ids) => { selectMultipleClinics(ids); setIsOpen(false); reload(); }}
        />
      )}
    </div>
  );
};

interface PanelProps {
  anchor: 'expanded' | 'collapsed';
  query: string;
  setQuery: (q: string) => void;
  /** Parent-then-branches order, each row tagged with what it is. */
  filtered: { clinic: any; isBranch: boolean; parentName?: string }[];
  allClinics: any[];
  /** e.g. "2 clinics · 3 branches" — branches counted as branches, not clinics. */
  scopeSummary: string;
  selectedIds: string[];
  canMultiSelect: boolean;
  onClose: () => void;
  onApplySingle: (id: string) => void;
  onApplyMany: (ids: string[]) => void;
}

const DropdownPanel: React.FC<PanelProps> = ({
  anchor, query, setQuery, filtered, allClinics, scopeSummary, selectedIds,
  canMultiSelect, onClose, onApplySingle, onApplyMany,
}) => {
  // Position absolutely below in expanded mode; floats to the right of
  // the collapsed sidebar otherwise (sidebar is 80px wide when collapsed).
  const positionClass = anchor === 'collapsed'
    ? 'fixed left-20 top-32 w-[280px]'
    : 'absolute left-3 right-3 top-full mt-1';

  // Draft selection. Local to the dropdown so the user can toggle several
  // rows before committing via Apply — nothing reloads until they click it.
  const [draft, setDraft] = useState<string[]>(selectedIds);

  // Reset the draft each time the dropdown opens with a different baseline.
  useEffect(() => {
    setDraft(selectedIds);
    // We intentionally re-sync only when the committed selection changes;
    // mid-edit changes to selectedIds shouldn't blow away the user's draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(',')]);

  const draftSet = useMemo(() => new Set(draft), [draft]);
  const isAllDrafted = draft.length === allClinics.length && allClinics.length > 0;
  const dirty = draft.length !== selectedIds.length || draft.some(id => !selectedIds.includes(id));

  const toggle = (id: string) => {
    setDraft(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setDraft(isAllDrafted ? [] : allClinics.map(c => c.id));
  };

  const apply = () => {
    if (draft.length === 0) return;
    if (draft.length === 1) onApplySingle(draft[0]);
    else onApplyMany(draft);
  };

  return (
    <div className={`${positionClass} z-[200] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden flex flex-col`}>
      {/* Search input */}
      <div className="p-2 border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clinics…"
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

      {/* Select-all toggle — multi-select only */}
      {canMultiSelect && allClinics.length > 1 && (
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

      {/* Filtered list */}
      <div className="max-h-72 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            No matches
          </p>
        ) : (
          filtered.map(({ clinic: c, isBranch, parentName }) => {
            const isDrafted = draftSet.has(c.id);
            const isCommitted = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => canMultiSelect ? toggle(c.id) : onApplySingle(c.id)}
                // Branches are indented under the clinic they belong to, so the
                // list reads as a hierarchy instead of a flat roster of equals.
                className={`w-full flex items-center gap-2.5 py-2 pr-3 text-left transition-colors border-t border-slate-50 dark:border-zinc-800/50 ${
                  isBranch ? 'pl-7' : 'pl-3'
                } ${
                  isDrafted
                    ? 'bg-seafoam/10'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {canMultiSelect && <CheckBox checked={isDrafted} />}
                <div className={`rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xs shrink-0 overflow-hidden ${isBranch ? 'w-5 h-5' : 'w-6 h-6'}`}>
                  <ClinicLogo logo={c.logo} fallback="🐾" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] font-black truncate ${isDrafted ? 'text-seafoam' : 'text-pine dark:text-zinc-100'}`}>{c.name}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 truncate">
                    {[c.city, c.countryCode].filter(Boolean).join(' · ') || c.subdomain || '—'}
                  </p>
                </div>
                {isBranch && (
                  <span
                    title={parentName ? `Branch of ${parentName}` : 'Branch'}
                    className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[7px] font-black uppercase tracking-widest"
                  >
                    Branch
                  </span>
                )}
                {!canMultiSelect && isCommitted && <Check size={12} className="text-seafoam shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      {/* Apply bar — multi-select only */}
      {canMultiSelect && (
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
            onClick={apply}
            disabled={draft.length === 0 || !dirty}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-seafoam text-white hover:bg-pine transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      )}
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

export default ClinicSearchDropdown;

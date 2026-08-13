
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Plus } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Let the user COMMIT WHAT THEY TYPED when no option matches.
   *
   * A fixed list is a promise that the list is complete, and for species and
   * breeds it never is — a clinic that sees a Sokoke, an Ankole cow or a
   * cross nobody has named cannot record the patient at all, and the usual
   * workaround is to pick the nearest wrong option, which then pollutes every
   * report grouped by that field (user, 2026-08-13: "allow user to add new by
   * typing", "same too species").
   *
   * ⚠️ This does NOT write to the catalog. It returns the typed string to the
   * caller exactly like a picked option, so the value is honest and the
   * decision to persist a new global breed stays with whoever owns that
   * catalog — see the `is_approved` global-vs-clinic model on species/breeds.
   */
  allowCreate?: boolean;
  /** Word used in the create row, e.g. "breed" → “Use “Sokoke” as a new breed”. */
  createLabel?: string;
}

const SearchableDropdown: React.FC<Props> = ({ label, options, value, onChange, placeholder, disabled, allowCreate, createLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const typed = searchTerm.trim();
  // Offer the create row only when the typed text is not ALREADY an option —
  // case-insensitively, or the user would be offered "add Poodle" while Poodle
  // sits in the list right under it, and two spellings of one breed is exactly
  // the mess a picker exists to prevent.
  const canCreate = !!allowCreate
    && typed.length > 0
    && !options.some(o => o.toLowerCase() === typed.toLowerCase());

  const commit = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="text-[10px] font-black text-seafoam dark:text-zinc-500 uppercase tracking-widest px-1">
        {label}
      </label>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-50 dark:bg-zinc-800 border ${isOpen ? 'border-seafoam ring-2 ring-seafoam/20' : 'border-slate-200 dark:border-zinc-700'} rounded-2xl px-6 py-4 cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`font-bold ${value ? 'text-pine dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}`}>
          {value || placeholder || `Select ${label}...`}
        </span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                autoFocus
                className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-xl pl-12 pr-10 py-2.5 text-sm text-pine dark:text-zinc-100 outline-none"
                placeholder={allowCreate ? 'Type to filter, or add a new one…' : 'Type to filter...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                // Enter commits: the exact match if there is one, otherwise the
                // typed text. Typing the full name and pressing Enter is the
                // fast path, and it should never silently do nothing.
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const exact = filteredOptions.find(o => o.toLowerCase() === typed.toLowerCase());
                  if (exact) return commit(exact);
                  if (canCreate) return commit(typed);
                  if (filteredOptions.length === 1) return commit(filteredOptions[0]);
                }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
            {/* The create row sits FIRST when nothing matches, so an unlisted
                breed is one keystroke away rather than a dead end; it drops
                below the matches when there are some, because picking an
                existing option is still the common case. */}
            {canCreate && filteredOptions.length === 0 && (
              <button
                type="button"
                onClick={() => commit(typed)}
                className="w-full flex items-center gap-2.5 text-left px-5 py-3.5 rounded-2xl text-sm font-bold text-seafoam hover:bg-seafoam/10 transition-all"
              >
                <Plus size={15} className="shrink-0" />
                <span className="truncate">Use &ldquo;{typed}&rdquo;{createLabel ? ` as a new ${createLabel}` : ''}</span>
              </button>
            )}
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <button
                key={opt}
                onClick={() => commit(opt)}
                className={`w-full text-left px-5 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                  value === opt
                    ? 'bg-seafoam text-white shadow-lg'
                    : 'text-pine dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {opt}
              </button>
            )) : !canCreate && (
              <p className="p-5 text-center text-xs text-slate-400 font-black uppercase">No matches found</p>
            )}
            {canCreate && filteredOptions.length > 0 && (
              <button
                type="button"
                onClick={() => commit(typed)}
                className="w-full flex items-center gap-2.5 text-left px-5 py-3.5 mt-1 border-t border-slate-100 dark:border-zinc-800 rounded-2xl text-sm font-bold text-seafoam hover:bg-seafoam/10 transition-all"
              >
                <Plus size={15} className="shrink-0" />
                <span className="truncate">Use &ldquo;{typed}&rdquo;{createLabel ? ` as a new ${createLabel}` : ''}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;

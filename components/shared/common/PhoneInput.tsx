import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { COUNTRIES, getCountry, type Country } from '../../../utils/countries';

interface Props {
  /** ISO-2 country code (e.g. "KE"). */
  countryCode?: string | null;
  /** E.164 dial prefix (e.g. "+254"). */
  dialCode: string;
  /** Local part of the number (no dial code). */
  phone: string;
  onChange: (v: { countryCode: string; dialCode: string; phone: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Phone field with a searchable country-code picker (flag + dial code, all
 * countries). The dial code + local number are managed together; the full
 * number is `dialCode + phone`.
 */
const PhoneInput: React.FC<Props> = ({ countryCode, dialCode, phone, onChange, placeholder = '700 000 000', className = '', disabled, required }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Resolve the selected country from the ISO code, else by dial code.
  const selected: Country | undefined = getCountry(countryCode ?? undefined) || COUNTRIES.find(c => c.dialCode === dialCode);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (c: Country) => { onChange({ countryCode: c.code, dialCode: c.dialCode, phone }); setOpen(false); setQuery(''); };

  return (
    <div ref={wrapRef} className={`relative flex items-stretch ${className}`}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 rounded-l-xl border border-r-0 border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm font-bold text-pine dark:text-zinc-100 shrink-0 hover:bg-slate-100 dark:hover:bg-zinc-900 disabled:opacity-60">
        <span className="text-base leading-none">{selected?.flag ?? '🌍'}</span>
        <span>{dialCode || selected?.dialCode || '+'}</span>
        <ChevronDown size={13} className="text-slate-400" />
      </button>
      <input
        type="tel"
        inputMode="tel"
        required={required}
        disabled={disabled}
        value={phone}
        placeholder={placeholder}
        onChange={e => onChange({ countryCode: selected?.code ?? countryCode ?? '', dialCode: dialCode || selected?.dialCode || '', phone: e.target.value })}
        className="flex-1 min-w-0 px-3 py-2.5 rounded-r-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
      />
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 max-h-72 overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl">
          <div className="p-2 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search country or code"
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map(c => (
              <button key={c.code} type="button" onClick={() => pick(c)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                <span className="flex items-center gap-2 min-w-0"><span className="text-base">{c.flag}</span><span className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.name}</span><span className="text-[11px] text-slate-400">{c.code}</span></span>
                <span className="flex items-center gap-1.5 shrink-0"><span className="text-xs font-mono text-slate-500">{c.dialCode}</span>{selected?.code === c.code && <Check size={13} className="text-seafoam" />}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">No match.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneInput;

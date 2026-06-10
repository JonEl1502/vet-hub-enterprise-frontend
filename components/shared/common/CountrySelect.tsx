import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { COUNTRIES, getCountry, type Country } from '../../../utils/countries';

interface CountrySelectProps {
  value: string | null;          // ISO-2 country code
  onChange: (country: Country) => void;
  className?: string;
  placeholder?: string;
}

export default function CountrySelect({
  value,
  onChange,
  className = '',
  placeholder = 'Select country',
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = getCountry(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dialCode.includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handlePick = (c: Country) => {
    onChange(c);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <span className="text-base leading-none">{selected.flag}</span>
              <span className="truncate">{selected.name}</span>
              <span className="text-[#144E35]/40 font-black text-xs">{selected.dialCode}</span>
            </>
          ) : (
            <span className="text-[#144E35]/40">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="text-[#144E35]/40 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 left-0 right-0 bg-white border border-[#CFE6D8] rounded-xl shadow-2xl shadow-[#144E35]/10 overflow-hidden">
          <div className="p-2 border-b border-[#CFE6D8] bg-[#f4f7f7]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#144E35]/30" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                className="w-full bg-white border border-[#CFE6D8] rounded-lg pl-9 pr-3 py-2 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold"
              />
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-[#144E35]/40 font-bold">No matches</li>
            )}
            {filtered.map((c) => {
              const isSel = value === c.code;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => handlePick(c)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left hover:bg-[#f4f7f7] transition-colors ${
                      isSel ? 'bg-[#1C7A5B]/5' : ''
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate text-[#144E35]">{c.name}</span>
                    <span className="text-[#144E35]/40 text-xs font-black">{c.dialCode}</span>
                    {isSel && <Check size={14} className="text-[#1C7A5B]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

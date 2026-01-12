
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableDropdown: React.FC<Props> = ({ label, options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-xl pl-12 pr-4 py-2.5 text-sm text-pine dark:text-zinc-100 outline-none"
                placeholder="Type to filter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full text-left px-5 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                  value === opt 
                    ? 'bg-seafoam text-white shadow-lg' 
                    : 'text-pine dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {opt}
              </button>
            )) : (
              <p className="p-5 text-center text-xs text-slate-400 font-black uppercase">No matches found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;

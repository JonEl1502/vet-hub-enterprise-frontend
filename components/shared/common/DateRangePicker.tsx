import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Clock, X } from 'lucide-react';
import {
  startOfToday,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  format,
} from 'date-fns';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  className?: string;
  buttonClassName?: string;
}

interface PresetGroup {
  group: string;
  items: { label: string; range: () => DateRange }[];
}

// Native <input type="date"> works in yyyy-MM-dd; convert to/from Date.
const toInputValue = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : '');
const fromInputValue = (s: string): Date | null => (s ? new Date(`${s}T00:00:00`) : null);

export const DateRangePicker = ({ value, onChange, className = '', buttonClassName = '' }: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange>({ start: null, end: null });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Seed the custom inputs from the current value each time we open.
  useEffect(() => {
    if (isOpen) {
      setCustomRange({ start: value?.start ?? null, end: value?.end ?? null });
      setShowPresets(false);
    }
  }, [isOpen, value]);

  // Close on outside click.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const today = startOfToday();

  const presetGroups: PresetGroup[] = [
    {
      group: 'Days',
      items: [
        { label: 'Last 7 Days', range: () => ({ start: subDays(today, 6), end: today }) },
        { label: 'Last 14 Days', range: () => ({ start: subDays(today, 13), end: today }) },
        { label: 'Last 30 Days', range: () => ({ start: subDays(today, 29), end: today }) },
        { label: 'Last 90 Days', range: () => ({ start: subDays(today, 89), end: today }) },
      ],
    },
    {
      group: 'Months',
      items: [
        { label: 'Last 6 Months', range: () => ({ start: subMonths(today, 6), end: today }) },
        { label: 'Last 12 Months', range: () => ({ start: subMonths(today, 12), end: today }) },
        { label: 'This Month', range: () => ({ start: startOfMonth(today), end: endOfMonth(today) }) },
        {
          label: 'Last Month',
          range: () => ({ start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) }),
        },
      ],
    },
    {
      group: 'Years',
      items: [
        { label: 'This Year', range: () => ({ start: startOfYear(today), end: endOfYear(today) }) },
        {
          label: 'Last Year',
          range: () => ({ start: startOfYear(subYears(today, 1)), end: endOfYear(subYears(today, 1)) }),
        },
      ],
    },
  ];

  const applyRange = (range: DateRange) => {
    onChange(range);
    setIsOpen(false);
    setShowPresets(false);
  };

  const handleToday = () => applyRange({ start: today, end: today });

  const handleCustomApply = () => {
    if (customRange.start && customRange.end) applyRange(customRange);
  };

  const handleClearAll = () => {
    onChange({ start: null, end: null });
    setCustomRange({ start: null, end: null });
    setIsOpen(false);
    setShowPresets(false);
  };

  const getButtonLabel = () => {
    if (!value || (!value.start && !value.end)) return 'Select Date Range';
    if (value.start && value.end) {
      return `${format(value.start, 'MMM dd, yyyy')} - ${format(value.end, 'MMM dd, yyyy')}`;
    }
    return 'Select Date Range';
  };

  const hasValue = !!(value && (value.start || value.end));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-100 transition-all ${
          isOpen
            ? 'border-pine dark:border-seafoam ring-2 ring-pine/30 dark:ring-seafoam/30'
            : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
        } ${buttonClassName}`}
      >
        <Calendar size={15} className="text-seafoam shrink-0" />
        <span className="truncate flex-1 min-w-0 text-left">{getButtonLabel()}</span>
        {hasValue && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleClearAll(); } }}
            className="ml-1 p-0.5 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[min(340px,92vw)] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 space-y-3">
            {/* Today + Presets row */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleToday}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 text-sm font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
              >
                <Clock size={15} /> Today
              </button>
              <button
                type="button"
                onClick={() => setShowPresets((s) => !s)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  showPresets
                    ? 'bg-pine text-white'
                    : 'bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Calendar size={15} /> Presets
                <ChevronDown size={14} className={`transition-transform ${showPresets ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Custom range */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 mb-1.5">Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={toInputValue(customRange.start)}
                  max={toInputValue(customRange.end) || undefined}
                  onChange={(e) => setCustomRange((r) => ({ ...r, start: fromInputValue(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20 focus:border-seafoam"
                />
                <input
                  type="date"
                  value={toInputValue(customRange.end)}
                  min={toInputValue(customRange.start) || undefined}
                  onChange={(e) => setCustomRange((r) => ({ ...r, end: fromInputValue(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20 focus:border-seafoam"
                />
              </div>
              {(customRange.start || customRange.end) && (
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleCustomApply}
                    disabled={!customRange.start || !customRange.end}
                    className="px-5 py-2 bg-seafoam text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Clear */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm font-bold text-seafoam hover:text-pine dark:hover:text-zinc-100 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Presets submenu — floats to the right (drops below on small screens) */}
          {showPresets && (
            <div className="absolute top-0 left-full ml-2 w-56 max-h-[26rem] overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 max-sm:left-0 max-sm:top-full max-sm:ml-0 max-sm:mt-2 max-sm:w-full animate-in fade-in slide-in-from-left-2 duration-150">
              {presetGroups.map((g, gi) => (
                <div key={g.group} className={gi > 0 ? 'mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800' : ''}>
                  <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 px-2 mb-1">{g.group}</p>
                  {g.items.map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      onClick={() => applyRange(it.range())}
                      className="w-full text-left px-2 py-2 rounded-lg text-sm font-semibold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;

import React, { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { 
  startOfToday, 
  startOfYesterday, 
  endOfYesterday,
  subDays, 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  startOfYear,
  subYears,
  format 
} from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

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

type QuickFilter = 'today' | 'todayFuture' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'last3months' | 'last6months' | 'last1year' | 'custom';

export const DateRangePicker = ({ value, onChange, className = '', buttonClassName = '' }: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [customRange, setCustomRange] = useState<DateRange>({ start: null, end: null });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getQuickFilterRange = (filter: QuickFilter): DateRange | null => {
    const today = startOfToday();

    switch (filter) {
      case 'today':
        return { start: today, end: today };
      case 'todayFuture':
        // Today and future: start from today, no end date (represented as far future)
        const farFuture = new Date(2099, 11, 31);
        return { start: today, end: farFuture };
      case 'yesterday':
        return { start: startOfYesterday(), end: endOfYesterday() };
      case 'last7days':
        return { start: subDays(today, 6), end: today };
      case 'thisMonth':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last3months':
        return { start: subMonths(today, 3), end: today };
      case 'last6months':
        return { start: subMonths(today, 6), end: today };
      case 'last1year':
        return { start: subYears(today, 1), end: today };
      default:
        return null;
    }
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    if (filter === 'custom') {
      setActiveFilter('custom');
      setCustomRange({ start: null, end: null });
      return;
    }

    const range = getQuickFilterRange(filter);
    if (range) {
      setActiveFilter(filter);
      onChange(range);
      setIsOpen(false);
    }
  };

  const handleCustomApply = () => {
    if (customRange.start && customRange.end) {
      onChange(customRange);
      setActiveFilter('custom');
      setIsOpen(false);
    }
  };

  const handleCustomClear = () => {
    setCustomRange({ start: null, end: null });
  };

  const handleClearAll = () => {
    onChange({ start: null, end: null });
    setActiveFilter(null);
    setCustomRange({ start: null, end: null });
  };

  const getButtonLabel = () => {
    // Safety check for undefined value
    if (!value || (!value.start && !value.end)) {
      return 'Select Date Range';
    }

    if (value.start && value.end) {
      // Check if it's the "Today & Future" range (far future date)
      const farFuture = new Date(2099, 11, 31);
      if (value.end.getTime() === farFuture.getTime()) {
        return `${format(value.start, 'MMM d, yyyy')} - Future`;
      }
      return `${format(value.start, 'MMM d, yyyy')} - ${format(value.end, 'MMM d, yyyy')}`;
    }

    return 'Select Date Range';
  };

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'todayFuture', label: 'Today & Future' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7days', label: 'Last 7 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'last3months', label: 'Last 3 Months' },
    { id: 'last6months', label: 'Last 6 Months' },
    { id: 'last1year', label: 'Last 1 Year' },
    { id: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all ${buttonClassName}`}
      >
        <Calendar size={15} className="text-seafoam shrink-0" />
        <span className="truncate flex-1 min-w-0 text-left">{getButtonLabel()}</span>
        {value && (value.start || value.end) && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleClearAll();
            }}
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
        <div className="absolute top-full left-0 mt-2 w-[min(280px,90vw)] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Quick Filters */}
          <div className="p-3 space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
            <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Quick Filters</p>
            {quickFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleQuickFilter(filter.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === filter.id
                    ? 'bg-seafoam text-white shadow-md'
                    : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {filter.label}
              </button>
            ))}

            {/* Custom Range Pickers */}
            {activeFilter === 'custom' && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1 block">
                    Start Date
                  </label>
                  <DatePicker
                    selected={customRange.start}
                    onChange={(date) => setCustomRange({ ...customRange, start: date })}
                    selectsStart
                    startDate={customRange.start}
                    endDate={customRange.end}
                    maxDate={customRange.end || new Date()}
                    placeholderText="Select start date"
                    portalId="date-picker-portal"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1 block">
                    End Date
                  </label>
                  <DatePicker
                    selected={customRange.end}
                    onChange={(date) => setCustomRange({ ...customRange, end: date })}
                    selectsEnd
                    startDate={customRange.start}
                    endDate={customRange.end}
                    minDate={customRange.start}
                    maxDate={new Date()}
                    placeholderText="Select end date"
                    portalId="date-picker-portal"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                  />
                </div>

                {/* Custom Range Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleCustomClear}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleCustomApply}
                    disabled={!customRange.start || !customRange.end}
                    className="flex-1 px-4 py-2 bg-seafoam text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-pine transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;


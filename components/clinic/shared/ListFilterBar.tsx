import React from 'react';
import { Search } from 'lucide-react';
import { DateRangePicker, DateRange } from '../../shared/common/DateRangePicker';

export interface StatusOption { value: string; label: string }

interface Props {
  search: string;
  onSearch: (v: string) => void;
  dateRange: DateRange | null;
  onDateRange: (r: DateRange | null) => void;
  statuses?: StatusOption[];
  status?: string;
  onStatus?: (v: string) => void;
  searchPlaceholder?: string;
}

// Shared list filters: text search + date range + status pills.
const ListFilterBar: React.FC<Props> = ({ search, onSearch, dateRange, onDateRange, statuses, status, onStatus, searchPlaceholder }) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="relative flex-1 min-w-[180px]">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder={searchPlaceholder || 'Search patient or owner…'}
        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
      />
    </div>
    <DateRangePicker value={dateRange} onChange={onDateRange} buttonClassName="py-2" />
    {statuses && statuses.length > 0 && (
      <div className="flex gap-1.5">
        {statuses.map(s => (
          <button
            key={s.value}
            onClick={() => onStatus?.(s.value)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${status === s.value ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

// Inclusive date-range test against an ISO/string date.
export const inRange = (d: string | null | undefined, range: DateRange | null): boolean => {
  if (!range || (!range.start && !range.end)) return true;
  if (!d) return false;
  const t = new Date(d).getTime();
  if (range.start && t < new Date(range.start).setHours(0, 0, 0, 0)) return false;
  if (range.end && t > new Date(range.end).setHours(23, 59, 59, 999)) return false;
  return true;
};

export default ListFilterBar;

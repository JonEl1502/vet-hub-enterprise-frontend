import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  startOfToday,
  startOfDay,
  endOfDay,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  subDays,
  subHours,
  subMinutes,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  format,
  parse,
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

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Quick ranges mirror the reference design (Grafana-style). Each returns a
// fresh range relative to "now" at click time.
const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'Last 30 minutes', range: () => ({ start: subMinutes(new Date(), 30), end: new Date() }) },
  { label: 'Last 1 hour', range: () => ({ start: subHours(new Date(), 1), end: new Date() }) },
  { label: 'Last 6 hours', range: () => ({ start: subHours(new Date(), 6), end: new Date() }) },
  { label: 'Last 12 hours', range: () => ({ start: subHours(new Date(), 12), end: new Date() }) },
  { label: 'Last 24 hours', range: () => ({ start: subHours(new Date(), 24), end: new Date() }) },
  { label: 'Last 7 days', range: () => ({ start: startOfDay(subDays(new Date(), 6)), end: endOfDay(new Date()) }) },
  { label: 'Last 30 days', range: () => ({ start: startOfDay(subDays(new Date(), 29)), end: endOfDay(new Date()) }) },
];

const fmtInput = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd HH:mm') : '');

// Resolve the browser's timezone long name + GMT offset, e.g.
// "East Africa Time (GMT+3)" — display only, matches the reference.
const useTimezoneLabel = () =>
  useMemo(() => {
    let long = '';
    try {
      long =
        new Intl.DateTimeFormat('en', { timeZoneName: 'long' })
          .formatToParts(new Date())
          .find((p) => p.type === 'timeZoneName')?.value || '';
    } catch {
      /* ignore */
    }
    const offMin = -new Date().getTimezoneOffset();
    const sign = offMin >= 0 ? '+' : '-';
    const h = Math.abs(offMin) / 60;
    const gmt = `GMT${sign}${Number.isInteger(h) ? h : h.toFixed(1)}`;
    return { long: long || 'Local Time', gmt };
  }, []);

export const DateRangePicker = ({ value, onChange, className = '', buttonClassName = '' }: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(value?.start ?? new Date()));
  const [draft, setDraft] = useState<DateRange>({ start: value?.start ?? null, end: value?.end ?? null });
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tz = useTimezoneLabel();
  const today = startOfToday();

  // Seed draft + calendar month each time the popover opens; decide whether to
  // anchor left or right so a wide popover never spills off the viewport.
  useEffect(() => {
    if (!isOpen) return;
    setDraft({ start: value?.start ?? null, end: value?.end ?? null });
    setViewMonth(startOfMonth(value?.start ?? new Date()));
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAlign(rect.left > window.innerWidth / 2 ? 'right' : 'left');
  }, [isOpen, value]);

  // Keep the Start/End text fields in sync with the working selection.
  useEffect(() => {
    setStartText(fmtInput(draft.start));
    setEndText(fmtInput(draft.end));
  }, [draft.start, draft.end]);

  // Close on outside click.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const onDayClick = (day: Date) => {
    setDraft((prev) => {
      // No anchor yet, or a full range already chosen → start a new range.
      if (!prev.start || (prev.start && prev.end)) return { start: startOfDay(day), end: null };
      // Clicked before the anchor → move the anchor.
      if (day < prev.start) return { start: startOfDay(day), end: null };
      return { start: prev.start, end: endOfDay(day) };
    });
  };

  const commitText = (which: 'start' | 'end', raw: string) => {
    const parsed = parse(raw, 'yyyy-MM-dd HH:mm', new Date());
    if (!isNaN(parsed.getTime())) {
      setDraft((d) => ({ ...d, [which]: parsed }));
      setViewMonth(startOfMonth(parsed));
    } else {
      // revert text to the last valid value
      setStartText(fmtInput(draft.start));
      setEndText(fmtInput(draft.end));
    }
  };

  const applyPreset = (range: DateRange) => {
    onChange(range);
    setIsOpen(false);
  };

  const applyDraft = () => {
    if (!draft.start) return;
    const range: DateRange = { start: draft.start, end: draft.end ?? endOfDay(draft.start) };
    onChange(range);
    setIsOpen(false);
  };

  const clearAll = () => {
    onChange({ start: null, end: null });
    setIsOpen(false);
  };

  // Trigger label — "Jun 22 – Today" style.
  const label = (() => {
    if (!value || (!value.start && !value.end)) return 'Select range';
    const s = value.start ? format(value.start, 'MMM d') : '…';
    const e = value.end ? (isSameDay(value.end, today) ? 'Today' : format(value.end, 'MMM d')) : '…';
    return `${s} – ${e}`;
  })();

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-zinc-900 border rounded-xl text-xs sm:text-sm font-bold text-pine dark:text-zinc-100 transition-all ${
          isOpen
            ? 'border-pine dark:border-seafoam ring-2 ring-pine/20 dark:ring-seafoam/30'
            : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
        } ${buttonClassName}`}
      >
        <Calendar size={15} className="text-seafoam shrink-0" />
        <span className="truncate text-left">{label}</span>
        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 shrink-0">{tz.gmt}</span>
        <ChevronDown size={15} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover — anchored directly below the trigger with an upward caret. */}
      {isOpen && (
        <div
          className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-2.5 z-[9999] w-[min(500px,95vw)] animate-in fade-in slide-in-from-top-1 duration-150`}
        >
          {/* Caret pointing up to the trigger */}
          <div
            className={`absolute -top-[7px] ${align === 'right' ? 'right-6' : 'left-6'} w-3.5 h-3.5 rotate-45 bg-white dark:bg-zinc-900 border-l border-t border-slate-200 dark:border-zinc-800`}
          />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Top: calendar + quick ranges */}
            <div className="flex flex-col sm:flex-row">
              {/* Calendar */}
              <div className="flex-1 p-3 sm:border-r border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-black text-pine dark:text-zinc-100 tracking-tight">
                    {format(viewMonth, 'MMMM yyyy')}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewMonth((m) => subMonths(m, 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMonth((m) => addMonths(m, 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Weekday header */}
                <div className="grid grid-cols-7">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="h-6 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                      {w}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7">
                  {days.map((day) => {
                    const outside = !isSameMonth(day, viewMonth);
                    const isStart = !!draft.start && isSameDay(day, draft.start);
                    const isEnd = !!draft.end && isSameDay(day, draft.end);
                    const hasRange = !!draft.start && !!draft.end;
                    const inRange =
                      hasRange &&
                      isWithinInterval(startOfDay(day), { start: startOfDay(draft.start!), end: startOfDay(draft.end!) });
                    const isEndpoint = isStart || isEnd;
                    const isMiddle = inRange && !isEndpoint;
                    // Range bar: full behind middle days, inner-half behind the
                    // start (right) / end (left) endpoints — mirrors the design.
                    const barHalf = hasRange && isStart ? 'left-1/2 right-0' : hasRange && isEnd ? 'left-0 right-1/2' : '';
                    return (
                      <div key={day.toISOString()} className="relative h-8 flex items-center justify-center">
                        {isMiddle && <div className="absolute inset-y-0.5 inset-x-0 bg-slate-100 dark:bg-zinc-800" />}
                        {isEndpoint && hasRange && barHalf && (
                          <div className={`absolute inset-y-0.5 ${barHalf} bg-slate-100 dark:bg-zinc-800`} />
                        )}
                        <button
                          type="button"
                          onClick={() => onDayClick(day)}
                          className={`relative z-10 w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-bold transition-colors ${
                            isEndpoint
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                              : outside
                                ? 'text-slate-300 dark:text-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                : 'text-pine dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {format(day, 'd')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick ranges */}
              <div className="w-full sm:w-36 p-1.5 sm:py-3 border-t sm:border-t-0 border-slate-200 dark:border-zinc-800 overflow-y-auto max-h-[280px] custom-scrollbar">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.range())}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] font-medium text-pine dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Start / End inputs */}
            <div className="grid grid-cols-2 gap-3 px-3 py-3 border-t border-slate-200 dark:border-zinc-800">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Start</label>
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus-within:ring-2 focus-within:ring-pine/20 dark:focus-within:ring-seafoam/30">
                  <Calendar size={15} className="text-slate-400 shrink-0" />
                  <input
                    value={startText}
                    onChange={(e) => setStartText(e.target.value)}
                    onBlur={(e) => commitText('start', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitText('start', (e.target as HTMLInputElement).value); }}
                    placeholder="YYYY-MM-DD HH:mm"
                    className="w-full bg-transparent outline-none text-[12px] font-semibold text-pine dark:text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">End</label>
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus-within:ring-2 focus-within:ring-pine/20 dark:focus-within:ring-seafoam/30">
                  <Calendar size={15} className="text-slate-400 shrink-0" />
                  <input
                    value={endText}
                    onChange={(e) => setEndText(e.target.value)}
                    onBlur={(e) => commitText('end', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitText('end', (e.target as HTMLInputElement).value); }}
                    placeholder="YYYY-MM-DD HH:mm"
                    className="w-full bg-transparent outline-none text-[12px] font-semibold text-pine dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Footer: timezone + Clear + Apply */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-slate-200 dark:border-zinc-800">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-zinc-400">
                {tz.long} ({tz.gmt})
                <ChevronsUpDown size={15} className="text-slate-400" />
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  disabled={!draft.start}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;

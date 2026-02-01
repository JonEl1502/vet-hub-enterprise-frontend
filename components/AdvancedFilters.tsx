import React, { useState } from 'react';
import { Filter, X, Calendar, User, Tag, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';

export interface FilterOptions {
  dateRange?: { start: Date | null; end: Date | null };
  staffIds?: number[];
  serviceCategories?: string[];
  petIds?: number[];
  statuses?: string[];
}

interface Props {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableStaff: Array<{ id: number; name: string }>;
  availableCategories: string[];
  availablePets: Array<{ id: number; name: string }>;
  availableStatuses: string[];
}

const AdvancedFilters: React.FC<Props> = ({
  filters,
  onFiltersChange,
  availableStaff,
  availableCategories,
  availablePets,
  availableStatuses,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = [
    filters.dateRange?.start || filters.dateRange?.end ? 1 : 0,
    filters.staffIds?.length || 0,
    filters.serviceCategories?.length || 0,
    filters.petIds?.length || 0,
    filters.statuses?.length || 0,
  ].reduce((a, b) => a + b, 0);

  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    onFiltersChange({ ...filters, dateRange: { start, end } });
  };

  const toggleStaff = (staffId: number) => {
    const current = filters.staffIds || [];
    const updated = current.includes(staffId)
      ? current.filter(id => id !== staffId)
      : [...current, staffId];
    onFiltersChange({ ...filters, staffIds: updated });
  };

  const toggleCategory = (category: string) => {
    const current = filters.serviceCategories || [];
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    onFiltersChange({ ...filters, serviceCategories: updated });
  };

  const togglePet = (petId: number) => {
    const current = filters.petIds || [];
    const updated = current.includes(petId)
      ? current.filter(id => id !== petId)
      : [...current, petId];
    onFiltersChange({ ...filters, petIds: updated });
  };

  const toggleStatus = (status: string) => {
    const current = filters.statuses || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, statuses: updated });
  };

  const clearFilters = () => {
    onFiltersChange({
      dateRange: { start: null, end: null },
      staffIds: [],
      serviceCategories: [],
      petIds: [],
      statuses: [],
    });
  };

  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-pine dark:text-zinc-100 font-bold text-sm relative"
      >
        <Filter size={16} className="text-seafoam" />
        Advanced Filters
        {activeFilterCount > 0 && (
          <span className="absolute -top-2 -right-2 w-6 h-6 bg-seafoam text-white text-xs font-black rounded-full flex items-center justify-center shadow-lg">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown
          size={16}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Filter Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
                Filter Options
              </h3>
              <button
                onClick={clearFilters}
                className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={12} />
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <DatePicker
                      selected={filters.dateRange?.start || null}
                      onChange={(date) => handleDateRangeChange(date, filters.dateRange?.end || null)}
                      placeholderText="Start date"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <DatePicker
                      selected={filters.dateRange?.end || null}
                      onChange={(date) => handleDateRangeChange(filters.dateRange?.start || null, date)}
                      placeholderText="End date"
                      minDate={filters.dateRange?.start || undefined}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                </div>
              </div>

              {/* Staff Filter */}
              {availableStaff.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={12} />
                    Staff Members
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableStaff.map(staff => (
                      <button
                        key={staff.id}
                        onClick={() => toggleStaff(staff.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filters.staffIds?.includes(staff.id)
                            ? 'bg-seafoam text-white'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {staff.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Categories */}
              {availableCategories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Tag size={12} />
                    Service Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map(category => (
                      <button
                        key={category}
                        onClick={() => toggleCategory(category)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filters.serviceCategories?.includes(category)
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Filter */}
              {availableStatuses.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableStatuses.map(status => (
                      <button
                        key={status}
                        onClick={() => toggleStatus(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filters.statuses?.includes(status)
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active Filters Summary */}
            {activeFilterCount > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    <span className="font-black text-seafoam">{activeFilterCount}</span> filter{activeFilterCount !== 1 ? 's' : ''} active
                  </p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 bg-seafoam text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvancedFilters;


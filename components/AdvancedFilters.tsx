import React, { useState } from 'react';
import { X, Calendar, User, Tag } from 'lucide-react';
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
  availableStaff?: Array<{ id: number; name: string }>;
  staff?: Array<{ id: number; name: string }>;
  availableCategories?: string[];
  availablePets?: Array<{ id: number; name: string }>;
  pets?: Array<{ id: number; name: string }>;
  availableStatuses?: string[];
  onClose?: () => void;
}

const AdvancedFilters: React.FC<Props> = ({
  filters,
  onFiltersChange,
  availableStaff = [],
  staff = [],
  availableCategories = [],
  availablePets = [],
  pets = [],
  availableStatuses = [],
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const staffList = availableStaff.length > 0 ? availableStaff : staff;
  const petList = availablePets.length > 0 ? availablePets : pets;

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

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  return (
    <div className="w-full">

      {/* Filter Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-2 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
                Filter Options
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearFilters}
                  className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors uppercase tracking-widest"
                >
                  Clear All
                </button>
                <button
                  onClick={handleClose}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {/* Date Range */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={11} />
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <DatePicker
                      selected={filters.dateRange?.start || null}
                      onChange={(date) => handleDateRangeChange(date, filters.dateRange?.end || null)}
                      placeholderText="Start date"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                  <div>
                    <DatePicker
                      selected={filters.dateRange?.end || null}
                      onChange={(date) => handleDateRangeChange(filters.dateRange?.start || null, date)}
                      placeholderText="End date"
                      minDate={filters.dateRange?.start || undefined}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    />
                  </div>
                </div>
              </div>

              {/* Staff Filter */}
              {staffList.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={11} />
                    Staff Members
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {staffList.map(staff => (
                      <button
                        key={staff.id}
                        onClick={() => toggleStaff(staff.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
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
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Tag size={11} />
                    Service Categories
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCategories.map(category => (
                      <button
                        key={category}
                        onClick={() => toggleCategory(category)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
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
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableStatuses.map(status => (
                      <button
                        key={status}
                        onClick={() => toggleStatus(status)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
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
              <div className="px-4 py-2 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-600 dark:text-zinc-400">
                    <span className="font-black text-seafoam">{activeFilterCount}</span> filter{activeFilterCount !== 1 ? 's' : ''} active
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-3 py-1 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all"
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


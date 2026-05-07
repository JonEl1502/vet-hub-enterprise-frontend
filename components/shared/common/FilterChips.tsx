import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { FilterOptions } from './AdvancedFilters';

interface Props {
  filters: FilterOptions;
  onRemoveFilter: (filterType: keyof FilterOptions, value?: any) => void;
  staffMap?: Map<number, string>;
  petMap?: Map<number, string>;
  staff?: Array<{ id: number; name: string }>;
  pets?: Array<{ id: number; name: string }>;
  onClearAll?: () => void;
}

const FilterChips: React.FC<Props> = ({
  filters,
  onRemoveFilter,
  staffMap,
  petMap,
  staff = [],
  pets = [],
  onClearAll,
}) => {
  const chips: Array<{ id: string; label: string; type: keyof FilterOptions; value?: any }> = [];

  const getStaffName = (id: number) => {
    if (staffMap?.has(id)) return staffMap.get(id);
    const found = staff.find(s => s.id === id);
    return found ? found.name : `Staff #${id}`;
  };

  const getPetName = (id: number) => {
    if (petMap?.has(id)) return petMap.get(id);
    const found = pets.find(p => p.id === id);
    return found ? found.name : `Pet #${id}`;
  };

  // Date range chip
  if (filters.dateRange?.start || filters.dateRange?.end) {
    const start = filters.dateRange.start ? format(filters.dateRange.start, 'MMM dd') : '...';
    const end = filters.dateRange.end ? format(filters.dateRange.end, 'MMM dd') : '...';
    chips.push({
      id: 'dateRange',
      label: `${start} - ${end}`,
      type: 'dateRange',
    });
  }

  // Staff chips
  filters.staffIds?.forEach(staffId => {
    chips.push({
      id: `staff-${staffId}`,
      label: getStaffName(staffId) || `Staff #${staffId}`,
      type: 'staffIds',
      value: staffId,
    });
  });

  // Category chips
  filters.serviceCategories?.forEach(category => {
    chips.push({
      id: `category-${category}`,
      label: category,
      type: 'serviceCategories',
      value: category,
    });
  });

  // Pet chips
  filters.petIds?.forEach(petId => {
    chips.push({
      id: `pet-${petId}`,
      label: getPetName(petId) || `Pet #${petId}`,
      type: 'petIds',
      value: petId,
    });
  });

  // Status chips
  filters.statuses?.forEach(status => {
    chips.push({
      id: `status-${status}`,
      label: status.replace('_', ' '),
      type: 'statuses',
      value: status,
    });
  });

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
        Filters:
      </span>
      <AnimatePresence>
        {chips.map(chip => (
          <motion.button
            key={chip.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onRemoveFilter(chip.type, chip.value)}
            className="flex items-center gap-1.5 px-2 py-1 bg-seafoam/10 text-seafoam border border-seafoam/20 rounded-lg hover:bg-seafoam hover:text-white transition-all group"
          >
            <span className="text-[10px] font-bold">{chip.label}</span>
            <X size={10} className="group-hover:rotate-90 transition-transform" />
          </motion.button>
        ))}
        {onClearAll && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClearAll}
            className="text-[9px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest ml-1"
          >
            Clear All
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterChips;


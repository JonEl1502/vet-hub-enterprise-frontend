import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PaginationMeta } from '../services/types/pagination';
import { calculatePageRange } from '../services/types/pagination';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showLimitSelector?: boolean;
  limitOptions?: number[];
  /** Compact variant: only prev/next + scrollable page numbers, no counter or per-page selector. For top-of-list placement. */
  compact?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  meta,
  onPageChange,
  onLimitChange,
  showLimitSelector = true,
  limitOptions = [10, 20, 50, 100],
  compact = false,
}) => {
  const { currentPage, totalPages, totalItems, itemsPerPage, hasNextPage, hasPreviousPage } = meta;

  const pageRange = calculatePageRange(currentPage, totalPages);

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onLimitChange) {
      onLimitChange(parseInt(e.target.value));
    }
  };

  if (compact) {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl">
        <button
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={!hasPreviousPage}
          className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0">
          {pageRange.map((page) => (
            <button
              key={page}
              onClick={() => handlePageClick(page)}
              className={`shrink-0 min-w-[32px] px-2.5 py-1 text-[9px] font-black rounded-lg transition-colors uppercase tracking-wider ${
                page === currentPage
                  ? 'bg-seafoam text-white shadow-sm'
                  : 'border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={!hasNextPage}
          className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  if (totalPages <= 1 && !showLimitSelector) {
    return null;
  }

  const from = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-b-xl">
      {/* Items info — compact X-Y/Z form */}
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
          <span className="text-pine dark:text-zinc-100">{from}-{to}</span>
          <span className="text-slate-400">/</span>
          <span className="text-pine dark:text-zinc-100">{totalItems}</span>
        </p>

        {/* Items per page selector */}
        {showLimitSelector && onLimitChange && (() => {
          // Ensure the current itemsPerPage is always selectable so the dropdown
          // never silently falls back to displaying the wrong number.
          const mergedOptions = limitOptions.includes(itemsPerPage)
            ? limitOptions
            : [itemsPerPage, ...limitOptions].sort((a, b) => a - b);
          return (
            <select
              id="limit"
              value={itemsPerPage}
              onChange={handleLimitChange}
              className="px-2 py-1 text-[9px] font-black border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-seafoam uppercase tracking-wider"
              title="Items per page"
            >
              {mergedOptions.map((option) => (
                <option key={option} value={option}>
                  {option}/pg
                </option>
              ))}
            </select>
          );
        })()}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          {/* First page */}
          <button
            onClick={() => handlePageClick(1)}
            disabled={!hasPreviousPage}
            className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="First page"
          >
            <ChevronsLeft size={14} />
          </button>

          {/* Previous page */}
          <button
            onClick={() => handlePageClick(currentPage - 1)}
            disabled={!hasPreviousPage}
            className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page numbers — scrollable when they overflow */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
            {pageRange.map((page) => (
              <button
                key={page}
                onClick={() => handlePageClick(page)}
                className={`shrink-0 min-w-[32px] px-2.5 py-1 text-[9px] font-black rounded-lg transition-colors uppercase tracking-wider ${
                  page === currentPage
                    ? 'bg-seafoam text-white shadow-sm'
                    : 'border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          {/* Next page */}
          <button
            onClick={() => handlePageClick(currentPage + 1)}
            disabled={!hasNextPage}
            className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>

          {/* Last page */}
          <button
            onClick={() => handlePageClick(totalPages)}
            disabled={!hasNextPage}
            className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Last page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;


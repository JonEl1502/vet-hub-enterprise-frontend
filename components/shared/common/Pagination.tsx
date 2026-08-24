import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpToLine, ArrowDownToLine, AlignCenterVertical } from 'lucide-react';
import { PaginationMeta } from '../../../services/types/pagination';
import { calculatePageRange } from '../../../services/types/pagination';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showLimitSelector?: boolean;
  limitOptions?: number[];
  /** Compact variant: only prev/next + scrollable page numbers, no counter or per-page selector. For top-of-list placement. */
  compact?: boolean;
  /**
   * Render a SECOND copy of the full bar, stuck to the bottom of the viewport
   * (user, 2026-08-24). On a 4,000-row list the pager is a scroll away at all
   * times; this keeps it under the thumb without moving the one at the end of
   * the list, which is where people look for it after reading the last row.
   *
   * The sticky copy — and only the sticky copy — carries the scroll buttons in
   * the space its middle would otherwise waste.
   *
   * ⚠️ Ignored on a short list: fewer than `STICKY_MIN_ROWS` rows on screen and
   * no second bar is rendered.
   */
  alsoStickyBottom?: boolean;
}

/**
 * Below this many rows on screen there is nothing to scroll past, so the sticky
 * copy of the pager is not rendered at all.
 */
const STICKY_MIN_ROWS = 20;

const Pagination: React.FC<PaginationProps> = ({
  meta,
  onPageChange,
  onLimitChange,
  showLimitSelector = true,
  /**
   * 100 WAS THE CEILING AND THE SERVER'S IS 1,000 (user, 2026-08-24: the
   * dropdown "limits to 100" on clients, patients and visits).
   * `parsePaginationParams` caps `limit` at 1000, so everything up to there is
   * a request the API will honour — the dropdown was simply not offering it.
   *
   * ⚠️ 1000 is the real maximum, not a round number: ask for more and the
   * server silently clamps, so the pager would promise a page size it never
   * returns.
   */
  limitOptions = [10, 20, 50, 100, 250, 500, 1000],
  compact = false,
  alsoStickyBottom = false,
}) => {
  const stickyRef = React.useRef<HTMLDivElement>(null);

  /**
   * The app does not scroll the window — `<main>` does — and a view may put
   * its own scroller in between. So find the real scrollport by climbing from
   * the bar itself rather than assuming one, and fall back to the document.
   */
  const scrollPort = (): { el: HTMLElement | null; max: number } => {
    let node: HTMLElement | null = stickyRef.current?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
        return { el: node, max: node.scrollHeight - node.clientHeight };
      }
      node = node.parentElement;
    }
    const doc = (document.scrollingElement || document.documentElement) as HTMLElement;
    return { el: doc, max: doc.scrollHeight - doc.clientHeight };
  };

  const scrollTo = (where: 'top' | 'center' | 'bottom') => {
    const { el, max } = scrollPort();
    if (!el) return;
    const top = where === 'top' ? 0 : where === 'bottom' ? max : Math.round(max / 2);
    el.scrollTo({ top, behavior: 'smooth' });
  };
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
    // No limit selector in the compact variant — it is a top-of-list summary,
    // so one page means nothing to show.
    if (totalPages <= 1) return null;
    const cFrom = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const cTo = Math.min(currentPage * itemsPerPage, totalItems);
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl">
        {/* The count belongs at the TOP as well, not only under the list
            (user, 2026-08-22): on a long page you decide whether to page or
            filter BEFORE scrolling to the bottom to find out how many there
            are. */}
        <p className="shrink-0 text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap pr-1">
          <span className="text-pine dark:text-zinc-100">{cFrom}-{cTo}</span>
          <span className="text-slate-400">/</span>
          <span className="text-pine dark:text-zinc-100">{totalItems}</span>
        </p>
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

  const bar = (isSticky: boolean) => (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${
      isSticky ? 'rounded-xl border shadow-lg shadow-slate-900/10 dark:shadow-black/40' : 'rounded-b-xl'
    }`}>
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

      {/* Scroll controls — the STICKY copy only (user, 2026-08-24). The bar at
          the end of the list is already at the bottom, so "back to top" there
          would be a button you reach by doing the thing it offers to do. Here
          the middle of the bar is dead space and the list above it is long. */}
      {isSticky && (
        <div className="flex items-center gap-1.5 order-3 sm:order-none">
          <button
            onClick={() => scrollTo('top')}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-seafoam transition-colors text-[9px] font-black uppercase tracking-wider"
            title="Scroll back to the top"
          >
            <ArrowUpToLine size={13} />
            <span className="hidden sm:inline">Top</span>
          </button>
          <button
            onClick={() => scrollTo('center')}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-seafoam transition-colors text-[9px] font-black uppercase tracking-wider"
            title="Scroll to the middle of the list"
          >
            <AlignCenterVertical size={13} />
            <span className="hidden sm:inline">Middle</span>
          </button>
          <button
            onClick={() => scrollTo('bottom')}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-seafoam transition-colors text-[9px] font-black uppercase tracking-wider"
            title="Scroll to the end of the list"
          >
            <ArrowDownToLine size={13} />
            <span className="hidden sm:inline">Bottom</span>
          </button>
        </div>
      )}

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

  /**
   * The sticky copy only earns its place on a list long enough that the bar at
   * the END of it is off-screen (user, 2026-08-24: "if records below 10 or 20
   * hide the bottom pager"). On a short list — or an empty one — it was two
   * identical bars stacked on top of each other saying "0-0/0".
   *
   * ⚠️ Measured in ROWS ACTUALLY RENDERED, not `totalItems`: 4,171 results at
   * 5/pg is five rows on screen and needs no floating pager, while 40 results
   * at 100/pg is forty rows and does.
   */
  const rowsOnPage = Math.min(itemsPerPage, totalItems);
  if (!alsoStickyBottom || rowsOnPage < STICKY_MIN_ROWS) return bar(false);

  return (
    <>
      {bar(false)}
      {/*
        A COPY, not a move: the bar at the end of the list stays where people
        look for it after the last row. This one rides the bottom of the
        scrollport so paging never costs a scroll.

        ⚠️ `sticky`, not `fixed` — fixed would sit over the page at every
        width and cover the last row; sticky pins only while there IS more
        list below, and settles above its twin at the end.
        ⚠️ The wrapper is `pointer-events-none` so the transparent gutter
        beside the bar does not eat clicks on the row underneath it.
      */}
      {/*
        ⚠️ z-[52] is a SLOT, not a round number. The ladder it has to sit in:
          60  navbar
          55  the list pages' filter card and its dropdowns
        → 52  this bar
          50  a hovered list card (`hover:z-[50]`), which also bounds the card's
              own ⋮ menu — a child cannot escape its parent's stacking context
          40  was here, and a hovered card rose straight over the pager
        Above the cards it is pinned in front of, below the filters that open
        downward onto it (user, 2026-08-24).
      */}
      <div ref={stickyRef} className="sticky bottom-2 z-[52] mt-2 px-1 pointer-events-none">
        <div className="pointer-events-auto">{bar(true)}</div>
      </div>
    </>
  );
};

export default Pagination;


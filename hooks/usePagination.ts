import { useState, useMemo } from 'react';
import { PaginationMeta } from '../services/types/pagination';

/**
 * Custom hook for client-side pagination
 * @param items - Array of items to paginate
 * @param initialItemsPerPage - Initial number of items per page (default: 12)
 * @returns Paginated items and pagination controls
 */
export function usePagination<T>(items: T[], initialItemsPerPage: number = 12) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  // Calculate pagination metadata
  const paginationMeta: PaginationMeta = useMemo(() => {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const safePage = Math.min(currentPage, totalPages);

    return {
      currentPage: safePage,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    };
  }, [items.length, itemsPerPage, currentPage]);

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (paginationMeta.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, paginationMeta.currentPage, itemsPerPage]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle items per page change
  const handleLimitChange = (limit: number) => {
    setItemsPerPage(limit);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Reset to first page (useful when filters change)
  const resetPage = () => {
    setCurrentPage(1);
  };

  return {
    paginatedItems,
    paginationMeta,
    currentPage,
    itemsPerPage,
    handlePageChange,
    handleLimitChange,
    resetPage,
  };
}


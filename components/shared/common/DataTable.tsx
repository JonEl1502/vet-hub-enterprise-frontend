import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Skip this field in mobile card rows (e.g. already shown via cardTitle/cardBadge/cardExtra) */
  hideInCard?: boolean;
}

export interface TableAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  /** Per-row actions rendered as a ⋮ dropdown on both mobile and desktop */
  actions?: (row: T) => TableAction<T>[];
  /** Column key whose render output becomes the mobile card header (auto-excluded from card rows) */
  headerKey: string;
  /** Status badge or similar element shown top-right in card header */
  cardBadge?: (row: T) => React.ReactNode;
  /** Extra element in card header before the ⋮ menu (e.g. a toggle) */
  cardExtra?: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

function DataTable<T>({
  rows,
  columns,
  rowKey,
  actions,
  headerKey,
  cardBadge,
  cardExtra,
  emptyState,
}: DataTableProps<T>) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const headerCol = columns.find(c => c.key === headerKey);
  const cardColumns = columns.filter(c => !c.hideInCard && c.key !== headerKey);
  const hasActions = !!actions;

  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {emptyState}
      </div>
    );
  }

  const ActionMenu = ({ row, menuKey }: { row: T; menuKey: string }) => {
    const rowActions = actions?.(row) ?? [];
    if (rowActions.length === 0) return null;
    const isOpen = openMenu === menuKey;
    return (
      <div className="relative">
        <button
          onClick={() => setOpenMenu(isOpen ? null : menuKey)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
        >
          <MoreVertical size={16} />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {rowActions.map((action, i) => (
                <button
                  key={i}
                  disabled={action.disabled}
                  onClick={() => { action.onClick(row); setOpenMenu(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    action.variant === 'danger'
                      ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                      : 'text-pine dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {action.icon && (
                    <span className={action.variant === 'danger' ? 'text-red-400' : 'text-blue-400'}>
                      {action.icon}
                    </span>
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* ── Mobile cards ─────────────────────────────── */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
        {rows.map(row => {
          const key = rowKey(row);
          return (
            <div key={key} className="p-4">
              {/* Card header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="min-w-0 flex-1">
                  {headerCol?.render(row)}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cardBadge?.(row)}
                  {cardExtra?.(row)}
                  <ActionMenu row={row} menuKey={key} />
                </div>
              </div>

              {/* Field rows */}
              {cardColumns.map(col => (
                <div
                  key={col.key}
                  className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 dark:border-zinc-800/40 last:border-0"
                >
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                    {col.label}
                  </div>
                  <div className="text-right">{col.render(row)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 ${ALIGN[col.align ?? 'left']}`}>
                  {col.label}
                </th>
              ))}
              {hasActions && <th className="px-4 py-3 text-right" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/60">
            {rows.map(row => {
              const key = rowKey(row);
              return (
                <tr key={key} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className={`px-4 py-3 ${ALIGN[col.align ?? 'left']}`}>
                      {col.render(row)}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3 text-right">
                      <ActionMenu row={row} menuKey={key} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;

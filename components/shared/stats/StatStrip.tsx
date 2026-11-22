import React from 'react';
import { SoftTile, SoftTone } from './ColorTiles';

/**
 * A row of coloured SoftTiles that can act as a status filter (user,
 * 2026-11-22: stats cards on Reminders, Appointments and Visits). Clicking a
 * tile selects its key; clicking the selected tile again clears it. A tile
 * with no `filterable` flag is display-only.
 */
export interface StatItem {
  key: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone: SoftTone;
  icon?: React.ComponentType<any>;
  /** false = this tile shows a figure but does not filter. Default true. */
  filterable?: boolean;
}

interface Props {
  items: StatItem[];
  active?: string | null;
  onSelect?: (key: string | null) => void;
  /** Tailwind grid columns; defaults to 2 / 4 / 8 (8 only on very wide screens). */
  cols?: string;
}

const StatStrip: React.FC<Props> = ({ items, active, onSelect, cols = 'grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8' }) => (
  <div className={`grid ${cols} gap-2.5`}>
    {items.map(it => {
      const canFilter = !!onSelect && it.filterable !== false;
      const on = canFilter && active === it.key;
      return (
        <div key={it.key} className={`rounded-2xl transition-shadow ${on ? 'ring-2 ring-seafoam ring-offset-2 ring-offset-white dark:ring-offset-zinc-950' : ''}`}>
          <SoftTile
            compact
            label={it.label}
            value={it.value}
            sub={it.sub}
            tone={it.tone}
            icon={it.icon}
            onClick={canFilter ? () => onSelect!(on ? null : it.key) : undefined}
          />
        </div>
      );
    })}
  </div>
);

export default StatStrip;

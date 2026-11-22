import React from 'react';
import { SOFT, GRAD_FOR, SoftTone } from './ColorTiles';

/**
 * A list card coloured by its status (user, 2026-11-22: Inpatient / Grooming /
 * Boarding "can look better, maybe better colors"). The shared SoftTile wash
 * for the body plus a gradient band across the top in the same tone, so a
 * board of cards reads by colour before it reads by text. `tone = null` is a
 * finished / closed record: plain white card, grey band.
 */
interface Props {
  tone: SoftTone | null;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}

const TintCard: React.FC<Props> = ({ tone, onClick, title, children }) => {
  const t = tone ? SOFT[tone] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative overflow-hidden text-left border rounded-2xl p-4 pt-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
        t ? `${t.tile} ${t.ring}` : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-seafoam'
      }`}
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${tone ? GRAD_FOR[tone].bg : 'bg-slate-200 dark:bg-zinc-700'}`} />
      {children}
    </button>
  );
};

export default TintCard;

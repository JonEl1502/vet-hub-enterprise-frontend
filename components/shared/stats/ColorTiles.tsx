import React from 'react';

/**
 * Coloured stat tiles — the supplier dashboard's look, shared (user,
 * 2026-11-21: "i want stats card in clinic admin etc to be colored like
 * supplier"). Two kinds, same palette as `SupplierDashboard`:
 *
 *  - `GradientTile` — the money cards: a deep gradient, white figure, rings.
 *  - `SoftTile`     — counts and everything else: a tinted wash, a solid icon
 *                     chip, the number in the tone's ink.
 *
 * Tiles without an explicit tone take the next colour in `CYCLE`, so a row of
 * six reads as six colours rather than six grey boxes. Meaning still wins:
 * callers pass `rose` for a problem and `amber` for a warning.
 */

export type SoftTone = 'violet' | 'emerald' | 'sky' | 'rose' | 'amber' | 'pine' | 'indigo' | 'teal';
export type GradientTone = 'pine' | 'ocean' | 'gold' | 'violet';

export const SOFT: Record<SoftTone, { tile: string; icon: string; num: string; ring: string }> = {
  violet:  { tile: 'bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20',     icon: 'bg-violet-500 text-white',  num: 'text-violet-700 dark:text-violet-300',   ring: 'hover:border-violet-300' },
  emerald: { tile: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'bg-emerald-600 text-white', num: 'text-emerald-700 dark:text-emerald-300', ring: 'hover:border-emerald-300' },
  sky:     { tile: 'bg-sky-50 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20',                 icon: 'bg-sky-500 text-white',     num: 'text-sky-700 dark:text-sky-300',         ring: 'hover:border-sky-300' },
  rose:    { tile: 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20',             icon: 'bg-rose-500 text-white',    num: 'text-rose-700 dark:text-rose-300',       ring: 'hover:border-rose-300' },
  amber:   { tile: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20',         icon: 'bg-amber-500 text-white',   num: 'text-amber-700 dark:text-amber-300',     ring: 'hover:border-amber-300' },
  pine:    { tile: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'bg-[#144E35] text-white',   num: 'text-[#144E35] dark:text-emerald-300',   ring: 'hover:border-emerald-300' },
  indigo:  { tile: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20',     icon: 'bg-indigo-500 text-white',  num: 'text-indigo-700 dark:text-indigo-300',   ring: 'hover:border-indigo-300' },
  teal:    { tile: 'bg-teal-50 dark:bg-teal-500/10 border-teal-100 dark:border-teal-500/20',             icon: 'bg-teal-500 text-white',    num: 'text-teal-700 dark:text-teal-300',       ring: 'hover:border-teal-300' },
};

/** The order tiles take colours in when a row gives none. */
export const CYCLE: SoftTone[] = ['pine', 'sky', 'violet', 'amber', 'indigo', 'teal', 'rose', 'emerald'];
export const toneAt = (i: number): SoftTone => CYCLE[i % CYCLE.length];

export const GRADIENT: Record<GradientTone, { bg: string; text: string; sub: string; chip: string }> = {
  pine:   { bg: 'bg-gradient-to-br from-[#0f3d29] via-[#144E35] to-[#1f7a52]', text: 'text-white',     sub: 'text-emerald-100/80', chip: 'bg-white/15 text-white' },
  ocean:  { bg: 'bg-gradient-to-br from-[#0c4a6e] via-[#0369a1] to-[#0ea5e9]', text: 'text-white',     sub: 'text-sky-100/80',     chip: 'bg-white/15 text-white' },
  gold:   { bg: 'bg-gradient-to-br from-[#F2A41C] via-[#f59e0b] to-[#fbbf24]', text: 'text-[#3d2a05]', sub: 'text-[#3d2a05]/70',   chip: 'bg-white/30 text-[#3d2a05]' },
  violet: { bg: 'bg-gradient-to-br from-[#4c1d95] via-[#6d28d9] to-[#a855f7]', text: 'text-white',     sub: 'text-violet-100/80',  chip: 'bg-white/15 text-white' },
};

interface SoftProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone: SoftTone;
  icon?: React.ComponentType<any>;
  onClick?: () => void;
  /** Extra control in the tile's corner (e.g. a "View" link). */
  action?: React.ReactNode;
  compact?: boolean;
}

export const SoftTile: React.FC<SoftProps> = ({ label, value, sub, tone, icon: Icon, onClick, action, compact }) => {
  const t = SOFT[tone];
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`relative text-left rounded-2xl border ${compact ? 'p-3.5' : 'p-4'} flex items-center gap-3.5 min-w-0 transition-all ${t.tile} ${
        onClick ? `hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${t.ring}` : ''
      }`}
    >
      {Icon && (
        <span className={`${compact ? 'w-10 h-10' : 'w-11 h-11'} rounded-xl grid place-items-center shadow-sm shrink-0 ${t.icon}`}>
          <Icon size={compact ? 17 : 19} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">{label}</span>
        <span className={`block mt-1 ${compact ? 'text-[20px]' : 'text-[24px]'} font-black leading-none tabular-nums truncate ${t.num}`}>{value}</span>
        {sub != null && sub !== '' && <span className="block mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate">{sub}</span>}
      </span>
      {action && <span className="self-start shrink-0">{action}</span>}
    </Tag>
  );
};

interface GradientProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone: GradientTone;
  icon: React.ComponentType<any>;
  onClick?: () => void;
}

export const GradientTile: React.FC<GradientProps> = ({ label, value, sub, tone, icon: Icon, onClick }) => {
  const t = GRADIENT[tone];
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`relative overflow-hidden text-left rounded-3xl p-5 shadow-lg shadow-slate-900/10 ${t.bg} ${t.text} min-h-[132px] flex flex-col ${
        onClick ? 'hover:brightness-110 active:scale-[0.99] transition' : ''
      }`}
    >
      <span className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10" />
      <span className="absolute -right-2 -bottom-14 w-28 h-28 rounded-full bg-white/5" />
      <Icon className="absolute right-4 bottom-4 opacity-[0.12]" size={60} strokeWidth={1.5} />
      <span className="relative flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${t.sub}`}>{label}</span>
        <span className={`w-8 h-8 rounded-xl grid place-items-center ${t.chip}`}><Icon size={15} /></span>
      </span>
      <span className="relative mt-3 text-[26px] font-black tracking-tight leading-none tabular-nums truncate">{value}</span>
      {sub != null && sub !== '' && <span className={`relative mt-2 text-[11px] font-semibold ${t.sub} truncate`}>{sub}</span>}
    </Tag>
  );
};

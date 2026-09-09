import React, { useState } from 'react';
import { Dog, Wheat, Loader2, Check } from 'lucide-react';
import type { PortalMode } from './usePortalMode';

/**
 * 290 — THE ONE QUESTION A NEW PORTAL ACCOUNT IS ASKED.
 *
 * User, 2026-09-09: *"they both use client, but when they log in, they say
 * which part they want to activate. So if they only activated one, let's say
 * they activated farm, then every time they log in it will be going to farm
 * without asking again."*
 *
 * ⚠️ IT IS ASKED ONCE, AND ONLY WHEN THERE IS A REAL QUESTION. The server
 * decides (`needsSideChoice`): nothing chosen yet, AND either both sides are
 * already live or neither is. An account with pets and no farm is not asked —
 * its answer is already on the record. Asking anyway would be a modal between
 * a returning user and their own animals.
 *
 * ⚠️ NOT DISMISSIBLE, and deliberately so. Every other modal in the portal
 * closes on backdrop or Escape, but this one has no correct "neither" — the
 * app behind it cannot render a nav until it knows which side it is. It is
 * also not a commitment: the answer is changed from Profile → Settings in two
 * clicks, and the copy says so before anyone picks.
 */
const SIDES: Array<{
  id: PortalMode;
  icon: typeof Dog;
  title: string;
  blurb: string;
  bullets: string[];
}> = [
  {
    id: 'PETS',
    icon: Dog,
    title: 'My pets',
    blurb: 'Dogs, cats and other animals you keep at home.',
    bullets: ['Vaccination and visit history', 'Book appointments with your clinic', 'Bills and reminders in one place'],
  },
  {
    id: 'FARM',
    icon: Wheat,
    title: 'My farm',
    blurb: 'Livestock, crops and the money that moves through them.',
    bullets: ['Herds, flocks and head counts', 'Feed, treatments and produce', 'Link a clinic or a vet officer'],
  },
];

interface Props {
  /** Hidden when the plan cannot support farm mode — see usePortalMode. */
  farmAvailable: boolean;
  onChoose: (side: PortalMode) => Promise<unknown>;
}

const PortalSideChooser: React.FC<Props> = ({ farmAvailable, onChoose }) => {
  const [saving, setSaving] = useState<PortalMode | null>(null);
  const sides = SIDES.filter((s) => s.id !== 'FARM' || farmAvailable);

  const pick = async (side: PortalMode) => {
    if (saving) return;
    setSaving(side);
    try { await onChoose(side); } finally { setSaving(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <p className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-seafoam">
          Welcome
        </p>
        <h2 className="mt-1.5 text-xl font-black text-slate-900 dark:text-zinc-100 leading-tight">
          What are you here to look after?
        </h2>
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          This sets what the app opens on. It is one account either way — you can
          turn the other side on whenever you like from Profile → Settings, and
          keep both.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sides.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              disabled={!!saving}
              className="group text-left rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 hover:border-pine dark:hover:border-seafoam hover:bg-pine/[0.03] dark:hover:bg-pine/10 transition-all disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-pine/10 dark:bg-seafoam/15 grid place-items-center shrink-0">
                  {saving === s.id
                    ? <Loader2 size={18} className="animate-spin text-pine dark:text-seafoam" />
                    : <s.icon size={18} className="text-pine dark:text-seafoam" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-900 dark:text-zinc-100">{s.title}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{s.blurb}</span>
                </span>
              </span>
              <ul className="mt-3 space-y-1.5">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-zinc-400">
                    <Check size={11} className="text-pine dark:text-seafoam shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortalSideChooser;

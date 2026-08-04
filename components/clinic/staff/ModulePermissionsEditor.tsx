import React from 'react';
import { LayoutGrid, Check, Minus, Lock } from 'lucide-react';
import { UserRole } from '../../../types';
import {
  PERMISSION_MODULES, MODULE_ROLE_PRESETS, ModuleDef, ModuleActionDef,
  DENY_PREFIX, denyOf, grantsFor,
} from '../../../constants/modulePermissions';

/**
 * Grouped page permissions — "access the page" + [create · edit · delete],
 * laid out the way the sidebar reads (user, 2026-08-04).
 *
 * One row per PAGE, one chip per ACTION. Three states per chip:
 *   • from role   — the role preset grants it (seafoam). Click to DENY.
 *   • granted     — an explicit extra grant for this person (indigo).
 *   • off         — click to grant.
 *   • denied      — explicitly taken away from the preset (rose, minus icon).
 *
 * "Access page" is the page grant itself, so granting any action turns it on
 * automatically and denying it takes the whole page away.
 */

interface Props {
  role: UserRole;
  /** The person's stored `customPermissions`, grants and `-denials` together. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Owner/manager/platform admin — every page, nothing to configure. */
  fullAccess?: boolean;
}

type ChipState = 'preset' | 'granted' | 'denied' | 'off';

const ModulePermissionsEditor: React.FC<Props> = ({ role, value, onChange, fullAccess }) => {
  const preset = new Set(MODULE_ROLE_PRESETS[role] || []);
  const effective = grantsFor({ role, customPermissions: value });

  const stateOf = (grant: string): ChipState => {
    if (value.includes(denyOf(grant))) return 'denied';
    if (value.includes(grant)) return 'granted';
    if (preset.has(grant)) return 'preset';
    return effective.has(grant) ? 'granted' : 'off';
  };

  /** off → grant · preset → deny · granted/denied → back to the role default. */
  const toggle = (moduleId: string, actionId: string) => {
    const grant = `${moduleId}:${actionId}`;
    const state = stateOf(grant);
    let next = value.filter(v => v !== grant && v !== denyOf(grant));

    if (state === 'off') {
      next.push(grant);
      // Rule 2 — an action implies page access. Clear a stale view denial and
      // add the view grant when the preset doesn't already carry it.
      const view = `${moduleId}:view`;
      if (actionId !== 'view') {
        next = next.filter(v => v !== denyOf(view));
        if (!preset.has(view) && !next.includes(view)) next.push(view);
      }
    } else if (state === 'preset' || state === 'granted') {
      next.push(denyOf(grant));
      // Denying the page denies everything on it — drop the now-meaningless
      // action grants rather than leaving orphans in the stored list.
      if (actionId === 'view') {
        next = next.filter(v => !v.startsWith(`${moduleId}:`));
        next.push(denyOf(`${moduleId}:view`));
      }
    }
    onChange(Array.from(new Set(next)));
  };

  if (fullAccess) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3 mb-3">
          <LayoutGrid className="text-seafoam shrink-0" size={18} />
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Page permissions</h3>
        </div>
        <p className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
          <Lock size={13} /> Owners and managers have every page and every action — nothing to configure here.
        </p>
      </div>
    );
  }

  const groups = Array.from(new Set(PERMISSION_MODULES.map(m => m.group)));

  const chip = (m: ModuleDef, a: ModuleActionDef) => {
    const grant = `${m.id}:${a.id}`;
    const state = stateOf(grant);
    const isView = a.id === 'view';
    const tone =
      state === 'denied'  ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
      : state === 'preset'  ? 'bg-seafoam/10 border-seafoam/40 text-seafoam'
      : state === 'granted' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400'
      : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 hover:border-slate-300';
    const title =
      state === 'denied'  ? 'Taken away from this person — click to restore the role default'
      : state === 'preset'  ? `Comes with ${String(role).replace(/_/g, ' ').toLowerCase()} — click to take it away`
      : state === 'granted' ? 'Granted to this person — click to remove'
      : a.hint || 'Click to grant';

    return (
      <button
        key={a.id}
        type="button"
        onClick={() => toggle(m.id, a.id)}
        title={title}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-left ${tone} ${
          isView ? 'font-black' : ''
        }`}
      >
        <span className={`w-3 h-3 rounded flex items-center justify-center shrink-0 border ${
          state === 'off' ? 'border-slate-300 dark:border-zinc-600' : 'bg-current border-current'
        }`}>
          {state === 'denied'
            ? <Minus size={9} className="text-white dark:text-zinc-900" />
            : state !== 'off' && <Check size={9} className="text-white dark:text-zinc-900" />}
        </span>
        <span className="text-[9px] font-black uppercase tracking-wide whitespace-nowrap">{a.label}</span>
      </button>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <LayoutGrid className="text-seafoam shrink-0" size={18} />
          <div>
            <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Page permissions</h3>
            <p className="text-[10px] font-bold text-slate-400">Access to a page, and what they may do on it</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-1 text-seafoam"><span className="w-2 h-2 rounded bg-seafoam" /> From role</span>
          <span className="flex items-center gap-1 text-indigo-500"><span className="w-2 h-2 rounded bg-indigo-500" /> Granted</span>
          <span className="flex items-center gap-1 text-rose-500"><span className="w-2 h-2 rounded bg-rose-500" /> Taken away</span>
        </div>
      </div>

      <div className="space-y-5">
        {groups.map(group => (
          <div key={group}>
            <h4 className="text-[9px] font-black text-seafoam uppercase tracking-widest mb-2">{group}</h4>
            <div className="space-y-2">
              {PERMISSION_MODULES.filter(m => m.group === group).map(m => {
                const pageOff = stateOf(`${m.id}:view`) === 'denied';
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 transition-all ${
                      pageOff
                        ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/10'
                        : 'border-slate-100 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="min-w-[9rem] flex-1">
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-wide">{m.label}</p>
                        {m.hint && <p className="text-[9px] font-bold text-slate-400 leading-snug">{m.hint}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.actions.map(a => chip(m, a))}
                      </div>
                    </div>
                    {pageOff && (
                      <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-rose-500">
                        Page hidden — the whole module is off for this person
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] text-slate-400 leading-snug">
        Actions are enforced on the server as well as here, so a hidden button is not the only thing stopping the
        action. Groups other than <span className="font-bold">Inventory &amp; Billables</span> still use the older
        permission list below.
      </p>
    </div>
  );
};

export default ModulePermissionsEditor;

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import { AUDIENCES, AudienceId, audiencesForRole } from './menus';

interface AudienceSwitcherProps {
  role: string;
  /** Current audience, or 'all' for the merged collapsibles view. */
  value: AudienceId | 'all';
  onChange: (next: AudienceId | 'all') => void;
  /** When the sidebar is collapsed, render the icon-only version. */
  isCollapsed: boolean;
}

const AudienceSwitcher: React.FC<AudienceSwitcherProps> = ({ role, value, onChange, isCollapsed }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Only SUPER_ADMIN gets the switcher today — they're the only role with
  // legitimate access to other audiences. Everyone else is locked to their
  // natural sidebar; render nothing so the layout isn't busy.
  const allowed = audiencesForRole(role);
  if (allowed.length <= 1) return null;

  const options: Array<{ id: AudienceId | 'all'; label: string; hint: string }> = [
    { id: 'all', label: 'All', hint: 'All sections, grouped' },
    ...allowed.map(id => {
      const a = AUDIENCES.find(x => x.id === id)!;
      return { id, label: a.label, hint: a.hint };
    }),
  ];

  const selected = options.find(o => o.id === value) ?? options[0];

  if (isCollapsed) {
    return (
      <div ref={ref} className="relative px-3 py-2 border-b border-seafoam/10 dark:border-zinc-800 shrink-0">
        <button
          onClick={() => setOpen(!open)}
          title={`Audience: ${selected.label}`}
          className="w-full flex items-center justify-center p-2 rounded-lg bg-seafoam/10 dark:bg-zinc-800 text-seafoam dark:text-zinc-300 hover:bg-seafoam/20 transition-colors"
        >
          <Layers size={14} />
        </button>
        {open && (
          <div className="fixed left-20 top-32 z-[200] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl min-w-[200px] overflow-hidden">
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  opt.id === value
                    ? 'bg-seafoam/10 text-seafoam'
                    : 'text-pine dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div>{opt.label}</div>
                <div className="text-[8px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">{opt.hint}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-3 py-3 border-b border-seafoam/10 dark:border-zinc-800 shrink-0">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">View as</p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-seafoam rounded-xl text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 transition-colors"
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-[200]">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 transition-colors ${
                opt.id === value
                  ? 'bg-seafoam/10 text-seafoam'
                  : 'text-pine dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest">{opt.label}</div>
              <div className="text-[8px] font-bold text-slate-400 mt-0.5">{opt.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudienceSwitcher;

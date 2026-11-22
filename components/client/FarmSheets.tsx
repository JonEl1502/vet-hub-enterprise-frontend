import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { X, Settings, type LucideIcon } from 'lucide-react';

/**
 * The farm bottom bar's two sheets (user, 2026-11-22).
 *
 *  - MORE: "can also look like the one in Rekodi SmartLedger" — a solid bottom
 *    sheet with who you are, a grid of app-icon tiles and a close button,
 *    instead of a small floating list.
 *  - RECORD (the centre button): "let it not open like … the zoom camera ring"
 *    — the half-ring dial is gone. The centre button now raises a sheet of big
 *    labelled tiles, one per thing a farmer records, so nothing has to be
 *    guessed from an icon on an arc.
 *
 * Both are bottom sheets that cover the bar (LIM: sheets on phones), close on
 * the backdrop, Escape or ✕, and pad for the iPhone home bar.
 */

export interface SheetTile {
  key: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Tile colours: [background, ink]. */
  tone: [string, string];
  to?: string;
  onSelect?: () => void;
  badge?: number;
}

const Sheet: React.FC<{ onClose: () => void; children: React.ReactNode; label: string }> = ({ onClose, children, label }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="client-portal-sheet md:hidden fixed inset-0 z-[60]" role="dialog" aria-label={label} onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cp-backdrop-in" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t cp-sheet-in overscroll-contain"
        style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-border)', color: 'var(--cp-ink)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))', boxShadow: '0 -12px 40px rgba(20, 45, 22, 0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full" style={{ background: 'var(--cp-border)' }} />
        {children}
        <div className="flex justify-end px-4 -mt-1">
          <button onClick={onClose} aria-label="Close"
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ color: 'var(--cp-accent-dark)' }}>
            <X size={24} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>,
    // Portalled into the portal root so the `--cp-*` tokens still apply.
    document.querySelector('.client-portal') ?? document.body,
  );
};

/** MORE — who you are, then the rest of the app as tiles. */
export const FarmMoreSheet: React.FC<{
  name: string; sub?: string; initial: string; tiles: SheetTile[];
  onClose: () => void; onSettings: () => void;
}> = ({ name, sub, initial, tiles, onClose, onSettings }) => (
  <Sheet onClose={onClose} label="More">
    <div className="flex items-center gap-3 px-5 pt-2 pb-3">
      <span className="cp-avatar shrink-0">{initial}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold truncate leading-tight">{name}</p>
        {sub && <p className="text-[11px] cp-muted truncate">{sub}</p>}
      </div>
      <button onClick={onSettings} aria-label="Settings"
        className="w-9 h-9 rounded-full flex items-center justify-center cp-muted" style={{ background: 'var(--cp-surface-2)' }}>
        <Settings size={17} />
      </button>
    </div>
    <div className="grid grid-cols-4 gap-y-4 gap-x-2 px-4 pb-4">
      {tiles.map((t, i) => (
        <NavLink key={t.key} to={t.to!} onClick={onClose}
          className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform cp-tile-in"
          style={{ animationDelay: `${60 + i * 35}ms` }}>
          {({ isActive }) => (
            <>
              <span className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: t.tone[0], color: t.tone[1], boxShadow: isActive ? '0 0 0 2px var(--cp-surface), 0 0 0 4px var(--cp-accent)' : undefined }}>
                <t.icon size={22} />
                {!!t.badge && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--cp-accent)' }}>{t.badge}</span>
                )}
              </span>
              <span className={`text-[11px] leading-tight text-center ${isActive ? 'font-bold cp-accent-text' : 'font-medium'}`}>{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  </Sheet>
);

/** RECORD — the centre button. Big labelled tiles, two across. */
export const FarmRecordSheet: React.FC<{ tiles: SheetTile[]; onClose: () => void }> = ({ tiles, onClose }) => (
  <Sheet onClose={onClose} label="Record something">
    <div className="px-5 pt-2 pb-3">
      <p className="text-[16px] font-bold">Record something</p>
      <p className="text-[12px] cp-muted">What just happened on the farm?</p>
    </div>
    <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
      {tiles.map((t, i) => (
        <button key={t.key} type="button" onClick={() => { onClose(); t.onSelect?.(); }}
          className={`flex items-center gap-3 p-3 rounded-2xl border text-left active:scale-95 transition-transform cp-tile-in ${i === tiles.length - 1 && tiles.length % 2 ? 'col-span-2' : ''}`}
          style={{ animationDelay: `${50 + i * 40}ms`, borderColor: 'var(--cp-border)', background: 'var(--cp-surface-2)' }}>
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: t.tone[0], color: t.tone[1] }}>
            <t.icon size={21} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight">{t.label}</span>
            {t.hint && <span className="block text-[11px] cp-muted leading-snug mt-0.5">{t.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  </Sheet>
);

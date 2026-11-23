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

/**
 * RECORD — the centre button (user, 2026-11-23: "it should not open a bottom
 * sheet. It should just open icons … in a grid of 2 … its background should be
 * very transparent"). Round icons with their names float in two columns just
 * above the bar, over a barely-there backdrop, so the farm page stays visible.
 */
export const FarmRecordSheet: React.FC<{ tiles: SheetTile[]; onClose: () => void }> = ({ tiles, onClose }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-label="Record something" onClick={onClose}>
      <div className="absolute inset-0 bg-black/10 cp-backdrop-in" />
      <div
        className="absolute inset-x-0 flex justify-center px-6"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      >
        <div className="grid grid-cols-2 gap-x-10 gap-y-4" onClick={(e) => e.stopPropagation()}>
          {tiles.map((t, i) => (
            <button key={t.key} type="button" onClick={() => { onClose(); t.onSelect?.(); }}
              className={`flex flex-col items-center gap-1.5 active:scale-90 transition-transform cp-tile-in ${i === tiles.length - 1 && tiles.length % 2 ? 'col-span-2' : ''}`}
              style={{ animationDelay: `${(tiles.length - 1 - i) * 40}ms` }}>
              <span className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: t.tone[0], color: t.tone[1], boxShadow: '0 8px 20px -8px rgba(0,0,0,0.45)' }}>
                <t.icon size={24} />
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold leading-tight"
                style={{ background: 'color-mix(in srgb, var(--cp-surface) 85%, transparent)', color: 'var(--cp-ink)' }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.querySelector('.client-portal') ?? document.body,
  );
};

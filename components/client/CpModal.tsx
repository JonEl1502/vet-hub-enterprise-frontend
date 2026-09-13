import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Portal-styled modal — a bottom SHEET on mobile, a centred dialog from `sm`.
 *
 * ⚠️ A LONG FORM DOES NOT BELONG HERE. This component briefly grew a `page`
 * flag that dropped `maxWidth` and stood the card up at `100dvh`; on a phone
 * that worked, and on a desktop it covered the top bar and the side rail and
 * ran a six-field form across a 2000px monitor. Use `CpPage`, which renders in
 * the shell instead of over it. Keep this one for two or three fields.
 *
 * ⚠️ Two separate things have to be right for the primary button at the bottom
 * of a sheet to be reachable on a phone, and only one of them was.
 *
 * 1. The BODY scrolls (`flex-1 overflow-y-auto` with a `dvh` cap). That was
 *    already here, and it is why tall sheets scrolled at all.
 *
 * 2. ⚠️ The CONTAINER must be measured in `dvh` too. It was `fixed inset-0`,
 *    and `inset-0` resolves against the LARGE viewport — the one that assumes
 *    the browser toolbar is hidden. On iOS Safari with the toolbar showing, the
 *    container's bottom edge therefore sits BEHIND that toolbar, and because
 *    `items-end` pins the sheet to that edge, the last ~60px of the sheet went
 *    under it. The sheet itself was not overflowing, so there was nothing to
 *    scroll — which is exactly what the user reported: *"hidden below and I
 *    cannot scroll up to see it."*
 *
 * Hence `height: 100dvh` on the container: it tracks the VISUAL viewport, so
 * the sheet's bottom is always the bottom of what the user can actually see.
 * `env(safe-area-inset-bottom)` then clears the home indicator on top of that.
 *
 * ⚠️ Do not "simplify" this back to `inset-0` alone. It looks identical in a
 * desktop browser and in every emulator that hides the toolbar.
 */
const CpModal: React.FC<{
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}> = ({ title, onClose, children, maxWidth = '32rem' }) => {
  // A sheet over a scrollable page: without this the page behind scrolls under
  // the finger as soon as the sheet's own scroll hits its end.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="client-portal fixed inset-x-0 top-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(31,61,57,0.4)', height: '100dvh' }}
      onClick={onClose}
    >
      <div
        className="cp-card w-full overflow-hidden flex flex-col rounded-b-none sm:rounded-3xl"
        style={{ maxWidth, maxHeight: '92dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--cp-border)' }}
        >
          <h3 className="font-black text-lg flex-1 min-w-0 truncate" style={{ color: 'var(--cp-ink)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="cp-muted hover:opacity-70"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div
          className="p-5 flex-1 overflow-y-auto overscroll-contain"
          // The extra bottom inset is what keeps a submit button clear of the
          // home indicator on a notched phone, where the sheet's own rounded
          // edge already eats a few pixels.
          style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default CpModal;

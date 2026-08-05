import React from 'react';

/**
 * The patient header every module record page wears: a coloured banner that is
 * STICKY and CONDENSES once the page scrolls.
 *
 * WHY IT STICKS. Who the patient is must never scroll away on a clinical
 * record — every vital, drug and note below is recorded against that animal,
 * and "which patient am I looking at?" is the one question the page must always
 * be able to answer. Proven first on the inpatient chart (2026-08-04) and
 * rolled out from there at the user's request.
 *
 * WHY IT CONDENSES rather than pinning at full height: the vertical budget is
 * tight. The fixed 4rem navbar, this header, and (on pages that have one) the
 * pinned action bar are all permanently off the content. Full banner at rest,
 * one line once moving — identity survives, the decoration doesn't.
 *
 * ⚠️ `top-16` clears the fixed 4rem navbar (`Navbar.tsx` is `fixed top-0 h-16
 * z-[60]`), and this sits at `z-30` so it passes UNDER the navbar rather than
 * over it. Change either and they collide.
 *
 * ⚠️ Sticky silently stops working if any ancestor becomes a scroll container.
 * `App.tsx` keeps `<main>` on `overflow-x-clip` (NOT `-hidden`) precisely for
 * this — there is a comment there saying so. Don't "tidy" it to hidden.
 *
 * ⚠️ Never sticky when `embedded` (rendered inside the visit wizard): the
 * wizard owns its own chrome and a second pinned header would stack on it.
 */

/**
 * The banner gradient every record page uses.
 *
 * ⚠️ Modules do NOT get their own hue (user decision, 2026-08-05). Two pairs had
 * silently collided — Lab + Vaccination were both emerald→teal, Boarding +
 * Inpatient both pine — so colour identified nothing, and every hue was a
 * hardcoded Tailwind palette entry that ignored the clinic's brand variables.
 * Clinics rebrand; `pine` and `seafoam` are `rgb(var(--secondary-rgb))` /
 * `rgb(var(--primary-rgb))`, so this gradient follows the rebrand and a literal
 * `from-emerald-700` never can. **The module ICON carries identity now.**
 */
export const BRAND_BANNER = 'from-pine to-seafoam';

export interface RecordPageHeaderProps {
  /**
   * Banner gradient. Defaults to {@link BRAND_BANNER} — leave it unset.
   * Pass a literal palette gradient ONLY for something that is deliberately not
   * clinic-branded; a per-module hue is not a reason (see BRAND_BANNER).
   */
  accent?: string;
  icon: React.ElementType;
  /** Small caps line above the name, e.g. "Grooming visit". */
  eyebrow: string;
  /** Usually the patient's name. */
  title: React.ReactNode;
  /** Breed · species · owner. Hidden once condensed. */
  subtitle?: React.ReactNode;
  /**
   * The one identifying detail worth keeping ON the condensed line — cage,
   * accession no, modality. Keep it SHORT; it shares a row with the title.
   */
  condensedMeta?: React.ReactNode;
  /** Status / billing chips, right-aligned. Kept in both states. */
  right?: React.ReactNode;
  /** Inside the visit wizard — disables sticky. */
  embedded?: boolean;
}

/** Condense once the page has moved. 48px, not 0, so trackpad jitter at the
 *  very top doesn't flip it back and forth. */
export const useCondensedOnScroll = (disabled?: boolean) => {
  const [condensed, setCondensed] = React.useState(false);
  React.useEffect(() => {
    if (disabled) return;
    const onScroll = () => setCondensed(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [disabled]);
  return disabled ? false : condensed;
};

/**
 * Classes for a STICKY SIDE RAIL on a two-column record page.
 *
 * ⚠️ Both halves are load-bearing, neither is decoration:
 *  - `lg:self-start` — a grid child stretches to the row height by default, and
 *    a stretched column can never stick. Without this nothing happens at all.
 *  - `lg:max-h` + `lg:overflow-y-auto` — a long rail (treatment plan, a stack of
 *    actions) would otherwise run past the bottom of the viewport with no way
 *    to scroll to it, because the rail no longer moves with the page.
 * `lg:` only: on a single column a sticky rail would sit on top of the content.
 * Requires `items-start` on the grid parent.
 */
export const STICKY_RAIL = 'lg:sticky lg:top-[8.5rem] lg:self-start lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-1';

const RecordPageHeader: React.FC<RecordPageHeaderProps> = ({
  accent = BRAND_BANNER, icon: Icon, eyebrow, title, subtitle, condensedMeta, right, embedded,
}) => {
  const condensed = useCondensedOnScroll(embedded);

  return (
    <div className={embedded ? '' : 'sticky top-16 z-30 -mx-1 px-1 py-1 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur'}>
      <div className={`bg-gradient-to-br ${accent} text-white rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-lg transition-all duration-200 ${condensed ? 'px-3 py-1.5' : 'px-4 py-3 sm:py-4'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`bg-white/15 rounded-2xl shrink-0 transition-all ${condensed ? 'p-1.5' : 'p-2.5'}`}>
            <Icon size={condensed ? 16 : 22} />
          </div>
          <div className="min-w-0">
            {/* Eyebrow and subtitle go first — identity is what has to survive. */}
            {!condensed && <p className="text-white/60 text-[8px] font-black uppercase tracking-widest">{eyebrow}</p>}
            <h1 className={`font-black tracking-tight truncate flex items-center gap-2 transition-all ${condensed ? 'text-sm' : 'text-lg'}`}>
              {title}
              {condensed && condensedMeta && (
                <span className="text-[10px] font-bold text-white/70 truncate">{condensedMeta}</span>
              )}
            </h1>
            {!condensed && subtitle && <p className="text-[11px] text-white/70 truncate">{subtitle}</p>}
          </div>
        </div>
        {right && (
          <div className="flex flex-row flex-wrap items-center sm:justify-end gap-1.5 shrink-0">{right}</div>
        )}
      </div>
    </div>
  );
};

export default RecordPageHeader;

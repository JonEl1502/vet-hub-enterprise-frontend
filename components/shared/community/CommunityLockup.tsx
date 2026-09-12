import React from 'react';

/**
 * The Community wordmark (297).
 *
 *   VetHub
 *      Community
 *
 * "Community" sits below, in amber, tabbed in so it starts on the stem of the
 * H rather than at the left margin.
 *
 * ⚠️ THE INDENT IS A GRID COLUMN, NOT A PADDING VALUE. It has to land on the
 * H, and that position moves with the face, the weight and the user's text-size
 * setting. Splitting the top line as "Vet | Hub" and putting "Community" in the
 * same column as "Hub" makes the alignment structural, so it cannot drift.
 *
 * ⚠️ Amber is TWO values. `#F2A41C` is the brand amber and is right on the dark
 * ground, but against ink on a light one the eye reads it as disabled rather
 * than accented — so light mode uses a deeper `#C57F06`. Both then carry the
 * same weight next to "VetHub".
 *
 * It belongs to Community ONLY. Back in the clinic app the plain mark returns —
 * that absence is what makes this a signal rather than decoration.
 */
const CommunityLockup: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-label="VetHub Community"
    className={`inline-grid font-display leading-[0.98] tracking-[-0.035em] ${className}`}
    style={{ gridTemplateColumns: 'auto auto' }}
  >
    <span className="col-start-1 row-start-1 text-[16px] font-extrabold text-pine dark:text-zinc-100">Vet</span>
    <span className="col-start-2 row-start-1 text-[16px] font-extrabold text-pine dark:text-zinc-100">Hub</span>
    <span className="col-start-2 row-start-2 text-[16px] font-extrabold whitespace-nowrap text-[#C57F06] dark:text-amber">
      Community
    </span>
  </span>
);

export default CommunityLockup;

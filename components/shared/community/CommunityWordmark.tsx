import React from 'react';

/**
 * The VetHubCore Community wordmark (297).
 *
 * One shared "Co": read ACROSS it says VetHubCore, read DOWN it says
 * Community. Four tiny tracks walk inside the C — cow, goat, sheep and a
 * chicken foot — and two paws sit inside the o.
 *
 * ⚠️ INLINED, not an <img> to /public. The wordmark has to take the page's
 * ink colour so one component serves a white rail and a near-black one; an
 * <img> cannot, and would need two files swapped by a media query that the
 * app's class-based dark mode does not drive. The amber stays literal because
 * it is the brand colour in both themes, not a themed value.
 *
 * ⚠️ NO <defs>/<use>. SVG ids are document-global, so a component that may
 * render more than once cannot own them without collisions. The shapes are
 * inlined under their own transforms instead — the file is longer, and it
 * cannot break when someone puts two of these on a page.
 *
 * ⚠️ The four prints sit LEFT of the C's mouth. That bowl opens on the right,
 * and anything near the gap reads as escaping the letter rather than living
 * inside it.
 *
 * Source of truth for the geometry is scripts/gen-community-mark.py, which
 * cuts the four files in public/. Change one, change both.
 */

const AMBER = '#F2A41C';

const CommunityWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 800 232"
    role="img"
    aria-label="VetHubCore Community"
    className={className}
  >
    {/* the two letters */}
    <g transform="translate(242,45.8) scale(1.086)">
      <g fill="none" stroke={AMBER} strokeWidth="17" strokeLinecap="round">
        <path d="M 92 34.8 A 44 44 0 1 0 92 85.2" />
        <circle cx="160" cy="60" r="38" />
      </g>

      <g fill={AMBER}>
        {/* cow — fattest cleaves, barely splayed */}
        <g transform="translate(52,41.5) rotate(-14)">
          <path d="M-1.1 -6.3 C-3.9 -6.3 -5.7 -3.1 -5.7 .6 C-5.7 4.3 -3.9 6.4 -2 6.4 C-.9 6.4 -.7 4.6 -.7 2.2 L-.7 -5.2 C-.7 -6 -.8 -6.3 -1.1 -6.3 Z" />
          <path d="M1.1 -6.3 C3.9 -6.3 5.7 -3.1 5.7 .6 C5.7 4.3 3.9 6.4 2 6.4 C.9 6.4 .7 4.6 .7 2.2 L.7 -5.2 C.7 -6 .8 -6.3 1.1 -6.3 Z" />
        </g>

        {/* goat — longer, splayed at the toe; the splay is the only cue that
            separates it from the sheep once this is reduced */}
        <g transform="translate(37,59) rotate(-62)">
          <path transform="rotate(-9)" d="M-.9 -6.8 C-3.1 -6.2 -4.5 -2.7 -4.3 1.1 C-4.1 4.5 -2.6 6.1 -1.2 5.7 C-.4 5.5 -.5 3.9 -.6 1.8 L-.9 -5.5 C-.95 -6.3 -.75 -6.85 -.9 -6.8 Z" />
          <path transform="rotate(9)" d="M.9 -6.8 C3.1 -6.2 4.5 -2.7 4.3 1.1 C4.1 4.5 2.6 6.1 1.2 5.7 C.4 5.5 .5 3.9 .6 1.8 L.9 -5.5 C.95 -6.3 .75 -6.85 .9 -6.8 Z" />
        </g>

        {/* sheep — shortest and bluntest, cleaves held tight */}
        <g transform="translate(51,77) rotate(12)">
          <path d="M-.85 -5 C-3.3 -5 -4.9 -2.4 -4.9 .8 C-4.9 3.9 -3.3 5.4 -1.7 5.4 C-.8 5.4 -.6 3.9 -.6 1.9 L-.6 -4.1 C-.6 -4.8 -.7 -5 -.85 -5 Z" />
          <path d="M.85 -5 C3.3 -5 4.9 -2.4 4.9 .8 C4.9 3.9 3.3 5.4 1.7 5.4 C.8 5.4 .6 3.9 .6 1.9 L.6 -4.1 C.6 -4.8 .7 -5 .85 -5 Z" />
        </g>

        {/* chicken — three toes forward, one back. STROKED: a bird track is a
            line drawing and fills to a blob at this size */}
        <g transform="translate(67,60) rotate(24)" fill="none" stroke={AMBER} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 1.7 L0 -6.9" />
          <path d="M0 1.7 L-5.3 -4.3" />
          <path d="M0 1.7 L5.3 -4.3" />
          <path d="M0 1.7 L0 6.7" />
        </g>

        {/* two paws in the o */}
        <g transform="translate(153,52) rotate(-16) scale(.95)">
          <ellipse cx="-3.6" cy="-4.2" rx="1.9" ry="2.4" />
          <ellipse cx=".9" cy="-5.6" rx="1.9" ry="2.5" />
          <ellipse cx="5" cy="-3.6" rx="1.8" ry="2.3" transform="rotate(16 5 -3.6)" />
          <ellipse cx="-7" cy="-.2" rx="1.7" ry="2.1" transform="rotate(-24 -7 -.2)" />
          <path d="M-.8 -1.4 C3 -1.4 5.9 1.2 5.9 4.1 C5.9 7.1 3 8.4 -.8 8.4 C-4.6 8.4 -7.5 7.1 -7.5 4.1 C-7.5 1.2 -4.6 -1.4 -.8 -1.4 Z" />
        </g>
        <g transform="translate(168,69) rotate(18) scale(.85)">
          <ellipse cx="-3.6" cy="-4.2" rx="1.9" ry="2.4" />
          <ellipse cx=".9" cy="-5.6" rx="1.9" ry="2.5" />
          <ellipse cx="5" cy="-3.6" rx="1.8" ry="2.3" transform="rotate(16 5 -3.6)" />
          <ellipse cx="-7" cy="-.2" rx="1.7" ry="2.1" transform="rotate(-24 -7 -.2)" />
          <path d="M-.8 -1.4 C3 -1.4 5.9 1.2 5.9 4.1 C5.9 7.1 3 8.4 -.8 8.4 C-4.6 8.4 -7.5 7.1 -7.5 4.1 C-7.5 1.2 -4.6 -1.4 -.8 -1.4 Z" />
        </g>
      </g>
    </g>

    {/* ⚠️ currentColor, so the caller's text class themes the wordmark. */}
    <g
      fontFamily="'Hanken Grotesk','Inter',Helvetica,Arial,sans-serif"
      fontWeight="800"
      fontSize="64"
      letterSpacing="-1"
      fill="currentColor"
    >
      <text x="239" y="92" textAnchor="end">VetHub</text>
      <text x="473" y="92" textAnchor="start">re</text>
      <text x="473" y="176" textAnchor="start">mmunity</text>
    </g>
  </svg>
);

export default CommunityWordmark;

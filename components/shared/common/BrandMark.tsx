import React from 'react';

interface BrandMarkProps {
  /** Tailwind sizing classes for the square mark (default fills its parent). */
  className?: string;
  /** Stroke + fill colour of the "C" and the paws. */
  color?: string;
  /** Animate as a loading indicator (arc draws + paws pulse). */
  animate?: boolean;
  /** Accessible label. */
  title?: string;
}

// Four toe pads + the main pad — shared by both paws.
const Paw = (
  <>
    <ellipse cx="43.5" cy="40" rx="5.2" ry="6" />
    <ellipse cx="56.5" cy="40" rx="5.2" ry="6" />
    <ellipse cx="33" cy="48.5" rx="4.8" ry="5.6" transform="rotate(-18 33 48.5)" />
    <ellipse cx="67" cy="48.5" rx="4.8" ry="5.6" transform="rotate(18 67 48.5)" />
    <path d="M50 50 C 60 50 68 57 68 64 C 68 72 60 74 50 74 C 40 74 32 72 32 64 C 32 57 40 50 50 50 Z" />
  </>
);

/**
 * VetHub Core brand mark — the "C" arc wrapped around two paw prints.
 * Inline SVG (not an <img>) so the loading animation can drive the arc and
 * paws directly. Drop it anywhere; pass `animate` to turn it into a spinner.
 */
const BrandMark: React.FC<BrandMarkProps> = ({
  className = 'w-full h-full',
  color = '#FFFFFF',
  animate = false,
  title = 'VetHub Core',
}) => {
  return (
    <svg
      viewBox="-6 -6 112 112"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {animate && (
        <style>{`
          @keyframes bm-draw {
            0%   { stroke-dashoffset: 220; }
            55%  { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -220; }
          }
          @keyframes bm-paw {
            0%, 100% { opacity: .45; transform: scale(.88); }
            50%      { opacity: 1;   transform: scale(1); }
          }
          .bm-arc  { stroke-dasharray: 220; animation: bm-draw 1.8s ease-in-out infinite; }
          .bm-paw1 { transform-box: fill-box; transform-origin: center;
                     animation: bm-paw 1.8s ease-in-out infinite; }
          .bm-paw2 { transform-box: fill-box; transform-origin: center;
                     animation: bm-paw 1.8s ease-in-out .35s infinite; }
          @media (prefers-reduced-motion: reduce) {
            .bm-arc, .bm-paw1, .bm-paw2 { animation: none; }
          }
        `}</style>
      )}
      <path
        d="M 81.1 28.2 A 38 38 0 1 0 81.1 71.8"
        fill="none"
        stroke={color}
        strokeWidth="13"
        strokeLinecap="round"
        className={animate ? 'bm-arc' : undefined}
      />
      <g fill={color}>
        <g className={animate ? 'bm-paw1' : undefined}>
          <g transform="translate(43,42) rotate(-14) scale(0.46) translate(-50,-57)">{Paw}</g>
        </g>
        <g className={animate ? 'bm-paw2' : undefined}>
          <g transform="translate(60,60) rotate(-14) scale(0.34) translate(-50,-57)">{Paw}</g>
        </g>
      </g>
    </svg>
  );
};

export default BrandMark;

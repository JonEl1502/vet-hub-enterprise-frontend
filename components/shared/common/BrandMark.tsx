import React from 'react';

// ── v2 (Oct 2026): the C holding a paw print and a cloven-hoof print — pets AND
// livestock. Geometry is the designer's own file, exported from
// NEWLOGOS/VetHubCore/svg/vethub-mark-tile.svg in a 120-unit box (arc stroke 13.5).
// Opt-in via `variant="v2"` so the rest of the app keeps the classic mark until
// the user says to switch it everywhere.
const V2_ARC = 'M88.755 30.219 C72.443 14.467 46.493 14.769 30.552 30.897 C14.611 47.025 14.611 72.975 30.552 89.103 C46.493 105.231 72.443 105.533 88.755 89.781';
const V2_PAW = 'M53.44 37.222 C54.953 37.276 56.119 39.019 56.043 41.114 C55.968 43.21 54.68 44.865 53.167 44.81 C51.653 44.756 50.488 43.013 50.563 40.917 C50.638 38.822 51.926 37.167 53.44 37.222 Z M46.23 38.099 C47.686 37.683 49.334 38.981 49.91 40.997 C50.485 43.013 49.772 44.985 48.316 45.401 C46.859 45.817 45.212 44.519 44.636 42.503 C44.06 40.487 44.774 38.515 46.23 38.099 Z M56.305 44.921 C57.053 43.164 58.754 42.205 60.105 42.78 C61.455 43.355 61.944 45.246 61.195 47.003 C60.447 48.761 58.746 49.72 57.395 49.145 C57.354 49.128 57.313 49.109 57.273 49.089 C57.687 49.633 57.955 50.257 58.038 50.936 C58.073 51.224 58.073 51.51 58.041 51.792 C58.731 52.265 59.274 53.008 59.517 53.919 C60.022 55.81 59.044 57.713 57.333 58.169 C56.604 58.364 55.86 58.265 55.207 57.941 C54.742 59.024 53.763 59.829 52.551 59.976 C51.34 60.124 50.196 59.577 49.484 58.637 C48.928 59.108 48.23 59.383 47.476 59.369 C45.706 59.337 44.3 57.724 44.336 55.767 C44.353 54.824 44.703 53.973 45.258 53.348 C45.16 53.082 45.091 52.804 45.056 52.517 C44.974 51.837 45.084 51.167 45.355 50.54 C45.322 50.569 45.287 50.597 45.251 50.624 C44.078 51.506 42.196 50.983 41.048 49.456 C39.899 47.929 39.92 45.976 41.093 45.094 C42.266 44.212 44.148 44.735 45.296 46.262 C46.055 47.27 46.303 48.465 46.046 49.414 C47.094 48.128 48.867 47.166 50.961 46.911 C53.055 46.656 55.007 47.165 56.333 48.162 C55.856 47.303 55.81 46.083 56.305 44.921 Z';
const V2_HOOF = 'M73.002 62.175 C76.558 62.326 80.87 65.832 82.128 71.767 C83.146 76.513 81.094 80.148 77.9 80.562 C76.299 80.769 75.381 79.952 75.121 77.954 C74.606 73.957 73.765 67.767 73.002 62.175 Z M74.056 64.54 C74.674 69.069 75.357 74.083 75.773 77.322 C75.981 78.939 76.726 79.598 78.022 79.431 C80.611 79.099 82.272 76.15 81.448 72.307 C80.431 67.5 76.937 64.659 74.056 64.54 Z M74.781 66.172 C77.197 66.274 80.132 68.658 80.984 72.693 C81.678 75.92 80.283 78.394 78.108 78.677 C77.021 78.815 76.397 78.26 76.224 76.904 C75.869 74.183 75.301 69.975 74.781 66.172 Z M63.248 72.545 C64.012 66.527 68.02 62.679 71.552 62.234 C71.252 67.87 70.925 74.109 70.74 78.134 C70.645 80.147 69.798 81.037 68.186 80.963 C64.968 80.813 62.623 77.36 63.248 72.545 Z M70.697 64.678 C67.835 65.034 64.587 68.153 63.969 73.028 C63.465 76.926 65.363 79.728 67.97 79.846 C69.276 79.905 69.964 79.187 70.038 77.558 C70.186 74.296 70.454 69.243 70.697 64.678 Z M64.464 73.375 C64.981 69.283 67.709 66.665 70.109 66.364 C69.904 70.197 69.684 74.438 69.555 77.179 C69.494 78.545 68.918 79.149 67.823 79.102 C65.632 78.999 64.038 76.648 64.464 73.375 Z';

interface BrandMarkProps {
  /** 'classic' = the C with two paws (default). 'v2' = the C with a paw and a hoof. */
  variant?: 'classic' | 'v2';
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
  variant = 'classic',
  className = 'w-full h-full',
  color = '#FFFFFF',
  animate = false,
  title = 'VetHubCore',
}) => {
  if (variant === 'v2') {
    return (
      <svg viewBox="2 2 116 116" className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
        {animate && (
          <style>{`
            @keyframes bm-draw { 0% { stroke-dashoffset: 235; } 55% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -235; } }
            @keyframes bm-paw  { 0%, 100% { opacity: .45; transform: scale(.88); } 50% { opacity: 1; transform: scale(1); } }
            .bm-arc  { stroke-dasharray: 235; animation: bm-draw 1.8s ease-in-out infinite; }
            .bm-paw1 { transform-box: fill-box; transform-origin: center; animation: bm-paw 1.8s ease-in-out infinite; }
            .bm-paw2 { transform-box: fill-box; transform-origin: center; animation: bm-paw 1.8s ease-in-out .35s infinite; }
            @media (prefers-reduced-motion: reduce) { .bm-arc, .bm-paw1, .bm-paw2 { animation: none; } }
          `}</style>
        )}
        <path d={V2_ARC} fill="none" stroke={color} strokeWidth="13.5" strokeLinecap="round" className={animate ? 'bm-arc' : undefined} />
        <path d={V2_PAW} fill={color} className={animate ? 'bm-paw1' : undefined} />
        <path d={V2_HOOF} fill={color} className={animate ? 'bm-paw2' : undefined} />
      </svg>
    );
  }

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

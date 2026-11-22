import React, { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * The top of every portal screen: a field-green band with the page's name
 * (user, 2026-11-22: "look like a farm product … very beautiful", then "go
 * further" into the inner screens). It wears the same crop-row hero as the
 * farm home, so moving between screens feels like one product instead of a
 * plain title over plain cards.
 *
 * `.cp-band` styles a `.cp-btn` inside it harvest gold, so a screen's main
 * action can sit in the band without a green button on a green ground.
 */
const CpBand: React.FC<{
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small gold line above the title — the section or a greeting. */
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
}> = ({ title, subtitle, eyebrow, icon: Icon, actions }) => (
  <div className="cp-hero cp-band relative overflow-hidden text-white px-4 py-4 sm:px-6 sm:py-5 flex items-center gap-3 sm:gap-4 flex-wrap">
    {Icon && <span className="cp-band-badge"><Icon className="w-5 h-5" /></span>}
    <div className="min-w-0 flex-1">
      {eyebrow && <p className="text-[11px] font-semibold text-[#f2d58a] truncate">{eyebrow}</p>}
      <h1 className="text-xl sm:text-2xl font-black text-white leading-tight truncate">{title}</h1>
      {subtitle && <div className="mt-0.5 text-xs sm:text-sm text-white/75">{subtitle}</div>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export default CpBand;

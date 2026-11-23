import React, { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * The top of a portal screen.
 *
 * 2026-11-23 (user): the page's NAME now lives in the top bar as a breadcrumb
 * under the brand ("My Farm › Store"), so the green title card that sat above
 * every screen is gone. What is left is the one thing the card still carried:
 * a line of context and the screen's main action, as a slim row. `title` and
 * `icon` are kept on the props so call sites don't change; the title is only
 * read by screen readers.
 */
const CpBand: React.FC<{
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
}> = ({ title, subtitle, eyebrow, actions }) => {
  if (!subtitle && !eyebrow && !actions) return <h1 className="sr-only">{title}</h1>;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h1 className="sr-only">{title}</h1>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-[11px] font-semibold cp-accent-text truncate">{eyebrow}</p>}
        {subtitle && <div className="text-xs cp-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

export default CpBand;

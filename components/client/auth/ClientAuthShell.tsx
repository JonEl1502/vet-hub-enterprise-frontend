import React, { ReactNode } from 'react';
import { PawPrint, Building2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ClientAuthBackdrop from './ClientAuthBackdrop';

/**
 * 298 — THE SCAN HAS TO SURVIVE THE CLICK.
 *
 * The QR landing (`/c/:slug`) carries `?clinic=&clinicName=` through to both
 * auth screens, but they rendered a bare "Welcome back" — so someone who had
 * just scanned Riverside's poster and tapped "I already have an account" lost
 * every sign they were in the right place (user, 2026-09-11). A context strip
 * is the difference between "this is the clinic's page" and "this is some app
 * that wants my password".
 *
 * Absent params render nothing at all, so the ordinary /client/login is
 * unchanged.
 */
const ScannedClinicStrip: React.FC = () => {
  const [params] = useSearchParams();
  const name = params.get('clinicName');
  if (!name) return null;
  return (
    <div className="relative z-10 w-full max-w-md mb-4">
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border"
           style={{ borderColor: 'var(--cp-accent)', background: 'var(--cp-accent-soft)' }}>
        <span className="w-8 h-8 rounded-xl grid place-items-center shrink-0 bg-white/70">
          <Building2 className="w-4 h-4 cp-accent-text" />
        </span>
        <span className="min-w-0">
          <span className="block text-[9px] font-black uppercase tracking-widest cp-accent-text">Continuing with</span>
          <span className="block text-sm font-black truncate" style={{ color: 'var(--cp-ink)' }}>{name}</span>
        </span>
      </div>
    </div>
  );
};

// Warm, friendly auth shell for the pet-owner portal. Centered card on the
// sand canvas — deliberately softer and rounder than the staff AuthShell.
const ClientAuthShell: React.FC<{ title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }> = ({
  title, subtitle, children, footer,
}) => (
  <div
    className="client-portal min-h-screen flex flex-col items-center justify-center px-4 py-10"
    /**
     * 🔴 300 — `background: transparent` IS LOAD-BEARING, AND INLINE ON PURPOSE.
     *
     * `.client-portal` sets `background: var(--cp-bg)` — an OPAQUE sand fill.
     * The backdrop is a child of this element, so at `-z-10` it painted behind
     * that fill and was invisible no matter what: the carousel loaded, decoded
     * and crossfaded against a wall. Lightening the scrim (300) changed
     * nothing, because the scrim was never what was covering it.
     *
     * Inline rather than a `bg-transparent` class because both selectors have
     * the same specificity (0,1,0) and which one wins would come down to
     * stylesheet order — a coin-flip that breaks on any Tailwind reshuffle.
     * Inline always wins.
     *
     * The backdrop is `fixed inset-0` and fills the viewport itself, so nothing
     * shows through where the sand used to be.
     */
    style={{ background: 'transparent' }}
  >
    {/* 298 — crossfading cats/dogs/livestock behind a warm wash. */}
    <ClientAuthBackdrop />
    <ScannedClinicStrip />
    {/* 300 — `relative z-10` puts the card above the z-0 backdrop. Without a
        position the z-index would be inert and the photo would paint over the
        form. */}
    <div className="relative z-10 w-full max-w-md">
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
             style={{ background: 'var(--cp-accent)' }}>
          <PawPrint className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--cp-ink)' }}>{title}</h1>
        {subtitle && <p className="text-sm cp-muted mt-1 text-center">{subtitle}</p>}
      </div>
      <div className="cp-card p-6">{children}</div>
      {footer && <div className="text-center mt-5 text-sm cp-muted">{footer}</div>}
    </div>
  </div>
);

export default ClientAuthShell;

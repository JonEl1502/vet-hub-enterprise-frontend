import React from 'react';
import BrandMark from './BrandMark';

/**
 * THE FRAME every client-facing money document wears: invoice, receipt and
 * group invoice. Clinic logo top-left, clinic contact block top-right, a bar in
 * the clinic's own colour carrying the document's name, and a footer with a
 * sign-up QR (bottom-left) and "Powered by VetHubCore" (bottom-right)
 * (user, 2026-10-19: *"invoices in vhc to come out like so with qrcode to vhc
 * acc for client signup … clinic logo to left and vhc bottom right"*).
 *
 * ⚠️ PAPER, NOT SCREEN. Nothing in here uses a `dark:` variant and nothing uses
 * a responsive (`sm:` / `md:`) one. These pages are rasterised into a PDF from
 * an off-screen clone fixed at A4 width (documentShare.renderElementToPdfBlob):
 * a `dark:` class would be stripped for the capture, so the screen and the file
 * would disagree, and a viewport breakpoint would be evaluated against the
 * PHONE's width rather than the clone's — a clinic exporting from a phone would
 * get a PDF with columns missing.
 *
 * ⚠️ The QR target is `/c/<clinic subdomain>`, the public landing every clinic
 * already has. Signing up from it attaches the new client to THIS clinic with
 * no directory search (ClientSignup, `?clinic=`) — which is the point of putting
 * the code on a bill the client is holding. It is deliberately not the clinic's
 * invoice: there is no public invoice page, and a code that opens a login wall
 * is worse than no code.
 */

/** What a document needs to know about the org that issued it. */
export interface DocClinic {
  name: string;
  /** Emoji or image URL — the same column holds both. */
  logo?: string | null;
  slogan?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  /** Public slug — what `/c/<slug>` resolves. */
  subdomain?: string | null;
  /** Clinic theme colour, `#rrggbb`. */
  color?: string | null;
}

const FALLBACK_COLOR = '#1C7A5B';

/** Narrow a `Clinic` (context or `types.ts` — both shapes exist) to a DocClinic. */
export const toDocClinic = (c: any): DocClinic => ({
  name: c?.name ?? '',
  logo: c?.logo ?? null,
  slogan: c?.slogan ?? null,
  address: c?.address ?? null,
  phone: c?.phone ?? null,
  email: c?.email ?? null,
  website: c?.website ?? c?.websiteUrl ?? null,
  subdomain: c?.subdomain ?? null,
  color: c?.colors?.primary ?? c?.primaryColor ?? null,
});

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A usable `#rrggbb`, or the VHC green when the clinic has none / a broken one. */
export const docColor = (c?: string | null): string => {
  const v = (c || '').trim();
  if (!HEX.test(v)) return FALLBACK_COLOR;
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
};

/**
 * White or near-black text for a bar of this colour. A clinic can pick a pale
 * theme; white-on-yellow would make the document's own title unreadable.
 */
export const readableOn = (bg: string): string => {
  const h = docColor(bg).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.5 ? '#0f172a' : '#ffffff';
};

/**
 * The clinic colour as TEXT on white. A bar can be any colour because its label
 * flips to dark or white (`readableOn`); text set in the raw colour cannot — a
 * pale yellow theme made every category heading on the invoice vanish. Light
 * colours are darkened until they read; dark ones pass through untouched.
 */
export const docInk = (c?: string | null): string => {
  const base = docColor(c);
  if (readableOn(base) === '#ffffff') return base;
  const h = base.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.5));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const isImage = (v?: string | null): boolean =>
  !!v && (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:') || v.startsWith('/'));

/** Where the QR points. */
export const signupUrl = (subdomain?: string | null): string => {
  if (typeof window === 'undefined') return '';
  return subdomain
    ? `${window.location.origin}/c/${encodeURIComponent(subdomain)}`
    : `${window.location.origin}/client/signup`;
};

/**
 * The QR as a data URI. Client-side and lazy: `qrcode` is only needed once a
 * document is on screen, and a data URI survives the PDF clone (an <img> with a
 * blob URL can be revoked under html2canvas).
 */
export const useQrDataUrl = (text: string): string | null => {
  const [data, setData] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!text) { setData(null); return; }
    let alive = true;
    import('qrcode')
      .then((m) => (m.default ?? (m as any)).toDataURL(text, { errorCorrectionLevel: 'M', width: 320, margin: 1 }))
      .then((d: string) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [text]);
  return data;
};

/** Clinic logo on the left, clinic contact block right-aligned on the right. */
export const DocLetterhead: React.FC<{ clinic: DocClinic }> = ({ clinic }) => {
  const [broken, setBroken] = React.useState(false);
  const showImage = isImage(clinic.logo) && !broken;
  const contact = [
    clinic.address,
    clinic.phone ? `Tel: ${clinic.phone}` : null,
    clinic.email ? `Email: ${clinic.email}` : null,
    clinic.website ? `Web: ${String(clinic.website).replace(/^https?:\/\//, '')}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="shrink-0 flex items-center">
        {showImage ? (
          <img
            src={clinic.logo!}
            alt=""
            className="object-contain"
            style={{ maxHeight: 64, maxWidth: 150 }}
            onError={() => setBroken(true)}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-xl text-3xl font-black border border-slate-200 bg-slate-50 text-slate-700"
            style={{ width: 56, height: 56 }}
          >
            {(!isImage(clinic.logo) && clinic.logo) || (clinic.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 text-right">
        <p className="text-sm font-black uppercase tracking-tight leading-tight text-slate-900">{clinic.name}</p>
        {clinic.slogan && <p className="text-[10px] font-bold leading-snug text-slate-500">{clinic.slogan}</p>}
        {contact.map((l, i) => (
          <p key={i} className="text-[10px] leading-snug text-slate-500">{l}</p>
        ))}
      </div>
    </div>
  );
};

/**
 * The full-width bar naming the document. Bleeds to the paper's edges by
 * cancelling the page padding (`-mx-6`), so the page that hosts it must use `p-6`.
 */
export const DocTitleBar: React.FC<{ title: string; color?: string | null; right?: React.ReactNode }> = ({ title, color, right }) => {
  const bg = docColor(color);
  return (
    <div
      className="-mx-6 px-6 py-2 flex items-center justify-between gap-3"
      style={{ backgroundColor: bg, color: readableOn(bg) }}
    >
      <p className="text-base font-black uppercase tracking-[0.2em]">{title}</p>
      {right}
    </div>
  );
};

/** A coloured bar inside the page body (e.g. PAYMENT RECEIPTS), same bleed rule. */
export const DocSectionBar: React.FC<{ color?: string | null; className?: string; children: React.ReactNode }> = ({ color, className = '', children }) => {
  const bg = docColor(color);
  return (
    <div
      className={`-mx-6 px-6 py-1.5 ${className}`}
      style={{ backgroundColor: bg, color: readableOn(bg) }}
    >
      {children}
    </div>
  );
};

/** Sign-up QR bottom-left, VetHubCore bottom-right. */
export const DocFooter: React.FC<{ clinic: DocClinic }> = ({ clinic }) => {
  const url = signupUrl(clinic.subdomain);
  const qr = useQrDataUrl(url);
  return (
    <div className="mt-6 pt-4 border-t border-slate-200 flex items-end justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {qr ? (
          <img src={qr} alt="Scan to sign up" style={{ width: 88, height: 88 }} className="shrink-0" />
        ) : (
          <div className="shrink-0 rounded bg-slate-100" style={{ width: 88, height: 88 }} />
        )}
        <div className="min-w-0" style={{ maxWidth: 220 }}>
          <p className="text-[10px] font-black uppercase tracking-wide leading-tight text-slate-800">
            Scan to join {clinic.name || 'your clinic'} on VetHubCore
          </p>
          <p className="text-[9px] leading-snug text-slate-500 mt-0.5">
            See your pets, bills and receipts, and book visits, from your phone.
          </p>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <div className="text-right">
          <p className="text-[8px] uppercase tracking-widest text-slate-400">Powered by</p>
          <p className="text-[13px] font-black leading-none text-slate-800">VetHubCore</p>
        </div>
        <div className="rounded-lg flex items-center justify-center" style={{ width: 34, height: 34, backgroundColor: FALLBACK_COLOR, padding: 2 }}>
          <BrandMark variant="v2" color="#FFFFFF" className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

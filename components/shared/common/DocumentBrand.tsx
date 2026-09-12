import React from 'react';

/**
 * THE LOGO BLOCK every money document wears.
 *
 * Receipts, bills and invoices are the pages that leave the building — the
 * client keeps them, a supplier files them, an auditor reads them a year later
 * — and ours went out with the org's NAME in text and nothing else. The POS
 * receipt went out with neither: a PDF that says "SALE COMPLETE · KES 2,260"
 * and never names who was paid (user, 2026-09-12: *"can the receipts bills
 * invoices all contain clinic logos … n supplier or any other"*).
 *
 * ⚠️ ORG-AGNOSTIC ON PURPOSE. A clinic, a supplier, a farm and a counter shop
 * all issue these, so this takes a name and a logo rather than a `Clinic`. The
 * callers already hold the right object; none of them should be teaching a
 * shared document what a clinic is.
 *
 * The logo is an emoji OR a URL — the same column holds both across clinics
 * and suppliers — so it renders like `ClinicLogo` does, and falls back to the
 * org's initial rather than to a broken image. A document that cannot show a
 * mark still has to name the business.
 */

interface Props {
  name: string;
  /** Emoji or image URL. Both live in the same column. */
  logo?: string | null;
  slogan?: string | null;
  /** Address / phone / email — whatever the org has; blanks are dropped. */
  contact?: (string | null | undefined)[];
  /** `light` for a coloured header band, `dark` for a white document body. */
  tone?: 'light' | 'dark';
  /** Right-aligned when the document's title sits on the left. */
  align?: 'left' | 'right';
  className?: string;
}

const isImage = (v?: string | null): boolean =>
  !!v && (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:') || v.startsWith('/'));

const DocumentBrand: React.FC<Props> = ({
  name, logo, slogan, contact = [], tone = 'dark', align = 'left', className = '',
}) => {
  const [broken, setBroken] = React.useState(false);
  const lines = contact.filter(Boolean) as string[];
  const showImage = isImage(logo) && !broken;

  // Spelled out rather than interpolated — Tailwind cannot see built class names.
  const nameCls = tone === 'light'
    ? 'text-white'
    : 'text-pine dark:text-zinc-100';
  const subCls = tone === 'light'
    ? 'text-white/60'
    : 'text-slate-400 dark:text-zinc-500';
  const markCls = tone === 'light'
    ? 'bg-white/20 border-white/20 text-white'
    : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-100';

  return (
    <div className={`flex items-center gap-2.5 ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${className}`}>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 overflow-hidden ${markCls}`}>
        {showImage
          ? <img src={logo!} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
          : <span>{(!isImage(logo) && logo) || name.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-black uppercase tracking-tight leading-tight truncate ${nameCls}`}>{name}</p>
        {slogan && <p className={`text-[9px] font-bold leading-tight truncate ${subCls}`}>{slogan}</p>}
        {lines.map((l, i) => (
          <p key={i} className={`text-[9px] leading-tight truncate ${subCls}`}>{l}</p>
        ))}
      </div>
    </div>
  );
};

export default DocumentBrand;

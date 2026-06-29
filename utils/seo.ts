// Lightweight per-route head manager for the pre-auth (public) screens.
// The app is a SPA, so without this every URL would serve the identical
// <title>/<meta description> baked into index.html, and Google would treat
// them as one page. This sets unique, indexable metadata per public view.

const SITE = 'https://app.vethubcore.com';

type Seo = {
  title: string;
  description: string;
  /** Canonical path. Pre-auth screens that share '/' keep the root canonical. */
  path: string;
  /** Keep thin auth pages out of the index. */
  noindex?: boolean;
};

const DEFAULT_DESCRIPTION =
  'VetHub Core is the operating system for veterinary clinics. Appointments, ' +
  'patient & medical records, inventory, invoicing, M-Pesa & card payments, ' +
  'plus a pet-owner portal for booking and paying online.';

export const SEO_BY_VIEW: Record<string, Seo> = {
  landing: {
    title: 'VetHub Core — Veterinary Practice Management Software & Pet-Owner Portal',
    description: DEFAULT_DESCRIPTION,
    path: '/',
  },
  pricing: {
    title: 'Pricing — VetHub Core Veterinary Practice Management Software',
    description:
      'Simple, transparent pricing for VetHub Core. Run your whole veterinary ' +
      'practice — appointments, records, inventory, invoicing and payments — on one plan.',
    path: '/',
  },
  signup: {
    title: 'Create your clinic account — VetHub Core veterinary software',
    description:
      'Start running your veterinary clinic on VetHub Core: appointments, patient ' +
      'records, inventory, invoicing and M-Pesa & card payments. Free trial.',
    path: '/signup',
  },
  'supplier-signup': {
    title: 'List your veterinary supply business — VetHub Core',
    description:
      'Join VetHub Core as a veterinary supplier and reach clinics ordering ' +
      'medicines, consumables and equipment online.',
    path: '/supplier-signup',
  },
  login: {
    title: 'Log in — VetHub Core',
    description: DEFAULT_DESCRIPTION,
    path: '/login',
    noindex: true,
  },
  'forgot-password': {
    title: 'Reset your password — VetHub Core',
    description: DEFAULT_DESCRIPTION,
    path: '/forgot-password',
    noindex: true,
  },
  'reset-password': {
    title: 'Reset your password — VetHub Core',
    description: DEFAULT_DESCRIPTION,
    path: '/reset-password',
    noindex: true,
  },
};

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Apply SEO metadata for a public view. No-op for unknown views. */
export function applySeo(view: string) {
  const seo = SEO_BY_VIEW[view];
  if (!seo || typeof document === 'undefined') return;

  const url = SITE + seo.path;
  document.title = seo.title;
  upsertMeta('meta[name="description"]', 'name', 'description', seo.description);
  upsertMeta('meta[name="robots"]', 'name', 'robots',
    seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
  upsertLink('canonical', url);

  // Keep social cards in sync with the active view.
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);
}

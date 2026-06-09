/**
 * Google Analytics 4 (gtag.js) integration for the SPA.
 *
 * The default GA snippet fires a single `page_view` on initial load, which is
 * wrong for a single-page app: client-side route changes never reload the page,
 * so without this module GA would only ever record the first URL.
 *
 * Strategy:
 *  - Load gtag.js once, with `send_page_view: false` so GA does NOT auto-fire.
 *  - Fire one `page_view` manually for every route (including the first) via
 *    `trackPageView`, called from the <AnalyticsTracker /> in Router.tsx.
 *
 * Disabled in dev so local traffic never pollutes the GA property.
 */

const MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || 'G-MV44S040RN';

const isEnabled = Boolean(MEASUREMENT_ID) && import.meta.env.PROD;

let initialized = false;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Inject gtag.js and configure GA4. Safe to call multiple times. */
export function initAnalytics(): void {
  if (!isEnabled || initialized || typeof document === 'undefined') return;
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  // send_page_view:false — we fire page_view manually per route below.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

/** Record a page view for the current SPA route. */
export function trackPageView(path: string, title?: string): void {
  if (!isEnabled || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: title ?? document.title,
  });
}

/** Record a custom event (e.g. sign-up, booking). Optional helper for later. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!isEnabled || !window.gtag) return;
  window.gtag('event', name, params ?? {});
}

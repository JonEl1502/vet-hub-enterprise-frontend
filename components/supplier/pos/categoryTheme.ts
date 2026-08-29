/**
 * A colour and a glyph for every category on the shelf.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * A POS grid of 20–200 identical white rectangles is read WORD BY WORD, and a
 * cashier under a queue does not read — they recognise. Square and Loyverse
 * solve this with product photography; an agrovet has none, and will not stop
 * to shoot 200 bags of feed. Colour by category is the same affordance for
 * free: the feed aisle is amber, the drugs are blue, and the hand goes to the
 * right quarter of the screen before the eye has finished the name.
 *
 * ⚠️ Colour is NEVER the only signal. Sold-out and low stock are stated in
 * words on every tile, because roughly 1 in 12 men has some colour blindness
 * and a till is not a place to guess.
 */

export interface CategoryTheme {
  /** Swatch background. */
  bg: string;
  /** Glyph/initial colour on that swatch. */
  fg: string;
  glyph: string;
}

/**
 * The categories a Kenyan agrovet actually stocks. Matched loosely — a shop
 * that types "Animal Feeds" or "Vet Drugs" should still land on the right one,
 * because these are free-text on `SupplierProduct.category`.
 */
const KNOWN: { test: RegExp; theme: CategoryTheme }[] = [
  { test: /feed|mash|meal|pellet/i,             theme: { bg: '#FDF0D5', fg: '#8A5A0B', glyph: '🌾' } },
  { test: /vet|drug|medicine|pharma|vaccine/i,  theme: { bg: '#E3EEFB', fg: '#1B4E86', glyph: '💉' } },
  { test: /agro-?chem|pesticid|herbicid|spray/i,theme: { bg: '#EDE7FA', fg: '#553C9A', glyph: '🧪' } },
  { test: /fertilis|fertiliz|manure/i,          theme: { bg: '#D9F0EA', fg: '#0F6B55', glyph: '🧺' } },
  { test: /seed|plant/i,                        theme: { bg: '#E4F3DA', fg: '#3F6B1E', glyph: '🌱' } },
  { test: /equip|tool|sprayer|hardware/i,       theme: { bg: '#E7EAEF', fg: '#3D4655', glyph: '🔧' } },
  { test: /poultry|chick|bird/i,                theme: { bg: '#FCEBE0', fg: '#93441A', glyph: '🐓' } },
  { test: /dairy|cattle|cow/i,                  theme: { bg: '#F0EDE6', fg: '#6B5A2E', glyph: '🐄' } },
];

/** Stable fallbacks for a category nobody anticipated. */
const FALLBACKS: CategoryTheme[] = [
  { bg: '#E7EAEF', fg: '#3D4655', glyph: '📦' },
  { bg: '#E3EEFB', fg: '#1B4E86', glyph: '📦' },
  { bg: '#EDE7FA', fg: '#553C9A', glyph: '📦' },
  { bg: '#FDF0D5', fg: '#8A5A0B', glyph: '📦' },
  { bg: '#D9F0EA', fg: '#0F6B55', glyph: '📦' },
];

export function categoryTheme(category?: string | null): CategoryTheme {
  const c = (category ?? '').trim();
  if (!c) return FALLBACKS[0];

  for (const { test, theme } of KNOWN) {
    if (test.test(c)) return theme;
  }

  // Deterministic, so the same category is the same colour on every device and
  // every reload — a swatch that moves is worse than no swatch.
  let hash = 0;
  for (let i = 0; i < c.length; i += 1) hash = (hash * 31 + c.charCodeAt(i)) >>> 0;
  return FALLBACKS[hash % FALLBACKS.length];
}

/** First letters of a product name, for a swatch with no category glyph. */
export const productInitials = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

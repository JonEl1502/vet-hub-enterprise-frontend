import {
  Wheat, Syringe, FlaskConical, Sprout, Wrench, Package, Egg, Milk, Droplets, Leaf,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * A colour and an icon for every category on the shelf.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * A POS grid of 20–200 identical white rectangles is read WORD BY WORD, and a
 * cashier under a queue does not read — they recognise. Square and Loyverse
 * solve this with product photography; an agrovet has none, and will not stop
 * to shoot 200 bags of feed. Colour and shape by category are the same
 * affordance for free: the feed aisle is amber wheat, the drugs are a blue
 * syringe, and the hand goes to the right quarter of the screen before the eye
 * has finished the name.
 *
 * ⚠️ Real SVG (lucide), not emoji. Emoji render as a different picture on every
 * OS, sit on their own baseline, and go muddy under 20px — which is exactly the
 * size this is used at. These are stroked paths that inherit `currentColor` and
 * stay crisp at any density.
 *
 * ⚠️ Colour is NEVER the only signal. Sold-out and low stock are stated in
 * words on every tile, because roughly 1 in 12 men has some colour blindness
 * and a till is not a place to guess.
 */

export interface CategoryTheme {
  /** Swatch background. */
  bg: string;
  /** Icon colour on that swatch. */
  fg: string;
  Icon: LucideIcon;
}

/**
 * The categories a Kenyan agrovet actually stocks. Matched loosely — a shop
 * that types "Animal Feeds" or "Vet Drugs" should still land on the right one,
 * because these are free text on `SupplierProduct.category`.
 *
 * ⚠️ Order matters: the first hit wins. "Poultry feed" must reach FEED, not
 * POULTRY, because what it IS on the shelf is a bag of feed.
 */
const KNOWN: { test: RegExp; theme: CategoryTheme }[] = [
  { test: /feed|mash|meal|pellet/i,              theme: { bg: '#FBEFD6', fg: '#8A5A0B', Icon: Wheat } },
  { test: /vet|drug|medicine|pharma|vaccin|inject/i, theme: { bg: '#E2EDFB', fg: '#1B4E86', Icon: Syringe } },
  { test: /agro-?chem|pesticid|herbicid|acaricid|spray/i, theme: { bg: '#EBE5FA', fg: '#553C9A', Icon: FlaskConical } },
  { test: /fertilis|fertiliz|manure|compost/i,   theme: { bg: '#D7EFE8', fg: '#0F6B55', Icon: Droplets } },
  { test: /seed|seedling/i,                      theme: { bg: '#E2F2D8', fg: '#3F6B1E', Icon: Sprout } },
  { test: /equip|tool|sprayer|hardware|machine/i,theme: { bg: '#E6E9EF', fg: '#3D4655', Icon: Wrench } },
  { test: /poultry|chick|bird/i,                 theme: { bg: '#FBE9DE', fg: '#93441A', Icon: Egg } },
  { test: /dairy|cattle|cow|milk/i,              theme: { bg: '#EFECE4', fg: '#6B5A2E', Icon: Milk } },
  { test: /crop|plant|garden|horti/i,            theme: { bg: '#E2F2D8', fg: '#3F6B1E', Icon: Leaf } },
];

/** Stable fallbacks for a category nobody anticipated. */
const FALLBACKS: CategoryTheme[] = [
  { bg: '#E6E9EF', fg: '#3D4655', Icon: Package },
  { bg: '#E2EDFB', fg: '#1B4E86', Icon: Package },
  { bg: '#EBE5FA', fg: '#553C9A', Icon: Package },
  { bg: '#FBEFD6', fg: '#8A5A0B', Icon: Package },
  { bg: '#D7EFE8', fg: '#0F6B55', Icon: Package },
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

/**
 * The animal reaction pack (297).
 *
 * ── Why this layer exists at all ──────────────────────────────────────────
 * Helpful / Thanks are the SIGNAL layer: Helpful is what ranks an article and
 * what a profile totals. But a lot of what lands in this feed is a photo of an
 * animal — a recovery story, somebody's new heifer — and nobody wants to press
 * "Helpful" on a photo of a dog that can walk again. This is the warmth layer
 * for those.
 *
 * ⚠️ IT MUST NEVER FEED RANKING. The server counts it in `reactionCount`, never
 * `helpfulCount`, for exactly this reason: merge the two and the feed sorts on
 * cuteness while the clinical writing sinks.
 *
 * ── Why the order changes ─────────────────────────────────────────────────
 * A poultry post opens on 🐓, a small-animal post on 🐕. We already know the
 * species from the post's own tags, so the first row is the one the reader
 * actually wants rather than a generic grid they have to hunt through. No
 * general-purpose social product can do this; it costs us one lookup.
 *
 * ⚠️ ONE ROW, TEN ANIMALS, NO VARIANTS. Not a full emoji keyboard: the pack
 * opens over a feed card on a phone, and a picker that needs scrolling is a
 * picker nobody finishes.
 */

export type PackId = 'small' | 'poultry' | 'livestock' | 'equine' | 'general';

interface Pack {
  /** Shown as the picker's heading, so the reader knows why this order. */
  label: string;
  emojis: string[];
}

export const PACKS: Record<PackId, Pack> = {
  small:     { label: 'Small animal',        emojis: ['🐕', '🐈', '🐇', '🦜', '🐹', '🐢', '🐄', '🐐', '🐓', '🐎'] },
  poultry:   { label: 'Poultry',             emojis: ['🐓', '🐔', '🐣', '🦃', '🦆', '🐖', '🐐', '🐄', '🐕', '🐈'] },
  livestock: { label: 'Dairy & livestock',   emojis: ['🐄', '🐐', '🐑', '🐖', '🐎', '🐓', '🐕', '🐈', '🦙', '🐇'] },
  equine:    { label: 'Equine',              emojis: ['🐎', '🐴', '🦄', '🐐', '🐄', '🐕', '🐈', '🐓', '🐑', '🐇'] },
  general:   { label: 'Animals',             emojis: ['🐕', '🐈', '🐄', '🐐', '🐑', '🐓', '🐖', '🐎', '🐇', '🦜'] },
};

/**
 * Which pack a post gets, from the words already on it.
 *
 * Matched on SUBSTRINGS of the tags, not equality: a post tagged
 * "poultry-health" or "dairy-herd" is about poultry and dairy, and demanding an
 * exact tag would quietly send every real-world post to the generic pack.
 *
 * Order matters — the first match wins, and the more specific families are
 * checked before the broad ones.
 */
const RULES: Array<{ pack: PackId; words: string[] }> = [
  { pack: 'poultry',   words: ['poultry', 'chicken', 'layer', 'broiler', 'newcastle', 'gumboro', 'avian', 'duck', 'turkey'] },
  { pack: 'livestock', words: ['dairy', 'cattle', 'bovine', 'cow', 'herd', 'mastitis', 'goat', 'sheep', 'caprine', 'ovine', 'swine', 'pig', 'livestock', 'farm'] },
  { pack: 'equine',    words: ['equine', 'horse', 'donkey', 'foal'] },
  { pack: 'small',     words: ['small-animal', 'canine', 'feline', 'dog', 'cat', 'puppy', 'kitten', 'spay', 'neuter', 'orthopaed', 'exotic', 'rabbit'] },
];

export function packFor(tags: string[] | undefined | null, fallbackText?: string | null): PackId {
  const hay = [...(tags || []), fallbackText || ''].join(' ').toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => hay.includes(w))) return rule.pack;
  }
  return 'general';
}

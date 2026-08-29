/**
 * What each species actually needs asked (265).
 *
 * User, 2026-08-29: *"for chicken like layers you cannot put something like
 * pregnant. You can say maybe the date of starting to lay. Is it a layer, or
 * kienyeji, or indigenous chicken? … for goats, how many are for milking, how
 * many for meat. Sheep, how many for the skin and hide, or the wool."*
 *
 * One generic form asks a poultry keeper whether a hen is pregnant and never
 * asks when she started laying. Both are wrong, and the second is the one that
 * actually predicts income.
 *
 * ⚠️ ONE source for both tiers. The paid per-animal form and the free herd
 * breakdown read the same `purposes` list, so "layers" means the same thing on
 * both sides of the paywall and the numbers stay comparable when someone
 * upgrades.
 *
 * ⚠️ Kenyan words, not textbook ones: *kienyeji* is what an indigenous bird is
 * called at every gate in the country, and a farmer scanning a dropdown for it
 * should find it.
 */
export interface SpeciesConfig {
  /** The purposes this species is kept for. `key` is stored, uppercase. */
  purposes: { key: string; label: string }[];
  /** Does gestation apply at all? False for poultry — the whole point. */
  pregnancy: boolean;
  /** Species-correct word for "pregnant". "In calf", not "pregnant". */
  pregnantLabel: string;
  /** Does milking apply? False for poultry and donkeys. */
  lactation: boolean;
  lactatingLabel: string;
  /** Poultry only: point of lay is the productive-life clock. */
  laying: boolean;
  /** What the young are called — calves, kids, lambs, chicks. */
  youngLabel: string;
}

const P = (...pairs: [string, string][]) => pairs.map(([key, label]) => ({ key, label }));

export const SPECIES_CONFIG: Record<string, SpeciesConfig> = {
  Cattle: {
    purposes: P(['DAIRY', 'Dairy'], ['BEEF', 'Beef'], ['BREEDING', 'Breeding'], ['DRAUGHT', 'Draught / ploughing']),
    pregnancy: true, pregnantLabel: 'In calf',
    lactation: true, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Calves',
  },
  Goat: {
    purposes: P(['DAIRY', 'Milk'], ['MEAT', 'Meat'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'In kid',
    lactation: true, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Kids',
  },
  Sheep: {
    purposes: P(['WOOL', 'Wool'], ['MEAT', 'Meat'], ['HIDE', 'Skin & hide'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'In lamb',
    // Sheep are milked almost nowhere in Kenya. Offering the field would be
    // asking every flock owner a question with one answer.
    lactation: false, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Lambs',
  },
  Poultry: {
    purposes: P(['LAYER', 'Layers'], ['BROILER', 'Broilers'], ['INDIGENOUS', 'Kienyeji / indigenous'], ['BREEDING', 'Breeding stock']),
    // ⚠️ The reason this file exists.
    pregnancy: false, pregnantLabel: '',
    lactation: false, lactatingLabel: '',
    laying: true, youngLabel: 'Chicks',
  },
  Pig: {
    purposes: P(['BREEDING', 'Breeding'], ['MEAT', 'Fattening']),
    pregnancy: true, pregnantLabel: 'In pig',
    lactation: true, lactatingLabel: 'Suckling',
    laying: false, youngLabel: 'Piglets',
  },
  Camel: {
    purposes: P(['DAIRY', 'Milk'], ['MEAT', 'Meat'], ['PACK', 'Pack / transport']),
    pregnancy: true, pregnantLabel: 'In calf',
    lactation: true, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Calves',
  },
  Donkey: {
    purposes: P(['DRAUGHT', 'Draught'], ['PACK', 'Pack / transport'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'In foal',
    lactation: false, lactatingLabel: '',
    laying: false, youngLabel: 'Foals',
  },
  Rabbit: {
    purposes: P(['MEAT', 'Meat'], ['FUR', 'Fur'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'Pregnant',
    lactation: true, lactatingLabel: 'Nursing',
    laying: false, youngLabel: 'Kits',
  },
};

/**
 * ⚠️ Falls back to a permissive generic rather than throwing or hiding fields.
 * `species` is free text — a farmer can type "Ostrich" — and an unknown species
 * must still be recordable, just without a tailored vocabulary.
 */
export const GENERIC_SPECIES: SpeciesConfig = {
  purposes: P(['MEAT', 'Meat'], ['DAIRY', 'Milk'], ['BREEDING', 'Breeding'], ['OTHER', 'Other']),
  pregnancy: true, pregnantLabel: 'Pregnant',
  lactation: true, lactatingLabel: 'Milking',
  laying: false, youngLabel: 'Young',
};

export const speciesConfig = (species?: string | null): SpeciesConfig => {
  if (!species) return GENERIC_SPECIES;
  const key = Object.keys(SPECIES_CONFIG).find(
    (k) => k.toLowerCase() === species.trim().toLowerCase(),
  );
  return key ? SPECIES_CONFIG[key] : GENERIC_SPECIES;
};

/** Human label for a stored purpose key, across every species. */
export const purposeLabel = (key?: string | null) => {
  if (!key) return null;
  for (const cfg of [...Object.values(SPECIES_CONFIG), GENERIC_SPECIES]) {
    const hit = cfg.purposes.find((p) => p.key === key);
    if (hit) return hit.label;
  }
  return key.charAt(0) + key.slice(1).toLowerCase();
};

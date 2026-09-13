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

  /**
   * ⚠️ A FLOCK IS NOT A HERD, AND BIRDS ARE NOT HEAD.
   *
   * User, 2026-09-14, looking at a chicken group labelled "Herd · 7 head":
   * *"for chicken we wont have [name / tag / weight] … because its flock."*
   * Every word below is the word used at a Kenyan farm gate, not the one a
   * generic livestock form would reach for.
   */
  /** A group of them: herd, flock, colony, pond, apiary. */
  groupNoun: string;
  /** How a count reads: "4 head", "900 birds", "12 rabbits", "3 hives". */
  headNoun: string;
  /** The adults, by name: cow/bull, doe/buck, hen/cock, sow/boar. */
  femaleLabel: string;
  maleLabel: string;

  /**
   * INDIVIDUAL — named, tagged and weighed one at a time. A dairy cow has a
   * name, a history and her own milk record.
   * BATCH — counted, and only counted. Nobody names one bird of nine hundred,
   * and a form that asks for a tag number and a weight per chicken is asking
   * a question the farm has no answer to. The batch IS the record.
   */
  identity: 'INDIVIDUAL' | 'BATCH';

  /**
   * The age clock. ⚠️ MONTHS IS WRONG FOR POULTRY: a broiler is slaughtered at
   * six WEEKS and a pullet comes into lay at eighteen, so a months box rounds
   * a bird's entire productive life to 1 or 2.
   */
  ageUnit: 'weeks' | 'months';

  /**
   * Breeds actually kept in Kenya, for a datalist — the field stays free text,
   * because the next farm over keeps something not on any list.
   */
  breeds: string[];

  /** How they are housed, in the words on an extension officer's form. */
  housing: string[];

  /** What it yields and the unit it is SOLD in — a tray is 30 eggs here. */
  produce: { key: string; label: string; unit: string; per: 'day' | 'week' | 'cycle' | 'year' }[];
}

const P = (...pairs: [string, string][]) => pairs.map(([key, label]) => ({ key, label }));

export const SPECIES_CONFIG: Record<string, SpeciesConfig> = {
  Cattle: {
    purposes: P(['DAIRY', 'Dairy'], ['BEEF', 'Beef'], ['BREEDING', 'Breeding'], ['DRAUGHT', 'Draught / ploughing']),
    pregnancy: true, pregnantLabel: 'In calf',
    lactation: true, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Calves',
    groupNoun: 'herd', headNoun: 'head', femaleLabel: 'Cow', maleLabel: 'Bull',
    identity: 'INDIVIDUAL', ageUnit: 'months',
    breeds: ['Friesian', 'Ayrshire', 'Guernsey', 'Jersey', 'Sahiwal', 'Boran', 'Zebu', 'Crossbreed'],
    housing: ['Zero-grazing unit', 'Paddock', 'Tethered', 'Open grazing'],
    produce: [
      { key: 'MILK', label: 'Milk', unit: 'litres', per: 'day' },
      { key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' },
    ],
  },
  Goat: {
    purposes: P(['DAIRY', 'Milk'], ['MEAT', 'Meat'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'In kid',
    lactation: true, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Kids',
    groupNoun: 'herd', headNoun: 'head', femaleLabel: 'Doe', maleLabel: 'Buck',
    identity: 'INDIVIDUAL', ageUnit: 'months',
    breeds: ['Toggenburg', 'German Alpine', 'Saanen', 'Galla', 'Small East African', 'Boer', 'Kenya Dual Purpose'],
    housing: ['Raised slatted house', 'Zero-grazing unit', 'Tethered', 'Open grazing'],
    produce: [
      { key: 'MILK', label: 'Milk', unit: 'litres', per: 'day' },
      { key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' },
    ],
  },
  Sheep: {
    purposes: P(['WOOL', 'Wool'], ['MEAT', 'Meat'], ['HIDE', 'Skin & hide'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'In lamb',
    // Sheep are milked almost nowhere in Kenya. Offering the field would be
    // asking every flock owner a question with one answer.
    lactation: false, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Lambs',
    // ⚠️ Sheep are a FLOCK, not a herd — the one word a cattle-shaped form
    // always gets wrong about them.
    groupNoun: 'flock', headNoun: 'head', femaleLabel: 'Ewe', maleLabel: 'Ram',
    identity: 'INDIVIDUAL', ageUnit: 'months',
    breeds: ['Dorper', 'Red Maasai', 'Merino', 'Corriedale', 'Hampshire Down', 'Blackhead Persian', 'Romney Marsh'],
    housing: ['Raised slatted house', 'Paddock', 'Open grazing'],
    produce: [
      { key: 'WOOL', label: 'Wool', unit: 'kg', per: 'cycle' },
      { key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' },
    ],
  },
  Poultry: {
    purposes: P(['LAYER', 'Layers'], ['BROILER', 'Broilers'], ['INDIGENOUS', 'Kienyeji / indigenous'], ['BREEDING', 'Breeding stock']),
    // ⚠️ The reason this file exists.
    pregnancy: false, pregnantLabel: '',
    lactation: false, lactatingLabel: '',
    laying: true, youngLabel: 'Chicks',
    // ⚠️ THE SPECIES THIS WHOLE FILE EXISTS FOR. A flock of birds, counted —
    // never a herd of head, and never named one at a time.
    groupNoun: 'flock', headNoun: 'birds', femaleLabel: 'Hen', maleLabel: 'Cock',
    identity: 'BATCH', ageUnit: 'weeks',
    breeds: ['Improved kienyeji (KARI)', 'Kuroiler', 'Rainbow Rooster', 'Kienyeji (indigenous)',
             'Isa Brown', 'Lohmann Brown', 'Cobb 500', 'Ross 308'],
    housing: ['Deep litter', 'Battery cage', 'Free range', 'Kienyeji run'],
    produce: [
      // A tray is 30 eggs, and eggs are counted and sold in trays at every
      // gate in the country. Recording "eggs" makes the farmer do the sum.
      { key: 'EGGS', label: 'Eggs', unit: 'trays', per: 'day' },
      { key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' },
    ],
  },
  Pig: {
    purposes: P(['BREEDING', 'Breeding'], ['MEAT', 'Fattening']),
    pregnancy: true, pregnantLabel: 'In pig',
    lactation: true, lactatingLabel: 'Suckling',
    laying: false, youngLabel: 'Piglets',
    groupNoun: 'herd', headNoun: 'head', femaleLabel: 'Sow', maleLabel: 'Boar',
    // Sows are named and followed through their litters; fatteners are moved
    // through in batches. INDIVIDUAL because the model already carries both —
    // a group holds the fatteners and the sows are named inside it.
    identity: 'INDIVIDUAL', ageUnit: 'months',
    breeds: ['Large White', 'Landrace', 'Duroc', 'Hampshire', 'Camborough', 'Crossbreed'],
    housing: ['Concrete sty', 'Deep litter sty', 'Free range'],
    produce: [{ key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' }],
  },
  Camel: {
    purposes: P(['DAIRY', 'Milk'], ['MEAT', 'Meat'], ['PACK', 'Pack / transport']),
    pregnancy: true, pregnantLabel: 'In calf',
    lactation: true, lactatingLabel: 'Milking',
    laying: false, youngLabel: 'Calves',
    groupNoun: 'herd', headNoun: 'head', femaleLabel: 'She-camel', maleLabel: 'Bull',
    identity: 'INDIVIDUAL', ageUnit: 'months',
    breeds: ['Somali', 'Turkana', 'Gabbra', 'Rendille', 'Pakistani'],
    housing: ['Open range', 'Boma'],
    produce: [
      { key: 'MILK', label: 'Milk', unit: 'litres', per: 'day' },
      { key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' },
    ],
  },
  Donkey: {
    purposes: P(['DRAUGHT', 'Draught'], ['PACK', 'Pack / transport'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'In foal',
    lactation: false, lactatingLabel: '',
    laying: false, youngLabel: 'Foals',
    groupNoun: 'herd', headNoun: 'head', femaleLabel: 'Jenny', maleLabel: 'Jack',
    identity: 'INDIVIDUAL', ageUnit: 'months',
    breeds: ['Indigenous', 'Maasai', 'Crossbreed'],
    housing: ['Boma', 'Tethered', 'Open grazing'],
    // A donkey earns by working, not by yielding. No produce line is the
    // honest answer; an empty "milk per day" box would be noise.
    produce: [],
  },
  Rabbit: {
    purposes: P(['MEAT', 'Meat'], ['FUR', 'Fur'], ['BREEDING', 'Breeding']),
    pregnancy: true, pregnantLabel: 'Pregnant',
    lactation: true, lactatingLabel: 'Nursing',
    laying: false, youngLabel: 'Kits',
    // A rabbitry is a COLONY, and they are counted as rabbits, not head.
    groupNoun: 'colony', headNoun: 'rabbits', femaleLabel: 'Doe', maleLabel: 'Buck',
    identity: 'INDIVIDUAL', ageUnit: 'months',
    breeds: ['New Zealand White', 'California White', 'Chinchilla', 'Flemish Giant', 'Dutch', 'French Ear Lop'],
    housing: ['Hutch', 'Colony pen', 'Deep litter'],
    produce: [{ key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' }],
  },
  /**
   * ⚠️ Farmed, and farmed HERE — aquaculture and apiculture are ordinary
   * Kenyan smallholder enterprises, not exotica. Both are batch-kept, which is
   * the shape this file now knows how to express; before it did, a fish pond
   * could only be recorded by pretending it was a cow.
   */
  Fish: {
    purposes: P(['MEAT', 'Table fish'], ['BREEDING', 'Fingerlings'], ['OTHER', 'Ornamental']),
    pregnancy: false, pregnantLabel: '',
    lactation: false, lactatingLabel: '',
    laying: false, youngLabel: 'Fingerlings',
    groupNoun: 'pond', headNoun: 'fish', femaleLabel: 'Female', maleLabel: 'Male',
    identity: 'BATCH', ageUnit: 'months',
    breeds: ['Nile tilapia', 'Catfish', 'Common carp', 'Rainbow trout'],
    housing: ['Earthen pond', 'Liner pond', 'Concrete tank', 'Cage'],
    produce: [{ key: 'MEAT', label: 'Harvest', unit: 'kg', per: 'cycle' }],
  },
  Bees: {
    purposes: P(['HONEY', 'Honey'], ['WAX', 'Wax'], ['POLLINATION', 'Pollination'], ['BREEDING', 'Queen rearing']),
    pregnancy: false, pregnantLabel: '',
    lactation: false, lactatingLabel: '',
    laying: false, youngLabel: 'Brood',
    // An apiary is counted in HIVES. A colony's population is nobody's number.
    groupNoun: 'apiary', headNoun: 'hives', femaleLabel: 'Queen', maleLabel: 'Drone',
    identity: 'BATCH', ageUnit: 'months',
    breeds: ['African honey bee', 'Stingless bee'],
    housing: ['Langstroth hive', 'Kenya Top Bar hive', 'Log hive'],
    produce: [
      { key: 'HONEY', label: 'Honey', unit: 'kg', per: 'cycle' },
      { key: 'WAX', label: 'Wax', unit: 'kg', per: 'cycle' },
    ],
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
  // Permissive, like the rest of this fallback: a group, counted in head,
  // named if the farmer wants to. Guessing 'flock' for an unknown species
  // would be wrong more often than 'herd'.
  groupNoun: 'group', headNoun: 'head', femaleLabel: 'Female', maleLabel: 'Male',
  identity: 'INDIVIDUAL', ageUnit: 'months',
  breeds: [], housing: [],
  produce: [{ key: 'MEAT', label: 'Liveweight', unit: 'kg', per: 'cycle' }],
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

/**
 * The picture a product shows when it has no photo of its own (2026-11-21).
 *
 * Real packshots were wanted for every product, but the 5,000-row reference
 * catalogue is mostly generic drug + strength + form ("Methocarbamol 500mg
 * Injectable (250mL Vial)") and no free source has proper photos of those.
 * So each product gets a clean, background-free drawing of its FORM —
 * tablets, vial, bottle, tube, sachet… — from /public/product-forms. Any real
 * `imageUrl` always wins; this is only ever the fallback, never stored.
 *
 * The rules mirror the grouping used for the photo search, so a product's
 * icon and its photo group always agree.
 */
const FORMS: Array<[string, RegExp]> = [
  ['vaccine', /vaccin/],
  ['injectable', /inject|vial|ampoule|\binj\b|infusion/],
  ['tablets', /tablet|\btabs?\b|caplet|bolus/],
  ['capsules', /capsule|\bcaps?\b/],
  ['oral-suspension', /suspension|syrup|oral solution|elixir|oral drops|oral liquid|oral gel|paste/],
  ['pour-on', /pour-?on|spot-?on/],
  ['spray', /spray|aerosol/],
  ['eye-drops', /\beye\b|ophthalm/],
  ['ear-drops', /\bear\b|otic/],
  ['ointment', /ointment|cream|\bgel\b|salve/],
  ['shampoo', /shampoo|\bwash\b|scrub/],
  ['powder', /powder|sachet|granule|premix/],
  ['test-kit', /\btest\b|\bkit\b|strip|dipstick/],
  ['collar', /collar/],
  ['fluid-bag', /saline|ringer|dextrose|\biv\b bag|fluid/],
  ['food', /\b\d+(\.\d+)?\s?kg\b|pouch|kibble|\bfood\b|\bdiet\b|portion|meal|treat/],
  ['supply', /syringe|needle|tube|glove|gauze|bandage|catheter|swab|cotton|forceps|suture|blade|scalpel|stethoscope|thermometer/],
];

export const productFormKey = (name?: string | null, category?: string | null, unit?: string | null): string => {
  const s = `${name ?? ''} ${category ?? ''} ${unit ?? ''}`.toLowerCase();
  for (const [key, rx] of FORMS) if (rx.test(s)) return key;
  return 'product';
};

export const productFormIcon = (name?: string | null, category?: string | null, unit?: string | null): string =>
  `/product-forms/${productFormKey(name, category, unit)}.svg`;

/** The product's own photo, or its form drawing. */
export const productImage = (p: { imageUrl?: string | null; name?: string | null; category?: string | null; unit?: string | null }): string =>
  (p.imageUrl && String(p.imageUrl).trim()) || productFormIcon(p.name, p.category, p.unit);

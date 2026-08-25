import type { LeadImportRow } from '../../../services/modules/demoRequests.api';

/**
 * Turning somebody's spreadsheet into leads.
 *
 * Reads the `{ headers, rows }` shape that `utils/import/parse.ts` (files) and
 * `utils/import/paste.ts` (pasted text) already produce, so upload and paste
 * arrive here identical and neither path needs its own reader.
 *
 * ⚠️ Nothing here is keyed on column POSITION. The research file is a working
 * document, not an interface: its clinic tab and its farm tab use DIFFERENT
 * headings for the same thing ("Business / Facility" vs "Practice /
 * Practitioner", "Town / Area" vs "Base Town"), and the next list will be laid
 * out differently again. Each field lists the headings it answers to; anything
 * unrecognised is reported, never guessed at.
 *
 * This lives on the client on purpose — the shape of one spreadsheet is a UI
 * concern, and a new list must not need a backend release.
 */

/**
 * `parse.ts` hands us headers already lowercased and underscored
 * ("Region / County" → "region_county"). Stripping to bare alphanumerics on
 * top makes our aliases matchable in their written form.
 */
const norm = (h: string) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Aliases in PRIORITY order — the first present *with a value* wins.
 *
 * That ordering is load-bearing for `phone`: the sheet has both Phone and
 * WhatsApp, and a practice that publishes only a WhatsApp number should still
 * be callable rather than importing blank.
 */
const FIELD_ALIASES: Record<keyof LeadImportRow, string[]> = {
  externalRef: ['Lead ID', 'Vet ID', 'ID', 'Ref', 'Reference'],
  clinicName: [
    'Business / Facility', 'Practice / Practitioner', 'Business Name', 'Business',
    'Facility', 'Practice', 'Clinic Name', 'Clinic', 'Organisation', 'Organization',
    'Company', 'Name',
  ],
  // The business name is NOT the contact person. Where a sheet knows a human,
  // that is who gets addressed on the call — and whose name the created
  // account's owner profile carries.
  name: ['Contact Person', 'Contact Name', 'Contact', 'Owner', 'Principal', 'Director'],
  email: ['Email', 'E-mail', 'Email Address', 'Emails'],
  phone: ['Phone', 'Telephone', 'Phone Number', 'Mobile', 'Tel', 'WhatsApp'],
  website: ['Website', 'Web', 'URL', 'Site', 'Web Address'],
  country: ['Country'],
  region: ['Region / County', 'Region', 'County', 'Coverage Area', 'State', 'Province'],
  town: ['Town / Area', 'Town', 'Base Town', 'City', 'Area', 'Location'],
  segment: ['Classification', 'Segment', 'Category', 'Type', 'Evidence Tier'],
  priority: ['Prior Priority', 'Priority'],
  leadScore: ['Lead Score', 'Score'],
  message: [], // built from several columns at once — see EXTRA_COLUMNS.
};

/** Shown in the mapping summary instead of the raw object key. */
export const FIELD_LABELS: Record<string, string> = {
  externalRef: 'Lead ID', clinicName: 'Business', name: 'Contact', email: 'Email',
  phone: 'Phone', website: 'Website', country: 'Country', region: 'Region',
  town: 'Town', segment: 'Segment', priority: 'Priority', leadScore: 'Lead score',
};

/**
 * Columns that are not fields of their own but ARE what you say on the call —
 * folded into `message` as "Label: value" so the row shows them.
 *
 * Anything not listed here (Facebook, Google rating, verification status…) is
 * research provenance and is deliberately dropped: a queue you have to scroll
 * sideways is a queue nobody works.
 */
const EXTRA_COLUMNS = [
  'Animals Treated', 'Animals / Focus', 'Services Advertised',
  'Mobile / Farm Service', 'Website Opportunity', 'Website Status',
  'Physical Address', 'Parent Organisation', 'Linked Clinic ID', 'Notes',
];

export interface MappedSheet {
  rows: LeadImportRow[];
  /** Headings we understood — the "we read these columns" line in the UI. */
  matched: { field: string; header: string }[];
  /** Headings present in the source that nothing claimed. */
  ignored: string[];
  /** Rows that carried no business and no contact, so nobody to call. */
  skipped: number;
}

const cell = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();

/**
 * Map parsed rows onto leads.
 *
 * Rows with nothing in any recognised name column are dropped and counted —
 * a pasted selection routinely carries a trailing blank line, and a
 * spreadsheet's "total" row is not a lead.
 */
export function mapLeadRows(
  headers: string[],
  rows: Record<string, string>[],
): MappedSheet {
  const byNorm = new Map<string, string>();
  headers.forEach(h => {
    const k = norm(h);
    // First occurrence wins: a duplicated heading is a copy-paste artefact and
    // the leftmost is the one people mean.
    if (k && !byNorm.has(k)) byNorm.set(k, h);
  });

  const matched: { field: string; header: string }[] = [];
  const claimed = new Set<string>();
  const plan: Partial<Record<keyof LeadImportRow, string[]>> = {};

  (Object.keys(FIELD_ALIASES) as (keyof LeadImportRow)[]).forEach(field => {
    const cols = FIELD_ALIASES[field]
      .map(a => byNorm.get(norm(a)))
      .filter((h): h is string => h !== undefined);
    if (cols.length) {
      plan[field] = cols;
      cols.forEach(h => claimed.add(h));
      matched.push({ field, header: cols[0] });
    }
  });

  const extras: { label: string; header: string }[] = [];
  EXTRA_COLUMNS.forEach(label => {
    const h = byNorm.get(norm(label));
    if (h && !claimed.has(h)) { extras.push({ label, header: h }); claimed.add(h); }
  });

  const ignored = headers.filter(h => h && !claimed.has(h));

  const pick = (row: Record<string, string>, field: keyof LeadImportRow): string => {
    for (const h of plan[field] ?? []) {
      const v = cell(row[h]);
      if (v) return v;
    }
    return '';
  };

  const out: LeadImportRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const clinicName = pick(row, 'clinicName');
    const name = pick(row, 'name');
    if (!clinicName && !name) { skipped++; continue; }

    const message = extras
      .map(({ label, header }) => { const v = cell(row[header]); return v ? `${label}: ${v}` : ''; })
      .filter(Boolean)
      .join(' · ');

    const scoreRaw = pick(row, 'leadScore');
    const score = Number(scoreRaw);

    out.push({
      externalRef: pick(row, 'externalRef') || null,
      // The business name stands in until somebody learns a human's — every
      // row in the current list has an empty Contact Person.
      name: name || clinicName,
      clinicName: clinicName || null,
      email: pick(row, 'email') || null,
      phone: pick(row, 'phone') || null,
      website: pick(row, 'website') || null,
      country: pick(row, 'country') || null,
      region: pick(row, 'region') || null,
      town: pick(row, 'town') || null,
      segment: pick(row, 'segment') || null,
      priority: pick(row, 'priority') || null,
      leadScore: scoreRaw && Number.isFinite(score) ? score : null,
      message: message || null,
    });
  }

  return { rows: out, matched, ignored, skipped };
}

/**
 * Does this look like a lead list at all?
 *
 * Guards the case that costs the most to undo: pasting the wrong tab and
 * importing 22 rows of headline figures as prospects. Two recognised headings
 * is a low bar on purpose — a hand-typed list of "Clinic, Town, Phone" is
 * perfectly valid input.
 */
export function looksLikeLeads(headers: string[]): boolean {
  const known = new Set(
    Object.values(FIELD_ALIASES).flat().concat(EXTRA_COLUMNS).map(norm),
  );
  return headers.filter(h => known.has(norm(h))).length >= 2;
}

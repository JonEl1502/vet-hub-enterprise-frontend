/**
 * Column matching + row cleaning for pasted data.
 *
 * Two steps, deliberately separate so the user can correct the first before the
 * second runs:
 *   1. autoMatch  — which pasted column feeds which template column
 *   2. applyMapping — clean each value into template shape, reporting repairs
 */

import { EntitySchema, ColumnDef } from './schemas';
import {
  cleanText, smartCase, splitName, normalisePhone, normaliseEmailAddress,
  isBlankMarker, phoneProfileFor, EMAIL_RE,
} from './clean';

/** A synthetic target: one source column holding the whole name. */
export const FULL_NAME = '__full_name';

export interface TargetDef {
  key: string;
  label: string;
  required: boolean;
  help?: string;
}

export type Mapping = Record<string, string>;  // target key -> source header ('' = unmapped)

export interface RowIssue {
  field: string;
  message: string;
  /** 'fixed' = value used after a repair; 'dropped' = value discarded. */
  severity: 'fixed' | 'dropped';
}

export interface MappedRows {
  rows: Record<string, string>[];
  issues: RowIssue[][];
  /** Source rows that carried no usable identity at all. */
  skipped: number;
}

export interface MapOptions {
  /** E.164 prefix used for local numbers, e.g. '+254'. */
  dialCode: string;
  /** Written into a `country` column when the source has none. */
  country?: string;
  /** Written into a `currency` column when the source has none. */
  currency?: string;
}

// ── targets ──────────────────────────────────────────────────────────────────

const nameCols = (schema: EntitySchema) =>
  schema.columns.filter(c => ['title', 'first_name', 'second_name', 'surname'].includes(c.key));

export const supportsFullName = (schema: EntitySchema): boolean =>
  schema.columns.some(c => c.key === 'first_name') &&
  schema.columns.some(c => c.key === 'surname');

/** Template columns plus, where the schema has split name parts, a combined one. */
export function buildTargets(schema: EntitySchema): TargetDef[] {
  const targets: TargetDef[] = [];
  if (supportsFullName(schema)) {
    targets.push({
      key: FULL_NAME,
      label: 'Full name (split automatically)',
      required: false,
      help: 'One column holding the whole name — it is split into title, first, middle and surname.',
    });
  }
  for (const c of schema.columns) {
    targets.push({ key: c.key, label: c.label, required: !!c.required, help: c.help });
  }
  return targets;
}

// ── auto-match ───────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADER_HINTS: Record<string, string[]> = {
  [FULL_NAME]: ['name', 'fullname', 'clientname', 'ownername', 'customername', 'contactname', 'names'],
  first_name: ['firstname', 'fname', 'givenname'],
  second_name: ['middlename', 'secondname', 'othernames', 'mname'],
  surname: ['surname', 'lastname', 'lname', 'familyname'],
  phone: ['phone', 'phoneno', 'phonenumber', 'mobile', 'mobileno', 'tel', 'telephone', 'cell', 'msisdn', 'contact'],
  owner_phone: ['ownerphone', 'clientphone', 'phone', 'mobile'],
  email: ['email', 'emailaddress', 'mail', 'eaddress'],
  owner_email: ['owneremail', 'clientemail', 'email'],
  address: ['address', 'physicaladdress', 'postaladdress', 'location', 'residence', 'town', 'city'],
  title: ['title', 'salutation', 'prefix'],
  gender: ['gender', 'sex'],
  dob: ['dob', 'dateofbirth', 'birthdate', 'birthday'],
  country: ['country', 'nation'],
  currency: ['currency', 'ccy'],
};

const sample = (rows: Record<string, string>[], header: string, n = 60): string[] =>
  rows.slice(0, n).map(r => cleanText(r[header])).filter(v => v !== '');

const fraction = (vals: string[], pred: (v: string) => boolean): number =>
  vals.length ? vals.filter(pred).length / vals.length : 0;

const looksEmail = (v: string) => EMAIL_RE.test(v) || (v.includes('@') && v.includes('.'));

const looksPhone = (v: string) => {
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 16) return false;
  // Mostly digits, punctuation only of the phone kind.
  return /^[\d\s+()\-/.,;]+$/.test(v);
};

const looksPersonName = (v: string) => {
  if (v.includes('@') || /\d/.test(v)) return false;
  const words = v.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 6 && v.length <= 60;
};

const looksAddress = (v: string) =>
  !v.includes('@') && v.length >= 6 && (v.includes(',') || v.split(/\s+/).length >= 2);

/**
 * Address is scored only over the values that are NOT an email or a phone.
 *
 * The address column in these dumps is exactly where the stray email and the
 * second phone number ended up, so counting those as misses makes the real
 * address column score too low to be claimed — and then the swap-recovery in
 * normaliseEmailAddress never gets the chance to rescue them.
 */
const addressScore = (vals: string[]): number => {
  const rest = vals.filter(v => !looksEmail(v) && !looksPhone(v));
  if (rest.length < 2) return 0;
  return fraction(rest, looksAddress);
};

/** Row indices and record ids look identical to a short phone — never map them. */
const looksIdColumn = (vals: string[]) =>
  vals.length >= 3 && fraction(vals, v => /^\d{1,6}$/.test(v)) > 0.9;

/**
 * Guess the mapping: by header name first, then — for anything still unmapped —
 * by what the column actually contains. Content sniffing is what makes a
 * headerless dump usable at all.
 */
export function autoMatch(
  headers: string[],
  rows: Record<string, string>[],
  schema: EntitySchema,
): Mapping {
  const targets = buildTargets(schema);
  const mapping: Mapping = {};
  for (const t of targets) mapping[t.key] = '';
  const used = new Set<string>();

  // Pass 1 — header names, including each column's declared aliases.
  for (const t of targets) {
    const col: ColumnDef | undefined = schema.columns.find(c => c.key === t.key);
    const candidates = new Set<string>([
      norm(t.key),
      ...(col?.aliases ?? []).map(norm),
      ...(HEADER_HINTS[t.key] ?? []).map(norm),
    ]);
    const hit = headers.find(h => !used.has(h) && candidates.has(norm(h)));
    if (hit) {
      mapping[t.key] = hit;
      used.add(hit);
    }
  }

  // A source column literally called "name" beats the split parts.
  if (mapping[FULL_NAME] && mapping.first_name && mapping.surname) {
    mapping[FULL_NAME] = '';
  }

  // Pass 2 — contents, for whatever is still unmapped.
  const free = headers.filter(h => !used.has(h));
  const stats = free.map(h => {
    const vals = sample(rows, h);
    return {
      header: h,
      vals,
      isId: looksIdColumn(vals),
      email: fraction(vals, looksEmail),
      phone: fraction(vals, looksPhone),
      name: fraction(vals, looksPersonName),
      address: addressScore(vals),
    };
  });

  const claim = (target: string, key: 'email' | 'phone' | 'name' | 'address', min: number) => {
    if (mapping[target] === undefined || mapping[target]) return;
    const best = stats
      .filter(s => !used.has(s.header) && !s.isId && s[key] >= min)
      .sort((a, b) => b[key] - a[key])[0];
    if (best) {
      mapping[target] = best.header;
      used.add(best.header);
    }
  };

  // Order matters: the most distinctive signature claims its column first.
  claim('email', 'email', 0.5);
  claim('owner_email', 'email', 0.5);
  claim('phone', 'phone', 0.5);
  claim('owner_phone', 'phone', 0.5);
  if (!mapping.first_name || !mapping.surname) claim(FULL_NAME, 'name', 0.5);
  // Lower bar than the rest: a wrong address guess is visible and one edit to
  // undo, while a missed one strands the emails hiding in that column.
  claim('address', 'address', 0.4);

  return mapping;
}

// ── apply ────────────────────────────────────────────────────────────────────

const NAME_PART_KEYS = ['title', 'first_name', 'second_name', 'surname'];

const isPhoneKey = (k: string) => k === 'phone' || k.endsWith('_phone');
const isEmailKey = (k: string) => k === 'email' || k.endsWith('_email');

/**
 * Build template rows from the mapping, cleaning as it goes.
 *
 * Every repair lands in `issues` rather than being applied quietly — the row is
 * about to be shown in an editable table, and a note is what tells the user
 * which cell to look at.
 */
export function applyMapping(
  source: Record<string, string>[],
  mapping: Mapping,
  schema: EntitySchema,
  opts: MapOptions,
): MappedRows {
  const profile = phoneProfileFor(opts.dialCode);
  const keys = schema.columns.map(c => c.key);
  const hasAddress = keys.includes('address');

  const rows: Record<string, string>[] = [];
  const issues: RowIssue[][] = [];
  let skipped = 0;

  const get = (src: Record<string, string>, target: string): string => {
    const h = mapping[target];
    return h ? (src[h] ?? '') : '';
  };

  for (const src of source) {
    const out: Record<string, string> = {};
    const rowIssues: RowIssue[] = [];
    for (const k of keys) out[k] = '';

    // 1. Name — the combined column fills only the parts nothing else provides.
    if (mapping[FULL_NAME]) {
      const split = splitName(get(src, FULL_NAME));
      for (const c of nameCols(schema)) {
        const v = (split as unknown as Record<string, string>)[c.key] ?? '';
        if (v) out[c.key] = v;
      }
      // Mr./Mrs. implies a gender. Not flagged as a repair — it fires on most
      // rows, and a badge on every row tells the user nothing about which ones
      // are actually worth looking at. The filled cell is its own disclosure.
      if (keys.includes('gender') && split.gender && !mapping.gender) {
        out.gender = split.gender;
      }
    }

    // 2. Straight columns.
    for (const k of keys) {
      if (mapping[FULL_NAME] && NAME_PART_KEYS.includes(k) && !mapping[k]) continue;
      const raw = get(src, k);
      if (!mapping[k]) continue;
      const v = cleanText(raw);
      out[k] = isBlankMarker(v) ? '' : v;
    }

    // 3. Name parts that came in individually still need casing fixed.
    for (const k of NAME_PART_KEYS) {
      if (!keys.includes(k) || !mapping[k] || !out[k]) continue;
      if (k === 'title') continue;
      out[k] = out[k].split(/\s+/).map(smartCase).join(' ');
    }

    // 4. Email + address together — legacy dumps swap the two.
    for (const k of keys.filter(isEmailKey)) {
      const pairAddress = k === 'email' && hasAddress ? out.address : '';
      const res = normaliseEmailAddress(out[k], pairAddress);
      out[k] = res.email;
      if (k === 'email' && hasAddress) out.address = res.address;
      for (const n of res.notes) {
        // An owner_email column has no paired address; point its notes at itself.
        const field = n.field === 'address' && k !== 'email' ? k : n.field;
        rowIssues.push({
          field,
          message: n.message,
          severity: n.message.startsWith('dropped') ? 'dropped' : 'fixed',
        });
      }
    }

    // 5. Phones.
    for (const k of keys.filter(isPhoneKey)) {
      if (!out[k]) continue;
      const res = normalisePhone(out[k], profile);
      if (res.issue) {
        rowIssues.push({ field: k, message: res.issue, severity: 'dropped' });
        out[k] = '';
      } else {
        out[k] = res.phone;
        if (res.note) rowIssues.push({ field: k, message: res.note, severity: 'fixed' });
      }
    }

    // 6. Defaults the clinic chose, only where the source said nothing.
    if (keys.includes('country') && !out.country && opts.country) out.country = opts.country;
    if (keys.includes('currency') && !out.currency && opts.currency) out.currency = opts.currency;

    // A row with nothing in it is the old system's blank line, not a record.
    if (!Object.entries(out).some(([k, v]) => v && !['country', 'currency'].includes(k))) {
      skipped++;
      continue;
    }

    rows.push(out);
    issues.push(rowIssues);
  }

  return { rows, issues, skipped };
}

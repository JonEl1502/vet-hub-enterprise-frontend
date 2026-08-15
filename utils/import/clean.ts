/**
 * Cleaning engine for pasted legacy data.
 *
 * A dump out of an old practice-management system is never template-shaped: the
 * whole name sits in one column ("MRS.Jane Ng&#039;ang&#039;a"), the phone column
 * sometimes holds the row's own client id, the address column sometimes holds an
 * email, and half the values are HTML-encoded twice over.
 *
 * These helpers turn that into template columns. Every repair is REPORTED as a
 * note rather than applied silently — the user edits the preview before it goes
 * anywhere, so a wrong guess costs a keystroke, not a bad record.
 */

// ── text ─────────────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

const TAG_RE = /<[^>]+>/g;
const WS_RE = /\s+/g;

const unescapeOnce = (s: string): string =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITIES[n.toLowerCase()] ?? m);

/** Decode entities (twice — these dumps are commonly double-encoded), strip
 *  tags, flatten newlines into a comma list, collapse whitespace. */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = unescapeOnce(unescapeOnce(String(value)));
  s = s.replace(TAG_RE, ' ');
  s = s.replace(/\r\n|\n|\r/g, ', ');
  s = s.replace(WS_RE, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
  // Entity decoding leaves a stray space: "Ng 'ang 'a" -> "Ng'ang'a".
  s = s.replace(/\s+'/g, "'");
  return s.trim();
}

const BLANK_MARKERS = new Set(['', '_', '-', '--', 'na', 'n/a', 'none', 'null', '.', 'nil', 'unknown']);

export const isBlankMarker = (s: string): boolean =>
  BLANK_MARKERS.has(s.trim().toLowerCase());

// ── casing ───────────────────────────────────────────────────────────────────

const ROMAN = /^(II|III|IV|VI{0,3})$/;

/**
 * Fix SHOUTED or lowercased tokens without destroying acronyms.
 *
 * Rather than a hardcoded allow-list (which only ever covers the dataset it was
 * written against), an ALL-CAPS token is left alone when it reads as an acronym:
 * short and vowel-free, or containing a digit — G4S, KWS, CSCEC, JK, III.
 */
export function smartCase(token: string): string {
  if (!token) return token;
  const bare = token.replace(/[^A-Za-z0-9]/g, '');
  if (token === token.toUpperCase()) {
    if (ROMAN.test(bare)) return token;
    if (/\d/.test(bare)) return token;
    if (bare.length <= 5 && !/[AEIOU]/.test(bare)) return token;
  }
  // Already mixed case — the source meant it (McDonald, van Wyk).
  if (token !== token.toUpperCase() && token !== token.toLowerCase()) return token;

  let out = token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  out = out.replace(/\bMc([a-z])/g, (_, c: string) => 'Mc' + c.toUpperCase());
  out = out.replace(/([A-Za-z]')([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
  out = out.replace(/(-)([a-z])/g, (_, d: string, c: string) => d + c.toUpperCase());
  return out;
}

// ── names ────────────────────────────────────────────────────────────────────

/** title token -> [display title, implied gender]. Joint households get no gender. */
const TITLE_MAP: Record<string, [string, string]> = {
  mr: ['Mr.', 'M'], mister: ['Mr.', 'M'],
  mrs: ['Mrs.', 'F'],
  miss: ['Miss', 'F'], ms: ['Ms.', 'F'], mss: ['Ms.', 'F'], mi: ['Ms.', 'F'],
  dr: ['Dr.', ''], doctor: ['Dr.', ''],
  prof: ['Prof.', ''], professor: ['Prof.', ''],
  hon: ['Hon.', ''],
  major: ['Major', ''], eng: ['Eng.', ''], capt: ['Capt.', ''], sgt: ['Sgt.', ''],
  'mr/mrs': ['Mr. & Mrs.', ''], 'mrs/mr': ['Mr. & Mrs.', ''], 'mr&mrs': ['Mr. & Mrs.', ''],
  'm/s': ['Ms.', 'F'],
};

const TITLE_PREFIX_RE = /^(mr|mrs|ms|miss|dr|prof|hon|eng|capt|sgt)\.\s*(?=[A-Za-z])/i;

/** Placeholder names the old system accepted in place of a real one. */
const JUNK_NAMES = new Set([
  '', 'null', 'na', 'n/a', '-', '_', '.', 'client', 'client client', 'new client',
  'test', 'test test', 'wrong', 'unknown', 'walk in', 'walk-in', 'counter sale',
]);

export interface SplitName {
  title: string;
  first_name: string;
  second_name: string;
  surname: string;
  gender: string;
}

const EMPTY_NAME: SplitName = { title: '', first_name: '', second_name: '', surname: '', gender: '' };

/** "MRS.Jane Wanjiru Ng'ang'a" -> Mrs. / Jane / Wanjiru / Ng'ang'a / F */
export function splitName(raw: unknown): SplitName {
  let name = cleanText(raw);
  const low = name.toLowerCase();
  if (JUNK_NAMES.has(low) || /^x+$/.test(low) || low.length < 2) return { ...EMPTY_NAME };

  // Un-glue a run-on title: "Dr.stephen" -> "Dr. stephen".
  name = name.replace(TITLE_PREFIX_RE, (_m, t: string) => `${t}. `);

  let tokens = name.split(' ').filter(Boolean);
  let title = '';
  let gender = '';

  if (tokens.length) {
    const key = tokens[0].toLowerCase().replace(/[.,]+$/, '');
    const keySlash = tokens[0].toLowerCase().replace(/\./g, '');
    const hit = TITLE_MAP[key] ?? TITLE_MAP[keySlash];
    if (hit) {
      [title, gender] = hit;
      tokens = tokens.slice(1);
    }
  }

  tokens = tokens.map(smartCase);
  if (!tokens.length) return { ...EMPTY_NAME, title, gender };
  if (tokens.length === 1) return { title, first_name: tokens[0], second_name: '', surname: '', gender };
  if (tokens.length === 2) return { title, first_name: tokens[0], second_name: '', surname: tokens[1], gender };
  return {
    title,
    first_name: tokens[0],
    second_name: tokens.slice(1, -1).join(' '),
    surname: tokens[tokens.length - 1],
    gender,
  };
}

// ── phone ────────────────────────────────────────────────────────────────────

export interface PhoneProfile {
  /** E.164 prefix including '+' — e.g. '+254'. */
  dialCode: string;
  /** Expected national significant length, when the country has exactly one. */
  nationalLength?: number;
  /** Leading digits of a mobile number, after the trunk 0 is stripped. */
  mobilePrefixes?: string[];
}

/**
 * Kenya gets a strict profile because that is where the placeholder rows live:
 * legacy exports there routinely stored the row's own client id, "07", or
 * 0700000000 in the phone column, and all three pass a loose length check.
 * Everywhere else takes the generic 8–15 digit rule — a wrong strict rule
 * rejects real numbers, which is worse than admitting a doubtful one the user
 * can see and edit.
 */
const STRICT_PROFILES: Record<string, PhoneProfile> = {
  '+254': { dialCode: '+254', nationalLength: 9, mobilePrefixes: ['7', '1'] },
};

export const phoneProfileFor = (dialCode: string): PhoneProfile =>
  STRICT_PROFILES[dialCode] ?? { dialCode };

export interface PhoneResult {
  phone: string;
  /** Set when the value was unusable — the reason, for the review list. */
  issue: string;
  /** Set when the value WAS used but something was changed or discarded. */
  note: string;
}

export function normalisePhone(raw: unknown, profile: PhoneProfile): PhoneResult {
  const s0 = cleanText(raw);
  if (isBlankMarker(s0)) return { phone: '', issue: '', note: '' };

  const parts = s0.split(/[/;,]/).map(p => p.trim()).filter(Boolean);
  const extra = parts.length > 1;
  const s = parts[0] ?? s0;

  const plus = s.startsWith('+') || s.startsWith('00');
  let digits = s.replace(/\D/g, '');
  if (!digits) return { phone: '', issue: `no digits in "${s0}"`, note: '' };
  if (s.startsWith('00')) digits = digits.slice(2);

  const note = extra ? 'extra number(s) in source discarded' : '';
  const cc = profile.dialCode.replace('+', '');

  if (plus) {
    if (digits.startsWith(cc)) {
      digits = digits.slice(cc.length);
    } else {
      // A genuinely foreign number — pass it through rather than force the
      // clinic's own dial code onto it.
      if (digits.length >= 8 && digits.length <= 15) {
        return { phone: '+' + digits, issue: '', note: [note, 'foreign number'].filter(Boolean).join('; ') };
      }
      return { phone: '', issue: `unusable international number "${s0}"`, note: '' };
    }
  } else if (digits.startsWith(cc) && digits.length >= cc.length + 8) {
    digits = digits.slice(cc.length);
  } else if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  const { nationalLength, mobilePrefixes } = profile;

  const count = (n: number) => `${n} digit${n === 1 ? '' : 's'}`;

  if (nationalLength) {
    if (digits.length < nationalLength) {
      return { phone: '', issue: `too short (${count(digits.length)}) — often a client id, not a phone: "${s0}"`, note: '' };
    }
    if (digits.length > nationalLength) {
      return { phone: '', issue: `too long (${count(digits.length)}) — needs a manual fix: "${s0}"`, note: '' };
    }
  } else if (digits.length < 7 || digits.length > 15) {
    return { phone: '', issue: `${count(digits.length)} is not a usable number: "${s0}"`, note: '' };
  }

  if (mobilePrefixes && !mobilePrefixes.some(p => digits.startsWith(p))) {
    return { phone: '', issue: `not a mobile prefix for ${profile.dialCode}: "${s0}"`, note: '' };
  }

  // 0700000000, 0712121212, 070000000 — a filled-in blank, not a number.
  if (new Set(digits).size <= 2 || new Set(digits.slice(-6)).size === 1) {
    return { phone: '', issue: `placeholder / repeated digits: "${s0}"`, note: '' };
  }

  return { phone: profile.dialCode + digits, issue: '', note };
}

// ── email / address ──────────────────────────────────────────────────────────

export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PLACEHOLDER_EMAIL_RE = /^(na|n\/a|-|none|null|noemail|no)@/i;
const PHONE_ONLY_RE = /^[\d\s+()\-]{7,}$/;

export interface EmailAddressResult {
  email: string;
  address: string;
  /** Field-tagged so the preview can highlight the cell the note is about. */
  notes: { field: 'email' | 'address'; message: string }[];
}

/** "jane@gmailcom" -> "jane@gmail.com". Returns '' when it is not salvageable. */
const repairEmail = (v: string): string => {
  if (EMAIL_RE.test(v)) return v;
  const fixed = v.replace(/@(gmail|hotmail|yahoo|outlook|live|icloud)com$/i, '@$1.com');
  return EMAIL_RE.test(fixed) ? fixed : '';
};

/** Legacy rows put an email in the address column and vice versa often enough
 *  that treating the pair together recovers data a per-column pass loses. */
export function normaliseEmailAddress(rawEmail: unknown, rawAddress: unknown): EmailAddressResult {
  const notes: EmailAddressResult['notes'] = [];
  let email = cleanText(rawEmail);
  let address = cleanText(rawAddress);

  if (PLACEHOLDER_EMAIL_RE.test(email) || isBlankMarker(email)) email = '';

  if (email && !EMAIL_RE.test(email)) {
    const fixed = repairEmail(email);
    if (fixed) {
      notes.push({ field: 'email', message: `email typo repaired: "${email}" -> "${fixed}"` });
      email = fixed;
    } else {
      notes.push({ field: 'email', message: `dropped unparseable email "${email}"` });
      email = '';
    }
  }

  if (isBlankMarker(address)) address = '';

  // The address column carrying an email — including a typo'd one, which is how
  // it usually looks once someone has been typing into the wrong box for years.
  const addressAsEmail = address && !address.includes(' ') ? repairEmail(address) : '';
  if (addressAsEmail) {
    if (!email) {
      notes.push(
        address === addressAsEmail
          ? { field: 'address', message: 'email recovered from the address column' }
          : { field: 'address', message: `email recovered and repaired from the address column: "${address}" -> "${addressAsEmail}"` },
      );
      email = addressAsEmail;
    } else {
      notes.push({ field: 'address', message: `dropped a second email in the address column ("${address}")` });
    }
    address = '';
  } else if (address && PHONE_ONLY_RE.test(address)) {
    notes.push({ field: 'address', message: `dropped a stray phone number in the address column ("${address}")` });
    address = '';
  }

  return { email: email.toLowerCase(), address, notes };
}

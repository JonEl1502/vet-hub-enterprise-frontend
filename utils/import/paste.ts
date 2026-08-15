/**
 * Pasted-text parser.
 *
 * The clinic migrating off an old system rarely has a clean CSV — they have
 * whatever the old admin screen let them copy: a block out of Excel, a JSON
 * response lifted from the network tab, a half-formatted table. This reads all
 * three into the same { headers, rows } shape the file path already produces.
 */

import Papa from 'papaparse';

export type PasteSource = 'json-objects' | 'json-rows' | 'delimited';

export interface PastedParse {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
  source: PasteSource;
  /** True when column names had to be invented — the mapper carries the work. */
  synthesizedHeaders: boolean;
}

const cell = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim();

const synthHeaders = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `column_${i + 1}`);

const normaliseHeader = (h: string): string =>
  String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');

const isRowArray = (v: unknown): v is unknown[][] =>
  Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);

/**
 * Does this first line name columns, or is it data?
 *
 * A header row is short, wholly non-numeric, and free of the giveaways of a
 * record: '@', long digit runs. Guessing wrong only costs one row either way,
 * and the mapping step shows the user which it chose.
 */
function looksLikeHeaderRow(cells: string[]): boolean {
  if (!cells.length) return false;
  const filled = cells.filter(c => c !== '');
  if (filled.length < Math.max(2, Math.ceil(cells.length / 2))) return false;
  return filled.every(c =>
    c.length <= 40 &&
    !c.includes('@') &&
    !/\d{4,}/.test(c) &&
    !/^\d+$/.test(c),
  );
}

function fromRowArrays(raw: unknown[][], warnings: string[]): PastedParse {
  const width = raw.reduce((w, r) => Math.max(w, r.length), 0);
  const cells = raw.map(r => Array.from({ length: width }, (_, i) => cell(r[i])));

  let headers: string[];
  let body: string[][];
  let synthesized: boolean;

  if (looksLikeHeaderRow(cells[0])) {
    headers = cells[0].map((h, i) => normaliseHeader(h) || `column_${i + 1}`);
    body = cells.slice(1);
    synthesized = false;
  } else {
    headers = synthHeaders(width);
    body = cells;
    synthesized = true;
    warnings.push('No header row detected — columns were matched by their contents. Check the mapping below.');
  }

  const rows = body
    .map(r => {
      const o: Record<string, string> = {};
      headers.forEach((h, i) => { o[h] = r[i] ?? ''; });
      return o;
    })
    .filter(r => Object.values(r).some(v => v !== ''));

  return { headers, rows, warnings, source: 'json-rows', synthesizedHeaders: synthesized };
}

function fromObjects(raw: Record<string, unknown>[], warnings: string[]): PastedParse {
  const seen: string[] = [];
  for (const o of raw) {
    for (const k of Object.keys(o ?? {})) {
      const h = normaliseHeader(k);
      if (h && !seen.includes(h)) seen.push(h);
    }
  }
  const rows = raw
    .map(o => {
      const out: Record<string, string> = {};
      for (const h of seen) out[h] = '';
      for (const k of Object.keys(o ?? {})) {
        const h = normaliseHeader(k);
        if (h) out[h] = cell((o as Record<string, unknown>)[k]);
      }
      return out;
    })
    .filter(r => Object.values(r).some(v => v !== ''));

  return { headers: seen, rows, warnings, source: 'json-objects', synthesizedHeaders: false };
}

/** Pull the record array out of the common API envelopes before giving up. */
function unwrapJson(parsed: unknown): unknown {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    for (const key of ['data', 'aaData', 'rows', 'records', 'items', 'results']) {
      if (Array.isArray(obj[key])) return obj[key];
    }
    // { data: { rows: [...] } }
    for (const key of ['data', 'result', 'payload']) {
      const inner = obj[key];
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        const found = unwrapJson(inner);
        if (Array.isArray(found)) return found;
      }
    }
  }
  return null;
}

function parseDelimited(text: string, warnings: string[]): PastedParse {
  const res = Papa.parse<string[]>(text.trim(), {
    header: false,
    skipEmptyLines: 'greedy',
  });
  for (const e of res.errors ?? []) {
    if (e.type !== 'FieldMismatch') warnings.push(`Row ${(e.row ?? 0) + 1}: ${e.message}`);
  }
  const raw = (res.data ?? []).filter(r => Array.isArray(r));
  if (!raw.length) throw new Error('Nothing to read — the pasted text has no rows.');
  const out = fromRowArrays(raw as unknown[][], warnings);
  return { ...out, source: 'delimited' };
}

export function parsePasted(text: string): PastedParse {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Paste something first.');

  const warnings: string[] = [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      warnings.push('That looked like JSON but would not parse — read as delimited text instead.');
      return parseDelimited(trimmed, warnings);
    }
    const arr = unwrapJson(parsed);
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error('Found JSON, but no array of records inside it.');
    }
    if (isRowArray(arr)) return fromRowArrays(arr as unknown[][], warnings);
    if (typeof arr[0] === 'object' && arr[0] !== null) {
      return fromObjects(arr as Record<string, unknown>[], warnings);
    }
    throw new Error('Found JSON, but its records are neither objects nor rows.');
  }

  return parseDelimited(trimmed, warnings);
}

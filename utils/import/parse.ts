/**
 * File parsing for bulk imports. Supports CSV (via papaparse) and .xlsx/.xls
 * (via xlsx). Returns normalised { headers, rows } with all row values as strings
 * so downstream validation has a consistent shape.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

const normaliseHeader = (h: string): string =>
  String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normaliseRow = (
  row: Record<string, unknown>,
  headers: string[],
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const h of headers) {
    const v = row[h];
    out[h] = v === null || v === undefined ? '' : String(v).trim();
  }
  return out;
};

export async function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normaliseHeader,
      complete: (result) => {
        const headers = (result.meta.fields ?? []).map(normaliseHeader);
        const rows = (result.data ?? [])
          .map((r) => normaliseRow(r, headers))
          .filter((r) => Object.values(r).some((v) => v.length > 0));
        const warnings = (result.errors ?? []).map(
          (e) => `Row ${e.row ?? '?'}: ${e.message}`,
        );
        resolve({ headers, rows, warnings });
      },
      error: (err) => reject(err),
    });
  });
}

export async function parseXlsx(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], warnings: ['Workbook has no sheets'] };
  }
  const sheet = wb.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: '',
  });

  const rawHeaders = json.length
    ? Object.keys(json[0])
    : XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0 })[0] ?? [];
  const headers = rawHeaders.map(normaliseHeader);

  const rows = json
    .map((r) => {
      // remap keys to normalised headers
      const mapped: Record<string, unknown> = {};
      for (const k of Object.keys(r)) mapped[normaliseHeader(k)] = r[k];
      return normaliseRow(mapped, headers);
    })
    .filter((r) => Object.values(r).some((v) => v.length > 0));

  const warnings: string[] = [];
  if (wb.SheetNames.length > 1) {
    warnings.push(`Only the first sheet ("${firstSheetName}") was imported; ${wb.SheetNames.length - 1} other sheet(s) skipped.`);
  }
  return { headers, rows, warnings };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseXlsx(file);
  throw new Error(`Unsupported file type: ${file.name}. Use .csv, .xlsx, or .xls.`);
}

/** Convert an array of row objects to a CSV string. */
export function rowsToCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  const cols = headers ?? (rows.length ? Object.keys(rows[0]) : []);
  return Papa.unparse({ fields: cols, data: rows.map((r) => cols.map((c) => r[c] ?? '')) });
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

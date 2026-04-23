/**
 * Template generator — builds a CSV from a schema's columns + sample rows so users
 * can download, fill, and upload.
 */

import { EntitySchema } from './schemas';
import { rowsToCsv, downloadCsv } from './parse';

export function buildTemplateCsv(schema: EntitySchema): string {
  const headers = schema.columns.map((c) => c.key);
  const rows = schema.sampleRows.map((r) => {
    const full: Record<string, string> = {};
    for (const h of headers) full[h] = r[h] ?? '';
    return full;
  });
  return rowsToCsv(rows, headers);
}

export function downloadTemplate(schema: EntitySchema): void {
  const csv = buildTemplateCsv(schema);
  downloadCsv(`vethub-${schema.entity}-template.csv`, csv);
}

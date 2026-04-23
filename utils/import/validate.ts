/**
 * Client-side validation — mirrors the backend rules so users see feedback in the
 * preview step before committing. The server revalidates and is the source of truth.
 */

import { EntitySchema, ColumnDef } from './schemas';

export interface RowValidation {
  rowIndex: number;            // 0-based index within the parsed rows
  errors: { field: string; message: string }[];
}

const aliasMap = (col: ColumnDef): string[] => [col.key, ...(col.aliases ?? [])];

const firstValue = (row: Record<string, string>, keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

const isValidDate = (s: string): boolean => {
  const d = new Date(s);
  return !isNaN(d.getTime());
};

const isFiniteNumber = (s: string): boolean => {
  const n = Number(s);
  return Number.isFinite(n);
};

export function validateRow(
  row: Record<string, string>,
  schema: EntitySchema,
  rowIndex: number,
): RowValidation {
  const errors: { field: string; message: string }[] = [];

  for (const col of schema.columns) {
    const value = firstValue(row, aliasMap(col));

    if (!value) {
      if (col.required) {
        errors.push({ field: col.key, message: `${col.label} is required` });
      }
      continue;
    }

    if (col.type === 'date' && !isValidDate(value)) {
      errors.push({ field: col.key, message: `${col.label} is not a valid date` });
    }
    if (col.type === 'number' && !isFiniteNumber(value)) {
      errors.push({ field: col.key, message: `${col.label} must be a number` });
    }
    if (col.type === 'enum' && col.enumValues) {
      const up = value.toUpperCase();
      if (!col.enumValues.includes(up)) {
        errors.push({
          field: col.key,
          message: `${col.label} must be one of: ${col.enumValues.join(', ')}`,
        });
      }
    }
  }

  // Entity-specific cross-field rules.
  if (schema.entity === 'pets') {
    const oe = firstValue(row, ['owner_email', 'ownerEmail']);
    const op = firstValue(row, ['owner_phone', 'ownerPhone']);
    if (!oe && !op) {
      errors.push({
        field: 'owner',
        message: 'owner_email or owner_phone is required',
      });
    }
  }

  return { rowIndex, errors };
}

export function validateRows(
  rows: Record<string, string>[],
  schema: EntitySchema,
): RowValidation[] {
  return rows.map((r, i) => validateRow(r, schema, i));
}

export function countInvalid(validations: RowValidation[]): number {
  return validations.reduce((n, v) => n + (v.errors.length ? 1 : 0), 0);
}

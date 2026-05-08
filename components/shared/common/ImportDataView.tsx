import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  X, Loader2, ArrowLeft, Users, PawPrint, Package, UserCog, RefreshCw,
} from 'lucide-react';
import {
  SCHEMAS,
  ImportEntity,
  EntitySchema,
  getSchema,
} from '../../../utils/import/schemas';
import { parseFile, rowsToCsv, downloadCsv } from '../../../utils/import/parse';
import { downloadTemplate } from '../../../utils/import/template';
import { validateRows, countInvalid, RowValidation } from '../../../utils/import/validate';
import { importsAPI, ImportResult } from '../../../services/modules/imports.api';

const TABS: { entity: ImportEntity; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { entity: 'clients',   label: 'Clients',   icon: Users     },
  { entity: 'pets',      label: 'Pets',      icon: PawPrint  },
  { entity: 'inventory', label: 'Inventory', icon: Package   },
  { entity: 'staff',     label: 'Staff',     icon: UserCog   },
];

interface ImportDataViewProps {
  onBack?: () => void;
  initialEntity?: ImportEntity;
}

const ImportDataView: React.FC<ImportDataViewProps> = ({ onBack, initialEntity = 'clients' }) => {
  const [active, setActive] = useState<ImportEntity>(initialEntity);
  const schema = getSchema(active);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tight">Import data</h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Bring existing clients, pets, inventory, and staff into VetHubCore from a CSV or Excel file.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = t.entity === active;
              return (
                <button
                  key={t.entity}
                  onClick={() => setActive(t.entity)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black whitespace-nowrap transition-colors
                    ${isActive
                      ? 'bg-seafoam text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel — re-keys on tab switch so local state resets */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <EntityImportPanel key={schema.entity} schema={schema} />
      </div>
    </div>
  );
};

// ── Per-entity panel ─────────────────────────────────────────────────────────
const EntityImportPanel: React.FC<{ schema: EntitySchema }> = ({ schema }) => {
  const [file, setFile]             = useState<File | null>(null);
  const [parsing, setParsing]       = useState(false);
  const [rows, setRows]             = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [warnings, setWarnings]     = useState<string[]>([]);
  const [committing, setCommitting] = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);

  const validations = useMemo<RowValidation[]>(
    () => validateRows(rows, schema),
    [rows, schema],
  );
  const invalidCount = countInvalid(validations);
  const validCount   = rows.length - invalidCount;

  const handleFiles = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setParseError(null);
    setWarnings([]);
    setRows([]);
    setParsing(true);
    try {
      const parsed = await parseFile(f);
      setRows(parsed.rows);
      setWarnings(parsed.warnings);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  }, []);

  const reset = () => {
    setFile(null);
    setRows([]);
    setWarnings([]);
    setParseError(null);
    setResult(null);
  };

  const commit = async () => {
    const validRows = rows.filter((_, i) => validations[i].errors.length === 0);
    if (validRows.length === 0) return;
    setCommitting(true);
    try {
      const resp = await importsAPI.commit(schema.entity, validRows);
      setResult(resp.data);
    } catch {
      // axios error handler already surfaces via showError toast
    } finally {
      setCommitting(false);
    }
  };

  // ── result view ────────────────────────────────────────────────────────────
  if (result) return <ResultCard result={result} schemaTitle={schema.title} onReset={reset} />;

  return (
    <>
      {/* Intro + template download */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">{schema.title}</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">{schema.subtitle}</p>
        </div>
        <button
          onClick={() => downloadTemplate(schema)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 text-[13px] font-bold hover:border-seafoam transition-colors shrink-0"
        >
          <Download size={15} />
          Download CSV template
        </button>
      </div>

      {/* Column reference */}
      <ColumnReference schema={schema} />

      {/* Dropzone / Preview */}
      {!file ? (
        <Dropzone onFile={handleFiles} />
      ) : (
        <div className="space-y-4">
          {/* File header */}
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-seafoam/10 text-seafoam grid place-items-center shrink-0">
                <FileSpreadsheet size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {parsing ? 'Parsing…' : `${rows.length} row${rows.length === 1 ? '' : 's'} detected`}
                </p>
              </div>
            </div>
            <button
              onClick={reset}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400"
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          </div>

          {parseError && (
            <Banner tone="error" icon={<AlertTriangle size={16} />}>{parseError}</Banner>
          )}

          {warnings.map((w, i) => (
            <Banner key={i} tone="warn" icon={<AlertTriangle size={16} />}>{w}</Banner>
          ))}

          {!parsing && rows.length > 0 && (
            <>
              <ValidationSummary valid={validCount} invalid={invalidCount} />
              <PreviewTable schema={schema} rows={rows} validations={validations} />

              {/* Commit actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                <button
                  onClick={reset}
                  className="px-5 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 text-[13px] font-bold hover:border-slate-300"
                >
                  Clear
                </button>
                <button
                  onClick={commit}
                  disabled={committing || validCount === 0}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-seafoam text-white text-[13px] font-bold hover:bg-pine transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {committing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Import {validCount} valid {validCount === 1 ? 'row' : 'rows'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

// ── Dropzone ─────────────────────────────────────────────────────────────────
const Dropzone: React.FC<{ onFile: (f: File) => void }> = ({ onFile }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (f: FileList | null) => {
    if (f && f[0]) onFile(f[0]);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files); }}
      className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors
        ${dragOver ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-seafoam/10 text-seafoam grid place-items-center mx-auto mb-4">
        <Upload size={22} />
      </div>
      <p className="text-base font-black text-pine dark:text-zinc-100">Drop your CSV or Excel here</p>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
        Accepts <code className="text-xs">.csv</code>, <code className="text-xs">.xlsx</code>, and <code className="text-xs">.xls</code>
      </p>
      <button
        onClick={() => inputRef.current?.click()}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-seafoam text-white text-[13px] font-bold hover:bg-pine transition-colors"
      >
        Choose file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
};

// ── Column reference ─────────────────────────────────────────────────────────
const ColumnReference: React.FC<{ schema: EntitySchema }> = ({ schema }) => (
  <details className="mb-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
    <summary className="px-4 py-3 cursor-pointer text-[13px] font-bold text-pine dark:text-zinc-100 select-none">
      Column reference ({schema.columns.length} fields)
    </summary>
    <div className="px-4 pb-4 border-t border-slate-100 dark:border-zinc-800 overflow-x-auto">
      <table className="w-full mt-3 text-xs">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="py-2 pr-4 font-bold uppercase tracking-wider">Column</th>
            <th className="py-2 pr-4 font-bold uppercase tracking-wider">Required</th>
            <th className="py-2 pr-4 font-bold uppercase tracking-wider">Example</th>
            <th className="py-2 font-bold uppercase tracking-wider">Notes</th>
          </tr>
        </thead>
        <tbody>
          {schema.columns.map((c) => (
            <tr key={c.key} className="border-t border-slate-100 dark:border-zinc-800">
              <td className="py-2 pr-4 font-mono text-pine dark:text-zinc-100">{c.key}</td>
              <td className="py-2 pr-4">
                {c.required ? (
                  <span className="text-red-500 font-bold">Required</span>
                ) : (
                  <span className="text-slate-400">Optional</span>
                )}
              </td>
              <td className="py-2 pr-4 text-slate-500 dark:text-zinc-400 font-mono">{c.example ?? '—'}</td>
              <td className="py-2 text-slate-500 dark:text-zinc-400">{c.help ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

// ── Validation summary ───────────────────────────────────────────────────────
const ValidationSummary: React.FC<{ valid: number; invalid: number }> = ({ valid, invalid }) => (
  <div className="flex flex-wrap gap-2">
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-xs font-bold">
      <CheckCircle2 size={13} />
      {valid} valid
    </span>
    {invalid > 0 && (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold">
        <AlertTriangle size={13} />
        {invalid} will be skipped
      </span>
    )}
  </div>
);

// ── Preview table ────────────────────────────────────────────────────────────
const PreviewTable: React.FC<{
  schema: EntitySchema;
  rows: Record<string, string>[];
  validations: RowValidation[];
}> = ({ schema, rows, validations }) => {
  const [showAll, setShowAll] = useState(false);
  const MAX = 10;
  const displayRows = showAll ? rows : rows.slice(0, MAX);
  const hasErrors = validations.some((v) => v.errors.length > 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-zinc-800/50">
            <tr className="text-slate-500 dark:text-zinc-400 text-left">
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider w-10">#</th>
              {schema.columns.map((c) => (
                <th key={c.key} className="py-2.5 px-3 font-bold uppercase tracking-wider whitespace-nowrap">
                  {c.label}
                  {c.required && <span className="text-red-500 ml-0.5">*</span>}
                </th>
              ))}
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => {
              const v = validations[i];
              const hasError = v.errors.length > 0;
              const errorFields = new Set(v.errors.map((e) => e.field));
              return (
                <tr
                  key={i}
                  className={`border-t border-slate-100 dark:border-zinc-800 ${hasError ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}
                >
                  <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                  {schema.columns.map((c) => {
                    const val = row[c.key] ?? '';
                    const isErr = errorFields.has(c.key) || (c.key === 'owner_email' && errorFields.has('owner')) || (c.key === 'owner_phone' && errorFields.has('owner'));
                    return (
                      <td
                        key={c.key}
                        className={`py-2 px-3 whitespace-nowrap ${isErr ? 'text-red-600 dark:text-red-400 font-medium' : 'text-pine dark:text-zinc-100'}`}
                      >
                        {val || <span className="text-slate-300 dark:text-zinc-600">—</span>}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 whitespace-nowrap">
                    {hasError ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" title={v.errors.map((e) => e.message).join(', ')}>
                        <AlertTriangle size={12} />
                        {v.errors.length} error{v.errors.length === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 size={12} />
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Errors detail */}
      {hasErrors && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
          Hover the <span className="text-amber-600 font-bold">error count</span> column to see messages.
        </div>
      )}

      {/* Show more */}
      {rows.length > MAX && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 text-center">
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-[13px] font-bold text-seafoam hover:text-pine transition-colors"
          >
            {showAll ? `Show first ${MAX} only` : `Show all ${rows.length} rows`}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Result card (after commit) ───────────────────────────────────────────────
const ResultCard: React.FC<{
  result: ImportResult;
  schemaTitle: string;
  onReset: () => void;
}> = ({ result, schemaTitle, onReset }) => {
  const downloadErrors = () => {
    if (!result.errors.length) return;
    const csv = rowsToCsv(
      result.errors.map((e) => ({ row: e.row, field: e.field ?? '', message: e.message })),
      ['row', 'field', 'message'],
    );
    downloadCsv(`vethub-${result.entity}-import-errors.csv`, csv);
  };

  const allGood = result.failed === 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-2xl mx-auto">
      <div
        className={`w-16 h-16 rounded-2xl mx-auto grid place-items-center mb-5
          ${allGood ? 'bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'}`}
      >
        {allGood ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
      </div>
      <h2 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tight">
        {allGood ? `${schemaTitle} imported.` : 'Imported with some skipped rows.'}
      </h2>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
        <span className="text-green-600 font-bold">{result.created}</span> created
        {result.failed > 0 && (
          <>
            {' · '}
            <span className="text-amber-600 font-bold">{result.failed}</span> skipped
          </>
        )}
        {' · '}
        <span className="text-slate-400">{result.total} submitted</span>
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7">
        {result.errors.length > 0 && (
          <button
            onClick={downloadErrors}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 text-[13px] font-bold hover:border-slate-300"
          >
            <Download size={15} />
            Download error report
          </button>
        )}
        <button
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-seafoam text-white text-[13px] font-bold hover:bg-pine transition-colors"
        >
          <RefreshCw size={15} />
          Import more
        </button>
      </div>
    </div>
  );
};

// ── Banner ───────────────────────────────────────────────────────────────────
const Banner: React.FC<{
  tone: 'warn' | 'error';
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ tone, icon, children }) => {
  const cls =
    tone === 'error'
      ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50'
      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
  return (
    <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border ${cls} text-[13px]`}>
      <span className="mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  );
};

// Ensure unused schema map is tree-reachable.
void SCHEMAS;

export default ImportDataView;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  X, Loader2, ArrowLeft, Users, PawPrint, Package, UserCog, RefreshCw,
  ClipboardPaste, Wand2, ArrowRight, Pencil, Trash2,
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
import { parsePasted, PastedParse } from '../../../utils/import/paste';
import {
  autoMatch, applyMapping, buildTargets,
  Mapping, RowIssue, TargetDef, FULL_NAME,
} from '../../../utils/import/match';
import { COUNTRIES } from '../../../utils/countries';
import { importsAPI, ImportResult } from '../../../services/modules/imports.api';
import ManagingSwitcher from './ManagingSwitcher';

const CLINIC_TABS: { entity: ImportEntity; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { entity: 'clients',   label: 'Clients',   icon: Users     },
  { entity: 'pets',      label: 'Pets',      icon: PawPrint  },
  { entity: 'inventory', label: 'Inventory', icon: Package   },
  { entity: 'staff',     label: 'Staff',     icon: UserCog   },
];

// A supplier has no clients, pets or clinic staff — only a catalogue. Showing
// the clinic tabs to a supplier would offer four imports that cannot succeed:
// they are scoped to a clinic id the account does not have.
const SUPPLIER_TABS: typeof CLINIC_TABS = [
  { entity: 'supplier-products', label: 'Products', icon: Package },
];

interface ImportDataViewProps {
  onBack?: () => void;
  initialEntity?: ImportEntity;
  /** Which catalogue of importers to offer. Defaults to the clinic's. */
  audience?: 'clinic' | 'supplier';
}

const ImportDataView: React.FC<ImportDataViewProps> = ({ onBack, initialEntity, audience = 'clinic' }) => {
  const TABS = audience === 'supplier' ? SUPPLIER_TABS : CLINIC_TABS;
  // Default follows the audience — a supplier has only one importer, and
  // defaulting to 'clients' would open a tab that is not in their TABS list.
  const [active, setActive] = useState<ImportEntity>(
    initialEntity ?? (audience === 'supplier' ? 'supplier-products' : 'clients'),
  );
  const schema = getSchema(active);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="mb-4"><ManagingSwitcher kind="clinic" /></div>
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
                {audience === 'supplier'
                  ? 'Bring your product catalogue into VetHubCore from a CSV or Excel file, or paste it straight in. Image, manufacturer, pack size and the subcategory path all flow to a clinic when they receive a purchase order.'
                  : 'Bring existing clients, pets, inventory, and staff into VetHubCore — upload a CSV or Excel file, or paste rows straight out of your old system and we will match them to the template.'}
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
type SourceMode = 'file' | 'paste';

const EntityImportPanel: React.FC<{ schema: EntitySchema }> = ({ schema }) => {
  const [mode, setMode]             = useState<SourceMode>('file');
  const [file, setFile]             = useState<File | null>(null);
  const [parsing, setParsing]       = useState(false);
  const [rows, setRows]             = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [warnings, setWarnings]     = useState<string[]>([]);
  const [committing, setCommitting] = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);

  // Paste flow only — the mapping step sits between the raw text and the rows.
  const [pasteText, setPasteText]   = useState('');
  const [pasted, setPasted]         = useState<PastedParse | null>(null);
  const [mapping, setMapping]       = useState<Mapping>({});
  const [issues, setIssues]         = useState<RowIssue[][]>([]);
  const [skipped, setSkipped]       = useState(0);
  const [countryCode, setCountryCode] = useState('KE');

  const validations = useMemo<RowValidation[]>(
    () => validateRows(rows, schema),
    [rows, schema],
  );
  const invalidCount = countInvalid(validations);
  const validCount   = rows.length - invalidCount;

  /**
   * Did they upload the right FILE for this tab?
   *
   * The panel validated whatever it was handed against whatever tab was open,
   * so dropping the inventory file on the Clients tab produced 114 rows of
   * "3 errors" — first name, surname and phone missing — with nothing saying
   * the file was simply in the wrong place (user, 2026-08-05). Every row
   * failing the same required fields is the signature of that mistake, not of
   * a bad file.
   *
   * Heuristic, deliberately: match the file's headers against each schema's
   * known keys + aliases, and speak up only when ANOTHER entity is a clearly
   * better fit. A file with extra or missing columns still imports.
   */
  const entityMismatch = useMemo<{ better: EntitySchema; hit: number; own: number } | null>(() => {
    if (rows.length === 0) return null;
    const headers = Object.keys(rows[0] ?? {}).map(h => h.trim().toLowerCase());
    if (headers.length === 0) return null;
    const score = (sch: EntitySchema) => {
      const keys = new Set<string>();
      for (const c of sch.columns) {
        keys.add(c.key.toLowerCase());
        for (const a of c.aliases ?? []) keys.add(a.toLowerCase());
      }
      return headers.filter(h => keys.has(h)).length;
    };
    const own = score(schema);
    let better: EntitySchema | null = null;
    let hit = own;
    for (const other of Object.values(SCHEMAS)) {
      if (other.entity === schema.entity) continue;
      const s = score(other);
      // A clear margin, not a tie — sibling schemas share name/phone/email.
      if (s > hit && s >= own + 3) { better = other; hit = s; }
    }
    return better ? { better, hit, own } : null;
  }, [rows, schema]);

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
    setPasteText('');
    setPasted(null);
    setMapping({});
    setIssues([]);
    setSkipped(0);
  };

  const country = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];

  /** Paste step 1 — read the text and guess the mapping. Nothing is cleaned yet. */
  const readPaste = () => {
    setParseError(null);
    setWarnings([]);
    setRows([]);
    setIssues([]);
    try {
      const p = parsePasted(pasteText);
      if (!p.rows.length) throw new Error('No data rows found in that paste.');
      setPasted(p);
      setWarnings(p.warnings);
      setMapping(autoMatch(p.headers, p.rows, schema));
    } catch (e: unknown) {
      setPasted(null);
      setParseError(e instanceof Error ? e.message : 'Could not read the pasted data');
    }
  };

  /** Paste step 2 — clean into template columns using the (possibly edited) mapping. */
  const runMapping = useCallback((m: Mapping) => {
    if (!pasted) return;
    const res = applyMapping(pasted.rows, m, schema, {
      dialCode: country.dialCode,
      country: schema.columns.some(c => c.key === 'country') ? country.name : undefined,
      currency: schema.columns.some(c => c.key === 'currency') ? country.currency : undefined,
    });
    setRows(res.rows);
    setIssues(res.issues);
    setSkipped(res.skipped);
  }, [pasted, schema, country]);

  const updateCell = (rowIdx: number, key: string, value: string) => {
    setRows(prev => prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)));
  };

  const deleteRow = (rowIdx: number) => {
    setRows(prev => prev.filter((_, i) => i !== rowIdx));
    setIssues(prev => prev.filter((_, i) => i !== rowIdx));
  };

  const downloadCleaned = () => {
    const cols = schema.columns.map(c => c.key);
    downloadCsv(`vethub-${schema.entity}-cleaned.csv`, rowsToCsv(rows, cols));
  };

  const downloadReview = () => {
    const flat = issues.flatMap((rowIssues, i) =>
      rowIssues.map(is => ({
        row: String(i + 1),
        name: [rows[i]?.first_name, rows[i]?.surname].filter(Boolean).join(' ') || rows[i]?.name || '',
        field: is.field,
        action: is.severity,
        issue: is.message,
      })),
    );
    if (!flat.length) return;
    downloadCsv(
      `vethub-${schema.entity}-review.csv`,
      rowsToCsv(flat, ['row', 'name', 'field', 'action', 'issue']),
    );
  };

  // Re-clean whenever the mapping, the source text, or the country changes.
  // Cell edits are deliberately NOT a trigger — remapping regenerates rows and
  // would throw the user's corrections away on every keystroke.
  useEffect(() => { runMapping(mapping); }, [mapping, runMapping]);

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

      {/* Where the data is coming from */}
      <div className="flex gap-1 mb-4 p-1 bg-slate-100 dark:bg-zinc-800/60 rounded-xl w-fit">
        {([
          { key: 'file',  label: 'Upload a file', icon: FileSpreadsheet },
          { key: 'paste', label: 'Paste data',    icon: ClipboardPaste  },
        ] as { key: SourceMode; label: string; icon: React.ComponentType<{ size?: number }> }[]).map(m => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => { if (m.key !== mode) { reset(); setMode(m.key); } }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-colors
                ${mode === m.key
                  ? 'bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-200'}`}
            >
              <Icon size={15} />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {/* ── Source input ────────────────────────────────────────────────── */}
        {mode === 'file' && !file && <Dropzone onFile={handleFiles} />}

        {mode === 'file' && file && (
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
        )}

        {mode === 'paste' && !pasted && (
          <PastePanel
            text={pasteText}
            onChange={setPasteText}
            onRead={readPaste}
          />
        )}

        {mode === 'paste' && pasted && (
          <MappingEditor
            schema={schema}
            pasted={pasted}
            mapping={mapping}
            onChange={setMapping}
            countryCode={countryCode}
            onCountryChange={setCountryCode}
            onStartOver={reset}
            skipped={skipped}
          />
        )}

        {/* ── Feedback ────────────────────────────────────────────────────── */}
        {parseError && (
          <Banner tone="error" icon={<AlertTriangle size={16} />}>{parseError}</Banner>
        )}

        {warnings.map((w, i) => (
          <Banner key={i} tone="warn" icon={<AlertTriangle size={16} />}>{w}</Banner>
        ))}

        {/* ── Review + edit ───────────────────────────────────────────────── */}
        {!parsing && rows.length > 0 && (
          <>
            {/* Wrong tab, not a bad file — say so before the user starts
                hunting for 114 identical validation errors. */}
            {mode === 'file' && entityMismatch && (
              <Banner tone="warn" icon={<AlertTriangle size={16} />}>
                This file looks like <strong>{entityMismatch.better.title}</strong> data, not{' '}
                <strong>{schema.title}</strong> — {entityMismatch.hit} of its columns match{' '}
                {entityMismatch.better.title}
                {entityMismatch.own > 0 ? `, against ${entityMismatch.own} here` : ''}. Open the{' '}
                <strong>{entityMismatch.better.title}</strong> tab and upload it there, or carry on
                if this is deliberate.
              </Banner>
            )}

            <ValidationSummary
              valid={validCount}
              invalid={invalidCount}
              repaired={issues.filter(r => r.length > 0).length}
            />

            <EditableTable
              schema={schema}
              rows={rows}
              validations={validations}
              issues={issues}
              onEdit={updateCell}
              onDelete={deleteRow}
            />

            {/* Commit actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
              <button
                onClick={reset}
                className="px-5 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 text-[13px] font-bold hover:border-slate-300"
              >
                Clear
              </button>
              <button
                onClick={downloadCleaned}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 text-[13px] font-bold hover:border-slate-300"
              >
                <Download size={15} />
                Cleaned CSV
              </button>
              {issues.some(r => r.length > 0) && (
                <button
                  onClick={downloadReview}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 text-[13px] font-bold hover:border-slate-300"
                >
                  <Download size={15} />
                  Review list
                </button>
              )}
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
    </>
  );
};

// ── Paste panel ──────────────────────────────────────────────────────────────
const PastePanel: React.FC<{
  text: string;
  onChange: (v: string) => void;
  onRead: () => void;
}> = ({ text, onChange, onRead }) => (
  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-seafoam/10 text-seafoam grid place-items-center shrink-0">
        <ClipboardPaste size={18} />
      </div>
      <div>
        <p className="text-sm font-black text-pine dark:text-zinc-100">Paste whatever you have</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">
          Rows copied out of Excel or Google Sheets, a CSV, or a JSON export from your old
          system. Column names are optional — VetHubCore works out which column is which,
          shows you its guess, and lets you fix every value before anything is saved.
        </p>
      </div>
    </div>

    <textarea
      value={text}
      onChange={(e) => onChange(e.target.value)}
      rows={10}
      spellCheck={false}
      placeholder={'Mrs. Jane Wanjiru Ng\'ang\'a\t0722123456\tjane@example.com\tKilimani, Nairobi\nDr.stephen Mwangi\t+254733000111\t\tKaren\n\n…or paste a JSON export straight from the old system.'}
      className="w-full font-mono text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-pine dark:text-zinc-100 p-3 focus:outline-none focus:ring-2 focus:ring-seafoam/40 resize-y"
    />

    <div className="flex items-center justify-between gap-3 mt-4">
      <p className="text-xs text-slate-400">
        {text.trim() ? `${text.trim().split(/\r?\n/).length} line(s)` : 'Nothing pasted yet'}
      </p>
      <button
        onClick={onRead}
        disabled={!text.trim()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-seafoam text-white text-[13px] font-bold hover:bg-pine transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wand2 size={15} />
        Format &amp; match
      </button>
    </div>
  </div>
);

// ── Mapping editor ───────────────────────────────────────────────────────────
const MappingEditor: React.FC<{
  schema: EntitySchema;
  pasted: PastedParse;
  mapping: Mapping;
  onChange: (m: Mapping) => void;
  countryCode: string;
  onCountryChange: (c: string) => void;
  onStartOver: () => void;
  skipped: number;
}> = ({ schema, pasted, mapping, onChange, countryCode, onCountryChange, onStartOver, skipped }) => {
  const targets: TargetDef[] = useMemo(() => buildTargets(schema), [schema]);
  const hasPhone = schema.columns.some(c => c.key === 'phone' || c.key.endsWith('_phone'));

  // A column already spoken for shouldn't be offered twice — silently feeding
  // one source column into two template columns is never what was meant.
  const takenBy = (header: string) =>
    Object.entries(mapping).find(([, h]) => h === header)?.[0];

  const set = (target: string, header: string) => {
    const next = { ...mapping };
    if (header) {
      for (const k of Object.keys(next)) if (next[k] === header) next[k] = '';
    }
    next[target] = header;
    // The combined name column and the split parts are alternatives, not both.
    if (target === FULL_NAME && header) {
      for (const k of ['first_name', 'second_name', 'surname', 'title']) {
        if (next[k] !== undefined) next[k] = '';
      }
    }
    if (['first_name', 'surname'].includes(target) && header && next[FULL_NAME]) {
      next[FULL_NAME] = '';
    }
    onChange(next);
  };

  const previewOf = (header: string) => {
    if (!header) return '';
    const v = pasted.rows.find(r => (r[header] ?? '').trim())?.[header] ?? '';
    return v.length > 42 ? v.slice(0, 42) + '…' : v;
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  /**
   * A name part is NOT missing just because no source column points at it — the
   * combined name column fills it. Counting it as unmapped put a red border on
   * First name and Surname and warned they were required while every row in the
   * table below plainly had both.
   */
  const filledByFullName = (key: string) =>
    !!mapping[FULL_NAME] && ['title', 'first_name', 'second_name', 'surname'].includes(key);
  const isSatisfied = (t: TargetDef) => !!mapping[t.key] || filledByFullName(t.key);
  const unmappedRequired = targets.filter(t => t.required && !isSatisfied(t));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-black text-pine dark:text-zinc-100">
            Column matching
            <span className="ml-2 text-xs font-bold text-slate-400">
              {pasted.rows.length} row{pasted.rows.length === 1 ? '' : 's'} read · {mappedCount} column{mappedCount === 1 ? '' : 's'} matched
              {skipped > 0 ? ` · ${skipped} blank row${skipped === 1 ? '' : 's'} dropped` : ''}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">
            {pasted.synthesizedHeaders
              ? 'Your paste had no header row, so columns were matched by what they contain. Check each one.'
              : 'Matched from your column names. Change anything that landed in the wrong place.'}
          </p>
        </div>
        <button
          onClick={onStartOver}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold text-slate-500 hover:text-pine dark:hover:text-zinc-100"
        >
          <X size={14} />
          Paste something else
        </button>
      </div>

      {hasPhone && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
          <label className="text-xs font-bold text-pine dark:text-zinc-100">Numbers are local to</label>
          <select
            value={countryCode}
            onChange={(e) => onCountryChange(e.target.value)}
            className="field-select text-xs py-1.5 w-auto"
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dialCode})</option>
            ))}
          </select>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            0722… becomes {COUNTRIES.find(c => c.code === countryCode)?.dialCode}722…; numbers already
            carrying another country code are left alone.
          </span>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {targets.map(t => {
          const header = mapping[t.key] ?? '';
          const preview = previewOf(header);
          return (
            <div
              key={t.key}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
                ${t.required && !isSatisfied(t)
                  ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20'
                  : 'border-slate-100 dark:border-zinc-800'}`}
            >
              <select
                value={header}
                onChange={(e) => set(t.key, e.target.value)}
                className="field-select text-xs py-1.5 flex-1 min-w-0"
              >
                <option value="">
                  {filledByFullName(t.key) ? '— split from the full name —' : '— not in my data —'}
                </option>
                {pasted.headers.map(h => {
                  const owner = takenBy(h);
                  return (
                    <option key={h} value={h}>
                      {h}{owner && owner !== t.key ? ' (in use)' : ''}
                    </option>
                  );
                })}
              </select>
              <ArrowRight size={13} className="text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-pine dark:text-zinc-100 truncate">
                  {t.label}
                  {t.required && <span className="text-red-500 ml-0.5">*</span>}
                </p>
                {preview && (
                  <p className="text-slate-400 truncate font-mono text-[11px]">{preview}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unmappedRequired.length > 0 && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-bold">
          {unmappedRequired.map(t => t.label).join(', ')} {unmappedRequired.length === 1 ? 'is' : 'are'} required —
          match {unmappedRequired.length === 1 ? 'it' : 'them'} above, or fill the column in by hand in the table below.
        </p>
      )}
    </div>
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
const ValidationSummary: React.FC<{ valid: number; invalid: number; repaired?: number }> = ({
  valid, invalid, repaired = 0,
}) => (
  <div className="flex flex-wrap gap-2">
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-xs font-bold">
      <CheckCircle2 size={13} />
      {valid} ready to import
    </span>
    {invalid > 0 && (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold">
        <AlertTriangle size={13} />
        {invalid} need{invalid === 1 ? 's' : ''} a fix — edit or they are skipped
      </span>
    )}
    {repaired > 0 && (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 text-xs font-bold">
        <Wand2 size={13} />
        {repaired} cleaned up — worth a look
      </span>
    )}
  </div>
);

// ── Editable preview table ───────────────────────────────────────────────────
/**
 * The preview used to be read-only, which meant a single bad phone number sent
 * the user back to Excel and round the whole loop again. Every cell is an input
 * here: a row that arrives broken can be fixed where it is shown, and the valid
 * count updates as it is typed.
 */
const EditableTable: React.FC<{
  schema: EntitySchema;
  rows: Record<string, string>[];
  validations: RowValidation[];
  issues: RowIssue[][];
  onEdit: (rowIdx: number, key: string, value: string) => void;
  onDelete: (rowIdx: number) => void;
}> = ({ schema, rows, validations, issues, onEdit, onDelete }) => {
  const [showAll, setShowAll] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const MAX = 25;

  const hasProblem = (i: number) =>
    (validations[i]?.errors.length ?? 0) > 0 || (issues[i]?.length ?? 0) > 0;

  // Keep the ORIGINAL index alongside — edits and deletes address the real row,
  // not its position in a filtered view.
  const indexed = rows.map((row, i) => ({ row, i }));
  const filtered = problemsOnly ? indexed.filter(({ i }) => hasProblem(i)) : indexed;
  const display = showAll ? filtered : filtered.slice(0, MAX);
  const problemCount = indexed.filter(({ i }) => hasProblem(i)).length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
        <p className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
          <Pencil size={13} />
          Click any cell to correct it before importing
        </p>
        {problemCount > 0 && (
          <label className="inline-flex items-center gap-2 text-xs font-bold text-pine dark:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={problemsOnly}
              onChange={(e) => setProblemsOnly(e.target.checked)}
              className="rounded border-slate-300 text-seafoam focus:ring-seafoam"
            />
            Show only the {problemCount} row{problemCount === 1 ? '' : 's'} needing attention
          </label>
        )}
      </div>

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
              <th className="py-2.5 px-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {display.map(({ row, i }) => {
              const v = validations[i];
              const rowIssues = issues[i] ?? [];
              const hasError = (v?.errors.length ?? 0) > 0;
              const errorFields = new Set((v?.errors ?? []).map((e) => e.field));
              const issueFields = new Set(rowIssues.map((is) => is.field));
              return (
                <tr
                  key={i}
                  className={`border-t border-slate-100 dark:border-zinc-800 ${hasError ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}
                >
                  <td className="py-1.5 px-3 text-slate-400 align-middle">{i + 1}</td>
                  {schema.columns.map((c) => {
                    const isErr =
                      errorFields.has(c.key) ||
                      (c.key === 'owner_email' && errorFields.has('owner')) ||
                      (c.key === 'owner_phone' && errorFields.has('owner'));
                    const wasRepaired = issueFields.has(c.key);
                    const issueText = rowIssues
                      .filter((is) => is.field === c.key)
                      .map((is) => is.message)
                      .join('\n');
                    return (
                      <td key={c.key} className="py-1.5 px-1.5 align-middle">
                        <input
                          value={row[c.key] ?? ''}
                          onChange={(e) => onEdit(i, c.key, e.target.value)}
                          title={issueText || undefined}
                          placeholder={c.required ? 'Required' : '—'}
                          className={`w-36 px-2 py-1.5 rounded-lg border bg-transparent text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-seafoam/40
                            ${isErr
                              ? 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 placeholder:text-red-400/70'
                              : wasRepaired
                                ? 'border-sky-200 dark:border-sky-900 text-pine dark:text-zinc-100'
                                : 'border-transparent hover:border-slate-200 dark:hover:border-zinc-700 text-pine dark:text-zinc-100 placeholder:text-slate-300 dark:placeholder:text-zinc-600'}`}
                        />
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-3 whitespace-nowrap align-middle">
                    {hasError ? (
                      <span
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                        title={v.errors.map((e) => e.message).join('\n')}
                      >
                        <AlertTriangle size={12} />
                        {v.errors.length} to fix
                      </span>
                    ) : rowIssues.length ? (
                      <span
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400"
                        title={rowIssues.map((is) => `${is.field}: ${is.message}`).join('\n')}
                      >
                        <Wand2 size={12} />
                        cleaned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 size={12} />
                        OK
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 align-middle">
                    <button
                      onClick={() => onDelete(i)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      aria-label={`Remove row ${i + 1}`}
                      title="Remove this row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {problemCount > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
          Hover a highlighted cell or the <span className="font-bold">Status</span> column to see what was
          wrong or what changed. Rows still showing errors are left behind, not imported.
        </div>
      )}

      {filtered.length > MAX && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 text-center">
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-[13px] font-bold text-seafoam hover:text-pine transition-colors"
          >
            {showAll ? `Show first ${MAX} only` : `Show all ${filtered.length} rows`}
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

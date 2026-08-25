import React from 'react';
import toast from 'react-hot-toast';
import {
  Upload, ClipboardPaste, FileSpreadsheet, Loader2, X, AlertTriangle,
  CheckCircle2, ArrowRight,
} from 'lucide-react';
import demoRequestsAPI, { LeadImportRow } from '../../../services/modules/demoRequests.api';
import { parseFile, listSheetNames, ParsedFile } from '../../../utils/import/parse';
import { parsePasted } from '../../../utils/import/paste';
import { mapLeadRows, looksLikeLeads, FIELD_LABELS, MappedSheet } from './leadSheetMapping';

/**
 * Import a researched prospect list into the "Potential clients" queue.
 *
 * Two ways in because people have the list in two states: the file as exported,
 * and a selection copied out of the sheet they are already looking at (user,
 * 2026-08-25: *"allow upload n paste too"*). Both land in the same
 * `{ headers, rows }` shape and share every step after it.
 *
 * ⚠️ Nothing is sent until the preview has been seen. An import that silently
 * accepted the wrong sheet would put 22 rows of headline figures in the sales
 * queue, and un-importing is a database job.
 */

interface Props {
  onClose: () => void;
  /** Fired after a successful import so the queue behind reloads. */
  onImported: () => void;
}

type Mode = 'file' | 'paste';

const LeadImportModal: React.FC<Props> = ({ onClose, onImported }) => {
  const [mode, setMode] = React.useState<Mode>('file');
  const [file, setFile] = React.useState<File | null>(null);
  const [sheets, setSheets] = React.useState<string[]>([]);
  const [sheet, setSheet] = React.useState<string>('');
  const [text, setText] = React.useState('');
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null);
  const [mapped, setMapped] = React.useState<MappedSheet | null>(null);
  const [reading, setReading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [result, setResult] = React.useState<{ created: number; updated: number; skipped: { row: number; reason: string }[] } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const reset = () => { setParsed(null); setMapped(null); setError(null); };

  const ingest = React.useCallback((p: ParsedFile) => {
    setParsed(p);
    const m = mapLeadRows(p.headers, p.rows);
    setMapped(m);
    if (!m.rows.length) {
      setError(
        looksLikeLeads(p.headers)
          ? 'Those columns were recognised, but no row had a business or contact name in it.'
          : 'No lead columns recognised here. Expected headings like "Business / Facility", "Email", "Phone", "Town".',
      );
    } else setError(null);
  }, []);

  /**
   * Read a workbook. The lead database opens on a "Summary" tab of headline
   * figures, so preferring the first sheet that actually looks like leads saves
   * the user a step — and getting it wrong is a dropdown away.
   */
  const readFile = React.useCallback(async (f: File, wanted?: string) => {
    setReading(true); reset();
    try {
      const names = await listSheetNames(f);
      setSheets(names);
      let target = wanted;
      if (!target && names.length > 1) {
        for (const n of names) {
          const probe = await parseFile(f, n);
          if (looksLikeLeads(probe.headers) && probe.rows.length) { target = n; break; }
        }
      }
      const chosen = target || names[0] || '';
      setSheet(chosen);
      ingest(await parseFile(f, chosen || undefined));
    } catch (e: any) {
      setError(e?.message || 'That file could not be read.');
      setParsed(null); setMapped(null);
    } finally { setReading(false); }
  }, [ingest]);

  const onPick = (f: File | null) => {
    if (!f) return;
    setFile(f); setResult(null);
    readFile(f);
  };

  const onPasteChange = (v: string) => {
    setText(v); setResult(null);
    if (!v.trim()) { reset(); return; }
    try { ingest(parsePasted(v)); }
    catch (e: any) { setError(e?.message || 'That could not be read.'); setParsed(null); setMapped(null); }
  };

  const doImport = async () => {
    if (!mapped?.rows.length) return;
    setBusy(true);
    try {
      const res = await demoRequestsAPI.importLeads(mapped.rows as LeadImportRow[]);
      if (res.success && res.data) {
        setResult({ created: res.data.created, updated: res.data.updated, skipped: res.data.skipped || [] });
        toast.success(`${res.data.created} added, ${res.data.updated} updated`);
        onImported();
      }
    } catch { /* the API layer surfaces its own error */ }
    finally { setBusy(false); }
  };

  const withEmail = mapped?.rows.filter(r => r.email).length ?? 0;
  const preview = mapped?.rows.slice(0, 5) ?? [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Import</p>
            <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">Potential clients</h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Upload your research file or paste rows out of it. Columns are matched by their headings, so
              a differently-arranged list still works.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-pine shrink-0"><X size={16} /></button>
        </div>

        {/* ── Done ──────────────────────────────────────────────────────── */}
        {result ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Imported
              </p>
              <p className="text-sm font-black text-pine dark:text-zinc-100 mt-1">
                {result.created} added{result.updated ? `, ${result.updated} updated` : ''}
              </p>
              {!!result.updated && (
                <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1">
                  Updated rows kept their status, notes and contact history — only the researched details changed.
                </p>
              )}
            </div>
            {!!result.skipped.length && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {result.skipped.length} skipped
                </p>
                {result.skipped.slice(0, 8).map(s => (
                  <p key={s.row} className="text-[11px] text-slate-600 dark:text-zinc-300">Row {s.row}: {s.reason}</p>
                ))}
                {result.skipped.length > 8 && (
                  <p className="text-[10px] text-slate-400">…and {result.skipped.length - 8} more</p>
                )}
              </div>
            )}
            <button onClick={onClose} className="w-full py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest">Done</button>
          </div>
        ) : (
          <>
            {/* ── Source ──────────────────────────────────────────────────── */}
            <div className="flex gap-2">
              {([['file', 'Upload a file', Upload], ['paste', 'Paste rows', ClipboardPaste]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); reset(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                    mode === m
                      ? 'bg-seafoam text-white border-seafoam'
                      : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>

            {mode === 'file' ? (
              <div className="space-y-2">
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); onPick(e.dataTransfer.files?.[0] ?? null); }}
                  onClick={() => fileRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                    dragging ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'
                  }`}
                >
                  <FileSpreadsheet size={20} className="mx-auto text-slate-400" />
                  <p className="text-[11px] font-bold text-pine dark:text-zinc-100 mt-2">
                    {file ? file.name : 'Drop your .xlsx or .csv here, or click to choose'}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">xlsx · xls · csv</p>
                </div>
                <input
                  ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => onPick(e.target.files?.[0] ?? null)}
                />
                {/* A workbook's first tab is usually a summary, not the data. */}
                {sheets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Sheet</label>
                    <select
                      value={sheet}
                      onChange={e => { setSheet(e.target.value); if (file) readFile(file, e.target.value); }}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 outline-none"
                    >
                      {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={text}
                onChange={e => onPasteChange(e.target.value)}
                rows={7}
                placeholder={'Paste rows copied from your spreadsheet — include the header row.\n\nLead ID\tBusiness / Facility\tCountry\tTown / Area\tPhone\tEmail\nCL-0001\tThe Andys Veterinary Hospital\tKenya\tLoresho\t+254 713 036765\tinfo@andysvetclinic.com'}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[11px] font-mono text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
              />
            )}

            {reading && (
              <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={18} /></div>
            )}

            {error && (
              <div className="flex gap-2 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 p-3">
                <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 dark:text-zinc-300">{error}</p>
              </div>
            )}

            {/* ── Preview ─────────────────────────────────────────────────── */}
            {mapped && mapped.rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p className="text-sm font-black text-pine dark:text-zinc-100">
                    {mapped.rows.length} lead{mapped.rows.length === 1 ? '' : 's'} ready
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {withEmail} with an email
                  </span>
                  {mapped.rows.length - withEmail > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                      {mapped.rows.length - withEmail} without — add one when you convert
                    </span>
                  )}
                  {!!mapped.skipped && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {mapped.skipped} row{mapped.skipped === 1 ? '' : 's'} had no name, ignored
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 dark:bg-zinc-950">
                      <tr>
                        {['Business', 'Where', 'Email', 'Phone', 'Score'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-zinc-800">
                          <td className="px-3 py-1.5 font-bold text-pine dark:text-zinc-100">{r.clinicName || r.name}</td>
                          <td className="px-3 py-1.5 text-slate-500 dark:text-zinc-400">{[r.town, r.country].filter(Boolean).join(', ') || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-500 dark:text-zinc-400">{r.email || <span className="text-amber-600">none</span>}</td>
                          <td className="px-3 py-1.5 text-slate-500 dark:text-zinc-400">{r.phone || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-500 dark:text-zinc-400">{r.leadScore ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mapped.rows.length > preview.length && (
                    <p className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 dark:border-zinc-800">
                      …and {mapped.rows.length - preview.length} more
                    </p>
                  )}
                </div>

                {/* Which heading fed which field — the one thing worth checking
                    before committing, and cheaper to show than to debug after. */}
                <details className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
                  <summary className="text-[9px] font-black uppercase tracking-widest text-slate-400 cursor-pointer">
                    Columns read ({mapped.matched.length}){mapped.ignored.length ? ` · ${mapped.ignored.length} ignored` : ''}
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mapped.matched.map(m => (
                      <span key={m.field} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                        {m.header} <ArrowRight size={9} /> {FIELD_LABELS[m.field] || m.field}
                      </span>
                    ))}
                  </div>
                  {!!mapped.ignored.length && (
                    <p className="mt-2 text-[10px] text-slate-400">
                      Ignored: {mapped.ignored.join(', ')}
                    </p>
                  )}
                </details>

                <p className="text-[10px] text-slate-400">
                  Re-importing a corrected list updates the same leads instead of duplicating them, and never
                  overwrites their status, notes or contact history.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
              <button
                onClick={doImport}
                disabled={busy || !mapped?.rows.length}
                className="flex-1 py-2 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {busy
                  ? <><Loader2 size={12} className="animate-spin" /> Importing…</>
                  : `Import ${mapped?.rows.length || ''}`.trim()}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LeadImportModal;

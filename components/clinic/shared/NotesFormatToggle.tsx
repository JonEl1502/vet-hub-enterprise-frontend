import React from 'react';

/**
 * Paragraph / Bullets toggle for a record's findings-notes. Rendered directly
 * ABOVE the note/findings text area it formats (not buried in the control row),
 * so the choice sits next to what it affects.
 */
const NotesFormatToggle: React.FC<{ value: string; onChange: (v: string) => void; className?: string }> = ({ value, onChange, className = '' }) => (
  <div className={className}>
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Notes format</p>
    <div className="flex gap-2">
      {['PARAGRAPH', 'BULLET'].map(f => (
        <button key={f} type="button" onClick={() => onChange(f)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${(value || 'PARAGRAPH') === f ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>
          {f === 'BULLET' ? 'Bullets' : 'Paragraph'}
        </button>
      ))}
    </div>
  </div>
);

/**
 * Renders a note/findings string honoring its displayFormat — a bulleted list
 * when BULLET (one bullet per line), otherwise a wrapped paragraph. Keeps the
 * drawer display in sync with the NotesFormatToggle choice (and the client view).
 */
export const FormattedNotes: React.FC<{ text?: string | null; format?: string; className?: string }> = ({ text, format, className = '' }) => {
  if (!text || !text.trim()) return <p className={`text-sm text-slate-400 dark:text-zinc-500 ${className}`}>—</p>;
  if ((format || 'PARAGRAPH') === 'BULLET') {
    // One bullet per line AND per sentence: a full stop followed by
    // whitespace starts a new bullet (decimals like "1.5" stay intact).
    const items = text
      .split(/\n+/)
      .flatMap(line => line.split(/\.\s+/).map((s, i, arr) => (i < arr.length - 1 ? `${s.trim()}.` : s.trim())))
      .map(s => s.replace(/^[-•*]\s*/, '').replace(/\s+\./g, '.').trim())
      .filter(Boolean);
    return <ul className={`list-disc pl-5 space-y-0.5 text-sm text-pine dark:text-zinc-200 ${className}`}>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
  }
  return <p className={`text-sm text-pine dark:text-zinc-200 whitespace-pre-wrap ${className}`}>{text}</p>;
};

export default NotesFormatToggle;

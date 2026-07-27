/**
 * Internal manual — SUPER_ADMIN only, read in-app.
 *
 * Presented as a bound document (contents rail + paged sections) rather than a
 * file, because the intent is that it stays here. Print is suppressed and text
 * selection is discouraged, but see the banner: that is a deterrent, not a
 * control. Anything the browser renders can be screenshotted. The honest
 * protection is the SUPER_ADMIN gate on the endpoint.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BookLock, Loader2, Search, ChevronRight, ShieldAlert, FileText } from 'lucide-react';
import { get } from '../../../services/api/client';
import AdminPageHeader, { AdminPage } from '../shared/AdminPageHeader';

interface ManualSection {
  group: string;
  title: string;
  source: string;
  blurb: string;
  outline: Array<{ level: number; text: string }>;
  body: string;
  chars: number;
  truncated: boolean;
}

const GROUP_ORDER = ['Brand', 'Architecture', 'Operations', 'Security', 'Changelog'];

const InternalManualPage: React.FC = () => {
  const [sections, setSections] = useState<ManualSection[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    get<{ generatedAt: string; sections: ManualSection[] }>('/admin/manual', { cache: false })
      .then((r) => {
        if (r.success && r.data) { setSections(r.data.sections); setGeneratedAt(r.data.generatedAt); }
        else setError('Could not load the manual.');
      })
      .catch(() => setError('Could not load the manual. It is restricted to platform admins.'))
      .finally(() => setLoading(false));
  }, []);

  // Suppress printing while this page is mounted. Deterrent only — stated as
  // such in the banner so nobody mistakes it for protection.
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-manual-print-guard', '');
    style.textContent = '@media print { body { display: none !important; } }';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const visible = needle
      ? sections.filter((s) => `${s.title} ${s.blurb} ${s.body}`.toLowerCase().includes(needle))
      : sections;
    const byGroup = new Map<string, ManualSection[]>();
    visible.forEach((s) => {
      if (!byGroup.has(s.group)) byGroup.set(s.group, []);
      byGroup.get(s.group)!.push(s);
    });
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ group: g, items: byGroup.get(g)! }));
  }, [sections, q]);

  const active = sections[activeIdx];

  if (loading) {
    return (
      <AdminPage>
        <div className="h-64 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading manual…
        </div>
      </AdminPage>
    );
  }

  if (error) {
    return (
      <AdminPage>
        <AdminPageHeader title="Internal Manual" subtitle="Platform administrators only" icon={BookLock} />
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 text-sm text-amber-800 dark:text-amber-300">
          {error}
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Internal Manual"
        subtitle={`Platform administrators only${generatedAt ? ` · compiled ${new Date(generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''}`}
        icon={BookLock}
      />

      {/* Say what the restriction actually is. Overstating it would be worse
          than saying nothing. */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert size={15} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
          <span className="font-bold text-slate-700 dark:text-zinc-200">Internal — keep it here.</span>{' '}
          This manual includes deployment specifics and a map of which stored keys touch
          credentials. There is no export, and printing is disabled — but that's a deterrent,
          not a guarantee: anything on screen can be captured. The real control is that this
          page and its API are restricted to platform admins.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-5">
        {/* Contents */}
        <aside className="lg:sticky lg:top-4 self-start space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field-input pl-8 text-xs"
              placeholder="Search the manual…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <nav className="space-y-3">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5 px-1">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((s) => {
                    const idx = sections.indexOf(s);
                    return (
                      <button
                        key={s.title}
                        onClick={() => setActiveIdx(idx)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                          idx === activeIdx
                            ? 'bg-pine text-white'
                            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <ChevronRight size={11} className="shrink-0 opacity-60" />
                        <span className="truncate">{s.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="text-[11px] text-slate-400 px-1">Nothing matches that search.</p>
            )}
          </nav>
        </aside>

        {/* The page */}
        {active && (
          <article
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 select-none"
            onContextMenu={(e) => e.preventDefault()}
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{active.group}</p>
            <h2 className="mt-1 font-display text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">
              {active.title}
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{active.blurb}</p>
            <p className="mt-1 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <FileText size={10} /> {active.source}
            </p>

            {active.outline.length > 0 && (
              <div className="mt-5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">In this section</p>
                <ul className="space-y-0.5">
                  {active.outline.map((h, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-slate-600 dark:text-zinc-400 truncate"
                      style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                    >
                      {h.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <pre className="mt-5 whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-slate-700 dark:text-zinc-300">
              {active.body}
            </pre>

            {active.truncated && (
              <p className="mt-4 text-[11px] text-amber-600 dark:text-amber-400">
                Excerpt only — this document is {active.chars.toLocaleString()} characters.
                The full text lives at <span className="font-mono">{active.source}</span> in the repo.
              </p>
            )}
          </article>
        )}
      </div>
    </AdminPage>
  );
};

export default InternalManualPage;

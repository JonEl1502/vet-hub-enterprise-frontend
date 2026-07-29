import React from 'react';
import toast from 'react-hot-toast';
import { Mail, Phone, Search, Loader2, Building2, MessageSquare, CheckCircle2, X } from 'lucide-react';
import demoRequestsAPI, { DemoRequest, DemoRequestStatus } from '../../../services/modules/demoRequests.api';
import AdminPageHeader from '../shared/AdminPageHeader';

/**
 * Demo requests — the lead inbox (backend 146).
 *
 * These used to be emailed to one Gmail account and stored nowhere: you could
 * not search them, hand them to someone, or tell whether anyone had followed
 * up. The whole point of this page is that last part, so every row shows its
 * status and who moved it.
 */

const STATUSES: { id: DemoRequestStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'NEW', label: 'New' },
  { id: 'CONTACTED', label: 'Contacted' },
  { id: 'CONVERTED', label: 'Converted' },
  { id: 'DISMISSED', label: 'Dismissed' },
];

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CONTACTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  CONVERTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DISMISSED: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const DemoRequestsAdminPage: React.FC = () => {
  const [rows, setRows] = React.useState<DemoRequest[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [tab, setTab] = React.useState<DemoRequestStatus | 'ALL'>('NEW');
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await demoRequestsAPI.list({ status: tab === 'ALL' ? undefined : tab, q: q.trim() || undefined });
      if (res.success && res.data) { setRows(res.data.requests); setCounts(res.data.counts || {}); }
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [tab, q]);

  // Debounced so typing a search doesn't fire a request per keystroke.
  React.useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const setStatus = async (r: DemoRequest, status: DemoRequestStatus) => {
    setBusyId(r.id);
    try {
      const res = await demoRequestsAPI.update(r.id, { status });
      if (res.success) { toast.success(`Marked ${status.toLowerCase()}`); await load(); }
    } finally { setBusyId(null); }
  };

  const saveNote = async (r: DemoRequest) => {
    const notes = noteDraft[r.id];
    if (notes === undefined || notes === (r.notes ?? '')) return;
    setBusyId(r.id);
    try {
      const res = await demoRequestsAPI.update(r.id, { notes });
      if (res.success) { toast.success('Note saved'); await load(); }
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Demo Requests"
        subtitle="Leads from the public “request a demo” form — contact them, and record that you did"
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map(s => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === s.id
                ? 'bg-pine text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-pine'
            }`}
          >
            {s.label}
            {s.id !== 'ALL' && counts[s.id] ? ` (${counts[s.id]})` : ''}
          </button>
        ))}
        <div className="relative ml-auto min-w-[220px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search name, email, clinic, phone…"
            className="w-full pl-8 pr-8 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {q ? 'Nothing matches that search' : tab === 'NEW' ? 'No new demo requests' : 'Nothing here'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-pine dark:text-zinc-100">{r.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${STATUS_STYLE[r.status] || STATUS_STYLE.NEW}`}>
                      {r.status}
                    </span>
                    {r.clinicName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                        <Building2 size={11} /> {r.clinicName}
                      </span>
                    )}
                  </div>
                  {/* Contact details are the point of the page — make them
                      one-click, not something to copy out by hand. */}
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-seafoam hover:underline">
                      <Mail size={12} /> {r.email}
                    </a>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-seafoam hover:underline">
                        <Phone size={12} /> {r.phone}
                      </a>
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{fmt(r.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(['CONTACTED', 'CONVERTED', 'DISMISSED'] as DemoRequestStatus[])
                    .filter(s => s !== r.status)
                    .map(s => (
                      <button
                        key={s}
                        disabled={busyId === r.id}
                        onClick={() => setStatus(r, s)}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-40"
                      >
                        {s === 'CONTACTED' ? 'Mark contacted' : s === 'CONVERTED' ? 'Converted' : 'Dismiss'}
                      </button>
                    ))}
                </div>
              </div>

              {r.message && (
                <div className="flex gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800">
                  <MessageSquare size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{r.message}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  defaultValue={r.notes ?? ''}
                  onChange={e => setNoteDraft(d => ({ ...d, [r.id]: e.target.value }))}
                  onBlur={() => saveNote(r)}
                  placeholder="Internal note — what was said, what next…"
                  className="flex-1 min-w-[200px] px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
                />
                {r.contactedAt && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    {fmt(r.contactedAt)}{r.contactedBy ? ` · ${r.contactedBy.email}` : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DemoRequestsAdminPage;

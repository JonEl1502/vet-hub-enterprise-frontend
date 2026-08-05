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
  // One-click convert (2026-08-05): the lead being converted, the form, and the
  // credentials that come back. The password is shown ONCE — the server does not
  // keep a readable copy — so this state is the only place it ever exists.
  const [converting, setConverting] = React.useState<DemoRequest | null>(null);
  const [convType, setConvType] = React.useState<'CLINIC' | 'FARM'>('CLINIC');
  const [convName, setConvName] = React.useState('');
  const [convBusy, setConvBusy] = React.useState(false);
  const [created, setCreated] = React.useState<{ ownerEmail: string; temporaryPassword: string; orgName: string } | null>(null);

  React.useEffect(() => {
    if (converting) { setConvType('CLINIC'); setConvName(converting.clinicName || converting.name || ''); }
  }, [converting]);

  const doConvert = async () => {
    if (!converting || !convName.trim()) return;
    setConvBusy(true);
    try {
      const res = await demoRequestsAPI.convert(converting.id, { accountType: convType, orgName: convName.trim() });
      if (res.success && res.data) {
        setCreated({ ownerEmail: res.data.ownerEmail, temporaryPassword: res.data.temporaryPassword, orgName: res.data.orgName });
        setConverting(null);
        load();
      }
    } catch { /* the API layer surfaces its own error (e.g. email already has an account) */ }
    finally { setConvBusy(false); }
  };
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
                  {/* "Converted" used to be a STATUS CHANGE only — it recorded
                      that someone, somewhere, had made an account by hand.
                      It now CREATES the account (user, 2026-08-05). */}
                  {r.status !== 'CONVERTED' && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => setConverting(r)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-40"
                    >
                      <Building2 size={11} /> Create account
                    </button>
                  )}
                  {(['CONTACTED', 'DISMISSED'] as DemoRequestStatus[])
                    .filter(s => s !== r.status)
                    .map(s => (
                      <button
                        key={s}
                        disabled={busyId === r.id}
                        onClick={() => setStatus(r, s)}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-40"
                      >
                        {s === 'CONTACTED' ? 'Mark contacted' : 'Dismiss'}
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
    
      {/* CONVERT — asks only what the lead cannot tell us: the org's real name
          and whether it is a clinic or a farm. Everything else (owner name,
          email, phone) comes from the lead itself. */}
      {converting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70" onClick={() => setConverting(null)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Create account</p>
            <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">{converting.name}</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Creates the organisation <strong>and its owner</strong>. The owner logs in with{' '}
              <span className="font-mono text-pine dark:text-zinc-200">{converting.email}</span> — that is why the
              account is created with their email, not yours.
            </p>
            <div>
              <label className="field-label">Organisation name</label>
              <input className="field-input" value={convName} onChange={e => setConvName(e.target.value)} placeholder="e.g. Mombasani Vets Clinic" />
            </div>
            <div>
              <label className="field-label">Account type</label>
              <div className="flex gap-2">
                {(['CLINIC', 'FARM'] as const).map(t => (
                  <button key={t} onClick={() => setConvType(t)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${convType === t ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>
                    {t === 'CLINIC' ? 'Vet clinic' : 'Farm / livestock'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConverting(null)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
              <button onClick={doConvert} disabled={convBusy || !convName.trim()}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5">
                {convBusy ? <><Loader2 size={12} className="animate-spin" /> Creating…</> : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDENTIALS — shown ONCE. The server keeps no readable copy, so if this
          is dismissed without copying, the owner must reset their password. */}
      {created && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={13} /> Account created</p>
            <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">{created.orgName}</h2>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">Copy this now — it is shown once</p>
              <p className="text-xs font-mono text-pine dark:text-zinc-100 break-all">{created.ownerEmail}</p>
              <p className="text-sm font-mono font-black text-pine dark:text-zinc-100 break-all">{created.temporaryPassword}</p>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              There is no readable copy on the server. If this is lost the owner has to reset their password.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard?.writeText(`${created.ownerEmail} / ${created.temporaryPassword}`); toast.success('Copied'); }}
                className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">Copy</button>
              <button onClick={() => setCreated(null)} className="flex-1 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-lg text-[10px] font-black uppercase tracking-widest">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoRequestsAdminPage;

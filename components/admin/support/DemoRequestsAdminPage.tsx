import React from 'react';
import toast from 'react-hot-toast';
import {
  Mail, Phone, Search, Loader2, Building2, MessageSquare, CheckCircle2, X,
  Globe, MapPin, Upload, Plus, ChevronDown, Inbox, Target, AlertTriangle,
} from 'lucide-react';
import demoRequestsAPI, { DemoRequest, DemoRequestStatus, LeadKind } from '../../../services/modules/demoRequests.api';
import AdminPageHeader from '../shared/AdminPageHeader';
import LeadImportModal from './LeadImportModal';

/**
 * The lead inbox — both directions (backend 146, 234).
 *
 * INBOUND leads used to be emailed to one Gmail account and stored nowhere: you
 * could not search them, hand them to someone, or tell whether anyone had
 * followed up. The whole point of this page is that last part, so every row
 * shows its status and who moved it.
 *
 * POTENTIAL CLIENTS (2026-08-25, user) is the same queue pointed the other way:
 * a researched list of practices who have never heard of us, imported from a
 * spreadsheet and worked down to the same one-click convert. It renders as a
 * TABLE rather than the inbound cards because it is read in bulk and sorted by
 * score — you scan sixty rows for the next call, you do not read each one.
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

/** Research priority, loudest first — it is the reason to call today. */
const PRIORITY_STYLE: Record<string, string> = {
  'VERY HIGH': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MEDIUM: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Strip the scheme so a column of URLs stays readable at a glance. */
const host = (url?: string | null) => {
  if (!url) return '';
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
};

const DemoRequestsAdminPage: React.FC = () => {
  const [rows, setRows] = React.useState<DemoRequest[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [kindCounts, setKindCounts] = React.useState<Record<string, number>>({});
  // Which queue. Inbound first: someone who asked for a demo an hour ago is
  // colder every hour they wait, and outreach keeps.
  const [kind, setKind] = React.useState<LeadKind>('INBOUND');
  const [tab, setTab] = React.useState<DemoRequestStatus | 'ALL'>('NEW');
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  // One-click convert (2026-08-05): the lead being converted, the form, and the
  // credentials that come back. The password is shown ONCE — the server does not
  // keep a readable copy — so this state is the only place it ever exists.
  const [converting, setConverting] = React.useState<DemoRequest | null>(null);
  const [convType, setConvType] = React.useState<'CLINIC' | 'FARM'>('CLINIC');
  const [convName, setConvName] = React.useState('');
  const [convEmail, setConvEmail] = React.useState('');
  const [convBusy, setConvBusy] = React.useState(false);
  const [created, setCreated] = React.useState<{ ownerEmail: string; temporaryPassword: string; orgName: string } | null>(null);

  React.useEffect(() => {
    if (converting) {
      setConvName(converting.clinicName || converting.name || '');
      setConvEmail(converting.email || '');
      // A mobile/farm practice is a FARM account, and the research says which —
      // guessing from the segment saves the commonest correction.
      const seg = `${converting.segment || ''} ${converting.message || ''}`.toLowerCase();
      setConvType(/farm|livestock|mobile|ambulatory/.test(seg) ? 'FARM' : 'CLINIC');
    }
  }, [converting]);

  const [noteDraft, setNoteDraft] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await demoRequestsAPI.list({
        status: tab === 'ALL' ? undefined : tab,
        q: q.trim() || undefined,
        kind,
      });
      if (res.success && res.data) {
        setRows(res.data.requests);
        setCounts(res.data.counts || {});
        setKindCounts(res.data.kindCounts || {});
      }
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [tab, q, kind]);

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

  /** Filling in the address research left blank — this is what makes a lead convertible. */
  const saveEmail = async (r: DemoRequest, email: string) => {
    const next = email.trim();
    if (next === (r.email ?? '')) return;
    setBusyId(r.id);
    try {
      const res = await demoRequestsAPI.update(r.id, { email: next });
      if (res.success) { toast.success('Email saved'); await load(); }
    } finally { setBusyId(null); }
  };

  const doConvert = async () => {
    if (!converting || !convName.trim()) return;
    setConvBusy(true);
    try {
      const res = await demoRequestsAPI.convert(converting.id, {
        accountType: convType,
        orgName: convName.trim(),
        // Sent always: for an inbound lead it is what they typed, for a
        // researched one it may be what we just learnt on the call.
        ownerEmail: convEmail.trim() || undefined,
      });
      if (res.success && res.data) {
        setCreated({ ownerEmail: res.data.ownerEmail, temporaryPassword: res.data.temporaryPassword, orgName: res.data.orgName });
        setConverting(null);
        load();
      }
    } catch { /* the API layer surfaces its own error (e.g. email already has an account) */ }
    finally { setConvBusy(false); }
  };

  const isOutreach = kind === 'OUTREACH';

  const KIND_TABS: { id: LeadKind; label: string; icon: React.ComponentType<{ size?: number }>; hint: string }[] = [
    { id: 'INBOUND', label: 'Demo requests', icon: Inbox, hint: 'They came to us' },
    { id: 'OUTREACH', label: 'Potential clients', icon: Target, hint: 'We go to them' },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Demo Requests"
        subtitle={isOutreach
          ? 'Researched practices we are going after — call them, record that you did, create the account'
          : 'Leads from the public “request a demo” form — contact them, and record that you did'}
      />

      {/* ── Which queue ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map(k => {
          const Icon = k.icon;
          const active = kind === k.id;
          return (
            <button
              key={k.id}
              onClick={() => { setKind(k.id); setTab('NEW'); setExpanded(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                active
                  ? 'bg-pine dark:bg-zinc-100 text-white dark:text-zinc-900 border-pine dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-seafoam/50'
              }`}
            >
              <Icon size={14} />
              <span className="text-[11px] font-black uppercase tracking-widest">{k.label}</span>
              {kindCounts[k.id] ? (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${active ? 'bg-white/20 dark:bg-zinc-900/10' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                  {kindCounts[k.id]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── Status filter, search, and (outreach only) getting leads in ──── */}
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
            placeholder={isOutreach ? 'Search name, town, county, email…' : 'Search name, email, clinic, phone…'}
            className="w-full pl-8 pr-8 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine">
              <X size={12} />
            </button>
          )}
        </div>
        {isOutreach && (
          <>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-pine transition-all"
            >
              <Plus size={12} /> Add one
            </button>
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-seafoam text-white hover:opacity-90 transition-all"
            >
              <Upload size={12} /> Import list
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {q ? 'Nothing matches that search'
              : isOutreach ? 'No potential clients yet'
              : tab === 'NEW' ? 'No new demo requests' : 'Nothing here'}
          </p>
          {isOutreach && !q && (
            <button onClick={() => setImporting(true)} className="text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline">
              Import your list
            </button>
          )}
        </div>
      ) : isOutreach ? (
        /* ── POTENTIAL CLIENTS — a table, because this list is scanned, not read.
              The row opens for the notes and the message; everything you need to
              pick the next call is on the closed row. */
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr>
                {['Practice', 'Where', 'Contact', 'Score', 'Status', ''].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const open = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(open ? null : r.id)}
                      className="border-t border-slate-100 dark:border-zinc-800 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-zinc-950/40"
                    >
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-black text-pine dark:text-zinc-100">{r.clinicName || r.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.segment && <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{r.segment}</span>}
                          {r.externalRef && <span className="text-[9px] font-mono text-slate-300 dark:text-zinc-600">{r.externalRef}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><MapPin size={10} /> {r.town || r.region || '—'}</span>
                        {r.country && <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{r.country}</p>}
                      </td>
                      <td className="px-3 py-2.5 align-top" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-0.5">
                          {r.email ? (
                            <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 font-bold text-seafoam hover:underline">
                              <Mail size={10} /> {r.email}
                            </a>
                          ) : (
                            /* 60% of the researched list publishes no address, and
                               the address is the login — say so where it is read,
                               not at the moment convert fails. */
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-600">
                              <AlertTriangle size={10} /> No email yet
                            </span>
                          )}
                          {r.phone && (
                            <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-zinc-400 hover:text-seafoam">
                              <Phone size={10} /> {r.phone}
                            </a>
                          )}
                          {r.website && (
                            <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-seafoam truncate max-w-[180px]">
                              <Globe size={10} /> {host(r.website)}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        {r.leadScore != null && <span className="font-black text-pine dark:text-zinc-100">{r.leadScore}</span>}
                        {r.priority && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${PRIORITY_STYLE[r.priority.toUpperCase()] || PRIORITY_STYLE.MEDIUM}`}>
                            {r.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${STATUS_STYLE[r.status] || STATUS_STYLE.NEW}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {r.status !== 'CONVERTED' && (
                            <button
                              disabled={busyId === r.id}
                              onClick={() => setConverting(r)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-40"
                            >
                              <Building2 size={10} /> Create
                            </button>
                          )}
                          {r.status === 'NEW' && (
                            <button
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r, 'CONTACTED')}
                              className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 transition-all disabled:opacity-40"
                            >
                              Contacted
                            </button>
                          )}
                          <ChevronDown size={13} className={`text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </div>
                      </td>
                    </tr>

                    {open && (
                      <tr className="border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/40">
                        <td colSpan={6} className="px-3 py-3 space-y-2.5">
                          {r.message && (
                            <div className="flex gap-2">
                              <MessageSquare size={12} className="text-slate-400 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{r.message}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Editable here rather than only in the convert
                                dialog: it was learnt on the call, it belongs to
                                the record, and the next person should see it. */}
                            <input
                              defaultValue={r.email ?? ''}
                              onBlur={e => saveEmail(r, e.target.value)}
                              placeholder="Email — add it once you have it"
                              className={`min-w-[200px] px-3 py-1.5 bg-white dark:bg-zinc-900 border rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30 ${
                                r.email ? 'border-slate-200 dark:border-zinc-800' : 'border-amber-300 dark:border-amber-800/60'
                              }`}
                            />
                            <input
                              defaultValue={r.notes ?? ''}
                              onChange={e => setNoteDraft(d => ({ ...d, [r.id]: e.target.value }))}
                              onBlur={() => saveNote(r)}
                              placeholder="Internal note — what was said, what next…"
                              className="flex-1 min-w-[220px] px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30"
                            />
                            {r.status !== 'DISMISSED' && r.status !== 'CONVERTED' && (
                              <button
                                disabled={busyId === r.id}
                                onClick={() => setStatus(r, 'DISMISSED')}
                                className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
                              >
                                Dismiss
                              </button>
                            )}
                          </div>
                          {r.contactedAt && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                              <CheckCircle2 size={11} className="text-emerald-500" />
                              {fmt(r.contactedAt)}{r.contactedBy ? ` · ${r.contactedBy.email}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── INBOUND — cards. Each is read once, in full, and acted on. */
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
                    {r.email && (
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-seafoam hover:underline">
                        <Mail size={12} /> {r.email}
                      </a>
                    )}
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

      {importing && <LeadImportModal onClose={() => setImporting(false)} onImported={load} />}
      {adding && <AddPotentialClientModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />}

      {/* CONVERT — asks only what the lead cannot tell us: the org's real name,
          whether it is a clinic or a farm, and — for a researched lead — the
          email that becomes the login. */}
      {converting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70" onClick={() => setConverting(null)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Create account</p>
            <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">{converting.clinicName || converting.name}</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Creates the organisation <strong>and its owner</strong>. The owner logs in with the email below —
              that is why the account is created with theirs, not yours.
            </p>
            <div>
              <label className="field-label">Organisation name</label>
              <input className="field-input" value={convName} onChange={e => setConvName(e.target.value)} placeholder="e.g. Mombasani Vets Clinic" />
            </div>
            <div>
              <label className="field-label">Owner email {converting.email ? '' : '— not on this lead yet'}</label>
              <input
                className="field-input"
                type="email"
                value={convEmail}
                onChange={e => setConvEmail(e.target.value)}
                placeholder="owner@practice.co.ke"
              />
              {!converting.email && (
                <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">
                  This lead was researched without an email. Whatever you enter is saved back onto the lead too.
                </p>
              )}
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
              <button onClick={doConvert} disabled={convBusy || !convName.trim() || !convEmail.trim()}
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

/**
 * One prospect, typed by hand.
 *
 * The list arrives by import, but a practice mentioned on a call should not
 * require opening a spreadsheet, saving it and re-importing to get into the
 * queue. Only the business name is required — everything else is what you
 * happen to know.
 */
const AddPotentialClientModal: React.FC<{ onClose: () => void; onAdded: () => void }> = ({ onClose, onAdded }) => {
  const [form, setForm] = React.useState({
    clinicName: '', name: '', email: '', phone: '', town: '', country: '', segment: '', website: '', notes: '',
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.clinicName.trim()) return;
    setBusy(true);
    try {
      const res = await demoRequestsAPI.create(form);
      if (res.success) { toast.success('Added to potential clients'); onAdded(); }
    } catch { /* surfaced by the client */ }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
        <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">Add</p>
        <h2 className="font-display text-lg font-black text-pine dark:text-zinc-100">Potential client</h2>
        <div>
          <label className="field-label">Practice / business name</label>
          <input className="field-input" value={form.clinicName} onChange={set('clinicName')} placeholder="e.g. Westlands Paws Veterinary Clinic" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Contact person</label><input className="field-input" value={form.name} onChange={set('name')} placeholder="Optional" /></div>
          <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={set('phone')} placeholder="+254…" /></div>
        </div>
        <div>
          <label className="field-label">Email</label>
          <input className="field-input" type="email" value={form.email} onChange={set('email')} placeholder="Add it later if you don't have it" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Town</label><input className="field-input" value={form.town} onChange={set('town')} placeholder="Nairobi" /></div>
          <div><label className="field-label">Country</label><input className="field-input" value={form.country} onChange={set('country')} placeholder="Kenya" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Segment</label><input className="field-input" value={form.segment} onChange={set('segment')} placeholder="Mixed Practice" /></div>
          <div><label className="field-label">Website</label><input className="field-input" value={form.website} onChange={set('website')} placeholder="https://…" /></div>
        </div>
        <div>
          <label className="field-label">Note</label>
          <input className="field-input" value={form.notes} onChange={set('notes')} placeholder="Where this came from, what to say…" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
          <button onClick={submit} disabled={busy || !form.clinicName.trim()}
            className="flex-1 py-2 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5">
            {busy ? <><Loader2 size={12} className="animate-spin" /> Adding…</> : 'Add lead'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoRequestsAdminPage;

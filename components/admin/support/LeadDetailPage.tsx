import React from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Mail, Phone, Globe, MapPin, Building2, Loader2, CheckCircle2,
  AlertTriangle, Trash2, Settings2, MessageSquare, Hash, Target, Inbox,
} from 'lucide-react';
import demoRequestsAPI, { DemoRequest, DemoRequestStatus, LeadNote } from '../../../services/modules/demoRequests.api';
import LeadConvertDialog from './LeadConvertDialog';

/**
 * One lead, in full.
 *
 * The queue used to expand a row in place. That works for a glance and not for
 * a call: you want every researched field and the whole history of what was
 * said on screen at once, without the other 52 rows underneath it (user,
 * 2026-08-25: *"open details in page we can have some notes too"*).
 *
 * It is a routed view, so it sits on the nav stack — Back returns to the queue
 * with its filter and scroll intact, and the browser back button works.
 */

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CONTACTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  CONVERTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DISMISSED: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const host = (url?: string | null) =>
  url ? url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '') : '';

interface Props {
  leadId: string;
  onBack: () => void;
}

const LeadDetailPage: React.FC<Props> = ({ leadId, onBack }) => {
  const [lead, setLead] = React.useState<DemoRequest | null>(null);
  const [notes, setNotes] = React.useState<LeadNote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [converting, setConverting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await demoRequestsAPI.get(leadId);
      if (res.success && res.data) { setLead(res.data.request); setNotes(res.data.notes || []); }
    } catch { /* surfaced by the client */ }
    finally { setLoading(false); }
  }, [leadId]);

  React.useEffect(() => { load(); }, [load]);

  const patch = async (data: Parameters<typeof demoRequestsAPI.update>[1], msg?: string) => {
    if (!lead) return;
    setBusy(true);
    try {
      const res = await demoRequestsAPI.update(lead.id, data);
      if (res.success) { if (msg) toast.success(msg); await load(); }
    } finally { setBusy(false); }
  };

  const addNote = async () => {
    const body = draft.trim();
    if (!body || !lead) return;
    setBusy(true);
    try {
      const res = await demoRequestsAPI.addNote(lead.id, body);
      if (res.success) {
        setDraft('');
        // Reload rather than push the returned note: adding a note on a NEW
        // lead also moves it to CONTACTED, and the header must show that.
        await load();
      }
    } finally { setBusy(false); }
  };

  const removeNote = async (n: LeadNote) => {
    if (!lead) return;
    setBusy(true);
    try {
      const res = await demoRequestsAPI.deleteNote(lead.id, n.id);
      if (res.success) setNotes(prev => prev.filter(x => x.id !== n.id));
    } finally { setBusy(false); }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (!lead) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">That lead no longer exists</p>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline">Back to the list</button>
      </div>
    );
  }

  const isOutreach = lead.source === 'OUTREACH';
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Segment', value: lead.segment },
    { label: 'Country', value: lead.country },
    { label: 'Region', value: lead.region },
    { label: 'Town', value: lead.town },
    { label: 'Lead score', value: lead.leadScore != null ? String(lead.leadScore) : null },
    { label: 'Priority', value: lead.priority },
    { label: 'Added', value: fmt(lead.createdAt) },
  ].filter(f => f.value) as { label: string; value: React.ReactNode }[];

  return (
    <div className="space-y-4 max-w-5xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-pine">
        <ArrowLeft size={13} /> Back to leads
      </button>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${isOutreach ? 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'}`}>
                {isOutreach ? <><Target size={9} /> Potential client</> : <><Inbox size={9} /> Demo request</>}
              </span>
              {lead.externalRef && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-400">
                  <Hash size={9} />{lead.externalRef}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-black text-pine dark:text-zinc-100 mt-1">
              {lead.clinicName || lead.name}
            </h1>
            {lead.clinicName && lead.name !== lead.clinicName && (
              <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mt-0.5">Contact: {lead.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_STYLE[lead.status] || STATUS_STYLE.NEW}`}>
              {lead.status}
            </span>
            {lead.status !== 'CONVERTED' && (
              <button
                onClick={() => setConverting(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
              >
                <Building2 size={11} /> Create account
              </button>
            )}
          </div>
        </div>

        {/* Contact — the point of the page, so one click each. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-seafoam hover:underline">
              <Mail size={13} /> {lead.email}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600">
              <AlertTriangle size={12} /> No email yet
            </span>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-seafoam hover:underline">
              <Phone size={13} /> {lead.phone}
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 dark:text-zinc-400 hover:text-seafoam">
              <Globe size={13} /> {host(lead.website)}
            </a>
          )}
          {(lead.town || lead.country) && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 dark:text-zinc-400">
              <MapPin size={13} /> {[lead.town, lead.region, lead.country].filter(Boolean).join(', ')}
            </span>
          )}
        </div>

        {lead.contactedAt && (
          <p className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
            <CheckCircle2 size={11} className="text-emerald-500" />
            First worked {fmt(lead.contactedAt)}{lead.contactedBy ? ` · ${lead.contactedBy.email}` : ''}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* ── Notes ──────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-zinc-600">
              {notes.length || 'none'}{notes.length ? ` entr${notes.length === 1 ? 'y' : 'ies'}` : ''}
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote(); }}
              rows={3}
              placeholder="What was said, what happens next…"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-[12px] text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30 resize-y"
            />
            <div className="flex items-center justify-between gap-2">
              {/* Said plainly, because it changes the queue behind you. */}
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                {lead.status === 'NEW' ? 'Adding a note marks this contacted' : '⌘↵ to save'}
              </p>
              <button
                onClick={addNote}
                disabled={busy || !draft.trim()}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white disabled:opacity-40"
              >
                Add note
              </button>
            </div>
          </div>

          {notes.length === 0 ? (
            <p className="py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-zinc-700">
              Nothing recorded yet
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              {notes.map(n => {
                const system = n.kind === 'SYSTEM';
                return (
                  <div key={n.id} className="flex gap-2.5 group">
                    <div className={`mt-1.5 shrink-0 ${system ? 'text-slate-300 dark:text-zinc-600' : 'text-seafoam'}`}>
                      {system ? <Settings2 size={12} /> : <MessageSquare size={12} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[12px] whitespace-pre-wrap ${system ? 'italic text-slate-500 dark:text-zinc-400' : 'text-pine dark:text-zinc-100'}`}>
                        {n.body}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                        {fmt(n.createdAt)}
                        {n.author ? ` · ${n.author.email}` : system ? ' · system' : ''}
                      </p>
                    </div>
                    {/* System entries are the audit trail — not removable. */}
                    {!system && (
                      <button
                        onClick={() => removeNote(n)}
                        disabled={busy}
                        title="Delete note"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500 shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── The record ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Record</p>

            {/* Editable because this is what makes the lead convertible. */}
            <div>
              <label className="field-label">Email</label>
              <input
                className="field-input"
                defaultValue={lead.email ?? ''}
                key={lead.email ?? 'none'}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v !== (lead.email ?? '')) patch({ email: v }, 'Email saved');
                }}
                placeholder="Add it once you have it"
              />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input
                className="field-input"
                defaultValue={lead.phone ?? ''}
                key={lead.phone ?? 'nophone'}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v !== (lead.phone ?? '')) patch({ phone: v }, 'Phone saved');
                }}
                placeholder="+254…"
              />
            </div>

            {facts.length > 0 && (
              <dl className="pt-1 space-y-1.5">
                {facts.map(f => (
                  <div key={f.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{f.label}</dt>
                    <dd className="text-[11px] font-bold text-pine dark:text-zinc-100 text-right">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {lead.message && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {isOutreach ? 'From the research' : 'Their message'}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">{lead.message}</p>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(['NEW', 'CONTACTED', 'DISMISSED'] as DemoRequestStatus[])
                .filter(st => st !== lead.status && lead.status !== 'CONVERTED')
                .map(st => (
                  <button
                    key={st}
                    disabled={busy}
                    onClick={() => patch({ status: st }, `Marked ${st.toLowerCase()}`)}
                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-40"
                  >
                    {st === 'NEW' ? 'Back to new' : st === 'CONTACTED' ? 'Contacted' : 'Dismiss'}
                  </button>
                ))}
              {lead.status === 'CONVERTED' && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  This lead became an account. Its status is final.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {converting && (
        <LeadConvertDialog
          lead={lead}
          onClose={() => setConverting(false)}
          // Reload rather than navigate away: the timeline gains an "Account
          // created" entry and the status becomes CONVERTED, and seeing that
          // land is the confirmation the account is real.
          onConverted={load}
        />
      )}
    </div>
  );
};

export default LeadDetailPage;

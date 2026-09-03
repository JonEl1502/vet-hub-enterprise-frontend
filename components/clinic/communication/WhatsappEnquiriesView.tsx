import React from 'react';
import {
  MessageCircle, Loader2, UserPlus, XCircle, Phone, RefreshCw, Inbox, Paperclip, CheckCircle2,
} from 'lucide-react';
import { whatsappAPI, type UnmatchedSender } from '../../../services/modules/whatsapp.api';
import { toast } from '../../../services';

/**
 * WHATSAPP ENQUIRIES — people who messaged the clinic and are not in the CRM.
 *
 * Before this existed these messages were logged on the server and dropped: a
 * prospective client reaching a clinic, and nobody ever seeing it.
 *
 * ⚠️ Grouped BY SENDER, not by message. Someone who sends four messages is one
 * prospect, not four leads — a raw list would make a chatty enquirer look like
 * a busy week. Converting or dismissing closes that sender's WHOLE backlog for
 * the same reason: leaving three of four behind means they reappear tomorrow
 * looking like a fresh enquiry.
 *
 * ⚠️ Converting CREATES A REAL CLIENT, so the name is typed by a person rather
 * than lifted from the WhatsApp profile. "Mum ❤️" is a perfectly common profile
 * name and a terrible client record.
 */

const relative = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const WhatsappEnquiriesView: React.FC<{ onOpenClient?: (clientId: string) => void }> = ({ onOpenClient }) => {
  const [senders, setSenders] = React.useState<UnmatchedSender[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<'NEW' | 'CONVERTED' | 'DISMISSED'>('NEW');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [converting, setConverting] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ firstName: '', surname: '', email: '' });

  const load = React.useCallback((silent = false) => {
    if (!silent) setLoading(true);
    whatsappAPI.listUnmatched(tab)
      .then((r) => setSenders(r?.data?.senders ?? []))
      .catch(() => toast.error('Could not load enquiries'))
      .finally(() => setLoading(false));
  }, [tab]);

  React.useEffect(() => { load(); }, [load]);

  const startConvert = (s: UnmatchedSender) => {
    setConverting(s.ids[0]);
    // Seed from the profile name only as a STARTING POINT — the staff member
    // still has to look at it, which is the whole point.
    const parts = (s.profileName || '').trim().split(/\s+/).filter(Boolean);
    setForm({ firstName: parts[0] || '', surname: parts.slice(1).join(' ') || '', email: '' });
  };

  const doConvert = async (s: UnmatchedSender) => {
    if (!form.firstName.trim() || !form.surname.trim()) {
      toast.error('First name and surname are required');
      return;
    }
    setBusy(s.fromPhone);
    try {
      const r = await whatsappAPI.convertUnmatched(s.ids[0], {
        firstName: form.firstName.trim(),
        surname: form.surname.trim(),
        email: form.email.trim() || undefined,
        phone: `+${s.fromPhone}`,
      });
      toast.success(r?.data?.created ? 'Client created' : 'Linked to the existing client');
      setConverting(null);
      load(true);
    } catch { /* the API client surfaces it */ } finally { setBusy(null); }
  };

  const doDismiss = async (s: UnmatchedSender) => {
    setBusy(s.fromPhone);
    try {
      await whatsappAPI.dismissUnmatched(s.ids[0]);
      load(true);
    } catch { /* handled */ } finally { setBusy(null); }
  };

  /**
   * Full width, like every sibling page.
   *
   * `max-w-5xl mx-auto` capped this one at 1024px and centred it INSIDE the
   * shared `p-4 md:p-6 w-full` wrapper, so on a desktop the content floated in
   * the middle with a wide empty gutter either side, while Broadcasts, Staff
   * and HR beside it ran edge to edge (user, 2026-09-03: "padding"). The
   * wrapper already supplies the padding; the cap only removed width.
   */
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 pb-20">
      <header className="flex items-center justify-between gap-3 pb-3 border-b border-seafoam/15 dark:border-zinc-800">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-pine dark:text-zinc-100 tracking-tight flex items-center gap-2">
            <MessageCircle size={18} className="text-emerald-500" /> WhatsApp enquiries
          </h1>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">
            People who messaged you and aren&rsquo;t clients yet
          </p>
        </div>
        <button
          onClick={() => load()}
          className="shrink-0 p-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-seafoam hover:border-seafoam transition-all"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </header>

      <div className="flex gap-1.5">
        {(['NEW', 'CONVERTED', 'DISMISSED'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              tab === t
                ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine border-pine dark:border-zinc-100'
                : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
            }`}
          >
            {t === 'NEW' ? 'Waiting' : t === 'CONVERTED' ? 'Converted' : 'Dismissed'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-seafoam" size={22} /></div>
      ) : senders.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Inbox size={28} className="text-slate-200 dark:text-zinc-700" />
          <p className="uppercase font-black text-[10px] tracking-[0.2em] text-slate-300 dark:text-zinc-600">
            {tab === 'NEW' ? 'Nothing waiting' : `Nothing ${tab.toLowerCase()}`}
          </p>
          {tab === 'NEW' && (
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium text-center max-w-sm">
              When someone who isn&rsquo;t in your client list messages your WhatsApp number, their
              enquiry appears here instead of being lost.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {senders.map((s) => {
            const isConverting = converting === s.ids[0];
            const isBusy = busy === s.fromPhone;
            return (
              <div key={s.fromPhone} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">
                      {s.profileName || 'Unknown sender'}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 tabular-nums">
                      <Phone size={11} /> +{s.fromPhone}
                      <span className="text-slate-300 dark:text-zinc-600">·</span>
                      {s.messageCount} message{s.messageCount === 1 ? '' : 's'}
                      <span className="text-slate-300 dark:text-zinc-600">·</span>
                      {relative(s.lastAt)}
                    </p>
                  </div>
                  {tab === 'NEW' && !isConverting && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => startConvert(s)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 transition-all"
                      >
                        <UserPlus size={12} /> Add client
                      </button>
                      <button
                        onClick={() => doDismiss(s)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-all"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* The actual enquiry, oldest first so it reads as a conversation. */}
                <div className="space-y-1.5">
                  {s.messages.map((m) => (
                    <div key={m.id} className="bg-slate-50 dark:bg-zinc-800 rounded-xl px-3 py-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      {m.mediaUrl && m.mediaType?.startsWith('image/') && (
                        <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">
                          <img src={m.mediaUrl} alt="Attachment" className="mt-2 rounded-lg max-h-48 border border-slate-200 dark:border-zinc-700" />
                        </a>
                      )}
                      {m.mediaUrl && !m.mediaType?.startsWith('image/') && (
                        <a
                          href={m.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline"
                        >
                          <Paperclip size={11} /> Attachment
                        </a>
                      )}
                      {/* An attachment we know about but could not keep. Meta
                          deletes media after 30 days, so saying nothing here
                          would look like the client sent only text. */}
                      {!m.mediaUrl && m.mediaType && (
                        <p className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Paperclip size={11} /> Attachment could not be saved
                        </p>
                      )}
                      <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600 mt-1">{relative(m.receivedAt)}</p>
                    </div>
                  ))}
                </div>

                {isConverting && (
                  <div className="rounded-xl border border-seafoam/30 bg-seafoam/5 p-3 space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-seafoam">
                      New client · +{s.fromPhone}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                      Check the name before saving — this creates a real client record, and a
                      WhatsApp profile name is often a nickname.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([['firstName', 'First name'], ['surname', 'Surname'], ['email', 'Email (optional)']] as const).map(([k, label]) => (
                        <input
                          key={k}
                          value={form[k]}
                          onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                          placeholder={label}
                          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/25"
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => doConvert(s)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 transition-all"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Create client
                      </button>
                      <button
                        onClick={() => setConverting(null)}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {tab === 'CONVERTED' && onOpenClient && s.messages.length > 0 && (
                  <button
                    onClick={() => onOpenClient(s.fromPhone)}
                    className="text-[10px] font-black uppercase tracking-widest text-seafoam hover:underline"
                  >
                    Open client
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhatsappEnquiriesView;

import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Send, Users, History, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { broadcastsAPI, Broadcast, BroadcastAudience } from '../../../services';
import { toast } from '../../../services';
import { CLIENT_TYPES } from '../../../constants';

// Admin email-broadcast composer. Sends a one-off email campaign to the active
// clinic's opted-in clients. Per-client unsubscribe + opt-out is handled
// server-side; this page only composes, previews the audience size, and sends.
const BroadcastView: React.FC = () => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | string>('all');

  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const buildAudience = useCallback((): BroadcastAudience => {
    return audienceType === 'all'
      ? { type: 'all' }
      : { type: 'clientType', clientType: audienceType };
  }, [audienceType]);

  // Refresh the live recipient count whenever the audience changes.
  useEffect(() => {
    let cancelled = false;
    setCountLoading(true);
    setRecipientCount(null);
    broadcastsAPI
      .recipientCount(buildAudience(), { showError: false })
      .then((res) => { if (!cancelled) setRecipientCount(res.data?.count ?? 0); })
      .catch(() => { if (!cancelled) setRecipientCount(0); })
      .finally(() => { if (!cancelled) setCountLoading(false); });
    return () => { cancelled = true; };
  }, [buildAudience]);

  const loadHistory = useCallback(() => {
    broadcastsAPI.list({ showError: false })
      .then((res) => setHistory(res.data?.broadcasts ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && (recipientCount ?? 0) > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    const count = recipientCount ?? 0;
    if (!window.confirm(`Send this email to ${count} client${count === 1 ? '' : 's'}? This cannot be undone.`)) return;

    setSending(true);
    try {
      const res = await broadcastsAPI.send({ subject: subject.trim(), body: body.trim(), audience: buildAudience() });
      const b = res.data?.broadcast;
      toast.success(`Sent to ${b?.sentCount ?? count} recipient(s)${b?.failedCount ? `, ${b.failedCount} failed` : ''}`);
      setSubject('');
      setBody('');
      loadHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center">
          <Mail size={20} className="text-seafoam" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">
            Broadcasts
          </h1>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-widest">
            Email all your clients at once
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Compose */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 space-y-5">
            <div>
              <label className="field-label">Audience</label>
              <select
                className="field-select"
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value)}
              >
                <option value="all">All clients</option>
                {CLIENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} clients</option>
                ))}
              </select>
              <p className="field-help flex items-center gap-1.5 mt-2">
                {countLoading ? (
                  <><Loader2 size={11} className="animate-spin" /> Counting recipients…</>
                ) : (
                  <><Users size={11} className="text-seafoam" />
                    <span className="text-seafoam font-black">{recipientCount ?? 0}</span> opted-in recipient{(recipientCount ?? 0) === 1 ? '' : 's'} with an email on file
                  </>
                )}
              </p>
            </div>

            <div>
              <label className="field-label">Subject</label>
              <input
                className="field-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Vaccination reminder this month"
                maxLength={200}
              />
            </div>

            <div>
              <label className="field-label">Message</label>
              <textarea
                className="field-textarea"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Write your message here.\n\nBlank lines become paragraphs. An unsubscribe link is added automatically."}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                <AlertCircle size={12} /> Only clients who haven't unsubscribed are emailed.
              </p>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="bg-seafoam hover:bg-[#357066] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-seafoam/20 transition-all active:scale-95 flex items-center gap-2 shrink-0"
              >
                {sending
                  ? <><Loader2 size={15} className="animate-spin" /> Sending…</>
                  : <><Send size={15} /> Send to {recipientCount ?? 0}</>}
              </button>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 lg:sticky lg:top-6">
            <div className="flex items-center gap-2 mb-4">
              <History size={14} className="text-seafoam" />
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Broadcasts</h2>
            </div>
            {history.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-zinc-600 italic">No broadcasts sent yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((b) => (
                  <li key={b.id} className="border border-slate-100 dark:border-zinc-800 rounded-xl p-3">
                    <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{b.subject || '(no subject)'}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{fmtDate(b.createdAt)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md">
                        <CheckCircle2 size={9} /> {b.sentCount} sent
                      </span>
                      {b.failedCount > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-md">
                          {b.failedCount} failed
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastView;

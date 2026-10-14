import React from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, Mail, Copy, Check, Send } from 'lucide-react';
import demoRequestsAPI, { DemoRequest } from '../../../services/modules/demoRequests.api';
import { greetingFor, templatesFor, whatsappNumber, LeadMessageTemplate } from './leadMessageTemplates';

/**
 * "Send first message" panel on a lead.
 *
 * ⚠️ WhatsApp delivery from the platform is blocked on a provider and
 * credentials, so this does NOT send. It fills a message in from the lead's
 * details and opens WhatsApp (or the mail app) with it ready — one tap to send
 * from the person's own number, which is also what a cold clinic is likelier
 * to answer than a bulk sender.
 *
 * Because opening the app is not the same as sending, nothing is recorded
 * until the person says they sent it ("Log it as sent"), which writes the
 * message into the lead's notes and moves a NEW lead to CONTACTED.
 */

// v2: an earlier build could save a wrong name here (the clinic's own name), so the key moved on.
const LS_SIGN = 'vhc:outreach:sign:v2';
const LS_LINK = 'vhc:outreach:link';
const read = (k: string, fallback: string) => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not persisted */ } };

interface Props {
  lead: DemoRequest;
  /** Reload the lead after a note is logged (status may have changed). */
  onLogged: () => void;
}

const LeadOutreachComposer: React.FC<Props> = ({ lead, onLogged }) => {
  const templates = React.useMemo(() => templatesFor(lead), [lead]);

  // The signature is typed once and remembered. It is NOT taken from the
  // signed-in account: that picked up the wrong name. John is the default
  // because this is his platform's outreach; anyone else changes it once.
  const [sign, setSign] = React.useState(() => read(LS_SIGN, 'John'));
  const [link, setLink] = React.useState(() => read(LS_LINK, 'https://vethubcore.com'));
  const [tplId, setTplId] = React.useState(templates[0]?.id || '');
  const [text, setText] = React.useState('');
  const [pending, setPending] = React.useState<{ channel: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [logging, setLogging] = React.useState(false);

  const clinic = (lead.clinicName || lead.name || 'your clinic').trim();
  const tpl: LeadMessageTemplate | undefined = templates.find(t => t.id === tplId) || templates[0];
  const ctx = React.useMemo(
    () => ({ greeting: greetingFor(lead), clinic, town: (lead.town || '').trim(), sign: sign.trim() || '[Your name]', link: link.trim() || 'https://vethubcore.com' }),
    [lead, clinic, sign, link],
  );

  // A template change, or a changed name/link, rewrites the text. Hand edits
  // are kept until one of those happens, which is what a person editing wants.
  React.useEffect(() => { if (tpl) setText(tpl.body(ctx)); }, [tpl?.id, ctx.sign, ctx.link, lead.id]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { setPending(null); }, [lead.id, tplId]);

  const wa = whatsappNumber(lead.phone, lead.country);
  const missingName = !sign.trim() || text.includes('[Your name]');

  const guard = (): boolean => {
    if (!text.trim()) { toast.error('Write a message first'); return false; }
    if (missingName) { toast.error('Add your name first'); return false; }
    return true;
  };

  const openWhatsApp = () => {
    if (!guard()) return;
    if (!wa) { toast.error(lead.phone ? 'That number needs a country code (+254…)' : 'This lead has no phone number'); return; }
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    setPending({ channel: 'WhatsApp' });
  };

  const openEmail = () => {
    if (!guard()) return;
    if (!lead.email) { toast.error('This lead has no email yet'); return; }
    const subject = tpl ? tpl.subject(ctx) : '';
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    setPending({ channel: 'email' });
  };

  const copy = async () => {
    if (!guard()) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error('Could not copy'); }
  };

  const logSent = async () => {
    if (!pending) return;
    setLogging(true);
    try {
      const res = await demoRequestsAPI.addNote(lead.id, `Sent via ${pending.channel} (${tpl?.label || 'message'}):\n${text.trim()}`);
      if (res.success) { toast.success('Logged'); setPending(null); onLogged(); }
    } finally { setLogging(false); }
  };

  if (!tpl) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3" data-testid="lead-outreach">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Send a message</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-zinc-600">Opens WhatsApp or your mail app, you press send</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => setTplId(t.id)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors ${
              t.id === tpl.id ? 'bg-pine text-white dark:bg-seafoam' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={11}
        data-testid="outreach-text"
        className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-[12px] text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/30 resize-y leading-relaxed"
      />

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="field-label">Your name (signs the message)</label>
          <input
            className="field-input"
            value={sign}
            name="outreach-sender-name"
            autoComplete="off"
            data-1p-ignore="true"
            onChange={e => setSign(e.target.value)}
            onBlur={() => save(LS_SIGN, sign.trim())}
            placeholder="John"
          />
        </div>
        <div>
          <label className="field-label">Video / demo link</label>
          <input
            className="field-input"
            value={link}
            name="outreach-demo-link"
            autoComplete="off"
            data-1p-ignore="true"
            onChange={e => setLink(e.target.value)}
            onBlur={() => save(LS_LINK, link.trim())}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={openWhatsApp}
          disabled={!wa}
          title={wa ? `WhatsApp +${wa}` : lead.phone ? 'Needs a country code' : 'No phone number'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <MessageCircle size={12} /> WhatsApp
        </button>
        <button
          onClick={openEmail}
          disabled={!lead.email}
          title={lead.email || 'No email yet'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-seafoam text-white hover:opacity-90 disabled:opacity-40"
        >
          <Mail size={12} /> Email
        </button>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-auto">Check prices and features before you send</p>
      </div>

      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2" data-testid="outreach-confirm">
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Did you send it on {pending.channel}?</p>
          <div className="flex items-center gap-2">
            <button
              onClick={logSent}
              disabled={logging}
              data-testid="outreach-log"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-600 text-white disabled:opacity-40"
            >
              <Send size={11} /> Log it as sent
            </button>
            <button onClick={() => setPending(null)} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:underline">Not sent</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadOutreachComposer;

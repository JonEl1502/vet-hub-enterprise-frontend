import React from 'react';
import {
  MessageCircle, Loader2, AlertTriangle, CheckCircle2, Copy, Check, Link2,
  ShieldCheck, Trash2, Bell, BellOff, ExternalLink,
} from 'lucide-react';
import { whatsappAPI, type WhatsappConfigView, type WhatsappPurpose } from '../../../services/modules/whatsapp.api';
import { toast } from '../../../services';

/**
 * WHATSAPP — this clinic's own WhatsApp Business number, or VetHub's.
 *
 * Until this screen existed a clinic could only bring its own WABA by having
 * someone write SQL on the server, which meant tier 2 was not really available.
 *
 * ⚠️ Secrets are WRITE-ONLY here. The API returns the last four characters and
 * nothing more, and a blank field means "keep what is stored" rather than
 * "clear it" — so the placeholders below are safe to submit untouched. A
 * settings page that could redisplay a permanent access token would leak it to
 * anyone who got one look at the screen.
 */

const PURPOSE_LABEL: Record<WhatsappPurpose, { label: string; hint: string }> = {
  default: { label: 'Default template', hint: '[client, subject, detail, clinic]' },
  appointment_reminder: { label: 'Appointment reminder', hint: '[client, pet, when, clinic]' },
  vaccination_due: { label: 'Vaccination due', hint: '[client, pet, vaccine, clinic]' },
  bill_due: { label: 'Bill outstanding', hint: '[client, amount, bill no., clinic]' },
  clinic_broadcast: { label: 'Broadcast', hint: 'marketing — approved separately' },
};
const PURPOSES = Object.keys(PURPOSE_LABEL) as WhatsappPurpose[];
/** Everything the default template can stand in for. Broadcast cannot. */
const OVERRIDE_PURPOSES: WhatsappPurpose[] = ['appointment_reminder', 'vaccination_due', 'bill_due', 'clinic_broadcast'];

/**
 * The wording to paste into Meta for the default template. Kept here rather
 * than only in the runbook because this is where someone is standing when they
 * need it, and a template whose variables are in a different order from ours
 * sends the right values into the wrong slots — successfully, and unreadably.
 */
const DEFAULT_TEMPLATE_BODY =
  'Hello {{1}}, this is {{4}}. Regarding {{2}} — {{3}}. Reply to this message if you need anything.';

const FIELD =
  'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 ' +
  'text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/25 focus:border-seafoam/40';
const LABEL = 'text-[9px] font-black text-seafoam uppercase tracking-widest px-0.5';

const WhatsappTab: React.FC = () => {
  const [cfg, setCfg] = React.useState<WhatsappConfigView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const [form, setForm] = React.useState({
    phoneNumberId: '', wabaId: '', accessToken: '', appSecret: '', verifyToken: '',
  });
  const [templates, setTemplates] = React.useState<Partial<Record<WhatsappPurpose, string>>>({});

  const load = React.useCallback(() => {
    setLoading(true);
    whatsappAPI.getConfig()
      .then((r) => {
        if (!r?.data) return;
        setCfg(r.data);
        setForm((f) => ({ ...f, phoneNumberId: r.data!.phoneNumberId || '', wabaId: r.data!.wabaId || '' }));
        const t: Partial<Record<WhatsappPurpose, string>> = {};
        for (const p of PURPOSES) if (r.data!.templates?.[p]?.name) t[p] = r.data!.templates![p]!.name;
        setTemplates(t);
      })
      .catch(() => toast.error('Could not load WhatsApp settings'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await whatsappAPI.saveConfig({
        phoneNumberId: form.phoneNumberId.trim(),
        wabaId: form.wabaId.trim() || undefined,
        // Blank = keep stored. This is why the inputs can start empty even
        // though the clinic already has credentials saved.
        accessToken: form.accessToken.trim() || undefined,
        appSecret: form.appSecret.trim() || undefined,
        verifyToken: form.verifyToken.trim() || undefined,
        templates: Object.fromEntries(
          PURPOSES.filter((p) => templates[p]?.trim()).map((p) => [p, { name: templates[p]!.trim(), language: 'en' }]),
        ),
      });
      if (r?.data) setCfg(r.data);
      setForm((f) => ({ ...f, accessToken: '', appSecret: '', verifyToken: '' }));
      toast.success('WhatsApp settings saved');
    } catch {
      /* the API client surfaces the message */
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await whatsappAPI.testConfig();
      if (r?.data?.ok) toast.success(r.data.detail);
      else toast.error(r?.data?.detail || 'Connection test failed');
      load();
    } catch {
      /* handled by the client */
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect this clinic’s own WhatsApp number? Messages will go out from the VetHub number instead. Message history is kept.')) return;
    try {
      const r = await whatsappAPI.removeConfig();
      if (r?.data) setCfg(r.data);
      setForm({ phoneNumberId: '', wabaId: '', accessToken: '', appSecret: '', verifyToken: '' });
      toast.success('Disconnected — now using the VetHub number');
    } catch { /* handled */ }
  };

  const toggleAuto = async () => {
    if (!cfg) return;
    try {
      const r = await whatsappAPI.setAutoReminders(!cfg.autoReminders);
      if (r?.data) setCfg(r.data);
    } catch { /* handled */ }
  };

  const copyWebhook = () => {
    if (!cfg) return;
    navigator.clipboard?.writeText(cfg.webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => toast.error('Could not copy'));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-10 flex justify-center">
        <Loader2 className="animate-spin text-seafoam" size={22} />
      </div>
    );
  }
  if (!cfg) return null;

  const onOwnNumber = cfg.tier === 'clinic';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-5 animate-in slide-in-from-bottom-4">
      {/* Which number this clinic actually sends from. A clinic riding the
          platform number must not be told it is "not configured" — its
          messages are going out fine. */}
      <div className={`flex items-start gap-3 rounded-xl border p-3 ${
        cfg.tier === 'clinic'
          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30'
          : cfg.tier === 'platform'
            ? 'border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30'
            : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30'
      }`}>
        <MessageCircle size={16} className="mt-0.5 shrink-0 text-seafoam" />
        <div className="min-w-0">
          <p className="text-xs font-black text-pine dark:text-zinc-100">
            {cfg.tier === 'clinic' && `Sending from this clinic’s own number${cfg.displayPhone ? ` · ${cfg.displayPhone}` : ''}`}
            {cfg.tier === 'platform' && 'Sending from the VetHub number'}
            {cfg.tier === 'none' && 'WhatsApp is not set up on this server'}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
            {cfg.tier === 'clinic' && 'Clients see your clinic. Your own Meta templates and quality rating apply.'}
            {cfg.tier === 'platform' && 'Clients see VetHub. Connect your own WhatsApp Business number below to send under your clinic’s name.'}
            {cfg.tier === 'none' && 'No credentials on this server yet. Nothing is sent automatically; staff still get the WhatsApp links they have today.'}
          </p>
        </div>
      </div>

      {cfg.lastError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-[11px] font-bold text-red-800 dark:text-red-300">{cfg.lastError}</p>
        </div>
      )}
      {cfg.lastVerifiedAt && !cfg.lastError && (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={13} /> Verified with Meta on {new Date(cfg.lastVerifiedAt).toLocaleString()}
        </p>
      )}

      {/* ── Automatic reminders ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-pine dark:text-zinc-100 flex items-center gap-1.5">
              {cfg.autoReminders ? <Bell size={13} className="text-emerald-500" /> : <BellOff size={13} className="text-slate-400" />}
              Automatic appointment &amp; vaccination reminders
            </p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
              Sends a WhatsApp for reminders falling due in the next 24 hours, with nobody pressing send.
              Only reminders <strong>coming up</strong> — an existing backlog is never messaged.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAuto}
            disabled={!cfg.configured}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              cfg.autoReminders
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
            }`}
          >
            {cfg.autoReminders ? 'On' : 'Off'}
          </button>
        </div>
        {cfg.autoReminders && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
            Clients will receive messages without a staff member reviewing each one. An approved
            template is still required — without one, nothing is sent.
          </p>
        )}
      </div>

      {/* ── Templates ───────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div>
          <p className="text-xs font-black text-pine dark:text-zinc-100">Approved template</p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
            WhatsApp only lets you message a client out of the blue with a template Meta has
            approved in advance. <strong>One is enough.</strong> Get this one approved and
            appointment reminders, vaccination notices and bill notices all send through it.
          </p>
        </div>

        <div className="space-y-1">
          <label className={LABEL}>{PURPOSE_LABEL.default.label}</label>
          <input
            value={templates.default ?? ''}
            onChange={(e) => setTemplates((t) => ({ ...t, default: e.target.value }))}
            placeholder={cfg.platformTemplates?.default?.name || 'vethub_notification'}
            className={FIELD}
          />
          <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
            {PURPOSE_LABEL.default.hint} · category <strong>UTILITY</strong>
          </p>
        </div>

        {/* The exact body to submit. Variables are positional, so a template
            worded in a different order sends the right values into the wrong
            slots — and Meta accepts the send. */}
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-2.5 space-y-1.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Paste this as the template body in Meta
          </p>
          <div className="flex items-start gap-2">
            <code className="flex-1 text-[10px] font-bold text-pine dark:text-zinc-200 leading-relaxed break-words">
              {DEFAULT_TEMPLATE_BODY}
            </code>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(DEFAULT_TEMPLATE_BODY); toast.success('Template body copied'); }}
              className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:border-seafoam"
              title="Copy template body"
            >
              <Copy size={12} className="text-slate-400" />
            </button>
          </div>
          <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
            <strong>Keep the numbering exactly as written.</strong> Meta matches variables by
            position, so a reworded template sends the right values into the wrong slots — and the
            send still succeeds.
          </p>
        </div>

        {/* Per-purpose overrides, folded away. Most clinics never open this. */}
        <details className="rounded-xl border border-slate-200 dark:border-zinc-800 p-2.5">
          <summary className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 cursor-pointer">
            Different template for a specific purpose (optional)
          </summary>
          <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-2">
            Only if you have had purpose-specific wording approved. Anything left blank uses the
            default above. <strong>Broadcasts are the exception</strong> — Meta approves marketing
            separately, so a broadcast never falls back to the default and sends nothing without
            its own template.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
            {OVERRIDE_PURPOSES.map((p) => (
              <div key={p} className="space-y-1">
                <label className={LABEL}>{PURPOSE_LABEL[p].label}</label>
                <input
                  value={templates[p] ?? ''}
                  onChange={(e) => setTemplates((t) => ({ ...t, [p]: e.target.value }))}
                  placeholder={templates.default?.trim() || cfg.platformTemplates?.[p]?.name || p}
                  className={FIELD}
                />
                <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">{PURPOSE_LABEL[p].hint}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* ── BYOK credentials ────────────────────────────────────────────── */}
      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
        <div className="pt-3">
          <p className="text-xs font-black text-pine dark:text-zinc-100">Use this clinic&rsquo;s own WhatsApp number</p>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
            Requires your own Meta Business account and a verified WhatsApp Business Account.
            <strong> The number cannot already be in use in the WhatsApp app</strong> — registering
            it here means deleting that account, and its chat history with it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className={LABEL}>Phone number ID</label>
            <input
              value={form.phoneNumberId}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumberId: e.target.value }))}
              placeholder="15-digit ID from Meta"
              className={FIELD}
            />
            <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
              Meta&rsquo;s numeric ID, not the phone number itself.
            </p>
          </div>
          <div className="space-y-1">
            <label className={LABEL}>WhatsApp Business Account ID</label>
            <input
              value={form.wabaId}
              onChange={(e) => setForm((f) => ({ ...f, wabaId: e.target.value }))}
              placeholder="optional"
              className={FIELD}
            />
          </div>
          {([
            ['accessToken', 'Access token', 'Permanent system-user token'],
            ['appSecret', 'App secret', 'Signs incoming webhooks'],
            ['verifyToken', 'Verify token', 'You invent this one'],
          ] as const).map(([key, label, hint]) => (
            <div key={key} className="space-y-1">
              <label className={LABEL}>{label}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={cfg.secrets[key] ? `saved · ${cfg.secrets[key]}` : 'not set'}
                className={FIELD}
              />
              <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
                {hint}. {cfg.secrets[key] ? 'Leave blank to keep the saved one.' : ''}
              </p>
            </div>
          ))}
        </div>

        {/* The webhook URL Meta needs. Copyable because typing it wrong is the
            single most common reason the handshake fails with no explanation. */}
        <div className="space-y-1 pt-1">
          <label className={LABEL}>Callback URL for Meta</label>
          <div className="flex gap-2">
            <input readOnly value={cfg.webhookUrl} className={`${FIELD} font-mono !text-[10px] cursor-default`} />
            <button
              type="button"
              onClick={copyWebhook}
              className="shrink-0 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam hover:text-seafoam transition-all"
              title="Copy"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-600">
            Meta app dashboard → WhatsApp → Configuration → Webhook, with your verify token. Subscribe to the <strong>messages</strong> field.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || !form.phoneNumberId.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            {onOwnNumber ? 'Save changes' : 'Connect number'}
          </button>
          {onOwnNumber && (
            <>
              <button
                type="button"
                onClick={test}
                disabled={testing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam hover:text-seafoam disabled:opacity-40 transition-all"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                Test connection
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
              >
                <Trash2 size={13} /> Disconnect
              </button>
            </>
          )}
          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-seafoam transition-all"
          >
            <ExternalLink size={13} /> Meta setup guide
          </a>
        </div>
      </div>
    </div>
  );
};

export default WhatsappTab;

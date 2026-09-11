import React, { useState, useEffect } from 'react';
import {
  Globe, Loader2, Copy, Check, Plus, KeyRound, Send, Trash2, RefreshCw,
  AlertTriangle, ShieldAlert, ExternalLink, Radio, RotateCw, ShoppingBag, ShoppingCart,
  SlidersHorizontal, Webhook, Link2,
} from 'lucide-react';
import { siteConnectAPI, type SiteConnection, type SiteDelivery } from '../../../services/modules/siteConnect.api';
import { toast, dialog } from '../../../services';
import QRCode from 'qrcode';
import { useClinic } from '../../../contexts/ClinicContext';
import WebsiteCatalogPanel from './WebsiteCatalogPanel';
import WebsiteOrdersPanel from './WebsiteOrdersPanel';

/**
 * WEBSITE — Site Connect (269). A clinic's own public website sends appointment
 * requests into VetHub Core and (Phase 2) sells its real stock.
 *
 * ⚠️ The secret key and the webhook signing secret are shown ONCE, on the
 * response that creates or rotates them, and that is the literal truth: only a
 * sha256 of the secret is stored. So the reveal panel below is modal-ish and
 * insistent, and it is the only place either string ever appears. A settings
 * page that could redisplay them would leak both to anyone who got one look at
 * the screen — the same rule WhatsappTab follows for its access token.
 */

const FIELD =
  'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 ' +
  'text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/25 focus:border-seafoam/40';
const LABEL = 'text-[9px] font-black text-seafoam uppercase tracking-widest px-0.5';
const CARD = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm';

const DELIVERY_TONE: Record<SiteDelivery['status'], string> = {
  DELIVERED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  PENDING: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  FAILED: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  DEAD: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
};

const CopyRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => {
  const [copied, setCopied] = React.useState(false);
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <code className={`flex-1 min-w-0 truncate bg-slate-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-[11px] ${mono ? 'font-mono' : 'font-bold'} text-pine dark:text-zinc-100`}>
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="shrink-0 p-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-seafoam hover:border-seafoam/50"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
};

/**
 * 297 — THE LINK BEHIND THE CLINIC'S QR CODE.
 *
 * `/c/<subdomain>` is a public landing that confirms whose code was scanned,
 * says what a client account is for, and offers both doors — signing up there
 * attaches the owner to this clinic automatically, with no directory search.
 *
 * The URL is what gets printed, so it is shown plainly and copyably rather than
 * hidden behind a generated image. Rendering the QR itself needs a library the
 * app does not carry yet — deliberately not added here without asking, because
 * a new dependency means a full `npm ci` on a build box that is already the
 * slowest part of shipping.
 */
const ClientLinkPanel: React.FC = () => {
  const { clinics, selectedClinicIds } = useClinic();
  const clinic = clinics.find((c) => String(c.id) === String(selectedClinicIds[0])) ?? clinics[0];
  const slug = (clinic as any)?.subdomain;
  const [copied, setCopied] = useState(false);
  if (!slug) return null;

  const url = `${window.location.origin}/c/${slug}`;

  /**
   * 298 — the QR itself, rendered to a data URI in the browser.
   *
   * Client-side on purpose: the URL is not a secret, so a round trip would buy
   * nothing, and a data URI is directly right-clickable and directly
   * downloadable without a blob or an object URL to revoke.
   *
   * Sized and error-corrected for PRINT, not for screen — `level: 'H'` survives
   * a logo sticker, a fold or a scuffed receipt, and 512px gives a poster
   * something to scale from. A QR that only scans on a clean monitor is not
   * the artefact being asked for.
   */
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'H', width: 512, margin: 2 })
      .then((d) => { if (alive) setQr(d); })
      .catch(() => { if (alive) setQr(null); });
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the link and copy it manually.');
    }
  };

  return (
    <div className={CARD}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-pine/10 text-pine dark:text-seafoam shrink-0"><Link2 size={16} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">Your client link</h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed max-w-2xl">
            Print this on a poster, a receipt or a collar tag — or turn it into a QR code.
            It opens a page naming {clinic?.name || 'this clinic'}, and anyone who signs up
            from it is connected to you automatically.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <code className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-pine dark:text-zinc-200 break-all">
              {url}
            </code>
            <button
              onClick={copy}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:border-pine/40 transition-colors"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={url} target="_blank" rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:border-pine/40 transition-colors"
            >
              Preview
            </a>
          </div>
        </div>

        {/* The printable artefact. Shown small but generated at 512px, so the
            download is worth putting on a poster. */}
        {qr && (
          <div className="shrink-0 flex flex-col items-center gap-2">
            <img
              src={qr}
              alt={`QR code linking to ${clinic?.name || 'this clinic'}'s client page`}
              className="w-28 h-28 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white p-1.5"
            />
            <a
              href={qr}
              download={`${slug}-client-qr.png`}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:border-pine/40 transition-colors"
            >
              Download PNG
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

const WebsiteTab: React.FC = () => {
  const [connections, setConnections] = React.useState<SiteConnection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);

  /** Set once, right after create/rotate. The only time these strings exist. */
  const [reveal, setReveal] = React.useState<{ name: string; secretKey: string; webhookSecret?: string | null } | null>(null);

  /**
   * Which connection is being edited, and the draft.
   *
   * ⚠️ This screen could ISSUE a webhook URL but never CHANGE one. The API had
   * supported it since day one; the card only ever offered Test / New keys /
   * Disconnect, so a clinic that connected a site and then wanted webhooks had
   * to disconnect and start over — losing its keys to add a URL.
   */
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState({ name: '', siteUrl: '', origins: '', webhookUrl: '' });

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [deliveries, setDeliveries] = React.useState<Record<string, SiteDelivery[]>>({});

  const [form, setForm] = React.useState({
    name: '', siteUrl: '', origins: '', webhookUrl: '',
    environment: 'LIVE' as 'LIVE' | 'TEST',
  });

  const load = React.useCallback(() => {
    setLoading(true);
    siteConnectAPI.listConnections()
      .then((r) => setConnections(r?.data?.connections ?? []))
      .catch(() => toast.error('Could not load website connections'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load]);

  const create = async () => {
    if (!form.name.trim()) return toast.error('Give the website a name');
    if (!form.siteUrl.trim()) return toast.error('The website address is required');
    setCreating(true);
    try {
      const r = await siteConnectAPI.createConnection({
        name: form.name.trim(),
        siteUrl: form.siteUrl.trim(),
        allowedOrigins: form.origins.split(',').map((s) => s.trim()).filter(Boolean),
        environment: form.environment,
        webhookUrl: form.webhookUrl.trim() || null,
      });
      if (r?.data) {
        setReveal({ name: r.data.connection.name, secretKey: r.data.secretKey, webhookSecret: r.data.webhookSecret });
        setForm({ name: '', siteUrl: '', origins: '', webhookUrl: '', environment: 'LIVE' });
        setShowForm(false);
        load();
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleSurface = async (c: SiteConnection, key: 'appointmentsEnabled' | 'catalogEnabled' | 'ordersEnabled') => {
    setBusy(true);
    try {
      await siteConnectAPI.updateConnection(c.id, { [key]: !c[key] } as any);
      setConnections((list) => list.map((x) => (x.id === c.id ? { ...x, [key]: !c[key] } : x)));
    } catch {
      /* the API layer has already surfaced it */
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (c: SiteConnection) => {
    if (editingId === c.id) { setEditingId(null); return; }
    setEditingId(c.id);
    setEdit({
      name: c.name,
      siteUrl: c.siteUrl,
      origins: (c.allowedOrigins ?? []).join(', '),
      webhookUrl: c.webhookUrl ?? '',
    });
  };

  const saveEdit = async (c: SiteConnection) => {
    setBusy(true);
    try {
      const r = await siteConnectAPI.updateConnection(c.id, {
        name: edit.name.trim(),
        siteUrl: edit.siteUrl.trim(),
        allowedOrigins: edit.origins.split(',').map((x) => x.trim()).filter(Boolean),
        webhookUrl: edit.webhookUrl.trim() || null,
      });
      /**
       * ⚠️ A NEW webhook address gets a NEW signing secret, and this is the
       * only moment it exists in readable form. Surface it in the same reveal
       * panel as a fresh key, or the clinic saves the URL and has nothing to
       * verify the webhooks with.
       */
      if (r?.data?.webhookSecret) {
        setReveal({ name: c.name, secretKey: '', webhookSecret: r.data.webhookSecret });
      } else {
        toast.success('Website settings saved');
      }
      setEditingId(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (c: SiteConnection) => {
    const ok = await dialog.confirm({
      title: 'Issue new keys?',
      // Say the cost plainly. Someone reading "rotate" may not picture the site
      // going down the second they press it.
      message: `The current keys stop working immediately, and ${c.name} will stop reaching VetHub Core until you paste the new secret into it. The new key is shown once.`,
      confirmLabel: 'Issue new keys',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await siteConnectAPI.rotateKeys(c.id);
      if (r?.data) {
        setReveal({ name: r.data.connection.name, secretKey: r.data.secretKey });
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (c: SiteConnection) => {
    const ok = await dialog.confirm({
      title: `Disconnect ${c.name}?`,
      message: 'Its keys stop working at once and the website can no longer send appointment requests. Requests already in your inbox are kept.',
      confirmLabel: 'Disconnect',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await siteConnectAPI.revokeConnection(c.id);
      toast.success('Website disconnected');
      load();
    } finally {
      setBusy(false);
    }
  };

  const test = async (c: SiteConnection) => {
    setBusy(true);
    try {
      await siteConnectAPI.sendTestEvent(c.id);
      toast.success('Test event sent — check the delivery log below');
      openDeliveries(c.id, true);
    } finally {
      setBusy(false);
    }
  };

  const openDeliveries = async (id: string, force = false) => {
    const next = expanded === id && !force ? null : id;
    setExpanded(next);
    if (!next) return;
    try {
      const r = await siteConnectAPI.listDeliveries(id);
      setDeliveries((d) => ({ ...d, [id]: r?.data?.deliveries ?? [] }));
    } catch {
      /* handled upstream */
    }
  };

  const resend = async (connId: string, deliveryId: string) => {
    setBusy(true);
    try {
      await siteConnectAPI.resendDelivery(connId, deliveryId);
      toast.success('Queued for another attempt');
      openDeliveries(connId, true);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={`${CARD} flex items-center justify-center py-16`}>
        <Loader2 size={18} className="animate-spin text-seafoam" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 297 — the link a QR code points at ────────────────────────────── */}
      <ClientLinkPanel />

      {/* ── what this is, in the clinic's own terms ───────────────────────── */}
      <div className={CARD}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-seafoam/10 text-seafoam shrink-0"><Globe size={16} /></div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-pine dark:text-zinc-100">Your website</h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed max-w-2xl">
              Connect the clinic's own website so visitors can request appointments without
              phoning. Requests land in <strong>Appointments → Website</strong>; you accept
              one and it becomes a real booking. Nothing is confirmed until you say so.
            </p>
          </div>
        </div>
      </div>

      {/* ── the reveal: the one moment these strings exist ─────────────────── */}
      {reveal && (
        <div className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest">
              {reveal.secretKey ? 'Copy these now — they are not shown again' : 'Copy this now — it is not shown again'}
            </h4>
          </div>
          {/* ⚠️ The wording follows what is actually on screen. Saving a webhook
              address reveals only a signing secret, and telling someone to
              "issue new keys" there would have them rotate a working API key
              they never lost. */}
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
            {reveal.secretKey ? (
              <>VetHub Core stores only a fingerprint of the secret key, so there is no way to look
              it up later. Send it to whoever builds <strong>{reveal.name}</strong> through a
              password manager — not email or WhatsApp. If you lose it, issue new keys.</>
            ) : (
              <>This signs the events we send <strong>{reveal.name}</strong>, so the site can prove
              they came from us. It is stored encrypted and cannot be read back. Send it through a
              password manager — not email or WhatsApp. If you lose it, save the webhook address
              again to issue a new one.</>
            )}
          </p>
          {reveal.secretKey && <CopyRow label="Secret key (server-side only)" value={reveal.secretKey} />}
          {reveal.webhookSecret && <CopyRow label="Webhook signing secret" value={reveal.webhookSecret} />}
          <button
            type="button"
            onClick={() => setReveal(null)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest"
          >
            I've stored them
          </button>
        </div>
      )}

      {/* ── connect a website ──────────────────────────────────────────────── */}
      {showForm ? (
        <div className={`${CARD} space-y-3`}>
          <h4 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Connect a website</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className={LABEL}>Name</p>
              <input className={FIELD} value={form.name} placeholder="Our public site"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <p className={LABEL}>Website address</p>
              <input className={FIELD} value={form.siteUrl} placeholder="https://yourclinic.co.ke"
                onChange={(e) => setForm((f) => ({ ...f, siteUrl: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <p className={LABEL}>Allowed origins (optional, comma separated)</p>
              <input className={FIELD} value={form.origins} placeholder="https://yourclinic.co.ke"
                onChange={(e) => setForm((f) => ({ ...f, origins: e.target.value }))} />
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Only needed if the site talks to VetHub Core from the visitor's browser.
                Leave empty when it calls from its own server, which is the safer way.
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className={LABEL}>Webhook address (optional)</p>
              <input className={FIELD} value={form.webhookUrl} placeholder="https://yourclinic.co.ke/api/vethub/webhook"
                onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))} />
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Where we tell the site that you accepted, declined or moved a request, so it can
                let the visitor know. Must be https.
              </p>
            </div>
            <div>
              <p className={LABEL}>Environment</p>
              <select className={FIELD} value={form.environment}
                onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value as 'LIVE' | 'TEST' }))}>
                <option value="LIVE">Live</option>
                <option value="TEST">Test — for the developer to build against</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={create} disabled={creating}
              className="px-4 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
              {creating ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
              Connect and issue keys
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-800 text-seafoam text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:border-seafoam/50">
          <Plus size={13} /> Connect a website
        </button>
      )}

      {/* ── the connections ────────────────────────────────────────────────── */}
      {connections.length === 0 && !showForm && (
        <div className={`${CARD} text-center py-10`}>
          <Globe size={24} className="text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">No website connected yet</p>
        </div>
      )}

      {connections.map((c) => (
        <div key={c.id} className={`${CARD} space-y-3 ${c.revokedAt ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-pine dark:text-zinc-100 truncate">{c.name}</h4>
                {c.environment === 'TEST' && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">Test</span>
                )}
                {c.revokedAt && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">Disconnected</span>
                )}
              </div>
              <a href={c.siteUrl} target="_blank" rel="noreferrer"
                className="text-[11px] text-slate-400 hover:text-seafoam inline-flex items-center gap-1 mt-0.5">
                {c.siteUrl} <ExternalLink size={10} />
              </a>
              <p className="text-[10px] text-slate-400 mt-1">
                {c.lastSeenAt ? `Last heard from ${new Date(c.lastSeenAt).toLocaleString()}` : 'Has not called yet'}
              </p>
            </div>
            {!c.revokedAt && (
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => openEdit(c)} disabled={busy}
                  title="Change the address, origins or webhook"
                  className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5 ${
                    editingId === c.id
                      ? 'bg-pine text-white border-pine'
                      : 'border-slate-200 dark:border-zinc-700 text-pine dark:text-zinc-200'
                  }`}>
                  <SlidersHorizontal size={11} /> {editingId === c.id ? 'Close' : 'Settings'}
                </button>
                <button type="button" onClick={() => test(c)} disabled={busy || !c.webhookEnabled}
                  title={c.webhookEnabled ? 'Send a test event' : 'Add a webhook address first'}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-seafoam text-[9px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5">
                  <Send size={11} /> Test
                </button>
                <button type="button" onClick={() => rotate(c)} disabled={busy}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-amber-600 text-[9px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5">
                  <RefreshCw size={11} /> New keys
                </button>
                <button type="button" onClick={() => revoke(c)} disabled={busy}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-rose-500 text-[9px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5">
                  <Trash2 size={11} /> Disconnect
                </button>
              </div>
            )}
          </div>

          {editingId === c.id && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className={LABEL}>Name</p>
                  <input className={FIELD} value={edit.name}
                    onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <p className={LABEL}>Website address</p>
                  <input className={FIELD} value={edit.siteUrl}
                    onChange={(e) => setEdit((f) => ({ ...f, siteUrl: e.target.value }))} />
                </div>
              </div>
              <div>
                <p className={LABEL}>Allowed origins (comma separated)</p>
                <input className={FIELD} value={edit.origins} placeholder="https://yourclinic.co.ke"
                  onChange={(e) => setEdit((f) => ({ ...f, origins: e.target.value }))} />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Only needed if the site calls us from the visitor's browser. Leave empty when it
                  calls from its own server, which is the safer way.
                </p>
              </div>
              <div>
                <p className={`${LABEL} flex items-center gap-1.5`}><Webhook size={11} /> Webhook address</p>
                <input className={FIELD} value={edit.webhookUrl}
                  placeholder="https://yourclinic.co.ke/api/vethub/webhook"
                  onChange={(e) => setEdit((f) => ({ ...f, webhookUrl: e.target.value }))} />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Where we tell the site you accepted, declined or moved a request, so it can let the
                  visitor know. Must be https.
                  {' '}<strong className="text-amber-600">Saving a new address issues a new signing
                  secret, shown once</strong> — the site needs it to verify what we send.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => saveEdit(c)} disabled={busy}
                  className="px-4 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                </button>
                <button type="button" onClick={() => setEditingId(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CopyRow label="Publishable key (safe in a browser)" value={c.publishableKey} />
            <div>
              <p className={LABEL}>Secret key</p>
              <div className="mt-1 bg-slate-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-400">
                ••••••••••••••••{c.secretKeyLast4}
                <span className="ml-2 font-sans font-bold not-italic">stored as a fingerprint only</span>
              </div>
            </div>
          </div>

          {/* Surfaces. Each one is a real switch, not decoration — the API reads
              them on every call and a website is told which are on. */}
          <div>
            <p className={LABEL}>What this website may do</p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {([
                // The third value is whether the surface is BUILT. Orders are
                // Phase 3 — shown, disabled, and labelled, never hidden.
                ['appointmentsEnabled', 'Appointment requests', true],
                ['catalogEnabled', 'Product catalogue', true],
                ['ordersEnabled', 'Online orders', true],
              ] as const).map(([key, label, ready]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy || !!c.revokedAt || !ready}
                  onClick={() => toggleSurface(c, key)}
                  title={undefined}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all disabled:cursor-not-allowed ${
                    c[key]
                      ? 'bg-pine text-white border-pine'
                      : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-700'
                  } ${!ready ? 'opacity-40' : ''}`}
                >
                  {label}{!ready && ' · soon'}
                </button>
              ))}
            </div>
          </div>

          {/* Deliveries */}
          <div className="pt-1">
            <button type="button" onClick={() => openDeliveries(c.id)}
              className="text-[9px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5">
              <Radio size={11} /> {expanded === c.id ? 'Hide' : 'Show'} what we sent this website
            </button>
            {expanded === c.id && (
              <div className="mt-2 border border-slate-200 dark:border-zinc-800 rounded-lg divide-y divide-slate-100 dark:divide-zinc-800">
                {(deliveries[c.id] ?? []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 p-3">Nothing sent yet.</p>
                ) : (
                  (deliveries[c.id] ?? []).map((d) => (
                    <div key={d.id} className="flex items-center gap-2 p-2.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${DELIVERY_TONE[d.status]}`}>
                        {d.status}
                      </span>
                      <code className="text-[10px] font-mono text-pine dark:text-zinc-200 truncate">{d.eventType}</code>
                      <span className="text-[10px] text-slate-400">
                        {new Date(d.createdAt).toLocaleString()}
                        {d.attempts > 0 && ` · ${d.attempts} attempt${d.attempts === 1 ? '' : 's'}`}
                        {d.lastStatusCode != null && ` · HTTP ${d.lastStatusCode}`}
                      </span>
                      {d.status !== 'DELIVERED' && (
                        <button type="button" onClick={() => resend(c.id, d.id)} disabled={busy}
                          className="ml-auto px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 text-seafoam text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                          <RotateCw size={10} /> Resend
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* ── what of the shop is on the website ──────────────────────────────── */}
      {connections.length > 0 && (
        <div className={`${CARD} space-y-3`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-seafoam/10 text-seafoam shrink-0"><ShoppingBag size={16} /></div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100">Products on your website</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed max-w-2xl">
                Your stock, managed here as always — pick which of it your website shows. Prices and
                availability follow whatever you do in Inventory, so there is nothing to keep in step.
              </p>
            </div>
          </div>
          <WebsiteCatalogPanel enabled={connections.some((c) => c.catalogEnabled && !c.revokedAt)} />
        </div>
      )}

      {/* ── what customers have ordered ─────────────────────────────────────── */}
      {connections.length > 0 && (
        <div className={`${CARD} space-y-3`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-seafoam/10 text-seafoam shrink-0"><ShoppingCart size={16} /></div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100">Orders from your website</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed max-w-2xl">
                Your website never takes money and never moves your stock. An order waits here until
                you ring it up, which sells it exactly as if you had done it at the counter.
              </p>
            </div>
          </div>
          <WebsiteOrdersPanel enabled={connections.some((c) => c.ordersEnabled && !c.revokedAt)} />
        </div>
      )}

      {/* ── the one thing an owner must not misread ─────────────────────────── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-3">
        <ShieldAlert size={14} className="text-seafoam shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
          The secret key lets a website book in your clinic's name. It belongs on the website's
          own server, never in a page a visitor can read. If you think it has been seen by
          anyone else, press <strong>New keys</strong> — the old pair stops working straight away.
        </p>
      </div>
    </div>
  );
};

export default WebsiteTab;

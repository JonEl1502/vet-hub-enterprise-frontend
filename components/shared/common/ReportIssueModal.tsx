import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Upload, LifeBuoy, Loader2, Bug, CreditCard, Database, KeyRound,
  Lightbulb, MessageSquare, Search, Check, Camera,
} from 'lucide-react';
import { supportTicketsAPI, type TicketKind } from '../../../services/modules/supportTickets.api';
import { uploadsAPI } from '../../../services/modules/uploads.api';
import { invoicesAPI, type InvoiceRow } from '../../../services/modules/invoices.api';
import { toast } from '../../../services';

/**
 * REPORT AN ISSUE — one channel, several shapes.
 *
 * The payment-issue modal already filed support tickets and admins already
 * triaged them, so this reuses that channel rather than inventing a second
 * inbox nobody watches (user, 2026-09-12: *"use same channel as for Report a
 * payment issue"*).
 *
 * What changes is the FORM. An issue type is not a label to sort by afterwards
 * — it decides what we need in order to act:
 *
 *   PAYMENT  — which invoice or receipt, and the provider reference, so an
 *              admin can reconcile instead of asking.
 *   BUG      — a screenshot, and the route/version/browser captured for them.
 *   DATA     — what record, and what it should say.
 *   ACCESS   — who, and what they cannot reach.
 *   FEATURE  — free text; nothing else helps.
 *
 * Asking every question every time is how a report form gets abandoned; asking
 * none is how a ticket comes back "can you send a screenshot?" three days
 * later.
 */

export interface TicketTxnOption {
  channel: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  packageName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  /** Open straight onto one type — the payment card's own button passes PAYMENT. */
  initialKind?: TicketKind;
  /** Pre-fill provider + reference (e.g. from a stuck PENDING attempt). */
  prefill?: { provider?: string; reference?: string };
  /** Recent payment attempts the user can attach so admins can reconcile on resolve. */
  transactions?: TicketTxnOption[];
  /** Hide the type picker — used when the caller has already chosen one. */
  lockKind?: boolean;
}

const KINDS: {
  id: TicketKind;
  label: string;
  blurb: string;
  icon: React.FC<any>;
  /** Bright, distinct per type — the same trick the visit search uses. */
  on: string;
  off: string;
}[] = [
  {
    id: 'BUG', label: 'Something is broken', blurb: 'A page, button or number is wrong',
    icon: Bug,
    on: 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/25',
    off: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20',
  },
  {
    id: 'PAYMENT', label: 'Payment', blurb: 'Paid but it did not reflect',
    icon: CreditCard,
    on: 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25',
    off: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
  },
  {
    id: 'DATA', label: 'Wrong data', blurb: 'A record shows the wrong thing',
    icon: Database,
    on: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25',
    off: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
  },
  {
    id: 'ACCESS', label: 'Access', blurb: 'Cannot reach something I should',
    icon: KeyRound,
    on: 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25',
    off: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 hover:bg-sky-500/20',
  },
  {
    id: 'FEATURE', label: 'Idea', blurb: 'Something that would help',
    icon: Lightbulb,
    on: 'bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/25',
    off: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/20',
  },
  {
    id: 'OTHER', label: 'Something else', blurb: '',
    icon: MessageSquare,
    on: 'bg-pine text-white border-pine shadow-md dark:bg-zinc-100 dark:text-pine dark:border-zinc-100',
    off: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700',
  },
];

/** What the textarea should ask for, per type. A generic prompt gets a generic report. */
const PROMPT: Record<TicketKind, { label: string; placeholder: string }> = {
  BUG: {
    label: 'What did you do, and what happened instead?',
    placeholder: 'e.g. I deleted a service on the bill tab and the total still shows the old amount.',
  },
  PAYMENT: {
    label: 'What happened?',
    placeholder: 'e.g. I paid via M-Pesa but my plan still shows inactive.',
  },
  DATA: {
    label: 'Which record, and what should it say?',
    placeholder: 'e.g. Invoice INV-2026-0042 shows KES 4,000 but the visit was 3,500.',
  },
  ACCESS: {
    label: 'What can you not reach, and what were you trying to do?',
    placeholder: 'e.g. My receptionist cannot open Reports — she needs the daily takings.',
  },
  FEATURE: {
    label: 'What would help?',
    placeholder: 'e.g. Let me filter the visits list by vet.',
  },
  OTHER: { label: 'Tell us what is going on', placeholder: '' },
};

const MAX_MB = 8;

const ReportIssueModal: React.FC<Props> = ({
  isOpen, onClose, onSubmitted, initialKind = 'BUG', prefill, transactions, lockKind = false,
}) => {
  const [kind, setKind] = useState<TicketKind>(initialKind);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [currency, setCurrency] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // Invoice tagging (PAYMENT / DATA) — searchable, because a clinic with 400
  // invoices cannot find one in a <select>.
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invQ, setInvQ] = useState('');
  const [taggedInvoices, setTaggedInvoices] = useState<InvoiceRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setKind(initialKind);
      setProvider(prefill?.provider ?? '');
      setReference(prefill?.reference ?? '');
      setAmount(undefined);
      setCurrency('');
      setTaggedInvoices([]);
      setInvQ('');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Invoices are fetched LAZILY, the first time a type that can tag one is
   * chosen — opening "Report an issue" to describe a broken button should not
   * pull the clinic's whole invoice list down the wire.
   */
  const tagsInvoices = kind === 'PAYMENT' || kind === 'DATA';
  useEffect(() => {
    if (!isOpen || !tagsInvoices || loadedFor.current === 'done') return;
    loadedFor.current = 'done';
    setLoadingInvoices(true);
    invoicesAPI.list(undefined, { silent: true } as any)
      .then(r => { if (r.success && r.data?.invoices) setInvoices(r.data.invoices); })
      .catch(() => { /* tagging is a convenience; the ticket files without it */ })
      .finally(() => setLoadingInvoices(false));
  }, [isOpen, tagsInvoices]);

  const invoiceMatches = useMemo(() => {
    const q = invQ.trim().toLowerCase();
    if (!q) return [];
    return invoices
      .filter(i => !taggedInvoices.some(t => t.id === i.id))
      .filter(i =>
        (i.number || '').toLowerCase().includes(q) ||
        (i.billNumber || '').toLowerCase().includes(q) ||
        String(i.total).includes(q))
      .slice(0, 6);
  }, [invQ, invoices, taggedInvoices]);

  if (!isOpen) return null;

  const meta = KINDS.find(k => k.id === kind) ?? KINDS[0];
  const prompt = PROMPT[kind];

  const pickTxn = (ref: string) => {
    const t = transactions?.find((x) => x.reference === ref);
    setReference(ref);
    if (t) { setProvider(t.channel); setAmount(t.amount); setCurrency(t.currency); }
    else { setAmount(undefined); setCurrency(''); }
  };

  const chooseFile = (f: File | null) => {
    if (f && f.size > MAX_MB * 1024 * 1024) {
      toast.error(`That file is over ${MAX_MB}MB — please attach a smaller one.`);
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!message.trim()) {
      toast.error('Please describe the issue.');
      return;
    }
    setBusy(true);
    try {
      let screenshotUrl: string | undefined;
      let screenshotKey: string | undefined;
      if (file) {
        // 'payment-proof' is the existing upload scope this channel uses; a
        // bug screenshot rides the same bucket rather than needing a new one.
        const up = await uploadsAPI.upload(file, 'payment-proof');
        screenshotUrl = up.publicUrl;
        screenshotKey = up.key;
      }
      /**
       * WHERE THEY WERE STANDING, captured rather than asked for. Half of a
       * bug report is the route and the browser, and nobody types those
       * accurately — "the products page" is three different screens.
       */
      const context: Record<string, unknown> = {
        route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        reportedAt: new Date().toISOString(),
      };
      if (taggedInvoices.length) {
        context.invoices = taggedInvoices.map(i => ({
          id: i.id,
          number: i.number || i.billNumber || null,
          total: i.total,
          outstanding: i.outstanding,
          status: i.status,
        }));
      }

      const res = await supportTicketsAPI.create({
        kind,
        message: message.trim(),
        attemptReference: reference.trim() || undefined,
        provider: provider || undefined,
        amount,
        currency: currency || undefined,
        screenshotUrl,
        screenshotKey,
        context,
      });
      if (res.success) {
        toast.success('Reported — our team will follow up.');
        setMessage('');
        setReference('');
        setProvider('');
        setAmount(undefined);
        setCurrency('');
        setFile(null);
        setTaggedInvoices([]);
        onSubmitted?.();
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not submit the report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-pine dark:text-zinc-100 flex items-center gap-2">
            <LifeBuoy size={18} className="text-seafoam" /> {lockKind ? 'Report a payment issue' : 'Report an issue'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {!lockKind && (
          <div className="mb-4">
            <label className="field-label">What kind of issue?</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {KINDS.map(k => {
                const active = kind === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    title={k.blurb || k.label}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
                      active ? k.on : k.off
                    }`}
                  >
                    <k.icon size={11} /> {k.label}
                  </button>
                );
              })}
            </div>
            {meta.blurb && <p className="text-[11px] text-slate-400 mt-1.5">{meta.blurb}.</p>}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="field-label">{prompt.label}</label>
            <textarea
              className="field-textarea"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={prompt.placeholder}
            />
          </div>

          {/* ── Invoices / receipts, searchable ─────────────────────────────
              Only for the types where a document IS the issue. */}
          {tagsInvoices && (
            <div>
              <label className="field-label">
                Tag an invoice or receipt {kind === 'PAYMENT' ? '(recommended)' : '(optional)'}
              </label>
              {taggedInvoices.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {taggedInvoices.map(i => (
                    <span key={i.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-black">
                      {i.number || i.billNumber || `#${i.id}`}
                      <button
                        type="button"
                        onClick={() => setTaggedInvoices(t => t.filter(x => x.id !== i.id))}
                        className="hover:text-rose-500"
                        aria-label="Remove"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  className="field-input !pl-8"
                  value={invQ}
                  onChange={e => setInvQ(e.target.value)}
                  placeholder={loadingInvoices ? 'Loading invoices…' : 'Search by invoice or bill number, or amount…'}
                />
              </div>
              {/* Rendered inline, not in a portal: this modal does not scroll-clip. */}
              {invQ.trim() && (
                <div className="mt-1 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-44 overflow-y-auto custom-scrollbar">
                  {invoiceMatches.length === 0 ? (
                    <p className="text-[10px] font-bold text-slate-400 text-center py-3">
                      {loadingInvoices ? 'Loading…' : `Nothing matches “${invQ.trim()}”.`}
                    </p>
                  ) : invoiceMatches.map(i => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => { setTaggedInvoices(t => [...t, i]); setInvQ(''); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-seafoam/10 border-b border-slate-50 dark:border-zinc-800 last:border-0"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                          {i.number || i.billNumber || `Invoice ${i.id}`}
                        </span>
                        <span className="block text-[9px] font-bold text-slate-400">
                          {i.status} · {new Date(i.issuedAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        <span className="text-seafoam font-black font-mono text-[10px]">{Number(i.total).toLocaleString()}</span>
                        <Check size={12} className="text-seafoam" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {kind === 'PAYMENT'
                  ? 'Tagging the exact document lets us reconcile it rather than ask you for it.'
                  : 'If a specific document is wrong, tag it.'}
              </p>
            </div>
          )}

          {/* ── Payment-only: the attempt, provider and reference ───────── */}
          {kind === 'PAYMENT' && transactions && transactions.length > 0 && (
            <div>
              <label className="field-label">Attach the payment attempt</label>
              <select
                className="field-select"
                value={transactions.some((t) => t.reference === reference) ? reference : ''}
                onChange={(e) => pickTxn(e.target.value)}
              >
                <option value="">— pick a recent payment —</option>
                {transactions.map((t, i) => (
                  <option key={`${t.reference}-${i}`} value={t.reference}>
                    {t.channel} · {t.currency} {t.amount} · {t.status} · {new Date(t.createdAt).toLocaleDateString()}{t.packageName ? ` · ${t.packageName}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Attaching the exact payment lets us reconcile and activate it on resolve.</p>
            </div>
          )}
          {kind === 'PAYMENT' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Provider (optional)</label>
                <select className="field-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
                  <option value="">—</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="PAYSTACK">Paystack</option>
                  <option value="PESAPAL">Pesapal</option>
                </select>
              </div>
              <div>
                <label className="field-label">Reference (optional)</label>
                <input
                  className="field-input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="M-Pesa code / ref"
                />
              </div>
            </div>
          )}

          {/* ── Screenshot ───────────────────────────────────────────────────
              Asked for on every type, but PRESSED on a bug: a screenshot is
              usually the whole report, and a ticket that comes back three days
              later asking for one has cost everybody a week (user,
              2026-09-12: *"some reporting a bug ask for screenshot if
              possible"*). Never required — someone reporting from a phone
              mid-consult may not have one, and a refused form gets no report
              at all. */}
          <div>
            <label className="field-label flex items-center gap-1.5">
              {kind === 'BUG' ? <Camera size={11} className="text-rose-500" /> : null}
              {kind === 'BUG' ? 'Screenshot — please attach one if you can' : kind === 'PAYMENT' ? 'Payment screenshot (optional)' : 'Screenshot (optional)'}
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-pine file:text-white file:text-xs file:font-bold"
            />
            {file
              ? <p className="text-[11px] text-slate-400 mt-1">{file.name}</p>
              : kind === 'BUG' && (
                <p className="text-[11px] text-rose-500/80 dark:text-rose-400/80 mt-1 font-semibold">
                  A picture of the screen is usually the whole report — it is the difference between
                  a fix today and an email thread. You can still send without one.
                </p>
              )}
          </div>

          {kind === 'BUG' && (
            <p className="text-[10px] text-slate-400 leading-relaxed">
              We attach the page you are on, your screen size and your browser automatically — no
              need to type them.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-bold">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-xl bg-pine text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportIssueModal;

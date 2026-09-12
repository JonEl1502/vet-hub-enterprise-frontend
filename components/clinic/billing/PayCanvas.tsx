import React from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, CreditCard, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { vethubPaystackAPI, type PaystackInitiateResult } from '../../../services/modules/vethubPaystack.api';
import { toast } from '../../../services';

/**
 * THE PAYMENT CANVAS — ours for mobile money, Paystack's for cards.
 *
 * "Can we have both canvases" (user, 2026-09-12), after landing on
 * checkout.paystack.com and wanting the step to look like VetHubCore.
 *
 * ── Why the split is not a compromise ────────────────────────────────────
 * MOBILE MONEY is ours end to end: we take a phone number, the server calls
 * Paystack's `/charge`, the customer approves on their handset. Nothing that
 * enters this DOM is payment-card data, so there is no PCI consequence — and
 * in this market it is what almost everyone actually uses.
 *
 * CARDS open Paystack's INLINE overlay on this page. It looks like a modal of
 * ours and never leaves the URL, but the PAN is typed into their iframe, not
 * our inputs. Building our own card form would move VetHubCore from PCI SAQ A
 * to SAQ D — an annual audit, segmentation, pen-testing — to save a customer
 * one visual seam. That is the wrong trade, and Paystack's terms require
 * certification for raw PAN capture anyway.
 *
 * ⚠️ A `/charge` RESPONSE IS NOT A PAYMENT. `pay_offline` / `send_otp` /
 * `pending` all mean "the handset has been asked". Settlement arrives by
 * webhook, so this polls `status` and celebrates nothing until it says
 * SUCCESS.
 */

const INLINE_SRC = 'https://js.paystack.co/v2/inline.js';

/** Load Paystack Inline once, lazily — a card payment is the rare path. */
const loadInline = (): Promise<any> =>
  new Promise((resolve, reject) => {
    const w = window as any;
    if (w.PaystackPop) return resolve(w.PaystackPop);
    const existing = document.querySelector(`script[src="${INLINE_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).PaystackPop));
      existing.addEventListener('error', () => reject(new Error('Paystack failed to load')));
      return;
    }
    const el = document.createElement('script');
    el.src = INLINE_SRC;
    el.async = true;
    el.onload = () => resolve((window as any).PaystackPop);
    el.onerror = () => reject(new Error('Paystack failed to load'));
    document.head.appendChild(el);
  });

type Method = 'mpesa' | 'airtel' | 'card';
type Phase = 'choose' | 'starting' | 'waiting' | 'done' | 'failed';

const METHODS: { id: Method; label: string; hint: string; icon: React.FC<any> }[] = [
  { id: 'mpesa', label: 'M-Pesa', hint: 'STK push to your phone', icon: Smartphone },
  { id: 'airtel', label: 'Airtel Money', hint: 'Prompt on your phone', icon: Smartphone },
  { id: 'card', label: 'Card', hint: 'Visa / Mastercard', icon: CreditCard },
];

interface Props {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  email: string;
  /** Prefills the number; the payer can change it. */
  defaultPhone?: string;
  packageId: string | number;
  billingOptionId?: string | number;
  cycle?: any;
  addOnPackageIds?: (string | number)[];
  planName: string;
  amountLabel: string;
  onPaid: () => void;
}

const PayCanvas: React.FC<Props> = ({
  open, onClose, clinicId, email, defaultPhone, packageId, billingOptionId, cycle,
  addOnPackageIds, planName, amountLabel, onPaid,
}) => {
  const [method, setMethod] = React.useState<Method>('mpesa');
  const [phone, setPhone] = React.useState(defaultPhone ?? '');
  const [phase, setPhase] = React.useState<Phase>('choose');
  const [note, setNote] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (open) { setPhase('choose'); setNote(null); setPhone(defaultPhone ?? ''); }
  }, [open, defaultPhone]);

  // Always clear the poll — leaving one running after close keeps hitting the
  // API from a screen nobody is looking at.
  React.useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = (reference: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 4;
      try {
        const r = await vethubPaystackAPI.getStatus(reference, { silent: true } as any);
        const st = r?.data?.status;
        if (st === 'SUCCESS') {
          clearInterval(pollRef.current!);
          setPhase('done');
          onPaid();
          return;
        }
        if (st === 'FAILED' || st === 'CANCELLED' || st === 'EXPIRED') {
          clearInterval(pollRef.current!);
          setNote(r?.data?.resultDesc || 'The payment did not go through.');
          setPhase('failed');
          return;
        }
      } catch { /* a blip must not end the wait — the webhook is the truth */ }
      /**
       * ⚠️ STOP ASKING after three minutes, but do NOT call it failed. An STK
       * push can be approved late, and the webhook settles it whenever it
       * lands — telling someone it failed when it may yet succeed is how a
       * customer pays twice.
       */
      if (elapsed >= 180) {
        clearInterval(pollRef.current!);
        setNote('Still waiting on the network. If you approved it, the plan activates by itself — you can close this.');
      }
    }, 4000);
  };

  const pay = async () => {
    setPhase('starting');
    setNote(null);
    try {
      const res = await vethubPaystackAPI.initiate(clinicId, {
        packageId,
        billingOptionId,
        cycle,
        email,
        phone: method === 'card' ? undefined : phone.trim(),
        method: method === 'card' ? 'hosted' : 'mobile_money',
        mobileProvider: method === 'airtel' ? 'airtel' : 'mpesa',
        addOnPackageIds,
      } as any);

      const data = res?.data as PaystackInitiateResult | undefined;
      if (!res?.success || !data) throw new Error(res?.message || 'Could not start the payment');

      try { sessionStorage.setItem('vethub_paystack_ref', data.reference); } catch { /* private window */ }

      if (method === 'card') {
        // Paystack Inline — their iframe, our page. No redirect, no PAN here.
        if (!data.accessCode || !data.publicKey) {
          // Nothing to open an overlay with; the hosted page still works.
          if (data.authorizationUrl) { window.location.href = data.authorizationUrl; return; }
          throw new Error('Card payments are not configured — add a Paystack public key in Platform Settings.');
        }
        const Pop = await loadInline();
        const popup = new Pop();
        popup.resumeTransaction(data.accessCode, {
          onSuccess: () => { setPhase('done'); onPaid(); },
          onCancel: () => { setPhase('choose'); },
          onError: (e: any) => { setNote(e?.message || 'The card was declined.'); setPhase('failed'); },
        });
        setPhase('waiting');
        startPolling(data.reference);
        return;
      }

      setNote(data.mobilePrompt || 'Check your phone and approve the payment.');
      setPhase('waiting');
      startPolling(data.reference);
    } catch (e: any) {
      setNote(e?.message || 'Could not start the payment.');
      setPhase('failed');
    }
  };

  if (!open) return null;

  const isMobile = method !== 'card';
  const canPay = method === 'card' || phone.trim().length >= 9;

  return createPortal(
    // Portalled — the nav is backdrop-blurred, which makes it a containing
    // block for fixed children (see ReportIssueModal for the full note).
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md my-auto overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{planName}</p>
            <p className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight">{amountLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
        </div>

        {phase === 'done' ? (
          <div className="p-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <p className="mt-3 text-sm font-black text-pine dark:text-zinc-100">Payment received</p>
            <p className="text-[12px] text-slate-500 dark:text-zinc-400 mt-1">Your plan is active.</p>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[11px] font-black uppercase tracking-widest">Done</button>
          </div>
        ) : phase === 'waiting' ? (
          <div className="p-8 text-center">
            <Loader2 size={34} className="mx-auto text-seafoam animate-spin" />
            <p className="mt-3 text-sm font-bold text-pine dark:text-zinc-100">
              {isMobile ? 'Waiting for you to approve on your phone' : 'Completing the card payment'}
            </p>
            {note && <p className="text-[12px] text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">{note}</p>}
            <button onClick={onClose} className="mt-5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-pine">
              Close — it keeps running
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="field-label">How would you like to pay?</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`rounded-xl border px-2 py-2.5 text-left transition-all ${
                      method === m.id
                        ? 'border-seafoam bg-seafoam/10'
                        : 'border-slate-200 dark:border-zinc-700 hover:border-seafoam/50'
                    }`}
                  >
                    <m.icon size={14} className={method === m.id ? 'text-seafoam' : 'text-slate-400'} />
                    <span className="block text-[10px] font-black text-pine dark:text-zinc-100 mt-1">{m.label}</span>
                    <span className="block text-[8px] font-bold text-slate-400 leading-tight">{m.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {isMobile && (
              <div>
                <label className="field-label">Mobile money number</label>
                <input
                  className="field-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0722 100 200"
                  inputMode="tel"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  We send the prompt here. Approve it on the handset to finish.
                </p>
              </div>
            )}

            {!isMobile && (
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                Your card details are entered in Paystack's secure window, which opens over this
                page — they never pass through VetHubCore.
              </p>
            )}

            {phase === 'failed' && note && (
              <p className="flex items-start gap-2 text-[11px] font-bold text-red-600 dark:text-red-400">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {note}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[11px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
              <button
                onClick={pay}
                disabled={!canPay || phase === 'starting'}
                className="px-5 py-2 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[11px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
              >
                {phase === 'starting' ? <Loader2 size={13} className="animate-spin" /> : null}
                Pay {amountLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default PayCanvas;

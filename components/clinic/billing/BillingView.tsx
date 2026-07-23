import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, Calendar, CheckCircle2, Zap, Crown, Building2, Rocket,
  ExternalLink, RefreshCw, AlertTriangle, Package, ArrowUpRight, Settings,
  Check,
} from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';
import { useAuth } from '../../../contexts/AuthContext';
import { stripeAPI, BillingInfo, SubscriptionPackage } from '../../../services/modules/stripe.api';
import { vethubMpesaAPI, toast, dialog } from '../../../services';
import type { MpesaAttemptStatus } from '../../../services';
import { clinicSubscriptionAPI, type ClinicUsage } from '../../../services/modules/clinicSubscription.api';
import ReportPaymentIssueModal from './ReportPaymentIssueModal';
import { LifeBuoy } from 'lucide-react';
import { vethubLipanaAPI, type LipanaAttemptStatus } from '../../../services/modules/vethubLipana.api';
import { vethubPaystackAPI } from '../../../services/modules/vethubPaystack.api';
import { subscriptionPaymentHistoryAPI, type PaymentHistoryRow } from '../../../services/modules/subscriptionPaymentHistory.api';
import { subscriptionCancelAPI, type CancellationMode } from '../../../services/modules/subscriptionCancel.api';
import { useDisplayCurrency } from '../../../contexts/DisplayCurrencyContext';
import { useManagementScope } from '../../../contexts/ManagementScopeContext';
import ManagingSwitcher from '../../shared/common/ManagingSwitcher';
import { PlanCard } from './PlanCard';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

// formatPrice now comes from useDisplayCurrency() so every render honors
// the platform-wide display currency the admin chose.

const BillingView: React.FC = () => {
  const { selectedClinicIds } = useClinic();
  const { managedClinicId } = useManagementScope();
  // Scope billing to the clinic chosen in the "Managing" switcher (falls back
  // to the first selected) so it follows the switcher on this page.
  const clinicId = managedClinicId || selectedClinicIds[0] || null;
  const { formatPrice } = useDisplayCurrency();
  const { user } = useAuth();
  const ownerPhone = user?.phone || '';

  // ── Cancel subscription flow ───────────────────────────────────
  const [showCancel, setShowCancel] = useState(false);
  const [cancelMode, setCancelMode] = useState<CancellationMode>('END_OF_CYCLE');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelAck, setCancelAck] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const handleCancelOpen = () => {
    setCancelMode('END_OF_CYCLE');
    setCancelReason('');
    setCancelAck(false);
    setShowCancel(true);
  };
  const handleCancelSubmit = async () => {
    if (!clinicId || !cancelAck) return;
    setCancelSubmitting(true);
    try {
      const res = await subscriptionCancelAPI.cancel(clinicId, { mode: cancelMode, reason: cancelReason.trim() || undefined });
      if (res.success) {
        const receiptNo = (res.data?.subscription as any)?.cancellationReceipt?.receiptNo;
        const base = cancelMode === 'NOW'
          ? 'Subscription cancelled. You can now choose any package.'
          : 'Cancellation scheduled — access continues until the cycle ends. You can choose any package now.';
        toast.success(receiptNo ? `${base} Receipt ${receiptNo}.` : base);
        await fetchInfo();
        setShowCancel(false);
      }
    } finally {
      setCancelSubmitting(false);
    }
  };

  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [reportPrefill, setReportPrefill] = useState<{ provider?: string; reference?: string } | undefined>(undefined);
  const [usage, setUsage] = useState<ClinicUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Payment history ──────────────────────────────────────────
  const [history, setHistory] = useState<PaymentHistoryRow[]>([]);
  const [receiptRow, setReceiptRow] = useState<PaymentHistoryRow | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!clinicId) return;
    try {
      const res = await subscriptionPaymentHistoryAPI.list(clinicId, { limit: 50 });
      if (res.success && res.data?.rows) setHistory(res.data.rows);
    } catch {
      // Non-fatal — history is an addendum, not a blocker.
    }
  }, [clinicId]);

  const fetchInfo = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await stripeAPI.getInfo(clinicId);
      if (res.success) setInfo(res.data);
      else setError('Failed to load billing information.');
    } catch {
      setError('Failed to load billing information.');
    } finally {
      setLoading(false);
    }
    fetchHistory();
    // Plan usage vs limits — non-fatal if it fails.
    clinicSubscriptionAPI.getUsage(String(clinicId))
      .then((r) => { if (r.success && r.data) setUsage(r.data); })
      .catch(() => {});
  }, [clinicId, fetchHistory]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  // Refetch billing info whenever the tab regains focus. Covers the
  // common case where a payment webhook landed while the user was on
  // their phone approving the STK push, and they return to the desktop
  // tab expecting their plan to be updated.
  useEffect(() => {
    if (!clinicId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchInfo();
        fetchHistory();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [clinicId, fetchInfo, fetchHistory]);

  const handleCheckout = async (priceId: string, packageId: string) => {
    if (!clinicId) return;
    setActionLoading(priceId);
    try {
      const res = await stripeAPI.createCheckout(clinicId, priceId, packageId);
      if (res.success && res.data.url) {
        window.location.href = res.data.url;
      }
    } catch {
      setError('Failed to start checkout. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── M-Pesa subscription payment flow ─────────────────────────
  const [mpesaPlan, setMpesaPlan] = useState<SubscriptionPackage | null>(null);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaAttempt, setMpesaAttempt] = useState<{
    checkoutRequestId: string;
    message: string;
    status: MpesaAttemptStatus;
    resultDesc?: string | null;
  } | null>(null);
  const [mpesaInitiating, setMpesaInitiating] = useState(false);

  const openMpesaModal = (pkg: SubscriptionPackage) => {
    setMpesaPlan(pkg);
    setMpesaAttempt(null);
    setMpesaPhone('');
  };
  const closeMpesaModal = () => {
    setMpesaPlan(null);
    setMpesaAttempt(null);
    setMpesaPhone('');
    setMpesaInitiating(false);
  };

  const handleMpesaSubmit = async () => {
    if (!clinicId || !mpesaPlan) return;
    if (!/^(\+?254|0)\d{9}$/.test(mpesaPhone.replace(/\s/g, ''))) {
      toast.error('Enter a valid Kenyan phone number (e.g. 0712345678).');
      return;
    }
    setMpesaInitiating(true);
    try {
      const res = await vethubMpesaAPI.initiate(clinicId, {
        packageId: mpesaPlan.id,
        phone: mpesaPhone,
      });
      if (res.success && res.data.checkoutRequestId) {
        setMpesaAttempt({
          checkoutRequestId: res.data.checkoutRequestId,
          message: res.data.message,
          status: 'PENDING',
        });
        toast.success('STK push sent — check your phone.');
      } else {
        toast.error('Failed to start M-Pesa payment.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start M-Pesa payment.');
    } finally {
      setMpesaInitiating(false);
    }
  };

  // Poll status while a Mpesa attempt is PENDING. Stops on terminal status
  // or after ~2 minutes (Daraja STK timeout is ~60–90 s).
  useEffect(() => {
    if (!clinicId || !mpesaAttempt || mpesaAttempt.status !== 'PENDING') return;
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const res = await vethubMpesaAPI.getStatus(clinicId, mpesaAttempt.checkoutRequestId);
        if (!res.success || !res.data) return;
        const next = res.data.status;
        if (next !== 'PENDING') {
          setMpesaAttempt((prev) => prev && {
            ...prev,
            status: next,
            resultDesc: res.data.resultDesc,
          });
          if (next === 'SUCCESS') {
            toast.success('Payment received — your subscription is active.');
            await fetchInfo();
            await fetchHistory();
            setTimeout(() => closeMpesaModal(), 1500);
          } else {
            toast.error(`Payment ${next.toLowerCase()}: ${res.data.resultDesc || 'no further detail'}`);
          }
        }
      } catch {
        // Network blip — keep polling.
      }
      if (Date.now() - startedAt > 5 * 60 * 1000 && mpesaAttempt.status === 'PENDING') {
        setMpesaAttempt((prev) => prev && { ...prev, status: 'EXPIRED' });
        toast.error('Payment is taking longer than expected. Closing this dialog — your subscription will update automatically when the payment confirms.');
        fetchInfo();
      }
    };
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [clinicId, mpesaAttempt, fetchInfo]);

  // ── Lipana STK subscription payment flow ────────────────────
  // Static URL on the package (or any active billing option) gates the
  // button. Click opens a phone-input modal; submit fires
  // POST /subscriptions/lipana/initiate with {packageId, billingOptionId, phone}
  // which triggers Lipana → Safaricom STK push directly. The webhook then
  // matches the attempt by transactionId and activates the subscription.
  const [lipanaPlan, setLipanaPlan] = useState<SubscriptionPackage | null>(null);
  const [lipanaOptionId, setLipanaOptionId] = useState<string | null>(null);
  const [lipanaCycle, setLipanaCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY'>('MONTHLY');
  // Phone choice: 'owner' prefills the clinic owner's phone; 'other'
  // reveals a free-text input. Owner's phone comes from the auth context.
  const [lipanaPhoneChoice, setLipanaPhoneChoice] = useState<'owner' | 'other'>('owner');
  const [lipanaCustomPhone, setLipanaCustomPhone] = useState('');
  const [lipanaInitiating, setLipanaInitiating] = useState(false);
  const [lipanaAttempt, setLipanaAttempt] = useState<{
    reference: string;
    transactionId?: string;
    message?: string;
    status: LipanaAttemptStatus;
    resultDesc?: string | null;
  } | null>(null);

  // Resolve the phone we'll actually send to the backend.
  const resolvedLipanaPhone = (lipanaPhoneChoice === 'owner' ? ownerPhone : lipanaCustomPhone).trim();

  const openLipanaModal = (pkg: SubscriptionPackage, optionId: string | null, cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') => {
    setLipanaPlan(pkg);
    setLipanaOptionId(optionId);
    setLipanaCycle(cycle);
    setLipanaAttempt(null);
    // Default to owner's phone if we have one; otherwise force the user to
    // type a number.
    setLipanaPhoneChoice(ownerPhone ? 'owner' : 'other');
    setLipanaCustomPhone('');
  };
  const closeLipanaModal = () => {
    setLipanaPlan(null);
    setLipanaAttempt(null);
    setLipanaCustomPhone('');
    setLipanaInitiating(false);
  };

  const handleLipanaSubmit = async () => {
    if (!clinicId || !lipanaPlan) return;
    const phoneToSend = resolvedLipanaPhone;
    if (!/^(\+?254|0)\d{9}$/.test(phoneToSend.replace(/\s/g, ''))) {
      toast.error('Enter a valid Kenyan phone number (e.g. 0712345678).');
      return;
    }
    setLipanaInitiating(true);
    try {
      const res = await vethubLipanaAPI.initiate(clinicId, {
        packageId: lipanaPlan.id,
        billingOptionId: lipanaOptionId ?? undefined,
        cycle: lipanaCycle,
        phone: phoneToSend,
      });
      if (res.success && res.data?.merchantReference) {
        setLipanaAttempt({
          reference: res.data.merchantReference,
          transactionId: res.data.transactionId,
          message: res.data.message || 'STK push sent — check your phone.',
          status: 'PENDING',
        });
        toast.success('STK push sent — check your phone.');
      } else {
        toast.error('Failed to start Lipana payment.');
      }
    } catch (e: any) {
      // Surface engine rejections (same-plan / downgrade / not-configured)
      // through a VetHub dialog so the message is unmissable. Anything
      // else (network blips, etc.) still falls back to a toast.
      const msg = e?.message || 'Failed to start Lipana payment.';
      const isPolicy = /downgrade|already on the|cycle|configured/i.test(msg);
      if (isPolicy) {
        dialog.alert({
          title: 'We can’t proceed with this change',
          message: msg,
          variant: 'info',
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLipanaInitiating(false);
    }
  };

  // Poll Lipana attempt status. Stops on terminal status or after ~2 min
  // (matches Lipana's STK timeout window).
  useEffect(() => {
    if (!clinicId || !lipanaAttempt || lipanaAttempt.status !== 'PENDING') return;
    const startedAt = Date.now();
    // Longer timeout — Lipana webhook + activation can land 30-60s
    // after STK approval on a slow network. 5 min covers the long tail.
    const TIMEOUT_MS = 5 * 60 * 1000;
    const POLL_MS = 2000;
    const tick = async () => {
      try {
        const res = await vethubLipanaAPI.getStatus(clinicId, lipanaAttempt.reference);
        if (!res.success || !res.data) return;
        const next = res.data.status;
        if (next !== 'PENDING') {
          setLipanaAttempt((prev) => prev && {
            ...prev,
            status: next,
            resultDesc: res.data.resultDesc,
          });
          if (next === 'SUCCESS') {
            toast.success('Payment received — your subscription is active.');
            await fetchInfo();
            await fetchHistory();
            setTimeout(() => closeLipanaModal(), 1500);
          } else {
            toast.error(`Payment ${next.toLowerCase()}: ${res.data.resultDesc || 'no further detail'}`);
          }
        }
      } catch {
        // Network blip — keep polling.
      }
      if (Date.now() - startedAt > TIMEOUT_MS && lipanaAttempt.status === 'PENDING') {
        setLipanaAttempt((prev) => prev && { ...prev, status: 'EXPIRED' });
        toast.error('Payment is taking longer than expected. Closing this dialog — your subscription will update automatically when the payment confirms.');
        // One last refetch in case the webhook landed during the closing
        // animation. The Lipana attempt status check happens server-side
        // so we may catch a late SUCCESS the polling missed.
        fetchInfo();
        fetchHistory();
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [clinicId, lipanaAttempt, fetchInfo, fetchHistory]);

  // ── Paystack subscription payment flow ──────────────────────
  // Paystack hosts the checkout (card + mobile money + bank), so this is a
  // redirect, not an in-app modal. We initiate, stash the reference, and
  // send the user to Paystack's authorization URL. On return the
  // visibility/focus refetch picks up the activated sub; the effect below
  // also actively polls the attempt status for a snappier confirmation.
  const [paystackPlanId, setPaystackPlanId] = useState<string | null>(null);

  const handlePaystackPay = async (
    pkg: SubscriptionPackage,
    optionId: string | null,
    cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY',
  ) => {
    if (!clinicId) return;
    const email = user?.email?.trim();
    if (!email) {
      toast.error('Add an email to your account to pay by card.');
      return;
    }
    setPaystackPlanId(pkg.id);
    try {
      const res = await vethubPaystackAPI.initiate(clinicId, {
        packageId: pkg.id,
        billingOptionId: optionId ?? undefined,
        cycle,
        email,
      });
      if (res.success && res.data?.authorizationUrl) {
        // Remember the ref so we can confirm the payment when the user
        // returns from Paystack (in case the query param is stripped).
        try { sessionStorage.setItem('vethub_paystack_ref', res.data.reference); } catch { /* ignore */ }
        window.location.href = res.data.authorizationUrl;
      } else {
        toast.error('Failed to start card payment.');
        setPaystackPlanId(null);
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to start card payment.';
      const isPolicy = /downgrade|already on the|cycle|configured/i.test(msg);
      if (isPolicy) {
        dialog.alert({ title: 'We can’t proceed with this change', message: msg, variant: 'info' });
      } else {
        toast.error(msg);
      }
      setPaystackPlanId(null);
    }
  };

  // On return from Paystack — the callback URL carries ?provider=paystack&ref=…
  // (we also stash the ref in sessionStorage as a fallback). Poll the attempt
  // status for ~90s so the plan flips without the user manually refreshing.
  useEffect(() => {
    if (!clinicId) return;
    const params = new URLSearchParams(window.location.search);
    let ref = params.get('ref');
    if (params.get('provider') !== 'paystack' || !ref) {
      try { ref = sessionStorage.getItem('vethub_paystack_ref'); } catch { ref = null; }
    }
    if (!ref) return;
    try { sessionStorage.removeItem('vethub_paystack_ref'); } catch { /* ignore */ }
    // Strip the billing query params so a refresh doesn't re-trigger this.
    if (params.get('provider') === 'paystack') {
      window.history.replaceState({}, '', window.location.pathname);
    }

    let cancelled = false;
    const startedAt = Date.now();
    toast('Confirming your card payment…');
    const tick = async () => {
      if (cancelled || !ref) return;
      try {
        const res = await vethubPaystackAPI.getStatus(clinicId, ref);
        if (res.success && res.data) {
          const st = res.data.status;
          if (st === 'SUCCESS') {
            cancelled = true;
            toast.success('Payment received — your subscription is active.');
            await fetchInfo();
            await fetchHistory();
            return;
          }
          if (st === 'FAILED' || st === 'CANCELLED' || st === 'EXPIRED') {
            cancelled = true;
            toast.error(`Card payment ${st.toLowerCase()}: ${res.data.resultDesc || 'no further detail'}`);
            await fetchInfo();
            return;
          }
        }
      } catch { /* keep polling */ }
      if (!cancelled && Date.now() - startedAt < 90 * 1000) {
        setTimeout(tick, 2500);
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [clinicId, fetchInfo, fetchHistory]);

  const handlePortal = async () => {
    if (!clinicId) return;
    setActionLoading('portal');
    try {
      const res = await stripeAPI.createPortal(clinicId);
      if (res.success && res.data.url) {
        window.open(res.data.url, '_blank');
      }
    } catch {
      setError('Failed to open billing portal. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const getPlanIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('enterprise') || n.includes('premium')) return Crown;
    if (n.includes('pro')) return Rocket;
    if (n.includes('basic') || n.includes('starter')) return Building2;
    return Zap;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const daysUntilExpiry = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading billing..." />
      </div>
    );
  }

  const sub = info?.subscription ?? null;
  const packages = info?.packages ?? [];

  // Featured/display billing option for a package (admin's featuredCycle, else
  // first option, else a synthetic from the legacy columns). Mirrors PlanCard.
  const featuredOptionFor = (p: SubscriptionPackage) => {
    const opts = (p.billingOptions && p.billingOptions.length > 0)
      ? p.billingOptions
      : [{ id: '', cycle: (p.billingCycle as any) || 'MONTHLY', price: p.price, currency: p.currency || 'KES', discountPct: 0, lipanaStaticLinkUrl: p.lipanaStaticLinkUrl ?? null }];
    const featured = (p.featuredCycle as any) || 'MONTHLY';
    return opts.find((o) => o.cycle === featured) ?? opts[0];
  };

  // The next package up from the active subscription's tier — the natural
  // upgrade target surfaced as a CTA on the current plan card.
  const currentTier = sub?.package?.tier ?? null;
  const nextUpgradePkg = currentTier == null
    ? null
    : ([...packages]
        .filter((p) => typeof p.tier === 'number' && (p.tier as number) > currentTier)
        .sort((a, b) => ((a.tier as number) - (b.tier as number))
          || (Number(featuredOptionFor(a).price) - Number(featuredOptionFor(b).price)))[0] ?? null);
  const nextUpgradeOption = nextUpgradePkg ? featuredOptionFor(nextUpgradePkg) : null;

  // A payment stuck PENDING for 4h+ — surface a prominent "raise a ticket"
  // prompt, prefilled with that attempt's provider + reference.
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  const stalePending = history.find(
    (r) => r.status === 'PENDING' && Date.now() - new Date(r.createdAt).getTime() > FOUR_HOURS_MS,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-20"
    >
      <ManagingSwitcher kind="clinic" />
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Billing & Subscription</h1>
          <p className="page-subheader mt-1">Manage your plan and payment details</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInfo}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setReportPrefill(undefined); setShowReportIssue(true); }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-pine dark:hover:text-zinc-100 transition-all flex items-center gap-1.5"
            title="Paid but not reflected? Let us know."
          >
            <LifeBuoy size={14} /> Report an issue
          </button>
        </div>
      </header>

      <ReportPaymentIssueModal
        isOpen={showReportIssue}
        onClose={() => setShowReportIssue(false)}
        onSubmitted={() => { fetchInfo(); fetchHistory(); }}
        prefill={reportPrefill}
        transactions={history}
      />

      {/* Stuck-payment prompt — a payment PENDING for 4h+ */}
      {stalePending && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">
            A {stalePending.channel} payment of {stalePending.currency} {stalePending.amount} has been pending since{' '}
            {new Date(stalePending.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}. If you completed it, raise a ticket and our team will reconcile it.
          </span>
          <button
            onClick={() => { setReportPrefill({ provider: stalePending.channel, reference: stalePending.reference }); setShowReportIssue(true); }}
            className="shrink-0 px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-amber-700"
          >
            <LifeBuoy size={14} /> Raise a ticket
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* Trial banner — shown when there's no active sub but the clinic
          is still inside its free trial window. Helps the owner know how
          long they have before features lock. */}
      {!sub && info?.isInTrial && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} />
          <p className="text-sm font-bold">
            Free trial — {info.trialDaysLeft ?? 0} day{(info.trialDaysLeft ?? 0) === 1 ? '' : 's'} left.
            Choose a plan below to keep your access after the trial ends.
          </p>
        </div>
      )}

      {/* Current Plan Card */}
      {sub ? (
        <CurrentPlanCard
          sub={sub}
          formatDate={formatDate}
          daysUntilExpiry={daysUntilExpiry}
          getPlanIcon={getPlanIcon}
          onCancel={handleCancelOpen}
          subscriptionDaysLeft={info?.subscriptionDaysLeft}
          // Pass the full package row so the card can look up the
          // billing_option matching the sub's actual cycle.
          fullPackage={info?.packages?.find((p) => p.id === sub.package?.id) ?? null}
        />
      ) : (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle size={15} />
          No active subscription found. Choose a plan below to get started.
        </div>
      )}

      {/* Plan usage — current counts vs the active package limits */}
      {usage?.limits && (
        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
            <Package size={15} /> Plan usage
            {usage.packageName && <span className="text-xs font-normal text-slate-400">· {usage.packageName}</span>}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { label: 'Patients', used: usage.usage.patients, limit: usage.limits.maxPatients, cap: usage.unlimited.patients },
              { label: 'Clients',  used: usage.usage.clients,  limit: usage.limits.maxClients,  cap: usage.unlimited.clients },
              { label: 'Staff',    used: usage.usage.staff,    limit: usage.limits.maxStaff,    cap: usage.unlimited.staff },
            ]).map(({ label, used, limit, cap }) => {
              const unlimited = limit >= cap;
              const pct = unlimited ? 0 : Math.min(100, limit > 0 ? Math.round((used / limit) * 100) : 0);
              const danger = !unlimited && used >= limit;
              const warn = !unlimited && !danger && pct >= 80;
              const barColor = danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-pine dark:bg-seafoam';
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{label}</span>
                    <span className={`text-sm font-black ${danger ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                      {used.toLocaleString()}<span className="text-slate-400 font-medium"> / {unlimited ? '∞' : limit.toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: unlimited ? '8%' : `${Math.max(pct, 3)}%` }} />
                  </div>
                  {danger && <p className="mt-1 text-[11px] font-semibold text-red-500">Limit reached — upgrade to add more.</p>}
                </div>
              );
            })}

            {/* Branches — Enterprise-only capability. Disabled + upsell when the
                plan grants no branch slots (maxBranches = 0). */}
            {(() => {
              const bMax = usage.branches?.max ?? 0;
              const bUsed = usage.branches?.count ?? 0;
              const enabled = bMax > 0;
              const unlimited = bMax >= 9999;
              const pct = enabled && !unlimited ? Math.min(100, bMax > 0 ? Math.round((bUsed / bMax) * 100) : 0) : 0;
              return (
                <div className={enabled ? '' : 'opacity-60'}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Branches</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">
                      {enabled
                        ? <>{bUsed.toLocaleString()}<span className="text-slate-400 font-medium"> / {unlimited ? '∞' : bMax.toLocaleString()}</span></>
                        : <span className="text-slate-400">—</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    {enabled && <div className="h-full rounded-full transition-all bg-pine dark:bg-seafoam" style={{ width: unlimited ? '8%' : `${Math.max(pct, 3)}%` }} />}
                  </div>
                  {!enabled && <p className="mt-1 text-[11px] font-semibold text-seafoam">Available in Enterprise</p>}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* Branch clinic — plan is inherited from the parent, read-only here. */}
      {info?.isBranch && (
        <section className={`rounded-2xl border p-4 flex items-start gap-3 ${info.branchBlocked ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
          <Package size={18} className={info.branchBlocked ? 'text-amber-500 shrink-0 mt-0.5' : 'text-seafoam shrink-0 mt-0.5'} />
          <div className="text-sm">
            {info.branchBlocked ? (
              <>
                <p className="font-black text-amber-700 dark:text-amber-400">Branches need the Enterprise plan</p>
                <p className="text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  This branch{info.inheritedFromName ? ` of ${info.inheritedFromName}` : ''} is locked because the parent clinic's plan doesn't include branches. Ask the parent clinic to upgrade to Enterprise to activate it.
                </p>
              </>
            ) : (
              <>
                <p className="font-black text-slate-800 dark:text-white">Plan inherited{info.inheritedFromName ? ` from ${info.inheritedFromName}` : ''}</p>
                <p className="text-slate-500 dark:text-zinc-400 mt-0.5">Branches share the parent clinic's subscription — manage billing from the parent clinic.</p>
              </>
            )}
          </div>
        </section>
      )}

      {/* Available Plans */}
      {packages.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
            <Package size={15} />
            {sub ? 'Change Plan' : 'Choose a Plan'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg, i) => (
              <PlanCard
                key={pkg.id}
                pkg={pkg}
                isCurrent={sub?.package?.id === pkg.id}
                isLoading={actionLoading === (pkg.stripePriceId ?? pkg.id)}
                onSelect={() => {
                  if (pkg.stripePriceId) {
                    handleCheckout(pkg.stripePriceId, pkg.id);
                  }
                }}
                // Mpesa Daraja subscription path retired from the customer
                // UI — kept in backend code for per-clinic BYOK wallets later.
                // Pass undefined so PlanCard skips rendering the M-Pesa CTA.
                onPayWithMpesa={undefined}
                onPayWithLipana={(optionId, cycle) => openLipanaModal(pkg, optionId, cycle)}
                onPayWithPaystack={(optionId, cycle) => handlePaystackPay(pkg, optionId, cycle)}
                paystackLoading={paystackPlanId === pkg.id}
                currentSubBillingCycle={(sub?.package?.id === pkg.id ? sub?.billingCycle : null) ?? null}
                currentSubTier={sub?.package?.tier ?? null}
                upgradeTarget={sub?.package?.id === pkg.id && nextUpgradePkg ? { name: nextUpgradePkg.name, tier: nextUpgradePkg.tier } : null}
                upgradeTargetPrice={sub?.package?.id === pkg.id ? (nextUpgradeOption?.price ?? null) : null}
                upgradeTargetCurrency={sub?.package?.id === pkg.id ? (nextUpgradeOption?.currency ?? null) : null}
                onUpgradeToTarget={() => {
                  if (nextUpgradePkg && nextUpgradeOption) openLipanaModal(nextUpgradePkg, nextUpgradeOption.id || null, nextUpgradeOption.cycle as any);
                }}
                lipanaLoading={lipanaPlan?.id === pkg.id && (lipanaInitiating || lipanaAttempt?.status === 'PENDING')}
                getPlanIcon={getPlanIcon}
                delay={i * 0.05}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 size={11} />
            Subscriptions are billed monthly. You can change your plan at any time.
          </p>
        </section>
      )}

      {/* No packages notice */}
      {packages.length === 0 && !sub && (
        <div className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">
          No subscription plans are currently available. Please contact support.
        </div>
      )}

      {/* ── Payment History ─────────────────────────────────────── */}
      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
            <CreditCard size={15} />
            Payment History
          </h2>
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Date</th>
                    <th className="text-left px-4 py-2 font-semibold">Plan</th>
                    <th className="text-left px-4 py-2 font-semibold">Channel</th>
                    <th className="text-right px-4 py-2 font-semibold">Amount</th>
                    <th className="text-left px-4 py-2 font-semibold">Status</th>
                    <th className="text-right px-4 py-2 font-semibold">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {history.map((row) => (
                    <tr key={`${row.channel}-${row.id}`} className="text-slate-700 dark:text-zinc-300">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.settledAt || row.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{row.packageName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                          {row.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatPrice(row.amount, row.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          row.status === 'SUCCESS'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : row.status === 'PENDING'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === 'SUCCESS' && (
                          <button
                            onClick={() => setReceiptRow(row)}
                            className="text-pine dark:text-seafoam hover:underline text-xs font-semibold"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Receipt modal ───────────────────────────────────────── */}
      {receiptRow && (
        <ReceiptModal row={receiptRow} onClose={() => setReceiptRow(null)} formatDate={formatDate} />
      )}

      {/* ── Cancel subscription modal ───────────────────────────── */}
      {showCancel && sub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCancel(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-2xl">⚠️</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">Cancel subscription</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{sub.package?.name ?? 'Current plan'}</p>
              </div>
            </div>

            <div className="text-[11px] leading-relaxed px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              <strong className="font-black">Heads up:</strong> a cancelled subscription cannot be recovered. To use the platform again you'll need to subscribe fresh.
            </div>

            {/* Mode radios */}
            <div className="space-y-1.5">
              <label className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                cancelMode === 'END_OF_CYCLE'
                  ? 'border-pine dark:border-seafoam bg-pine/5 dark:bg-pine/10'
                  : 'border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}>
                <input type="radio" name="cancel-mode" checked={cancelMode === 'END_OF_CYCLE'} onChange={() => setCancelMode('END_OF_CYCLE')} className="mt-0.5 accent-pine" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-pine dark:text-zinc-100">Cancel now, execute at end of cycle</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Keeps your access until <span className="font-mono">{formatDate(sub.expiresAt)}</span>. Recommended.
                  </p>
                </div>
              </label>
              <label className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                cancelMode === 'NOW'
                  ? 'border-rose-400 dark:border-rose-600 bg-rose-50/60 dark:bg-rose-900/20'
                  : 'border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}>
                <input type="radio" name="cancel-mode" checked={cancelMode === 'NOW'} onChange={() => setCancelMode('NOW')} className="mt-0.5 accent-rose-500" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-pine dark:text-zinc-100">Cancel & execute now</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Deactivates immediately. No refund.
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling? Helps us improve."
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-rose-400/30 resize-none"
              />
            </div>

            <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={cancelAck} onChange={(e) => setCancelAck(e.target.checked)} className="mt-0.5 accent-rose-500" />
              <span>I understand this cannot be undone.</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCancel(false)}
                disabled={cancelSubmitting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
              >
                Keep my subscription
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={!cancelAck || cancelSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-all"
              >
                {cancelSubmitting ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── M-Pesa subscription payment modal ──────────────────── */}
      {mpesaPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeMpesaModal} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-2xl">📱</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">
                  Pay with M-Pesa
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                  {mpesaPlan.name} — {mpesaPlan.currency || 'KES'} {mpesaPlan.price.toLocaleString()}
                </p>
              </div>
            </div>

            {!mpesaAttempt ? (
              <>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    M-Pesa phone number
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    placeholder="0712345678"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    You'll get an STK push prompt on this phone.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeMpesaModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMpesaSubmit}
                    disabled={mpesaInitiating || !mpesaPhone}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
                  >
                    {mpesaInitiating ? 'Sending…' : 'Send STK Push'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-4">
                  {mpesaAttempt.status === 'PENDING' && (
                    <>
                      <RefreshCw size={28} className="animate-spin text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-pine dark:text-zinc-100 mb-1">
                        Waiting for payment…
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        {mpesaAttempt.message}
                      </p>
                    </>
                  )}
                  {mpesaAttempt.status === 'SUCCESS' && (
                    <>
                      <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-pine dark:text-zinc-100 mb-1">
                        Payment received
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Your subscription is now active.
                      </p>
                    </>
                  )}
                  {(mpesaAttempt.status === 'FAILED' || mpesaAttempt.status === 'EXPIRED' || mpesaAttempt.status === 'CANCELLED') && (
                    <>
                      <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-pine dark:text-zinc-100 mb-1">
                        Payment {mpesaAttempt.status.toLowerCase()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        {mpesaAttempt.resultDesc || 'No further details from M-Pesa.'}
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={closeMpesaModal}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Lipana subscription payment modal ───────────────────── */}
      {lipanaPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeLipanaModal} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-2xl">💳</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">
                  Pay via Lipana
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                  {lipanaPlan.name} — {lipanaPlan.currency || 'KES'} {lipanaPlan.price.toLocaleString()}
                </p>
              </div>
            </div>

            {!lipanaAttempt ? (
              <>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Pay with phone
                  </label>
                  {/* Two-option radio: prefill with the owner's phone, or
                      let the user type a different number. If owner phone
                      isn't on file, only the "Different" path is offered. */}
                  <div className="space-y-1.5">
                    {ownerPhone && (
                      <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        lipanaPhoneChoice === 'owner'
                          ? 'border-pine dark:border-seafoam bg-pine/5 dark:bg-pine/10'
                          : 'border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}>
                        <input
                          type="radio"
                          name="phone-choice"
                          checked={lipanaPhoneChoice === 'owner'}
                          onChange={() => setLipanaPhoneChoice('owner')}
                          className="accent-pine"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-pine dark:text-zinc-100">Owner's number</p>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 truncate">{ownerPhone}</p>
                        </div>
                      </label>
                    )}
                    <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      lipanaPhoneChoice === 'other'
                        ? 'border-pine dark:border-seafoam bg-pine/5 dark:bg-pine/10'
                        : 'border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}>
                      <input
                        type="radio"
                        name="phone-choice"
                        checked={lipanaPhoneChoice === 'other'}
                        onChange={() => setLipanaPhoneChoice('other')}
                        className="accent-pine"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-pine dark:text-zinc-100">Use a different number</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">Send the STK to someone else's phone</p>
                      </div>
                    </label>
                  </div>
                  {lipanaPhoneChoice === 'other' && (
                    <input
                      type="tel"
                      inputMode="tel"
                      value={lipanaCustomPhone}
                      onChange={(e) => setLipanaCustomPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-pine/30"
                      autoFocus
                    />
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    We'll send an M-Pesa STK prompt to this number. Approve on your phone to subscribe.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeLipanaModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLipanaSubmit}
                    disabled={lipanaInitiating || !resolvedLipanaPhone}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-xs font-bold hover:opacity-95 disabled:opacity-50 transition-all"
                  >
                    {lipanaInitiating ? 'Sending…' : 'Pay'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-4">
                  {lipanaAttempt.status === 'PENDING' && (
                    <>
                      <RefreshCw size={28} className="animate-spin text-violet-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-pine dark:text-zinc-100 mb-1">
                        Waiting for payment…
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        {lipanaAttempt.message}
                      </p>
                    </>
                  )}
                  {lipanaAttempt.status === 'SUCCESS' && (
                    <>
                      <CheckCircle2 size={32} className="text-violet-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-pine dark:text-zinc-100 mb-1">
                        Payment received
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Your subscription is now active.
                      </p>
                    </>
                  )}
                  {(lipanaAttempt.status === 'FAILED' || lipanaAttempt.status === 'EXPIRED' || lipanaAttempt.status === 'CANCELLED') && (
                    <>
                      <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-pine dark:text-zinc-100 mb-1">
                        Payment {lipanaAttempt.status.toLowerCase()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                        {lipanaAttempt.resultDesc || 'No further details from Lipana.'}
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={closeLipanaModal}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ─── Current Plan Card ────────────────────────────────────────────────────────

interface CurrentPlanCardProps {
  sub: NonNullable<BillingInfo['subscription']>;
  formatDate: (d: string) => string;
  daysUntilExpiry: (d: string) => number;
  getPlanIcon: (name: string) => React.ElementType;
  onCancel: () => void;
  /** Server-computed days left until subscription expires. Falls back to
   *  daysUntilExpiry(sub.expiresAt) if absent. */
  subscriptionDaysLeft?: number;
  /** Full package row from /stripe/info.packages — needed because
   *  sub.package only carries the package-level defaults, not the
   *  per-cycle billingOptions. We look up the option matching
   *  sub.billingCycle to show the correct price + cycle label. */
  fullPackage?: SubscriptionPackage | null;
}

const CurrentPlanCard: React.FC<CurrentPlanCardProps> = ({
  sub, formatDate, daysUntilExpiry, getPlanIcon, onCancel, subscriptionDaysLeft, fullPackage,
}) => {
  const { formatPrice } = useDisplayCurrency();
  const cancelled = !!sub.cancellationMode;
  const cancelScheduled = sub.cancellationMode === 'END_OF_CYCLE' && sub.cancellationScheduledFor;
  const daysLeft = subscriptionDaysLeft ?? daysUntilExpiry(sub.expiresAt);
  // Resolve the actual price + label from the sub's billing_cycle. The
  // package-level defaults (sub.package.price / billingCycle) don't move
  // when a clinic upgrades to a longer cycle — we need the per-cycle
  // option to render honestly.
  const subCycle = sub.billingCycle ?? 'MONTHLY';
  const matchingOption = fullPackage?.billingOptions?.find((o) => o.cycle === subCycle);
  const displayPrice = matchingOption?.price ?? sub.package?.price ?? 0;
  const displayCurrency = matchingOption?.currency ?? sub.package?.currency ?? 'KES';
  const CYCLE_LABEL_LOCAL: Record<string, string> = {
    MONTHLY: 'month', QUARTERLY: '3 months', SEMIANNUAL: '6 months', YEARLY: 'year',
  };
  const cycleLabel = CYCLE_LABEL_LOCAL[subCycle] ?? 'cycle';
  const days = daysLeft;
  const expiringSoon = days <= 7;
  const Icon = sub.package ? getPlanIcon(sub.package.name) : CreditCard;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Top accent strip */}
      <div className="h-1 bg-gradient-to-r from-pine to-seafoam" />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pine/10 dark:bg-pine/20 flex items-center justify-center flex-shrink-0">
              <Icon size={22} className="text-pine dark:text-seafoam" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {sub.package?.name ?? 'Current Plan'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  sub.isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                }`}>
                  {sub.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {sub.package && (
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {formatPrice(displayPrice, displayCurrency)}
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 ml-1">
                    / {cycleLabel}
                  </span>
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Dates */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-zinc-400">
            <Calendar size={13} className="text-slate-400 dark:text-zinc-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">Started</p>
              <p className="text-slate-700 dark:text-zinc-300 font-medium">{formatDate(sub.startedAt)}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2.5 text-sm ${expiringSoon ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-zinc-400'}`}>
            <Calendar size={13} className={expiringSoon ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-500'} />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                {sub.autoRenew ? 'Renews' : 'Expires'}
              </p>
              <p className="font-medium">
                {formatDate(sub.expiresAt)}
                {expiringSoon && <span className="ml-1 text-[10px]">({days}d left)</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        {sub.package?.features && sub.package.features.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500 mb-2">Included Features</p>
            <div className="flex flex-wrap gap-2">
              {sub.package.features.map((f, i) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pine/8 dark:bg-pine/15 text-pine dark:text-seafoam text-xs font-medium">
                  <Check size={10} />
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Limits */}
        {sub.package && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Patients', value: sub.package.maxPatients.toLocaleString() },
              { label: 'Staff', value: sub.package.maxStaff.toLocaleString() },
              { label: 'Storage', value: `${sub.package.storageGb} GB` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
                <p className="text-sm font-bold text-slate-800 dark:text-white">{value}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cancellation badge + cancel CTA */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          {cancelScheduled ? (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              <AlertTriangle size={13} />
              <p className="text-[11px] font-bold">
                Cancellation scheduled — access ends {formatDate(sub.cancellationScheduledFor as string)}
              </p>
            </div>
          ) : cancelled ? (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
              <AlertTriangle size={13} />
              <p className="text-[11px] font-bold">Subscription cancelled</p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              Need to stop? Cancel options below.
            </p>
          )}
          {!cancelled && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            >
              Cancel subscription
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

// ─── Plan Card ────────────────────────────────────────────────────────────────


// ─── Receipt Modal ────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  row: PaymentHistoryRow;
  onClose: () => void;
  formatDate: (d: string) => string;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ row, onClose, formatDate }) => {
  const { formatPrice } = useDisplayCurrency();
  const paidAt = row.settledAt || row.createdAt;
  // Print only the receipt body — give it a stable id so the print stylesheet
  // (defined inline at the top of the modal) can target it.
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:block">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm print:hidden" onClick={onClose} />
      <div
        id="vethub-receipt-printable"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-150 print:max-w-none print:rounded-none print:shadow-none print:border-0 print:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subscription Receipt</p>
            <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100 mt-0.5">VetHub Core</h3>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
            row.status === 'SUCCESS'
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
          }`}>
            {row.status}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-4 space-y-2 text-sm">
          <Row label="Plan" value={row.packageName} />
          <Row label="Amount" value={formatPrice(row.amount, row.currency)} mono />
          <Row label="Channel" value={row.channel} />
          <Row label="Paid at" value={formatDate(paidAt)} />
          <Row label="Reference" value={row.reference} mono small />
          {row.transactionId && <Row label="Transaction ID" value={row.transactionId} mono small />}
          {row.resultDesc && <Row label="Note" value={row.resultDesc} small />}
        </div>

        <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed print:text-slate-600">
          Thank you for your payment. Keep this receipt for your records. For
          billing questions contact <span className="font-mono">support@vethubcore.com</span>.
        </p>

        <div className="flex gap-2 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-pine text-white text-xs font-bold hover:opacity-90"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Print-only rule: hide everything except the receipt body. Scoped to
          this component so it can't leak into the rest of the app. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #vethub-receipt-printable, #vethub-receipt-printable * { visibility: visible !important; }
          #vethub-receipt-printable { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean; small?: boolean }> = ({ label, value, mono, small }) => (
  <div className="flex justify-between items-baseline gap-3">
    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest flex-shrink-0">{label}</span>
    <span className={`${mono ? 'font-mono' : 'font-semibold'} ${small ? 'text-[11px]' : 'text-sm'} text-slate-700 dark:text-zinc-200 text-right break-all`}>{value}</span>
  </div>
);

export default BillingView;

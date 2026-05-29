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
import { vethubMpesaAPI, toast } from '../../../services';
import type { MpesaAttemptStatus } from '../../../services';
import { vethubLipanaAPI, type LipanaAttemptStatus } from '../../../services/modules/vethubLipana.api';
import { subscriptionPaymentHistoryAPI, type PaymentHistoryRow } from '../../../services/modules/subscriptionPaymentHistory.api';
import { subscriptionCancelAPI, type CancellationMode } from '../../../services/modules/subscriptionCancel.api';
import { useDisplayCurrency } from '../../../contexts/DisplayCurrencyContext';

// formatPrice now comes from useDisplayCurrency() so every render honors
// the platform-wide display currency the admin chose.

const BillingView: React.FC = () => {
  const { selectedClinicIds } = useClinic();
  const clinicId = selectedClinicIds[0] ?? null;
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
        toast.success(
          cancelMode === 'NOW'
            ? 'Subscription cancelled immediately.'
            : 'Cancellation scheduled — access continues until the end of the cycle.'
        );
        await fetchInfo();
        setShowCancel(false);
      }
    } finally {
      setCancelSubmitting(false);
    }
  };

  const [info, setInfo] = useState<BillingInfo | null>(null);
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
  }, [clinicId, fetchHistory]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

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
      if (Date.now() - startedAt > 120_000 && mpesaAttempt.status === 'PENDING') {
        setMpesaAttempt((prev) => prev && { ...prev, status: 'EXPIRED' });
        toast.error('Payment timed out. Please try again.');
      }
    };
    const id = setInterval(tick, 3000);
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
      toast.error(e?.message || 'Failed to start Lipana payment.');
    } finally {
      setLipanaInitiating(false);
    }
  };

  // Poll Lipana attempt status. Stops on terminal status or after ~2 min
  // (matches Lipana's STK timeout window).
  useEffect(() => {
    if (!clinicId || !lipanaAttempt || lipanaAttempt.status !== 'PENDING') return;
    const startedAt = Date.now();
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
      if (Date.now() - startedAt > 120_000 && lipanaAttempt.status === 'PENDING') {
        setLipanaAttempt((prev) => prev && { ...prev, status: 'EXPIRED' });
        toast.error('Payment timed out. Please try again.');
      }
    };
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [clinicId, lipanaAttempt, fetchInfo]);

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
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-pine" />
      </div>
    );
  }

  const sub = info?.subscription ?? null;
  const packages = info?.packages ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-20"
    >
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
        </div>
      </header>

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
        />
      ) : (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle size={15} />
          No active subscription found. Choose a plan below to get started.
        </div>
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
                currentSubBillingCycle={(sub?.package?.id === pkg.id ? sub?.billingCycle : null) ?? null}
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
}

const CurrentPlanCard: React.FC<CurrentPlanCardProps> = ({
  sub, formatDate, daysUntilExpiry, getPlanIcon, onCancel, subscriptionDaysLeft,
}) => {
  const { formatPrice } = useDisplayCurrency();
  const cancelled = !!sub.cancellationMode;
  const cancelScheduled = sub.cancellationMode === 'END_OF_CYCLE' && sub.cancellationScheduledFor;
  const daysLeft = subscriptionDaysLeft ?? daysUntilExpiry(sub.expiresAt);
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
                  {formatPrice(sub.package.price, sub.package.currency)}
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 ml-1">
                    / {sub.package.billingCycle === 'MONTHLY' ? 'month' : 'year'}
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

interface PlanCardProps {
  pkg: SubscriptionPackage;
  isCurrent: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onPayWithMpesa?: () => void;
  onPayWithLipana?: (optionId: string | null, cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') => void;
  lipanaLoading?: boolean;
  getPlanIcon: (name: string) => React.ElementType;
  delay: number;
  /** Current sub on this clinic — used to dim cycle-downgrade choices when
   *  the user is viewing their own package. */
  currentSubBillingCycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY' | null;
}

const CYCLE_LABEL: Record<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY', string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: '6 Months',
  YEARLY: 'Yearly',
};
const CYCLE_DAYS_FE: Record<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY', number> = {
  MONTHLY: 30, QUARTERLY: 90, SEMIANNUAL: 180, YEARLY: 365,
};
const CYCLE_SUFFIX: Record<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY', string> = {
  MONTHLY: 'mo',
  QUARTERLY: '3mo',
  SEMIANNUAL: '6mo',
  YEARLY: 'yr',
};

const PlanCard: React.FC<PlanCardProps> = ({ pkg, isCurrent, isLoading, onSelect, onPayWithMpesa, onPayWithLipana, lipanaLoading, getPlanIcon, delay, currentSubBillingCycle }) => {
  const Icon = getPlanIcon(pkg.name);
  const { formatPrice } = useDisplayCurrency();
  // For the user's CURRENT package: any cycle shorter than what they're on
  // is a downgrade — disable it. New packages are unaffected.
  const currentCycleDays = (isCurrent && currentSubBillingCycle) ? CYCLE_DAYS_FE[currentSubBillingCycle] : 0;
  const isCycleDowngrade = (c: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') =>
    isCurrent && currentCycleDays > 0 && CYCLE_DAYS_FE[c] < currentCycleDays;
  // Tier 2 is the featured/recommended plan (Growth in the current catalog).
  // Highlighted with a glowing border, scale-up on desktop, and a "Most
  // Popular" ribbon. The current-plan styling still wins when both apply.
  const isFeatured = pkg.tier === 2;

  // Cycle selector — sourced from billingOptions when present; falls back to
  // a single MONTHLY synthetic option built from the legacy package columns.
  const cycleOptions = (pkg.billingOptions && pkg.billingOptions.length > 0)
    ? pkg.billingOptions
    : [{
        id: '',
        cycle: (pkg.billingCycle as 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY') || 'MONTHLY',
        price: pkg.price,
        currency: pkg.currency || 'KES',
        discountPct: 0,
        lipanaStaticLinkUrl: pkg.lipanaStaticLinkUrl ?? null,
      }];
  // Default to the admin-chosen featured cycle when present (and an active
  // option exists for it); else first option's cycle.
  const featured = (pkg.featuredCycle || 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
  const initialCycle = cycleOptions.find((o) => o.cycle === featured)?.cycle ?? cycleOptions[0].cycle;
  const [selectedCycle, setSelectedCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY'>(initialCycle);
  // "On current cycle" = the user is on this package AND has the same
  // cycle selected. Drives whether we show the 'Current Plan' chip vs an
  // 'Upgrade' Pay button. Declared here so selectedCycle is in scope.
  const onCurrentCycle = isCurrent && selectedCycle === currentSubBillingCycle;
  const [showCycleMenu, setShowCycleMenu] = useState(false);
  const selectedOption = cycleOptions.find((o) => o.cycle === selectedCycle) ?? cycleOptions[0];
  // Pay button shows whenever there's a priced option for this package
  // (Lipana is a platform-wide service driven by the secret key; per-cycle
  // URLs are optional marketing extras, not a payment gate).
  const lipanaEnabled = cycleOptions.some((o) => Number(o.price) > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
        isCurrent
          ? 'border-pine dark:border-seafoam bg-pine/5 dark:bg-pine/10'
          : isFeatured
          ? 'border-amber-400 dark:border-amber-500/70 bg-amber-50/40 dark:bg-amber-500/5 shadow-lg shadow-amber-500/10 lg:scale-[1.02]'
          : 'border-slate-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 hover:border-pine/50 dark:hover:border-seafoam/40'
      }`}
    >
      {isFeatured && !isCurrent && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 whitespace-nowrap">
          <span aria-hidden>⭐</span> Most Popular
        </span>
      )}
      {isCurrent && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-pine text-white text-[9px] font-black uppercase tracking-wider">
          Current
        </span>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isFeatured
            ? 'bg-amber-500/15 dark:bg-amber-500/20'
            : 'bg-pine/10 dark:bg-pine/20'
        }`}>
          <Icon size={18} className={isFeatured ? 'text-amber-600 dark:text-amber-400' : 'text-pine dark:text-seafoam'} />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
            {pkg.name}
            {isFeatured && <span className="text-amber-500" aria-hidden>⭐</span>}
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">{CYCLE_LABEL[selectedCycle]} billing</p>
        </div>
      </div>

      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">
          {formatPrice(selectedOption.price, selectedOption.currency)}
          <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 ml-1">
            /{CYCLE_SUFFIX[selectedCycle]}
          </span>
          {selectedOption.discountPct > 0 && (
            <span className="ml-2 align-middle inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
              SAVE {Math.round(selectedOption.discountPct)}%
            </span>
          )}
        </p>
        {cycleOptions.length > 1 && (
          <div className="relative mt-1">
            <button
              onClick={() => setShowCycleMenu((v) => !v)}
              className="text-[10px] font-bold uppercase tracking-widest text-pine dark:text-seafoam hover:underline flex items-center gap-1"
            >
              Change cycle <span aria-hidden>⌄</span>
            </button>
            {showCycleMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCycleMenu(false)} />
                <div className="absolute z-20 mt-1 left-0 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                  {cycleOptions.map((o) => {
                    const active = o.cycle === selectedCycle;
                    const downgrade = isCycleDowngrade(o.cycle);
                    return (
                      <button
                        key={o.cycle}
                        onClick={() => { if (downgrade) return; setSelectedCycle(o.cycle); setShowCycleMenu(false); }}
                        disabled={downgrade}
                        className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs transition-colors ${
                          downgrade
                            ? 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'
                            : active
                            ? 'bg-pine/5 dark:bg-pine/20 text-pine dark:text-seafoam font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {active && <Check size={11}/>} {CYCLE_LABEL[o.cycle]}
                          {downgrade && <span className="text-[9px] uppercase tracking-widest text-slate-400">downgrade</span>}
                        </span>
                        <span className="font-mono">
                          {formatPrice(o.price, o.currency)}
                          {o.discountPct > 0 && !downgrade && <span className="ml-1.5 text-[9px] text-emerald-500 font-black">−{Math.round(o.discountPct)}%</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Limits */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Patients', value: pkg.maxPatients >= 99999 ? '∞' : pkg.maxPatients.toLocaleString() },
          { label: 'Staff', value: pkg.maxStaff >= 9999 ? '∞' : pkg.maxStaff.toLocaleString() },
          { label: 'Storage', value: `${pkg.storageGb}GB` },
        ].map(({ label, value }) => (
          <div key={label} className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60">
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{value}</p>
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      {pkg.features.length > 0 && (
        <ul className="space-y-1.5">
          {pkg.features.slice(0, 4).map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <CheckCircle2 size={11} className="text-pine dark:text-seafoam flex-shrink-0" />
              {f}
            </li>
          ))}
          {pkg.features.length > 4 && (
            <li className="text-xs text-slate-400 dark:text-zinc-500 pl-5">
              +{pkg.features.length - 4} more features
            </li>
          )}
        </ul>
      )}

      {/* "Current plan" chip only when the user is on this package AND on
          this exact cycle. If they switch to a longer cycle in the popover,
          we hide the chip and show the Upgrade CTA below instead. */}
      {onCurrentCycle && (
        <div className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-pine/10 dark:bg-pine/20 text-pine dark:text-seafoam">
          <Check size={13} /> Current Plan
        </div>
      )}

      {/* Pay CTA. Shows for:
          - New packages (!isCurrent)
          - Current package on a longer cycle (cycle upgrade) — label says
            'Upgrade' instead of 'Pay' so the user knows what's happening.
          Hidden when the user is already on this exact cycle (chip above
          already covers that case). */}
      {!onCurrentCycle && lipanaEnabled && onPayWithLipana && (
        <button
          onClick={() => onPayWithLipana(selectedOption.id || null, selectedCycle)}
          disabled={lipanaLoading || !(Number(selectedOption.price) > 0)}
          className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-pine to-seafoam hover:opacity-95"
          title={!(Number(selectedOption.price) > 0) ? 'No price set for this cycle' : undefined}
        >
          {lipanaLoading ? (
            <><RefreshCw size={14} className="animate-spin" /> Waiting for payment…</>
          ) : (
            <>📱 {isCurrent ? 'Upgrade' : 'Pay'} — {formatPrice(selectedOption.price, selectedOption.currency)}</>
          )}
        </button>
      )}
    </motion.div>
  );
};

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

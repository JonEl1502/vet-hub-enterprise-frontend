import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, Calendar, CheckCircle2, Zap, Crown, Building2, Rocket,
  ExternalLink, RefreshCw, AlertTriangle, Package, ArrowUpRight, Settings,
  Check,
} from 'lucide-react';
import { useClinic } from '../../../contexts/ClinicContext';
import { stripeAPI, BillingInfo, SubscriptionPackage } from '../../../services/modules/stripe.api';
import { vethubMpesaAPI, toast } from '../../../services';
import type { MpesaAttemptStatus } from '../../../services';
import { vethubLipanaAPI, type LipanaAttemptStatus } from '../../../services/modules/vethubLipana.api';

const BillingView: React.FC = () => {
  const { selectedClinicIds } = useClinic();
  const clinicId = selectedClinicIds[0] ?? null;

  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [clinicId]);

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
  // Static URL on the package gates the button (admin "Lipana enabled"
  // flag). The actual click opens a phone-input modal; submit fires
  // POST /subscriptions/lipana/initiate with {packageId, phone} which
  // triggers Lipana → Safaricom STK push directly. The webhook then
  // matches the attempt by transactionId and activates the subscription.
  const [lipanaPlan, setLipanaPlan] = useState<SubscriptionPackage | null>(null);
  const [lipanaPhone, setLipanaPhone] = useState('');
  const [lipanaInitiating, setLipanaInitiating] = useState(false);
  const [lipanaAttempt, setLipanaAttempt] = useState<{
    reference: string;
    transactionId?: string;
    message?: string;
    status: LipanaAttemptStatus;
    resultDesc?: string | null;
  } | null>(null);

  const openLipanaModal = (pkg: SubscriptionPackage) => {
    setLipanaPlan(pkg);
    setLipanaAttempt(null);
    setLipanaPhone('');
  };
  const closeLipanaModal = () => {
    setLipanaPlan(null);
    setLipanaAttempt(null);
    setLipanaPhone('');
    setLipanaInitiating(false);
  };

  const handleLipanaSubmit = async () => {
    if (!clinicId || !lipanaPlan) return;
    if (!/^(\+?254|0)\d{9}$/.test(lipanaPhone.replace(/\s/g, ''))) {
      toast.error('Enter a valid Kenyan phone number (e.g. 0712345678).');
      return;
    }
    setLipanaInitiating(true);
    try {
      const res = await vethubLipanaAPI.initiate(clinicId, {
        packageId: lipanaPlan.id,
        phone: lipanaPhone,
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
          {sub && (
            <button
              onClick={handlePortal}
              disabled={actionLoading === 'portal'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pine text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {actionLoading === 'portal' ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Settings size={13} />
              )}
              Manage Billing
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* Current Plan Card */}
      {sub ? (
        <CurrentPlanCard
          sub={sub}
          formatDate={formatDate}
          daysUntilExpiry={daysUntilExpiry}
          onManageBilling={handlePortal}
          portalLoading={actionLoading === 'portal'}
          getPlanIcon={getPlanIcon}
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
                onPayWithMpesa={() => openMpesaModal(pkg)}
                onPayWithLipana={() => openLipanaModal(pkg)}
                lipanaLoading={lipanaPlan?.id === pkg.id && (lipanaInitiating || lipanaAttempt?.status === 'PENDING')}
                getPlanIcon={getPlanIcon}
                delay={i * 0.05}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 size={11} />
            Payments are securely processed by Stripe. You can cancel or change your plan at any time.
          </p>
        </section>
      )}

      {/* No packages notice */}
      {packages.length === 0 && !sub && (
        <div className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">
          No subscription plans are currently available. Please contact support.
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
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    M-Pesa phone number
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={lipanaPhone}
                    onChange={(e) => setLipanaPhone(e.target.value)}
                    placeholder="0712345678"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/30"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Lipana sends an STK push to this phone. Approve to subscribe.
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
                    disabled={lipanaInitiating || !lipanaPhone}
                    className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-all"
                  >
                    {lipanaInitiating ? 'Sending…' : 'Send STK Push'}
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
  onManageBilling: () => void;
  portalLoading: boolean;
  getPlanIcon: (name: string) => React.ElementType;
}

const CurrentPlanCard: React.FC<CurrentPlanCardProps> = ({
  sub, formatDate, daysUntilExpiry, onManageBilling, portalLoading, getPlanIcon,
}) => {
  const days = daysUntilExpiry(sub.expiresAt);
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
                  ${sub.package.price.toFixed(2)}
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 ml-1">
                    / {sub.package.billingCycle === 'MONTHLY' ? 'month' : 'year'}
                  </span>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onManageBilling}
            disabled={portalLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-pine dark:hover:border-seafoam hover:text-pine dark:hover:text-seafoam transition-all disabled:opacity-50 flex-shrink-0"
          >
            {portalLoading ? <RefreshCw size={11} className="animate-spin" /> : <ExternalLink size={11} />}
            Manage
          </button>
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

        {/* Portal CTA */}
        <button
          onClick={onManageBilling}
          disabled={portalLoading}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-pine dark:hover:text-seafoam transition-all disabled:opacity-50"
        >
          {portalLoading ? <RefreshCw size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
          Open Stripe Billing Portal — update card, download invoices, cancel
        </button>
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
  onPayWithLipana?: () => void;
  lipanaLoading?: boolean;
  getPlanIcon: (name: string) => React.ElementType;
  delay: number;
}

const PlanCard: React.FC<PlanCardProps> = ({ pkg, isCurrent, isLoading, onSelect, onPayWithMpesa, onPayWithLipana, lipanaLoading, getPlanIcon, delay }) => {
  const Icon = getPlanIcon(pkg.name);
  // Tier 2 is the featured/recommended plan (Growth in the current catalog).
  // Highlighted with a glowing border, scale-up on desktop, and a "Most
  // Popular" ribbon. The current-plan styling still wins when both apply.
  const isFeatured = pkg.tier === 2;

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
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            {pkg.billingCycle === 'MONTHLY' ? 'Billed monthly' : 'Billed yearly'}
          </p>
        </div>
      </div>

      <p className="text-2xl font-black text-slate-900 dark:text-white">
        ${pkg.price.toFixed(2)}
        <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 ml-1">
          /{pkg.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}
        </span>
      </p>

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

      <button
        onClick={onSelect}
        disabled={isCurrent || isLoading || !pkg.stripePriceId}
        className={`mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          isCurrent
            ? 'bg-pine/10 dark:bg-pine/20 text-pine dark:text-seafoam cursor-default'
            : !pkg.stripePriceId
            ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
            : isFeatured
            ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20 disabled:opacity-50'
            : 'bg-pine text-white hover:opacity-90 disabled:opacity-50'
        }`}
        title={!pkg.stripePriceId ? 'Stripe price not configured yet' : undefined}
      >
        {isLoading ? (
          <RefreshCw size={13} className="animate-spin" />
        ) : isCurrent ? (
          <><Check size={13} /> Current Plan</>
        ) : !pkg.stripePriceId ? (
          <>Coming Soon</>
        ) : (
          <><ArrowUpRight size={13} /> Subscribe via Stripe</>
        )}
      </button>

      {/* M-Pesa secondary CTA — independent of Stripe price configuration. */}
      {!isCurrent && onPayWithMpesa && (
        <button
          onClick={onPayWithMpesa}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-emerald-300 dark:border-emerald-600/60 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all disabled:opacity-50"
        >
          📱 Pay with M-Pesa
        </button>
      )}

      {/* Lipana hosted-page CTA — gated by lipanaStaticLinkUrl being set on
          the package (admin flag). Click triggers /subscriptions/lipana/initiate
          which generates a per-clinic payment link with our merchantReference,
          so the webhook can auto-activate the subscription on success. */}
      {!isCurrent && pkg.lipanaStaticLinkUrl && onPayWithLipana && (
        <button
          onClick={onPayWithLipana}
          disabled={lipanaLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-violet-300 dark:border-violet-600/60 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all disabled:opacity-60"
        >
          {lipanaLoading ? (
            <><RefreshCw size={12} className="animate-spin" /> Waiting for payment…</>
          ) : (
            <>💳 Pay via Lipana</>
          )}
        </button>
      )}
    </motion.div>
  );
};

export default BillingView;

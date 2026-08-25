import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Calendar, CheckCircle2, Zap, Crown, Building2, Rocket,
  RefreshCw, AlertTriangle, Package, ArrowUpRight, Check, Loader2,
  ShieldCheck, Users, HardDrive, Clock, Star, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSupplier } from '../../../contexts/SupplierContext';
import { supplierSubscriptionAPI, SupplierSubscription, SubscriptionPackage, UpgradePreview } from '../../../services/modules/supplierSubscription.api';
import { toast } from '../../../services/utils/toast';
import { vethubPaystackAPI } from '../../../services/modules/vethubPaystack.api';
import { cache } from '../../../services/utils/cache';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { PlanCard } from '../../clinic/billing/PlanCard';

const SupplierBillingView: React.FC = () => {
  const { user } = useAuth();
  const { mySupplier, selectedSupplierIds } = useSupplier();

  /**
   * Whose billing are we looking at?
   *
   * ⚠️ This used to be `user.supplier.id` alone, which is null for a PLATFORM
   * ADMIN using "View as → Supplier": an admin is not themselves a supplier.
   * `fetchAll` then bailed on its first line without ever clearing `loading`,
   * so the page sat on "Loading billing info…" forever — no request, no error,
   * nothing in the console to explain it (user, 2026-08-25).
   *
   * Resolution order mirrors the theme effect in SupplierContext, which had
   * already solved exactly this question: the supplier user's own account
   * first, then the one selected in the switcher.
   */
  const supplierId = React.useMemo(() => {
    const own = mySupplier?.id ?? (user as any)?.supplier?.id;
    if (own) return String(own);
    // Admin viewing one supplier. With several selected there is no single
    // subscription to show, so we say so rather than pick one arbitrarily.
    if (selectedSupplierIds.length === 1) return selectedSupplierIds[0];
    return null;
  }, [mySupplier, user, selectedSupplierIds]);

  const [subscription, setSubscription] = useState<SupplierSubscription | null>(null);
  const [packages, setPackages]         = useState<SubscriptionPackage[]>([]);
  const [previews, setPreviews]         = useState<Record<string, UpgradePreview>>({});
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const SUB_CACHE_KEY  = `/supplier-subscription/${supplierId}`;
  const PKG_CACHE_KEY  = `/supplier-packages/${supplierId}`;

  const fetchAll = useCallback(async (silent = false) => {
    // ⚠️ Must clear `loading`. Returning early with it still true is what
    // produced the permanent spinner — a page that cannot load is a page that
    // has to SAY so.
    if (!supplierId) {
      setLoading(false);
      setError(
        selectedSupplierIds.length > 1
          ? 'Several suppliers are selected. Pick a single supplier to see its billing.'
          : 'No supplier is selected, so there is no billing account to show. Choose one from the supplier switcher.',
      );
      return;
    }
    if (!silent) {
      const cachedSub = cache.get<SupplierSubscription>(SUB_CACHE_KEY);
      const cachedPkg = cache.get<SubscriptionPackage[]>(PKG_CACHE_KEY);
      if (cachedSub && cachedPkg) {
        setSubscription(cachedSub);
        setPackages(cachedPkg);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const [subRes, pkgRes] = await Promise.all([
        supplierSubscriptionAPI.getActive(supplierId),
        supplierSubscriptionAPI.getPackages(supplierId),
      ]);
      if (subRes.success) {
        setSubscription(subRes.data.subscription);
        cache.set(SUB_CACHE_KEY, subRes.data.subscription);
      }
      if (pkgRes.success) {
        setPackages(pkgRes.data.packages);
        cache.set(PKG_CACHE_KEY, pkgRes.data.packages);
      }
    } catch {
      setError('Failed to load billing information.');
    } finally {
      setLoading(false);
    }
  }, [supplierId, selectedSupplierIds.length]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load proration previews for packages above the current tier
  useEffect(() => {
    if (!supplierId || !subscription || packages.length === 0) return;
    packages.forEach(pkg => {
      if (pkg.tier > (subscription.package?.tier ?? 0)) {
        supplierSubscriptionAPI.previewUpgrade(supplierId, pkg.id)
          .then(res => {
            if (res.success) setPreviews(prev => ({ ...prev, [pkg.id]: res.data.preview }));
          })
          .catch(() => {});
      }
    });
  }, [supplierId, subscription, packages]);

  const handleSubscribe = async (pkg: SubscriptionPackage) => {
    if (!supplierId) return;
    const label = pkg.id;
    setActionLoading(label);
    try {
      const res = await supplierSubscriptionAPI.subscribe(supplierId, { packageId: pkg.id, autoRenew: true });
      if (res.success) {
        setSubscription(res.data.subscription);
        cache.set(SUB_CACHE_KEY, res.data.subscription);
        toast.success(`Subscribed to ${pkg.name}!`);
      } else {
        toast.error('Subscription failed. Please try again.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Subscription failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const getPlanIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('enterprise') || n.includes('premium')) return Crown;
    if (n.includes('pro'))                                  return Rocket;
    if (n.includes('basic') || n.includes('starter'))      return Building2;
    return Zap;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const daysLeft = (expiresAt: string) =>
    Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));

  const currentTier = subscription?.package?.tier ?? -1;

  // Add-ons layer OVER a base plan; listing one here would let a supplier
  // "subscribe" to it and replace their real plan. Mirrors the clinic page.
  /**
   * 220 — Paystack for suppliers.
   *
   * Until now a supplier "subscribed" without paying: the only rail was the
   * clinic one, and `/subscriptions/paystack/initiate` demanded an
   * `x-clinic-id` a supplier does not have. Same endpoint now accepts
   * `x-supplier-id`.
   */
  const [paystackPkgId, setPaystackPkgId] = useState<string | null>(null);

  const handlePaystackPay = async (
    pkg: SubscriptionPackage,
    optionId: string | null,
    cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY' | 'BIENNIAL' | 'TRIENNIAL',
  ) => {
    if (!supplierId) return;
    // Paystack REQUIRES an email and rejects the transaction without one, so
    // stop here with a sentence the user can act on rather than a gateway error.
    const email = (user?.email || '').trim();
    if (!email) {
      toast.error('Add an email address to your account before paying — Paystack requires one.');
      return;
    }
    setPaystackPkgId(pkg.id);
    try {
      const res = await vethubPaystackAPI.initiateSupplier(supplierId, {
        packageId: pkg.id,
        billingOptionId: optionId ?? undefined,
        cycle,
        email,
      });
      const url = (res as any)?.data?.authorizationUrl;
      if (res.success && url) {
        // Paystack hosts the checkout, so this leaves the app. On return the
        // page refetches and the new plan is already active.
        window.location.href = url;
        return;
      }
      toast.error('Could not start the payment. Please try again.');
    } catch (e: any) {
      /**
       * The API interceptor has ALREADY toasted the server's message — it does
       * that for every non-silent error. Re-toasting `e.message` here stacked
       * axios's "Request failed with status code 400" underneath the sentence
       * that actually explained the problem (user, 2026-08-23), so the useful
       * message was the one people ignored. Only speak up if nothing did.
       */
      if (!e?.response && !e?.status) toast.error('Could not start the payment.');
    } finally {
      setPaystackPkgId(null);
    }
  };

  const basePackages = React.useMemo(
    () => packages.filter((p) => !p.isAddon).sort((a, b) => a.tier - b.tier),
    [packages],
  );

  if (loading) {
    return (
      <LoadingSpinner contentArea message="Loading billing info…" />
    );
  }

  // Nothing resolved: show the reason on its own. Rendering the plan chrome
  // with every field blank reads as a broken page rather than an explained one.
  if (!supplierId) {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-amber-700 dark:text-amber-400">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <p className="text-sm font-semibold">{error || 'No supplier selected.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400">
          <AlertTriangle size={18} className="shrink-0" />
          <p className="text-sm font-semibold flex-1">{error}</p>
          <button onClick={() => fetchAll(true)} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      {/* ── Current Plan Card ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-seafoam" />
            <h2 className="font-black text-sm uppercase tracking-wider text-pine dark:text-zinc-100">Current Plan</h2>
          </div>
          <button
            onClick={() => fetchAll(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-slate-400" />
          </button>
        </div>

        {subscription && subscription.isActive ? (
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              {/* Plan info */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-seafoam/10 flex items-center justify-center shrink-0">
                  {React.createElement(getPlanIcon(subscription.package?.name ?? ''), { size: 26, className: 'text-seafoam' })}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-black text-pine dark:text-zinc-100">
                      {subscription.package?.name ?? 'Active Plan'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-[9px] font-black uppercase tracking-widest border border-green-200 dark:border-green-800">
                      Active
                    </span>
                  </div>
                  <p className="text-2xl font-black text-seafoam">
                    {user?.supplier?.currency ?? 'KES'} {Number(subscription.package?.price ?? 0).toLocaleString()}
                    <span className="text-sm font-bold text-slate-400 ml-1">/ mo</span>
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Started</p>
                  <p className="font-bold text-pine dark:text-zinc-100">{formatDate(subscription.startedAt)}</p>
                </div>
                <div className={`rounded-xl p-3 ${daysLeft(subscription.expiresAt) <= 7 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50 dark:bg-zinc-800'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Expires</p>
                  <p className={`font-bold ${daysLeft(subscription.expiresAt) <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-pine dark:text-zinc-100'}`}>
                    {formatDate(subscription.expiresAt)}
                    {daysLeft(subscription.expiresAt) <= 7 && (
                      <span className="ml-1 text-[9px]">({daysLeft(subscription.expiresAt)}d left)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Features */}
            {(subscription.package?.features?.length ?? 0) > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Included Features</p>
                <div className="flex flex-wrap gap-2">
                  {subscription.package!.features.map((f, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-seafoam/10 text-seafoam text-[10px] font-bold">
                      <Check size={10} /> {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Limits */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { icon: Users,      label: 'Staff',    value: subscription.package?.maxStaff === -1 ? 'Unlimited' : String(subscription.package?.maxStaff ?? '—') },
                { icon: HardDrive,  label: 'Storage',  value: subscription.package?.storageGb ? `${subscription.package.storageGb} GB` : '—' },
                { icon: ShieldCheck, label: 'Billing', value: subscription.package?.billingCycle ?? '—' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
                  <item.icon size={14} className="text-seafoam shrink-0" />
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                    <p className="text-xs font-black text-pine dark:text-zinc-100">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
              <Package size={28} className="text-slate-300 dark:text-zinc-600" />
            </div>
            <p className="font-black text-pine dark:text-zinc-100">No Active Subscription</p>
            <p className="text-slate-400 text-sm">Choose a plan below to get started.</p>
          </div>
        )}
      </div>

      {/* ── Available Plans ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-seafoam" />
          <h2 className="font-black text-sm uppercase tracking-wider text-pine dark:text-zinc-100">
            {subscription ? 'Upgrade Plan' : 'Choose a Plan'}
          </h2>
        </div>

        {/* Same PlanCard the clinic billing page uses (user, 2026-08-22:
            "copy exactly as clinic billing but pkgs are for supplier
            filtered"), so cycle pickers, discounts, feature lists and the
            downgrade gate all behave identically. The catalog is the ONE
            catalog filtered to audiences=['SUPPLIER'] — 113.

            ⚠️ STILL NO CLINIC ID. Paystack is wired as of 220, but through the
            SUPPLIER rail (`x-supplier-id`) — the clinic header this endpoint
            used to demand is never sent. `onSelect` remains the free
            activation path for plans with no price. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {basePackages.map((pkg, i) => (
            <PlanCard
              key={pkg.id}
              pkg={pkg}
              isCurrent={subscription?.packageId === pkg.id && !!subscription?.isActive}
              isLoading={actionLoading === pkg.id}
              onSelect={() => handleSubscribe(pkg)}
              onPayWithMpesa={undefined}
              onPayWithPaystack={(optionId, cycle) => handlePaystackPay(pkg, optionId, cycle)}
              paystackLoading={paystackPkgId === pkg.id}
              /* supplier_subscriptions stores no purchased-cycle column (unlike
                 clinic_subscriptions), so the plan's own cycle is the best
                 signal available for dimming cycle downgrades. */
              currentSubBillingCycle={
                (subscription?.packageId === pkg.id ? (subscription?.package?.billingCycle as any) : null) ?? null
              }
              currentSubTier={subscription?.package?.tier ?? null}
              getPlanIcon={getPlanIcon}
              /* SECONDS — framer-motion's unit. This was `i * 60`, i.e. a
                 millisecond stagger fed to a seconds API, so plans 2, 3 and 4
                 stayed invisible for 1, 2 and 3 MINUTES and the page looked
                 like it only offered Starter (user, 2026-08-23). */
              delay={i * 0.05}
              inheritsFrom={
                [...basePackages]
                  .filter((o) => o.tier < pkg.tier)
                  .sort((x, y) => y.tier - x.tier)[0] ?? null
              }
            />
          ))}
        </div>

        {packages.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-sm">No plans available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierBillingView;

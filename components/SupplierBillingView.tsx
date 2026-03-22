import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Calendar, CheckCircle2, Zap, Crown, Building2, Rocket,
  RefreshCw, AlertTriangle, Package, ArrowUpRight, Check, Loader2,
  ShieldCheck, Users, HardDrive, Clock, Star, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supplierSubscriptionAPI, SupplierSubscription, SubscriptionPackage, UpgradePreview } from '../services/modules/supplierSubscription.api';
import { toast } from '../services/utils/toast';
import { cache } from '../services/utils/cache';

const SupplierBillingView: React.FC = () => {
  const { user } = useAuth();
  const supplierId = user?.supplier?.id ? String(user.supplier.id) : null;

  const [subscription, setSubscription] = useState<SupplierSubscription | null>(null);
  const [packages, setPackages]         = useState<SubscriptionPackage[]>([]);
  const [previews, setPreviews]         = useState<Record<string, UpgradePreview>>({});
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const SUB_CACHE_KEY  = `/supplier-subscription/${supplierId}`;
  const PKG_CACHE_KEY  = `/supplier-packages/${supplierId}`;

  const fetchAll = useCallback(async (silent = false) => {
    if (!supplierId) return;
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
  }, [supplierId]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={28} className="text-seafoam animate-spin" />
        <p className="text-slate-500 text-sm font-semibold">Loading billing info…</p>
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
          <button onClick={fetchAll} className="text-xs font-bold underline">Retry</button>
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
            onClick={fetchAll}
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {packages
            .sort((a, b) => a.tier - b.tier)
            .map(pkg => {
              const PlanIcon = getPlanIcon(pkg.name);
              const isCurrent = subscription?.packageId === pkg.id && subscription?.isActive;
              const isUpgrade = pkg.tier > currentTier;
              const isDowngrade = pkg.tier < currentTier && currentTier !== -1;
              const preview = previews[pkg.id];
              const isLoading = actionLoading === pkg.id;

              return (
                <div
                  key={pkg.id}
                  className={`relative bg-white dark:bg-zinc-900 rounded-2xl border-2 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-lg ${
                    isCurrent
                      ? 'border-seafoam'
                      : isUpgrade
                      ? 'border-slate-200 dark:border-zinc-700 hover:border-seafoam/40'
                      : 'border-slate-100 dark:border-zinc-800 opacity-80'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute top-0 right-0 bg-seafoam text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                      Current
                    </div>
                  )}

                  <div className="p-6 flex-1 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCurrent ? 'bg-seafoam/10 text-seafoam' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'}`}>
                        <PlanIcon size={22} />
                      </div>
                      <div>
                        <h3 className="font-black text-pine dark:text-zinc-100">{pkg.name}</h3>
                        <p className="text-xs text-slate-400 capitalize">{pkg.billingCycle.toLowerCase()} billing</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div>
                      <span className="text-3xl font-black text-pine dark:text-zinc-100">
                        {user?.supplier?.currency ?? 'KES'} {Number(pkg.price).toLocaleString()}
                      </span>
                      <span className="text-slate-400 text-xs ml-1">/mo</span>
                    </div>

                    {/* Proration note */}
                    {isUpgrade && preview && (
                      <div className="bg-seafoam/5 border border-seafoam/20 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-seafoam mb-1">Upgrade Cost</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Credit from current plan</span>
                          <span className="font-bold text-green-600">− {user?.supplier?.currency ?? 'KES'} {preview.creditAvailable.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-black mt-1">
                          <span className="text-pine dark:text-zinc-100">Due now</span>
                          <span className="text-pine dark:text-zinc-100">{user?.supplier?.currency ?? 'KES'} {preview.amountDue.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    <ul className="space-y-2 flex-1">
                      {pkg.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-zinc-400">
                          <CheckCircle2 size={13} className="text-seafoam shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Limits */}
                    <div className="flex gap-3 text-[10px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users size={10} /> {pkg.maxStaff === -1 ? 'Unlimited' : pkg.maxStaff} staff
                      </span>
                      {pkg.storageGb > 0 && (
                        <span className="flex items-center gap-1">
                          <HardDrive size={10} /> {pkg.storageGb} GB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-5">
                    <button
                      onClick={() => handleSubscribe(pkg)}
                      disabled={isCurrent || isLoading || !!isDowngrade}
                      className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-seafoam/10 text-seafoam cursor-default'
                          : isDowngrade
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-300 dark:text-zinc-600 cursor-not-allowed'
                          : 'bg-pine dark:bg-zinc-100 text-white dark:text-pine hover:bg-seafoam hover:dark:bg-seafoam hover:text-white active:scale-95 shadow-md'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isCurrent ? (
                        <><CheckCircle2 size={14} /> Current Plan</>
                      ) : isDowngrade ? (
                        'Contact Support to Downgrade'
                      ) : isUpgrade ? (
                        <><ArrowUpRight size={14} /> Upgrade</>
                      ) : (
                        <><Star size={14} /> Subscribe</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
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

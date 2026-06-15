
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SubscriptionPackage, SubscriptionTier, ClinicSubscription, SubscriptionStatus } from '../../../types';
import { Check, X, Zap, Crown, Building2, Rocket, CreditCard, Calendar, AlertCircle, TrendingUp, Lock } from 'lucide-react';

interface Props {
  currentSubscription?: ClinicSubscription;
  availablePackages: SubscriptionPackage[];
  onUpgrade: (packageId: number) => void;
  onCancelSubscription: () => void;
  loading?: boolean;
}

// Convert tier to a comparable number regardless of whether it's a number or enum string
const getTierLevel = (tier: any): number => {
  if (typeof tier === 'number') return tier;
  const order: Record<string, number> = { FREE: 0, BASIC: 1, PROFESSIONAL: 2, ENTERPRISE: 3 };
  return order[String(tier)] ?? 0;
};

const SubscriptionManagement: React.FC<Props> = ({
  currentSubscription,
  availablePackages,
  onUpgrade,
  onCancelSubscription,
  loading,
}) => {
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const getTierIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case SubscriptionTier.FREE: return Zap;
      case SubscriptionTier.BASIC: return Building2;
      case SubscriptionTier.PROFESSIONAL: return Rocket;
      case SubscriptionTier.ENTERPRISE: return Crown;
      default: return Zap;
    }
  };

  const getTierColor = (tier: SubscriptionTier) => {
    switch (tier) {
      case SubscriptionTier.FREE: return 'slate';
      case SubscriptionTier.BASIC: return 'cyan';
      case SubscriptionTier.PROFESSIONAL: return 'seafoam';
      case SubscriptionTier.ENTERPRISE: return 'amber';
      default: return 'slate';
    }
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    const base = "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ";
    switch (status) {
      case SubscriptionStatus.ACTIVE: return base + "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case SubscriptionStatus.TRIAL: return base + "bg-cyan/10 text-cyan border-cyan/20";
      case SubscriptionStatus.CANCELLED: return base + "bg-red-500/10 text-red-500 border-red-500/20";
      case SubscriptionStatus.EXPIRED: return base + "bg-slate-100 text-slate-500 border-slate-200";
      case SubscriptionStatus.PAST_DUE: return base + "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return base + "bg-slate-100 text-slate-500 border-slate-200";
    }
  };

  const calculateYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    const percentage = Math.round((savings / monthlyCost) * 100);
    return { amount: savings, percentage };
  };

  // Packages for the selected cycle, ordered by tier (FREE → … → ENTERPRISE).
  const currentTierLevel = currentSubscription ? getTierLevel(currentSubscription.package.tier) : -1;
  const cyclePackages = availablePackages
    .filter(pkg => pkg.billingCycle === billingCycle)
    .sort((a, b) => getTierLevel(a.tier) - getTierLevel(b.tier));
  // The next tier up from the current plan — auto-highlighted as the suggested upgrade.
  const recommendedId = currentSubscription
    ? cyclePackages.find(p => getTierLevel(p.tier) > currentTierLevel)?.id
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Subscription Management</h1>
          <p className="page-subheader mt-1">Manage your clinic's subscription plan and billing</p>
        </div>
      </header>

      {/* Current Subscription Card */}
      {currentSubscription && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-pine to-seafoam dark:from-zinc-800 dark:to-zinc-900 rounded-xl p-6 text-white shadow-lg"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-black tracking-tight">{currentSubscription.package.name}</h2>
                <span className={getStatusBadge(currentSubscription.status)}>{currentSubscription.status}</span>
              </div>
              <p className="text-white/80 text-sm font-bold">
                {currentSubscription.package.description || 'Your current subscription plan'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black">${currentSubscription.package.price}</div>
              <div className="text-white/60 text-xs font-black uppercase tracking-wider">
                /{currentSubscription.package.billingCycle === 'MONTHLY' ? 'month' : 'year'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
            <div className="flex items-center gap-3">
              <Calendar className="text-white/60" size={16} />
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-white/60">Next Billing</div>
                <div className="text-sm font-bold">{new Date(currentSubscription.endDate).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="text-white/60" size={16} />
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-white/60">Auto Renew</div>
                <div className="text-sm font-bold">{currentSubscription.autoRenew ? 'Enabled' : 'Disabled'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertCircle className="text-white/60" size={16} />
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-white/60">Status</div>
                <div className="text-sm font-bold capitalize">{currentSubscription.status.toLowerCase()}</div>
              </div>
            </div>
          </div>

          {currentSubscription.status === SubscriptionStatus.ACTIVE && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-black uppercase tracking-wider transition-all"
            >
              Cancel Subscription
            </button>
          )}
        </motion.div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              billingCycle === 'MONTHLY'
                ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md'
                : 'text-slate-400 hover:text-pine'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('YEARLY')}
            className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              billingCycle === 'YEARLY'
                ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md'
                : 'text-slate-400 hover:text-pine'
            }`}
          >
            Yearly <span className="text-emerald-500 ml-1">(Save 20%)</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cyclePackages
          .map((pkg, index) => {
            const Icon = getTierIcon(pkg.tier);
            const color = getTierColor(pkg.tier);
            const isCurrentPlan = currentSubscription?.packageId === pkg.id;
            const isRecommended = recommendedId != null && pkg.id === recommendedId;
            const savings = pkg.yearlyPrice && billingCycle === 'YEARLY'
              ? calculateYearlySavings(pkg.price, pkg.yearlyPrice)
              : null;

            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className={`compact-card relative transition-all ${
                  isRecommended
                    ? 'ring-2 ring-seafoam dark:ring-cyan shadow-lg shadow-seafoam/15 scale-[1.02]'
                    : pkg.isPopular ? 'ring-2 ring-seafoam/40 dark:ring-cyan/40' : ''
                } ${isCurrentPlan ? 'bg-pine/5 dark:bg-zinc-800/50' : ''}`}
              >
                {isRecommended ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-seafoam text-white rounded-full text-[8px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                    <TrendingUp size={10} /> Recommended
                  </div>
                ) : pkg.isPopular ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-seafoam text-white rounded-full text-[8px] font-black uppercase tracking-wider shadow-lg">
                    Most Popular
                  </div>
                ) : null}

                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-pine dark:bg-zinc-700 text-white rounded-full text-[8px] font-black uppercase tracking-wider shadow-lg">
                    Current Plan
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-${color}/10 dark:bg-${color}/20 flex items-center justify-center`}>
                    <Icon className={`text-${color}`} size={24} />
                  </div>
                  <div>
                    <h3 className="card-title text-lg">{pkg.name}</h3>
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{pkg.tier}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-pine dark:text-zinc-100">
                      ${billingCycle === 'YEARLY' && pkg.yearlyPrice ? pkg.yearlyPrice : pkg.price}
                    </span>
                    <span className="text-slate-400 text-xs font-black uppercase">
                      /{billingCycle === 'MONTHLY' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  {savings && (
                    <div className="text-emerald-500 text-[9px] font-black uppercase tracking-wider mt-1">
                      Save ${savings.amount} ({savings.percentage}%)
                    </div>
                  )}
                  {pkg.description && (
                    <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-bold mt-2">
                      {pkg.description}
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-3">Features</div>
                  {pkg.features.slice(0, 5).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                      <span className="text-[10px] font-bold text-pine dark:text-zinc-300">{feature}</span>
                    </div>
                  ))}
                  {pkg.features.length > 5 && (
                    <div className="text-[9px] font-black text-seafoam uppercase tracking-wider">
                      +{pkg.features.length - 5} more features
                    </div>
                  )}
                </div>

                {/* Limits */}
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex justify-between text-[9px]">
                    <span className="font-black uppercase text-slate-400">Patients</span>
                    <span className="font-bold text-pine dark:text-zinc-100">
                      {pkg.limits.patients === -1 ? 'Unlimited' : pkg.limits.patients.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="font-black uppercase text-slate-400">Staff</span>
                    <span className="font-bold text-pine dark:text-zinc-100">{pkg.limits.staff}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="font-black uppercase text-slate-400">Storage</span>
                    <span className="font-bold text-pine dark:text-zinc-100">{pkg.limits.storageGb} GB</span>
                  </div>
                </div>

                {/* Action Button */}
                {(() => {
                  const pkgTierLevel = getTierLevel(pkg.tier);
                  const currentTierLevel = currentSubscription
                    ? getTierLevel(currentSubscription.package.tier)
                    : -1;
                  const isLocked = currentSubscription && pkgTierLevel < currentTierLevel;

                  if (isCurrentPlan) {
                    return (
                      <div className="w-full px-4 py-2 bg-pine/10 dark:bg-zinc-700/50 border border-pine/20 dark:border-zinc-600 rounded-xl text-center text-[9px] font-black uppercase tracking-wider text-pine dark:text-zinc-300">
                        Active Plan
                      </div>
                    );
                  }

                  if (isLocked) {
                    return (
                      <div className="w-full px-4 py-3 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-center space-y-1 cursor-not-allowed opacity-60">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-zinc-500">
                          <Lock size={11} />
                          <span className="text-[9px] font-black uppercase tracking-wider">Unavailable</span>
                        </div>
                        {currentSubscription?.endDate && (
                          <div className="text-[8px] font-bold text-slate-400 dark:text-zinc-600">
                            Available after {new Date(currentSubscription.endDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      onClick={() => onUpgrade(pkg.id)}
                      disabled={loading}
                      className={`w-full compact-button ${
                        isRecommended || pkg.isPopular
                          ? 'bg-seafoam text-white shadow-lg'
                          : 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                      } flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <CreditCard size={12} />
                      {!currentSubscription ? 'Get Started' : 'Upgrade'}
                    </button>
                  );
                })()}
              </motion.div>
            );
          })}
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="text-red-500" size={24} />
              </div>
              <h3 className="text-xl font-black text-pine dark:text-zinc-100">Cancel Subscription?</h3>
            </div>

            <p className="text-slate-600 dark:text-zinc-400 text-sm font-bold mb-6">
              Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your billing period.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => {
                  onCancelSubscription();
                  setShowCancelModal(false);
                }}
                className="flex-1 compact-button bg-red-500 text-white"
              >
                Cancel Plan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default SubscriptionManagement;


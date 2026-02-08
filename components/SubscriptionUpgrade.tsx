
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUp, ArrowDown, Check, X, AlertCircle, Calendar, 
  CreditCard, Zap, Building2, Rocket, Crown, Info
} from 'lucide-react';
import { SubscriptionPackage, ClinicSubscription, SubscriptionTier } from '../types';

interface Props {
  currentSubscription: ClinicSubscription;
  targetPackage: SubscriptionPackage;
  onConfirm: (packageId: number, prorationAmount: number) => Promise<void>;
  onCancel: () => void;
}

const SubscriptionUpgrade: React.FC<Props> = ({
  currentSubscription,
  targetPackage,
  onConfirm,
  onCancel
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>(
    currentSubscription.package.billingCycle
  );

  const isUpgrade = useMemo(() => {
    const tierOrder = [SubscriptionTier.FREE, SubscriptionTier.BASIC, SubscriptionTier.PROFESSIONAL, SubscriptionTier.ENTERPRISE];
    const currentIndex = tierOrder.indexOf(currentSubscription.package.tier);
    const targetIndex = tierOrder.indexOf(targetPackage.tier);
    return targetIndex > currentIndex;
  }, [currentSubscription, targetPackage]);

  const calculateProration = useMemo(() => {
    const now = new Date();
    const endDate = new Date(currentSubscription.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const currentPrice = billingCycle === 'YEARLY' 
      ? (currentSubscription.package.yearlyPrice || currentSubscription.package.price * 12)
      : currentSubscription.package.price;
    
    const targetPrice = billingCycle === 'YEARLY'
      ? (targetPackage.yearlyPrice || targetPackage.price * 12)
      : targetPackage.price;

    const daysInPeriod = billingCycle === 'YEARLY' ? 365 : 30;
    const unusedCredit = (currentPrice / daysInPeriod) * daysRemaining;
    const prorationAmount = Math.max(0, targetPrice - unusedCredit);

    return {
      daysRemaining,
      unusedCredit,
      targetPrice,
      prorationAmount,
      effectiveDate: isUpgrade ? 'Immediately' : new Date(currentSubscription.endDate).toLocaleDateString()
    };
  }, [currentSubscription, targetPackage, billingCycle, isUpgrade]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm(targetPackage.id, calculateProration.prorationAmount);
    } catch (error) {
      console.error('Failed to change subscription:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getTierIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case SubscriptionTier.FREE: return Zap;
      case SubscriptionTier.BASIC: return Building2;
      case SubscriptionTier.PROFESSIONAL: return Rocket;
      case SubscriptionTier.ENTERPRISE: return Crown;
    }
  };

  const getTierColor = (tier: SubscriptionTier) => {
    switch (tier) {
      case SubscriptionTier.FREE: return 'from-slate-500 to-slate-600';
      case SubscriptionTier.BASIC: return 'from-blue-500 to-blue-600';
      case SubscriptionTier.PROFESSIONAL: return 'from-purple-500 to-purple-600';
      case SubscriptionTier.ENTERPRISE: return 'from-amber-500 to-amber-600';
    }
  };

  const CurrentIcon = getTierIcon(currentSubscription.package.tier);
  const TargetIcon = getTierIcon(targetPackage.tier);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-3xl w-full my-8 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-pine dark:text-zinc-100 mb-2">
              {isUpgrade ? 'Upgrade' : 'Downgrade'} Subscription
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 font-bold">
              Review the changes to your subscription plan
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-pine dark:hover:text-zinc-100"
          >
            <X size={24} />
          </button>
        </div>

        {/* Plan Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Current Plan */}
          <div className="compact-card bg-slate-50 dark:bg-zinc-800">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Current Plan
            </div>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getTierColor(currentSubscription.package.tier)} flex items-center justify-center mb-3`}>
              <CurrentIcon className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-black text-pine dark:text-zinc-100 mb-2">
              {currentSubscription.package.name}
            </h3>
            <div className="text-2xl font-black text-pine dark:text-zinc-100 mb-4">
              ${billingCycle === 'YEARLY' 
                ? (currentSubscription.package.yearlyPrice || currentSubscription.package.price * 12).toFixed(2)
                : currentSubscription.package.price.toFixed(2)}
              <span className="text-sm text-slate-400 font-bold">
                /{billingCycle === 'YEARLY' ? 'year' : 'month'}
              </span>
            </div>
            <div className="space-y-2">
              {currentSubscription.package.features.slice(0, 3).map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 font-bold">
                  <Check size={14} className="text-seafoam flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Target Plan */}
          <div className={`compact-card ${isUpgrade ? 'ring-2 ring-seafoam' : 'ring-2 ring-amber-500'}`}>
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">
              {isUpgrade ? 'Upgrading To' : 'Downgrading To'}
            </div>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getTierColor(targetPackage.tier)} flex items-center justify-center mb-3`}>
              <TargetIcon className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-black text-pine dark:text-zinc-100 mb-2">
              {targetPackage.name}
            </h3>
            <div className="text-2xl font-black text-pine dark:text-zinc-100 mb-4">
              ${billingCycle === 'YEARLY'
                ? (targetPackage.yearlyPrice || targetPackage.price * 12).toFixed(2)
                : targetPackage.price.toFixed(2)}
              <span className="text-sm text-slate-400 font-bold">
                /{billingCycle === 'YEARLY' ? 'year' : 'month'}
              </span>
            </div>
            <div className="space-y-2">
              {targetPackage.features.slice(0, 3).map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 font-bold">
                  <Check size={14} className="text-seafoam flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="compact-card bg-slate-50 dark:bg-zinc-800 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-black text-pine dark:text-zinc-100 mb-1">Billing Cycle</div>
              <div className="text-sm text-slate-400 font-bold">
                {billingCycle === 'YEARLY' && targetPackage.yearlyPrice && (
                  <span className="text-emerald-500">
                    Save ${((targetPackage.price * 12) - targetPackage.yearlyPrice).toFixed(2)}/year
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  billingCycle === 'MONTHLY'
                    ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-400'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('YEARLY')}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  billingCycle === 'YEARLY'
                    ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-400'
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Proration Details */}
        <div className="compact-card mb-6">
          <h3 className="section-header mb-4">Billing Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-zinc-400">
                <Calendar size={14} />
                Effective Date
              </div>
              <div className="font-black text-pine dark:text-zinc-100">
                {calculateProration.effectiveDate}
              </div>
            </div>

            {isUpgrade && calculateProration.daysRemaining > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
                <div className="text-sm font-bold text-slate-600 dark:text-zinc-400">
                  Unused Credit ({calculateProration.daysRemaining} days)
                </div>
                <div className="font-black text-emerald-500">
                  -${calculateProration.unusedCredit.toFixed(2)}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div className="text-sm font-bold text-slate-600 dark:text-zinc-400">
                New Plan Price
              </div>
              <div className="font-black text-pine dark:text-zinc-100">
                ${calculateProration.targetPrice.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center justify-between py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl px-4">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-seafoam" />
                <div className="font-black text-pine dark:text-zinc-100">
                  {isUpgrade ? 'Amount Due Today' : 'Next Billing Amount'}
                </div>
              </div>
              <div className="text-2xl font-black text-pine dark:text-zinc-100">
                ${calculateProration.prorationAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className={`compact-card mb-6 ${
          isUpgrade
            ? 'bg-seafoam/10 border-seafoam/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isUpgrade ? 'bg-seafoam/20' : 'bg-amber-500/20'
            }`}>
              {isUpgrade ? (
                <ArrowUp className="text-seafoam" size={20} />
              ) : (
                <AlertCircle className="text-amber-500" size={20} />
              )}
            </div>
            <div>
              <h4 className="font-black text-pine dark:text-zinc-100 mb-2">
                {isUpgrade ? 'Upgrade Details' : 'Downgrade Notice'}
              </h4>
              {isUpgrade ? (
                <ul className="text-sm text-slate-600 dark:text-zinc-400 font-bold space-y-1">
                  <li>• Your plan will be upgraded immediately</li>
                  <li>• You'll be charged the prorated amount today</li>
                  <li>• New features will be available right away</li>
                  <li>• Your billing cycle will remain {billingCycle.toLowerCase()}</li>
                </ul>
              ) : (
                <ul className="text-sm text-slate-600 dark:text-zinc-400 font-bold space-y-1">
                  <li>• Your current plan will remain active until {new Date(currentSubscription.endDate).toLocaleDateString()}</li>
                  <li>• The new plan will take effect at the end of your current billing period</li>
                  <li>• You'll retain access to current features until then</li>
                  <li>• No charges will be applied today</li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="compact-card mb-6">
          <h3 className="section-header mb-4">What's Changing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Current Limits
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-bold">Patients</span>
                  <span className="font-black text-pine dark:text-zinc-100">
                    {currentSubscription.package.limits.patients === -1 ? 'Unlimited' : currentSubscription.package.limits.patients}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-bold">Staff</span>
                  <span className="font-black text-pine dark:text-zinc-100">
                    {currentSubscription.package.limits.staff === -1 ? 'Unlimited' : currentSubscription.package.limits.staff}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-bold">Storage</span>
                  <span className="font-black text-pine dark:text-zinc-100">
                    {currentSubscription.package.limits.storageGb}GB
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                New Limits
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-bold">Patients</span>
                  <span className={`font-black ${
                    targetPackage.limits.patients > currentSubscription.package.limits.patients || targetPackage.limits.patients === -1
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  }`}>
                    {targetPackage.limits.patients === -1 ? 'Unlimited' : targetPackage.limits.patients}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-bold">Staff</span>
                  <span className={`font-black ${
                    targetPackage.limits.staff > currentSubscription.package.limits.staff || targetPackage.limits.staff === -1
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  }`}>
                    {targetPackage.limits.staff === -1 ? 'Unlimited' : targetPackage.limits.staff}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-zinc-400 font-bold">Storage</span>
                  <span className={`font-black ${
                    targetPackage.limits.storageGb > currentSubscription.package.limits.storageGb
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  }`}>
                    {targetPackage.limits.storageGb}GB
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`flex-1 compact-button text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              isUpgrade ? 'bg-seafoam' : 'bg-amber-500'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center text-xs mr-2 animate-pulse">
                  🐾
                </div>
                Processing...
              </>
            ) : (
              <>
                {isUpgrade ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                Confirm {isUpgrade ? 'Upgrade' : 'Downgrade'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SubscriptionUpgrade;


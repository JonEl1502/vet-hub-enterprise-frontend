import React, { useState } from 'react';
import { Layers, Lock, Syringe } from 'lucide-react';
import VaccinePackagesView from './VaccinePackagesView';
import ServiceBundlesView from './ServiceBundlesView';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';
import { hasFeature, featureCopy } from '../../../services/entitlements';

/**
 * Packages — fixed-price offerings (Billable Items taxonomy, M4).
 * Wraps the two existing preset systems under one roof: vaccine packages
 * (inventory-item bundles) and service bundles (catalog-service bundles).
 * Procedures (dynamic recipes) live on their own page — per the domain
 * decision, a Package is fixed-price; a Procedure computes.
 *
 * ⚠️ GATED PER TAB, not per page. The two halves carry SEPARATE keys
 * (`view:vaccine-packages`, `view:service-bundles`), so gating the container on
 * one of them would hide the other from a plan that pays for it.
 *
 * Before this, neither was gated here at all: the page rendered in full, an
 * inner request 403'd, and the API interceptor raised a dismissible "Upgrade
 * needed" modal — so "Not now" left the user sitting on a working-looking page
 * for a feature their plan excludes (user, 2026-09-13: *"on clicking not now i
 * get access"*). A lock you can dismiss is not a lock.
 */

const LockedTab: React.FC<{ featureKey: string }> = ({ featureKey }) => {
  const copy = featureCopy(featureKey);
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Lock className="text-seafoam/40 mb-4" size={40} />
      <h3 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
        Upgrade to access
      </h3>
      <p className="text-slate-400 text-sm mt-2 max-w-sm">
        {copy.label} is on a higher plan.{copy.blurb ? ` ${copy.blurb}` : ''}
      </p>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view: 'billing' } }))}
        className="mt-5 px-5 py-2.5 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest"
      >
        See plans
      </button>
    </div>
  );
};

const PackagesView: React.FC = () => {
  const [tab, setTab] = useState<'vaccines' | 'services'>('vaccines');
  const { access } = usePlanAccess();
  const canVaccines = hasFeature(access, 'view:vaccine-packages');
  const canServices = hasFeature(access, 'view:service-bundles');

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-800">
        {([
          { id: 'vaccines', label: 'Vaccine Packages', icon: <Syringe size={13} />, allowed: canVaccines },
          { id: 'services', label: 'Service Bundles', icon: <Layers size={13} />, allowed: canServices },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-seafoam text-seafoam' : 'border-transparent text-slate-400 hover:text-pine dark:hover:text-zinc-200'
            }`}
          >
            {t.icon} {t.label}
            {!t.allowed && <Lock size={10} className="opacity-70" />}
          </button>
        ))}
      </div>
      {tab === 'vaccines'
        ? (canVaccines ? <VaccinePackagesView /> : <LockedTab featureKey="view:vaccine-packages" />)
        : (canServices ? <ServiceBundlesView /> : <LockedTab featureKey="view:service-bundles" />)}
    </div>
  );
};

export default PackagesView;

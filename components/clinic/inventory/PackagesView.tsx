import React, { useState } from 'react';
import { Layers, Syringe } from 'lucide-react';
import VaccinePackagesView from './VaccinePackagesView';
import ServiceBundlesView from './ServiceBundlesView';

/**
 * Packages — fixed-price offerings (Billable Items taxonomy, M4).
 * Wraps the two existing preset systems under one roof: vaccine packages
 * (inventory-item bundles) and service bundles (catalog-service bundles).
 * Procedures (dynamic recipes) live on their own page — per the domain
 * decision, a Package is fixed-price; a Procedure computes.
 */
const PackagesView: React.FC = () => {
  const [tab, setTab] = useState<'vaccines' | 'services'>('vaccines');

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-800">
        {([
          { id: 'vaccines', label: 'Vaccine Packages', icon: <Syringe size={13} /> },
          { id: 'services', label: 'Service Bundles', icon: <Layers size={13} /> },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-seafoam text-seafoam' : 'border-transparent text-slate-400 hover:text-pine dark:hover:text-zinc-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'vaccines' ? <VaccinePackagesView /> : <ServiceBundlesView />}
    </div>
  );
};

export default PackagesView;

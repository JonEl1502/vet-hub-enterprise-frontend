import React from 'react';
import { Stethoscope } from 'lucide-react';
import ClinicCatalogTab from '../clinic-mgmt/ClinicCatalogTab';

/**
 * Services — the clinic's service catalog as a first-class Billable Items
 * page (M4). Reuses the existing catalog manager (categories, services,
 * per-clinic price overrides) that also lives in Clinic Management.
 */
const ServicesCatalogPage: React.FC = () => (
  <div className="space-y-5 animate-in fade-in duration-300">
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-900/20 flex items-center justify-center">
        <Stethoscope size={22} className="text-sky-600 dark:text-sky-400" />
      </div>
      <div>
        <h1 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Services</h1>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">Catalog services, categories & your clinic's prices</p>
      </div>
    </div>
    <ClinicCatalogTab />
  </div>
);

export default ServicesCatalogPage;

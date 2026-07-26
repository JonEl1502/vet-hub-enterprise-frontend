/**
 * VetHubCore **Livestock** — bare-bones module shells.
 *
 * The data model exists (migration 109: farms, animal_groups, crop_plots,
 * feeding_plans, feeding_logs, produce_schedules, produce_records) and the
 * audience + subscription plumbing is live. These pages are deliberately
 * scaffolding: they establish the routes, the nav, and the gating so the
 * vertical is walkable end-to-end, without pretending the CRUD is finished.
 *
 * Each shell states plainly what it will own, so nobody mistakes an empty
 * page for a broken one.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, Warehouse, Milk, Wheat, CalendarClock, Construction } from 'lucide-react';

interface LivestockPlaceholderProps {
  view:
    | 'livestock-dashboard'
    | 'farms'
    | 'animal-groups'
    | 'crop-plots'
    | 'feeding'
    | 'produce-schedule'
    | 'livestock-settings';
}

const SHELLS: Record<
  LivestockPlaceholderProps['view'],
  { title: string; subtitle: string; icon: React.ElementType; owns: string[]; table: string }
> = {
  'livestock-dashboard': {
    title: 'Farm Dashboard',
    subtitle: 'At-a-glance herd, feed and produce status',
    icon: Sprout,
    owns: ['Head count by species', 'Feed due today', 'Produce recorded this week', 'Linked clinic / vet officer'],
    table: 'farms · animal_groups · feeding_plans · produce_records',
  },
  farms: {
    title: 'Farms',
    subtitle: 'The farms on this account',
    icon: Warehouse,
    owns: ['Farm records (name, type, county, acreage)', 'Link to a clinic OR an independent vet officer', 'Activate / deactivate'],
    table: 'farms',
  },
  'animal-groups': {
    title: 'Herds & Flocks',
    subtitle: 'Livestock managed by group, not per animal',
    icon: Milk,
    owns: ['Species, breed, head count', 'Purpose (dairy / meat / layers / breeding)', 'Housing'],
    table: 'animal_groups',
  },
  'crop-plots': {
    title: 'Crop Plots',
    subtitle: 'Planted areas and their harvest windows',
    icon: Wheat,
    owns: ['Crop, plot size', 'Planted date, expected harvest', 'Per-plot notes'],
    table: 'crop_plots',
  },
  feeding: {
    title: 'Feeding',
    subtitle: 'Feeding plans and what was actually fed',
    icon: Sprout,
    owns: ['Plans per herd (feed type, kg, frequency)', 'Daily feeding log', 'Who fed, when, how much'],
    table: 'feeding_plans · feeding_logs',
  },
  'produce-schedule': {
    title: 'Produce',
    subtitle: 'Expected output and recorded yield',
    icon: CalendarClock,
    owns: ['Schedules for milk / eggs / harvest', 'Expected vs actual quantity', 'Next due date'],
    table: 'produce_schedules · produce_records',
  },
  'livestock-settings': {
    title: 'Farm Settings',
    subtitle: 'Account and linkage preferences',
    icon: Warehouse,
    owns: ['Contact details', 'Clinic / vet officer linkage', 'Units and measurement preferences'],
    table: 'clients (is_livestock) · farms',
  },
};

const LivestockPlaceholder: React.FC<LivestockPlaceholderProps> = ({ view }) => {
  const shell = SHELLS[view] ?? SHELLS['livestock-dashboard'];
  const Icon = shell.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-20"
    >
      <header>
        <h1 className="page-header flex items-center gap-2">
          <Icon size={20} className="text-pine dark:text-seafoam" />
          {shell.title}
        </h1>
        <p className="page-subheader mt-1">{shell.subtitle}</p>
      </header>

      <section className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-900/60 p-6">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Construction size={16} />
          <p className="text-[10px] font-black uppercase tracking-widest">Scaffolding — not yet built</p>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300 max-w-xl leading-relaxed">
          The database and subscription plumbing for VetHubCore Livestock are live; this
          screen is the placeholder for the module below. It exists so the navigation,
          routing and plan gating can be walked end-to-end before the CRUD lands.
        </p>

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            This page will own
          </p>
          <ul className="mt-2 space-y-1.5">
            {shell.owns.map((o) => (
              <li key={o} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-400">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                {o}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Backing tables (migration 109)
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-zinc-400">{shell.table}</p>
        </div>
      </section>
    </motion.div>
  );
};

export default LivestockPlaceholder;

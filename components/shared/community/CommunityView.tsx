import React from 'react';
import { Users, Star, Store, ShieldCheck, Megaphone } from 'lucide-react';
import PageHeader from '../common/PageHeader';

/**
 * Community — the shared space for clinics, suppliers, practitioners, clients
 * and farm owners.
 *
 * ⚠️ NOT BUILT YET. This is the nav entry and the agreed model, deliberately
 * shipped as an honest placeholder rather than a nav item that dead-ends: the
 * session board records a supplier page that was "done" on a passing API test
 * and turned out to be unreachable through three separate layers. A route with
 * nothing behind it looks identical to a broken one.
 *
 * The model below is settled (user, 2026-08-15) and is what the build must
 * honour — it is stated here so the first person to open this file does not
 * have to reconstruct it:
 *   · ONE surface. Staff reach it here; clients and farm owners reach the same
 *     Community from the portal.
 *   · Clients and farm owners take part FREE — their participation is what
 *     makes the space worth paying to reach.
 *   · Clinics and suppliers pay, via a package on the existing subscription
 *     catalogue (113: audiences + isAddon + featureKeys). Enterprise includes it.
 *   · Read access is universal. The subscription gates WRITES only — post,
 *     message, rank, advertise — so a lapsed plan still sees the space.
 *   · RANKING IS EARNED, NEVER BOUGHT. Clinics rank suppliers; clients rank
 *     clinics. Position comes from ratings, fulfilment and response time.
 *     Advertising is a separate package and is labelled as promoted.
 */
const POINTS = [
  { icon: Star, title: 'Ranking is earned', body: 'Clinics rank suppliers. Clients rank clinics. Position comes from real signals — ratings, fulfilment, response time — never from what someone pays.' },
  { icon: Store, title: 'Free for clients and farm owners', body: 'The people who make the space worth joining are never charged for it.' },
  { icon: ShieldCheck, title: 'Everyone can see it', body: 'A clinic whose plan lapses still sees the space. Taking part — posting, messaging, ranking — is what a subscription unlocks.' },
  { icon: Megaphone, title: 'Advertising is separate, and labelled', body: 'A clinic or supplier can buy placement. It never moves anyone up the rankings, and it always says it is promoted.' },
];

const CommunityView: React.FC = () => (
  <div className="space-y-5">
    <PageHeader
      icon={Users}
      title="Community"
      subtitle="Clinics, suppliers, practitioners, clients and farm owners — one space"
    />
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
      <span className="inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/20">
        Not built yet
      </span>
      <p className="mt-3 text-sm font-bold text-pine dark:text-zinc-100">
        This is the agreed shape, not a working space.
      </p>
      <p className="mt-1 text-[11px] font-bold text-slate-400 leading-relaxed max-w-2xl">
        Nothing here is live — no profiles, posts or rankings exist. The entry sits in the sidebar so
        the design is visible while it is built, rather than appearing one day with rules nobody saw
        coming.
      </p>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {POINTS.map(p => (
          <div key={p.title} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/30">
            <span className="shrink-0 w-8 h-8 rounded-lg bg-seafoam/10 text-seafoam grid place-items-center">
              <p.icon size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-pine dark:text-zinc-100">{p.title}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400 leading-relaxed">{p.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default CommunityView;

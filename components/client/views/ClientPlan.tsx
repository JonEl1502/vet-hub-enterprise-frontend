import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Loader2, Sprout, ExternalLink, CreditCard, Layers, Lock,
} from 'lucide-react';
import { clientPortalAPI, PortalCommunityAddOn, PortalPlan, PortalPlanState } from '../../../services';
import { CLIENT_FEATURE_CATALOG } from '../../../services/modules/subscriptionPackages.api';
import { KEY_LABEL, BASELINE_KEYS } from '../../../services/entitlements';

/**
 * 231 — the client's own plan.
 *
 * The CLIENT audience holds two different customers and one ladder. A pet owner
 * climbs it for convenience; a FARMER climbs it for farm access, which starts
 * at the Farmer rung. That is why farm access is a plan rung and not an add-on:
 * a farmer IS a client, and 230 took CLIENT off the Farms add-on for exactly
 * this reason.
 *
 * 233 — but one ladder for two customers meant every pet owner was offered
 * "Farmer Pro+ — KES 5,000", which is livestock software for a labrador. The
 * server now sends only the rungs this account should see, and `farmAccount`
 * says which of the two it is.
 *
 * ⚠️ The reveal below is FREE. Charging for it would bill the same capability
 * twice — an unlock fee, then the rung that actually grants the farms — so all
 * this control does is stop showing a farmer's ladder to someone with a cat.
 *
 * ⚠️ Free is a real rung, shown alongside the rest, and it is where cancelling
 * returns you. Nothing on this screen can lock a pet owner out of their own
 * pets' records.
 */

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** Same cycles the clinic and supplier plan cards offer — kept local since
 *  PlanCard.tsx does not export its copy. */
const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', SEMIANNUAL: '6 Months',
  YEARLY: 'Yearly', BIENNIAL: '2 Years', TRIENNIAL: '3 Years', ONE_TIME: 'One-off',
};
const CYCLE_SUFFIX: Record<string, string> = {
  MONTHLY: 'mo', QUARTERLY: '3mo', SEMIANNUAL: '6mo',
  YEARLY: 'yr', BIENNIAL: '2yr', TRIENNIAL: '3yr', ONE_TIME: 'once',
};

/** Would `keys` already cover everything the add-on grants? Same subset test
 *  as the clinic side's `planCoversAddOn` — an add-on nobody's keys need is
 *  never worth ticking. */
const coversAddOn = (keys: Set<string>, addOnKeys: string[]) =>
  addOnKeys.length > 0 && addOnKeys.every((k) => keys.has(k));

/**
 * ⚠️ THE CARD READS THE PLAN, NOT A HAND-WRITTEN BLURB.
 *
 * `features` is prose stored on the package row; `featureKeys` is what the
 * gates actually run on. They drift — a plan grants `livestock:feeding` while
 * its blurb still says "priority booking" — and the blurb is the half the
 * customer sees. User, 2026-09-14: *"ensure features in pkgs and in card
 * fetched from the [plan editor]."* So the keys win, and prose is only a
 * fallback for a row nobody has ticked anything on yet.
 */
const BUCKETS: { title: string; keys: string[] }[] = [
  { title: 'Modules', keys: CLIENT_FEATURE_CATALOG.views },
  { title: 'Capabilities', keys: CLIENT_FEATURE_CATALOG.capabilities },
  { title: 'Services', keys: CLIENT_FEATURE_CATALOG.services },
];

/** Every key admin can put on a client plan, in the editor's own order. */
const CATALOG_ORDER = BUCKETS.flatMap((b) => b.keys);

const labelsFor = (keys: string[]) =>
  CATALOG_ORDER.filter((k) => keys.includes(k) && !BASELINE_KEYS.has(k))
    .map((k) => KEY_LABEL[k] ?? k);

const farmLine = (p: PortalPlan) => {
  if (!p.featureKeys.includes('livestock:farms')) return null;
  return p.maxFarms <= 0 ? 'Unlimited farms' : `${p.maxFarms} farm${p.maxFarms === 1 ? '' : 's'}`;
};

const ClientPlan: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PortalPlan[]>([]);
  const [farmAccount, setFarmAccount] = useState(false);
  const [canChooseFarm, setCanChooseFarm] = useState(false);
  const [communityAddOn, setCommunityAddOn] = useState<PortalCommunityAddOn | null>(null);
  const [includeCommunity, setIncludeCommunity] = useState(true);
  /** Selected billing cycle per plan card, keyed by plan id. */
  const [cycles, setCycles] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState<PortalPlanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [switchingFarm, setSwitchingFarm] = useState(false);
  /* The clinic and supplier billing screens split the same two questions —
     "what do I pay" and "what do I get" — and the portal asked only the
     first. Same structure here, portal colours. */
  const [tab, setTab] = useState<'plans' | 'features'>('plans');

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      clientPortalAPI.listPlans(),
      clientPortalAPI.getMyPlan(),
    ]);
    if (p.success && p.data) {
      setPlans(p.data.plans);
      setFarmAccount(p.data.farmAccount);
      setCanChooseFarm(p.data.canChooseFarmPlans);
      setCommunityAddOn(p.data.communityAddOn);
    }
    if (c.success && c.data) setCurrent(c.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentTier = current?.tier ?? 0;

  /**
   * Coming back from Paystack's hosted checkout, the URL carries the reference.
   * Poll it rather than trusting the redirect: the webhook is what actually
   * provisions the plan, and it can land before or after the browser does.
   */
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return;
    let tries = 0;
    const tick = async () => {
      const r = await clientPortalAPI.planPaymentStatus(ref);
      const status = r.data?.status;
      if (status === 'SUCCESS') { await load(); return; }
      if (status === 'FAILED' || status === 'CANCELLED' || ++tries > 20) return;
      setTimeout(tick, 3000);
    };
    tick();
  }, [load]);

  /** The selected cycle's billing option for a plan — defaults to the
   *  cheapest (first) option when nothing has been picked yet. */
  const optionFor = useCallback((plan: PortalPlan) => {
    const wanted = cycles[plan.id];
    return plan.billingOptions.find((o) => o.cycle === wanted) ?? plan.billingOptions[0] ?? null;
  }, [cycles]);

  /** Does the account already hold everything Community Access grants —
   *  by owning it outright, or because the current plan already covers it? */
  const communityOwned = useMemo(() => {
    if (!communityAddOn) return true;
    const mineKeys = new Set(current?.featureKeys ?? []);
    return coversAddOn(mineKeys, communityAddOn.featureKeys);
  }, [communityAddOn, current]);

  useEffect(() => { if (communityOwned) setIncludeCommunity(false); }, [communityOwned]);

  const subscribe = async (plan: PortalPlan) => {
    setBusyId(plan.id);
    const option = optionFor(plan);
    const r = await clientPortalAPI.initiatePlanPayment({
      packageId: plan.id,
      billingOptionId: option?.id,
      cycle: option?.cycle,
      // 288 — ids only, same as the clinic rail: the server prices every
      // line from the catalogue, nothing here says what anything costs.
      addOnPackageIds: (communityAddOn && !communityOwned && includeCommunity) ? [communityAddOn.id] : undefined,
    });
    setBusyId(null);
    // Paystack's hosted checkout — same rail the clinics and suppliers use.
    if (r.success && r.data?.authorizationUrl) window.location.href = r.data.authorizationUrl;
  };

  const cancel = async () => {
    setCancelling(true);
    const r = await clientPortalAPI.cancelMyPlan();
    setCancelling(false);
    if (r.success && r.data) setCurrent(r.data);
  };

  /**
   * Reveal (or hide) the farmer half of the ladder.
   *
   * Not a purchase — the server just records that this account keeps
   * livestock, which is also what the clinics serving them already read. It
   * refuses to hide the rungs while farms exist on the account, so the plan
   * someone is paying for can never disappear from the screen they renew it on.
   */
  const toggleFarm = async () => {
    setSwitchingFarm(true);
    const r = await clientPortalAPI.setFarmAccount(!farmAccount);
    setSwitchingFarm(false);
    if (r.success && r.data) {
      setPlans(r.data.plans);
      setFarmAccount(r.data.farmAccount);
      setCanChooseFarm(r.data.canChooseFarmPlans);
    }
  };

  const ordered = useMemo(() => [...plans].sort((a, b) => a.tier - b.tier), [plans]);

  /**
   * ⚠️ LOCKED means "on a rung above you", not "exists somewhere in the
   * product". Listing a key no plan on this ladder sells would advertise an
   * upgrade the client cannot buy — the lock rule inverted.
   */
  const reachable = useMemo(() => {
    const all = new Set<string>();
    ordered.forEach((p) => p.featureKeys.forEach((k) => all.add(k)));
    return CATALOG_ORDER.filter((k) => all.has(k) && !BASELINE_KEYS.has(k));
  }, [ordered]);

  const mine = useMemo(() => new Set(current?.featureKeys ?? []), [current]);

  /** The cheapest rung that would unlock a key — what the upsell must name. */
  const unlockedBy = useCallback((key: string) => (
    ordered.find((p) => p.featureKeys.includes(key) && p.tier > currentTier)?.name ?? null
  ), [ordered, currentTier]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin cp-accent-text" />
      </div>
    );
  }

  return (
    // The layout already allows 1400px; this view capped itself at 768 and
    // left half the desktop empty beside four plan cards.
    <div className="space-y-5 fade-in">
      <button className="text-xs font-bold cp-accent-text flex items-center gap-1" onClick={() => navigate('/client')}>
        <ArrowLeft className="w-3.5 h-3.5" /> Home
      </button>

      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Your plan</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--cp-ink-soft)' }}>
          You are on <strong>{current?.packageName ?? 'Free'}</strong>
          {current?.state === 'ACTIVE' && current.expiresAt
            ? ` until ${new Date(current.expiresAt).toLocaleDateString()}`
            : ' — and always will be, unless you choose to upgrade'}.
        </p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────
          The clinic and supplier billing pages' own strip, in portal tokens
          rather than the clinic palette — user: "exactly … just keep colors
          for here." */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="inline-flex min-w-max p-1 rounded-2xl border"
          style={{ background: 'var(--cp-surface-2)', borderColor: 'var(--cp-border)' }}
        >
          {([
            { id: 'plans' as const, label: 'Plans', icon: CreditCard },
            { id: 'features' as const, label: 'What you get', icon: Layers },
          ]).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  active ? 'cp-tab-on' : 'cp-muted'
                }`}
              >
                <t.icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Community Access — one shared tick, same shape as the clinic and
          supplier plan cards: ids only, priced by the server, and it rides
          along with whichever plan is bought next. Hidden once the account
          already holds it (owns it outright, or the current plan covers it). */}
      {tab === 'plans' && communityAddOn && !communityOwned && (
        <label className="cp-card p-4 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeCommunity}
            onChange={(e) => setIncludeCommunity(e.target.checked)}
          />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>
              Add {communityAddOn.name} — {money(communityAddOn.price, communityAddOn.currency)}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cp-ink-soft)' }}>
              Added to whichever plan you buy next, on the same billing cycle.
            </p>
          </div>
        </label>
      )}

      {tab === 'plans' && (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ordered.map((p) => {
          const isCurrent = p.tier === currentTier;
          const isDown = p.tier < currentTier;
          const farms = farmLine(p);
          const option = optionFor(p);
          const selectedCycle = option?.cycle;
          return (
            <div
              key={p.id}
              className="cp-card p-5 flex flex-col gap-3"
              style={isCurrent ? { borderColor: 'var(--cp-accent)', borderWidth: 2 } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black text-lg" style={{ color: 'var(--cp-ink)' }}>{p.name}</div>
                  <div className="text-sm font-bold cp-accent-text">
                    {option && Number(option.price) > 0
                      ? `${money(Number(option.price), p.currency)} / ${CYCLE_SUFFIX[option.cycle] ?? option.cycle}`
                      : 'Free, always'}
                  </div>
                  {p.purchasable && p.billingOptions.length > 1 && (
                    <select
                      className="mt-1 text-xs font-bold bg-transparent border rounded-lg px-1.5 py-0.5"
                      style={{ borderColor: 'var(--cp-border)', color: 'var(--cp-ink-soft)' }}
                      value={selectedCycle}
                      onChange={(e) => setCycles((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    >
                      {p.billingOptions.map((o) => (
                        <option key={o.cycle} value={o.cycle}>{CYCLE_LABEL[o.cycle] ?? o.cycle}</option>
                      ))}
                    </select>
                  )}
                </div>
                {isCurrent && (
                  <span className="cp-chip shrink-0">Current</span>
                )}
              </div>

              {farms && (
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--cp-ink-soft)' }}>
                  <Sprout className="w-3.5 h-3.5 cp-accent-text" /> {farms}
                </div>
              )}

              {/* ⚠️ Keys first, prose only as a fallback. See labelsFor. */}
              <ul className="space-y-1.5">
                {(labelsFor(p.featureKeys).length ? labelsFor(p.featureKeys) : p.features).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--cp-ink-soft)' }}>
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 cp-accent-text" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-1">
                {isCurrent ? (
                  // Cancelling returns you to Free — never to nothing. Said out
                  // loud here because "cancel" on every other product means
                  // losing access, and on this one it does not.
                  current?.state === 'ACTIVE' ? (
                    <button className="cp-btn-ghost w-full" onClick={cancel} disabled={cancelling}>
                      {cancelling ? 'Cancelling…' : 'Cancel — back to Free'}
                    </button>
                  ) : (
                    <div className="text-xs font-bold text-center py-2" style={{ color: 'var(--cp-ink-soft)' }}>
                      This is what you have
                    </div>
                  )
                ) : isDown || !p.purchasable ? (
                  <div className="text-xs font-bold text-center py-2" style={{ color: 'var(--cp-ink-soft)' }}>
                    {p.purchasable ? 'Included in your plan' : 'Everyone has this'}
                  </div>
                ) : (
                  <button className="cp-btn w-full flex items-center justify-center gap-1.5" onClick={() => subscribe(p)} disabled={busyId === p.id}>
                    {busyId === p.id
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening checkout…</>
                      : <>Upgrade to {p.name} <ExternalLink className="w-3.5 h-3.5" /></>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* ══ What you get ═══════════════════════════════════════════════════
          The same included/locked split the clinic and supplier pages show,
          read from the keys the gates run on. A locked row names the rung
          that unlocks it — sell the lock, never hide it. */}
      {tab === 'features' && (
        <div className="space-y-4">
          {BUCKETS.map((b) => {
            const rows = b.keys.filter((k) => reachable.includes(k));
            if (rows.length === 0) return null;
            return (
              <div key={b.title} className="cp-card p-4 sm:p-5">
                <h3 className="text-[10px] font-black uppercase tracking-widest cp-muted mb-3">
                  {b.title}
                  <span className="ml-2 cp-accent-text">
                    {rows.filter((k) => mine.has(k)).length} of {rows.length}
                  </span>
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rows.map((k) => {
                    const has = mine.has(k);
                    const rung = has ? null : unlockedBy(k);
                    return (
                      <div
                        key={k}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border"
                        style={{
                          borderColor: has ? 'var(--cp-accent)' : 'var(--cp-border)',
                          background: has ? 'transparent' : 'var(--cp-surface-2)',
                        }}
                      >
                        {has
                          ? <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 cp-accent-text" />
                          : <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 cp-muted" />}
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate" style={{ color: has ? 'var(--cp-ink)' : 'var(--cp-ink-soft)' }}>
                            {KEY_LABEL[k] ?? k}
                          </div>
                          {rung && (
                            <button
                              onClick={() => setTab('plans')}
                              className="text-[10px] font-black uppercase tracking-widest cp-accent-text"
                            >
                              On {rung} →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/*
        The way IN and the way OUT of the farmer ladder.

        Without this the gate is a dead end: a pet owner who buys a smallholding
        would see Free and Plus forever, and every route to farm mode — the
        `is_livestock` flag, owning a farm, holding a farm plan — presupposes
        already being through it.

        Hidden whenever the switch would not actually move anything: while they
        hold a farm plan or own a farm ("hide farm plans" beside the Farmer plan
        they pay for is an offer the server will rightly refuse, and it would
        read as a cancel button that is not one), and when an admin or the
        platform mode made the decision instead. A dead control is worse than no
        control — it makes the client doubt what they are seeing.
      */}
      {canChooseFarm && (
        <div className="cp-card p-4 flex items-start gap-3">
          <Sprout className="w-4 h-4 mt-0.5 shrink-0 cp-accent-text" />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>
              {farmAccount ? 'Farm plans are on for this account' : 'Do you keep livestock?'}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cp-ink-soft)' }}>
              {farmAccount
                ? 'The Farmer plans above cover farms, herds, feeding and produce. Turn them off to go back to the pet-owner plans.'
                : 'Turn on farm plans to see Farmer, Farmer Pro and Farmer Pro+ — for farms, herds, feeding and produce. Free to turn on; you only pay if you pick one.'}
            </p>
          </div>
          <button className="cp-btn-ghost shrink-0" onClick={toggleFarm} disabled={switchingFarm}>
            {switchingFarm ? '…' : farmAccount ? 'Turn off' : 'Show farm plans'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientPlan;

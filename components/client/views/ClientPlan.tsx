import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Sprout, ExternalLink } from 'lucide-react';
import { clientPortalAPI, PortalPlan, PortalPlanState } from '../../../services';

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

const farmLine = (p: PortalPlan) => {
  if (!p.featureKeys.includes('livestock:farms')) return null;
  return p.maxFarms <= 0 ? 'Unlimited farms' : `${p.maxFarms} farm${p.maxFarms === 1 ? '' : 's'}`;
};

const ClientPlan: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PortalPlan[]>([]);
  const [farmAccount, setFarmAccount] = useState(false);
  const [canChooseFarm, setCanChooseFarm] = useState(false);
  const [current, setCurrent] = useState<PortalPlanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [switchingFarm, setSwitchingFarm] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      clientPortalAPI.listPlans(),
      clientPortalAPI.getMyPlan(),
    ]);
    if (p.success && p.data) {
      setPlans(p.data.plans);
      setFarmAccount(p.data.farmAccount);
      setCanChooseFarm(p.data.canChooseFarmPlans);
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

  const subscribe = async (plan: PortalPlan) => {
    setBusyId(plan.id);
    const r = await clientPortalAPI.initiatePlanPayment({ packageId: plan.id });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin cp-accent-text" />
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in max-w-3xl">
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

      <div className="grid gap-3 sm:grid-cols-2">
        {ordered.map((p) => {
          const isCurrent = p.tier === currentTier;
          const isDown = p.tier < currentTier;
          const farms = farmLine(p);
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
                    {p.price > 0 ? `${money(p.price, p.currency)} / month` : 'Free, always'}
                  </div>
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

              <ul className="space-y-1.5">
                {p.features.map((f, i) => (
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

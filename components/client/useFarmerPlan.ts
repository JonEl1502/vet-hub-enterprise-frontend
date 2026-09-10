import { useEffect, useState } from 'react';
import { clientPortalAPI, type PortalPlan } from '../../services';

/**
 * 288 — THE FARMER RUNG'S REAL PRICE, from the catalogue.
 *
 * Three places in the portal sold the paid farm product as a hardcoded
 * **"KES 1,500/mo"**: the rail promo in `ClientLayout`, and the upgrade panels
 * in `ClientFarms` and `ClientFarmMedical`.
 *
 * That went stale the moment the catalogue moved. Migration 288 repriced the
 * whole platform to test values (Farmer is now **15**), and a farmer looking at
 * their own portal was still quoted 1,500 — a hundred times the price the
 * checkout would actually charge. A number typed into JSX cannot be repriced by
 * an admin, which is the whole reason the price lives in a table.
 *
 * ⚠️ Fails SOFT and renders NOTHING rather than a guess. There is deliberately
 * no fallback constant here: a wrong price in an upsell is worse than no price,
 * because the customer only finds out at the checkout. Callers hide the figure
 * when this returns null.
 *
 * Cached at module scope — three components mount this on the same screen and
 * the ladder does not change between them.
 */
export interface FarmerPlanPrice {
  name: string;
  price: number;
  currency: string;
}

let cached: FarmerPlanPrice | null = null;
let inFlight: Promise<FarmerPlanPrice | null> | null = null;

const resolve = async (): Promise<FarmerPlanPrice | null> => {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = clientPortalAPI.listPlans({ silent: true })
      .then((r) => {
        const plans: PortalPlan[] = (r.success && r.data?.plans) || [];
        // The cheapest PURCHASABLE farm rung — that is what "upgrade to the
        // paid farm product" costs, whatever it happens to be called.
        const farm = plans
          .filter((p) => p.farmPlan && p.purchasable && Number(p.price) > 0)
          .sort((a, b) => Number(a.price) - Number(b.price))[0];
        if (!farm) return null;
        cached = { name: farm.name, price: Number(farm.price), currency: farm.currency || 'KES' };
        return cached;
      })
      .catch(() => null)
      .finally(() => { inFlight = null; });
  }
  return inFlight;
};

export const useFarmerPlan = (): FarmerPlanPrice | null => {
  const [plan, setPlan] = useState<FarmerPlanPrice | null>(cached);
  useEffect(() => {
    let alive = true;
    resolve().then((p) => { if (alive && p) setPlan(p); });
    return () => { alive = false; };
  }, []);
  return plan;
};

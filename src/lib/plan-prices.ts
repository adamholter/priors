import { currentPlanName, planReadings, subscriptionPlanOptions, subscriptionPrices, type PlanReading, type SubscriptionPrice } from "@/data/subscription";
import type { Snapshot } from "@/data/types";

/** One plan's price for a model: `ratio` is the share of API cost a subscriber pays (0.07 = 7% of API price). */
export interface PlanPrice { plan: string; feeUsd?: number; ratio: number; confidence: string }
export interface PlanPriceModel extends PlanPrice {
  id: string; name: string; lab: string;
  /** This model's slugs on artificialanalysis.ai, one per reasoning effort it lists. */
  aa: string[];
  /** The model is free today. `paid` is what it costs on a paid plan, when it has one. */
  free?: true;
  paid?: PlanPrice;
  /** The model's share on each plan its lab sells, for labs with more than one. */
  plans?: Record<string, { ratio: number; feeUsd?: number }>;
  /** The share read more than one way (Fable 5.2: the shared weekly limit, or only the Fable a plan can buy). The first is `ratio`. */
  readings?: PlanReading[];
}
export interface PlanPrices {
  date: string;
  /** When the snapshot these figures come from was built: the scrape job rebuilds it every 15 minutes. */
  generatedAt: string;
  /** Labs that sell more than one plan, with the plans a viewer can pick between. */
  labs: { id: string; name: string; plans: { plan: string; feeUsd?: number }[] }[];
  models: PlanPriceModel[];
}

const AA_MODEL = /^https:\/\/artificialanalysis\.ai\/models\/([a-z0-9][a-z0-9._-]*)\/?$/i;
const round = (n: number) => +n.toPrecision(5);
/** The share to scale an Artificial Analysis cost by: its own when AA priced the cost at another list price than the lab charges today. */
const share = (p: SubscriptionPrice): PlanPrice => ({ plan: currentPlanName(p.plan), ...(p.feeUsd != null ? { feeUsd: p.feeUsd } : {}), ratio: round(p.aaCostRatio ?? p.ratio), confidence: p.confidence });

/**
 * Every model a first-party plan sells, with the share of API price its subscribers pay: the figures
 * behind the cost charts' Subscription pricing, for tools that reprice someone else's API-priced costs
 * (the AA Plus browser extension reads this at `/api/plan-prices`). Models without a plan are absent.
 */
export function planPrices(snapshot: Snapshot): PlanPrices {
  const withFree = subscriptionPrices(snapshot), paid = subscriptionPrices(snapshot, {}, { free: false });
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const slugs = new Map<string, Set<string>>();
  for (const o of snapshot.observations) {
    const slug = o.sourceUrl?.match(AA_MODEL)?.[1], modelId = slug && (modelOf.get(o.variantId) ?? o.variantId.split("@")[0]);
    if (modelId) (slugs.get(modelId) ?? slugs.set(modelId, new Set()).get(modelId)!).add(slug);
  }
  // AA's newer rows link to evaluation pages; the variant still records the model page it came from.
  for (const v of snapshot.variants) for (const m of [v.sourceModel, ...(v.sourceModels ?? [])]) {
    const slug = m?.url?.match(AA_MODEL)?.[1];
    if (slug) (slugs.get(v.modelId) ?? slugs.set(v.modelId, new Set()).get(v.modelId)!).add(slug);
  }
  const labName = new Map(snapshot.labs.map((l) => [l.id, l.name])), labOf = new Map(snapshot.models.map((m) => [m.id, m.labId]));
  const options = subscriptionPlanOptions(snapshot);
  const readings = new Map(planReadings(snapshot).map((m) => [m.modelId, m.readings.map((r) => ({ ...r, ratio: round(r.ratio) }))]));
  // One pass per plan a lab sells: what each of that lab's models costs on it.
  const byPlan = new Map<string, Record<string, { ratio: number; feeUsd?: number }>>();
  for (const lab of options) for (const { plan } of lab.plans) {
    for (const [id, p] of subscriptionPrices(snapshot, { [lab.labId]: plan }, { free: false })) {
      if (labOf.get(id) !== lab.labId || currentPlanName(p.plan) !== currentPlanName(plan)) continue;
      (byPlan.get(id) ?? byPlan.set(id, {}).get(id)!)[currentPlanName(plan)] = { ratio: round(p.aaCostRatio ?? p.ratio), ...(p.feeUsd != null ? { feeUsd: p.feeUsd } : {}) };
    }
  }
  const models = snapshot.models.flatMap((m): PlanPriceModel[] => {
    const now = withFree.get(m.id), paying = paid.get(m.id);
    if (!now && !paying) return [];
    const free = !!now && now.ratio === 0, plans = byPlan.get(m.id);
    return [{ id: m.id, name: m.name, lab: m.labId, aa: [...(slugs.get(m.id) ?? [])].sort(), ...share(now ?? paying!), ...(free ? { free: true as const, ...(paying && paying.ratio > 0 ? { paid: share(paying) } : {}) } : {}), ...(plans && Object.keys(plans).length > 1 ? { plans } : {}), ...(readings.has(m.id) ? { readings: readings.get(m.id) } : {}) }];
  });
  return {
    date: snapshot.date, generatedAt: snapshot.generatedAt,
    labs: options.map((l) => ({ id: l.labId, name: labName.get(l.labId) ?? l.labId, plans: l.plans.map((p) => ({ plan: currentPlanName(p.plan), ...(p.feeUsd != null ? { feeUsd: p.feeUsd } : {}) })) })),
    models,
  };
}

import type { AppliedSpeedTier, RankedVariant } from "@/engine";
import { subscriptionPrices, type SubscriptionPrice } from "./subscription";
import type { Snapshot, SpeedTierId, SpeedTierPlanRate, SpeedTierRate } from "./types";

/**
 * Speed tiers: the same model run faster or cheaper than standard (OpenAI's Flex, Fast and Ultrafast, Claude Opus Fast).
 * The score never changes, so a tier is a chart row made from the model's standard row: its cost and speed scaled by what
 * the scrape job read (`scripts/scrape/speed-tiers.ts`). Rows get their own model id (`gpt-6.1-sol+fast`) so everything
 * that groups by model (effort lines, labels, best per model, bars) treats a tier as its own line.
 *
 * Cost per task follows the price, since a tier spends the same tokens. Speed is measured on one effort and applied to
 * all: a model's output speed barely moves with effort. Time per task is tokens over speed, so it divides by the same ratio.
 *
 * Billing, on subscription pricing: a tier a plan covers spends the allowance at its usage rate, on the only plan that has
 * it if there is one (Ultrafast, Pro 500). Any other tier costs what the API charges whatever plan you hold (Flex, Opus Fast).
 */
export type SpeedTierChoice = "standard" | SpeedTierId;
export const SPEED_TIERS: { id: SpeedTierChoice; name: string }[] = [{ id: "standard", name: "Standard" }, { id: "flex", name: "Flex" }, { id: "fast", name: "Fast" }, { id: "ultrafast", name: "Ultrafast" }];
const TIER_NAME: Record<SpeedTierId, string> = { flex: "Flex", fast: "Fast", ultrafast: "Ultrafast" };
const TIER_IDS = Object.keys(TIER_NAME) as SpeedTierId[];
const SEP = "+";

export const isSpeedTierChoice = (value: string): value is SpeedTierChoice => SPEED_TIERS.some((t) => t.id === value);
/** The model a tier row belongs to: its model page, its highlight. */
export const baseModelId = (id: string) => id.split(SEP)[0];
/** Every id a chart can draw a model under. */
export const tierModelIds = (modelId: string) => modelId.includes(SEP) ? [modelId] : [modelId, ...TIER_IDS.map((t) => `${modelId}${SEP}${t}`)];

export const hasSpeedTiers = (snapshot: Snapshot) => !!snapshot.speedTiers?.rates.length;

/** The model's name with its tier, for a highlight on a tier row. */
export const tierModelName = (modelId: string, name: (id: string) => string | undefined) => {
  const [base, tier] = modelId.split(SEP), own = name(base) ?? base;
  return tier ? `${own} ${TIER_NAME[tier as SpeedTierId] ?? tier}` : own;
};

export interface SpeedTierOptions {
  /** `cost` keeps every priced tier and names API billing in the mark's label. `speed` keeps a model at standard where its tier has no measured speed, so it never drops off a time or speed chart. */
  chart: "cost" | "speed";
}

function planRateOf(snapshot: Snapshot, labId: string, tier: SpeedTierId): SpeedTierPlanRate | undefined {
  return snapshot.speedTiers?.planRates.find((p) => p.labId === labId && p.tier === tier);
}

/** A tier's cost, on the basis the row was priced at. Undefined when the row has no cost to scale, or is on a free plan with no API cost to work from. */
function tierCost(r: RankedVariant, rate: SpeedTierRate, planRate: SpeedTierPlanRate | undefined, planShare: (plan: string) => number | undefined) {
  if (r.costUsd == null) return undefined;
  const plan = r.costPlan;
  if (!plan) return { usd: r.costUsd * rate.priceMultiple, source: `${r.costSource ?? ""} · ${TIER_NAME[rate.tier]}, ${rate.priceMultiple}x API price` };
  if (!(plan.ratio > 0)) return undefined;
  const api = r.costUsd / plan.ratio;
  const share = planRate && (planRate.plan ? planShare(planRate.plan) : plan.ratio);
  if (planRate && share) return {
    usd: api * share * planRate.usageMultiple,
    plan: { ...plan, plan: planRate.plan ?? plan.plan, ratio: share * planRate.usageMultiple / rate.priceMultiple },
    source: `${r.costSource ?? ""} · ${TIER_NAME[rate.tier]}, ${planRate.usageMultiple}x usage on ${planRate.plan ?? plan.plan}`,
    usageMultiple: planRate.usageMultiple, planName: planRate.plan ?? plan.plan,
  };
  return { usd: api * rate.priceMultiple, source: `${r.costSource ?? ""} · ${TIER_NAME[rate.tier]}, billed at API rates (${rate.priceMultiple}x)`, apiRates: true };
}

/**
 * The rows a cost, time or speed chart draws for the picked tiers. A picked tier replaces a model's standard row unless
 * Standard is picked too; a model without a picked tier keeps its standard row. `chosen` is the index's plan per lab.
 */
export function withSpeedTiers(ranked: RankedVariant[], snapshot: Snapshot, tiers: string[] | undefined, chosen: Record<string, string> = {}, { chart }: SpeedTierOptions = { chart: "cost" }): RankedVariant[] {
  const picked = TIER_IDS.filter((t) => tiers?.includes(t)), data = snapshot.speedTiers;
  if (!picked.length || !data?.rates.length) return ranked;
  const standard = !tiers?.length || tiers.includes("standard");
  const rates = new Map<string, SpeedTierRate[]>();
  for (const rate of data.rates) if (picked.includes(rate.tier)) (rates.get(rate.modelId) ?? rates.set(rate.modelId, []).get(rate.modelId)!).push(rate);
  const base = subscriptionPrices(snapshot, chosen);
  const onPlan = new Map<string, Map<string, SubscriptionPrice>>();
  // A plan's share of API price with resets counted: the row's own share already has them, so the same factor carries to the plan a tier needs.
  const share = (r: RankedVariant, plan: string) => {
    const prices = onPlan.get(plan) ?? onPlan.set(plan, subscriptionPrices(snapshot, { ...chosen, [r.model.labId]: plan })).get(plan)!, own = prices.get(r.model.id);
    // A model without that plan keeps its median one, which is not a price for this tier.
    if (!own || own.ratio <= 0 || own.plan !== plan) return undefined;
    const listed = base.get(r.model.id)?.ratio;
    return own.ratio * (listed && r.costPlan ? r.costPlan.ratio / listed : 1);
  };
  return ranked.flatMap((r) => {
    const rows: RankedVariant[] = [];
    for (const rate of rates.get(r.model.id) ?? []) {
      if (chart === "speed" && !rate.speedMultiple) continue;
      const planRate = planRateOf(snapshot, r.model.labId, rate.tier), cost = tierCost(r, rate, planRate, (plan) => share(r, plan));
      if (r.costPlan && !cost) continue;
      const modelId = `${r.model.id}${SEP}${rate.tier}`;
      const tier: AppliedSpeedTier = {
        id: rate.tier, name: TIER_NAME[rate.tier], baseVariantId: r.variant.id, priceMultiple: rate.priceMultiple,
        ...(rate.speedMultiple ? { speedMultiple: rate.speedMultiple, speedSource: rate.speedSource } : {}), ...(rate.errorRate ? { errorRate: rate.errorRate } : {}),
        // Billing belongs on a cost chart. A speed chart's mark needs only the tier's name.
        ...(cost?.apiRates && chart === "cost" ? { apiRates: true } : {}), ...(cost?.usageMultiple ? { usageMultiple: cost.usageMultiple, plan: cost.planName } : {}),
      };
      rows.push({
        ...r, model: { ...r.model, id: modelId, name: `${r.model.name} ${TIER_NAME[rate.tier]}` },
        variant: { ...r.variant, id: r.variant.id.startsWith(r.model.id) ? `${modelId}${r.variant.id.slice(r.model.id.length)}` : `${modelId}@${r.variant.effort}`, modelId, aliases: undefined },
        costUsd: cost?.usd, costSource: cost?.source, costPlan: cost?.plan, speed: r.speed && rate.speedMultiple ? r.speed * rate.speedMultiple : undefined,
        speedTier: tier,
      });
    }
    return rows.length && !standard ? rows : [r, ...rows];
  });
}

const times = (n: number) => `${parseFloat(n.toFixed(2))}x`;

/** One line per tier for chart settings: what it costs against standard, and how each lab bills it. */
export function speedTierRows(snapshot: Snapshot): { tier: SpeedTierId; name: string; text: string }[] {
  const data = snapshot.speedTiers;
  if (!data) return [];
  const labOf = new Map(snapshot.models.map((m) => [m.id, m.labId])), labName = new Map(snapshot.labs.map((l) => [l.id, l.name]));
  return TIER_IDS.flatMap((tier) => {
    const byLab = new Map<string, number[]>();
    for (const r of data.rates) if (r.tier === tier) { const lab = labOf.get(r.modelId); if (lab) (byLab.get(lab) ?? byLab.set(lab, []).get(lab)!).push(r.priceMultiple); }
    if (!byLab.size) return [];
    const parts = [...byLab].map(([lab, prices]) => {
      const price = [...prices].sort((a, b) => a - b)[prices.length >> 1], plan = planRateOf(snapshot, lab, tier);
      return `${byLab.size > 1 ? `${labName.get(lab) ?? lab}: ` : ""}${times(price)} API price${plan ? `, or ${times(plan.usageMultiple)} usage on ${plan.plan ?? "a plan"}` : ", billed at API rates"}`;
    });
    return [{ tier, name: TIER_NAME[tier], text: `${parts.join(". ")}.` }];
  });
}

/** What ChartSettings needs for its Speed tiers section. Undefined for a snapshot from before tiers were scraped. */
export const speedTierSettings = (snapshot: Snapshot, value: string[] | undefined, onChange: (tiers: string[] | undefined) => void) =>
  hasSpeedTiers(snapshot) ? { value: value?.length ? value : ["standard"], onChange, rows: speedTierRows(snapshot) } : undefined;

/** The line under a chart that draws tier rows, so a reader knows what was scaled and how it was billed. Empty when no tier is drawn. */
export function speedTierLegend(rows: RankedVariant[], chart: "cost" | "speed"): string {
  const tiers = rows.flatMap((r) => r.speedTier ? [r.speedTier] : []);
  if (!tiers.length) return "";
  if (chart === "speed") {
    const sources = [...new Set(tiers.flatMap((t) => t.speedSource ? [t.speedSource.split(",")[0]] : []))];
    return `Speed tiers are scaled by the speed ${sources.join(" or ")} measured for each tier on one effort, applied to every effort.`;
  }
  const notes: string[] = [];
  const planned = new Map(tiers.filter((t) => t.usageMultiple).map((t) => [t.id, t]));
  for (const t of planned.values()) notes.push(`${t.name} spends ${t.id === "ultrafast" && t.plan ? `${t.plan}'s` : "the plan's"} allowance at ${times(t.usageMultiple!)}.`);
  if (tiers.some((t) => t.apiRates)) notes.push("Marks named API rates cost what the API charges, since no plan covers that tier.");
  return notes.join(" ");
}

/** Tooltip text for a tier row: what was scaled, by how much, measured by whom. */
export function speedTierNote(r: RankedVariant): string {
  const t = r.speedTier;
  if (!t) return "";
  const speed = t.speedMultiple ? `${times(t.speedMultiple)} speed (${t.speedSource})` : "speed not measured";
  const price = t.usageMultiple ? `${times(t.usageMultiple)} usage on ${t.plan}` : `${times(t.priceMultiple)} API price${t.apiRates ? ", billed at API rates" : ""}`;
  return `${t.name}: ${price}, ${speed}${t.errorRate && t.errorRate >= 0.02 ? `, ${Math.round(t.errorRate * 100)}% of requests failed` : ""}`;
}

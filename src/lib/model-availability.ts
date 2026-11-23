import { columnsOf, observationsOf } from "@/data/columns";
import { modelProviders, type ModelProviders } from "@/data/providers";
import { peakKind, studentBase, type PlanCaveat } from "@/data/subscription";
import type { Snapshot } from "@/data/types";
import { computeIndex, defaultConfig, selectVariants } from "@/engine";
import { planPrices, soldAs, type PlanPriceModel, type PlanPrices } from "./plan-prices";

const PLAN_LISTINGS_ID = "plan-listed-models";

/** One subscription that sells a model. `ratio` is the share of API price its subscribers pay, absent when no one has measured it. */
export interface PlanOffer { plan: string; feeUsd?: number; ratio?: number; free?: true; assumed?: true; preliminary?: PlanCaveat }
export interface ModelAvailability extends ModelProviders { plans: PlanOffer[] }
/** A company selling plans. `plans[0]` is its default: a current plan selling its best-ranked models, then the one most models are priced on. */
export interface SubsidySeller { id: string; name: string; logo: boolean; plans: PlanSubsidy[] }
/** `multiple` is absent for a model the plan sells but no one has measured. */
export interface PlanSubsidy { plan: string; feeUsd?: number; median: number; models: { id: string; name: string; lab: string; multiple?: number; assumed?: true; preliminary?: PlanCaveat }[] }

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Peak-hour and blended rows repeat a plan at other rates, and a student price repeats it at another fee. */
const listed = (plan: string) => !studentBase(plan) && !["peak", "mixed"].includes(peakKind(plan)?.kind ?? "");

/** The plans that sell a model, cheapest first. A free tier leads. */
export function plansOf(m: PlanPriceModel): PlanOffer[] {
  // Each plan carries its own confidence: Devin Max measured on GPT-6.2 Sol is not assumed because Sol's ChatGPT price is.
  const assumedIf = (c?: string) => /^(assumed|estimated)/.test(c ?? "") ? { assumed: true as const } : {}, assumed = assumedIf(m.confidence);
  const paid = new Map(Object.entries(m.plans ?? {}).map(([plan, p]) => [plan, { plan, ...(p.feeUsd != null ? { feeUsd: p.feeUsd } : {}), ratio: p.listRatio ?? p.ratio, ...(p.preliminary ? { preliminary: p.preliminary } : {}), ...(p.confidence !== undefined ? assumedIf(p.confidence) : assumed) }]));
  const own = m.free ? m.paid : m, name = own && soldAs(own.plan);
  if (own && name && !paid.has(name) && own.ratio > 0) paid.set(name, { plan: name, ...(own.feeUsd != null ? { feeUsd: own.feeUsd } : {}), ratio: own.listRatio ?? own.ratio, ...(own.preliminary ? { preliminary: own.preliminary } : {}), ...assumed });
  const rows = sortOffers([...paid.values()].filter((p) => listed(p.plan) && p.ratio > 0));
  return m.free ? [{ plan: soldAs(m.plan), ratio: 0, free: true, ...(m.feeUsd != null ? { feeUsd: m.feeUsd } : {}) }, ...rows] : rows;
}
const sortOffers = <T extends PlanOffer>(rows: T[]) => rows.sort((a, b) => (a.feeUsd ?? Infinity) - (b.feeUsd ?? Infinity) || a.plan.localeCompare(b.plan));

const cache = new WeakMap<Snapshot, { prices: PlanPrices; offers: Map<string, PlanOffer[]> }>();
/** Every model's plans: the measured and assumed figures Priors prices with, plus plans a seller lists for a model with no figure yet. */
function plansData(snapshot: Snapshot) {
  let data = cache.get(snapshot);
  if (data) return data;
  const prices = planPrices(snapshot), offers = new Map(prices.models.map((m) => [m.id, plansOf(m)])), fees = new Map<string, number>(), modelOf = columnsOf(snapshot).modelOf;
  for (const list of offers.values()) for (const p of list) if (p.feeUsd != null && !p.free) fees.set(p.plan, p.feeUsd);
  for (const o of observationsOf(snapshot, PLAN_LISTINGS_ID)) {
    const id = modelOf.get(o.variantId) ?? o.variantId.split("@")[0], own = offers.get(id) ?? [], have = new Set(own.map((p) => p.plan));
    const extra = ((o.details?.plans ?? []) as { plan: string; feeUsd?: number }[]).filter((p) => !have.has(p.plan)).map(({ plan, feeUsd }): PlanOffer => { const fee = feeUsd ?? fees.get(plan); return { plan, ...(fee != null ? { feeUsd: fee } : {}) }; });
    if (extra.length) offers.set(id, sortOffers([...own, ...extra]));
  }
  cache.set(snapshot, data = { prices, offers });
  return data;
}

/** Where a model can be used: the API providers serving it and the subscriptions selling it. Undefined when nothing is known. */
export function modelAvailability(snapshot: Snapshot, modelId: string): ModelAvailability | undefined {
  const plans = plansData(snapshot).offers.get(modelId) ?? [], providers = modelProviders(snapshot, modelId);
  return plans.length || providers.providers.length ? { ...providers, plans } : undefined;
}

/** Every paid plan with what each of its models gives per dollar at API prices, most generous plan first. Unmeasured models come last. */
export function planSubsidies(snapshot: Snapshot): PlanSubsidy[] {
  const plans = new Map<string, Omit<PlanSubsidy, "median">>(), models = new Map(snapshot.models.map((m) => [m.id, m]));
  for (const [id, offers] of plansData(snapshot).offers) for (const p of offers) {
    const m = models.get(id);
    if (p.free || !m) continue;
    const row = plans.get(p.plan) ?? plans.set(p.plan, { plan: p.plan, feeUsd: p.feeUsd, models: [] }).get(p.plan)!;
    row.models.push({ id, name: m.name, lab: m.labId, ...(p.ratio ? { multiple: 1 / p.ratio } : {}), ...(p.assumed ? { assumed: true as const } : {}), ...(p.preliminary ? { preliminary: p.preliminary } : {}) });
  }
  return [...plans.values()].map((p) => ({ ...p, median: median(p.models.flatMap((m) => m.multiple ?? [])), models: p.models.sort((a, b) => (b.multiple ?? -1) - (a.multiple ?? -1) || a.name.localeCompare(b.name)) })).sort((a, b) => b.median - a.median || a.plan.localeCompare(b.plan));
}

/** Who sells a plan, read from its name, and whose models count as the seller's own. Logos are in `public/logos/<id>.png`. */
const SELLERS: { id: string; name: string; plans: RegExp; lab?: string }[] = [
  { id: "anthropic", name: "Anthropic", plans: /^Claude\b/, lab: "anthropic" }, { id: "openai", name: "OpenAI", plans: /^ChatGPT\b/, lab: "openai" }, { id: "google", name: "Google", plans: /^Google AI\b/, lab: "google" }, { id: "xai", name: "xAI", plans: /^SuperGrok\b/, lab: "xai" },
  { id: "cursor", name: "Cursor", plans: /^Cursor\b/, lab: "cursor" }, { id: "kimi", name: "Kimi", plans: /^Kimi\b/, lab: "moonshot" }, { id: "zhipu", name: "Z.ai", plans: /^GLM\b/, lab: "zhipu" }, { id: "minimax", name: "MiniMax", plans: /^MiniMax\b/, lab: "minimax" },
  { id: "xiaomi", name: "Xiaomi", plans: /^MiMo\b/, lab: "xiaomi" }, { id: "tencent", name: "Tencent", plans: /^Tencent\b/, lab: "tencent" }, { id: "alibaba", name: "Alibaba", plans: /^(阿里云|Alibaba\b|Qwen\b)/, lab: "alibaba" }, { id: "mistral", name: "Mistral", plans: /^Mistral\b/, lab: "mistral" },
  { id: "opencode", name: "OpenCode", plans: /^OpenCode\b/ }, { id: "commandcode", name: "Command Code", plans: /^Command Code\b/ }, { id: "factory", name: "Factory", plans: /^Droid\b/ }, { id: "ollama", name: "Ollama", plans: /^Ollama\b/ },
  { id: "devin", name: "Devin", plans: /^Devin\b/, lab: "cognition" }, { id: "deeprelay", name: "DeepRelay", plans: /^DeepRelay\b/ },
];
/** Plans a new subscriber can no longer buy. */
const closed = (plan: string) => /\blegacy\b|existing subscribers/i.test(plan);
const earlier = (a: number[], b: number[]) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? Infinity) - (b[i] ?? Infinity); if (d) return d; } return 0; };

const sellersCache = new WeakMap<Snapshot, SubsidySeller[]>();
/** Plans grouped by the company selling them, the most generous default plan first. Plans no longer sold come last in a company's list. */
export function subsidySellers(snapshot: Snapshot): SubsidySeller[] {
  const hit = sellersCache.get(snapshot);
  if (hit) return hit;
  const defaults = new Map<string, number>();
  for (const m of plansData(snapshot).prices.models) { const own = m.free ? m.paid : m, plan = own && soldAs(own.plan); if (plan) defaults.set(plan, (defaults.get(plan) ?? 0) + 1); }
  const place = new Map(selectVariants(computeIndex(snapshot, { ...defaultConfig(snapshot), variants: "all" }).ranked, "best").map((r, i) => [r.model.id, i]));
  const groups = new Map<string, { seller: SubsidySeller; lab?: string }>();
  for (const plan of planSubsidies(snapshot)) {
    const known = SELLERS.find((s) => s.plans.test(plan.plan)), id = known?.id ?? plan.plan;
    (groups.get(id) ?? groups.set(id, { seller: { id, name: known?.name ?? plan.plan, logo: !!known, plans: [] }, lab: known?.lab }).get(id)!).seller.plans.push(plan);
  }
  const out = [...groups.values()].map(({ seller, lab }) => {
    const ranks = (p: PlanSubsidy) => p.models.flatMap((m) => (m.lab === lab ? place.get(m.id) ?? [] : [])).sort((a, b) => a - b);
    const byFee = (a: PlanSubsidy, b: PlanSubsidy) => Number(closed(a.plan)) - Number(closed(b.plan)) || (a.feeUsd ?? Infinity) - (b.feeUsd ?? Infinity) || a.plan.localeCompare(b.plan);
    const byDefault = (a: PlanSubsidy, b: PlanSubsidy) => Number(closed(a.plan)) - Number(closed(b.plan)) || earlier(ranks(a), ranks(b)) || (lab ? (defaults.get(b.plan) ?? 0) - (defaults.get(a.plan) ?? 0) : 0) || b.models.length - a.models.length || byFee(a, b);
    // Among models with no figure yet, the seller's own best-ranked come first.
    const order = (p: PlanSubsidy) => ({ ...p, models: [...p.models].sort((a, b) => (b.multiple ?? -1) - (a.multiple ?? -1) || Number(b.lab === lab) - Number(a.lab === lab) || (place.get(a.id) ?? Infinity) - (place.get(b.id) ?? Infinity) || a.name.localeCompare(b.name)) });
    const [first, ...rest] = [...seller.plans].sort(byDefault);
    return { ...seller, plans: [first, ...rest.sort(byFee)].map(order) };
  }).sort((a, b) => b.plans[0].median - a.plans[0].median || a.name.localeCompare(b.name));
  sellersCache.set(snapshot, out);
  return out;
}

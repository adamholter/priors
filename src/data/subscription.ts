import type { Snapshot } from "./types";

/** Subscription token price per model, scraped from Real API Pricing (`scripts/scrape/sources/realapipricing.ts`). */
export const SUBSCRIPTION_BENCHMARK = "subscription-token-price";

/** How cost per task is priced: at API list prices, or at what a subscriber to the lab's plan pays. */
export type CostBasis = "api" | "subscription";
export const COST_BASES: { id: CostBasis; name: string }[] = [{ id: "subscription", name: "Subscription" }, { id: "api", name: "API" }];
/** Subscription pricing is the default; `costBasis` is only stored when someone picks API. Without plan data in the snapshot everything is API-priced. */
export const effectiveBasis = (basis: CostBasis | undefined, hasPrices = true): CostBasis => hasPrices ? basis ?? "subscription" : "api";
export const isCostBasis = (value: string): value is CostBasis => COST_BASES.some((b) => b.id === value);

/** Token shares of the workload a plan's allowance was converted with; they sum to 1. */
export interface TokenMix { cache: number; input: number; output: number; cacheWrite?: number }

/** A model's token mix measured from T3 Code usage over a rolling 7 days, on its busiest harness. */
export interface MeasuredTokenMix extends TokenMix {
  harness: string; tokens: number; start: string; end: string;
  /** "high" from 100B tokens in the window, "medium" from 1B. Less than that isn't published, and the assumed mix stands. */
  confidence: "high" | "medium";
  /** Other harnesses with enough usage to measure. */
  byHarness?: Record<string, TokenMix & { tokens: number }>;
}

export interface SubscriptionDetails {
  plan: string;
  /** Set when the share of API price is known directly (a published plan allowance), instead of derived from `mix` and a list price. */
  ratio?: number;
  /** A model no plan sells yet, assumed to get this model's share of API price (`scripts/scrape/sources/subscription-overrides.ts`). */
  sameAs?: string;
  /** Where a curated figure came from. */
  source?: string;
  feeUsd?: number;
  confidence: string;
  mix: TokenMix;
  dataDate?: string;
  /** The API list price (USD per 1M) the source converted this plan with, when it publishes one. */
  listPrice?: { cached: number; input: number; output: number };
  plans: { plan: string; feeUsd?: number; usdPerMtok: number; confidence: string }[];
}

export interface SubscriptionPrice {
  /** Subscription cost as a fraction of the API cost of the same tokens; 0 for a free tier. */
  ratio: number;
  plan: string;
  feeUsd?: number;
  confidence: string;
}

type Prices = { input: number; output: number; cached?: number; cacheWrite?: number };
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** API price of one million tokens at the plan's workload. Unpublished cache prices follow the source's convention (cache read = 10% of input). */
export function blendedApiPrice(p: Prices, mix: TokenMix): number {
  const cached = p.cached ?? p.input * 0.1;
  return mix.cache * cached + mix.input * p.input + (mix.cacheWrite ?? 0) * (p.cacheWrite ?? p.input * 1.25) + mix.output * p.output;
}

/** OpenAI's estimated Codex messages per five hours on Plus, per model (`scripts/scrape/sources/codex-limits.ts`). */
export const CODEX_LIMITS_BENCHMARK = "codex-plus-messages";
/** The workload assumed when usage can't tell: Real API Pricing's standard convention. */
export const STANDARD_MIX: TokenMix = { cache: 0.97, input: 0.025, output: 0.005 };
const T3_USAGE_BENCHMARK = "t3-usage-share";
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/** Each model's measured token mix (`scripts/scrape/sources/slopalytics.ts`). Models with too little T3 Code usage are absent. */
export function measuredTokenMixes(snapshot: Snapshot): Map<string, MeasuredTokenMix> {
  const variants = new Map(snapshot.variants.map((v) => [v.id, v.modelId])), out = new Map<string, MeasuredTokenMix>();
  for (const o of snapshot.observations) {
    const mix = o.benchmarkId === T3_USAGE_BENCHMARK ? o.details?.tokenMix as MeasuredTokenMix | undefined : undefined;
    if (mix) out.set(variants.get(o.variantId) ?? o.variantId.split("@")[0], mix);
  }
  return out;
}

const listPrices = (m: NonNullable<Snapshot["variants"][number]["sourceModel"]>["metadata"] | undefined): Prices | undefined =>
  m && positive(m.price1mInputTokens) && positive(m.price1mOutputTokens) ? { input: m.price1mInputTokens, output: m.price1mOutputTokens, cached: positive(m.cacheHitPrice) ? m.cacheHitPrice : undefined, cacheWrite: positive(m.cacheWritePrice) ? m.cacheWritePrice : undefined } : undefined;

/** What one million of a model's tokens cost, at its measured mix when it has one and otherwise its plan's assumed mix. */
export interface TokenPrice {
  mix: TokenMix; measured?: MeasuredTokenMix;
  apiUsd: number;
  /** The same tokens at the fixed standard mix, to compare against. */
  standardUsd: number;
  /** What a subscriber pays for those tokens. Absent without a plan, or on a free tier. */
  subscription?: { usd: number; plan: string };
}

/** Undefined when no list price is known. Uses the same list price as the plan's share of API price. */
export function tokenPrice(snapshot: Snapshot, modelId: string, chosen: Record<string, string> = {}): TokenPrice | undefined {
  const own = new Set(snapshot.variants.filter((v) => v.modelId === modelId).map((v) => v.id));
  const details = snapshot.observations.find((o) => o.benchmarkId === SUBSCRIPTION_BENCHMARK && own.has(o.variantId))?.details as unknown as SubscriptionDetails | undefined;
  const prices = details?.listPrice ?? snapshot.variants.filter((v) => own.has(v.id)).map((v) => listPrices(v.sourceModel?.metadata)).find(Boolean);
  if (!prices) return undefined;
  const measured = measuredTokenMixes(snapshot).get(modelId), mix = measured ?? details?.mix ?? STANDARD_MIX, apiUsd = blendedApiPrice(prices, mix);
  const plan = subscriptionPrices(snapshot, chosen).get(modelId);
  return { mix, ...(measured ? { measured } : {}), apiUsd, standardUsd: blendedApiPrice(prices, STANDARD_MIX), ...(positive(plan?.ratio) ? { subscription: { usd: plan.ratio * apiUsd, plan: plan.plan } } : {}) };
}

/** The plans a viewer can price each lab at (Advanced → Plan): every plan a model of that lab was measured on, by monthly fee. Labs with one plan are left out. `median`: the plans its models fall on with nothing picked, most models first. */
export function subscriptionPlanOptions(snapshot: Snapshot): { labId: string; plans: { plan: string; feeUsd?: number; models: number }[]; median: { plan: string; models: number }[] }[] {
  const lab = new Map(snapshot.models.map((m) => [m.id, m.labId])), variants = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const byLab = new Map<string, Map<string, { plan: string; feeUsd?: number; models: Set<string> }>>();
  for (const o of snapshot.observations) {
    if (o.benchmarkId !== SUBSCRIPTION_BENCHMARK) continue;
    const d = o.details as unknown as SubscriptionDetails | undefined, modelId = variants.get(o.variantId) ?? o.variantId.split("@")[0], labId = lab.get(modelId);
    if (!labId || !d?.plans?.length || d.ratio != null || d.sameAs) continue;
    const plans = byLab.get(labId) ?? byLab.set(labId, new Map()).get(labId)!;
    for (const p of d.plans) (plans.get(p.plan) ?? plans.set(p.plan, { plan: p.plan, feeUsd: p.feeUsd, models: new Set() }).get(p.plan)!).models.add(modelId);
  }
  const medians = [...subscriptionPrices(snapshot)];
  return [...byLab].map(([labId, plans]) => {
    const median = new Map<string, number>();
    for (const [id, p] of medians) if (lab.get(id) === labId && p.plan && plans.has(p.plan)) median.set(p.plan, (median.get(p.plan) ?? 0) + 1);
    return { labId, plans: [...plans.values()].map((p) => ({ plan: p.plan, feeUsd: p.feeUsd, models: p.models.size })).sort((a, b) => (a.feeUsd ?? 0) - (b.feeUsd ?? 0) || a.plan.localeCompare(b.plan)), median: [...median].map(([plan, models]) => ({ plan, models })).sort((a, b) => b.models - a.models || a.plan.localeCompare(b.plan)) };
  })
    .filter((l) => l.plans.length > 1)
    .sort((a, b) => Math.max(...b.plans.map((p) => p.models)) - Math.max(...a.plans.map((p) => p.models)) || a.labId.localeCompare(b.labId));
}

/**
 * Share of API cost a subscriber pays, per model. A plan debits its allowance in proportion to API
 * list prices, so the same share applies to a measured cost per task at any reasoning effort.
 * List prices are the ones the source converted the plan with, falling back to Artificial Analysis
 * for models it has not priced yet. Models without a first-party plan are absent.
 * Each model is priced at its median plan unless `chosen` names a plan for its lab (lab id → plan name)
 * that the model was measured on; a model without that plan keeps its median one.
 * The share is worked out at the mix the plan's token price was converted with, never a measured one: an allowance
 * spent at list prices gives the same share at any mix, and mixing the two would change the share for no reason.
 * Only comparing two different models' prices depends on the mix, so that (below) uses measured mixes.
 */
export function subscriptionPrices(snapshot: Snapshot, chosen: Record<string, string> = {}): Map<string, SubscriptionPrice> {
  const labOf = new Map(snapshot.models.map((m) => [m.id, m.labId]));
  const out = new Map<string, SubscriptionPrice>();
  const mixes = new Map<string, TokenMix>();
  const variants = new Map(snapshot.variants.map((v) => [v.id, v]));
  const aaPrices = new Map<string, Prices>();
  for (const v of snapshot.variants) {
    const m = v.sourceModel?.metadata;
    const prices = aaPrices.has(v.modelId) ? undefined : listPrices(m);
    if (prices) aaPrices.set(v.modelId, prices);
  }
  const assumed: [string, SubscriptionDetails][] = [];
  for (const o of snapshot.observations) {
    if (o.benchmarkId !== SUBSCRIPTION_BENCHMARK) continue;
    const d = o.details as unknown as SubscriptionDetails | undefined;
    const modelId = variants.get(o.variantId)?.modelId ?? o.variantId.split("@")[0];
    if (d?.sameAs) assumed.push([modelId, d]);
    // A curated ratio is taken as is; 0 is a free tier.
    if (typeof d?.ratio === "number" && Number.isFinite(d.ratio) && d.ratio >= 0) { out.set(modelId, { ratio: d.ratio, plan: d.plan, feeUsd: d.feeUsd, confidence: d.confidence }); continue; }
    const want = chosen[labOf.get(modelId) ?? ""], pick = want !== undefined ? d?.plans?.find((p) => p.plan === want && positive(p.usdPerMtok)) : undefined;
    const value = pick?.usdPerMtok ?? o.value;
    if (!positive(value)) continue;
    const prices = d?.listPrice ?? aaPrices.get(modelId);
    if (!d?.mix || !prices) continue;
    const api = blendedApiPrice(prices, d.mix);
    if (positive(api)) { out.set(modelId, pick ? { ratio: value / api, plan: pick.plan, feeUsd: pick.feeUsd, confidence: pick.confidence } : { ratio: value / api, plan: d.plan, feeUsd: d.feeUsd, confidence: d.confidence }); mixes.set(modelId, d.mix); }
  }
  // A model assumed to match another's subsidy pays that model's share, whatever its own list price (a free tier is not a plan's subsidy).
  // Its label follows the plan the other model is priced at ("Google AI Pro (assumed same as Argon)").
  for (const [modelId, d] of assumed) { const from = out.get(d.sameAs!); if (positive(from?.ratio)) out.set(modelId, { ratio: from.ratio, plan: d.plan.replace(/^.*?(?= \(assumed same as )/, from.plan), feeUsd: from.feeUsd, confidence: d.confidence }); }
  // An OpenAI model with no plan data yet, priced from Codex's published limits: a plan's five-hour allowance is the
  // same budget whichever model spends it, so a model allowed k times the messages of a measured one at p times its
  // API price per token pays 1/(k·p) of that model's share (same tokens per message assumed). The median over every
  // measured model keeps one odd reference from setting the price. Real plan data replaces it once the model has some.
  const messages = new Map<string, number>();
  for (const o of snapshot.observations) if (o.benchmarkId === CODEX_LIMITS_BENCHMARK && positive(o.value)) messages.set(variants.get(o.variantId)?.modelId ?? o.variantId.split("@")[0], o.value);
  const measured = [...messages.keys()].filter((id) => out.has(id) && aaPrices.has(id)), usage = measuredTokenMixes(snapshot);
  for (const [modelId, n] of messages) {
    const prices = aaPrices.get(modelId);
    if (out.has(modelId) || !prices) continue;
    const refs = measured.map((ref) => {
      const assumed = mixes.get(ref) ?? STANDARD_MIX;
      return { ref, ratio: out.get(ref)!.ratio * (messages.get(ref)! / n) * (blendedApiPrice(aaPrices.get(ref)!, usage.get(ref) ?? assumed) / blendedApiPrice(prices, usage.get(modelId) ?? assumed)) };
    }).filter((r) => positive(r.ratio));
    if (!refs.length) continue;
    const ratio = median(refs.map((r) => r.ratio));
    const nearest = refs.reduce((a, b) => (Math.abs(b.ratio - ratio) < Math.abs(a.ratio - ratio) ? b : a));
    out.set(modelId, { ...out.get(nearest.ref)!, ratio, confidence: `estimated from Codex Plus message limits against ${refs.map((r) => r.ref).join(", ")}` });
  }
  return out;
}

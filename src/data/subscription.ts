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

export interface SubscriptionDetails {
  plan: string;
  /** Set when the share of API price is known directly (a published plan allowance), instead of derived from `mix` and a list price. */
  ratio?: number;
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
const STANDARD_MIX: TokenMix = { cache: 0.97, input: 0.025, output: 0.005 };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/**
 * Share of API cost a subscriber pays, per model. A plan debits its allowance in proportion to API
 * list prices, so the same share applies to a measured cost per task at any reasoning effort.
 * List prices are the ones the source converted the plan with, falling back to Artificial Analysis
 * for models it has not priced yet. Models without a first-party plan are absent.
 */
export function subscriptionPrices(snapshot: Snapshot): Map<string, SubscriptionPrice> {
  const out = new Map<string, SubscriptionPrice>();
  const mixes = new Map<string, TokenMix>();
  const variants = new Map(snapshot.variants.map((v) => [v.id, v]));
  const aaPrices = new Map<string, Prices>();
  for (const v of snapshot.variants) {
    const m = v.sourceModel?.metadata;
    if (!m || aaPrices.has(v.modelId) || !positive(m.price1mInputTokens) || !positive(m.price1mOutputTokens)) continue;
    aaPrices.set(v.modelId, { input: m.price1mInputTokens, output: m.price1mOutputTokens, cached: positive(m.cacheHitPrice) ? m.cacheHitPrice : undefined, cacheWrite: positive(m.cacheWritePrice) ? m.cacheWritePrice : undefined });
  }
  for (const o of snapshot.observations) {
    if (o.benchmarkId !== SUBSCRIPTION_BENCHMARK) continue;
    const d = o.details as unknown as SubscriptionDetails | undefined;
    const modelId = variants.get(o.variantId)?.modelId ?? o.variantId.split("@")[0];
    // A curated ratio is taken as is; 0 is a free tier.
    if (typeof d?.ratio === "number" && Number.isFinite(d.ratio) && d.ratio >= 0) { out.set(modelId, { ratio: d.ratio, plan: d.plan, feeUsd: d.feeUsd, confidence: d.confidence }); continue; }
    if (!positive(o.value)) continue;
    const prices = d?.listPrice ?? aaPrices.get(modelId);
    if (!d?.mix || !prices) continue;
    const api = blendedApiPrice(prices, d.mix);
    if (positive(api)) { out.set(modelId, { ratio: o.value / api, plan: d.plan, feeUsd: d.feeUsd, confidence: d.confidence }); mixes.set(modelId, d.mix); }
  }
  // An OpenAI model with no plan data yet, priced from Codex's published limits: a plan's five-hour allowance is the
  // same budget whichever model spends it, so a model allowed k times the messages of a measured one at p times its
  // API price per token pays 1/(k·p) of that model's share (same tokens per message assumed). The median over every
  // measured model keeps one odd reference from setting the price. Real plan data replaces it once the model has some.
  const messages = new Map<string, number>();
  for (const o of snapshot.observations) if (o.benchmarkId === CODEX_LIMITS_BENCHMARK && positive(o.value)) messages.set(variants.get(o.variantId)?.modelId ?? o.variantId.split("@")[0], o.value);
  const measured = [...messages.keys()].filter((id) => out.has(id) && aaPrices.has(id));
  for (const [modelId, n] of messages) {
    const prices = aaPrices.get(modelId);
    if (out.has(modelId) || !prices) continue;
    const refs = measured.map((ref) => {
      const mix = mixes.get(ref) ?? STANDARD_MIX;
      return { ref, ratio: out.get(ref)!.ratio * (messages.get(ref)! / n) * (blendedApiPrice(aaPrices.get(ref)!, mix) / blendedApiPrice(prices, mix)) };
    }).filter((r) => positive(r.ratio));
    if (!refs.length) continue;
    const ratio = median(refs.map((r) => r.ratio));
    const nearest = refs.reduce((a, b) => (Math.abs(b.ratio - ratio) < Math.abs(a.ratio - ratio) ? b : a));
    out.set(modelId, { ...out.get(nearest.ref)!, ratio, confidence: `estimated from Codex Plus message limits against ${refs.map((r) => r.ref).join(", ")}` });
  }
  return out;
}

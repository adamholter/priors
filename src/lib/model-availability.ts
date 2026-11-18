import { modelProviders, type ModelProviders } from "@/data/providers";
import { peakKind, studentBase } from "@/data/subscription";
import type { Snapshot } from "@/data/types";
import { planPrices, soldAs, type PlanPriceModel, type PlanPrices } from "./plan-prices";

/** One subscription that sells a model. `ratio` is the share of API price its subscribers pay. */
export interface PlanOffer { plan: string; feeUsd?: number; ratio: number; free?: true; assumed?: true }
export interface ModelAvailability extends ModelProviders { plans: PlanOffer[] }
/** A company selling plans. `plans[0]` is its default: the plan most of its models are priced on. */
export interface SubsidySeller { id: string; name: string; logo: boolean; plans: PlanSubsidy[] }
export interface PlanSubsidy { plan: string; feeUsd?: number; median: number; models: { id: string; name: string; lab: string; multiple: number; assumed?: true }[] }

const cache = new WeakMap<Snapshot, PlanPrices>();
const pricesOf = (snapshot: Snapshot) => { let p = cache.get(snapshot); if (!p) cache.set(snapshot, p = planPrices(snapshot)); return p; };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Peak-hour and blended rows repeat a plan at other rates, and a student price repeats it at another fee. */
const listed = (plan: string) => !studentBase(plan) && !["peak", "mixed"].includes(peakKind(plan)?.kind ?? "");

/** The plans that sell a model, cheapest first. A free tier leads. */
export function plansOf(m: PlanPriceModel): PlanOffer[] {
  const assumed = /^(assumed|estimated)/.test(m.confidence) ? { assumed: true as const } : {};
  const paid = new Map(Object.entries(m.plans ?? {}).map(([plan, p]) => [plan, { plan, ...(p.feeUsd != null ? { feeUsd: p.feeUsd } : {}), ratio: p.listRatio ?? p.ratio, ...assumed }]));
  const own = m.free ? m.paid : m, name = own && soldAs(own.plan);
  if (own && name && !paid.has(name) && own.ratio > 0) paid.set(name, { plan: name, ...(own.feeUsd != null ? { feeUsd: own.feeUsd } : {}), ratio: own.listRatio ?? own.ratio, ...assumed });
  const rows = [...paid.values()].filter((p) => listed(p.plan) && p.ratio > 0).sort((a, b) => (a.feeUsd ?? Infinity) - (b.feeUsd ?? Infinity) || a.plan.localeCompare(b.plan));
  return m.free ? [{ plan: soldAs(m.plan), ratio: 0, free: true, ...(m.feeUsd != null ? { feeUsd: m.feeUsd } : {}) }, ...rows] : rows;
}

/** Where a model can be used: the API providers serving it and the subscriptions selling it. Undefined when nothing is known. */
export function modelAvailability(snapshot: Snapshot, modelId: string): ModelAvailability | undefined {
  const m = pricesOf(snapshot).models.find((x) => x.id === modelId), plans = m ? plansOf(m) : [], providers = modelProviders(snapshot, modelId);
  return plans.length || providers.providers.length ? { ...providers, plans } : undefined;
}

/** Every paid plan with what each of its models gives per dollar at API prices, most generous plan first. */
export function planSubsidies(snapshot: Snapshot): PlanSubsidy[] {
  const plans = new Map<string, Omit<PlanSubsidy, "median">>();
  for (const m of pricesOf(snapshot).models) for (const p of plansOf(m)) {
    if (p.free) continue;
    const row = plans.get(p.plan) ?? plans.set(p.plan, { plan: p.plan, feeUsd: p.feeUsd, models: [] }).get(p.plan)!;
    row.models.push({ id: m.id, name: m.name, lab: m.lab, multiple: 1 / p.ratio, ...(p.assumed ? { assumed: true as const } : {}) });
  }
  return [...plans.values()].map((p) => ({ ...p, median: median(p.models.map((m) => m.multiple)), models: p.models.sort((a, b) => b.multiple - a.multiple) })).sort((a, b) => b.median - a.median || a.plan.localeCompare(b.plan));
}

/** Who sells a plan, read from its name. Logos are in `public/logos/<id>.png`. */
const SELLERS: { id: string; name: string; plans: RegExp }[] = [
  { id: "anthropic", name: "Anthropic", plans: /^Claude\b/ }, { id: "openai", name: "OpenAI", plans: /^ChatGPT\b/ }, { id: "google", name: "Google", plans: /^Google AI\b/ }, { id: "xai", name: "xAI", plans: /^SuperGrok\b/ },
  { id: "cursor", name: "Cursor", plans: /^Cursor\b/ }, { id: "kimi", name: "Kimi", plans: /^Kimi\b/ }, { id: "zhipu", name: "Z.ai", plans: /^GLM\b/ }, { id: "minimax", name: "MiniMax", plans: /^MiniMax\b/ },
  { id: "xiaomi", name: "Xiaomi", plans: /^MiMo\b/ }, { id: "tencent", name: "Tencent", plans: /^Tencent\b/ }, { id: "alibaba", name: "Alibaba", plans: /^(阿里云|Alibaba\b)/ }, { id: "mistral", name: "Mistral", plans: /^Mistral\b/ },
  { id: "opencode", name: "OpenCode", plans: /^OpenCode\b/ }, { id: "commandcode", name: "Command Code", plans: /^Command Code\b/ }, { id: "factory", name: "Factory", plans: /^Droid\b/ }, { id: "ollama", name: "Ollama", plans: /^Ollama\b/ },
];

/** Plans grouped by the company selling them, the most generous default plan first. */
export function subsidySellers(snapshot: Snapshot): SubsidySeller[] {
  const defaults = new Map<string, number>();
  for (const m of pricesOf(snapshot).models) { const own = m.free ? m.paid : m, plan = own && soldAs(own.plan); if (plan) defaults.set(plan, (defaults.get(plan) ?? 0) + 1); }
  const groups = new Map<string, SubsidySeller>();
  for (const plan of planSubsidies(snapshot)) {
    const known = SELLERS.find((s) => s.plans.test(plan.plan)), id = known?.id ?? plan.plan;
    (groups.get(id) ?? groups.set(id, { id, name: known?.name ?? plan.plan, logo: !!known, plans: [] }).get(id)!).plans.push(plan);
  }
  const rank = (p: PlanSubsidy) => [-(defaults.get(p.plan) ?? 0), -p.models.length, p.feeUsd ?? Infinity];
  const byDefault = (a: PlanSubsidy, b: PlanSubsidy) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  return [...groups.values()].map((s) => { const [first, ...rest] = [...s.plans].sort(byDefault); return { ...s, plans: [first, ...rest.sort((a, b) => (a.feeUsd ?? Infinity) - (b.feeUsd ?? Infinity) || a.plan.localeCompare(b.plan))] }; }).sort((a, b) => b.plans[0].median - a.plans[0].median || a.name.localeCompare(b.name));
}

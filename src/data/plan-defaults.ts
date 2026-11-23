/**
 * Which plan a model is priced at by default, and the visitor's own adjustments to plan data.
 *
 * Default (`withCommonDefaults`, run by the snapshot build): a simple, common plan with the biggest subsidy, not the single most
 * subsidized plan whoever sells it, which put models on plans nobody uses (Command Code GOAT) and spread a lab's models over
 * several plans. Common: the lab's own current consumer plans (no legacy, existing-subscriber, peak or mixed, team, student or
 * China-only rows where a global one exists) plus resellers people use (OpenCode Go, Ollama, Cursor). Each lab gets one default,
 * the common plan with the biggest subsidy for its flagship (newest model with plan data, the priciest on a tie); a model takes it
 * when it is within 10% of its own best common plan, else that plan, then any plan but Command Code. A model sold only on
 * Command Code has no default and is priced at the API. Adam, 2026-11-19.
 *
 * Adjustments (`adjustSnapshot`, in the browser): a plan's allowance or a model's cost scaled by a factor, which the chart
 * settings agent writes when a visitor says they get more than the data knows (bonus credits, a discount).
 */
import { blendedApiPrice, listPrices, planDisplayName, SUBSCRIPTION_BENCHMARK, type SubscriptionDetails } from "./subscription";
import type { Observation, Snapshot } from "./types";

const OWN: Record<string, RegExp> = {
  anthropic: /^Claude\b/, openai: /^ChatGPT\b/, google: /^Google AI\b/, xai: /^SuperGrok\b/, cursor: /^Cursor\b/, moonshot: /^Kimi\b/, zhipu: /^GLM\b/,
  minimax: /^MiniMax\b/, xiaomi: /^MiMo\b/, tencent: /^Tencent\b/, alibaba: /^(Alibaba\b|Qwen\b)/, mistral: /^Mistral\b/,
};
const POPULAR_RESELLERS = /^(OpenCode Go|Ollama (Pro|Max)|Cursor (Pro|Pro\+|Ultra))$/;
const NOT_SIMPLE = /legacy|existing subscribers|\((peak|mixed)\)$|\bTeams?\b|\(Student\)|会员|阿里云/;
const UNPOPULAR = /^Command Code\b/;
/** Within this share of a model's own best common plan, it takes its lab's default. */
const LAB_DEFAULT_SLACK = 0.9;

/** A plan as Priors names it, minus the yuan price GLM rows carry ("GLM Coding Pro (off-peak)"); the fee is shown beside it. */
export const naturalPlanName = (plan: string) => planDisplayName(plan).replace(/ ¥\d+(?=,| \(|$)/, "");

export function isCommonPlan(plan: string, labId: string, siblings: readonly string[] = []): boolean {
  const name = planDisplayName(plan);
  if (NOT_SIMPLE.test(name)) return false;
  if (POPULAR_RESELLERS.test(name)) return true;
  if (!OWN[labId]?.test(name)) return false;
  // MiniMax sells a China plan and a global one under one name; the global one is the one most people can buy.
  if (labId === "minimax" && !/\(Global\)$/.test(name) && siblings.some((s) => planDisplayName(s) === `${name} (Global)`)) return false;
  return true;
}

type Plan = SubscriptionDetails["plans"][number];
type Row = { o: Observation; d: SubscriptionDetails; free: boolean; modelId: string; labId: string; api: number };
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

/** Subscription rows priced from a plan list (not curated or assumed), with the API price of a million tokens at the row's mix. */
function rowsOf(snapshot: Snapshot): Row[] {
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId])), labOf = new Map(snapshot.models.map((m) => [m.id, m.labId]));
  const aa = new Map<string, ReturnType<typeof listPrices>>();
  for (const v of snapshot.variants) if (!aa.get(v.modelId)) aa.set(v.modelId, listPrices(v.sourceModel?.metadata));
  const out: Row[] = [];
  for (const o of snapshot.observations) {
    if (o.benchmarkId !== SUBSCRIPTION_BENCHMARK) continue;
    const row = o.details as unknown as SubscriptionDetails | undefined, free = !!row?.free, d = free ? row?.paid : row;
    const modelId = modelOf.get(o.variantId) ?? o.variantId.split("@")[0], labId = labOf.get(modelId) ?? "";
    if (!d?.plans?.length || d.ratio != null || d.sameAs || d.listOnly || !d.mix) continue;
    const prices = d.listPrice ?? aa.get(modelId), api = prices ? blendedApiPrice(prices, d.mix) : 0;
    if (positive(api)) out.push({ o, d, free, modelId, labId, api });
  }
  return out;
}

/** The plan with the biggest subsidy (lowest price per token), the cheaper fee on a tie: Pro 10x and Pro 20x often give the same. */
const bestOf = (list: Plan[]) => [...list].filter((p) => positive(p.usdPerMtok)).sort((a, b) => a.usdPerMtok / b.usdPerMtok - 1 > 1e-9 ? 1 : b.usdPerMtok / a.usdPerMtok - 1 > 1e-9 ? -1 : (a.feeUsd ?? 0) - (b.feeUsd ?? 0))[0];
const commonOf = (labId: string, plans: Plan[]) => plans.filter((p) => isCommonPlan(p.plan, labId, plans.map((x) => x.plan)));

/** Each lab's default plan (display name): the common plan with the biggest subsidy for its flagship. */
export function commonLabDefaults(snapshot: Snapshot): Map<string, string> {
  const released = new Map(snapshot.models.map((m) => [m.id, m.releaseDate ?? ""])), byLab = new Map<string, Row[]>();
  for (const r of rowsOf(snapshot)) if (commonOf(r.labId, r.d.plans).length) (byLab.get(r.labId) ?? byLab.set(r.labId, []).get(r.labId)!).push(r);
  const out = new Map<string, string>();
  for (const [lab, list] of byLab) {
    const flagship = [...list].sort((a, b) => (released.get(b.modelId) ?? "").localeCompare(released.get(a.modelId) ?? "") || b.api - a.api)[0];
    const best = bestOf(commonOf(lab, flagship.d.plans));
    if (best) out.set(lab, planDisplayName(best.plan));
  }
  return out;
}

const rewrite = (r: Row, plans: Plan[], pick: Plan, note?: string): Observation => {
  const d: SubscriptionDetails = { ...r.d, plans, plan: pick.plan, feeUsd: pick.feeUsd, confidence: pick.confidence, preliminary: pick.preliminary };
  return r.free
    ? { ...r.o, details: { ...(r.o.details as object), paid: { ...d, value: pick.usdPerMtok } } as unknown as Observation["details"] }
    : { ...r.o, value: pick.usdPerMtok, ...(note ? { note } : {}), details: d as unknown as Observation["details"] };
};

/** The snapshot with every model's default subscription row on its common-plan default. Running it again changes nothing. */
export function withCommonDefaults(snapshot: Snapshot): { snapshot: Snapshot; moved: number; dropped: string[] } {
  const defaults = commonLabDefaults(snapshot), changed = new Map<Observation, Observation | null>(), dropped: string[] = [];
  for (const r of rowsOf(snapshot)) {
    const own = bestOf(commonOf(r.labId, r.d.plans)), labDefault = defaults.get(r.labId), lab = r.d.plans.find((p) => positive(p.usdPerMtok) && planDisplayName(p.plan) === labDefault);
    const pick = (lab && (!own || lab.usdPerMtok <= own.usdPerMtok / LAB_DEFAULT_SLACK) ? lab : own) ?? bestOf(r.d.plans.filter((p) => !UNPOPULAR.test(p.plan)));
    if (!pick) { changed.set(r.o, null); dropped.push(r.modelId); continue; }
    if (pick.plan === r.d.plan) continue;
    changed.set(r.o, rewrite(r, r.d.plans, pick, `${pick.plan}${pick.feeUsd ? `, $${pick.feeUsd}/month` : ""}; ${pick.confidence} confidence; best common plan${pick.plan === lab?.plan ? ", its lab's default" : ""}`));
  }
  if (!changed.size) return { snapshot, moved: 0, dropped };
  const observations = snapshot.observations.flatMap((o) => { const next = changed.get(o); return next === undefined ? [o] : next === null ? [] : [next]; });
  return { snapshot: { ...snapshot, observations }, moved: changed.size - dropped.length, dropped };
}

/** Each lab's plans with how many times the fee in API value a subscriber gets: the median over the lab's models on it. */
export function labPlanMultiples(snapshot: Snapshot): Map<string, Map<string, number>> {
  const by = new Map<string, Map<string, number[]>>();
  for (const r of rowsOf(snapshot)) for (const p of r.d.plans) {
    if (!positive(p.usdPerMtok)) continue;
    const name = planDisplayName(p.plan), lab = by.get(r.labId) ?? by.set(r.labId, new Map()).get(r.labId)!;
    (lab.get(name) ?? lab.set(name, []).get(name)!).push(r.api / p.usdPerMtok);
  }
  return new Map([...by].map(([lab, plans]) => [lab, new Map([...plans].map(([plan, xs]) => [plan, median(xs)]))]));
}

export type PlanAdjustment =
  /** A plan's allowance is bigger or smaller than measured (bonus credits, a promotion): its share of API price divides by `factor`. */
  | { kind: "subsidy"; factor: number; lab?: string; plan?: string; model?: string; note: string }
  /** Every cost figure for a model scales by `factor` (a discount, a price change). */
  | { kind: "cost"; factor: number; model: string; note: string };

/** Factors outside this range are a misreading, not a plan. */
export const ADJUSTMENT_FACTOR: [number, number] = [0.05, 20];
export const validAdjustment = (a: unknown): a is PlanAdjustment => {
  const x = a as PlanAdjustment | null;
  return !!x && (x.kind === "subsidy" || (x.kind === "cost" && typeof x.model === "string")) && positive(x.factor) && x.factor >= ADJUSTMENT_FACTOR[0] && x.factor <= ADJUSTMENT_FACTOR[1] && typeof x.note === "string";
};
const matches = (a: { lab?: string; plan?: string; model?: string }, modelId: string, labId: string, plan: string) =>
  (!a.lab || a.lab === labId) && (!a.model || a.model === modelId) && (!a.plan || planDisplayName(plan).toLowerCase().includes(a.plan.toLowerCase()));

const adjustedCache = new WeakMap<Snapshot, Map<string, Snapshot>>();
/** The snapshot with the visitor's adjustments applied: plan rows' token prices and their default's value, and cost figures. Pure and cached. */
export function adjustSnapshot(snapshot: Snapshot, adjustments: readonly PlanAdjustment[]): Snapshot {
  const list = adjustments.filter(validAdjustment);
  if (!list.length) return snapshot;
  const key = JSON.stringify(list), cache = adjustedCache.get(snapshot) ?? adjustedCache.set(snapshot, new Map()).get(snapshot)!, hit = cache.get(key);
  if (hit) return hit;
  const subsidy = list.filter((a): a is Extract<PlanAdjustment, { kind: "subsidy" }> => a.kind === "subsidy");
  const cost = new Map(list.filter((a): a is Extract<PlanAdjustment, { kind: "cost" }> => a.kind === "cost").map((a) => [a.model, a.factor]));
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId])), labOf = new Map(snapshot.models.map((m) => [m.id, m.labId]));
  const scale = (plans: Plan[], modelId: string) => { let hit = false; const out = plans.map((p) => { const f = subsidy.filter((a) => matches(a, modelId, labOf.get(modelId) ?? "", p.plan)).reduce((x, a) => x * a.factor, 1); if (f === 1) return p; hit = true; return { ...p, usdPerMtok: p.usdPerMtok / f }; }); return hit ? out : undefined; };
  const observations = snapshot.observations.map((o) => {
    const modelId = modelOf.get(o.variantId) ?? o.variantId.split("@")[0];
    let next = o;
    if (subsidy.length && o.benchmarkId === SUBSCRIPTION_BENCHMARK) {
      const row = o.details as unknown as SubscriptionDetails | undefined, free = !!row?.free, d = free ? row?.paid : row;
      const plans = d?.plans?.length ? scale(d.plans, modelId) : undefined;
      if (d && plans) {
        const own = plans.find((p) => p.plan === d.plan), details = { ...d, plans };
        // A row priced from its plan list moves with its own plan; an assumed one reads the list; a curated share divides directly.
        if (free) next = { ...o, details: { ...(row as object), paid: { ...details, ...(own && !d.sameAs ? { value: own.usdPerMtok } : {}) } } as unknown as Observation["details"] };
        else next = { ...o, ...(own && !d.sameAs && d.ratio == null ? { value: own.usdPerMtok } : {}), details: details as unknown as Observation["details"] };
      } else if (d && d.ratio != null && !free) {
        const f = subsidy.filter((a) => matches(a, modelId, labOf.get(modelId) ?? "", d.plan)).reduce((x, a) => x * a.factor, 1);
        if (f !== 1) next = { ...o, value: o.value / f, details: { ...d, ratio: d.ratio / f, ...(d.readings ? { readings: d.readings.map((r) => ({ ...r, ratio: r.ratio / f })) } : {}) } as unknown as Observation["details"] };
      }
    }
    const f = cost.get(modelId);
    if (f) {
      if (next.benchmarkId === "aa-cost-per-task-index") next = { ...next, value: next.value * f, ...(next.costUsd != null ? { costUsd: next.costUsd * f } : {}) };
      else if (next.costUsd != null) next = { ...next, costUsd: next.costUsd * f };
    }
    return next;
  });
  const out = { ...snapshot, observations };
  cache.set(key, out);
  return out;
}

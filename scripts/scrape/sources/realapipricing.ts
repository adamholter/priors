/**
 * Real API Pricing (realapipricing.com, github.com/FeiZhuLulu/real-api-pricing): what a subscription
 * plan costs per million tokens when its whole monthly allowance is used — monthly fee ÷ measured
 * monthly tokens. One row per plan × model in `derived/points.json`, each with a confidence grade
 * and the workload convention used to turn a dollar pool into tokens.
 *
 * We publish one model-level proxy: the token price on the model's own lab's plan. A lab usually
 * sells several plans (and scenario variants: off-peak, legacy pricing, annual), so the row is the
 * median first-party plan, not the cheapest — graded "low" rows are used only when nothing better
 * exists. Plans from resellers and harnesses (Cursor, Droid, Command Code, …) are not used: they
 * tie the model to a product. The engine divides this by the API list price at the same workload
 * to get the share of API cost a subscriber pays (`src/data/subscription.ts`).
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { normalizeLabel } from "../../../src/data/normalize";
import { SUBSCRIPTION_BENCHMARK, type SubscriptionDetails, type TokenMix } from "../../../src/data/subscription";
import { PLAN_CUTS, SUBSIDY_OVERRIDES } from "./subscription-overrides";

const SITE = "https://realapipricing.com";
const REPO = "https://github.com/FeiZhuLulu/real-api-pricing";
const RAW = "https://raw.githubusercontent.com/FeiZhuLulu/real-api-pricing/main";

type Point = {
  id: string; plan: string; plan_en?: string | null; billing: string; model: string; model_display: string; vendor: string;
  workload?: string; list_price?: { cached: number; input: number; output: number; currency: string } | null;
  price_usd?: number | null; real_usd_per_mtok: number; confidence: string; unmetered?: boolean; data_date?: string | null;
};
export type Points = { generatedAt: string; points: Point[] };
export type Conventions = { usdPerCny: number; standardTokenMix: TokenMix; lowCacheTokenMix: TokenMix; anthropicTokenMix: { cache: number; cacheWrite: number; output: number } };
export type Channels = { channels: [string, string][] };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Real API Pricing model slugs whose Priors id differs. Gemini 4 Argon was Gemini 4's first tier, so it keeps the bare id. */
const PRIORS_IDS: Record<string, string> = { "gemini-4-argon": "gemini-4" };

/** One row per model: the median first-party subscription, with every first-party plan in details. */
export function parseSubscriptions(json: Points, conventions: Conventions, channels: Channels): RawRow[] {
  const channelOf = (id: string) => channels.channels.find(([prefix]) => id.startsWith(prefix))?.[1];
  const mixOf = (workload?: string): TokenMix => workload === "anthropic"
    ? { cache: conventions.anthropicTokenMix.cache, input: 0, cacheWrite: conventions.anthropicTokenMix.cacheWrite, output: conventions.anthropicTokenMix.output }
    : workload === "lowCache" ? pickMix(conventions.lowCacheTokenMix) : pickMix(conventions.standardTokenMix);
  const byModel = new Map<string, Point[]>(), resold = new Map<string, Point[]>();
  for (const raw of json.points) {
    const p = cut(raw);
    if (p.billing !== "subscription" || p.unmetered || !(p.real_usd_per_mtok > 0)) continue;
    const group = channelOf(p.id) === p.vendor ? byModel : resold;
    (group.get(p.model) ?? group.set(p.model, []).get(p.model)!).push(p);
  }
  const rows: RawRow[] = [];
  const taken = new Set<string>();
  // "(9/14+)" marks which generation of a plan's limits was measured; it is not part of the plan's name.
  const name = (p: Point) => (p.plan_en || p.plan).replace(/\s*\(\d+\/\d+\+\)$/, "");
  const add = (all: Point[], pick: Point, note: string) => {
    const label = all[0].model_display.replace(/\s*\(v\d+\)$/, "");
    const list = pick.list_price;
    const rate = list?.currency === "CNY" ? conventions.usdPerCny : 1;
    const details: SubscriptionDetails = {
      plan: name(pick), feeUsd: pick.price_usd ?? undefined, confidence: pick.confidence, mix: mixOf(pick.workload), dataDate: pick.data_date ?? undefined,
      ...(list ? { listPrice: { cached: list.cached / rate, input: list.input / rate, output: list.output / rate } } : {}),
      plans: [...all].sort((a, b) => a.real_usd_per_mtok - b.real_usd_per_mtok).map((p) => ({ plan: name(p), feeUsd: p.price_usd ?? undefined, usdPerMtok: p.real_usd_per_mtok, confidence: p.confidence })),
    };
    rows.push({ benchmarkId: SUBSCRIPTION_BENCHMARK, modelLabel: label, value: pick.real_usd_per_mtok, sourceUrl: SITE, note: `${name(pick)}${pick.price_usd ? `, $${pick.price_usd}/month` : ""}; ${pick.confidence} confidence; ${note}`, details: details as unknown as Record<string, unknown> });
  };
  // Speed tiers and previews ("-fast", "-flashx", "-preview") normalize onto their base model; a
  // price for one must not be shown as the other's, so the label has to survive normalization whole.
  const claim = (all: Point[]) => {
    const n = normalizeLabel(all[0].model_display.replace(/\s*\(v\d+\)$/, ""));
    if (!n.ok || squash(n.modelId) !== squash(PRIORS_IDS[all[0].model] ?? all[0].model) || taken.has(n.modelId)) return false;
    taken.add(n.modelId);
    return true;
  };
  for (const all of byModel.values()) {
    if (!claim(all)) continue;
    const graded = all.filter((p) => p.confidence !== "low");
    const pool = (graded.length ? graded : all).sort((a, b) => a.real_usd_per_mtok - b.real_usd_per_mtok);
    add(all, pool[Math.floor(pool.length / 2)], `median of ${pool.length} first-party plan${pool.length === 1 ? "" : "s"}`);
  }
  // Models with no first-party plan: the best subsidy a reseller or harness offers (lowest token price,
  // medium confidence or better). Same list price at every plan, so the cheapest tokens are the biggest subsidy.
  for (const all of resold.values()) {
    const graded = all.filter((p) => p.confidence !== "low").sort((a, b) => a.real_usd_per_mtok - b.real_usd_per_mtok);
    if (!graded.length || !claim(all)) continue;
    add(all, graded[0], `best of ${graded.length} reseller plan${graded.length === 1 ? "" : "s"} (no first-party plan)`);
  }
  // Curated figures from published plan allowances replace anything computed for the same model.
  for (const o of SUBSIDY_OVERRIDES) {
    const idOf = (r: RawRow) => { if (r.identity) return r.identity.modelId; const n = normalizeLabel(r.modelLabel); return n.ok ? n.modelId : undefined; };
    const at = rows.findIndex((r) => idOf(r) === o.modelId);
    if (at >= 0) rows.splice(at, 1);
    rows.push({
      benchmarkId: SUBSCRIPTION_BENCHMARK, modelLabel: o.label, value: o.ratio, sourceUrl: o.source, note: `${o.plan}, $${o.feeUsd}/month: ${o.note}`,
      ...(o.identity ? { identity: o.identity } : {}),
      details: { plan: o.plan, feeUsd: o.feeUsd, confidence: o.confidence, ratio: o.ratio, source: o.source, dataDate: o.checked, plans: [] } as unknown as Record<string, unknown>,
    });
  }
  return rows;
}

/** A point measured before a plan's allowance was cut, priced at the allowance it sells with now. */
export function cut(p: Point): Point {
  const c = PLAN_CUTS.find((c) => p.id.startsWith(`${c.planId}::`));
  const measured = p.data_date?.split("~").pop();
  if (!c || (measured && measured >= c.until)) return p;
  return { ...p, plan: c.plan, plan_en: c.plan, real_usd_per_mtok: p.real_usd_per_mtok * c.factor };
}

const pickMix = (m: TokenMix): TokenMix => ({ cache: m.cache, input: m.input, output: m.output });

const source: Source = {
  id: "realapipricing",
  name: "Real API Pricing (subscription token prices)",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [points, conventions, channels] = await Promise.all([
      ctx.fetchText(`${RAW}/derived/points.json`), ctx.fetchText(`${RAW}/data/conventions.json`), ctx.fetchText(`${RAW}/config/channel-colors.json`),
    ]);
    const json = JSON.parse(points) as Points;
    if (!Array.isArray(json.points) || !json.points.length) throw new Error("Real API Pricing: unexpected points payload");
    const rows = parseSubscriptions(json, JSON.parse(conventions) as Conventions, JSON.parse(channels) as Channels);
    if (!rows.length) throw new Error("Real API Pricing: no subscription rows");
    return {
      benchmarks: [{
        id: SUBSCRIPTION_BENCHMARK, name: "Subscription token price (USD per 1M tokens)", shortName: "Subscription price", sourceId: this.id, url: REPO, lastUpdated: json.generatedAt,
        description: "Monthly fee ÷ the tokens a subscriber can use in a month on the lab's own plan (median plan), from Real API Pricing's measured allowances. A lower bound: it assumes the whole allowance is used. Model-level, no reasoning effort; it powers the subscription cost view.",
        unit: "usd" as const, higherIsBetter: false, category: "cost" as const, proxy: true, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "points.json": points, "conventions.json": conventions, "channel-colors.json": channels },
      notes: [`${rows.length} models with a subscription price (first-party plans, reseller fallback, curated overrides), snapshot ${json.generatedAt}`],
    };
  },
};
export default source;

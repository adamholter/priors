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

/** One row per model: the median first-party subscription, with every first-party plan in details. */
export function parseSubscriptions(json: Points, conventions: Conventions, channels: Channels): RawRow[] {
  const channelOf = (id: string) => channels.channels.find(([prefix]) => id.startsWith(prefix))?.[1];
  const mixOf = (workload?: string): TokenMix => workload === "anthropic"
    ? { cache: conventions.anthropicTokenMix.cache, input: 0, cacheWrite: conventions.anthropicTokenMix.cacheWrite, output: conventions.anthropicTokenMix.output }
    : workload === "lowCache" ? pickMix(conventions.lowCacheTokenMix) : pickMix(conventions.standardTokenMix);
  const byModel = new Map<string, Point[]>();
  for (const p of json.points) {
    if (p.billing !== "subscription" || p.unmetered || !(p.real_usd_per_mtok > 0) || channelOf(p.id) !== p.vendor) continue;
    (byModel.get(p.model) ?? byModel.set(p.model, []).get(p.model)!).push(p);
  }
  const rows: RawRow[] = [];
  const taken = new Set<string>();
  for (const [slug, all] of byModel) {
    // Speed tiers and previews ("-fast", "-flashx", "-preview") normalize onto their base model; a
    // price for one must not be shown as the other's, so the label has to survive normalization whole.
    const label = all[0].model_display.replace(/\s*\(v\d+\)$/, "");
    const n = normalizeLabel(label);
    if (!n.ok || squash(n.modelId) !== squash(slug) || taken.has(n.modelId)) continue;
    taken.add(n.modelId);
    const graded = all.filter((p) => p.confidence !== "low");
    const pool = (graded.length ? graded : all).sort((a, b) => a.real_usd_per_mtok - b.real_usd_per_mtok);
    const pick = pool[Math.floor(pool.length / 2)];
    // "(9/14+)" marks which generation of a plan's limits was measured; it is not part of the plan's name.
    const name = (p: Point) => (p.plan_en || p.plan).replace(/\s*\(\d+\/\d+\+\)$/, "");
    const list = pick.list_price;
    const rate = list?.currency === "CNY" ? conventions.usdPerCny : 1;
    const details: SubscriptionDetails = {
      plan: name(pick), feeUsd: pick.price_usd ?? undefined, confidence: pick.confidence, mix: mixOf(pick.workload), dataDate: pick.data_date ?? undefined,
      ...(list ? { listPrice: { cached: list.cached / rate, input: list.input / rate, output: list.output / rate } } : {}),
      plans: all.sort((a, b) => a.real_usd_per_mtok - b.real_usd_per_mtok).map((p) => ({ plan: name(p), feeUsd: p.price_usd ?? undefined, usdPerMtok: p.real_usd_per_mtok, confidence: p.confidence })),
    };
    rows.push({
      benchmarkId: SUBSCRIPTION_BENCHMARK, modelLabel: label, value: pick.real_usd_per_mtok, sourceUrl: SITE,
      note: `${name(pick)}${pick.price_usd ? `, $${pick.price_usd}/month` : ""}; ${pick.confidence} confidence; median of ${pool.length} first-party plan${pool.length === 1 ? "" : "s"}`,
      details: details as unknown as Record<string, unknown>,
    });
  }
  return rows;
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
    if (!rows.length) throw new Error("Real API Pricing: no first-party subscription rows");
    return {
      benchmarks: [{
        id: SUBSCRIPTION_BENCHMARK, name: "Subscription token price (USD per 1M tokens)", shortName: "Subscription price", sourceId: this.id, url: REPO, lastUpdated: json.generatedAt,
        description: "Monthly fee ÷ the tokens a subscriber can use in a month on the lab's own plan (median plan), from Real API Pricing's measured allowances. A lower bound: it assumes the whole allowance is used. Model-level, no reasoning effort; it powers the subscription cost view.",
        unit: "usd" as const, higherIsBetter: false, category: "cost" as const, proxy: true, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "points.json": points, "conventions.json": conventions, "channel-colors.json": channels },
      notes: [`${rows.length} models with a first-party plan, snapshot ${json.generatedAt}`],
    };
  },
};
export default source;

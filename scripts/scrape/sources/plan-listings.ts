/**
 * Which models a seller's plans include, read from the seller's own docs. Not a score: these sellers publish no allowance per model that
 * converts to API dollars, so this says only that a plan sells a model, and plan pages show it unmeasured until a figure is known.
 * Google: Antigravity's model tables. Models marked for removal are left out, as are Orchestrators, which run other listed models.
 * Alibaba: Token Plan (Personal Edition), its current plans, with fees in yuan. Text models only, without dated or preview builds.
 */
import type { RawRow, ScrapeContext, Source } from "../../../src/data/types";

export const ANTIGRAVITY_MODELS = "https://antigravity.google/docs/models";
export const ALIBABA_TOKEN_PLAN = "https://help.aliyun.com/en/model-studio/token-plan-personal-overview";
const CONVENTIONS = "https://raw.githubusercontent.com/FeiZhuLulu/real-api-pricing/main/data/conventions.json";
export const PLAN_LISTINGS_ID = "plan-listed-models";
export type ListedPlan = { plan: string; feeUsd?: number };
export type Listing = { label: string; plans: ListedPlan[] };
/** The table has one Ultra column; Ultra is sold at two sizes. */
const COLUMNS: [RegExp, string[]][] = [[/^Google AI Pro$/, ["Google AI Pro"]], [/^Google AI Ultra$/, ["Google AI Ultra 5x", "Google AI Ultra 20x"]]];
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const cells = (row: string, tag: string) => [...row.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
const rowsOf = (table: string) => [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
const tables = (html: string) => [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].map((m) => m[0]);

/** Throws when the tables change shape, so the last list stands. */
export function parseAntigravityModels(html: string): Listing[] {
  const out = tables(html).flatMap((table) => {
    const rows = rowsOf(table), header = cells(rows[0] ?? "", "th").map(text), columns = COLUMNS.map(([name, plans]) => ({ at: header.findIndex((h) => name.test(h)), plans }));
    if (header[0] !== "Model" || columns.some((c) => c.at < 0)) return [];
    return rows.slice(1).flatMap((row) => {
      const cell = cells(row, "td"), mark = text(cell[0] ?? "").match(/^(.*?)\s*(\*+)?$/), name = mark?.[1] ?? "";
      // One star marks a model due for removal; two mark a plan condition.
      if (!name || mark?.[2] === "*" || /^Orchestrator\b/.test(name)) return [];
      const plans = columns.flatMap((c) => (cell[c.at]?.includes("✅") ? c.plans.map((plan) => ({ plan })) : []));
      return plans.length ? [{ label: name.replace(/\s*\(thinking\)$/, ""), plans }] : [];
    });
  });
  if (out.length < 3) throw new Error("Antigravity models: table changed");
  return out;
}

/** Throws when the page changes shape. */
export function parseAlibabaTokenPlan(html: string, cnyPerUsd: number): Listing[] {
  const all = tables(html), price = all.flatMap(rowsOf).map((r) => [...r.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => text(m[1]))), names = price.find((r) => r.filter((c) => /^\w+ plan$/i.test(c)).length === 4)?.filter((c) => /^\w+ plan$/i.test(c)).map((c) => c.replace(/ plan$/i, ""));
  const fees = price.find((r) => /^Pricing$/i.test(r[0] ?? ""))?.slice(1).map((c) => Number(/(\d+)\s*CNY\/month/.exec(c)?.[1]));
  if (!names || fees?.length !== 4 || fees.some((f) => !f)) throw new Error("Alibaba Token Plan: price table changed");
  const plans = names.map((n, i) => ({ plan: `Alibaba Token Plan ${n}`, feeUsd: +(fees[i] / cnyPerUsd).toFixed(2) }));
  const models = price.flatMap((r) => { const id = r[0] ?? ""; return /^(qwen\d|deepseek-v|glm-)/.test(id) && /text generation/i.test(r[1] ?? "") && !/-preview$|-\d{4}$/.test(id.replace("deepseek-v4.1-flash-1017", "deepseek-v4.1-flash")) ? [id] : []; });
  if (!models.some((m) => m.startsWith("qwen"))) throw new Error("Alibaba Token Plan: model table changed");
  return [...new Set(models)].map((id) => ({ label: id.replace(/-/g, " "), plans }));
}

const key = (label: string) => label.toLowerCase().replace(/[^a-z0-9]/g, "");
const source: Source = {
  id: "plan-listings",
  name: "Plan model listings",
  url: ANTIGRAVITY_MODELS,
  async scrape(ctx: ScrapeContext) {
    const raw: Record<string, string> = {}, notes: string[] = [], found: { url: string; list: Listing[] }[] = [];
    const read = async (url: string, name: string, parse: (html: string) => Listing[] | Promise<Listing[]>) => { try { const page = await ctx.fetchText(url); raw[name] = page; found.push({ url, list: await parse(page) }); } catch (e) { notes.push(`${name}: ${e instanceof Error ? e.message : e}`); } };
    await read(ANTIGRAVITY_MODELS, "antigravity-models.html", parseAntigravityModels);
    await read(ALIBABA_TOKEN_PLAN, "alibaba-token-plan.html", async (page) => parseAlibabaTokenPlan(page, (await ctx.fetchJson<{ usdPerCny: number }>(CONVENTIONS)).usdPerCny));
    if (!found.length) throw new Error(notes.join("; "));
    const rows = new Map<string, RawRow>();
    for (const { url, list } of found) for (const { label, plans } of list) {
      const had = rows.get(key(label)), all = [...new Map([...((had?.details?.plans ?? []) as ListedPlan[]), ...plans].map((p) => [p.plan, p])).values()];
      rows.set(key(label), { benchmarkId: PLAN_LISTINGS_ID, modelLabel: label, value: all.length, sourceUrl: had?.sourceUrl ?? url, details: { plans: all } });
    }
    return {
      benchmarks: [{ id: PLAN_LISTINGS_ID, name: "Plans listing the model", shortName: "Plans listing", sourceId: "plan-listings", url: ANTIGRAVITY_MODELS, description: "How many subscription plans list the model in the seller's docs.", unit: "count", higherIsBetter: true, category: "cost", proxy: true, eligibleForDefault: false, defaultWeight: 0 }],
      rows: [...rows.values()], raw, notes,
    };
  },
};
export default source;

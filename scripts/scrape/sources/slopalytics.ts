/**
 * Slopalytics (slopalytics.com) usage tab: T3 Code's own PostHog telemetry, published as one static
 * JSON (`/data/t3-usage.json`, refreshed daily, a trailing calendar window). Rows are day × harness ×
 * model. We publish one operational metric — each model's share of all sent turns in the window —
 * plus per-turn session stats in details. Model-level only (no reasoning effort), coding-agent
 * traffic from one app; popularity reflects price, plans and harness defaults as much as quality,
 * so it never enters default indices. "Other models" / "Unreported model" / "Mixed models" count
 * toward the total but are never ranked. Each row also carries the model's measured token mix
 * (`tokenMixes`), which Priors uses to blend API prices per token (`src/data/subscription.ts`).
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import type { MeasuredTokenMix, TokenMix } from "../../../src/data/subscription";

const SITE = "https://slopalytics.com";
const API = "https://slopalytics.com/data/t3-usage.json";
const BUCKETS = new Set(["Other models", "Unreported model", "Mixed models"]);

type ModelRow = { day: string; harness: string; model: string; turns: number };
type MetricRow = {
  day: string; harness: string; model: string; terminal?: number; completed?: number; failed?: number; interrupted?: number;
  tokenTurns?: number; input?: number; output?: number; cached?: number; fresh?: number; written?: number; timedTurns?: number; durationMs?: number;
  pricedTurns?: number; estimatedCost?: number; subagentTurns?: number;
};
type Usage = { schemaVersion: number; fetchedAt: string; start: string; endExclusive: string; project: string; models: ModelRow[]; metrics?: MetricRow[] };

/** Rolling window for token mixes, and the least usage in it that counts as a measurement. Below that, a model keeps its plan's assumed mix. */
const MIX_DAYS = 7, MIX_MIN_TOKENS = 1e9, MIX_MIN_TURNS = 1000, MIX_HIGH_TOKENS = 100e9;

/** Each model's share of all tokens by kind over the window's last 7 days, on the harness that carries most of it. Other harnesses with enough usage are listed in `byHarness`. */
export function tokenMixes(metrics: MetricRow[], days: string[]): Map<string, MeasuredTokenMix> {
  const recent = new Set(days.slice(-MIX_DAYS)), start = days.slice(-MIX_DAYS)[0], end = days.at(-1)!;
  const sums = new Map<string, Map<string, { cached: number; fresh: number; written: number; output: number; turns: number }>>();
  for (const r of metrics) {
    if (!recent.has(r.day) || BUCKETS.has(r.model)) continue;
    const harnesses = sums.get(r.model) ?? sums.set(r.model, new Map()).get(r.model)!;
    const s = harnesses.get(r.harness) ?? harnesses.set(r.harness, { cached: 0, fresh: 0, written: 0, output: 0, turns: 0 }).get(r.harness)!;
    s.cached += r.cached ?? 0; s.fresh += r.fresh ?? 0; s.written += r.written ?? 0; s.output += r.output ?? 0; s.turns += r.tokenTurns ?? 0;
  }
  const share = (n: number, total: number) => Math.round((n / total) * 1e6) / 1e6;
  const out = new Map<string, MeasuredTokenMix>();
  for (const [model, harnesses] of sums) {
    const measured = [...harnesses].map(([harness, s]) => {
      const tokens = s.cached + s.fresh + s.written + s.output;
      const mix: TokenMix & { tokens: number } = { cache: share(s.cached, tokens), input: share(s.fresh, tokens), cacheWrite: share(s.written, tokens), output: share(s.output, tokens), tokens };
      return { harness, mix, turns: s.turns };
    }).filter((x) => x.mix.tokens >= MIX_MIN_TOKENS && x.turns >= MIX_MIN_TURNS).sort((a, b) => b.mix.tokens - a.mix.tokens);
    if (!measured.length) continue;
    const [top, ...rest] = measured;
    out.set(model, { ...top.mix, harness: top.harness, start, end, confidence: top.mix.tokens >= MIX_HIGH_TOKENS ? "high" : "medium", ...(rest.length ? { byHarness: Object.fromEntries(rest.map((x) => [x.harness, x.mix])) } : {}) });
  }
  return out;
}

const source: Source = {
  id: "slopalytics",
  name: "Slopalytics (T3 Code usage)",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const json = await ctx.fetchJson(API) as Usage;
    // Check the shape we read, not the version number: v3 only added fields (`sent`, `prices`, ...) and a version allow-list broke on it.
    const sample = Array.isArray(json.models) ? json.models[0] : undefined;
    if (!sample || typeof sample.day !== "string" || typeof sample.model !== "string" || typeof sample.turns !== "number" || typeof json.start !== "string" || typeof json.endExclusive !== "string") throw new Error(`Slopalytics: unexpected usage payload (schemaVersion ${json.schemaVersion})`);
    // Turns per day for each model (and all models), over the window's days in order, for the usage-over-time chart.
    const days: string[] = [];
    for (let t = Date.parse(`${json.start}T00:00:00Z`); t < Date.parse(`${json.endExclusive}T00:00:00Z`) && days.length < 400; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
    const dayIndex = new Map(days.map((d, i) => [d, i]));
    const daily = new Map<string, number[]>(), dayTotals = days.map(() => 0);
    for (const r of json.models) {
      const i = dayIndex.get(r.day);
      if (i === undefined || !r.model || !(r.turns > 0)) continue;
      dayTotals[i] += r.turns;
      (daily.get(r.model) ?? daily.set(r.model, days.map(() => 0)).get(r.model)!)[i] += r.turns;
    }
    const turns = new Map<string, number>();
    const harnesses = new Map<string, Set<string>>();
    let total = 0;
    for (const r of json.models) {
      if (!r.model || !(r.turns > 0)) continue;
      total += r.turns;
      turns.set(r.model, (turns.get(r.model) ?? 0) + r.turns);
      (harnesses.get(r.model) ?? harnesses.set(r.model, new Set()).get(r.model)!).add(r.harness);
    }
    const sums = new Map<string, Required<Omit<MetricRow, "day" | "harness" | "model" | "fresh" | "written">>>();
    for (const r of json.metrics ?? []) {
      const s = sums.get(r.model) ?? { terminal: 0, completed: 0, failed: 0, interrupted: 0, tokenTurns: 0, input: 0, output: 0, cached: 0, timedTurns: 0, durationMs: 0, pricedTurns: 0, estimatedCost: 0, subagentTurns: 0 };
      for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] += Number(r[k] ?? 0) || 0;
      sums.set(r.model, s);
    }
    const end = new Date(Date.parse(`${json.endExclusive}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const window = `${json.start} to ${end}`;
    const rows: RawRow[] = [], mixes = tokenMixes(json.metrics ?? [], days);
    for (const [model, n] of turns) {
      if (BUCKETS.has(model)) continue;
      const s = sums.get(model);
      const ratio = (a?: number, b?: number) => (a != null && b ? a / b : undefined);
      rows.push({
        benchmarkId: "t3-usage-share", modelLabel: model, value: (n / total) * 100, sourceUrl: SITE,
        note: `${n.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} T3 Code turns, ${window}`,
        details: {
          turns: n, totalTurns: total, window, start: days[0], daily: daily.get(model), dayTotals, harnesses: [...(harnesses.get(model) ?? [])].sort(),
          completionRate: ratio(s?.completed, s?.terminal), interruptRate: ratio(s?.interrupted, s?.terminal), failureRate: ratio(s?.failed, s?.terminal),
          minutesPerCompletedTurn: s && s.timedTurns ? s.durationMs / s.timedTurns / 60_000 : undefined,
          outputTokensPerTurn: ratio(s?.output, s?.tokenTurns), inputTokensPerTurn: ratio(s?.input, s?.tokenTurns),
          estimatedUsdPerTurn: ratio(s?.estimatedCost, s?.pricedTurns), tokenMix: mixes.get(model),
        },
      });
    }
    if (!rows.length) throw new Error("Slopalytics: no models");
    return {
      benchmarks: [{
        id: "t3-usage-share", name: "T3 Code usage share", shortName: "T3 Code usage", sourceId: this.id, url: SITE, lastUpdated: json.fetchedAt.slice(0, 10),
        description: `Share of all turns sent in T3 Code (${window}), from T3's own telemetry via Slopalytics. Revealed preference among T3 Code users, not a quality measure: price, plans and harness defaults drive it too. Model-level, no reasoning effort.`,
        unit: "percent" as const, higherIsBetter: true, category: "other" as const, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "t3-usage.json": JSON.stringify(json) },
      notes: [`${rows.length} models, ${total.toLocaleString("en-US")} turns, ${window}; ${[...BUCKETS].map((b) => `${b} ${(((turns.get(b) ?? 0) / total) * 100).toFixed(1)}%`).join(", ")}; token mixes for ${mixes.size} models`],
    };
  },
};
export default source;

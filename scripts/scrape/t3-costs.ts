/**
 * T3 Code cost per turn at today's list prices, from each source's tokens by kind per turn (`details.perTurn`), priced at the
 * model's API list price from Artificial Analysis's metadata (`listPrices`). Slopalytics' own price table (September 2026) leaves
 * out every newer model, so its estimate stands only where Priors has no price and there are no ClickHouse rows.
 */
import type { Observation, Snapshot } from "../../src/data/types";
import { listPrices } from "../../src/data/subscription";

export interface PerTurn { fresh: number; cached: number; written: number; output: number }

/** Dollars for one turn's tokens. Unlisted cache prices: reads at a tenth of input, writes at input. */
export function turnCost(t: PerTurn, p: { input: number; output: number; cached?: number; cacheWrite?: number }): number {
  return (t.fresh * p.input + t.cached * (p.cached ?? p.input / 10) + t.written * (p.cacheWrite ?? p.input) + t.output * p.output) / 1e6;
}

const COST_BENCHMARK = "t3-cost-per-turn", TIME_BENCHMARK = "t3-turn-time";

/**
 * Prices T3 Code turns at list price. Two inputs: T3's ClickHouse rows (`t3-turn-time`, per model and reasoning effort, every model
 * with 5+ users and 30+ turns) and Slopalytics' usage rows (`t3-usage-share`, model-level, 2,000+ turns). When the ClickHouse rows
 * carry tokens, they are the cost source: each gets `costUsd`, and `t3-cost-per-turn` is rebuilt from them, one row per model and
 * effort with the users and turns behind it. Slopalytics' usage rows are still priced but no longer write cost-per-turn rows,
 * which would sit beside the per-effort ones as a second, model-level figure.
 */
export function applyT3Costs(snapshot: Snapshot): { priced: string[]; perEffort: number } {
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const prices = new Map<string, NonNullable<ReturnType<typeof listPrices>>>();
  for (const v of snapshot.variants) { const p = prices.has(v.modelId) ? undefined : listPrices(v.sourceModel?.metadata); if (p) prices.set(v.modelId, p); }
  const priceOf = (o: Observation) => prices.get(modelOf.get(o.variantId) ?? o.variantId.split("@")[0]);
  const noteFor = (p: { input: number; output: number }) => `API list price (Artificial Analysis: $${p.input} in, $${p.output} out per 1M) on the average turn's tokens by kind`;
  const priced: string[] = [];

  // T3's own ClickHouse rows, per effort.
  const perEffort: Observation[] = [];
  for (const o of snapshot.observations) {
    const d = o.benchmarkId === TIME_BENCHMARK ? o.details as { perTurn?: PerTurn; users?: number; turns?: number; tokenTurns?: number; tokenUsers?: number; window?: string } | undefined : undefined;
    const p = d?.perTurn && priceOf(o);
    if (!d?.perTurn || !p) continue;
    const usd = turnCost(d.perTurn, p);
    if (!(usd > 0) || !Number.isFinite(usd)) continue;
    o.costUsd = usd;
    priced.push(modelOf.get(o.variantId) ?? o.variantId);
    perEffort.push({
      benchmarkId: COST_BENCHMARK, variantId: o.variantId, value: usd, observedAt: o.observedAt, sourceUrl: o.sourceUrl, costUsd: usd,
      note: `${noteFor(p)}; ${(d.tokenTurns ?? d.turns ?? 0).toLocaleString("en-US")} turns with token counts from ${(d.tokenUsers ?? d.users ?? 0).toLocaleString("en-US")} T3 Code users${d.window ? `, ${d.window}` : ""}`,
      details: { users: d.tokenUsers ?? d.users, turns: d.tokenTurns ?? d.turns, perTurn: d.perTurn, ...(d.window ? { window: d.window } : {}) },
    });
  }

  // Slopalytics' model-level usage rows.
  const costRows = new Map(snapshot.observations.filter((o) => o.benchmarkId === COST_BENCHMARK).map((o) => [o.variantId, o]));
  const added: Observation[] = [];
  for (const o of snapshot.observations) {
    const perTurn = o.benchmarkId === "t3-usage-share" ? (o.details as { perTurn?: PerTurn } | undefined)?.perTurn : undefined;
    const p = perTurn && priceOf(o);
    if (!perTurn || !p) continue;
    const usd = turnCost(perTurn, p);
    if (!(usd > 0) || !Number.isFinite(usd)) continue;
    o.costUsd = usd;
    if (perEffort.length) continue;
    priced.push(modelOf.get(o.variantId) ?? o.variantId);
    const row = costRows.get(o.variantId), tail = row?.note?.split("; ").slice(1).join("; ");
    if (row) { row.value = usd; row.note = tail ? `${noteFor(p)}; ${tail}` : noteFor(p); }
    else added.push({ benchmarkId: COST_BENCHMARK, variantId: o.variantId, value: usd, observedAt: o.observedAt, sourceUrl: o.sourceUrl, note: noteFor(p) });
  }

  if (perEffort.length) {
    snapshot.observations = [...snapshot.observations.filter((o) => o.benchmarkId !== COST_BENCHMARK), ...perEffort];
    const time = snapshot.benchmarks.find((b) => b.id === TIME_BENCHMARK), window = (perEffort[0].details as { window?: string }).window;
    const cost = {
      id: COST_BENCHMARK, name: "T3 Code cost per turn", shortName: "T3 $/turn", sourceId: time?.sourceId ?? "t3-telemetry", url: time?.url ?? "https://t3.codes",
      ...(time?.lastUpdated ? { lastUpdated: time.lastUpdated } : {}),
      description: `API-equivalent cost of an average turn in real T3 Code sessions, by model and reasoning effort${window ? ` (${window})` : ""}: its fresh, cached, cache-write and output tokens at the model's current list price. Not what anyone was billed. From T3 Code's own telemetry; each figure lists the users behind it.`,
      unit: "usd" as const, higherIsBetter: false, category: "cost" as const, eligibleForDefault: false, defaultWeight: 0,
    };
    const i = snapshot.benchmarks.findIndex((b) => b.id === COST_BENCHMARK);
    if (i >= 0) snapshot.benchmarks[i] = { ...snapshot.benchmarks[i], ...cost }; else snapshot.benchmarks.push(cost);
  } else snapshot.observations.push(...added);
  return { priced: [...new Set(priced)], perEffort: perEffort.length };
}

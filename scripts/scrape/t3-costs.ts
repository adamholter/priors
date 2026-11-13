/**
 * T3 Code cost per turn at today's list prices. Slopalytics prices turns with a table saved in September 2026, which leaves
 * out every newer model (Fable 5.2, GPT-6.1 Sol). The usage rows carry each model's tokens by kind per turn (`details.perTurn`,
 * scripts/scrape/sources/slopalytics.ts); this prices them at the model's API list price from Artificial Analysis's metadata
 * (`listPrices`), sets the usage row's `costUsd` (the charts' "T3 Code" cost source) and writes `t3-cost-per-turn`.
 * A model Priors has no price for keeps Slopalytics' estimate, if it has one.
 */
import type { Observation, Snapshot } from "../../src/data/types";
import { listPrices } from "../../src/data/subscription";

export interface PerTurn { fresh: number; cached: number; written: number; output: number }

/** Dollars for one turn's tokens. Unlisted cache prices: reads at a tenth of input, writes at input. */
export function turnCost(t: PerTurn, p: { input: number; output: number; cached?: number; cacheWrite?: number }): number {
  return (t.fresh * p.input + t.cached * (p.cached ?? p.input / 10) + t.written * (p.cacheWrite ?? p.input) + t.output * p.output) / 1e6;
}

export function applyT3Costs(snapshot: Snapshot): { priced: string[] } {
  if (!snapshot.benchmarks.some((b) => b.id === "t3-cost-per-turn")) return { priced: [] };
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const prices = new Map<string, NonNullable<ReturnType<typeof listPrices>>>();
  for (const v of snapshot.variants) { const p = prices.has(v.modelId) ? undefined : listPrices(v.sourceModel?.metadata); if (p) prices.set(v.modelId, p); }
  const costRows = new Map(snapshot.observations.filter((o) => o.benchmarkId === "t3-cost-per-turn").map((o) => [o.variantId, o]));
  const added: Observation[] = [], priced: string[] = [];
  for (const o of snapshot.observations) {
    const perTurn = o.benchmarkId === "t3-usage-share" ? (o.details as { perTurn?: PerTurn } | undefined)?.perTurn : undefined;
    const modelId = modelOf.get(o.variantId) ?? o.variantId.split("@")[0], p = prices.get(modelId);
    if (!perTurn || !p) continue;
    const usd = turnCost(perTurn, p);
    if (!(usd > 0) || !Number.isFinite(usd)) continue;
    o.costUsd = usd;
    priced.push(modelId);
    const note = `API list price (Artificial Analysis: $${p.input} in, $${p.output} out per 1M) on the average turn's tokens by kind`;
    const row = costRows.get(o.variantId);
    const tail = row?.note?.split("; ").slice(1).join("; ");
    if (row) { row.value = usd; row.note = tail ? `${note}; ${tail}` : note; }
    else added.push({ benchmarkId: "t3-cost-per-turn", variantId: o.variantId, value: usd, observedAt: o.observedAt, sourceUrl: o.sourceUrl, note });
  }
  snapshot.observations.push(...added);
  return { priced };
}

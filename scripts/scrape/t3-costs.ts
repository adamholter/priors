/**
 * T3 Code cost per turn at today's list prices, from each source's tokens by kind per turn (`details.perTurn`), priced at the
 * model's API list price from Artificial Analysis's metadata (`listPrices`). Slopalytics' own price table (September 2026) leaves
 * out every newer model, so its estimate stands only where Priors has no price and there are no ClickHouse rows.
 */
import type { Effort, Observation, Snapshot } from "../../src/data/types";
import { EFFORT_ORDER } from "../../src/data/types";
import { listPrices } from "../../src/data/subscription";

export interface PerTurn { fresh: number; cached: number; written: number; output: number }

/** Dollars for one turn's tokens. Unlisted cache prices: reads at a tenth of input, writes at input. */
export function turnCost(t: PerTurn, p: { input: number; output: number; cached?: number; cacheWrite?: number }): number {
  return (t.fresh * p.input + t.cached * (p.cached ?? p.input / 10) + t.written * (p.cacheWrite ?? p.input) + t.output * p.output) / 1e6;
}

const COST_BENCHMARK = "t3-cost-per-turn", TIME_BENCHMARK = "t3-turn-time";

/**
 * A model with little T3 Code data, such as one released days ago, can have figures that swing. Below SETTLED_TURNS turns (all its
 * efforts together) its rows are published only once its cost per turn rises with each step of reasoning effort (Adam,
 * 2026-11-17): each priced effort must cost more than the priced effort below it. With more data than that it is published either
 * way, since some settled models break the pattern. A model with fewer than two priced efforts has nothing to compare. Gemini is
 * exempt: its efforts break the pattern even on settled data. A held model loses its T3 Code time and cost (ClickHouse rows, and
 * Slopalytics' per-turn rows and usage-row cost and time); its usage share stays, since that counts turns and claims nothing.
 */
export const SETTLED_TURNS = 5_000;
const SLOPALYTICS_PER_TURN = new Set(["t3-minutes-per-turn", "t3-output-tokens-per-turn", COST_BENCHMARK]);
function holdUnsettled(snapshot: Snapshot, model: (o: Observation) => string, priceOf: (o: Observation) => { input: number; output: number } | undefined): string[] {
  const variantOf = new Map(snapshot.variants.map((v) => [v.id, v]));
  const byModel = new Map<string, Observation[]>();
  for (const o of snapshot.observations) if (o.benchmarkId === TIME_BENCHMARK && !/^gemini/.test(model(o))) byModel.set(model(o), [...byModel.get(model(o)) ?? [], o]);
  const held = new Set<string>();
  for (const [m, rows] of byModel) {
    if (rows.reduce((a, o) => a + ((o.details as { turns?: number } | undefined)?.turns ?? 0), 0) >= SETTLED_TURNS) continue;
    // One curve per configuration: a model's plans or context sizes are separate lines, not steps of effort.
    const curves = new Map<string, { rank: number; usd: number }[]>();
    for (const o of rows) {
      const v = variantOf.get(o.variantId), rank = EFFORT_ORDER.indexOf(v?.effort as Effort), t = (o.details as { perTurn?: PerTurn } | undefined)?.perTurn, p = priceOf(o);
      if (rank >= 0 && t && p) curves.set(v?.configuration ?? "", [...curves.get(v?.configuration ?? "") ?? [], { rank, usd: turnCost(t, p) }]);
    }
    for (const c of curves.values()) if (c.sort((a, b) => a.rank - b.rank).some((x, i) => i > 0 && !(x.usd > c[i - 1].usd))) held.add(m);
  }
  if (held.size) snapshot.observations = snapshot.observations.filter((o) => {
    if (!held.has(model(o))) return true;
    if (o.benchmarkId === TIME_BENCHMARK || SLOPALYTICS_PER_TURN.has(o.benchmarkId)) return false;
    if (o.benchmarkId === "t3-usage-share") { delete o.costUsd; delete o.durationSec; }
    return true;
  });
  return [...held];
}

/**
 * Prices T3 Code turns at list price. Two inputs: T3's ClickHouse rows (`t3-turn-time`, per model and reasoning effort, every model
 * with 5+ users and 30+ turns) and Slopalytics' usage rows (`t3-usage-share`, model-level, 2,000+ turns). When the ClickHouse rows
 * carry tokens, they are the cost source: each gets `costUsd`, and `t3-cost-per-turn` is rebuilt from them, one row per model and
 * effort with the users and turns behind it. Slopalytics' usage rows are still priced but no longer write cost-per-turn rows,
 * which would sit beside the per-effort ones as a second, model-level figure.
 */
export function applyT3Costs(snapshot: Snapshot, opts: { hold?: boolean } = {}): { priced: string[]; perEffort: number; held: string[] } {
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const prices = new Map<string, NonNullable<ReturnType<typeof listPrices>>>();
  for (const v of snapshot.variants) { const p = prices.has(v.modelId) ? undefined : listPrices(v.sourceModel?.metadata); if (p) prices.set(v.modelId, p); }
  const priceOf = (o: Observation) => prices.get(modelOf.get(o.variantId) ?? o.variantId.split("@")[0]);
  const held = opts.hold === false ? [] : holdUnsettled(snapshot, (o) => modelOf.get(o.variantId) ?? o.variantId.split("@")[0], priceOf);
  const noteFor = (p: { input: number; output: number }) => `API list price (Artificial Analysis: $${p.input} in, $${p.output} out per 1M) on the average turn's tokens by kind`;
  const priced: string[] = [];

  // T3's own ClickHouse rows, per effort.
  const perEffort: Observation[] = [];
  for (const o of snapshot.observations) {
    const d = o.benchmarkId === TIME_BENCHMARK ? o.details as { perTurn?: PerTurn; users?: number; turns?: number; tokenTurns?: number; tokenUsers?: number; window?: string; tokenWindow?: string } | undefined : undefined;
    const p = d?.perTurn && priceOf(o);
    if (!d?.perTurn || !p) continue;
    const usd = turnCost(d.perTurn, p);
    if (!(usd > 0) || !Number.isFinite(usd)) continue;
    o.costUsd = usd;
    priced.push(modelOf.get(o.variantId) ?? o.variantId);
    perEffort.push({
      benchmarkId: COST_BENCHMARK, variantId: o.variantId, value: usd, observedAt: o.observedAt, sourceUrl: o.sourceUrl, costUsd: usd,
      note: `${noteFor(p)}; ${(d.tokenTurns ?? d.turns ?? 0).toLocaleString("en-US")} turns with token counts from ${(d.tokenUsers ?? d.users ?? 0).toLocaleString("en-US")} T3 Code users${d.tokenWindow ?? d.window ? `, ${d.tokenWindow ?? d.window}` : ""}`,
      details: { users: d.tokenUsers ?? d.users, turns: d.tokenTurns ?? d.turns, perTurn: d.perTurn, ...(d.tokenWindow ?? d.window ? { window: d.tokenWindow ?? d.window } : {}) },
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
    const time = snapshot.benchmarks.find((b) => b.id === TIME_BENCHMARK), windows = perEffort.map((o) => (o.details as { window?: string }).window).filter(Boolean) as string[];
    // Tokens come from the last week where an effort has enough turns there, else the full window: name the usual one.
    const window = windows.sort((x, y) => windows.filter((w) => w === y).length - windows.filter((w) => w === x).length)[0];
    const cost = {
      id: COST_BENCHMARK, name: "T3 Code cost per turn", shortName: "T3 $/turn", sourceId: time?.sourceId ?? "t3-telemetry", url: time?.url ?? "https://t3.codes",
      ...(time?.lastUpdated ? { lastUpdated: time.lastUpdated } : {}),
      description: `API-equivalent cost of an average turn in real T3 Code sessions, by model and reasoning effort${window ? ` (${window})` : ""}: its fresh, cached, cache-write and output tokens at the model's current list price. Efforts with too few turns in that window use the time chart's 30 days. Not what anyone was billed. From T3 Code's own telemetry; each figure lists the users behind it.`,
      unit: "usd" as const, higherIsBetter: false, category: "cost" as const, eligibleForDefault: false, defaultWeight: 0,
    };
    const i = snapshot.benchmarks.findIndex((b) => b.id === COST_BENCHMARK);
    if (i >= 0) snapshot.benchmarks[i] = { ...snapshot.benchmarks[i], ...cost }; else snapshot.benchmarks.push(cost);
  } else snapshot.observations.push(...added);
  return { priced: [...new Set(priced)], perEffort: perEffort.length, held };
}

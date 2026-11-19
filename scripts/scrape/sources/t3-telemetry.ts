/**
 * T3 Code's own telemetry, read from its ClickHouse dashboard (slophouse, shared with Adam by Theo), for time per turn by
 * model AND reasoning effort, with how many installs each figure rests on. Slopalytics (slopalytics.ts) publishes the same
 * telemetry model-level only and drops models under 2,000 turns, so a new model (Gemini 4 Hydrogen) had no per-effort
 * times. One aggregate query over the last 30 days up to the moment it runs, at most once a day (cached), so a model released yesterday is already in it: completed, non-subagent turns,
 * grouped by model and effort, kept only where at least MIN_USERS installs and MIN_TURNS turns stand behind it. Only
 * aggregates leave the dashboard: no install ids or per-user rows.
 *
 * Effort is T3's `effort` column, except for Gemini, whose harnesses put it in the model id (`gemini-4-hydrogen-high`):
 * there the suffix is the effort. Turns with no effort recorded use the harness default, which differs by harness, so they
 * count only for a model that has no turns at an explicit effort. Provider-prefixed, regional, fast-mode and composite ids
 * (`us.anthropic.…`, `…-fast`, `fusion-…`) are left out rather than folded into the plain model.
 *
 * Fireworks-style versions (`glm-5p3`) read as `glm-5.3`. Value: mean seconds per completed turn, tool and wait time included (Slopalytics' "average" too); the median and 90th
 * percentile ride in details. Rows also carry `durationSec`, which the time charts read for the "T3 Code" source, and the average turn's
 * tokens by kind (`details.perTurn`), which scripts/scrape/t3-costs.ts prices into `costUsd` for the cost charts' "T3 Code" source.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { normalizeLabel } from "../../../src/data/normalize";
import type { RawRow, ScrapeResult, Snapshot, Source } from "../../../src/data/types";
import { T3_MIN_USERS } from "../../../src/data/task-metrics";

export const T3_TURN_TIME_ID = "t3-turn-time";
const SITE = "https://t3.codes";
const DASHBOARD = "https://slophouse.ineededadomain.com";
/** The least installs and turns behind a published figure. Low on purpose: every effort of a new model should show; the time chart's Advanced filter raises it. */
export const MIN_USERS = T3_MIN_USERS, MIN_TURNS = 30;
const DAYS = 30, CACHE_HOURS = 20, CACHE_MAX_DAYS = 7;
/**
 * Between the daily queries, every scrape (15 minutes) runs the same query over the last week and looks only at models the site does
 * not show yet: just released, or held by scripts/scrape/t3-costs.ts until their cost rises with effort. One enters the day's data once
 * it has this many turns at this many stated efforts, so a chance fit in a launch's first hour does not go up. A published model keeps
 * its daily figures unless the week holds WATCH_GROWTH times the day's turns: only a model days old grows that fast in under a day
 * (Gemini 4 Neon doubled between the morning query and the evening, November 19), and then the week is its whole history. Each
 * refresh raises the bar, so this does not republish the site every 15 minutes.
 */
const WATCH_DAYS = 7, WATCH_MIN_TURNS = 1_000, WATCH_MIN_EFFORTS = 3, WATCH_GROWTH = 1.25;
const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
/** Ids that are not the plain model: provider or region prefixes (`openai.`, `us.anthropic.`), fast and sovereign modes, composites, an effort in a non-Gemini id, and aliases with no version (`opus`). */
const NOT_PLAIN = /[:[\]"\s/]|^[a-z-]+\.|^fusion-|-(fast|build|turbo|sidekick|ultrafast|sovereign|latest)(-|$)|-(minimal|low|medium|high|xhigh|max)$|^[^0-9]*$/;

/**
 * Antigravity's own effort for a plain model id, which is all newer T3 Code versions send (older ones sent `gemini-4-neon-high`, with no
 * token counts). Antigravity resolves the alias itself and logs it (`agy --model gemini-4-neon --log-file …`: "model alias "gemini-4-neon"
 * resolved to "gemini-4-neon-high"", checked 2026-11-19). Only Neon so far, whose turns were nearly all plain: Carbon, Argon, Hydrogen
 * and 3.8 Flash resolve to medium, but their published figures still come from explicit efforts alone.
 */
export const ANTIGRAVITY_ALIAS_EFFORT: Record<string, string> = { "gemini-4-neon": "high" };
const aliasSql = (map: Record<string, string>) => `transform(m2, [${Object.keys(map).map((k) => `'${k}'`).join(", ")}], [${Object.values(map).map((v) => `'${v}'`).join(", ")}], '')`;

export const T3_SQL = `SELECT base, sum(n) total, groupArray((eff, n, u, avg_s, med_s, p90_s, out_tok, tok_n, fresh, cached, written, tok_out, tok_u)) efforts FROM (
 SELECT base, eff, count() n, uniq(installId) u, round(avg(durationMs)/1000, 2) avg_s, round(quantileTDigest(0.5)(durationMs)/1000, 2) med_s, round(quantileTDigest(0.9)(durationMs)/1000, 2) p90_s, round(avg(outputTokens)) out_tok,
  countIf(tok) tok_n, round(avgIf(greatest(inputTokens - ifNull(cachedInputTokens, 0) - ifNull(cacheCreationTokens, 0), 0), tok)) fresh,
  round(avgIf(ifNull(cachedInputTokens, 0), tok)) cached, round(avgIf(ifNull(cacheCreationTokens, 0), tok)) written, round(avgIf(outputTokens, tok)) tok_out, uniqIf(installId, tok) tok_u
 FROM (SELECT replaceRegexpOne(replaceRegexpOne(replaceRegexpOne(model, '\\\\[1m\\\\]$', ''), '^(claude-[a-z]+-[0-9]+)\\\\.([0-9]+)$', '\\\\1-\\\\2'), '^deepseek-v([0-9])([0-9])-', 'deepseek-v\\\\1.\\\\2-') AS m2,
   extract(m2, '^gemini-.+-(minimal|low|medium|high|xhigh)$') AS sfx,
   if(sfx != '', substring(m2, 1, length(m2) - length(sfx) - 1), m2) AS base,
   if(sfx != '', sfx, if(provider = 'antigravity' AND effort = '', ${aliasSql(ANTIGRAVITY_ALIAS_EFFORT)}, effort)) AS eff, installId, durationMs, outputTokens, inputTokens, cachedInputTokens, cacheCreationTokens,
   inputTokens IS NOT NULL AND outputTokens IS NOT NULL AS tok
  FROM events WHERE event = 'provider.turn.completed' AND terminalStatus = 'completed' AND timestamp >= now() - toIntervalDay({days:UInt32}) AND timestamp < now()
   AND position(model, '/') = 0 AND model NOT IN ('', 'default') AND durationMs > 0 AND durationMs < 86400000 AND JSONExtractBool(properties, 'subagent') = 0)
 WHERE eff IN ('', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max')
 GROUP BY base, eff HAVING u >= ${MIN_USERS} AND n >= ${MIN_TURNS})
GROUP BY base ORDER BY total DESC LIMIT 100`;

/**
 * Token columns (older cached payloads stop at outputTokens): turns with token counts, then their average tokens by kind. T3's
 * inputTokens includes cached reads and cache writes for every harness (cached plus written never exceeds it), so fresh input is
 * the rest.
 */
type Effort = [eff: string, turns: number, users: number, meanSec: number | null, medianSec: number | null, p90Sec: number | null, outputTokens: number | null,
  tokenTurns?: number, fresh?: number | null, cached?: number | null, written?: number | null, tokenOutput?: number | null, tokenUsers?: number];
/** Bumped when the query changes, so a cached payload from the old query is refetched instead of served for up to a day. */
export const T3_PAYLOAD_VERSION = 5;
export type T3Payload = { version?: number; fetchedAt: string; start: string; end: string; rows: [base: string, total: number, efforts: Effort[]][] };

export function parseT3Telemetry(p: T3Payload): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const window = `${p.start} to ${p.end}`;
  const rows: RawRow[] = [];
  let skipped = 0;
  for (const [base, , efforts] of p.rows) {
    if (!base || NOT_PLAIN.test(base)) { skipped++; continue; }
    const usable = efforts.filter(([eff, n, u, mean]) => (eff === "" || EFFORTS.has(eff)) && n >= MIN_TURNS && u >= MIN_USERS && typeof mean === "number" && mean > 0);
    // No effort recorded means the harness default, which differs by harness: it stands in only for a model run (almost) without an
    // explicit effort, such as Composer 2.5, where a stray handful of "high" turns is noise rather than a setting.
    const explicit = usable.filter(([eff]) => eff !== ""), unstated = usable.filter(([eff]) => eff === "");
    const turns = (list: Effort[]) => list.reduce((a, [, n]) => a + n, 0);
    const pick = explicit.length && turns(explicit) >= 0.05 * turns(usable) ? explicit : unstated;
    for (const [eff, n, u, mean, median, p90, out, tokenTurns, fresh, cached, written, tokenOut, tokenUsers] of pick) {
      // Tokens by kind for an average turn, which scripts/scrape/t3-costs.ts prices at the model's list price. Some harnesses send no
      // token counts (Antigravity often), so the turns and users behind the tokens must clear the same bar on their own.
      const perTurn = (tokenTurns ?? 0) >= MIN_TURNS && (tokenUsers ?? 0) >= MIN_USERS && typeof tokenOut === "number" && tokenOut > 0
        ? { fresh: fresh ?? 0, cached: cached ?? 0, written: written ?? 0, output: tokenOut } : undefined;
      rows.push({
        benchmarkId: T3_TURN_TIME_ID, modelLabel: base.replace(/(\d)p(\d)/g, "$1.$2"), ...(eff ? { effort: eff } : { effortUnstated: true }), value: Math.round((mean! / 60) * 100) / 100, durationSec: mean!,
        ...(typeof out === "number" && out > 0 ? { outputTokens: out } : {}), sourceUrl: SITE,
        note: `mean of ${n.toLocaleString("en-US")} completed turns from ${u.toLocaleString("en-US")} T3 Code users, ${window}${eff ? "" : "; effort not recorded (harness default)"}`,
        details: { users: u, turns: n, medianSec: median ?? undefined, p90Sec: p90 ?? undefined, window, ...(perTurn ? { perTurn, tokenTurns, tokenUsers } : {}) },
      });
    }
  }
  if (rows.length < 10) throw new Error(`T3 telemetry: ${rows.length} rows; query or schema changed?`);
  return {
    benchmarks: [{
      id: T3_TURN_TIME_ID, name: "T3 Code minutes per turn by effort", shortName: "T3 min/turn (effort)", sourceId: "t3-telemetry", url: SITE, lastUpdated: p.fetchedAt.slice(0, 10),
      description: `Average time from sending a turn to its completion in real T3 Code sessions, by model and reasoning effort (${window}), tool and wait time included. Lower is faster. From T3 Code's own telemetry, shared by Theo. Each figure lists the users behind it; a figure from few users is noisy. At least ${MIN_USERS} users and ${MIN_TURNS} turns.`,
      unit: "score", higherIsBetter: false, category: "speed", eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    notes: [`${rows.length} model-efforts from ${p.rows.length} model ids (${skipped} provider, regional or fast-mode ids left out), ${window}`],
  };
}

/**
 * The day's payload with last week's rows for models the site lacks, and for published ones whose week already holds WATCH_GROWTH times
 * the day's turns. A model with turns older than the week has more in the 30-day payload than in `week`, and stays as it is: a week's
 * slice would misstate it.
 */
export function mergeWatched(day: T3Payload, week: T3Payload["rows"], published: (base: string) => boolean): { payload: T3Payload; added: string[] } {
  const rows = new Map(day.rows.map((r) => [r[0], r]));
  const added: string[] = [];
  for (const row of week) {
    const [base, total, efforts] = row, known = rows.get(base), stated = efforts.filter(([eff]) => EFFORTS.has(eff));
    if (!base || NOT_PLAIN.test(base) || stated.length < WATCH_MIN_EFFORTS || stated.reduce((a, [, n]) => a + n, 0) < WATCH_MIN_TURNS) continue;
    if (published(base) ? !known || total < WATCH_GROWTH * known[1] : known && (known[1] > total || JSON.stringify(known) === JSON.stringify(row))) continue;
    rows.set(base, row);
    added.push(base);
  }
  return { payload: added.length ? { ...day, rows: [...rows.values()] } : day, added };
}

/** Models with T3 Code rows on the site now, from the last snapshot this checkout built. */
function publishedModels(): Set<string> {
  const snapshot = JSON.parse(gunzipSync(readFileSync(path.resolve("data/snapshots/latest.json.gz"))).toString("utf8")) as Snapshot;
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  return new Set(snapshot.observations.filter((o) => o.benchmarkId === T3_TURN_TIME_ID).map((o) => modelOf.get(o.variantId) ?? o.variantId.split("@")[0]));
}

/** Netscape cookie jar (curl -c) to a Cookie header. The value is Adam's session: never logged or written anywhere else. */
function cookieHeader(jar: string): string {
  return readFileSync(jar, "utf8").split("\n").map((l) => l.replace(/^#HttpOnly_/, "")).filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t")).filter((f) => f.length >= 7).map((f) => `${f[5]}=${f[6].trim()}`).join("; ");
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** One aggregate query. The session cookie goes only to the dashboard. */
async function query(days: number, timeoutMs: number): Promise<T3Payload["rows"]> {
  const jar = process.env.PRIORS_SLOPHOUSE_JAR ?? path.join(homedir(), "Projects/overnight-2026-10-20/data/b81/.jar");
  if (!existsSync(jar)) throw new Error("no slophouse session on this machine");
  const res = await fetch(`${DASHBOARD}/api/query`, {
    method: "POST", signal: AbortSignal.timeout(timeoutMs),
    headers: { Cookie: cookieHeader(jar), Origin: DASHBOARD, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify({ sql: T3_SQL, days }),
  });
  if (res.status === 401 || res.status === 403) throw new Error(`slophouse session expired (${res.status}); sign in again in a browser and save the cookie jar`);
  if (!res.ok) throw new Error(`slophouse ${res.status}`);
  const json = await res.json() as { rows?: T3Payload["rows"]; error?: string };
  if (!Array.isArray(json.rows)) throw new Error(`slophouse: ${json.error ?? "no rows"}`);
  return json.rows;
}

const source: Source = {
  id: "t3-telemetry", name: "T3 Code telemetry (by effort)", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const cacheFile = path.join(homedir(), ".cache", "priors", "t3-telemetry.json");
    let cached: T3Payload | undefined;
    try { cached = JSON.parse(readFileSync(cacheFile, "utf8")) as T3Payload; } catch { /* first run */ }
    const age = cached ? (Date.parse(ctx.now) - Date.parse(cached.fetchedAt)) / 3_600_000 : Infinity;
    let payload = cached && age < CACHE_HOURS && cached.version === T3_PAYLOAD_VERSION ? cached : undefined;
    if (payload) {
      // Failing here costs nothing: the day's figures stand and the next scrape looks again.
      try {
        const published = publishedModels();
        const known = (base: string) => { const n = normalizeLabel(base.replace(/(\d)p(\d)/g, "$1.$2")); return n.ok && published.has(n.modelId); };
        const { payload: merged, added } = mergeWatched(payload, await query(WATCH_DAYS, 90_000), known);
        if (added.length) { payload = merged; writeFileSync(cacheFile, JSON.stringify(payload)); ctx.log(`T3 telemetry: rechecking ${added.join(", ")}, not on the site yet`); }
      } catch (e) { ctx.log(`T3 telemetry: new-model check skipped: ${(e as Error).message}`); }
    } else {
      try {
        const rows = await query(DAYS, 150_000);
        const now = Date.parse(ctx.now);
        payload = { version: T3_PAYLOAD_VERSION, fetchedAt: ctx.now, start: day(now - DAYS * 86_400_000), end: day(now), rows };
        mkdirSync(path.dirname(cacheFile), { recursive: true });
        writeFileSync(cacheFile, JSON.stringify(payload));
      } catch (e) {
        // A day or two old is still the same 30-day window give or take; past a week the build carries the last snapshot's rows instead.
        if (!cached || age > CACHE_MAX_DAYS * 24) throw e;
        ctx.log(`T3 telemetry: ${(e as Error).message}; using the ${Math.round(age)} h old result`);
        payload = cached;
      }
    }
    return { ...parseT3Telemetry(payload), raw: { "t3-telemetry.json": JSON.stringify(payload) } };
  },
};
export default source;

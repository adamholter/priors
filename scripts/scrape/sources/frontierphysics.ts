/**
 * FrontierPhysics (benchflow.ai/frontierphysics), by BenchFlow with physicists from Berkeley, Caltech, Harvard and
 * others. End-to-end physics research: 56 tasks in 9 domains written by 42 researchers, 3 trials each, graded by
 * deterministic verifiers plus expert rubrics. A pass needs every verifier test and every blocker rubric.
 * The page is Next.js; the leaderboard ships as a `JSON.parse('...')` module inside one of the page's hashed JS
 * chunks, so the chunk is found live by its `"agents":[{"rank"` marker. Value is the headline Overall pass rate
 * (mean over three trials); verifier pass, pass@3 and rubric score go in details. Cost, minutes, steps and
 * output tokens are per rollout, which is one attempt at one task.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { balancedJson } from "./_rsc";

const SITE = "https://www.benchflow.ai/frontierphysics";
const ORIGIN = "https://www.benchflow.ai";
const MARKER = '"agents":[{"rank"';

type Stat = { avg3?: number; ci?: number; pass3?: number };
type PerRollout = { perRollout?: number; estimated?: boolean };
type Agent = {
  rank?: number; id?: string; model?: string; baseModel?: string; provider?: string; harness?: string; effort?: string | null;
  overall?: Stat; verifier?: Stat; score?: { mean?: number; ci?: number }; passes?: number; rollouts?: number; tasksSolved?: number;
  cost?: PerRollout; minutes?: PerRollout; steps?: PerRollout; outputTokens?: PerRollout; paretoOptimal?: boolean;
};

/** The last `"key":value` before the leaderboard, so a field of an earlier module in the chunk never wins. */
const field = (js: string, key: string) => [...js.matchAll(new RegExp(`"${key}":"?([\\w.-]+)`, "g"))].at(-1)?.[1];

export function parseFrontierPhysics(js: string): ScrapeResult {
  const at = js.indexOf(MARKER);
  if (at < 0) throw new Error("FrontierPhysics: leaderboard not found in bundle");
  const body = balancedJson(js, at + '"agents":'.length);
  if (!body) throw new Error("FrontierPhysics: leaderboard unterminated");
  const agents = JSON.parse(body) as Agent[];
  const head = js.slice(Math.max(0, at - 4000), at);
  const tasks = field(head, "tasks"), trials = field(head, "trialsPerTask"), date = field(head, "date");
  const rows: RawRow[] = [];
  for (const a of agents) {
    const label = a.baseModel || a.model, v = a.overall?.avg3;
    if (!label || typeof v !== "number" || !Number.isFinite(v)) continue;
    const ci = a.overall?.ci;
    const per = (x?: PerRollout) => (typeof x?.perRollout === "number" ? x.perRollout : undefined);
    const minutes = per(a.minutes);
    rows.push({
      benchmarkId: "frontierphysics", modelLabel: label, effort: a.effort || undefined, value: v,
      ...(typeof ci === "number" ? { ci: [Math.max(0, +(v - ci).toFixed(2)), Math.min(100, +(v + ci).toFixed(2))] as [number, number] } : {}),
      costUsd: per(a.cost), durationSec: minutes === undefined ? undefined : minutes * 60, steps: per(a.steps), outputTokens: per(a.outputTokens),
      harness: a.harness, rank: a.rank, labHint: a.provider, sourceUrl: SITE,
      note: `${a.passes ?? "?"} of ${a.rollouts ?? "?"} rollouts passed · verifier ${a.verifier?.avg3 ?? "?"}% · pass@3 ${a.overall?.pass3 ?? "?"}%${a.cost?.estimated ? " · cost estimated" : ""}`,
      details: {
        verifierPass: a.verifier?.avg3, verifierPass3: a.verifier?.pass3, pass3: a.overall?.pass3, rubricScore: a.score?.mean,
        passes: a.passes, rollouts: a.rollouts, tasksSolved: a.tasksSolved, costEstimated: a.cost?.estimated, configuration: a.id,
      },
    });
  }
  if (!rows.length) throw new Error("FrontierPhysics: no usable rows");
  return {
    benchmarks: [{
      id: "frontierphysics", name: "FrontierPhysics", sourceId: "frontierphysics", url: SITE, lastUpdated: date,
      description: `End-to-end physics research by agents: ${tasks ?? 56} tasks across nine domains (theory, computation and experiment), written by 42 physicists from 26 institutions, ${trials ?? 3} trials each. A pass needs every deterministic verifier test and every blocker rubric. Value is the overall pass rate averaged over the trials. Cost is per rollout, one attempt at one task.`,
      normalization: { kind: "linear", min: 0, max: 100 },
      unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    raw: { "leaderboard.js": js },
    notes: [`${rows.length} configurations`],
  };
}

const source: Source = {
  id: "frontierphysics",
  name: "FrontierPhysics",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE);
    const chunks = [...new Set(html.match(/\/frontierphysics\/_next\/static\/[\w/.-]+\.js/g) ?? [])];
    if (!chunks.length) throw new Error("FrontierPhysics: no script chunks on the page");
    for (const c of chunks) {
      const js = await ctx.fetchText(`${ORIGIN}${c}`);
      if (js.includes(MARKER)) return parseFrontierPhysics(js);
    }
    throw new Error(`FrontierPhysics: leaderboard not in any of ${chunks.length} chunks`);
  },
};
export default source;

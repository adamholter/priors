/**
 * Scores a lab published at launch, for boards that have not listed the model yet.
 *
 * A new model's launch table often reaches Priors days before the boards run it. Each score here fills
 * one benchmark only while that board's own data has no result for the model (at any effort); the
 * moment the board lists it, the board's number replaces this one, whatever it says. Only benchmarks
 * Priors already tracks are filled, and the board's own wording must match the launch table's (same
 * version and harness). Delete an entry once its boards have the model; leaving it is harmless.
 * AA's own announced-but-unlisted results stay in aa-preview.ts, which feeds the AA source directly.
 */
import type { Effort, Model, Snapshot } from "../../src/data/types";
import { normalizeLabel, variantId } from "../../src/data/normalize";

export interface LaunchClaim {
  /** The model's name as the lab writes it. */
  model: string;
  /** Effort the lab ran, when it says; otherwise the effort the boards list the model at by default. */
  effort: Effort;
  releaseDate: string;
  /** Who published the numbers, where, and when. */
  by: string; url: string; published: string;
  /** Priors benchmark id → score in that benchmark's unit. */
  scores: Record<string, number>;
}

/**
 * GPT-6.2 Astra and Sol (OpenAI, 2026-11-17). The post's charts carry their data (each model at every effort, with score and cost per
 * task); the rows kept are the ones whose reference models match the board exactly: Agents' Last Exam v1.1, AA Intelligence Index
 * v5.0.1 (its cost is AA's cost per Intelligence Index task, to the cent for Opus 5.5, Fable 5.2, GPT-6 Astra and GPT-6.1 Sol),
 * Harvey LAB-AA v1.1, and the text's AA-3D Elo (Fable 5.2's 1,271 matches AA) and AA-AnalystAgent (62.5%, AA's own measure; both at max,
 * as AA runs these models). Left out: Terminal-Bench-Science 0.1 and FrontierCode 2.0 (OpenAI's reference scores differ from every board
 * here, so another harness), AutomationBench 1.0.6 (Zapier's board already lists both, at the same numbers), Vals Science Index v1 and
 * BenchCAD 2.1 Core (not tracked), and the internal or untracked ones (GDPval v2, LifeVal, SecureSWE, PatchBench, ExploitBench, DeepBinary).
 * The post loaded only through a reader (openai.com served it as an error page); the numbers are the charts' own data.
 */
const BLOG_62 = "https://openai.com/index/introducing-gpt-6-2-astra-sol/";

export const LAUNCH_CLAIMS: LaunchClaim[] = [{
  model: "Gemini 4 Carbon",
  effort: "high",
  releaseDate: "2026-10-28",
  by: "Google",
  url: "https://deepmind.google/models/evals-methodology/gemini-4-carbon",
  published: "2026-10-28",
  // The launch table's rows that match a board Priors tracks. Rows left out: SWE-sweep, GraphWalks,
  // ExploitGym and SEC-bench Pro (not tracked); OSWorld-2.1 offline subset and CWE-bench (versions
  // that differ from the boards here); Terminal-Bench 4.0 and Terminal-Bench-Science (AA's harness,
  // and AA already lists the model). Rows whose board already lists Carbon are kept: they step aside.
  scores: {
    "aa-intelligence-index-v5.0": 59,
    "vals-index-v2": 70.4,
    "frontierswe-v2": 61.2,
    "aa-terminalbench-v4-0": 65.2,
    "agents-last-exam": 77.4,
    automationbench: 53.9,
    "vendingbench-2": 16484,
    chartography: 72.5,
    "blueprintbench-2": 58.6,
    "bg-riemann-bench": 80,
    "aa-terminalbench-science": 64.8,
  },
}, {
  model: "Hy4",
  effort: "high",
  releaseDate: "2026-11-04",
  by: "Tencent",
  url: "https://hy.tencent.ai/research/hy4?langVersion=en",
  published: "2026-11-04",
  // Tencent's appendix has 34 rows, all its own runs at the highest reasoning. Only FrontierCode 2.0 is kept: its five reference
  // scores match AA's board exactly. Rows left out: 20 internal benchmarks; ProgramBench, APEX-Agents, DeepSWE, Terminal-Bench 4.0
  // and Science, AutomationBench, Agents' Last Exam, MMMU-Pro and ZeroBench (reference scores differ from the boards here, so not
  // the same harness or version); SWE-Marathon, PostTrainBench v1.2, HLE-Full and OSWorld 2.1 (not tracked).
  scores: {
    "aa-frontiercode-2-0": 31,
  },
}, {
  model: "GPT-6.2 Astra", effort: "low", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 65.8, "aa-intelligence-index-v5.0.1": 45.7, "aa-cost-per-task-index": 0.6617, "aa-harvey-lab-aa": 2.2 },
},
{
  model: "GPT-6.2 Astra", effort: "medium", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 72.1, "aa-intelligence-index-v5.0.1": 57, "aa-cost-per-task-index": 1.6177, "aa-harvey-lab-aa": 8.1 },
},
{
  model: "GPT-6.2 Astra", effort: "high", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 76.0, "aa-intelligence-index-v5.0.1": 60.1, "aa-cost-per-task-index": 2.0739, "aa-harvey-lab-aa": 13.3 },
},
{
  model: "GPT-6.2 Astra", effort: "xhigh", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 78.3, "aa-intelligence-index-v5.0.1": 61.6, "aa-cost-per-task-index": 2.5211, "aa-harvey-lab-aa": 12.8 },
},
{
  model: "GPT-6.2 Astra", effort: "max", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 77.6, "aa-intelligence-index-v5.0.1": 62.1, "aa-cost-per-task-index": 3.9979, "aa-harvey-lab-aa": 15.0, "aa-3d": 1318, "aa-analyst-agent": 62.5 },
},
{
  model: "GPT-6.2 Sol", effort: "low", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 66.7, "aa-intelligence-index-v5.0.1": 40.6, "aa-cost-per-task-index": 0.18, "aa-harvey-lab-aa": 3.1 },
},
{
  model: "GPT-6.2 Sol", effort: "medium", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 70.3, "aa-intelligence-index-v5.0.1": 52.7, "aa-cost-per-task-index": 0.41, "aa-harvey-lab-aa": 5.0 },
},
{
  model: "GPT-6.2 Sol", effort: "high", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 72.0, "aa-intelligence-index-v5.0.1": 54.9, "aa-cost-per-task-index": 0.56, "aa-harvey-lab-aa": 5.8 },
},
{
  model: "GPT-6.2 Sol", effort: "xhigh", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 72.5, "aa-intelligence-index-v5.0.1": 55.7, "aa-cost-per-task-index": 0.65, "aa-harvey-lab-aa": 6.1 },
},
{
  model: "GPT-6.2 Sol", effort: "max", releaseDate: "2026-11-17", by: "OpenAI", url: BLOG_62, published: "2026-11-17",
  scores: { "agents-last-exam": 73.0, "aa-intelligence-index-v5.0.1": 57.3, "aa-cost-per-task-index": 1.01, "aa-harvey-lab-aa": 11.1, "aa-3d": 1259 },
}];

export interface ClaimResult { added: string[]; replaced: string[]; untracked: string[] }

/** Adds each claim the boards have not superseded. Mutates `snap`; returns what it did, for the build log. */
export function applyLaunchClaims(snap: Snapshot, date: string, claims: LaunchClaim[] = LAUNCH_CLAIMS): ClaimResult {
  const out: ClaimResult = { added: [], replaced: [], untracked: [] };
  const modelOf = new Map(snap.variants.map((v) => [v.id, v.modelId]));
  const benchmarks = new Set(snap.benchmarks.map((b) => b.id));
  // Claims a failed source carried over from the last run, by variant and benchmark: those are already in place. Counted once, up front,
  // so a model's claims at several efforts don't see each other's fresh rows as carried.
  const carriedAtStart = new Set(snap.observations.filter((o) => o.details?.launchClaim).map((o) => `${o.variantId}|${o.benchmarkId}`));
  for (const c of claims) {
    const n = normalizeLabel(c.model);
    if (!n.ok) throw new Error(`launch claim for unknown model "${c.model}": add it to normalize.ts`);
    const mine = snap.observations.filter((o) => modelOf.get(o.variantId) === n.modelId);
    const listed = new Set(mine.filter((o) => !o.details?.launchClaim).map((o) => o.benchmarkId));
    const vid = variantId(n.modelId, c.effort);
    for (const [benchmarkId, value] of Object.entries(c.scores)) {
      const key = `${n.modelName} ${benchmarkId}`;
      if (!benchmarks.has(benchmarkId)) { out.untracked.push(key); continue; }
      if (listed.has(benchmarkId)) { out.replaced.push(key); continue; }
      if (carriedAtStart.has(`${vid}|${benchmarkId}`)) continue;
      snap.observations.push({
        benchmarkId, variantId: vid, value, observedAt: date, sourceUrl: c.url,
        note: `${c.by}'s self-reported launch figure (${c.published}); the board's own result replaces it once it lists the model`,
        details: { launchClaim: { by: c.by, published: c.published } },
      });
      out.added.push(key);
    }
    if (!out.added.some((k) => k.startsWith(`${n.modelName} `))) continue;
    if (!snap.variants.some((v) => v.id === vid)) snap.variants.push({ id: vid, modelId: n.modelId, effort: c.effort });
    // Another source may have created the model without a date (OpenRouter's rows carry none).
    const known = snap.models.find((m) => m.id === n.modelId);
    if (known && !known.releaseDate) known.releaseDate = c.releaseDate;
    if (!known) {
      const model: Model = { id: n.modelId, name: n.modelName, labId: n.labId, kind: "llm", reasoning: n.reasoningFamily, aliases: [c.model.toLowerCase()], releaseDate: c.releaseDate };
      snap.models.push(model);
      snap.models.sort((a, b) => a.id.localeCompare(b.id));
    }
  }
  return out;
}

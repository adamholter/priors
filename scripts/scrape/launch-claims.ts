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
}];

export interface ClaimResult { added: string[]; replaced: string[]; untracked: string[] }

/** Adds each claim the boards have not superseded. Mutates `snap`; returns what it did, for the build log. */
export function applyLaunchClaims(snap: Snapshot, date: string, claims: LaunchClaim[] = LAUNCH_CLAIMS): ClaimResult {
  const out: ClaimResult = { added: [], replaced: [], untracked: [] };
  const modelOf = new Map(snap.variants.map((v) => [v.id, v.modelId]));
  const benchmarks = new Set(snap.benchmarks.map((b) => b.id));
  for (const c of claims) {
    const n = normalizeLabel(c.model);
    if (!n.ok) throw new Error(`launch claim for unknown model "${c.model}": add it to normalize.ts`);
    const mine = snap.observations.filter((o) => modelOf.get(o.variantId) === n.modelId);
    const listed = new Set(mine.filter((o) => !o.details?.launchClaim).map((o) => o.benchmarkId));
    // A failed source carries its last scores, claims included: those are already in place.
    const carried = new Set(mine.filter((o) => o.details?.launchClaim).map((o) => o.benchmarkId));
    const vid = variantId(n.modelId, c.effort);
    for (const [benchmarkId, value] of Object.entries(c.scores)) {
      const key = `${n.modelName} ${benchmarkId}`;
      if (!benchmarks.has(benchmarkId)) { out.untracked.push(key); continue; }
      if (listed.has(benchmarkId)) { out.replaced.push(key); continue; }
      if (carried.has(benchmarkId)) continue;
      snap.observations.push({
        benchmarkId, variantId: vid, value, observedAt: date, sourceUrl: c.url,
        note: `${c.by}'s launch figure (${c.published}); the board's own result replaces it once it lists the model`,
        details: { launchClaim: { by: c.by, published: c.published } },
      });
      out.added.push(key);
    }
    if (!out.added.some((k) => k.startsWith(`${n.modelName} `))) continue;
    if (!snap.variants.some((v) => v.id === vid)) snap.variants.push({ id: vid, modelId: n.modelId, effort: c.effort });
    if (!snap.models.some((m) => m.id === n.modelId)) {
      const model: Model = { id: n.modelId, name: n.modelName, labId: n.labId, kind: "llm", reasoning: n.reasoningFamily, aliases: [c.model.toLowerCase()], releaseDate: c.releaseDate };
      snap.models.push(model);
      snap.models.sort((a, b) => a.id.localeCompare(b.id));
    }
  }
  return out;
}

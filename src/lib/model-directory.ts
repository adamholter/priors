import { computeIndex, defaultConfig, defaultReleasedAfter, PAGE_VIEW, selectVariants } from "@/engine";
import type { Snapshot } from "@/data/types";
import { squash, type Effort, type ModelItem, type NotRanked } from "./model-list";

export type { ModelItem } from "./model-list";
export interface ModelDirectory { items: ModelItem[]; indexName: string }

const PRICE = "aa-price-blended";
const cache = new WeakMap<Snapshot, ModelDirectory>();

/** Labs the snapshot names by their id: how they are written. */
const LAB_NAMES: Record<string, string> = { bytedance: "ByteDance", mbzuai: "MBZUAI", opengvlab: "OpenGVLab", "dots-studio": "dots.studio", "lm-provers": "LM Provers", "google-cloud": "Google Cloud", stepfun: "StepFun", openbmb: "OpenBMB", spacexai: "SpaceXAI", elevenlabs: "ElevenLabs", assemblyai: "AssemblyAI" };
const labName = (id: string, name: string) => (name !== id ? name : LAB_NAMES[id] ?? name.charAt(0).toUpperCase() + name.slice(1));

/** Two ids for one model (a board's spelling and Priors' own): the ranked row stays, else the one measured on more benchmarks, and the other's id becomes an alias so search still finds it. */
function collapseTwins(items: ModelItem[]): ModelItem[] {
  const keep = new Map<string, ModelItem>();
  for (const x of items) {
    const k = `${x.labId}|${squash(x.name)}`, was = keep.get(k);
    if (!was) { keep.set(k, x); continue; }
    const better = (x.rank != null ? 1 : 0) - (was.rank != null ? 1 : 0) || x.benchmarks - was.benchmarks;
    const [win, lose] = better > 0 ? [x, was] : [was, x];
    keep.set(k, { ...win, aliases: [...new Set([...win.aliases, ...lose.aliases, lose.id])].slice(0, 12) });
  }
  return keep.size === items.length ? items : [...keep.values()];
}

export function modelDirectory(snapshot: Snapshot): ModelDirectory {
  const hit = cache.get(snapshot);
  if (hit) return hit;
  // Ranks as the default ranking shows them, which leaves out superseded versions; those keep their score from the full field, unranked.
  const config = defaultConfig(snapshot), page = computeIndex(snapshot, config, PAGE_VIEW), all = computeIndex(snapshot, config);
  const superseded = new Set(page.autoHidden);
  const best = new Map<string, { rank?: number; score: number }>(selectVariants(page.ranked, "best").map((r, i) => [r.model.id, { rank: i + 1, score: r.score }]));
  for (const r of selectVariants(all.ranked, "best")) if (superseded.has(r.model.id)) best.set(r.model.id, { score: r.score });
  // Every effort of every model: its ladder of scores, and what a task costs at the best one.
  const efforts = new Map<string, Effort[]>(), cost = new Map<string, number>(), top = new Map<string, number>();
  for (const r of [...computeIndex(snapshot, { ...config, variants: "all" }).ranked].sort((a, b) => a.score - b.score)) {
    const list = efforts.get(r.model.id) ?? efforts.set(r.model.id, []).get(r.model.id)!;
    if (!list.some((e) => e.effort === r.variant.effort)) list.push({ effort: r.variant.effort, score: +r.score.toFixed(1) });
    if (r.score >= (top.get(r.model.id) ?? -Infinity)) { top.set(r.model.id, r.score); if (r.costUsd != null && r.costUsd >= 0) cost.set(r.model.id, r.costUsd); else cost.delete(r.model.id); }
  }
  const estimated = new Set(page.estimated.map((r) => r.model.id)), coverage = new Map(page.excluded.map((e) => [e.model.id, e.measuredShare]));
  const models = new Map(snapshot.models.map((m) => [m.id, m])), after = defaultReleasedAfter(snapshot.date);
  const whyNot = (id: string): { why: NotRanked; share?: number } => {
    if (estimated.has(id)) return { why: "estimated" };
    if (coverage.has(id)) return { why: "coverage", share: +coverage.get(id)!.toFixed(2) };
    const d = models.get(id)?.releaseDate;
    return { why: !d || d < after ? "window" : "thin" };
  };
  const proxy = new Set(snapshot.benchmarks.filter((b) => b.proxy || b.id === PRICE).map((b) => b.id));
  // A variant id can itself contain "~" (a board's own suffix), so it is looked up whole before it is cut.
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const measured = new Map<string, Set<string>>();
  for (const o of snapshot.observations) {
    const model = modelOf.get(o.variantId) ?? modelOf.get(o.variantId.split("~")[0]);
    if (!model || proxy.has(o.benchmarkId)) continue;
    (measured.get(model) ?? measured.set(model, new Set()).get(model)!).add(o.benchmarkId);
  }
  const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
  const nvidia = labs.get("nvidia");
  const items = snapshot.models.filter((m) => m.kind === "llm" && measured.has(m.id)).map((m): ModelItem => {
    // Nemotron is NVIDIA's even where a board files it under Other.
    const lab = m.labId === "other" && /nemotron|nvidia/i.test(m.name) && nvidia ? nvidia : labs.get(m.labId), labId = lab?.id ?? m.labId, at = best.get(m.id), ladder = efforts.get(m.id);
    return {
      id: m.id, name: m.name, labId, labName: labName(labId, lab?.name ?? labId), labColor: lab?.color ?? "var(--grey)",
      ...(m.releaseDate ? { releaseDate: m.releaseDate } : {}), ...(m.openWeights != null ? { openWeights: m.openWeights } : {}), ...(m.paramsB ? { paramsB: m.paramsB } : {}),
      reasoning: m.reasoning, benchmarks: measured.get(m.id)!.size,
      ...(at?.rank ? { rank: at.rank } : {}), ...(at ? { score: +at.score.toFixed(1) } : {}),
      ...(at?.rank && ladder && ladder.length > 1 ? { efforts: ladder } : {}),
      ...(cost.has(m.id) ? { costUsd: cost.get(m.id)! } : {}),
      ...(superseded.has(m.id) ? { superseded: true } : at?.rank ? {} : whyNot(m.id)), aliases: m.aliases.slice(0, 12),
    };
  });
  const out = { items: collapseTwins(items), indexName: config.name };
  cache.set(snapshot, out);
  return out;
}

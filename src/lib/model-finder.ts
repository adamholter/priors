import type { Effort, Snapshot } from "../data/types";
import { computeIndex, defaultConfig, type IndexConfig } from "../engine";
import { encodeIndex, prettyQuery } from "./url";

export interface ModelFinderVariant {
  id: string;
  modelId: string;
  name: string;
  effort: Effort;
  score: number;
  measuredBenchmarks: string[];
  measuredShare: number;
  costUsd: number;
  costSource?: string;
  color: string;
  labName: string;
  labId: string;
}

export interface ModelFinderBenchmark {
  id: string;
  name: string;
  url: string;
  weight: number;
  share: number;
}

export interface ModelFinderMix {
  id: string;
  name: string;
  description: string;
  benchmarks: ModelFinderBenchmark[];
  variants: ModelFinderVariant[];
  builderUrl: string;
}

export interface ModelFinderGroup {
  id: string;
  label: string;
  mixes: ModelFinderMix[];
}

export interface ModelFinderData {
  date: string;
  costNote: string;
  groups: ModelFinderGroup[];
}

interface MixDefinition {
  id: string;
  name: string;
  description: string;
  weights: Record<string, number>;
  required?: string[];
}

interface GroupDefinition {
  id: string;
  label: string;
  mixes: (snapshot: Snapshot) => MixDefinition[];
}

const fixedMix = (id: string, name: string, description: string, weights: Record<string, number>): MixDefinition => ({ id, name, description, weights });

function latestIntelligenceIndex(snapshot: Snapshot) {
  return snapshot.benchmarks
    .filter((benchmark) => benchmark.id.startsWith("aa-intelligence-index"))
    .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0];
}

const GROUPS: GroupDefinition[] = [
  {
    id: "multimodal",
    label: "Multimodal",
    mixes: () => [
      fixedMix("visual-reasoning", "Visual reasoning", "Balances academic visual questions, grounded image reasoning, and human preference for image responses.", {
        "aa-mmmu-pro": 40, "roboflow-visual-reasoning": 35, "arena-vision": 25,
      }),
      fixedMix("vision-preference", "Vision preference", "Weights human judgments of image responses more heavily while keeping academic and grounded reasoning in the mix.", {
        "arena-vision": 40, "roboflow-visual-reasoning": 35, "aa-mmmu-pro": 25,
      }),
    ],
  },
  {
    id: "overall",
    label: "Overall",
    mixes: (snapshot) => {
      const index = latestIntelligenceIndex(snapshot);
      const general = defaultConfig(snapshot, "finder-general", "Priors general frontier");
      return [
        fixedMix("aa-intelligence", "AA Intelligence Index", "The latest Artificial Analysis composite index in this snapshot.", index ? { [index.id]: 100 } : {}),
        fixedMix("general-frontier", "General frontier", "A broad mix of coding, agent work, reasoning, math, and knowledge benchmarks.", general.weights),
      ];
    },
  },
  {
    id: "coding",
    label: "Coding",
    mixes: (snapshot) => {
      // Use current releases and a shared measured anchor. A 50/50 mix of
      // unrelated leaderboards let one-benchmark models outrank fully tested ones.
      const latest = (pattern: RegExp, fallback: string) => snapshot.benchmarks
        .filter((benchmark) => pattern.test(benchmark.id))
        .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0]?.id ?? fallback;
      const terminal = latest(/^aa-terminalbench-v[\d.]+(?:-\d+)*$/, "aa-terminalbench-v4-0");
      const frontierExtended = latest(/^frontiercode-[\d.]+-extended$/, "frontiercode-1.1-extended");
      const frontierMain = latest(/^frontiercode-[\d.]+-main$/, "frontiercode-1.1-main");
      const vibe = latest(/^vals-vibe-code-v[\d-]+$/, "vals-vibe-code-v1-1");
      const ml = latest(/^weirdml-v\d+$/, "weirdml-v3");
      return [
        { ...fixedMix("software-engineering", "Software engineering", "Current terminal tasks, maintainer-reviewed code changes, and web-app building. Every ranked effort has a measured Terminal-Bench result.", {
          [terminal]: 50, [frontierExtended]: 25, [vibe]: 25,
        }), required: [terminal] },
        { ...fixedMix("coding-breadth", "Coding breadth", "Current terminal tasks, maintainer-reviewed code changes, and machine-learning pipelines. Every ranked effort has a measured Terminal-Bench result.", {
          [terminal]: 50, [frontierMain]: 25, [ml]: 25,
        }), required: [terminal] },
      ];
    },
  },
  {
    id: "knowledge",
    label: "Knowledge",
    mixes: () => [
      fixedMix("broad-knowledge", "Broad knowledge", "Mixes general and multilingual knowledge with graduate science and factual accuracy.", {
        "aa-mmlu-pro": 30, "aa-gpqa-diamond": 30, "aa-omniscience-accuracy": 25, "aa-global-mmlu-lite": 15,
      }),
      fixedMix("facts-and-search", "Facts and search", "Balances factual accuracy, resistance to hallucination, graduate science, and search-assisted answers.", {
        "aa-omniscience-accuracy": 35, "aa-omniscience-non-hallucination": 25, "aa-gpqa-diamond": 25, "arena-search": 15,
      }),
    ],
  },
];

const EFFORT_ORDER: Record<Effort, number> = {
  none: 0, minimal: 1, low: 2, medium: 3, high: 4, xhigh: 5, max: 6, default: 7,
};

function compareVariants(a: ModelFinderVariant, b: ModelFinderVariant) {
  return b.score - a.score
    || a.costUsd - b.costUsd
    || EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort]
    || a.id.localeCompare(b.id)
    || a.modelId.localeCompare(b.modelId);
}

/** Keep the top-scoring measured-cost effort for each model under the task budget. */
export function affordableModels(variants: ModelFinderVariant[], budgetUsd: number | null): ModelFinderVariant[] {
  if (budgetUsd !== null && !Number.isFinite(budgetUsd)) return [];
  const eligible = variants.filter((variant) => Number.isFinite(variant.costUsd)
    && variant.costUsd >= 0
    && (budgetUsd === null || variant.costUsd <= budgetUsd));
  eligible.sort(compareVariants);
  const seen = new Set<string>();
  return eligible.filter((variant) => {
    if (seen.has(variant.modelId)) return false;
    seen.add(variant.modelId);
    return true;
  });
}

const COST_NOTE = "Task costs vary by workload. Uses measured costs for this mix when available, otherwise Artificial Analysis Intelligence Index task costs.";

/** Build current-snapshot mixes using only directly measured benchmark values and measured task costs. */
export function buildModelFinder(snapshot: Snapshot): ModelFinderData {
  const benchmarkById = new Map(snapshot.benchmarks.map((benchmark) => [benchmark.id, benchmark]));
  const labs = new Map(snapshot.labs.map((lab) => [lab.id, lab]));
  const groups = GROUPS.map((group): ModelFinderGroup => ({
    id: group.id,
    label: group.label,
    mixes: group.mixes(snapshot).map((definition): ModelFinderMix => {
      const weights = Object.fromEntries(Object.entries(definition.weights).filter(([id, weight]) => benchmarkById.has(id) && weight > 0));
      const config: IndexConfig = {
        id: `model-finder-${group.id}-${definition.id}`,
        name: definition.name,
        weights,
        required: definition.required ?? [],
        cutoff: 5,
        strictness: 50,
        estimateMissing: false,
        variants: "all",
        effortMatching: "strict",
        releasedAfter: "",
      };
      const result = computeIndex(snapshot, config);
      const variants = result.ranked
        .filter((row) => row.values.length > 0 && row.values.every((value) => !value.estimated)
          && row.costUsd != null && Number.isFinite(row.costUsd) && row.costUsd >= 0)
        .map((row): ModelFinderVariant => ({
          id: row.variant.id,
          modelId: row.model.id,
          name: row.model.name,
          effort: row.variant.effort,
          score: row.score,
          measuredBenchmarks: row.values.map((value) => value.benchmarkId),
          measuredShare: row.measuredShare,
          costUsd: row.costUsd!,
          costSource: row.costSource,
          color: labs.get(row.model.labId)?.color ?? "currentColor",
          labName: labs.get(row.model.labId)?.name ?? row.model.labId,
          labId: row.model.labId,
        }))
        .sort(compareVariants);
      const benchmarks = result.benchmarks.map(({ benchmark, share }): ModelFinderBenchmark => ({
        id: benchmark.id,
        name: benchmark.shortName || benchmark.name,
        url: benchmark.url,
        weight: share,
        share,
      }));
      const builder = new URLSearchParams({ i: encodeIndex(config) });
      return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        benchmarks,
        variants,
        builderUrl: `/builder?${prettyQuery(builder)}`,
      };
    }),
  }));
  return { date: snapshot.date, costNote: COST_NOTE, groups };
}

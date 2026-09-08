import type { Benchmark, Effort, Lab, Model, Observation, Snapshot, Variant } from "./types";
import dataset from "../../data/real-index-handoff-2026-09-08/dataset.json";
import formulas from "../../data/real-index-handoff-2026-09-08/formulas.json";
import resolved from "../../data/real-index-handoff-2026-09-08/resolved-benchmarks.json";

const ns = (id: string) => `real-index:${id}`;
const efforts = new Set<Effort>(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
type Metric = (typeof formulas.metrics)[number];

// Reviewed exact release identities only. Names that match but carry different release dates stay isolated.
const RELEASE_CROSSWALK: Record<string, string> = {
  "claude-fable-5-1-max": "claude-fable-5.1",
  "claude-opus-5-max": "claude-opus-5",
  "gpt-6-astra-max": "gpt-6-astra",
  "gpt-5-6-sol-max": "gpt-5.6-sol",
  "gpt-5-6-terra": "gpt-5.6-terra",
  "gpt-5-6-luna-max": "gpt-5.6-luna",
  "gemini-3-8-flash-high": "gemini-3.8-flash",
  "glm-5-3-max": "glm-5.3",
  "grok-4-6-high": "grok-4.6",
  "muse-spark-1-3-xhigh": "muse-spark-1.3",
};
const BENCHMARK_CROSSWALK: Record<string, string> = {
  "deepswe-1-1": "deepswe-1.1",
  "terminal-bench-v4": "terminalbench-4",
  "arc-agi-3": "arc-agi-3",
  "hle": "aa-humanitys-last-exam",
  "aa-omniscience": "aa-omniscience",
};

function normalize(value: number, metric: Metric): number {
  const n = metric.normalization;
  if (!n) throw new Error(`Real Index raw metric ${metric.id} has no normalization`);
  const transform = "scale" in n && n.scale === "log" ? Math.log : (x: number) => x;
  const lo = transform(n.lowerAnchor);
  const hi = transform(n.upperAnchor);
  const raw = (transform(value) - lo) / (hi - lo) * 100;
  const directed = metric.direction === "lower" ? 100 - raw : raw;
  return "clamp" in n && n.clamp ? Math.min(100, Math.max(0, directed)) : directed;
}

function category(metric: Metric): Benchmark["category"] {
  if (metric.family === "cost") return "cost";
  if (metric.family === "speed" || metric.family === "latency") return "speed";
  if (metric.family === "knowledge") return "knowledge";
  if (metric.id.includes("swe") || metric.id.includes("code") || metric.id.includes("terminal")) return "coding";
  return "other";
}

/** Recorded Real Index evidence only. Exported estimates and composites remain audit artifacts. */
export function realIndexSupplement(): Pick<Snapshot, "labs" | "models" | "variants" | "benchmarks" | "observations" | "estimates" | "sources"> {
  const rawMetrics = formulas.metrics.filter((m) => m.kind === "raw");
  const rawIds = new Set(rawMetrics.map((m) => m.id));
  const calibrations = new Map(formulas.calibrations.map((c) => [`${c.targetMetricId}:${c.sourceMetricId}`, c]));
  const routes = new Map(formulas.catalog.fallbackRoutes.map((r) => [r.metricId, r.fallbackMetricIds]));
  const organizations = [...new Set(dataset.modelCatalog.map((m) => m.organization))];
  const labs: Lab[] = organizations.map((name) => ({ id: ns(name), name, color: "#777777" }));
  const models: Model[] = dataset.modelCatalog.map((m) => ({
    id: ns(m.id), name: m.name, labId: ns(m.organization), releaseDate: m.releaseDate,
    kind: "llm", reasoning: m.isReasoningModel, aliases: [],
  }));
  const variants: Variant[] = dataset.models.map((m) => ({
    id: ns(m.id), modelId: ns(m.reasoningConfiguration.releaseId),
    effort: efforts.has(m.reasoningConfiguration.effort as Effort) ? m.reasoningConfiguration.effort as Effort : "default",
    configuration: JSON.stringify(m.reasoningConfiguration),
  }));
  const benchmarks: Benchmark[] = rawMetrics.map((m) => ({
    id: ns(m.id), name: `${m.name} (Real Index points)`, shortName: m.shortName,
    sourceId: "real-index", url: m.source?.primarySourceUrl ?? "", description: m.source?.description ?? m.name,
    unit: "score", normalization: { kind: "linear", min: 0, max: 100 }, higherIsBetter: true,
    category: category(m), proxy: m.id === "blended-token-price", defaultWeight: 0, eligibleForDefault: false,
    estimationRoutes: (routes.get(m.id) ?? []).flatMap((sourceId) => {
      const c = calibrations.get(`${m.id}:${sourceId}`);
      if (!c || !rawIds.has(sourceId)) return [];
      const factor = c.scale.targetAnchor / c.scale.sourceAnchor;
      return [{ sourceId: ns(sourceId), factor, method: c.method === "manual" ? "manual" as const : "paired-average" as const, pairedCount: c.pairedCount, evidenceId: c.id }];
    }),
  }));
  const metricMap = new Map(rawMetrics.map((m) => [m.id, m]));
  const observations: Observation[] = dataset.bestObservations.flatMap((o) => {
    const metric = metricMap.get(o.metricId);
    if (!metric) return [];
    const primary: Observation = {
      benchmarkId: ns(o.metricId), variantId: ns(o.modelId), value: normalize(o.value, metric),
      observedAt: o.observationDate, sourceUrl: o.sourceUrl, harness: o.scaffoldOrHarness, note: o.notes,
      details: { realIndex: { ...o, rawValue: o.value, evidenceKind: "recorded-observation" } },
    };
    const sourceConfig = dataset.models.find((m) => m.id === o.modelId);
    const mappedModel = sourceConfig && RELEASE_CROSSWALK[sourceConfig.reasoningConfiguration.releaseId];
    const mappedBenchmark = BENCHMARK_CROSSWALK[o.metricId];
    if (!mappedModel || !mappedBenchmark) return [primary];
    const effort = efforts.has(sourceConfig.reasoningConfiguration.effort as Effort) ? sourceConfig.reasoningConfiguration.effort : "default";
    return [primary, { ...primary, benchmarkId: mappedBenchmark, variantId: `${mappedModel}@${effort}`, value: o.value, details: { realIndex: { ...o, rawValue: o.value, evidenceKind: "recorded-observation", crosswalk: "source-release-and-effort", releaseDateDiscrepancy: true } } }];
  });
  const estimates: NonNullable<Snapshot["estimates"]> = resolved.filter((r) => r.state === "estimated").map((r) => ({
    benchmarkId: ns(r.metricId), variantId: ns(r.modelId), value: r.normalizedValue,
    estimateKind: r.estimateKind as "scaled" | "cross-effort",
    sourceBenchmarkId: r.sourceMetric?.id ? ns(r.sourceMetric.id) : undefined,
    sourceVariantId: r.sourceObservation?.modelId ? ns(r.sourceObservation.modelId) : undefined,
    sourceUrl: r.sourceObservation?.sourceUrl,
    evidence: [r.explanation],
  }));
  return { labs, models, variants, benchmarks, observations, estimates, sources: [{
    sourceId: "real-index", status: "ok", fetchedAt: "2026-09-08T18:33:45.750Z",
    rowCount: dataset.bestObservations.length, unknownLabels: [], rawPath: "data/real-index-handoff-2026-09-08/dataset.json",
  }] };
}

export function appendRealIndex(snapshot: Snapshot): Snapshot {
  if (snapshot.date < "2026-09-08" || snapshot.sources.some((s) => s.sourceId === "real-index")) return snapshot;
  const supplement = realIndexSupplement();
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const existingNames = new Set(snapshot.models.map((m) => key(m.name)));
  const mappedReleaseIds = new Set(Object.keys(RELEASE_CROSSWALK).map(ns));
  const addedModels = supplement.models.filter((m) => !mappedReleaseIds.has(m.id) && !existingNames.has(key(m.name)));
  const addedModelIds = new Set(addedModels.map((m) => m.id));
  const existingVariantIds = new Set(snapshot.variants.map((v) => v.id));
  const variantCrosswalk = new Map<string, string>();
  const plainVariantCrosswalk = new Map<string, string>();
  for (const v of supplement.variants) {
    const releaseId = v.modelId.slice("real-index:".length);
    const mapped = RELEASE_CROSSWALK[releaseId];
    const plain = mapped ? `${mapped}@${v.effort}` : undefined;
    const matches = mapped ? snapshot.variants.filter((candidate) => candidate.modelId === mapped && candidate.effort === v.effort) : [];
    const canonical = plain && existingVariantIds.has(plain) ? plain : matches.length === 1 ? matches[0].id : undefined;
    if (canonical) {
      variantCrosswalk.set(v.id, canonical);
      if (plain) plainVariantCrosswalk.set(plain, canonical);
    }
  }
  const addedVariants = supplement.variants.filter((v) => addedModelIds.has(v.modelId));
  const addedVariantIds = new Set(addedVariants.map((v) => v.id));
  const observations = supplement.observations.flatMap((o) => {
    if (!o.variantId.startsWith("real-index:")) return [{ ...o, variantId: plainVariantCrosswalk.get(o.variantId) ?? o.variantId }];
    const canonical = variantCrosswalk.get(o.variantId);
    if (canonical) return [{ ...o, variantId: canonical }];
    return addedVariantIds.has(o.variantId) ? [o] : [];
  });
  const estimates = supplement.estimates?.flatMap((o) => {
    const canonical = variantCrosswalk.get(o.variantId);
    const variantId = canonical ?? o.variantId;
    if (!canonical && !addedVariantIds.has(variantId)) return [];
    const sourceVariantId = o.sourceVariantId ? variantCrosswalk.get(o.sourceVariantId) ?? o.sourceVariantId : undefined;
    return [{ ...o, variantId, sourceVariantId }];
  });
  return {
    ...snapshot,
    labs: [...snapshot.labs, ...supplement.labs], models: [...snapshot.models, ...addedModels],
    variants: [...snapshot.variants, ...addedVariants], benchmarks: [...snapshot.benchmarks, ...supplement.benchmarks],
    observations: [...snapshot.observations, ...observations], estimates: [...(snapshot.estimates ?? []), ...(estimates ?? [])], sources: [...snapshot.sources, ...supplement.sources],
  };
}

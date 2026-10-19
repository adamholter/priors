import { normalizeLabel } from "./normalize";
import { isBaselineVariant } from "./variant-identity";
import { withFamilies } from "./benchmark-families";
import type { Snapshot, Variant } from "./types";

/** Repair the source-scoped alias regression in both old snapshots and new scrape output.
 * All observations survive, with their source IDs, URLs, harnesses and measured costs.
 * Unknown configurations and conflicting same-benchmark measurements remain separate.
 */
export function canonicalizeSnapshot(snapshot: Snapshot): Snapshot {
  // Older AA snapshots may have matched the base model inside a derived release's
  // description. Repair those identities before merging ordinary source aliases.
  const repairs = new Map<string, string>();
  const models = [...snapshot.models ?? []];
  const inputVariants = snapshot.variants.map(v => {
    const source = v.sourceModel;
    if (!source?.url.startsWith("https://artificialanalysis.ai/") || !/\bbased\s+on\b/i.test(source.name)) return v;
    const n = normalizeLabel(source.name, v.effort);
    const modelId = n.ok ? n.modelId : `aa-${source.slug}`;
    if (modelId === v.modelId) return v;
    const base = `${modelId}@${v.effort}`;
    const configuration = isBaselineVariant(modelId, v.effort, source.slug, source.name) ? undefined : v.configuration;
    const id = `${base}${configuration ? `~${configuration}` : ""}`;
    repairs.set(v.id, id);
    if (!models.some(m => m.id === modelId)) models.push({ id: modelId,
      name: n.ok ? n.modelName : source.name.replace(/\s*\([^)]*\bbased\s+on\b[^)]*\)/gi, ""),
      labId: n.ok ? n.labId : "other", kind: "llm", reasoning: source.metadata?.isReasoning === true,
      aliases: [source.name.toLowerCase()],
      ...(typeof source.metadata?.releaseDate === "string" ? { releaseDate: source.metadata.releaseDate } : {}),
    });
    return { ...v, id, modelId, configuration, aliases: [...new Set([...v.aliases ?? [], v.id])] };
  });
  const repaired = (id: string) => repairs.get(id) ?? id;
  snapshot = { ...snapshot, models, variants: inputVariants,
    observations: snapshot.observations.map(o => ({ ...o, variantId: repaired(o.variantId) })),
    series: snapshot.series.map(s => ({ ...s, variantId: repaired(s.variantId) })),
    ...(snapshot.estimates ? { estimates: snapshot.estimates.map(e => ({ ...e, variantId: repaired(e.variantId), ...(e.sourceVariantId ? { sourceVariantId: repaired(e.sourceVariantId) } : {}) })) } : {}),
  };
  const proposed = new Map(snapshot.variants.map(v => [v.id,
    v.sourceModel && isBaselineVariant(v.modelId, v.effort, v.sourceModel.slug, v.sourceModel.name)
      ? `${v.modelId}@${v.effort}` : v.id,
  ]));
  const measurements = new Map<string, { variantId: string; signature: string }>();
  const ambiguous = new Set<string>();
  for (const o of snapshot.observations) {
    const target = proposed.get(o.variantId) ?? o.variantId;
    const key = JSON.stringify([o.benchmarkId, target, o.harness ?? ""]);
    const signature = JSON.stringify([o.value, o.sourceModelId, o.costUsd, o.durationSec, o.outputTokens, o.steps]);
    const previous = measurements.get(key);
    if (previous && previous.variantId !== o.variantId && previous.signature !== signature) ambiguous.add(target);
    else measurements.set(key, { variantId: o.variantId, signature });
  }
  const ids = new Map([...proposed].map(([old, target]) => [old, ambiguous.has(target) ? old : target]));
  const groups = new Map<string, Variant[]>();
  for (const v of snapshot.variants) {
    const id = ids.get(v.id)!;
    const group = groups.get(id) ?? [];
    group.push(v); groups.set(id, group);
  }
  const variants = [...groups].map(([id, group]): Variant => {
    const sources = [...new Map(group.flatMap(v => [v.sourceModel, ...v.sourceModels ?? []])
      .filter((s): s is NonNullable<Variant["sourceModel"]> => !!s)
      .map(s => [JSON.stringify([s.id, s.url]), s])).values()]
      .sort((a, b) => Number(b.url.startsWith("https://artificialanalysis.ai/")) - Number(a.url.startsWith("https://artificialanalysis.ai/")) || a.id.localeCompare(b.id) || a.url.localeCompare(b.url));
    // Future full scrapes already emit canonical AA IDs. Reconstruct the previous
    // UUID-qualified alias from retained provenance so older saved links keep working.
    const legacyAaIds = id.includes("~") ? [] : sources.filter(s => s.url.startsWith("https://artificialanalysis.ai/"))
      .map(s => `${id}~aa-${s.slug}-${s.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 8)}`);
    const aliases = [...new Set([...legacyAaIds, ...group.flatMap(v => [...v.aliases ?? [], ...(v.id !== id ? [v.id] : [])])])].filter(a => a !== id).sort();
    const representative = group.find(v => v.id === id) ?? group[0];
    return { ...representative, id,
      configuration: id.includes("~") ? representative.configuration : undefined,
      ...(sources.length ? { sourceModel: sources[0], sourceModels: sources.length > 1 ? sources : undefined } : {}),
      ...(aliases.length ? { aliases } : {}),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const remap = (id: string) => ids.get(id) ?? id;
  return { ...snapshot, variants, ...(snapshot.benchmarks ? { benchmarks: withFamilies(snapshot.benchmarks) } : {}),
    observations: snapshot.observations.map(o => ({ ...o, variantId: remap(o.variantId) })),
    series: snapshot.series.map(s => ({ ...s, variantId: remap(s.variantId) })),
    ...(snapshot.estimates ? { estimates: snapshot.estimates.map(e => ({ ...e, variantId: remap(e.variantId), ...(e.sourceVariantId ? { sourceVariantId: remap(e.sourceVariantId) } : {}) })) } : {}),
  };
}

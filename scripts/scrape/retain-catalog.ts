import type { Model, Variant } from "../../src/data/types";

/** A partial scrape adds measurements, but must retain catalog metadata from skipped sources. */
export function retainCatalog(previous: { models: Model[]; variants: Variant[] }, current: { models: Model[]; variants: Variant[] }) {
  const models = new Map(previous.models.map(m => [m.id, m]));
  for (const m of current.models) {
    const old = models.get(m.id);
    models.set(m.id, old ? {
      ...old, ...m,
      releaseDate: m.releaseDate ?? old.releaseDate,
      priceTier: m.priceTier ?? old.priceTier,
      aliases: [...new Set([...old.aliases, ...m.aliases])],
      reasoning: m.reasoning || old.reasoning,
    } : m);
  }
  const variants = new Map(previous.variants.map(v => [v.id, v]));
  for (const v of current.variants) {
    const old = variants.get(v.id);
    if (!old) { variants.set(v.id, v); continue; }
    const lineage = [old.sourceModel, ...(old.sourceModels ?? []), v.sourceModel, ...(v.sourceModels ?? [])]
      .filter((s): s is NonNullable<Variant["sourceModel"]> => !!s);
    variants.set(v.id, {
      ...old, ...v,
      sourceModel: v.sourceModel ?? old.sourceModel,
      configuration: v.configuration ?? old.configuration,
      aliases: old.aliases || v.aliases ? [...new Set([...(old.aliases ?? []), ...(v.aliases ?? [])])] : undefined,
      sourceModels: lineage.length ? [...new Map(lineage.map(s => [`${s.id}|${s.slug}|${s.url}`, s])).values()] : undefined,
    });
  }
  return { models: [...models.values()], variants: [...variants.values()] };
}

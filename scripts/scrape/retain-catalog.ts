import type { Model, Variant } from "../../src/data/types";

/**
 * Until 2026-11-04 Hy4 preview was stored as `hy-4`. Reads an older snapshot under the id it has now, so final Hy4 inherits
 * none of its date, scores or open weights. Only a snapshot from before the split matches, so this stops doing anything by itself.
 */
export function splitHy4Preview<S extends { models: Model[] }>(snapshot: S): S {
  const old = snapshot.models.find((m) => m.id === "hy-4");
  if (!old?.releaseDate || old.releaseDate >= "2026-11-04") return snapshot;
  const moved = JSON.parse(JSON.stringify(snapshot).replace(/"hy-4(@[^"]*)?"/g, '"hy-4-preview$1"')) as S;
  const preview = moved.models.find((m) => m.id === "hy-4-preview")!;
  preview.name = "Hy4 preview";
  preview.aliases = preview.aliases.filter((a) => a.includes("preview"));
  return moved;
}

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

import { normalizeLabel } from "../../src/data/normalize";
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
export function retainCatalog(previous: { models: Model[]; variants: Variant[] }, current: { models: Model[]; variants: Variant[]; observations?: { variantId: string }[] }) {
  const models = new Map(previous.models.map(m => [m.id, m]));
  // A label that now resolves to another model has left this one, so an old merge cannot come back through the catalog ("swe-2 flash" on `swe-2`).
  const stillOurs = (alias: string, id: string) => { const n = normalizeLabel(alias); return !n.ok || n.modelId === id || !current.models.some((m) => m.id === n.modelId); };
  for (const m of current.models) {
    const old = models.get(m.id);
    models.set(m.id, old ? {
      ...old, ...m,
      releaseDate: m.releaseDate ?? old.releaseDate,
      priceTier: m.priceTier ?? old.priceTier,
      aliases: [...new Set([...old.aliases.filter((a) => stillOurs(a, m.id)), ...m.aliases])],
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
  // A bare variant carries nothing but its id, so one with no rows left is only the trace of a row that moved (`swe-2@low`).
  const observed = current.observations && new Set(current.observations.map((o) => o.variantId)), fresh = new Set(current.variants.map((v) => v.id));
  // A label that now resolves to another current model has moved there (`inkling 2 small` left `inkling`), so a trace
  // that carries nothing but moved labels and no rows goes too, or the old model keeps a stale configuration or a twin.
  const movedTo = (label: string | undefined, id: string) => { if (!label) return false; const n = normalizeLabel(label); return n.ok && n.modelId !== id && current.models.some((m) => m.id === n.modelId); };
  const live = new Set(current.models.map((m) => m.id));
  const gone = new Set([...models.values()].filter((m) => observed && !live.has(m.id) && m.aliases.length > 0 && m.aliases.every((a) => movedTo(a, m.id))
    && ![...variants.values()].some((v) => v.modelId === m.id && observed.has(v.id))).map((m) => m.id));
  const kept = [...variants.values()].filter((v) => !gone.has(v.modelId) && (!observed || fresh.has(v.id) || observed.has(v.id)
    || (v.sourceModel || v.sourceModels?.length || v.configuration) && !(v.sourceModel && movedTo(v.sourceModel.name, v.modelId) && movedTo(v.sourceModel.slug, v.modelId))));
  return { models: [...models.values()].filter((m) => !gone.has(m.id)), variants: kept };
}

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
    // A label that moved away may have brought the old date with it (o1-preview's Sept 2024 on o1), so then the date is left to this run's sources.
    const lostLabel = !!old && old.aliases.some((a) => !stillOurs(a, m.id));
    models.set(m.id, old ? {
      ...old, ...m,
      releaseDate: m.releaseDate ?? (lostLabel ? undefined : old.releaseDate),
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

/**
 * A carried row keeps the variant it was stored under. When that variant's source model now resolves elsewhere (AA's
 * o1-preview record, once a configuration of o1), the row follows it to the current variant for the same source record.
 */
export function remapMovedRows<O extends { variantId: string }>(previous: Variant[], current: Variant[], observations: O[]): O[] {
  const live = new Set(current.map((v) => v.id)), bySource = new Map<string, Variant>();
  for (const v of current) if (v.sourceModel?.id) bySource.set(`${v.sourceModel.id}|${v.effort}`, v);
  const prev = new Map(previous.map((v) => [v.id, v]));
  return observations.map((o) => {
    if (live.has(o.variantId)) return o;
    const old = prev.get(o.variantId), next = old?.sourceModel?.id ? bySource.get(`${old.sourceModel.id}|${old.effort}`) : undefined;
    return next && next.modelId !== old!.modelId ? { ...o, variantId: next.id } : o;
  });
}

/**
 * A carried row keeps the variant it was filed under when it was fresh. If its own source id now resolves to another model
 * (Vals' `tencent/hy4` once sat on Hy4 preview), it moves to that model at the same effort, when that variant exists.
 */
export function remapCarriedBySource<O extends { variantId: string; sourceModelId?: string; note?: string }>(variants: Variant[], observations: O[]): O[] {
  const byId = new Map(variants.map((v) => [v.id, v]));
  return observations.map((o) => {
    if (!o.sourceModelId || !o.note?.includes("carried from")) return o;
    const v = byId.get(o.variantId), n = normalizeLabel(o.sourceModelId);
    if (!v || !n.ok || n.modelId === v.modelId) return o;
    const target = byId.get(`${n.modelId}@${v.effort}`);
    return target ? { ...o, variantId: target.id } : o;
  });
}

/** Keeps only the first "carried from" in a note, which is when the scores were last fresh. */
export function firstCarry(note: string | undefined): string | undefined {
  if (!note) return note;
  let seen = false;
  return note.split("; ").filter((part) => !/^carried from \d{4}-\d{2}-\d{2}$/.test(part) || (!seen && (seen = true))).join("; ");
}

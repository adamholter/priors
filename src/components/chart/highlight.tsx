"use client";
import { createContext, useContext } from "react";
import { featuredPoints, type ScatterPoint } from "./scatter-option";
import type { IndexConfig } from "@/engine";
import { matchesVariantId } from "@/data/variant-identity";
import { tierModelName } from "@/data/speed-tiers";

/**
 * Highlighted models for every chart on a page. Items are model ids (feature the model's best effort)
 * or variant ids (feature exactly that effort). Stored on the index (`hl=` in URLs), so links, saved
 * pages and exported images keep them.
 */
/** A model the star picker can list. `lab` (display name) and `labId` (logo) let it group by lab; `open` is open weights. */
export type HighlightModel = { id: string; name: string; color?: string; open?: boolean; lab?: string; labId?: string };
export type HighlightState = { items: string[]; set: (items: string[]) => void; models: HighlightModel[]; /** How many leading `models` are ranked (the star picker lists those, plus anything starred). */ ranked?: number; indexId?: string; /** `hv` for a link: this index's unsaved display settings (see `viewParam`). */ view?: string; linkIndices?: IndexConfig[]; /** The index's models were picked by hand (excludeModels or onlyModels set): Pareto charts then show exactly those, with no default trimming. */ curated?: boolean };
export const HighlightContext = createContext<HighlightState | null>(null);
export const useHighlight = () => useContext(HighlightContext);

export const modelOf = (item: string) => item.split("@")[0];
export const isHighlighted = (items: string[], modelId: string) => items.some((it) => modelOf(it) === modelId);
/** Star / menu checkbox: a model is on if any of its efforts is; turning it off clears them all. */
export const toggleModel = (items: string[], modelId: string) => (isHighlighted(items, modelId) ? items.filter((it) => modelOf(it) !== modelId) : [...items, modelId]);
/** Clicking a mark: a featured effort turns off; any other effort is added (several per model allowed). */
export function togglePoint(items: string[], pts: ScatterPoint[], p: ScatterPoint) {
  const id = p.r.variant.id;
  if (items.some(it => matchesVariantId(p.r.variant, it))) return items.filter(it => !matchesVariantId(p.r.variant, it));
  const viaModel = items.includes(p.r.model.id) && featuredPoints(pts, [p.r.model.id])[0]?.r.variant.id === id;
  return viaModel ? items.filter((it) => it !== p.r.model.id) : [...items, id];
}
export function itemLabel(item: string, models: HighlightState["models"]) {
  const [m, v] = item.split("@"), name = tierModelName(m, (id) => models.find((x) => x.id === id)?.name), effort = v?.split("~")[0];
  return effort && effort !== "default" ? `${name} ${effort}` : name;
}

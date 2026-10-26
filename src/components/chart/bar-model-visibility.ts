"use client";
import { useCallback, useMemo, useState } from "react";
import type { RankedVariant } from "@/engine";
import { defaultBarModels, filterBarModels } from "./bars-option";
import type { ScatterPoint } from "./scatter-option";

export type BarModelOption = { id: string; name: string; color?: string };
export type BarModelPicker = {
  models: BarModelOption[];
  excluded: Set<string>;
  onToggleModel: (id: string) => void;
  onShowAllModels: () => void;
  onHideAllModels: () => void;
};

/** Per-chart model selection for vertical metric bars. Scatter and index visibility stay independent. */
export function useBarModelVisibility({ metricPoints, points, better, ranked, modelOptions = [] }: {
  metricPoints: ScatterPoint[];
  points: ScatterPoint[];
  better: "lower" | "higher";
  ranked: RankedVariant[];
  modelOptions?: BarModelOption[];
}): { points: ScatterPoint[]; picker: BarModelPicker } {
  const defaults = useMemo(() => defaultBarModels(metricPoints, better, ranked), [metricPoints, better, ranked]);
  const models = useMemo(() => {
    const best = new Map<string, RankedVariant>();
    for (const p of metricPoints) {
      const current = best.get(p.r.model.id);
      if (!current || p.r.score > current.score) best.set(p.r.model.id, p.r);
    }
    const known = new Map(modelOptions.map((m) => [m.id, m]));
    return [...best.values()].sort((a, b) => b.score - a.score || a.rank - b.rank || a.model.id.localeCompare(b.model.id))
      .map((r) => known.get(r.model.id) ?? { id: r.model.id, name: r.model.name });
  }, [metricPoints, modelOptions]);
  const [overrides, setOverrides] = useState<{ shown: string[]; hidden: string[] }>({ shown: [], hidden: [] });
  const visibleModels = useMemo(() => new Set([...defaults, ...overrides.shown].filter((id) => !overrides.hidden.includes(id))), [defaults, overrides]);
  const excluded = useMemo(() => new Set(models.filter((model) => !visibleModels.has(model.id)).map((model) => model.id)), [models, visibleModels]);
  const onToggleModel = useCallback((id: string) => setOverrides((current) => visibleModels.has(id)
    ? { shown: current.shown.filter((modelId) => modelId !== id), hidden: [...new Set([...current.hidden, id])] }
    : { shown: [...new Set([...current.shown, id])], hidden: current.hidden.filter((modelId) => modelId !== id) }), [visibleModels]);
  const onShowAllModels = useCallback(() => setOverrides({ shown: models.filter((model) => !defaults.has(model.id)).map((model) => model.id), hidden: [] }), [models, defaults]);
  const onHideAllModels = useCallback(() => setOverrides({ shown: [], hidden: models.map((model) => model.id) }), [models]);
  return {
    points: useMemo(() => filterBarModels(points, visibleModels), [points, visibleModels]),
    picker: { models, excluded, onToggleModel, onShowAllModels, onHideAllModels },
  };
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Snapshot } from "@/data/types";
import type { RankingOption } from "@/lib/model-ranking-param";
import type { RankSummary } from "@/lib/model-rank-text";

/**
 * Where the model stands in each ranking the picker lists. The standard ones (and the model's own) arrive with the page (`server`);
 * a visitor's own rankings are worked out here from the calculation dataset, one at a time so the page stays responsive, once `enabled`.
 * Only the engine-free summaries ship with the page; `summarize` loads on demand.
 */
export function useRankSummaries(options: RankingOption[], server: Record<string, RankSummary>, snapshot: Snapshot | null, modelId: string, enabled: boolean): Record<string, RankSummary | undefined> {
  const [found, setFound] = useState<Record<string, RankSummary>>({});
  const done = useRef(new Set<string>());
  const wanted = useMemo(() => options.flatMap((o) => (o.config && !server[o.key] ? [{ o, id: `${modelId}|${o.key}|${JSON.stringify(o.config)}` }] : [])), [options, server, modelId]);
  useEffect(() => {
    if (!enabled || !snapshot) return;
    const todo = wanted.filter((w) => !done.current.has(w.id));
    if (!todo.length) return;
    let live = true, i = 0, timer: ReturnType<typeof setTimeout> | undefined;
    void Promise.all([import("@/lib/model-ranks"), import("@/lib/import-merge")]).then(([{ summarize }, { mergeImports }]) => {
      const step = () => {
        if (!live || i >= todo.length) return;
        const { o, id } = todo[i++];
        const summary = summarize(o.imports?.length ? mergeImports(snapshot, o.imports).snapshot : snapshot, o.config!, modelId);
        done.current.add(id);
        setFound((f) => ({ ...f, [id]: summary }));
        timer = setTimeout(step, 24);
      };
      step();
    });
    return () => { live = false; clearTimeout(timer); };
  }, [enabled, snapshot, wanted, modelId]);
  return useMemo(() => {
    const idOf = new Map(wanted.map((w) => [w.o, w.id]));
    return Object.fromEntries(options.map((o) => [o.key, server[o.key] ?? found[idOf.get(o) ?? ""]]));
  }, [options, server, found, wanted]);
}

"use client";
import { useEffect, useMemo, useState } from "react";
import type { ModelView } from "@/lib/model-view";
import { findRanking, rankParam, rankingOptions } from "@/lib/model-ranking-param";
import { usePlanResetsOn, withResetsPref } from "@/lib/plan-resets-pref";
import { useSubscriptionPlansPref, withPlansPref } from "@/lib/subscription-plans-pref";
import type { IndexConfig } from "@/engine";
import { useMyRankings } from "../my-rankings";
import { useCoreSnapshot } from "../use-core-snapshot";
import { ModelPage } from "./ModelPage";

/**
 * A model page draws from what the server sent (`serverView`, a standard ranking at standard prices). The calculation
 * dataset and the engine download only when the visitor needs something else: a ranking of their own, another ranking
 * picked here, their pricing choices, or a benchmark's details.
 */
export function ModelLoader({ view: serverView, rankingKey, modelId, rank, summary }: { view: ModelView; rankingKey: string; modelId: string; rank?: string; summary?: string }) {
  const mine = useMyRankings();
  const options = useMemo(() => rankingOptions(mine.page, mine.builder), [mine.page, mine.builder]);
  // The ranking in the address (`?r=`), so a shared link opens in it; kept as the param, because a visitor's own rankings only load after mount.
  const [picked, setPicked] = useState<string | null>(rank ?? null);
  const pickedOption = findRanking(options, picked);
  const resetsOn = usePlanResetsOn(), plansPref = useSubscriptionPlansPref();
  const needsData = resetsOn || Object.keys(plansPref).length > 0 || (pickedOption ? pickedOption.key !== rankingKey : options.some((o) => o.config));
  const [info, setInfo] = useState<string | null>(null);
  const { snapshot, error, retry } = useCoreSnapshot(needsData || info !== null);
  const [lib, setLib] = useState<typeof import("@/lib/model-view") | null>(null);
  useEffect(() => { if (needsData && !lib) void import("@/lib/model-view").then(setLib); }, [needsData, lib]);
  const chosen = useMemo(() => {
    if (!needsData || !snapshot || !lib) return null;
    return lib.chosenView(snapshot, modelId, options, pickedOption, mine.ready, (c: IndexConfig) => withPlansPref(withResetsPref(c, resetsOn), plansPref));
  }, [needsData, snapshot, lib, modelId, options, pickedOption, mine.ready, resetsOn, plansPref]);
  const currentKey = pickedOption?.key ?? chosen?.key ?? rankingKey;
  const current = options.find((o) => o.key === currentKey) ?? options.find((o) => o.key === rankingKey)!;
  const onPick = (param: string) => { setPicked(param); const url = new URL(window.location.href); url.searchParams.set("r", param); window.history.replaceState(window.history.state, "", url); };
  return <ModelPage view={chosen?.view ?? serverView} othersUrl={`/api/models/${encodeURIComponent(modelId)}/field?r=${rankingKey.slice("preset:".length)}`} summary={summary} options={options} current={rankParam(current)} onPick={onPick} pending={needsData && !chosen && !error} error={needsData ? error : ""} retry={retry} infoSnapshot={chosen?.snapshot ?? snapshot} info={info} onInfo={setInfo} probe={mine.probe} />;
}

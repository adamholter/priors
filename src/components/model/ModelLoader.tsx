"use client";
import { useEffect, useMemo, useState } from "react";
import type { ModelAvailability } from "@/lib/model-availability";
import type { ModelView } from "@/lib/model-view";
import { findRanking, OWN_KEY, OWN_PARAM, rankParam, rankingOptions } from "@/lib/model-ranking-param";
import type { RankSummary } from "@/lib/model-rank-text";
import type { OwnRanking } from "@/lib/model-ranks";
import { usePlanResetsOn, withResetsPref } from "@/lib/plan-resets-pref";
import { useSubscriptionPlansPref, withPlansPref } from "@/lib/subscription-plans-pref";
import type { IndexConfig } from "@/engine";
import { useMyRankings } from "../my-rankings";
import { useCoreSnapshot } from "../use-core-snapshot";
import { ModelPage } from "./ModelPage";
import { useRankSummaries } from "./use-rank-summaries";

/** What the page's field and stability requests name: the standard ranking's key, or the model's own. */
const rankingQuery = (key: string) => (key === OWN_KEY ? OWN_PARAM : key.slice("preset:".length));

/**
 * A model page draws from what the server sent (`serverView`, a standard ranking at standard prices). The calculation
 * dataset and the engine download only when the visitor needs something else: a ranking of their own, another ranking
 * picked here, their pricing choices, or a benchmark's details. `ranks` is where the model stands in each ranking the server
 * can place it in, and `own` the ranking made from its own benchmarks when no standard ranking places it.
 */
export function ModelLoader({ view: serverView, availability, rankingKey, modelId, rank, summary, ranks: serverRanks, own }: { view: ModelView; availability?: ModelAvailability; rankingKey: string; modelId: string; rank?: string; summary?: string; ranks: Record<string, RankSummary>; own?: OwnRanking }) {
  const mine = useMyRankings();
  const options = useMemo(() => rankingOptions(mine.page, mine.builder, own?.config), [mine.page, mine.builder, own]);
  // The ranking in the address (`?r=`), so a shared link opens in it; kept as the param, because a visitor's own rankings only load after mount.
  const [picked, setPicked] = useState<string | null>(rank ?? null);
  const pickedOption = findRanking(options, picked);
  const resetsOn = usePlanResetsOn(), plansPref = useSubscriptionPlansPref();
  const needsData = resetsOn || Object.keys(plansPref).length > 0 || (pickedOption ? pickedOption.key !== rankingKey : options.some((o) => o.config && o.key !== OWN_KEY));
  const [info, setInfo] = useState<string | null>(null), [menu, setMenu] = useState(false);
  // The picker shows the model's place in the visitor's own rankings too, which the server cannot work out: opening it asks for the dataset.
  const wantsRanks = menu && options.some((o) => o.config && !serverRanks[o.key]);
  const { snapshot, error, retry } = useCoreSnapshot(needsData || info !== null || wantsRanks);
  const [lib, setLib] = useState<typeof import("@/lib/model-view") | null>(null);
  useEffect(() => { if (needsData && !lib) void import("@/lib/model-view").then(setLib); }, [needsData, lib]);
  const chosen = useMemo(() => {
    if (!needsData || !snapshot || !lib) return null;
    return lib.chosenView(snapshot, modelId, options, pickedOption, mine.ready, (c: IndexConfig) => withPlansPref(withResetsPref(c, resetsOn), plansPref));
  }, [needsData, snapshot, lib, modelId, options, pickedOption, mine.ready, resetsOn, plansPref]);
  // The ranking the page is drawn in: the picked one once its dataset has arrived, until then the one the server drew. The score, the
  // place, the note and the picker's row all read from it, so a pick that is still loading never shows the old place under the new name.
  const viewKey = chosen?.key ?? rankingKey;
  const current = options.find((o) => o.key === viewKey) ?? options.find((o) => o.key === rankingKey)!;
  const view = chosen?.view ?? serverView;
  const found = useRankSummaries(options, serverRanks, snapshot, modelId, menu);
  // The ranking on screen is read from its view, so the picker agrees with the score above it.
  const strict = (current.config?.strictness ?? 50) >= 100;
  const ranks = useMemo(() => ({ ...found, [current.key]: { benchmarks: view.weighted, allRequired: found[current.key]?.allRequired ?? strict, standing: view.mine.length ? { rank: view.place + 1, of: view.models, loose: view.loose } : null } }), [found, current.key, strict, view]);
  // Not drawn anywhere: it puts the figure in the network tab for anyone who wants it.
  useEffect(() => { if (!rankingKey.startsWith("preset:")) return; const t = setTimeout(() => { void fetch(`/api/rank-stability?r=${rankingQuery(rankingKey)}&model=${encodeURIComponent(modelId)}`).catch(() => {}); }, 2000); return () => clearTimeout(t); }, [rankingKey, modelId]);
  const onPick = (param: string) => { setPicked(param); const url = new URL(window.location.href); url.searchParams.set("r", param); window.history.replaceState(window.history.state, "", url); };
  return <ModelPage view={view} availability={availability} othersUrl={`/api/models/${encodeURIComponent(modelId)}/field?r=${rankingQuery(rankingKey)}`} summary={summary} options={options} current={rankParam(current)} onPick={onPick} ranks={ranks} own={own} onMenu={setMenu} pending={needsData && !chosen && !error} error={needsData || wantsRanks ? error : ""} retry={retry} infoSnapshot={chosen?.snapshot ?? snapshot} info={info} onInfo={setInfo} probe={mine.probe} />;
}

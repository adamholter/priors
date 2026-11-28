import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { ModelLoader } from "@/components/model/ModelLoader";
import { isPreviewBot, isSearchBot, PreviewPage } from "@/lib/link-preview";
import { defaultConfig, type IndexConfig } from "@/engine";
import { defaultPreset, modelView, presetConfig } from "@/lib/model-view";
import { OWN_KEY, OWN_PARAM } from "@/lib/model-ranking-param";
import { ownRanking, sizeOf, summarize } from "@/lib/model-ranks";
import type { RankSummary } from "@/lib/model-rank-text";
import { modelAvailability } from "@/lib/model-availability";
import { pageMeta } from "@/lib/site-meta";
import { modelDescription, modelStanding } from "@/lib/og-model";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const snap = await loadSnapshot();
  const m = snap?.models.find((x) => x.id === id);
  if (!m || !snap) return { title: "Page not found" };
  const s = modelStanding(snap, id);
  return pageMeta({
    title: `${m.name} · benchmarks`, description: s ? modelDescription(s) : `How ${m.name} scores on every benchmark Priors tracks, by reasoning effort.`, path: `/models/${id}`,
    image: { url: `/models/${id}/opengraph-image?d=${snap.date}`, width: 1200, height: 630, alt: `${m.name} on Priors: index score, rank and strengths across benchmarks` },
  });
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const { r } = await searchParams;
  const snapshot = await loadSnapshot();
  const m = snapshot?.models.find((x) => x.id === id);
  if (!snapshot || !m) notFound();
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    const s = modelStanding(snapshot, id);
    return <PreviewPage title={`${m.name} · benchmarks`} description={s ? modelDescription(s) : `How ${m.name} scores on every benchmark Priors tracks, by reasoning effort.`} href={`/models/${id}`} />;
  }
  // Everything on the page is in the response, worked out here. The visitor's browser needs the full dataset only for rankings of their own (`ModelLoader`).
  const costConfig = defaultConfig(snapshot), named = r === "aa" || r === "general";
  let key = named ? `preset:${r}` : defaultPreset(snapshot, id), config = presetConfig(snapshot, key);
  let view = modelView(snapshot, id, config, costConfig);
  // A model no standard ranking places is ranked on its own benchmarks, selected for it unless the link names a standard ranking.
  const own = r === OWN_PARAM || !view.mine.length ? ownRanking(snapshot, id) : null;
  if (own && !named) { key = OWN_KEY; config = own.config; view = modelView(snapshot, id, config, costConfig); }
  // A model nothing places has only its benchmark list to show, so it comes with the page instead of on request.
  if (!view.mine.length) view = modelView(snapshot, id, config, costConfig, { inlineOthers: true });
  // The picker lists where the model stands in each ranking on offer; the one on screen is read from its view.
  const here = view.mine.length ? { rank: view.place + 1, of: view.models, loose: view.loose } : null;
  const listed: [string, IndexConfig][] = [["preset:general", presetConfig(snapshot, "preset:general")], ["preset:aa", presetConfig(snapshot, "preset:aa")], ...(own ? [[OWN_KEY, own.config] as [string, IndexConfig]] : [])];
  const ranks = Object.fromEntries(listed.map(([k, c]): [string, RankSummary] => [k, k === key ? { ...sizeOf(c), standing: here } : summarize(snapshot, c, id)]));
  const standing = await isSearchBot() ? modelStanding(snapshot, id) : null;
  return <ModelLoader view={view} availability={modelAvailability(snapshot, id)} rankingKey={key} modelId={id} rank={typeof r === "string" ? r : undefined} summary={standing ? modelDescription(standing) : undefined} ranks={ranks} own={own ?? undefined} />;
}

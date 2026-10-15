import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { ModelPage } from "@/components/model/ModelPage";
import { isPreviewBot, PreviewPage } from "@/lib/link-preview";
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

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await loadSnapshot();
  const m = snapshot?.models.find((x) => x.id === id);
  if (!snapshot || !m) notFound();
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    const s = modelStanding(snapshot, id);
    return <PreviewPage title={`${m.name} · benchmarks`} description={s ? modelDescription(s) : `How ${m.name} scores on every benchmark Priors tracks, by reasoning effort.`} href={`/models/${id}`} />;
  }
  return <ModelPage snapshot={snapshot} modelId={id} />;
}

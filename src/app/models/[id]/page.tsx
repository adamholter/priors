import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { ModelPage } from "@/components/model/ModelPage";
import { isPreviewBot, PreviewPage } from "@/lib/link-preview";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const snap = await loadSnapshot();
  const m = snap?.models.find((x) => x.id === id);
  if (!m) return {};
  const title = `${m.name} · benchmarks`;
  return { title, description: `How ${m.name} scores on every benchmark Priors tracks, by reasoning effort.` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await loadSnapshot();
  const m = snapshot?.models.find((x) => x.id === id);
  if (!snapshot || !m) notFound();
  if (await isPreviewBot()) {
    // Link-preview crawlers cap response size — give them the tags plus a tiny body, not the app.
    return <PreviewPage title={`${m.name} · benchmarks`} description={`How ${m.name} scores on every benchmark Priors tracks, by reasoning effort.`} href={`/models/${id}`} />;
  }
  return <ModelPage snapshot={snapshot} modelId={id} />;
}

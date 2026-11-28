import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LabPage } from "@/components/lab/LabPage";
import { isPreviewBot, PreviewPage } from "@/lib/link-preview";
import { labPage, resolveLab, type LabPageData } from "@/lib/lab-page";
import { labPath } from "@/lib/lab-path";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";

function describe({ lab, indexName }: LabPageData): string {
  const best = lab.best ? `Its best model, ${lab.best.name}, is #${lab.best.rank} on ${indexName}` : `None of its models is ranked on ${indexName} yet`;
  return `${lab.name}'s ${lab.models} AI models on Priors. ${best}${lab.leads ? `, and it leads ${lab.leads} benchmarks` : ""}.`;
}

async function find(raw: string) {
  const snapshot = await loadSnapshot();
  const id = snapshot && resolveLab(snapshot, decodeURIComponent(raw));
  const data = id ? labPage(snapshot, id) : null;
  return data ? { id: id!, data } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const hit = await find((await params).id);
  if (!hit) return { title: "Page not found" };
  return pageMeta({ title: `${hit.data.lab.name} · AI lab`, description: describe(hit.data), path: labPath(hit.id) });
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id, hit = await find(raw);
  if (!hit) notFound();
  // Any spelling of the lab (z-ai, glm, Zhipu) lands on its one page.
  if (decodeURIComponent(raw) !== hit.id) permanentRedirect(labPath(hit.id) as "/");
  if (await isPreviewBot()) return <PreviewPage title={`${hit.data.lab.name} · AI lab`} description={describe(hit.data)} href={labPath(hit.id)} />;
  return (
    <main className="min-h-screen">
      <SiteHeader current="models" />
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-10"><LabPage data={hit.data} /></div>
      <SiteFooter />
    </main>
  );
}

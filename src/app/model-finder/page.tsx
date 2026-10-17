import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { HeaderAccount } from "@/components/AccountMenu";
import { loadSnapshot } from "@/data/load";
import { buildModelFinder } from "@/lib/model-finder";
import { ModelFinder } from "@/components/model-finder/ModelFinder";
import { Wordmark } from "@/components/Wordmark";
import { SettingsButton } from "@/components/SiteSettings";
import { pageMeta } from "@/lib/site-meta";
import { SiteNav } from "@/components/SiteNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({
  title: "Model finder",
  description: "Find an AI model for your budget, using measured benchmarks for coding, knowledge, multimodal tasks, and overall ability.",
  path: "/model-finder",
});

export default async function ModelFinderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [snapshot, params] = await Promise.all([loadSnapshot(), searchParams]);
  const budget = typeof params.budget === "string" ? Number(params.budget) : 100;
  return <main className="min-h-dvh">
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
      <span className="sm:hidden w-full"><SiteNav /></span>
    </header>
    {snapshot ? <ModelFinder data={buildModelFinder(snapshot)} initialGroup={typeof params.use === "string" ? params.use : "overall"} initialBudget={Number.isFinite(budget) ? Math.round(Math.max(0, Math.min(100, budget))) : 100} initialMix={typeof params.mix === "string" ? params.mix : undefined} /> : <p className="p-8 text-ink-2">Model data is temporarily unavailable.</p>}
    <SiteFooter />
  </main>;
}

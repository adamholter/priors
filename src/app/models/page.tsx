import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { Wordmark } from "@/components/Wordmark";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { HeaderAccount } from "@/components/AccountMenu";
import { SettingsButton } from "@/components/SiteSettings";
import { ModelDirectory } from "@/components/model/ModelDirectory";
import { modelDirectory } from "@/lib/model-directory";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Models", description: "Search every AI model Priors tracks, by lab: its rank, release date, how many benchmarks measure it and its API price. Each has its own page with every score.", path: "/models" });

export default async function Page() {
  const snapshot = await loadSnapshot();
  const { items, indexName } = snapshot ? modelDirectory(snapshot) : { items: [], indexName: "General frontier" };
  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
        <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav current="models" /></span></div>
        <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
        <span className="sm:hidden w-full"><SiteNav current="models" /></span>
      </header>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-10 grid gap-8">
        <div>
          <h1 className="text-[38px] leading-tight">Models</h1>
          <p className="text-[14.5px] text-ink-2 mt-2 max-w-[66ch]">Every model Priors has benchmark results for. Each has its own page with every score, by reasoning effort, and what it costs on the plans that sell it.</p>
        </div>
        {items.length ? <ModelDirectory items={items} indexName={indexName} /> : <p className="text-ink-2">Model data is temporarily unavailable.</p>}
      </div>
      <SiteFooter />
    </main>
  );
}

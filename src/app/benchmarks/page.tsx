import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { SiteFooter } from "@/components/SiteFooter";
import { BenchmarkDirectory } from "@/components/benchmark/BenchmarkDirectory";
import { directoryItems, starIds } from "@/lib/benchmark-page";
import { benchmarkQuality } from "@/onboarding/quality";
import { benchmarkCommunity } from "@/lib/benchmark-community";
import { pageMeta } from "@/lib/site-meta";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Benchmarks", description: "Search every benchmark Priors tracks. Each has its own leaderboard, its published extras, and a cost chart adjusted for subscription plans.", path: "/benchmarks" });

export default async function Page() {
  const snapshot = await loadSnapshot();
  const community = await benchmarkCommunity(snapshot ? starIds(snapshot) : []);
  const items = snapshot ? directoryItems(snapshot, new Map(benchmarkQuality(snapshot).map((q) => [q.id, q])), community) : [];
  return (
    <main className="min-h-screen">
      <SiteHeader current="benchmarks" />
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-10 grid gap-8">
        <div>
          <h1 className="text-[38px] leading-tight">Benchmarks</h1>
          <p className="text-[14.5px] text-ink-2 mt-2 max-w-[66ch]">Every benchmark has its own leaderboard and everything its publisher releases beyond the score. Where one measures cost per task, Priors adjusts it for subscription plans, so you see what a model costs to actually use.</p>
        </div>
        <BenchmarkDirectory items={items} />
      </div>
      <SiteFooter />
    </main>
  );
}

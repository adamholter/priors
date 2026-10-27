import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { Wordmark } from "@/components/Wordmark";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { HeaderAccount } from "@/components/AccountMenu";
import { SettingsButton } from "@/components/SiteSettings";
import { BenchmarkDirectory } from "@/components/benchmark/BenchmarkDirectory";
import { directoryItems } from "@/lib/benchmark-page";
import { qualityOf } from "@/agent/solver";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Benchmarks", description: "Search every benchmark Priors tracks. Each has its own leaderboard, its published extras, and a cost chart adjusted for subscription plans.", path: "/benchmarks" });

export default async function Page() {
  const convex = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [snapshot, pages] = await Promise.all([
    loadSnapshot(),
    convex ? new ConvexHttpClient(convex).query(api.profiles.explore, {}).catch(() => []) : Promise.resolve([]),
  ]);
  const items = snapshot ? directoryItems(snapshot, qualityOf(snapshot), pages) : [];
  const shown = items.filter((x) => !x.superseded && !x.variantOf).length;
  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span></header>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-8">
        <div>
          <h1 className="text-[38px] leading-tight">Benchmarks</h1>
          <p className="text-[14.5px] text-ink-2 mt-2 max-w-[66ch]">{shown} benchmarks, each with its own leaderboard and everything its publisher releases beyond the score. Where a benchmark measures cost per task, Priors adjusts it for subscription plans, so you see what a model costs to actually use.</p>
        </div>
        <BenchmarkDirectory items={items} />
      </div>
      <SiteFooter />
    </main>
  );
}

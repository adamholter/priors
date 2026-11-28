import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LabList } from "@/components/lab/LabList";
import { labDirectory } from "@/lib/lab-page";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Labs", description: "Every AI lab Priors tracks: its best-ranked model, how many of its models are ranked, and how many benchmarks it leads. Each lab has its own page.", path: "/labs" });

export default async function Page() {
  const snapshot = await loadSnapshot();
  const { labs, indexName } = snapshot ? labDirectory(snapshot) : { labs: [], indexName: "General frontier" };
  return (
    <main className="min-h-screen">
      <SiteHeader current="models" />
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-10 grid gap-8">
        <div className="grid gap-2">
          <h1 className="text-[38px] leading-tight">Labs</h1>
          <p className="text-[13.5px] text-ink-2 max-w-[70ch]">Ranked by each lab&apos;s best model on {indexName}. &ldquo;First on&rdquo; counts the benchmarks where its best model beats every other lab&apos;s best.</p>
        </div>
        {labs.length ? <LabList labs={labs} indexName={indexName} /> : <p className="text-ink-2">Lab data is temporarily unavailable.</p>}
      </div>
      <SiteFooter />
    </main>
  );
}

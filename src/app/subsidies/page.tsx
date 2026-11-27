import type { Metadata } from "next";
import { HeaderAccount } from "@/components/AccountMenu";
import { PlanSubsidies } from "@/components/PlanSubsidies";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/Wordmark";
import { loadSnapshot } from "@/data/load";
import { subsidySellers } from "@/lib/model-availability";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Plan subsidies", description: "How much API-priced usage each AI subscription gives per dollar, model by model.", path: "/subsidies" });

export default async function Subsidies() {
  const snapshot = await loadSnapshot();
  const sellers = snapshot ? subsidySellers(snapshot) : [];
  return <main className="min-h-dvh">
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:min-h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
      <span className="sm:hidden w-full"><SiteNav mobile /></span>
    </header>
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10">
      <h1 className="text-[36px] leading-tight">Plan subsidies</h1>
      <p className="text-ink-2 text-[14px] mt-1 mb-8">API value per dollar on each plan.</p>
      {sellers.length ? <PlanSubsidies sellers={sellers} labColors={Object.fromEntries((snapshot?.labs ?? []).map((l) => [l.id, l.color]))} /> : <p className="cap py-16 text-center">No plan data right now.</p>}
    </div>
    <SiteFooter />
  </main>;
}

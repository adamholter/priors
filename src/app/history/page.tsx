import type { Metadata } from "next";
import { HistoryRace } from "@/components/HistoryRace";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Rankings through time · Priors", robots: { index: false, follow: false } };

/** Not linked from anywhere: the top 20 on every snapshot date, played back in time. `?video=1` is the bare stage the video render captures. */
export default async function History({ searchParams }: { searchParams: Promise<{ video?: string }> }) {
  if ((await searchParams).video) return <HistoryRace video />;
  return <main className="min-h-dvh">
    <SiteHeader />
    <HistoryRace />
  </main>;
}

import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { SettingsButton } from "@/components/SiteSettings";
import { HistoryRace } from "@/components/HistoryRace";

export const metadata: Metadata = { title: "Rankings through time · Priors", robots: { index: false, follow: false } };

/** Not linked from anywhere: the top 20 on every snapshot date, played back in time. `?video=1` is the bare stage the video render captures. */
export default async function History({ searchParams }: { searchParams: Promise<{ video?: string }> }) {
  if ((await searchParams).video) return <HistoryRace video />;
  return <main className="min-h-dvh">
    <header className="flex items-center gap-5 px-4 sm:px-8 h-14 border-b hairline">
      <Wordmark />
      <span className="ml-auto"><SettingsButton /></span>
    </header>
    <HistoryRace />
  </main>;
}

import Link from "next/link";
import { SettingsButton, SiteSettingsPanel } from "@/components/SiteSettings";
import { Wordmark } from "@/components/Wordmark";
import { pageMeta } from "@/lib/site-meta";

export const metadata = { ...pageMeta({ title: "Settings", description: "Advanced settings for this device: theme, mode and update notices.", path: "/settings" }), robots: { index: false, follow: false } };

/** Advanced settings for this device. Not in any menu: a page owner's settings link here, and so can anyone who knows the address. */
export default function SettingsPage() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-6 px-4 sm:px-8 h-14 border-b hairline"><Wordmark /><Link href="/builder" className="text-grey text-[13px] hover:text-ink">Builder</Link><span className="ml-auto"><SettingsButton /></span></header>
      <article className="max-w-[688px] mx-auto px-4 sm:px-8 py-10">
        <h1 className="text-[36px] mb-2">Settings</h1>
        <p className="cap mb-8">Saved in this browser.</p>
        <SiteSettingsPanel />
      </article>
    </main>
  );
}

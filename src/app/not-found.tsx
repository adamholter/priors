import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SettingsButton } from "@/components/SiteSettings";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Page not found", robots: { index: false } };

/** Any address that leads nowhere: a mistyped handle, a model that left the data, a broken link. */
export default function NotFound() {
  return <main className="min-h-dvh">
    <header className="flex items-center gap-5 px-4 sm:px-8 h-14 border-b hairline">
      <Wordmark />
      <SiteNav />
      <span className="ml-auto"><SettingsButton /></span>
    </header>
    <div className="max-w-[640px] mx-auto px-4 sm:px-8 py-16 sm:py-24 grid gap-4">
      <p className="cap">404</p>
      <h1 className="text-[32px] sm:text-[36px] leading-tight">Nothing at this address</h1>
      <p className="text-ink-2 text-[15px] max-w-[52ch]">The page may have been renamed or removed, or the link may be incomplete. Published rankings are listed on Explore.</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <Link href="/explore" className="btn">Explore rankings</Link>
        <Link href="/rank" className="btn-quiet">Rank models · 1 min</Link>
        <Link href="/builder" className="btn-quiet">Open the builder</Link>
      </div>
    </div>
  </main>;
}

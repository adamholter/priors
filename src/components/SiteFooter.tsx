import Link from "next/link";
import { SupportLink } from "./SupportLink";
import { Wordmark } from "./Wordmark";

/** The foot of the app's own pages: the wordmark and the site-level links people look for at the bottom. */
export function SiteFooter() {
  return <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-8 pb-10 pt-4 max-w-[1500px] border-t border-hair mx-4 sm:mx-8 mt-6">
    <Wordmark size={20} />
    <nav aria-label="Footer" className="flex items-center gap-4 cap">
      <SupportLink from="footer" className="support-link support-link-foot" />
      <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      <Link href="/skill" className="hover:text-ink">Agent skill</Link>
      <Link href="/cli" className="hover:text-ink">CLI and MCP</Link>
      <Link href="/import" className="hover:text-ink">Import</Link>
    </nav>
  </footer>;
}

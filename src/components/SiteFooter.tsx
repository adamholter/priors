import Link from "next/link";
import { SupportLink } from "./SupportLink";
import { Wordmark } from "./Wordmark";

/**
 * The foot of the app's own pages: the wordmark and the site-level links people look for at the bottom.
 * Tools is the one door to the agent skill, the CLI, the MCP server, import and export; Request asks for a benchmark or a feature.
 */
export function SiteFooter() {
  return <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-8 pb-10 pt-4 max-w-[1500px] border-t border-hair mx-4 sm:mx-8 mt-6">
    <Wordmark size={20} />
    <nav aria-label="Footer" className="flex items-center gap-4 cap">
      <SupportLink from="footer" className="support-link support-link-foot" />
      <Link prefetch={false} href="/privacy" className="hover:text-ink">Privacy</Link>
      <Link prefetch={false} href="/benchmarks" className="hover:text-ink">Benchmarks</Link>
      <Link prefetch={false} href="/tools" className="hover:text-ink">Tools</Link>
      <Link prefetch={false} href="/request" className="hover:text-ink">Request</Link>
    </nav>
  </footer>;
}

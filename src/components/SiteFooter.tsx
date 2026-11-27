import Link from "next/link";
import {
  IconArrowsLeftRight, IconBox, IconCoin, IconLock, IconMathFunction, IconMessageReport, IconScale, IconSearch, IconSparkles, IconTerminal2, IconTimeline, IconTool, IconTrophy, IconUpload,
} from "@tabler/icons-react";
import { SITE_PLACES } from "./site-places";
import { SupportLink } from "./SupportLink";
import { Wordmark } from "./Wordmark";

type Icon = typeof IconCoin;
/** Every page that is not one of the header's five places, in the groups the footer shows. Support is the one link in color. */
const GROUPS: { title: string; links: ({ href: string; label: string; icon: Icon } | "support")[] }[] = [
  { title: "Browse", links: [{ href: "/subsidies", label: "Plan subsidies", icon: IconCoin }, { href: "/history", label: "Rankings through time", icon: IconTimeline }] },
  { title: "Community", links: [{ href: "/compare", label: "Compare rankings", icon: IconArrowsLeftRight }, { href: "/model-finder", label: "Model finder", icon: IconSearch }, { href: "/priorsbench", label: "PriorsBench", icon: IconTrophy }] },
  { title: "Build on Priors", links: [{ href: "/tools", label: "Tools", icon: IconTool }, { href: "/cli", label: "CLI and MCP", icon: IconTerminal2 }, { href: "/skill", label: "Agent skill", icon: IconSparkles }, { href: "/import", label: "Import data", icon: IconUpload }, { href: "/3d", label: "3D view", icon: IconBox }] },
  { title: "About", links: [{ href: "/methods/scoring", label: "How scores work", icon: IconMathFunction }, { href: "/benchmarks/methodology", label: "Benchmark quality", icon: IconScale }, "support", { href: "/request", label: "Report or request", icon: IconMessageReport }, { href: "/privacy", label: "Privacy", icon: IconLock }] },
];

/**
 * The foot of the app's own pages: the header's five places with the same icons, then every other page in four groups, so the bottom of
 * any page is a map of the site. Support Priors is in the brand blue so it stands out from the list.
 */
export function SiteFooter() {
  return <footer className="grid gap-8 px-4 sm:px-8 pt-8 pb-10 max-w-[1500px] border-t border-hair mx-4 sm:mx-8 mt-6">
    <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
      {SITE_PLACES.map((p) => <Link key={p.id} prefetch={false} href={p.href} className="inline-flex items-center gap-2 text-[14px] text-ink no-underline hover:underline">
        <p.icon size={18} stroke={1.6} aria-hidden="true" className="text-ink-2" />{p.label}</Link>)}
    </nav>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
      {GROUPS.map((g) => <nav key={g.title} aria-label={g.title} className="grid gap-2 content-start">
        <p className="cap mb-0.5">{g.title}</p>
        {g.links.map((l) => l === "support"
          ? <SupportLink key="support" from="footer" label="Support Priors" className="support-link support-link-foot text-[13px] gap-2" />
          : <Link key={l.href} prefetch={false} href={l.href as "/"} className="inline-flex items-center gap-2 text-[13px] text-ink-2 no-underline hover:text-ink">
            <l.icon size={15} stroke={1.6} aria-hidden="true" className="text-grey" />{l.label}</Link>)}
      </nav>)}
    </div>
    <Wordmark size={18} />
  </footer>;
}
